// QuickBooks Online Integration
// OAuth2 flow + API integration for bill/vendor interception

import { neon } from '@neondatabase/serverless';
import type { QBOBill, QBOVendor, QBOPayment, ERPConnection } from './types';

const sql = neon(process.env.DATABASE_URL!);

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QBO_OAUTH_BASE = 'https://oauth.platform.intuit.com/oauth2/v1';
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || 'https://wellsai.app/api/erp/quickbooks/callback';

export class QuickBooksService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID!;
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }
  }

  // OAuth2 Flow
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });

    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    realm_id: string;
  }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${QBO_OAUTH_BASE}/tokens/bearer`, {
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

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      realm_id: data.realmId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${QBO_OAUTH_BASE}/tokens/bearer`, {
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

  private async makeRequest(
    connectionId: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<any> {
    // Get connection details
    const [connection] = await sql`
      SELECT access_token, refresh_token, token_expires_at, realm_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('QuickBooks connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(connection.refresh_token);
      accessToken = tokens.access_token;

      // Update tokens in database
      await sql`
        UPDATE erp_connections
        SET
          access_token = ${tokens.access_token},
          refresh_token = ${tokens.refresh_token},
          token_expires_at = NOW() + INTERVAL '${tokens.expires_in} seconds',
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;
    }

    const url = `${QBO_API_BASE}/${connection.realm_id}${endpoint}`;
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
      throw new Error(`QuickBooks API error: ${error}`);
    }

    return response.json();
  }

  // Fetch Bills (Unpaid Invoices)
  async fetchBills(connectionId: string, startDate?: Date): Promise<QBOBill[]> {
    let query = "SELECT * FROM Bill WHERE Balance > '0'";

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` AND DueDate >= '${dateStr}'`;
    }

    query += " MAXRESULTS 1000";

    const response = await this.makeRequest(
      connectionId,
      `/query?query=${encodeURIComponent(query)}`
    );

    return response.QueryResponse?.Bill || [];
  }

  // Fetch Vendors
  async fetchVendors(connectionId: string): Promise<QBOVendor[]> {
    const query = "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 1000";

    const response = await this.makeRequest(
      connectionId,
      `/query?query=${encodeURIComponent(query)}`
    );

    return response.QueryResponse?.Vendor || [];
  }

  // Fetch Vendor by ID
  async fetchVendor(connectionId: string, vendorId: string): Promise<QBOVendor> {
    const response = await this.makeRequest(
      connectionId,
      `/vendor/${vendorId}`
    );

    return response.Vendor;
  }

  // Fetch Bill by ID
  async fetchBill(connectionId: string, billId: string): Promise<QBOBill> {
    const response = await this.makeRequest(
      connectionId,
      `/bill/${billId}`
    );

    return response.Bill;
  }

  // Fetch Payments
  async fetchPayments(connectionId: string, startDate?: Date): Promise<QBOPayment[]> {
    let query = "SELECT * FROM BillPayment";

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` WHERE TxnDate >= '${dateStr}'`;
    }

    query += " MAXRESULTS 1000";

    const response = await this.makeRequest(
      connectionId,
      `/query?query=${encodeURIComponent(query)}`
    );

    return response.QueryResponse?.BillPayment || [];
  }

  // Create Payment (through Wells)
  async createPayment(
    connectionId: string,
    billId: string,
    amount: number,
    paymentDate: Date,
    bankAccountId: string,
    memo?: string
  ): Promise<QBOPayment> {
    const paymentData = {
      VendorRef: {
        value: billId, // This should be vendor ID
      },
      TotalAmt: amount,
      TxnDate: paymentDate.toISOString().split('T')[0],
      PayType: 'Check', // Or 'CreditCard'
      PrivateNote: memo || 'Paid via Wells AI',
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: billId,
              TxnType: 'Bill',
            },
          ],
        },
      ],
      APAccountRef: {
        value: bankAccountId,
      },
    };

    const response = await this.makeRequest(
      connectionId,
      '/billpayment',
      'POST',
      paymentData
    );

    return response.BillPayment;
  }

  // Get Company Info
  async getCompanyInfo(connectionId: string): Promise<any> {
    const response = await this.makeRequest(connectionId, '/companyinfo/1');
    return response.CompanyInfo;
  }

  // Webhook Verification
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const computedSignature = hmac.digest('base64');

    return signature === computedSignature;
  }

  // Process Webhook Event
  async processWebhookEvent(connectionId: string, event: any): Promise<void> {
    const eventNotifications = event.eventNotifications || [];

    for (const notification of eventNotifications) {
      const realmId = notification.realmId;
      const dataChangeEvent = notification.dataChangeEvent;

      for (const entity of dataChangeEvent.entities) {
        const entityName = entity.name; // 'Bill', 'Vendor', 'BillPayment'
        const entityId = entity.id;
        const operation = entity.operation; // 'Create', 'Update', 'Delete'

        console.log(`QuickBooks webhook: ${operation} ${entityName} ${entityId}`);

        // Log webhook event
        await sql`
          INSERT INTO erp_webhook_events (
            erp_connection_id,
            provider,
            event_type,
            external_entity_id,
            entity_type,
            payload
          ) VALUES (
            ${connectionId},
            'quickbooks',
            ${operation.toLowerCase() + '.' + entityName.toLowerCase()},
            ${entityId},
            ${entityName.toLowerCase()},
            ${JSON.stringify(entity)}
          )
        `;

        // Trigger sync for this entity
        if (entityName === 'Bill' && (operation === 'Create' || operation === 'Update')) {
          // Fetch and sync this specific bill
          try {
            const bill = await this.fetchBill(connectionId, entityId);
            await this.syncBillToDatabase(connectionId, bill);
          } catch (error) {
            console.error('Error syncing bill from webhook:', error);
          }
        }
      }
    }
  }

  // Sync Bill to Database
  private async syncBillToDatabase(connectionId: string, bill: QBOBill): Promise<void> {
    const wellsFee = bill.TotalAmt * 0.01; // 1%
    const paymentCostSaved = 25; // Typical wire fee
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
        line_items,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${bill.Id},
        ${bill.VendorRef.value},
        ${bill.DocNumber || null},
        ${bill.VendorRef.name},
        ${bill.TotalAmt},
        'USD',
        ${bill.TxnDate},
        ${bill.DueDate},
        ${bill.Balance > 0 ? 'pending' : 'paid_external'},
        ${bill.Balance > 0 ? 'unpaid' : 'paid'},
        ${bill.TotalAmt - bill.Balance},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${JSON.stringify(bill.Line || [])},
        ${bill.PrivateNote || null},
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

  // Sync Vendor to Database
  async syncVendorToDatabase(connectionId: string, vendor: QBOVendor): Promise<void> {
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
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.Id},
        ${vendor.CompanyName || vendor.DisplayName},
        ${vendor.DisplayName},
        ${vendor.PrimaryEmailAddr?.Address || null},
        ${vendor.PrimaryPhone?.FreeFormNumber || null},
        ${vendor.BillAddr?.Line1 || null},
        ${vendor.BillAddr?.Line2 || null},
        ${vendor.BillAddr?.City || null},
        ${vendor.BillAddr?.CountrySubDivisionCode || null},
        ${vendor.BillAddr?.PostalCode || null},
        ${vendor.BillAddr?.Country || 'US'},
        ${vendor.TaxIdentifier || null},
        ${vendor.Active},
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
}

export const quickbooks = new QuickBooksService();
