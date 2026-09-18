import type { BoardType } from '@/app/boards/types'

export type PublishForm = {
	slug: string
	title: string
	/** 内容类型，决定发布时写哪个文件、用什么编辑器 */
	type: BoardType

	/** html / markdown 类型的正文文本 */
	content: string
	/** sheet 类型的快照数据（Univer IWorkbookData） */
	snapshot: unknown | null

	tags: string[]
	date: string
	summary: string
	hidden?: boolean
	category?: string
}

export type ImageItem = { id: string; type: 'url'; url: string } | { id: string; type: 'file'; file: File; previewUrl: string; filename: string; hash?: string; dataUrl?: string }
