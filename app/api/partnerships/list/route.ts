import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { OPEN_CATEGORIES, ACTIVE_PARTNERSHIPS } from '@/lib/categories'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * List all Category Pioneer partnerships
 * Supports filtering by status
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'open', 'live', 'all'

    if (!process.env.NOTION_PARTNERSHIPS_DB) {
      // Return mock data when Notion not configured
      return NextResponse.json({
        success: true,
        openCategories: OPEN_CATEGORIES,
        activePartnerships: ACTIVE_PARTNERSHIPS,
        source: 'static'
      })
    }

    // Fetch all partnerships
    // TODO: Fix Notion SDK
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: process.env.NOTION_PARTNERSHIPS_DB,
    //   sorts: [
    //     { property: 'Created Date', direction: 'descending' }
    //   ]
    // })

    const partnerships = response.results.map((page: any) => {
      const props = page.properties

      return {
        id: page.id,
        company: props['Pioneer Company']?.rich_text?.[0]?.plain_text || '',
        category: props['Category Name']?.select?.name || '',
        categorySlug: props['Category Slug']?.rich_text?.[0]?.plain_text || '',
        tier: props['Partnership Tier']?.select?.name || '',
        revenueShare: props['Revenue Share %']?.number || 0,
        status: props['Status']?.select?.name || '',
        marketSize: props['Market Size']?.rich_text?.[0]?.plain_text || '',
        totalRevenue: props['Total Category Revenue']?.number || 0,
        wellsAIFee: props['Total Category Revenue']?.number
          ? props['Total Category Revenue'].number * 0.0033
          : 0,
        partnerShare: props['Total Category Revenue']?.number && props['Revenue Share %']?.number
          ? props['Total Category Revenue'].number * 0.0033 * props['Revenue Share %'].number
          : 0,
        dealCount: props['Deal Count']?.rollup?.number || 0,
        goLiveDate: props['Go-Live Date']?.date?.start || null,
        contactName: props['Contact Name']?.rich_text?.[0]?.plain_text || '',
        contactEmail: props['Contact Email']?.email || '',
        createdDate: props['Created Date']?.created_time || page.created_time
      }
    })

    // Filter by status if requested
    let filtered = partnerships
    if (status === 'live') {
      filtered = partnerships.filter(p => p.status === '✅ Live')
    } else if (status === 'open') {
      filtered = partnerships.filter(p =>
        p.status === '🟢 Open' || p.status === '🟡 In Negotiation'
      )
    }

    // Separate into categories
    const live = partnerships.filter(p => p.status === '✅ Live')
    const inNegotiation = partnerships.filter(p => p.status === '🟡 In Negotiation')
    const open = partnerships.filter(p => p.status === '🟢 Open')

    // Calculate totals
    const totalMarketSize = live.reduce((sum, p) => {
      const sizeStr = p.marketSize.replace(/[^0-9.]/g, '')
      return sum + (parseFloat(sizeStr) || 0)
    }, 0)

    const totalRevenue = live.reduce((sum, p) => sum + p.totalRevenue, 0)
    const totalPartnerShare = live.reduce((sum, p) => sum + p.partnerShare, 0)

    return NextResponse.json({
      success: true,
      partnerships: filtered,
      stats: {
        totalPartnerships: partnerships.length,
        livePartnerships: live.length,
        inNegotiation: inNegotiation.length,
        openCategories: open.length,
        totalMarketSize: `$${totalMarketSize.toFixed(1)}B`,
        totalRevenue,
        totalPartnerShare
      },
      source: 'notion'
    })

  } catch (error: any) {
    console.error('Partnership list error:', error)

    // Fallback to static data on error
    return NextResponse.json({
      success: true,
      openCategories: OPEN_CATEGORIES,
      activePartnerships: ACTIVE_PARTNERSHIPS,
      source: 'static_fallback',
      error: error.message
    })
  }
}
