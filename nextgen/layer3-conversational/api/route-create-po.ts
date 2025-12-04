// @ts-nocheck
/**
 * Layer 3: Conversational ERP - Create PO Endpoint
 * POST /api/conversational/erp/create-po
 *
 * Conversationally create a purchase order with field inference and validation
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  ConversationalRequest,
  ConversationalResponse,
  ExtractedEntities,
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

    // Force the intent to create_po
    const context = conversation.getContext()
    if (context.state === 'idle') {
      // Prime with create_po intent
      context.currentIntent = 'create_po'
    }

    // Process the message
    const result = conversation.processInput(body.message)

    // Build response
    const response: ConversationalResponse = {
      message: result.response,
      sessionId,
      state: result.newState,
      intent: 'create_po',
      entities: conversation.getContext().entities,
      missingFields: result.missingFields,
      pendingAction: result.pendingAction,
      quickReplies: result.quickReplies,
      suggestedActions: [
        {
          label: 'Add line item',
          intent: 'create_po',
          entities: {},
        },
        {
          label: 'Change vendor',
          intent: 'create_po',
          entities: {},
        },
      ],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Conversational create-po error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// Auto-suggest fields based on partial input
export async function suggestFields(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const field = searchParams.get('field')
    const query = searchParams.get('query') || ''
    const accountId = searchParams.get('accountId')

    const suggestions: Record<string, string[]> = {
      vendor: [
        'Acme Industrial Supplies',
        'TechSolutions Inc',
        'Global Freight Co',
        'Office Essentials LLC',
      ],
      paymentTerms: [
        'Net 30',
        'Net 60',
        '2/10 Net 30',
        'Due on Receipt',
      ],
      costCenter: [
        'CC-100 Operations',
        'CC-200 Engineering',
        'CC-300 Sales',
        'CC-400 Admin',
      ],
      department: [
        'Engineering',
        'Operations',
        'Sales',
        'Marketing',
        'Finance',
        'HR',
      ],
      unitOfMeasure: [
        'EA (Each)',
        'CS (Case)',
        'BX (Box)',
        'HR (Hour)',
        'MO (Month)',
      ],
    }

    let fieldSuggestions = suggestions[field || ''] || []

    // Filter by query
    if (query) {
      const queryLower = query.toLowerCase()
      fieldSuggestions = fieldSuggestions.filter(s =>
        s.toLowerCase().includes(queryLower)
      )
    }

    return NextResponse.json({
      field,
      suggestions: fieldSuggestions.slice(0, 5),
    })
  } catch (error) {
    console.error('Field suggestions error:', error)
    return NextResponse.json({ suggestions: [] })
  }
}

// Validate line item data
export async function validateLineItem(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, quantity, unitPrice } = body

    const errors: string[] = []
    const warnings: string[] = []

    if (!description || description.trim().length < 3) {
      errors.push('Description must be at least 3 characters')
    }

    if (!quantity || quantity <= 0) {
      errors.push('Quantity must be greater than 0')
    }

    if (!unitPrice || unitPrice <= 0) {
      errors.push('Unit price must be greater than 0')
    }

    // Business rule warnings
    if (quantity > 1000) {
      warnings.push('Large quantity - may require additional approval')
    }

    if (unitPrice > 10000) {
      warnings.push('High unit price - please verify')
    }

    const lineTotal = (quantity || 0) * (unitPrice || 0)

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings,
      lineTotal,
      suggestedAccountCode: inferAccountCode(description),
    })
  } catch (error) {
    console.error('Validate line item error:', error)
    return NextResponse.json(
      { valid: false, errors: ['Validation failed'] },
      { status: 500 }
    )
  }
}

function inferAccountCode(description: string): string {
  const descLower = description.toLowerCase()

  if (descLower.includes('software') || descLower.includes('license')) {
    return '6100 - Software & Licenses'
  }
  if (descLower.includes('hardware') || descLower.includes('computer') || descLower.includes('server')) {
    return '1500 - Computer Equipment'
  }
  if (descLower.includes('office') || descLower.includes('supplies')) {
    return '6200 - Office Supplies'
  }
  if (descLower.includes('service') || descLower.includes('consulting')) {
    return '6300 - Professional Services'
  }
  if (descLower.includes('shipping') || descLower.includes('freight')) {
    return '6400 - Freight & Shipping'
  }

  return '5000 - General Expenses'
}

export { POST as createPO, suggestFields, validateLineItem }
