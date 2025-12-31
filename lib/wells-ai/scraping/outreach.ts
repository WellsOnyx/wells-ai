/**
 * Automated Outreach to Scraped Suppliers
 *
 * After finding suppliers, WellsAI sends personalized outreach
 * with the specific buyer opportunity.
 */

import { v4 as uuidv4 } from 'uuid'
import { ScrapedSupplier, SupplierOutreach } from './types'
import { sendEmail } from '@/lib/email'

// ============================================================================
// OUTREACH TEMPLATES
// ============================================================================

interface OutreachContext {
  supplier: ScrapedSupplier
  buyerRequest?: {
    id: string
    category: string
    subcategory?: string
    requirements: string
    location?: string
    budget?: number
    timeline?: string
    companyName?: string
  }
}

export function generateOutreachEmail(context: OutreachContext): { subject: string; html: string } {
  const { supplier, buyerRequest } = context

  // Personalization
  const firstName = supplier.contactName?.split(' ')[0] || 'there'
  const companyName = supplier.name
  const buyerCompany = buyerRequest?.companyName || 'a company'
  const category = buyerRequest?.category || 'services'

  const subject = buyerRequest
    ? `${buyerCompany} is looking for ${category} - interested?`
    : `Quick question about ${companyName}`

  const html = buyerRequest
    ? generateBuyerMatchEmail(context, firstName, companyName, buyerCompany)
    : generateColdIntroEmail(context, firstName, companyName)

  return { subject, html }
}

