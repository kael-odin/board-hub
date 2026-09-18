/**
 * 部署子路径支持。
 *
 * 当站点部署在子路径下（例如 GitHub Pages 的 /board-hub/），
 * 所有站内绝对路径都必须带上这个前缀，否则会 404。
 * Next.js 只会自动处理 /_next/* 的资源，public/ 下的文件和
 * 内容里写死的路径得我们自己加。
 *
 * 部署在根路径（Vercel / 自定义域名）时把它留空即可，所有函数会退化成恒等操作。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** 给单个站内绝对路径加前缀。外链、data:、相对路径原样返回。 */
export function withBase(path?: string | null): string {
	if (!path) return ''
	// 协议相对外链（//cdn.example.com）和带协议的都不要动
	if (!path.startsWith('/') || path.startsWith('//')) return path
	if (!BASE_PATH) return path
	return `${BASE_PATH}${path}`
}

/** public/ 下需要加前缀的顶层目录 */
const ASSET_ROOTS = 'boards|images|music|live2d|favicon|manifest'

/**
 * 把一段 HTML / Markdown / JSON 文本里所有站内资源绝对路径批量加前缀。
 * 用于看板正文 —— 里面的 `<img src="/boards/...">` 是发布时写死的，
 * 换部署路径后必须重写。
 */
export function rewriteAssets(text: string): string {
	if (!text || !BASE_PATH) return text
	// 只处理紧跟在引号或 markdown 左括号后的站内路径，避免误伤正文里的其他斜杠
	return text.replace(new RegExp(`(["'(])/(${ASSET_ROOTS})/`, 'g'), `$1${BASE_PATH}/$2/`)
}

/** 站内 API / 静态资源的 fetch 前缀（当前没有服务端 API，保留给以后用） */
export function apiPath(path: string): string {
	return withBase(path)
}
