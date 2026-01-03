/**
 * Cold Start API
 *
 * Import contacts, create campaigns, send outreach
 * The nuclear launch button for WellsAI
 */

import { NextRequest, NextResponse } from 'next/server'

// Predefined templates (inline to avoid module loading issues)
const EMAIL_TEMPLATES = {
  founder_personal: {
    subject: "{{firstName}}, quick question",
    body: `
      <p>Hey {{firstName}},</p>

      <p>I'm building something I think you'll find interesting - an AI that actually executes B2B deals, not just recommends them.</p>

      <p>Think: "I need 1000 custom widgets" → AI finds suppliers, negotiates, handles contracts, manages payment. Done.</p>

      <p>We're opening up early access. Given your background at {{company}}, I'd love your take.</p>

      <p>Worth a quick look?</p>

      <p>- Jonah</p>

      <p style="font-size: 12px; color: #666;">
        <a href="[LINK]">Check it out</a> | <a href="%unsubscribe%">Unsubscribe</a>
      </p>
    `
  },

  supplier_invite: {
    subject: "New sales channel for {{company}}",
    body: `
      <p>Hi {{firstName}},</p>

      <p>I'm reaching out because {{company}} came up as a potential fit for Wells AI - a new platform where enterprise buyers are actively sourcing suppliers.</p>

      <p>Here's what's different:</p>
      <ul>
        <li>Buyers come to you (no cold outreach needed)</li>
        <li>AI handles initial qualification</li>
        <li>Built-in payments and contracts</li>
        <li>Zero cost until you close a deal</li>
      </ul>

      <p>We're onboarding select suppliers this month. Interested?</p>

      <p><a href="[LINK]">Join the waitlist →</a></p>

      <p>Best,<br>Wells Team</p>
    `
  },

  buyer_value: {
    subject: "Cut your sourcing time by 80%",
    body: `
      <p>{{firstName}},</p>

      <p>What if you could go from "we need X" to "contract signed" in 48 hours instead of 6 weeks?</p>

      <p>Wells AI is an autonomous agent that:</p>
      <ul>
        <li>Finds qualified suppliers for any requirement</li>
        <li>Negotiates pricing and terms on your behalf</li>
        <li>Handles contracts and compliance</li>
        <li>Manages payments with built-in escrow</li>
      </ul>

      <p>Early users are seeing 73% faster sourcing and 18% cost savings.</p>

      <p><a href="[LINK]">See it in action →</a></p>

      <p>- Wells Team</p>
    `
  }
}

const SMS_TEMPLATES = {
  short_personal: {
    body: "Hey {{firstName}}, built something you might like - AI that closes B2B deals autonomously. Worth 2 mins? [LINK]"
  },

  supplier_invite: {
    body: "{{firstName}} - new buyers are looking for suppliers like {{company}} on Wells AI. Free to join, pay only when you win deals. [LINK]"
  },

  urgency: {
    body: "{{firstName}}, we're opening Wells AI to 100 early users this week. Given your background, thought you should know. [LINK]"
  }
}

