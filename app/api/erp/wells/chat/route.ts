// @ts-nocheck
/**
 * WellsAI Conversational ERP - Chat API
 *
 * Natural language interface for ERP operations.
 * Users manage their entire business through conversation.
 *
 * POST /api/erp/wells/chat
 * Body: { message: string, conversationId?: string }
 *
 * @example
 * // Create invoice
 * { "message": "Create an invoice for Acme Corp for $5000 for consulting services" }
 *
 * // Check status
 * { "message": "What invoices are overdue?" }
 *
 * // Add vendor
 * { "message": "Add a new vendor called TechSupply, contact is john@techsupply.com" }
 *
 * // Generate report
 * { "message": "Generate a cash flow report for this month" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getWellsERP } from '@/lib/erp/wells-erp'
import { handleERPCommand } from '@/lib/wells-erp'

// ============================================================================
// POST - Process natural language ERP command
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationId, userId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get user ID from body or session (in production, use auth)
    const effectiveUserId = userId || 'default-user'

    // Get or create ERP instance for user
    const erp = getWellsERP(effectiveUserId)

    // Process the chat message
    const result = await erp.chat(message, conversationId)

    // Store conversation in database
    const convId = result.conversationId
    await storeConversation(effectiveUserId, convId, message, result.response, result.actions)

    return NextResponse.json({
      success: true,
      response: result.response,
      conversationId: convId,
      actions: result.actions.map(a => ({
        tool: a.tool,
        success: !('error' in (a.result as object)),
      })),
      // Include any created entities for UI updates
      entities: extractEntities(result.actions),
    })
  } catch (error) {
    console.error('ERP Chat error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process request',
        success: false,
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get conversation history
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || 'default-user'
    const conversationId = searchParams.get('conversationId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (conversationId) {
      // Get specific conversation
      const messages = await sql`
        SELECT * FROM wells_erp_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `

      const conversation = await sql`
        SELECT * FROM wells_erp_conversations
        WHERE id = ${conversationId}
        LIMIT 1
      `

      return NextResponse.json({
        conversation: conversation.rows[0] || null,
        messages: messages.rows,
      })
    }

    // List recent conversations
    const conversations = await sql`
      SELECT
        c.*,
        (SELECT content FROM wells_erp_messages WHERE conversation_id = c.id ORDER BY created_at ASC LIMIT 1) as first_message
      FROM wells_erp_conversations c
      WHERE c.user_id = ${userId}
        AND c.status = 'active'
      ORDER BY c.last_message_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json({
      conversations: conversations.rows,
    })
  } catch (error) {
    console.error('ERP Chat GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function storeConversation(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  actions: Array<{ tool: string; result: unknown }>
): Promise<void> {
  try {
    // Ensure conversation exists
    await sql`
      INSERT INTO wells_erp_conversations (
        id, user_id, status, started_at, last_message_at, message_count, created_at, updated_at
      ) VALUES (
        ${conversationId}, ${userId}, 'active', NOW(), NOW(), 0, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        last_message_at = NOW(),
        updated_at = NOW()
    `

    // Store user message
    const userMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    await sql`
      INSERT INTO wells_erp_messages (
        id, conversation_id, user_id, role, content, created_at
      ) VALUES (
        ${userMsgId}, ${conversationId}, ${userId}, 'user', ${userMessage}, NOW()
      )
    `

    // Store assistant response with tool usage
    const assistantMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const toolsUsed = actions.map(a => a.tool)
    const toolResults = actions.map(a => ({
      tool: a.tool,
      result: a.result,
    }))

    // Extract entities created
    const entitiesCreated = actions
      .filter(a => a.tool.includes('create') || a.tool.includes('add'))
      .map(a => ({
        type: a.tool.replace('create_', '').replace('add_', ''),
        id: (a.result as { id?: string })?.id,
      }))
      .filter(e => e.id)

    await sql`
      INSERT INTO wells_erp_messages (
        id, conversation_id, user_id, role, content,
        tools_used, tool_results, entities_created, created_at
      ) VALUES (
        ${assistantMsgId}, ${conversationId}, ${userId}, 'assistant', ${assistantResponse},
        ${toolsUsed}, ${JSON.stringify(toolResults)}, ${JSON.stringify(entitiesCreated)}, NOW()
      )
    `

    // Update conversation with related entities
    if (entitiesCreated.length > 0) {
      const invoiceIds = entitiesCreated.filter(e => e.type === 'invoice').map(e => e.id)
      const poIds = entitiesCreated.filter(e => e.type === 'po').map(e => e.id)
      const vendorIds = entitiesCreated.filter(e => e.type === 'vendor').map(e => e.id)

      if (invoiceIds.length > 0) {
        await sql`
          UPDATE wells_erp_conversations
          SET related_invoices = array_cat(related_invoices, ${invoiceIds}::text[])
          WHERE id = ${conversationId}
        `
      }
      if (poIds.length > 0) {
        await sql`
          UPDATE wells_erp_conversations
          SET related_pos = array_cat(related_pos, ${poIds}::text[])
          WHERE id = ${conversationId}
        `
      }
      if (vendorIds.length > 0) {
        await sql`
          UPDATE wells_erp_conversations
          SET related_vendors = array_cat(related_vendors, ${vendorIds}::text[])
          WHERE id = ${conversationId}
        `
      }
    }
  } catch (error) {
    // Log but don't fail the request if conversation storage fails
    console.error('Failed to store conversation:', error)
  }
}

function extractEntities(actions: Array<{ tool: string; result: unknown }>): {
  invoices?: unknown[]
  purchaseOrders?: unknown[]
  vendors?: unknown[]
  inventory?: unknown[]
} {
  const entities: {
    invoices?: unknown[]
    purchaseOrders?: unknown[]
    vendors?: unknown[]
    inventory?: unknown[]
  } = {}

  for (const action of actions) {
    const result = action.result

    if (action.tool.includes('invoice')) {
      if (!entities.invoices) entities.invoices = []
      if (Array.isArray(result)) {
        entities.invoices.push(...result)
      } else if (result && typeof result === 'object') {
        entities.invoices.push(result)
      }
    }

    if (action.tool.includes('po') || action.tool.includes('purchase')) {
      if (!entities.purchaseOrders) entities.purchaseOrders = []
      if (Array.isArray(result)) {
        entities.purchaseOrders.push(...result)
      } else if (result && typeof result === 'object') {
        entities.purchaseOrders.push(result)
      }
    }

    if (action.tool.includes('vendor') || action.tool.includes('contact')) {
      if (!entities.vendors) entities.vendors = []
      if (Array.isArray(result)) {
        entities.vendors.push(...result)
      } else if (result && typeof result === 'object') {
        entities.vendors.push(result)
      }
    }

    if (action.tool.includes('inventory') || action.tool.includes('item')) {
      if (!entities.inventory) entities.inventory = []
      if (Array.isArray(result)) {
        entities.inventory.push(...result)
      } else if (result && typeof result === 'object') {
        entities.inventory.push(result)
      }
    }
  }

  return entities
}
