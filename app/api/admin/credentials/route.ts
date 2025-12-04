// @ts-nocheck
/**
 * Admin Credentials API
 *
 * ⚠️ MASTER ACCESS ONLY ⚠️
 *
 * Manages API keys and session cookies.
 * Uses runtime memory cache - for persistent storage, use Vercel env vars.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCredential,
  saveCredential,
  type CredentialKey
} from '@/lib/cold-start/credential-helper'

const MASTER_KEY = process.env.COLD_START_MASTER_KEY

function validateMasterAccess(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return token === MASTER_KEY
  }
  return false
}

// GET - Retrieve current credentials (masked)
export async function GET(request: NextRequest) {
  if (!MASTER_KEY || !validateMasterAccess(request)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  }

  try {
    const envKeys: CredentialKey[] = [
      'APOLLO_API_KEY',
      'LINKEDIN_SESSION_COOKIE',
      'LINKEDIN_RECRUITER_SESSION',
      'OWNER_EMAIL',
      'OWNER_PHONE',
      'ESCALATION_SLACK_WEBHOOK',
    ]

    const credentials: Record<string, string> = {}

    for (const key of envKeys) {
      const value = await getCredential(key)
      if (value) {
        // Mask value for display (show last 4 chars only)
        if (value.length > 8) {
          credentials[key] = '••••••••' + value.slice(-4)
        } else {
          credentials[key] = '••••••••'
        }
      }
    }

    return NextResponse.json({ credentials })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get credentials' },
      { status: 500 }
    )
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
    const allowedKeys: CredentialKey[] = [
      'APOLLO_API_KEY',
      'LINKEDIN_SESSION_COOKIE',
      'LINKEDIN_RECRUITER_SESSION',
      'OWNER_EMAIL',
      'OWNER_PHONE',
      'ESCALATION_SLACK_WEBHOOK',
    ]

    if (!allowedKeys.includes(key as CredentialKey)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    const saved = await saveCredential(key as CredentialKey, value)

    if (saved) {
      return NextResponse.json({
        success: true,
        key,
        message: 'Saved to runtime cache. For persistent storage, add to Vercel env vars.',
      })
    } else {
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
  } catch (error) {
    console.error('Save credential error:', error)
    return NextResponse.json(
      { error: 'Failed to save credential' },
      { status: 500 }
    )
  }
}
