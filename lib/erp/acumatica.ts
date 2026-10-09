// Acumatica ERP Integration
// OAuth 2.0 + REST API integration for Acumatica Cloud ERP
// Popular in manufacturing, distribution, construction, and retail industries

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const REDIRECT_URI = process.env.ACUMATICA_REDIRECT_URI || 'https://wellsai.app/api/erp/acumatica/callback';

// Acumatica REST API version
const API_VERSION = '23.200.001'; // Acumatica 2023 R2

// ============================================================================
// ACUMATICA TYPE DEFINITIONS
// ============================================================================

// Acumatica Vendor (Business Account)
interface AcumaticaVendor {
  id: string;
  VendorID: { value: string };
  VendorName: { value: string };
  VendorClass: { value?: string };
  Status: { value: 'Active' | 'On Hold' | 'One Time' | 'Inactive' };
  MainContact?: {
    Email?: { value?: string };
    Phone1?: { value?: string };
    Address?: {
      AddressLine1?: { value?: string };
      AddressLine2?: { value?: string };
      City?: { value?: string };
      State?: { value?: string };
      PostalCode?: { value?: string };
      Country?: { value?: string };
    };
  };
  PrimaryContact?: {
    Email?: { value?: string };
    Phone1?: { value?: string };
  };
  PaymentMethod?: { value?: string };
  CashAccount?: { value?: string };
  PaymentLeadTime?: { value?: number };
  Terms?: { value?: string };
  CurrencyID?: { value?: string };
  TaxZone?: { value?: string };
  LandedCostVendor?: { value?: boolean };
  PaymentBy?: { value?: string };
  TaxRegistrationID?: { value?: string };
  LastModifiedDateTime?: { value?: string };
  custom?: Record<string, any>;
}

// Acumatica Bill (AP Bill / Vendor Invoice)
interface AcumaticaBill {
  id: string;
  Type: { value: 'Bill' | 'Credit Adj.' | 'Debit Adj.' | 'Prepayment' | 'Quick Check' };
  ReferenceNbr: { value: string };
  Status: { value: 'Hold' | 'Balanced' | 'Voided' | 'Scheduled' | 'Open' | 'Closed' | 'Printed' | 'Prebooked' | 'Reserved' };
  Date: { value: string };
  PostPeriod?: { value?: string };
  DueDate?: { value?: string };
  CashDiscountDate?: { value?: string };
  Vendor: { value: string };
  VendorRef?: { value?: string };
  LocationID?: { value?: string };
  CurrencyID?: { value?: string };
  Amount: { value: number };
  Balance?: { value?: number };
  Hold?: { value?: boolean };
  Description?: { value?: string };
  Terms?: { value?: string };
  TaxTotal?: { value?: number };
  Branch?: { value?: string };
  Details?: Array<{
    Branch?: { value?: string };
    InventoryID?: { value?: string };
    TransactionDescr?: { value?: string };
    Qty?: { value?: number };
    UOM?: { value?: string };
    UnitCost?: { value?: number };
    Amount?: { value?: number };
    Account?: { value?: string };
    Subaccount?: { value?: string };
    Project?: { value?: string };
    ProjectTask?: { value?: string };
  }>;
  custom?: Record<string, any>;
}

// Acumatica Payment (AP Payment / Check)
interface AcumaticaPayment {
  id: string;
  Type: { value: 'Check' | 'Prepayment' | 'Refund' | 'Voided Check' | 'Debit Adj.' };
  ReferenceNbr: { value: string };
  Status: { value: 'Hold' | 'Balanced' | 'Pending Print' | 'Pending Approval' | 'Rejected' | 'Closed' | 'Printed' | 'Voided' | 'Reserved' | 'Open' };
  ApplicationDate: { value: string };
  Vendor: { value: string };
  PaymentMethod?: { value?: string };
  CashAccount?: { value?: string };
  PaymentRef?: { value?: string };
  PaymentAmount: { value: number };
  CurrencyID?: { value?: string };
  UnappliedBalance?: { value?: number };
  Description?: { value?: string };
  Branch?: { value?: string };
  DocumentsToApply?: Array<{
    DocType?: { value?: string };
    ReferenceNbr?: { value?: string };
    AmountPaid?: { value?: number };
    Balance?: { value?: number };
  }>;
  custom?: Record<string, any>;
}

