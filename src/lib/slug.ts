/** 由标题生成 slug：拉丁字符直接用，中文转拼音（按需加载 pinyin-pro） */
export async function suggestSlug(title: string): Promise<string> {
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
