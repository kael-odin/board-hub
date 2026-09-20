import { NextResponse } from 'next/server'
import { getRole } from '@/lib/server/session'
import { readIndexList } from '@/lib/server/content'
import type { BoardIndexItem } from '@/app/boards/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 看板列表。只有登录用户能拿到：
 * admin 看到全部（含 hidden），viewer 只看到非隐藏的，未登录 401。
 */
export async function GET() {
	const role = await getRole()
	if (!role) {
		return NextResponse.json({ error: '需要登录' }, { status: 401 })
	}

	const list = await readIndexList<BoardIndexItem>()
	const visible = role === 'admin' ? list : list.filter(item => !item?.hidden)

	return NextResponse.json(visible, { headers: { 'Cache-Control': 'no-store' } })
}
