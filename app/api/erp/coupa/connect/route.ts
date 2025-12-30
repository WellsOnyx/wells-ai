// @ts-nocheck
/**
 * Coupa Procurement Connection API
 *
 * POST /api/erp/coupa/connect - Connect to Coupa
 * GET /api/erp/coupa/connect - Test connection status
 * DELETE /api/erp/coupa/connect - Disconnect from Coupa
 *
 * Coupa is procurement-focused - best for supplier management,
 * invoices, and payments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createCoupaAdapter, CoupaConfig } from '@/lib/treasury-sdk/adapters/coupa'

// In-memory adapter cache (in production, use Redis or similar)
const adapterCache = new Map<string, ReturnType<typeof createCoupaAdapter>>()

/**
 * Get or create Coupa adapter for an instance
 */
export function getCoupaAdapter(instanceId: string, config?: CoupaConfig) {
  let adapter = adapterCache.get(instanceId)

  if (!adapter && config) {
    adapter = createCoupaAdapter(config)
    adapterCache.set(instanceId, adapter)
  }

  return adapter
}

/**
 * POST - Connect to Coupa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      instanceUrl,
      apiKey,
      clientId,
      clientSecret,
      scope,
      useOAuth = false,
      apiVersion = 'v1',
    } = body

    // Validate required fields
    if (!instanceUrl) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['instanceUrl'],
          optional: ['apiKey (for API Key auth)', 'clientId + clientSecret (for OAuth)'],
        },
        { status: 400 }
      )
    }

    if (!useOAuth && !apiKey) {
      return NextResponse.json(
        {
          error: 'apiKey is required for API Key authentication',
          hint: 'Set useOAuth: true if you want to use OAuth2 authentication',
        },
        { status: 400 }
      )
    }

    if (useOAuth && (!clientId || !clientSecret)) {
      return NextResponse.json(
        {
          error: 'clientId and clientSecret are required for OAuth2 authentication',
        },
        { status: 400 }
      )
    }

    const config: CoupaConfig = {
      instanceUrl,
      apiKey,
      clientId,
      clientSecret,
      scope,
      useOAuth,
      apiVersion,
      endpoint: `https://${instanceUrl}`,
      credentials: {
        type: useOAuth ? 'oauth2' : 'apikey',
        apiKey,
        clientId,
        clientSecret,
      },
    }

    const adapter = createCoupaAdapter(config)

    // Connect
    await adapter.connect()

    // Test connection
    const connected = await adapter.testConnection()

    if (!connected) {
      return NextResponse.json(
        {
          error: 'Failed to connect to Coupa',
          message: 'Could not authenticate with the provided credentials',
        },
        { status: 401 }
      )
    }

    // Cache the adapter using instance URL as key
    const instanceId = instanceUrl.replace(/\./g, '_')
    adapterCache.set(instanceId, adapter)

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Coupa Procurement',
      instanceUrl,
      authMethod: useOAuth ? 'oauth2' : 'apiKey',
      connectionStatus: adapter.getConnectionStatus(),
    })
  } catch (error) {
    console.error('Coupa connect error:', error)
    return NextResponse.json(
      {
        error: 'Connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Check connection status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const instanceUrl = searchParams.get('instanceUrl')

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl parameter is required' },
        { status: 400 }
      )
    }

    const instanceId = instanceUrl.replace(/\./g, '_')
    const adapter = adapterCache.get(instanceId)

    if (!adapter) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
        message: 'No connection configured for this instance',
      })
    }

    const status = adapter.getConnectionStatus()
    const isConnected = status === 'connected'

    // Test if still valid
    if (isConnected) {
      try {
        await adapter.testConnection()
      } catch {
        return NextResponse.json({
          connected: false,
          status: 'expired',
          message: 'Connection expired, please reconnect',
        })
      }
    }

    return NextResponse.json({
      connected: isConnected,
      status,
      instanceUrl,
    })
  } catch (error) {
    console.error('Coupa status check error:', error)
    return NextResponse.json(
      {
        error: 'Status check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Disconnect from Coupa
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const instanceUrl = searchParams.get('instanceUrl')

    if (!instanceUrl) {
      return NextResponse.json(
        { error: 'instanceUrl parameter is required' },
        { status: 400 }
      )
    }

    const instanceId = instanceUrl.replace(/\./g, '_')
    const adapter = adapterCache.get(instanceId)

    if (adapter) {
      await adapter.disconnect()
      adapterCache.delete(instanceId)
    }

    return NextResponse.json({
      success: true,
      message: 'Disconnected from Coupa',
      instanceUrl,
    })
  } catch (error) {
    console.error('Coupa disconnect error:', error)
    return NextResponse.json(
      {
        error: 'Disconnect failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
