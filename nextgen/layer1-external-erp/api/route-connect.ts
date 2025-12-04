// @ts-nocheck
/**
 * Layer 1: Integration Connect API
 * POST /api/integrations/connect
 *
 * Establish connections between Grain & Vault accounts and external ERPs
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  IntegrationConnection,
  ConnectRequest,
  ErpSourceSystem,
} from '../types'

// ============================================================================
// In-memory store (replace with database in production)
// ============================================================================

const connectionsStore: Map<string, IntegrationConnection> = new Map()

// ============================================================================
// OAUTH CONFIGURATION (per provider)
// ============================================================================

const oauthConfigs: Record<string, {
  authUrl: string
  tokenUrl: string
  scopes: string[]
}> = {
  merge: {
    authUrl: 'https://api.merge.dev/api/integrations/connect',
    tokenUrl: 'https://api.merge.dev/api/integrations/token',
    scopes: ['accounting.read', 'accounting.write'],
  },
  workato: {
    authUrl: 'https://www.workato.com/oauth/authorize',
    tokenUrl: 'https://www.workato.com/oauth/token',
    scopes: ['read', 'write'],
  },
  quickbooks: {
    authUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    scopes: ['com.intuit.quickbooks.accounting'],
  },
  xero: {
    authUrl: 'https://login.xero.com/identity/connect/authorize',
    tokenUrl: 'https://identity.xero.com/connect/token',
    scopes: ['openid', 'profile', 'email', 'accounting.transactions', 'accounting.contacts'],
  },
  netsuite: {
    authUrl: 'https://system.netsuite.com/app/login/oauth2/authorize.nl',
    tokenUrl: 'https://system.netsuite.com/oauth2/v1/token',
    scopes: ['rest_webservices', 'restlets'],
  },
}

// ============================================================================
// API HANDLERS
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: ConnectRequest = await request.json()

    // Validate required fields
    if (!body.providerId || !body.erpSystem) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, erpSystem' },
        { status: 400 }
      )
    }

    // Get account ID from auth header (in production, from JWT/session)
    const accountId = request.headers.get('x-account-id') || 'demo-account'

    // Check if connection already exists
    const existingKey = `${accountId}-${body.erpSystem}`
    const existing = Array.from(connectionsStore.values()).find(
      c => c.accountId === accountId && c.erpSystem === body.erpSystem
    )

    if (existing && existing.status === 'connected') {
      return NextResponse.json(
        { error: 'Connection already exists for this ERP system' },
        { status: 409 }
      )
    }

    // Handle different auth types
    let connection: IntegrationConnection

    if (body.authCode) {
      // OAuth flow - exchange code for tokens
      connection = await handleOAuthConnect(accountId, body)
    } else if (body.apiKey) {
      // API Key auth
      connection = handleApiKeyConnect(accountId, body)
    } else if (body.credentials) {
      // Basic auth
      connection = handleBasicAuthConnect(accountId, body)
    } else {
      // Return OAuth URL for user to authorize
      const oauthUrl = generateOAuthUrl(body.erpSystem, accountId)
      return NextResponse.json({
        status: 'pending',
        message: 'Authorization required',
        authUrl: oauthUrl,
        connectionId: crypto.randomUUID(),
      })
    }

    connectionsStore.set(connection.id, connection)

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        status: connection.status,
        erpSystem: connection.erpSystem,
        erpCompanyName: connection.erpCompanyName,
        syncDirection: connection.syncDirection,
        syncFrequency: connection.syncFrequency,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST connect error:', error)
    return NextResponse.json(
      { error: 'Failed to establish connection' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id') || 'demo-account'
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')

    if (connectionId) {
      const connection = connectionsStore.get(connectionId)
      if (!connection || connection.accountId !== accountId) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(sanitizeConnection(connection))
    }

    // Return all connections for account
    const connections = Array.from(connectionsStore.values())
      .filter(c => c.accountId === accountId)
      .map(sanitizeConnection)

    return NextResponse.json({ connections })
  } catch (error) {
    console.error('GET connections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id') || 'demo-account'
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const connection = connectionsStore.get(connectionId)
    if (!connection || connection.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Mark as disconnected instead of deleting
    const updated: IntegrationConnection = {
      ...connection,
      status: 'disconnected',
      accessToken: undefined,
      refreshToken: undefined,
      apiKey: undefined,
      updatedAt: new Date().toISOString(),
    }

    connectionsStore.set(connectionId, updated)

    return NextResponse.json({
      success: true,
      message: 'Connection disconnected',
    })
  } catch (error) {
    console.error('DELETE connection error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function handleOAuthConnect(
  accountId: string,
  body: ConnectRequest
): Promise<IntegrationConnection> {
  // In production, exchange authCode for tokens with provider
  // For now, simulate successful token exchange

  const tokens = await exchangeOAuthCode(body.erpSystem, body.authCode!)

  return {
    id: crypto.randomUUID(),
    accountId,
    providerId: body.providerId,
    erpSystem: body.erpSystem,
    status: 'connected',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    syncDirection: body.syncDirection || 'bidirectional',
    syncFrequency: body.syncFrequency || 'hourly',
    erpCompanyId: tokens.companyId,
    erpCompanyName: tokens.companyName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function handleApiKeyConnect(
  accountId: string,
  body: ConnectRequest
): IntegrationConnection {
  return {
    id: crypto.randomUUID(),
    accountId,
    providerId: body.providerId,
    erpSystem: body.erpSystem,
    status: 'connected',
    apiKey: body.apiKey,
    syncDirection: body.syncDirection || 'bidirectional',
    syncFrequency: body.syncFrequency || 'hourly',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function handleBasicAuthConnect(
  accountId: string,
  body: ConnectRequest
): IntegrationConnection {
  // In production, encrypt credentials
  return {
    id: crypto.randomUUID(),
    accountId,
    providerId: body.providerId,
    erpSystem: body.erpSystem,
    status: 'connected',
    syncDirection: body.syncDirection || 'bidirectional',
    syncFrequency: body.syncFrequency || 'hourly',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function generateOAuthUrl(erpSystem: ErpSourceSystem, accountId: string): string {
  const config = oauthConfigs[erpSystem] || oauthConfigs.merge
  const state = Buffer.from(JSON.stringify({ accountId, erpSystem })).toString('base64')

  const params = new URLSearchParams({
    client_id: process.env[`${erpSystem.toUpperCase()}_CLIENT_ID`] || 'demo-client',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/callback`,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  })

  return `${config.authUrl}?${params.toString()}`
}

async function exchangeOAuthCode(
  erpSystem: ErpSourceSystem,
  authCode: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: string
  companyId?: string
  companyName?: string
}> {
  // In production, make actual API call to exchange code
  // Simulated response for development
  return {
    accessToken: `at_${crypto.randomUUID()}`,
    refreshToken: `rt_${crypto.randomUUID()}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    companyId: 'demo-company-123',
    companyName: 'Demo Company Inc.',
  }
}

function sanitizeConnection(connection: IntegrationConnection): Partial<IntegrationConnection> {
  // Remove sensitive fields before returning
  const { accessToken, refreshToken, apiKey, ...safe } = connection
  return {
    ...safe,
    hasAccessToken: !!accessToken,
    hasApiKey: !!apiKey,
  } as Partial<IntegrationConnection>
}

// Export for Next.js App Router
export { GET as getConnections, POST as createConnection, DELETE as disconnectConnection }
