import { useCallback } from 'react'
import { readFileAsText } from '@/lib/file-utils'
import { toast } from 'sonner'
import { pushBoard } from '../services/push-board'
import { deleteBoard } from '../services/delete-board'
import { useWriteStore } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'
import { clearDraft, draftKey } from '../services/draft-store'

export function usePublish() {
	const { loading, setLoading, form, cover, images, mode, originalSlug } = useWriteStore()
	const { isAuth, setPrivateKey } = useAuthStore()

	const onChoosePrivateKey = useCallback(
		async (file: File) => {
			const pem = await readFileAsText(file)
			setPrivateKey(pem)
		},
		[setPrivateKey]
	)

	const onPublish = useCallback(async () => {
		try {
			setLoading(true)
			await pushBoard({
				form,
				cover,
				images,
				mode,
				originalSlug
			})

			// 发布成功后清除对应本地草稿（编辑模式同时清掉可能残留的 new 草稿）
			clearDraft(draftKey(mode, originalSlug))
			clearDraft(draftKey('create', null))
			// 成功提示由 pushBoard 内部统一发出，这里不再重复弹一次
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, setLoading])

	const onDelete = useCallback(async () => {
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return
		}
		try {
			setLoading(true)
			await deleteBoard(targetSlug)
			clearDraft(draftKey('edit', targetSlug))
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading])

	return {
		isAuth,
		loading,
		onChoosePrivateKey,
		onPublish,
		onDelete
	}
}
