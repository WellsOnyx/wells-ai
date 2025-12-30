// Oracle ERP Integration
// OAuth2 flow + API integration for Oracle Fusion Cloud and Oracle E-Business Suite

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

const REDIRECT_URI = process.env.ORACLE_REDIRECT_URI || 'https://wellsai.app/api/erp/oracle/callback';

// Oracle Fusion REST API Types
interface OracleFusionVendor {
  SupplierId: number;
  Supplier: string;
  SupplierNumber?: string;
  TaxpayerId?: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  PaymentCurrency?: string;
  PaymentTerms?: string;
  CreationDate?: string;
  LastUpdateDate?: string;
}

interface OracleFusionInvoice {
  InvoiceId: number;
  InvoiceNum: string;
  InvoiceAmount: number;
  InvoiceCurrencyCode: string;
  InvoiceDate: string;
  PaymentDueDate?: string;
  Supplier?: string;
  SupplierId?: number;
  InvoiceStatus?: string;
  Description?: string;
  PayGroupLookupCode?: string;
  PaymentStatusFlag?: string;
}

interface OracleFusionPayment {
  PaymentId: number;
  PaymentNum?: string;
  PaymentAmount: number;
  PaymentCurrencyCode: string;
  PaymentDate: string;
  PaymentMethodCode: string;
  PaymentStatus?: string;
  BankAccountId?: number;
  PaymentReference?: string;
}

export class OracleService {
  private clientId: string;
  private clientSecret: string;
  private fusionBaseUrl: string;

  constructor() {
    this.clientId = process.env.ORACLE_CLIENT_ID || '';
    this.clientSecret = process.env.ORACLE_CLIENT_SECRET || '';
    this.fusionBaseUrl = process.env.ORACLE_FUSION_BASE_URL || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Oracle credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAUTH2 FLOW
  // ============================================================================

  /**
   * Generate OAuth2 authorization URL for Oracle Fusion Cloud
   * @param state - Base64 encoded state parameter containing companyId and variant
   * @param oracleHost - The Oracle Fusion Cloud host (e.g., fa-xxx.oraclecloud.com)
   */
  getAuthorizationUrl(state: string, oracleHost: string): string {
    const tokenEndpoint = `https://${oracleHost}/oauth/v1/authorize`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'urn:opc:idm:__myscopes__',
      state,
    });

    return `${tokenEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    oracleHost: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const tokenUrl = `https://${oracleHost}/oauth/v1/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    oracleHost: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = `https://${oracleHost}/oauth/v1/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // API REQUEST HELPERS
  // ============================================================================

  private async makeRequest(
    connectionId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    // Get connection details
    const [connection] = await sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at,
        oracle_host,
        oracle_variant,
        business_unit_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Oracle connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        connection.oracle_host
      );
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

    // Build URL based on variant
    let baseUrl: string;
    if (connection.oracle_variant === 'fusion') {
      baseUrl = `https://${connection.oracle_host}/fscmRestApi/resources/11.13.18.05`;
    } else {
      // E-Business Suite
      baseUrl = `https://${connection.oracle_host}/apps/api`;
    }

    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Oracle API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // VENDOR OPERATIONS
  // ============================================================================

  async fetchVendors(connectionId: string, limit: number = 100): Promise<OracleFusionVendor[]> {
    const response = await this.makeRequest(
      connectionId,
      `/suppliers?limit=${limit}&onlyData=true`
    );

    return response.items || [];
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<OracleFusionVendor> {
    const response = await this.makeRequest(
      connectionId,
      `/suppliers/${vendorId}`
    );

    return response;
  }

  async syncVendorToDatabase(connectionId: string, vendor: OracleFusionVendor): Promise<void> {
    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        tax_id,
        is_active,
        default_currency,
        payment_terms,
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.SupplierId.toString()},
        ${vendor.Supplier},
        ${vendor.SupplierNumber || vendor.Supplier},
        ${vendor.EmailAddress || null},
        ${vendor.PhoneNumber || null},
        ${vendor.TaxpayerId || null},
        true,
        ${vendor.PaymentCurrency || 'USD'},
        ${vendor.PaymentTerms || null},
        ${JSON.stringify(vendor)}
      )
      ON CONFLICT (erp_connection_id, external_vendor_id)
      DO UPDATE SET
        vendor_name = EXCLUDED.vendor_name,
        vendor_display_name = EXCLUDED.vendor_display_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        tax_id = EXCLUDED.tax_id,
        default_currency = EXCLUDED.default_currency,
        payment_terms = EXCLUDED.payment_terms,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // INVOICE/BILL OPERATIONS
  // ============================================================================

  async fetchInvoices(
    connectionId: string,
    filters?: {
      status?: string;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      limit?: number;
    }
  ): Promise<OracleFusionInvoice[]> {
    let query = '/invoices?onlyData=true';
    const qFilters: string[] = [];

    if (filters?.status) {
      qFilters.push(`PaymentStatusFlag='${filters.status}'`);
    }

    if (filters?.dueDateFrom) {
      qFilters.push(`PaymentDueDate>='${filters.dueDateFrom.toISOString().split('T')[0]}'`);
    }

    if (filters?.dueDateTo) {
      qFilters.push(`PaymentDueDate<='${filters.dueDateTo.toISOString().split('T')[0]}'`);
    }

    if (qFilters.length > 0) {
      query += `&q=${qFilters.join(';')}`;
    }

    if (filters?.limit) {
      query += `&limit=${filters.limit}`;
    }

    const response = await this.makeRequest(connectionId, query);
    return response.items || [];
  }

