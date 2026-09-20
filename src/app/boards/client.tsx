'use client'

import { BoardWall } from '@/components/board-wall'
import { useConfigStore } from '@/app/(home)/stores/config-store'

export default function Client() {
	const shelf = useConfigStore(state => state.siteContent.shelf)
	return (
		<div className='mx-auto w-full px-6 pt-24 pb-16' style={{ maxWidth: shelf?.contentWidth || 1280 }}>
			<BoardWall />
		</div>
	)
}
