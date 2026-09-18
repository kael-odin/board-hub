'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { BOARD_TYPE_LABELS, normalizeBoardType, type BoardType, type BoardIndexItem } from '../types'
import { withBase } from '@/lib/asset-path'

/** 缩略图渲染时假定的看板逻辑尺寸，实际显示靠 transform 缩放 */
const THUMB_W = 1280
const THUMB_H = 800

/** 各类型的占位图标（用简单的字符，避免为一张占位图引入图标依赖） */
const TYPE_GLYPH: Record<BoardType, string> = {
	html: '◇',
	markdown: '¶',
	sheet: '▦',
	image: '▣'
}

/**
 * 卡片缩略图。按类型给不同的呈现：
 * - 有封面图：一律用封面
 * - image：用第一张图
 * - html：鼠标悬停时才取 HTML 并按比例缩放渲染（一屏几十张卡片不会同时加载）
 * - markdown / sheet：显示类型占位，避免为了缩略图去加载重资源
 */
function BoardThumb({ item }: { item: BoardIndexItem }) {
	const type = normalizeBoardType(item.type)
	const boxRef = useRef<HTMLDivElement>(null)
	const [scale, setScale] = useState(0.3)
	const [html, setHtml] = useState<string | null>(null)
	const [hovered, setHovered] = useState(false)

	// 图片类型优先用封面，其次用第一张图
	const staticImage = withBase(item.cover || (type === 'image' ? item.images?.[0] : undefined))

	// 按容器实际宽度算缩放比，让 1280 宽的看板正好铺满卡片
	useEffect(() => {
		const el = boxRef.current
		if (!el) return
		const update = () => setScale(el.clientWidth / THUMB_W)
		update()
		const ro = new ResizeObserver(update)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// html 类型首次悬停时才拉取，并缓存
	useEffect(() => {
		if (type !== 'html' || !hovered || html || staticImage) return
		let cancelled = false
		fetch(withBase(`/boards/${encodeURIComponent(item.slug)}/index.html`))
			.then(r => (r.ok ? r.text() : null))
			.then(t => {
				if (!cancelled && t) setHtml(t)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [type, hovered, html, staticImage, item.slug])

	return (
		<div ref={boxRef} onMouseEnter={() => setHovered(true)} className='relative aspect-[16/10] w-full overflow-hidden border-b bg-neutral-100 dark:bg-neutral-800'>
			{staticImage ? (
				<img src={staticImage} alt={item.title} className='h-full w-full object-cover' />
			) : html ? (
				<iframe
					srcDoc={html}
					sandbox='allow-scripts'
					title={`${item.title} 预览`}
					tabIndex={-1}
					aria-hidden
					className='pointer-events-none absolute top-0 left-0 origin-top-left border-0'
					style={{ width: THUMB_W, height: THUMB_H, transform: `scale(${scale})` }}
				/>
			) : (
				<div className='grid h-full w-full place-items-center'>
					<div className='text-center'>
						<div className='text-brand/70 text-3xl leading-none'>{TYPE_GLYPH[type]}</div>
						<div className='text-secondary mt-2 text-xs opacity-60'>
							{type === 'html' ? (hovered ? '加载预览…' : '悬停查看预览') : BOARD_TYPE_LABELS[type]}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

type BoardCardProps = {
	item: BoardIndexItem & { images?: string[] }
	index: number
	onEdit?: () => void
}

export function BoardCard({ item, index, onEdit }: BoardCardProps) {
	const dateText = item.date ? dayjs(item.date).format('YYYY-MM-DD') : ''
	const type = normalizeBoardType(item.type)

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.94 }}
			whileInView={{ opacity: 1, scale: 1 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ delay: Math.min(index, 8) * 0.04 }}
			className='card relative flex flex-col overflow-hidden'>
			<Link href={`/boards/${item.slug}`} className='block'>
				<BoardThumb item={item} />
			</Link>

			<div className='flex flex-1 flex-col gap-2 p-5'>
				<div className='flex items-start justify-between gap-2'>
					<Link href={`/boards/${item.slug}`} className='min-w-0 flex-1'>
						<h2 className='hover:text-brand truncate text-base font-medium transition-colors'>{item.title || item.slug}</h2>
					</Link>
					{onEdit && (
						<button type='button' onClick={onEdit} className='text-secondary shrink-0 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-bg' title='编辑看板'>
							编辑
						</button>
					)}
				</div>

				{item.summary && <p className='text-secondary line-clamp-2 text-xs leading-relaxed'>{item.summary}</p>}

				<div className='mt-auto flex flex-wrap items-center gap-2 pt-1'>
					<span className='bg-secondary/10 rounded px-2 py-0.5 text-[11px]'>{BOARD_TYPE_LABELS[type]}</span>
					{item.tags?.slice(0, 3).map(tag => (
						<span key={tag} className='bg-secondary/10 rounded px-2 py-0.5 text-[11px]'>
							{tag}
						</span>
					))}
					{dateText && <span className='text-secondary ml-auto text-[11px] opacity-70'>{dateText}</span>}
				</div>
			</div>
		</motion.div>
	)
}
