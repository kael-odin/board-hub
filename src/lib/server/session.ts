import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * 会话鉴权（无数据库）。
 *
 * 密码来自环境变量，登录成功后签发一张 HMAC-SHA256 签名的 cookie：
 *   <base64url(payload)>.<base64url(hmac)>   payload = { r: role, e: 过期时间戳 }
 *
 * 两种角色：
 *   admin  —— 管理者：查看/下载/编辑/发布/删除，以及仓库浏览
 *   viewer —— 查看者：只能查看与下载
 *
 * 环境变量：
 *   AUTH_SECRET      签名密钥（必填，随机长字符串）
 *   ADMIN_PASSWORD   管理员密码（必填）
 *   VIEWER_PASSWORD  查看者密码（可选；不设则没有查看者入口）
 */

export type Role = 'admin' | 'viewer'

export const SESSION_COOKIE = 'bh_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret(): string {
	const s = process.env.AUTH_SECRET
	if (!s || s.length < 8) {
		// 未配置时给一个可预知的兜底，只在本地开发时会出现
		console.warn('[auth] AUTH_SECRET 未配置，使用不安全的开发密钥')
		return 'board-hub-dev-insecure-secret'
	}
	return s
}

export function isAuthConfigured(): boolean {
	return Boolean(process.env.ADMIN_PASSWORD)
}

/** 用哪个密码登录就是哪种角色，两个都不匹配则拒绝 */
export function checkPassword(password: string): Role | null {
	const admin = process.env.ADMIN_PASSWORD
	const viewer = process.env.VIEWER_PASSWORD
	if (admin && safeEqual(password, admin)) return 'admin'
	if (viewer && safeEqual(password, viewer)) return 'viewer'
	return null
}

export function signSession(role: Role): { token: string; maxAge: number } {
	const maxAge = SESSION_TTL_MS / 1000
	const payload = Buffer.from(JSON.stringify({ r: role, e: Date.now() + SESSION_TTL_MS })).toString('base64url')
	const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
	return { token: `${payload}.${sig}`, maxAge }
}

export function verifySessionToken(token: string | undefined | null): Role | null {
	if (!token) return null
	const dot = token.lastIndexOf('.')
	if (dot <= 0) return null
	const payload = token.slice(0, dot)
	const sig = token.slice(dot + 1)
	const expected = createHmac('sha256', secret()).update(payload).digest()
	let given: Buffer
	try {
		given = Buffer.from(sig, 'base64url')
	} catch {
		return null
	}
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { r?: string; e?: number }
		if (!data.e || typeof data.e !== 'number' || Date.now() > data.e) return null
		if (data.r === 'admin' || data.r === 'viewer') return data.r
		return null
	} catch {
		return null
	}
}

/** 服务端组件 / 路由处理器里读取当前角色 */
export async function getRole(): Promise<Role | null> {
	const store = await cookies()
	return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

/**
 * 内容资源签名 token。
 * 看板 HTML 在 sandbox iframe（opaque origin）里渲染时，浏览器不会带 cookie，
 * 里面的 <img> 等子资源靠 URL 上的这个 token 通过鉴权。
 * 只有能读到看板内容的人见过这个 URL，风险可控。
 */
export function assetToken(slug: string): string {
	return createHmac('sha256', secret()).update(`asset:${slug}`).digest('hex').slice(0, 24)
}

export function verifyAssetToken(slug: string, token: string | null | undefined): boolean {
	if (!token) return false
	const expected = assetToken(slug)
	if (token.length !== expected.length) return false
	return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8')
	const bb = Buffer.from(b, 'utf8')
	if (ab.length !== bb.length) {
		// 长度不等也跑一次比较，抹平时序差异
		timingSafeEqual(ab, ab)
		return false
	}
	return timingSafeEqual(ab, bb)
}
