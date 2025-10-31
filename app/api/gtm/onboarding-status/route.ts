import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkGTMOnboarding } from '@/lib/gtm/onboarding-check'

/**
 * GET /api/gtm/onboarding-status
 *
 * Returns the current onboarding status for the logged-in user
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = await checkGTMOnboarding(userId)

    return NextResponse.json(status)
  } catch (error: any) {
    console.error('[GTM] Error checking onboarding status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check onboarding status' },
      { status: 500 }
    )
  }
}
