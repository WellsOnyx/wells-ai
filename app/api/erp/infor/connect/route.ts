// @ts-nocheck
/**
 * Infor CloudSuite Connection API
 *
 * POST /api/erp/infor/connect - Connect to Infor ION API
 * GET /api/erp/infor/connect - Test connection status
 * DELETE /api/erp/infor/connect - Disconnect from Infor
 */

import { NextRequest, NextResponse } from 'next/server'
import { createInforAdapter, InforConfig } from '@/lib/treasury-sdk/adapters/infor'

// In-memory adapter cache (in production, use Redis or similar)
const adapterCache = new Map<string, ReturnType<typeof createInforAdapter>>()

/**
 * Get or create Infor adapter for a tenant
 */
export function getInforAdapter(tenantId: string, config?: InforConfig) {
  let adapter = adapterCache.get(tenantId)

  if (!adapter && config) {
    adapter = createInforAdapter(config)
    adapterCache.set(tenantId, adapter)
  }

  return adapter
}

/**
 * POST - Connect to Infor CloudSuite
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tenant,
      ionGatewayUrl,
      clientId,
      clientSecret,
      logicalId,
      dataAreaId,
      product = 'csf',
      apiVersion = 'v1',
    } = body

    // Validate required fields
    if (!tenant || !ionGatewayUrl || !clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['tenant', 'ionGatewayUrl', 'clientId', 'clientSecret'],
        },
        { status: 400 }
      )
    }

    const config: InforConfig = {
      tenant,
      ionGatewayUrl,
      clientId,
      clientSecret,
      logicalId,
      dataAreaId,
      product,
      apiVersion,
      endpoint: ionGatewayUrl,
      credentials: {
        type: 'oauth2',
        clientId,
        clientSecret,
      },
    }

    const adapter = createInforAdapter(config)

    // Test connection
    const connected = await adapter.testConnection()

    if (!connected) {
      return NextResponse.json(
        {
          error: 'Failed to connect to Infor',
          message: 'Could not authenticate with the provided credentials',
        },
        { status: 401 }
      )
    }

    // Cache the adapter
    adapterCache.set(tenant, adapter)

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Infor CloudSuite',
      tenant,
      product,
      dataAreaId,
      connectionStatus: adapter.getConnectionStatus(),
    })
  } catch (error) {
    console.error('Infor connect error:', error)
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
    const tenant = searchParams.get('tenant')

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant parameter is required' },
        { status: 400 }
      )
    }

    const adapter = adapterCache.get(tenant)

    if (!adapter) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
        message: 'No connection configured for this tenant',
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
      tenant,
    })
  } catch (error) {
    console.error('Infor status check error:', error)
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
 * DELETE - Disconnect from Infor
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tenant = searchParams.get('tenant')

    if (!tenant) {
      return NextResponse.json(
        { error: 'tenant parameter is required' },
        { status: 400 }
      )
    }

    const adapter = adapterCache.get(tenant)

    if (adapter) {
      await adapter.disconnect()
      adapterCache.delete(tenant)
    }

    return NextResponse.json({
      success: true,
      message: 'Disconnected from Infor CloudSuite',
      tenant,
    })
  } catch (error) {
    console.error('Infor disconnect error:', error)
    return NextResponse.json(
      {
        error: 'Disconnect failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
