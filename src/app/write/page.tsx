'use client'

import { useWriteStore } from './stores/write-store'
import { usePreviewStore } from './stores/preview-store'
import { WriteEditor } from './components/editor'
import { WriteSidebar } from './components/sidebar'
import { WriteActions } from './components/actions'
import { WritePreview } from './components/preview'
import { WriteLivePreview } from './components/live-preview'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { clearDraft, draftKey, loadDraft } from './services/draft-store'

/**
 * 编辑页。新建与编辑共用同一个路由：
 *   /write            新建
 *   /write?slug=xxx   编辑已有看板
 *
 * 用查询参数而不是 /write/[slug] 动态段，是因为站点是静态导出
 * （output: 'export'），动态路由必须在构建时穷举所有 slug —— 而看板
 * 是发布后才产生的，做不到。查询参数下整站只需要一个 /write 静态页。
 */
export default function WritePage() {
	const { reset } = useWriteStore()

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
