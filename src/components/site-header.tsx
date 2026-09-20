'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { withBase } from '@/lib/asset-path'
import ThemeToggle from '@/components/theme-toggle'
import ConfigDialog from '@/app/(home)/config-dialog'

/**
 * 全站顶部导航条。
 *
 * 取代博客遗留的悬浮 NavCard：站名回到左上，右侧按角色给入口——
 *   书架（所有人）· 仓库浏览 / 设置（管理员）· 身份菜单（所有人）
 * 「设置」打开全站配置弹窗（站点信息 / 色彩 / 书架外观），弹窗本体挂在这里，
 * 任何页面都能唤起，不再只属于首页。
 */
export function SiteHeader() {
	const pathname = usePathname()
	const router = useRouter()
	const { role, hydrated, logout } = useAuthStore()
	const isAdmin = role === 'admin'
	const { siteContent, configDialogOpen, setConfigDialogOpen } = useConfigStore()
	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
		}
		window.addEventListener('mousedown', onClickOutside)
		return () => window.removeEventListener('mousedown', onClickOutside)
	}, [])

	// 编辑页有自己的全屏动作条，顶栏只保留站名避免拥挤
	const minimal = pathname === '/write'

	const navItems: Array<{ label: string; href?: string; onClick?: () => void; adminOnly?: boolean; active?: boolean }> = [
		{ label: '书架', href: '/boards', active: pathname === '/' || pathname.startsWith('/boards') },
		{ label: '仓库浏览', href: '/repo', adminOnly: true, active: pathname.startsWith('/repo') },
		{ label: '设置', adminOnly: !minimal, onClick: () => setConfigDialogOpen(true), active: configDialogOpen }
	]

	return (
		<>
			<header className='bg-card/70 fixed inset-x-0 top-0 z-40 border-b backdrop-blur-md'>
				<div className='mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6'>
					{/* 站名 */}
					<Link href='/' className='flex min-w-0 items-center gap-2.5'>
						<Image
							src={withBase('/images/avatar.png')}
							alt='avatar'
							width={30}
							height={30}
							className='shrink-0 rounded-full transition-transform hover:scale-105'
						/>
						<span className='truncate text-sm font-medium'>{siteContent.meta.title}</span>
						<span className='text-brand hidden text-[11px] font-medium sm:inline'>看板 · Boards</span>
					</Link>

					{!minimal && (
						<nav className='ml-2 flex items-center gap-1'>
							{navItems.map(item => {
								if (item.adminOnly && !isAdmin) return null
								const inner = (
									<span
										className={clsx(
											'rounded-full px-3 py-1.5 text-xs transition-colors',
											item.active ? 'bg-brand/10 text-brand' : 'text-secondary hover:bg-secondary/10 hover:text-primary'
										)}>
										{item.label}
									</span>
								)
								return item.href ? (
									<Link key={item.label} href={item.href}>
										{inner}
									</Link>
								) : (
									<button key={item.label} type='button' onClick={item.onClick}>
										{inner}
									</button>
								)
							})}
						</nav>
					)}

					<div className='ml-auto flex items-center gap-2'>
						<ThemeToggle />
						{!minimal && (
							<div ref={menuRef} className='relative'>
								{hydrated && !role ? (
									<button onClick={() => router.push('/login')} className='brand-btn rounded-full px-4 py-1.5 text-xs'>
										登录
									</button>
								) : (
									<button
										onClick={() => setMenuOpen(v => !v)}
										className='text-secondary bg-secondary/10 hover:bg-secondary/20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors'>
										{role === 'admin' ? '🛠️ 管理员' : '👤 查看者'}
									</button>
								)}
								{menuOpen && (
									<div className='bg-card absolute right-0 top-10 w-40 overflow-hidden rounded-xl border shadow-lg'>
										<div className='text-secondary border-b px-3 py-2 text-[11px]'>
											当前身份：<span className='text-brand'>{role === 'admin' ? '管理员' : '查看者'}</span>
										</div>
										<button
											onClick={async () => {
												setMenuOpen(false)
												await logout()
												router.push('/login')
											}}
											className='hover:bg-secondary/10 block w-full px-3 py-2 text-left text-xs transition-colors'>
											退出登录
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</header>

			{/* 全站配置弹窗：站点信息 / 色彩 / 书架外观（管理员可保存） */}
			<ConfigDialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
		</>
	)
}