function generateBuyerMatchEmail(
  context: OutreachContext,
  firstName: string,
  companyName: string,
  buyerCompany: string
): string {
  const { buyerRequest } = context

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .opportunity { background: #f8f9fa; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .cta { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi ${firstName},</p>

    <p>I came across ${companyName} while researching suppliers for one of our buyers.</p>

    <p><strong>${buyerCompany} is actively looking for a ${buyerRequest?.category} provider</strong>, and your company looks like a potential fit.</p>

    <div class="opportunity">
      <strong>Quick Details:</strong><br>
      ${buyerRequest?.requirements ? `<strong>Need:</strong> ${buyerRequest.requirements}<br>` : ''}
      ${buyerRequest?.location ? `<strong>Location:</strong> ${buyerRequest.location}<br>` : ''}
      ${buyerRequest?.budget ? `<strong>Budget:</strong> $${buyerRequest.budget.toLocaleString()}<br>` : ''}
      ${buyerRequest?.timeline ? `<strong>Timeline:</strong> ${buyerRequest.timeline}` : ''}
    </div>

    <p>If this sounds interesting, I can connect you directly with the buyer. No commitment, just an intro.</p>

    <a href="https://wellsonyx.com/wells-ai/sell?ref=outreach&request=${buyerRequest?.id}" class="cta">
      I'm Interested →
    </a>

    <p>If now isn't the right time, no worries at all. But if you know someone who might be a better fit, feel free to forward this along.</p>

    <p>Best,<br>
    <strong>Wells AI</strong><br>
    <em>AI-powered procurement matching</em></p>

    <div class="footer">
      <p>You're receiving this because we found your company while sourcing suppliers for our network.
      <a href="https://wellsonyx.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
`
}

function generateColdIntroEmail(
  context: OutreachContext,
  firstName: string,
  companyName: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .cta { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi ${firstName},</p>

    <p>I came across ${companyName} and thought you might be interested in a new way to find customers.</p>

    <p><strong>Wells AI</strong> is an AI-powered procurement network where businesses post what they need to buy, and we match them with the right suppliers.</p>

    <p>No cold calling. No RFP hunting. Buyers come to you with real budgets and timelines.</p>

    <p>Would you be open to creating a supplier profile? It's free, takes 5 minutes, and puts you in front of buyers actively looking for what you sell.</p>

    <a href="https://wellsonyx.com/wells-ai/sell?ref=outreach" class="cta">
      Create Supplier Profile →
    </a>

    <p>No strings attached. Just more inbound opportunities.</p>

    <p>Best,<br>
    <strong>Wells AI</strong><br>
    <em>AI-powered procurement matching</em></p>

    <div class="footer">
      <p>You're receiving this because we found your company while building our supplier network.
      <a href="https://wellsonyx.com/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
`
}

// ============================================================================
// OUTREACH EXECUTION
// ============================================================================

export async function sendOutreachToSupplier(
  supplier: ScrapedSupplier,
  buyerRequest?: OutreachContext['buyerRequest']
): Promise<SupplierOutreach | null> {
  // Need an email to send outreach
  if (!supplier.email) {
    console.log(`No email for supplier ${supplier.name}, skipping outreach`)
    return null
  }

  const context: OutreachContext = { supplier, buyerRequest }
  const { subject, html } = generateOutreachEmail(context)

  // Create outreach record
  const outreach: SupplierOutreach = {
    id: uuidv4(),
    scrapedSupplierId: supplier.id,
    scrapingJobId: '', // Will be set by caller
    buyerRequestId: buyerRequest?.id,
    contactMethod: 'email',
    contactEmail: supplier.email,
    subject,
    message: html,
    status: 'pending',
    createdAt: new Date(),
  }

  try {
    // Send the email
    const sent = await sendEmail({
      to: supplier.email,
      subject,
      html,
    })

    if (sent) {
      outreach.status = 'sent'
      outreach.sentAt = new Date()
      console.log(`Outreach sent to ${supplier.email} for ${supplier.name}`)
    } else {
      outreach.status = 'bounced'
      console.warn(`Failed to send outreach to ${supplier.email}`)
    }
  } catch (error) {
    outreach.status = 'bounced'
    console.error(`Error sending outreach to ${supplier.email}:`, error)
  }

  return outreach
}

// ============================================================================
// BATCH OUTREACH
// ============================================================================

interface BatchOutreachOptions {
  suppliers: ScrapedSupplier[]
  buyerRequest?: OutreachContext['buyerRequest']
  maxPerDay?: number
  delayMs?: number
}

export async function sendBatchOutreach(options: BatchOutreachOptions): Promise<SupplierOutreach[]> {
  const { suppliers, buyerRequest, maxPerDay = 50, delayMs = 5000 } = options

  const results: SupplierOutreach[] = []
  const suppliersWithEmail = suppliers.filter(s => s.email)

  // Limit to maxPerDay
  const toSend = suppliersWithEmail.slice(0, maxPerDay)

  for (const supplier of toSend) {
    const outreach = await sendOutreachToSupplier(supplier, buyerRequest)
    if (outreach) {
      results.push(outreach)
    }

    // Delay between sends to avoid spam filters
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  console.log(`Batch outreach complete: ${results.length}/${toSend.length} sent`)
  return results
}

// ============================================================================
// LINKEDIN OUTREACH (Message Templates)
// ============================================================================

export function generateLinkedInMessage(context: OutreachContext): string {
  const { supplier, buyerRequest } = context
  const companyName = supplier.name

  if (buyerRequest) {
    return `Hi! I came across ${companyName} while sourcing suppliers for a buyer in my network.

They're looking for ${buyerRequest.category} and your company looks like a potential fit.

Would you be open to a quick intro? No commitment - just connecting supply with demand.

Happy to share more details if interested.`
  }

  return `Hi! I came across ${companyName} and wanted to reach out.

I run Wells AI - we help businesses find qualified suppliers through AI-powered matching. Buyers post what they need, we match them with the right suppliers.

Would you be interested in joining our supplier network? It's free and puts you in front of buyers actively looking for what you sell.

Let me know if you'd like to learn more.`
}

// ============================================================================
// PHONE OUTREACH (Script Templates)
// ============================================================================

export function generatePhoneScript(context: OutreachContext): string {
  const { supplier, buyerRequest } = context
  const companyName = supplier.name

  if (buyerRequest) {
    return `
PHONE SCRIPT - BUYER MATCH

Intro:
"Hi, this is [Name] from Wells AI. I'm calling because we have a buyer actively looking for ${buyerRequest.category}, and ${companyName} came up as a potential fit."

Hook:
"They're looking for: ${buyerRequest.requirements}"
${buyerRequest.budget ? `"Budget is around $${buyerRequest.budget.toLocaleString()}"` : ''}
${buyerRequest.timeline ? `"Timeline is ${buyerRequest.timeline}"` : ''}

Ask:
"Is this something you'd be interested in learning more about? I can connect you directly with the buyer if so."

If Yes:
"Great! I'll send over the details and set up an intro. What's the best email to reach you at?"

If No/Not Now:
"No problem at all. Would you mind if I kept you in our network for future opportunities that might be a better fit?"

Close:
"Thanks for your time. Have a great day!"
`
  }

  return `
PHONE SCRIPT - COLD INTRO

Intro:
"Hi, this is [Name] from Wells AI. I'm reaching out to ${companyName} because we're building a supplier network and your company came up in our research."

Value Prop:
"We help businesses find qualified suppliers through AI-powered matching. Buyers post what they need, we match them with the right suppliers. It's like inbound leads, but for B2B procurement."

Ask:
"Would you be interested in creating a free supplier profile? Takes about 5 minutes and puts you in front of buyers actively looking for what you sell."

If Yes:
"Great! I'll send you the link. What's the best email to reach you at?"

If No/Not Now:
"No problem. Would you mind if I sent over some info in case things change?"

Close:
"Thanks for your time. Have a great day!"
`
}
