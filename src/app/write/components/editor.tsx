import { motion } from 'motion/react'
import { useWriteStore } from '../stores/write-store'
import { usePreviewStore } from '../stores/preview-store'
import { INIT_DELAY } from '@/consts'
import { useEffect, useState } from 'react'
import { buildDraftPayload, draftKey, formatDraftTime, saveDraft } from '../services/draft-store'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { EditorView } from '@codemirror/view'

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
	const { form, updateForm, addFiles } = useWriteStore()
	const { mode } = useWriteStore()
	const livePreview = usePreviewStore(state => state.livePreview)
	const toggleLivePreview = usePreviewStore(state => state.toggleLivePreview)
	const [savedAt, setSavedAt] = useState<number | null>(null)
	const isDark = useIsDark()

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

	/**
	 * 粘贴图片时自动上传，并插入 <img src="local-image:ID"> 占位符。
	 * 占位符在预览和发布时会分别被替换成 blob URL 和真实仓库路径。
	 */
	const handlePaste = async (e: React.ClipboardEvent) => {
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

		const tags = resultImages.map(item => (item.type === 'url' ? `<img src="${item.url}" alt="" />` : `<img src="local-image:${item.id}" alt="" />`)).join('\n')
		const { form: current } = useWriteStore.getState()
		updateForm({ html: `${current.html}\n${tags}` })
	}

	const insertTemplate = () => {
		const { form: current } = useWriteStore.getState()
		const next = current.html.trim() ? `${current.html}\n\n${HTML_TEMPLATE}` : HTML_TEMPLATE
		updateForm({ html: next })
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: INIT_DELAY }}
			className='bg-card flex min-h-[60vh] w-full flex-col rounded-[40px] border p-4 shadow sm:p-6 lg:min-h-[800px] lg:w-[800px]'>
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
				<button
					type='button'
					onClick={toggleLivePreview}
					className={`hidden shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors 2xl:block ${livePreview ? 'brand-btn' : 'bg-card hover:bg-bg'}`}
					title='宽屏分屏实时预览'>
					预览
				</button>
			</div>

			<div className='bg-card min-h-0 flex-1 overflow-hidden rounded-xl border'>
				<CodeMirror
					value={form.html}
					height='100%'
					className='h-[55vh] lg:h-[650px]'
					theme={isDark ? 'dark' : 'light'}
					extensions={[htmlLang(), editorTheme]}
					onChange={value => updateForm({ html: value })}
					onPaste={handlePaste}
					placeholder='在这里粘贴 AI 生成的看板 HTML，或点下方「插入基础模板」从零开始'
					basicSetup={{
						lineNumbers: true,
						foldGutter: true,
						highlightActiveLine: true,
						autocompletion: true,
						bracketMatching: true
					}}
				/>
			</div>

			<div className='text-secondary mt-2 flex items-center justify-between px-1 text-xs opacity-70'>
				<span>{savedAt ? `已自动保存本地草稿 ${formatDraftTime(savedAt)}` : '内容修改后会自动保存本地草稿'}</span>
				<button type='button' onClick={insertTemplate} className='shrink-0 rounded-md border px-2 py-1 transition-colors hover:bg-bg'>
					插入基础模板
				</button>
			</div>
		</motion.div>
	)
}
