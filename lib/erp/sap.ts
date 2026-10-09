// SAP ERP Integration
// Supports both SAP S/4HANA (OData) and SAP Business One (Service Layer)
// OAuth2 for S/4HANA Cloud, Session-based for Business One

import { neon } from '@neondatabase/serverless';
import type { ERPConnection, ERPBill, ERPVendor, ERPPayment } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const REDIRECT_URI = process.env.SAP_REDIRECT_URI || 'https://wellsai.app/api/erp/sap/callback';

// SAP Bill/Invoice structure
interface SAPBill {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocDueDate: string;
  DocTotal: number;
  DocCurrency: string;
  DocumentStatus: string;
  PaidToDate?: number;
  Comments?: string;
  DocumentLines?: Array<{
    LineNum: number;
    ItemDescription: string;
    Quantity: number;
    Price: number;
    LineTotal: number;
    AccountCode?: string;
  }>;
}

// SAP Vendor (Business Partner) structure
interface SAPVendor {
  CardCode: string;
  CardName: string;
  CardType: string;
  EmailAddress?: string;
  Phone1?: string;
  FederalTaxID?: string;
  Currency?: string;
  PayTermsGrpCode?: number;
  Valid: string;
}

// SAP Payment structure
interface SAPPayment {
  DocEntry?: number;
  DocNum?: number;
  DocType: string;
  CardCode: string;
  DocDate: string;
  DocCurrency: string;
  TransferSum?: number;
  CashSum?: number;
  CheckSum?: number;
  TransferAccount?: string;
  TransferReference?: string;
  JournalRemarks?: string;
  PaymentInvoices?: Array<{
    DocEntry: number;
    InvoiceType: string;
    SumApplied: number;
  }>;
}

