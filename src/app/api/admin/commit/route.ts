import { NextRequest, NextResponse } from 'next/server'
import { getRole } from '@/lib/server/session'
import { createBlobBase64, createCommit, createTree, getBranchHeadSha, isGithubConfigured, updateBranchHead, type TreeItem } from '@/lib/server/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 通用提交端点（admin 专属）。
 *
 * 浏览器只负责「想提交什么」，GitHub 凭据和提交动作全在服务端：
 *   body: { message, files: [{ path, base64 }], deletions?: [path] }
 *
 * 路径白名单 —— 只允许碰内容与站点资源目录，防止改到应用代码本身：
 *   content/**         看板书架 + 内容区（待收编文件等）
 *   public/**          站点静态资源（favicon、头像、音乐等，非敏感）
 *   src/config/**      站点配置 JSON
 */

const ALLOWED_PREFIXES = ['content/', 'public/', 'src/config/']
const ALLOWED_EXACT: string[] = []
/** 单次提交的总体积护栏（Vercel 函数请求体上限约 4.5MB，留余量） */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024

function isAllowedPath(p: string): boolean {
	if (!p || p.includes('\\') || p.includes('..')) return false
	if (ALLOWED_EXACT.includes(p)) return true
	return ALLOWED_PREFIXES.some(prefix => p.startsWith(prefix))
}

export async function POST(req: NextRequest) {
	const role = await getRole()
	if (role !== 'admin') {
		return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
	}

	const body = (await req.json().catch(() => null)) as
		| { message?: unknown; files?: unknown; deletions?: unknown }
		| null

	const message = typeof body?.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 200) : null
	if (!message) return NextResponse.json({ error: '缺少提交说明' }, { status: 400 })

	const files = Array.isArray(body?.files) ? (body!.files as Array<{ path?: unknown; base64?: unknown }>) : []
	const deletions = Array.isArray(body?.deletions) ? (body!.deletions as unknown[]).filter((p): p is string => typeof p === 'string') : []
	if (files.length === 0 && deletions.length === 0) {
		return NextResponse.json({ error: '没有要提交的内容' }, { status: 400 })
	}

	const treeItems: TreeItem[] = []
	let totalBytes = 0
	for (const file of files) {
		if (typeof file?.path !== 'string' || typeof file?.base64 !== 'string') {
			return NextResponse.json({ error: 'files 里存在格式错误的条目' }, { status: 400 })
		}
		if (!isAllowedPath(file.path)) {
			return NextResponse.json({ error: `路径不在白名单内：${file.path}` }, { status: 400 })
		}
		totalBytes += file.base64.length
		if (totalBytes > MAX_TOTAL_BYTES) {
			return NextResponse.json({ error: '单次提交总体积超过 4MB 上限，请拆分或压缩后再发布' }, { status: 413 })
		}
	}
	for (const p of deletions) {
		if (!isAllowedPath(p)) {
			return NextResponse.json({ error: `路径不在白名单内：${p}` }, { status: 400 })
		}
	}

	if (!isGithubConfigured()) {
		return NextResponse.json({ error: '服务端未配置 GitHub App，无法写入仓库' }, { status: 501 })
	}

	for (const file of files) {
		const sha = await createBlobBase64(file.base64 as string)
		treeItems.push({ path: file.path as string, mode: '100644', type: 'blob', sha })
	}
	for (const p of deletions) {
		treeItems.push({ path: p, mode: '100644', type: 'blob', sha: null })
	}

	try {
		const headSha = await getBranchHeadSha()
		const treeSha = await createTree(treeItems, headSha)
		const commitSha = await createCommit(message, treeSha, [headSha])
		await updateBranchHead(commitSha)
	} catch (err: any) {
		const status = typeof err?.status === 'number' ? err.status : 502
		return NextResponse.json({ error: err?.message || '提交失败' }, { status })
	}

	return NextResponse.json({ ok: true })
}
