import { useMemo } from 'react'
import dayjs from 'dayjs'
import { useWriteStore } from '../stores/write-store'

export function useWriteData() {
	const { form, images } = useWriteStore()

	// 把 HTML 里的 local-image:ID 占位符换成浏览器内的 blob 预览地址，
	// 这样编辑器里还没发布的图片也能在预览中正常显示。
	const processedHtml = useMemo(() => {
		let htmlForPreview = form.html
		for (const img of images) {
			if (img.type === 'file') {
				htmlForPreview = htmlForPreview.split(`local-image:${img.id}`).join(img.previewUrl)
			}
		}
		return htmlForPreview
	}, [form.html, images])

	const title = form.title || '未命名看板'
	const date = dayjs(form.date).format('YYYY年 M月 D日')

	return {
		html: processedHtml,
		title,
		date
	}
}
