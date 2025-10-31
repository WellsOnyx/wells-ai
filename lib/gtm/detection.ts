/**
 * Tool Detection System
 *
 * Auto-discovers what tools the user already has:
 * - Microsoft stack (Dynamics, Outlook, Teams)
 * - Google stack (Gmail, Calendar, Workspace)
 * - Salesforce
 * - HubSpot
 * - LinkedIn Sales Navigator
 * - etc.
 *
 * Then provisions what's missing with best-in-class alternatives.
 */

import { clerkClient } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface DetectedStack {
  // CRM
  crm?: 'dynamics' | 'salesforce' | 'hubspot' | 'pipedrive' | 'none'
  crmDomain?: string
  crmAccessToken?: string

  // Email
  email?: 'outlook' | 'gmail' | 'none'
  emailAddress?: string
  emailAccessToken?: string

  // Calendar
  calendar?: 'outlook' | 'google' | 'none'
  calendarAccessToken?: string

  // Enrichment
  enrichment?: 'zoominfo' | 'clearbit' | 'apollo' | 'none'
  enrichmentApiKey?: string

  // LinkedIn
  linkedin?: 'sales-navigator' | 'basic' | 'none'
  linkedinAccessToken?: string

  // Confidence
  confidence: number
  reasoning: string
}

/**
 * Detect user's existing tool stack via conversation
 *
 * Ask Claude to analyze the user's responses and infer their stack
 */
