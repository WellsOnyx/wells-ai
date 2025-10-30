import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import { query } from '@/lib/db'
import {
  createPurchaseOrder,
  syncVendor,
  searchVendor,
  convertDealToPurchaseOrder,
  convertSupplierToVendor,
  getIntegrationInfo,
} from '@/lib/merge'

/**
 * ERP Sync API
 * POST /api/deals/sync-erp
 *
 * Automatically syncs Wells AI deals to customer's ERP system
 * via Merge.dev universal API (SAP, Oracle, NetSuite, Workday, Coupa, Ariba, etc.)
 *
 * This is the "paperwork automation" that eliminates manual PO creation.
 * When a deal closes on Wells AI, it automatically appears in the customer's ERP.
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/deals/sync-erp', 'POST')

  try {
    const { dealId, force } = await req.json()

    if (!dealId) {
      monitor.end(false)
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

    // Get deal details
    const dealResult = await query<any>(
      `SELECT
        d.id,
        d.supplier_id as "supplierId",
        d.buyer_id as "buyerId",
        d.amount,
        d.wells_fee as "wellsFee",
        d.status,
        d.quote_id as "quoteId",
        d.created_at as "createdAt",
        s.name as supplier_name,
        s.email as supplier_email,
        s.contact_phone as supplier_phone,
        s.contact_email as supplier_contact_email,
        s.address as supplier_address,
        s.industry as supplier_industry,
        s.specialties as supplier_specialties,
        q.product_name,
        q.quantity,
        q.delivery_time as "deliveryTime",
        r.description as rfq_description
       FROM deals d
       LEFT JOIN suppliers s ON d.supplier_id = s.id
       LEFT JOIN quotes q ON d.quote_id = q.id
       LEFT JOIN rfqs r ON q.rfq_id = r.id
       WHERE d.id = $1`,
      [dealId]
    )

    if (dealResult.rows.length === 0) {
      monitor.end(false)
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const deal = dealResult.rows[0]

    // Check if deal is eligible for sync
    if (!force && deal.status !== 'paid' && deal.status !== 'completed') {
      monitor.end(false)
      return NextResponse.json(
        {
          error: 'Deal must be paid or completed to sync to ERP',
          status: deal.status,
        },
        { status: 400 }
      )
    }

    // Check if already synced
    const syncCheckResult = await query<any>(
      `SELECT * FROM erp_syncs WHERE deal_id = $1 AND status = 'synced'`,
      [dealId]
    )

    if (syncCheckResult.rows.length > 0 && !force) {
      monitor.end(false)
      return NextResponse.json(
        {
          error: 'Deal already synced to ERP',
          syncId: syncCheckResult.rows[0].id,
          syncedAt: syncCheckResult.rows[0].synced_at,
        },
        { status: 400 }
      )
    }

    // Get customer's Merge.dev account token
    const accountTokenResult = await query<any>(
      `SELECT account_token, integration_name, organization_name
       FROM merge_account_tokens
       WHERE customer_id = $1 AND is_active = true
       LIMIT 1`,
      [deal.buyerId]
    )

    if (accountTokenResult.rows.length === 0) {
      monitor.end(false)
      return NextResponse.json(
        {
          error: 'No ERP integration found for this customer',
          message: 'Customer needs to connect their ERP via Merge.dev',
          linkUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/settings/integrations`,
        },
        { status: 400 }
      )
    }

    const { account_token, integration_name, organization_name } = accountTokenResult.rows[0]

    // Get integration details
    const integrationInfo = await getIntegrationInfo(account_token)
    console.log('[ERP_SYNC] Integration:', integration_name, organization_name)

    // Step 1: Sync vendor (supplier) to ERP
    console.log('[ERP_SYNC] Syncing vendor:', deal.supplier_name)

    let vendorId

    // Check if vendor already exists in ERP
    const existingVendor = await searchVendor({
      accountToken: account_token,
      vendorName: deal.supplier_name,
    })

    if (existingVendor) {
      vendorId = existingVendor.id
      console.log('[ERP_SYNC] Vendor already exists:', vendorId)
    } else {
      // Create new vendor in ERP
      const mergeVendor = convertSupplierToVendor({
        id: deal.supplierId,
        name: deal.supplier_name,
        email: deal.supplier_email || deal.supplier_contact_email,
        phone: deal.supplier_phone,
        address: deal.supplier_address,
        industry: deal.supplier_industry,
        specialties: deal.supplier_specialties,
      })

      const createdVendor = await syncVendor({
        accountToken: account_token,
        vendor: mergeVendor,
      })

      vendorId = createdVendor.id
      console.log('[ERP_SYNC] Vendor created:', vendorId)

      // Save vendor ID for future syncs
      await query(
        `UPDATE suppliers SET merge_vendor_id = $1 WHERE id = $2`,
        [vendorId, deal.supplierId]
      )
    }

    // Step 2: Create Purchase Order in ERP
    console.log('[ERP_SYNC] Creating purchase order...')

    const purchaseOrder = convertDealToPurchaseOrder(
      {
        ...deal,
        description: deal.rfq_description,
        product_name: deal.product_name,
        quantity: deal.quantity,
        deliveryDate: deal.deliveryTime,
      },
      {
        id: deal.supplierId,
        name: deal.supplier_name,
        merge_vendor_id: vendorId,
      }
    )

    // Override vendor ID with actual ERP vendor ID
    purchaseOrder.vendor = vendorId

    const createdPO = await createPurchaseOrder({
      accountToken: account_token,
      purchaseOrder,
    })

    console.log('[ERP_SYNC] Purchase order created:', createdPO.id, createdPO.po_number)

    // Step 3: Record sync in database
    await query(
      `INSERT INTO erp_syncs (
        deal_id,
        customer_id,
        integration_name,
        erp_vendor_id,
        erp_po_id,
        erp_po_number,
        status,
        synced_at,
        sync_data
      ) VALUES ($1, $2, $3, $4, $5, $6, 'synced', NOW(), $7)
      ON CONFLICT (deal_id) DO UPDATE SET
        erp_po_id = $5,
        erp_po_number = $6,
        status = 'synced',
        synced_at = NOW(),
        sync_data = $7`,
      [
        dealId,
        deal.buyerId,
        integration_name,
        vendorId,
        createdPO.id,
        createdPO.po_number || purchaseOrder.po_number,
        JSON.stringify({
          purchaseOrder: createdPO,
          vendor: { id: vendorId, name: deal.supplier_name },
          integrationInfo,
        }),
      ]
    )

    // Update deal with ERP sync info
    await query(
      `UPDATE deals SET
        metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [
        dealId,
        JSON.stringify({
          erp_synced: true,
          erp_integration: integration_name,
          erp_po_id: createdPO.id,
          erp_po_number: createdPO.po_number || purchaseOrder.po_number,
          erp_synced_at: new Date().toISOString(),
        }),
      ]
    )

    monitor.end(true)

    return NextResponse.json({
      success: true,
      message: `Deal synced to ${integration_name} (${organization_name})`,
      sync: {
        dealId,
        integration: integration_name,
        organization: organization_name,
        vendorId,
        vendorName: deal.supplier_name,
        poId: createdPO.id,
        poNumber: createdPO.po_number || purchaseOrder.po_number,
        amount: deal.amount,
        wellsFee: deal.wellsFee,
        totalAmount: purchaseOrder.total_amount,
        syncedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    monitor.end(false)
    console.error('[ERP_SYNC] Sync error:', error)

    // Log failed sync
    await query(
      `INSERT INTO erp_syncs (deal_id, customer_id, status, error_message)
       VALUES ($1, $2, 'failed', $3)
       ON CONFLICT (deal_id) DO UPDATE SET
         status = 'failed',
         error_message = $3,
         updated_at = NOW()`,
      [
        (await req.json()).dealId,
        'unknown',
        error instanceof Error ? error.message : 'Unknown error',
      ]
    ).catch(() => {})

    return NextResponse.json(
      {
        error: 'Failed to sync deal to ERP',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/deals/sync-erp/status/:dealId
 * Check ERP sync status for a deal
 */
