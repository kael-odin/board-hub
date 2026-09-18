import type { BoardConfig } from '@/app/boards/types'

export type { BoardConfig } from '@/app/boards/types'

export type LoadedBoard = {
	slug: string
	config: BoardConfig
	/** 看板本体的完整 HTML 源码 */
	html: string
	cover?: string
}

/**
 * 从 public/boards/{slug} 加载看板数据
 * 查看页和编辑页都会用到
 */
export async function loadBoard(slug: string): Promise<LoadedBoard> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	// 读取 config.json（缺失时降级为空对象）
	let config: BoardConfig = {}
	const configRes = await fetch(`/boards/${encodeURIComponent(slug)}/config.json`)
	if (configRes.ok) {
		try {
			config = await configRes.json()
		} catch {
			config = {}
		}
	}

	// 读取看板本体 index.html
	const htmlRes = await fetch(`/boards/${encodeURIComponent(slug)}/index.html`)
	if (!htmlRes.ok) {
		throw new Error('Board not found')
	}
	const html = await htmlRes.text()

	return {
		slug,
		config,
		html,
		cover: config.cover
	}
}
