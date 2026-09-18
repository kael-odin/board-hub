import { motion } from 'motion/react'
import { BoardFrame } from '@/components/board-frame'
import { useWriteData } from '../hooks/use-write-data'
import type { PublishForm } from '../types'

type WritePreviewProps = {
	form: PublishForm
	coverPreviewUrl: string | null
	onClose: () => void
	slug?: string
}

/** 全屏预览 —— 直接按最终呈现效果渲染看板 */
export function WritePreview({ form, onClose }: WritePreviewProps) {
	const previewData = useWriteData()
	return (
		<div>
			<div onClick={e => e.stopPropagation()}>
				<BoardFrame html={previewData.html} title={form.title || '看板预览'} className='h-[calc(100vh-2rem)] w-full rounded-[40px] border-0' />
			</div>
			<motion.button
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				className='absolute top-6 right-8 rounded-xl border bg-white/60 px-6 py-2 text-sm dark:bg-white/10'
				onClick={onClose}>
				关闭预览
			</motion.button>
		</div>
	)
}
