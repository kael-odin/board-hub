'use client'

import { useMarkdownRender } from '@/hooks/use-markdown-render'

/**
 * Markdown 类型的看板。
 * 直接复用站点原有的 markdown 渲染链（marked + shiki + katex + mermaid + DOMPurify），
 * 正文样式由 src/styles/article.css 的 .prose 提供。
 */
export function BoardMarkdown({ markdown }: { markdown: string }) {
	const { content, loading } = useMarkdownRender(markdown)

	if (loading) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>渲染中…</div>
	}

	return (
		<div className='h-full overflow-auto'>
			<div className='mx-auto w-full max-w-3xl px-6 py-10'>
				<div className='prose'>{content}</div>
			</div>
		</div>
	)
}
