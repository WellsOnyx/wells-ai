/**
 * GET /api/playbooks/actions
 * Get all playbook actions (queued + historical)
 */

import { NextResponse } from 'next/server'
import { getQueuedActions, getActionHistory, getQueueStats } from '@/lib/queue'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId') || undefined
    const includeHistory = searchParams.get('includeHistory') === 'true'

    const queued = getQueuedActions(supplierId)
    const history = includeHistory ? getActionHistory(supplierId) : []
    const stats = getQueueStats()

    return NextResponse.json({
      success: true,
      queued,
      history,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch playbook actions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch playbook actions' },
      { status: 500 }
    )
  }
}
