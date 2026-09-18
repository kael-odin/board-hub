'use client'

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { createUniver, LocaleType, merge } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core'
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN'
import '@univerjs/presets/lib/styles/preset-sheets-core.css'
import { createEmptySnapshot } from '@/lib/sheet/empty-snapshot'
import { snapshotToXlsx } from '@/lib/sheet/snapshot-to-xlsx'
import { xlsxToSnapshot } from '@/lib/sheet/xlsx-to-snapshot'
import type { IWorkbookData } from '@univerjs/core'

export type SheetEditorApi = {
	/** 取出当前工作簿快照，用于提交到仓库 */
	getSnapshot: () => IWorkbookData | null
	/** 导出 .xlsx 并触发浏览器下载 */
	exportXlsx: (filename?: string) => void
	/** 用一个 .xlsx 文件替换当前内容（会清空未保存的改动） */
	importXlsx: (file: File) => Promise<void>
}

type SheetEditorProps = {
	initialSnapshot?: unknown | null
	/** 只读模式：隐藏导入导出按钮，工作簿也切到 viewer 权限 */
	readOnly?: boolean
	/** 编辑后回调（已防抖），把最新快照交给外面的表单，进而来得及被草稿和发布捕获 */
	onChange?: (snapshot: IWorkbookData) => void
	apiRef?: Ref<SheetEditorApi>
}

/**
 * 电子表格看板。基于 Univer 开源核心，零后端。
 *
 * ⚠️ 保真度：只处理「值 + 公式 + 多 sheet」。样式、条件格式、图表、透视表
 * 不在转换范围内（官方完整转换需 Univer Pro 服务端模块，见 README）。
 */
export function SheetEditor({ initialSnapshot, readOnly = false, onChange, apiRef }: SheetEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	// 用 ref 保存最新的 onChange，避免因为它的引用变化而重建整个 Univer 实例
	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange
	const workbookRef = useRef<any>(null)
	const univerRef = useRef<any>(null)
	const univerAPIRef = useRef<any>(null)
	const importInputRef = useRef<HTMLInputElement>(null)
	const [ready, setReady] = useState(false)
	const [busy, setBusy] = useState(false)

	// 挂载时初始化 Univer；卸载时必须 dispose，否则会泄漏 canvas 与事件监听
	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const { univer, univerAPI } = createUniver({
			locale: LocaleType.ZH_CN,
			locales: { [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN as any) },
			presets: [
				UniverSheetsCorePreset({
					container: el
				})
			]
		})

		const snapshot = (initialSnapshot as IWorkbookData) || createEmptySnapshot()
		const workbook = univerAPI.createWorkbook(snapshot as any)
		workbookRef.current = workbook
		univerRef.current = univer
		univerAPIRef.current = univerAPI

		if (readOnly) {
			// 只读：切到 viewer 权限，工具栏仍可见但不接受编辑
			Promise.resolve(workbook?.getWorkbookPermission?.()?.setReadOnly?.()).catch(() => {})
		}

		setReady(true)

		// 订阅编辑事件，防抖后把最新快照交给外层（用于草稿与发布）
		let notifyTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleNotify = () => {
			if (readOnly || !onChangeRef.current) return
			if (notifyTimer) clearTimeout(notifyTimer)
			notifyTimer = setTimeout(() => {
				const wb = workbookRef.current
				if (!wb || !onChangeRef.current) return
				try {
					// 不同小版本上取值方法名有差异，两个都试
					const snap = typeof wb.save === 'function' ? wb.save() : typeof wb.getSnapshot === 'function' ? wb.getSnapshot() : null
					if (snap) onChangeRef.current(snap)
				} catch {
					// 忽略：下一次编辑会再触发
				}
			}, 800)
		}

		const commandDisposable = univerAPI?.onCommandExecuted?.(() => scheduleNotify())

		return () => {
			if (notifyTimer) clearTimeout(notifyTimer)
			try {
				commandDisposable?.dispose?.()
			} catch {
				// 忽略
			}
			workbookRef.current = null
			univerRef.current = null
			univerAPIRef.current = null
			// 官方要求：路由卸载时用 univer.dispose()，而不是 disposeUnit
			univer?.dispose?.()
		}
		// initialSnapshot 只在挂载时用一次；后续通过 importXlsx 替换
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const getSnapshot = (): IWorkbookData | null => {
		const wb = workbookRef.current
		if (!wb) return null
		try {
			// 不同小版本上取值方法名有差异，两个都试
			if (typeof wb.save === 'function') return wb.save()
			if (typeof wb.getSnapshot === 'function') return wb.getSnapshot()
		} catch {
			// 忽略，返回 null 由调用方兜底
		}
		return null
	}

	const exportXlsx = (filename?: string) => {
		const snapshot = getSnapshot()
		if (!snapshot) return
		try {
			const buf = snapshotToXlsx(snapshot)
			const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${filename || snapshot.name || 'sheet'}.xlsx`
			a.click()
			URL.revokeObjectURL(url)
		} catch (e) {
			console.error('导出 xlsx 失败:', e)
		}
	}

	const importXlsx = async (file: File) => {
		setBusy(true)
		try {
			const buf = await file.arrayBuffer()
			const { snapshot } = xlsxToSnapshot(buf, file.name.replace(/\.(xlsx|xls|csv)$/i, ''))
			const api = univerAPIRef.current
			const old = workbookRef.current
			// Univer 没有「整体替换内容」的 API，先销毁旧工作簿再建新的最稳
			if (api && old?.getUnitId) {
				try {
					api.disposeUnit(old.getUnitId())
				} catch {
					// 旧实例可能已被销毁，忽略
				}
			}
			if (api) {
				workbookRef.current = api.createWorkbook(snapshot as any)
			}
		} catch (e) {
			console.error('导入 xlsx 失败:', e)
		} finally {
			setBusy(false)
		}
	}

	useImperativeHandle(apiRef, () => ({ getSnapshot, exportXlsx, importXlsx }), [])

	return (
		<div className='relative flex h-full min-h-0 flex-col'>
			{!readOnly && (
				<div className='flex shrink-0 items-center gap-2 border-b bg-white/60 px-3 py-2 text-xs backdrop-blur-sm dark:bg-white/5'>
					<button type='button' onClick={() => importInputRef.current?.click()} disabled={busy} className='rounded-md border px-2.5 py-1 transition-colors hover:bg-bg disabled:opacity-50'>
						{busy ? '导入中…' : '导入 Excel'}
					</button>
					<button type='button' onClick={() => exportXlsx()} className='rounded-md border px-2.5 py-1 transition-colors hover:bg-bg'>
						导出 Excel
					</button>
					<span className='text-secondary ml-auto opacity-70'>改完记得点上方的「发布」才会存进仓库</span>
				</div>
			)}

			<input
				ref={importInputRef}
				type='file'
				accept='.xlsx,.xls,.csv'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (e.currentTarget) e.currentTarget.value = ''
					if (f) await importXlsx(f)
				}}
			/>

			<div className='relative min-h-0 flex-1'>
				<div ref={containerRef} className='absolute inset-0' />
				{!ready && <div className='text-secondary absolute inset-0 grid place-items-center text-sm'>加载表格引擎…</div>}
			</div>
		</div>
	)
}
