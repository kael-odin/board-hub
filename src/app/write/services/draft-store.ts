import type { ImageItem, PublishForm } from '../types'
import type { BoardSource } from '@/app/boards/types'

/**
 * 编辑器本地草稿层（localStorage）。
 * 编辑中每 800ms 自动保存，刷新/误关标签页不丢稿。
 * File 对象无法序列化：小图在入库时转 dataUrl 随草稿保存，
 * 超大图片只保留正文占位文本，恢复时提示用户重新插入。
 */

const STORAGE_KEY = 'kael-blog-write-drafts'
// localStorage 一般 5MB，留出余量
const TOTAL_BUDGET = 4 * 1024 * 1024

export type DraftImage =
	| { id: string; url: string }
	| { id: string; dataUrl: string; filename: string }

export type DraftPayload = {
	form: PublishForm
	coverUrl?: string
	coverDataUrl?: string
	coverFilename?: string
	images: DraftImage[]
	/** true 表示有图片因超出预算未能随草稿保存 */
	filesDropped?: boolean
	/** 远端已有的原始数据附件元信息（编辑模式），恢复草稿时回填 store */
	sourceMeta?: BoardSource | null
	savedAt: number
}

function readAll(): Record<string, DraftPayload> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as Record<string, DraftPayload>) : {}
	} catch {
		return {}
	}
}

function writeAll(map: Record<string, DraftPayload>): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
		return true
	} catch {
		return false
	}
}

export function draftKey(mode: 'create' | 'edit', originalSlug: string | null): string {
	return mode === 'edit' && originalSlug ? `edit:${originalSlug}` : 'new'
}

/** 由 store 当前状态构建可序列化草稿；超出预算时从最大的图片 dataUrl 开始丢弃 */
export function buildDraftPayload(form: PublishForm, cover: ImageItem | null, images: ImageItem[], sourceMeta?: BoardSource | null): DraftPayload {
	let filesDropped = false
	const draftImages: Array<{ id: string; url?: string; dataUrl?: string; filename?: string }> = []
	for (const it of images) {
		if (it.type === 'url') {
			draftImages.push({ id: it.id, url: it.url })
		} else if (it.dataUrl) {
			draftImages.push({ id: it.id, dataUrl: it.dataUrl, filename: it.filename })
		} else {
			filesDropped = true
		}
	}

	const payload: DraftPayload = { form: { ...form }, images: draftImages as DraftImage[], filesDropped, sourceMeta: sourceMeta || null, savedAt: Date.now() }
	if (cover?.type === 'url') payload.coverUrl = cover.url
	if (cover?.type === 'file' && cover.dataUrl) {
		payload.coverDataUrl = cover.dataUrl
		payload.coverFilename = cover.filename
	} else if (cover?.type === 'file') {
		payload.filesDropped = true
	}

	if (JSON.stringify(payload).length > TOTAL_BUDGET) {
		// 从最大的 dataUrl 开始丢弃直到放得下
		const sized = draftImages
			.map((it, idx) => ({ idx, len: it.dataUrl?.length ?? 0 }))
			.filter(it => it.len > 0)
			.sort((a, b) => b.len - a.len)
		for (const { idx } of sized) {
			if (JSON.stringify(payload).length <= TOTAL_BUDGET) break
			delete draftImages[idx].dataUrl
			delete draftImages[idx].filename
			filesDropped = true
		}
		payload.images = draftImages.filter(it => it.url || it.dataUrl) as DraftImage[]
		payload.filesDropped = filesDropped
	}
	return payload
}

export function saveDraft(key: string, payload: DraftPayload): void {
	if (typeof window === 'undefined') return
	try {
		const map = readAll()
		map[key] = payload
		if (!writeAll(map)) {
			// 超配额：丢掉本条之外的旧草稿再试
			const slim: Record<string, DraftPayload> = { [key]: payload }
			if (!writeAll(slim)) console.warn('[draft] 保存草稿失败：存储空间不足')
		}
	} catch (err) {
		console.warn('[draft] 保存草稿失败', err)
	}
}

export function loadDraft(key: string): DraftPayload | null {
	if (typeof window === 'undefined') return null
	const draft = readAll()[key]
	return draft && draft.form ? draft : null
}

export function clearDraft(key: string): void {
	if (typeof window === 'undefined') return
	try {
		const map = readAll()
		delete map[key]
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
	} catch {
		// ignore
	}
}

export function formatDraftTime(savedAt: number): string {
	const d = new Date(savedAt)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File | null> {
	try {
		const res = await fetch(dataUrl)
		const blob = await res.blob()
		return new File([blob], filename, { type: blob.type || 'image/png' })
	} catch {
		return null
	}
}

/** 把草稿恢复为 store 的 images / cover 结构（file 图片由 dataUrl 还原） */
export async function draftToStoreAssets(draft: DraftPayload): Promise<{ images: ImageItem[]; cover: ImageItem | null; filesDropped: boolean }> {
	const images: ImageItem[] = []
	for (const it of draft.images) {
		if ('url' in it) {
			images.push({ id: it.id, type: 'url', url: it.url })
		} else {
			const file = await dataUrlToFile(it.dataUrl, it.filename)
			if (file) {
				images.push({ id: it.id, type: 'file', file, previewUrl: URL.createObjectURL(file), filename: it.filename })
			} else {
				images.push({ id: it.id, type: 'url', url: '' })
			}
		}
	}

	let cover: ImageItem | null = null
	if (draft.coverUrl) {
		cover = { id: Math.random().toString(36).slice(2, 10), type: 'url', url: draft.coverUrl }
	} else if (draft.coverDataUrl) {
		const file = await dataUrlToFile(draft.coverDataUrl, draft.coverFilename || 'cover')
		if (file) cover = { id: Math.random().toString(36).slice(2, 10), type: 'file', file, previewUrl: URL.createObjectURL(file), filename: file.name }
	}

	return { images, cover, filesDropped: Boolean(draft.filesDropped) }
}
