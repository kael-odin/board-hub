import { toast } from 'sonner'
import { commitToRepo } from '@/lib/board-api'
import { toBase64Utf8 } from '@/lib/file-utils'
import type { CardStyles } from '../stores/config-store'

/** 仅提交首页卡片布局（src/config/card-styles.json），不触碰站点其他配置 */
export async function pushCardStyles(cardStyles: CardStyles): Promise<void> {
	toast.info('正在提交...')
	await commitToRepo({
		message: '更新首页卡片布局',
		files: [{ path: 'src/config/card-styles.json', base64: toBase64Utf8(JSON.stringify(cardStyles, null, '\t')) }]
	})
	toast.success('布局已保存，部署完成后全局生效')
}
