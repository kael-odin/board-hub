import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, listRepoFilesRecursive, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { prepareBoardsIndex, BOARDS_INDEX_PATH } from '@/lib/board-index'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../types'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDateTimeLocal } from '../stores/write-store'

export type PushBoardParams = {
	form: {
		slug: string
		title: string
		html: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

/** 看板在仓库里的目录前缀 */
export const BOARDS_DIR = 'public/boards'

export async function pushBoard(params: PushBoardParams): Promise<void> {
	const { form, cover, images, mode = 'create', originalSlug } = params

	// 基础校验（放在鉴权之前，未导入私钥也能先得到表单错误提示）
	if (!form?.slug) throw new Error('需要 slug')
	if (!form.title?.trim()) throw new Error('标题不能为空')
	if (!form.html?.trim()) throw new Error('看板内容不能为空')
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(form.slug)) {
		throw new Error('slug 只能包含英文、数字、连字符和下划线，以英文或数字开头，长度不超过 80')
	}

	if (mode === 'edit' && originalSlug && originalSlug !== form.slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}

	// 获取认证 token（自动从全局认证状态获取）
	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	// 新建模式查重，防止同 slug 静默覆盖
	if (mode === 'create') {
		const indexRaw = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, BOARDS_INDEX_PATH, latestCommitSha)
		try {
			const list = JSON.parse(indexRaw || '[]') as Array<{ slug: string; title?: string }>
			const dup = list.find(item => item.slug === form.slug)
			if (dup) throw new Error(`slug「${form.slug}」已被看板《${dup.title || dup.slug}》占用，请更换 slug`)
		} catch (err) {
			if (err instanceof Error && err.message.includes('占用')) throw err
			// 索引缺失/损坏时不阻塞发布
		}
	}

	const basePath = `${BOARDS_DIR}/${form.slug}`
	const commitMessage = mode === 'edit' ? `更新看板: ${form.slug}` : `新增看板: ${form.slug}`

	// 收集所有本地图片（正文 + 封面）
	const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []

	for (const img of images || []) {
		if (img.type === 'file') {
			allLocalImages.push({ img, id: img.id })
		}
	}

	if (cover?.type === 'file') {
		allLocalImages.push({ img: cover, id: cover.id })
	}

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let htmlToUpload = form.html
	let coverPath: string | undefined

	const treeItems: TreeItem[] = []

	// 上传图片，并把 HTML 里的 local-image: 占位符换成真实路径
	if (allLocalImages.length > 0) {
		toast.info('正在上传图片...')
		for (const { img, id } of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/boards/${form.slug}/${filename}`

			if (!uploadedHashes.has(hash)) {
				const path = `${basePath}/${filename}`
				const contentBase64 = await fileToBase64NoPrefix(img.file)
				const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
				treeItems.push({
					path,
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				})
				uploadedHashes.add(hash)
			}

			// HTML 里的占位符是 src="local-image:xxx"，所以直接替换裸 token 即可
			htmlToUpload = htmlToUpload.split(`local-image:${id}`).join(publicPath)

			if (cover?.type === 'file' && cover.id === id) {
				coverPath = publicPath
			}
		}
	}

	// 外链封面
	if (cover?.type === 'url') {
		coverPath = cover.url
	}

	// 编辑模式：回收目录下已不被引用的旧资源，避免仓库积累孤儿文件
	if (mode === 'edit' && originalSlug) {
		try {
			toast.info('正在检查旧图片引用...')
			const newRefs = new Set<string>()
			const collect = (text?: string | null) => {
				if (!text) return
				for (const m of text.matchAll(new RegExp(`/boards/${form.slug}/[A-Za-z0-9._-]+`, 'g'))) newRefs.add(m[0])
			}
			collect(htmlToUpload)
			if (coverPath) newRefs.add(coverPath)

			const existing = await listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, basePath, latestCommitSha)
			for (const p of existing) {
				if (p.endsWith('/index.html') || p.endsWith('/config.json')) continue
				if (!newRefs.has(`/${p}`)) {
					treeItems.push({ path: p, mode: '100644', type: 'blob', sha: null })
				}
			}
		} catch (err) {
			// 清理失败不阻塞发布
			console.warn('orphan image cleanup skipped:', err)
		}
	}

	toast.info('正在创建文件...')

	// 看板本体
	const htmlBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(htmlToUpload), 'base64')
	treeItems.push({
		path: `${basePath}/index.html`,
		mode: '100644',
		type: 'blob',
		sha: htmlBlob.sha
	})

	// 元信息
	const dateStr = form.date || formatDateTimeLocal()
	const config = {
		title: form.title,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category
	}

	const configBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(JSON.stringify(config, null, 2)), 'base64')
	treeItems.push({
		path: `${basePath}/config.json`,
		mode: '100644',
		type: 'blob',
		sha: configBlob.sha
	})

	// 列表索引
	const indexJson = await prepareBoardsIndex(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		{
			slug: form.slug,
			title: form.title,
			tags: form.tags,
			date: dateStr,
			summary: form.summary,
			cover: coverPath,
			hidden: form.hidden,
			category: form.category
		},
		GITHUB_CONFIG.BRANCH
	)
	const indexBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(indexJson), 'base64')
	treeItems.push({
		path: BOARDS_INDEX_PATH,
		mode: '100644',
		type: 'blob',
		sha: indexBlob.sha
	})

	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('发布成功！', {
		description: 'Vercel 正在重新部署，约 30-60 秒后可在线上看到'
	})
}
