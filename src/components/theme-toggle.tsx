'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { motion } from 'motion/react'

const THEME_KEY = 'kael-blog-theme'

/**
 * 明暗主题切换按钮，持久化到 localStorage 并写入 <html data-theme>。
 * 本体不带定位，放哪由父容器决定（当前在顶部导航条右侧）。
 */
export default function ThemeToggle() {
	const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

	useEffect(() => {
		const current = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
		setTheme(current)
		document.documentElement.dataset.theme = current
	}, [])

	const toggle = () => {
		const next = theme === 'dark' ? 'light' : 'dark'
		setTheme(next)
		document.documentElement.dataset.theme = next
		try {
			localStorage.setItem(THEME_KEY, next)
		} catch {
			// ignore
		}
	}

	// 挂载前不渲染，避免水合不一致
	if (theme === null) return null

	return (
		<motion.button
			initial={{ opacity: 0, scale: 0.6 }}
			animate={{ opacity: 1, scale: 1 }}
			whileHover={{ scale: 1.08 }}
			whileTap={{ scale: 0.92 }}
			onClick={toggle}
			aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
			title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
			className='bg-card text-primary flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors hover:bg-white/60 dark:hover:bg-white/15'>
			{theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
		</motion.button>
	)
}
