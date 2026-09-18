import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: 'SVG 图标库',
	description: '站点内置图标资源'
}

export default function Page() {
	return <Client />
}
