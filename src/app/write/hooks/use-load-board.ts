import { useEffect } from 'react'
import { useWriteStore } from '../stores/write-store'
import { toast } from 'sonner'

export function useLoadBoard(slug?: string) {
	const { loadBoardForEdit, loading } = useWriteStore()

	useEffect(() => {
		if (slug) {
			loadBoardForEdit(slug).catch(err => {
				console.error('Failed to load board:', err)
				toast.error('加载看板失败')
			})
		}
	}, [slug, loadBoardForEdit])

	return { loading }
}
