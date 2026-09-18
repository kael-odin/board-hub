import { useMemo } from 'react'
import dayjs from 'dayjs'
import { useWriteStore } from '../stores/write-store'

export function useWriteData() {
	const { form, images } = useWriteStore()

	// 把正文里的 local-image:ID 占位符换成浏览器内的 blob 预览地址，
	// 这样还没发布的图片也能在预览中正常显示。markdown 与 html 两种语法都处理。
	const processedContent = useMemo(() => {
		let out = form.content
		for (const img of images) {
			if (img.type === 'file') {
				out = out.split(`local-image:${img.id}`).join(img.previewUrl)
			}
		}
		return out
	}, [form.content, images])

	const title = form.title || '未命名看板'
	const date = dayjs(form.date).format('YYYY年 M月 D日')

	/** 图片看板在预览里要展示的图片地址（本地文件用 blob URL） */
	const galleryImages = useMemo(
		() => images.map(img => (img.type === 'url' ? img.url : img.previewUrl)),
		[images]
	)

	return {
		content: processedContent,
		galleryImages,
		title,
		date
	}
}
