import { motion } from 'motion/react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/hooks/use-auth'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { usePublish } from '../hooks/use-publish'

export function WriteActions() {
	const { loading, mode, form, originalSlug, updateForm } = useWriteStore()
	const { openPreview } = usePreviewStore()
	const { role, hydrated } = useAuthStore()
	const isAdmin = role === 'admin'
	const { onPublish, onDelete } = usePublish()
	const htmlInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()

	const handleCancel = () => {
		if (!window.confirm('放弃本次修改吗？')) {
			return
		}
		if (mode === 'edit' && originalSlug) {
			router.push(`/boards/${originalSlug}`)
		} else {
			router.push('/')
		}
	}

	const handleDelete = () => {
		const confirmMsg = form?.title ? `确定删除《${form.title}》吗？该操作不可恢复。` : '确定删除当前看板吗？该操作不可恢复。'
		if (window.confirm(confirmMsg)) {
			onDelete()
		}
	}

	const handleImportHtml = () => {
		htmlInputRef.current?.click()
	}

	// 按扩展名判断是 Markdown 还是 HTML，导入的同时把内容类型切过去
	const handleTextFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		try {
			const text = await file.text()
			const isMarkdown = /\.(md|markdown|mdx)$/i.test(file.name)
			updateForm({ content: text, type: isMarkdown ? 'markdown' : 'html' })
			toast.success(isMarkdown ? '已导入 Markdown 文件' : '已导入 HTML 文件')
		} catch (error) {
			toast.error('导入失败，请重试')
		} finally {
			if (e.currentTarget) e.currentTarget.value = ''
		}
	}

	// 查看者 / 未登录：进入 /write 本身已由页面重定向拦下，这里兜底只读提示
	if (hydrated && !isAdmin) {
		return (
			<ul className='absolute top-3 right-3 left-3 flex flex-wrap items-center justify-end gap-2 sm:top-4 sm:right-6 sm:left-auto'>
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='rounded-lg border bg-blue-50 dark:bg-blue-500/15 px-4 py-2 text-sm text-blue-700'>
					查看者账号只能浏览与下载
				</motion.div>
			</ul>
		)
	}

	return (
		<>
			<input ref={htmlInputRef} type='file' accept='.html,.htm,.md,.markdown' className='hidden' onChange={handleTextFileChange} />

			<ul className='absolute top-3 right-3 left-3 flex flex-wrap items-center justify-end gap-2 sm:top-4 sm:right-6 sm:left-auto'>
				{mode === 'edit' && (
					<>
						<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='flex items-center gap-2'>
							<div className='rounded-lg border bg-blue-50 dark:bg-blue-500/15 px-4 py-2 text-sm text-blue-700'>编辑模式</div>
						</motion.div>

						<motion.button
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className='rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/15 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-100 dark:hover:bg-red-500/25'
							disabled={loading}
							onClick={handleDelete}>
							删除
						</motion.button>

						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							className='bg-card rounded-xl border px-4 py-2 text-sm'>
							取消
						</motion.button>
					</>
				)}

				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='bg-card rounded-xl border px-4 py-2 text-sm'
					disabled={loading}
					onClick={handleImportHtml}>
					导入文件
				</motion.button>
				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='bg-card rounded-xl border px-6 py-2 text-sm'
					disabled={loading}
					onClick={openPreview}>
					预览
				</motion.button>
				<motion.button
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					className='brand-btn px-6'
					disabled={loading || !hydrated || !isAdmin}
					onClick={onPublish}>
					{mode === 'edit' ? '更新' : '发布'}
				</motion.button>
			</ul>
		</>
	)
}
