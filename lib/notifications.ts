/**
 * Notification System - Alert Jonah when deals come in
 *
 * Sends SMS + Email when:
 * - User requests supplier/product
 * - Procurement intent detected
 * - RFQ submitted
 *
 * This enables the "Procurement Concierge" model where Jonah
 * manually handles deals while automation is being built.
 */

import { sendEmail } from './resend-email'
import twilio from 'twilio'

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

// Jonah's contact info for notifications
const JONAH_PHONE = process.env.JONAH_PHONE || '+18339175812'
const JONAH_EMAIL = process.env.JONAH_EMAIL || 'jonah@wellsonyx.com'

export interface DealRequest {
  requestId: string
  category: string
  requirements: string
  buyerName?: string
  buyerEmail?: string
  buyerPhone?: string
  urgency?: 'immediate' | 'this-week' | 'this-month' | 'flexible'
  budget?: string
  quantity?: string
  conversationUrl?: string
}

/**
 * Notify Jonah when a new deal request comes in
 */
export async function notifyDealRequest(deal: DealRequest): Promise<{
  smsSuccess: boolean
  emailSuccess: boolean
  error?: string
}> {
  console.log('[NOTIFICATIONS] New deal request:', deal.requestId)

  const results = {
    smsSuccess: false,
    emailSuccess: false,
    error: undefined as string | undefined
  }

  // Format SMS message (160 chars max for best deliverability)
  const smsMessage = `🎯 NEW DEAL REQUEST

Category: ${deal.category}
${deal.buyerName ? `Buyer: ${deal.buyerName}` : 'Buyer: Anonymous'}
${deal.urgency ? `Urgency: ${deal.urgency}` : ''}

Requirements:
${deal.requirements.substring(0, 200)}${deal.requirements.length > 200 ? '...' : ''}

View: ${deal.conversationUrl || 'Check dashboard'}

Request ID: ${deal.requestId}`

  // Format email message (detailed version)
  const emailMessage = `You've got a new deal request! 🎯

**DEAL DETAILS:**
- Request ID: ${deal.requestId}
- Category: ${deal.category}
- Urgency: ${deal.urgency || 'Not specified'}

**BUYER INFO:**
- Name: ${deal.buyerName || 'Anonymous'}
- Email: ${deal.buyerEmail || 'Not provided'}
- Phone: ${deal.buyerPhone || 'Not provided'}

**REQUIREMENTS:**
${deal.requirements}

${deal.budget ? `**BUDGET:** ${deal.budget}` : ''}
${deal.quantity ? `**QUANTITY:** ${deal.quantity}` : ''}

${deal.conversationUrl ? `**VIEW CONVERSATION:**\n${deal.conversationUrl}` : ''}

---

**NEXT STEPS:**
1. Review the requirements
2. Search for suppliers manually
3. Negotiate terms
4. Present options in the chat
5. Process payment through Grain Vault (33 bps)

This is your Procurement Concierge workflow. Let's make some money!

- Wells AI`

  // Send SMS notification
  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const smsResult = await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: JONAH_PHONE,
        body: smsMessage
      })

      console.log('[NOTIFICATIONS] SMS sent:', smsResult.sid)
      results.smsSuccess = true
    } catch (error: any) {
      console.error('[NOTIFICATIONS] SMS failed:', error.message)
      results.error = `SMS failed: ${error.message}`
    }
  } else {
    console.warn('[NOTIFICATIONS] Twilio not configured - skipping SMS')
  }

  // Send email notification
  try {
    const emailResult = await sendEmail({
      to: JONAH_EMAIL,
      subject: `🎯 New Deal Request: ${deal.category} - ${deal.requestId}`,
      text: emailMessage,
      from: 'wells@grainandvault.com',
      fromName: 'Wells AI',
      replyTo: deal.buyerEmail || undefined
    })

    if (emailResult.success) {
      console.log('[NOTIFICATIONS] Email sent:', emailResult.messageId)
      results.emailSuccess = true
    } else {
      console.error('[NOTIFICATIONS] Email failed:', emailResult.error)
      results.error = results.error
        ? `${results.error}; Email failed: ${emailResult.error}`
        : `Email failed: ${emailResult.error}`
    }
  } catch (error: any) {
    console.error('[NOTIFICATIONS] Email exception:', error.message)
    results.error = results.error
      ? `${results.error}; Email exception: ${error.message}`
      : `Email exception: ${error.message}`
  }

  // Log summary
  if (results.smsSuccess && results.emailSuccess) {
    console.log('[NOTIFICATIONS] ✅ Both SMS and email sent successfully')
  } else if (results.smsSuccess || results.emailSuccess) {
    console.warn('[NOTIFICATIONS] ⚠️ Partial success:', results)
  } else {
    console.error('[NOTIFICATIONS] ❌ All notification channels failed')
  }

  return results
}

/**
 * Extract deal details from procurement intent
 */
export function extractDealDetails(messages: any[], intent: any, userData?: any): DealRequest {
  const lastMessage = messages[messages.length - 1]?.content || ''

  // Extract urgency from message
  let urgency: DealRequest['urgency'] = 'flexible'
  const lower = lastMessage.toLowerCase()
  if (lower.includes('asap') || lower.includes('urgent') || lower.includes('immediately')) {
    urgency = 'immediate'
  } else if (lower.includes('this week') || lower.includes('within a week')) {
    urgency = 'this-week'
  } else if (lower.includes('this month') || lower.includes('within a month')) {
    urgency = 'this-month'
  }

  // Extract quantity if mentioned
  const quantityMatch = lastMessage.match(/(\d+[\d,]*)\s*(units?|pieces?|items?)?/i)
  const quantity = quantityMatch ? quantityMatch[0] : undefined

  // Extract budget if mentioned
  const budgetMatch = lastMessage.match(/\$[\d,]+(\.\d{2})?/i)
  const budget = budgetMatch ? budgetMatch[0] : undefined

  return {
    requestId: intent.requestId || `req_${Date.now()}`,
    category: intent.category || 'General',
    requirements: intent.requirements || lastMessage,
    buyerName: userData?.name || intent.buyerName || 'Anonymous Buyer',
    buyerEmail: userData?.email,
    buyerPhone: userData?.phone,
    urgency,
    budget,
    quantity,
    conversationUrl: undefined // TODO: Add conversation URL when we have it
  }
}

/**
 * Quick notification for testing
 */
export async function testNotification() {
  return await notifyDealRequest({
    requestId: 'test_' + Date.now(),
    category: 'Test Notification',
    requirements: 'This is a test notification from the Wells AI notification system. If you received this, everything is working!',
    buyerName: 'Test User',
    urgency: 'immediate'
  })
}
