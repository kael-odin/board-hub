'use client'

import { motion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { BOARD_TYPES, BOARD_TYPE_LABELS, type BoardType } from '@/app/boards/types'
import type { IWorkbookData } from '@univerjs/core'
import { INIT_DELAY } from '@/consts'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { buildDraftPayload, draftKey, formatDraftTime, saveDraft } from '../services/draft-store'

// Univer 体积大且依赖 Intl.Segmenter，只在用到时才加载
const SheetEditor = dynamic(() => import('@/components/sheet-editor').then(m => m.SheetEditor), {
	ssr: false,
	loading: () => <div className='text-secondary grid h-full place-items-center text-sm'>加载表格引擎…</div>
})

/** 给新看板用的最小 HTML 骨架 —— 让不熟语法的人也能直接开始改 */
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>看板标题</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-800 p-8">
  <h1 class="text-2xl font-bold mb-6">看板标题</h1>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <div class="text-slate-500 text-sm">指标名称</div>
      <div class="text-3xl font-semibold mt-2">1,234</div>
    </div>
    <!-- 复制上面的卡片继续加 -->
  </div>
</body>
</html>
`

const MARKDOWN_TEMPLATE = `# 标题

正文段落。

## 小标题

- 列表项
- 列表项

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |
`

/** 各类型在编辑器里的空状态提示 */
const EMPTY_HINT: Record<BoardType, string> = {
	html: '在这里粘贴 AI 生成的看板 HTML，或点下方「插入模板」从零开始',
	markdown: '在这里写 Markdown，支持表格、公式、代码块、流程图',
	sheet: '可以直接在下面编辑；也可以用「导入 Excel」把现成的 .xlsx 载进来',
	image: '图片看板的内容就是右侧「图片管理」里的图片，按顺序展示'
}

/** 由标题生成 slug：拉丁字符直接用，中文转拼音（按需加载 pinyin-pro） */
async function suggestSlug(title: string): Promise<string> {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9一-龥\s-]/g, '')
		.trim()
	if (!base) return ''
	try {
		const mod: any = await import('pinyin-pro')
		const pinyin = mod?.pinyin ?? mod?.default?.pinyin
		if (pinyin) {
			const py: string[] = pinyin(base, { toneType: 'none', type: 'array', nonZh: 'consecutive' } as const)
			return (
				py
					.join('-')
					.toLowerCase()
					.replace(/[^a-z0-9-]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-|-$/g, '')
					.slice(0, 60) || ''
			)
		}
	} catch {
		// 库加载失败退回拉丁字符
	}
	return base.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
}

/** 跟随站点的 data-theme 属性，让编辑器和页面明暗一致 */
function useIsDark() {
	const [isDark, setIsDark] = useState(false)
	useEffect(() => {
		const read = () => setIsDark(document.documentElement.dataset.theme === 'dark')
		read()
		const observer = new MutationObserver(read)
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
		return () => observer.disconnect()
	}, [])
	return isDark
}

/** 让编辑区自己滚动、不撑开外层容器的样式 */
const editorTheme = EditorView.theme({
	'&': { height: '100%', fontSize: '13px' },
	'.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
	'&.cm-focused': { outline: 'none' }
})

export function WriteEditor() {
	const { form, updateForm, addFiles, images } = useWriteStore()
	const { mode } = useWriteStore()
	const livePreview = usePreviewStore(state => state.livePreview)
	const toggleLivePreview = usePreviewStore(state => state.toggleLivePreview)
	const [savedAt, setSavedAt] = useState<number | null>(null)
	const isDark = useIsDark()

	const isText = form.type === 'html' || form.type === 'markdown'

	const extensions = useMemo(() => {
		return form.type === 'markdown' ? [markdownLang(), editorTheme] : [htmlLang(), editorTheme]
	}, [form.type])

	// 自动保存到本地草稿：表单/封面/图片任一变化后 800ms 落盘
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null
		const unsub = useWriteStore.subscribe((state, prev) => {
			if (state.form === prev.form && state.cover === prev.cover && state.images === prev.images) return
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => {
				const { form, cover, images, mode, originalSlug } = useWriteStore.getState()
				saveDraft(draftKey(mode, originalSlug), buildDraftPayload(form, cover, images))
				setSavedAt(Date.now())
			}, 800)
		})

		// 关闭/切换页签前立即补存，避免最后几秒输入丢失
		const flush = () => {
			if (timer) clearTimeout(timer)
			const { form, cover, images, mode, originalSlug } = useWriteStore.getState()
			saveDraft(draftKey(mode, originalSlug), buildDraftPayload(form, cover, images))
		}
		window.addEventListener('pagehide', flush)
		return () => {
			unsub()
			window.removeEventListener('pagehide', flush)
			if (timer) clearTimeout(timer)
		}
	}, [])

	/** 粘贴图片时自动上传并按当前类型插入合适的引用语法 */
	const handlePaste = async (e: React.ClipboardEvent) => {
		if (!isText) return
		const items = e.clipboardData?.items
		if (!items) return

		const imageFiles: File[] = []
		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile()
				if (file) imageFiles.push(file)
			}
		}
		if (imageFiles.length === 0) return

		e.preventDefault()
		const resultImages = await addFiles(imageFiles).catch(() => [])
		if (!resultImages || resultImages.length === 0) return

		const isMd = form.type === 'markdown'
		const tags = resultImages
			.map(item => {
				const src = item.type === 'url' ? item.url : `local-image:${item.id}`
				return isMd ? `![](${src})` : `<img src="${src}" alt="" />`
			})
			.join('\n')

		const current = useWriteStore.getState().form
		updateForm({ content: `${current.content}\n${tags}` })
	}

	const insertTemplate = () => {
		const current = useWriteStore.getState().form
		const tpl = current.type === 'markdown' ? MARKDOWN_TEMPLATE : HTML_TEMPLATE
		updateForm({ content: current.content.trim() ? `${current.content}\n\n${tpl}` : tpl })
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: INIT_DELAY }}
			className='bg-card flex min-h-[60vh] w-full flex-col rounded-[40px] border p-4 shadow sm:p-6 lg:min-h-[800px] lg:w-[800px]'>
			{/* 标题 + slug */}
			<div className='mb-3 flex gap-3'>
				<input
					type='text'
					placeholder='标题'
					className='bg-card flex-1 rounded-lg border px-3 py-2 text-sm'
					value={form.title}
					onChange={e => {
						const title = e.target.value
						// 新建模式下标题为空 slug 时自动生成（拼音）
						if (mode === 'create' && !form.slug && title.trim()) {
							updateForm({ title })
							suggestSlug(title).then(slug => {
								if (slug && !useWriteStore.getState().form.slug) {
									updateForm({ slug })
								}
							})
						} else {
							updateForm({ title })
						}
					}}
				/>
				<input
					type='text'
					placeholder='slug（xx-xx）'
					className='bg-card w-[200px] rounded-lg border px-3 py-2 text-sm'
					value={form.slug}
					onChange={e => updateForm({ slug: e.target.value })}
				/>
			</div>

			{/* 内容类型选择 */}
			<div className='mb-3 flex flex-wrap items-center gap-2'>
				{BOARD_TYPES.map(t => (
					<button
						key={t}
						type='button'
						onClick={() => updateForm({ type: t })}
						className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
							form.type === t ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'
						}`}>
						{BOARD_TYPE_LABELS[t]}
					</button>
				))}

				<button
					type='button'
					onClick={toggleLivePreview}
					className={`ml-auto hidden shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors 2xl:block ${
						livePreview ? 'brand-btn' : 'bg-card hover:bg-bg'
					}`}
					title='宽屏分屏实时预览'>
					预览
				</button>
			</div>

			{/* 内容区：按类型切换编辑器 */}
			<div className='bg-card min-h-0 flex-1 overflow-hidden rounded-xl border'>
				{isText ? (
					<CodeMirror
						value={form.content}
						height='100%'
						className='h-[55vh] lg:h-[600px]'
						theme={isDark ? 'dark' : 'light'}
						extensions={extensions}
						onChange={value => updateForm({ content: value })}
						onPaste={handlePaste}
						placeholder={EMPTY_HINT[form.type]}
						basicSetup={{
							lineNumbers: true,
							foldGutter: true,
							highlightActiveLine: true,
							autocompletion: true,
							bracketMatching: true
						}}
					/>
				) : form.type === 'sheet' ? (
					<div className='h-[55vh] lg:h-[600px]'>
						<SheetEditor
							initialSnapshot={form.snapshot}
							onChange={(snapshot: IWorkbookData) => updateForm({ snapshot })}
						/>
					</div>
				) : (
					<div className='text-secondary grid h-[55vh] place-items-center px-8 text-center text-sm lg:h-[600px]'>
						<div>
							<p>{EMPTY_HINT.image}</p>
							<p className='mt-2 text-xs opacity-70'>当前 {images.length} 张</p>
						</div>
					</div>
				)}
			</div>

			<div className='text-secondary mt-2 flex items-center justify-between px-1 text-xs opacity-70'>
				<span>{savedAt ? `已自动保存本地草稿 ${formatDraftTime(savedAt)}` : '内容修改后会自动保存本地草稿'}</span>
				{isText && (
					<button type='button' onClick={insertTemplate} className='shrink-0 rounded-md border px-2 py-1 transition-colors hover:bg-bg'>
						插入模板
					</button>
				)}
			</div>
		</motion.div>
	)
}
