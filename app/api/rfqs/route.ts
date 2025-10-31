import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRFQs, getRFQById } from '@/lib/notion'

/**
 * GET /api/rfqs
 * Fetch RFQs from Notion - Organization-scoped
 *
 * Query params:
 * - id: Get specific RFQ by ID
 * - orgId: Filter RFQs by organization ID
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const orgId = searchParams.get('orgId')

    // Get specific RFQ by ID
    if (id) {
      const rfq = await getRFQById(id)
      if (!rfq) {
        return NextResponse.json(
          { success: false, error: 'RFQ not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, rfq })
    }

    // Get RFQs with optional organization filter
    const rfqs = await getRFQs(50, orgId || undefined)

    return NextResponse.json({
      success: true,
      rfqs,
      count: rfqs.length,
      organizationId: orgId || null
    })

  } catch (error: any) {
    console.error('Error fetching RFQs:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch RFQs' },
      { status: 500 }
    )
  }
}
