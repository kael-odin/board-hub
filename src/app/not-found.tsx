import Link from 'next/link'

export default function NotFound() {
	return (
		<div className='flex h-screen flex-col items-center justify-center gap-6 px-6 text-center'>
			<h1 className='text-linear text-6xl font-bold'>404</h1>
			<p className='text-secondary text-sm'>页面不存在，或者已经被移走了</p>
			<Link href='/' className='brand-btn'>
				回到首页
			</Link>
		</div>
	)
}
