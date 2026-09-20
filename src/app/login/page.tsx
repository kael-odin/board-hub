import { Suspense } from 'react'
import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
	title: '登录',
	description: '私有看板书架，登录后访问'
}

export default function Page() {
	return (
		<Suspense fallback={<div className='text-secondary grid min-h-[80vh] place-items-center text-sm'>加载中…</div>}>
			<Client />
		</Suspense>
	)
}
