'use client'

import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useWriteStore } from '../../stores/write-store'
import { isVideoSrc } from '@/components/markdown-image'
import Link from 'next/link'

type ImagesSectionProps = {
	delay?: number
}

export function ImagesSection({ delay = 0 }: ImagesSectionProps) {
	const { images, cover, addUrlImage, addFiles, deleteImage } = useWriteStore()
	const [urlInput, setUrlInput] = useState<string>('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	const coverId = cover?.id ?? null

	return (
		<motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className='card relative'>
			<div className='flex items-center justify-between'>
				<h2 className='text-sm'>图片管理</h2>
				<span className='text-secondary text-xs opacity-70'>上传自动压缩为 WebP</span>
			</div>

			<div className='mt-3 flex items-center gap-2'>
				<input
					type='text'
					placeholder='https://...'
					className='bg-card flex-1 rounded-lg border px-3 py-2 text-sm'
					value={urlInput}
					onChange={e => setUrlInput(e.target.value)}
				/>
				<button
					className='rounded-lg border bg-white/70 dark:bg-white/10 px-3 py-2 text-sm'
					onClick={() => {
						const v = urlInput.trim()
						if (!v) return
						addUrlImage(v)
						setUrlInput('')
					}}>
					添加
				</button>
			</div>

			<input
				ref={fileInputRef}
				type='file'
				accept='image/*,video/mp4,video/webm,video/quicktime'
				multiple
				className='hidden'
				onChange={e => {
					const files = e.target.files
					if (files && files.length > 0) {
						addFiles(files)
					}
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			<div className='mt-3 grid grid-cols-4 gap-2'>
				{/* plus tile */}
				<div
					className='group bg-card hover:bg-secondary/20 relative grid aspect-square cursor-pointer place-items-center rounded-lg border'
					onClick={() => fileInputRef.current?.click()}
					onDragOver={e => {
						e.preventDefault()
					}}
					onDrop={e => {
						e.preventDefault()
						const files = e.dataTransfer.files
						if (files && files.length) addFiles(files)
					}}>
					<span className='text-2xl leading-none text-neutral-400'>+</span>
				</div>

				{images.map(item => {
					const isUrl = item.type === 'url'
					const src = isUrl ? item.url : item.previewUrl
					// 拖到编辑器里插入的片段用 HTML，未发布的图片用 local-image 占位符
					const snippet = isUrl ? `<img src="${item.url}" alt="" />` : `<img src="local-image:${item.id}" alt="" />`
					const isCover = coverId === item.id
					const isVideo = item.type === 'file' ? item.file.type.startsWith('video/') : isVideoSrc(item.url)

					return (
						<div
							key={item.id}
							className={`group relative aspect-square overflow-hidden rounded-lg border bg-white/50 dark:bg-white/10 text-xs ${isCover ? 'ring-2 ring-blue-500' : ''}`}>
							{isVideo ? (
								<video src={src} className='h-full w-full object-cover' muted draggable onDragStart={e => {
									e.dataTransfer.setData('text/plain', snippet)
								}} />
							) : (
								<img
									src={src}
									className='h-full w-full object-cover'
									draggable
									onDragStart={e => {
										e.dataTransfer.setData('text/plain', snippet)
									}}
								/>
							)}
							{isVideo && <div className='absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-white shadow'>视频</div>}
							{isCover && <div className='absolute top-1 left-1 rounded-md bg-blue-500 px-1.5 py-0.5 text-white shadow'>封面</div>}
							<div className='absolute top-1 right-1 hidden group-hover:flex'>
								<button type='button' className='rounded-md bg-white/80 dark:bg-white/10 px-1.5 py-0.5 shadow hover:bg-white dark:bg-[#1c2629] dark:hover:bg-white/10' onClick={() => deleteImage(item.id)}>
									删除
								</button>
							</div>
						</div>
					)
				})}
			</div>
		</motion.div>
	)
}
