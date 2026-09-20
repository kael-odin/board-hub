'use client'

import { toast } from 'sonner'
import { commitToRepo } from '@/lib/board-api'
import { fileToBase64NoPrefix, toBase64Utf8 } from '@/lib/file-utils'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, BackgroundImageUploads } from '../config-dialog/site-settings'

type BackgroundImageConfig = SiteContent['backgroundImages'][number]

/**
 * 把站点配置（site-content.json / card-styles.json）和站点静态资源
 * 提交回仓库。GitHub 提交由服务端 /api/admin/commit 完成（admin 会话）。
 */
export async function pushSiteContent(
	siteContent: SiteContent,
	cardStyles: CardStyles,
	faviconItem?: FileItem | null,
	avatarItem?: FileItem | null,
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[]
): Promise<void> {
	const files: Array<{ path: string; base64: string }> = []
	const deletions: string[] = []

	const commitMessage = `更新站点配置`

	toast.info('正在准备文件...')

	if (faviconItem?.type === 'file') {
		toast.info('正在上传 Favicon...')
		files.push({ path: 'public/favicon.png', base64: await fileToBase64NoPrefix(faviconItem.file) })
	}

	if (avatarItem?.type === 'file') {
		toast.info('正在上传 Avatar...')
		files.push({ path: 'public/images/avatar.png', base64: await fileToBase64NoPrefix(avatarItem.file) })
	}

	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type !== 'file') continue

			const bgConfig = siteContent.backgroundImages?.find(bg => bg.id === id)
			if (!bgConfig) continue

			// Only upload if URL starts with /images/background/ (local file)
			if (!bgConfig.url.startsWith('/images/background/')) continue

			const normalizedUrlPath = bgConfig.url.startsWith('/') ? bgConfig.url : `/${bgConfig.url}`
			const path = `public${normalizedUrlPath}`

			toast.info(`正在上传背景图片 ${id}...`)
			files.push({ path, base64: await fileToBase64NoPrefix(item.file) })
		}
	}

	if (removedBackgroundImages && removedBackgroundImages.length > 0) {
		for (const bg of removedBackgroundImages) {
			if (!bg.url.startsWith('/images/background/')) continue

			const normalizedUrlPath = bg.url.startsWith('/') ? bg.url : `/${bg.url}`
			deletions.push(`public${normalizedUrlPath}`)
		}
	}

	files.push({ path: 'src/config/site-content.json', base64: toBase64Utf8(JSON.stringify(siteContent, null, '	')) })
	files.push({ path: 'src/config/card-styles.json', base64: toBase64Utf8(JSON.stringify(cardStyles, null, '	')) })

	toast.info('正在提交到仓库...')
	await commitToRepo({ message: commitMessage, files, deletions })

	toast.success('保存成功！')
}
