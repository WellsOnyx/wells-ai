/**
 * Wells AI - Instantly Integration
 * Send emails via Instantly.ai campaigns
 */

import { writeAuditAction } from './audit-ledger'

// ===== CONFIGURATION =====

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY || ''
const INSTANTLY_API_URL = 'https://api.instantly.ai/api/v2'

// ===== TYPES =====

export interface InstantlyLead {
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  customVariables?: Record<string, any>
}

export interface AddLeadToCampaignParams {
  lead: InstantlyLead
  campaignId: string
  skipIfInWorkspace?: boolean
  skipIfInCampaign?: boolean
}

export interface InstantlyResponse {
  success: boolean
  data?: any
  error?: string
}

// ===== API FUNCTIONS =====

/**
 * Add a lead to an Instantly campaign
 * This triggers the campaign email sequence for this lead
 */
export async function addLeadToCampaign(
  params: AddLeadToCampaignParams
): Promise<InstantlyResponse> {
  const { lead, campaignId, skipIfInWorkspace = true, skipIfInCampaign = true } = params

  if (!INSTANTLY_API_KEY) {
    throw new Error('INSTANTLY_API_KEY not configured')
  }

  try {
    const response = await fetch(`${INSTANTLY_API_URL}/leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company_name: lead.companyName,
        campaign_id: campaignId,
        skip_if_in_workspace: skipIfInWorkspace,
        skip_if_in_campaign: skipIfInCampaign,
        custom_variables: lead.customVariables || {}
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Instantly API error: ${response.status}`)
    }

    console.log(`✅ Lead added to Instantly campaign: ${lead.email} → ${campaignId}`)

    return {
      success: true,
      data
    }
  } catch (error: any) {
    console.error(`❌ Instantly API error: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Send an email via Instantly (add lead to campaign)
 * Wrapper that adds lead to campaign with audit logging
 */
export async function sendEmailViaInstantly(params: {
  actionId: string
  to: string
  toName?: string
  subject: string
  campaignId: string
  metadata?: Record<string, any>
}): Promise<void> {
  const { actionId, to, toName, subject, campaignId, metadata } = params

  // Parse first/last name
  const nameParts = toName ? toName.split(' ') : []
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Add lead to campaign
  const result = await addLeadToCampaign({
    lead: {
      email: to,
      firstName,
      lastName,
      customVariables: {
        ...metadata,
        source: 'wells_onyx_gtm',
        subject
      }
    },
    campaignId,
    skipIfInWorkspace: false, // Allow duplicates for now
    skipIfInCampaign: true     // Don't re-add if already in campaign
  })

  // Log to audit trail
  await writeAuditAction({
    actionId,
    actionType: 'email',
    title: result.success
      ? `Email queued via Instantly: ${subject}`
      : `Failed to queue email via Instantly: ${subject}`,
    description: `To: ${to} via campaign ${campaignId}`,
    recipient: to,
    decision: result.success ? 'approve' : 'error',
    decidedBy: 'system',
    metadata: {
      provider: 'instantly',
      campaignId,
      success: result.success,
      error: result.error,
      ...metadata
    }
  })

  if (!result.success) {
    throw new Error(`Failed to send via Instantly: ${result.error}`)
  }

  console.log(`✅ Email queued via Instantly: ${to} - ${subject}`)
}

/**
 * List campaigns
 */
export async function listCampaigns(): Promise<any[]> {
  if (!INSTANTLY_API_KEY) {
    throw new Error('INSTANTLY_API_KEY not configured')
  }

  try {
    const response = await fetch(`${INSTANTLY_API_URL}/campaigns`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Instantly API error: ${response.status}`)
    }

    return data.campaigns || []
  } catch (error: any) {
    console.error(`❌ Instantly API error: ${error.message}`)
    throw error
  }
}

// ===== EXPORTS =====

export default {
  addLeadToCampaign,
  sendEmailViaInstantly,
  listCampaigns
}
