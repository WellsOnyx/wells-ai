/**
 * Layer 3: Conversational ERP - Update Vendor Endpoint
 * POST /api/conversational/erp/update-vendor
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  ConversationalRequest,
  ConversationalResponse,
} from '../types'
import { createConversation } from '../services/state-machine'

export async function POST(request: NextRequest) {
  try {
    const body: ConversationalRequest = await request.json()

    if (!body.message || !body.accountId) {
      return NextResponse.json(
        { error: 'message and accountId are required' },
        { status: 400 }
      )
    }

    const sessionId = body.sessionId || crypto.randomUUID()
    const conversation = createConversation(sessionId, body.accountId, body.userId)

    // Prime with update_vendor intent
    const context = conversation.getContext()
    if (context.state === 'idle') {
      context.currentIntent = 'update_vendor'
    }

    const result = conversation.processInput(body.message)

    const response: ConversationalResponse = {
      message: result.response,
      sessionId,
      state: result.newState,
      intent: 'update_vendor',
      entities: conversation.getContext().entities,
      missingFields: result.missingFields,
      pendingAction: result.pendingAction,
      quickReplies: result.quickReplies || [
        'Update payment method',
        'Change contact info',
        'Update address',
      ],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Conversational update-vendor error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export { POST as updateVendor }
