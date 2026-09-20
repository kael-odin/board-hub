import type { MetadataRoute } from 'next'

// 这是私有站点：对搜索引擎全量关闭，也不提供 sitemap
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [{ userAgent: '*', disallow: '/' }]
	}
}
