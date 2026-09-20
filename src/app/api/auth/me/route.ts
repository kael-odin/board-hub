import { NextResponse } from 'next/server'
import { getRole, isAuthConfigured } from '@/lib/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
	const configured = isAuthConfigured()
	const role = await getRole()
	return NextResponse.json(
		{ role, configured },
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}
