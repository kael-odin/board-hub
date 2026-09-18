import { NextConfig } from 'next'

/**
 * 部署子路径。GitHub Pages 部署在 /board-hub/ 下，Vercel 或自定义域名留空。
 * 和 src/lib/asset-path.ts 里的 BASE_PATH 必须用同一个值。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
	// 整站完全静态：内容都在 public/ 下，写路径靠浏览器直连 GitHub API，
	// 没有任何需要服务端渲染的东西。静态导出让它可以部署到任意静态托管。
	output: 'export',

	// 子路径部署时前缀所有 /_next/* 资源（public/ 下的文件由 asset-path.ts 处理）
	basePath: BASE_PATH || undefined,

	devIndicators: false,
	reactStrictMode: false,
	reactCompiler: true,
	pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
	images: {
		// 静态导出没有服务端，next/image 的按需优化不可用
		unoptimized: true,
		// AVIF 压缩率更优，不支持时自动回退 WebP
		formats: ['image/avif', 'image/webp'],
		// 站点允许用户配置外链图片（封面/头图等），放宽远程来源
		remotePatterns: [{ protocol: 'https', hostname: '**' }],
		// 文章可能引用 SVG 插图；attachment 头防止内联执行
		dangerouslyAllowSVG: true,
		contentDispositionType: 'attachment'
	},
	experimental: {
		scrollRestoration: false
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

	// 原模板遗留的 /zh /en 重定向已移除：
	// 一是对 board-hub 没有意义，二是 redirects() 与 output:'export' 不兼容
}

export default nextConfig
