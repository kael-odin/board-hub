'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { useAuthStore } from '@/hooks/use-auth'

export default function LoginClient() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const { role, hydrated, refresh } = useAuthStore()
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	// 已登录直接进书架
	useEffect(() => {
		if (hydrated && role) router.replace('/boards')
	}, [hydrated, role, router])

	const submit = async (e: FormEvent) => {
		e.preventDefault()
		if (!password.trim() || loading) return
		setLoading(true)
		setError(null)
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			})
			const data = (await res.json().catch(() => ({}))) as { error?: string }
			if (!res.ok) {
				setError(data.error || '登录失败，请重试')
				return
			}
			await refresh()
			const next = searchParams.get('next')
			router.replace(next && next.startsWith('/') ? next : '/boards')
		} catch {
			setError('网络异常，请重试')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='grid min-h-[80vh] place-items-center px-6'>
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				className='bg-card w-full max-w-sm rounded-3xl border p-8 shadow'>
				<div className='text-center'>
					<div className='text-3xl'>🔒</div>
					<h1 className='mt-3 text-lg font-medium'>私有看板书架</h1>
					<p className='text-secondary mt-2 text-xs leading-relaxed'>
						输入密码登录。管理员密码可查看、编辑、发布与删除；查看者密码只能浏览与下载。
					</p>
				</div>

				<form onSubmit={submit} className='mt-6 space-y-3'>
					<input
						type='password'
						placeholder='访问密码'
						autoFocus
						value={password}
						onChange={e => setPassword(e.target.value)}
						className='bg-card w-full rounded-lg border px-3 py-2 text-sm'
					/>
					{error && <p className='text-xs text-red-500'>{error}</p>}
					<button type='submit' disabled={loading || !password.trim()} className='brand-btn w-full disabled:opacity-50'>
						{loading ? '登录中…' : '登录'}
					</button>
				</form>
			</motion.div>
		</div>
	)
}
