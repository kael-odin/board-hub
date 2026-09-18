'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { DialogModal } from '@/components/dialog-modal'
import { isVideoSrc } from '@/components/markdown-image'

/**
 * 图片类型的看板：图墙 + 灯箱。
 * 图片列表来自 config.json 的 images 字段（相对路径或外链）。
 */
export function BoardGallery({ images, title }: { images: string[]; title: string }) {
	const [active, setActive] = useState<number | null>(null)

	const close = useCallback(() => setActive(null), [])

	// 灯箱打开时支持左右方向键切换
	useEffect(() => {
		if (active === null) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'ArrowRight') setActive(i => (i === null ? i : (i + 1) % images.length))
			if (e.key === 'ArrowLeft') setActive(i => (i === null ? i : (i - 1 + images.length) % images.length))
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [active, images.length])

	if (images.length === 0) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>这个看板还没有图片</div>
	}

	const current = active === null ? null : images[active]

	return (
		<>
			<div className='h-full overflow-auto'>
				<div className='mx-auto w-full max-w-7xl px-6 py-8'>
					<div className='columns-1 gap-5 sm:columns-2 lg:columns-3'>
						{images.map((src, i) => (
							<motion.button
								key={`${src}-${i}`}
								type='button'
								initial={{ opacity: 0, scale: 0.96 }}
								whileInView={{ opacity: 1, scale: 1 }}
								viewport={{ once: true, margin: '-40px' }}
								transition={{ delay: Math.min(i, 8) * 0.03 }}
								onClick={() => setActive(i)}
								className='card relative mb-5 block w-full overflow-hidden p-0'>
								{isVideoSrc(src) ? (
									<video src={src} className='w-full' muted playsInline />
								) : (
									<img src={src} alt={`${title} ${i + 1}`} loading='lazy' className='w-full transition-transform duration-300 hover:scale-[1.02]' />
								)}
							</motion.button>
						))}
					</div>
				</div>
			</div>

			<DialogModal open={current !== null} onClose={close} className='max-w-[92vw] bg-transparent p-0 shadow-none'>
				{current && (
					<div className='flex max-h-[88vh] flex-col items-center gap-3'>
						{isVideoSrc(current) ? (
							<video src={current} className='max-h-[80vh] max-w-full rounded-2xl' controls autoPlay />
						) : (
							<img src={current} alt={title} className='max-h-[80vh] max-w-full rounded-2xl object-contain' />
						)}
						<span className='text-secondary text-xs'>
							{(active ?? 0) + 1} / {images.length}　·　← → 切换，Esc 关闭
						</span>
					</div>
				)}
			</DialogModal>
		</>
	)
}
