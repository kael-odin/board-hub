'use client'

import { ColorPicker } from '@/components/color-picker'
import type { SiteContent } from '../stores/config-store'
import siteContent from '@/config/site-content.json'

interface ColorConfigProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
}

const DEFAULT_THEME_COLORS = siteContent.theme

type ColorPreset = {
	name: string
	theme: Partial<SiteContent['theme']>
}

/** 企业向配色预设：改动立即预览，保存后全站生效（含暗色模式的品牌色） */
const COLOR_PRESETS: ColorPreset[] = [
	{
		name: '商务蓝（默认）',
		theme: {
			colorBrand: '#2563eb',
			colorBrandSecondary: '#0ea5e9',
			colorPrimary: '#111827',
			colorSecondary: '#6b7280',
			colorBg: '#f4f5f7',
			colorBorder: '#e5e7eb',
			colorCard: '#ffffff',
			colorArticle: '#ffffff'
		}
	},
	{
		name: '深海',
		theme: {
			colorBrand: '#0f766e',
			colorBrandSecondary: '#0891b2',
			colorPrimary: '#134e4a',
			colorSecondary: '#64748b',
			colorBg: '#f1f5f6',
			colorBorder: '#d9e2e5',
			colorCard: '#ffffff',
			colorArticle: '#ffffff'
		}
	},
	{
		name: '石墨',
		theme: {
			colorBrand: '#374151',
			colorBrandSecondary: '#f59e0b',
			colorPrimary: '#111827',
			colorSecondary: '#6b7280',
			colorBg: '#f5f5f4',
			colorBorder: '#e7e5e4',
			colorCard: '#ffffff',
			colorArticle: '#ffffff'
		}
	},
	{
		name: '绛紫',
		theme: {
			colorBrand: '#7c3aed',
			colorBrandSecondary: '#a855f7',
			colorPrimary: '#1e1b2e',
			colorSecondary: '#71717a',
			colorBg: '#f6f5fa',
			colorBorder: '#e6e4ef',
			colorCard: '#ffffff',
			colorArticle: '#ffffff'
		}
	}
]

export function ColorConfig({ formData, setFormData }: ColorConfigProps) {
	const theme = formData.theme ?? {}

	const handleThemeColorChange = (key: keyof typeof DEFAULT_THEME_COLORS, value: string) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				[key]: value
			}
		}))
	}

	const handlePresetChange = (preset: ColorPreset) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				...preset.theme
			}
		}))
	}

	const field = (label: string, key: keyof typeof DEFAULT_THEME_COLORS) => (
		<div className='flex items-center gap-3'>
			<ColorPicker value={theme[key] ?? DEFAULT_THEME_COLORS[key]} onChange={value => handleThemeColorChange(key, value)} />
			<span className='text-xs'>{label}</span>
		</div>
	)

	return (
		<div className='space-y-6'>
			<div>
				<label className='mb-2 block text-sm font-medium'>基础颜色</label>
				<div className='grid grid-cols-2 gap-4'>
					{field('主题色', 'colorBrand')}
					{field('次级主题色', 'colorBrandSecondary')}
					{field('主色', 'colorPrimary')}
					{field('次色', 'colorSecondary')}
					{field('背景色', 'colorBg')}
					{field('边框色', 'colorBorder')}
					{field('卡片色', 'colorCard')}
					{field('文章背景', 'colorArticle')}
				</div>
			</div>

			<div>
				<label className='mb-2 block text-sm font-medium'>配色方案</label>
				<div className='flex flex-col gap-3'>
					{COLOR_PRESETS.map(preset => (
						<button
							key={preset.name}
							onClick={() => handlePresetChange(preset)}
							className='bg-card flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-secondary/5'>
							<div className='flex items-center gap-2'>
								<div className='h-8 w-8 rounded-md border shadow-sm' style={{ backgroundColor: preset.theme.colorBrand ?? DEFAULT_THEME_COLORS.colorBrand }} />
								<div className='h-8 w-8 rounded-md border shadow-sm' style={{ backgroundColor: preset.theme.colorBg ?? DEFAULT_THEME_COLORS.colorBg }} />
							</div>
							<span className='text-sm font-medium whitespace-nowrap'>{preset.name}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	)
}
