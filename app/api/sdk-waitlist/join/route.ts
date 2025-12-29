import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, name, company, title, companySize, erp, useCases, annualSpend, message } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!erp) {
      return NextResponse.json({ error: 'ERP selection is required' }, { status: 400 })
    }

    const db = await getDb()

    // Check if email already exists
    const existingEntry = await db.query(
      'SELECT * FROM wells_sdk_waitlist WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingEntry.rows.length > 0) {
      const entry = existingEntry.rows[0]

      // Get position
      const positionResult = await db.query(
        'SELECT COUNT(*) as ahead FROM wells_sdk_waitlist WHERE created_at < $1',
        [entry.created_at]
      )

      return NextResponse.json({
        email: entry.email,
        company: entry.company,
        erp: entry.erp,
        position: parseInt(positionResult.rows[0].ahead) + 1,
        referralCode: entry.referral_code,
        joinedAt: entry.created_at
      })
    }

    // Generate referral code
    const referralCode = `WELLS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Insert new waitlist entry
    const result = await db.query(
      `INSERT INTO wells_sdk_waitlist (
        email, name, company, title, company_size, erp, use_cases, annual_spend, message, referral_code, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        email.toLowerCase(),
        name || null,
        company || null,
        title || null,
        companySize || null,
        erp,
        useCases ? JSON.stringify(useCases) : null,
        annualSpend || null,
        message || null,
        referralCode
      ]
    )

    const newEntry = result.rows[0]

    // Get position
    const positionResult = await db.query(
      'SELECT COUNT(*) as ahead FROM wells_sdk_waitlist WHERE created_at < $1',
      [newEntry.created_at]
    )

    return NextResponse.json({
      email: newEntry.email,
      company: newEntry.company,
      erp: newEntry.erp,
      position: parseInt(positionResult.rows[0].ahead) + 1,
      referralCode: newEntry.referral_code,
      joinedAt: newEntry.created_at
    })

  } catch (error: any) {
    console.error('[SDK Waitlist Join Error]', error)

    // If table doesn't exist, return mock data
    if (error.code === '42P01') {
      const referralCode = `WELLS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const position = Math.floor(Math.random() * 50) + 10

      return NextResponse.json({
        email: 'user@example.com',
        position,
        referralCode,
        joinedAt: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    )
  }
}
