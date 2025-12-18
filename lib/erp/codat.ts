// Codat Integration - Universal Accounting Connector
// One integration to rule them all: QuickBooks, Xero, NetSuite, Sage, and 30+ more

import { neon } from '@neondatabase/serverless';
import type { CodatBill, CodatSupplier } from './types';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

const CODAT_API_BASE = 'https://api.codat.io';

export class CodatService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CODAT_API_KEY || '';

    if (!this.apiKey) {
      console.warn('Codat API key not configured - integration disabled');
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    const url = `${CODAT_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Codat API error: ${error}`);
    }

    return response.json();
  }

  // Create Company in Codat
  async createCompany(name: string, platformType?: string): Promise<{
    id: string;
    name: string;
    platform: string;
    redirect: string;
    created: string;
  }> {
    const response = await this.makeRequest('/companies', 'POST', {
      name,
      platformType,
    });

    return response;
  }

  // Get Link URL for company to connect their accounting platform
  async getLinkUrl(companyId: string): Promise<string> {
    // Generate hosted link
    const response = await this.makeRequest(`/companies/${companyId}/connections`, 'POST', {
      platformKey: undefined, // Let user choose
    });

    return response.linkUrl;
  }

  // Get Company Info
  async getCompany(companyId: string): Promise<any> {
    return this.makeRequest(`/companies/${companyId}`);
  }

  // Get Data Connections (which platform they connected)
  async getConnections(companyId: string): Promise<any[]> {
    const response = await this.makeRequest(`/companies/${companyId}/connections`);
    return response.results || [];
  }

  // Sync Data (refresh from accounting platform)
  async syncData(companyId: string, dataType: string): Promise<void> {
    await this.makeRequest(
      `/companies/${companyId}/data/queue/${dataType}`,
      'POST'
    );
  }

  // Fetch Bills
  async fetchBills(
    companyId: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<{ results: CodatBill[]; pageNumber: number; pageSize: number; totalResults: number }> {
    const response = await this.makeRequest(
      `/companies/${companyId}/data/bills?page=${page}&pageSize=${pageSize}`
    );

    return response;
  }

  // Fetch Bill by ID
  async fetchBill(companyId: string, billId: string): Promise<CodatBill> {
    return this.makeRequest(`/companies/${companyId}/data/bills/${billId}`);
  }

  // Fetch Suppliers
  async fetchSuppliers(
    companyId: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<{ results: CodatSupplier[]; pageNumber: number; pageSize: number; totalResults: number }> {
    const response = await this.makeRequest(
      `/companies/${companyId}/data/suppliers?page=${page}&pageSize=${pageSize}`
    );

    return response;
  }

  // Fetch Supplier by ID
  async fetchSupplier(companyId: string, supplierId: string): Promise<CodatSupplier> {
    return this.makeRequest(`/companies/${companyId}/data/suppliers/${supplierId}`);
  }

  // Fetch Payments (Bill Payments)
  async fetchBillPayments(
    companyId: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<any> {
    const response = await this.makeRequest(
      `/companies/${companyId}/data/billPayments?page=${page}&pageSize=${pageSize}`
    );

    return response;
  }

  // Create Payment
  async createBillPayment(
    companyId: string,
    payment: {
      supplierRef: { id: string };
      accountRef: { id: string };
      totalAmount: number;
      currency: string;
      date: string;
      lines: Array<{
        amount: number;
        links: Array<{
          type: 'Bill';
          id: string;
          amount: number;
        }>;
      }>;
      reference?: string;
    }
  ): Promise<any> {
    return this.makeRequest(
      `/companies/${companyId}/connections/{connectionId}/push/billPayments`,
      'POST',
      payment
    );
  }

  // Get Company Info
  async getCompanyInfo(companyId: string): Promise<any> {
    return this.makeRequest(`/companies/${companyId}/data/info`);
  }

  // Setup Webhooks
  async createWebhook(
    notificationUrl: string,
    eventTypes: string[]
  ): Promise<{ id: string }> {
    const response = await this.makeRequest('/rules', 'POST', {
      type: 'webhook',
      notifiers: {
        webhook: [notificationUrl],
      },
      companyId: '*', // All companies
      dataType: eventTypes, // ['bills', 'suppliers', 'billPayments']
    });

    return response;
  }

  // Process Webhook Event
  async processWebhookEvent(connectionId: string, event: any): Promise<void> {
    const companyId = event.CompanyId;
    const dataType = event.DataType; // 'bills', 'suppliers', 'billPayments'
    const datasetId = event.DatasetId;

    console.log(`Codat webhook: ${dataType} for company ${companyId}`);

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
        'codat',
        ${dataType},
        ${datasetId},
        ${dataType},
        ${JSON.stringify(event)}
      )
    `;

    // Trigger sync based on data type
    if (dataType === 'bills') {
      // Fetch and sync bills
      try {
        const response = await this.fetchBills(companyId);
        for (const bill of response.results) {
          await this.syncBillToDatabase(connectionId, bill);
        }
      } catch (error) {
        console.error('Error syncing bills from webhook:', error);
      }
    }
  }

  // Sync Bill to Database
  async syncBillToDatabase(connectionId: string, bill: CodatBill): Promise<void> {
    const wellsFee = bill.totalAmount * 0.01; // 1%
    const paymentCostSaved = 25; // Typical wire fee
    const netSavings = paymentCostSaved - wellsFee;

    // Determine status
    let status = 'pending';
    let paidStatus = 'unpaid';
    if (bill.status === 'Paid') {
      status = 'paid_external';
      paidStatus = 'paid';
    } else if (bill.status === 'PartiallyPaid') {
      paidStatus = 'partial';
    }

    await sql`
      INSERT INTO erp_bills (
        erp_connection_id,
        external_bill_id,
        external_vendor_id,
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
        ${bill.id},
        ${bill.supplierRef.id},
        ${bill.supplierRef.supplierName},
        ${bill.totalAmount},
        ${bill.currency},
        ${bill.issueDate},
        ${bill.dueDate},
        ${status},
        ${paidStatus},
        ${bill.totalAmount - bill.amountDue},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${JSON.stringify(bill.lineItems || [])},
        ${bill.note || null},
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

  // Sync Supplier to Database
  async syncSupplierToDatabase(connectionId: string, supplier: CodatSupplier): Promise<void> {
    const defaultAddress = supplier.addresses?.[0];

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
        ${supplier.id},
        ${supplier.supplierName},
        ${supplier.contactName || supplier.supplierName},
        ${supplier.emailAddress || null},
        ${supplier.phone || null},
        ${defaultAddress?.line1 || null},
        ${defaultAddress?.line2 || null},
        ${defaultAddress?.city || null},
        ${defaultAddress?.region || null},
        ${defaultAddress?.postalCode || null},
        ${defaultAddress?.country || 'US'},
        ${supplier.taxNumber || null},
        ${supplier.status === 'Active'},
        ${JSON.stringify(supplier)}
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

  // Full Sync for Connection
  async fullSync(connectionId: string, companyId: string): Promise<{
    billsCount: number;
    suppliersCount: number;
    paymentsCount: number;
  }> {
    let billsCount = 0;
    let suppliersCount = 0;
    let paymentsCount = 0;

    // Sync Bills
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const billsResponse = await this.fetchBills(companyId, page);

      for (const bill of billsResponse.results) {
        await this.syncBillToDatabase(connectionId, bill);
        billsCount++;
      }

      hasMore = page < Math.ceil(billsResponse.totalResults / billsResponse.pageSize);
      page++;
    }

    // Sync Suppliers
    page = 1;
    hasMore = true;

    while (hasMore) {
      const suppliersResponse = await this.fetchSuppliers(companyId, page);

      for (const supplier of suppliersResponse.results) {
        await this.syncSupplierToDatabase(connectionId, supplier);
        suppliersCount++;
      }

      hasMore = page < Math.ceil(suppliersResponse.totalResults / suppliersResponse.pageSize);
      page++;
    }

    // Sync Payments
    page = 1;
    hasMore = true;

    while (hasMore) {
      const paymentsResponse = await this.fetchBillPayments(companyId, page);

      paymentsCount += paymentsResponse.results?.length || 0;

      hasMore = page < Math.ceil(paymentsResponse.totalResults / paymentsResponse.pageSize);
      page++;
    }

    return { billsCount, suppliersCount, paymentsCount };
  }
}

export const codat = new CodatService();
