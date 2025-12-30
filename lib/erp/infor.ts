// Infor ERP Integration
// OAuth 2.0 via ION API Gateway + REST API integration
// Supports: CloudSuite Financials (CSF), LN Finance, M3, SyteLine

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// Infor Product Variants
export type InforProduct = 'csf' | 'lnfin' | 'm3' | 'syteline';

// ION API Gateway endpoints
const ION_AUTH_URL = (ionHost: string) => `https://${ionHost}/as/authorization.oauth2`;
const ION_TOKEN_URL = (ionHost: string) => `https://${ionHost}/as/token.oauth2`;
const ION_API_URL = (ionHost: string) => `https://${ionHost}/api`;

const REDIRECT_URI = process.env.INFOR_REDIRECT_URI || 'https://wellsai.app/api/erp/infor/callback';

// ============================================================================
// INFOR TYPE DEFINITIONS
// ============================================================================

// CloudSuite Financials (CSF) Types
interface CSFVendor {
  VendorNumber: string;
  VendorName: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  TaxId?: string;
  CurrencyCode: string;
  PaymentTerms?: string;
  Status: 'Active' | 'Inactive' | 'Hold';
  BankAccountNumber?: string;
  BankRoutingNumber?: string;
  BankSwiftCode?: string;
  BankIBAN?: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  StateProvince?: string;
  PostalCode?: string;
  Country?: string;
  LastModifiedDate?: string;
}

interface CSFInvoice {
  InvoiceId: string;
  InvoiceNumber: string;
  VendorNumber: string;
  VendorName: string;
  InvoiceAmount: number;
  CurrencyCode: string;
  InvoiceDate: string;
  DueDate: string;
  PaymentStatus: 'Open' | 'Partial' | 'Paid' | 'Void';
  AmountPaid: number;
  AmountRemaining: number;
  PurchaseOrderNumber?: string;
  Description?: string;
  CompanyId?: string;
}

interface CSFPayment {
  PaymentId: string;
  PaymentNumber?: string;
  VendorNumber: string;
  PaymentAmount: number;
  CurrencyCode: string;
  PaymentDate: string;
  PaymentMethod: string;
  PaymentStatus: string;
  BankAccountId?: string;
  ReferenceNumber?: string;
  CheckNumber?: string;
}

// LN Finance Types
interface LNVendor {
  BusinessPartner: string;
  Name: string;
  Email?: string;
  Phone?: string;
  TaxRegistrationNumber?: string;
  Currency?: string;
  PaymentMethod?: string;
  Status: number;  // 1 = Active, 2 = Blocked
  BankAccount?: string;
  IBAN?: string;
  BIC?: string;
}

interface LNInvoice {
  Invoice: string;
  TransactionNumber: string;
  BusinessPartner: string;
  BusinessPartnerName?: string;
  InvoiceAmount: number;
  Currency: string;
  InvoiceDate: string;
  DueDate: string;
  Status: number;  // 1 = Open, 2 = Partially Paid, 3 = Paid
  PaidAmount: number;
  OpenAmount: number;
  Description?: string;
}

interface LNPayment {
  PaymentDocument: string;
  BusinessPartner: string;
  Amount: number;
  Currency: string;
  PaymentDate: string;
  PaymentMethod: string;
  BankReference?: string;
  Status: number;
}

// M3 Types
interface M3Vendor {
  SUNO: string;           // Supplier Number
  SUNM: string;           // Supplier Name
  PHNO?: string;          // Phone
  EMAL?: string;          // Email
  VRNO?: string;          // VAT Registration Number
  CUCD?: string;          // Currency Code
  TEPY?: string;          // Terms of Payment
  STAT: string;           // Status: 20 = Active
  BKAC?: string;          // Bank Account
  IBAN?: string;
  SPTS?: string;          // Swift Code
}

interface M3Invoice {
  SUNO: string;           // Supplier Number
  SINO: string;           // Supplier Invoice Number
  IVAM: number;           // Invoice Amount
  CUCD: string;           // Currency Code
  IVDT: string;           // Invoice Date
  DUDT: string;           // Due Date
  PYST: string;           // Payment Status
  PAAM: number;           // Paid Amount
  OPAM: number;           // Open Amount
  PUNO?: string;          // Purchase Order Number
  VTXT?: string;          // Voucher Text
}

