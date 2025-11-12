/**
 * Integration Disconnect API
 * POST /api/integrations/disconnect
 *
 * Disconnect and remove user integration credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteUserIntegration } from '@/lib/settings/credential-storage'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { integration } = body

    // Validate integration type
    const validIntegrations = ['instantly', 'clay', 'apollo', 'phantombuster', 'twilio', 'notion']
    if (!validIntegrations.includes(integration)) {
      return NextResponse.json(
        { error: 'Invalid integration type' },
        { status: 400 }
      )
    }

    // Delete integration
    await deleteUserIntegration(userId, integration)

    return NextResponse.json({
      success: true,
      message: `${integration} disconnected successfully`
    })

  } catch (error: any) {
    console.error('Integration disconnect error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect integration' },
      { status: 500 }
    )
  }
}
