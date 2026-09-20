'use client'

/** 文本 → base64（提交到仓库用） */
export function toBase64Utf8(input: string): string {
	return btoa(unescape(encodeURIComponent(input)))
}

/** base64 → UTF-8 文本 */
export function fromBase64Utf8(base64: string): string {
	const bin = atob(base64)
	const bytes = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
	return new TextDecoder('utf-8').decode(bytes)
}

/** base64 → 二进制（显式绑定 ArrayBuffer，便于直接进 Blob/File 构造器） */
export function fromBase64Bytes(base64: string): Uint8Array<ArrayBuffer> {
	const bin = atob(base64)
	const buffer = new ArrayBuffer(bin.length)
	const bytes = new Uint8Array(buffer)
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
	return bytes
}

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = reject
		reader.readAsText(file)
	})
}

export function fileToBase64NoPrefix(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const dataUrl = String(reader.result || '')
			resolve(dataUrl.replace(/^data:[^;]+;base64,/, ''))
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

export async function hashFileSHA256(file: File): Promise<string> {
	const buf = await file.arrayBuffer()
	const digest = await crypto.subtle.digest('SHA-256', buf)
	const bytes = new Uint8Array(digest)
	let hex = ''
	for (let i = 0; i < bytes.length; i++) {
		const h = bytes[i].toString(16).padStart(2, '0')
		hex += h
	}
	return hex.slice(0, 16)
}
