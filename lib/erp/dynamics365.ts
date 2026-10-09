// Microsoft Dynamics 365 Integration
// Azure AD OAuth2 flow + API integration for Dynamics 365 Finance & Operations and Business Central

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const REDIRECT_URI = process.env.DYNAMICS_REDIRECT_URI || 'https://wellsai.app/api/erp/dynamics/callback';

// Dynamics 365 Finance & Operations Types
interface DynamicsVendor {
  VendorAccountNumber: string;
  VendorOrganizationName: string;
  PrimaryContactEmail?: string;
  PrimaryContactPhone?: string;
  VendorGroupId?: string;
  CurrencyCode: string;
  PaymentTermsId?: string;
  TaxRegistrationNumber?: string;
  IsOnHold: boolean;
  DefaultPaymentMethodName?: string;
  BankAccountNumber?: string;
  BankRoutingNumber?: string;
  BankSWIFTCode?: string;
  BankIBAN?: string;
}

interface DynamicsInvoice {
  InvoiceId: string;
  VendorInvoiceNumber: string;
  VendorAccountNumber: string;
  VendorName: string;
  InvoiceAmount: number;
  CurrencyCode: string;
  InvoiceDate: string;
  DueDate: string;
  InvoiceStatus: string;
  PurchaseOrderNumber?: string;
  Description?: string;
}

interface DynamicsPayment {
  PaymentId: string;
  VendorAccountNumber: string;
  PaymentAmount: number;
  CurrencyCode: string;
  PaymentDate: string;
  PaymentMethod: string;
  PaymentStatus: string;
  PaymentReference?: string;
  BankAccountId?: string;
  TransactionId?: string;
}

// Business Central Types
interface BCVendor {
  id: string;
  number: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  taxRegistrationNumber?: string;
  currencyCode: string;
  paymentTermsId?: string;
  blocked?: string;
  lastModifiedDateTime: string;
}

interface BCInvoice {
  id: string;
  number: string;
  vendorId: string;
  vendorNumber: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currencyCode: string;
  status: string;
  purchaseOrderNumber?: string;
}

interface BCPayment {
  id: string;
  vendorNumber: string;
  postingDate: string;
  amount: number;
  currencyCode: string;
  description?: string;
  externalDocumentNumber?: string;
}

export class Dynamics365Service {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.DYNAMICS_CLIENT_ID || '';
    this.clientSecret = process.env.DYNAMICS_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Dynamics 365 credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // AZURE AD OAUTH2 FLOW
  // ============================================================================

