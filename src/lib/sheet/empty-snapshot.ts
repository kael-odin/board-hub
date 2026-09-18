import { CellValueType, LocaleType, type IWorkbookData, type IWorksheetData } from '@univerjs/core'

/** 生成一个短随机 id（Univer 内部只要求唯一，不要求特定格式） */
export function shortId(prefix = 's'): string {
	return `${prefix}${Math.random().toString(36).slice(2, 10)}`
}

export const DEFAULT_ROW_COUNT = 200
export const DEFAULT_COLUMN_COUNT = 26

/** 新建一个空工作簿快照 */
export function createEmptySnapshot(name = '未命名表格'): IWorkbookData {
	const sheetId = shortId('sheet')

	// Univer 的 IWorksheetData 声明了一批必填字段（tabColor/freeze/zoomRatio 等），
	// 但运行时它们都有默认值，这里只需给出真正影响显示的那几个即可
	const sheet = {
		id: sheetId,
		name: 'Sheet1',
		rowCount: DEFAULT_ROW_COUNT,
		columnCount: DEFAULT_COLUMN_COUNT,
		cellData: {},
		defaultColumnWidth: 88,
		defaultRowHeight: 24
	} as unknown as IWorksheetData

	return {
		id: shortId('wb'),
		name,
		appVersion: '0.25.1',
		locale: LocaleType.ZH_CN,
		styles: {},
		sheetOrder: [sheetId],
		sheets: { [sheetId]: sheet }
	}
}

export { CellValueType }
