'use client'

import useSWR from 'swr'
import { deriveCategories } from '@/lib/board-index'
import type { BoardIndexItem } from '@/app/boards/types'

const fetcher = async (url: string): Promise<BoardIndexItem[]> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) return []
	const data = await res.json()
	return Array.isArray(data) ? (data as BoardIndexItem[]) : []
}

/**
 * 看板分类列表。
 * 不再单独维护 categories.json —— 直接从看板索引的 category 字段推导，
 * 少一个需要同步的文件。
 */
export function useCategories() {
	const { data, error, isLoading } = useSWR<BoardIndexItem[]>('/api/boards', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		categories: deriveCategories(data ?? []),
		loading: isLoading,
		error
	}
}