  /**
   * Generate Azure AD OAuth2 authorization URL
   * @param state - Base64 encoded state parameter containing companyId and variant
   * @param tenantId - Azure AD tenant ID
   * @param variant - 'finance_operations' or 'business_central'
   */
  getAuthorizationUrl(state: string, tenantId: string, variant: 'finance_operations' | 'business_central'): string {
    const scope = variant === 'finance_operations'
      ? 'https://finance.dynamics.com/.default offline_access'
      : 'https://api.businesscentral.dynamics.com/.default offline_access';

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope,
      state,
      response_mode: 'query',
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    tenantId: string,
    variant: 'finance_operations' | 'business_central'
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const scope = variant === 'finance_operations'
      ? 'https://finance.dynamics.com/.default offline_access'
      : 'https://api.businesscentral.dynamics.com/.default offline_access';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope,
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
    tenantId: string,
    variant: 'finance_operations' | 'business_central'
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const scope = variant === 'finance_operations'
      ? 'https://finance.dynamics.com/.default offline_access'
      : 'https://api.businesscentral.dynamics.com/.default offline_access';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope,
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
        dynamics_host,
        dynamics_variant,
        dynamics_tenant_id,
        dynamics_company_id,
        dynamics_environment
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Dynamics 365 connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        connection.dynamics_tenant_id,
        connection.dynamics_variant
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
    if (connection.dynamics_variant === 'finance_operations') {
      // Dynamics 365 Finance & Operations OData endpoint
      baseUrl = `https://${connection.dynamics_host}/data`;
    } else {
      // Business Central API endpoint
      const environment = connection.dynamics_environment || 'production';
      const apiVersion = 'v2.0';
      baseUrl = `https://api.businesscentral.dynamics.com/v2.0/${connection.dynamics_tenant_id}/${environment}/api/${apiVersion}`;

      if (connection.dynamics_company_id) {
        baseUrl += `/companies(${connection.dynamics_company_id})`;
      }
    }

    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dynamics API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // VENDOR OPERATIONS
  // ============================================================================

  async fetchVendors(connectionId: string, limit: number = 100): Promise<DynamicsVendor[] | BCVendor[]> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    if (connection.dynamics_variant === 'finance_operations') {
      const response = await this.makeRequest(
        connectionId,
        `/Vendors?$top=${limit}&$select=VendorAccountNumber,VendorOrganizationName,PrimaryContactEmail,PrimaryContactPhone,CurrencyCode,PaymentTermsId,TaxRegistrationNumber,IsOnHold,BankAccountNumber,BankRoutingNumber,BankSWIFTCode,BankIBAN`
      );
      return response.value || [];
    } else {
      const response = await this.makeRequest(
        connectionId,
        `/vendors?$top=${limit}&$select=id,number,displayName,email,phoneNumber,currencyCode,paymentTermsId,taxRegistrationNumber,blocked,lastModifiedDateTime`
      );
      return response.value || [];
    }
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<DynamicsVendor | BCVendor> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    if (connection.dynamics_variant === 'finance_operations') {
      const response = await this.makeRequest(
        connectionId,
        `/Vendors(VendorAccountNumber='${vendorId}')`
      );
      return response;
    } else {
      const response = await this.makeRequest(
        connectionId,
        `/vendors(${vendorId})`
      );
      return response;
    }
  }

