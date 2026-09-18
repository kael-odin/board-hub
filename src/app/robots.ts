import type { MetadataRoute } from 'next'

// 静态导出要求所有路由显式声明为静态
export const dynamic = 'force-static'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kael-odin.github.io/board-hub'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [{ userAgent: '*', allow: '/', disallow: ['/write', '/write/*', '/api/*'] }],
		sitemap: `${SITE}/sitemap.xml`
	}
}
