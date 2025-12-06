import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getUserIntegrations,
  getIntegrationsSummary,
  connectChannel,
  disconnectChannel,
  INTEGRATION_CONFIG,
  generateOAuthUrl
} from '@/lib/integrations'
import { Channel, CHANNEL_INFO } from '@/lib/inbox'

export const dynamic = 'force-dynamic'

// GET /api/integrations - Get user's integrations
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const summaryOnly = searchParams.get('summary') === 'true'

    if (summaryOnly) {
      const summary = await getIntegrationsSummary(userId)
      return NextResponse.json({
        success: true,
        ...summary,
        channelInfo: CHANNEL_INFO,
        integrationConfig: INTEGRATION_CONFIG
      })
    }

    const integrations = await getUserIntegrations(userId)

    return NextResponse.json({
      success: true,
      integrations,
      channelInfo: CHANNEL_INFO,
      integrationConfig: INTEGRATION_CONFIG
    })
  } catch (error: any) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/integrations - Connect a channel
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { channel, credentials, accountName } = body

    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel is required' },
        { status: 400 }
      )
    }

    const config = INTEGRATION_CONFIG[channel as Channel]
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel' },
        { status: 400 }
      )
    }

    // For OAuth channels, return the OAuth URL
    if (config.authType === 'oauth') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsonyx.io'
      const redirectUri = `${baseUrl}/api/integrations/callback/${channel}`
      const oauthUrl = generateOAuthUrl(channel as Channel, userId, redirectUri)

      if (!oauthUrl) {
        return NextResponse.json(
          { success: false, error: 'OAuth not configured for this channel' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        authType: 'oauth',
        oauthUrl
      })
    }

    // For API key / webhook channels, validate and store credentials
    if (config.authType === 'api_key' || config.authType === 'webhook' || config.authType === 'phone') {
      // Validate required fields
      for (const field of config.requiredFields) {
        if (!credentials?.[field]) {
          return NextResponse.json(
            { success: false, error: `Missing required field: ${field}` },
            { status: 400 }
          )
        }
      }

      const integration = await connectChannel(
        userId,
        channel as Channel,
        credentials,
        accountName
      )

      return NextResponse.json({
        success: true,
        integration
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown auth type' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error connecting channel:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/integrations - Disconnect a channel
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const channel = searchParams.get('channel')

    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel is required' },
        { status: 400 }
      )
    }

    await disconnectChannel(userId, channel as Channel)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error disconnecting channel:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
