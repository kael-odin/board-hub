'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { withBase, rewriteAssets } from '@/lib/asset-path'
import { BoardFrame } from '@/components/board-frame'
import { BoardMarkdown } from '@/components/board-markdown'
import { BoardGallery } from '@/components/board-gallery'
import type { BoardType } from '@/app/boards/types'

// Univer 体积大且依赖 Intl.Segmenter，只有表格类型才加载，且不走 SSR
const SheetEditor = dynamic(() => import('@/components/sheet-editor').then(m => m.SheetEditor), {
	ssr: false,
	loading: () => <div className='text-secondary grid h-full place-items-center text-sm'>加载表格引擎…</div>
})

type BoardBodyProps = {
	type: BoardType
	/** html / markdown 的正文 */
	content: string
	/** sheet 的快照 */
	snapshot?: unknown | null
	/** image 的图片列表 */
	images?: string[]
	title: string
	/** 查看页为 true；编辑页预览时表格也需要可交互，传 false */
	readOnly?: boolean
}

/**
 * 按内容类型渲染看板正文。
 * 查看页、全屏预览、分屏预览都用它，保证三处呈现完全一致。
 */
export function BoardBody({ type, content, snapshot, images = [], title, readOnly = true }: BoardBodyProps) {
	// 正文里的 /boards/xxx 是发布时写死的站内绝对路径，
	// 部署到子路径下（如 GitHub Pages）时必须重写，否则全部 404
	const safeContent = useMemo(() => rewriteAssets(content), [content])
	const safeImages = useMemo(() => images.map(withBase), [images])

	switch (type) {
		case 'markdown':
			return <BoardMarkdown markdown={safeContent} />
		case 'image':
			return <BoardGallery images={safeImages} title={title} />
		case 'sheet':
			return <SheetEditor initialSnapshot={snapshot} readOnly={readOnly} />
		case 'html':
		default:
			return <BoardFrame html={safeContent} title={title} className='h-full w-full border-0' />
	}
}
