'use client'

type BoardFrameProps = {
	/** 看板的完整 HTML 源码 */
	html: string
	title?: string
	className?: string
	/** 是否等看板加载完再显示（列表页缩略图用） */
	lazy?: boolean
}

/**
 * 看板渲染容器 —— 用 iframe 做样式与脚本隔离。
 *
 * 为什么必须用 iframe：
 * AI 生成的看板 HTML 通常自带 Tailwind CDN 和内联样式，如果内联渲染进页面，
 * 它的类名和站点的 Tailwind 类名、`--color-*` CSS 变量会互相污染。
 * 放进 iframe 后两个文档的样式树完全独立。
 *
 * 安全说明：
 * - `sandbox="allow-scripts"` 让看板里的图表库能跑，但**故意不给 `allow-same-origin`**，
 *   于是 iframe 拿到的是 opaque origin —— 看板脚本无法读取站点的 cookie、localStorage，
 *   也无法通过 `parent` 操作宿主页面。
 * - 相对路径（如 /boards/xxx/img.webp）仍然可用：srcdoc 文档会继承父页面的 base URL。
 */
export function BoardFrame({ html, title, className, lazy }: BoardFrameProps) {
	return (
		<iframe
			title={title || '看板'}
			srcDoc={html}
			sandbox='allow-scripts'
			loading={lazy ? 'lazy' : undefined}
			className={className}
		/>
	)
}
