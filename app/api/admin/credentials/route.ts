// @ts-nocheck
/**
 * Admin Credentials API
 *
 * ⚠️ MASTER ACCESS ONLY ⚠️
 *
 * Manages API keys and session cookies stored in database.
 * These override environment variables when present.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const MASTER_KEY = process.env.COLD_START_MASTER_KEY

function validateMasterAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === MASTER_KEY
  }
  return false
}

// Ensure credentials table exists
async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cold_start_credentials (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  } catch (error) {
    // Table might already exist or DB not available
    console.log('Credentials table check:', error)
  }
}

// GET - Retrieve current credentials (masked)
export async function GET(request: NextRequest) {
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    await ensureTable()

    const result = await sql`
      SELECT key, value, updated_at FROM cold_start_credentials
    `

    // Mask values for display (show last 4 chars only)
    const credentials: Record<string, string> = {}
    for (const row of result) {
      const value = row.value as string
      if (value.length > 8) {
        credentials[row.key as string] = '••••••••' + value.slice(-4)
      } else {
        credentials[row.key as string] = '••••••••'
      }
    }

    // Also check env vars and show if DB empty
    const envKeys = [
      'APOLLO_API_KEY',
      'LINKEDIN_SESSION_COOKIE',
      'LINKEDIN_RECRUITER_SESSION',
      'OWNER_EMAIL',
      'ESCALATION_SLACK_WEBHOOK',
    ]

    for (const key of envKeys) {
      if (!credentials[key] && process.env[key]) {
        const value = process.env[key] as string
        credentials[key] = '(env) ••••' + value.slice(-4)
      }
    }

    return NextResponse.json({ credentials })
  } catch (error) {
    // If DB fails, just show env status
    const credentials: Record<string, string> = {}
    if (process.env.APOLLO_API_KEY) credentials['APOLLO_API_KEY'] = '(env) ••••'
    if (process.env.LINKEDIN_SESSION_COOKIE) credentials['LINKEDIN_SESSION_COOKIE'] = '(env) ••••'
    if (process.env.OWNER_EMAIL) credentials['OWNER_EMAIL'] = process.env.OWNER_EMAIL

    return NextResponse.json({ credentials, dbError: true })
  }
}

// POST - Save a credential
export async function POST(request: NextRequest) {
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    const { key, value } = await request.json()

    if (!key || typeof value !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Validate key is allowed
    const allowedKeys = [
      'APOLLO_API_KEY',
      'LINKEDIN_SESSION_COOKIE',
      'LINKEDIN_RECRUITER_SESSION',
      'OWNER_EMAIL',
      'ESCALATION_SLACK_WEBHOOK',
    ]

    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    await ensureTable()

    // Upsert the credential
    await sql`
      INSERT INTO cold_start_credentials (key, value, updated_at)
      VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = ${value},
        updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ success: true, key })
  } catch (error) {
    console.error('Save credential error:', error)
    return NextResponse.json(
      { error: 'Failed to save credential' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a credential (fall back to env var)
export async function DELETE(request: NextRequest) {
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const key = url.searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key required' }, { status: 400 })
    }

    await ensureTable()

    await sql`
      DELETE FROM cold_start_credentials WHERE key = ${key}
    `

    return NextResponse.json({ success: true, key })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    )
  }
}
