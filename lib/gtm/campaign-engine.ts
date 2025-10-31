/**
 * Campaign Engine - MVP Version
 *
 * Simple campaign flow: ICP → Search → Generate → Approve → Send
 * Ship tonight
 */

import Anthropic from '@anthropic-ai/sdk'
import { buildICPFromNotion, icpToSearchCriteria, type ICP } from './icp-analyzer'
import { searchApollo, type ApolloProspect } from './apollo-search'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface Campaign {
  id: string
  userId: string
  icp: ICP
  prospects: ApolloProspect[]
  messages: Array<{
    prospectId: string
    subject: string
    body: string
    approved: boolean
    sent: boolean
    sentAt?: Date
  }>
  status: 'draft' | 'approved' | 'sending' | 'sent'
  createdAt: Date
}

/**
 * Create campaign from user's request
 */
export async function createCampaign(params: {
  userId: string
  userRequest: string // e.g., "Find me customers who buy vegetables"
  notionApiKey: string
  notionDealsDbId: string
}): Promise<Campaign> {
  // Step 1: Build ICP from won deals
  console.log('Building ICP from Notion...')
  const icp = await buildICPFromNotion(params.notionApiKey, params.notionDealsDbId)

  // Step 2: Search Apollo for prospects
  console.log('Searching Apollo for prospects...')
  const searchCriteria = icpToSearchCriteria(icp)
  const prospects = await searchApollo({
    titles: searchCriteria.titles,
    industries: searchCriteria.industries,
    limit: 25,
  })

  // Step 3: Generate personalized messages
  console.log('Generating personalized messages...')
  const messages = await Promise.all(
    prospects.map((prospect) =>
      generateMessage({
        prospect,
        icp,
        userRequest: params.userRequest,
      })
    )
  )

  const campaign: Campaign = {
    id: `campaign_${Date.now()}`,
    userId: params.userId,
    icp,
    prospects,
    messages: messages.map((msg, i) => ({
      prospectId: prospects[i].id,
      subject: msg.subject,
      body: msg.body,
      approved: false,
      sent: false,
    })),
    status: 'draft',
    createdAt: new Date(),
  }

  console.log(`✅ Campaign created: ${campaign.id}`)
  console.log(`   Prospects: ${prospects.length}`)
  console.log(`   Messages generated: ${messages.length}`)

  return campaign
}

/**
 * Generate personalized email for prospect
 */
async function generateMessage(params: {
  prospect: ApolloProspect
  icp: ICP
  userRequest: string
}): Promise<{ subject: string; body: string }> {
  const { prospect, icp } = params

  const prompt = `You are a sales development rep. Write a personalized cold email.

PROSPECT:
Name: ${prospect.name}
Title: ${prospect.title}
Company: ${prospect.company}

IDEAL CUSTOMER PROFILE:
${icp.summary}

Common pain points: ${icp.commonPainPoints.join(', ')}

INSTRUCTIONS:
- Keep it short (under 100 words)
- Personalize to their role and company
- Mention a specific pain point relevant to them
- Include a clear call-to-action
- Sound human, not salesy
- NO corporate jargon

Respond in JSON:
{
  "subject": "Email subject line",
  "body": "Email body"
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response')
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON in response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Send campaign via Instantly
 */
export async function sendCampaign(
  campaign: Campaign,
  instantlyApiKey: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const message of campaign.messages) {
    if (!message.approved) continue

    try {
      const prospect = campaign.prospects.find((p) => p.id === message.prospectId)!

      await sendEmailViaInstantly({
        apiKey: instantlyApiKey,
        to: prospect.email,
        subject: message.subject,
        body: message.body,
      })

      message.sent = true
      message.sentAt = new Date()
      sent++
    } catch (error) {
      console.error(`Failed to send to ${message.prospectId}:`, error)
      failed++
    }
  }

  campaign.status = 'sent'
  return { sent, failed }
}

/**
 * Send email via Instantly API
 */
async function sendEmailViaInstantly(params: {
  apiKey: string
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
      campaign_id: process.env.INSTANTLY_CAMPAIGN_ID,
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
