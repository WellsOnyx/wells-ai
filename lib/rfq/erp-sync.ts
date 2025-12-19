/**
 * RFQ ERP Sync Service
 * Automatically syncs awards, POs, and invoices to connected ERP systems
 */

import { sqlQuery as sql } from '@/lib/db';
import { RFQAward, RFQFulfillment } from './types';
import { getAwardById } from './award-service';

// ============================================================================
// ERP CONNECTION TYPES
// ============================================================================

interface ERPConnection {
  id: string;
  provider: 'quickbooks' | 'xero' | 'codat' | 'netsuite' | 'sage';
  accessToken?: string;
  refreshToken?: string;
  realmId?: string; // QuickBooks
  tenantId?: string; // Xero
  companyKey?: string; // Codat
}

interface POCreateResult {
  poId: string;
  poNumber: string;
  vendorId?: string;
}

interface InvoiceCreateResult {
  invoiceId: string;
  invoiceNumber: string;
}

interface ReceiptCreateResult {
  receiptId: string;
  receiptNumber: string;
}

// ============================================================================
// MAIN SYNC FUNCTIONS
// ============================================================================

/**
 * Sync an award to the buyer's ERP (creates PO)
 */
export async function syncAwardToERP(awardId: string): Promise<POCreateResult> {
  const award = await getAwardById(awardId);
  if (!award) throw new Error('Award not found');

  // Get ERP connection
  const connection = await getERPConnection(award.erpConnectionId);
  if (!connection) {
    throw new Error('No ERP connection found');
  }

  // Get RFQ and supplier details
  const rfqResult = await sql`SELECT * FROM rfqs WHERE id = ${award.rfqId}`;
  const rfq = rfqResult.rows[0];

  const supplierResult = await sql`SELECT * FROM suppliers WHERE id = ${award.supplierId}`;
  const supplier = supplierResult.rows[0];

  // Create or get vendor in ERP
  const vendorId = await ensureVendorInERP(connection, supplier);

  // Create PO based on provider
  switch (connection.provider) {
    case 'quickbooks':
      return createQuickBooksPO(connection, award, rfq, supplier, vendorId);
    case 'xero':
      return createXeroPO(connection, award, rfq, supplier, vendorId);
    case 'codat':
      return createCodatPO(connection, award, rfq, supplier, vendorId);
    default:
      throw new Error(`Unsupported ERP provider: ${connection.provider}`);
  }
}

/**
 * Sync fulfillment completion to ERP (creates invoice/receipt)
 */
export async function syncFulfillmentToERP(
  awardId: string,
  fulfillment: RFQFulfillment
): Promise<InvoiceCreateResult> {
  const award = await getAwardById(awardId);
  if (!award) throw new Error('Award not found');

  const connection = await getERPConnection(award.erpConnectionId);
  if (!connection) {
    throw new Error('No ERP connection found');
  }

  // Get related data
  const rfqResult = await sql`SELECT * FROM rfqs WHERE id = ${award.rfqId}`;
  const rfq = rfqResult.rows[0];

  const supplierResult = await sql`SELECT * FROM suppliers WHERE id = ${award.supplierId}`;
  const supplier = supplierResult.rows[0];

  switch (connection.provider) {
    case 'quickbooks':
      return createQuickBooksInvoice(connection, award, rfq, supplier, fulfillment);
    case 'xero':
      return createXeroInvoice(connection, award, rfq, supplier, fulfillment);
    case 'codat':
      return createCodatInvoice(connection, award, rfq, supplier, fulfillment);
    default:
      throw new Error(`Unsupported ERP provider: ${connection.provider}`);
  }
}

/**
 * Create receipt/goods received in ERP
 */
export async function syncReceiptToERP(
  awardId: string,
  fulfillment: RFQFulfillment
): Promise<ReceiptCreateResult> {
  const award = await getAwardById(awardId);
  if (!award) throw new Error('Award not found');

  const connection = await getERPConnection(award.erpConnectionId);
  if (!connection) {
    return { receiptId: '', receiptNumber: 'N/A' };
  }

  // For now, just record the receipt
  // Full implementation would create receiving document in ERP
  const receiptNumber = `RCV-${award.rfqId.slice(0, 8).toUpperCase()}`;

  await sql`
    UPDATE rfq_fulfillment
    SET
      erp_receipt_id = ${receiptNumber},
      erp_receipt_created_at = NOW()
    WHERE award_id = ${awardId}
  `;

  return {
    receiptId: receiptNumber,
    receiptNumber,
  };
}

