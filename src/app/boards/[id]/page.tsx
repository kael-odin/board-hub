import type { Metadata } from 'next'
import fs from 'node:fs/promises'
import path from 'node:path'
import BoardView from './board-view'

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://board-hub.vercel.app'

type BoardMetaConfig = {
	title?: string
	date?: string
	summary?: string
	cover?: string
	hidden?: boolean
	tags?: string[]
}

async function readBoardConfig(slug: string): Promise<BoardMetaConfig | null> {
	// slug 同时是目录名，只放行安全字符
	if (!/^[a-zA-Z0-9_-]{1,120}$/.test(slug)) return null
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'boards', slug, 'config.json'), 'utf-8')
		return JSON.parse(raw) as BoardMetaConfig
	} catch {
		return null
	}
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params
	const config = await readBoardConfig(id)
	if (!config) return { title: '看板不存在' }

	const title = config.title || id
	const description = config.summary || `${title} - ${SITE_ORIGIN.replace(/^https?:\/\//, '')}`
	// 无封面的看板回退到站点头像，保证社交分享始终有图
	const ogImage = config.cover ? new URL(config.cover, SITE_ORIGIN).toString() : new URL('/images/avatar.png', SITE_ORIGIN).toString()
	const publishedTime = config.date ? new Date(config.date).toISOString() : undefined

	return {
		title,
		description,
		keywords: config.tags,
		openGraph: {
			title,
			description,
			type: 'article',
			publishedTime,
			tags: config.tags,
			images: [{ url: ogImage }]
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: [ogImage]
		},
		// 已下线（hidden）的看板不让搜索引擎收录
		robots: config.hidden ? { index: false, follow: false } : undefined
	}
}

/**
 * 静态导出需要在构建时枚举所有看板 slug。
 * slug 列表来自 public/boards/index.json —— 发布看板会 push 到仓库并触发重新构建，
 * 所以新看板在下次部署后就会有对应的静态页。
 */
export async function generateStaticParams() {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'boards', 'index.json'), 'utf-8')
		const list = JSON.parse(raw) as Array<{ slug?: string }>
		return list.filter(item => typeof item?.slug === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(item.slug!)).map(item => ({ id: item.slug! }))
	} catch {
		// 索引缺失时导出空列表，首页仍可正常构建
		return []
	}
}

/** 未在构建时枚举到的 slug 直接 404，静态导出下没有按需渲染 */
export const dynamicParams = false

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <BoardView slug={id} />
}
