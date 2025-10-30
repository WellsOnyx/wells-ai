import { monitorAPI } from './monitoring'

/**
 * Merge.dev Universal API Integration
 * Syncs Wells AI deals to ANY ERP system:
 * SAP, Oracle, NetSuite, Workday, Coupa, Ariba, and 100+ more
 *
 * This is the "paperwork automation" layer mentioned in the user's insight:
 * "It's not about the search, it's about the contract" - Wells AI handles
 * negotiation AND automatically syncs the final deal to the customer's ERP.
 */

const MERGE_API_BASE = 'https://api.merge.dev/api'
const MERGE_API_KEY = process.env.MERGE_API_KEY || ''

/**
 * Merge.dev Supported ERP Systems
 */
export const ERPSystems = {
  SAP: 'sap',
  ORACLE_EBS: 'oracle_ebs',
  ORACLE_NETSUITE: 'netsuite',
  ORACLE_FUSION: 'oracle_fusion',
  WORKDAY: 'workday',
  COUPA: 'coupa',
  SAP_ARIBA: 'ariba',
  MICROSOFT_DYNAMICS: 'dynamics',
  SAGE_INTACCT: 'sage_intacct',
  QUICKBOOKS: 'quickbooks',
  XERO: 'xero',
  SAGE_BUSINESS_CLOUD: 'sage_business_cloud',
  ACUMATICA: 'acumatica',
  EPICOR: 'epicor',
  INFOR: 'infor',
}

/**
 * Merge.dev Account Token (per customer)
 * Each Wells AI customer links their ERP via Merge.dev OAuth
 */
export interface MergeAccountToken {
  accountToken: string // Unique per customer's ERP connection
  integration: string // e.g., 'netsuite', 'sap', 'workday'
  organizationName: string
  isActive: boolean
}

/**
 * Purchase Order in Merge.dev format
 * This is the universal format that syncs to ANY ERP
 */
export interface MergePurchaseOrder {
  // Vendor (supplier)
  vendor: string | { id: string } // Merge vendor ID or object

  // Line items
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total_price: number
    item?: string | { id: string } // Merge item/product ID
    account?: string // Accounting account code
  }>

  // Amounts
  sub_total: number
  total_amount: number
  tax_amount?: number

  // Metadata
  issue_date: string // ISO 8601
  delivery_date?: string
  po_number: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed'

  // Wells AI specific
  memo?: string
  currency?: string
  tracking_categories?: Array<{
    name: string
    id: string
  }>

  // Custom fields (for ERP-specific data)
  integration_params?: Record<string, any>
  linked_account_params?: Record<string, any>
}

/**
 * Vendor in Merge.dev format
 */
export interface MergeVendor {
  vendor_name: string
  email_address?: string
  phone_number?: string
  address?: {
    street_1?: string
    street_2?: string
    city?: string
    state?: string
    country?: string
    zip_code?: string
  }
  currency?: string
  integration_params?: Record<string, any>
}

/**
 * Invoice in Merge.dev format
 */
export interface MergeInvoice {
  vendor: string | { id: string }
  invoice_number: string
  issue_date: string
  due_date?: string
  paid_date?: string
  status: 'draft' | 'submitted' | 'paid' | 'void' | 'payment_pending'
  sub_total: number
  total_amount: number
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  memo?: string
  currency?: string
}

/**
 * Create Purchase Order in ERP via Merge.dev
 */
export async function createPurchaseOrder(params: {
  accountToken: string
  purchaseOrder: MergePurchaseOrder
}): Promise<any> {
  const monitor = monitorAPI('merge_create_purchase_order', 'POST')

  try {
    const response = await fetch(`${MERGE_API_BASE}/accounting/v1/purchase-orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.purchaseOrder,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE] Create PO error:', error)
      throw new Error(`Merge API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log('[MERGE] Purchase order created:', result.model.id)
    return result.model
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE] Create purchase order error:', error)
    throw error
  }
}

/**
 * Create or Update Vendor in ERP via Merge.dev
 */
export async function syncVendor(params: {
  accountToken: string
  vendor: MergeVendor
  existingVendorId?: string
}): Promise<any> {
  const monitor = monitorAPI('merge_sync_vendor', 'POST')

  try {
    const url = params.existingVendorId
      ? `${MERGE_API_BASE}/accounting/v1/vendors/${params.existingVendorId}`
      : `${MERGE_API_BASE}/accounting/v1/vendors`

    const method = params.existingVendorId ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.vendor,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE] Sync vendor error:', error)
      throw new Error(`Merge API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log('[MERGE] Vendor synced:', result.model.id)
    return result.model
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE] Sync vendor error:', error)
    throw error
  }
}

/**
 * Create Invoice in ERP via Merge.dev
 */
export async function createInvoice(params: {
  accountToken: string
  invoice: MergeInvoice
}): Promise<any> {
  const monitor = monitorAPI('merge_create_invoice', 'POST')

  try {
    const response = await fetch(`${MERGE_API_BASE}/accounting/v1/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.invoice,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE] Create invoice error:', error)
      throw new Error(`Merge API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log('[MERGE] Invoice created:', result.model.id)
    return result.model
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE] Create invoice error:', error)
    throw error
  }
}

/**
 * Get Vendor by ID from ERP
 */
export async function getVendor(params: {
  accountToken: string
  vendorId: string
}): Promise<any> {
  try {
    const response = await fetch(
      `${MERGE_API_BASE}/accounting/v1/vendors/${params.vendorId}`,
      {
        headers: {
          Authorization: `Bearer ${MERGE_API_KEY}`,
          'X-Account-Token': params.accountToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch vendor: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE] Get vendor error:', error)
    throw error
  }
}

/**
 * Search for existing vendor by name
 */
export async function searchVendor(params: {
  accountToken: string
  vendorName: string
}): Promise<any | null> {
  try {
    const response = await fetch(
      `${MERGE_API_BASE}/accounting/v1/vendors?vendor_name=${encodeURIComponent(params.vendorName)}`,
      {
        headers: {
          Authorization: `Bearer ${MERGE_API_KEY}`,
          'X-Account-Token': params.accountToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to search vendors: ${response.statusText}`)
    }

    const result = await response.json()
    return result.results?.[0] || null
  } catch (error) {
    console.error('[MERGE] Search vendor error:', error)
    return null
  }
}

