'use client'

import { withBase } from '@/lib/asset-path'
import { useEffect } from 'react'
import { useConfigStore } from './stores/config-store'
import { BoardWall } from '@/components/board-wall'
import { useAuthStore } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { INIT_DELAY } from '@/consts'
import { motion } from 'motion/react'

/**
 * 首页 = 仪表盘式页头 + 看板卡片墙。
 * 装饰性资源（明暗主题）由根 layout 提供，这里不用重复。
 */
export default function Home() {
	const { setConfigDialogOpen, siteContent } = useConfigStore()
	const shelf = siteContent.shelf
	const isAdmin = useAuthStore(state => state.role === 'admin')
	const router = useRouter()

	// Ctrl/Cmd + L 或 , 打开站点配置
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === ',')) {
				e.preventDefault()
				setConfigDialogOpen(true)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [setConfigDialogOpen])

	return (
		<>
			<div className='mx-auto w-full px-6 pt-20 pb-16' style={{ maxWidth: shelf?.contentWidth || 1280 }}>
				{/* 仪表盘页头 */}
				<motion.header
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: INIT_DELAY }}
					className='mb-6 flex flex-wrap items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={withBase('/images/avatar.png')} alt='avatar' className='h-9 w-9 rounded-md border' />
						<div>
							<h1 className='text-lg leading-tight font-semibold'>{siteContent.meta.title}</h1>
							<p className='text-secondary mt-0.5 text-xs'>{siteContent.meta.description}</p>
						</div>
					</div>
					{isAdmin && (
						<div className='flex items-center gap-2'>
							<button onClick={() => router.push('/write')} className='brand-btn rounded-lg px-4 py-1.5 text-xs'>
								新建看板
							</button>
							<button onClick={() => router.push('/repo')} className='bg-card rounded-lg border px-4 py-1.5 text-xs transition-colors hover:bg-bg'>
								仓库浏览
							</button>
						</div>
					)}
				</motion.header>

				<BoardWall />
			</div>
		</>
	)
}
