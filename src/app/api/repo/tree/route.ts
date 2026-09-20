import { NextResponse } from 'next/server'
import { getRole } from '@/lib/server/session'
import { isGithubConfigured, listRepoTree } from '@/lib/server/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 仓库文件树（admin 专属 —— 能看到全仓库文件本身就是一种权限） */
export async function GET() {
	const role = await getRole()
	if (role !== 'admin') {
		return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
	}
	if (!isGithubConfigured()) {
		return NextResponse.json({ error: '服务端未配置 GitHub App' }, { status: 501 })
	}
	try {
		const entries = await listRepoTree()
		return NextResponse.json(entries, { headers: { 'Cache-Control': 'no-store' } })
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || '读取文件树失败' }, { status: typeof err?.status === 'number' ? err.status : 502 })
	}
}
