import type { MetadataRoute } from 'next'

// 私有站点：内容不出现在 sitemap 里，robots.txt 也全量禁止收录
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
	return []
}
