import { toast } from 'sonner'
import { commitToRepo, fetchBoardIndex } from '@/lib/board-api'
import { removeBoardItems, BOARDS_INDEX_PATH, type BoardIndexItem } from '@/lib/board-index'
import { toBase64Utf8 } from '@/lib/file-utils'

export const BOARDS_DIR = 'content/boards'

export async function deleteBoard(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')

	toast.info('正在收集看板文件...')
	const res = await fetch(`/api/boards/${encodeURIComponent(slug)}`, { cache: 'no-store' })
	if (res.status === 404) throw new Error('看板不存在或已删除')
	if (!res.ok) throw new Error(`读取看板失败（${res.status}）`)
	const data = (await res.json()) as { files?: Array<{ name: string }> }
	const files = (data.files || []).map(f => `${BOARDS_DIR}/${slug}/${f.name}`)
	if (files.length === 0) {
		throw new Error('看板不存在或已删除')
	}

	toast.info('正在更新索引...')
	const indexList = await fetchBoardIndex()
	const nextIndex = removeBoardItems(indexList as BoardIndexItem[], [slug])

	toast.info('正在提交到仓库...')
	await commitToRepo({
		message: `删除看板: ${slug}`,
		files: [{ path: BOARDS_INDEX_PATH, base64: toBase64Utf8(JSON.stringify(nextIndex, null, 2)) }],
		deletions: files
	})

	toast.success('删除成功！请等待页面部署后刷新')
}
