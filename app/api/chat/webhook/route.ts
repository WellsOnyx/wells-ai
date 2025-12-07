// @ts-nocheck
/**
 * UNIVERSAL CHAT WEBHOOK
 *
 * Handles incoming messages from all chat platforms.
 * POST /api/chat/webhook
 *
 * Supports: Slack, Teams, Discord, WhatsApp, SMS, Web Widget
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// Main webhook handler
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      platform,
      workspace_id,
      user_id,
      channel_id,
      thread_ts,
      message,
      metadata
    } = body

    // Validate required fields
    if (!platform || !workspace_id || !user_id || !message) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['platform', 'workspace_id', 'user_id', 'message']
      }, { status: 400 })
    }

    // Get or verify workspace
    const workspaceResult = await sql`
      SELECT * FROM chat_workspaces
      WHERE external_workspace_id = ${workspace_id}
      AND platform = ${platform}
      AND status = 'active'
    `

    if (workspaceResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Workspace not found or inactive',
        hint: 'Connect workspace using POST /api/chat/workspace'
      }, { status: 404 })
    }

    const workspace = workspaceResult.rows[0]

    // Process the message using our database function
    const result = await sql`
      SELECT * FROM process_chat_message(
        ${workspace.id}::UUID,
        ${user_id},
        ${channel_id || 'direct'},
        ${message},
        ${thread_ts || null}
      )
    `

    const processed = result.rows[0]

    // Get or generate response
    let response = processed.response_text
    let buttons = processed.response_buttons

    // If intent requires action, handle it
    const actionResult = await handleIntent(
      processed.detected_intent,
      processed.entities,
      workspace,
      user_id,
      processed.conversation_id
    )

    if (actionResult) {
      response = actionResult.response || response
      buttons = actionResult.buttons || buttons
    }

    // Update workspace stats
    await sql`
      UPDATE chat_workspaces
      SET messages_processed = messages_processed + 1,
          last_activity_at = NOW()
      WHERE id = ${workspace.id}::UUID
    `

    // Store outbound message
    await sql`
      INSERT INTO chat_messages (
        conversation_id, direction, content, generated_by
      ) VALUES (
        ${processed.conversation_id}::UUID,
        'outbound',
        ${response},
        'ai'
      )
    `

    return NextResponse.json({
      success: true,
      message_id: processed.message_id,
      conversation_id: processed.conversation_id,
      intent: {
        detected: processed.detected_intent,
        confidence: parseFloat(processed.confidence)
      },
      entities: processed.entities,
      response: {
        text: response,
        buttons: buttons
      },
      action: actionResult?.action || null
    })
  } catch (error) {
    console.error('Chat webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    )
  }
}

// Intent handlers
async function handleIntent(
  intent: string,
  entities: any,
  workspace: any,
  userId: string,
  conversationId: string
) {
  switch (intent) {
    case 'search_products':
      return await handleProductSearch(entities, workspace.customer_id)

    case 'create_order':
      return await handleCreateOrder(entities, workspace, userId, conversationId)

    case 'order_status':
      return await handleOrderStatus(entities, workspace.customer_id)

    case 'grain_balance':
      return await handleGrainBalance(userId, workspace.customer_id)

    case 'spend_analytics':
      return await handleSpendAnalytics(workspace.customer_id)

    case 'reorder':
      return await handleReorder(entities, workspace, userId, conversationId)

    case 'approve_order':
      return await handleApproval(entities, userId, true)

    case 'reject_order':
      return await handleApproval(entities, userId, false)

    default:
      return null
  }
}

// Product search handler
async function handleProductSearch(entities: any, customerId: string) {
  const quantities = entities?.quantities || []
  const skus = entities?.mentioned_sku || []

  // Search in supplier catalog
  const products = await sql`
    SELECT
      sc.id,
      sc.sku,
      sc.description,
      sc.unit_price,
      sc.unit_of_measure,
      sn.company_name as supplier_name
    FROM supplier_catalog sc
    JOIN supplier_network sn ON sc.supplier_id = sn.id
    WHERE sc.is_active = true
    LIMIT 5
  `

  if (products.rows.length === 0) {
    return {
      response: "I couldn't find any products matching your search. Try being more specific or ask for help.",
      action: 'no_results'
    }
  }

  const productList = products.rows.map(p =>
    `• ${p.description} (${p.sku}) - $${parseFloat(p.unit_price).toFixed(2)}/${p.unit_of_measure}`
  ).join('\n')

  return {
    response: `Found some products:\n\n${productList}\n\nWould you like to add any of these to your cart?`,
    buttons: [
      { text: '🛒 Add to Cart', action: 'add_to_cart' },
      { text: '🔍 Search More', action: 'search_more' }
    ],
    action: 'products_found'
  }
}

// Create order handler
async function handleCreateOrder(entities: any, workspace: any, userId: string, conversationId: string) {
  // Check if user can create orders
  const userResult = await sql`
    SELECT * FROM chat_users
    WHERE workspace_id = ${workspace.id}::UUID
    AND external_user_id = ${userId}
  `

  const user = userResult.rows[0]
  if (!user?.can_create_orders) {
    return {
      response: "Sorry, you don't have permission to create orders. Contact your administrator.",
      action: 'permission_denied'
    }
  }

  // Create draft order
  const orderResult = await sql`
    INSERT INTO chat_orders (
      conversation_id,
      user_id,
      status,
      created_via_intent
    ) VALUES (
      ${conversationId}::UUID,
      ${user.id}::UUID,
      'draft',
      'create_order'
    )
    RETURNING *
  `

  const order = orderResult.rows[0]

  return {
    response: "I've started a new order for you. What would you like to add?\n\nYou can say things like:\n• \"500 boxes of latex gloves\"\n• \"Add SKU-12345\"\n• \"Show me office supplies\"",
    buttons: [
      { text: '🔍 Search Products', action: 'search_products' },
      { text: '📋 View Recent Orders', action: 'recent_orders' }
    ],
    action: 'order_started',
    orderId: order.id
  }
}

// Order status handler
async function handleOrderStatus(entities: any, customerId: string) {
  const skus = entities?.mentioned_sku || []
  const poMatch = skus.find(s => s?.toLowerCase().includes('po'))

  // Get recent orders
  const orders = await sql`
    SELECT
      io.id,
      io.customer_po,
      io.status,
      io.customer_total,
      io.created_at
    FROM intercept_orders io
    WHERE io.customer_id = ${customerId}::UUID
    ORDER BY io.created_at DESC
    LIMIT 5
  `

  if (orders.rows.length === 0) {
    return {
      response: "I couldn't find any orders for your account. Would you like to place a new order?",
      action: 'no_orders'
    }
  }

  const orderList = orders.rows.map(o =>
    `📦 ${o.customer_po || o.id.slice(0, 8)} - ${o.status} - $${parseFloat(o.customer_total || 0).toFixed(2)}`
  ).join('\n')

  return {
    response: `Here are your recent orders:\n\n${orderList}\n\nWould you like more details on any of these?`,
    buttons: [
      { text: '📦 Track Shipment', action: 'track_shipment' },
      { text: '🔄 Reorder', action: 'reorder' }
    ],
    action: 'orders_listed'
  }
}

// GRAIN balance handler
async function handleGrainBalance(userId: string, customerId: string) {
  // Get GRAIN balance from ledger
  const grainResult = await sql`
    SELECT
      SUM(CASE WHEN type = 'credit' THEN quantity ELSE -quantity END) as balance
    FROM grain_ledger
    WHERE customer_id = ${customerId}::UUID
  `

  const balance = parseFloat(grainResult.rows[0]?.balance || 0)
  const grainPrice = 1.0 // Placeholder

  return {
    response: `🌾 **Your GRAIN Balance**\n\n**Balance:** ${balance.toFixed(2)} GRAIN\n**Value:** $${(balance * grainPrice).toFixed(2)}\n\nGRAIN appreciates as our hard asset portfolio grows. Every purchase earns more GRAIN!`,
    buttons: [
      { text: '📊 View History', action: 'grain_history' },
      { text: '❓ How GRAIN Works', action: 'explain_grain' }
    ],
    action: 'grain_balance_shown'
  }
}

// Spend analytics handler
async function handleSpendAnalytics(customerId: string) {
  const spendResult = await sql`
    SELECT
      COUNT(*) as order_count,
      SUM(customer_total) as total_spend,
      AVG(gross_margin) as avg_margin
    FROM intercept_orders
    WHERE customer_id = ${customerId}::UUID
    AND created_at > NOW() - INTERVAL '30 days'
  `

  const stats = spendResult.rows[0]

  return {
    response: `📊 **Last 30 Days**\n\n**Orders:** ${stats.order_count || 0}\n**Total Spend:** $${parseFloat(stats.total_spend || 0).toFixed(2)}\n**Avg Savings:** $${parseFloat(stats.avg_margin || 0).toFixed(2)}\n\nWant a detailed breakdown by category?`,
    buttons: [
      { text: '📈 By Category', action: 'spend_by_category' },
      { text: '📅 By Month', action: 'spend_by_month' }
    ],
    action: 'analytics_shown'
  }
}

// Reorder handler
async function handleReorder(entities: any, workspace: any, userId: string, conversationId: string) {
  // Get last order
  const lastOrder = await sql`
    SELECT
      io.*,
      json_agg(json_build_object(
        'sku', iol.product_sku,
        'description', iol.description,
        'quantity', iol.quantity,
        'price', iol.unit_price
      )) as items
    FROM intercept_orders io
    LEFT JOIN intercept_order_lines iol ON io.id = iol.order_id
    WHERE io.customer_id = ${workspace.customer_id}::UUID
    GROUP BY io.id
    ORDER BY io.created_at DESC
    LIMIT 1
  `

  if (lastOrder.rows.length === 0) {
    return {
      response: "I couldn't find any previous orders to reorder. Would you like to start a new order?",
      action: 'no_previous_orders'
    }
  }

  const order = lastOrder.rows[0]
  const items = order.items || []

  const itemList = items.slice(0, 5).map(i =>
    `• ${i.quantity}x ${i.description} - $${parseFloat(i.price).toFixed(2)}`
  ).join('\n')

  return {
    response: `📋 **Last Order (${order.customer_po || order.id.slice(0, 8)})**\n\n${itemList}\n\n**Total:** $${parseFloat(order.customer_total || 0).toFixed(2)}\n\nWould you like to reorder the same items?`,
    buttons: [
      { text: '✅ Reorder All', action: 'confirm_reorder' },
      { text: '✏️ Modify', action: 'modify_reorder' },
      { text: '❌ Cancel', action: 'cancel' }
    ],
    action: 'reorder_preview'
  }
}

// Approval handler
async function handleApproval(entities: any, userId: string, approve: boolean) {
  const action = approve ? 'approved' : 'rejected'

  return {
    response: approve
      ? "✅ Order approved! It's been submitted for processing."
      : "❌ Order rejected. The requester has been notified.",
    action: `order_${action}`
  }
}

// GET: Conversation history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversation_id = searchParams.get('conversation_id')
    const workspace_id = searchParams.get('workspace_id')
    const user_id = searchParams.get('user_id')

    if (conversation_id) {
      // Get specific conversation
      const messages = await sql`
        SELECT
          cm.*,
          cc.context
        FROM chat_messages cm
        JOIN chat_conversations cc ON cm.conversation_id = cc.id
        WHERE cm.conversation_id = ${conversation_id}::UUID
        ORDER BY cm.sent_at ASC
      `

      return NextResponse.json({
        conversation_id,
        messages: messages.rows.map(m => ({
          id: m.id,
          direction: m.direction,
          content: m.content,
          intent: m.intent,
          confidence: parseFloat(m.intent_confidence || 0),
          entities: m.entities,
          sent_at: m.sent_at
        })),
        context: messages.rows[0]?.context || {}
      })
    }

    // List recent conversations
    if (workspace_id) {
      const convs = await sql`
        SELECT
          cc.*,
          cu.external_username,
          (SELECT content FROM chat_messages WHERE conversation_id = cc.id ORDER BY sent_at DESC LIMIT 1) as last_message
        FROM chat_conversations cc
        JOIN chat_users cu ON cc.user_id = cu.id
        JOIN chat_workspaces cw ON cc.workspace_id = cw.id
        WHERE cw.external_workspace_id = ${workspace_id}
        ORDER BY cc.last_message_at DESC
        LIMIT 20
      `

      return NextResponse.json({
        conversations: convs.rows.map(c => ({
          id: c.id,
          user: c.external_username,
          state: c.state,
          last_message: c.last_message,
          last_activity: c.last_message_at,
          started_at: c.started_at
        }))
      })
    }

    return NextResponse.json({ error: 'conversation_id or workspace_id required' }, { status: 400 })
  } catch (error) {
    console.error('Conversation fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: error.message },
      { status: 500 }
    )
  }
}
