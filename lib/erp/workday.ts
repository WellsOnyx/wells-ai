// Workday HCM & Financials Integration
// OAuth 2.0 with Integration System Users (ISU) + REST API / RAAS Reports
// CRITICAL for GRAIN token model - contractor payroll data extraction

import { neon } from '@neondatabase/serverless';
import type { ERPConnection } from './types';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// Workday data center options
type WorkdayDataCenter = 'us' | 'eu' | 'ca' | 'ap';

const DATA_CENTER_HOSTS: Record<WorkdayDataCenter, string> = {
  us: 'wd2-impl-services1.workday.com',     // US Implementation
  eu: 'wd3-impl-services1.workday.com',     // EU Implementation
  ca: 'wd10-impl-services1.workday.com',    // Canada Implementation
  ap: 'wd5-impl-services1.workday.com',     // Asia Pacific Implementation
};

// Production data centers (after go-live)
const PROD_DATA_CENTER_HOSTS: Record<WorkdayDataCenter, string> = {
  us: 'wd2-services1.myworkday.com',
  eu: 'wd3-services1.myworkday.com',
  ca: 'wd10-services1.myworkday.com',
  ap: 'wd5-services1.myworkday.com',
};

const REDIRECT_URI = process.env.WORKDAY_REDIRECT_URI || 'https://wellsai.app/api/erp/workday/callback';

// ============================================================================
// WORKDAY DATA TYPES
// ============================================================================

// Workday Worker (for contractor payroll - HUGE for GRAIN)
export interface WorkdayWorker {
  workerId: string;
  workerDescriptor: string;
  workerType: 'Employee' | 'Contingent_Worker';
  employeeId?: string;
  contingentWorkerId?: string;
  legalName: {
    firstName: string;
    lastName: string;
    middleName?: string;
  };
  email?: string;
  phone?: string;
  hireDate: string;
  terminationDate?: string;
  jobTitle?: string;
  department?: string;
  costCenter?: string;
  payGroup?: string;
  hourlyRate?: number;
  annualSalary?: number;
  currency: string;
  isActive: boolean;
  managerId?: string;
  location?: string;
  taxId?: string;
  bankAccountLastFour?: string;
}

// Workday Supplier/Vendor
export interface WorkdayVendor {
  supplierId: string;
  supplierReferenceId: string;
  supplierName: string;
  supplierCategory?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  defaultCurrency: string;
  paymentTerms?: string;
  bankAccountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  status: 'Active' | 'Inactive';
  isContractor: boolean;  // CRITICAL for GRAIN
  w9OnFile: boolean;
}

// Workday Supplier Invoice (Bill)
export interface WorkdayBill {
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currencyCode: string;
  status: 'Draft' | 'In_Progress' | 'Approved' | 'Paid' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  amountPaid: number;
  amountRemaining: number;
  purchaseOrderNumber?: string;
  companyId?: string;
  memo?: string;
  lineItems?: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitCost: number;
    extendedAmount: number;
    spendCategory?: string;
    costCenter?: string;
  }>;
}

// Workday Payment
export interface WorkdayPayment {
  paymentId: string;
  paymentNumber: string;
  supplierId: string;
  paymentDate: string;
  paymentAmount: number;
  currencyCode: string;
  paymentMethod: 'Check' | 'EFT' | 'Wire' | 'ACH' | 'Manual';
  paymentStatus: 'Initiated' | 'Approved' | 'In_Progress' | 'Completed' | 'Failed' | 'Cancelled';
  bankAccountId?: string;
  referenceNumber?: string;
  memo?: string;
  invoicesApplied?: Array<{
    invoiceId: string;
    amountApplied: number;
  }>;
}

// Workday Payroll Run (CRITICAL for GRAIN - contractor payments)
export interface WorkdayPayrollRun {
  payrollRunId: string;
  payGroupId: string;
  payGroupName: string;
  periodStartDate: string;
  periodEndDate: string;
  paymentDate: string;
  status: 'In_Progress' | 'Complete' | 'Confirmed';
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  totalTaxes: number;
  currency: string;
  workerCount: number;
  contractorCount: number;   // HUGE for GRAIN
  contractorGrossPay: number; // HUGE for GRAIN
}

