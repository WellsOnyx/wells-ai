/**
 * Integration List API
 * GET /api/integrations/list
 *
 * List all user integrations (without exposing credentials)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listUserIntegrations } from '@/lib/settings/credential-storage'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all integrations for user
    const integrations = await listUserIntegrations(userId)

    // Available integrations
    const allIntegrations = [
      {
        id: 'instantly',
        name: 'Instantly.ai',
        description: 'Cold email outreach platform',
        category: 'outreach',
        icon: '📧'
      },
      {
        id: 'clay',
        name: 'Clay.earth',
        description: 'Data enrichment and workflow automation',
        category: 'data',
        icon: '🧱'
      },
      {
        id: 'apollo',
        name: 'Apollo.io',
        description: 'Sales intelligence and engagement',
        category: 'sales',
        icon: '🚀'
      },
      {
        id: 'phantombuster',
        name: 'PhantomBuster',
        description: 'Social media automation',
        category: 'automation',
        icon: '👻'
      },
      {
        id: 'twilio',
        name: 'Twilio',
        description: 'SMS and voice communications',
        category: 'communication',
        icon: '📱'
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Workspace and database',
        category: 'productivity',
        icon: '📝'
      }
    ]

    // Merge with user's connected integrations
    const integrationsWithStatus = allIntegrations.map(integration => {
      const userIntegration = integrations.find(i => i.integration === integration.id)

      return {
        ...integration,
        connected: !!userIntegration,
        lastTested: userIntegration?.lastTested,
        testStatus: userIntegration?.testStatus
      }
    })

    return NextResponse.json({
      integrations: integrationsWithStatus,
      connectedCount: integrations.length,
      availableCount: allIntegrations.length
    })

  } catch (error: any) {
    console.error('Integration list error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list integrations' },
      { status: 500 }
    )
  }
}