/**
 * Get Purchase Order status from ERP
 */
export async function getPurchaseOrder(params: {
  accountToken: string
  poId: string
}): Promise<any> {
  try {
    const response = await fetch(
      `${MERGE_API_BASE}/accounting/v1/purchase-orders/${params.poId}`,
      {
        headers: {
          Authorization: `Bearer ${MERGE_API_KEY}`,
          'X-Account-Token': params.accountToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch purchase order: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE] Get purchase order error:', error)
    throw error
  }
}

/**
 * Get ERP integration info
 */
export async function getIntegrationInfo(accountToken: string): Promise<any> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/accounting/v1/account-details`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': accountToken,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get integration info: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE] Get integration info error:', error)
    throw error
  }
}

/**
 * Generate Merge Link Token for customer to connect their ERP
 * This creates the OAuth flow for customers to link SAP, NetSuite, etc.
 */
export async function generateLinkToken(params: {
  customerId: string
  customerEmail: string
  companyName: string
}): Promise<string> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/accounting/v1/link-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        end_user_origin_id: params.customerId,
        end_user_email_address: params.customerEmail,
        end_user_organization_name: params.companyName,
        categories: ['accounting'],
        integration_specific_config: {
          // Optional: pre-select specific ERPs
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate link token: ${response.statusText}`)
    }

    const result = await response.json()
    return result.link_token
  } catch (error) {
    console.error('[MERGE] Generate link token error:', error)
    throw error
  }
}

/**
 * Convert Wells AI Deal to Merge.dev Purchase Order
 * This is the core transformation that enables "paperwork automation"
 */
export function convertDealToPurchaseOrder(deal: any, supplier: any): MergePurchaseOrder {
  // Generate PO number
  const poNumber = `WA-${Date.now()}-${deal.id.substring(0, 8)}`

  // Calculate amounts
  const subTotal = deal.amount
  const wellsFee = deal.wellsFee || deal.amount * 0.0033
  const totalAmount = subTotal + wellsFee

  return {
    vendor: supplier.merge_vendor_id || { id: 'temp' }, // Will be created if doesn't exist
    po_number: poNumber,
    issue_date: new Date().toISOString(),
    delivery_date: deal.deliveryDate || undefined,
    status: deal.status === 'paid' ? 'approved' : 'submitted',
    sub_total: subTotal,
    total_amount: totalAmount,
    tax_amount: 0,
    currency: 'USD',
    memo: `Wells AI automated procurement\nDeal ID: ${deal.id}\nSupplier: ${supplier.name}\nWells AI service fee: $${wellsFee.toFixed(2)} (0.33%)`,
    line_items: [
      {
        description: deal.description || deal.product_name || 'Procurement via Wells AI',
        quantity: deal.quantity || 1,
        unit_price: deal.amount / (deal.quantity || 1),
        total_price: deal.amount,
      },
      {
        description: 'Wells AI Platform Fee (0.33%)',
        quantity: 1,
        unit_price: wellsFee,
        total_price: wellsFee,
      },
    ],
    integration_params: {
      wells_ai_deal_id: deal.id,
      wells_ai_rfq_id: deal.rfqId,
      wells_ai_quote_id: deal.quoteId,
      created_via: 'wells_ai_automation',
    },
  }
}

/**
 * Convert Wells AI Supplier to Merge.dev Vendor
 */
export function convertSupplierToVendor(supplier: any): MergeVendor {
  return {
    vendor_name: supplier.name,
    email_address: supplier.email || supplier.contactEmail,
    phone_number: supplier.phone || supplier.contactPhone,
    address: supplier.address
      ? {
          street_1: supplier.address.street1,
          street_2: supplier.address.street2,
          city: supplier.address.city,
          state: supplier.address.state,
          country: supplier.address.country || 'US',
          zip_code: supplier.address.zipCode,
        }
      : undefined,
    currency: 'USD',
    integration_params: {
      wells_ai_supplier_id: supplier.id,
      industry: supplier.industry,
      specialties: supplier.specialties,
    },
  }
}

/**
 * Health check - verify Merge.dev connection
 */
export async function checkMergeConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/accounting/v1/integrations`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
      },
    })

    return response.ok
  } catch (error) {
    console.error('[MERGE] Connection check failed:', error)
    return false
  }
}
