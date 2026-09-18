import { MetadataRoute } from 'next'
import boardIndex from '@/../public/boards/index.json'
import type { BoardIndexItem } from '@/app/boards/types'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// 域名配置：
	// 1. 优先使用 SITE_URL (你在 Vercel 手动设置的正式域名)
	// 2. 其次尝试 VERCEL_URL (Vercel 自动生成的预览域名，通常不带 https://)
	// 3. 最后回退到本地开发地址
	const baseUrl = process.env.SITE_URL ? process.env.SITE_URL : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

	// hidden 的看板不进 sitemap，避免被搜索引擎收录
	const boards: BoardIndexItem[] = (boardIndex as BoardIndexItem[]).filter(item => item?.slug && !item.hidden)

	const boardEntries: MetadataRoute.Sitemap = boards.map(item => ({
		url: `${baseUrl}/boards/${item.slug}`,
		lastModified: item.date ? new Date(item.date) : new Date(),
		changeFrequency: 'weekly',
		priority: 0.8
	}))

	const staticEntries: MetadataRoute.Sitemap = [
		{ url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
		{ url: `${baseUrl}/boards`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
		{ url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
		{ url: `${baseUrl}/clock`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
		{ url: `${baseUrl}/live2d`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 }
	]

	return [...staticEntries, ...boardEntries]
}
