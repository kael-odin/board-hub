import { create } from 'zustand'

/**
 * 站点会话（双角色）。
 *
 * 登录态由服务端签发的 HttpOnly cookie 承载，这里只缓存「我是谁」：
 *   admin  —— 管理者：查看/下载/编辑/发布/删除/仓库浏览
 *   viewer —— 查看者：只能查看与下载
 *   null   —— 未登录
 *
 * 角色决定界面里哪些按钮出现；真正的鉴权在 /api/* 服务端强制执行，
 * 改这里的 state 绕不过去。
 */

export type Role = 'admin' | 'viewer'

interface SessionState {
	role: Role | null
	/** 是否已完成首次会话探测（避免登录前闪现内容） */
	hydrated: boolean
	isAuth: boolean
	refresh: () => Promise<void>
	logout: () => Promise<void>
}

export const useAuthStore = create<SessionState>(set => ({
	role: null,
	hydrated: false,
	isAuth: false,

	refresh: async () => {
		try {
			const res = await fetch('/api/auth/me', { cache: 'no-store' })
			const data = (await res.json()) as { role?: Role | null }
			set({ role: data.role || null, hydrated: true, isAuth: Boolean(data.role) })
		} catch {
			set({ role: null, hydrated: true, isAuth: false })
		}
	},

	logout: async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST' })
		} catch {
			// 网络失败也照常清理本地状态
		}
		set({ role: null, isAuth: false })
	}
}))

// 浏览器里模块加载即探测会话（每个页面都依赖它决定渲染什么）
if (typeof window !== 'undefined') {
	useAuthStore.getState().refresh()
}

/** 是否管理员（决定编辑/发布/删除/仓库浏览入口） */
export function useIsAdmin(): boolean {
	return useAuthStore(state => state.role === 'admin')
}
