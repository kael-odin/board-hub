'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { INIT_DELAY } from '@/consts'
import { useAuthStore } from '@/hooks/use-auth'
import { useBoardIndex } from '@/hooks/use-board-index'
import { BoardCard } from '@/app/boards/components/board-card'

type BoardWallProps = {
	/** 首页带一个大标题头部；/boards 页头部更紧凑 */
	showHero?: boolean
}

/**
 * 看板卡片墙 —— 首页和 /boards 共用的主体。
 * 卡片的缩略图在悬停时会按真实比例渲染看板本身，所以这一屏看起来就是一堆真的看板。
 */
export function BoardWall({ showHero = false }: BoardWallProps) {
	const router = useRouter()
	const { items, loading, error } = useBoardIndex()
	const { role, hydrated } = useAuthStore()
	const isAdmin = role === 'admin'

	const [searchTerm, setSearchTerm] = useState('')
	const [selectedTag, setSelectedTag] = useState<string>('all')

	const allTags = useMemo(() => Array.from(new Set(items.flatMap(item => item.tags || []))), [items])

	const filtered = useMemo(() => {
		const kw = searchTerm.trim().toLowerCase()
		return items.filter(item => {
			const matchesSearch =
				!kw || (item.title || '').toLowerCase().includes(kw) || (item.summary || '').toLowerCase().includes(kw) || item.slug.toLowerCase().includes(kw)
			const matchesTag = selectedTag === 'all' || (item.tags || []).includes(selectedTag)
			return matchesSearch && matchesTag
		})
	}, [items, searchTerm, selectedTag])

	return (
		<>
			{showHero && (
				<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: INIT_DELAY }} className='mb-10 text-center'>
					<h1 className='text-2xl font-semibold sm:text-3xl'>看板</h1>
					<p className='text-secondary mt-2 text-sm'>AI 整理的报表与看板，都收在这里</p>
				</motion.div>
			)}

			{/* 搜索 + 标签筛选（未登录无需展示） */}
			<div className={`mb-8 space-y-4 ${role ? '' : 'hidden'}`}>
				<input
					type='text'
					placeholder='搜索看板…'
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					className='focus:ring-brand mx-auto block w-full max-w-md rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:outline-none'
				/>

				{allTags.length > 0 && (
					<div className='flex flex-wrap justify-center gap-2'>
						<button
							onClick={() => setSelectedTag('all')}
							className={`rounded-full px-4 py-1.5 text-sm transition-colors ${selectedTag === 'all' ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
							全部
						</button>
						{allTags.map(tag => (
							<button
								key={tag}
								onClick={() => setSelectedTag(tag)}
								className={`rounded-full px-4 py-1.5 text-sm transition-colors ${selectedTag === tag ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
								{tag}
							</button>
						))}
					</div>
				)}
			</div>

			{/* 卡片墙 */}
			{!hydrated && !loading ? (
				<div className='text-secondary py-20 text-center text-sm'>加载中…</div>
			) : hydrated && !role ? (
				/* 未登录：私有书架，先登录 */
				<div className='bg-card mx-auto mt-10 max-w-md rounded-3xl border p-10 text-center shadow'>
					<div className='text-3xl'>🔒</div>
					<p className='mt-3 text-sm'>这是一个私有看板书架，登录后才能浏览。</p>
					<button onClick={() => router.push('/login')} className='brand-btn mx-auto mt-5'>
						去登录
					</button>
				</div>
			) : loading ? (
				<div className='text-secondary py-20 text-center text-sm'>加载中…</div>
			) : error ? (
				<div className='py-20 text-center text-sm text-red-500'>加载失败，请刷新重试；若持续失败请联系管理员检查服务端配置</div>
			) : filtered.length === 0 ? (
				<div className='text-secondary py-20 text-center text-sm'>
					{items.length === 0 ? (
						<>
							<p>还没有任何看板</p>
							{isAdmin && (
								<div className='mt-4 flex items-center justify-center gap-2'>
									<button onClick={() => router.push('/write')} className='brand-btn'>
										新建第一个看板
									</button>
									<button onClick={() => router.push('/repo')} className='bg-card rounded-xl border px-6 py-2 text-sm'>
										仓库浏览
									</button>
								</div>
							)}
						</>
					) : (
						<p>没有匹配的看板</p>
					)}
				</div>
			) : (
				<div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
					{filtered.map((item, i) => (
						<BoardCard key={item.slug} item={item} index={i} onEdit={isAdmin ? () => router.push(`/write?slug=${item.slug}`) : undefined} />
					))}
				</div>
			)}

			{/* 新建入口 */}
			{isAdmin && items.length > 0 && (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='mt-12 flex items-center justify-center gap-2 text-center'>
					<button onClick={() => router.push('/write')} className='brand-btn mx-auto'>
						新建看板
					</button>
					<button onClick={() => router.push('/repo')} className='bg-card mx-auto rounded-xl border px-6 py-2 text-sm'>
						仓库浏览
					</button>
				</motion.div>
			)}
		</>
	)
}
