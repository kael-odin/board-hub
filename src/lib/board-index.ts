'use client'

import { toBase64Utf8, readTextFileFromRepo } from '@/lib/github-client'

import type { BoardIndexItem } from '@/app/boards/types'

export type { BoardIndexItem } from '@/app/boards/types'

/** 看板索引文件在仓库中的路径 */
export const BOARDS_INDEX_PATH = 'public/boards/index.json'

async function readIndex(token: string, owner: string, repo: string, branch: string): Promise<BoardIndexItem[]> {
	try {
		const txt = await readTextFileFromRepo(token, owner, repo, BOARDS_INDEX_PATH, branch)
		if (txt) return JSON.parse(txt) as BoardIndexItem[]
	} catch {
		// 索引缺失或损坏时不阻塞发布，从空列表开始
	}
	return []
}

/** 新增或更新一条看板索引，返回新的 index.json 文本 */
export async function prepareBoardsIndex(token: string, owner: string, repo: string, item: BoardIndexItem, branch: string): Promise<string> {
	const list = await readIndex(token, owner, repo, branch)
	const map = new Map<string, BoardIndexItem>(list.map(i => [i.slug, i]))
	map.set(item.slug, item)
	const next = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
	return JSON.stringify(next, null, 2)
}

/** 从索引里移除若干看板，返回新的 index.json 文本 */
export async function removeBoardsFromIndex(token: string, owner: string, repo: string, slugs: string[], branch: string): Promise<string> {
	const list = await readIndex(token, owner, repo, branch)
	const slugSet = new Set(slugs.filter(Boolean))
	if (slugSet.size === 0) {
		return JSON.stringify(list, null, 2)
	}
	const next = list.filter(item => !slugSet.has(item.slug))
	return JSON.stringify(next, null, 2)
}

export async function removeBoardFromIndex(token: string, owner: string, repo: string, slug: string, branch: string): Promise<string> {
	return removeBoardsFromIndex(token, owner, repo, [slug], branch)
}

/** 从索引里推导出所有分类（不再单独维护 categories.json） */
export function deriveCategories(list: BoardIndexItem[]): string[] {
	const set = new Set<string>()
	for (const item of list) {
		if (item.category) set.add(item.category)
	}
	return Array.from(set).sort()
}
