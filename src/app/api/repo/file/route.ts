import { NextRequest, NextResponse } from 'next/server'
import { getRole } from '@/lib/server/session'
import { isGithubConfigured, listRepoTree, putTextFile, readBlobBase64, type RepoTreeEntry } from '@/lib/server/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 这些前缀不允许通过网页改：改错会打断部署甚至自锁 */
const DENIED_PREFIXES = ['.github/', '.env']

function isEditablePath(p: string): boolean {
	if (!p || p.startsWith('/') || p.includes('..') || p.includes('\\')) return false
	return !DENIED_PREFIXES.some(prefix => p.startsWith(prefix))
}

function forbidden(): NextResponse {
	return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
}

function notConfigured(): NextResponse {
	return NextResponse.json({ error: '服务端未配置 GitHub App' }, { status: 501 })
}

/** 读单个文件内容（base64），供仓库浏览页预览/编辑 */
export async function GET(req: NextRequest) {
	const role = await getRole()
	if (role !== 'admin') return forbidden()
	if (!isGithubConfigured()) return notConfigured()

	const path = req.nextUrl.searchParams.get('path') || ''
	if (!isEditablePath(path)) {
		return NextResponse.json({ error: '路径不可读' }, { status: 400 })
	}

	try {
		const tree = await listRepoTree()
		const entry = tree.find(item => item.path === path) as RepoTreeEntry | undefined
		if (!entry) {
			return NextResponse.json({ error: '文件不存在' }, { status: 404 })
		}
		const base64 = await readBlobBase64(entry.sha)
		return NextResponse.json({ path, sha: entry.sha, size: entry.size, base64 }, { headers: { 'Cache-Control': 'no-store' } })
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || '读取失败' }, { status: typeof err?.status === 'number' ? err.status : 502 })
	}
}

/** 单文件写回原路径 */
export async function PUT(req: NextRequest) {
	const role = await getRole()
	if (role !== 'admin') return forbidden()
	if (!isGithubConfigured()) return notConfigured()

	const body = (await req.json().catch(() => null)) as { path?: unknown; text?: unknown } | null
	const path = typeof body?.path === 'string' ? body.path : ''
	const text = typeof body?.text === 'string' ? body.text : null
	if (text === null) {
		return NextResponse.json({ error: '缺少内容' }, { status: 400 })
	}
	if (!path || !isEditablePath(path)) {
		return NextResponse.json({ error: '路径不可写' }, { status: 400 })
	}

	try {
		await putTextFile(path, text ?? '', `更新 ${path}`)
		return NextResponse.json({ ok: true })
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || '保存失败' }, { status: typeof err?.status === 'number' ? err.status : 502 })
	}
}
