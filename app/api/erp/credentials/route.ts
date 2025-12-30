// @ts-nocheck
/**
 * ERP Credentials API
 *
 * POST /api/erp/credentials - Store credentials after OAuth callback
 * GET /api/erp/credentials - Get credential status (not the credentials themselves)
 * PUT /api/erp/credentials - Refresh tokens
 * DELETE /api/erp/credentials - Revoke credentials
 *
 * Security:
 * - All credentials are encrypted at rest with AES-256-GCM
 * - Provider-specific key derivation prevents cross-provider decryption
 * - Tokens are automatically refreshed before expiry
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import {
  credentialManager,
  ERPProvider,
  ERPCredentials,
} from '@/lib/erp/credential-manager'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST - Store credentials after OAuth callback or manual entry
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      connectionId,
      provider,
      credentials,
    }: {
      connectionId: string
      provider: ERPProvider
      credentials: Partial<ERPCredentials>
    } = body

    if (!connectionId || !provider) {
      return NextResponse.json(
        { error: 'connectionId and provider are required' },
        { status: 400 }
      )
    }

    // Verify user owns this connection
    const [connection] = await sql`
      SELECT id, user_id, provider FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - connection belongs to another user' },
        { status: 403 }
      )
    }

    // Validate credentials for the provider
    const validation = credentialManager.validateCredentials(provider, credentials)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          missing: validation.missing,
        },
        { status: 400 }
      )
    }

    // Store credentials based on provider type
    switch (provider) {
      case 'sage_intacct':
        await credentialManager.storeSageIntacctCredentials(connectionId, {
          senderId: credentials.senderId!,
          senderPassword: credentials.senderPassword!,
          userId: credentials.userId!,
          userPassword: credentials.userPassword!,
          companyId: credentials.intacctCompanyId!,
        })
        break

      case 'workday':
        await credentialManager.storeWorkdayCredentials(connectionId, {
          tenant: credentials.tenantId!,
          integrationId: credentials.integrationId!,
          integrationSecret: credentials.integrationSecret!,
          refreshToken: credentials.refreshToken!,
          dataCenter: credentials.dataCenter,
        })
        break

      case 'netsuite':
        if (credentials.consumerKey) {
          // Token-based auth
          await credentialManager.storeNetSuiteCredentials(connectionId, {
            accountId: credentials.accountId!,
            consumerKey: credentials.consumerKey!,
            consumerSecret: credentials.consumerSecret!,
            tokenKey: credentials.tokenKey!,
            tokenSecret: credentials.tokenSecret!,
          })
        } else {
          // OAuth
          await credentialManager.storeCredentials(connectionId, {
            ...credentials,
            provider,
            connectionId,
          } as ERPCredentials)
        }
        break

      default:
        // Standard OAuth providers
        await credentialManager.storeCredentials(connectionId, {
          ...credentials,
          provider,
          connectionId,
        } as ERPCredentials)
    }

    // Update connection status
    await sql`
      UPDATE erp_connections
      SET
        connection_status = 'active',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `

    return NextResponse.json({
      success: true,
      message: `Credentials stored for ${provider}`,
      connectionId,
    })
  } catch (error: any) {
    console.error('[ERP Credentials] Store error:', error)
    return NextResponse.json(
      { error: 'Failed to store credentials', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get credential status (never returns actual credentials)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    // Get connection with ownership check
    const [connection] = await sql`
      SELECT
        id,
        user_id,
        provider,
        connection_status,
        token_expires_at,
        last_sync_at,
        last_sync_status
      FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const provider = connection.provider as ERPProvider
    const tokenExpiresAt = connection.token_expires_at
      ? new Date(connection.token_expires_at)
      : undefined

    // Check if credentials need refresh
    const needsRefresh = credentialManager.needsRefresh(provider, tokenExpiresAt)

    // Calculate time until expiry
    let expiresIn: number | null = null
    if (tokenExpiresAt) {
      expiresIn = Math.max(0, Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000))
    }

    return NextResponse.json({
      connectionId,
      provider,
      status: connection.connection_status,
      credentials: {
        hasAccessToken: connection.connection_status === 'active',
        hasRefreshToken: true, // We don't expose this directly
        tokenExpiresAt: tokenExpiresAt?.toISOString(),
        expiresIn,
        needsRefresh,
      },
      sync: {
        lastSyncAt: connection.last_sync_at,
        lastSyncStatus: connection.last_sync_status,
      },
    })
  } catch (error: any) {
    console.error('[ERP Credentials] Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to get credential status', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT - Refresh tokens
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { connectionId } = body

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const [connection] = await sql`
      SELECT id, user_id, provider FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Refresh tokens
    const refreshed = await credentialManager.refreshTokens(connectionId)

    if (!refreshed) {
      return NextResponse.json(
        { error: 'Failed to refresh tokens - reconnection may be required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      connectionId,
      tokenExpiresAt: refreshed.tokenExpiresAt?.toISOString(),
      expiresIn: refreshed.tokenExpiresAt
        ? Math.floor((refreshed.tokenExpiresAt.getTime() - Date.now()) / 1000)
        : null,
    })
  } catch (error: any) {
    console.error('[ERP Credentials] Refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh tokens', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Revoke credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const [connection] = await sql`
      SELECT id, user_id, provider FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Clear credentials (soft delete - keep connection record)
    await sql`
      UPDATE erp_connections
      SET
        access_token = NULL,
        refresh_token = NULL,
        token_expires_at = NULL,
        webhook_secret = NULL,
        intacct_sender_password = NULL,
        intacct_user_password = NULL,
        workday_integration_secret = NULL,
        netsuite_consumer_secret = NULL,
        netsuite_token_secret = NULL,
        connection_status = 'disconnected',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `

    return NextResponse.json({
      success: true,
      message: 'Credentials revoked',
      connectionId,
    })
  } catch (error: any) {
    console.error('[ERP Credentials] Revoke error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke credentials', details: error.message },
      { status: 500 }
    )
  }
}
