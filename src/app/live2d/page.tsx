import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: 'Live2D',
	description: 'Live2D 看板'
}

export default function Page() {
	return <Client />
}
