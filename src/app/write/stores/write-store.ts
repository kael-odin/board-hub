import { create } from 'zustand'
import { toast } from 'sonner'
import { hashFileSHA256 } from '@/lib/file-utils'
import { compressImageToWebp, isCompressibleImage } from '@/lib/image-compress'
import { loadBoard } from '@/lib/load-board'
import { draftKey, draftToStoreAssets, loadDraft, type DraftPayload } from '../services/draft-store'
import type { PublishForm, ImageItem } from '../types'

/** 单张图片转 dataUrl 的上限（超过则不随本地草稿持久化） */
const DATAURL_BUDGET = 400 * 1024

/** 单个视频文件上限：GitHub blob 硬限 100MB，留出 base64 余量 */
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string | null> {
	return new Promise(resolve => {
		if (file.size > DATAURL_BUDGET) return resolve(null)
		const reader = new FileReader()
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
		reader.onerror = () => resolve(null)
		reader.readAsDataURL(file)
	})
}

export const formatDateTimeLocal = (date: Date = new Date()): string => {
	const pad = (n: number) => String(n).padStart(2, '0')
	const year = date.getFullYear()
	const month = pad(date.getMonth() + 1)
	const day = pad(date.getDate())
	const hours = pad(date.getHours())
	const minutes = pad(date.getMinutes())
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

type WriteStore = {
	// Mode state
	mode: 'create' | 'edit'
	originalSlug: string | null
	setMode: (mode: 'create' | 'edit', originalSlug?: string) => void

	// Form state
	form: PublishForm
	updateForm: (updates: Partial<PublishForm>) => void
	setForm: (form: PublishForm) => void

	// Image state
	images: ImageItem[]
	addUrlImage: (url: string) => void
	addFiles: (files: FileList | File[]) => Promise<ImageItem[]>
	deleteImage: (id: string) => void

	// Cover state
	cover: ImageItem | null
	setCover: (cover: ImageItem | null) => void

	// Publish state
	loading: boolean
	setLoading: (loading: boolean) => void

	// Load board for editing
	loadBoardForEdit: (slug: string) => Promise<void>

	// Restore local draft
	restoreFromDraft: (draft: DraftPayload) => Promise<{ filesDropped: boolean }>

	// Reset to create mode
	reset: () => void
}

const initialForm: PublishForm = {
	slug: '',
	title: '',
	html: '',
	tags: [],
	date: formatDateTimeLocal(),
	summary: '',
	hidden: false,
	category: ''
}

export const useWriteStore = create<WriteStore>((set, get) => ({
	// Mode state
	mode: 'create',
	originalSlug: null,
	setMode: (mode, originalSlug) => set({ mode, originalSlug: originalSlug || null }),

	// Form state
	form: { ...initialForm },
	updateForm: updates => set(state => ({ form: { ...state.form, ...updates } })),
	setForm: form => set({ form }),

	// Image state
	images: [],
	addUrlImage: url => {
		const { images } = get()
		const exists = images.some(it => it.type === 'url' && it.url === url)
		if (exists) {
			toast.info('该图片已在列表中')
			return
		}
		const id = Math.random().toString(36).slice(2, 10)
		set(state => ({ images: [{ id, type: 'url', url }, ...state.images] }))
	},
	// 单个视频文件上限：GitHub blob 硬限 100MB，留出 base64 余量
	addFiles: async (files: FileList | File[]) => {
		const { images } = get()
		const rejected: string[] = []
		const arr = Array.from(files).filter(f => {
			if (f.type.startsWith('video/')) {
				if (f.size > MAX_VIDEO_BYTES) {
					rejected.push(f.name)
					return false
				}
				return true
			}
			return f.type.startsWith('image/')
		})
		if (rejected.length > 0) {
			toast.error(`以下视频超过 80MB 上限，请压缩后上传：${rejected.join('、')}`)
		}
		if (arr.length === 0) return []

		// 自动压缩：可压缩栅格图转 WebP（超大图缩放），失败或无收益则保留原图
		let compressedCount = 0
		let savedBytes = 0
		const processed = await Promise.all(
			arr.map(async f => {
				if (!isCompressibleImage(f)) return f
				try {
					const out = await compressImageToWebp(f)
					if (out !== f) {
						compressedCount++
						savedBytes += f.size - out.size
					}
					return out
				} catch {
					return f
				}
			})
		)
		if (compressedCount > 0) {
			toast.info(`已自动压缩 ${compressedCount} 张图片，节省 ${(savedBytes / 1024 / 1024).toFixed(1)} MB`)
		}

		const existingHashes = new Map<string, ImageItem>(
			images
				.filter((it): it is Extract<ImageItem, { type: 'file'; hash?: string }> => it.type === 'file' && (it as any).hash)
				.map(it => [(it as any).hash as string, it])
		)

		const computed = await Promise.all(
			processed.map(async file => {
				const hash = await hashFileSHA256(file)
				return { file, hash }
			})
		)

		const seen = new Set<string>()
		const unique = computed.filter(({ hash }) => {
			if (existingHashes.has(hash)) return false
			if (seen.has(hash)) return false
			seen.add(hash)
			return true
		})

		const resultImages: ImageItem[] = []

		// 处理已存在的图片
		for (const { hash } of computed) {
			if (existingHashes.has(hash)) {
				resultImages.push(existingHashes.get(hash)!)
			}
		}

		// 处理新图片（小图同时生成 dataUrl 供本地草稿持久化）
		if (unique.length > 0) {
			const newItems: ImageItem[] = await Promise.all(
				unique.map(async ({ file, hash }) => {
					const id = Math.random().toString(36).slice(2, 10)
					const previewUrl = URL.createObjectURL(file)
					const filename = file.name
					const dataUrl = await readAsDataUrl(file)
					return { id, type: 'file', file, previewUrl, filename, hash, dataUrl: dataUrl || undefined } as ImageItem
				})
			)

			set(state => ({ images: [...newItems, ...state.images] }))
			resultImages.push(...newItems)
		} else if (resultImages.length === 0) {
			toast.info('图片已存在，不重复添加')
		}

		return resultImages
	},
	deleteImage: id =>
		set(state => {
			for (const it of state.images) {
				if (it.type === 'file' && it.id === id) {
					URL.revokeObjectURL(it.previewUrl)

					if (it.id === state.cover?.id) {
						set({ cover: null })
					}
				}
			}
			return { images: state.images.filter(it => it.id !== id) }
		}),

	// Cover state
	cover: null,
	setCover: cover => set({ cover }),

	// Publish state
	loading: false,
	setLoading: loading => set({ loading }),

	// Load board for editing
	loadBoardForEdit: async (slug: string) => {
		try {
			set({ loading: true })
			const board = await loadBoard(slug)

			// 从 HTML 里提取引用的图片/视频，避免重复上传。
			// 只收集被 `<img src>` / `<video src>` / `<source src>` 引用，
			// 且不是封面、不是尚未上传的 local-image 占位符的资源。
			const images: ImageItem[] = []
			const srcRegex = /<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi
			let match
			while ((match = srcRegex.exec(board.html)) !== null) {
				const url = match[1]
				if (url && url !== board.cover && !url.startsWith('local-image:') && !url.startsWith('data:')) {
					if (!images.some(img => img.type === 'url' && img.url === url)) {
						const id = Math.random().toString(36).slice(2, 10)
						images.push({ id, type: 'url', url })
					}
				}
			}

			// Set cover
			let cover: ImageItem | null = null
			if (board.cover) {
				const coverId = Math.random().toString(36).slice(2, 10)
				cover = { id: coverId, type: 'url', url: board.cover }
			}

			// Set form
			set({
				mode: 'edit',
				originalSlug: slug,
				form: {
					slug,
					title: board.config.title || '',
					html: board.html,
					tags: board.config.tags || [],
					date: board.config.date ? formatDateTimeLocal(new Date(board.config.date)) : formatDateTimeLocal(),
					summary: board.config.summary || '',
					hidden: board.config.hidden || false,
					category: board.config.category || ''
				},
				images,
				cover,
				loading: false
			})

			toast.success('看板加载成功')

			// 线上加载完后检查本地草稿：若与线上内容不同，视为未保存的修改，恢复之
			const draft = loadDraft(draftKey('edit', slug))
			if (draft && draft.form.html !== board.html) {
				await get().restoreFromDraft(draft)
				toast.success('已恢复本地未保存的修改', {
					description: `草稿保存于 ${new Date(draft.savedAt).toLocaleString('zh-CN')}，发布后自动清除`
				})
			}
		} catch (err: any) {
			console.error('Failed to load board:', err)
			toast.error(err?.message || '加载看板失败')
			set({ loading: false })
			throw err
		}
	},

	// Restore local draft
	restoreFromDraft: async (draft: DraftPayload) => {
		const { images, cover, filesDropped } = await draftToStoreAssets(draft)
		set({
			form: { ...draft.form },
			images,
			cover
		})
		return { filesDropped }
	},

	// Reset to create mode
	reset: () => {
		// Revoke object URLs
		const { images, cover } = get()
		for (const img of images) {
			if (img.type === 'file') {
				URL.revokeObjectURL(img.previewUrl)
			}
		}
		if (cover?.type === 'file') {
			URL.revokeObjectURL(cover.previewUrl)
		}

		set({
			mode: 'create',
			originalSlug: null,
			form: { ...initialForm, date: formatDateTimeLocal() },
			images: [],
			cover: null
		})
	}
}))
