'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { withBase } from '@/lib/asset-path'
import { useEffect } from 'react'
import { INIT_DELAY } from '@/consts'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from './stores/config-store'
import ConfigDialog from './config-dialog/index'
import SnowfallBackground from '@/layout/backgrounds/snowfall'
import { BoardWall } from '@/components/board-wall'

/**
 * 首页 = 站点标识头部 + 看板卡片墙。
 * 装饰性资源（背景动效、明暗主题、光标、NavCard、音乐卡片）由根 layout 提供，这里不用重复。
 */
export default function Home() {
	const { maxSM } = useSize()
	const { configDialogOpen, setConfigDialogOpen, siteContent } = useConfigStore()

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
			{siteContent.enableChristmas && <SnowfallBackground zIndex={0} count={!maxSM ? 125 : 20} />}

			<div className='mx-auto w-full max-w-7xl px-6 pt-28 pb-16'>
				{/* 站点标识 */}
				<motion.header
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: INIT_DELAY }}
					className='mb-12 flex flex-col items-center gap-4 text-center'>
					<Link href='/'>
						<Image
							src={withBase('/images/avatar.png')}
							alt='avatar'
							width={72}
							height={72}
							className='rounded-full transition-transform hover:scale-105'
							style={{ boxShadow: '0 12px 20px -5px #E2D9CE' }}
						/>
					</Link>
					<div>
						<h1 className='font-averia text-2xl leading-tight font-medium'>{siteContent.meta.title}</h1>
						<p className='text-secondary mt-2 max-w-xl text-sm'>{siteContent.meta.description}</p>
					</div>
				</motion.header>

				<BoardWall />
			</div>

			{siteContent.enableChristmas && <SnowfallBackground zIndex={2} count={!maxSM ? 125 : 20} />}
			<ConfigDialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
		</>
	)
}
