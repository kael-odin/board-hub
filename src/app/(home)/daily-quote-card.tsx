'use client'

import { useEffect, useState } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import quoteList from '@/config/daily-quotes.json'
import { HomeDraggableLayer } from './home-draggable-layer'

type Quote = {
	text: string
	from: string
}

// 以日期为种子做一次散列：同一天稳定展示同一条，隔天自动换一条
function pickDailyQuote(): Quote {
	const now = new Date()
	const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
	let x = (seed ^ 0x5f3759df) >>> 0
	x = Math.imul(x ^ (x >>> 15), 0x2545f491) >>> 0
	x = (Math.imul(x ^ (x >>> 13), 0x27d4eb2d) >>> 0) % quoteList.length
	return quoteList[x] ?? quoteList[0]
}

export default function DailyQuoteCard() {
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const [quote, setQuote] = useState<Quote | null>(null)
	const styles = cardStyles.shareCard
	const hiCardStyles = cardStyles.hiCard
	const socialButtonsStyles = cardStyles.socialButtons

	useEffect(() => {
		setQuote(pickDailyQuote())
	}, [])

	if (!quote) {
		return null
	}

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + hiCardStyles.width / 2 - socialButtonsStyles.width
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING + socialButtonsStyles.height + CARD_SPACING

	return (
		<HomeDraggableLayer cardKey='shareCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y}>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-12.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -12, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<h2 className='text-secondary text-sm'>每日一签</h2>

				<div className='mt-2 block space-y-2'>
					<p className='text-primary line-clamp-4 text-sm leading-relaxed'>「{quote.text}」</p>
					<p className='text-secondary text-right text-xs'>—— {quote.from}</p>
				</div>
			</Card>
		</HomeDraggableLayer>
	)
}
