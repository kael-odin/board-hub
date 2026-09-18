import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: '关于本站',
	description: '站点与作者介绍'
}

export default function Page() {
	return <Client />
}
