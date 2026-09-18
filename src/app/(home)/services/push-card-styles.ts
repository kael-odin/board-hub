import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob } from '@/lib/github-client'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { toast } from 'sonner'
import type { CardStyles } from '../stores/config-store'

/** 仅提交首页卡片布局（src/config/card-styles.json），不触碰站点其他配置 */
export async function pushCardStyles(cardStyles: CardStyles): Promise<void> {
	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	toast.info('正在准备文件...')
	const cardStylesJson = JSON.stringify(cardStyles, null, '\t')
	const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(cardStylesJson), 'base64')

	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [
		{
			path: 'src/config/card-styles.json',
			mode: '100644',
			type: 'blob',
			sha: blob.sha
		}
	], latestCommitSha)

	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '更新首页卡片布局', treeData.sha, [latestCommitSha])

	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('布局已保存，部署完成后全局生效')
}
