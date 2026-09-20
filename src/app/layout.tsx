import '@/styles/globals.css'

import type { Metadata } from 'next'
import Layout from '@/layout'
import Head from '@/layout/head'
import siteContent from '@/config/site-content.json'
import { Analytics } from '@vercel/analytics/react'

const {
	meta: { title, description },
	theme
} = siteContent

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kael-odin-blog.vercel.app'),
	title,
	description,
	openGraph: {
		title,
		description
	},
	twitter: {
		title,
		description
	}
}

// 暗色定值调色板：保持品牌青绿不变，翻转中性色（对应 theme.css 的 --dk-*）
const darkPalette = {
	'--dk-primary': '#d8e4e5',
	'--dk-secondary': '#90a1a7',
	'--dk-brand-secondary': '#1fc9e7',
	'--dk-bg': '#0f1719',
	'--dk-border': '#2c3a3e',
	'--dk-brand': '#35bfab',
	'--dk-card': '#ffffff14',
	'--dk-article': '#182426f2'
}

const htmlStyle: React.CSSProperties = {
	cursor: 'url(/images/cursor.svg) 2 1, auto',
	'--lc-brand': theme.colorBrand,
	'--lc-primary': theme.colorPrimary,
	'--lc-secondary': theme.colorSecondary,
	'--lc-brand-secondary': theme.colorBrandSecondary,
	'--lc-bg': theme.colorBg,
	'--lc-border': theme.colorBorder,
	'--lc-card': theme.colorCard,
	'--lc-article': theme.colorArticle,
	...darkPalette
} as React.CSSProperties

// 首帧前恢复上次选择的主题，避免暗色用户看到浅色闪烁
const themeInitScript = `
try {
	if (localStorage.getItem('kael-blog-theme') === 'dark') {
		document.documentElement.dataset.theme = 'dark';
	}
} catch (e) {}

if (/windows|win32/i.test(navigator.userAgent)) {
	document.documentElement.classList.add('windows');
}
`

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='zh-CN' suppressHydrationWarning style={htmlStyle}>
			<Head />

			<body>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />

				<Layout>{children}</Layout>


				{/* Vercel Web Analytics：本地开发自动跳过，仅线上采集（Vercel 控制台可看流量） */}
				<Analytics debug={false} />
			</body>
		</html>
	)
}
