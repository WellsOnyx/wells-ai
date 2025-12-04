// @ts-nocheck
/**
 * Cold Start Protocol - Master API Route
 *
 * ⚠️  MASTER ACCESS ONLY ⚠️
 *
 * This endpoint is protected by COLD_START_MASTER_KEY.
 * Only the owner (you) should have access to this key.
 *
 * Features:
 * - Natural language campaign creation
 * - Campaign management (start/pause/stop)
 * - Status monitoring
 * - Escalation handling
 */

import { NextRequest, NextResponse } from 'next/server'
import type { ColdStartRequest, ColdStartConfig } from '../types'
import { createOrchestrator, ColdStartOrchestrator } from '../services/orchestrator'

// ============================================================================
// MASTER ACCESS AUTHENTICATION
// ============================================================================

const MASTER_KEY = process.env.COLD_START_MASTER_KEY

function validateMasterAccess(request: NextRequest): boolean {
  // Check for master key in header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === MASTER_KEY
  }

  // Check for master key in query param (for webhooks)
  const url = new URL(request.url)
  const keyParam = url.searchParams.get('master_key')
  return keyParam === MASTER_KEY
}

function masterAccessDenied(): NextResponse {
  return NextResponse.json(
    {
      error: 'Access Denied',
      message: 'This endpoint requires master access. Nice try.',
    },
    { status: 403 }
  )
}

// ============================================================================
// SINGLETON ORCHESTRATOR
// ============================================================================

let orchestrator: ColdStartOrchestrator | null = null

function getOrchestrator(): ColdStartOrchestrator {
  if (!orchestrator) {
    // Load config from environment
    const config: ColdStartConfig = {
      ownerId: 'master',
      ownerEmail: process.env.OWNER_EMAIL || '',
      credentials: {
        apollo: process.env.APOLLO_API_KEY ? {
          apiKey: process.env.APOLLO_API_KEY,
          dailyCredits: 10000,
          usedCredits: 0,
        } : undefined,
        linkedin: process.env.LINKEDIN_SESSION_COOKIE ? {
          email: process.env.LINKEDIN_EMAIL || '',
          password: '', // Not stored
          sessionCookie: process.env.LINKEDIN_SESSION_COOKIE,
        } : undefined,
        linkedinRecruiter: process.env.LINKEDIN_RECRUITER_SESSION ? {
          email: process.env.LINKEDIN_RECRUITER_EMAIL || '',
          password: '', // Not stored
          sessionCookie: process.env.LINKEDIN_RECRUITER_SESSION,
        } : undefined,
      },
      defaultOutreachTemplates: {},
      defaultRfpTemplates: {},
      companyInfo: {
        name: process.env.COMPANY_NAME || 'Wells Onyx',
        website: process.env.COMPANY_WEBSITE || 'https://wellsonyx.io',
        description: process.env.COMPANY_DESCRIPTION || 'AI-powered commerce and executive search',
        address: process.env.COMPANY_ADDRESS || '',
        phone: process.env.COMPANY_PHONE || '',
        email: process.env.COMPANY_EMAIL || '',
        taxId: process.env.COMPANY_TAX_ID,
        duns: process.env.COMPANY_DUNS,
        cage: process.env.COMPANY_CAGE,
        naicsCodes: process.env.COMPANY_NAICS?.split(','),
        certifications: process.env.COMPANY_CERTIFICATIONS?.split(','),
      },
      dailyActionLimit: parseInt(process.env.DAILY_ACTION_LIMIT || '50'),
      concurrentCampaigns: parseInt(process.env.MAX_CONCURRENT_CAMPAIGNS || '3'),
      escalationEmail: process.env.ESCALATION_EMAIL || process.env.OWNER_EMAIL || '',
      escalationPhone: process.env.ESCALATION_PHONE,
      slackWebhook: process.env.ESCALATION_SLACK_WEBHOOK,
    }

    orchestrator = createOrchestrator(config)
  }

  return orchestrator
}

// ============================================================================
// POST - Create/Execute Commands
// ============================================================================

export async function POST(request: NextRequest) {
  // Validate master access
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return masterAccessDenied()
  }

  try {
    const body = await request.json() as ColdStartRequest & { action?: string }
    const orch = getOrchestrator()

    // Handle different actions
    switch (body.action) {
      case 'start_campaign':
        const startResult = await orch.startCampaign(body.campaignId as string)
        return NextResponse.json(startResult)

      case 'pause_campaign':
        const pauseResult = await orch.pauseCampaign(body.campaignId as string)
        return NextResponse.json(pauseResult)

      case 'resolve_escalation':
        const resolveResult = await orch.resolveEscalation(
          body.escalationId as string,
          body.resolution as string
        )
        return NextResponse.json(resolveResult)

      default:
        // Parse command and create campaign
        const response = await orch.parseCommand(body)
        return NextResponse.json(response)
    }
  } catch (error) {
    console.error('Cold Start API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Status and Monitoring
// ============================================================================

export async function GET(request: NextRequest) {
  // Validate master access
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return masterAccessDenied()
  }

  try {
    const orch = getOrchestrator()
    const url = new URL(request.url)
    const view = url.searchParams.get('view') || 'overview'

    switch (view) {
      case 'campaigns':
        return NextResponse.json({
          campaigns: orch.getCampaigns(),
          active: orch.getActiveCampaigns().length,
        })

      case 'campaign':
        const campaignId = url.searchParams.get('id')
        if (!campaignId) {
          return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
        }
        const campaign = orch.getCampaign(campaignId)
        if (!campaign) {
          return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }
        return NextResponse.json(campaign)

      case 'escalations':
        return NextResponse.json({
          escalations: orch.getEscalations(),
          count: orch.getEscalations().length,
        })

      case 'queue':
        return NextResponse.json(orch.getQueueStatus())

      case 'overview':
      default:
        const activeCampaigns = orch.getActiveCampaigns()
        const escalations = orch.getEscalations()
        const queueStatus = orch.getQueueStatus()

        return NextResponse.json({
          status: 'operational',
          activeCampaigns: activeCampaigns.length,
          pendingEscalations: escalations.length,
          queueStatus,
          campaigns: activeCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            status: c.status,
            stats: {
              prospectsContacted: c.stats.prospectsContacted,
              responses: c.stats.totalResponses,
              meetings: c.stats.meetingsBooked,
            },
          })),
          criticalEscalations: escalations.filter(e => e.priority === 'critical'),
        })
    }
  } catch (error) {
    console.error('Cold Start API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Stop/Remove
// ============================================================================

export async function DELETE(request: NextRequest) {
  // Validate master access
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return masterAccessDenied()
  }

  try {
    const orch = getOrchestrator()
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'stop_all':
        orch.stop()
        return NextResponse.json({ success: true, message: 'All campaigns stopped' })

      case 'stop_campaign':
        const campaignId = url.searchParams.get('id')
        if (!campaignId) {
          return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
        }
        const result = await orch.pauseCampaign(campaignId)
        return NextResponse.json(result)

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Cold Start API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
