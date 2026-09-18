'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { motion } from 'motion/react'

const THEME_KEY = 'kael-blog-theme'

/**
 * 明暗主题切换（固定在左下角），持久化到 localStorage 并写入 <html data-theme>。
 *
 * 位置用 bottom-20 而不是紧贴底部：电子表格看板的底部工作表栏
 * （Univer 的「+ 新建工作表」就在那一排）正好占据左下角，贴底会把按钮盖住。
 */
const TOGGLE_POSITION = 'fixed bottom-20 left-5'
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
			className={`bg-card text-primary ${TOGGLE_POSITION} z-50 flex h-9 w-9 items-center justify-center rounded-full border shadow backdrop-blur transition-colors hover:bg-white/60 dark:hover:bg-white/15 dark:hover:bg-white/10`}>
			{theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
		</motion.button>
	)
}
