import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { generateATSLinkToken } from '@/lib/merge/ats'

/**
 * POST /api/ats/connect
 *
 * Generate Merge.dev Link Token for ATS/HRIS connection
 * This enables companies to connect their ATS (Greenhouse, Lever, etc.)
 * or HRIS (BambooHR, Workday, etc.) to Wells AI
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { companyName, email } = body

    if (!companyName || !email) {
      return NextResponse.json(
        { error: 'Company name and email required' },
        { status: 400 }
      )
    }

    // Generate Merge.dev Link Token
    const linkToken = await generateATSLinkToken({
      customerId: orgId,
      customerEmail: email,
      companyName: companyName,
    })

    console.log('[ATS] Generated link token for:', companyName)

    return NextResponse.json({
      linkToken,
      message: 'Link token generated successfully',
    })
  } catch (error: any) {
    console.error('[ATS] Connect error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate link token' },
      { status: 500 }
    )
  }
}
