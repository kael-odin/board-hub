import { normalizeBoardType, type BoardConfig, type BoardSource, type BoardType } from '@/app/boards/types'

export type { BoardConfig } from '@/app/boards/types'

export type LoadedBoard = {
	slug: string
	type: BoardType
	config: BoardConfig
	/** html / markdown 类型的正文文本 */
	text: string
	/** sheet 类型的快照数据（Univer IWorkbookData），未加载时为 null */
	snapshot: unknown | null
	/** image 类型的图片列表 */
	images: string[]
	cover?: string
	/** 原始数据附件（.xlsx 等），未附加时为 null */
	source: BoardSource | null
}

/**
 * 从 /api/boards/<slug> 加载看板数据（服务端鉴权出库，hidden 只对 admin 可见）。
 * 404 = 不存在或无权查看。
 */
export async function loadBoard(slug: string): Promise<LoadedBoard> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	const res = await fetch(`/api/boards/${encodeURIComponent(slug)}`, { cache: 'no-store' })
	if (!res.ok) {
		throw new Error(res.status === 404 ? 'Board not found' : `加载失败（${res.status}）`)
	}
	const data = (await res.json()) as {
		type: BoardType
		config: BoardConfig
		text: string
		snapshot: unknown | null
		images?: string[]
		cover?: string
		source?: BoardSource | null
	}

	return {
		slug,
		type: normalizeBoardType(data.type),
		config: data.config || {},
		text: data.text || '',
		snapshot: data.snapshot ?? null,
		images: Array.isArray(data.images) ? data.images : [],
		cover: data.cover,
		source: data.source || null
	}
}
