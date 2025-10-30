/**
 * Partner SDK API Endpoint
 * RESTful API for partner automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { WellsPartnerSDK } from '@/lib/partner-sdk'
import { PartnerPlatform, SDKMode } from '@/lib/partner-sdk/types'

// In-memory SDK instances (in production: use Redis or database)
const sdkInstances = new Map<string, WellsPartnerSDK>()

/**
 * POST /api/partner-sdk
 * Initialize SDK instance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      partner,
      mode = 'observe',
      auth,
      playbooks = ['deal_registration'],
      consent,
    } = body

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner platform required' },
        { status: 400 }
      )
    }

    // Create SDK instance
    const sdk = new WellsPartnerSDK({
      partner: partner as PartnerPlatform,
      auth: auth || {
        method: 'session',
        credentials: {
          sessionToken: `session_${partner}_${Date.now()}`,
        },
      },
      mode: mode as SDKMode,
      playbooks,
      consent: consent || {
        required: true,
        type: 'action',
      },
      learning: {
        enabled: true,
        storage: 'local',
      },
      rateLimit: {
        actionsPerDay: 200,
        actionsPerHour: 50,
        cooldownMinutes: 5,
      },
      notifications: {
        channels: ['ui'],
        threshold: 75, // Only notify for high-confidence suggestions
      },
    })

    // Start SDK
    await sdk.start()

    // Store instance
    const instanceId = `sdk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    sdkInstances.set(instanceId, sdk)

    console.log('[Partner SDK API] Created instance:', instanceId, 'for', partner)

    return NextResponse.json({
      success: true,
      instanceId,
      partner,
      mode,
      message: 'SDK instance created and started',
    })
  } catch (error: any) {
    console.error('[Partner SDK API] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/partner-sdk?instanceId=xxx
 * Get SDK status and pending actions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json(
        { error: 'Instance ID required' },
        { status: 400 }
      )
    }

    const sdk = sdkInstances.get(instanceId)
    if (!sdk) {
      return NextResponse.json(
        { error: 'SDK instance not found' },
        { status: 404 }
      )
    }

    // Get pending actions
    const pendingActions = sdk.getPendingActions()

    // Get opportunities
    const opportunities = sdk.getOpportunities()

    // Get learning stats
    const learningStats = sdk.getLearningStats()

    return NextResponse.json({
      success: true,
      instanceId,
      status: 'running',
      pendingActions: pendingActions.map(a => ({
        id: a.id,
        type: a.type,
        opportunity: {
          name: a.opportunity.name,
          value: a.opportunity.value.amount,
          customer: a.opportunity.customer.name,
        },
        confidence: a.confidence,
        reasoning: a.reasoning,
        status: a.status,
      })),
      opportunities: opportunities.map(o => ({
        id: o.id,
        name: o.name,
        customer: o.customer.name,
        value: o.value.amount,
        stage: o.stage,
      })),
      learningStats,
    })
  } catch (error: any) {
    console.error('[Partner SDK API] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partner-sdk
 * Approve or reject action
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      instanceId,
      actionId,
      decision, // 'approve' or 'reject'
      approver,
      reason,
    } = body

    if (!instanceId || !actionId || !decision) {
      return NextResponse.json(
        { error: 'Instance ID, action ID, and decision required' },
        { status: 400 }
      )
    }

    const sdk = sdkInstances.get(instanceId)
    if (!sdk) {
      return NextResponse.json(
        { error: 'SDK instance not found' },
        { status: 404 }
      )
    }

    if (decision === 'approve') {
      const result = await sdk.approve(actionId, approver || {
        userId: 'user_default',
        name: 'User',
        email: 'user@company.com',
      })

      return NextResponse.json({
        success: true,
        decision: 'approved',
        result,
      })
    } else if (decision === 'reject') {
      await sdk.reject(actionId, reason || 'No reason provided')

      return NextResponse.json({
        success: true,
        decision: 'rejected',
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[Partner SDK API] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partner-sdk?instanceId=xxx
 * Stop and destroy SDK instance
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json(
        { error: 'Instance ID required' },
        { status: 400 }
      )
    }

    const sdk = sdkInstances.get(instanceId)
    if (!sdk) {
      return NextResponse.json(
        { error: 'SDK instance not found' },
        { status: 404 }
      )
    }

    await sdk.stop()
    sdkInstances.delete(instanceId)

    console.log('[Partner SDK API] Destroyed instance:', instanceId)

    return NextResponse.json({
      success: true,
      message: 'SDK instance stopped and destroyed',
    })
  } catch (error: any) {
    console.error('[Partner SDK API] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
