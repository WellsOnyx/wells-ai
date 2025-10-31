/**
 * Multi-Channel Outreach - Human-First Approach
 *
 * Email: Primary (Instantly)
 * SMS: ONLY if user knows them or they opted in (Twilio)
 * LinkedIn: User sends manually, we just draft (no automation)
 *
 * STRICT GUARDRAILS:
 * - No cold SMS (spam)
 * - No automated LinkedIn (ToS violation)
 * - Everything stays human
 */

import Anthropic from '@anthropic-ai/sdk'
import { sendSMS } from '@/lib/twilio'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface OutreachMessage {
  channel: 'email' | 'sms' | 'linkedin'
  to: string
  subject?: string // Email only
  body: string
  canSend: boolean // Based on guardrails
  reason?: string // Why can't send
}

/**
 * Determine if SMS is allowed
 *
 * ONLY allow if:
 * - User has existing relationship
 * - Prospect opted in
 * - NOT cold outreach
 */
export function canSendSMS(params: {
  userRelationship: 'existing' | 'opt-in' | 'cold'
  prospectPhone?: string
}): { allowed: boolean; reason: string } {
  if (!params.prospectPhone) {
    return { allowed: false, reason: 'No phone number' }
  }

  if (params.userRelationship === 'cold') {
    return {
      allowed: false,
      reason: 'Cannot send cold SMS - this is spam. Use email instead.',
    }
  }

  if (params.userRelationship === 'existing') {
    return {
      allowed: true,
      reason: 'Existing relationship - SMS is appropriate follow-up',
    }
  }

  if (params.userRelationship === 'opt-in') {
    return {
      allowed: true,
      reason: 'Prospect opted in - SMS allowed',
    }
  }

  return { allowed: false, reason: 'Unknown relationship status' }
}

/**
 * Generate multi-channel messages
 */
export async function generateMultiChannelMessages(params: {
  prospect: {
    name: string
    company: string
    title: string
    email: string
    phone?: string
    linkedin?: string
  }
  userRelationship: 'existing' | 'opt-in' | 'cold'
  context: string // e.g., "Following up from our call last week"
  productDescription: string
}): Promise<OutreachMessage[]> {
  const messages: OutreachMessage[] = []

  // Email (always allowed)
  const emailMessage = await generateEmailMessage({
    prospect: params.prospect,
    context: params.context,
    productDescription: params.productDescription,
  })

  messages.push({
    channel: 'email',
    to: params.prospect.email,
    subject: emailMessage.subject,
    body: emailMessage.body,
    canSend: true,
  })

  // SMS (only if allowed)
  const smsCheck = canSendSMS({
    userRelationship: params.userRelationship,
    prospectPhone: params.prospect.phone,
  })

  if (smsCheck.allowed) {
    const smsMessage = await generateSMSMessage({
      prospect: params.prospect,
      context: params.context,
    })

    messages.push({
      channel: 'sms',
      to: params.prospect.phone!,
      body: smsMessage,
      canSend: true,
    })
  } else {
    messages.push({
      channel: 'sms',
      to: params.prospect.phone || '',
      body: '',
      canSend: false,
      reason: smsCheck.reason,
    })
  }

  // LinkedIn (draft only, user sends manually)
  if (params.prospect.linkedin) {
    const linkedinMessage = await generateLinkedInMessage({
      prospect: params.prospect,
      context: params.context,
      productDescription: params.productDescription,
    })

    messages.push({
      channel: 'linkedin',
      to: params.prospect.linkedin,
      body: linkedinMessage,
      canSend: true, // User sends manually
      reason: 'Draft ready - send manually from your LinkedIn to stay compliant',
    })
  }

  return messages
}

/**
 * Generate email message
 */
async function generateEmailMessage(params: {
  prospect: { name: string; company: string; title: string }
  context: string
  productDescription: string
}): Promise<{ subject: string; body: string }> {
  const prompt = `Write a short, personalized email.

Prospect: ${params.prospect.name}, ${params.prospect.title} at ${params.prospect.company}
Context: ${params.context}
What we sell: ${params.productDescription}

Requirements:
- Under 100 words
- Personalized to their role
- Natural, human tone
- Clear call-to-action
- NO corporate jargon

Respond in JSON:
{
  "subject": "...",
  "body": "..."
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate SMS message (short!)
 */
async function generateSMSMessage(params: {
  prospect: { name: string }
  context: string
}): Promise<string> {
  const prompt = `Write a SHORT text message (under 160 characters).

To: ${params.prospect.name}
Context: ${params.context}

Requirements:
- VERY short (SMS, not email)
- Casual, friendly tone
- Reference existing relationship
- Clear next step

Respond with ONLY the message, no JSON.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  return content.text.trim()
}

/**
 * Generate LinkedIn InMail draft
 */
async function generateLinkedInMessage(params: {
  prospect: { name: string; company: string; title: string }
  context: string
  productDescription: string
}): Promise<string> {
  const prompt = `Write a LinkedIn InMail (under 300 characters - LinkedIn limit).

To: ${params.prospect.name}, ${params.prospect.title} at ${params.prospect.company}
Context: ${params.context}
What we sell: ${params.productDescription}

Requirements:
- Under 300 characters (LinkedIn InMail limit)
- Professional but casual
- Personalized
- Clear value prop

Respond with ONLY the message, no JSON.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  return content.text.trim()
}

/**
 * Send SMS via Twilio (only if guardrails passed)
 */
export async function sendSMSMessage(params: {
  to: string
  body: string
  from: string
  userRelationship: 'existing' | 'opt-in' | 'cold'
}): Promise<{ sent: boolean; error?: string }> {
  // Double-check guardrails
  const check = canSendSMS({
    userRelationship: params.userRelationship,
    prospectPhone: params.to,
  })

  if (!check.allowed) {
    return { sent: false, error: check.reason }
  }

  try {
    await sendSMS({
      to: params.to,
      body: params.body,
      from: params.from,
    })
    return { sent: true }
  } catch (error: any) {
    return { sent: false, error: error.message }
  }
}

export default {
  canSendSMS,
  generateMultiChannelMessages,
  sendSMSMessage,
}