export async function GET(req: NextRequest) {
  const monitor = monitorAPI('/api/deals/sync-erp/status', 'GET')

  try {
    const dealId = req.nextUrl.pathname.split('/').pop()

    if (!dealId) {
      monitor.end(false)
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

    const result = await query<any>(
      `SELECT
        es.*,
        mat.integration_name,
        mat.organization_name
       FROM erp_syncs es
       LEFT JOIN merge_account_tokens mat ON es.customer_id = mat.customer_id
       WHERE es.deal_id = $1
       ORDER BY es.synced_at DESC
       LIMIT 1`,
      [dealId]
    )

    if (result.rows.length === 0) {
      monitor.end(true)
      return NextResponse.json({
        synced: false,
        message: 'Deal not yet synced to ERP',
      })
    }

    const sync = result.rows[0]

    monitor.end(true)

    return NextResponse.json({
      synced: sync.status === 'synced',
      status: sync.status,
      integration: sync.integration_name,
      organization: sync.organization_name,
      vendorId: sync.erp_vendor_id,
      poId: sync.erp_po_id,
      poNumber: sync.erp_po_number,
      syncedAt: sync.synced_at,
      errorMessage: sync.error_message,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[ERP_SYNC] Status check error:', error)

    return NextResponse.json(
      {
        error: 'Failed to check sync status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
