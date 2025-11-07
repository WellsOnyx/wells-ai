/**
 * Daily Digest Cron Job
 *
 * GET /api/cron/daily-digest
 *
 * Runs daily at 8am to send digest notifications to sellers
 * who prefer daily summaries of RFQ matches.
 *
 * Configure in vercel.json or similar:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-digest",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendDailyDigest } from '@/lib/seller-notifications'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Daily Digest] Starting daily digest job...')

    const result = await sendDailyDigest()

    console.log('[Daily Digest] Completed:', result)

    return NextResponse.json({
      success: true,
      message: 'Daily digest sent',
      stats: result
    })

  } catch (error: any) {
    console.error('[Daily Digest] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
