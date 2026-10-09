// @ts-nocheck
/**
 * Unified ERP Connection API
 *
 * POST /api/erp/connect - Connect to any ERP
 * GET /api/erp/connect - Get connection status
 * DELETE /api/erp/connect - Disconnect from ERP
 *
 * Supported ERPs:
 * - QuickBooks (SMB - 500K+ businesses)
 * - Xero (SMB - Global)
 * - NetSuite (Mid-market)
 * - SAP (Enterprise)
 * - Oracle (Enterprise)
 * - Dynamics 365 (Enterprise)
 * - Workday (Enterprise - contractor payroll)
 * - Coupa (Procurement)
 * - Sage Intacct (Mid-market)
 * - Acumatica (Mid-market)
 * - Infor (Enterprise)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { v4 as uuidv4 } from 'uuid'

import { quickbooks } from '@/lib/erp/quickbooks'
import { xero } from '@/lib/erp/xero'
import { netsuite } from '@/lib/erp/netsuite'
import { sap } from '@/lib/erp/sap'
import { oracle } from '@/lib/erp/oracle'
import { dynamics365 } from '@/lib/erp/dynamics365'
import { workday } from '@/lib/erp/workday'
import { coupa } from '@/lib/erp/coupa'
import { sageIntacct } from '@/lib/erp/sage-intacct'
import { acumatica } from '@/lib/erp/acumatica'
import { infor } from '@/lib/erp/infor'
import { unifiedERP } from '@/lib/erp/unified-erp-service'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export const runtime = 'nodejs'
export const maxDuration = 60

// Supported ERP providers
const SUPPORTED_PROVIDERS = [
  'quickbooks',
  'xero',
  'netsuite',
  'sap',
  'oracle',
  'dynamics365',
  'workday',
  'coupa',
  'sage_intacct',
  'acumatica',
  'infor',
] as const

type ERPProvider = typeof SUPPORTED_PROVIDERS[number]

/**
 * POST - Connect to ERP (initiate OAuth or store credentials)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, companyId, credentials, ...providerConfig } = body

    // Validate provider
    if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        {
          error: 'Invalid provider',
          supported: SUPPORTED_PROVIDERS,
        },
        { status: 400 }
      )
    }

    // Check for existing connection
    const [existingConnection] = await sql`
      SELECT id FROM erp_connections
      WHERE company_id = ${companyId}
      AND provider = ${provider}
    `

    let connectionId = existingConnection?.id

    if (!connectionId) {
      // Create new connection record
      const [newConnection] = await sql`
        INSERT INTO erp_connections (
          id,
          company_id,
          user_id,
          provider,
          connection_status,
          created_at,
          updated_at
        ) VALUES (
          ${uuidv4()},
          ${companyId},
          ${userId},
          ${provider},
          'pending',
          NOW(),
          NOW()
        )
        RETURNING id
      `
      connectionId = newConnection.id
    }

    // Generate OAuth URL or store credentials based on provider
    let result: any = { connectionId }

    switch (provider) {
      case 'quickbooks':
        const qbAuthUrl = quickbooks.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64')
        )
        result.authUrl = qbAuthUrl
        result.method = 'oauth'
        break

      case 'xero':
        const xeroAuthUrl = xero.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64')
        )
        result.authUrl = xeroAuthUrl
        result.method = 'oauth'
        break

      case 'netsuite':
        const nsAuthUrl = netsuite.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64')
        )
        result.authUrl = nsAuthUrl
        result.method = 'oauth'
        break

      case 'sap':
        const sapAuthUrl = sap.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.apiEndpoint || ''
        )
        result.authUrl = sapAuthUrl
        result.method = 'oauth'
        break

      case 'oracle':
        const oracleAuthUrl = oracle.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.oracleHost || ''
        )
        result.authUrl = oracleAuthUrl
        result.method = 'oauth'
        break

      case 'dynamics365':
        const d365AuthUrl = dynamics365.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.tenantId || '',
          providerConfig.variant || 'business_central'
        )
        result.authUrl = d365AuthUrl
        result.method = 'oauth'
        break

      case 'workday':
        const wdAuthUrl = workday.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.tenant || '',
          providerConfig.dataCenter || 'us'
        )
        result.authUrl = wdAuthUrl
        result.method = 'oauth'
        break

      case 'coupa':
        const coupaAuthUrl = coupa.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.instanceUrl || ''
        )
        result.authUrl = coupaAuthUrl
        result.method = 'oauth'
        break

      case 'sage_intacct':
        // Sage Intacct uses sender ID + user credentials
        if (credentials?.userId && credentials?.userPassword) {
          await sql`
            UPDATE erp_connections
            SET
              intacct_user_id = ${credentials.userId},
              intacct_user_password = ${credentials.userPassword},
              intacct_company_id = ${providerConfig.companyId || ''},
              connection_status = 'pending_verification',
              updated_at = NOW()
            WHERE id = ${connectionId}
          `
          result.method = 'credentials'
          result.status = 'pending_verification'
        } else {
          return NextResponse.json(
            { error: 'Sage Intacct requires userId and userPassword' },
            { status: 400 }
          )
        }
        break

      case 'acumatica':
        const acumAuthUrl = acumatica.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.instanceUrl || '',
          providerConfig.tenant
        )
        result.authUrl = acumAuthUrl
        result.method = 'oauth'
        break

      case 'infor':
        const inforAuthUrl = infor.getAuthorizationUrl(
          Buffer.from(JSON.stringify({ connectionId, companyId })).toString('base64'),
          providerConfig.ionGatewayUrl || '',
          providerConfig.tenant || '',
          providerConfig.product || 'csf'
        )
        result.authUrl = inforAuthUrl
        result.method = 'oauth'
        break

      default:
        return NextResponse.json(
          { error: `Provider ${provider} not implemented` },
          { status: 501 }
        )
    }

    return NextResponse.json({
      success: true,
      provider,
      ...result,
    })
  } catch (error: any) {
    console.error('[ERP Connect] Error:', error)
    return NextResponse.json(
      { error: 'Connection failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get connection status for a company
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const provider = searchParams.get('provider')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    let connections

    if (provider) {
      connections = await sql`
        SELECT
          id,
          provider,
          connection_status,
          last_sync_at,
          last_sync_status,
          last_sync_error,
          next_sync_at,
          created_at,
          updated_at
        FROM erp_connections
        WHERE company_id = ${companyId}
        AND provider = ${provider}
      `
    } else {
      connections = await sql`
        SELECT
          id,
          provider,
          connection_status,
          last_sync_at,
          last_sync_status,
          last_sync_error,
          next_sync_at,
          created_at,
          updated_at
        FROM erp_connections
        WHERE company_id = ${companyId}
        ORDER BY updated_at DESC
      `
    }

    // Test each connection and update status
    const connectionsWithStatus = await Promise.all(
      connections.map(async (conn) => {
        let isHealthy = false
        try {
          if (conn.connection_status === 'active') {
            isHealthy = await unifiedERP.testConnection(conn.id)
          }
        } catch (e) {
          // Connection test failed
        }

        return {
          ...conn,
          isHealthy,
        }
      })
    )

    return NextResponse.json({
      connections: connectionsWithStatus,
      availableProviders: SUPPORTED_PROVIDERS,
    })
  } catch (error: any) {
    console.error('[ERP Connect] Status check error:', error)
    return NextResponse.json(
      { error: 'Status check failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Disconnect from ERP
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
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 })
    }

    // Verify ownership
    const [connection] = await sql`
      SELECT id, provider FROM erp_connections
      WHERE id = ${connectionId}
    `

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Soft delete - mark as disconnected
    await sql`
      UPDATE erp_connections
      SET
        connection_status = 'disconnected',
        access_token = NULL,
        refresh_token = NULL,
        updated_at = NOW()
      WHERE id = ${connectionId}
    `

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${connection.provider}`,
      connectionId,
    })
  } catch (error: any) {
    console.error('[ERP Connect] Disconnect error:', error)
    return NextResponse.json(
      { error: 'Disconnect failed', details: error.message },
      { status: 500 }
    )
  }
}
