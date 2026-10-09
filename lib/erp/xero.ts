// Xero Integration
// OAuth2 flow + API integration for invoice/supplier interception

import { neon } from '@neondatabase/serverless';
import type { XeroInvoice, XeroContact, XeroPayment, ERPConnection } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const XERO_OAUTH_BASE = 'https://login.xero.com/identity/connect';
const REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'https://wellsai.app/api/erp/xero/callback';

export class XeroService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID || '';
    this.clientSecret = process.env.XERO_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Xero credentials not configured - integration disabled');
    }
  }

  // OAuth2 Flow
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'accounting.transactions accounting.contacts accounting.settings offline_access',
      state,
    });

    return `${XERO_OAUTH_BASE}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch('https://identity.xero.com/connect/token', {
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

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch('https://identity.xero.com/connect/token', {
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

  // Get Tenant IDs (Xero organizations)
  async getTenants(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Xero tenants');
    }

    return response.json();
  }

  private async makeRequest(
    connectionId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: any
  ): Promise<any> {
    // Get connection details
    const [connection] = await sql`
      SELECT access_token, refresh_token, token_expires_at, tenant_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Xero connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(connection.refresh_token);
      accessToken = tokens.access_token;

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

    const url = `${XERO_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'xero-tenant-id': connection.tenant_id,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero API error: ${error}`);
    }

    return response.json();
  }

  // Fetch Invoices (Bills Payable)
  async fetchInvoices(
    connectionId: string,
    type: 'ACCPAY' | 'ACCREC' = 'ACCPAY',
    status?: string
  ): Promise<XeroInvoice[]> {
    let endpoint = `/Invoices?where=Type=="${type}"`;

    if (status) {
      endpoint += `%20AND%20Status=="${status}"`;
    } else {
      // Default to unpaid invoices
      endpoint += `%20AND%20Status=="AUTHORISED"`;
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.Invoices || [];
  }

  // Fetch Invoice by ID
  async fetchInvoice(connectionId: string, invoiceId: string): Promise<XeroInvoice> {
    const response = await this.makeRequest(connectionId, `/Invoices/${invoiceId}`);
    return response.Invoices?.[0];
  }

  // Fetch Contacts (Suppliers)
  async fetchContacts(
    connectionId: string,
    isSupplier: boolean = true
  ): Promise<XeroContact[]> {
    let endpoint = '/Contacts';

    if (isSupplier) {
      endpoint += '?where=IsSupplier==true';
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.Contacts || [];
  }

  // Fetch Contact by ID
  async fetchContact(connectionId: string, contactId: string): Promise<XeroContact> {
    const response = await this.makeRequest(connectionId, `/Contacts/${contactId}`);
    return response.Contacts?.[0];
  }

  // Fetch Payments
  async fetchPayments(connectionId: string, invoiceId?: string): Promise<XeroPayment[]> {
    let endpoint = '/Payments';

    if (invoiceId) {
      endpoint += `?where=Invoice.InvoiceID==Guid("${invoiceId}")`;
    }

    const response = await this.makeRequest(connectionId, endpoint);
    return response.Payments || [];
  }

  // Create Payment
  async createPayment(
    connectionId: string,
    invoiceId: string,
    amount: number,
    paymentDate: Date,
    accountCode: string,
    reference?: string
  ): Promise<XeroPayment> {
    const paymentData = {
      Invoice: {
        InvoiceID: invoiceId,
      },
      Account: {
        Code: accountCode,
      },
      Date: paymentDate.toISOString().split('T')[0],
      Amount: amount,
      Reference: reference || 'Paid via Wells AI',
    };

    const response = await this.makeRequest(connectionId, '/Payments', 'POST', paymentData);
    return response.Payments?.[0];
  }

  // Get Organisation Info
  async getOrganisation(connectionId: string): Promise<any> {
    const response = await this.makeRequest(connectionId, '/Organisation');
    return response.Organisations?.[0];
  }

  // Setup Webhooks
  async createWebhook(connectionId: string, webhookUrl: string): Promise<string> {
    // Xero requires webhook setup through their portal
    // This is a placeholder for the webhook key generation
    const webhookKey = crypto.randomUUID();

    await sql`
      UPDATE erp_connections
      SET
        webhook_id = ${webhookKey},
        webhook_enabled = true,
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    return webhookKey;
  }

  // Verify Webhook Signature
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookKey: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookKey);
    hmac.update(payload);
    const computedSignature = hmac.digest('base64');

    return signature === computedSignature;
  }

  // Process Webhook Event
  async processWebhookEvent(connectionId: string, events: any[]): Promise<void> {
    for (const event of events) {
      const resourceUrl = event.resourceUrl;
      const eventCategory = event.eventCategory; // 'INVOICE', 'CONTACT', 'PAYMENT'
      const eventType = event.eventType; // 'CREATE', 'UPDATE', 'DELETE'

      console.log(`Xero webhook: ${eventType} ${eventCategory} ${resourceUrl}`);

      // Extract ID from resource URL
      const resourceId = resourceUrl.split('/').pop();

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
          'xero',
          ${eventType.toLowerCase() + '.' + eventCategory.toLowerCase()},
          ${resourceId},
          ${eventCategory.toLowerCase()},
          ${JSON.stringify(event)}
        )
      `;

      // Trigger sync for this entity
      if (eventCategory === 'INVOICE' && (eventType === 'CREATE' || eventType === 'UPDATE')) {
        try {
          const invoice = await this.fetchInvoice(connectionId, resourceId);
          if (invoice.Type === 'ACCPAY') {
            await this.syncInvoiceToDatabase(connectionId, invoice);
          }
        } catch (error) {
          console.error('Error syncing invoice from webhook:', error);
        }
      }
    }
  }

  // Sync Invoice to Database
  private async syncInvoiceToDatabase(connectionId: string, invoice: XeroInvoice): Promise<void> {
    if (invoice.Type !== 'ACCPAY') return; // Only bills payable

    const wellsFee = invoice.Total * 0.01; // 1%
    const paymentCostSaved = 25; // Typical wire fee
    const netSavings = paymentCostSaved - wellsFee;

    await sql`
      INSERT INTO erp_bills (
        erp_connection_id,
        external_bill_id,
        external_vendor_id,
        bill_number,
        vendor_name,
        vendor_email,
        total_amount,
        currency,
        bill_date,
        due_date,
        status,
        paid_status,
        amount_paid,
        payment_terms,
        wells_fee_amount,
        payment_cost_saved,
        net_customer_savings,
        line_items,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${invoice.InvoiceID},
        ${invoice.Contact.ContactID},
        ${invoice.InvoiceNumber},
        ${invoice.Contact.Name},
        ${invoice.Contact.EmailAddress || null},
        ${invoice.Total},
        ${invoice.CurrencyCode},
        ${invoice.Date},
        ${invoice.DueDate},
        ${invoice.Status === 'AUTHORISED' ? 'pending' : 'paid_external'},
        ${invoice.Status === 'PAID' ? 'paid' : 'unpaid'},
        ${invoice.AmountPaid},
        ${invoice.Reference || null},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${JSON.stringify(invoice.LineItems || [])},
        ${invoice.Reference || null},
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

  // Sync Contact to Database
  async syncContactToDatabase(connectionId: string, contact: XeroContact): Promise<void> {
    if (!contact.IsSupplier) return; // Only suppliers

    const billingAddress = contact.Addresses?.find(a => a.AddressType === 'POBOX') ||
                          contact.Addresses?.[0];
    const phone = contact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber;

    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
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
        ${contact.ContactID},
        ${contact.Name},
        ${contact.EmailAddress || null},
        ${phone || null},
        ${billingAddress?.AddressLine1 || null},
        ${billingAddress?.AddressLine2 || null},
        ${billingAddress?.City || null},
        ${billingAddress?.Region || null},
        ${billingAddress?.PostalCode || null},
        ${billingAddress?.Country || 'US'},
        ${contact.TaxNumber || null},
        ${contact.ContactStatus === 'ACTIVE'},
        ${JSON.stringify(contact)}
      )
      ON CONFLICT (erp_connection_id, external_vendor_id)
      DO UPDATE SET
        vendor_name = EXCLUDED.vendor_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }
}

export const xero = new XeroService();
