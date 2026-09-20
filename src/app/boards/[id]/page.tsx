import type { Metadata } from 'next'
import fs from 'node:fs/promises'
import path from 'node:path'
import BoardView from './board-view'
import { getRole } from '@/lib/server/session'

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://board-hub-nine.vercel.app'

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
		const raw = await fs.readFile(path.join(process.cwd(), 'content', 'boards', slug, 'config.json'), 'utf-8')
		return JSON.parse(raw) as BoardMetaConfig
	} catch {
		return null
	}
}

/**
 * 按请求生成元信息。私有站点：hidden 看板对非管理员一律当作不存在，
 * 连 <title> 也不泄露。
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params
	const [config, role] = await Promise.all([readBoardConfig(id), getRole()])
	if (!config || (config.hidden && role !== 'admin')) {
		return { title: '看板不存在', robots: { index: false, follow: false } }
	}

	const title = config.title || id
	const description = config.summary || `${title} - ${SITE_ORIGIN.replace(/^https?:\/\//, '')}`
	// 无封面的看板回退到站点头像，保证社交分享始终有图
	const ogImage = config.cover ? new URL(config.cover, SITE_ORIGIN).toString() : new URL('/images/avatar.png', SITE_ORIGIN).toString()
	const publishedTime = config.date ? new Date(config.date).toISOString() : undefined

	return {
		title,
		description,
		keywords: config.tags,
		robots: { index: false, follow: false },
		openGraph: {
			title,
			description,
			type: 'article',
			publishedTime,
			tags: config.tags,
			images: [{ url: ogImage }]
		}
	}
}

/**
 * 看板页按需渲染（内容经 /api/boards/* 鉴权出库后由客户端拉取）。
 * 发布新看板提交到仓库触发重新部署后即可访问。
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <BoardView slug={id} />
}