interface M3Payment {
  PPYN: string;           // Payment Proposal Number
  SUNO: string;           // Supplier Number
  PYAM: number;           // Payment Amount
  CUCD: string;           // Currency Code
  PYDT: string;           // Payment Date
  PMTP: string;           // Payment Method
  BKRF?: string;          // Bank Reference
  PYST: string;           // Payment Status
}

// SyteLine Types
interface SyteLineVendor {
  VendNum: string;
  VendName: string;
  Email?: string;
  Phone?: string;
  TaxRegNum?: string;
  CurrCode: string;
  PaymentTerms?: string;
  VendStatus: string;
  BankAcct?: string;
  RoutingNum?: string;
}

interface SyteLineVoucher {
  Voucher: string;
  VendNum: string;
  VendName?: string;
  VouchAmt: number;
  CurrCode: string;
  InvDate: string;
  DueDate: string;
  Status: string;
  AmtPaid: number;
  AmtOpen: number;
  PoNum?: string;
  Description?: string;
}

interface SyteLinePayment {
  CheckNum: string;
  VendNum: string;
  CheckAmt: number;
  CurrCode: string;
  CheckDate: string;
  PayMethod: string;
  BankCode?: string;
  RefNum?: string;
}

// Unified Infor types for internal use
type InforVendor = CSFVendor | LNVendor | M3Vendor | SyteLineVendor;
type InforBill = CSFInvoice | LNInvoice | M3Invoice | SyteLineVoucher;
type InforPayment = CSFPayment | LNPayment | M3Payment | SyteLinePayment;

// ============================================================================
// INFOR SERVICE CLASS
// ============================================================================

