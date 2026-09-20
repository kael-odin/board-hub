import { assetToken } from './session'

/**
 * 资源 URL 重写助手（服务端用）。
 *
 * 内容里写死的资源路径有两代：
 *   旧：/boards/<slug>/<file>        —— public/ 静态托管时代直接落在文件路径上
 *   新：/api/boards/<slug>/asset/<file> —— 走鉴权 API
 * 读出来时统一把旧的映射成新的，老看板不用迁移。
 */

function apiAssetPrefix(slug: string): string {
	return `/api/boards/${encodeURIComponent(slug)}/asset/`
}

/** 把一个资源 URL 从旧路径映射到鉴权 API 路径；外链、data: 原样返回 */
export function legacyToApi(slug: string, url: string): string {
	if (!url || !url.startsWith('/')) return url
	const prefix = `/boards/${slug}/`
	if (!url.startsWith(prefix)) return url
	const file = url.slice(prefix.length)
	// 只映射纯文件名，防止怪路径混进来
	return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file) ? `${apiAssetPrefix(slug)}${file}` : url
}

/**
 * 给正文（html/markdown）里指向本看板资源的 URL 追加签名 token。
 * sandbox iframe 是 opaque origin，里面的 img/canvas 子资源带不了 cookie，
 * 靠 URL 上的 ?k= 通过鉴权；URL 只会出现在能读到内容的人手里，风险可控。
 */
export function signAssetUrls(text: string, slug: string): string {
	if (!text) return text
	const k = assetToken(slug)
	return text.replace(
		new RegExp(`(/api/boards/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/asset/[A-Za-z0-9._-]+)(?!\\?)(?![\\w.-])`, 'g'),
		`$1?k=${k}`
	)
}
