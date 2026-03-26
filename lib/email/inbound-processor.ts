// @ts-nocheck
/**
 * Inbound Email Processor
 *
 * Handles incoming emails to wells@wellsonyx.com
 * Parses, classifies intent, routes, and auto-responds when appropriate.
 *
 * Features:
 * - Parse incoming email (from Resend inbound webhook)
 * - Extract sender, subject, body, thread ID, attachments
 * - Classify intent (interested, not interested, question, meeting request)
 * - Route to appropriate handler
 * - Auto-respond when appropriate
 * - Link to existing threads/contacts
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { sendWellsEmail } from './wells-native-email'

// ============================================================================
// TYPES
// ============================================================================

export interface InboundEmail {
  messageId: string
  from: {
    email: string
    name?: string
  }
  to: string[]
  cc?: string[]
  subject: string
  textBody?: string
  htmlBody?: string
  date: Date
  inReplyTo?: string
  references?: string
  threadId?: string
  attachments?: InboundAttachment[]
  headers?: Record<string, string>
  rawPayload?: any
}

export interface InboundAttachment {
  filename: string
  contentType: string
  size: number
  content?: Buffer | string
  contentId?: string
}

export type EmailIntent =
  | 'interested'           // Positive response, wants to proceed
  | 'not_interested'       // Negative response, not interested
  | 'question'             // Has a question to answer
  | 'meeting_request'      // Wants to schedule a meeting
  | 'meeting_confirmation' // Confirming a meeting time
  | 'information'          // Providing requested information
  | 'follow_up'            // Following up on previous conversation
  | 'unsubscribe'          // Wants to stop receiving emails
  | 'out_of_office'        // Auto-reply OOO
  | 'bounce'               // Delivery failure
  | 'spam'                 // Spam/irrelevant
  | 'unknown'              // Cannot classify

export interface IntentClassification {
  intent: EmailIntent
  confidence: number
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'high' | 'medium' | 'low'
  summary: string
  suggestedAction?: string
  extractedEntities?: {
    dates?: string[]
    times?: string[]
    questions?: string[]
    requestedInfo?: string[]
    meetingDetails?: {
      proposedTime?: string
      duration?: string
      topic?: string
    }
  }
}

export interface ProcessedEmail {
  id: string
  inboundEmail: InboundEmail
  classification: IntentClassification
  linkedThread?: string
  linkedContact?: string
  autoResponded: boolean
  autoResponseId?: string
  requiresHumanReview: boolean
  processedAt: Date
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// RESEND API - FETCH FULL EMAIL CONTENT
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

/**
 * Fetch full email content from Resend API
 * Webhook only contains metadata, need to call API for body/attachments
 */
