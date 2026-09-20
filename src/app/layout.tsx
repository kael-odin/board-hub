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
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://board-hub-nine.vercel.app'),
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
	'--dk-primary': '#e5e7eb',
	'--dk-secondary': '#9ca3af',
	'--dk-brand-secondary': '#38bdf8',
	'--dk-bg': '#111418',
	'--dk-border': '#262b33',
	'--dk-brand': '#3b82f6',
	'--dk-card': '#1a1f26',
	'--dk-article': '#1a1f26'
}

const htmlStyle: React.CSSProperties = {
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
