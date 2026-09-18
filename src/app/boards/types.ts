/** 看板列表索引项 —— 存在 public/boards/index.json */
export type BoardIndexItem = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
}

/** 单个看板的元信息 —— 存在 public/boards/<slug>/config.json */
export type BoardConfig = {
	title?: string
	tags?: string[]
	date?: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
}
