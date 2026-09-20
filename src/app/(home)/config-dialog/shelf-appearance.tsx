'use client'

import { motion } from 'motion/react'
import { Select } from '@/components/select'
import type { SiteContent } from '../stores/config-store'

interface ShelfAppearanceProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
}

type ShelfConfig = NonNullable<SiteContent['shelf']>

const WIDTH_PRESETS = [
	{ value: '1080', label: '窄 1080px' },
	{ value: '1280', label: '标准 1280px' },
	{ value: '1440', label: '宽 1440px' },
	{ value: '1600', label: '全宽 1600px' }
]

const COLUMN_PRESETS = [
	{ value: '0', label: '自动（窄屏 1 列 · 宽屏 3 列）' },
	{ value: '2', label: '固定 2 列' },
	{ value: '3', label: '固定 3 列' }
]

const DEFAULTS: ShelfConfig = { contentWidth: 1280, columns: 0, compact: false }

/**
 * 书架外观：内容宽度、看板卡片列数、紧凑模式。
 * 存在 site-content.json 的 shelf 字段，改动立即预览，保存后全站生效。
 */
export function ShelfAppearance({ formData, setFormData }: ShelfAppearanceProps) {
	const shelf: ShelfConfig = { ...DEFAULTS, ...(formData.shelf || {}) }

	const update = (patch: Partial<ShelfConfig>) => {
		setFormData({ ...formData, shelf: { ...shelf, ...patch } })
	}

	return (
		<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className='space-y-5 py-2'>
			<p className='text-secondary text-xs leading-relaxed'>
				控制书架页面的整体排版。点上方「预览」可先看效果，满意再点「保存」提交，全站生效。
			</p>

			<div>
				<div className='mb-1.5 text-sm'>内容宽度</div>
				<Select className='w-full text-sm' value={String(shelf.contentWidth)} onChange={v => update({ contentWidth: Number(v) })} options={WIDTH_PRESETS} />
			</div>

			<div>
				<div className='mb-1.5 text-sm'>看板卡片列数</div>
				<Select className='w-full text-sm' value={String(shelf.columns)} onChange={v => update({ columns: Number(v) })} options={COLUMN_PRESETS} />
			</div>

			<label className='flex cursor-pointer items-center gap-2'>
				<input
					type='checkbox'
					checked={Boolean(shelf.compact)}
					onChange={e => update({ compact: e.target.checked })}
					className='h-4 w-4 rounded border-gray-300 dark:border-gray-600'
				/>
				<span className='text-sm text-gray-600 select-none dark:text-gray-300'>紧凑模式（缩小卡片间距，一屏多放些看板）</span>
			</label>
		</motion.div>
	)
}
