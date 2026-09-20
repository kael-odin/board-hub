import { toast } from 'sonner'
import { commitToRepo } from '@/lib/board-api'
import { fileToBase64NoPrefix, toBase64Utf8 } from '@/lib/file-utils'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'

type ArtImageConfig = SiteContent['artImages'][number]
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
	artImageUploads?: ArtImageUploads,
	removedArtImages?: ArtImageConfig[],
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[],
	socialButtonImageUploads?: SocialButtonImageUploads
): Promise<void> {
	const files: Array<{ path: string; base64: string }> = []
	const deletions: string[] = []

	const commitMessage = `更新站点配置`

	toast.info('正在准备文件...')

	// Handle favicon upload
	if (faviconItem?.type === 'file') {
		toast.info('正在上传 Favicon...')
		files.push({ path: 'public/favicon.png', base64: await fileToBase64NoPrefix(faviconItem.file) })
	}

	// Handle avatar upload
	if (avatarItem?.type === 'file') {
		toast.info('正在上传 Avatar...')
		files.push({ path: 'public/images/avatar.png', base64: await fileToBase64NoPrefix(avatarItem.file) })
	}

	// Handle art images upload
	if (artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type !== 'file') continue

			const artConfig = siteContent.artImages?.find(art => art.id === id)
			if (!artConfig) continue

			// Ensure blob is saved under public directory while keeping URL as /images/...
			const normalizedUrlPath = artConfig.url.startsWith('/') ? artConfig.url : `/${artConfig.url}`
			const path = `public${normalizedUrlPath}`
			if (!path) continue

			toast.info(`正在上传 Art 图片 ${id}...`)
			files.push({ path, base64: await fileToBase64NoPrefix(item.file) })
		}
	}

	// Handle art images deletion
	if (removedArtImages && removedArtImages.length > 0) {
		for (const art of removedArtImages) {
			const normalizedUrlPath = art.url.startsWith('/') ? art.url : `/${art.url}`
			deletions.push(`public${normalizedUrlPath}`)
		}
	}

	// Handle background images upload
	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type !== 'file') continue

			const bgConfig = siteContent.backgroundImages?.find(bg => bg.id === id)
			if (!bgConfig) continue

			// Only upload if URL starts with /images/background/ (local file)
			if (!bgConfig.url.startsWith('/images/background/')) continue

			const normalizedUrlPath = bgConfig.url.startsWith('/') ? bgConfig.url : `/${bgConfig.url}`
			const path = `public${normalizedUrlPath}`
			if (!path) continue

			toast.info(`正在上传背景图片 ${id}...`)
			files.push({ path, base64: await fileToBase64NoPrefix(item.file) })
		}
	}

	// Handle background images deletion
	if (removedBackgroundImages && removedBackgroundImages.length > 0) {
		for (const bg of removedBackgroundImages) {
			// Only delete if URL starts with /images/background/ (local file)
			if (!bg.url.startsWith('/images/background/')) continue

			const normalizedUrlPath = bg.url.startsWith('/') ? bg.url : `/${bg.url}`
			deletions.push(`public${normalizedUrlPath}`)
		}
	}

	// Handle social button images upload
	if (socialButtonImageUploads) {
		for (const [buttonId, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type !== 'file') continue

			const button = siteContent.socialButtons?.find(btn => btn.id === buttonId)
			if (!button) continue

			// Only upload if URL starts with /images/social-buttons/ (local file)
			if (!button.value.startsWith('/images/social-buttons/')) continue

			const normalizedUrlPath = button.value.startsWith('/') ? button.value : `/${button.value}`
			const path = `public${normalizedUrlPath}`
			if (!path) continue

			toast.info(`正在上传社交按钮图片 ${buttonId}...`)
			files.push({ path, base64: await fileToBase64NoPrefix(item.file) })
		}
	}

	// Handle site content JSON
	files.push({ path: 'src/config/site-content.json', base64: toBase64Utf8(JSON.stringify(siteContent, null, '\t')) })

	// Handle card styles JSON
	files.push({ path: 'src/config/card-styles.json', base64: toBase64Utf8(JSON.stringify(cardStyles, null, '\t')) })

	toast.info('正在提交到仓库...')
	await commitToRepo({ message: commitMessage, files, deletions })

	toast.success('保存成功！')
}
