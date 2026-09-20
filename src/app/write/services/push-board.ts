import { commitToRepo, boardAssetUrl, fetchBoardIndex } from '@/lib/board-api'
import { fileToBase64NoPrefix, hashFileSHA256, toBase64Utf8 } from '@/lib/file-utils'
import { upsertBoardItem, BOARDS_INDEX_PATH, type BoardIndexItem } from '@/lib/board-index'
import type { ImageItem } from '../types'
import type { BoardType, BoardSource } from '@/app/boards/types'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDateTimeLocal } from '../stores/write-store'

export type PushBoardParams = {
	form: {
		slug: string
		title: string
		type: BoardType
		content: string
		snapshot: unknown | null
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	/** 待上传的原始数据附件（如 .xlsx 源文件）；不传表示本次没有新文件 */
	sourceFile?: File | null
	/** 远端已有且要保留的附件元信息（编辑模式未更换文件时）；与 sourceFile 都为空则删除附件 */
	keepSource?: BoardSource | null
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

/** 看板在仓库里的目录前缀（content/ 目录，须经鉴权 API 出库） */
export const BOARDS_DIR = 'content/boards'

/** 每种类型对应的正文文件名；image 类型没有正文文件，内容就是图片列表 */
const ENTRY_FILE: Record<BoardType, string | null> = {
	html: 'index.html',
	markdown: 'index.md',
	sheet: 'sheet.json',
	image: null
}

/** 看板目录里属于原始数据附件的文件（source.xlsx / source.csv …） */
function isSourcePath(p: string): boolean {
	return /\/source\.[a-z0-9]+$/i.test(p)
}

/** 编辑时不能误删的文件（正文 + 元信息） */
function isProtectedPath(p: string): boolean {
	return p.endsWith('/index.html') || p.endsWith('/index.md') || p.endsWith('/sheet.json') || p.endsWith('/config.json')
}

export async function pushBoard(params: PushBoardParams): Promise<void> {
	const { form, cover, images, sourceFile, keepSource, mode = 'create', originalSlug } = params

	// 基础校验（服务端 commit API 还有白名单与体积校验兜底）
	if (!form?.slug) throw new Error('需要 slug')
	if (!form.title?.trim()) throw new Error('标题不能为空')
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(form.slug)) {
		throw new Error('slug 只能包含英文、数字、连字符和下划线，以英文或数字开头，长度不超过 80')
	}
	if (form.type === 'html' || form.type === 'markdown') {
		if (!form.content?.trim()) throw new Error(`${form.type === 'html' ? 'HTML' : 'Markdown'} 内容不能为空`)
	}
	if (form.type === 'sheet' && !form.snapshot) {
		throw new Error('表格内容为空，请先导入或新建表格')
	}

	if (mode === 'edit' && originalSlug && originalSlug !== form.slug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}

	toast.info('正在读取看板索引...')
	const indexList = await fetchBoardIndex()

	// 新建模式查重，防止同 slug 静默覆盖
	if (mode === 'create') {
		const dup = indexList.find(item => item.slug === form.slug)
		if (dup) throw new Error(`slug「${form.slug}」已被看板《${dup.title || dup.slug}》占用，请更换 slug`)
	}

	const basePath = `${BOARDS_DIR}/${form.slug}`
	const commitMessage = mode === 'edit' ? `更新看板: ${form.slug}` : `新增看板: ${form.slug}`

	// 收集所有需要上传的本地图片（正文引用 + 封面 + 图片看板的图）
	const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []
	for (const img of images || []) {
		if (img.type === 'file') allLocalImages.push({ img, id: img.id })
	}
	if (cover?.type === 'file') allLocalImages.push({ img: cover, id: cover.id })

	toast.info('正在准备文件...')

	const commitFiles: Array<{ path: string; base64: string }> = []
	const uploadedHashes = new Set<string>()
	let contentToUpload = form.content
	let coverPath: string | undefined
	/** 图片看板用：每张图在站点上的公开访问路径 */
	const galleryPaths: string[] = []

	if (allLocalImages.length > 0) {
		toast.info('正在上传图片...')
		for (const { img, id } of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = boardAssetUrl(form.slug, filename)

			if (!uploadedHashes.has(hash)) {
				const contentBase64 = await fileToBase64NoPrefix(img.file)
				commitFiles.push({ path: `${basePath}/${filename}`, base64: contentBase64 })
				uploadedHashes.add(hash)
			}

			// 正文里的占位符换成真实路径
			if (contentToUpload) {
				contentToUpload = contentToUpload.split(`local-image:${id}`).join(publicPath)
			}

			if (cover?.type === 'file' && cover.id === id) coverPath = publicPath
		}
	}

	// 图片列表：外链保持原样，本地文件用上传后的路径
	for (const img of images || []) {
		galleryPaths.push(img.type === 'url' ? img.url : boardAssetUrl(form.slug, `${img.hash}${getFileExt(img.filename || '')}`))
	}

	if (cover?.type === 'url') coverPath = cover.url

	// 图片看板没手动设封面时，用第一张图当封面 —— 卡片墙就有缩略图可显示，
	// 索引里也不用再存整个图片列表
	if (!coverPath && form.type === 'image' && galleryPaths.length > 0) {
		coverPath = galleryPaths[0]
	}

	// 原始数据附件：有新文件就上传（覆盖旧附件），否则按 keepSource 原样保留
	let sourceMetaOut: BoardSource | null = null
	if (sourceFile) {
		toast.info('正在上传原始数据附件...')
		// 用文件自己的扩展名（getFileExt 是图片专用的白名单，这里不能复用）
		const dot = sourceFile.name.lastIndexOf('.')
		const rawExt = dot >= 0 ? sourceFile.name.slice(dot).toLowerCase() : ''
		const ext = /^\.[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : '.bin'
		const filename = `source${ext}`
		const contentBase64 = await fileToBase64NoPrefix(sourceFile)
		commitFiles.push({ path: `${basePath}/${filename}`, base64: contentBase64 })
		sourceMetaOut = { file: filename, name: sourceFile.name, size: sourceFile.size }
	} else if (keepSource?.file) {
		sourceMetaOut = keepSource
	}

	// 编辑模式：回收目录下已不被引用的旧资源
	const deletions: string[] = []
	if (mode === 'edit' && originalSlug) {
		try {
			toast.info('正在检查旧文件引用...')
			const res = await fetch(`/api/boards/${encodeURIComponent(originalSlug)}`, { cache: 'no-store' })
			if (!res.ok) throw new Error(String(res.status))
			const data = (await res.json()) as { files?: Array<{ name: string }> }
			const newRefs = new Set<string>()
			const collect = (text?: string | null) => {
				if (!text) return
				for (const m of text.matchAll(new RegExp(`/api/boards/${form.slug}/asset/[A-Za-z0-9._-]+`, 'g'))) newRefs.add(m[0])
				// 兼容更早版本写死的 /boards/<slug>/<file> 引用
				for (const m of text.matchAll(new RegExp(`/boards/${form.slug}/[A-Za-z0-9._-]+`, 'g'))) newRefs.add(m[0])
			}
			collect(contentToUpload)
			if (coverPath) newRefs.add(coverPath)
			for (const p of galleryPaths) newRefs.add(p)

			for (const f of data.files || []) {
				const path = `${basePath}/${f.name}`
				if (isProtectedPath(path)) continue
				// 附件文件：保留当前生效的那一个，其余（被替换/被移除的）清掉
				if (isSourcePath(path)) {
					if (sourceMetaOut && f.name === sourceMetaOut.file) continue
					deletions.push(path)
					continue
				}
				const urlPath = `/${path.replace(/^content\//, 'api/')}`
				if (!newRefs.has(urlPath) && !newRefs.has(`/${f.name}`)) {
					// 正文里的引用形如 /api/boards/<slug>/<file>，文件名兜底比对
					const fileRef = `/${f.name}`
					const referenced = Array.from(newRefs).some(ref => ref.endsWith(fileRef))
					if (!referenced) deletions.push(path)
				}
			}
		} catch (err) {
			// 清理失败不阻塞发布
			console.warn('orphan file cleanup skipped:', err)
		}
	}

	toast.info('正在写入正文与元信息...')

	// 正文文件：按类型决定文件名和内容
	const entry = ENTRY_FILE[form.type]
	if (entry) {
		const body = form.type === 'sheet' ? JSON.stringify(form.snapshot, null, 2) : contentToUpload
		commitFiles.push({ path: `${basePath}/${entry}`, base64: toBase64Utf8(body) })
	}

	// 元信息
	const dateStr = form.date || formatDateTimeLocal()
	const config: Record<string, unknown> = {
		title: form.title,
		type: form.type,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category
	}
	// 图片看板把图片列表也存进元信息，渲染时直接读它
	if (form.type === 'image') config.images = galleryPaths
	// 原始数据附件元信息（null 时不写字段，编辑清理逻辑会移除多余附件文件）
	if (sourceMetaOut) config.source = sourceMetaOut
	commitFiles.push({ path: `${basePath}/config.json`, base64: toBase64Utf8(JSON.stringify(config, null, 2)) })

	// 列表索引
	const nextIndex = upsertBoardItem(indexList as BoardIndexItem[], {
		slug: form.slug,
		title: form.title,
		type: form.type,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category
	})
	commitFiles.push({ path: BOARDS_INDEX_PATH, base64: toBase64Utf8(JSON.stringify(nextIndex, null, 2)) })

	toast.info('正在提交到仓库...')
	await commitToRepo({ message: commitMessage, files: commitFiles, deletions })

	toast.success('发布成功！', {
		description: '正在重新部署，约 1-2 分钟后可在线上看到'
	})
}
