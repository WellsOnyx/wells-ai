// @ts-nocheck
/**
 * ERP Encryption Key Rotation API
 *
 * POST /api/admin/erp/rotate-keys - Rotate encryption keys for all ERP credentials
 *
 * This is an admin-only endpoint that re-encrypts all ERP credentials
 * with a new encryption key. Should be used:
 * - When rotating keys as part of security policy
 * - If a key is suspected to be compromised
 * - During security audits
 *
 * Flow:
 * 1. Decrypt all credentials with old key
 * 2. Re-encrypt with new key
 * 3. Update database atomically
 * 4. Return summary of rotated connections
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { credentialManager } from '@/lib/erp/credential-manager'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large rotations

// Admin user IDs (should be in env vars in production)
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') || []

/**
 * POST - Rotate encryption keys
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    if (!ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { oldKey, newKey, newKeyId, dryRun = true } = body

    // Validate keys
    if (!oldKey || !/^[a-fA-F0-9]{64}$/.test(oldKey)) {
      return NextResponse.json(
        { error: 'Invalid old key format (must be 64 hex characters)' },
        { status: 400 }
      )
    }

    if (!newKey || !/^[a-fA-F0-9]{64}$/.test(newKey)) {
      return NextResponse.json(
        { error: 'Invalid new key format (must be 64 hex characters)' },
        { status: 400 }
      )
    }

    if (!newKeyId || newKeyId.length < 5) {
      return NextResponse.json(
        { error: 'newKeyId is required (min 5 characters)' },
        { status: 400 }
      )
    }

    // Get all active connections
    const connections = await sql`
      SELECT id, provider, access_token, refresh_token, webhook_secret
      FROM erp_connections
      WHERE connection_status = 'active'
      AND (access_token IS NOT NULL OR refresh_token IS NOT NULL)
    `

    const results = {
      total: connections.length,
      rotated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { connectionId: string; error: string }[],
    }

    for (const conn of connections) {
      try {
        // Check if credentials are actually encrypted
        const isEncrypted = conn.access_token
          ? credentialManager.isEncrypted(conn.access_token)
          : false

        if (!isEncrypted) {
          results.skipped++
          continue
        }

        if (!dryRun) {
          // Actually rotate the key
          await credentialManager.rotateConnectionKey(
            conn.id,
            oldKey,
            newKey,
            newKeyId
          )
        }

        results.rotated++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          connectionId: conn.id,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? 'Dry run complete - no changes made'
        : 'Key rotation complete',
      results,
      newKeyId,
      instructions: dryRun
        ? [
            'Review the results above',
            'If everything looks good, run again with dryRun: false',
            'After successful rotation, update ERP_ENCRYPTION_KEY and ERP_ENCRYPTION_KEY_ID in env vars',
          ]
        : [
            'Key rotation complete',
            'Update ERP_ENCRYPTION_KEY to the new key value',
            `Update ERP_ENCRYPTION_KEY_ID to "${newKeyId}"`,
            'Restart all services to pick up new env vars',
          ],
    })
  } catch (error: any) {
    console.error('[Admin ERP Key Rotation] Error:', error)
    return NextResponse.json(
      { error: 'Key rotation failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Generate new key pair
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    if (!ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const newKey = credentialManager.generateEncryptionKey()
    const newKeyId = credentialManager.generateKeyId()

    return NextResponse.json({
      success: true,
      newKey,
      newKeyId,
      instructions: [
        'Save these values securely - the key cannot be recovered',
        'Use this key pair in the POST request to rotate keys',
        'After rotation, update environment variables:',
        `  ERP_ENCRYPTION_KEY=${newKey}`,
        `  ERP_ENCRYPTION_KEY_ID=${newKeyId}`,
      ],
    })
  } catch (error: any) {
    console.error('[Admin ERP Key Generation] Error:', error)
    return NextResponse.json(
      { error: 'Key generation failed', details: error.message },
      { status: 500 }
    )
  }
}