export async function detectStackFromConversation(
  conversationHistory: string[]
): Promise<DetectedStack> {
  const prompt = `You are analyzing a conversation to detect what sales/CRM tools the user already has.

Conversation history:
${conversationHistory.join('\n')}

Based on the conversation, determine what tools the user likely has:

CRM: dynamics | salesforce | hubspot | pipedrive | none
Email: outlook | gmail | none
Calendar: outlook | google | none
Enrichment: zoominfo | clearbit | apollo | none
LinkedIn: sales-navigator | basic | none

Respond in JSON:
{
  "crm": "...",
  "email": "...",
  "calendar": "...",
  "enrichment": "...",
  "linkedin": "...",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of detection"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const result = JSON.parse(jsonMatch[0]) as DetectedStack

    console.log('Stack detection result:', result)
    return result
  } catch (error) {
    console.error('Error detecting stack:', error)

    // Fallback: assume nothing
    return {
      crm: 'none',
      email: 'none',
      calendar: 'none',
      enrichment: 'none',
      linkedin: 'none',
      confidence: 0.1,
      reasoning: 'Detection failed, assuming no existing tools',
    }
  }
}

/**
 * Detect stack from user's email domain
 *
 * @microsoft.com → Likely uses Outlook, Dynamics
 * @gmail.com → Likely uses Gmail, Google Calendar
 * Custom domain → Check MX records
 */
export async function detectStackFromEmail(email: string): Promise<Partial<DetectedStack>> {
  const domain = email.split('@')[1]

  // Microsoft email domains
  if (
    domain === 'microsoft.com' ||
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com'
  ) {
    return {
      email: 'outlook',
      calendar: 'outlook',
      crm: 'dynamics', // Assumption
      confidence: 0.8,
      reasoning: 'Microsoft email detected, likely uses Microsoft stack',
    }
  }

  // Google email domains
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return {
      email: 'gmail',
      calendar: 'google',
      confidence: 0.8,
      reasoning: 'Gmail detected, likely uses Google stack',
    }
  }

  // Custom domain - check MX records
  try {
    // In production, use DNS lookup to check MX records
    // const mx = await dns.resolveMx(domain)
    // if (mx.some(record => record.exchange.includes('outlook'))) return 'outlook'
    // if (mx.some(record => record.exchange.includes('google'))) return 'gmail'

    return {
      email: 'none',
      calendar: 'none',
      confidence: 0.3,
      reasoning: 'Custom domain, could not determine email provider',
    }
  } catch (error) {
    return {
      confidence: 0.1,
      reasoning: 'Email detection failed',
    }
  }
}

/**
 * Ask user directly what they use
 *
 * This is the most reliable method - just ask!
 */
export async function askUserAboutStack(): Promise<{
  questions: string[]
  options: Record<string, string[]>
}> {
  return {
    questions: [
      'What CRM do you use?',
      'What email system do you use?',
      'Do you have LinkedIn Sales Navigator?',
      'Do you use any data enrichment tools (ZoomInfo, Clearbit, Apollo)?',
    ],
    options: {
      crm: ['Microsoft Dynamics', 'Salesforce', 'HubSpot', 'Pipedrive', 'None/Other'],
      email: ['Outlook/Microsoft', 'Gmail/Google', 'Other'],
      linkedin: ['Sales Navigator', 'Basic LinkedIn', 'None'],
      enrichment: ['ZoomInfo', 'Clearbit', 'Apollo', 'None/Other'],
    },
  }
}

/**
 * Provision missing tools
 *
 * Based on what user has, provision what's missing
 */
export async function provisionMissingTools(
  detected: DetectedStack
): Promise<{
  crm?: string
  email?: string
  calendar?: string
  enrichment?: string
  prospecting?: string
  wellsAICost: number // Wells AI's internal cost to provide FREE stack (user pays $0)
}> {
  const provisioned: any = {}
  let wellsAICost = 0 // USER PAYS $0 - This is Wells AI's cost, recovered via 0.33% transaction fees

  // CRM
  if (detected.crm === 'none') {
    provisioned.crm = 'notion' // Free, familiar to most users
    wellsAICost += 0 // FREE for Wells AI too
  }

  // Email automation
  if (detected.email === 'none') {
    provisioned.email = 'instantly' // $30/month Wells AI internal cost (user pays $0)
    wellsAICost += 30 // Wells AI cost, recovered via 0.33% transaction fees
  }

  // Calendar
  if (detected.calendar === 'none') {
    provisioned.calendar = 'cal.com' // Free, open source
    wellsAICost += 0 // FREE for Wells AI too
  }

  // Enrichment
  if (detected.enrichment === 'none') {
    provisioned.enrichment = 'apollo' // $49/month Wells AI internal cost (user pays $0)
    wellsAICost += 49 // Wells AI cost, recovered via 0.33% transaction fees
  }

  // Prospecting
  provisioned.prospecting = 'apollo' // Same tool for enrichment + prospecting
  // No additional cost if already provisioned

  return {
    ...provisioned,
    wellsAICost, // Wells AI's internal cost (USER PAYS $0)
  }
}

/**
 * Store detected stack in user metadata
 */
export async function saveStackToUser(userId: string, stack: DetectedStack) {
  const client = await clerkClient()

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      detectedStack: {
        crm: stack.crm,
        email: stack.email,
        calendar: stack.calendar,
        enrichment: stack.enrichment,
        linkedin: stack.linkedin,
      },
      stackConfidence: stack.confidence,
      stackDetectedAt: new Date().toISOString(),
    },
  })

  console.log(`✅ Saved stack for user ${userId}:`, stack)
}

/**
 * Get user's stack from metadata
 */
export async function getUserStack(userId: string): Promise<DetectedStack | null> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const detectedStack = user.publicMetadata.detectedStack as any

  if (!detectedStack) {
    return null
  }

  return {
    crm: detectedStack.crm,
    email: detectedStack.email,
    calendar: detectedStack.calendar,
    enrichment: detectedStack.enrichment,
    linkedin: detectedStack.linkedin,
    confidence: user.publicMetadata.stackConfidence as number,
    reasoning: 'Retrieved from user metadata',
  }
}

/**
 * Complete detection flow
 *
 * 1. Try conversation analysis
 * 2. Try email domain detection
 * 3. Ask user directly
 * 4. Provision missing tools
 * 5. Save to user metadata
 */
export async function detectAndProvisionStack(
  userId: string,
  conversationHistory: string[],
  userEmail: string
): Promise<{
  detected: DetectedStack
  provisioned: any
  userCost: number // What user pays (ALWAYS $0)
  wellsAICost: number // Wells AI's internal cost
}> {
  // Step 1: Conversation analysis
  let detected = await detectStackFromConversation(conversationHistory)

  // Step 2: Email domain detection (if low confidence)
  if (detected.confidence < 0.5) {
    const emailDetection = await detectStackFromEmail(userEmail)
    detected = {
      ...detected,
      ...emailDetection,
      confidence: Math.max(detected.confidence, emailDetection.confidence || 0),
    }
  }

  // Step 3: Provision missing tools
  const provisioned = await provisionMissingTools(detected)

  // Step 4: Save to user
  await saveStackToUser(userId, detected)

  console.log(`✅ Stack detection complete for user ${userId}`)
  console.log(`   Detected: ${JSON.stringify(detected)}`)
  console.log(`   Provisioned: ${JSON.stringify(provisioned)}`)
  console.log(`   User cost: $0 (FREE - they pay 0.33% on deals only)`)
  console.log(`   Wells AI internal cost: $${provisioned.wellsAICost}/month (recovered via transaction fees)`)

  return {
    detected,
    provisioned,
    userCost: 0, // USER ALWAYS PAYS $0 upfront
    wellsAICost: provisioned.wellsAICost, // Wells AI's internal cost
  }
}

export default {
  detectStackFromConversation,
  detectStackFromEmail,
  askUserAboutStack,
  provisionMissingTools,
  saveStackToUser,
  getUserStack,
  detectAndProvisionStack,
}
