import useSWR from 'swr'
import { useAuthStore } from '@/hooks/use-auth'
import { withBase } from '@/lib/asset-path'
import type { BoardIndexItem } from '@/app/boards/types'

export type { BoardIndexItem } from '@/app/boards/types'

// 改进 fetcher，抛出状态码以便处理 404
const fetcher = async (url: string) => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

/** 读取看板列表。未登录时自动过滤掉标记为 hidden 的看板。 */
export function useBoardIndex() {
	const { isAuth } = useAuthStore()
	const { data, error, isLoading } = useSWR<BoardIndexItem[]>(withBase('/boards/index.json'), fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	let result = data || []
	if (!isAuth) {
		result = result.filter(item => !item.hidden)
	}

	return {
		items: result,
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
