import { NextRequest, NextResponse } from 'next/server'
import { normalizeBoardType, type BoardConfig } from '@/app/boards/types'
import { getRole } from '@/lib/server/session'
import { isSafeAssetName, isValidSlug, listBoardFiles, readBoardText } from '@/lib/server/content'
import { legacyToApi, signAssetUrls } from '@/lib/server/rewrite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 单个看板的完整内容。hidden 看板对 viewer / 未登录者等同于不存在（404）。
 * 正文里的资源 URL 统一映射到鉴权 API 路径，并给 sandbox iframe 用的 URL 追加签名 token。
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const role = await getRole()
	if (!role) {
		return NextResponse.json({ error: '需要登录' }, { status: 401 })
	}

	const { slug } = await params
	if (!isValidSlug(slug)) {
		return NextResponse.json({ error: '无效的 slug' }, { status: 400 })
	}

	// config.json 缺失时按空配置处理（老数据兼容）
	let config: BoardConfig = {}
	const configText = await readBoardText(slug, 'config.json')
	if (configText) {
		try {
			config = JSON.parse(configText) as BoardConfig
		} catch {
			config = {}
		}
	}

	const type = normalizeBoardType(config.type)
	// hidden 的看板只有管理员可见
	if (config.hidden && role !== 'admin') {
		return NextResponse.json({ error: '看板不存在' }, { status: 404 })
	}

	let text = ''
	let snapshot: unknown = null
	if (type === 'html' || type === 'markdown') {
		text = (await readBoardText(slug, type === 'html' ? 'index.html' : 'index.md')) ?? ''
		if (!text) {
			return NextResponse.json({ error: '看板不存在' }, { status: 404 })
		}
	} else if (type === 'sheet') {
		const raw = await readBoardText(slug, 'sheet.json')
		if (!raw) {
			return NextResponse.json({ error: '看板不存在' }, { status: 404 })
		}
		try {
			snapshot = JSON.parse(raw)
		} catch {
			return NextResponse.json({ error: '表格数据损坏' }, { status: 500 })
		}
	}

	const files = await listBoardFiles(slug)

	// images / cover / source.file：旧静态路径 → 鉴权 API 路径（展示用，cookie 即可）
	const images = (Array.isArray(config.images) ? config.images : []).map(url => legacyToApi(slug, url))
	const cover = config.cover ? legacyToApi(slug, config.cover) : undefined
	const source = config.source ? { ...config.source } : null

	// 正文：额外追加签名 token（sandbox iframe 里的子资源带不了 cookie）
	const signedText = type === 'html' || type === 'markdown' ? signAssetUrls(legacyMapText(slug, text), slug) : ''

	return NextResponse.json(
		{ slug, type, config: { ...config, images: undefined }, text: signedText, snapshot, images, cover, source, files },
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}

/** 正文里写死的旧静态路径批量映射 */
function legacyMapText(slug: string, text: string): string {
	if (!text || !text.includes(`/boards/${slug}/`)) return text
	return text.replace(new RegExp(`(["'(])/boards/${slug}/([A-Za-z0-9][A-Za-z0-9._-]*)`, 'g'), (_m, q, file) => `${q}/api/boards/${slug}/asset/${file}`)
}
