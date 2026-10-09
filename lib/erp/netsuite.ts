// NetSuite ERP Integration
// OAuth 1.0 Token-Based Authentication + REST API / SuiteQL integration
// Bridges treasury-sdk NetSuite adapter with production ERP flow

import { neon } from '@neondatabase/serverless';
import * as crypto from 'crypto';
import type { ERPConnection, ERPBill, ERPVendor, ERPPayment } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// NetSuite REST API endpoints
const NETSUITE_REST_BASE = (accountId: string) =>
  `https://${accountId.toLowerCase().replace('_', '-')}.suitetalk.api.netsuite.com/services/rest/record/v1`;
const NETSUITE_SUITEQL_BASE = (accountId: string) =>
  `https://${accountId.toLowerCase().replace('_', '-')}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;
const NETSUITE_OAUTH_BASE = 'https://system.netsuite.com/app/login/oauth2';

const REDIRECT_URI = process.env.NETSUITE_REDIRECT_URI || 'https://wellsai.app/api/erp/netsuite/callback';

// NetSuite Bill record structure
interface NetSuiteBill {
  id: string;
  tranId: string;
  entity: string;
  entityName?: string;
  tranDate: string;
  dueDate: string;
  total: number;
  amountRemaining: number;
  status: string;
  currency?: string;
  memo?: string;
}

// NetSuite Vendor record structure
interface NetSuiteVendor {
  id: string;
  entityId: string;
  companyName: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  currency?: string;
  terms?: string;
  isInactive: string;
}

// NetSuite Payment record structure
interface NetSuitePayment {
  id: string;
  tranId: string;
  entity: string;
  tranDate: string;
  account: string;
  total: number;
  status: string;
  memo?: string;
}

export class NetSuiteService {
  private consumerKey: string;
  private consumerSecret: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    // OAuth 1.0 TBA credentials
    this.consumerKey = process.env.NETSUITE_CONSUMER_KEY || '';
    this.consumerSecret = process.env.NETSUITE_CONSUMER_SECRET || '';
    // OAuth 2.0 credentials (for initial authorization)
    this.clientId = process.env.NETSUITE_CLIENT_ID || '';
    this.clientSecret = process.env.NETSUITE_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('NetSuite OAuth2 credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAuth 2.0 Flow (for initial authorization)
  // ============================================================================

  getAuthorizationUrl(state: string, accountId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'restlets rest_webservices',
      state,
    });

    // NetSuite OAuth 2.0 authorization URL
    return `https://${accountId}.app.netsuite.com/app/login/oauth2/authorize.nl?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, accountId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
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

  async refreshAccessToken(refreshToken: string, accountId: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
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
  // OAuth 1.0 TBA Helpers (for API requests)
  // ============================================================================

  private generateOAuthSignature(
    method: string,
    url: string,
    oauthParams: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string
  ): string {
    // Sort and encode parameters
    const sortedParams = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    // Build base string
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url.split('?')[0]),
      encodeURIComponent(sortedParams),
    ].join('&');

    // Generate signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

    // Generate signature
    return crypto
      .createHmac('sha256', signingKey)
      .update(baseString)
      .digest('base64');
  }

  private buildOAuthHeader(
    method: string,
    url: string,
    accountId: string,
    tokenId: string,
    tokenSecret: string
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_token: tokenId,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      realm: accountId,
    };

    // Generate signature
    const signature = this.generateOAuthSignature(
      method,
      url,
      oauthParams,
      this.consumerSecret,
      tokenSecret
    );
    oauthParams.oauth_signature = signature;

    // Build Authorization header
    return 'OAuth ' + Object.entries(oauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(', ');
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
        realm_id as account_id,
        token_id,
        token_secret
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('NetSuite connection not found');
    }

    const accountId = connection.account_id;
    let accessToken = connection.access_token;

    // Check if token needs refresh (OAuth 2.0)
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(connection.refresh_token, accountId);
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

    const baseUrl = NETSUITE_REST_BASE(accountId);
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NetSuite API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  private async executeSuiteQL(
    connectionId: string,
    query: string,
    limit: number = 1000,
    offset: number = 0
  ): Promise<{ items: any[]; hasMore: boolean; totalResults: number }> {
    const [connection] = await sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at,
        realm_id as account_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('NetSuite connection not found');
    }

    const accountId = connection.account_id;
    let accessToken = connection.access_token;

    // Token refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(connection.refresh_token, accountId);
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

    const url = `${NETSUITE_SUITEQL_BASE(accountId)}?limit=${limit}&offset=${offset}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'transient',
      },
      body: JSON.stringify({ q: query }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SuiteQL error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      items: data.items || [],
      hasMore: data.hasMore || false,
      totalResults: data.totalResults || 0,
    };
  }

  // ============================================================================
  // Bill/Invoice Methods
  // ============================================================================

  async fetchBills(connectionId: string, startDate?: Date): Promise<NetSuiteBill[]> {
    let query = `
      SELECT
        t.id,
        t.tranId,
        t.entity,
        v.companyName as entityName,
        t.tranDate,
        t.dueDate,
        t.total,
        t.amountRemaining,
        t.status,
        t.memo
      FROM transaction t
      INNER JOIN vendor v ON t.entity = v.id
      WHERE t.type = 'VendBill'
      AND t.amountRemaining > 0
    `;

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` AND t.dueDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`;
    }

    query += ` ORDER BY t.dueDate FETCH FIRST 1000 ROWS ONLY`;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items as NetSuiteBill[];
  }

  async fetchBill(connectionId: string, billId: string): Promise<NetSuiteBill | null> {
    const query = `
      SELECT
        t.id,
        t.tranId,
        t.entity,
        v.companyName as entityName,
        t.tranDate,
        t.dueDate,
        t.total,
        t.amountRemaining,
        t.status,
        t.memo
      FROM transaction t
      INNER JOIN vendor v ON t.entity = v.id
      WHERE t.id = ${billId}
      AND t.type = 'VendBill'
    `;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items[0] || null;
  }

  // ============================================================================
  // Vendor Methods
  // ============================================================================

  async fetchVendors(connectionId: string): Promise<NetSuiteVendor[]> {
    const query = `
      SELECT
        v.id,
        v.entityId,
        v.companyName,
        v.email,
        v.phone,
        v.taxNumber,
        v.currency,
        v.terms,
        v.isInactive
      FROM vendor v
      WHERE v.isInactive = 'F'
      ORDER BY v.companyName
      FETCH FIRST 1000 ROWS ONLY
    `;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items as NetSuiteVendor[];
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<NetSuiteVendor | null> {
    const query = `
      SELECT
        v.id,
        v.entityId,
        v.companyName,
        v.email,
        v.phone,
        v.taxNumber,
        v.currency,
        v.terms,
        v.isInactive
      FROM vendor v
      WHERE v.id = ${vendorId}
    `;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items[0] || null;
  }

  // ============================================================================
  // Payment Methods
  // ============================================================================

  async fetchPayments(connectionId: string, startDate?: Date): Promise<NetSuitePayment[]> {
    let query = `
      SELECT
        t.id,
        t.tranId,
        t.entity,
        t.tranDate,
        t.account,
        t.total,
        t.status,
        t.memo
      FROM transaction t
      WHERE t.type = 'VendPymt'
    `;

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` AND t.tranDate >= TO_DATE('${dateStr}', 'YYYY-MM-DD')`;
    }

    query += ` ORDER BY t.tranDate DESC FETCH FIRST 1000 ROWS ONLY`;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items as NetSuitePayment[];
  }

  async createPayment(
    connectionId: string,
    vendorId: string,
    billId: string,
    amount: number,
    paymentDate: Date,
    bankAccountId: string,
    memo?: string
  ): Promise<NetSuitePayment> {
    const paymentData = {
      entity: { id: vendorId },
      tranDate: paymentDate.toISOString().split('T')[0],
      account: { id: bankAccountId },
      memo: memo || 'Paid via Wells AI',
      applyList: {
        apply: [{
          doc: { id: billId },
          amount: amount,
          apply: true,
        }]
      },
    };

    const response = await this.makeRequest(
      connectionId,
      '/vendorPayment',
      'POST',
      paymentData
    );

    return {
      id: response.id,
      tranId: response.tranId || '',
      entity: vendorId,
      tranDate: paymentDate.toISOString(),
      account: bankAccountId,
      total: amount,
      status: 'completed',
      memo: memo,
    };
  }

  // ============================================================================
  // Company Info
  // ============================================================================

  async getCompanyInfo(connectionId: string): Promise<any> {
    const query = `
      SELECT
        c.companyName,
        c.country,
        c.currency
      FROM company c
      FETCH FIRST 1 ROWS ONLY
    `;

    const result = await this.executeSuiteQL(connectionId, query);
    return result.items[0] || null;
  }

  // ============================================================================
  // Database Sync Methods
  // ============================================================================

  async syncBillToDatabase(connectionId: string, bill: NetSuiteBill): Promise<void> {
    const wellsFee = bill.total * 0.01; // 1%
    const paymentCostSaved = 30; // Typical wire fee for larger payments
    const netSavings = paymentCostSaved - wellsFee;

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
        ${bill.id},
        ${bill.entity},
        ${bill.tranId || null},
        ${bill.entityName || 'Unknown Vendor'},
        ${bill.total},
        ${'USD'},
        ${bill.tranDate},
        ${bill.dueDate},
        ${bill.amountRemaining > 0 ? 'pending' : 'paid_external'},
        ${bill.amountRemaining > 0 ? 'unpaid' : 'paid'},
        ${bill.total - bill.amountRemaining},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${bill.memo || null},
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

  async syncVendorToDatabase(connectionId: string, vendor: NetSuiteVendor): Promise<void> {
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
        payment_terms,
        is_active,
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.id},
        ${vendor.companyName || vendor.entityId},
        ${vendor.companyName},
        ${vendor.email || null},
        ${vendor.phone || null},
        ${vendor.taxNumber || null},
        ${vendor.currency || 'USD'},
        ${vendor.terms || null},
        ${vendor.isInactive === 'F'},
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

  async syncPaymentToDatabase(connectionId: string, payment: NetSuitePayment): Promise<void> {
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
        ${payment.id},
        ${payment.entity},
        ${payment.total},
        'netsuite',
        ${payment.tranDate},
        ${payment.memo || null},
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
      const query = 'SELECT COUNT(*) as count FROM vendor WHERE ROWNUM <= 1';
      await this.executeSuiteQL(connectionId, query);
      return true;
    } catch (error) {
      console.error('NetSuite connection test failed:', error);
      return false;
    }
  }
}

export const netsuite = new NetSuiteService();