export class SAPService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.SAP_CLIENT_ID || '';
    this.clientSecret = process.env.SAP_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('SAP credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAuth 2.0 Flow (SAP S/4HANA Cloud)
  // ============================================================================

  getAuthorizationUrl(state: string, sapHost: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'API_PURCHASEORDER_PROCESS_SRV API_BUSINESS_PARTNER API_JOURNALENTRY_SRV',
      state,
    });

    return `${sapHost}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, sapHost: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = `${sapHost}/oauth/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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

  async refreshAccessToken(refreshToken: string, sapHost: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = `${sapHost}/oauth/token`;
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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
  // SAP Business One Session Authentication
  // ============================================================================

  async loginBusinessOne(
    host: string,
    companyDB: string,
    username: string,
    password: string
  ): Promise<{ sessionId: string; sessionTimeout: number }> {
    const loginUrl = `${host}/b1s/v1/Login`;

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CompanyDB: companyDB,
        UserName: username,
        Password: password,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAP B1 login failed: ${error}`);
    }

    const data = await response.json();
    return {
      sessionId: data.SessionId,
      sessionTimeout: data.SessionTimeout || 30,
    };
  }

  async logoutBusinessOne(host: string, sessionId: string): Promise<void> {
    try {
      await fetch(`${host}/b1s/v1/Logout`, {
        method: 'POST',
        headers: {
          'Cookie': `B1SESSION=${sessionId}`,
        },
      });
    } catch (error) {
      // Ignore logout errors
    }
  }

  // ============================================================================
  // API Request Methods
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
        realm_id as sap_host,
        tenant_id as sap_client,
        company_key as sap_system
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('SAP connection not found');
    }

    const sapHost = connection.sap_host;
    const sapSystem = connection.sap_system || 's4hana';
    let accessToken = connection.access_token;

    // Token refresh for S/4HANA
    if (sapSystem === 's4hana' && connection.token_expires_at) {
      if (new Date(connection.token_expires_at) <= new Date()) {
        const tokens = await this.refreshAccessToken(connection.refresh_token, sapHost);
        accessToken = tokens.access_token;

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
    }

    let url: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (sapSystem === 's4hana') {
      url = `${sapHost}${endpoint}`;
      headers['Authorization'] = `Bearer ${accessToken}`;
      if (connection.sap_client) {
        headers['sap-client'] = connection.sap_client;
      }
    } else {
      // Business One
      url = `${sapHost}/b1s/v1${endpoint}`;
      headers['Cookie'] = `B1SESSION=${accessToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAP API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  // ============================================================================
  // Bill/Invoice Methods
  // ============================================================================

  async fetchBills(connectionId: string, startDate?: Date): Promise<SAPBill[]> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = `/sap/opu/odata/sap/API_PURCHASEINVOICE/A_PurchaseInvoice?$filter=DocumentStatus eq 'O'&$top=1000`;
      if (startDate) {
        const dateStr = startDate.toISOString().split('T')[0];
        endpoint += ` and DueDate ge datetime'${dateStr}'`;
      }
    } else {
      // Business One
      endpoint = `/PurchaseInvoices?$filter=DocumentStatus eq 'O'&$top=1000`;
      if (startDate) {
        const dateStr = startDate.toISOString().split('T')[0];
        endpoint += ` and DocDueDate ge '${dateStr}'`;
      }
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.d?.results || response.value || [];
  }

  async fetchBill(connectionId: string, billId: string): Promise<SAPBill | null> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = `/sap/opu/odata/sap/API_PURCHASEINVOICE/A_PurchaseInvoice('${billId}')`;
    } else {
      endpoint = `/PurchaseInvoices(${billId})`;
    }

    try {
      const response = await this.makeRequest(connectionId, endpoint);
      return response.d || response;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Vendor Methods
  // ============================================================================

  async fetchVendors(connectionId: string): Promise<SAPVendor[]> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$filter=BusinessPartnerType eq 'Supplier'&$top=1000`;
    } else {
      endpoint = `/BusinessPartners?$filter=CardType eq 'S'&$top=1000`;
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.d?.results || response.value || [];
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<SAPVendor | null> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('${vendorId}')`;
    } else {
      endpoint = `/BusinessPartners('${vendorId}')`;
    }

    try {
      const response = await this.makeRequest(connectionId, endpoint);
      return response.d || response;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Payment Methods
  // ============================================================================

  async fetchPayments(connectionId: string, startDate?: Date): Promise<SAPPayment[]> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = `/sap/opu/odata/sap/API_OUTGOING_PAYMENT/A_OutgoingPayment?$top=1000`;
      if (startDate) {
        const dateStr = startDate.toISOString().split('T')[0];
        endpoint += `&$filter=PaymentDate ge datetime'${dateStr}'`;
      }
    } else {
      endpoint = `/VendorPayments?$top=1000`;
      if (startDate) {
        const dateStr = startDate.toISOString().split('T')[0];
        endpoint += `&$filter=DocDate ge '${dateStr}'`;
      }
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.d?.results || response.value || [];
  }

  async createPayment(
    connectionId: string,
    vendorId: string,
    billId: string,
    amount: number,
    paymentDate: Date,
    bankAccountId: string,
    memo?: string
  ): Promise<SAPPayment> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    const paymentData: Partial<SAPPayment> = {
      DocType: 'S',
      CardCode: vendorId,
      DocDate: paymentDate.toISOString().split('T')[0],
      DocCurrency: 'USD',
      TransferSum: amount,
      TransferAccount: bankAccountId,
      JournalRemarks: memo || 'Paid via Wells AI',
      PaymentInvoices: [{
        DocEntry: parseInt(billId),
        InvoiceType: '18', // AP Invoice
        SumApplied: amount,
      }],
    };

    if (sapSystem === 's4hana') {
      endpoint = '/sap/opu/odata/sap/API_OUTGOING_PAYMENT/A_OutgoingPayment';
    } else {
      endpoint = '/VendorPayments';
    }

    const response = await this.makeRequest(connectionId, endpoint, 'POST', paymentData);

    return {
      DocEntry: response.DocEntry || response.d?.DocEntry,
      DocNum: response.DocNum || response.d?.DocNum,
      DocType: 'S',
      CardCode: vendorId,
      DocDate: paymentDate.toISOString(),
      DocCurrency: 'USD',
      TransferSum: amount,
    };
  }

  // ============================================================================
  // Company Info
  // ============================================================================

  async getCompanyInfo(connectionId: string): Promise<any> {
    const [connection] = await sql`
      SELECT company_key as sap_system FROM erp_connections WHERE id = ${connectionId}
    `;

    const sapSystem = connection?.sap_system || 's4hana';
    let endpoint: string;

    if (sapSystem === 's4hana') {
      endpoint = '/sap/opu/odata/sap/API_COMPANYCODE/A_CompanyCode?$top=1';
    } else {
      endpoint = '/CompanyService_GetCompanyInfo';
    }

    try {
      const response = await this.makeRequest(connectionId, endpoint);
      return response.d?.results?.[0] || response.d || response;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Database Sync Methods
  // ============================================================================

  async syncBillToDatabase(connectionId: string, bill: SAPBill): Promise<void> {
    const wellsFee = bill.DocTotal * 0.01; // 1%
    const paymentCostSaved = 35; // SAP typically handles larger enterprise payments
    const netSavings = paymentCostSaved - wellsFee;

    const amountPaid = bill.PaidToDate || 0;
    const isPaid = bill.DocumentStatus === 'C';

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
        line_items,
        raw_data
      ) VALUES (
        ${connectionId},
        ${String(bill.DocEntry)},
        ${bill.CardCode},
        ${String(bill.DocNum) || null},
        ${bill.CardName},
        ${bill.DocTotal},
        ${bill.DocCurrency || 'USD'},
        ${bill.DocDate},
        ${bill.DocDueDate},
        ${isPaid ? 'paid_external' : 'pending'},
        ${isPaid ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid')},
        ${amountPaid},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${bill.Comments || null},
        ${JSON.stringify(bill.DocumentLines || [])},
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

  async syncVendorToDatabase(connectionId: string, vendor: SAPVendor): Promise<void> {
    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        tax_id,
        default_currency,
        is_active,
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.CardCode},
        ${vendor.CardName},
        ${vendor.CardName},
        ${vendor.EmailAddress || null},
        ${vendor.Phone1 || null},
        ${vendor.FederalTaxID || null},
        ${vendor.Currency || 'USD'},
        ${vendor.Valid === 'Y' || vendor.Valid === 'tYES'},
        ${JSON.stringify(vendor)}
      )
      ON CONFLICT (erp_connection_id, external_vendor_id)
      DO UPDATE SET
        vendor_name = EXCLUDED.vendor_name,
        vendor_display_name = EXCLUDED.vendor_display_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  async syncPaymentToDatabase(connectionId: string, payment: SAPPayment): Promise<void> {
    const amount = payment.TransferSum || payment.CashSum || payment.CheckSum || 0;

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
        ${String(payment.DocEntry)},
        ${payment.CardCode},
        ${amount},
        'sap',
        ${payment.DocDate},
        ${payment.JournalRemarks || null},
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
  // Full Sync
  // ============================================================================

  async fullSync(connectionId: string): Promise<{
    billsFound: number;
    vendorsFound: number;
    paymentsFound: number;
  }> {
    // Sync vendors
    const vendors = await this.fetchVendors(connectionId);
    for (const vendor of vendors) {
      await this.syncVendorToDatabase(connectionId, vendor);
    }

    // Sync bills
    const bills = await this.fetchBills(connectionId);
    for (const bill of bills) {
      await this.syncBillToDatabase(connectionId, bill);
    }

    // Sync recent payments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const payments = await this.fetchPayments(connectionId, thirtyDaysAgo);
    for (const payment of payments) {
      await this.syncPaymentToDatabase(connectionId, payment);
    }

    // Update connection sync status
    await sql`
      UPDATE erp_connections
      SET
        last_sync_at = NOW(),
        last_sync_status = 'completed',
        next_sync_at = NOW() + INTERVAL '4 hours',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    return {
      billsFound: bills.length,
      vendorsFound: vendors.length,
      paymentsFound: payments.length,
    };
  }

  // ============================================================================
  // Test Connection
  // ============================================================================

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      await this.getCompanyInfo(connectionId);
      return true;
    } catch (error) {
      console.error('SAP connection test failed:', error);
      return false;
    }
  }
}

export const sap = new SAPService();
