// @ts-nocheck
/**
 * SLACK SLASH COMMANDS
 *
 * Handle Slack slash commands.
 * POST /api/chat/slack/commands
 *
 * Commands:
 * /wells search <query> - Search for products
 * /wells order <items> - Quick order
 * /wells status [PO#] - Check order status
 * /wells grain - Check GRAIN balance
 * /wells help - Show help
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    // Slack sends form-urlencoded data
    const formData = await request.formData()

    const command = formData.get('command') as string
    const text = formData.get('text') as string
    const userId = formData.get('user_id') as string
    const userName = formData.get('user_name') as string
    const teamId = formData.get('team_id') as string
    const channelId = formData.get('channel_id') as string
    const responseUrl = formData.get('response_url') as string

    // Verify workspace
    const workspaceResult = await sql`
      SELECT * FROM chat_workspaces
      WHERE external_workspace_id = ${teamId}
      AND platform = 'slack'
      AND status = 'active'
    `

    if (workspaceResult.rows.length === 0) {
      return new Response(JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ This workspace is not connected to Wells AI. Contact your administrator.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const workspace = workspaceResult.rows[0]

    // Parse command
    const parts = (text || '').trim().split(/\s+/)
    const subCommand = parts[0]?.toLowerCase() || 'help'
    const args = parts.slice(1).join(' ')

    // Handle subcommands
    let response
    switch (subCommand) {
      case 'search':
        response = await handleSearch(args, workspace.customer_id)
        break

      case 'order':
        response = await handleQuickOrder(args, userId, workspace)
        break

      case 'status':
        response = await handleStatus(args, workspace.customer_id)
        break

      case 'grain':
        response = await handleGrain(userId, workspace.customer_id)
        break

      case 'reorder':
        response = await handleReorder(workspace.customer_id)
        break

      case 'approve':
        response = await handleApprove(args, userId)
        break

      case 'help':
      default:
        response = getHelpResponse()
        break
    }

    // Log command usage
    await sql`
      UPDATE chat_workspaces
      SET messages_processed = messages_processed + 1,
          last_activity_at = NOW()
      WHERE id = ${workspace.id}::UUID
    `

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Slash command error:', error)
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: '❌ Something went wrong. Please try again.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Search command
async function handleSearch(query: string, customerId: string) {
  if (!query) {
    return {
      response_type: 'ephemeral',
      text: '🔍 What would you like to search for?\n\nUsage: `/wells search latex gloves`'
    }
  }

  // Search products
  const results = await sql`
    SELECT
      sc.sku,
      sc.description,
      sc.unit_price,
      sc.unit_of_measure,
      sn.company_name as supplier
    FROM supplier_catalog sc
    JOIN supplier_network sn ON sc.supplier_id = sn.id
    WHERE sc.is_active = true
    AND (
      LOWER(sc.description) LIKE ${`%${query.toLowerCase()}%`}
      OR LOWER(sc.sku) LIKE ${`%${query.toLowerCase()}%`}
    )
    LIMIT 5
  `

  if (results.rows.length === 0) {
    return {
      response_type: 'ephemeral',
      text: `🔍 No products found for "${query}"\n\nTry different keywords or ask for help.`
    }
  }

  const productBlocks = results.rows.map(p => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${p.description}*\nSKU: \`${p.sku}\` | $${parseFloat(p.unit_price).toFixed(2)}/${p.unit_of_measure}\nSupplier: ${p.supplier}`
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: '🛒 Add',
        emoji: true
      },
      action_id: 'add_to_cart',
      value: p.sku
    }
  }))

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🔍 Search results for "${query}"`,
          emoji: true
        }
      },
      ...productBlocks,
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Found ${results.rows.length} products | Type \`/wells order <sku> <quantity>\` to order`
          }
        ]
      }
    ]
  }
}

// Quick order command
async function handleQuickOrder(args: string, userId: string, workspace: any) {
  if (!args) {
    return {
      response_type: 'ephemeral',
      text: '📦 Quick order format:\n\n`/wells order 500 latex gloves`\nor\n`/wells order SKU-12345 qty 100`'
    }
  }

  // Parse quantity and item
  const qtyMatch = args.match(/(\d+)\s*(.+)/)
  if (!qtyMatch) {
    return {
      response_type: 'ephemeral',
      text: '❓ I couldn\'t understand that order. Try: `/wells order 500 latex gloves`'
    }
  }

  const quantity = parseInt(qtyMatch[1])
  const item = qtyMatch[2]

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📦 *Order Request*\n\n*Item:* ${item}\n*Quantity:* ${quantity}\n\nSearching for matching products...`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Confirm Order',
              emoji: true
            },
            style: 'primary',
            action_id: 'confirm_quick_order',
            value: JSON.stringify({ item, quantity })
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❌ Cancel',
              emoji: true
            },
            action_id: 'cancel_order'
          }
        ]
      }
    ]
  }
}

// Status command
async function handleStatus(poNumber: string, customerId: string) {
  if (poNumber) {
    // Search for specific PO
    const order = await sql`
      SELECT
        io.*,
        COUNT(iol.id) as line_count
      FROM intercept_orders io
      LEFT JOIN intercept_order_lines iol ON io.id = iol.order_id
      WHERE io.customer_id = ${customerId}::UUID
      AND (io.customer_po ILIKE ${`%${poNumber}%`} OR io.id::TEXT ILIKE ${`%${poNumber}%`})
      GROUP BY io.id
      LIMIT 1
    `

    if (order.rows.length === 0) {
      return {
        response_type: 'ephemeral',
        text: `❓ Couldn't find order "${poNumber}". Try \`/wells status\` to see recent orders.`
      }
    }

    const o = order.rows[0]
    const statusEmoji = {
      draft: '📝',
      submitted: '📤',
      confirmed: '✅',
      shipped: '🚚',
      delivered: '📦',
      completed: '✔️'
    }[o.status] || '❓'

    return {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji} *Order ${o.customer_po || o.id.slice(0, 8)}*\n\n*Status:* ${o.status}\n*Items:* ${o.line_count}\n*Total:* $${parseFloat(o.customer_total || 0).toFixed(2)}\n*Created:* ${new Date(o.created_at).toLocaleDateString()}`
          }
        }
      ]
    }
  }

  // List recent orders
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
      response_type: 'ephemeral',
      text: '📦 No orders found. Use `/wells order` to place your first order!'
    }
  }

  const orderList = orders.rows.map(o => {
    const emoji = { draft: '📝', submitted: '📤', confirmed: '✅', shipped: '🚚' }[o.status] || '📦'
    return `${emoji} \`${o.customer_po || o.id.slice(0, 8)}\` - ${o.status} - $${parseFloat(o.customer_total || 0).toFixed(2)}`
  }).join('\n')

  return {
    response_type: 'in_channel',
    text: `📦 *Recent Orders*\n\n${orderList}\n\n_Use \`/wells status PO#\` for details_`
  }
}

// GRAIN balance command
async function handleGrain(userId: string, customerId: string) {
  const grainResult = await sql`
    SELECT
      SUM(CASE WHEN type = 'credit' THEN quantity ELSE -quantity END) as balance
    FROM grain_ledger
    WHERE customer_id = ${customerId}::UUID
  `

  const balance = parseFloat(grainResult.rows[0]?.balance || 0)

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌾 *Your GRAIN Balance*\n\n*Balance:* ${balance.toFixed(2)} GRAIN\n*Estimated Value:* $${(balance * 1.0).toFixed(2)}\n\n_GRAIN appreciates as our hard asset portfolio grows_`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Every purchase earns GRAIN. Every early payment earns bonus GRAIN.'
          }
        ]
      }
    ]
  }
}

// Reorder command
async function handleReorder(customerId: string) {
  const lastOrder = await sql`
    SELECT
      io.id,
      io.customer_po,
      io.customer_total
    FROM intercept_orders io
    WHERE io.customer_id = ${customerId}::UUID
    ORDER BY io.created_at DESC
    LIMIT 1
  `

  if (lastOrder.rows.length === 0) {
    return {
      response_type: 'ephemeral',
      text: '❓ No previous orders to reorder. Use `/wells order` to place a new order.'
    }
  }

  const order = lastOrder.rows[0]

  return {
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔄 *Reorder Last Order*\n\nOrder: \`${order.customer_po || order.id.slice(0, 8)}\`\nTotal: $${parseFloat(order.customer_total || 0).toFixed(2)}\n\nWould you like to reorder?`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Reorder',
              emoji: true
            },
            style: 'primary',
            action_id: 'confirm_reorder',
            value: order.id
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✏️ Modify',
              emoji: true
            },
            action_id: 'modify_reorder',
            value: order.id
          }
        ]
      }
    ]
  }
}

// Approve command
async function handleApprove(args: string, userId: string) {
  return {
    response_type: 'ephemeral',
    text: '✅ Approval workflow coming soon!\n\nFor now, pending approvals will be sent via DM.'
  }
}

// Help response
function getHelpResponse() {
  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🛒 Wells AI Commands',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*\n\n' +
            '`/wells search <query>` - Search for products\n' +
            '`/wells order <qty> <item>` - Quick order\n' +
            '`/wells status [PO#]` - Check order status\n' +
            '`/wells grain` - Check GRAIN balance\n' +
            '`/wells reorder` - Reorder last order\n' +
            '`/wells help` - Show this help\n\n' +
            '*Or just message me naturally!*\n' +
            'Try: "I need 500 boxes of latex gloves"'
        }
      }
    ]
  }
}
