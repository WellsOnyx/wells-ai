/**
 * GET /api/consent/pending
 * Get all pending actions awaiting consent approval
 */

import { NextResponse } from 'next/server'
import { getPendingActions } from '@/lib/consent'

export async function GET() {
  try {
    const pendingActions = getPendingActions()

    return NextResponse.json({
      success: true,
      count: pendingActions.length,
      actions: pendingActions
    })
  } catch (error) {
    console.error('Failed to fetch pending actions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending actions' },
      { status: 500 }
    )
  }
}
