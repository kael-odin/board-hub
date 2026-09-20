import { NextConfig } from 'next'

/**
 * 部署子路径。Vercel 根路径部署时留空即可（站点已从 GitHub Pages 静态托管
 * 迁移到 Vercel：内容需要服务端鉴权出库，静态导出已移除）。
 * 和 src/lib/asset-path.ts 里的 BASE_PATH 必须用同一个值。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
	// 站点内容（content/boards/**）是敏感数据，必须经 /api/boards/* 鉴权后出库，
	// 因此这是一个带 API 路由的 Next.js 服务端应用，部署到 Vercel。
	basePath: BASE_PATH || undefined,

	devIndicators: false,
	reactStrictMode: false,
	reactCompiler: true,
	pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
	images: {
		unoptimized: true,
		// AVIF 压缩率更优，不支持时自动回退 WebP
		formats: ['image/avif', 'image/webp'],
		// 站点允许用户配置外链图片（封面/头图等），放宽远程来源
		remotePatterns: [{ protocol: 'https', hostname: '**' }],
		// 可能引用 SVG 插图；attachment 头防止内联执行
		dangerouslyAllowSVG: true,
		contentDispositionType: 'attachment'
	},
	experimental: {
		scrollRestoration: false
	},
	// 把内容目录打进 serverless 函数包，运行时才能用 fs 读到
	outputFileTracingIncludes: {
		'/api/boards': ['./content/**'],
		'/api/boards/[slug]': ['./content/**'],
		'/api/boards/[slug]/asset/[name]': ['./content/**']
	},
	turbopack: {
		rules: {
			'*.svg': {
				loaders: ['@svgr/webpack'],
				as: '*.js'
			}
		},

		resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', 'css']
	},
	webpack: config => {
		config.module.rules.push({
			test: /\.svg$/i,
			use: [{ loader: '@svgr/webpack', options: { svgo: false } }]
		})

		return config
	}
}

export default nextConfig
