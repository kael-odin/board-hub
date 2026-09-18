'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { CARD_SPACING } from '@/consts'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { Pause, SkipForward } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import playlist from '@/config/playlist.json'

type Track = { name: string; url: string }

// 歌单：往 public/music/ 加音频文件并在 src/config/playlist.json 里追加即可
const MUSIC_FILES: Track[] = (playlist as Track[]).filter(t => t?.url)

export default function MusicCard() {
	const pathname = usePathname()
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const styles = cardStyles.musicCard
	const hiCardStyles = cardStyles.hiCard
	const clockCardStyles = cardStyles.clockCard
	const calendarCardStyles = cardStyles.calendarCard

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [progress, setProgress] = useState(0)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const currentIndexRef = useRef(0)

	const isHomePage = pathname === '/'

	const position = useMemo(() => {
		// If not on home page, always position at bottom-right corner when playing
		if (!isHomePage) {
			return {
				x: center.width - styles.width - 16,
				y: center.height - styles.height - 16
			}
		}

		// Default position on home page
		return {
			x: styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2 - styles.offset,
			y: styles.offsetY !== null ? center.y + styles.offsetY : center.y - clockCardStyles.offset + CARD_SPACING + calendarCardStyles.height + CARD_SPACING
		}
	}, [isPlaying, isHomePage, center, styles, hiCardStyles, clockCardStyles, calendarCardStyles])

	const { x, y } = position

	// Initialize audio element
	useEffect(() => {
		if (!audioRef.current) {
			audioRef.current = new Audio()
			// 4.9MB 音频不在页面加载时预取，首次播放才加载
			audioRef.current.preload = 'none'
		}

		const audio = audioRef.current

		const updateProgress = () => {
			if (audio.duration) {
				setProgress((audio.currentTime / audio.duration) * 100)
			}
		}

		const handleEnded = () => {
			const nextIndex = (currentIndexRef.current + 1) % MUSIC_FILES.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}
		// 曲目加载失败自动跳下一首
		const handleError = () => {
			if (MUSIC_FILES.length <= 1) return
			const nextIndex = (currentIndexRef.current + 1) % MUSIC_FILES.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}

		const handleTimeUpdate = () => {
			updateProgress()
		}

		const handleLoadedMetadata = () => {
			updateProgress()
		}

		audio.addEventListener('timeupdate', handleTimeUpdate)
		audio.addEventListener('ended', handleEnded)
		audio.addEventListener('error', handleError)
		audio.addEventListener('loadedmetadata', handleLoadedMetadata)

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate)
			audio.removeEventListener('ended', handleEnded)
			audio.removeEventListener('error', handleError)
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
		}
	}, [])

	// Handle currentIndex change - load new audio
	useEffect(() => {
		currentIndexRef.current = currentIndex
		if (audioRef.current) {
			const audio = audioRef.current
			const wasPlaying = !audio.paused
			audio.pause()
			// 懒加载：记下目标曲目，正在播放时才真正装载
			const url = MUSIC_FILES[currentIndex]?.url || ''
			if (audio.dataset.track !== url) {
				audio.dataset.track = url
				if (wasPlaying) {
					audio.src = url
					audio.loop = false
					audio.play().catch(console.error)
				}
			}
			audio.loop = false
			setProgress(0)
		}
	}, [currentIndex])

	// Handle play/pause state change
	useEffect(() => {
		if (!audioRef.current) return

		if (isPlaying) {
			const audio = audioRef.current
			// 首次播放（或换曲后）再装载音频源
			const url = MUSIC_FILES[currentIndexRef.current]?.url || ''
			if (audio.dataset.track !== url) {
				audio.dataset.track = url
				audio.src = url
			}
			audio.play().catch(console.error)
		} else {
			audioRef.current.pause()
		}
	}, [isPlaying])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ''
			}
		}
	}, [])

	const togglePlayPause = () => {
		setIsPlaying(!isPlaying)
	}

	const nextTrack = () => {
		if (MUSIC_FILES.length <= 1) return
		setCurrentIndex((currentIndex + 1) % MUSIC_FILES.length)
	}

	// Hide component if not on home page and not playing
	if (!isHomePage && !isPlaying) {
		return null
	}

	const currentTrack = MUSIC_FILES[currentIndex]

	return (
		<HomeDraggableLayer cardKey='musicCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className={clsx('flex items-center gap-3', !isHomePage && 'fixed')}>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-10.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -8, top: -12, opacity: 0.8 }}
						/>
						<img
							src='/images/christmas/snow-11.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 80, right: -10, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<MusicSVG className='h-8 w-8' />

				<div className='flex-1 overflow-hidden'>
					<div className='text-secondary truncate text-sm' title={currentTrack?.name}>
						{currentTrack?.name || '未配置曲目'}
					</div>

					<div className='mt-1 h-2 rounded-full bg-white/60 dark:bg-white/10'>
						<div className='bg-linear h-full rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
					</div>
				</div>

				<div className='flex items-center gap-1.5'>
					{MUSIC_FILES.length > 1 && (
						<button
							onClick={nextTrack}
							aria-label='下一首'
							className='flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70'>
							<SkipForward className='text-secondary h-4 w-4' />
						</button>
					)}
					<button
						onClick={togglePlayPause}
						aria-label={isPlaying ? '暂停' : '播放'}
						className='flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-[#1c2629] transition-opacity hover:opacity-80'>
						{isPlaying ? <Pause className='text-brand h-4 w-4' /> : <PlaySVG className='text-brand ml-1 h-4 w-4' />}
					</button>
				</div>
			</Card>
		</HomeDraggableLayer>
	)
}
