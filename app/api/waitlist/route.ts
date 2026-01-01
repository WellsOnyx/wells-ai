/**
 * Waitlist API - Email Capture for Early Access
 *
 * POST /api/waitlist - Add email to waitlist
 * GET /api/waitlist - Get waitlist stats (admin)
 *
 * Stores emails with optional company/role for prioritization.
 * Creates waitlist table if it doesn't exist.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Ensure waitlist table exists
async function ensureWaitlistTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      company VARCHAR(255),
      role VARCHAR(255),
      source VARCHAR(100) DEFAULT 'website',
      referral_code VARCHAR(50),
      ip_address VARCHAR(45),
      user_agent TEXT,
      priority_score INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      invited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Create index for faster lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email)
  `)

  await query(`
    CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)
  `)
}

/**
 * POST /api/waitlist
 * Add a new email to the waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, company, role, source, referralCode } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Block disposable email domains (common ones)
    const disposableDomains = [
      'tempmail.com', 'throwaway.email', 'guerrillamail.com',
      'mailinator.com', '10minutemail.com', 'temp-mail.org',
      'fakeinbox.com', 'trashmail.com', 'maildrop.cc'
    ]
    const emailDomain = normalizedEmail.split('@')[1]
    if (disposableDomains.includes(emailDomain)) {
      return NextResponse.json(
        { error: 'Please use a valid work email address' },
        { status: 400 }
      )
    }

    // Ensure table exists
    await ensureWaitlistTable()

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Calculate priority score based on email domain & company
    let priorityScore = 0
    const highValueDomains = ['google.com', 'microsoft.com', 'apple.com', 'amazon.com',
                              'meta.com', 'stripe.com', 'shopify.com', 'salesforce.com']
    if (highValueDomains.some(domain => normalizedEmail.endsWith(`@${domain}`))) {
      priorityScore += 50
    }

    // Enterprise domains (not gmail, outlook, etc.)
    const consumerDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
                             'icloud.com', 'aol.com', 'protonmail.com']
    if (!consumerDomains.includes(emailDomain)) {
      priorityScore += 20
    }

    // Bonus for providing company info
    if (company) priorityScore += 10
    if (role) priorityScore += 5

    // Check if already exists
    const existing = await query<{ id: number; status: string }>(
      'SELECT id, status FROM waitlist WHERE email = $1',
      [normalizedEmail]
    )

    if (existing.rows.length > 0) {
      // Get their position
      const position = await query<{ position: number }>(
        `SELECT COUNT(*) + 1 as position FROM waitlist WHERE created_at < (SELECT created_at FROM waitlist WHERE email = $1)`,
        [normalizedEmail]
      )

      return NextResponse.json({
        success: true,
        message: 'You\'re already on the list!',
        position: position.rows[0]?.position || 1,
        alreadyExists: true,
      })
    }

    // Insert new entry
    const result = await query<{ id: number }>(
      `INSERT INTO waitlist (email, company, role, source, referral_code, ip_address, user_agent, priority_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [normalizedEmail, company || null, role || null, source || 'website',
       referralCode || null, ipAddress, userAgent, priorityScore]
    )

    // Get their position (total count)
    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM waitlist')
    const position = parseInt(countResult.rows[0]?.count || '1', 10)

    return NextResponse.json({
      success: true,
      message: 'Welcome to the waitlist!',
      position,
      id: result.rows[0]?.id,
    })

  } catch (error: any) {
    console.error('Waitlist error:', error)

    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json({
        success: true,
        message: 'You\'re already on the list!',
        alreadyExists: true,
      })
    }

    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/waitlist
 * Get waitlist statistics (for admin/dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    // Simple auth check via header (in production, use proper auth)
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    // Ensure table exists
    await ensureWaitlistTable()

    // Public stats (no auth required)
    const stats = await query<{
      total: string
      this_week: string
      pending: string
      invited: string
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'invited') as invited
      FROM waitlist
    `)

    const publicStats = {
      totalSignups: parseInt(stats.rows[0]?.total || '0', 10),
      thisWeek: parseInt(stats.rows[0]?.this_week || '0', 10),
    }

    // If admin, return full stats
    if (adminKey && authHeader === `Bearer ${adminKey}`) {
      const topCompanies = await query<{ company: string; count: string }>(`
        SELECT company, COUNT(*) as count
        FROM waitlist
        WHERE company IS NOT NULL
        GROUP BY company
        ORDER BY count DESC
        LIMIT 10
      `)

      const recentSignups = await query<{
        email: string
        company: string | null
        role: string | null
        created_at: Date
        priority_score: number
      }>(`
        SELECT email, company, role, created_at, priority_score
        FROM waitlist
        ORDER BY created_at DESC
        LIMIT 20
      `)

      return NextResponse.json({
        ...publicStats,
        pending: parseInt(stats.rows[0]?.pending || '0', 10),
        invited: parseInt(stats.rows[0]?.invited || '0', 10),
        topCompanies: topCompanies.rows,
        recentSignups: recentSignups.rows,
      })
    }

    return NextResponse.json(publicStats)

  } catch (error: any) {
    console.error('Waitlist stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waitlist stats' },
      { status: 500 }
    )
  }
}
