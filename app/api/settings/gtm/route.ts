import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

/**
 * POST /api/settings/gtm
 *
 * Save GTM settings (API keys) to Clerk user metadata
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      notionApiKey,
      notionDealsDbId,
      instantlyApiKey,
      instantlyCampaignId,
      twilioFrom,
    } = body

    // Update user's private metadata (secure storage for API keys)
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const updatedMetadata: any = {}

    // Only update fields that are provided (allow partial updates)
    if (notionApiKey !== undefined) updatedMetadata.notionApiKey = notionApiKey
    if (notionDealsDbId !== undefined) updatedMetadata.notionDealsDbId = notionDealsDbId
    if (instantlyApiKey !== undefined) updatedMetadata.instantlyApiKey = instantlyApiKey
    if (instantlyCampaignId !== undefined) updatedMetadata.instantlyCampaignId = instantlyCampaignId
    if (twilioFrom !== undefined) updatedMetadata.twilioFrom = twilioFrom

    await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        ...updatedMetadata,
      },
    })

    console.log(`[GTM Settings] Updated settings for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    })
  } catch (error: any) {
    console.error('[GTM Settings] Error saving settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save settings' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/settings/gtm
 *
 * Get current GTM settings (without exposing full API keys)
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const privateMetadata = user.privateMetadata as any

    // Return masked API keys for display
    const maskApiKey = (key: string | undefined) => {
      if (!key) return ''
      if (key.length <= 8) return key
      return key.substring(0, 4) + '...' + key.substring(key.length - 4)
    }

    return NextResponse.json({
      notionApiKey: maskApiKey(privateMetadata.notionApiKey),
      notionDealsDbId: privateMetadata.notionDealsDbId || '',
      instantlyApiKey: maskApiKey(privateMetadata.instantlyApiKey),
      instantlyCampaignId: privateMetadata.instantlyCampaignId || '',
      twilioFrom: privateMetadata.twilioFrom || '',
      hasNotionSetup: !!(privateMetadata.notionApiKey && privateMetadata.notionDealsDbId),
      hasInstantlySetup: !!privateMetadata.instantlyApiKey,
      hasTwilioSetup: !!privateMetadata.twilioFrom,
    })
  } catch (error: any) {
    console.error('[GTM Settings] Error loading settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load settings' },
      { status: 500 }
    )
  }
}
