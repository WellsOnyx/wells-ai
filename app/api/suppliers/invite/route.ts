/**
 * Supplier Invite API
 *
 * Create and track supplier invitations
 * Supports: campaigns, individual invites, tracking pixels
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createSupplierInvite,
  trackInviteOpen,
  trackInviteClick,
  trackInviteRegistration,
  createCampaign,
  getCampaignTargets,
  getSupplier,
  updateSupplier
} from '@/lib/supplier-database'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const inviteCode = searchParams.get('code')

    // Track open (usually via tracking pixel)
    if (action === 'track_open' && inviteCode) {
      await trackInviteOpen(inviteCode)

      // Return 1x1 transparent pixel
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      )

      return new NextResponse(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    // Track click (redirect)
    if (action === 'track_click' && inviteCode) {
      await trackInviteClick(inviteCode)

      // Redirect to join page with invite code
      return NextResponse.redirect(
        new URL(`/join?ref=${inviteCode}`, request.url)
      )
    }

    // Get invite details
    if (inviteCode) {
      const result = await sql`
        SELECT
          i.*,
          s.company_name,
          s.contact_email,
          c.name as campaign_name
        FROM supplier_invites i
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        LEFT JOIN supplier_campaigns c ON i.campaign_id = c.id
        WHERE i.invite_code = ${inviteCode}
      `

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invite not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ invite: result.rows[0] })
    }

    // List campaigns
    const campaigns = await sql`
      SELECT * FROM supplier_campaigns
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json({ campaigns: campaigns.rows })
  } catch (error: any) {
    console.error('Supplier invite GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process invite' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Create campaign
    if (action === 'create_campaign') {
      const campaign = await createCampaign({
        name: body.name,
        description: body.description,
        targetNaicsCodes: body.targetNaicsCodes,
        targetSicCodes: body.targetSicCodes,
        targetStates: body.targetStates,
        targetEmployeeRanges: body.targetEmployeeRanges,
        targetRevenueRanges: body.targetRevenueRanges,
        targetDiversities: body.targetDiversities,
        emailSubject: body.emailSubject,
        emailTemplate: body.emailTemplate,
        headline: body.headline,
        benefits: body.benefits,
        ctaText: body.ctaText
      })

      if (!campaign) {
        return NextResponse.json(
          { error: 'Failed to create campaign' },
          { status: 500 }
        )
      }

      // Get target count
      const targets = await getCampaignTargets(campaign.id)

      return NextResponse.json({
        message: 'Campaign created',
        campaign,
        targetCount: targets.length
      })
    }

    // Get campaign targets preview
    if (action === 'preview_targets') {
      const { campaignId } = body

      if (!campaignId) {
        return NextResponse.json(
          { error: 'campaignId is required' },
          { status: 400 }
        )
      }

      const targets = await getCampaignTargets(campaignId)

      return NextResponse.json({
        targets: targets.slice(0, 20), // Preview first 20
        totalCount: targets.length
      })
    }

    // Send invites for campaign
    if (action === 'send_invites') {
      const { campaignId, supplierIds, limit } = body

      if (!campaignId) {
        return NextResponse.json(
          { error: 'campaignId is required' },
          { status: 400 }
        )
      }

      let targetSuppliers: string[]

      if (supplierIds && Array.isArray(supplierIds)) {
        targetSuppliers = supplierIds
      } else {
        // Get all targets not yet invited
        const targets = await getCampaignTargets(campaignId)
        targetSuppliers = targets.slice(0, limit || 100).map(s => s.id)
      }

      let sent = 0
      let failed = 0
      const invites: any[] = []

      for (const supplierId of targetSuppliers) {
        try {
          const invite = await createSupplierInvite(supplierId, campaignId)
          if (invite) {
            sent++
            invites.push(invite)
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }

      // Update campaign metrics
      await sql`
        UPDATE supplier_campaigns SET
          total_targeted = (
            SELECT COUNT(*) FROM suppliers
            WHERE invite_status = 'not_invited'
          ),
          total_invited = total_invited + ${sent},
          status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW()
        WHERE id = ${campaignId}
      `

      return NextResponse.json({
        message: `Sent ${sent} invites`,
        sent,
        failed,
        invites: invites.slice(0, 10) // First 10
      })
    }

    // Create single invite
    if (action === 'create_invite') {
      const { supplierId, campaignId, message } = body

      if (!supplierId) {
        return NextResponse.json(
          { error: 'supplierId is required' },
          { status: 400 }
        )
      }

      const invite = await createSupplierInvite(supplierId, campaignId, message)

      if (!invite) {
        return NextResponse.json(
          { error: 'Failed to create invite' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Invite created',
        invite
      })
    }

    // Track registration
    if (action === 'track_registration') {
      const { inviteCode, userId } = body

      if (!inviteCode || !userId) {
        return NextResponse.json(
          { error: 'inviteCode and userId are required' },
          { status: 400 }
        )
      }

      await trackInviteRegistration(inviteCode, userId)

      return NextResponse.json({
        message: 'Registration tracked'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Supplier invite POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process invite' },
      { status: 500 }
    )
  }
}
