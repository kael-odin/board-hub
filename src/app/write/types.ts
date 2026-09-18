export type PublishForm = {
	slug: string
	title: string
	/** 看板本体：一段完整的 HTML 文档（由 AI 从表格生成，或在网页内直接编辑） */
	html: string
	tags: string[]
	date: string
	summary: string
	hidden?: boolean
	category?: string
}

export type ImageItem = { id: string; type: 'url'; url: string } | { id: string; type: 'file'; file: File; previewUrl: string; filename: string; hash?: string; dataUrl?: string }
