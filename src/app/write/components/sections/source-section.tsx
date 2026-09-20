'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useWriteStore } from '../../stores/write-store'

/** 原始数据附件大小上限：服务端提交接口单次 4MB（Vercel 函数请求体限制） */
const MAX_SOURCE_BYTES = 4 * 1024 * 1024

const ACCEPT = '.xlsx,.xls,.csv,.md,.json,.txt'

function formatSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
	return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * 原始数据附件：把 Excel 源文件等原件随看板一起存进仓库。
 * 表格类型「导入 Excel」时会自动带上原件，这里也可以手动换/删。
 */
export function SourceSection({ delay = 0 }: { delay?: number }) {
	const { sourceFile, sourceMeta, setSourceFile, removeSource } = useWriteStore()
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragOver, setDragOver] = useState(false)

	const pick = (files: FileList | null) => {
		const file = files?.[0]
		if (!file) return
		if (file.size > MAX_SOURCE_BYTES) {
			toast.error('文件超过 4MB 上限，请压缩或拆分后再附加')
			return
		}
		setSourceFile(file)
	}

	const current = sourceFile || sourceMeta

	return (
		<motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className='card relative'>
			<div className='mb-3 flex items-center justify-between'>
				<h2 className='text-sm'>原始数据</h2>
				<button
					type='button'
					onClick={() => inputRef.current?.click()}
					className='rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-bg'>
					{current ? '更换' : '附加文件'}
				</button>
			</div>

			{current ? (
				<div className='bg-secondary/5 flex items-center gap-2 rounded-lg px-3 py-2'>
					<div className='min-w-0 flex-1'>
						<div className='truncate text-xs' title={current.name}>
							📎 {current.name}
						</div>
						<div className='text-secondary mt-0.5 text-[11px] opacity-70'>
							{sourceFile ? `新文件 · ${formatSize(sourceFile.size)} · 发布时上传` : `已存于仓库${sourceMeta?.size ? ` · ${formatSize(sourceMeta.size)}` : ''}`}
						</div>
					</div>
					<button
						type='button'
						onClick={removeSource}
						title='移除附件（发布后从仓库删除）'
						className='text-secondary hover:text-red-500 shrink-0 text-xs transition-colors'>
						移除
					</button>
				</div>
			) : (
				<div
					onDragOver={e => {
						e.preventDefault()
						setDragOver(true)
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={e => {
						e.preventDefault()
						setDragOver(false)
						pick(e.dataTransfer.files)
					}}
					onClick={() => inputRef.current?.click()}
					className={`text-secondary cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors ${
						dragOver ? 'border-brand text-brand' : 'hover:border-secondary/50'
					}`}>
					把 .xlsx / .csv 拖进来，或点「附加文件」
					<p className='text-secondary mt-1 text-[11px] opacity-70'>原件随看板存进仓库，详情页可下载</p>
				</div>
			)}

			<input
				ref={inputRef}
				type='file'
				accept={ACCEPT}
				className='hidden'
				onChange={e => {
					pick(e.target.files)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			{sourceFile && <p className='text-secondary mt-2 text-[11px] opacity-70'>附件本体不进本地草稿，刷新后需重新选择</p>}
		</motion.div>
	)
}
