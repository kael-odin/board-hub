import { normalizeBoardType, type BoardConfig, type BoardType } from '@/app/boards/types'
import { withBase } from '@/lib/asset-path'

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
}

/**
 * 从 public/boards/{slug} 加载看板数据。
 * 先读 config.json 拿到 type，再按类型取对应的正文文件。
 */
export async function loadBoard(slug: string): Promise<LoadedBoard> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	const base = withBase(`/boards/${encodeURIComponent(slug)}`)

	// config.json 缺失时降级为空对象（此时按 html 处理）
	let config: BoardConfig = {}
	const configRes = await fetch(`${base}/config.json`)
	if (configRes.ok) {
		try {
			config = (await configRes.json()) as BoardConfig
		} catch {
			config = {}
		}
	}

	const type = normalizeBoardType(config.type)

	let text = ''
	let snapshot: unknown | null = null
	const images: string[] = Array.isArray(config.images) ? [...config.images] : []

	if (type === 'html' || type === 'markdown') {
		const file = type === 'html' ? 'index.html' : 'index.md'
		const res = await fetch(`${base}/${file}`)
		if (!res.ok) {
			throw new Error('Board not found')
		}
		text = await res.text()
	} else if (type === 'sheet') {
		const res = await fetch(`${base}/sheet.json`)
		if (!res.ok) {
			throw new Error('Board not found')
		}
		snapshot = await res.json()
	}

	return {
		slug,
		type,
		config,
		text,
		snapshot,
		images,
		cover: config.cover
	}
}