// Master key for cold start operations (set in env)
const MASTER_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const key = authHeader?.replace('Bearer ', '')
  return key === MASTER_KEY
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Get templates - no database needed
    if (action === 'templates') {
      return NextResponse.json({
        email: EMAIL_TEMPLATES,
        sms: SMS_TEMPLATES
      })
    }

    // Get contact stats - uses database
    if (action === 'stats') {
      const { getContactStats } = await import('@/lib/coldstart/engine')
      const stats = await getContactStats()
      return NextResponse.json({ stats })
    }

    // Get contacts
    const { getContacts } = await import('@/lib/coldstart/engine')
    const filters = {
      sources: searchParams.get('sources')?.split(',').filter(Boolean) as any,
      tags: searchParams.get('tags')?.split(',').filter(Boolean),
      relationships: searchParams.get('relationships')?.split(',').filter(Boolean),
      hasEmail: searchParams.get('has_email') === 'true',
      hasPhone: searchParams.get('has_phone') === 'true',
      notContacted: searchParams.get('not_contacted') === 'true',
      limit: parseInt(searchParams.get('limit') || '100', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10)
    }

    const result = await getContacts(filters)

    return NextResponse.json({
      contacts: result.contacts,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    })
  } catch (error: any) {
    console.error('Cold start GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body

    // Dynamic import for database operations
    const engine = await import('@/lib/coldstart/engine')

    // ========================================
    // IMPORT CONTACTS
    // ========================================

    if (action === 'import_csv') {
      const { csvData, source, hasHeader, columnMap } = body

      if (!csvData) {
        return NextResponse.json({ error: 'csvData is required' }, { status: 400 })
      }

      const result = await engine.importContactsFromCSV(csvData, source || 'email_export', {
        hasHeader,
        columnMap
      })

      return NextResponse.json({
        message: `Imported ${result.imported} contacts`,
        ...result
      })
    }

    if (action === 'import_linkedin') {
      // LinkedIn exports CSV with specific columns
      const { csvData } = body

      const result = await engine.importContactsFromCSV(csvData, 'linkedin', {
        hasHeader: true,
        columnMap: {
          'first name': 'firstName',
          'last name': 'lastName',
          'email address': 'email',
          'company': 'company',
          'position': 'title',
          'connected on': 'lastInteraction'
        }
      })

      return NextResponse.json({
        message: `Imported ${result.imported} LinkedIn connections`,
        ...result
      })
    }

    if (action === 'add_contact') {
      const contact = body.contact

      if (!contact.email && !contact.phone) {
        return NextResponse.json(
          { error: 'email or phone is required' },
          { status: 400 }
        )
      }

      const result = await engine.addContact({
        ...contact,
        source: contact.source || 'manual'
      })

      return NextResponse.json({
        message: result.isDuplicate ? 'Contact updated' : 'Contact added',
        id: result.id,
        isDuplicate: result.isDuplicate
      })
    }

    // ========================================
    // CREATE CAMPAIGN
    // ========================================

    if (action === 'create_campaign') {
      const {
        name,
        description,
        sourceFilter,
        tagFilter,
        relationshipFilter,
        channels,
        rateLimit,
        variants
      } = body

      if (!name) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 })
      }

      const campaign = await engine.createCampaign({
        name,
        description,
        sourceFilter,
        tagFilter,
        relationshipFilter,
        channels: channels || ['email'],
        rateLimit: rateLimit || 100
      })

      // Add variants
      if (variants && Array.isArray(variants)) {
        for (const variant of variants) {
          await engine.addCampaignVariant(campaign.id, variant)
        }
      }

      return NextResponse.json({
        message: 'Campaign created',
        campaign
      })
    }

    if (action === 'add_variant') {
      const { campaignId, variant } = body

      if (!campaignId || !variant) {
        return NextResponse.json(
          { error: 'campaignId and variant are required' },
          { status: 400 }
        )
      }

      const result = await engine.addCampaignVariant(campaignId, variant)

      return NextResponse.json({
        message: 'Variant added',
        variant: result
      })
    }

    // ========================================
    // QUEUE & SEND
    // ========================================

    if (action === 'queue_outreach') {
      const { campaignId, limit, channels } = body

      if (!campaignId) {
        return NextResponse.json(
          { error: 'campaignId is required' },
          { status: 400 }
        )
      }

      const result = await engine.queueCampaignOutreach(campaignId, {
        limit,
        channels
      })

      return NextResponse.json({
        message: `Queued ${result.queued} outreach records`,
        queued: result.queued
      })
    }

    if (action === 'process_queue') {
      const { batchSize, channel } = body

      const result = await engine.processOutreachQueue({
        batchSize: batchSize || 50,
        channel
      })

      return NextResponse.json({
        message: `Processed ${result.processed} records`,
        ...result
      })
    }

    // ========================================
    // NUCLEAR LAUNCH (all-in-one)
    // ========================================

    if (action === 'nuclear_launch') {
      const {
        campaignName,
        csvData,
        source,
        emailTemplate,
        smsTemplate,
        channels,
        limit
      } = body

      // Step 1: Import contacts
      let importResult = { imported: 0, duplicates: 0, errors: [] as string[] }
      if (csvData) {
        importResult = await engine.importContactsFromCSV(csvData, source || 'email_export', {
          hasHeader: true
        })
      }

      // Step 2: Create campaign
      const campaign = await engine.createCampaign({
        name: campaignName || `Nuclear Launch ${new Date().toISOString()}`,
        channels: channels || ['email', 'sms'],
        sourceFilter: source ? [source] : undefined,
        rateLimit: 200
      })

      // Step 3: Add variant with templates
      const template = emailTemplate
        ? EMAIL_TEMPLATES[emailTemplate as keyof typeof EMAIL_TEMPLATES]
        : EMAIL_TEMPLATES.founder_personal

      const smsTemp = smsTemplate
        ? SMS_TEMPLATES[smsTemplate as keyof typeof SMS_TEMPLATES]
        : SMS_TEMPLATES.short_personal

      await engine.addCampaignVariant(campaign.id, {
        name: 'Nuclear',
        weight: 100,
        emailSubject: template?.subject,
        emailBody: template?.body,
        smsBody: smsTemp?.body
      })

      // Step 4: Queue outreach
      const queueResult = await engine.queueCampaignOutreach(campaign.id, {
        limit: limit || 10000,
        channels: channels || ['email']
      })

      return NextResponse.json({
        message: '☢️ NUCLEAR LAUNCH INITIATED',
        import: importResult,
        campaign: campaign,
        queued: queueResult.queued,
        nextStep: 'Call POST /api/coldstart with action=process_queue to start sending'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Cold start POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
