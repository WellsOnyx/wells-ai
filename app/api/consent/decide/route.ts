/**
 * POST /api/consent/decide
 * Process a consent decision (approve/reject) for a pending action
 */

import { NextResponse } from 'next/server'
import { decide, getAction } from '@/lib/consent'
import { withValidation } from '@/lib/validation'
import { consentDecideSchema } from '@/lib/schemas'

export const POST = withValidation(consentDecideSchema, async (request) => {
  try {
    const { actionId, decision, decidedBy, reason } = request.validatedBody

    // Check if action exists
    const action = getAction(actionId)
    if (!action) {
      return NextResponse.json(
        { error: `Action ${actionId} not found or already processed` },
        { status: 404 }
      )
    }

    // Process decision
    const decisionRecord = await decide(
      actionId,
      decision,
      decidedBy || 'user',
      reason
    )

    return NextResponse.json({
      success: true,
      decision: decisionRecord,
      action: {
        actionId: action.actionId,
        actionType: action.actionType,
        title: action.title,
        status: action.status
      }
    })
  } catch (error) {
    console.error('Consent decision error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process consent decision' },
      { status: 500 }
    )
  }
})
