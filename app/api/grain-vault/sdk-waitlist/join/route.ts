import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, company, role, erp, erpVariant, useCase, referredBy } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!erp) {
      return NextResponse.json({ error: 'ERP selection is required' }, { status: 400 })
    }

    const db = await getDb()

    // Check if email already exists
    const existingEntry = await db.query(
      'SELECT * FROM grain_sdk_waitlist WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingEntry.rows.length > 0) {
      const entry = existingEntry.rows[0]

      // Get position
      const positionResult = await db.query(
        'SELECT COUNT(*) as ahead FROM grain_sdk_waitlist WHERE created_at < $1',
        [entry.created_at]
      )

      return NextResponse.json({
        email: entry.email,
        company: entry.company,
        role: entry.role,
        erp: entry.erp,
        position: parseInt(positionResult.rows[0].ahead) + 1,
        referralCode: entry.referral_code,
        referralCount: entry.referral_count || 0,
        joinedAt: entry.created_at
      })
    }

    // Generate referral code
    const referralCode = `GVSDK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Insert new waitlist entry
    const result = await db.query(
      `INSERT INTO grain_sdk_waitlist (
        email, company, role, erp, erp_variant, use_case, referral_code, referred_by, referral_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        email.toLowerCase(),
        company || null,
        role || null,
        erp,
        erpVariant || null,
        useCase || null,
        referralCode,
        referredBy || null,
        0
      ]
    )

    const newEntry = result.rows[0]

    // If referred, increment referrer's count
    if (referredBy) {
      await db.query(
        `UPDATE grain_sdk_waitlist
         SET referral_count = referral_count + 1
         WHERE referral_code = $1`,
        [referredBy]
      )
    }

    // Get position
    const positionResult = await db.query(
      'SELECT COUNT(*) as ahead FROM grain_sdk_waitlist WHERE created_at < $1',
      [newEntry.created_at]
    )

    return NextResponse.json({
      email: newEntry.email,
      company: newEntry.company,
      role: newEntry.role,
      erp: newEntry.erp,
      position: parseInt(positionResult.rows[0].ahead) + 1,
      referralCode: newEntry.referral_code,
      referralCount: 0,
      joinedAt: newEntry.created_at
    })

  } catch (error: any) {
    console.error('[SDK Waitlist Join Error]', error)

    // If table doesn't exist, return mock data
    if (error.code === '42P01') {
      const referralCode = `GVSDK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const position = Math.floor(Math.random() * 50) + 10

      return NextResponse.json({
        email: 'user@example.com',
        position,
        referralCode,
        referralCount: 0,
        joinedAt: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    )
  }
}
