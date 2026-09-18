'use client'

import dynamic from 'next/dynamic'
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
	switch (type) {
		case 'markdown':
			return <BoardMarkdown markdown={content} />
		case 'image':
			return <BoardGallery images={images} title={title} />
		case 'sheet':
			return <SheetEditor initialSnapshot={snapshot} readOnly={readOnly} />
		case 'html':
		default:
			return <BoardFrame html={content} title={title} className='h-full w-full border-0' />
	}
}