  async fetchInvoice(connectionId: string, invoiceId: string): Promise<OracleFusionInvoice> {
    const response = await this.makeRequest(
      connectionId,
      `/invoices/${invoiceId}`
    );

    return response;
  }

  async syncInvoiceToDatabase(connectionId: string, invoice: OracleFusionInvoice): Promise<void> {
    const wellsFee = invoice.InvoiceAmount * 0.01; // 1%
    const paymentCostSaved = invoice.InvoiceAmount > 10000 ? 30 : 15;
    const netSavings = paymentCostSaved - wellsFee;

    const isPaid = invoice.PaymentStatusFlag === 'Y' || invoice.InvoiceStatus === 'PAID';

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
        ${invoice.InvoiceId.toString()},
        ${invoice.SupplierId?.toString() || null},
        ${invoice.InvoiceNum},
        ${invoice.Supplier || ''},
        ${invoice.InvoiceAmount},
        ${invoice.InvoiceCurrencyCode || 'USD'},
        ${invoice.InvoiceDate},
        ${invoice.PaymentDueDate || invoice.InvoiceDate},
        ${isPaid ? 'paid_external' : 'pending'},
        ${isPaid ? 'paid' : 'unpaid'},
        ${isPaid ? invoice.InvoiceAmount : 0},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${invoice.Description || null},
        ${JSON.stringify(invoice)}
      )
      ON CONFLICT (erp_connection_id, external_bill_id)
      DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        paid_status = EXCLUDED.paid_status,
        amount_paid = EXCLUDED.amount_paid,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  async fetchPayments(
    connectionId: string,
    filters?: {
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ): Promise<OracleFusionPayment[]> {
    let query = '/payments?onlyData=true';
    const qFilters: string[] = [];

    if (filters?.dateFrom) {
      qFilters.push(`PaymentDate>='${filters.dateFrom.toISOString().split('T')[0]}'`);
    }

    if (filters?.dateTo) {
      qFilters.push(`PaymentDate<='${filters.dateTo.toISOString().split('T')[0]}'`);
    }

    if (qFilters.length > 0) {
      query += `&q=${qFilters.join(';')}`;
    }

    if (filters?.limit) {
      query += `&limit=${filters.limit}`;
    }

    const response = await this.makeRequest(connectionId, query);
    return response.items || [];
  }

  async createPayment(
    connectionId: string,
    invoiceId: string,
    amount: number,
    paymentDate: Date,
    paymentMethod: string = 'Electronic',
    reference?: string
  ): Promise<OracleFusionPayment> {
    const paymentData = {
      PaymentAmount: amount,
      PaymentCurrencyCode: 'USD',
      PaymentDate: paymentDate.toISOString().split('T')[0],
      PaymentMethodCode: paymentMethod,
      PaymentReference: reference || `WELLS-${Date.now()}`,
      InvoiceId: parseInt(invoiceId),
    };

    const response = await this.makeRequest(
      connectionId,
      '/payments',
      'POST',
      paymentData
    );

    return response;
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  async fullSync(connectionId: string): Promise<{
    vendorsFound: number;
    invoicesFound: number;
    paymentsFound: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let vendorsFound = 0;
    let invoicesFound = 0;
    let paymentsFound = 0;

    try {
      // Sync vendors
      const vendors = await this.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        try {
          await this.syncVendorToDatabase(connectionId, vendor);
          vendorsFound++;
        } catch (error) {
          errors.push(`Vendor ${vendor.SupplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync invoices (unpaid only for intercepts)
      const invoices = await this.fetchInvoices(connectionId, {
        status: 'N', // Unpaid
        limit: 500,
      });
      for (const invoice of invoices) {
        try {
          await this.syncInvoiceToDatabase(connectionId, invoice);
          invoicesFound++;
        } catch (error) {
          errors.push(`Invoice ${invoice.InvoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync recent payments
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const payments = await this.fetchPayments(connectionId, {
        dateFrom: thirtyDaysAgo,
        limit: 200,
      });
      paymentsFound = payments.length;

      // Update sync status
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'completed',
          last_sync_error = null
        WHERE id = ${connectionId}
      `;
    } catch (error) {
      // Update sync status with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'failed',
          last_sync_error = ${errorMessage}
        WHERE id = ${connectionId}
      `;
      errors.push(errorMessage);
    }

    return {
      vendorsFound,
      invoicesFound,
      paymentsFound,
      errors,
    };
  }

  // ============================================================================
  // CONNECTION TEST
  // ============================================================================

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      // Try to fetch a single vendor
      await this.fetchVendors(connectionId, 1);
      return true;
    } catch (error) {
      console.error('Oracle connection test failed:', error);
      return false;
    }
  }
}

export const oracle = new OracleService();
