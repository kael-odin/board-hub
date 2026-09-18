'use client'

import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore, initLivePreview } from '../stores/preview-store'
import { BoardBody } from '@/components/board-body'
import { useWriteData } from '../hooks/use-write-data'

/** 编辑器右侧分屏实时预览（仅超宽屏显示，可用按钮开关） */
export function WriteLivePreview() {
	const { form } = useWriteStore()
	const livePreview = usePreviewStore(state => state.livePreview)
	const toggleLivePreview = usePreviewStore(state => state.toggleLivePreview)
	const previewData = useWriteData()

	useEffect(() => {
		initLivePreview()
	}, [])

	const dateText = useMemo(() => {
		const d = form.date ? dayjs(form.date) : dayjs()
		return d.isValid() ? d.format('YYYY年 M月 D日') : ''
	}, [form.date])

	if (!livePreview) return null

	return (
		<motion.aside
			initial={{ opacity: 0, x: 24 }}
			animate={{ opacity: 1, x: 0 }}
			className='bg-article sticky top-24 hidden h-[calc(100vh-9rem)] w-[520px] shrink-0 flex-col overflow-hidden rounded-[40px] border shadow 2xl:flex'>
			<div className='flex items-center justify-between gap-3 border-b px-6 py-4'>
				<div className='flex min-w-0 items-center gap-3'>
					<span className='text-secondary shrink-0 text-xs'>实时预览</span>
					<span className='truncate text-xs font-medium'>{form.title || '无标题'}</span>
					<span className='text-secondary shrink-0 text-xs'>{dateText}</span>
				</div>
				<button onClick={toggleLivePreview} className='text-secondary shrink-0 text-xs transition-colors hover:text-gray-600 dark:text-gray-300'>
					关闭
				</button>
			</div>
			{/* 与线上查看页共用同一套渲染器，避免预览和实际效果不一致 */}
			<div className='min-h-0 flex-1 bg-white'>
				<BoardBody
					type={form.type}
					content={previewData.content}
					snapshot={form.snapshot}
					images={previewData.galleryImages}
					title={previewData.title}
					readOnly
				/>
			</div>
		</motion.aside>
	)
}
