// @ts-nocheck
/**
 * Workday Financial Management Connection API
 *
 * POST /api/erp/workday/connect - Connect to Workday
 * GET /api/erp/workday/connect - Test connection status
 * DELETE /api/erp/workday/connect - Disconnect from Workday
 *
 * Critical for contractor/payroll spend management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWorkdayAdapter, WorkdayConfig } from '@/lib/treasury-sdk/adapters/workday'

// In-memory adapter cache (in production, use Redis or similar)
const adapterCache = new Map<string, ReturnType<typeof createWorkdayAdapter>>()

/**
 * Get or create Workday adapter for a tenant
 */
export function getWorkdayAdapter(tenantId: string, config?: WorkdayConfig) {
  let adapter = adapterCache.get(tenantId)

  if (!adapter && config) {
    adapter = createWorkdayAdapter(config)
    adapterCache.set(tenantId, adapter)
  }

  return adapter
}

/**
 * POST - Connect to Workday
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tenant,
      integrationId,
      integrationSecret,
      refreshToken,
      dataCenter = 'us',
      apiVersion = 'v1',
    } = body

    // Validate required fields
    if (!tenant || !integrationId || !integrationSecret) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['tenant', 'integrationId', 'integrationSecret'],
        },
        { status: 400 }
      )
    }

    const config: WorkdayConfig = {
      tenant,
      integrationId,
      integrationSecret,
      refreshToken,
      dataCenter,
      apiVersion,
      endpoint: `https://wd2-impl-services1.workday.com/ccx/api/financial_management/${apiVersion}/${tenant}`,
      credentials: {
        type: 'oauth2',
        clientId: integrationId,
        clientSecret: integrationSecret,
      },
    }

    const adapter = createWorkdayAdapter(config)

    // Test connection
    const connected = await adapter.testConnection()

    if (!connected) {
      return NextResponse.json(
        {
          error: 'Failed to connect to Workday',
          message: 'Could not authenticate with the provided credentials',
        },
        { status: 401 }
      )
    }

    // Cache the adapter
    adapterCache.set(tenant, adapter)

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Workday Financial Management',
      tenant,
      dataCenter,
      connectionStatus: adapter.getConnectionStatus(),
    })
  } catch (error) {
    console.error('Workday connect error:', error)
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
    console.error('Workday status check error:', error)
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
 * DELETE - Disconnect from Workday
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
      message: 'Disconnected from Workday',
      tenant,
    })
  } catch (error) {
    console.error('Workday disconnect error:', error)
    return NextResponse.json(
      {
        error: 'Disconnect failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
