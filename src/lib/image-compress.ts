'use client'

/**
 * 浏览器端图片压缩：转 WebP（canvas），与 /image-toolbox 的转换逻辑一致。
 * 编辑器入库图片自动调用，节省仓库体积与页面加载。
 */

export type CompressOptions = {
	/** 0-1，默认 0.82 */
	quality?: number
	/** 超过该宽度等比缩放，默认 1920 */
	maxWidth?: number
}

// gif（动图会丢帧）/svg（矢量）不做有损压缩
const COMPRESSIBLE = /^image\/(jpeg|png|webp|bmp)$/i

export function isCompressibleImage(file: File): boolean {
	return COMPRESSIBLE.test(file.type)
}

export async function compressImageToWebp(file: File, options: CompressOptions = {}): Promise<File> {
	const { quality = 0.82, maxWidth = 1920 } = options
	const bitmap = await createImageBitmap(file)
	try {
		const canvas = document.createElement('canvas')
		let width = bitmap.width
		let height = bitmap.height
		if (width > maxWidth) {
			height = Math.round((maxWidth / width) * height)
			width = maxWidth
		}
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('无法初始化画布')
		ctx.drawImage(bitmap, 0, 0, width, height)

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(result => (result ? resolve(result) : reject(new Error('无法生成 WebP'))), 'image/webp', quality)
		})
		// 压缩后反而更大就保留原图
		if (blob.size >= file.size) return file
		const name = `${file.name.replace(/\.[^.]+$/, '')}.webp`
		return new File([blob], name, { type: 'image/webp', lastModified: Date.now() })
	} finally {
		bitmap.close?.()
	}
}
