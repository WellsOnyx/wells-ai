// @ts-nocheck
/**
 * Infor ION OAuth 2.0 Callback Handler
 *
 * GET /api/erp/infor/callback - Handle OAuth authorization code exchange
 *
 * This endpoint completes the OAuth 2.0 flow for Infor ION API Gateway:
 * 1. Receives authorization code from ION
 * 2. Exchanges code for access and refresh tokens
 * 3. Stores encrypted tokens in database
 * 4. Triggers initial sync
 *
 * State parameter encodes: connectionId|ionHost|tenantId|product|logicalId
 */

import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { infor } from '@/lib/erp/infor'
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
 * GET - Handle OAuth callback from Infor ION
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth error from ION
    if (error) {
      console.error('[Infor Callback] OAuth error:', error, errorDescription)
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

    // Parse state: connectionId|ionHost|tenantId|product|logicalId
    const [connectionId, ionHost, tenantId, product, logicalId] = state.split('|')

    if (!connectionId || !ionHost || !tenantId) {
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

    if (connection.provider !== 'infor') {
      return NextResponse.redirect(
        `${ERROR_REDIRECT}${encodeURIComponent('Invalid connection provider')}`
      )
    }

    // Exchange authorization code for tokens
    const tokens = await infor.exchangeCodeForTokens(code, ionHost, tenantId)

    // Calculate token expiry
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + tokens.expires_in)

    // Store credentials using credential manager (encrypted)
    await credentialManager.storeCredentials(connectionId, {
      connectionId,
      provider: 'infor',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
    })

    // Update connection with Infor-specific metadata
    await sql`
      UPDATE erp_connections
      SET
        connection_status = 'active',
        infor_ion_gateway_url = ${ionHost},
        infor_tenant = ${tenantId},
        infor_product = ${product || 'csf'},
        infor_logical_id = ${logicalId || null},
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
        'infor',
        true,
        ${JSON.stringify({
          ionHost,
          tenantId,
          product,
          logicalId,
          tokenType: tokens.token_type,
          expiresIn: tokens.expires_in,
        })}
      )
    `

    // Trigger initial sync in background (non-blocking)
    triggerInitialSync(connectionId).catch(err => {
      console.error('[Infor Callback] Initial sync error:', err)
    })

    // Redirect to success page with connection details
    const successUrl = new URL(`${SUCCESS_REDIRECT}/erp/infor/success`)
    successUrl.searchParams.set('connectionId', connectionId)
    successUrl.searchParams.set('product', product || 'csf')

    return NextResponse.redirect(successUrl.toString())
  } catch (error: any) {
    console.error('[Infor Callback] Error:', error)

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
            'infor',
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
 */
async function triggerInitialSync(connectionId: string): Promise<void> {
  console.log(`[Infor] Triggering initial sync for connection ${connectionId}`)

  try {
    const result = await infor.fullSync(connectionId)

    console.log('[Infor] Initial sync complete:', {
      vendors: result.vendorsFound,
      bills: result.billsFound,
      payments: result.paymentsFound,
      errors: result.errors.length,
    })
  } catch (error) {
    console.error('[Infor] Initial sync failed:', error)
  }
}
