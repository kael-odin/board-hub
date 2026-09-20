'use client'

import { useWriteStore } from './stores/write-store'
import { usePreviewStore } from './stores/preview-store'
import { WriteEditor } from './components/editor'
import { WriteSidebar } from './components/sidebar'
import { WriteActions } from './components/actions'
import { WritePreview } from './components/preview'
import { WriteLivePreview } from './components/live-preview'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clearDraft, draftKey, loadDraft } from './services/draft-store'
import { useAuthStore } from '@/hooks/use-auth'

/**
 * 编辑页（仅管理员）。新建与编辑共用同一个路由：
 *   /write            新建
 *   /write?slug=xxx   编辑已有看板
 *
 * 用查询参数而不是 /write/[slug] 动态段，是因为内容由服务端按需返回，
 * 客户端路由在查询参数下整站只需要一个 /write 页面。
 */
export default function WritePage() {
	const { reset } = useWriteStore()
	const router = useRouter()
	const { role, hydrated } = useAuthStore()

	// 查看者 / 未登录不允许进入编辑页
	useEffect(() => {
		if (hydrated && role !== 'admin') {
			router.replace('/login?next=/write')
		}
	}, [hydrated, role, router])

	useEffect(() => {
		const slug = new URLSearchParams(window.location.search).get('slug')

		if (slug) {
			// 编辑模式：加载失败时 loadBoardForEdit 内部已经 toast 过
			useWriteStore
				.getState()
				.loadBoardForEdit(slug)
				.catch(() => {})
			return
		}

		// 新建模式：尝试恢复上次未发布的草稿
		;(async () => {
			const draft = loadDraft(draftKey('create', null))
			if (draft && (draft.form.title || draft.form.content || draft.form.snapshot)) {
				const { filesDropped } = await useWriteStore.getState().restoreFromDraft(draft)
				toast.success('已恢复上次未发布的草稿', {
					description: `保存于 ${new Date(draft.savedAt).toLocaleString('zh-CN')}`,
					action: {
						label: '清空重写',
						onClick: () => {
							clearDraft(draftKey('create', null))
							useWriteStore.getState().reset()
						}
					}
				})
				if (filesDropped) toast.info('草稿中的部分大图未能保存，请在正文中重新插入')
			} else {
				reset()
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const { isPreview, closePreview } = usePreviewStore()

	// 会话未确认或非管理员时不渲染编辑器，等待重定向
	if (!hydrated || role !== 'admin') {
		return <div className='text-secondary grid h-[60vh] place-items-center text-sm'>验证权限中…</div>
	}

	return isPreview ? (
		<WritePreview onClose={closePreview} />
	) : (
		<>
			<div className='flex h-full flex-col items-center justify-center gap-6 px-4 pt-24 pb-12 sm:px-6 lg:flex-row lg:items-start'>
				<WriteEditor />
				<WriteSidebar />
				<WriteLivePreview />
			</div>

			<WriteActions />
		</>
	)
}
