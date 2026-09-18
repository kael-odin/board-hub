import * as XLSX from 'xlsx'
import { CellValueType, LocaleType, type ICellData, type IWorkbookData, type IWorksheetData } from '@univerjs/core'
import { DEFAULT_COLUMN_COUNT, DEFAULT_ROW_COUNT, shortId } from './empty-snapshot'

/**
 * 把 Excel 单元格转成 Univer 单元格。
 *
 * ⚠️ 保真度说明：本适配层只搬运「值 + 公式 + 日期」，**不搬运样式**——
 * 字体、颜色、边框、条件格式、图表、透视表都会丢失。
 * 需要这些能力要接 Univer Pro 的服务端转换模块（商业授权 + 常驻服务）。
 */
function toUniverCell(cell: XLSX.CellObject): ICellData | null {
	if (cell == null) return null

	const out: ICellData = {}

	// 公式：SheetJS 的 f 不带前导 =，Univer 的 f 同样不带
	if (typeof cell.f === 'string' && cell.f.length > 0) {
		out.f = cell.f
	}

	// 有缓存值时一并带上，避免打开时公式尚未求值导致空白
	switch (cell.t) {
		case 'n': {
			// 日期在 cellDates:true 下会变成 Date，这里做成字符串，避免显示成 45500 这样的序列号
			if (cell.v instanceof Date) {
				const d = cell.v
				const hasTime = d.getHours() || d.getMinutes() || d.getSeconds()
				out.v = hasTime ? `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}` : d.toISOString().slice(0, 10)
				out.t = CellValueType.STRING
			} else {
				out.v = Number(cell.v)
				out.t = CellValueType.NUMBER
			}
			break
		}
		case 'b':
			out.v = Boolean(cell.v)
			out.t = CellValueType.BOOLEAN
			break
		case 'd':
			if (cell.v instanceof Date) {
				out.v = cell.v.toISOString().slice(0, 10)
			} else {
				out.v = String(cell.v ?? '')
			}
			out.t = CellValueType.STRING
			break
		case 'e':
			// 错误值（#REF! 之类）当作字符串保留，不要丢
			out.v = String(cell.w ?? cell.v ?? '')
			out.t = CellValueType.STRING
			break
		case 's':
		default:
			out.v = cell.v == null ? '' : String(cell.v)
			out.t = CellValueType.STRING
			break
	}

	// 完全没有内容的单元格不必占位
	if (out.v === '' && !out.f) return null

	return out
}

function sheetToWorksheet(ws: XLSX.WorkSheet, name: string, usedNames: Set<string>): IWorksheetData {
	const id = shortId('sheet')

	// 工作表名不能重复，也不能为空
	let sheetName = (name || 'Sheet').trim() || 'Sheet'
	while (usedNames.has(sheetName)) sheetName = `${sheetName}_1`
	usedNames.add(sheetName)

	const cellData: IWorksheetData['cellData'] = {}
	let maxRow = 0
	let maxCol = 0

	const rangeRef = ws['!ref']
	if (rangeRef) {
		const range = XLSX.utils.decode_range(rangeRef)
		for (let r = range.s.r; r <= range.e.r; r++) {
			const rowCells: Record<number, ICellData> = {}
			let rowHasContent = false

			for (let c = range.s.c; c <= range.e.c; c++) {
				const addr = XLSX.utils.encode_cell({ r, c })
				const cell = ws[addr] as XLSX.CellObject | undefined
				if (!cell) continue
				const converted = toUniverCell(cell)
				if (!converted) continue
				rowCells[c] = converted
				rowHasContent = true
				if (c > maxCol) maxCol = c
			}

			if (rowHasContent) {
				cellData[r] = rowCells
				if (r > maxRow) maxRow = r
			}
		}
	}

	// 同 empty-snapshot：Univer 声明的必填字段在运行时都有默认值，只给影响显示的那几个
	return {
		id,
		name: sheetName,
		rowCount: Math.max(maxRow + 50, DEFAULT_ROW_COUNT),
		columnCount: Math.max(maxCol + 10, 26) || DEFAULT_COLUMN_COUNT,
		cellData,
		defaultColumnWidth: 88,
		defaultRowHeight: 24
	} as unknown as IWorksheetData
}

/**
 * 解析 .xlsx / .xls / .csv 二进制，转换成 Univer 工作簿快照。
 * 转换后的快照会作为 sheet.json 提交到仓库。
 */
export function xlsxToSnapshot(data: ArrayBuffer, name: string): { snapshot: IWorkbookData; sheetCount: number } {
	const wb = XLSX.read(data, {
		type: 'array',
		cellDates: true, // 日期解析成 Date，便于转成可读字符串
		cellFormula: true,
		cellText: false,
		dense: false
	})

	const usedNames = new Set<string>()
	const sheets: Record<string, IWorksheetData> = {}
	const sheetOrder: string[] = []

	for (const sheetName of wb.SheetNames) {
		const ws = wb.Sheets[sheetName]
		if (!ws) continue
		const worksheet = sheetToWorksheet(ws, sheetName, usedNames)
		sheets[worksheet.id] = worksheet
		sheetOrder.push(worksheet.id)
	}

	// 一个 sheet 都没有时给一张空表，否则 Univer 打开会出错
	if (sheetOrder.length === 0) {
		const worksheet = sheetToWorksheet({}, 'Sheet1', usedNames)
		sheets[worksheet.id] = worksheet
		sheetOrder.push(worksheet.id)
	}

	return {
		snapshot: {
			id: shortId('wb'),
			name: name || '导入的表格',
			appVersion: '0.25.1',
			locale: LocaleType.ZH_CN,
			styles: {},
			sheetOrder,
			sheets
		},
		sheetCount: sheetOrder.length
	}
}
