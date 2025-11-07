/**
 * Weekly Digest Cron Job
 *
 * GET /api/cron/weekly-digest
 *
 * Runs weekly on Monday at 8am to send digest notifications to sellers
 * who prefer weekly summaries of RFQ matches.
 *
 * Configure in vercel.json or similar:
 * {
 *   "crons": [{
 *     "path": "/api/cron/weekly-digest",
 *     "schedule": "0 8 * * 1"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyDigest } from '@/lib/seller-notifications'

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

    console.log('[Weekly Digest] Starting weekly digest job...')

    const result = await sendWeeklyDigest()

    console.log('[Weekly Digest] Completed:', result)

    return NextResponse.json({
      success: true,
      message: 'Weekly digest sent',
      stats: result
    })

  } catch (error: any) {
    console.error('[Weekly Digest] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
