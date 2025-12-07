// @ts-nocheck
/**
 * CHAT WORKSPACE MANAGEMENT API
 *
 * Connect and manage chat platform integrations.
 * POST /api/chat/workspace - Connect new workspace
 * GET /api/chat/workspace - List/get workspaces
 * PATCH /api/chat/workspace - Update workspace settings
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// POST: Connect a new workspace
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customer_id,
      platform,
      external_workspace_id,
      external_workspace_name,
      access_token,
      refresh_token,
      bot_user_id,
      settings
    } = body

    // Validate required fields
    if (!platform || !external_workspace_id) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['platform', 'external_workspace_id']
      }, { status: 400 })
    }

    // Validate platform
    const validPlatforms = ['slack', 'teams', 'discord', 'whatsapp', 'sms', 'web', 'gchat']
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({
        error: 'Invalid platform',
        valid_platforms: validPlatforms
      }, { status: 400 })
    }

    // Create or update workspace
    const result = await sql`
      INSERT INTO chat_workspaces (
        customer_id,
        platform,
        external_workspace_id,
        external_workspace_name,
        access_token,
        refresh_token,
        bot_user_id,
        settings,
        status
      ) VALUES (
        ${customer_id}::UUID,
        ${platform},
        ${external_workspace_id},
        ${external_workspace_name},
        ${access_token},
        ${refresh_token},
        ${bot_user_id},
        ${settings ? JSON.stringify(settings) : '{}'}::JSONB,
        'active'
      )
      ON CONFLICT (platform, external_workspace_id) DO UPDATE SET
        customer_id = COALESCE(EXCLUDED.customer_id, chat_workspaces.customer_id),
        external_workspace_name = COALESCE(EXCLUDED.external_workspace_name, chat_workspaces.external_workspace_name),
        access_token = COALESCE(EXCLUDED.access_token, chat_workspaces.access_token),
        refresh_token = COALESCE(EXCLUDED.refresh_token, chat_workspaces.refresh_token),
        bot_user_id = COALESCE(EXCLUDED.bot_user_id, chat_workspaces.bot_user_id),
        status = 'active',
        updated_at = NOW()
      RETURNING *
    `

    const workspace = result.rows[0]

    // Get webhook URLs for the platform
    const webhookUrls = getWebhookUrls(platform)

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        platform: workspace.platform,
        external_workspace_id: workspace.external_workspace_id,
        external_workspace_name: workspace.external_workspace_name,
        status: workspace.status,
        settings: workspace.settings,
        created_at: workspace.created_at
      },
      setup: {
        webhook_urls: webhookUrls,
        next_steps: getSetupInstructions(platform)
      }
    })
  } catch (error) {
    console.error('Workspace creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace', details: error.message },
      { status: 500 }
    )
  }
}

// GET: List or get workspaces
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const workspace_id = searchParams.get('id')
    const customer_id = searchParams.get('customer_id')
    const platform = searchParams.get('platform')

    if (workspace_id) {
      // Get specific workspace
      const result = await sql`
        SELECT
          cw.*,
          ec.company_name as customer_name,
          (SELECT COUNT(*) FROM chat_users WHERE workspace_id = cw.id) as user_count,
          (SELECT COUNT(*) FROM chat_conversations WHERE workspace_id = cw.id) as conversation_count
        FROM chat_workspaces cw
        LEFT JOIN erp_customers ec ON cw.customer_id = ec.id
        WHERE cw.id = ${workspace_id}::UUID
      `

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      }

      const ws = result.rows[0]
      return NextResponse.json({
        workspace: {
          id: ws.id,
          platform: ws.platform,
          external_workspace_id: ws.external_workspace_id,
          external_workspace_name: ws.external_workspace_name,
          customer_id: ws.customer_id,
          customer_name: ws.customer_name,
          status: ws.status,
          settings: ws.settings,
          stats: {
            messages_processed: ws.messages_processed,
            orders_created: ws.orders_created,
            user_count: parseInt(ws.user_count),
            conversation_count: parseInt(ws.conversation_count),
            last_activity: ws.last_activity_at
          },
          created_at: ws.created_at
        }
      })
    }

    // List workspaces
    let result
    if (customer_id && platform) {
      result = await sql`
        SELECT cw.*, ec.company_name as customer_name
        FROM chat_workspaces cw
        LEFT JOIN erp_customers ec ON cw.customer_id = ec.id
        WHERE cw.customer_id = ${customer_id}::UUID
        AND cw.platform = ${platform}
        ORDER BY cw.created_at DESC
      `
    } else if (customer_id) {
      result = await sql`
        SELECT cw.*, ec.company_name as customer_name
        FROM chat_workspaces cw
        LEFT JOIN erp_customers ec ON cw.customer_id = ec.id
        WHERE cw.customer_id = ${customer_id}::UUID
        ORDER BY cw.platform, cw.created_at DESC
      `
    } else if (platform) {
      result = await sql`
        SELECT cw.*, ec.company_name as customer_name
        FROM chat_workspaces cw
        LEFT JOIN erp_customers ec ON cw.customer_id = ec.id
        WHERE cw.platform = ${platform}
        ORDER BY cw.created_at DESC
        LIMIT 50
      `
    } else {
      result = await sql`
        SELECT cw.*, ec.company_name as customer_name
        FROM chat_workspaces cw
        LEFT JOIN erp_customers ec ON cw.customer_id = ec.id
        ORDER BY cw.last_activity_at DESC NULLS LAST
        LIMIT 50
      `
    }

    // Group by platform
    const byPlatform = {}
    result.rows.forEach(ws => {
      if (!byPlatform[ws.platform]) {
        byPlatform[ws.platform] = []
      }
      byPlatform[ws.platform].push({
        id: ws.id,
        external_workspace_id: ws.external_workspace_id,
        external_workspace_name: ws.external_workspace_name,
        customer_id: ws.customer_id,
        customer_name: ws.customer_name,
        status: ws.status,
        messages_processed: ws.messages_processed,
        orders_created: ws.orders_created,
        last_activity: ws.last_activity_at
      })
    })

    return NextResponse.json({
      workspaces: byPlatform,
      total: result.rows.length
    })
  } catch (error) {
    console.error('Workspace fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH: Update workspace settings
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { workspace_id, settings, status } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    // Build update query
    let result
    if (settings && status) {
      result = await sql`
        UPDATE chat_workspaces
        SET settings = settings || ${JSON.stringify(settings)}::JSONB,
            status = ${status},
            updated_at = NOW()
        WHERE id = ${workspace_id}::UUID
        RETURNING *
      `
    } else if (settings) {
      result = await sql`
        UPDATE chat_workspaces
        SET settings = settings || ${JSON.stringify(settings)}::JSONB,
            updated_at = NOW()
        WHERE id = ${workspace_id}::UUID
        RETURNING *
      `
    } else if (status) {
      result = await sql`
        UPDATE chat_workspaces
        SET status = ${status},
            updated_at = NOW()
        WHERE id = ${workspace_id}::UUID
        RETURNING *
      `
    } else {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        settings: result.rows[0].settings,
        updated_at: result.rows[0].updated_at
      }
    })
  } catch (error) {
    console.error('Workspace update error:', error)
    return NextResponse.json(
      { error: 'Failed to update workspace', details: error.message },
      { status: 500 }
    )
  }
}

// Helper: Get webhook URLs for platform
function getWebhookUrls(platform: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wellsonyx.io'

  switch (platform) {
    case 'slack':
      return {
        events: `${baseUrl}/api/chat/slack/events`,
        commands: `${baseUrl}/api/chat/slack/commands`,
        interactive: `${baseUrl}/api/chat/slack/interactive`
      }
    case 'teams':
      return {
        messaging: `${baseUrl}/api/chat/teams/webhook`
      }
    case 'discord':
      return {
        interactions: `${baseUrl}/api/chat/discord/interactions`
      }
    case 'gchat':
      return {
        webhook: `${baseUrl}/api/chat/gchat/webhook`
      }
    default:
      return {
        webhook: `${baseUrl}/api/chat/webhook`
      }
  }
}

// Helper: Get setup instructions
function getSetupInstructions(platform: string) {
  switch (platform) {
    case 'slack':
      return [
        '1. Go to api.slack.com/apps and select your app',
        '2. Under "Event Subscriptions", enable events and set Request URL to the events webhook',
        '3. Subscribe to: message.channels, message.groups, message.im, message.mpim, app_mention',
        '4. Under "Slash Commands", create /wells command pointing to commands webhook',
        '5. Install the app to your workspace'
      ]
    case 'teams':
      return [
        '1. Go to Azure Portal > Bot Services',
        '2. Set messaging endpoint to the webhook URL',
        '3. Enable Teams channel',
        '4. Deploy the app to your Teams tenant'
      ]
    case 'discord':
      return [
        '1. Go to discord.com/developers/applications',
        '2. Under "General Information", set Interactions Endpoint URL',
        '3. Enable "Message Content Intent" under Bot settings',
        '4. Add bot to your server with appropriate permissions'
      ]
    case 'gchat':
      return [
        '1. Go to Google Cloud Console > APIs & Services > Credentials',
        '2. Create a new project or select existing',
        '3. Enable Google Chat API',
        '4. Go to Google Chat API > Configuration',
        '5. Set App URL to the webhook endpoint',
        '6. Enable "Receive 1:1 messages" and "Join spaces and group conversations"',
        '7. Set permissions and publish the app'
      ]
    default:
      return ['Use the webhook URL to send messages']
  }
}
