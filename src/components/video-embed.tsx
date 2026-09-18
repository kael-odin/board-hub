'use client'

import { useMemo } from 'react'

type EmbedInfo = { provider: 'bilibili' | 'youtube'; src: string }

/** 把 B站/YouTube 链接解析为嵌入播放器地址；不支持的形式返回 null */
export function parseVideoUrl(url: string): EmbedInfo | null {
	if (!url) return null
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return null
	}
	const host = parsed.hostname.replace(/^www\./, '')

	// B站：www.bilibili.com/video/BVxxxx（b23.tv 短链需要服务端解析，暂不处理）
	if (host === 'bilibili.com' || host === 'm.bilibili.com') {
		const match = parsed.pathname.match(/^\/video\/(BV[0-9A-Za-z]+)/)
		if (match) {
			return { provider: 'bilibili', src: `https://player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&danmaku=0&autoplay=0` }
		}
		return null
	}

	// YouTube：watch?v= / youtu.be/ / shorts/
	if (host === 'youtube.com' || host === 'm.youtube.com') {
		const v = parsed.searchParams.get('v')
		if (v) return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${v}` }
		const shorts = parsed.pathname.match(/^\/shorts\/([0-9A-Za-z_-]+)/)
		if (shorts) return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${shorts[1]}` }
		return null
	}
	if (host === 'youtu.be') {
		const id = parsed.pathname.slice(1)
		if (/^[0-9A-Za-z_-]+$/.test(id)) return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` }
		return null
	}

	return null
}

/** 文章内 16:9 自适应嵌入播放器 */
export function VideoEmbed({ url }: { url: string }) {
	const embed = useMemo(() => parseVideoUrl(url), [url])
	if (!embed) return null

	return (
		<span className='my-4 block w-full overflow-hidden rounded-xl shadow-sm' style={{ aspectRatio: '16 / 9' }}>
			<iframe
				src={embed.src}
				title='视频播放器'
				className='h-full w-full border-0'
				allowFullScreen
				allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-screen'
				referrerPolicy='no-referrer'
				loading='lazy'
			/>
		</span>
	)
}
