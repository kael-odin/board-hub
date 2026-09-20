import { NextRequest, NextResponse } from 'next/server'
import { getRole, verifyAssetToken } from '@/lib/server/session'
import { contentTypeFor, isSafeAssetName, readBoardFile, readBoardText } from '@/lib/server/content'
import type { BoardConfig } from '@/app/boards/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 看板目录内的文件（图片、原始数据附件等）。
 *
 * 鉴权两条通道：
 * - 会话 cookie（站点页面里的 <img>、<a> 下载等常规请求）
 * - ?k=<签名>（sandbox iframe 是 opaque origin 带不了 cookie，靠正文里的带签 URL）
 *
 * ?download=1 时按附件下发，文件名优先用 config.source 里记录的原始文件名。
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; name: string }> }) {
	const { slug, name: rawName } = await params
	const name = rawName.split('?')[0]
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(slug) || !isSafeAssetName(name)) {
		return NextResponse.json({ error: '无效路径' }, { status: 400 })
	}

	const role = await getRole()
	const k = req.nextUrl.searchParams.get('k')
	const tokenOk = verifyAssetToken(slug, k)
	if (!role && !tokenOk) {
		return NextResponse.json({ error: '需要登录' }, { status: 401 })
	}

	const buf = await readBoardFile(slug, name)
	if (!buf) {
		return NextResponse.json({ error: '文件不存在' }, { status: 404 })
	}

	// hidden 看板的附件对 viewer 同样隐藏
	const configText = await readBoardText(slug, 'config.json')
	if (configText && !tokenOk) {
		try {
			const config = JSON.parse(configText) as BoardConfig
			if (config.hidden && role !== 'admin') {
				return NextResponse.json({ error: '文件不存在' }, { status: 404 })
			}
		} catch {
			// 配置损坏不阻塞正常读取
		}
	}

	const headers = new Headers()
	headers.set('Content-Type', contentTypeFor(name))
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Cache-Control', 'private, no-store')

	if (req.nextUrl.searchParams.get('download')) {
		let pretty = ''
		if (configText) {
			try {
				const cfg = JSON.parse(configText) as BoardConfig
				if (cfg.source?.file === name && cfg.source.name) pretty = cfg.source.name
			} catch {
				// ignore
			}
		}
		const fallback = pretty || name
		const ascii = fallback.replace(/[^\x20-\x7e]/g, '_') || name
		headers.set('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fallback)}`)
	}

	return new NextResponse(new Uint8Array(buf), { headers })
}
