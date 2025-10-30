/**
 * API Endpoint: Run Daily GTM Automation
 *
 * GET /api/gtm/automation/run
 *
 * Triggers the daily GTM automation for all practice groups
 * Called by cron job every 24 hours
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyGTMAutomation } from '@/lib/gtm/automation-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for long-running automation

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized runs
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🚀 Starting daily GTM automation...')
    const startTime = Date.now()

    // Run the automation
    const results = await runDailyGTMAutomation()

    const duration = Date.now() - startTime
    console.log(`✅ Automation complete in ${duration}ms`)

    // Return summary
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: duration,
      results: results.map(r => ({
        practiceGroup: r.practiceGroup,
        newContacts: r.newContactsProcessed,
        messagesSent: Object.values(r.messagesSent).reduce((a, b) => a + b, 0),
        responses: r.responsesReceived,
        meetings: r.meetingsBooked,
        deals: r.dealsProgressed + r.dealsClosed,
        revenue: r.revenue
      })),
      totals: {
        newContacts: results.reduce((sum, r) => sum + r.newContactsProcessed, 0),
        messagesSent: results.reduce((sum, r) => sum + Object.values(r.messagesSent).reduce((a, b) => a + b, 0), 0),
        responses: results.reduce((sum, r) => sum + r.responsesReceived, 0),
        meetings: results.reduce((sum, r) => sum + r.meetingsBooked, 0),
        deals: results.reduce((sum, r) => sum + r.dealsProgressed + r.dealsClosed, 0),
        revenue: results.reduce((sum, r) => sum + r.revenue, 0)
      }
    }

    return NextResponse.json(summary)

  } catch (error) {
    console.error('❌ Automation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Manual trigger endpoint (for testing)
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Manual automation trigger...')

    const results = await runDailyGTMAutomation()

    return NextResponse.json({
      success: true,
      message: 'Automation triggered manually',
      results
    })

  } catch (error) {
    console.error('❌ Manual trigger error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
