import { create } from 'zustand'

type PreviewStore = {
	isPreview: boolean
	openPreview: () => void
	closePreview: () => void
	togglePreview: () => void
	/** 分屏实时预览（宽屏侧栏），状态存 localStorage */
	livePreview: boolean
	toggleLivePreview: () => void
}

const LIVE_PREVIEW_KEY = 'kael-blog-live-preview'

export const usePreviewStore = create<PreviewStore>(set => ({
	isPreview: false,
	openPreview: () => set({ isPreview: true }),
	closePreview: () => set({ isPreview: false }),
	togglePreview: () => set(state => ({ isPreview: !state.isPreview })),
	// 初始 false，挂载后从 localStorage 恢复（避免 SSR 水合不一致）
	livePreview: false,
	toggleLivePreview: () =>
		set(state => {
			const next = !state.livePreview
			try {
				localStorage.setItem(LIVE_PREVIEW_KEY, next ? '1' : '0')
			} catch {
				// ignore
			}
			return { livePreview: next }
		})
}))

/** 挂载时恢复本地开关 */
export function initLivePreview() {
	try {
		usePreviewStore.setState({ livePreview: localStorage.getItem(LIVE_PREVIEW_KEY) === '1' })
	} catch {
		// ignore
	}
}