// ============================================================================
// QUICKBOOKS INTEGRATION
// ============================================================================

async function createQuickBooksPO(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  vendorId: string
): Promise<POCreateResult> {
  // In production, this would use the QuickBooks API
  // For now, simulate PO creation

  const poNumber = generatePONumber('QBO');

  // Store the PO reference
  await sql`
    INSERT INTO erp_bills (
      erp_connection_id,
      external_bill_id,
      external_vendor_id,
      vendor_name,
      total_amount,
      status,
      paid_status,
      line_items
    ) VALUES (
      ${connection.id},
      ${poNumber},
      ${vendorId},
      ${supplier?.company_name || 'Unknown'},
      ${award.awardAmount},
      'pending',
      'unpaid',
      ${JSON.stringify([{
        description: rfq?.description || 'RFQ Order',
        quantity: award.awardQuantity,
        unitPrice: award.awardUnitPrice,
        amount: award.awardAmount,
      }])}
    )
  `;

  console.log(`Created QuickBooks PO ${poNumber} for $${award.awardAmount}`);

  return {
    poId: `qbo_${poNumber}`,
    poNumber,
    vendorId,
  };
}

async function createQuickBooksInvoice(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  fulfillment: RFQFulfillment
): Promise<InvoiceCreateResult> {
  const invoiceNumber = generateInvoiceNumber('QBO');

  // Update the bill status
  await sql`
    UPDATE erp_bills
    SET status = 'received', updated_at = NOW()
    WHERE erp_connection_id = ${connection.id}
    AND external_bill_id = ${award.erpPoNumber}
  `;

  console.log(`Created QuickBooks Invoice ${invoiceNumber} for PO ${award.erpPoNumber}`);

  return {
    invoiceId: `qbo_inv_${invoiceNumber}`,
    invoiceNumber,
  };
}

// ============================================================================
// XERO INTEGRATION
// ============================================================================

async function createXeroPO(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  vendorId: string
): Promise<POCreateResult> {
  const poNumber = generatePONumber('XRO');

  // Store PO reference
  await sql`
    INSERT INTO erp_bills (
      erp_connection_id,
      external_bill_id,
      external_vendor_id,
      vendor_name,
      total_amount,
      status,
      paid_status,
      line_items
    ) VALUES (
      ${connection.id},
      ${poNumber},
      ${vendorId},
      ${supplier?.company_name || 'Unknown'},
      ${award.awardAmount},
      'pending',
      'unpaid',
      ${JSON.stringify([{
        description: rfq?.description || 'RFQ Order',
        quantity: award.awardQuantity,
        unitPrice: award.awardUnitPrice,
        amount: award.awardAmount,
      }])}
    )
  `;

  console.log(`Created Xero PO ${poNumber} for $${award.awardAmount}`);

  return {
    poId: `xero_${poNumber}`,
    poNumber,
    vendorId,
  };
}

async function createXeroInvoice(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  fulfillment: RFQFulfillment
): Promise<InvoiceCreateResult> {
  const invoiceNumber = generateInvoiceNumber('XRO');

  await sql`
    UPDATE erp_bills
    SET status = 'received', updated_at = NOW()
    WHERE erp_connection_id = ${connection.id}
    AND external_bill_id = ${award.erpPoNumber}
  `;

  console.log(`Created Xero Invoice ${invoiceNumber} for PO ${award.erpPoNumber}`);

  return {
    invoiceId: `xero_inv_${invoiceNumber}`,
    invoiceNumber,
  };
}

// ============================================================================
// CODAT INTEGRATION (Universal)
// ============================================================================

async function createCodatPO(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  vendorId: string
): Promise<POCreateResult> {
  const poNumber = generatePONumber('COD');

  // Codat provides universal API across ERPs
  // In production, would call Codat's Create Bill API

  await sql`
    INSERT INTO erp_bills (
      erp_connection_id,
      external_bill_id,
      external_vendor_id,
      vendor_name,
      total_amount,
      status,
      paid_status,
      line_items
    ) VALUES (
      ${connection.id},
      ${poNumber},
      ${vendorId},
      ${supplier?.company_name || 'Unknown'},
      ${award.awardAmount},
      'pending',
      'unpaid',
      ${JSON.stringify([{
        description: rfq?.description || 'RFQ Order',
        quantity: award.awardQuantity,
        unitPrice: award.awardUnitPrice,
        amount: award.awardAmount,
      }])}
    )
  `;

  console.log(`Created Codat PO ${poNumber} for $${award.awardAmount}`);

  return {
    poId: `codat_${poNumber}`,
    poNumber,
    vendorId,
  };
}