  async syncVendorToDatabase(connectionId: string, vendor: DynamicsVendor | BCVendor, variant: string): Promise<void> {
    if (variant === 'finance_operations') {
      const v = vendor as DynamicsVendor;
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
          bank_account_number,
          routing_number,
          raw_data
        ) VALUES (
          ${connectionId},
          ${v.VendorAccountNumber},
          ${v.VendorOrganizationName},
          ${v.VendorAccountNumber},
          ${v.PrimaryContactEmail || null},
          ${v.PrimaryContactPhone || null},
          ${v.TaxRegistrationNumber || null},
          ${!v.IsOnHold},
          ${v.CurrencyCode || 'USD'},
          ${v.PaymentTermsId || null},
          ${v.BankAccountNumber || null},
          ${v.BankRoutingNumber || null},
          ${JSON.stringify(v)}
        )
        ON CONFLICT (erp_connection_id, external_vendor_id)
        DO UPDATE SET
          vendor_name = EXCLUDED.vendor_name,
          vendor_display_name = EXCLUDED.vendor_display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          tax_id = EXCLUDED.tax_id,
          is_active = EXCLUDED.is_active,
          default_currency = EXCLUDED.default_currency,
          payment_terms = EXCLUDED.payment_terms,
          bank_account_number = EXCLUDED.bank_account_number,
          routing_number = EXCLUDED.routing_number,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;
    } else {
      const v = vendor as BCVendor;
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
          ${v.id},
          ${v.displayName},
          ${v.number},
          ${v.email || null},
          ${v.phoneNumber || null},
          ${v.taxRegistrationNumber || null},
          ${v.blocked !== 'All'},
          ${v.currencyCode || 'USD'},
          ${v.paymentTermsId || null},
          ${JSON.stringify(v)}
        )
        ON CONFLICT (erp_connection_id, external_vendor_id)
        DO UPDATE SET
          vendor_name = EXCLUDED.vendor_name,
          vendor_display_name = EXCLUDED.vendor_display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          tax_id = EXCLUDED.tax_id,
          is_active = EXCLUDED.is_active,
          default_currency = EXCLUDED.default_currency,
          payment_terms = EXCLUDED.payment_terms,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;
    }
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
  ): Promise<DynamicsInvoice[] | BCInvoice[]> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    const filterConditions: string[] = [];

    if (filters?.status) {
      filterConditions.push(`InvoiceStatus eq '${filters.status}'`);
    }

    if (filters?.dueDateFrom) {
      filterConditions.push(`DueDate ge ${filters.dueDateFrom.toISOString()}`);
    }

    if (filters?.dueDateTo) {
      filterConditions.push(`DueDate le ${filters.dueDateTo.toISOString()}`);
    }

    let query = connection.dynamics_variant === 'finance_operations'
      ? `/VendorInvoices?$select=InvoiceId,VendorInvoiceNumber,VendorAccountNumber,VendorName,InvoiceAmount,CurrencyCode,InvoiceDate,DueDate,InvoiceStatus,PurchaseOrderNumber,Description`
      : `/purchaseInvoices?$select=id,number,vendorId,vendorNumber,vendorName,invoiceDate,dueDate,amount,currencyCode,status,purchaseOrderNumber`;

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`;
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`;
    }

    const response = await this.makeRequest(connectionId, query);
    return response.value || [];
  }

  async fetchInvoice(connectionId: string, invoiceId: string): Promise<DynamicsInvoice | BCInvoice> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    if (connection.dynamics_variant === 'finance_operations') {
      const response = await this.makeRequest(
        connectionId,
        `/VendorInvoices(InvoiceId='${invoiceId}')`
      );
      return response;
    } else {
      const response = await this.makeRequest(
        connectionId,
        `/purchaseInvoices(${invoiceId})`
      );
      return response;
    }
  }

  async syncInvoiceToDatabase(connectionId: string, invoice: DynamicsInvoice | BCInvoice, variant: string): Promise<void> {
    if (variant === 'finance_operations') {
      const inv = invoice as DynamicsInvoice;
      const wellsFee = inv.InvoiceAmount * 0.01;
      const paymentCostSaved = inv.InvoiceAmount > 10000 ? 30 : 15;
      const netSavings = paymentCostSaved - wellsFee;
      const isPaid = inv.InvoiceStatus === 'Paid';

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
          ${inv.InvoiceId},
          ${inv.VendorAccountNumber},
          ${inv.VendorInvoiceNumber},
          ${inv.VendorName},
          ${inv.InvoiceAmount},
          ${inv.CurrencyCode || 'USD'},
          ${inv.InvoiceDate},
          ${inv.DueDate},
          ${isPaid ? 'paid_external' : 'pending'},
          ${isPaid ? 'paid' : 'unpaid'},
          ${isPaid ? inv.InvoiceAmount : 0},
          ${wellsFee},
          ${paymentCostSaved},
          ${netSavings},
          ${inv.Description || null},
          ${JSON.stringify(inv)}
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
    } else {
      const inv = invoice as BCInvoice;
      const wellsFee = inv.amount * 0.01;
      const paymentCostSaved = inv.amount > 10000 ? 30 : 15;
      const netSavings = paymentCostSaved - wellsFee;
      const isPaid = inv.status === 'Paid';

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
          raw_data
        ) VALUES (
          ${connectionId},
          ${inv.id},
          ${inv.vendorId},
          ${inv.number},
          ${inv.vendorName},
          ${inv.amount},
          ${inv.currencyCode || 'USD'},
          ${inv.invoiceDate},
          ${inv.dueDate},
          ${isPaid ? 'paid_external' : 'pending'},
          ${isPaid ? 'paid' : 'unpaid'},
          ${isPaid ? inv.amount : 0},
          ${wellsFee},
          ${paymentCostSaved},
          ${netSavings},
          ${JSON.stringify(inv)}
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
  ): Promise<DynamicsPayment[] | BCPayment[]> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    const filterConditions: string[] = [];

    if (filters?.dateFrom) {
      filterConditions.push(`PaymentDate ge ${filters.dateFrom.toISOString()}`);
    }

    if (filters?.dateTo) {
      filterConditions.push(`PaymentDate le ${filters.dateTo.toISOString()}`);
    }

    let query = connection.dynamics_variant === 'finance_operations'
      ? `/VendorPayments?$select=PaymentId,VendorAccountNumber,PaymentAmount,CurrencyCode,PaymentDate,PaymentMethod,PaymentStatus,PaymentReference,BankAccountId,TransactionId`
      : `/vendorPayments?$select=id,vendorNumber,postingDate,amount,currencyCode,description,externalDocumentNumber`;

    if (filterConditions.length > 0) {
      query += `&$filter=${filterConditions.join(' and ')}`;
    }

    if (filters?.limit) {
      query += `&$top=${filters.limit}`;
    }

    const response = await this.makeRequest(connectionId, query);
    return response.value || [];
  }

  async createPayment(
    connectionId: string,
    invoiceId: string,
    vendorId: string,
    amount: number,
    paymentDate: Date,
    reference?: string
  ): Promise<DynamicsPayment | BCPayment> {
    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    if (connection.dynamics_variant === 'finance_operations') {
      const paymentData = {
        VendorAccountNumber: vendorId,
        PaymentAmount: amount,
        CurrencyCode: 'USD',
        PaymentDate: paymentDate.toISOString().split('T')[0],
        PaymentMethod: 'Electronic',
        PaymentReference: reference || `WELLS-${Date.now()}`,
      };

      const response = await this.makeRequest(
        connectionId,
        '/VendorPayments',
        'POST',
        paymentData
      );

      return response;
    } else {
      const paymentData = {
        vendorNumber: vendorId,
        postingDate: paymentDate.toISOString().split('T')[0],
        amount: amount,
        currencyCode: 'USD',
        description: reference || `Paid via Wells AI`,
        externalDocumentNumber: `WELLS-${Date.now()}`,
      };

      const response = await this.makeRequest(
        connectionId,
        '/vendorPayments',
        'POST',
        paymentData
      );

      return response;
    }
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

    const [connection] = await sql`
      SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}
    `;

    const variant = connection.dynamics_variant;

    try {
      // Sync vendors
      const vendors = await this.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        try {
          await this.syncVendorToDatabase(connectionId, vendor, variant);
          vendorsFound++;
        } catch (error) {
          const vendorId = variant === 'finance_operations'
            ? (vendor as DynamicsVendor).VendorAccountNumber
            : (vendor as BCVendor).id;
          errors.push(`Vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync invoices (unpaid only for intercepts)
      const invoices = await this.fetchInvoices(connectionId, {
        status: 'Open',
        limit: 500,
      });
      for (const invoice of invoices) {
        try {
          await this.syncInvoiceToDatabase(connectionId, invoice, variant);
          invoicesFound++;
        } catch (error) {
          const invoiceId = variant === 'finance_operations'
            ? (invoice as DynamicsInvoice).InvoiceId
            : (invoice as BCInvoice).id;
          errors.push(`Invoice ${invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  // BUSINESS CENTRAL SPECIFIC: Company Selection
  // ============================================================================

  async getBusinessCentralCompanies(
    accessToken: string,
    tenantId: string,
    environment: string = 'production'
  ): Promise<Array<{ id: string; name: string; displayName: string }>> {
    const url = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environment}/api/v2.0/companies`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch companies: ${error}`);
    }

    const data = await response.json();
    return data.value || [];
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
      console.error('Dynamics 365 connection test failed:', error);
      return false;
    }
  }
}

export const dynamics365 = new Dynamics365Service();
