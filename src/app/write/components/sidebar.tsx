import { CoverSection } from './sections/cover-section'
import { MetaSection } from './sections/meta-section'
import { ImagesSection } from './sections/images-section'
import { SourceSection } from './sections/source-section'
import { ANIMATION_DELAY, INIT_DELAY } from '@/consts'

export function WriteSidebar() {
	return (
		<div className='w-full space-y-6 lg:w-[320px]'>
			<CoverSection delay={INIT_DELAY + ANIMATION_DELAY * 0} />
			<MetaSection delay={INIT_DELAY + ANIMATION_DELAY * 1} />
			<SourceSection delay={INIT_DELAY + ANIMATION_DELAY * 2} />
			<ImagesSection delay={INIT_DELAY + ANIMATION_DELAY * 3} />
		</div>
	)
}
