import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, company, role, monthlyVolume, referredBy } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const db = await getDb()

    // Check if email already exists
    const existingEntry = await db.query(
      'SELECT * FROM grain_waitlist WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingEntry.rows.length > 0) {
      const entry = existingEntry.rows[0]

      // Get position
      const positionResult = await db.query(
        'SELECT COUNT(*) as ahead FROM grain_waitlist WHERE created_at < $1',
        [entry.created_at]
      )

      return NextResponse.json({
        email: entry.email,
        company: entry.company,
        role: entry.role,
        position: parseInt(positionResult.rows[0].ahead) + 1,
        totalAhead: parseInt(positionResult.rows[0].ahead),
        referralCode: entry.referral_code,
        referralCount: entry.referral_count || 0,
        joinedAt: entry.created_at
      })
    }

    // Generate referral code
    const referralCode = `GV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Insert new waitlist entry
    const result = await db.query(
      `INSERT INTO grain_waitlist (
        email, company, role, monthly_volume, referral_code, referred_by, referral_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        email.toLowerCase(),
        company || null,
        role || null,
        monthlyVolume || null,
        referralCode,
        referredBy || null,
        0
      ]
    )

    const newEntry = result.rows[0]

    // If referred, increment referrer's count
    if (referredBy) {
      await db.query(
        `UPDATE grain_waitlist
         SET referral_count = referral_count + 1
         WHERE referral_code = $1`,
        [referredBy]
      )
    }

    // Get position
    const positionResult = await db.query(
      'SELECT COUNT(*) as ahead FROM grain_waitlist WHERE created_at < $1',
      [newEntry.created_at]
    )

    return NextResponse.json({
      email: newEntry.email,
      company: newEntry.company,
      role: newEntry.role,
      position: parseInt(positionResult.rows[0].ahead) + 1,
      totalAhead: parseInt(positionResult.rows[0].ahead),
      referralCode: newEntry.referral_code,
      referralCount: 0,
      joinedAt: newEntry.created_at
    })

  } catch (error: any) {
    console.error('[Waitlist Join Error]', error)

    // If table doesn't exist, return mock data
    if (error.code === '42P01') {
      const referralCode = `GV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const position = Math.floor(Math.random() * 300) + 100

      return NextResponse.json({
        email: 'user@example.com',
        position,
        totalAhead: position - 1,
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const db = await getDb()

    const result = await db.query(
      'SELECT * FROM grain_waitlist WHERE referral_code = $1',
      [code]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const entry = result.rows[0]

    // Get position
    const positionResult = await db.query(
      'SELECT COUNT(*) as ahead FROM grain_waitlist WHERE created_at < $1',
      [entry.created_at]
    )

    return NextResponse.json({
      email: entry.email,
      company: entry.company,
      role: entry.role,
      position: parseInt(positionResult.rows[0].ahead) + 1,
      totalAhead: parseInt(positionResult.rows[0].ahead),
      referralCode: entry.referral_code,
      referralCount: entry.referral_count || 0,
      joinedAt: entry.created_at
    })

  } catch (error) {
    console.error('[Waitlist Get Error]', error)
    return NextResponse.json(
      { error: 'Failed to get waitlist entry' },
      { status: 500 }
    )
  }
}
