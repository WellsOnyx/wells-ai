// @ts-nocheck
/**
 * POST /api/companion/worker
 *
 * Trigger the background worker manually or via cron.
 * This endpoint can be called by Vercel Cron or manually for testing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  runBackgroundWorker,
  runForUser,
  getWorkerStatus,
} from '@/lib/companion/background-worker'

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

/**
 * POST - Trigger worker run
 *
 * Body options:
 * - { type: 'full' } - Run full worker for all users
 * - { type: 'user', userId: 'xxx' } - Run for specific user
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    const cronHeader = headersList.get('x-vercel-cron')

    // Allow requests from Vercel Cron or with correct secret
    const isVercelCron = cronHeader === '1'
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}` && CRON_SECRET

    if (!isVercelCron && !hasValidSecret) {
      // For development, allow requests without auth
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json().catch(() => ({ type: 'full' }))
    const { type, userId } = body

    let result: any

    if (type === 'user' && userId) {
      // Run for specific user
      result = await runForUser(userId)
      return NextResponse.json({
        success: true,
        type: 'user',
        userId,
        result,
      })
    } else {
      // Run full worker
      result = await runBackgroundWorker()
      return NextResponse.json({
        success: result.success,
        type: 'full',
        usersProcessed: result.usersProcessed,
        insightsGenerated: result.insightsGenerated,
        errorsCount: result.errors.length,
        errors: result.errors.slice(0, 10), // Return first 10 errors only
      })
    }
  } catch (error) {
    console.error('[API] Error running worker:', error)
    return NextResponse.json(
      { error: 'Failed to run worker', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET - Get worker status
 */
export async function GET(req: NextRequest) {
  try {
    const status = getWorkerStatus()

    return NextResponse.json({
      success: true,
      status: {
        ...status,
        lastRunAt: status.lastRunAt?.toISOString(),
        nextRunAt: status.nextRunAt?.toISOString(),
      },
    })
  } catch (error) {
    console.error('[API] Error getting worker status:', error)
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    )
  }
}
