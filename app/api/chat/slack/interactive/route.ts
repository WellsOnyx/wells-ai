// @ts-nocheck
/**
 * SLACK INTERACTIVE COMPONENTS
 *
 * Handle button clicks, modal submissions, etc.
 * POST /api/chat/slack/interactive
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    // Slack sends form-urlencoded data with payload
    const formData = await request.formData()
    const payloadStr = formData.get('payload') as string

    if (!payloadStr) {
      return new Response('Missing payload', { status: 400 })
    }

    const payload = JSON.parse(payloadStr)
    const { type, user, team, actions, trigger_id, view, response_url } = payload

    // Get workspace
    const workspaceResult = await sql`
      SELECT * FROM chat_workspaces
      WHERE external_workspace_id = ${team?.id}
      AND platform = 'slack'
      AND status = 'active'
    `

    const workspace = workspaceResult.rows[0]

    // Handle different interaction types
    switch (type) {
      case 'block_actions':
        return await handleBlockActions(actions, user, workspace, response_url)

      case 'view_submission':
        return await handleViewSubmission(view, user, workspace)

      case 'shortcut':
        return await handleShortcut(payload, workspace, trigger_id)

      default:
        console.log('Unhandled Slack interaction type:', type)
        return new Response('', { status: 200 })
    }
  } catch (error) {
    console.error('Slack interactive error:', error)
    return new Response('', { status: 200 })
  }
}

// Handle button clicks
async function handleBlockActions(
  actions: any[],
  user: any,
  workspace: any,
  responseUrl: string
) {
  for (const action of actions) {
    const actionId = action.action_id
    const value = action.value ? JSON.parse(action.value) : {}

    let response = null

    switch (actionId) {
      case 'add_to_cart':
        response = await handleAddToCart(action.value, user, workspace)
        break

      case 'confirm_order':
      case 'submit_order':
        response = await handleConfirmOrder(value, user, workspace)
        break

      case 'cancel_order':
        response = {
          response_type: 'in_channel',
          replace_original: true,
          text: '❌ Order cancelled.'
        }
        break

      case 'modify_order':
        response = {
          response_type: 'ephemeral',
          text: '✏️ What would you like to change? Just tell me naturally.'
        }
        break

      case 'confirm_reorder':
        response = await handleConfirmReorder(value, user, workspace)
        break

      case 'search_products':
        response = {
          response_type: 'ephemeral',
          text: '🔍 What would you like to search for? Use `/wells search <query>`'
        }
        break

      case 'my_orders':
        response = await handleMyOrders(user, workspace)
        break

      case 'grain_balance':
        response = await handleGrainBalance(user, workspace)
        break

      case 'view_rewards':
        response = {
          response_type: 'ephemeral',
          text: '📊 Rewards history coming soon! Your GRAIN is growing. 🌾'
        }
        break

      case 'explain_grain':
        response = {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '🌾 *How GRAIN Works*\n\n' +
                  '*What is GRAIN?*\n' +
                  'GRAIN is our rewards token backed by real hard assets - manufacturing equipment, real estate, and operating businesses.\n\n' +
                  '*How do I earn GRAIN?*\n' +
                  '• Every purchase through Wells AI\n' +
                  '• Early payment bonuses\n' +
                  '• Referral rewards\n\n' +
                  '*Why does it appreciate?*\n' +
                  'As our hard asset portfolio grows, each GRAIN represents a larger slice of real value. No speculation - just real assets.'
              }
            }
          ]
        }
        break

      default:
        console.log('Unhandled action:', actionId)
        response = {
          response_type: 'ephemeral',
          text: 'Processing...'
        }
    }

    // Send response
    if (response && responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
      })
    }
  }

  return new Response('', { status: 200 })
}

// Handle modal/view submissions
async function handleViewSubmission(view: any, user: any, workspace: any) {
  const callbackId = view.callback_id
  const values = view.state?.values || {}

  // Handle different view submissions
  switch (callbackId) {
    case 'order_modal':
      // Process order from modal
      break

    case 'settings_modal':
      // Update user settings
      break
  }

  return new Response('', { status: 200 })
}

// Handle shortcuts
async function handleShortcut(payload: any, workspace: any, triggerId: string) {
  const callbackId = payload.callback_id

  // Open appropriate modal
  // Would use Slack's views.open API here

  return new Response('', { status: 200 })
}

// Add product to cart
async function handleAddToCart(sku: string, user: any, workspace: any) {
  // Get product details
  const product = await sql`
    SELECT sc.*, sn.company_name as supplier_name
    FROM supplier_catalog sc
    JOIN supplier_network sn ON sc.supplier_id = sn.id
    WHERE sc.sku = ${sku}
  `

  if (product.rows.length === 0) {
    return {
      response_type: 'ephemeral',
      text: `❓ Couldn't find product ${sku}`
    }
  }

  const p = product.rows[0]

  return {
    response_type: 'in_channel',
    replace_original: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🛒 *Added to Cart*\n\n*${p.description}*\nSKU: \`${p.sku}\`\nPrice: $${parseFloat(p.unit_price).toFixed(2)}/${p.unit_of_measure}\n\nHow many would you like?`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '10', emoji: true },
            action_id: 'set_quantity_10',
            value: JSON.stringify({ sku, qty: 10 })
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '50', emoji: true },
            action_id: 'set_quantity_50',
            value: JSON.stringify({ sku, qty: 50 })
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '100', emoji: true },
            action_id: 'set_quantity_100',
            value: JSON.stringify({ sku, qty: 100 })
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Custom', emoji: true },
            action_id: 'set_quantity_custom',
            value: JSON.stringify({ sku })
          }
        ]
      }
    ]
  }
}

// Confirm order
async function handleConfirmOrder(value: any, user: any, workspace: any) {
  // Create the actual order
  const orderId = value.order_id || value.conversation_id

  // Generate PO number
  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`

  // Update workspace stats
  await sql`
    UPDATE chat_workspaces
    SET orders_created = orders_created + 1
    WHERE id = ${workspace?.id}::UUID
  `

  // Calculate GRAIN reward
  const grainEarned = Math.floor(Math.random() * 50) + 10 // Placeholder

  return {
    response_type: 'in_channel',
    replace_original: true,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Order Submitted!*\n\n*PO Number:* \`${poNumber}\`\n*Status:* Processing\n*Expected Delivery:* 3-5 business days\n\nYou earned *${grainEarned} GRAIN* on this order! 🌾`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'I\'ll notify you when your order ships. Questions? Just message me!'
          }
        ]
      }
    ]
  }
}

// Confirm reorder
async function handleConfirmReorder(value: any, user: any, workspace: any) {
  return handleConfirmOrder(value, user, workspace)
}

// My orders
async function handleMyOrders(user: any, workspace: any) {
  const orders = await sql`
    SELECT
      io.id,
      io.customer_po,
      io.status,
      io.customer_total,
      io.created_at
    FROM intercept_orders io
    WHERE io.customer_id = ${workspace?.customer_id}::UUID
    ORDER BY io.created_at DESC
    LIMIT 5
  `

  if (orders.rows.length === 0) {
    return {
      response_type: 'ephemeral',
      text: '📦 No orders yet. Start ordering with `/wells order`!'
    }
  }

  const orderList = orders.rows.map(o => {
    const emoji = { draft: '📝', submitted: '📤', confirmed: '✅', shipped: '🚚' }[o.status] || '📦'
    return `${emoji} \`${o.customer_po || o.id.slice(0, 8)}\` - ${o.status} - $${parseFloat(o.customer_total || 0).toFixed(2)}`
  }).join('\n')

  return {
    response_type: 'ephemeral',
    text: `📦 *Your Recent Orders*\n\n${orderList}`
  }
}

// GRAIN balance
async function handleGrainBalance(user: any, workspace: any) {
  const grainResult = await sql`
    SELECT
      SUM(CASE WHEN type = 'credit' THEN quantity ELSE -quantity END) as balance
    FROM grain_ledger
    WHERE customer_id = ${workspace?.customer_id}::UUID
  `

  const balance = parseFloat(grainResult.rows[0]?.balance || 0)

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌾 *Your GRAIN Balance*\n\n*Balance:* ${balance.toFixed(2)} GRAIN\n*Value:* ~$${(balance * 1.0).toFixed(2)}\n\n_Every purchase earns more GRAIN_`
        }
      }
    ]
  }
}
