/**
 * Instantly.ai API Integration
 * Automated email sequences and campaign management
 */

export interface InstantlyCampaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  createdAt: Date
  stats?: {
    sent: number
    opened: number
    clicked: number
    replied: number
  }
}

export interface InstantlyProspect {
  email: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  phone?: string
  website?: string
  customVariables?: Record<string, string>
}

export interface InstantlySequenceStep {
  subject: string
  body: string
  delayInDays: number
  variant?: number
}

export interface InstantlyCampaignConfig {
  name: string
  fromEmail?: string
  sequence: InstantlySequenceStep[]
  trackOpens?: boolean
  trackClicks?: boolean
  dailyLimit?: number
}

/**
 * Get Instantly API key from environment
 */
function getInstantlyApiKey(): string {
  const apiKey = process.env.INSTANTLY_API_KEY

  if (!apiKey) {
    throw new Error('INSTANTLY_API_KEY not configured')
  }

  return apiKey
}

/**
 * Make Instantly API request
 */
async function instantlyRequest(
  endpoint: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
  }
): Promise<any> {
  const apiKey = getInstantlyApiKey()
  const baseUrl = 'https://api.instantly.ai/api/v1'

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Instantly API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Create a new campaign
 */
export async function createInstantlyCampaign(
  config: InstantlyCampaignConfig
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  try {
    const result = await instantlyRequest('/campaign/create', {
      method: 'POST',
      body: {
        name: config.name,
        from_email: config.fromEmail,
        track_opens: config.trackOpens !== false,
        track_clicks: config.trackClicks !== false,
        daily_limit: config.dailyLimit || 50
      }
    })

    console.log(`✅ Created Instantly campaign: ${result.campaign_id}`)

    // Add sequence steps
    if (config.sequence && config.sequence.length > 0) {
      for (let i = 0; i < config.sequence.length; i++) {
        const step = config.sequence[i]
        await addCampaignStep(result.campaign_id, {
          stepNumber: i + 1,
          subject: step.subject,
          body: step.body,
          delayInDays: step.delayInDays
        })
      }
    }

    return {
      success: true,
      campaignId: result.campaign_id
    }
  } catch (error) {
    console.error('[INSTANTLY] Failed to create campaign:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create campaign'
    }
  }
}

/**
 * Add a sequence step to campaign
 */
export async function addCampaignStep(
  campaignId: string,
  step: {
    stepNumber: number
    subject: string
    body: string
    delayInDays: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await instantlyRequest('/campaign/sequence/add', {
      method: 'POST',
      body: {
        campaign_id: campaignId,
        step_number: step.stepNumber,
        subject: step.subject,
        body: step.body,
        delay_in_days: step.delayInDays
      }
    })

    console.log(`✅ Added step ${step.stepNumber} to campaign ${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('[INSTANTLY] Failed to add campaign step:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add step'
    }
  }
}

/**
 * Add prospects to campaign
 */
export async function addProspectsToCampaign(
  campaignId: string,
  prospects: InstantlyProspect[]
): Promise<{
  success: boolean
  added: number
  failed: number
  errors?: string[]
}> {
  try {
    // Instantly API accepts batch uploads
    const result = await instantlyRequest('/lead/add', {
      method: 'POST',
      body: {
        campaign_id: campaignId,
        leads: prospects.map(p => ({
          email: p.email,
          first_name: p.firstName || '',
          last_name: p.lastName || '',
          company_name: p.companyName || '',
          personalization: p.jobTitle || '',
          phone: p.phone || '',
          website: p.website || '',
          custom_variables: p.customVariables || {}
        }))
      }
    })

    console.log(`✅ Added ${prospects.length} prospects to campaign ${campaignId}`)

    return {
      success: true,
      added: result.added || prospects.length,
      failed: result.failed || 0,
      errors: result.errors
    }
  } catch (error) {
    console.error('[INSTANTLY] Failed to add prospects:', error)
    return {
      success: false,
      added: 0,
      failed: prospects.length,
      errors: [error instanceof Error ? error.message : 'Failed to add prospects']
    }
  }
}

/**
 * Get campaign details
 */
export async function getCampaign(campaignId: string): Promise<InstantlyCampaign | null> {
  try {
    const result = await instantlyRequest(`/campaign/get?id=${campaignId}`, {
      method: 'GET'
    })

    return {
      id: result.id,
      name: result.name,
      status: result.status,
      createdAt: new Date(result.created_at),
      stats: result.stats
    }
  } catch (error) {
    console.error('[INSTANTLY] Failed to get campaign:', error)
    return null
  }
}

/**
 * List all campaigns
 */
export async function listCampaigns(): Promise<InstantlyCampaign[]> {
  try {
    const result = await instantlyRequest('/campaign/list', {
      method: 'GET'
    })

    return result.campaigns.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: new Date(c.created_at),
      stats: c.stats
    }))
  } catch (error) {
    console.error('[INSTANTLY] Failed to list campaigns:', error)
    return []
  }
}

/**
 * Pause/resume campaign
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: 'active' | 'paused'
): Promise<{ success: boolean; error?: string }> {
  try {
    await instantlyRequest('/campaign/status', {
      method: 'PUT',
      body: {
        campaign_id: campaignId,
        status
      }
    })

    console.log(`✅ Updated campaign ${campaignId} status to ${status}`)

    return { success: true }
  } catch (error) {
    console.error('[INSTANTLY] Failed to update campaign status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status'
    }
  }
}

/**
 * Delete campaign
 */
export async function deleteCampaign(campaignId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    await instantlyRequest(`/campaign/delete?id=${campaignId}`, {
      method: 'DELETE'
    })

    console.log(`🗑️  Deleted campaign ${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('[INSTANTLY] Failed to delete campaign:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete campaign'
    }
  }
}

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(campaignId: string): Promise<{
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
  openRate: number
  clickRate: number
  replyRate: number
} | null> {
  try {
    const result = await instantlyRequest(`/campaign/analytics?id=${campaignId}`, {
      method: 'GET'
    })

    return {
      sent: result.sent || 0,
      delivered: result.delivered || 0,
      opened: result.opened || 0,
      clicked: result.clicked || 0,
      replied: result.replied || 0,
      bounced: result.bounced || 0,
      unsubscribed: result.unsubscribed || 0,
      openRate: result.open_rate || 0,
      clickRate: result.click_rate || 0,
      replyRate: result.reply_rate || 0
    }
  } catch (error) {
    console.error('[INSTANTLY] Failed to get analytics:', error)
    return null
  }
}

/**
 * Remove prospect from campaign
 */
export async function removeProspectFromCampaign(
  campaignId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await instantlyRequest('/lead/delete', {
      method: 'DELETE',
      body: {
        campaign_id: campaignId,
        email
      }
    })

    console.log(`🗑️  Removed ${email} from campaign ${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('[INSTANTLY] Failed to remove prospect:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove prospect'
    }
  }
}

/**
 * Wells AI: Smart campaign templates
 */
export const WELLS_CAMPAIGN_TEMPLATES = {
  'exec-search': {
    name: 'Executive Search Outreach',
    sequence: [
      {
        subject: 'Quick question about {{company_name}}',
        body: `Hi {{first_name}},

I noticed {{company_name}} is {{hiring_signal}}. I specialize in helping companies find exceptional {{role_type}} talent.

Would you be open to a quick call to discuss how we can help?

Best,
{{sender_name}}`,
        delayInDays: 0
      },
      {
        subject: 'Re: Quick question about {{company_name}}',
        body: `Hi {{first_name}},

Just following up on my previous email. I have 3 candidates that might be perfect for {{company_name}}.

Would Tuesday or Wednesday work for a brief call?

Best,
{{sender_name}}`,
        delayInDays: 3
      },
      {
        subject: 'Final follow-up',
        body: `Hi {{first_name}},

I'll keep this brief - if you're not interested, no worries. Just wanted to make sure this didn't get lost.

If finding top {{role_type}} talent is a priority, let's connect. If not, I'll leave you be.

Best,
{{sender_name}}`,
        delayInDays: 5
      }
    ]
  },
  'partnership': {
    name: 'Partnership Outreach',
    sequence: [
      {
        subject: 'Partnership opportunity for {{company_name}}',
        body: `Hi {{first_name}},

I lead partnerships at Wells AI. We're building {{value_prop}} and think there's a strong fit with {{company_name}}.

Would you be open to exploring a partnership?

Best,
{{sender_name}}`,
        delayInDays: 0
      },
      {
        subject: 'Re: Partnership opportunity',
        body: `Hi {{first_name}},

Quick follow-up - we're already working with {{competitor_name}} and {{competitor_2}} in your space.

Happy to share what we're seeing work well. 10 minutes?

Best,
{{sender_name}}`,
        delayInDays: 4
      }
    ]
  }
}

/**
 * Create campaign from template
 */
export async function createCampaignFromTemplate(
  templateName: keyof typeof WELLS_CAMPAIGN_TEMPLATES,
  fromEmail?: string
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const template = WELLS_CAMPAIGN_TEMPLATES[templateName]

  if (!template) {
    return {
      success: false,
      error: `Template '${templateName}' not found`
    }
  }

  return createInstantlyCampaign({
    name: template.name,
    fromEmail,
    sequence: template.sequence,
    trackOpens: true,
    trackClicks: true,
    dailyLimit: 50
  })
}
