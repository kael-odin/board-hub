import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: '时钟',
	description: '秒表与计时器'
}

export default function Page() {
	return <Client />
}
