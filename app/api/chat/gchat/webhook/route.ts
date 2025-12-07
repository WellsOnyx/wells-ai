// @ts-nocheck
/**
 * GOOGLE CHAT WEBHOOK
 *
 * Handle incoming messages from Google Chat.
 * POST /api/chat/gchat/webhook
 *
 * Google Chat sends events for:
 * - MESSAGE: User sends a message
 * - ADDED_TO_SPACE: Bot added to space/room
 * - REMOVED_FROM_SPACE: Bot removed
 * - CARD_CLICKED: User clicks a card button
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const event = await request.json()

    // Verify the request is from Google (in production, verify JWT)
    // const authorization = request.headers.get('Authorization')

    const eventType = event.type
    const spaceId = event.space?.name // spaces/AAAA...
    const spaceName = event.space?.displayName
    const spaceType = event.space?.type // ROOM, DM, or SPACE

    switch (eventType) {
      case 'MESSAGE':
        return await handleMessage(event)

      case 'ADDED_TO_SPACE':
        return await handleAddedToSpace(event)

      case 'REMOVED_FROM_SPACE':
        return await handleRemovedFromSpace(event)

      case 'CARD_CLICKED':
        return await handleCardClicked(event)

      default:
        console.log('Unhandled Google Chat event:', eventType)
        return NextResponse.json({})
    }
  } catch (error) {
    console.error('Google Chat webhook error:', error)
    return NextResponse.json({ text: 'Something went wrong. Please try again.' })
  }
}

// Handle incoming messages
async function handleMessage(event: any) {
  const spaceId = event.space?.name
  const userId = event.user?.name // users/AAAA...
  const userEmail = event.user?.email
  const userName = event.user?.displayName
  const message = event.message?.text || ''
  const threadId = event.message?.thread?.name

  // Remove @mention if present
  const cleanMessage = message
    .replace(/@\S+/g, '')
    .trim()

  // Get or create workspace
  let workspaceResult = await sql`
    SELECT * FROM chat_workspaces
    WHERE external_workspace_id = ${spaceId}
    AND platform = 'gchat'
    AND status = 'active'
  `

  if (workspaceResult.rows.length === 0) {
    // Auto-create workspace for new spaces
    const createResult = await sql`
      INSERT INTO chat_workspaces (
        platform,
        external_workspace_id,
        external_workspace_name,
        status
      ) VALUES (
        'gchat',
        ${spaceId},
        ${event.space?.displayName || 'Google Chat Space'},
        'active'
      )
      ON CONFLICT (platform, external_workspace_id) DO UPDATE SET
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `
    workspaceResult = { rows: createResult.rows }
  }

  const workspace = workspaceResult.rows[0]

  // Process through NLU
  const result = await sql`
    SELECT * FROM process_chat_message(
      ${workspace.id}::UUID,
      ${userId},
      ${spaceId},
      ${cleanMessage},
      ${threadId || null}
    )
  `

  const processed = result.rows[0]

  // Update stats
  await sql`
    UPDATE chat_workspaces
    SET messages_processed = messages_processed + 1,
        last_activity_at = NOW()
    WHERE id = ${workspace.id}::UUID
  `

  // Build response
  const buttons = processed.response_buttons ? JSON.parse(processed.response_buttons) : []

  // If we have buttons, return a card
  if (buttons.length > 0) {
    return NextResponse.json({
      cardsV2: [{
        cardId: 'response_card',
        card: {
          header: {
            title: 'Wells AI',
            subtitle: getIntentLabel(processed.detected_intent),
            imageUrl: 'https://wellsonyx.io/wells-ai-logo.svg',
            imageType: 'CIRCLE'
          },
          sections: [{
            widgets: [
              {
                textParagraph: {
                  text: processed.response_text
                }
              },
              {
                buttonList: {
                  buttons: buttons.map((btn: any) => ({
                    text: btn.text,
                    onClick: {
                      action: {
                        function: btn.action,
                        parameters: [{
                          key: 'conversation_id',
                          value: processed.conversation_id
                        }, {
                          key: 'intent',
                          value: processed.detected_intent
                        }]
                      }
                    }
                  }))
                }
              }
            ]
          }]
        }
      }]
    })
  }

  // Simple text response
  return NextResponse.json({
    text: processed.response_text
  })
}

// Handle bot added to space
async function handleAddedToSpace(event: any) {
  const spaceId = event.space?.name
  const spaceName = event.space?.displayName
  const spaceType = event.space?.type
  const addedBy = event.user?.displayName

  // Create workspace record
  await sql`
    INSERT INTO chat_workspaces (
      platform,
      external_workspace_id,
      external_workspace_name,
      status
    ) VALUES (
      'gchat',
      ${spaceId},
      ${spaceName || 'Google Chat'},
      'active'
    )
    ON CONFLICT (platform, external_workspace_id) DO UPDATE SET
      external_workspace_name = EXCLUDED.external_workspace_name,
      status = 'active',
      updated_at = NOW()
  `

  // Welcome message
  const welcomeText = spaceType === 'DM'
    ? `Hi ${addedBy}! I'm Wells AI, your procurement assistant.\n\nJust message me naturally to:\n• Search for products\n• Place orders\n• Check order status\n• View your GRAIN rewards\n\nTry: "I need to order office supplies"`
    : `Thanks for adding me to ${spaceName}! I'm Wells AI, your procurement assistant.\n\n@mention me to:\n• Search products\n• Place orders\n• Check status\n• View GRAIN\n\nTry: "@Wells AI find safety glasses"`

  return NextResponse.json({
    text: welcomeText
  })
}

// Handle bot removed from space
async function handleRemovedFromSpace(event: any) {
  const spaceId = event.space?.name

  // Mark workspace as disconnected
  await sql`
    UPDATE chat_workspaces
    SET status = 'disconnected',
        updated_at = NOW()
    WHERE external_workspace_id = ${spaceId}
    AND platform = 'gchat'
  `

  return NextResponse.json({})
}

// Handle card button clicks
async function handleCardClicked(event: any) {
  const action = event.common?.invokedFunction || event.action?.actionMethodName
  const parameters = event.common?.parameters || {}
  const userId = event.user?.name
  const spaceId = event.space?.name

  // Handle different actions
  switch (action) {
    case 'confirm_order':
    case 'submit_order':
      return NextResponse.json({
        actionResponse: {
          type: 'UPDATE_MESSAGE'
        },
        cardsV2: [{
          cardId: 'order_confirmed',
          card: {
            header: {
              title: 'Order Submitted!',
              subtitle: 'Processing your order',
              imageUrl: 'https://wellsonyx.io/wells-ai-logo.svg',
              imageType: 'CIRCLE'
            },
            sections: [{
              widgets: [{
                decoratedText: {
                  topLabel: 'Status',
                  text: '✅ Order submitted successfully!',
                  bottomLabel: 'You\'ll receive a confirmation shortly'
                }
              }, {
                decoratedText: {
                  topLabel: 'GRAIN Earned',
                  text: '🌾 +25 GRAIN',
                  bottomLabel: 'Keep ordering to earn more!'
                }
              }]
            }]
          }
        }]
      })

    case 'cancel_order':
      return NextResponse.json({
        actionResponse: {
          type: 'UPDATE_MESSAGE'
        },
        text: '❌ Order cancelled.'
      })

    case 'search_products':
      return NextResponse.json({
        text: '🔍 What would you like to search for? Just tell me what you need.'
      })

    case 'grain_balance':
      // Get GRAIN balance
      const workspaceResult = await sql`
        SELECT * FROM chat_workspaces
        WHERE external_workspace_id = ${spaceId}
        AND platform = 'gchat'
      `
      const workspace = workspaceResult.rows[0]

      const grainResult = await sql`
        SELECT
          SUM(CASE WHEN type = 'credit' THEN quantity ELSE -quantity END) as balance
        FROM grain_ledger
        WHERE customer_id = ${workspace?.customer_id}::UUID
      `
      const balance = parseFloat(grainResult.rows[0]?.balance || 0)

      return NextResponse.json({
        cardsV2: [{
          cardId: 'grain_balance',
          card: {
            header: {
              title: '🌾 Your GRAIN Balance',
              imageUrl: 'https://wellsonyx.io/wells-ai-logo.svg',
              imageType: 'CIRCLE'
            },
            sections: [{
              widgets: [{
                decoratedText: {
                  topLabel: 'Current Balance',
                  text: `${balance.toFixed(2)} GRAIN`,
                  bottomLabel: `≈ $${(balance * 1.0).toFixed(2)} USD`
                }
              }, {
                textParagraph: {
                  text: '<i>GRAIN appreciates as our hard asset portfolio grows. Every purchase earns more GRAIN!</i>'
                }
              }]
            }]
          }
        }]
      })

    case 'explain_grain':
      return NextResponse.json({
        cardsV2: [{
          cardId: 'grain_explainer',
          card: {
            header: {
              title: '🌾 How GRAIN Works',
              imageUrl: 'https://wellsonyx.io/wells-ai-logo.svg',
              imageType: 'CIRCLE'
            },
            sections: [{
              header: 'What is GRAIN?',
              widgets: [{
                textParagraph: {
                  text: 'GRAIN is our rewards token backed by real hard assets - manufacturing equipment, real estate, and operating businesses.'
                }
              }]
            }, {
              header: 'How do I earn GRAIN?',
              widgets: [{
                textParagraph: {
                  text: '• Every purchase through Wells AI\n• Early payment bonuses\n• Referral rewards\n• Financing transactions'
                }
              }]
            }, {
              header: 'Why does it appreciate?',
              widgets: [{
                textParagraph: {
                  text: 'As our hard asset portfolio grows, each GRAIN represents a larger slice of real value. No speculation - just real assets.'
                }
              }]
            }]
          }
        }]
      })

    default:
      return NextResponse.json({
        text: 'Processing...'
      })
  }
}

// Helper: Get human-readable intent label
function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    'search_products': 'Product Search',
    'create_order': 'New Order',
    'order_status': 'Order Tracking',
    'grain_balance': 'GRAIN Rewards',
    'spend_analytics': 'Spend Analytics',
    'reorder': 'Reorder',
    'greeting': 'Welcome',
    'help': 'Help',
    'approve_order': 'Approval',
    'reject_order': 'Rejection',
    'unknown': 'Processing'
  }
  return labels[intent] || 'Wells AI'
}