export async function fetchEmailFromResend(emailId: string): Promise<any> {
  if (!RESEND_API_KEY) {
    console.error('[Inbound] RESEND_API_KEY not configured')
    return null
  }

  try {
    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    })

    if (!response.ok) {
      console.error(`[Inbound] Failed to fetch email ${emailId}: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`[Inbound] Error fetching email ${emailId}:`, error)
    return null
  }
}

/**
 * Fetch attachment content from Resend API
 */
export async function fetchAttachmentFromResend(attachmentId: string): Promise<Buffer | null> {
  if (!RESEND_API_KEY) {
    return null
  }

  try {
    const response = await fetch(`https://api.resend.com/attachments/${attachmentId}`, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
    })

    if (!response.ok) {
      console.error(`[Inbound] Failed to fetch attachment ${attachmentId}: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error(`[Inbound] Error fetching attachment ${attachmentId}:`, error)
    return null
  }
}

/**
 * Process webhook event - fetch full content if needed
 */
export async function processWebhookEvent(webhookPayload: any): Promise<InboundEmail | null> {
  const eventType = webhookPayload.type || webhookPayload.event

  // email.received webhook - need to fetch full content
  if (eventType === 'email.received') {
    const emailId = webhookPayload.data?.email_id || webhookPayload.email_id

    if (!emailId) {
      console.error('[Inbound] No email_id in webhook payload')
      // Try to parse whatever we have
      return parseResendInbound(webhookPayload.data || webhookPayload)
    }

    // Fetch full email content from API
    const fullEmail = await fetchEmailFromResend(emailId)

    if (fullEmail) {
      return parseResendInbound(fullEmail)
    }

    // Fallback to webhook data
    return parseResendInbound(webhookPayload.data || webhookPayload)
  }

  // Other event types (bounces, complaints, etc.) - parse directly
  return parseResendInbound(webhookPayload.data || webhookPayload)
}

// ============================================================================
// EMAIL PARSING
// ============================================================================

/**
 * Parse raw email webhook payload from Resend
 */
export function parseResendInbound(payload: any): InboundEmail {
  // Resend inbound format
  const from = payload.from || payload.envelope?.from
  const fromEmail = typeof from === 'string'
    ? from
    : from?.address || from?.email

  const fromName = typeof from === 'object' ? from?.name : undefined

  return {
    messageId: payload.messageId || payload.message_id || uuidv4(),
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: Array.isArray(payload.to)
      ? payload.to.map((t: any) => typeof t === 'string' ? t : t.address)
      : [payload.to],
    cc: payload.cc
      ? Array.isArray(payload.cc)
        ? payload.cc.map((c: any) => typeof c === 'string' ? c : c.address)
        : [payload.cc]
      : undefined,
    subject: payload.subject || '(no subject)',
    textBody: payload.text || payload.text_body || payload.body?.text,
    htmlBody: payload.html || payload.html_body || payload.body?.html,
    date: payload.date ? new Date(payload.date) : new Date(),
    inReplyTo: payload.inReplyTo || payload.in_reply_to || payload.headers?.['in-reply-to'],
    references: payload.references || payload.headers?.references,
    threadId: extractThreadId(payload),
    attachments: parseAttachments(payload.attachments),
    headers: payload.headers,
    rawPayload: payload,
  }
}

function extractThreadId(payload: any): string | undefined {
  // Try to extract thread ID from references or in-reply-to
  const references = payload.references || payload.headers?.references
  const inReplyTo = payload.inReplyTo || payload.in_reply_to || payload.headers?.['in-reply-to']

  if (references) {
    // First reference is usually the original message
    const refs = references.split(/\s+/)
    if (refs.length > 0) return refs[0]
  }

  if (inReplyTo) {
    return inReplyTo
  }

  return undefined
}

function parseAttachments(attachments: any[]): InboundAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined

  return attachments.map(att => ({
    filename: att.filename || att.name || 'attachment',
    contentType: att.contentType || att.content_type || att.type || 'application/octet-stream',
    size: att.size || 0,
    content: att.content || att.data,
    contentId: att.contentId || att.content_id || att.cid,
  }))
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const INTENT_CLASSIFICATION_PROMPT = `You are an email intent classifier for Wells AI, a business assistant.

Analyze this incoming email and classify its intent. Consider:
1. The sender's primary purpose
2. Their sentiment (positive/neutral/negative)
3. Urgency level
4. Any specific entities (dates, questions, requests)

Email:
From: {from}
Subject: {subject}
Body:
{body}

Respond in JSON format only:
{
  "intent": "interested|not_interested|question|meeting_request|meeting_confirmation|information|follow_up|unsubscribe|out_of_office|bounce|spam|unknown",
  "confidence": 0.0-1.0,
  "sentiment": "positive|neutral|negative",
  "urgency": "high|medium|low",
  "summary": "One sentence summary of what they want",
  "suggestedAction": "What Wells should do",
  "extractedEntities": {
    "dates": ["any dates mentioned"],
    "times": ["any times mentioned"],
    "questions": ["specific questions asked"],
    "requestedInfo": ["info they need"],
    "meetingDetails": {
      "proposedTime": "if they suggest a time",
      "duration": "if mentioned",
      "topic": "what they want to discuss"
    }
  }
}

Be concise. Classify accurately. If unsure, use "unknown" with lower confidence.`

export async function classifyIntent(email: InboundEmail): Promise<IntentClassification> {
  // Quick pattern matching for obvious cases
  const quickClassification = quickClassify(email)
  if (quickClassification) return quickClassification

  // Use AI for complex classification
  try {
    const body = email.textBody || email.htmlBody?.replace(/<[^>]*>/g, ' ') || ''

    const prompt = INTENT_CLASSIFICATION_PROMPT
      .replace('{from}', `${email.from.name || ''} <${email.from.email}>`)
      .replace('{subject}', email.subject)
      .replace('{body}', body.substring(0, 2000))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      messages: [
        { role: 'user', content: prompt },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          intent: parsed.intent || 'unknown',
          confidence: parsed.confidence || 0.5,
          sentiment: parsed.sentiment || 'neutral',
          urgency: parsed.urgency || 'medium',
          summary: parsed.summary || 'Unable to summarize',
          suggestedAction: parsed.suggestedAction,
          extractedEntities: parsed.extractedEntities,
        }
      }
    }
  } catch (error) {
    console.error('[InboundProcessor] Classification failed:', error)
  }

  return {
    intent: 'unknown',
    confidence: 0.3,
    sentiment: 'neutral',
    urgency: 'medium',
    summary: 'Unable to classify email',
  }
}

function quickClassify(email: InboundEmail): IntentClassification | null {
  const subject = email.subject.toLowerCase()
  const body = (email.textBody || email.htmlBody || '').toLowerCase()

  // Out of office
  if (
    subject.includes('out of office') ||
    subject.includes('ooo') ||
    subject.includes('automatic reply') ||
    body.includes('i am currently out of the office')
  ) {
    return {
      intent: 'out_of_office',
      confidence: 0.95,
      sentiment: 'neutral',
      urgency: 'low',
      summary: 'Automated out-of-office response',
    }
  }

  // Bounce/delivery failure
  if (
    subject.includes('delivery failed') ||
    subject.includes('undeliverable') ||
    subject.includes('mail delivery') ||
    email.from.email.includes('mailer-daemon') ||
    email.from.email.includes('postmaster')
  ) {
    return {
      intent: 'bounce',
      confidence: 0.95,
      sentiment: 'negative',
      urgency: 'medium',
      summary: 'Email delivery failure',
    }
  }

  // Unsubscribe
  if (
    subject.includes('unsubscribe') ||
    body.includes('please remove me') ||
    body.includes('stop emailing') ||
    body.includes('take me off')
  ) {
    return {
      intent: 'unsubscribe',
      confidence: 0.9,
      sentiment: 'negative',
      urgency: 'high',
      summary: 'User wants to unsubscribe',
    }
  }

  // Clear positive interest
  if (
    body.includes("yes, i'm interested") ||
    body.includes("sounds great") ||
    body.includes("let's do it") ||
    body.includes("i'd love to")
  ) {
    return {
      intent: 'interested',
      confidence: 0.85,
      sentiment: 'positive',
      urgency: 'high',
      summary: 'Positive interest expressed',
    }
  }

  // Clear negative
  if (
    body.includes('not interested') ||
    body.includes('no thank you') ||
    body.includes('no thanks') ||
    body.includes("don't contact me")
  ) {
    return {
      intent: 'not_interested',
      confidence: 0.9,
      sentiment: 'negative',
      urgency: 'low',
      summary: 'Not interested in continuing',
    }
  }

  return null
}

// ============================================================================
// EMAIL ROUTING
// ============================================================================

interface RouteResult {
  action: 'auto_respond' | 'queue_for_review' | 'forward' | 'archive' | 'ignore'
  responseTemplate?: string
  forwardTo?: string
  notes?: string
}

export function routeEmail(
  email: InboundEmail,
  classification: IntentClassification
): RouteResult {
  switch (classification.intent) {
    case 'bounce':
      return {
        action: 'archive',
        notes: 'Delivery failure - marked recipient as invalid',
      }

    case 'out_of_office':
      return {
        action: 'archive',
        notes: 'OOO auto-reply - no action needed',
      }

    case 'unsubscribe':
      return {
        action: 'auto_respond',
        responseTemplate: 'unsubscribe_confirmation',
        notes: 'User unsubscribed - confirmation sent',
      }

    case 'not_interested':
      return {
        action: 'archive',
        notes: 'Not interested - marked and archived',
      }

    case 'spam':
      return {
        action: 'ignore',
        notes: 'Spam detected - ignored',
      }

    case 'interested':
      return {
        action: 'auto_respond',
        responseTemplate: 'interested_follow_up',
        notes: 'Positive response - follow-up sent',
      }

    case 'meeting_request':
    case 'meeting_confirmation':
      return {
        action: 'queue_for_review',
        notes: 'Meeting request - needs human scheduling',
      }

    case 'question':
      // Questions with high confidence can be auto-answered
      if (classification.confidence > 0.8 && isSimpleQuestion(email)) {
        return {
          action: 'auto_respond',
          responseTemplate: 'question_response',
          notes: 'Simple question - auto-response attempted',
        }
      }
      return {
        action: 'queue_for_review',
        notes: 'Question requires human response',
      }

    case 'information':
    case 'follow_up':
    default:
      return {
        action: 'queue_for_review',
        notes: 'Needs human review',
      }
  }
}

function isSimpleQuestion(email: InboundEmail): boolean {
  const body = email.textBody || email.htmlBody || ''

  // Simple questions are short and contain common question patterns
  return (
    body.length < 500 &&
    (body.includes('?') || body.toLowerCase().includes('what') || body.toLowerCase().includes('how'))
  )
}

// ============================================================================
// AUTO-RESPONSE GENERATION
// ============================================================================

interface AutoResponseParams {
  email: InboundEmail
  classification: IntentClassification
  template: string
  userId?: string
}

const AUTO_RESPONSE_TEMPLATES: Record<string, string> = {
  unsubscribe_confirmation: `Hey {firstName},

Got it - you're now unsubscribed. You won't hear from us again unless you reach out.

If this was a mistake or you change your mind, just reply to this email.

— Wells`,

  interested_follow_up: `Hey {firstName},

Glad to hear you're interested! Let me get the ball rolling.

{personalized_next_step}

What works better for you - a quick call this week, or should I send over some more details first?

— Wells`,

  question_response: `Hey {firstName},

Good question.

{ai_generated_answer}

Did that help? Happy to dig deeper if you need more.

— Wells`,
}

export async function generateAutoResponse(params: AutoResponseParams): Promise<string | null> {
  const { email, classification, template } = params

  const templateText = AUTO_RESPONSE_TEMPLATES[template]
  if (!templateText) return null

  const firstName = extractFirstName(email.from.name, email.from.email)

  // Replace basic variables
  let response = templateText
    .replace(/{firstName}/g, firstName)
    .replace(/{email}/g, email.from.email)

  // Handle AI-generated parts
  if (template === 'question_response' && classification.extractedEntities?.questions) {
    const answer = await generateQuestionAnswer(
      classification.extractedEntities.questions,
      email.textBody || ''
    )
    response = response.replace(/{ai_generated_answer}/g, answer)
  }

  if (template === 'interested_follow_up') {
    const nextStep = await generatePersonalizedNextStep(email, classification)
    response = response.replace(/{personalized_next_step}/g, nextStep)
  }

  return response
}

function extractFirstName(name?: string, email?: string): string {
  if (name) {
    return name.split(' ')[0]
  }
  if (email) {
    const local = email.split('@')[0]
    // Try to extract a name from email like john.doe@company.com
    const parts = local.split(/[._-]/)
    if (parts.length > 0) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    }
  }
  return 'there'
}

async function generateQuestionAnswer(questions: string[], context: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 300,
      system: `You are Wells, a direct and helpful business AI assistant.
Answer questions briefly and honestly. No corporate speak. Be helpful.
If you don't know something, say so and offer to find out.`,
      messages: [
        {
          role: 'user',
          content: `Someone emailed with these questions: ${questions.join(', ')}

Context from their email: ${context.substring(0, 500)}

Give a brief, helpful response in 2-3 sentences.`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }
  } catch (error) {
    console.error('[InboundProcessor] Failed to generate answer:', error)
  }

  return "I'll look into this and get back to you shortly."
}

async function generatePersonalizedNextStep(
  email: InboundEmail,
  classification: IntentClassification
): Promise<string> {
  // Try to determine what they're interested in from the original conversation
  const context = email.textBody || email.htmlBody || ''

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 150,
      system: `You are Wells. Based on someone's positive reply email, suggest ONE specific next step.
Be concise - one sentence. Don't be vague. Give a concrete action.`,
      messages: [
        {
          role: 'user',
          content: `They replied positively to our outreach. Their email says: ${context.substring(0, 500)}

Summary: ${classification.summary}

What's the ONE best next step to suggest?`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }
  } catch (error) {
    console.error('[InboundProcessor] Failed to generate next step:', error)
  }

  return "I'll put together some specific options based on what you're looking for."
}

// ============================================================================
// MAIN PROCESSING PIPELINE
// ============================================================================

export async function processInboundEmail(
  payload: any,
  userId?: string
): Promise<ProcessedEmail> {
  const processId = uuidv4()
  console.log(`[InboundProcessor] Processing email ${processId}`)

  // 1. Parse the email
  const email = parseResendInbound(payload)
  console.log(`[InboundProcessor] Parsed email from ${email.from.email}`)

  // 2. Classify intent
  const classification = await classifyIntent(email)
  console.log(`[InboundProcessor] Classified as ${classification.intent} (${classification.confidence})`)

  // 3. Link to existing thread/contact
  const linkedThread = await findLinkedThread(email)
  const linkedContact = await findOrCreateContact(email.from)

  // 4. Determine routing
  const route = routeEmail(email, classification)
  console.log(`[InboundProcessor] Route action: ${route.action}`)

  // 5. Handle based on route
  let autoResponded = false
  let autoResponseId: string | undefined

  if (route.action === 'auto_respond' && route.responseTemplate) {
    const response = await generateAutoResponse({
      email,
      classification,
      template: route.responseTemplate,
      userId,
    })

    if (response) {
      // Send the auto-response
      const sendResult = await sendWellsEmail(userId || 'system', {
        to: email.from.email,
        subject: `Re: ${email.subject}`,
        html: `<p>${response.replace(/\n/g, '<br>')}</p>`,
        text: response,
        inReplyTo: email.messageId,
        references: email.references ? `${email.references} ${email.messageId}` : email.messageId,
        threadId: linkedThread || undefined,
      })

      autoResponded = sendResult.success
      autoResponseId = sendResult.messageId
      console.log(`[InboundProcessor] Auto-response sent: ${autoResponded}`)
    }
  }

  // Handle unsubscribe
  if (classification.intent === 'unsubscribe') {
    await handleUnsubscribe(email.from.email)
  }

  // Handle bounce
  if (classification.intent === 'bounce') {
    await handleBounce(email)
  }

  // 6. Store processed email
  const processedEmail: ProcessedEmail = {
    id: processId,
    inboundEmail: email,
    classification,
    linkedThread: linkedThread || undefined,
    linkedContact: linkedContact || undefined,
    autoResponded,
    autoResponseId,
    requiresHumanReview: route.action === 'queue_for_review',
    processedAt: new Date(),
  }

  await storeProcessedEmail(processedEmail)

  return processedEmail
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findLinkedThread(email: InboundEmail): Promise<string | null> {
  if (!email.inReplyTo && !email.references) return null

  try {
    // Try to find by message reference
    const result = await query(
      `SELECT thread_id FROM email_messages
       WHERE resend_message_id = $1 OR id = $1
       LIMIT 1`,
      [email.inReplyTo]
    )

    if (result?.rows?.[0]) {
      return result.rows[0].thread_id
    }

    // Try subject matching as fallback
    const subjectWithoutRe = email.subject.replace(/^(Re|Fwd|Fw):\s*/i, '')
    const subjectResult = await query(
      `SELECT id FROM email_threads
       WHERE subject ILIKE $1
       AND last_message_at > NOW() - INTERVAL '30 days'
       ORDER BY last_message_at DESC
       LIMIT 1`,
      [`%${subjectWithoutRe}%`]
    )

    if (subjectResult?.rows?.[0]) {
      return subjectResult.rows[0].id
    }
  } catch (error) {
    console.error('[InboundProcessor] Thread lookup failed:', error)
  }

  return null
}

async function findOrCreateContact(from: { email: string; name?: string }): Promise<string | null> {
  try {
    // Check if contact exists
    const existing = await query(
      `SELECT id FROM contacts WHERE email = $1 LIMIT 1`,
      [from.email]
    )

    if (existing?.rows?.[0]) {
      return existing.rows[0].id
    }

    // Create new contact
    const id = uuidv4()
    await query(
      `INSERT INTO contacts (id, email, name, source, created_at)
       VALUES ($1, $2, $3, 'inbound_email', NOW())
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, contacts.name)
       RETURNING id`,
      [id, from.email, from.name]
    )

    return id
  } catch (error) {
    console.error('[InboundProcessor] Contact lookup failed:', error)
    return null
  }
}

async function handleUnsubscribe(email: string): Promise<void> {
  try {
    await query(
      `INSERT INTO email_unsubscribes (email, reason, created_at)
       VALUES ($1, 'inbound_request', NOW())
       ON CONFLICT (email) DO NOTHING`,
      [email]
    )
    console.log(`[InboundProcessor] Unsubscribed: ${email}`)
  } catch (error) {
    console.error('[InboundProcessor] Unsubscribe failed:', error)
  }
}

async function handleBounce(email: InboundEmail): Promise<void> {
  // Extract the bounced email from the message
  const body = email.textBody || email.htmlBody || ''
  const emailMatch = body.match(/[\w.-]+@[\w.-]+\.\w+/)

  if (emailMatch) {
    try {
      await query(
        `UPDATE email_accounts SET
          is_valid = false,
          bounce_count = COALESCE(bounce_count, 0) + 1,
          last_bounce_at = NOW()
         WHERE email = $1`,
        [emailMatch[0]]
      )
      console.log(`[InboundProcessor] Marked bounced: ${emailMatch[0]}`)
    } catch (error) {
      console.error('[InboundProcessor] Bounce handling failed:', error)
    }
  }
}

async function storeProcessedEmail(processed: ProcessedEmail): Promise<void> {
  try {
    await query(
      `INSERT INTO email_inbound_log (
        id, message_id, from_email, from_name, to_emails,
        subject, text_body, html_body,
        intent, confidence, sentiment, urgency, summary,
        linked_thread_id, linked_contact_id,
        auto_responded, auto_response_id, requires_review,
        raw_payload, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        processed.id,
        processed.inboundEmail.messageId,
        processed.inboundEmail.from.email,
        processed.inboundEmail.from.name,
        processed.inboundEmail.to,
        processed.inboundEmail.subject,
        processed.inboundEmail.textBody,
        processed.inboundEmail.htmlBody,
        processed.classification.intent,
        processed.classification.confidence,
        processed.classification.sentiment,
        processed.classification.urgency,
        processed.classification.summary,
        processed.linkedThread,
        processed.linkedContact,
        processed.autoResponded,
        processed.autoResponseId,
        processed.requiresHumanReview,
        JSON.stringify(processed.inboundEmail.rawPayload),
        processed.processedAt,
      ]
    )
  } catch (error) {
    console.error('[InboundProcessor] Failed to store processed email:', error)
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get emails pending human review
 */
export async function getPendingReview(
  userId?: string,
  limit = 50
): Promise<ProcessedEmail[]> {
  try {
    const result = await query(
      `SELECT * FROM email_inbound_log
       WHERE requires_review = true
       ORDER BY processed_at DESC
       LIMIT $1`,
      [limit]
    )

    return (result?.rows || []).map(rowToProcessedEmail)
  } catch (error) {
    console.error('[InboundProcessor] Failed to get pending review:', error)
    return []
  }
}

/**
 * Mark an email as reviewed
 */
export async function markReviewed(
  emailId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  try {
    await query(
      `UPDATE email_inbound_log SET
        requires_review = false,
        reviewed_by = $2,
        review_notes = $3,
        reviewed_at = NOW()
       WHERE id = $1`,
      [emailId, reviewedBy, notes]
    )
  } catch (error) {
    console.error('[InboundProcessor] Failed to mark reviewed:', error)
  }
}

function rowToProcessedEmail(row: any): ProcessedEmail {
  return {
    id: row.id,
    inboundEmail: {
      messageId: row.message_id,
      from: { email: row.from_email, name: row.from_name },
      to: row.to_emails,
      subject: row.subject,
      textBody: row.text_body,
      htmlBody: row.html_body,
      date: new Date(row.processed_at),
    },
    classification: {
      intent: row.intent,
      confidence: row.confidence,
      sentiment: row.sentiment,
      urgency: row.urgency,
      summary: row.summary,
    },
    linkedThread: row.linked_thread_id,
    linkedContact: row.linked_contact_id,
    autoResponded: row.auto_responded,
    autoResponseId: row.auto_response_id,
    requiresHumanReview: row.requires_review,
    processedAt: new Date(row.processed_at),
  }
}

export default {
  parseResendInbound,
  classifyIntent,
  routeEmail,
  generateAutoResponse,
  processInboundEmail,
  getPendingReview,
  markReviewed,
}
