'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { toast } from 'sonner'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { useAuthStore } from '@/hooks/use-auth'
import { GITHUB_CONFIG } from '@/consts'
import { suggestSlug } from '@/lib/slug'
import { fromBase64Utf8, fromBase64Bytes } from '@/lib/file-utils'
import { BoardFrame } from '@/components/board-frame'
import { BoardMarkdown } from '@/components/board-markdown'
import { pushBoard } from '@/app/write/services/push-board'
import { xlsxToSnapshot } from '@/lib/sheet/xlsx-to-snapshot'
import type { BoardType } from '@/app/boards/types'

// Univer 只在预览表格时加载
const SheetEditor = dynamic(() => import('@/components/sheet-editor').then(m => m.SheetEditor), {
	ssr: false,
	loading: () => <div className='text-secondary grid h-full place-items-center text-sm'>加载表格引擎…</div>
})

type FileKind = 'markdown' | 'html' | 'sheet' | 'image' | 'json' | 'text' | 'other'

type Preview =
	| { kind: 'markdown'; text: string }
	| { kind: 'html'; text: string }
	| { kind: 'sheet'; bytes: Uint8Array; name: string }
	| { kind: 'image'; url: string }
	| { kind: 'text'; text: string }
	| { kind: 'other' }

type TreeEntry = { path: string; size?: number }

const EXT_KIND: Array<[RegExp, FileKind]> = [
	[/\.(md|markdown|mdx)$/i, 'markdown'],
	[/\.(html?|htm)$/i, 'html'],
	[/\.(xlsx|xls|csv)$/i, 'sheet'],
	[/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i, 'image'],
	[/\.json$/i, 'json'],
	[/\.(txt|log|ya?ml|toml|css|js|ts|tsx|jsx)$/i, 'text']
]

/** 目录前缀不进列表：构建产物、依赖、配置目录 */
const EXCLUDED_PREFIXES = ['.github/', '.next/', '.vscode/', 'node_modules/', 'out/']

/** 书架区（content/boards/）由看板页管理，这里不重复展示 */
const SHELF_PREFIX = 'content/boards/'

function classify(path: string): FileKind {
	for (const [re, kind] of EXT_KIND) if (re.test(path)) return kind
	return 'other'
}

const KIND_LABELS: Record<FileKind, string> = {
	markdown: '文档',
	html: '网页',
	sheet: '表格',
	image: '图片',
	json: 'JSON',
	text: '文本',
	other: '其他'
}

function kindOfIcon(kind: FileKind): string {
	switch (kind) {
		case 'markdown':
			return '📝'
		case 'html':
			return '🌐'
		case 'sheet':
			return '📊'
		case 'image':
			return '🖼️'
		case 'json':
		case 'text':
			return '📄'
		default:
			return '📦'
	}
}

const IMAGE_MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	avif: 'image/avif'
}

function ext(path: string): string {
	const m = path.match(/\.([a-z0-9]+)$/i)
	return m ? m[1].toLowerCase() : ''
}

function formatSize(bytes?: number): string {
	if (bytes == null) return ''
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
	return `${bytes} B`
}

/** 文本类预览的大小护栏：超过后只提供下载，避免渲染几十 MB 文本卡死页面 */
const MAX_TEXT_PREVIEW = 2 * 1024 * 1024
const MAX_SHEET_PREVIEW = 20 * 1024 * 1024

const repoEditorTheme = EditorView.theme({
	'&': { height: '100%', fontSize: '13px' },
	'.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
	'&.cm-focused': { outline: 'none' }
})

/** 按文件扩展名挑 CodeMirror 语法高亮 */
function cmExtensions(path: string) {
	if (/\.html?$/i.test(path)) return [htmlLang(), repoEditorTheme]
	if (/\.(md|markdown|mdx)$/i.test(path)) return [markdownLang(), repoEditorTheme]
	return [repoEditorTheme]
}

