import type { BoardIndexItem } from '@/app/boards/types'

export type { BoardIndexItem } from '@/app/boards/types'

/** 看板索引在仓库中的路径（content/ 目录，须经鉴权 API 读取） */
export const BOARDS_INDEX_PATH = 'content/boards/index.json'

/** 在索引列表里新增或更新一条，返回新的列表（按日期倒序） */
export function upsertBoardItem(list: BoardIndexItem[], item: BoardIndexItem): BoardIndexItem[] {
	const map = new Map<string, BoardIndexItem>(list.map(i => [i.slug, i]))
	map.set(item.slug, item)
	return Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

/** 从索引里移除若干看板，返回新的列表 */
export function removeBoardItems(list: BoardIndexItem[], slugs: string[]): BoardIndexItem[] {
	const slugSet = new Set(slugs.filter(Boolean))
	return list.filter(item => !slugSet.has(item.slug))
}

/** 从索引里推导出所有分类（不再单独维护 categories.json） */
export function deriveCategories(list: BoardIndexItem[]): string[] {
	const set = new Set<string>()
	for (const item of list) {
		if (item.category) set.add(item.category)
	}
	return Array.from(set).sort()
}
