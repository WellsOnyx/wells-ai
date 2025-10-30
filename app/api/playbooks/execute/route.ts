/**
 * POST /api/playbooks/execute
 * Execute a playbook action (after consent approval)
 */

import { NextRequest, NextResponse } from 'next/server'
import { executePlaybookAction } from '@/lib/playbooks'
import { updateActionStatus } from '@/lib/queue'
import { ActionStatus } from '@/lib/playbooks/types'

export async function POST(request: NextRequest) {
  try {
    const { actionId } = await request.json()

    if (!actionId) {
      return NextResponse.json(
        { error: 'Missing actionId' },
        { status: 400 }
      )
    }

    // Execute playbook
    await executePlaybookAction(actionId)

    return NextResponse.json({
      success: true,
      actionId,
      status: ActionStatus.Submitted
    })
  } catch (error) {
    console.error('Failed to execute playbook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute playbook' },
      { status: 500 }
    )
  }
}
