// Coupa Procurement Integration
// OAuth 2.0 + REST API integration for Coupa Procurement Platform
// Focuses on supplier invoices and PO-backed payments (procurement-first)

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const REDIRECT_URI = process.env.COUPA_REDIRECT_URI || 'https://wellsai.app/api/erp/coupa/callback';

// Coupa API base URL (instance-specific)
const getCoupaBaseUrl = (instanceUrl: string) => `https://${instanceUrl}/api`;

// ============================================================================
// COUPA TYPE DEFINITIONS
// ============================================================================

// Coupa Supplier (Vendor) record structure
interface CoupaSupplier {
  id: number;
  name: string;
  display_name?: string;
  number?: string;
  status: 'active' | 'inactive' | 'pending';
  primary_contact?: {
    email?: string;
    phone_work?: string;
    phone_mobile?: string;
  };
  primary_address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: {
      code: string;
      name: string;
    };
  };
  tax_id?: string;
  payment_term?: {
    id: number;
    code: string;
    description?: string;
  };
  default_currency?: {
    id: number;
    code: string;
  };
  remit_to_addresses?: Array<{
    id: number;
    remit_to_code?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
    iban?: string;
    swift_code?: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Coupa Invoice record structure
interface CoupaInvoice {
  id: number;
  invoice_number: string;
  supplier: {
    id: number;
    name: string;
    number?: string;
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'disputed' | 'paid' | 'voided';
  invoice_date: string;
  payment_due_date?: string;
  total: string | number;
  currency: {
    id: number;
    code: string;
  };
  paid: string | number;
  invoice_lines?: Array<{
    id: number;
    description?: string;
    quantity: string | number;
    price: string | number;
    total: string | number;
    account?: {
      id: number;
      code: string;
      name: string;
    };
    order_line?: {
      id: number;
      order_header_id: number;
      order_header_number?: string;
    };
  }>;
  order_header?: {
    id: number;
    po_number: string;
  };
  payment_term?: {
    id: number;
    code: string;
  };
  remit_to_address?: {
    id: number;
    remit_to_code?: string;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Coupa Purchase Order record structure
interface CoupaPurchaseOrder {
  id: number;
  po_number: string;
  supplier: {
    id: number;
    name: string;
    number?: string;
  };
  status: 'draft' | 'pending_approval' | 'ordered' | 'soft_closed' | 'closed' | 'cancelled';
  order_date?: string;
  total?: string | number;
  currency?: {
    id: number;
    code: string;
  };
  order_lines?: Array<{
    id: number;
    description?: string;
    quantity: string | number;
    price: string | number;
    total: string | number;
    received?: string | number;
    invoiced?: string | number;
  }>;
  payment_term?: {
    id: number;
    code: string;
  };
  created_at: string;
  updated_at: string;
}

// Coupa Payment record structure
interface CoupaPayment {
  id: number;
  payment_number?: string;
  supplier: {
    id: number;
    name: string;
  };
  amount: string | number;
  currency: {
    id: number;
    code: string;
  };
  payment_date: string;
  payment_method?: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'voided';
  bank_account?: {
    id: number;
    account_number?: string;
  };
  invoices?: Array<{
    id: number;
    invoice_number: string;
    amount_applied: string | number;
  }>;
  external_ref_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COUPA SERVICE CLASS
// ============================================================================

export class CoupaService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.COUPA_CLIENT_ID || '';
    this.clientSecret = process.env.COUPA_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Coupa OAuth credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAUTH 2.0 FLOW
  // ============================================================================

  /**
   * Generate Coupa OAuth2 authorization URL
   * @param state - State parameter for CSRF protection (should include companyId)
   * @param instanceUrl - Coupa instance URL (e.g., 'yourcompany.coupahost.com')
   */
  getAuthorizationUrl(state: string, instanceUrl: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'core.invoice.read core.invoice.write core.supplier.read core.supplier.write core.purchase_order.read core.payment.read core.payment.write',
      state,
    });

    return `https://${instanceUrl}/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    instanceUrl: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const tokenUrl = `https://${instanceUrl}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    instanceUrl: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const tokenUrl = `https://${instanceUrl}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // API REQUEST HELPERS
  // ============================================================================

  private async makeRequest(
    connectionId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    // Get connection details
    const [connection] = await sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at,
        coupa_instance_url
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Coupa connection not found');
    }

    const instanceUrl = connection.coupa_instance_url;
    let accessToken = connection.access_token;

    // Check if token needs refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(connection.refresh_token, instanceUrl);
      accessToken = tokens.access_token;

      // Update tokens in database
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

      await sql`
        UPDATE erp_connections
        SET
          access_token = ${tokens.access_token},
          refresh_token = ${tokens.refresh_token},
          token_expires_at = ${expiresAt.toISOString()},
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;
    }

    const baseUrl = getCoupaBaseUrl(instanceUrl);
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-COUPA-API-VERSION': '2024.0', // Use latest stable API version
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Coupa API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  // ============================================================================
  // VENDOR (SUPPLIER) OPERATIONS
  // ============================================================================

  /**
   * Fetch suppliers from Coupa
   */
  async fetchVendors(connectionId: string, limit: number = 50): Promise<CoupaSupplier[]> {
    const response = await this.makeRequest(
      connectionId,
      `/suppliers?status=active&limit=${limit}&order_by=updated_at&order_by_dir=desc`
    );

    // Coupa returns array directly or in a wrapper
    return Array.isArray(response) ? response : (response.suppliers || []);
  }

  /**
   * Fetch a single supplier by ID
   */
  async fetchVendor(connectionId: string, supplierId: number): Promise<CoupaSupplier | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/suppliers/${supplierId}`
      );
      return response;
    } catch (error) {
      console.error(`Failed to fetch supplier ${supplierId}:`, error);
      return null;
    }
  }

  /**
   * Sync supplier to database
   */
  async syncVendorToDatabase(connectionId: string, supplier: CoupaSupplier): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const primaryContact = supplier.primary_contact || {};
    const primaryAddress = supplier.primary_address || {};
    const remitTo = supplier.remit_to_addresses?.[0] || {};

    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        tax_id,
        is_active,
        default_currency,
        payment_terms,
        bank_account_number,
        routing_number,
        raw_data
      ) VALUES (
        ${connectionId},
        ${String(supplier.id)},
        ${supplier.name},
        ${supplier.display_name || supplier.name},
        ${primaryContact.email || null},
        ${primaryContact.phone_work || primaryContact.phone_mobile || null},
        ${primaryAddress.street1 || null},
        ${primaryAddress.street2 || null},
        ${primaryAddress.city || null},
        ${primaryAddress.state || null},
        ${primaryAddress.postal_code || null},
        ${primaryAddress.country?.code || 'US'},
        ${supplier.tax_id || null},
        ${supplier.status === 'active'},
        ${supplier.default_currency?.code || 'USD'},
        ${supplier.payment_term?.code || null},
        ${remitTo.bank_account_number || null},
        ${remitTo.bank_routing_number || null},
        ${JSON.stringify(supplier)}
      )
      ON CONFLICT (erp_connection_id, external_vendor_id)
      DO UPDATE SET
        vendor_name = EXCLUDED.vendor_name,
        vendor_display_name = EXCLUDED.vendor_display_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        tax_id = EXCLUDED.tax_id,
        is_active = EXCLUDED.is_active,
        default_currency = EXCLUDED.default_currency,
        payment_terms = EXCLUDED.payment_terms,
        bank_account_number = EXCLUDED.bank_account_number,
        routing_number = EXCLUDED.routing_number,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // BILL (INVOICE) OPERATIONS - Procurement-Focused
  // ============================================================================

  /**
   * Fetch invoices from Coupa
   * Focuses on invoices that are approved but not yet paid (intercept opportunities)
   */
  async fetchBills(
    connectionId: string,
    options?: {
      status?: 'pending_approval' | 'approved' | 'disputed' | 'paid';
      startDate?: Date;
      limit?: number;
    }
  ): Promise<CoupaInvoice[]> {
    const params = new URLSearchParams();

    // Default to approved invoices (ready for payment - intercept opportunities)
    params.append('status', options?.status || 'approved');
    params.append('limit', String(options?.limit || 50));
    params.append('order_by', 'payment_due_date');
    params.append('order_by_dir', 'asc'); // Soonest due first

    if (options?.startDate) {
      params.append('payment_due_date[gt_or_eq]', options.startDate.toISOString().split('T')[0]);
    }

    const response = await this.makeRequest(
      connectionId,
      `/invoices?${params.toString()}`
    );

    return Array.isArray(response) ? response : (response.invoices || []);
  }

  /**
   * Fetch a single invoice by ID
   */
  async fetchBill(connectionId: string, invoiceId: number): Promise<CoupaInvoice | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/invoices/${invoiceId}`
      );
      return response;
    } catch (error) {
      console.error(`Failed to fetch invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Fetch purchase orders (for PO-backed payment context)
   */
  async fetchPurchaseOrders(
    connectionId: string,
    options?: {
      status?: 'ordered' | 'soft_closed' | 'closed';
      supplierId?: number;
      limit?: number;
    }
  ): Promise<CoupaPurchaseOrder[]> {
    const params = new URLSearchParams();

    params.append('status', options?.status || 'ordered');
    params.append('limit', String(options?.limit || 50));

    if (options?.supplierId) {
      params.append('supplier[id]', String(options.supplierId));
    }

    const response = await this.makeRequest(
      connectionId,
      `/purchase_orders?${params.toString()}`
    );

    return Array.isArray(response) ? response : (response.purchase_orders || []);
  }

  /**
   * Sync invoice (bill) to database
   */
  async syncBillToDatabase(connectionId: string, invoice: CoupaInvoice): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const totalAmount = typeof invoice.total === 'string' ? parseFloat(invoice.total) : invoice.total;
    const paidAmount = typeof invoice.paid === 'string' ? parseFloat(invoice.paid) : (invoice.paid || 0);
    const amountRemaining = totalAmount - paidAmount;
    const isPaid = invoice.status === 'paid' || amountRemaining <= 0;

    // Calculate Wells fee and savings (1% fee, typical wire costs saved)
    const wellsFee = totalAmount * 0.01;
    const paymentCostSaved = totalAmount > 10000 ? 30 : (totalAmount > 1000 ? 15 : 5);
    const netSavings = paymentCostSaved - wellsFee;

    // Determine status mapping
    let status: 'pending' | 'intercepted' | 'paid_external' | 'cancelled' = 'pending';
    if (invoice.status === 'paid') {
      status = 'paid_external';
    } else if (invoice.status === 'voided') {
      status = 'cancelled';
    }

    // Build memo with PO reference if available
    let memo = invoice.notes || '';
    if (invoice.order_header?.po_number) {
      memo = `PO: ${invoice.order_header.po_number}${memo ? ' | ' + memo : ''}`;
    }

    await sql`
      INSERT INTO erp_bills (
        erp_connection_id,
        external_bill_id,
        external_vendor_id,
        bill_number,
        vendor_name,
        total_amount,
        currency,
        bill_date,
        due_date,
        status,
        paid_status,
        amount_paid,
        wells_fee_amount,
        payment_cost_saved,
        net_customer_savings,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${String(invoice.id)},
        ${String(invoice.supplier.id)},
        ${invoice.invoice_number},
        ${invoice.supplier.name},
        ${totalAmount},
        ${invoice.currency?.code || 'USD'},
        ${invoice.invoice_date},
        ${invoice.payment_due_date || invoice.invoice_date},
        ${status},
        ${isPaid ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid')},
        ${paidAmount},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${memo || null},
        ${JSON.stringify(invoice)}
      )
      ON CONFLICT (erp_connection_id, external_bill_id)
      DO UPDATE SET
        bill_number = EXCLUDED.bill_number,
        vendor_name = EXCLUDED.vendor_name,
        total_amount = EXCLUDED.total_amount,
        currency = EXCLUDED.currency,
        due_date = EXCLUDED.due_date,
        status = EXCLUDED.status,
        paid_status = EXCLUDED.paid_status,
        amount_paid = EXCLUDED.amount_paid,
        wells_fee_amount = EXCLUDED.wells_fee_amount,
        payment_cost_saved = EXCLUDED.payment_cost_saved,
        net_customer_savings = EXCLUDED.net_customer_savings,
        memo = EXCLUDED.memo,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  /**
   * Fetch payments from Coupa
   */
  async fetchPayments(
    connectionId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      status?: 'pending' | 'processing' | 'paid' | 'failed';
      limit?: number;
    }
  ): Promise<CoupaPayment[]> {
    const params = new URLSearchParams();

    params.append('limit', String(options?.limit || 50));
    params.append('order_by', 'payment_date');
    params.append('order_by_dir', 'desc');

    if (options?.status) {
      params.append('status', options.status);
    }

    if (options?.startDate) {
      params.append('payment_date[gt_or_eq]', options.startDate.toISOString().split('T')[0]);
    }

    if (options?.endDate) {
      params.append('payment_date[lt_or_eq]', options.endDate.toISOString().split('T')[0]);
    }

    const response = await this.makeRequest(
      connectionId,
      `/payments?${params.toString()}`
    );

    return Array.isArray(response) ? response : (response.payments || []);
  }

  /**
   * Create a payment in Coupa
   * Used after Wells processes the actual payment to record it back
   */
  async createPayment(
    connectionId: string,
    invoiceId: number,
    supplierId: number,
    amount: number,
    paymentDate: Date,
    options?: {
      paymentMethod?: string;
      externalRefNumber?: string;
      notes?: string;
      bankAccountId?: number;
    }
  ): Promise<CoupaPayment> {
    const paymentData = {
      supplier: { id: supplierId },
      amount: amount.toFixed(2),
      payment_date: paymentDate.toISOString().split('T')[0],
      payment_method: options?.paymentMethod || 'Electronic',
      external_ref_number: options?.externalRefNumber || `WELLS-${Date.now()}`,
      notes: options?.notes || 'Paid via Wells AI',
      status: 'paid',
      invoices: [
        {
          id: invoiceId,
          amount_applied: amount.toFixed(2),
        },
      ],
      ...(options?.bankAccountId && {
        bank_account: { id: options.bankAccountId },
      }),
    };

    const response = await this.makeRequest(
      connectionId,
      '/payments',
      'POST',
      paymentData
    );

    return response;
  }

  /**
   * Sync payment to database
   */
  async syncPaymentToDatabase(connectionId: string, payment: CoupaPayment): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const paymentAmount = typeof payment.amount === 'string'
      ? parseFloat(payment.amount)
      : payment.amount;

    // Check if this was processed by Wells
    const isWellsPayment = payment.external_ref_number?.startsWith('WELLS-') || false;

    await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        processed_by_wells,
        wells_transaction_id,
        reference_number,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${String(payment.id)},
        ${String(payment.supplier.id)},
        ${paymentAmount},
        ${payment.payment_method || 'Electronic'},
        ${payment.payment_date},
        ${isWellsPayment},
        ${isWellsPayment ? payment.external_ref_number : null},
        ${payment.external_ref_number || payment.payment_number || null},
        ${payment.notes || null},
        ${JSON.stringify(payment)}
      )
      ON CONFLICT (erp_connection_id, external_payment_id)
      DO UPDATE SET
        payment_amount = EXCLUDED.payment_amount,
        payment_method = EXCLUDED.payment_method,
        processed_by_wells = EXCLUDED.processed_by_wells,
        wells_transaction_id = EXCLUDED.wells_transaction_id,
        reference_number = EXCLUDED.reference_number,
        memo = EXCLUDED.memo,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // FULL SYNC OPERATIONS
  // ============================================================================

  /**
   * Perform a full sync of vendors, bills, and payments
   */
  async fullSync(connectionId: string): Promise<{
    vendorsFound: number;
    billsFound: number;
    paymentsFound: number;
    errors: string[];
  }> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const errors: string[] = [];
    let vendorsFound = 0;
    let billsFound = 0;
    let paymentsFound = 0;

    try {
      // 1. Sync suppliers (vendors)
      console.log('Syncing Coupa suppliers...');
      const suppliers = await this.fetchVendors(connectionId, 200);
      for (const supplier of suppliers) {
        try {
          await this.syncVendorToDatabase(connectionId, supplier);
          vendorsFound++;
        } catch (error) {
          const errorMsg = `Supplier ${supplier.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 2. Sync approved invoices (intercept opportunities)
      console.log('Syncing Coupa invoices (approved - ready for payment)...');
      const approvedInvoices = await this.fetchBills(connectionId, {
        status: 'approved',
        limit: 200,
      });
      for (const invoice of approvedInvoices) {
        try {
          await this.syncBillToDatabase(connectionId, invoice);
          billsFound++;
        } catch (error) {
          const errorMsg = `Invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 3. Also sync pending approval invoices (upcoming opportunities)
      console.log('Syncing Coupa invoices (pending approval)...');
      const pendingInvoices = await this.fetchBills(connectionId, {
        status: 'pending_approval',
        limit: 100,
      });
      for (const invoice of pendingInvoices) {
        try {
          await this.syncBillToDatabase(connectionId, invoice);
          billsFound++;
        } catch (error) {
          const errorMsg = `Invoice ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 4. Sync recent payments (last 30 days)
      console.log('Syncing Coupa payments...');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const payments = await this.fetchPayments(connectionId, {
        startDate: thirtyDaysAgo,
        limit: 200,
      });
      for (const payment of payments) {
        try {
          await this.syncPaymentToDatabase(connectionId, payment);
          paymentsFound++;
        } catch (error) {
          const errorMsg = `Payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Update sync status - success
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'completed',
          last_sync_error = null,
          next_sync_at = NOW() + INTERVAL '4 hours',
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;

    } catch (error) {
      // Update sync status - failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'failed',
          last_sync_error = ${errorMessage},
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;
      errors.push(errorMessage);
    }

    return {
      vendorsFound,
      billsFound,
      paymentsFound,
      errors,
    };
  }

  // ============================================================================
  // CONNECTION TEST
  // ============================================================================

  /**
   * Test the Coupa connection
   */
  async testConnection(connectionId: string): Promise<boolean> {
    try {
      // Try to fetch a single supplier to validate the connection
      await this.fetchVendors(connectionId, 1);
      return true;
    } catch (error) {
      console.error('Coupa connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // COUPA-SPECIFIC: Invoice Approval Status Check
  // ============================================================================

  /**
   * Check if an invoice is ready for payment (approved and not disputed)
   */
  async isInvoiceReadyForPayment(connectionId: string, invoiceId: number): Promise<boolean> {
    const invoice = await this.fetchBill(connectionId, invoiceId);
    if (!invoice) return false;

    return invoice.status === 'approved';
  }

  /**
   * Get invoices by PO number (common in procurement workflows)
   */
  async fetchInvoicesByPO(
    connectionId: string,
    poNumber: string
  ): Promise<CoupaInvoice[]> {
    const response = await this.makeRequest(
      connectionId,
      `/invoices?order_header[po_number]=${encodeURIComponent(poNumber)}`
    );

    return Array.isArray(response) ? response : (response.invoices || []);
  }

  /**
   * Get supplier remit-to address for payment routing
   */
  async getSupplierRemitToAddress(
    connectionId: string,
    supplierId: number
  ): Promise<CoupaSupplier['remit_to_addresses']> {
    const supplier = await this.fetchVendor(connectionId, supplierId);
    return supplier?.remit_to_addresses || [];
  }
}

// Export singleton instance
export const coupa = new CoupaService();