// Acumatica Company/Tenant info
interface AcumaticaCompany {
  CompanyID: string;
  CompanyName: string;
  BaseCurrency?: string;
  CompanyType?: string;
}

export class AcumaticaService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.ACUMATICA_CLIENT_ID || '';
    this.clientSecret = process.env.ACUMATICA_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Acumatica credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAUTH 2.0 FLOW
  // ============================================================================

  /**
   * Generate Acumatica OAuth2 authorization URL
   * @param state - Base64 encoded state parameter containing companyId
   * @param instanceUrl - The Acumatica instance URL (e.g., https://mycompany.acumatica.com)
   * @param tenant - Optional tenant/company name for multi-tenant setups
   */
  getAuthorizationUrl(state: string, instanceUrl: string, tenant?: string): string {
    // Normalize instance URL
    const baseUrl = instanceUrl.replace(/\/+$/, '');

    // Acumatica uses a standard OAuth2 authorization endpoint
    const authEndpoint = tenant
      ? `${baseUrl}/${tenant}/identity/connect/authorize`
      : `${baseUrl}/identity/connect/authorize`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'api offline_access',
      state,
    });

    return `${authEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    instanceUrl: string,
    tenant?: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const baseUrl = instanceUrl.replace(/\/+$/, '');
    const tokenEndpoint = tenant
      ? `${baseUrl}/${tenant}/identity/connect/token`
      : `${baseUrl}/identity/connect/token`;

    const response = await fetch(tokenEndpoint, {
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
    instanceUrl: string,
    tenant?: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const baseUrl = instanceUrl.replace(/\/+$/, '');
    const tokenEndpoint = tenant
      ? `${baseUrl}/${tenant}/identity/connect/token`
      : `${baseUrl}/identity/connect/token`;

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
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
        acumatica_instance_url,
        acumatica_tenant,
        acumatica_branch,
        acumatica_company_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Acumatica connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        connection.acumatica_instance_url,
        connection.acumatica_tenant
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

    // Build API URL
    const baseUrl = connection.acumatica_instance_url.replace(/\/+$/, '');
    const tenant = connection.acumatica_tenant;

    // Acumatica REST API endpoint structure
    const apiBase = tenant
      ? `${baseUrl}/${tenant}/entity/Default/${API_VERSION}`
      : `${baseUrl}/entity/Default/${API_VERSION}`;

    const url = `${apiBase}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Add branch header if configured (for multi-branch companies)
    if (connection.acumatica_branch) {
      headers['X-ACUMATICA-BRANCH'] = connection.acumatica_branch;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Acumatica API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  // ============================================================================
  // VENDOR OPERATIONS
  // ============================================================================

  async fetchVendors(connectionId: string, limit: number = 100): Promise<AcumaticaVendor[]> {
    // Acumatica uses $top for pagination
    const response = await this.makeRequest(
      connectionId,
      `/Vendor?$top=${limit}&$filter=Status eq 'Active'&$select=VendorID,VendorName,VendorClass,Status,MainContact,PrimaryContact,PaymentMethod,CashAccount,Terms,CurrencyID,TaxRegistrationID,LastModifiedDateTime`
    );

    return Array.isArray(response) ? response : [];
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<AcumaticaVendor | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/Vendor/${encodeURIComponent(vendorId)}?$expand=MainContact,PrimaryContact`
      );
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async syncVendorToDatabase(connectionId: string, vendor: AcumaticaVendor): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const vendorId = vendor.VendorID?.value || vendor.id;
    const vendorName = vendor.VendorName?.value || 'Unknown Vendor';
    const email = vendor.MainContact?.Email?.value || vendor.PrimaryContact?.Email?.value || null;
    const phone = vendor.MainContact?.Phone1?.value || vendor.PrimaryContact?.Phone1?.value || null;
    const address = vendor.MainContact?.Address;
    const isActive = vendor.Status?.value === 'Active';
    const currency = vendor.CurrencyID?.value || 'USD';
    const terms = vendor.Terms?.value || null;
    const taxId = vendor.TaxRegistrationID?.value || null;

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
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendorId},
        ${vendorName},
        ${vendorId},
        ${email},
        ${phone},
        ${address?.AddressLine1?.value || null},
        ${address?.AddressLine2?.value || null},
        ${address?.City?.value || null},
        ${address?.State?.value || null},
        ${address?.PostalCode?.value || null},
        ${address?.Country?.value || 'US'},
        ${taxId},
        ${isActive},
        ${currency},
        ${terms},
        ${JSON.stringify(vendor)}
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
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // BILL OPERATIONS
  // ============================================================================

  async fetchBills(
    connectionId: string,
    filters?: {
      status?: string;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      limit?: number;
    }
  ): Promise<AcumaticaBill[]> {
    const filterConditions: string[] = [];

    // Default to Open bills (unpaid)
    if (filters?.status) {
      filterConditions.push(`Status eq '${filters.status}'`);
    } else {
      filterConditions.push(`Status eq 'Open'`);
    }

    // Bill type filter - only actual bills, not adjustments
    filterConditions.push(`Type eq 'Bill'`);

    if (filters?.dueDateFrom) {
      filterConditions.push(`DueDate ge datetimeoffset'${filters.dueDateFrom.toISOString()}'`);
    }

    if (filters?.dueDateTo) {
      filterConditions.push(`DueDate le datetimeoffset'${filters.dueDateTo.toISOString()}'`);
    }

    const limit = filters?.limit || 100;
    const filterString = filterConditions.join(' and ');

    const response = await this.makeRequest(
      connectionId,
      `/Bill?$top=${limit}&$filter=${encodeURIComponent(filterString)}&$select=ReferenceNbr,Type,Status,Date,DueDate,Vendor,VendorRef,CurrencyID,Amount,Balance,Description,Terms,TaxTotal,Branch&$expand=Details`
    );

    return Array.isArray(response) ? response : [];
  }

  async fetchBill(connectionId: string, billId: string): Promise<AcumaticaBill | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/Bill/Bill/${encodeURIComponent(billId)}?$expand=Details`
      );
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async syncBillToDatabase(connectionId: string, bill: AcumaticaBill): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const billNumber = bill.ReferenceNbr?.value || bill.id;
    const vendorId = bill.Vendor?.value || '';
    const totalAmount = bill.Amount?.value || 0;
    const balance = bill.Balance?.value ?? totalAmount;
    const currency = bill.CurrencyID?.value || 'USD';
    const billDate = bill.Date?.value || new Date().toISOString();
    const dueDate = bill.DueDate?.value || billDate;
    const description = bill.Description?.value || null;
    const status = bill.Status?.value || 'Open';

    // Calculate Wells fee and savings
    const wellsFee = totalAmount * 0.01; // 1%
    const paymentCostSaved = totalAmount > 10000 ? 30 : 15; // Wire vs ACH typical costs
    const netSavings = paymentCostSaved - wellsFee;

    const isPaid = status === 'Closed' || balance === 0;
    const amountPaid = totalAmount - balance;

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
        ${billNumber},
        ${vendorId},
        ${bill.VendorRef?.value || billNumber},
        ${vendorId},
        ${totalAmount},
        ${currency},
        ${billDate},
        ${dueDate},
        ${isPaid ? 'paid_external' : 'pending'},
        ${isPaid ? 'paid' : balance < totalAmount ? 'partial' : 'unpaid'},
        ${amountPaid},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${description},
        ${JSON.stringify(bill)}
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
  ): Promise<AcumaticaPayment[]> {
    const filterConditions: string[] = [];

    // Only fetch actual checks/payments, not voids
    filterConditions.push(`Type eq 'Check' or Type eq 'Prepayment'`);

    if (filters?.dateFrom) {
      filterConditions.push(`ApplicationDate ge datetimeoffset'${filters.dateFrom.toISOString()}'`);
    }

    if (filters?.dateTo) {
      filterConditions.push(`ApplicationDate le datetimeoffset'${filters.dateTo.toISOString()}'`);
    }

    const limit = filters?.limit || 100;
    const filterString = filterConditions.join(' and ');

    const response = await this.makeRequest(
      connectionId,
      `/Check?$top=${limit}&$filter=${encodeURIComponent(filterString)}&$select=ReferenceNbr,Type,Status,ApplicationDate,Vendor,PaymentMethod,CashAccount,PaymentRef,PaymentAmount,CurrencyID,UnappliedBalance,Description,Branch&$expand=DocumentsToApply`
    );

    return Array.isArray(response) ? response : [];
  }

  async createPayment(
    connectionId: string,
    vendorId: string,
    billReferenceNbr: string,
    amount: number,
    paymentDate: Date,
    cashAccountId?: string,
    description?: string
  ): Promise<AcumaticaPayment> {
    // Get connection to retrieve default cash account if not provided
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const [connection] = await sql`
      SELECT acumatica_default_cash_account, acumatica_branch
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    const cashAccount = cashAccountId || connection?.acumatica_default_cash_account;

    if (!cashAccount) {
      throw new Error('Cash account not specified and no default configured');
    }

    const paymentData = {
      Type: { value: 'Check' },
      Vendor: { value: vendorId },
      ApplicationDate: { value: paymentDate.toISOString().split('T')[0] },
      PaymentAmount: { value: amount },
      CashAccount: { value: cashAccount },
      Description: { value: description || `Paid via Wells AI - ${new Date().toISOString()}` },
      Hold: { value: false },
      DocumentsToApply: [
        {
          DocType: { value: 'Bill' },
          ReferenceNbr: { value: billReferenceNbr },
          AmountPaid: { value: amount },
        },
      ],
    };

    // Add branch if configured
    if (connection?.acumatica_branch) {
      (paymentData as any).Branch = { value: connection.acumatica_branch };
    }

    const response = await this.makeRequest(
      connectionId,
      '/Check',
      'PUT',
      paymentData
    );

    return response;
  }

  async syncPaymentToDatabase(connectionId: string, payment: AcumaticaPayment): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const paymentId = payment.ReferenceNbr?.value || payment.id;
    const vendorId = payment.Vendor?.value || '';
    const amount = payment.PaymentAmount?.value || 0;
    const paymentDate = payment.ApplicationDate?.value || new Date().toISOString();
    const paymentMethod = payment.PaymentMethod?.value || 'Check';
    const description = payment.Description?.value || null;

    await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${paymentId},
        ${vendorId},
        ${amount},
        ${paymentMethod},
        ${paymentDate},
        ${description},
        ${JSON.stringify(payment)}
      )
      ON CONFLICT (erp_connection_id, external_payment_id)
      DO UPDATE SET
        payment_amount = EXCLUDED.payment_amount,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // COMPANY/TENANT OPERATIONS
  // ============================================================================

  /**
   * Get available companies/tenants for a connected instance
   * Useful for multi-tenant Acumatica installations
   */
  async getCompanies(accessToken: string, instanceUrl: string): Promise<AcumaticaCompany[]> {
    const baseUrl = instanceUrl.replace(/\/+$/, '');

    // Acumatica system endpoint to list companies
    const url = `${baseUrl}/entity/auth/Companies`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Some Acumatica instances might not support this endpoint
      // Return empty array as fallback
      console.warn('Could not fetch Acumatica companies list');
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get company info for current connection
   */
  async getCompanyInfo(connectionId: string): Promise<any> {
    try {
      // Acumatica stores company info in Organization entity
      const response = await this.makeRequest(
        connectionId,
        '/Organization?$top=1'
      );
      return Array.isArray(response) ? response[0] : response;
    } catch (error) {
      console.warn('Could not fetch Acumatica company info:', error);
      return null;
    }
  }

  // ============================================================================
  // BRANCH OPERATIONS (for multi-branch companies)
  // ============================================================================

  /**
   * Get available branches for a connected company
   */
  async getBranches(connectionId: string): Promise<Array<{ BranchID: string; BranchName: string }>> {
    try {
      const response = await this.makeRequest(
        connectionId,
        '/Branch?$select=BranchID,BranchName'
      );
      return Array.isArray(response) ? response.map((b: any) => ({
        BranchID: b.BranchID?.value || '',
        BranchName: b.BranchName?.value || '',
      })) : [];
    } catch (error) {
      console.warn('Could not fetch Acumatica branches:', error);
      return [];
    }
  }

  // ============================================================================
  // CASH ACCOUNTS (for payment configuration)
  // ============================================================================

  /**
   * Get available cash accounts for payments
   */
  async getCashAccounts(connectionId: string): Promise<Array<{ CashAccountID: string; Description: string; Currency: string }>> {
    try {
      const response = await this.makeRequest(
        connectionId,
        '/CashAccount?$select=CashAccountID,Description,Currency&$filter=Active eq true'
      );
      return Array.isArray(response) ? response.map((a: any) => ({
        CashAccountID: a.CashAccountID?.value || '',
        Description: a.Description?.value || '',
        Currency: a.Currency?.value || 'USD',
      })) : [];
    } catch (error) {
      console.warn('Could not fetch Acumatica cash accounts:', error);
      return [];
    }
  }

  // ============================================================================
  // FULL SYNC
  // ============================================================================

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
      // Sync vendors
      const vendors = await this.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        try {
          await this.syncVendorToDatabase(connectionId, vendor);
          vendorsFound++;
        } catch (error) {
          const vendorId = vendor.VendorID?.value || vendor.id;
          errors.push(`Vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync bills (open/unpaid for intercepts)
      const bills = await this.fetchBills(connectionId, {
        status: 'Open',
        limit: 500,
      });
      for (const bill of bills) {
        try {
          await this.syncBillToDatabase(connectionId, bill);
          billsFound++;
        } catch (error) {
          const billId = bill.ReferenceNbr?.value || bill.id;
          errors.push(`Bill ${billId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync recent payments (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const payments = await this.fetchPayments(connectionId, {
        dateFrom: thirtyDaysAgo,
        limit: 200,
      });
      for (const payment of payments) {
        try {
          await this.syncPaymentToDatabase(connectionId, payment);
          paymentsFound++;
        } catch (error) {
          const paymentId = payment.ReferenceNbr?.value || payment.id;
          errors.push(`Payment ${paymentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update sync status
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
      // Update sync status with error
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

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      // Try to fetch a single vendor to verify connection
      await this.fetchVendors(connectionId, 1);
      return true;
    } catch (error) {
      console.error('Acumatica connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // HELPER: Login via username/password (alternative to OAuth)
  // Some Acumatica instances prefer this approach
  // ============================================================================

  async loginWithCredentials(
    instanceUrl: string,
    username: string,
    password: string,
    tenant?: string,
    branch?: string
  ): Promise<{ accessToken: string; sessionId: string }> {
    const baseUrl = instanceUrl.replace(/\/+$/, '');
    const loginEndpoint = tenant
      ? `${baseUrl}/${tenant}/entity/auth/login`
      : `${baseUrl}/entity/auth/login`;

    const loginBody: any = {
      name: username,
      password: password,
    };

    if (branch) {
      loginBody.branch = branch;
    }

    const response = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Acumatica login failed: ${error}`);
    }

    // Extract session cookie
    const cookies = response.headers.get('set-cookie');
    const sessionMatch = cookies?.match(/\.ASPXAUTH=([^;]+)/);

    return {
      accessToken: sessionMatch?.[1] || '',
      sessionId: sessionMatch?.[1] || '',
    };
  }

  /**
   * Logout/cleanup session (for credential-based auth)
   */
  async logout(instanceUrl: string, accessToken: string, tenant?: string): Promise<void> {
    const baseUrl = instanceUrl.replace(/\/+$/, '');
    const logoutEndpoint = tenant
      ? `${baseUrl}/${tenant}/entity/auth/logout`
      : `${baseUrl}/entity/auth/logout`;

    await fetch(logoutEndpoint, {
      method: 'POST',
      headers: {
        'Cookie': `.ASPXAUTH=${accessToken}`,
      },
    });
  }
}

// Export singleton instance
export const acumatica = new AcumaticaService();
