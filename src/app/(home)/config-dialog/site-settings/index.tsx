'use client'

import type { SiteContent } from '../../stores/config-store'
import type { BackgroundImageUploads, FileItem } from './types'
import { FaviconAvatarUpload } from './favicon-avatar-upload'
import { SiteMetaForm } from './site-meta-form'
import { BackgroundImagesSection } from './background-images-section'

export type { FileItem, BackgroundImageUploads } from './types'

interface SiteSettingsProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
	faviconItem: FileItem | null
	setFaviconItem: React.Dispatch<React.SetStateAction<FileItem | null>>
	avatarItem: FileItem | null
	setAvatarItem: React.Dispatch<React.SetStateAction<FileItem | null>>
	backgroundImageUploads: BackgroundImageUploads
	setBackgroundImageUploads: React.Dispatch<React.SetStateAction<BackgroundImageUploads>>
}

/** 网站设置：只保留书架站真正用得到的项（头像/favicon、站名摘要、背景图、分类开关） */
export function SiteSettings({
	formData,
	setFormData,
	faviconItem,
	setFaviconItem,
	avatarItem,
	setAvatarItem,
	backgroundImageUploads,
	setBackgroundImageUploads
}: SiteSettingsProps) {
	return (
		<div className='space-y-6'>
			<FaviconAvatarUpload faviconItem={faviconItem} setFaviconItem={setFaviconItem} avatarItem={avatarItem} setAvatarItem={setAvatarItem} />

			<SiteMetaForm formData={formData} setFormData={setFormData} />

			<BackgroundImagesSection
				formData={formData}
				setFormData={setFormData}
				backgroundImageUploads={backgroundImageUploads}
				setBackgroundImageUploads={setBackgroundImageUploads}
			/>

			<label className='flex cursor-pointer items-center gap-2'>
				<input
					type='checkbox'
					checked={formData.enableCategories ?? false}
					onChange={e => setFormData({ ...formData, enableCategories: e.target.checked })}
					className='accent-brand h-4 w-4 rounded'
				/>
				<span className='text-sm font-medium text-gray-600 dark:text-gray-300'>启用看板分类（发布时可给看板归档业务分类）</span>
			</label>
		</div>
	)
}
