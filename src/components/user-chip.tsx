'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/hooks/use-auth'

/**
 * 右下角的小身份角标：显示当前角色，提供退出 / 登录入口。
 * 未登录时只显示一个低调的「登录」按钮。
 */
export function UserChip() {
	const router = useRouter()
	const { role, hydrated, logout } = useAuthStore()
	const [open, setOpen] = useState(false)
	const boxRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
		}
		window.addEventListener('mousedown', onClickOutside)
		return () => window.removeEventListener('mousedown', onClickOutside)
	}, [])

	if (!hydrated) return null

	if (!role) {
		return (
			<button
				onClick={() => router.push('/login')}
				className='bg-card text-secondary hover:text-brand fixed right-4 bottom-4 z-40 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs shadow backdrop-blur-sm transition-colors'>
				登录
			</button>
		)
	}

	const label = role === 'admin' ? '管理员' : '查看者'

	return (
		<div ref={boxRef} className='fixed right-4 bottom-4 z-40'>
			{open && (
				<div className='bg-card absolute right-0 bottom-10 w-40 overflow-hidden rounded-xl border shadow-lg'>
					<div className='text-secondary border-b px-3 py-2 text-[11px]'>
						当前身份：<span className='text-brand'>{label}</span>
					</div>
					<button
						onClick={async () => {
							setOpen(false)
							await logout()
							router.push('/login')
						}}
						className='hover:bg-secondary/10 block w-full px-3 py-2 text-left text-xs transition-colors'>
						退出登录
					</button>
				</div>
			)}
			<button
				onClick={() => setOpen(v => !v)}
				className='bg-card text-secondary flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs shadow backdrop-blur-sm transition-colors hover:shadow-md'
				title='账号'>
				{role === 'admin' ? '🛠️' : '👤'} {label}
			</button>
		</div>
	)
}