// Workday Contractor Payment Detail (CRITICAL for GRAIN)
export interface WorkdayContractorPayment {
  paymentId: string;
  workerId: string;
  workerName: string;
  contingentWorkerId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  paymentDate: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  hoursWorked?: number;
  hourlyRate?: number;
  payType: 'Hourly' | 'Fixed' | 'Project' | 'Milestone';
  projectCode?: string;
  costCenter?: string;
  supplierInvoiceId?: string;  // Links to supplier invoice if applicable
}

// ============================================================================
// WORKDAY SERVICE CLASS
// ============================================================================

export class WorkdayService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.WORKDAY_CLIENT_ID || '';
    this.clientSecret = process.env.WORKDAY_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Workday credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // OAUTH 2.0 FLOW (Integration System User)
  // ============================================================================

  /**
   * Generate Workday OAuth2 authorization URL
   * Uses Authorization Code Grant with ISU credentials
   */
  getAuthorizationUrl(
    state: string,
    tenantAlias: string,
    dataCenter: WorkdayDataCenter = 'us',
    isProduction: boolean = false
  ): string {
    const host = isProduction
      ? PROD_DATA_CENTER_HOSTS[dataCenter]
      : DATA_CENTER_HOSTS[dataCenter];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'Financial_Management Human_Resources Payroll',
      state,
    });

    // Workday OAuth 2.0 authorization endpoint
    return `https://${host}/${tenantAlias}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    tenantAlias: string,
    dataCenter: WorkdayDataCenter = 'us',
    isProduction: boolean = false
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const host = isProduction
      ? PROD_DATA_CENTER_HOSTS[dataCenter]
      : DATA_CENTER_HOSTS[dataCenter];

    const tokenUrl = `https://${host}/${tenantAlias}/token`;

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

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    tenantAlias: string,
    dataCenter: WorkdayDataCenter = 'us',
    isProduction: boolean = false
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const host = isProduction
      ? PROD_DATA_CENTER_HOSTS[dataCenter]
      : DATA_CENTER_HOSTS[dataCenter];

    const tokenUrl = `https://${host}/${tenantAlias}/token`;

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
        workday_tenant_alias,
        workday_data_center,
        workday_is_production
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Workday connection not found');
    }

    const tenantAlias = connection.workday_tenant_alias;
    const dataCenter = (connection.workday_data_center || 'us') as WorkdayDataCenter;
    const isProduction = connection.workday_is_production || false;

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        tenantAlias,
        dataCenter,
        isProduction
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
    const host = isProduction
      ? PROD_DATA_CENTER_HOSTS[dataCenter]
      : DATA_CENTER_HOSTS[dataCenter];

    const baseUrl = `https://${host}/ccx/api/v1/${tenantAlias}`;
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Workday API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  /**
   * Execute Workday Report-as-a-Service (RaaS) query
   * Used for custom reports and bulk data extraction
   */
  private async executeRaasReport(
    connectionId: string,
    reportOwner: string,
    reportName: string,
    parameters?: Record<string, string>
  ): Promise<any> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const [connection] = await sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at,
        workday_tenant_alias,
        workday_data_center,
        workday_is_production
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Workday connection not found');
    }

    const tenantAlias = connection.workday_tenant_alias;
    const dataCenter = (connection.workday_data_center || 'us') as WorkdayDataCenter;
    const isProduction = connection.workday_is_production || false;

    // Refresh token if needed
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      const tokens = await this.refreshAccessToken(
        connection.refresh_token,
        tenantAlias,
        dataCenter,
        isProduction
      );
      accessToken = tokens.access_token;
    }

    const host = isProduction
      ? PROD_DATA_CENTER_HOSTS[dataCenter]
      : DATA_CENTER_HOSTS[dataCenter];

    // RaaS endpoint
    let url = `https://${host}/ccx/service/customreport2/${tenantAlias}/${reportOwner}/${reportName}?format=json`;

    if (parameters) {
      const params = new URLSearchParams(parameters);
      url += `&${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Workday RaaS error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // VENDOR OPERATIONS
  // ============================================================================

  async fetchVendors(connectionId: string, limit: number = 100): Promise<WorkdayVendor[]> {
    const response = await this.makeRequest(
      connectionId,
      `/suppliers?limit=${limit}`
    );

    const suppliers = response.data || [];

    return suppliers.map((s: any) => ({
      supplierId: s.id,
      supplierReferenceId: s.supplierReferenceID || s.id,
      supplierName: s.supplierName || s.descriptor,
      supplierCategory: s.supplierCategory?.descriptor,
      taxId: s.taxID,
      email: s.primaryEmail?.emailAddress,
      phone: s.primaryPhone?.completePhoneNumber,
      address: s.primaryAddress ? {
        addressLine1: s.primaryAddress.addressLine1,
        addressLine2: s.primaryAddress.addressLine2,
        city: s.primaryAddress.city,
        stateProvince: s.primaryAddress.countryRegion?.descriptor,
        postalCode: s.primaryAddress.postalCode,
        country: s.primaryAddress.country?.descriptor,
      } : undefined,
      defaultCurrency: s.defaultCurrency?.descriptor || 'USD',
      paymentTerms: s.paymentTerms?.descriptor,
      bankAccountNumber: s.settlementBankAccount?.bankAccountNumber,
      routingNumber: s.settlementBankAccount?.routingTransitNumber,
      swiftCode: s.settlementBankAccount?.swiftBankIdentificationCode,
      iban: s.settlementBankAccount?.iban,
      status: s.inactive ? 'Inactive' : 'Active',
      isContractor: s.supplierCategory?.id?.includes('CONTRACTOR') || false,
      w9OnFile: s.taxDocumentsOnFile || false,
    }));
  }

  async fetchVendor(connectionId: string, supplierId: string): Promise<WorkdayVendor | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/suppliers/${supplierId}`
      );

      const s = response;

      return {
        supplierId: s.id,
        supplierReferenceId: s.supplierReferenceID || s.id,
        supplierName: s.supplierName || s.descriptor,
        supplierCategory: s.supplierCategory?.descriptor,
        taxId: s.taxID,
        email: s.primaryEmail?.emailAddress,
        phone: s.primaryPhone?.completePhoneNumber,
        address: s.primaryAddress ? {
          addressLine1: s.primaryAddress.addressLine1,
          addressLine2: s.primaryAddress.addressLine2,
          city: s.primaryAddress.city,
          stateProvince: s.primaryAddress.countryRegion?.descriptor,
          postalCode: s.primaryAddress.postalCode,
          country: s.primaryAddress.country?.descriptor,
        } : undefined,
        defaultCurrency: s.defaultCurrency?.descriptor || 'USD',
        paymentTerms: s.paymentTerms?.descriptor,
        bankAccountNumber: s.settlementBankAccount?.bankAccountNumber,
        routingNumber: s.settlementBankAccount?.routingTransitNumber,
        swiftCode: s.settlementBankAccount?.swiftBankIdentificationCode,
        iban: s.settlementBankAccount?.iban,
        status: s.inactive ? 'Inactive' : 'Active',
        isContractor: s.supplierCategory?.id?.includes('CONTRACTOR') || false,
        w9OnFile: s.taxDocumentsOnFile || false,
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // BILL/INVOICE OPERATIONS
  // ============================================================================

  async fetchBills(
    connectionId: string,
    options?: {
      status?: string;
      dueDateFrom?: Date;
      dueDateTo?: Date;
      limit?: number;
    }
  ): Promise<WorkdayBill[]> {
    let endpoint = `/supplierInvoices?limit=${options?.limit || 100}`;

    if (options?.status) {
      endpoint += `&status=${options.status}`;
    }

    if (options?.dueDateFrom) {
      endpoint += `&dueDateFrom=${options.dueDateFrom.toISOString().split('T')[0]}`;
    }

    if (options?.dueDateTo) {
      endpoint += `&dueDateTo=${options.dueDateTo.toISOString().split('T')[0]}`;
    }

    const response = await this.makeRequest(connectionId, endpoint);
    const invoices = response.data || [];

    return invoices.map((inv: any) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber || inv.descriptor,
      supplierId: inv.supplier?.id,
      supplierName: inv.supplier?.descriptor,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount?.amount || 0,
      currencyCode: inv.totalAmount?.currency?.descriptor || 'USD',
      status: this.mapInvoiceStatus(inv.status?.descriptor),
      paymentStatus: this.mapPaymentStatus(inv.paymentStatus?.descriptor),
      amountPaid: inv.amountPaid?.amount || 0,
      amountRemaining: (inv.totalAmount?.amount || 0) - (inv.amountPaid?.amount || 0),
      purchaseOrderNumber: inv.purchaseOrder?.descriptor,
      companyId: inv.company?.id,
      memo: inv.memo,
      lineItems: inv.invoiceLines?.map((line: any, idx: number) => ({
        lineNumber: idx + 1,
        description: line.itemDescription || line.memo,
        quantity: line.quantity || 1,
        unitCost: line.unitCost?.amount || 0,
        extendedAmount: line.extendedAmount?.amount || 0,
        spendCategory: line.spendCategory?.descriptor,
        costCenter: line.costCenter?.descriptor,
      })),
    }));
  }

  async fetchBill(connectionId: string, invoiceId: string): Promise<WorkdayBill | null> {
    try {
      const response = await this.makeRequest(
        connectionId,
        `/supplierInvoices/${invoiceId}`
      );

      const inv = response;

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber || inv.descriptor,
        supplierId: inv.supplier?.id,
        supplierName: inv.supplier?.descriptor,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount?.amount || 0,
        currencyCode: inv.totalAmount?.currency?.descriptor || 'USD',
        status: this.mapInvoiceStatus(inv.status?.descriptor),
        paymentStatus: this.mapPaymentStatus(inv.paymentStatus?.descriptor),
        amountPaid: inv.amountPaid?.amount || 0,
        amountRemaining: (inv.totalAmount?.amount || 0) - (inv.amountPaid?.amount || 0),
        purchaseOrderNumber: inv.purchaseOrder?.descriptor,
        companyId: inv.company?.id,
        memo: inv.memo,
        lineItems: inv.invoiceLines?.map((line: any, idx: number) => ({
          lineNumber: idx + 1,
          description: line.itemDescription || line.memo,
          quantity: line.quantity || 1,
          unitCost: line.unitCost?.amount || 0,
          extendedAmount: line.extendedAmount?.amount || 0,
          spendCategory: line.spendCategory?.descriptor,
          costCenter: line.costCenter?.descriptor,
        })),
      };
    } catch {
      return null;
    }
  }

  private mapInvoiceStatus(status?: string): WorkdayBill['status'] {
    switch (status?.toLowerCase()) {
      case 'draft': return 'Draft';
      case 'in progress':
      case 'pending approval': return 'In_Progress';
      case 'approved': return 'Approved';
      case 'paid': return 'Paid';
      case 'cancelled':
      case 'voided': return 'Cancelled';
      default: return 'In_Progress';
    }
  }

  private mapPaymentStatus(status?: string): WorkdayBill['paymentStatus'] {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'complete': return 'Paid';
      case 'partial':
      case 'partially paid': return 'Partial';
      default: return 'Unpaid';
    }
  }

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  async fetchPayments(
    connectionId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ): Promise<WorkdayPayment[]> {
    let endpoint = `/payments?limit=${options?.limit || 100}`;

    if (options?.dateFrom) {
      endpoint += `&paymentDateFrom=${options.dateFrom.toISOString().split('T')[0]}`;
    }

    if (options?.dateTo) {
      endpoint += `&paymentDateTo=${options.dateTo.toISOString().split('T')[0]}`;
    }

    const response = await this.makeRequest(connectionId, endpoint);
    const payments = response.data || [];

    return payments.map((pmt: any) => ({
      paymentId: pmt.id,
      paymentNumber: pmt.paymentNumber || pmt.descriptor,
      supplierId: pmt.payee?.id,
      paymentDate: pmt.paymentDate,
      paymentAmount: pmt.paymentAmount?.amount || 0,
      currencyCode: pmt.paymentAmount?.currency?.descriptor || 'USD',
      paymentMethod: this.mapPaymentMethod(pmt.paymentType?.descriptor),
      paymentStatus: this.mapPaymentStatusEnum(pmt.status?.descriptor),
      bankAccountId: pmt.bankAccount?.id,
      referenceNumber: pmt.referenceNumber,
      memo: pmt.memo,
      invoicesApplied: pmt.remittanceDetails?.map((r: any) => ({
        invoiceId: r.supplierInvoice?.id,
        amountApplied: r.amountPaid?.amount || 0,
      })),
    }));
  }

  async createPayment(
    connectionId: string,
    supplierId: string,
    invoiceId: string,
    amount: number,
    paymentDate: Date,
    options?: {
      bankAccountId?: string;
      paymentMethod?: 'ACH' | 'Wire' | 'Check';
      memo?: string;
    }
  ): Promise<WorkdayPayment> {
    const paymentData = {
      payee: { id: supplierId },
      paymentDate: paymentDate.toISOString().split('T')[0],
      paymentAmount: {
        amount: amount,
        currency: { id: 'USD' },
      },
      paymentType: { id: options?.paymentMethod || 'ACH' },
      bankAccount: options?.bankAccountId ? { id: options.bankAccountId } : undefined,
      memo: options?.memo || 'Paid via Wells AI',
      remittanceDetails: [{
        supplierInvoice: { id: invoiceId },
        amountPaid: {
          amount: amount,
          currency: { id: 'USD' },
        },
      }],
    };

    const response = await this.makeRequest(
      connectionId,
      '/payments',
      'POST',
      paymentData
    );

    return {
      paymentId: response.id,
      paymentNumber: response.paymentNumber || `WELLS-${Date.now()}`,
      supplierId,
      paymentDate: paymentDate.toISOString(),
      paymentAmount: amount,
      currencyCode: 'USD',
      paymentMethod: options?.paymentMethod || 'ACH',
      paymentStatus: 'Initiated',
      bankAccountId: options?.bankAccountId,
      referenceNumber: response.referenceNumber,
      memo: options?.memo,
      invoicesApplied: [{
        invoiceId,
        amountApplied: amount,
      }],
    };
  }

  private mapPaymentMethod(method?: string): WorkdayPayment['paymentMethod'] {
    switch (method?.toLowerCase()) {
      case 'check': return 'Check';
      case 'eft':
      case 'electronic': return 'EFT';
      case 'wire': return 'Wire';
      case 'ach': return 'ACH';
      default: return 'Manual';
    }
  }

  private mapPaymentStatusEnum(status?: string): WorkdayPayment['paymentStatus'] {
    switch (status?.toLowerCase()) {
      case 'initiated': return 'Initiated';
      case 'approved': return 'Approved';
      case 'in progress':
      case 'processing': return 'In_Progress';
      case 'completed':
      case 'paid': return 'Completed';
      case 'failed':
      case 'error': return 'Failed';
      case 'cancelled':
      case 'voided': return 'Cancelled';
      default: return 'In_Progress';
    }
  }

  // ============================================================================
  // CONTRACTOR PAYROLL OPERATIONS (CRITICAL FOR GRAIN TOKEN MODEL)
  // ============================================================================

  /**
   * Fetch all contingent workers (contractors)
   * This is HUGE for GRAIN - identifies all contractor payments
   */
  async fetchContractors(connectionId: string, limit: number = 500): Promise<WorkdayWorker[]> {
    const response = await this.makeRequest(
      connectionId,
      `/workers?workerType=Contingent_Worker&limit=${limit}`
    );

    const workers = response.data || [];

    return workers.map((w: any) => ({
      workerId: w.id,
      workerDescriptor: w.descriptor,
      workerType: 'Contingent_Worker' as const,
      contingentWorkerId: w.contingentWorkerID,
      legalName: {
        firstName: w.legalName?.firstName || '',
        lastName: w.legalName?.lastName || '',
        middleName: w.legalName?.middleName,
      },
      email: w.primaryWorkEmail?.emailAddress,
      phone: w.primaryWorkPhone?.completePhoneNumber,
      hireDate: w.contingentWorkerData?.originalContractStartDate || w.hireDate,
      terminationDate: w.contingentWorkerData?.contractEndDate,
      jobTitle: w.primaryJob?.jobProfile?.descriptor,
      department: w.primaryJob?.supervisoryOrganization?.descriptor,
      costCenter: w.primaryJob?.costCenter?.descriptor,
      payGroup: w.payGroup?.descriptor,
      hourlyRate: w.compensation?.hourlyRate?.amount,
      currency: w.compensation?.currency?.descriptor || 'USD',
      isActive: !w.terminated,
      managerId: w.primaryJob?.manager?.id,
      location: w.primaryJob?.location?.descriptor,
    }));
  }

  /**
   * Fetch contractor payment history (CRITICAL FOR GRAIN)
   * Returns all payments made to contractors within a date range
   */
  async fetchContractorPayments(
    connectionId: string,
    options?: {
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ): Promise<WorkdayContractorPayment[]> {
    // Use RaaS report for contractor payments if available
    // Otherwise fall back to payroll API
    let endpoint = `/payroll/contractorPayments?limit=${options?.limit || 500}`;

    if (options?.dateFrom) {
      endpoint += `&paymentDateFrom=${options.dateFrom.toISOString().split('T')[0]}`;
    }

    if (options?.dateTo) {
      endpoint += `&paymentDateTo=${options.dateTo.toISOString().split('T')[0]}`;
    }

    try {
      const response = await this.makeRequest(connectionId, endpoint);
      const payments = response.data || [];

      return payments.map((p: any) => ({
        paymentId: p.id,
        workerId: p.worker?.id,
        workerName: p.worker?.descriptor,
        contingentWorkerId: p.worker?.contingentWorkerID,
        payPeriodStart: p.payPeriod?.startDate,
        payPeriodEnd: p.payPeriod?.endDate,
        paymentDate: p.paymentDate,
        grossPay: p.grossPay?.amount || 0,
        deductions: p.deductions?.amount || 0,
        netPay: p.netPay?.amount || 0,
        currency: p.currency?.descriptor || 'USD',
        hoursWorked: p.hoursWorked,
        hourlyRate: p.hourlyRate?.amount,
        payType: this.mapPayType(p.payType?.descriptor),
        projectCode: p.project?.descriptor,
        costCenter: p.costCenter?.descriptor,
        supplierInvoiceId: p.supplierInvoice?.id,
      }));
    } catch {
      // Fallback: return empty if contractor payments endpoint not available
      return [];
    }
  }

  /**
   * Get contractor payroll summary (CRITICAL FOR GRAIN ANALYTICS)
   * Aggregates contractor spend for GRAIN token calculations
   */
  async getContractorPayrollSummary(
    connectionId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalContractorPayments: number;
    contractorCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    averagePayPerContractor: number;
    paymentsByType: Record<string, number>;
    topContractors: Array<{
      workerId: string;
      name: string;
      totalPaid: number;
    }>;
    grainEligibleVolume: number;  // GRAIN token eligible volume
  }> {
    const payments = await this.fetchContractorPayments(connectionId, {
      dateFrom,
      dateTo,
      limit: 1000,
    });

    const contractorTotals: Record<string, { name: string; total: number }> = {};
    const paymentsByType: Record<string, number> = {};
    let totalGross = 0;
    let totalNet = 0;

    for (const payment of payments) {
      totalGross += payment.grossPay;
      totalNet += payment.netPay;

      // Track by contractor
      if (!contractorTotals[payment.workerId]) {
        contractorTotals[payment.workerId] = {
          name: payment.workerName,
          total: 0,
        };
      }
      contractorTotals[payment.workerId].total += payment.netPay;

      // Track by type
      paymentsByType[payment.payType] = (paymentsByType[payment.payType] || 0) + payment.netPay;
    }

    const uniqueContractors = Object.keys(contractorTotals).length;
    const topContractors = Object.entries(contractorTotals)
      .map(([workerId, data]) => ({
        workerId,
        name: data.name,
        totalPaid: data.total,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 10);

    // GRAIN eligible volume = total contractor payments that could be processed through GRAIN
    const grainEligibleVolume = totalNet;

    return {
      totalContractorPayments: payments.length,
      contractorCount: uniqueContractors,
      totalGrossPay: totalGross,
      totalNetPay: totalNet,
      averagePayPerContractor: uniqueContractors > 0 ? totalNet / uniqueContractors : 0,
      paymentsByType,
      topContractors,
      grainEligibleVolume,
    };
  }

  private mapPayType(type?: string): WorkdayContractorPayment['payType'] {
    switch (type?.toLowerCase()) {
      case 'hourly': return 'Hourly';
      case 'fixed':
      case 'salary': return 'Fixed';
      case 'project': return 'Project';
      case 'milestone': return 'Milestone';
      default: return 'Hourly';
    }
  }

  // ============================================================================
  // DATABASE SYNC METHODS
  // ============================================================================

  async syncVendorToDatabase(connectionId: string, vendor: WorkdayVendor): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

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
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.supplierId},
        ${vendor.supplierName},
        ${vendor.supplierReferenceId},
        ${vendor.email || null},
        ${vendor.phone || null},
        ${vendor.taxId || null},
        ${vendor.status === 'Active'},
        ${vendor.defaultCurrency || 'USD'},
        ${vendor.paymentTerms || null},
        ${vendor.bankAccountNumber || null},
        ${vendor.routingNumber || null},
        ${vendor.address?.addressLine1 || null},
        ${vendor.address?.addressLine2 || null},
        ${vendor.address?.city || null},
        ${vendor.address?.stateProvince || null},
        ${vendor.address?.postalCode || null},
        ${vendor.address?.country || 'US'},
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
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  async syncBillToDatabase(connectionId: string, bill: WorkdayBill): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    // Calculate Wells fee and savings
    const wellsFee = bill.totalAmount * 0.01; // 1% fee
    const paymentCostSaved = bill.totalAmount > 10000 ? 30 : 15; // Typical wire/check costs
    const netSavings = paymentCostSaved - wellsFee;
    const isPaid = bill.paymentStatus === 'Paid';

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
        ${bill.invoiceId},
        ${bill.supplierId},
        ${bill.invoiceNumber},
        ${bill.supplierName},
        ${bill.totalAmount},
        ${bill.currencyCode || 'USD'},
        ${bill.invoiceDate},
        ${bill.dueDate},
        ${isPaid ? 'paid_external' : 'pending'},
        ${bill.paymentStatus === 'Paid' ? 'paid' : bill.paymentStatus === 'Partial' ? 'partial' : 'unpaid'},
        ${bill.amountPaid},
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

  async syncPaymentToDatabase(connectionId: string, payment: WorkdayPayment): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        reference_number,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${payment.paymentId},
        ${payment.supplierId},
        ${payment.paymentAmount},
        ${payment.paymentMethod.toLowerCase()},
        ${payment.paymentDate},
        ${payment.referenceNumber || null},
        ${payment.memo || null},
        ${JSON.stringify(payment)}
      )
      ON CONFLICT (erp_connection_id, external_payment_id)
      DO UPDATE SET
        payment_amount = EXCLUDED.payment_amount,
        payment_method = EXCLUDED.payment_method,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  /**
   * Sync contractor to database (for GRAIN token model)
   * Tracks contractors separately for GRAIN eligibility
   */
  async syncContractorToDatabase(connectionId: string, contractor: WorkdayWorker): Promise<void> {
    if (!sql) {
      throw new Error('Database connection not available');
    }

    // Store contractors in erp_vendors table with contractor flag
    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        is_active,
        default_currency,
        vendor_type,
        raw_data
      ) VALUES (
        ${connectionId},
        ${`CW_${contractor.workerId}`},
        ${`${contractor.legalName.firstName} ${contractor.legalName.lastName}`},
        ${contractor.workerDescriptor},
        ${contractor.email || null},
        ${contractor.phone || null},
        ${contractor.isActive},
        ${contractor.currency || 'USD'},
        ${'contractor'},
        ${JSON.stringify(contractor)}
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

  // ============================================================================
  // FULL SYNC OPERATION
  // ============================================================================

  async fullSync(connectionId: string): Promise<{
    vendorsFound: number;
    billsFound: number;
    paymentsFound: number;
    contractorsFound: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let vendorsFound = 0;
    let billsFound = 0;
    let paymentsFound = 0;
    let contractorsFound = 0;

    if (!sql) {
      throw new Error('Database connection not available');
    }

    try {
      // Sync vendors/suppliers
      const vendors = await this.fetchVendors(connectionId, 500);
      for (const vendor of vendors) {
        try {
          await this.syncVendorToDatabase(connectionId, vendor);
          vendorsFound++;
        } catch (error) {
          errors.push(`Vendor ${vendor.supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync bills/invoices (unpaid for intercept opportunities)
      const bills = await this.fetchBills(connectionId, {
        status: 'Approved', // Only approved, unpaid invoices
        limit: 500,
      });
      for (const bill of bills) {
        try {
          await this.syncBillToDatabase(connectionId, bill);
          billsFound++;
        } catch (error) {
          errors.push(`Bill ${bill.invoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sync recent payments
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
          errors.push(`Payment ${payment.paymentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // CRITICAL FOR GRAIN: Sync contractors
      try {
        const contractors = await this.fetchContractors(connectionId, 500);
        for (const contractor of contractors) {
          try {
            await this.syncContractorToDatabase(connectionId, contractor);
            contractorsFound++;
          } catch (error) {
            errors.push(`Contractor ${contractor.workerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        // Contractor sync is optional - may not have HCM module
        errors.push(`Contractor sync skipped: ${error instanceof Error ? error.message : 'HCM module not available'}`);
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
      contractorsFound,
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
      console.error('Workday connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // GRAIN-SPECIFIC HELPERS
  // ============================================================================

  /**
   * Calculate GRAIN token eligibility for a company
   * Returns the total contractor payment volume eligible for GRAIN tokens
   */
  async calculateGrainEligibility(
    connectionId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    eligible: boolean;
    contractorVolume: number;
    estimatedGrainTokens: number;
    contractorCount: number;
    averagePaymentSize: number;
  }> {
    const summary = await this.getContractorPayrollSummary(connectionId, dateFrom, dateTo);

    // GRAIN eligibility rules:
    // - Minimum 10 contractors
    // - Minimum $50,000 in contractor payments per month
    const monthlyVolume = summary.totalNetPay / Math.max(1, this.monthsBetween(dateFrom, dateTo));
    const eligible = summary.contractorCount >= 10 && monthlyVolume >= 50000;

    // GRAIN token calculation: 1 GRAIN per $1,000 in contractor payments
    const estimatedGrainTokens = Math.floor(summary.grainEligibleVolume / 1000);

    return {
      eligible,
      contractorVolume: summary.grainEligibleVolume,
      estimatedGrainTokens,
      contractorCount: summary.contractorCount,
      averagePaymentSize: summary.averagePayPerContractor,
    };
  }

  private monthsBetween(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12 +
      (date2.getMonth() - date1.getMonth());
    return Math.max(1, Math.abs(months));
  }
}

// Export singleton instance
export const workday = new WorkdayService();
