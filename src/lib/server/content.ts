import { promises as fs } from 'fs'
import path from 'path'

/**
 * 内容目录读取层。
 *
 * 看板内容放在 content/boards/（git 跟踪但不在 public/ 下，Web 服务器不会直接吐出去），
 * 所有读取都必须经过带鉴权的 API 路由。
 *
 * Vercel 上由 next.config.ts 的 outputFileTracingIncludes 把 content/**
 * 打进 serverless 包，运行时从工作目录读。
 */

export const CONTENT_ROOT = path.join(process.cwd(), 'content', 'boards')

export const BOARDS_INDEX_FILE = 'content/boards/index.json'

const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/

/** 文件名只允许这一组字符，且不允许目录跳转 */
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

export function isValidSlug(slug: string): boolean {
	return SLUG_RE.test(slug)
}

export function isSafeAssetName(name: string): boolean {
	return NAME_RE.test(name) && !name.includes('..')
}

export type DirEntry = { name: string; size: number }

/** 列出某个看板目录下的文件（不存在返回空数组） */
export async function listBoardFiles(slug: string): Promise<DirEntry[]> {
	if (!isValidSlug(slug)) return []
	try {
		const items = await fs.readdir(path.join(CONTENT_ROOT, slug), { withFileTypes: true })
		const out: DirEntry[] = []
		for (const item of items) {
			if (!item.isFile()) continue
			try {
				const st = await fs.stat(path.join(CONTENT_ROOT, slug, item.name))
				out.push({ name: item.name, size: st.size })
			} catch {
				// 忽略刚好被删掉的文件
			}
		}
		return out
	} catch {
		return []
	}
}

/** 读看板目录下的单个文件；不存在返回 null */
export async function readBoardFile(slug: string, name: string): Promise<Buffer | null> {
	if (!isValidSlug(slug) || !isSafeAssetName(name)) return null
	try {
		return await fs.readFile(path.join(CONTENT_ROOT, slug, name))
	} catch {
		return null
	}
}

export async function readBoardText(slug: string, name: string): Promise<string | null> {
	const buf = await readBoardFile(slug, name)
	return buf ? buf.toString('utf-8') : null
}

async function readJson<T>(file: string): Promise<T | null> {
	try {
		return JSON.parse(await fs.readFile(file, 'utf-8')) as T
	} catch {
		return null
	}
}

/** 看板列表索引（content/boards/index.json）；缺失或损坏按空列表处理 */
export async function readIndexList<T>(): Promise<T[]> {
	const list = await readJson<T[]>(path.join(CONTENT_ROOT, 'index.json'))
	return Array.isArray(list) ? list : []
}

export function contentTypeFor(name: string): string {
	const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
	switch (ext) {
		case 'xlsx':
			return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		case 'xls':
			return 'application/vnd.ms-excel'
		case 'csv':
			return 'text/csv; charset=utf-8'
		case 'png':
			return 'image/png'
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg'
		case 'gif':
			return 'image/gif'
		case 'webp':
			return 'image/webp'
		case 'svg':
			return 'image/svg+xml'
		case 'avif':
			return 'image/avif'
		case 'json':
			return 'application/json; charset=utf-8'
		case 'md':
		case 'markdown':
			return 'text/markdown; charset=utf-8'
		default:
			// html 一律当纯文本吐（nosniff），避免存储型 HTML 在站点源上直接执行
			return 'text/plain; charset=utf-8'
	}
}
