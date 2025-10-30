/**
 * Admin Dashboard - Overview API
 * Unified dashboard data: RFQs, Quotes, Revenue, GTM Pipeline
 */

import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import twilio from 'twilio'

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export async function GET() {
  try {
    // Fetch data in parallel for speed
    const [rfqs, smsMessages, gtmMetrics] = await Promise.all([
      getRFQs(),
      getSMSMessages(),
      getGTMMetrics(),
    ])

    // Calculate revenue (33bps on closed deals)
    const revenue = calculateRevenue(rfqs)

    return NextResponse.json({
      success: true,
      data: {
        rfqs,
        sms: smsMessages,
        revenue,
        gtm: gtmMetrics,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[Admin API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Get RFQs from Notion
 */
async function getRFQs() {
  if (!process.env.NOTION_REQUESTS_DB) {
    return {
      total: 0,
      pending: 0,
      matched: 0,
      closed: 0,
      recent: [],
    }
  }

  try {
    const response = await (notion.databases as any).query({
      database_id: process.env.NOTION_REQUESTS_DB,
      sorts: [{ property: 'Created', direction: 'descending' }],
      page_size: 50,
    })

    const rfqs = response.results.map((page: any) => ({
      id: page.id,
      requestId: page.properties['Request ID']?.title?.[0]?.plain_text || 'N/A',
      buyer: page.properties['Buyer Name']?.rich_text?.[0]?.plain_text || 'Unknown',
      requirements: page.properties['Requirements']?.rich_text?.[0]?.plain_text || '',
      category: page.properties['Category']?.select?.name || 'Uncategorized',
      status: page.properties['Status']?.select?.name || 'New',
      created: page.created_time,
      amount: page.properties['Amount']?.number || 0,
    }))

    return {
      total: rfqs.length,
      pending: rfqs.filter((r: any) => r.status === 'Suppliers Notified').length,
      matched: rfqs.filter((r: any) => r.status === 'Matched').length,
      closed: rfqs.filter((r: any) => r.status === 'Closed Won').length,
      totalValue: rfqs.reduce((sum: number, r: any) => sum + r.amount, 0),
      recent: rfqs.slice(0, 10),
    }
  } catch (error) {
    console.error('[Admin API] Notion error:', error)
    return {
      total: 0,
      pending: 0,
      matched: 0,
      closed: 0,
      recent: [],
    }
  }
}

/**
 * Get SMS messages from Twilio
 */
async function getSMSMessages() {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    return {
      total: 0,
      sent: 0,
      received: 0,
      interested: 0,
      recent: [],
    }
  }

  try {
    const messages = await twilioClient.messages.list({
      limit: 100,
    })

    const sent = messages.filter(m => m.direction === 'outbound-api')
    const received = messages.filter(m => m.direction === 'inbound')
    const interested = received.filter(m => {
      const body = m.body.toLowerCase()
      return body.includes('1') || body.includes('interested') || body.includes('yes')
    })

    return {
      total: messages.length,
      sent: sent.length,
      received: received.length,
      interested: interested.length,
      replyRate: received.length > 0 ? Math.round((received.length / sent.length) * 100) : 0,
      interestRate: received.length > 0 ? Math.round((interested.length / received.length) * 100) : 0,
      recent: messages.slice(0, 10).map(m => ({
        sid: m.sid,
        from: m.from,
        to: m.to,
        body: m.body,
        direction: m.direction,
        status: m.status,
        date: m.dateCreated,
      })),
    }
  } catch (error) {
    console.error('[Admin API] Twilio error:', error)
    return {
      total: 0,
      sent: 0,
      received: 0,
      interested: 0,
      recent: [],
    }
  }
}

/**
 * Get GTM metrics from SDK
 */
async function getGTMMetrics() {
  // In production, this would query the Wells GTM SDK database
  // For now, return sample metrics
  return {
    prospects: {
      total: 10427,
      qualified: 3142,
      avgICPScore: 76,
    },
    outreach: {
      sent: 3000,
      opened: 1200,
      replied: 360,
      openRate: 40,
      replyRate: 12,
    },
    meetings: {
      booked: 45,
      held: 38,
      showRate: 84,
    },
    pipeline: {
      opportunities: 27,
      value: 6750000,
      avgDeal: 250000,
      forecast: 2362500,
    },
  }
}

/**
 * Calculate revenue (33bps on closed deals)
 */
function calculateRevenue(rfqs: any) {
  const closedDeals = rfqs.recent?.filter((r: any) => r.status === 'Closed Won') || []
  const totalClosedValue = closedDeals.reduce((sum: number, deal: any) => sum + deal.amount, 0)
  const wellsFee = totalClosedValue * 0.0033 // 33 basis points

  return {
    closedDeals: closedDeals.length,
    totalClosedValue,
    wellsFee: Math.round(wellsFee),
    basisPoints: 33,
    breakdown: closedDeals.map((deal: any) => ({
      id: deal.id,
      buyer: deal.buyer,
      amount: deal.amount,
      fee: Math.round(deal.amount * 0.0033),
    })),
  }
}
