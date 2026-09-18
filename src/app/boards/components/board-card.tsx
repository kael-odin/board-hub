'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import type { BoardIndexItem } from '../types'

/** 缩略图渲染时假定的看板逻辑尺寸，实际显示靠 transform 缩放 */
const THUMB_W = 1280
const THUMB_H = 800

/**
 * 卡片缩略图。
 * - 有封面图就直接用封面
 * - 没封面时，鼠标悬停才去取看板 HTML 并按比例缩放渲染 —— 一屏几十张卡片不会同时加载
 */
function BoardThumb({ slug, cover, title }: { slug: string; cover?: string; title: string }) {
	const boxRef = useRef<HTMLDivElement>(null)
	const [scale, setScale] = useState(0.3)
	const [html, setHtml] = useState<string | null>(null)
	const [hovered, setHovered] = useState(false)

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

	// 首次悬停时才拉取 HTML 并缓存
	useEffect(() => {
		if (!hovered || html || cover) return
		let cancelled = false
		fetch(`/boards/${encodeURIComponent(slug)}/index.html`)
			.then(r => (r.ok ? r.text() : null))
			.then(t => {
				if (!cancelled && t) setHtml(t)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [hovered, html, cover, slug])

	return (
		<div ref={boxRef} onMouseEnter={() => setHovered(true)} className='relative aspect-[16/10] w-full overflow-hidden border-b bg-neutral-100 dark:bg-neutral-800'>
			{cover ? (
				<img src={cover} alt={title} className='h-full w-full object-cover' />
			) : html ? (
				<iframe
					srcDoc={html}
					sandbox='allow-scripts'
					title={`${title} 预览`}
					tabIndex={-1}
					aria-hidden
					className='pointer-events-none absolute top-0 left-0 origin-top-left border-0'
					style={{ width: THUMB_W, height: THUMB_H, transform: `scale(${scale})` }}
				/>
			) : (
				<div className='grid h-full w-full place-items-center'>
					<span className='text-secondary text-xs opacity-50'>{hovered ? '加载预览…' : '悬停查看预览'}</span>
				</div>
			)}
		</div>
	)
}

type BoardCardProps = {
	item: BoardIndexItem
	index: number
	onEdit?: () => void
}

export function BoardCard({ item, index, onEdit }: BoardCardProps) {
	const dateText = item.date ? dayjs(item.date).format('YYYY-MM-DD') : ''

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.94 }}
			whileInView={{ opacity: 1, scale: 1 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ delay: Math.min(index, 8) * 0.04 }}
			className='card relative flex flex-col overflow-hidden'>
			<Link href={`/boards/${item.slug}`} className='block'>
				<BoardThumb slug={item.slug} cover={item.cover} title={item.title || item.slug} />
			</Link>

			<div className='flex flex-1 flex-col gap-2 p-5'>
				<div className='flex items-start justify-between gap-2'>
					<Link href={`/boards/${item.slug}`} className='min-w-0 flex-1'>
						<h2 className='truncate text-base font-medium transition-colors hover:text-brand'>{item.title || item.slug}</h2>
					</Link>
					{onEdit && (
						<button type='button' onClick={onEdit} className='text-secondary shrink-0 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-bg' title='编辑看板'>
							编辑
						</button>
					)}
				</div>

				{item.summary && <p className='text-secondary line-clamp-2 text-xs leading-relaxed'>{item.summary}</p>}

				<div className='mt-auto flex flex-wrap items-center gap-2 pt-1'>
					{item.tags?.slice(0, 4).map(tag => (
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
