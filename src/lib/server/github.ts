import { createSign } from 'crypto'

/**
 * 服务端 GitHub App 访问层。
 *
 * 私钥只存在 Vercel 环境变量里，浏览器永远接触不到；
 * 浏览器里的写入请求先过会话鉴权（admin），再由这里的函数完成 GitHub 提交。
 */

const GH_API = 'https://api.github.com'

function config() {
	const owner = process.env.GITHUB_OWNER || process.env.NEXT_PUBLIC_GITHUB_OWNER || 'kael-odin'
	const repo = process.env.GITHUB_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO || 'board-hub'
	const branch = process.env.GITHUB_BRANCH || process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main'
	const appId = process.env.GITHUB_APP_ID || process.env.NEXT_PUBLIC_GITHUB_APP_ID || ''
	// 环境变量里的换行可能是字面 \n，统一还原成真实换行
	const pemRaw = process.env.GITHUB_APP_PRIVATE_KEY || ''
	const pem = pemRaw.includes('\\n') ? pemRaw.replace(/\\n/g, '\n') : pemRaw
	return { owner, repo, branch, appId, pem }
}

export function isGithubConfigured(): boolean {
	const { appId, pem } = config()
	return Boolean(appId && appId !== '-' && pem)
}

function signJwt(appId: string, pem: string): string {
	const now = Math.floor(Date.now() / 1000)
	const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
	const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iat: now - 60, exp: now + 480, iss: appId })}`
	const signature = createSign('RSA-SHA256').update(input).sign(pem, 'base64url')
	return `${input}.${signature}`
}

let cachedToken: { token: string; expiresAt: number } | null = null

/** installation token 进程内缓存（serverless 实例存活期内复用） */
async function installationToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token

	const { owner, repo, appId, pem } = config()
	if (!appId || !pem) throw new HttpError(501, '服务端未配置 GitHub App（GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY）')

	const jwt = signJwt(appId, pem)
	const h = { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json' }

	const instRes = await fetch(`${GH_API}/repos/${owner}/${repo}/installation`, { headers: h, cache: 'no-store' })
	if (instRes.status === 404) throw new HttpError(501, `GitHub App 未安装到 ${owner}/${repo} 仓库`)
	if (!instRes.ok) throw new HttpError(502, `获取 App 安装信息失败：${instRes.status}`)
	const { id } = (await instRes.json()) as { id: number }

	const tokRes = await fetch(`${GH_API}/app/installations/${id}/access_tokens`, { method: 'POST', headers: h, cache: 'no-store' })
	if (!tokRes.ok) throw new HttpError(502, `创建安装令牌失败：${tokRes.status}`)
	const { token } = (await tokRes.json()) as { token: string; expires_at?: string }
	const expiresAt = Date.now() + 45 * 60 * 1000
	cachedToken = { token, expiresAt }
	return token
}

export class HttpError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

async function gh<T = any>(path: string, init?: RequestInit): Promise<T> {
	const token = await installationToken()
	const res = await fetch(`${GH_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...init?.headers
		},
		cache: 'no-store'
	})
	if (res.status === 401) cachedToken = null
	if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, `GitHub 请求失败（${res.status}）：${path}`)
	return (await res.json()) as T
}

export async function getBranchHeadSha(): Promise<string> {
	const { owner, repo, branch } = config()
	const data = await gh<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`)
	return data.object.sha
}

export async function createBlobBase64(base64: string): Promise<string> {
	const { owner, repo } = config()
	const data = await gh<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
		method: 'POST',
		body: JSON.stringify({ content: base64, encoding: 'base64' })
	})
	return data.sha
}

export type TreeItem = { path: string; mode: '100644'; type: 'blob'; sha: string | null }

export async function createTree(items: TreeItem[], baseTree: string): Promise<string> {
	const { owner, repo } = config()
	const data = await gh<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		body: JSON.stringify({ tree: items, base_tree: baseTree })
	})
	return data.sha
}

export async function createCommit(message: string, treeSha: string, parents: string[]): Promise<string> {
	const { owner, repo } = config()
	const data = await gh<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
		method: 'POST',
		body: JSON.stringify({ message, tree: treeSha, parents })
	})
	return data.sha
}

export async function updateBranchHead(sha: string): Promise<void> {
	const { owner, repo, branch } = config()
	await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
		method: 'PATCH',
		body: JSON.stringify({ sha, force: false })
	})
}

export type RepoTreeEntry = { path: string; size?: number; sha: string }

/** 全仓库文件树（recursive） */
export async function listRepoTree(): Promise<RepoTreeEntry[]> {
	const { owner, repo, branch } = config()
	const data = await gh<{ tree: Array<{ path: string; type: string; size?: number; sha: string }>; truncated?: boolean }>(
		`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
	)
	if (data.truncated) throw new HttpError(500, '仓库文件太多，GitHub 截断了树')
	return data.tree.filter(i => i.type === 'blob').map(i => ({ path: i.path, size: i.size, sha: i.sha }))
}

/** 按 sha 读文件内容（base64，Git Blob API 支持最大 100MB） */
export async function readBlobBase64(sha: string): Promise<string> {
	const { owner, repo } = config()
	const data = await gh<{ content: string }>(`/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`)
	return String(data.content || '').replace(/\n/g, '')
}

/** 单文件写回（Contents API，自动带 sha 覆盖） */
export async function putTextFile(pathname: string, text: string, message: string): Promise<void> {
	const { owner, repo, branch } = config()
	const encoded = encodeURIComponent(pathname).replace(/%2F/g, '/')
	let sha: string | undefined
	const headRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`, {
		headers: { Authorization: `Bearer ${await installationToken()}`, Accept: 'application/vnd.github+json' },
		cache: 'no-store'
	})
	if (headRes.ok) {
		const data = (await headRes.json()) as { sha?: string }
		sha = data.sha
	}
	await gh(`/repos/${owner}/${repo}/contents/${encoded}`, {
		method: 'PUT',
		body: JSON.stringify({ message, content: Buffer.from(text, 'utf-8').toString('base64'), branch, ...(sha ? { sha } : {}) })
	})
}

export function repoInfo() {
	const { owner, repo, branch } = config()
	return { owner, repo, branch }
}