export default function RepoClient() {
	const { role, hydrated } = useAuthStore()
	const isAdmin = role === 'admin'
	const repoLabel = `${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}`

	const [entries, setEntries] = useState<TreeEntry[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [filter, setFilter] = useState<FileKind | 'all'>('all')
	const [search, setSearch] = useState('')

	const [selected, setSelected] = useState<TreeEntry | null>(null)
	const [preview, setPreview] = useState<Preview | null>(null)
	const [previewLoading, setPreviewLoading] = useState(false)

	const [editing, setEditing] = useState(false)
	const [editText, setEditText] = useState('')
	const [saving, setSaving] = useState(false)
	const previewUrlRef = useRef<string | null>(null)

	const [adoptOpen, setAdoptOpen] = useState(false)
	const [adoptTitle, setAdoptTitle] = useState('')
	const [adoptSlug, setAdoptSlug] = useState('')
	const [adopting, setAdopting] = useState(false)

	const isDark = useIsDarkTheme()

	const grouped = useMemo(() => {
		const kw = search.trim().toLowerCase()
		const list = (entries || []).filter(item => {
			if (filter !== 'all' && classify(item.path) !== filter) return false
			if (kw && !item.path.toLowerCase().includes(kw)) return false
			return true
		})
		const groups = new Map<string, TreeEntry[]>()
		for (const item of list) {
			const dir = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : '（根目录）'
			if (!groups.has(dir)) groups.set(dir, [])
			groups.get(dir)!.push(item)
		}
		return Array.from(groups.entries())
	}, [entries, filter, search])

	const loadTree = useCallback(async () => {
		setEntries(null)
		setLoadError(null)
		setSelected(null)
		setPreview(null)
		try {
			const res = await fetch('/api/repo/tree', { cache: 'no-store' })
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error || `加载失败（${res.status}）`)
			const visible = (data as Array<{ path: string; size?: number }>)
				.filter(item => !item.path.includes('/.') && !item.path.startsWith('.') && !EXCLUDED_PREFIXES.some(p => item.path.startsWith(p)) && !item.path.startsWith(SHELF_PREFIX))
				.sort((a, b) => a.path.localeCompare(b.path))
			setEntries(visible)
		} catch (err: any) {
			setLoadError(err?.message || '加载仓库文件失败')
		}
	}, [])

	useEffect(() => {
		if (!isAdmin) return
		loadTree()
	}, [isAdmin, loadTree])

	/** 读单个文件（返回 base64） */
	const readRepoFile = useCallback(async (path: string): Promise<string> => {
		const res = await fetch(`/api/repo/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
		const data = await res.json().catch(() => ({}))
		if (!res.ok) throw new Error(data.error || `读取失败（${res.status}）`)
		return (data as { base64: string }).base64
	}, [])

	/** 选中文件后按类型加载预览内容 */
	const openFile = useCallback(
		async (entry: TreeEntry) => {
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current)
				previewUrlRef.current = null
			}
			setSelected(entry)
			setPreview(null)
			setEditing(false)
			setAdoptOpen(false)
			const kind = classify(entry.path)
			const tooBig = (entry.size || 0) > (kind === 'sheet' ? MAX_SHEET_PREVIEW : MAX_TEXT_PREVIEW)

			if (kind === 'other' || (kind !== 'image' && tooBig)) {
				setPreview({ kind: 'other' })
				return
			}

			setPreviewLoading(true)
			try {
				const b64 = await readRepoFile(entry.path)
				switch (kind) {
					case 'markdown':
						setPreview({ kind: 'markdown', text: fromBase64Utf8(b64) })
						break
					case 'html':
						setPreview({ kind: 'html', text: fromBase64Utf8(b64) })
						break
					case 'json':
					case 'text':
						setPreview({ kind: 'text', text: fromBase64Utf8(b64) })
						break
					case 'sheet':
						setPreview({ kind: 'sheet', bytes: fromBase64Bytes(b64), name: entry.path })
						break
					case 'image': {
						const mime = IMAGE_MIME[ext(entry.path)] || 'application/octet-stream'
						const url = URL.createObjectURL(new Blob([fromBase64Bytes(b64)], { type: mime }))
						previewUrlRef.current = url
						setPreview({ kind: 'image', url })
						break
					}
					default:
						setPreview({ kind: 'other' })
				}
			} catch (err: any) {
				toast.error(err?.message || '读取文件失败')
				setSelected(null)
			} finally {
				setPreviewLoading(false)
			}
		},
		[readRepoFile]
	)

	useEffect(
		() => () => {
			if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
		},
		[]
	)

	/** 在线编辑保存：直接 commit 回原路径 */
	const saveEdit = async () => {
		if (!selected) return
		setSaving(true)
		try {
			const res = await fetch('/api/repo/file', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: selected.path, text: editText })
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error || `保存失败（${res.status}）`)
			toast.success('已保存并提交到仓库', { description: '静态站点会自动重新部署' })
			setEditing(false)
			// 本地预览同步为新内容；树里的 sha/size 已过期，重拉
			setPreview(p => {
				if (p && (p.kind === 'markdown' || p.kind === 'html' || p.kind === 'text')) return { ...p, text: editText }
				return p
			})
			loadTree()
		} catch (err: any) {
			toast.error(err?.message || '保存失败')
		} finally {
			setSaving(false)
		}
	}

	const startEdit = () => {
		if (!preview || !('text' in preview)) return
		setEditText(preview.text)
		setEditing(true)
	}

	/** 收进书架：把仓库里的文件一键变成一个看板 */
	const openAdopt = () => {
		if (!selected) return
		const baseName = selected.path.split('/').pop() || selected.path
		const title = baseName.replace(/\.[a-z0-9]+$/i, '')
		setAdoptTitle(title)
		setAdoptSlug('')
		suggestSlug(title).then(slug => setAdoptSlug(slug))
		setAdoptOpen(true)
	}

	const confirmAdopt = async () => {
		if (!selected) return
		if (!adoptTitle.trim()) {
			toast.error('标题不能为空')
			return
		}
		if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(adoptSlug)) {
			toast.error('slug 只能包含英文、数字、连字符和下划线，以英文或数字开头')
			return
		}
		setAdopting(true)
		try {
			const kind = classify(selected.path)
			const b64 = await readRepoFile(selected.path)
			const form = {
				slug: adoptSlug,
				title: adoptTitle,
				type: (kind === 'markdown' ? 'markdown' : kind === 'html' ? 'html' : 'sheet') as BoardType,
				content: '',
				snapshot: null as unknown,
				tags: [] as string[],
				date: '',
				summary: '',
				hidden: false,
				category: ''
			}
			let sourceFile: File | null = null
			if (kind === 'markdown' || kind === 'html') {
				form.content = fromBase64Utf8(b64)
			} else {
				const bytes = fromBase64Bytes(b64)
				const name = selected.path.split('/').pop() || 'source.xlsx'
				const { snapshot } = xlsxToSnapshot(bytes.buffer as ArrayBuffer, form.title)
				form.snapshot = snapshot
				sourceFile = new File([bytes], name)
			}
			await pushBoard({ form, sourceFile, mode: 'create' })
			setAdoptOpen(false)
		} catch (err: any) {
			toast.error(err?.message || '收进书架失败')
		} finally {
			setAdopting(false)
		}
	}

	const downloadSelected = async () => {
		if (!selected) return
		try {
			const b64 = await readRepoFile(selected.path)
			const bytes = fromBase64Bytes(b64)
			const url = URL.createObjectURL(new Blob([bytes]))
			const a = document.createElement('a')
			a.href = url
			a.download = selected.path.split('/').pop() || 'file'
			a.click()
			URL.revokeObjectURL(url)
		} catch (err: any) {
			toast.error(err?.message || '下载失败')
		}
	}

	// ---- 会话/权限门 ----
	if (hydrated && !role) {
		return (
			<div className='mx-auto w-full max-w-7xl px-6 pt-28 pb-16'>
				<div className='bg-card mx-auto max-w-md rounded-3xl border p-8 text-center shadow'>
					<h1 className='text-lg font-medium'>仓库浏览</h1>
					<p className='text-secondary mt-2 text-sm'>这是管理员功能，请先登录。</p>
					<Link href='/login?next=/repo' className='brand-btn mx-auto mt-5 inline-block'>
						去登录
					</Link>
				</div>
			</div>
		)
	}
	if (hydrated && role === 'viewer') {
		return (
			<div className='mx-auto w-full max-w-7xl px-6 pt-28 pb-16'>
				<div className='bg-card mx-auto max-w-md rounded-3xl border p-8 text-center shadow'>
					<h1 className='text-lg font-medium'>仓库浏览</h1>
					<p className='text-secondary mt-2 text-sm'>查看者账号没有这个权限，请联系管理员。</p>
					<Link href='/boards' className='text-secondary mx-auto mt-4 block text-xs transition-colors hover:text-brand'>
						返回看板
					</Link>
				</div>
			</div>
		)
	}
	if (!hydrated || !isAdmin) {
		return <div className='text-secondary py-20 text-center text-sm'>验证权限中…</div>
	}

	return (
		<div className='mx-auto w-full max-w-7xl px-4 pt-24 pb-12 sm:px-6'>
			{/* 头部 */}
			<div className='mb-5 flex flex-wrap items-center gap-3'>
				<Link href='/' className='text-secondary text-xs transition-colors hover:text-brand'>
					← 首页
				</Link>
				<h1 className='text-base font-medium'>仓库浏览</h1>
				<span className='text-secondary text-xs opacity-70'>{repoLabel}</span>
				<div className='ml-auto flex items-center gap-2'>
					<button onClick={loadTree} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
						刷新
					</button>
					<button onClick={() => window.open(`https://github.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/tree/${GITHUB_CONFIG.BRANCH}`, '_blank')} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
						在 GitHub 打开
					</button>
				</div>
			</div>

			{loadError && (
				<div className='rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'>{loadError}</div>
			)}

			{!entries && !loadError && <div className='text-secondary py-20 text-center text-sm'>正在加载仓库文件树…</div>}

			{entries && (
				<div className='flex flex-col gap-4 lg:flex-row'>
					{/* 左侧：文件列表 */}
					<div className='bg-card w-full shrink-0 rounded-2xl border p-4 lg:sticky lg:top-20 lg:max-h-[80vh] lg:w-[340px] lg:overflow-hidden'>
						{/* 目录用途图例 */}
						<div className='text-secondary mb-3 space-y-1 rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed opacity-80'>
							<div>
								<code className='text-brand'>content/boards/</code> 书架数据区（本页已隐藏，去「书架」看）
							</div>
							<div>
								<code className='text-brand'>public/</code> 站点静态资源（头像、图标、音乐）
							</div>
							<div>
								<code className='text-brand'>src/config/</code> 站点配置 JSON（外观与首页布局）
							</div>
							<div>其余目录为程序代码，只读浏览即可，改动会触发重新部署</div>
						</div>
						<input
							type='text'
							placeholder='搜索文件路径…'
							value={search}
							onChange={e => setSearch(e.target.value)}
							className='bg-card mb-3 w-full rounded-lg border px-3 py-1.5 text-sm'
						/>
						<div className='mb-3 flex flex-wrap gap-1.5'>
							{(['all', 'markdown', 'sheet', 'html', 'image', 'json'] as const).map(k => (
								<button
									key={k}
									onClick={() => setFilter(k)}
									className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${filter === k ? 'bg-brand text-white' : 'bg-secondary/10 hover:bg-secondary/20'}`}>
									{k === 'all' ? `全部 ${entries.length}` : KIND_LABELS[k]}
								</button>
							))}
						</div>

						<div className='max-h-[55vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[calc(80vh-140px)]'>
							{grouped.length === 0 && <div className='text-secondary py-8 text-center text-xs'>没有匹配的文件</div>}
							{grouped.map(([dir, files]) => (
								<div key={dir}>
									<div className='text-secondary mb-1 truncate text-[11px] opacity-60' title={dir}>
										{dir}
									</div>
									<ul className='space-y-0.5'>
										{files.map(item => {
											const kind = classify(item.path)
											const active = selected?.path === item.path
											return (
												<li key={item.path}>
													<button
														onClick={() => openFile(item)}
														className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${active ? 'bg-brand/10 text-brand' : 'hover:bg-secondary/10'}`}>
														<span className='shrink-0'>{kindOfIcon(kind)}</span>
														<span className='min-w-0 flex-1 truncate'>{item.path.split('/').pop()}</span>
														<span className='text-secondary shrink-0 text-[10px] opacity-60'>{formatSize(item.size)}</span>
													</button>
												</li>
											)
										})}
									</ul>
								</div>
							))}
						</div>
					</div>

					{/* 右侧：预览/编辑区 */}
					<div className='flex min-h-[60vh] min-w-0 flex-1 flex-col'>
						{!selected && (
							<div className='text-secondary bg-card flex flex-1 items-center justify-center rounded-2xl border text-sm'>
								{entries.length === 0 ? '仓库里（书架区之外）没有可展示的文件' : '从左侧选一个文件查看'}
							</div>
						)}

						{selected && (
							<>
								{/* 操作条 */}
								<div className='bg-card mb-3 flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5'>
									<span className='min-w-0 flex-1 truncate font-mono text-xs' title={selected.path}>
										{selected.path}
									</span>
									{previewLoading && <span className='text-secondary text-xs'>加载中…</span>}

									{!editing && preview && 'text' in preview && (
										<button onClick={startEdit} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
											编辑
										</button>
									)}
									{editing && (
										<>
											<button onClick={() => setEditing(false)} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
												取消
											</button>
											<button onClick={saveEdit} disabled={saving} className='brand-btn rounded-lg px-3 py-1.5 text-xs disabled:opacity-50'>
												{saving ? '保存中…' : '保存到仓库'}
											</button>
										</>
									)}

									{!editing && ['markdown', 'html', 'sheet'].includes(classify(selected.path)) && (
										<button onClick={openAdopt} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
											收进书架
										</button>
									)}
									<button onClick={downloadSelected} className='bg-card rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-bg'>
										下载
									</button>
								</div>

								{/* 预览本体 */}
								<div className='bg-card min-h-0 flex-1 overflow-hidden rounded-2xl border'>
									{editing ? (
										<CodeMirror
											value={editText}
											height='100%'
											className='h-[65vh] lg:h-full'
											theme={isDark ? 'dark' : 'light'}
											extensions={cmExtensions(selected.path)}
											onChange={setEditText}
											basicSetup={{ lineNumbers: true, highlightActiveLine: true, bracketMatching: true }}
										/>
									) : previewLoading ? (
										<div className='text-secondary grid h-[65vh] place-items-center text-sm lg:h-full'>读取文件…</div>
									) : (
										<PreviewBody preview={preview} path={selected.path} isDark={isDark} />
									)}
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* 收进书架对话框 */}
			{adoptOpen && (
				<div className='fixed inset-0 z-50 grid place-items-center bg-black/40 px-4' onClick={() => !adopting && setAdoptOpen(false)}>
					<div className='bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl' onClick={e => e.stopPropagation()}>
						<h3 className='text-sm font-medium'>收进书架</h3>
						<p className='text-secondary mt-1 text-xs'>把 {selected?.path.split('/').pop()} 变成一个看板发布到书架上。</p>
						<div className='mt-4 space-y-3'>
							<input
								type='text'
								placeholder='标题'
								value={adoptTitle}
								onChange={e => setAdoptTitle(e.target.value)}
								className='bg-card w-full rounded-lg border px-3 py-2 text-sm'
							/>
							<input
								type='text'
								placeholder='slug（英文短横线）'
								value={adoptSlug}
								onChange={e => setAdoptSlug(e.target.value)}
								className='bg-card w-full rounded-lg border px-3 py-2 text-sm'
							/>
							{classify(selected?.path || '') === 'sheet' && <p className='text-secondary text-[11px] opacity-70'>表格会转成在线可编辑快照，原始文件同时作为附件保存。</p>}
						</div>
						<div className='mt-5 flex justify-end gap-2'>
							<button onClick={() => setAdoptOpen(false)} disabled={adopting} className='bg-card rounded-lg border px-4 py-1.5 text-sm'>
								取消
							</button>
							<button onClick={confirmAdopt} disabled={adopting} className='brand-btn rounded-lg px-4 py-1.5 text-sm disabled:opacity-50'>
								{adopting ? '发布中…' : '发布到书架'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

/** 预览渲染：复用看板的渲染链，保证与书架里的呈现一致 */
function PreviewBody({ preview, path, isDark }: { preview: Preview | null; path: string; isDark: boolean }) {
	if (!preview || preview.kind === 'other') {
		return (
			<div className='text-secondary flex h-[65vh] flex-col items-center justify-center gap-2 text-sm lg:h-full'>
				<span>该类型暂不支持在线预览</span>
				<span className='text-xs opacity-60'>可以用上方「下载」按钮取回文件</span>
			</div>
		)
	}
	if (preview.kind === 'markdown') {
		return (
			<div className='h-[65vh] overflow-auto lg:h-full'>
				<BoardMarkdown markdown={preview.text} />
			</div>
		)
	}
	if (preview.kind === 'html') {
		return (
			<div className='h-[65vh] lg:h-full'>
				<BoardFrame html={preview.text} title={path} className='h-full w-full border-0' />
			</div>
		)
	}
	if (preview.kind === 'sheet') {
		return <SheetPreview bytes={preview.bytes} name={preview.name} />
	}
	if (preview.kind === 'image') {
		return (
			<div className='grid h-[65vh] place-items-center bg-[repeating-conic-gradient(#0002_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4 lg:h-full'>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={preview.url} alt={path} className='max-h-full max-w-full object-contain' />
			</div>
		)
	}
	// text / json：只读代码视图（点上方「编辑」进入可编辑）
	const displayText = useMemo(() => {
		if (!/\.json$/i.test(path)) return preview.text
		try {
			return JSON.stringify(JSON.parse(preview.text), null, 2)
		} catch {
			return preview.text
		}
	}, [preview.text, path])
	return (
		<CodeMirror
			value={displayText}
			height='100%'
			className='h-[65vh] lg:h-full'
			theme={isDark ? 'dark' : 'light'}
			extensions={cmExtensions(path)}
			editable={false}
			basicSetup={{ lineNumbers: true, highlightActiveLine: false }}
		/>
	)
}

/** 表格预览：把文件字节转成 Univer 快照后只读展示 */
function SheetPreview({ bytes, name }: { bytes: Uint8Array; name: string }) {
	const snapshot = useMemo(() => {
		try {
			return xlsxToSnapshot(bytes.buffer as ArrayBuffer, name).snapshot
		} catch {
			return null
		}
	}, [bytes, name])
	if (!snapshot) return <div className='text-secondary grid h-[65vh] place-items-center text-sm lg:h-full'>表格解析失败</div>
	return <SheetEditor initialSnapshot={snapshot} readOnly />
}

/** 跟随站点明暗主题 */
function useIsDarkTheme() {
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
