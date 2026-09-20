/**
 * 看板内容类型 —— 决定用什么渲染器展示、用什么编辑器修改
 *
 * - html     ：一段完整的 HTML 文档，用 iframe 隔离渲染
 * - markdown ：Markdown 文本，走站点的 markdown 渲染链
 * - image    ：图片集合，图墙 + 灯箱
 * - sheet    ：电子表格，存 Univer 快照 JSON，可在线编辑
 */
export type BoardType = 'html' | 'markdown' | 'image' | 'sheet'

export const BOARD_TYPES: BoardType[] = ['html', 'markdown', 'image', 'sheet']

export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
	html: 'HTML 看板',
	markdown: 'Markdown 文档',
	image: '图片',
	sheet: '电子表格'
}

/** 各类型对应的主文件名（存在 public/boards/<slug>/ 下） */
export const BOARD_ENTRY_FILES: Record<BoardType, string> = {
	html: 'index.html',
	markdown: 'index.md',
	image: 'config.json',
	sheet: 'sheet.json'
}

/** 原始数据附件 —— 存在 public/boards/<slug>/source.<ext>，config.json 里记元信息 */
export type BoardSource = {
	/** 仓库内文件名，如 source.xlsx */
	file: string
	/** 上传时的原始文件名，仅用于展示 */
	name?: string
	size?: number
}

/** 看板列表索引项 —— 存在 public/boards/index.json */
export type BoardIndexItem = {
	slug: string
	title: string
	/** 未指定时按 html 处理，兼容第一阶段已发布的内容 */
	type?: BoardType
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	/** 仅图片看板：图片列表（可选，用于卡片墙直接取首图当缩略图） */
	images?: string[]
}

/** 单个看板的元信息 —— 存在 public/boards/<slug>/config.json */
export type BoardConfig = {
	title?: string
	type?: BoardType
	tags?: string[]
	date?: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
	/** image 类型：图片列表（相对路径或外链） */
	images?: string[]
	/** 原始数据附件（如导入表格时的 .xlsx） */
	source?: BoardSource
}

/** 归一化类型：老数据没有 type 字段时按 html 处理 */
export function normalizeBoardType(type?: string): BoardType {
	return type === 'markdown' || type === 'image' || type === 'sheet' ? type : 'html'
}
