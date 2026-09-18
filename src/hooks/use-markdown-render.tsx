import { useEffect, useState, type ReactElement, Fragment } from 'react'
import parse, { type HTMLReactParserOptions, Element, type DOMNode } from 'html-react-parser'
import DOMPurify from 'dompurify'
import { renderMarkdown, type TocItem } from '@/lib/markdown-renderer'
import { MarkdownImage } from '@/components/markdown-image'
import { CodeBlock } from '@/components/code-block'
import { VideoEmbed, parseVideoUrl } from '@/components/video-embed'

type MarkdownRenderResult = {
	content: ReactElement | null
	toc: TocItem[]
	loading: boolean
}

export function useMarkdownRender(markdown: string): MarkdownRenderResult {
	const [content, setContent] = useState<ReactElement | null>(null)
	const [toc, setToc] = useState<TocItem[]>([])
	const [loading, setLoading] = useState<boolean>(true)

	useEffect(() => {
		let cancelled = false

		async function render() {
			setLoading(true)
			try {
				const { html, toc } = await renderMarkdown(markdown)
				if (!cancelled) {
					// XSS 防线：marked 透传的原始 HTML（含 <iframe>/<img onerror> 等）在此统一消毒
					const sanitized = DOMPurify.sanitize(html, {
						ADD_TAGS: ['iframe'],
						ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'referrerpolicy', 'target', 'webkitallowfullscreen', 'mozallowfullscreen']
					})

					// Extract pre elements and replace with placeholders before parsing
					const codeBlocks: Array<{ placeholder: string; code: string; preHtml: string; kind: 'code' | 'mermaid' }> = []
					let processedHtml = sanitized.replace(/<pre([^>]*)data-code="([^"]*)"([^>]*)>([\s\S]*?)<\/pre>/g, (match, attrsBefore, codeAttr, attrsAfter, content) => {
						const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
						const allAttrs = `${attrsBefore} ${attrsAfter}`
						// Decode HTML entities in code attribute
						const code = codeAttr
							.replace(/&quot;/g, '"')
							.replace(/&#39;/g, "'")
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&amp;/g, '&')
						codeBlocks.push({
							placeholder,
							code,
							preHtml: `${content}`,
							kind: allAttrs.includes('mermaid-block') ? 'mermaid' : 'code'
						})
						return placeholder
					})

						// Parse HTML and replace img elements and code block placeholders
						const options: HTMLReactParserOptions = {
							replace(domNode: DOMNode) {
								if (domNode instanceof Element && domNode.name === 'img') {
									const { src, alt, title } = domNode.attribs
									return <MarkdownImage src={src} alt={alt} title={title} />
								}
								// 独立成段的 B站/YouTube 链接（marked 会把裸链转成 <a>）自动转为嵌入播放器
								if (domNode instanceof Element && domNode.name === 'a') {
									const href = domNode.attribs?.href
									if (href && parseVideoUrl(href)) {
										return <VideoEmbed url={href} />
									}
								}
							// Handle code block placeholders in text nodes
							if (domNode.type === 'text' && domNode.data && domNode.data.includes('__CODE_BLOCK_')) {
								const text = domNode.data
								const result = text
												.split(/(__CODE_BLOCK_\d+__)/)
												.filter(Boolean);

								return (
									<>
										{result.map((item, index) => {
											if(item.startsWith('__CODE_BLOCK_')){
												const block = codeBlocks.find(b => b.placeholder === item)
												if(block){
													if (block.kind === 'mermaid') {
														// mermaid SVG 由 securityLevel=strict 的 mermaid 自身生成，原样挂载
														return (
															<div
																key={block.placeholder}
																className='mermaid-block my-4 overflow-x-auto rounded-xl bg-white dark:bg-[#1c2629] p-4'
																dangerouslySetInnerHTML={{ __html: block.preHtml }}
															/>
														)
													}
													const preElement = parse(block.preHtml) as ReactElement
													return (
														<CodeBlock key={block.placeholder} code={block.code}>{preElement}</CodeBlock>
													)
												}
											}else{
												return item
													? <Fragment key={index}>{item}</Fragment>
													: null
											}
										})}
									</>
								)
							}
						}
					}
					const reactContent = parse(processedHtml, options) as ReactElement
					setContent(reactContent)
					setToc(toc)
				}
			} catch (error) {
				console.error('Markdown render error:', error)
				if (!cancelled) {
					setContent(null)
					setToc([])
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		render()

		return () => {
			cancelled = true
		}
	}, [markdown])

	return { content, toc, loading }
}
