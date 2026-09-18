import { motion } from 'motion/react'
import { BoardBody } from '@/components/board-body'
import { useWriteData } from '../hooks/use-write-data'
import { useWriteStore } from '../stores/write-store'

type WritePreviewProps = {
	onClose: () => void
	slug?: string
}

/** 全屏预览 —— 与线上查看页使用同一套渲染器 */
export function WritePreview({ onClose }: WritePreviewProps) {
	const { form } = useWriteStore()
	const previewData = useWriteData()

	// 表格类型自带工具栏，不套白底容器
	const bare = form.type === 'sheet'

	return (
		<div>
			<div className={bare ? 'h-[calc(100vh-6rem)]' : 'h-[calc(100vh-6rem)] overflow-hidden rounded-[40px] border bg-white shadow'}>
				<BoardBody
					type={form.type}
					content={previewData.content}
					snapshot={form.snapshot}
					images={previewData.galleryImages}
					title={previewData.title}
					readOnly
				/>
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
