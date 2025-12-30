// @ts-nocheck
/**
 * Workday OAuth 2.0 Callback Handler
 *
 * GET /api/erp/workday/callback - Handle OAuth authorization code exchange
 *
 * This endpoint completes the OAuth 2.0 flow for Workday:
 * 1. Receives authorization code from Workday
 * 2. Exchanges code for access and refresh tokens
 * 3. Stores encrypted tokens in database
 * 4. Triggers initial sync of contractor data (CRITICAL for GRAIN)
 *
 * State parameter encodes: connectionId|tenantAlias|dataCenter|isProduction
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { workday } from '@/lib/erp/workday'
import { credentialManager } from '@/lib/erp/credential-manager'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'
export const maxDuration = 60

// Frontend redirect URLs
const SUCCESS_REDIRECT = process.env.NEXT_PUBLIC_APP_URL || 'https://wellsai.app'
const ERROR_REDIRECT = `${SUCCESS_REDIRECT}/erp/connect?error=`

/**
 * GET - Handle OAuth callback from Workday
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth error from Workday
    if (error) {
      console.error('[Workday Callback] OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent(errorDescription || error)}`
      )
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Missing code or state parameter')}`
      )
    }

    // Parse state: connectionId|tenantAlias|dataCenter|isProduction
    const [connectionId, tenantAlias, dataCenter, isProductionStr] = state.split('|')
    const isProduction = isProductionStr === 'true'

    if (!connectionId || !tenantAlias) {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Invalid state parameter')}`
      )
    }

    if (!sql) {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Database not configured')}`
      )
    }

    // Verify connection exists
    const [connection] = await sql`
      SELECT id, user_id, provider
      FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Connection not found')}`
      )
    }

    if (connection.provider !== 'workday') {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Invalid connection provider')}`
      )
    }

    // Exchange authorization code for tokens
    const tokens = await workday.exchangeCodeForTokens(
      code,
      tenantAlias,
      dataCenter as any,
      isProduction
    )

    // Calculate token expiry
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + tokens.expires_in)

    // Store credentials using credential manager (encrypted)
    await credentialManager.storeCredentials(connectionId, {
      connectionId,
      provider: 'workday',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
    })

    // Update connection with Workday-specific metadata
    await sql`
      UPDATE erp_connections
      SET
        connection_status = 'active',
        workday_tenant_alias = ${tenantAlias},
        workday_data_center = ${dataCenter || 'us'},
        workday_is_production = ${isProduction},
        token_expires_at = ${tokenExpiresAt.toISOString()},
        connected_at = NOW(),
        updated_at = NOW()
      WHERE id = ${connectionId}
    `

    // Log successful connection
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
        ${connection.user_id || 'system'},
        'oauth_callback',
        'workday',
        true,
        ${JSON.stringify({
          tenantAlias,
          dataCenter,
          isProduction,
          tokenType: tokens.token_type,
          expiresIn: tokens.expires_in,
        })}
      )
    `

    // Trigger initial sync in background (non-blocking)
    triggerInitialSync(connectionId).catch(err => {
      console.error('[Workday Callback] Initial sync error:', err)
    })

    // Redirect to success page with connection details
    const successUrl = new URL(`${SUCCESS_REDIRECT}/erp/workday/success`)
    successUrl.searchParams.set('connectionId', connectionId)
    successUrl.searchParams.set('tenant', tenantAlias)

    return NextResponse.redirect(successUrl.toString())
  } catch (error: any) {
    console.error('[Workday Callback] Error:', error)

    // Log failure if we have connection ID
    const state = request.nextUrl.searchParams.get('state')
    if (state && sql) {
      const [connectionId] = state.split('|')
      try {
        await sql`
          INSERT INTO erp_credential_audit (
            connection_id,
            user_id,
            action,
            provider,
            success,
            error_message
          ) VALUES (
            ${connectionId},
            'system',
            'oauth_callback',
            'workday',
            false,
            ${error.message}
          )
        `
      } catch {
        // Ignore audit logging errors
      }
    }

    return NextResponse.redirect(
      `${ERROR_REDIRECT}${encodeURIComponent(error.message || 'OAuth callback failed')}`
    )
  }
}

/**
 * Trigger initial sync after successful OAuth
 * Runs in background - syncs vendors, bills, and CRITICALLY - contractors
 */
async function triggerInitialSync(connectionId: string): Promise<void> {
  console.log(`[Workday] Triggering initial sync for connection ${connectionId}`)

  try {
    // Full sync including contractors (for GRAIN)
    const result = await workday.fullSync(connectionId)

    console.log('[Workday] Initial sync complete:', {
      vendors: result.vendorsFound,
      bills: result.billsFound,
      payments: result.paymentsFound,
      contractors: result.contractorsFound,
      errors: result.errors.length,
    })

    // Calculate GRAIN eligibility if contractors found
    if (result.contractorsFound > 0) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const eligibility = await workday.calculateGrainEligibility(
        connectionId,
        thirtyDaysAgo,
        new Date()
      )

      console.log('[Workday] GRAIN eligibility:', {
        eligible: eligibility.eligible,
        contractorVolume: eligibility.contractorVolume,
        estimatedTokens: eligibility.estimatedGrainTokens,
      })

      // Store GRAIN eligibility data
      if (sql) {
        await sql`
          UPDATE erp_connections
          SET
            grain_eligible = ${eligibility.eligible},
            grain_contractor_volume = ${eligibility.contractorVolume},
            grain_estimated_tokens = ${eligibility.estimatedGrainTokens},
            updated_at = NOW()
          WHERE id = ${connectionId}
        `
      }
    }
  } catch (error) {
    console.error('[Workday] Initial sync failed:', error)
    // Don't throw - this is background work
  }
}
