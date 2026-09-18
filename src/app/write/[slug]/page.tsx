'use client'

import { useParams } from 'next/navigation'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { useLoadBoard } from '../hooks/use-load-board'
import { WriteEditor } from '../components/editor'
import { WriteSidebar } from '../components/sidebar'
import { WriteActions } from '../components/actions'
import { WritePreview } from '../components/preview'
import { WriteLivePreview } from '../components/live-preview'

export default function EditBoardPage() {
	const params = useParams() as { slug?: string }
	const slug = params?.slug || ''

	const { form, cover } = useWriteStore()
	const { isPreview, closePreview } = usePreviewStore()
	const { loading } = useLoadBoard(slug)

	const coverPreviewUrl = cover ? (cover.type === 'url' ? cover.url : cover.previewUrl) : null

	if (loading) {
		return <div className='text-secondary flex h-screen items-center justify-center text-sm'>加载中...</div>
	}

	if (!slug) {
		return <div className='flex h-screen items-center justify-center text-sm text-red-500'>无效的看板 ID</div>
	}

	return isPreview ? (
		<WritePreview onClose={closePreview} slug={slug} />
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
