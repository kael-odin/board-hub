'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import { INIT_DELAY } from '@/consts'
import { useAuthStore } from '@/hooks/use-auth'
import { useBoardIndex } from '@/hooks/use-board-index'
import { BoardCard } from '@/app/boards/components/board-card'
import { BOARD_TYPES, BOARD_TYPE_LABELS, normalizeBoardType, type BoardType } from '@/app/boards/types'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { LayoutGrid, List } from 'lucide-react'

type BoardWallProps = {
	/** 首页带一个大标题头部；/boards 页头部更紧凑 */
	showHero?: boolean
}

/** 固定列数时各档位的响应式类（保持窄屏始终单列） */
const FIXED_COLS_CLASS: Record<number, string> = {
	2: 'grid-cols-1 sm:grid-cols-2',
	3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
}

/**
 * 看板卡片墙 —— 首页和 /boards 共用的主体。
 * 卡片的缩略图在悬停时会按真实比例渲染看板本身，所以这一屏看起来就是一堆真的看板。
 *
 * 筛选分两层：主筛是「类型」（系统字段，稳定可靠），
 * 标签是发布时随手打的自由标记，只作为第二行的补充筛选项。
 * 视图可在「卡片墙」与「列表」（CRM 式表格）之间切换。
 */
export function BoardWall({ showHero = false }: BoardWallProps) {
	const router = useRouter()
	const { items, loading, error } = useBoardIndex()
	const { role, hydrated } = useAuthStore()
	const isAdmin = role === 'admin'
	const shelf = useConfigStore(state => state.siteContent.shelf)

	const [searchTerm, setSearchTerm] = useState('')
	const [selectedType, setSelectedType] = useState<BoardType | 'all'>('all')
	const [selectedTag, setSelectedTag] = useState<string>('all')
	const [view, setView] = useState<'grid' | 'list'>('grid')

	const allTags = useMemo(() => Array.from(new Set(items.flatMap(item => item.tags || []))), [items])

	const filtered = useMemo(() => {
		const kw = searchTerm.trim().toLowerCase()
		return items.filter(item => {
			const matchesSearch =
				!kw || (item.title || '').toLowerCase().includes(kw) || (item.summary || '').toLowerCase().includes(kw) || item.slug.toLowerCase().includes(kw)
			const matchesType = selectedType === 'all' || normalizeBoardType(item.type) === selectedType
			const matchesTag = selectedTag === 'all' || (item.tags || []).includes(selectedTag)
			return matchesSearch && matchesType && matchesTag
		})
	}, [items, searchTerm, selectedType, selectedTag])

	const typeChips: Array<{ key: BoardType | 'all'; label: string; count: number }> = useMemo(() => {
		const count = (t: BoardType | 'all') => (t === 'all' ? items.length : items.filter(item => normalizeBoardType(item.type) === t).length)
		return [{ key: 'all', label: '全部', count: count('all') }, ...BOARD_TYPES.map(t => ({ key: t, label: BOARD_TYPE_LABELS[t], count: count(t) }))]
	}, [items])

	const colsClass = FIXED_COLS_CLASS[shelf?.columns || 0] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
	const gridGap = shelf?.compact ? 'gap-5' : 'gap-8'

	return (
		<>
			{showHero && (
				<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: INIT_DELAY }} className='mb-10 text-center'>
					<h1 className='text-2xl font-semibold sm:text-3xl'>看板</h1>
					<p className='text-secondary mt-2 text-sm'>AI 整理的报表与看板，都收在这里</p>
				</motion.div>
			)}

			{/* 搜索 + 筛选（未登录无需展示） */}
			<div className={`mb-6 space-y-3 ${role ? '' : 'hidden'}`}>
				<div className='flex items-center gap-3'>
					<input
						type='text'
						placeholder='搜索看板标题、摘要、slug…'
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						className='focus:ring-brand min-w-0 flex-1 rounded-lg border px-3.5 py-2 text-sm focus:ring-2 focus:outline-none'
					/>
					{/* 视图切换 */}
					<div className='bg-card flex shrink-0 items-center rounded-lg border p-0.5'>
						<button
							onClick={() => setView('grid')}
							title='卡片视图'
							className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors ${view === 'grid' ? 'bg-brand/10 text-brand' : 'text-secondary hover:text-primary'}`}>
							<LayoutGrid className='h-4 w-4' />
						</button>
						<button
							onClick={() => setView('list')}
							title='列表视图'
							className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors ${view === 'list' ? 'bg-brand/10 text-brand' : 'text-secondary hover:text-primary'}`}>
							<List className='h-4 w-4' />
						</button>
					</div>
				</div>

				{/* 主筛：内容类型 */}
				<div className='flex flex-wrap items-center justify-center gap-2'>
					{typeChips.map(chip => {
						const active = selectedType === chip.key
						return (
							<button
								key={chip.key}
								onClick={() => setSelectedType(chip.key)}
								className={`rounded-full px-4 py-1.5 text-sm transition-colors ${active ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
								{chip.label}
								<span className={`ml-1.5 text-[11px] ${active ? 'text-white/75' : 'text-secondary opacity-60'}`}>{chip.count}</span>
							</button>
						)
					})}
				</div>

				{/* 副筛：自由标签（发布时随手打的，只在此展示） */}
				{allTags.length > 0 && (
					<div className='flex flex-wrap items-center justify-center gap-1.5'>
						<span className='text-secondary mr-1 text-[11px] opacity-60'>标签</span>
						<button
							onClick={() => setSelectedTag('all')}
							className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${selectedTag === 'all' ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
							不限
						</button>
						{allTags.map(tag => (
							<button
								key={tag}
								onClick={() => setSelectedTag(tag)}
								className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${selectedTag === tag ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
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
				<div className='bg-card mx-auto mt-10 max-w-md rounded-xl border p-10 text-center shadow'>
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
			) : view === 'list' ? (
				/* 列表视图：CRM 式表格，一屏扫完所有看板 */
				<div className='bg-card overflow-hidden rounded-lg border'>
					<table className='w-full text-left text-sm'>
						<thead>
							<tr className='text-secondary bg-secondary/5 text-xs'>
								<th className='px-4 py-2.5 font-medium'>名称</th>
								<th className='hidden px-4 py-2.5 font-medium sm:table-cell'>类型</th>
								<th className='hidden px-4 py-2.5 font-medium md:table-cell'>分类</th>
								<th className='hidden px-4 py-2.5 font-medium lg:table-cell'>标签</th>
								<th className='px-4 py-2.5 text-right font-medium'>日期</th>
								{isAdmin && <th className='px-4 py-2.5 text-right font-medium'>操作</th>}
							</tr>
						</thead>
						<tbody>
							{filtered.map(item => {
								const t = normalizeBoardType(item.type)
								return (
									<tr key={item.slug} className='border-border border-t transition-colors hover:bg-secondary/5'>
										<td className='max-w-[280px] px-4 py-2.5'>
											<Link href={`/boards/${item.slug}`} className='block truncate font-medium transition-colors hover:text-brand'>
												{item.title || item.slug}
											</Link>
											{item.summary && <div className='text-secondary mt-0.5 truncate text-xs opacity-80'>{item.summary}</div>}
										</td>
										<td className='hidden px-4 py-2.5 sm:table-cell'>
											<span className='bg-secondary/10 rounded px-2 py-0.5 text-xs'>{BOARD_TYPE_LABELS[t]}</span>
										</td>
										<td className='text-secondary hidden px-4 py-2.5 md:table-cell'>{item.category || '—'}</td>
										<td className='hidden px-4 py-2.5 lg:table-cell'>
											<div className='flex flex-wrap gap-1'>
												{(item.tags || []).slice(0, 3).map(tag => (
													<span key={tag} className='bg-secondary/10 rounded px-1.5 py-0.5 text-[11px]'>
														{tag}
													</span>
												))}
											</div>
										</td>
										<td className='text-secondary whitespace-nowrap px-4 py-2.5 text-right text-xs'>{item.date ? dayjs(item.date).format('YYYY-MM-DD') : '—'}</td>
										{isAdmin && (
											<td className='px-4 py-2.5 text-right'>
												<button onClick={() => router.push(`/write?slug=${item.slug}`)} className='text-secondary hover:text-brand text-xs transition-colors'>
													编辑
												</button>
											</td>
										)}
									</tr>
								)
							})}
						</tbody>
					</table>
					{filtered.length === 0 && <div className='text-secondary py-10 text-center text-xs'>没有匹配的看板</div>}
				</div>
			) : (
				<div className={`grid ${colsClass} ${gridGap}`}>
					{filtered.map((item, i) => (
						<BoardCard key={item.slug} item={item} index={i} onEdit={isAdmin ? () => router.push(`/write?slug=${item.slug}`) : undefined} />
					))}
				</div>
			)}

			{/* 新建入口 */}
			{isAdmin && items.length > 0 && (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='mt-10 flex items-center justify-center gap-2'>
					<button onClick={() => router.push('/write')} className='brand-btn'>
						新建看板
					</button>
					<button onClick={() => router.push('/repo')} className='bg-card rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-bg'>
						仓库浏览
					</button>
				</motion.div>
			)}
		</>
	)
}
