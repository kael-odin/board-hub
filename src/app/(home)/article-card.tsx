import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useLatestBoard } from '@/hooks/use-board-index'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import dayjs from 'dayjs'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'

export default function ArticleCard() {
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const { board, loading } = useLatestBoard()
	const styles = cardStyles.articleCard
	const hiCardStyles = cardStyles.hiCard
	const socialButtonsStyles = cardStyles.socialButtons

	const x = styles.offsetX !== null ? center.x + styles.offsetX : center.x + hiCardStyles.width / 2 - socialButtonsStyles.width - CARD_SPACING - styles.width
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING

	return (
		<HomeDraggableLayer cardKey='articleCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='space-y-2 max-sm:static'>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-9.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 140, left: -12, top: -16, opacity: 0.8 }}
						/>
					</>
				)}

				<h2 className='text-secondary text-sm'>最新看板</h2>

				{loading ? (
					<div className='flex h-[60px] items-center justify-center'>
						<span className='text-secondary text-xs'>加载中...</span>
					</div>
				) : board ? (
					<Link href={`/boards/${board.slug}`} className='flex transition-opacity hover:opacity-80'>
						{board.cover ? (
							<img src={board.cover} alt='cover' className='mr-3 h-12 w-12 shrink-0 rounded-xl border object-cover' />
						) : (
							<div className='text-secondary mr-3 grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-white/10'>+</div>
						)}
						<div className='flex-1'>
							<h3 className='line-clamp-1 text-sm font-medium'>{board.title || board.slug}</h3>
							{board.summary && <p className='text-secondary mt-1 line-clamp-3 text-xs'>{board.summary}</p>}
							<p className='text-secondary mt-3 text-xs'>{dayjs(board.date).format('YYYY/M/D')}</p>
						</div>
					</Link>
				) : (
					<div className='flex h-[60px] items-center justify-center'>
						<span className='text-secondary text-xs'>暂无看板</span>
					</div>
				)}
			</Card>
		</HomeDraggableLayer>
	)
}
