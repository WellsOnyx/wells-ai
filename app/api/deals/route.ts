import { NextResponse } from 'next/server'
import { getDeals, getRFQs, getDashboardStats } from '@/lib/notion'

/**
 * GET /api/deals
 * Fetch all deals from Notion
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('stats') === 'true'

    const deals = await getDeals()

    if (includeStats) {
      const stats = await getDashboardStats()
      return NextResponse.json({
        success: true,
        deals,
        stats
      })
    }

    return NextResponse.json({
      success: true,
      deals
    })

  } catch (error: any) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}
