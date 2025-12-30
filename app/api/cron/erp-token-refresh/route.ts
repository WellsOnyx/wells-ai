// @ts-nocheck
/**
 * ERP Token Refresh Cron Job
 *
 * GET /api/cron/erp-token-refresh - Refresh expiring ERP tokens
 *
 * This endpoint is called by Vercel cron every 5 minutes to:
 * 1. Find all connections with tokens expiring soon
 * 2. Refresh those tokens automatically
 * 3. Log results for monitoring
 *
 * Vercel Cron Configuration (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/erp-token-refresh",
 *     "schedule": "* /5 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { credentialManager, ERPProvider } from '@/lib/erp/credential-manager'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'
export const maxDuration = 60

// Verify cron secret (set in Vercel dashboard)
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[ERP Token Refresh] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron authentication
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Find connections needing refresh (tokens expiring within 10 minutes)
    const expiringConnections = await sql`
      SELECT
        id,
        provider,
        user_id,
        company_id,
        token_expires_at,
        EXTRACT(EPOCH FROM (token_expires_at - NOW())) as seconds_until_expiry
      FROM erp_connections
      WHERE connection_status = 'active'
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW() + INTERVAL '10 minutes'
        AND token_expires_at > NOW() - INTERVAL '1 hour'
        AND provider != 'sage_intacct'
      ORDER BY token_expires_at ASC
      LIMIT 50
    `

    const results = {
      total: expiringConnections.length,
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { connectionId: string; provider: string; error: string }[],
    }

    for (const conn of expiringConnections) {
      const connectionId = conn.id
      const provider = conn.provider as ERPProvider

      try {
        // Mark refresh as started
        await sql`
          INSERT INTO erp_token_refresh_jobs (
            connection_id,
            provider,
            scheduled_at,
            started_at,
            status
          ) VALUES (
            ${connectionId},
            ${provider},
            NOW(),
            NOW(),
            'running'
          )
          ON CONFLICT (connection_id) WHERE status = 'pending'
          DO UPDATE SET started_at = NOW(), status = 'running'
        `

        // Attempt refresh
        const refreshed = await credentialManager.refreshTokens(connectionId)

        if (refreshed) {
          results.refreshed++

          // Log success
          await sql`
            INSERT INTO erp_credential_audit (
              connection_id,
              user_id,
              action,
              provider,
              success,
              metadata
            ) VALUES (
              ${connectionId},
              'system',
              'refresh',
              ${provider},
              true,
              ${{
                source: 'cron',
                old_expires_at: conn.token_expires_at,
                new_expires_at: refreshed.tokenExpiresAt?.toISOString(),
              }}
            )
          `

          // Update job status
          await sql`
            UPDATE erp_token_refresh_jobs
            SET
              status = 'success',
              completed_at = NOW(),
              new_token_expires_at = ${refreshed.tokenExpiresAt}
            WHERE connection_id = ${connectionId}
              AND status = 'running'
          `
        } else {
          results.skipped++

          await sql`
            UPDATE erp_token_refresh_jobs
            SET
              status = 'failed',
              completed_at = NOW(),
              error_message = 'No refresh token available'
            WHERE connection_id = ${connectionId}
              AND status = 'running'
          `
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          connectionId,
          provider,
          error: error.message,
        })

        // Log failure
        await sql`
          INSERT INTO erp_credential_audit (
            connection_id,
            user_id,
            action,
            provider,
            success,
            error_message,
            metadata
          ) VALUES (
            ${connectionId},
            'system',
            'refresh',
            ${provider},
            false,
            ${error.message},
            ${{ source: 'cron' }}
          )
        `

        // Update job status
        await sql`
          UPDATE erp_token_refresh_jobs
          SET
            status = 'failed',
            completed_at = NOW(),
            error_message = ${error.message},
            retry_count = retry_count + 1
          WHERE connection_id = ${connectionId}
            AND status = 'running'
        `

        // If too many failures, mark connection as needing reauth
        const [failureCount] = await sql`
          SELECT COUNT(*) as count
          FROM erp_token_refresh_jobs
          WHERE connection_id = ${connectionId}
            AND status = 'failed'
            AND created_at > NOW() - INTERVAL '1 hour'
        `

        if (failureCount?.count >= 3) {
          await sql`
            UPDATE erp_connections
            SET
              connection_status = 'error',
              last_sync_error = 'Token refresh failed repeatedly - reconnection required',
              updated_at = NOW()
            WHERE id = ${connectionId}
          `
        }
      }
    }

    console.log('[ERP Token Refresh] Cron complete:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('[ERP Token Refresh] Cron error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    )
  }
}
