import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: '仓库浏览',
	description: '查看仓库里的文档、表格与页面，可编辑、可收进书架'
}

export default function Page() {
	return <Client />
}
