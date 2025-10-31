/**
 * Campaign Engine - Updated Version
 *
 * Simple campaign flow: ICP → Search → Generate → Approve → Send
 *
 * KEY CHANGE: Now uses Instantly for BOTH lead finding AND email sending
 * - User can bring their own Instantly account (they provide API key)
 * - OR use Wells AI's Instantly account (charged $79/month)
 */

import Anthropic from '@anthropic-ai/sdk'
import { buildICPFromNotion, icpToSearchCriteria, type ICP } from './icp-analyzer'
import { searchInstantlyLeads, type InstantlyLead } from './instantly-leads'
import {
  generateMultiChannelMessages,
  sendSMSMessage,
  type OutreachMessage,
} from './multi-channel'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface Prospect {
  id: string
  name: string
  email: string
  title: string
  company: string
  companyDomain: string
  linkedInUrl?: string
  phone?: string
}

export interface Campaign {
  id: string
  userId: string
  icp: ICP
  prospects: Prospect[]
  messages: Array<{
    prospectId: string
    channel: 'email' | 'sms' | 'linkedin'
    subject?: string // Email only
    body: string
    approved: boolean
    sent: boolean
    sentAt?: Date
    canSend: boolean
    reason?: string
  }>
  status: 'draft' | 'approved' | 'sending' | 'sent'
  createdAt: Date
  usingWellsStack: boolean // true if using Wells AI's Instantly account
}

/**
 * Create campaign from user's request
 */
export async function createCampaign(params: {
  userId: string
  userRequest: string // e.g., "Find me customers who buy vegetables"
  notionApiKey: string
  notionDealsDbId: string
  instantlyApiKey?: string // User's own Instantly API key (optional)
  userRelationship?: 'existing' | 'opt-in' | 'cold' // For SMS guardrails
  productDescription?: string // For multi-channel messaging
  twilioFrom?: string // For SMS sending
}): Promise<Campaign> {
  // Determine if using Wells AI stack or user's own
  const usingWellsStack = !params.instantlyApiKey
  const instantlyApiKey = params.instantlyApiKey || process.env.WELLS_INSTANTLY_API_KEY

  if (!instantlyApiKey) {
    throw new Error(
      'No Instantly API key provided. Either provide your own or subscribe to Wells AI GTM stack ($79/month).'
    )
  }

  // Step 1: Build ICP from won deals
  console.log('Building ICP from Notion...')
  const icp = await buildICPFromNotion(params.notionApiKey, params.notionDealsDbId)

  // Step 2: Search Instantly for prospects (replacing Apollo)
  console.log('Searching Instantly for prospects...')
  const searchCriteria = icpToSearchCriteria(icp)
  const instantlyLeads = await searchInstantlyLeads({
    apiKey: instantlyApiKey,
    titles: searchCriteria.titles,
    industries: searchCriteria.industries,
    limit: 25,
  })

  // Convert Instantly leads to our Prospect format
  const prospects: Prospect[] = instantlyLeads.map((lead) => ({
    id: `prospect_${lead.email}`,
    name: `${lead.first_name} ${lead.last_name}`,
    email: lead.email,
    title: lead.title,
    company: lead.company_name,
    companyDomain: lead.company_domain,
    linkedInUrl: lead.linkedin_url,
    phone: lead.phone,
  }))

  // Step 3: Generate multi-channel messages
  console.log('Generating multi-channel messages...')
  const allMessages: Campaign['messages'] = []

  for (const prospect of prospects) {
    // Generate messages for all channels
    const multiChannelMessages = await generateMultiChannelMessages({
      prospect: {
        name: prospect.name,
        company: prospect.company,
        title: prospect.title,
        email: prospect.email,
        phone: prospect.phone,
        linkedin: prospect.linkedInUrl,
      },
      userRelationship: params.userRelationship || 'cold',
      context: params.userRequest,
      productDescription: params.productDescription || icp.summary,
    })

    // Add all messages to campaign
    for (const msg of multiChannelMessages) {
      allMessages.push({
        prospectId: prospect.id,
        channel: msg.channel,
        subject: msg.subject,
        body: msg.body,
        approved: false,
        sent: false,
        canSend: msg.canSend,
        reason: msg.reason,
      })
    }
  }

  const campaign: Campaign = {
    id: `campaign_${Date.now()}`,
    userId: params.userId,
    icp,
    prospects,
    messages: allMessages,
    status: 'draft',
    createdAt: new Date(),
    usingWellsStack,
  }

  console.log(`✅ Campaign created: ${campaign.id}`)
  console.log(`   Prospects: ${prospects.length}`)
  console.log(`   Messages generated: ${allMessages.length}`)
  console.log(`   Using Wells AI stack: ${usingWellsStack ? 'YES ($79/month)' : 'NO (user provided)'}`)

  return campaign
}

// Removed old generateMessage function - now using multi-channel system

/**
 * Send campaign via Instantly (emails) and Twilio (SMS)
 */
export async function sendCampaign(params: {
  campaign: Campaign
  instantlyApiKey: string
  instantlyCampaignId?: string
  twilioFrom?: string
}): Promise<{
  sent: number
  failed: number
  breakdown: { email: number; sms: number; linkedin: number }
}> {
  let sent = 0
  let failed = 0
  const breakdown = { email: 0, sms: 0, linkedin: 0 }

  for (const message of params.campaign.messages) {
    if (!message.approved) continue
    if (!message.canSend) {
      console.log(`Skipping ${message.channel} to ${message.prospectId}: ${message.reason}`)
      continue
    }

    try {
      const prospect = params.campaign.prospects.find(
        (p) => p.id === message.prospectId
      )!

      if (message.channel === 'email') {
        await sendEmailViaInstantly({
          apiKey: params.instantlyApiKey,
          campaignId: params.instantlyCampaignId || process.env.INSTANTLY_CAMPAIGN_ID!,
          to: prospect.email,
          subject: message.subject!,
          body: message.body,
        })
        breakdown.email++
      } else if (message.channel === 'sms') {
        if (!params.twilioFrom) {
          throw new Error('No Twilio phone number provided for SMS')
        }
        await sendSMSMessage({
          to: prospect.phone!,
          body: message.body,
          from: params.twilioFrom,
          userRelationship: 'existing', // Already checked in canSend
        })
        breakdown.sms++
      } else if (message.channel === 'linkedin') {
        // LinkedIn messages are drafts only - user sends manually
        console.log(`LinkedIn draft ready for ${prospect.name}: ${message.body}`)
        breakdown.linkedin++
      }

      message.sent = true
      message.sentAt = new Date()
      sent++
    } catch (error) {
      console.error(
        `Failed to send ${message.channel} to ${message.prospectId}:`,
        error
      )
      failed++
    }
  }

  params.campaign.status = 'sent'
  return { sent, failed, breakdown }
}

/**
 * Send email via Instantly API
 */
async function sendEmailViaInstantly(params: {
  apiKey: string
  campaignId: string
  to: string
  subject: string
  body: string
}): Promise<void> {
  const response = await fetch('https://api.instantly.ai/api/v1/lead/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: params.apiKey,
      campaign_id: params.campaignId,
      email: params.to,
      variables: {
        subject: params.subject,
        message: params.body,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Instantly API error: ${response.statusText}`)
  }
}

export default {
  createCampaign,
  sendCampaign,
}