export class InforService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.INFOR_CLIENT_ID || '';
    this.clientSecret = process.env.INFOR_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Infor ION credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAUTH 2.0 VIA ION API GATEWAY
  // ============================================================================

  /**
   * Generate ION OAuth2 authorization URL
   * @param state - Base64 encoded state parameter containing companyId, product, and logicalId
   * @param ionHost - ION API Gateway host (e.g., 'mingle-ionapi.inforcloudsuite.com')
   * @param tenantId - Infor tenant ID
   * @param product - Infor product variant (csf, lnfin, m3, syteline)
   * @param logicalId - Logical ID for routing requests to correct backend
   */
  getAuthorizationUrl(
    state: string,
    ionHost: string,
    tenantId: string,
    product: InforProduct,
    logicalId: string
  ): string {
    // ION API uses standard OAuth 2.0 authorization code flow
    const scope = this.getScopeForProduct(product);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope,
      state,
      tenant: tenantId,
    });

    return `${ION_AUTH_URL(ionHost)}?${params.toString()}`;
  }

  /**
   * Get appropriate OAuth scope based on Infor product
   */
  private getScopeForProduct(product: InforProduct): string {
    switch (product) {
      case 'csf':
        return 'Financials.Supplier.Read Financials.Invoice.Read Financials.Invoice.Write Financials.Payment.Read Financials.Payment.Write';
      case 'lnfin':
        return 'LN.SupplierMaster.Read LN.PurchaseInvoice.Read LN.Payment.Read LN.Payment.Write';
      case 'm3':
        return 'M3.Supplier.Read M3.SupplierInvoice.Read M3.Payment.Read M3.Payment.Write';
      case 'syteline':
        return 'SyteLine.Vendor.Read SyteLine.Voucher.Read SyteLine.Payment.Read SyteLine.Payment.Write';
      default:
        return 'Financials.Supplier.Read Financials.Invoice.Read Financials.Payment.Read Financials.Payment.Write';
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens via ION
   */
  async exchangeCodeForTokens(
    code: string,
    ionHost: string,
    tenantId: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const tokenUrl = ION_TOKEN_URL(ionHost);
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
        tenant: tenantId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh expired access token via ION
   */
  async refreshAccessToken(
    refreshToken: string,
    ionHost: string,
    tenantId: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const tokenUrl = ION_TOKEN_URL(ionHost);
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
        tenant: tenantId,
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

  /**
   * Make authenticated request to Infor via ION API Gateway
   */
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
        infor_ion_host,
        infor_tenant_id,
        infor_product,
        infor_logical_id,
        infor_company_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Infor connection not found');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        connection.infor_ion_host,
        connection.infor_tenant_id
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

    // Build URL based on product and logical ID
    const baseUrl = this.getBaseUrlForProduct(
      connection.infor_ion_host,
      connection.infor_product as InforProduct,
      connection.infor_logical_id
    );
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-infor-companynumber': connection.infor_company_id || '',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Infor API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  /**
   * Get API base URL based on product variant
   */
  private getBaseUrlForProduct(ionHost: string, product: InforProduct, logicalId: string): string {
    const baseIonUrl = ION_API_URL(ionHost);

    switch (product) {
      case 'csf':
        return `${baseIonUrl}/${logicalId}/FSM/v1`;
      case 'lnfin':
        return `${baseIonUrl}/${logicalId}/LN/v1`;
      case 'm3':
        return `${baseIonUrl}/${logicalId}/M3/v1`;
      case 'syteline':
        return `${baseIonUrl}/${logicalId}/SyteLine/v1`;
      default:
        return `${baseIonUrl}/${logicalId}/FSM/v1`;
    }
  }

  // ============================================================================
  // VENDOR OPERATIONS
  // ============================================================================

  async fetchVendors(connectionId: string, limit: number = 100): Promise<InforVendor[]> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;

    switch (product) {
      case 'csf': {
        const response = await this.makeRequest(
          connectionId,
          `/suppliers?$top=${limit}&$filter=Status eq 'Active'`
        );
        return (response.value || response.items || []) as CSFVendor[];
      }
      case 'lnfin': {
        const response = await this.makeRequest(
          connectionId,
          `/businesspartners?$top=${limit}&$filter=Status eq 1`
        );
        return (response.value || response.items || []) as LNVendor[];
      }
      case 'm3': {
        const response = await this.makeRequest(
          connectionId,
          `/suppliers?maxRecords=${limit}&STAT=20`
        );
        return (response.results || response.records || []) as M3Vendor[];
      }
      case 'syteline': {
        const response = await this.makeRequest(
          connectionId,
          `/vendors?$top=${limit}&$filter=VendStatus eq 'A'`
        );
        return (response.value || response.items || []) as SyteLineVendor[];
      }
      default:
        return [];
    }
  }

  async fetchVendor(connectionId: string, vendorId: string): Promise<InforVendor | null> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;

    try {
      switch (product) {
        case 'csf': {
          const response = await this.makeRequest(
            connectionId,
            `/suppliers('${vendorId}')`
          );
          return response as CSFVendor;
        }
        case 'lnfin': {
          const response = await this.makeRequest(
            connectionId,
            `/businesspartners('${vendorId}')`
          );
          return response as LNVendor;
        }
        case 'm3': {
          const response = await this.makeRequest(
            connectionId,
            `/suppliers?SUNO=${vendorId}`
          );
          return (response.results?.[0] || response.records?.[0]) as M3Vendor;
        }
        case 'syteline': {
          const response = await this.makeRequest(
            connectionId,
            `/vendors('${vendorId}')`
          );
          return response as SyteLineVendor;
        }
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to fetch vendor ${vendorId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // BILL/INVOICE OPERATIONS
  // ============================================================================

  async fetchBills(
    connectionId: string,
    filters?: {
      status?: string;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      limit?: number;
    }
  ): Promise<InforBill[]> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;
    const limit = filters?.limit || 100;

    switch (product) {
      case 'csf': {
        let filterParts: string[] = ["PaymentStatus ne 'Paid'"];
        if (filters?.dueDateFrom) {
          filterParts.push(`DueDate ge ${filters.dueDateFrom.toISOString()}`);
        }
        if (filters?.dueDateTo) {
          filterParts.push(`DueDate le ${filters.dueDateTo.toISOString()}`);
        }
        const filterStr = filterParts.join(' and ');
        const response = await this.makeRequest(
          connectionId,
          `/invoices?$top=${limit}&$filter=${encodeURIComponent(filterStr)}&$orderby=DueDate`
        );
        return (response.value || response.items || []) as CSFInvoice[];
      }
      case 'lnfin': {
        let filterParts: string[] = ['Status ne 3']; // Not paid
        if (filters?.dueDateFrom) {
          filterParts.push(`DueDate ge ${filters.dueDateFrom.toISOString()}`);
        }
        const filterStr = filterParts.join(' and ');
        const response = await this.makeRequest(
          connectionId,
          `/purchaseinvoices?$top=${limit}&$filter=${encodeURIComponent(filterStr)}`
        );
        return (response.value || response.items || []) as LNInvoice[];
      }
      case 'm3': {
        // M3 uses different query format
        let params = `maxRecords=${limit}&PYST=10`; // Open status
        if (filters?.dueDateFrom) {
          const dateStr = filters.dueDateFrom.toISOString().split('T')[0].replace(/-/g, '');
          params += `&DUDT>=${dateStr}`;
        }
        const response = await this.makeRequest(
          connectionId,
          `/supplierinvoices?${params}`
        );
        return (response.results || response.records || []) as M3Invoice[];
      }
      case 'syteline': {
        let filterParts: string[] = ["Status ne 'P'"]; // Not paid
        if (filters?.dueDateFrom) {
          filterParts.push(`DueDate ge ${filters.dueDateFrom.toISOString()}`);
        }
        const filterStr = filterParts.join(' and ');
        const response = await this.makeRequest(
          connectionId,
          `/vouchers?$top=${limit}&$filter=${encodeURIComponent(filterStr)}`
        );
        return (response.value || response.items || []) as SyteLineVoucher[];
      }
      default:
        return [];
    }
  }

  async fetchBill(connectionId: string, billId: string): Promise<InforBill | null> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;

    try {
      switch (product) {
        case 'csf': {
          const response = await this.makeRequest(
            connectionId,
            `/invoices('${billId}')`
          );
          return response as CSFInvoice;
        }
        case 'lnfin': {
          const response = await this.makeRequest(
            connectionId,
            `/purchaseinvoices('${billId}')`
          );
          return response as LNInvoice;
        }
        case 'm3': {
          const response = await this.makeRequest(
            connectionId,
            `/supplierinvoices?SINO=${billId}`
          );
          return (response.results?.[0] || response.records?.[0]) as M3Invoice;
        }
        case 'syteline': {
          const response = await this.makeRequest(
            connectionId,
            `/vouchers('${billId}')`
          );
          return response as SyteLineVoucher;
        }
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to fetch bill ${billId}:`, error);
      return null;
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
  ): Promise<InforPayment[]> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;
    const limit = filters?.limit || 100;

    switch (product) {
      case 'csf': {
        let filterParts: string[] = [];
        if (filters?.dateFrom) {
          filterParts.push(`PaymentDate ge ${filters.dateFrom.toISOString()}`);
        }
        if (filters?.dateTo) {
          filterParts.push(`PaymentDate le ${filters.dateTo.toISOString()}`);
        }
        const filterStr = filterParts.length > 0 ? `&$filter=${encodeURIComponent(filterParts.join(' and '))}` : '';
        const response = await this.makeRequest(
          connectionId,
          `/payments?$top=${limit}${filterStr}&$orderby=PaymentDate desc`
        );
        return (response.value || response.items || []) as CSFPayment[];
      }
      case 'lnfin': {
        let filterParts: string[] = [];
        if (filters?.dateFrom) {
          filterParts.push(`PaymentDate ge ${filters.dateFrom.toISOString()}`);
        }
        const filterStr = filterParts.length > 0 ? `&$filter=${encodeURIComponent(filterParts.join(' and '))}` : '';
        const response = await this.makeRequest(
          connectionId,
          `/payments?$top=${limit}${filterStr}`
        );
        return (response.value || response.items || []) as LNPayment[];
      }
      case 'm3': {
        let params = `maxRecords=${limit}`;
        if (filters?.dateFrom) {
          const dateStr = filters.dateFrom.toISOString().split('T')[0].replace(/-/g, '');
          params += `&PYDT>=${dateStr}`;
        }
        const response = await this.makeRequest(
          connectionId,
          `/payments?${params}`
        );
        return (response.results || response.records || []) as M3Payment[];
      }
      case 'syteline': {
        let filterParts: string[] = [];
        if (filters?.dateFrom) {
          filterParts.push(`CheckDate ge ${filters.dateFrom.toISOString()}`);
        }
        const filterStr = filterParts.length > 0 ? `&$filter=${encodeURIComponent(filterParts.join(' and '))}` : '';
        const response = await this.makeRequest(
          connectionId,
          `/payments?$top=${limit}${filterStr}`
        );
        return (response.value || response.items || []) as SyteLinePayment[];
      }
      default:
        return [];
    }
  }

  async createPayment(
    connectionId: string,
    vendorId: string,
    invoiceId: string,
    amount: number,
    paymentDate: Date,
    reference?: string
  ): Promise<InforPayment> {
    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;
    const dateStr = paymentDate.toISOString().split('T')[0];

    switch (product) {
      case 'csf': {
        const paymentData = {
          VendorNumber: vendorId,
          PaymentAmount: amount,
          CurrencyCode: 'USD',
          PaymentDate: dateStr,
          PaymentMethod: 'EFT',
          ReferenceNumber: reference || `WELLS-${Date.now()}`,
          InvoiceApplications: [
            {
              InvoiceId: invoiceId,
              AmountApplied: amount,
            }
          ],
        };

        const response = await this.makeRequest(
          connectionId,
          '/payments',
          'POST',
          paymentData
        );

        return response as CSFPayment;
      }
      case 'lnfin': {
        const paymentData = {
          BusinessPartner: vendorId,
          Amount: amount,
          Currency: 'USD',
          PaymentDate: dateStr,
          PaymentMethod: 'Transfer',
          BankReference: reference || `WELLS-${Date.now()}`,
          InvoiceAllocations: [
            {
              Invoice: invoiceId,
              AllocatedAmount: amount,
            }
          ],
        };

        const response = await this.makeRequest(
          connectionId,
          '/payments',
          'POST',
          paymentData
        );

        return response as LNPayment;
      }
      case 'm3': {
        // M3 uses a different API structure
        const paymentData = {
          SUNO: vendorId,
          PYAM: amount,
          CUCD: 'USD',
          PYDT: dateStr.replace(/-/g, ''),
          PMTP: '10', // Electronic transfer
          BKRF: reference || `WELLS-${Date.now()}`,
          InvoiceDetails: [
            {
              SINO: invoiceId,
              PAAM: amount,
            }
          ],
        };

        const response = await this.makeRequest(
          connectionId,
          '/payments',
          'POST',
          paymentData
        );

        return response as M3Payment;
      }
      case 'syteline': {
        const paymentData = {
          VendNum: vendorId,
          CheckAmt: amount,
          CurrCode: 'USD',
          CheckDate: dateStr,
          PayMethod: 'EFT',
          RefNum: reference || `WELLS-${Date.now()}`,
          VoucherApplications: [
            {
              Voucher: invoiceId,
              AmtApplied: amount,
            }
          ],
        };

        const response = await this.makeRequest(
          connectionId,
          '/payments',
          'POST',
          paymentData
        );

        return response as SyteLinePayment;
      }
      default:
        throw new Error(`Unsupported Infor product: ${product}`);
    }
  }

  // ============================================================================
  // DATABASE SYNC METHODS
  // ============================================================================

  async syncVendorToDatabase(connectionId: string, vendor: InforVendor, product: InforProduct): Promise<void> {
    // Normalize vendor data across products
    const normalizedVendor = this.normalizeVendor(vendor, product);

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
        ${normalizedVendor.id},
        ${normalizedVendor.name},
        ${normalizedVendor.displayName},
        ${normalizedVendor.email || null},
        ${normalizedVendor.phone || null},
        ${normalizedVendor.taxId || null},
        ${normalizedVendor.isActive},
        ${normalizedVendor.currency || 'USD'},
        ${normalizedVendor.paymentTerms || null},
        ${normalizedVendor.bankAccount || null},
        ${normalizedVendor.routingNumber || null},
        ${JSON.stringify(vendor)}
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
  }

  private normalizeVendor(vendor: InforVendor, product: InforProduct): {
    id: string;
    name: string;
    displayName: string;
    email?: string;
    phone?: string;
    taxId?: string;
    isActive: boolean;
    currency?: string;
    paymentTerms?: string;
    bankAccount?: string;
    routingNumber?: string;
  } {
    switch (product) {
      case 'csf': {
        const v = vendor as CSFVendor;
        return {
          id: v.VendorNumber,
          name: v.VendorName,
          displayName: v.VendorNumber,
          email: v.EmailAddress,
          phone: v.PhoneNumber,
          taxId: v.TaxId,
          isActive: v.Status === 'Active',
          currency: v.CurrencyCode,
          paymentTerms: v.PaymentTerms,
          bankAccount: v.BankAccountNumber,
          routingNumber: v.BankRoutingNumber,
        };
      }
      case 'lnfin': {
        const v = vendor as LNVendor;
        return {
          id: v.BusinessPartner,
          name: v.Name,
          displayName: v.BusinessPartner,
          email: v.Email,
          phone: v.Phone,
          taxId: v.TaxRegistrationNumber,
          isActive: v.Status === 1,
          currency: v.Currency,
          paymentTerms: v.PaymentMethod,
          bankAccount: v.BankAccount || v.IBAN,
          routingNumber: v.BIC,
        };
      }
      case 'm3': {
        const v = vendor as M3Vendor;
        return {
          id: v.SUNO,
          name: v.SUNM,
          displayName: v.SUNO,
          email: v.EMAL,
          phone: v.PHNO,
          taxId: v.VRNO,
          isActive: v.STAT === '20',
          currency: v.CUCD,
          paymentTerms: v.TEPY,
          bankAccount: v.BKAC || v.IBAN,
          routingNumber: v.SPTS,
        };
      }
      case 'syteline': {
        const v = vendor as SyteLineVendor;
        return {
          id: v.VendNum,
          name: v.VendName,
          displayName: v.VendNum,
          email: v.Email,
          phone: v.Phone,
          taxId: v.TaxRegNum,
          isActive: v.VendStatus === 'A',
          currency: v.CurrCode,
          paymentTerms: v.PaymentTerms,
          bankAccount: v.BankAcct,
          routingNumber: v.RoutingNum,
        };
      }
      default:
        throw new Error(`Unknown Infor product: ${product}`);
    }
  }

  async syncBillToDatabase(connectionId: string, bill: InforBill, product: InforProduct): Promise<void> {
    // Normalize bill data across products
    const normalizedBill = this.normalizeBill(bill, product);

    const wellsFee = normalizedBill.totalAmount * 0.01; // 1%
    const paymentCostSaved = normalizedBill.totalAmount > 10000 ? 30 : 15;
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
        ${normalizedBill.id},
        ${normalizedBill.vendorId},
        ${normalizedBill.billNumber || null},
        ${normalizedBill.vendorName || 'Unknown Vendor'},
        ${normalizedBill.totalAmount},
        ${normalizedBill.currency || 'USD'},
        ${normalizedBill.billDate},
        ${normalizedBill.dueDate},
        ${normalizedBill.isPaid ? 'paid_external' : 'pending'},
        ${normalizedBill.isPaid ? 'paid' : (normalizedBill.amountPaid > 0 ? 'partial' : 'unpaid')},
        ${normalizedBill.amountPaid},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${normalizedBill.description || null},
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

  private normalizeBill(bill: InforBill, product: InforProduct): {
    id: string;
    billNumber?: string;
    vendorId: string;
    vendorName?: string;
    totalAmount: number;
    currency: string;
    billDate: string;
    dueDate: string;
    isPaid: boolean;
    amountPaid: number;
    amountRemaining: number;
    description?: string;
  } {
    switch (product) {
      case 'csf': {
        const b = bill as CSFInvoice;
        return {
          id: b.InvoiceId,
          billNumber: b.InvoiceNumber,
          vendorId: b.VendorNumber,
          vendorName: b.VendorName,
          totalAmount: b.InvoiceAmount,
          currency: b.CurrencyCode,
          billDate: b.InvoiceDate,
          dueDate: b.DueDate,
          isPaid: b.PaymentStatus === 'Paid',
          amountPaid: b.AmountPaid,
          amountRemaining: b.AmountRemaining,
          description: b.Description,
        };
      }
      case 'lnfin': {
        const b = bill as LNInvoice;
        return {
          id: b.Invoice,
          billNumber: b.TransactionNumber,
          vendorId: b.BusinessPartner,
          vendorName: b.BusinessPartnerName,
          totalAmount: b.InvoiceAmount,
          currency: b.Currency,
          billDate: b.InvoiceDate,
          dueDate: b.DueDate,
          isPaid: b.Status === 3,
          amountPaid: b.PaidAmount,
          amountRemaining: b.OpenAmount,
          description: b.Description,
        };
      }
      case 'm3': {
        const b = bill as M3Invoice;
        // Convert M3 date format (YYYYMMDD) to ISO
        const formatM3Date = (d: string) => {
          if (d && d.length === 8) {
            return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          }
          return d;
        };
        return {
          id: b.SINO,
          billNumber: b.SINO,
          vendorId: b.SUNO,
          vendorName: undefined,
          totalAmount: b.IVAM,
          currency: b.CUCD,
          billDate: formatM3Date(b.IVDT),
          dueDate: formatM3Date(b.DUDT),
          isPaid: b.PYST === '90', // Fully paid
          amountPaid: b.PAAM,
          amountRemaining: b.OPAM,
          description: b.VTXT,
        };
      }
      case 'syteline': {
        const b = bill as SyteLineVoucher;
        return {
          id: b.Voucher,
          billNumber: b.Voucher,
          vendorId: b.VendNum,
          vendorName: b.VendName,
          totalAmount: b.VouchAmt,
          currency: b.CurrCode,
          billDate: b.InvDate,
          dueDate: b.DueDate,
          isPaid: b.Status === 'P',
          amountPaid: b.AmtPaid,
          amountRemaining: b.AmtOpen,
          description: b.Description,
        };
      }
      default:
        throw new Error(`Unknown Infor product: ${product}`);
    }
  }

  async syncPaymentToDatabase(connectionId: string, payment: InforPayment, product: InforProduct): Promise<void> {
    // Normalize payment data across products
    const normalizedPayment = this.normalizePayment(payment, product);

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
        ${normalizedPayment.id},
        ${normalizedPayment.vendorId},
        ${normalizedPayment.amount},
        ${normalizedPayment.paymentMethod || 'infor'},
        ${normalizedPayment.paymentDate},
        ${normalizedPayment.reference || null},
        ${JSON.stringify(payment)}
      )
      ON CONFLICT (erp_connection_id, external_payment_id)
      DO UPDATE SET
        payment_amount = EXCLUDED.payment_amount,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  private normalizePayment(payment: InforPayment, product: InforProduct): {
    id: string;
    vendorId: string;
    amount: number;
    currency: string;
    paymentDate: string;
    paymentMethod?: string;
    reference?: string;
  } {
    switch (product) {
      case 'csf': {
        const p = payment as CSFPayment;
        return {
          id: p.PaymentId,
          vendorId: p.VendorNumber,
          amount: p.PaymentAmount,
          currency: p.CurrencyCode,
          paymentDate: p.PaymentDate,
          paymentMethod: p.PaymentMethod,
          reference: p.ReferenceNumber || p.CheckNumber,
        };
      }
      case 'lnfin': {
        const p = payment as LNPayment;
        return {
          id: p.PaymentDocument,
          vendorId: p.BusinessPartner,
          amount: p.Amount,
          currency: p.Currency,
          paymentDate: p.PaymentDate,
          paymentMethod: p.PaymentMethod,
          reference: p.BankReference,
        };
      }
      case 'm3': {
        const p = payment as M3Payment;
        // Convert M3 date format
        const formatM3Date = (d: string) => {
          if (d && d.length === 8) {
            return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          }
          return d;
        };
        return {
          id: p.PPYN,
          vendorId: p.SUNO,
          amount: p.PYAM,
          currency: p.CUCD,
          paymentDate: formatM3Date(p.PYDT),
          paymentMethod: p.PMTP,
          reference: p.BKRF,
        };
      }
      case 'syteline': {
        const p = payment as SyteLinePayment;
        return {
          id: p.CheckNum,
          vendorId: p.VendNum,
          amount: p.CheckAmt,
          currency: p.CurrCode,
          paymentDate: p.CheckDate,
          paymentMethod: p.PayMethod,
          reference: p.RefNum,
        };
      }
      default:
        throw new Error(`Unknown Infor product: ${product}`);
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
    const errors: string[] = [];
    let vendorsFound = 0;
    let billsFound = 0;
    let paymentsFound = 0;

    const [connection] = await sql`
      SELECT infor_product FROM erp_connections WHERE id = ${connectionId}
    `;

    const product = connection.infor_product as InforProduct;

    try {
      // Sync vendors
      const vendors = await this.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        try {
          await this.syncVendorToDatabase(connectionId, vendor, product);
          vendorsFound++;
        } catch (error) {
          const vendorId = this.getVendorId(vendor, product);
          errors.push(`Vendor ${vendorId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync bills (unpaid only for intercepts)
      const bills = await this.fetchBills(connectionId, {
        limit: 500,
      });
      for (const bill of bills) {
        try {
          await this.syncBillToDatabase(connectionId, bill, product);
          billsFound++;
        } catch (error) {
          const billId = this.getBillId(bill, product);
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
          await this.syncPaymentToDatabase(connectionId, payment, product);
          paymentsFound++;
        } catch (error) {
          const paymentId = this.getPaymentId(payment, product);
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
          last_sync_error = ${errorMessage}
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

  private getVendorId(vendor: InforVendor, product: InforProduct): string {
    switch (product) {
      case 'csf':
        return (vendor as CSFVendor).VendorNumber;
      case 'lnfin':
        return (vendor as LNVendor).BusinessPartner;
      case 'm3':
        return (vendor as M3Vendor).SUNO;
      case 'syteline':
        return (vendor as SyteLineVendor).VendNum;
      default:
        return 'unknown';
    }
  }

  private getBillId(bill: InforBill, product: InforProduct): string {
    switch (product) {
      case 'csf':
        return (bill as CSFInvoice).InvoiceId;
      case 'lnfin':
        return (bill as LNInvoice).Invoice;
      case 'm3':
        return (bill as M3Invoice).SINO;
      case 'syteline':
        return (bill as SyteLineVoucher).Voucher;
      default:
        return 'unknown';
    }
  }

  private getPaymentId(payment: InforPayment, product: InforProduct): string {
    switch (product) {
      case 'csf':
        return (payment as CSFPayment).PaymentId;
      case 'lnfin':
        return (payment as LNPayment).PaymentDocument;
      case 'm3':
        return (payment as M3Payment).PPYN;
      case 'syteline':
        return (payment as SyteLinePayment).CheckNum;
      default:
        return 'unknown';
    }
  }

  // ============================================================================
  // TEST CONNECTION
  // ============================================================================

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      // Try to fetch a single vendor to verify connection
      await this.fetchVendors(connectionId, 1);
      return true;
    } catch (error) {
      console.error('Infor connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // HELPER: GET AVAILABLE COMPANIES
  // ============================================================================

  async getAvailableCompanies(
    accessToken: string,
    ionHost: string,
    product: InforProduct,
    logicalId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const baseUrl = this.getBaseUrlForProduct(ionHost, product, logicalId);

    let endpoint: string;
    switch (product) {
      case 'csf':
        endpoint = '/companies';
        break;
      case 'lnfin':
        endpoint = '/companies';
        break;
      case 'm3':
        endpoint = '/companies';
        break;
      case 'syteline':
        endpoint = '/sites';
        break;
      default:
        endpoint = '/companies';
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
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
    const items = data.value || data.items || data.results || [];

    return items.map((item: any) => ({
      id: item.CompanyId || item.Company || item.CONO || item.Site || item.id,
      name: item.CompanyName || item.Description || item.Name || item.SiteName || item.name,
    }));
  }
}

// Export singleton instance
export const infor = new InforService();
