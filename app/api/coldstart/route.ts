/**
 * Cold Start API
 *
 * Import contacts, create campaigns, send outreach
 * The nuclear launch button for WellsAI
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  importContactsFromCSV,
  addContact,
  getContacts,
  getContactStats,
  createCampaign,
  addCampaignVariant,
  queueCampaignOutreach,
  processOutreachQueue,
  EMAIL_TEMPLATES,
  SMS_TEMPLATES
} from '@/lib/coldstart/engine'

// Master key for cold start operations (set in env)
const MASTER_KEY = process.env.COLD_START_MASTER_KEY || 'wells-master-2024-coldstart'

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const key = authHeader?.replace('Bearer ', '')
  return key === MASTER_KEY
}

export async function GET(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Get contact stats
    if (action === 'stats') {
      const stats = await getContactStats()
      return NextResponse.json({ stats })
    }

    // Get templates
    if (action === 'templates') {
      return NextResponse.json({
        email: EMAIL_TEMPLATES,
        sms: SMS_TEMPLATES
      })
    }

    // Get contacts
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

    // ========================================
    // IMPORT CONTACTS
    // ========================================

    if (action === 'import_csv') {
      const { csvData, source, hasHeader, columnMap } = body

      if (!csvData) {
        return NextResponse.json({ error: 'csvData is required' }, { status: 400 })
      }

      const result = await importContactsFromCSV(csvData, source || 'email_export', {
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

      const result = await importContactsFromCSV(csvData, 'linkedin', {
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

      const result = await addContact({
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

      const campaign = await createCampaign({
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
          await addCampaignVariant(campaign.id, variant)
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

      const result = await addCampaignVariant(campaignId, variant)

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

      const result = await queueCampaignOutreach(campaignId, {
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

      const result = await processOutreachQueue({
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
        importResult = await importContactsFromCSV(csvData, source || 'email_export', {
          hasHeader: true
        })
      }

      // Step 2: Create campaign
      const campaign = await createCampaign({
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

      await addCampaignVariant(campaign.id, {
        name: 'Nuclear',
        weight: 100,
        emailSubject: template?.subject,
        emailBody: template?.body,
        smsBody: smsTemp?.body
      })

      // Step 4: Queue outreach
      const queueResult = await queueCampaignOutreach(campaign.id, {
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
