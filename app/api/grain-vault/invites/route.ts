// @ts-nocheck
/**
 * Supplier/Customer Invite API
 *
 * Enables viral network effect by letting users invite suppliers to PAY them
 * and customers to GET PAID in GRAIN.
 *
 * GET: Get user's invite codes and stats
 * POST: Generate new invite link (supplier or customer type)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'

// Generate a unique invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Format invite link
function formatInviteLink(code: string, type: 'supplier' | 'customer'): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grainandvault.com'
  return `${baseUrl}/join/${code}?type=${type}`
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create supplier invite code
    let supplierInvite = await sql`
      SELECT * FROM grain_invites
      WHERE user_id = ${userId} AND invite_type = 'supplier' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (supplierInvite.length === 0) {
      const code = generateInviteCode()
      supplierInvite = await sql`
        INSERT INTO grain_invites (user_id, code, invite_type, status)
        VALUES (${userId}, ${code}, 'supplier', 'active')
        RETURNING *
      `
    }

    // Get or create customer invite code
    let customerInvite = await sql`
      SELECT * FROM grain_invites
      WHERE user_id = ${userId} AND invite_type = 'customer' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (customerInvite.length === 0) {
      const code = generateInviteCode()
      customerInvite = await sql`
        INSERT INTO grain_invites (user_id, code, invite_type, status)
        VALUES (${userId}, ${code}, 'customer', 'active')
        RETURNING *
      `
    }

    // Get onboarded counts
    const supplierStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted') as onboarded,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM grain_invite_connections
      WHERE inviter_id = ${userId} AND connection_type = 'supplier'
    `

    const customerStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted') as onboarded,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM grain_invite_connections
      WHERE inviter_id = ${userId} AND connection_type = 'customer'
    `

    // Get recent connections
    const recentConnections = await sql`
      SELECT
        ic.*,
        u.email as connection_email,
        u.first_name as connection_name
      FROM grain_invite_connections ic
      LEFT JOIN users u ON ic.invitee_id = u.clerk_id
      WHERE ic.inviter_id = ${userId}
      ORDER BY ic.created_at DESC
      LIMIT 10
    `

    return NextResponse.json({
      supplier: {
        code: supplierInvite[0].code,
        link: formatInviteLink(supplierInvite[0].code, 'supplier'),
        onboarded: parseInt(supplierStats[0]?.onboarded || '0'),
        pending: parseInt(supplierStats[0]?.pending || '0'),
        benefits: [
          'Get paid faster - instant GRAIN settlements',
          'No payment processing fees',
          'GRAIN appreciates over time',
          'Build trusted supplier relationships'
        ]
      },
      customer: {
        code: customerInvite[0].code,
        link: formatInviteLink(customerInvite[0].code, 'customer'),
        onboarded: parseInt(customerStats[0]?.onboarded || '0'),
        pending: parseInt(customerStats[0]?.pending || '0'),
        benefits: [
          'Pay customers instantly in GRAIN',
          'Zero transaction fees',
          'Recipients earn appreciation',
          'Strengthen customer loyalty'
        ]
      },
      recentConnections: recentConnections.map(c => ({
        id: c.id,
        type: c.connection_type,
        status: c.status,
        email: c.connection_email,
        name: c.connection_name,
        createdAt: c.created_at
      })),
      totalNetwork: (parseInt(supplierStats[0]?.onboarded || '0') + parseInt(customerStats[0]?.onboarded || '0'))
    })
  } catch (error) {
    console.error('Error fetching invites:', error)

    // Return mock data for development if tables don't exist
    const mockSupplierCode = generateInviteCode()
    const mockCustomerCode = generateInviteCode()

    return NextResponse.json({
      supplier: {
        code: mockSupplierCode,
        link: formatInviteLink(mockSupplierCode, 'supplier'),
        onboarded: 0,
        pending: 0,
        benefits: [
          'Get paid faster - instant GRAIN settlements',
          'No payment processing fees',
          'GRAIN appreciates over time',
          'Build trusted supplier relationships'
        ]
      },
      customer: {
        code: mockCustomerCode,
        link: formatInviteLink(mockCustomerCode, 'customer'),
        onboarded: 0,
        pending: 0,
        benefits: [
          'Pay customers instantly in GRAIN',
          'Zero transaction fees',
          'Recipients earn appreciation',
          'Strengthen customer loyalty'
        ]
      },
      recentConnections: [],
      totalNetwork: 0,
      _note: 'Using mock data - database tables may need migration'
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, email, companyName } = body

    if (!type || !['supplier', 'customer'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid invite type. Must be "supplier" or "customer"' },
        { status: 400 }
      )
    }

    // Generate a new personalized invite code
    const code = generateInviteCode()
    const link = formatInviteLink(code, type)

    try {
      // Store the invite
      await sql`
        INSERT INTO grain_invites (user_id, code, invite_type, target_email, target_company, status)
        VALUES (${userId}, ${code}, ${type}, ${email || null}, ${companyName || null}, 'active')
      `
    } catch (dbError) {
      // Table might not exist yet - continue with generated link
      console.log('Note: grain_invites table may need creation')
    }

    // Generate share text based on type
    const shareText = type === 'supplier'
      ? `Join me on Grain & Vault and get paid in GRAIN - faster payments, no fees, and your balance appreciates over time! Use my invite: ${link}`
      : `I'd like to pay you in GRAIN on Grain & Vault - instant settlements, zero fees, and your GRAIN appreciates! Join here: ${link}`

    return NextResponse.json({
      success: true,
      code,
      link,
      type,
      shareText,
      shareUrls: {
        email: `mailto:${email || ''}?subject=${encodeURIComponent(
          type === 'supplier'
            ? 'Get paid faster with Grain & Vault'
            : 'Receive payments in GRAIN'
        )}&body=${encodeURIComponent(shareText)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`
      }
    })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    )
  }
}
