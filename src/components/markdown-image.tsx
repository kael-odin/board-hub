'use client'

import { useState } from 'react'
import Image from 'next/image'
import { DialogModal } from '@/components/dialog-modal'

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|$)/i

export function isVideoSrc(src: string): boolean {
	return VIDEO_EXT.test(src || '')
}

/** next/image 只处理站内相对路径与 https 外链；blob:（编辑器预览）、data: 等交给原生 img */
function canOptimize(src: string): boolean {
	return src.startsWith('/') || /^https:\/\//i.test(src)
}

// 固定宽高仅用于占位防抖动，实际显示尺寸由 style + .prose img 的 max-width 约束
const OPTIMIZED_SIZE = { width: 1200, height: 800 }

type MarkdownImageProps = {
	src: string
	alt?: string
	title?: string
}

export function MarkdownImage({ src, alt = '', title = '' }: MarkdownImageProps) {
	const [display, setDisplay] = useState(false)

	// 视频文件（本地上传的 mp4/webm 等）用 <video> 播放，不做灯箱
	if (isVideoSrc(src)) {
		return <video src={src} controls preload='metadata' className='my-2 w-full rounded-xl' />
	}

	const inline = canOptimize(src) ? (
		<Image
			src={src}
			alt={alt}
			title={title}
			width={OPTIMIZED_SIZE.width}
			height={OPTIMIZED_SIZE.height}
			sizes='(max-width: 640px) 90vw, 45vw'
			loading='lazy'
			onClick={() => setDisplay(true)}
			className='cursor-pointer transition-opacity hover:opacity-80'
			style={{ width: '100%', height: 'auto' }}
		/>
	) : (
		<img src={src} alt={alt} title={title} loading='lazy' onClick={() => setDisplay(true)} className='cursor-pointer transition-opacity hover:opacity-80' />
	)

	return (
		<>
			{inline}
			<DialogModal open={display} onClose={() => setDisplay(false)} className='max-w-none bg-transparent p-0'>
				<img src={src} alt={alt} className='max-h-[90vh] max-w-full rounded-2xl object-contain' />
			</DialogModal>
		</>
	)
}
