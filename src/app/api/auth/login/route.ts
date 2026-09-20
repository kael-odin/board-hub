import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, isAuthConfigured, SESSION_COOKIE, signSession } from '@/lib/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 未配置 ADMIN_PASSWORD 时给出明确的配置错误，而不是放行 */
function notConfigured(): NextResponse {
	return NextResponse.json({ error: '服务端未配置登录密码（ADMIN_PASSWORD），请联系管理员' }, { status: 501 })
}

export async function POST(req: NextRequest) {
	if (!isAuthConfigured()) return notConfigured()

	const body = (await req.json().catch(() => null)) as { password?: unknown } | null
	const password = typeof body?.password === 'string' ? body.password : ''
	if (!password) {
		return NextResponse.json({ error: '请输入密码' }, { status: 400 })
	}

	const role = checkPassword(password)
	if (!role) {
		// 失败时拖一拍，抬高暴力尝试的成本
		await new Promise(resolve => setTimeout(resolve, 800))
		return NextResponse.json({ error: '密码不正确' }, { status: 401 })
	}

	const { token, maxAge } = signSession(role)
	const res = NextResponse.json({ role })
	res.cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge
	})
	return res
}
