import useSWR from 'swr'
import type { BoardIndexItem } from '@/app/boards/types'

export type { BoardIndexItem } from '@/app/boards/types'

const fetcher = async (url: string): Promise<BoardIndexItem[]> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		if (res.status === 401) return [] // 未登录：服务端本来就不会给内容
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

/**
 * 看板列表。hidden 过滤在服务端按角色完成：
 * admin 看到全部，viewer 只看到非隐藏的，未登录拿到空列表。
 */
export function useBoardIndex() {
	const { data, error, isLoading } = useSWR<BoardIndexItem[]>('/api/boards', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		items: data || [],
		loading: isLoading,
		error
	}
}

/** 取最新的一条看板（按日期倒序），用于首页卡片 */
export function useLatestBoard() {
	const { items, loading, error } = useBoardIndex()

	// 用展开拷贝排序，避免直接 sort 改动 SWR 缓存里的数组
	const latest = items.length > 0 ? [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null

	return {
		board: latest,
		loading,
		error
	}
}
