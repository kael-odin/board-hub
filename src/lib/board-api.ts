'use client'

import { toBase64Utf8 } from './file-utils'
import type { BoardIndexItem } from '@/app/boards/types'

/**
 * 内容资产与提交 API 的客户端助手。
 *
 * 所有 GitHub 凭据都在服务端；浏览器只跟自己的 /api/* 说话：
 *   GET  /api/boards                 看板列表（按角色过滤 hidden）
 *   GET  /api/boards/<slug>          单个看板完整内容
 *   GET  /api/boards/<slug>/asset/x  目录内文件（图片/原始数据附件）
 *   POST /api/admin/commit           通用提交（admin）
 *   /api/repo/*                      仓库浏览（admin）
 */

/** 看板目录内文件的鉴权访问地址 */
export function boardAssetUrl(slug: string, file: string, download = false): string {
	return `/api/boards/${encodeURIComponent(slug)}/asset/${encodeURIComponent(file)}${download ? '?download=1' : ''}`
}

export type CommitFile = { path: string; base64: string }
export type CommitDeletion = string

export class ApiError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

async function handle(res: Response): Promise<Response> {
	if (res.ok) return res
	let message = `请求失败（${res.status}）`
	try {
		const data = (await res.json()) as { error?: string }
		if (data?.error) message = data.error
	} catch {
		// 非 JSON 响应保持默认文案
	}
	throw new ApiError(res.status, message)
}

/** 提交一批文件/删除到仓库（服务端完成 GitHub commit） */
export async function commitToRepo(params: { message: string; files?: CommitFile[]; deletions?: CommitDeletion[] }): Promise<void> {
	const res = await fetch('/api/admin/commit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: params.message, files: params.files || [], deletions: params.deletions || [] })
	})
	await handle(res)
}

/** 文本 → base64（提交用） */
export { toBase64Utf8 }

/** 读看板列表（已按角色过滤） */
export async function fetchBoardIndex(): Promise<BoardIndexItem[]> {
	const res = await fetch('/api/boards', { cache: 'no-store' })
	await handle(res)
	return (await res.json()) as BoardIndexItem[]
}
