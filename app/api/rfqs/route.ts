import { NextResponse } from 'next/server'
import { getRFQs, getRFQById } from '@/lib/notion'

/**
 * GET /api/rfqs
 * Fetch all RFQs from Notion
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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

    const rfqs = await getRFQs()

    return NextResponse.json({
      success: true,
      rfqs
    })

  } catch (error: any) {
    console.error('Error fetching RFQs:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch RFQs' },
      { status: 500 }
    )
  }
}
