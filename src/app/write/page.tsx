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

export default function WritePage() {
	const { form, cover, reset } = useWriteStore()

	useEffect(() => {
		;(async () => {
			const draft = loadDraft(draftKey('create', null))
			if (draft && (draft.form.title || draft.form.html)) {
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

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	return isPreview ? (
		<WritePreview form={form} coverPreviewUrl={coverPreviewUrl} onClose={closePreview} />
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
