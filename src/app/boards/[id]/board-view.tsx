'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import Link from 'next/link'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { BoardBody } from '@/components/board-body'
import { BOARD_TYPE_LABELS, normalizeBoardType, type BoardType } from '@/app/boards/types'
import { loadBoard, type LoadedBoard } from '@/lib/load-board'
import { boardAssetUrl } from '@/lib/board-api'
import { useAuthStore } from '@/hooks/use-auth'

export default function BoardView({ slug }: { slug: string }) {
	const router = useRouter()
	const isAdmin = useAuthStore(state => state.role === 'admin')

	const [board, setBoard] = useState<LoadedBoard | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState<boolean>(true)
	// 全屏看板：隐藏头部信息条，Esc 退出
	const [fullscreen, setFullscreen] = useState(false)

	useEffect(() => {
		let cancelled = false
		async function run() {
			if (!slug) return
			try {
				setLoading(true)
				const data = await loadBoard(slug)
				if (!cancelled) {
					setBoard(data)
					setError(null)
				}
			} catch (e: any) {
				if (!cancelled) setError(e?.message || '加载失败')
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		run()
		return () => {
			cancelled = true
		}
	}, [slug])

	useEffect(() => {
		if (!fullscreen) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setFullscreen(false)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [fullscreen])

	const title = useMemo(() => (board?.config.title ? board.config.title : slug), [board?.config.title, slug])
	const date = useMemo(() => (board?.config.date ? dayjs(board.config.date).format('YYYY年 M月 D日') : ''), [board?.config.date])
	const tags = board?.config.tags || []
	const type: BoardType = board ? normalizeBoardType(board.type) : 'html'

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			toast.success('链接已复制')
		} catch {
			toast.error('复制失败，请手动复制地址栏链接')
		}
	}

	if (!slug) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>无效的链接</div>
	}

	if (loading) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>加载中...</div>
	}

	if (error) {
		return (
			<div className='flex h-full flex-col items-center justify-center gap-4 text-sm'>
				<span className='text-red-500'>{error}</span>
				<Link href='/boards' className='brand-btn'>
					返回看板列表
				</Link>
			</div>
		)
	}

	if (!board) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>看板不存在</div>
	}

	// 表格类型自带工具栏，不套外层白底容器和圆角裁切
	const bare = type === 'sheet'

	return (
		<div className='flex h-[100dvh] flex-col px-4 pt-20 pb-4 sm:px-6'>
			{/* 头部信息条（全屏模式隐藏） */}
			{!fullscreen && (
				<header className='mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1'>
					<Link href='/boards' className='text-secondary shrink-0 text-xs transition-colors hover:text-brand'>
						← 看板
					</Link>
					<h1 className='min-w-0 flex-1 truncate text-base font-medium'>{title}</h1>

					<div className='flex shrink-0 items-center gap-3'>
						<span className='bg-secondary/10 rounded px-2 py-0.5 text-[11px]'>{BOARD_TYPE_LABELS[type]}</span>
						{tags.slice(0, 4).map(tag => (
							<span key={tag} className='bg-secondary/10 rounded px-2 py-0.5 text-[11px]'>
								{tag}
							</span>
						))}
						{date && <span className='text-secondary text-[11px] opacity-70'>{date}</span>}
						{board.source && (
							<a
								href={boardAssetUrl(slug, board.source.file, true)}
								title={`下载原始数据：${board.source.name || board.source.file}`}
								className='rounded-xl border bg-white/60 px-4 py-1.5 text-xs backdrop-blur-sm transition-colors hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15'>
								原始数据
							</a>
						)}
						{isAdmin && (
							<motion.button
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => router.push(`/write?slug=${slug}`)}
								className='rounded-xl border bg-white/60 px-4 py-1.5 text-xs backdrop-blur-sm transition-colors hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15'>
								编辑
							</motion.button>
						)}
						<button
							type='button'
							onClick={copyLink}
							title='复制看板链接'
							className='text-secondary rounded-xl border bg-white/60 px-3 py-1.5 text-xs backdrop-blur-sm transition-colors hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15'>
							复制链接
						</button>
						<button
							type='button'
							onClick={() => setFullscreen(true)}
							title='全屏查看（Esc 退出）'
							className='text-secondary rounded-xl border bg-white/60 px-3 py-1.5 text-xs backdrop-blur-sm transition-colors hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15'>
							全屏
						</button>
					</div>
				</header>
			)}

			{fullscreen && (
				<button
					type='button'
					onClick={() => setFullscreen(false)}
					className='text-secondary hover:text-brand absolute top-4 right-4 z-10 rounded-lg border bg-white/70 px-3 py-1.5 text-xs backdrop-blur-sm transition-colors hover:bg-white/90 dark:bg-white/10'
					title='退出全屏（Esc）'>
					退出全屏
				</button>
			)}

			{/* 正文：占满剩余高度 */}
			<div className={`min-h-0 flex-1 overflow-hidden ${fullscreen ? '' : bare ? '' : 'rounded-2xl border bg-white shadow'}`}>
				<BoardBody type={type} content={board.text} snapshot={board.snapshot} images={board.images} title={title} readOnly />
			</div>
		</div>
	)
}
