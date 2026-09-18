import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: '看板',
	description: 'AI 整理的报表与看板'
}

export default function Page() {
	return <Client />
}