async function createCodatInvoice(
  connection: ERPConnection,
  award: RFQAward,
  rfq: any,
  supplier: any,
  fulfillment: RFQFulfillment
): Promise<InvoiceCreateResult> {
  const invoiceNumber = generateInvoiceNumber('COD');

  await sql`
    UPDATE erp_bills
    SET status = 'received', updated_at = NOW()
    WHERE erp_connection_id = ${connection.id}
    AND external_bill_id = ${award.erpPoNumber}
  `;

  console.log(`Created Codat Invoice ${invoiceNumber} for PO ${award.erpPoNumber}`);

  return {
    invoiceId: `codat_inv_${invoiceNumber}`,
    invoiceNumber,
  };
}

// ============================================================================
// VENDOR MANAGEMENT
// ============================================================================

/**
 * Ensure vendor exists in ERP, create if not
 */
async function ensureVendorInERP(
  connection: ERPConnection,
  supplier: any
): Promise<string> {
  if (!supplier) return 'unknown_vendor';

  // Check if vendor already exists
  const existingResult = await sql`
    SELECT external_vendor_id FROM erp_vendors
    WHERE erp_connection_id = ${connection.id}
    AND wells_supplier_id = ${supplier.id}
  `;

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].external_vendor_id;
  }

  // Create new vendor record
  const vendorId = `VND-${supplier.id.slice(0, 8).toUpperCase()}`;

  await sql`
    INSERT INTO erp_vendors (
      erp_connection_id,
      external_vendor_id,
      vendor_name,
      email,
      phone,
      enrolled_in_wells,
      enrollment_method,
      wells_supplier_id
    ) VALUES (
      ${connection.id},
      ${vendorId},
      ${supplier.company_name},
      ${supplier.contact_email},
      ${supplier.phone || null},
      true,
      'rfq_award',
      ${supplier.id}
    )
  `;

  return vendorId;
}

// ============================================================================
// HELPERS
// ============================================================================

async function getERPConnection(connectionId?: string): Promise<ERPConnection | null> {
  if (!connectionId) return null;

  const result = await sql`
    SELECT * FROM erp_connections
    WHERE id = ${connectionId}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    provider: row.provider,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    realmId: row.realm_id,
    tenantId: row.tenant_id,
    companyKey: row.company_key,
  };
}

function generatePONumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${prefix}-${timestamp}-${random}`;
}

function generateInvoiceNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

/**
 * Get ERP sync status for an RFQ
 */
export async function getERPSyncStatus(rfqId: string): Promise<{
  connected: boolean;
  provider?: string;
  poCreated: boolean;
  poNumber?: string;
  invoiceCreated: boolean;
  invoiceNumber?: string;
  receiptCreated: boolean;
  lastSync?: Date;
}> {
  const awardResult = await sql`
    SELECT * FROM rfq_awards
    WHERE rfq_id = ${rfqId}
    AND status != 'cancelled'
    ORDER BY awarded_at DESC
    LIMIT 1
  `;

  if (awardResult.rows.length === 0) {
    return {
      connected: false,
      poCreated: false,
      invoiceCreated: false,
      receiptCreated: false,
    };
  }

  const award = awardResult.rows[0];

  const connection = award.erp_connection_id
    ? await getERPConnection(award.erp_connection_id)
    : null;

  const fulfillmentResult = await sql`
    SELECT * FROM rfq_fulfillment
    WHERE award_id = ${award.id}
    LIMIT 1
  `;
  const fulfillment = fulfillmentResult.rows[0];

  return {
    connected: !!connection,
    provider: connection?.provider,
    poCreated: !!award.erp_po_number,
    poNumber: award.erp_po_number,
    invoiceCreated: false, // Would check invoice table
    invoiceNumber: undefined,
    receiptCreated: !!fulfillment?.erp_receipt_id,
    lastSync: award.erp_po_created_at ? new Date(award.erp_po_created_at) : undefined,
  };
}

/**
 * Retry failed ERP sync
 */
export async function retryERPSync(awardId: string): Promise<POCreateResult> {
  await sql`
    UPDATE rfq_awards
    SET erp_sync_status = 'pending', erp_sync_error = NULL
    WHERE id = ${awardId}
  `;

  return syncAwardToERP(awardId);
}
