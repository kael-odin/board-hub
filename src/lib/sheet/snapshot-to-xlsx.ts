import * as XLSX from 'xlsx'
import { CellValueType, type IWorkbookData, type IWorksheetData } from '@univerjs/core'

/** Univer 单元格 → SheetJS 单元格 */
function fromUniverCell(cell: any): XLSX.CellObject | null {
	if (cell == null) return null

	const hasFormula = typeof cell.f === 'string' && cell.f.length > 0
	const v = cell.v

	if (v == null && !hasFormula) return null

	const out: any = {}

	if (hasFormula) {
		// SheetJS 的 f 不带前导 =
		out.f = String(cell.f).replace(/^=/, '')
	}

	if (v == null || v === '') {
		// 只有公式没有缓存值，占位成空字符串，保证 Excel 打开时能重算
		out.t = 's'
		out.v = ''
		return out
	}

	switch (cell.t) {
		case CellValueType.NUMBER:
			out.t = 'n'
			out.v = Number(v)
			break
		case CellValueType.BOOLEAN:
			out.t = 'b'
			out.v = Boolean(v)
			break
		case CellValueType.STRING:
		case CellValueType.FORCE_STRING:
		default:
			out.t = 's'
			out.v = String(v)
			break
	}

	return out
}

/**
 * 把 Univer 工作簿快照导出成 .xlsx 二进制，供用户下载。
 *
 * ⚠️ 与导入方向同理：只导出「值 + 公式」，不导出样式、条件格式、图表。
 */
export function snapshotToXlsx(snapshot: IWorkbookData): ArrayBuffer {
	const wb = XLSX.utils.book_new()
	const sheets = (snapshot?.sheets || {}) as Record<string, IWorksheetData>
	const order = snapshot?.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(sheets)

	for (const sheetId of order) {
		const sheet = sheets[sheetId]
		if (!sheet) continue

		const ws: XLSX.WorkSheet = {}
		let maxRow = -1
		let maxCol = -1

		const cellData = (sheet.cellData || {}) as Record<string, Record<string, any>>
		for (const rowKey of Object.keys(cellData)) {
			const r = Number(rowKey)
			if (!Number.isFinite(r)) continue
			const row = cellData[rowKey]
			if (!row) continue

			for (const colKey of Object.keys(row)) {
				const c = Number(colKey)
				if (!Number.isFinite(c)) continue
				const converted = fromUniverCell(row[colKey])
				if (!converted) continue

				ws[XLSX.utils.encode_cell({ r, c })] = converted
				if (r > maxRow) maxRow = r
				if (c > maxCol) maxCol = c
			}
		}

		if (maxRow >= 0 && maxCol >= 0) {
			ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
		} else {
			ws['!ref'] = 'A1'
		}

		// 工作表名在 Excel 里不能超过 31 字符，也不能含 : \ / ? * [ ]
		const safeName = (sheet.name || `Sheet${order.indexOf(sheetId) + 1}`).replace(/[:\\/?*[\]]/g, '_').slice(0, 31)
		XLSX.utils.book_append_sheet(wb, ws, safeName)
	}

	if (wb.SheetNames.length === 0) {
		XLSX.utils.book_append_sheet(wb, { '!ref': 'A1' } as XLSX.WorkSheet, 'Sheet1')
	}

	return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}
