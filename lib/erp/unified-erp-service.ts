// Unified ERP Service
// Routes to the correct adapter based on company's ERP connection
// Normalizes data format across ALL 10 ERPs
//
// Supported ERPs:
// 1. QuickBooks (SMB - 500K+ businesses)
// 2. Xero (SMB - Global, especially APAC/UK)
// 3. Codat (Universal connector - bridges 30+ accounting systems)
// 4. NetSuite (Mid-market - $5M-$500M revenue)
// 5. SAP (Enterprise - S/4HANA, Business One)
// 6. Oracle (Enterprise - Fusion Cloud, E-Business Suite)
// 7. Microsoft Dynamics 365 (Enterprise - Finance & Operations, Business Central)
// 8. Workday (Enterprise - HCM + Financials, HUGE for contractor payroll)
// 9. Coupa (Procurement-first - procurement teams love it)
// 10. Sage Intacct (Mid-market - CFO favorite for multi-entity)
// 11. Acumatica (Mid-market - Cloud ERP, manufacturing/distribution)
// 12. Infor (Enterprise - Manufacturing, Distribution, Healthcare, Hospitality)

import { neon } from '@neondatabase/serverless';
import { quickbooks } from './quickbooks';
import { xero } from './xero';
import { codat } from './codat';
import { netsuite } from './netsuite';
import { sap } from './sap';
import { oracle } from './oracle';
import { dynamics365 } from './dynamics365';
import { workday } from './workday';
import { coupa } from './coupa';
import { sageIntacct } from './sage-intacct';
import { acumatica } from './acumatica';
import { infor } from './infor';
import type {
  ERPProvider,
  ERPConnection,
  ERPBill,
  ERPVendor,
  ERPPayment,
} from './types';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// Normalized data types for unified access
export interface NormalizedVendor {
  id: string;
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  taxId?: string;
  currency: string;
  paymentTerms?: string;
  isActive: boolean;
  enrolledInWells: boolean;
  wellsSupplierId?: string;
  metadata?: Record<string, any>;
}

export interface NormalizedInvoice {
  id: string;
  externalId: string;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  invoiceNumber?: string;
  amount: number;
  amountDue: number;
  currency: string;
  invoiceDate: Date;
  dueDate: Date;
  status: 'pending' | 'partial' | 'paid' | 'cancelled';
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    glAccount?: string;
  }>;
  wellsFee?: number;
  potentialSavings?: number;
  interceptProposed?: boolean;
  interceptAccepted?: boolean;
  metadata?: Record<string, any>;
}

export interface NormalizedPayment {
  id: string;
  externalId?: string;
  invoiceId?: string;
  vendorId: string;
  vendorName?: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedByWells: boolean;
  wellsTransactionId?: string;
  wellsFeeCollected?: number;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  billsFound: number;
  vendorsFound: number;
  paymentsFound: number;
  interceptsCreated: number;
  errors: string[];
}

export class UnifiedERPService {
  // ============================================================================
  // Connection Detection
  // ============================================================================

  /**
   * Get the ERP connection for a company
   */
  async getConnection(companyId: string, provider?: ERPProvider): Promise<ERPConnection | null> {
    if (provider) {
      const [connection] = await sql`
        SELECT * FROM erp_connections
        WHERE company_id = ${companyId}
        AND provider = ${provider}
        AND connection_status = 'active'
      `;
      return connection || null;
    }

    // Find any active connection
    const [connection] = await sql`
      SELECT * FROM erp_connections
      WHERE company_id = ${companyId}
      AND connection_status = 'active'
      LIMIT 1
    `;
    return connection || null;
  }

  /**
   * Get all ERP connections for a company
   */
  async getConnections(companyId: string): Promise<ERPConnection[]> {
    const connections = await sql`
      SELECT * FROM erp_connections
      WHERE company_id = ${companyId}
      ORDER BY updated_at DESC
    `;
    return connections;
  }

  /**
   * Detect which ERP a company uses (returns first active connection)
   */
  async detectERP(companyId: string): Promise<{ provider: ERPProvider; connectionId: string } | null> {
    const connection = await this.getConnection(companyId);
    if (!connection) {
      return null;
    }
    return {
      provider: connection.provider as ERPProvider,
      connectionId: connection.id,
    };
  }

  // ============================================================================
  // Unified Vendor Operations
  // ============================================================================

  /**
   * Get vendors from any connected ERP
   */
  async getVendors(connectionId: string, refresh: boolean = false): Promise<NormalizedVendor[]> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Refresh from ERP if requested
    if (refresh) {
      await this.syncVendors(connectionId, connection.provider);
    }

    // Get from database
    const vendors = await sql`
      SELECT * FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
      AND is_active = true
      ORDER BY vendor_name ASC
    `;

    return vendors.map(v => this.normalizeVendor(v));
  }

  /**
   * Get a single vendor
   */
  async getVendor(connectionId: string, vendorId: string): Promise<NormalizedVendor | null> {
    const [vendor] = await sql`
      SELECT * FROM erp_vendors
      WHERE erp_connection_id = ${connectionId}
      AND external_vendor_id = ${vendorId}
    `;

    if (!vendor) {
      return null;
    }

    return this.normalizeVendor(vendor);
  }

  /**
   * Sync vendors from ERP
   */
  private async syncVendors(connectionId: string, provider: string): Promise<number> {
    let count = 0;

    switch (provider) {
      case 'quickbooks':
        const qbVendors = await quickbooks.fetchVendors(connectionId);
        for (const v of qbVendors) {
          await quickbooks.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'xero':
        const xeroContacts = await xero.fetchContacts(connectionId, true);
        for (const c of xeroContacts) {
          await xero.syncContactToDatabase(connectionId, c);
          count++;
        }
        break;

      case 'netsuite':
        const nsVendors = await netsuite.fetchVendors(connectionId);
        for (const v of nsVendors) {
          await netsuite.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'sap':
        const sapVendors = await sap.fetchVendors(connectionId);
        for (const v of sapVendors) {
          await sap.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'oracle':
        const oracleVendors = await oracle.fetchVendors(connectionId);
        for (const v of oracleVendors) {
          await oracle.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'dynamics365':
        const d365Vendors = await dynamics365.fetchVendors(connectionId);
        const [d365Conn] = await sql`SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}`;
        for (const v of d365Vendors) {
          await dynamics365.syncVendorToDatabase(connectionId, v, d365Conn.dynamics_variant);
          count++;
        }
        break;

      case 'workday':
        const wdVendors = await workday.fetchVendors(connectionId);
        for (const v of wdVendors) {
          await workday.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'coupa':
        const coupaVendors = await coupa.fetchVendors(connectionId);
        for (const v of coupaVendors) {
          await coupa.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'sage_intacct':
        const siVendors = await sageIntacct.fetchVendors(connectionId);
        for (const v of siVendors) {
          await sageIntacct.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'acumatica':
        const acumVendors = await acumatica.fetchVendors(connectionId);
        for (const v of acumVendors) {
          await acumatica.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;

      case 'infor':
        const inforVendors = await infor.fetchVendors(connectionId);
        for (const v of inforVendors) {
          await infor.syncVendorToDatabase(connectionId, v);
          count++;
        }
        break;
    }

    return count;
  }

  // ============================================================================
  // Unified Invoice/Bill Operations
  // ============================================================================

  /**
   * Get invoices/bills from any connected ERP
   */
  async getInvoices(
    connectionId: string,
    options: {
      status?: 'pending' | 'intercepted' | 'paid_external';
      vendorId?: string;
      refresh?: boolean;
    } = {}
  ): Promise<NormalizedInvoice[]> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Refresh from ERP if requested
    if (options.refresh) {
      await this.syncBills(connectionId, connection.provider);
    }

    // Build query
    let bills;
    if (options.status && options.vendorId) {
      bills = await sql`
        SELECT b.*, v.vendor_name, v.email as vendor_email, v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = ${options.status}
        AND b.external_vendor_id = ${options.vendorId}
        ORDER BY b.due_date ASC
      `;
    } else if (options.status) {
      bills = await sql`
        SELECT b.*, v.vendor_name, v.email as vendor_email, v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = ${options.status}
        ORDER BY b.due_date ASC
      `;
    } else if (options.vendorId) {
      bills = await sql`
        SELECT b.*, v.vendor_name, v.email as vendor_email, v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.external_vendor_id = ${options.vendorId}
        ORDER BY b.due_date ASC
      `;
    } else {
      bills = await sql`
        SELECT b.*, v.vendor_name, v.email as vendor_email, v.enrolled_in_wells
        FROM erp_bills b
        LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
          AND b.erp_connection_id = v.erp_connection_id
        WHERE b.erp_connection_id = ${connectionId}
        AND b.status = 'pending'
        ORDER BY b.due_date ASC
      `;
    }

    return bills.map(b => this.normalizeInvoice(b));
  }

  /**
   * Get a single invoice
   */
  async getInvoice(connectionId: string, invoiceId: string): Promise<NormalizedInvoice | null> {
    const [bill] = await sql`
      SELECT b.*, v.vendor_name, v.email as vendor_email
      FROM erp_bills b
      LEFT JOIN erp_vendors v ON b.external_vendor_id = v.external_vendor_id
        AND b.erp_connection_id = v.erp_connection_id
      WHERE b.erp_connection_id = ${connectionId}
      AND b.external_bill_id = ${invoiceId}
    `;

    if (!bill) {
      return null;
    }

    return this.normalizeInvoice(bill);
  }

  /**
   * Sync bills from ERP
   */
  private async syncBills(connectionId: string, provider: string): Promise<number> {
    let count = 0;

    switch (provider) {
      case 'quickbooks':
        const qbBills = await quickbooks.fetchBills(connectionId);
        for (const b of qbBills) {
          await quickbooks['syncBillToDatabase'](connectionId, b);
          count++;
        }
        break;

      case 'xero':
        const xeroInvoices = await xero.fetchInvoices(connectionId, 'ACCPAY', 'AUTHORISED');
        for (const i of xeroInvoices) {
          await xero['syncInvoiceToDatabase'](connectionId, i);
          count++;
        }
        break;

      case 'netsuite':
        const nsBills = await netsuite.fetchBills(connectionId);
        for (const b of nsBills) {
          await netsuite.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'sap':
        const sapBills = await sap.fetchBills(connectionId);
        for (const b of sapBills) {
          await sap.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'oracle':
        const oracleBills = await oracle.fetchBills(connectionId);
        for (const b of oracleBills) {
          await oracle.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'dynamics365':
        const d365Bills = await dynamics365.fetchInvoices(connectionId);
        const [d365BillConn] = await sql`SELECT dynamics_variant FROM erp_connections WHERE id = ${connectionId}`;
        for (const b of d365Bills) {
          await dynamics365.syncInvoiceToDatabase(connectionId, b, d365BillConn.dynamics_variant);
          count++;
        }
        break;

      case 'workday':
        const wdBills = await workday.fetchBills(connectionId);
        for (const b of wdBills) {
          await workday.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'coupa':
        const coupaBills = await coupa.fetchBills(connectionId);
        for (const b of coupaBills) {
          await coupa.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'sage_intacct':
        const siBills = await sageIntacct.fetchBills(connectionId);
        for (const b of siBills) {
          await sageIntacct.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'acumatica':
        const acumBills = await acumatica.fetchBills(connectionId);
        for (const b of acumBills) {
          await acumatica.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;

      case 'infor':
        const inforBills = await infor.fetchBills(connectionId);
        for (const b of inforBills) {
          await infor.syncBillToDatabase(connectionId, b);
          count++;
        }
        break;
    }

    return count;
  }

  // ============================================================================
  // Unified Payment Operations
  // ============================================================================

  /**
   * Get payments from any connected ERP
   */
  async getPayments(
    connectionId: string,
    options: {
      vendorId?: string;
      startDate?: Date;
      refresh?: boolean;
    } = {}
  ): Promise<NormalizedPayment[]> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Refresh from ERP if requested
    if (options.refresh) {
      await this.syncPayments(connectionId, connection.provider, options.startDate);
    }

    // Build query
    let payments;
    if (options.vendorId) {
      payments = await sql`
        SELECT p.*, v.vendor_name
        FROM erp_payments p
        LEFT JOIN erp_vendors v ON p.external_vendor_id = v.external_vendor_id
          AND p.erp_connection_id = v.erp_connection_id
        WHERE p.erp_connection_id = ${connectionId}
        AND p.external_vendor_id = ${options.vendorId}
        ORDER BY p.payment_date DESC
      `;
    } else {
      payments = await sql`
        SELECT p.*, v.vendor_name
        FROM erp_payments p
        LEFT JOIN erp_vendors v ON p.external_vendor_id = v.external_vendor_id
          AND p.erp_connection_id = v.erp_connection_id
        WHERE p.erp_connection_id = ${connectionId}
        ORDER BY p.payment_date DESC
        LIMIT 100
      `;
    }

    return payments.map(p => this.normalizePayment(p));
  }

  /**
   * Create a payment in the connected ERP
   */
  async createPayment(
    connectionId: string,
    payment: {
      vendorId: string;
      billId: string;
      amount: number;
      paymentDate?: Date;
      bankAccountId?: string;
      memo?: string;
    }
  ): Promise<NormalizedPayment> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Connection not found');
    }

    const paymentDate = payment.paymentDate || new Date();
    let result: any;

    switch (connection.provider) {
      case 'quickbooks':
        result = await quickbooks.createPayment(
          connectionId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || 'default',
          payment.memo
        );
        break;

      case 'xero':
        result = await xero.createPayment(
          connectionId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || 'WELLS-PAYMENTS',
          payment.memo
        );
        break;

      case 'netsuite':
        result = await netsuite.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || '1',
          payment.memo
        );
        break;

      case 'sap':
        result = await sap.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || '100000',
          payment.memo
        );
        break;

      case 'oracle':
        result = await oracle.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || 'default',
          payment.memo
        );
        break;

      case 'dynamics365':
        result = await dynamics365.createPayment(
          connectionId,
          payment.billId,
          payment.vendorId,
          payment.amount,
          paymentDate,
          payment.memo
        );
        break;

      case 'workday':
        result = await workday.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId,
          payment.memo
        );
        break;

      case 'coupa':
        result = await coupa.createPayment(
          connectionId,
          payment.billId,
          payment.vendorId,
          payment.amount,
          paymentDate,
          { memo: payment.memo }
        );
        break;

      case 'sage_intacct':
        result = await sageIntacct.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId || 'default',
          { memo: payment.memo }
        );
        break;

      case 'acumatica':
        result = await acumatica.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          payment.bankAccountId,
          payment.memo
        );
        break;

      case 'infor':
        result = await infor.createPayment(
          connectionId,
          payment.vendorId,
          payment.billId,
          payment.amount,
          paymentDate,
          { bankAccountId: payment.bankAccountId, memo: payment.memo }
        );
        break;

      default:
        throw new Error(`Unsupported provider: ${connection.provider}`);
    }

    // Record in database
    const [bill] = await sql`
      SELECT id, wells_fee_amount FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
      AND external_bill_id = ${payment.billId}
    `;

    const [dbPayment] = await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        erp_bill_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        processed_by_wells,
        wells_transaction_id,
        wells_fee_collected,
        memo
      ) VALUES (
        ${connectionId},
        ${bill?.id || null},
        ${result.id || result.Id || result.PaymentID || result.DocEntry?.toString() || crypto.randomUUID()},
        ${payment.vendorId},
        ${payment.amount},
        ${connection.provider},
        ${paymentDate.toISOString()},
        true,
        ${crypto.randomUUID()},
        ${bill?.wells_fee_amount || payment.amount * 0.01},
        ${payment.memo || null}
      )
      RETURNING *
    `;

    // Update bill status
    if (bill) {
      await sql`
        UPDATE erp_bills
        SET
          status = 'intercepted',
          paid_status = 'paid',
          amount_paid = total_amount,
          intercept_executed = true,
          intercept_executed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${bill.id}
      `;
    }

    return this.normalizePayment(dbPayment);
  }

  /**
   * Sync payments from ERP
   */
  private async syncPayments(connectionId: string, provider: string, startDate?: Date): Promise<number> {
    let count = 0;

    switch (provider) {
      case 'quickbooks':
        const qbPayments = await quickbooks.fetchPayments(connectionId, startDate);
        // Note: QB doesn't have a direct syncPaymentToDatabase method in the original code
        count = qbPayments.length;
        break;

      case 'xero':
        const xeroPayments = await xero.fetchPayments(connectionId);
        count = xeroPayments.length;
        break;

      case 'netsuite':
        const nsPayments = await netsuite.fetchPayments(connectionId, startDate);
        for (const p of nsPayments) {
          await netsuite.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'sap':
        const sapPayments = await sap.fetchPayments(connectionId, startDate);
        for (const p of sapPayments) {
          await sap.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'oracle':
        const oraclePayments = await oracle.fetchPayments(connectionId, startDate);
        for (const p of oraclePayments) {
          await oracle.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'dynamics365':
        const d365Payments = await dynamics365.fetchPayments(connectionId, { dateFrom: startDate });
        count = d365Payments.length;
        break;

      case 'workday':
        const wdPayments = await workday.fetchPayments(connectionId, startDate);
        for (const p of wdPayments) {
          await workday.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'coupa':
        const coupaPayments = await coupa.fetchPayments(connectionId, { dateFrom: startDate });
        for (const p of coupaPayments) {
          await coupa.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'sage_intacct':
        const siPayments = await sageIntacct.fetchPayments(connectionId, startDate);
        for (const p of siPayments) {
          await sageIntacct.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'acumatica':
        const acumPayments = await acumatica.fetchPayments(connectionId, { dateFrom: startDate });
        for (const p of acumPayments) {
          await acumatica.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;

      case 'infor':
        const inforPayments = await infor.fetchPayments(connectionId, { dateFrom: startDate });
        for (const p of inforPayments) {
          await infor.syncPaymentToDatabase(connectionId, p);
          count++;
        }
        break;
    }

    return count;
  }

  // ============================================================================
  // Full Sync Operations
  // ============================================================================

  /**
   * Perform a full sync for any ERP connection
   */
  async fullSync(connectionId: string): Promise<SyncResult> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      return {
        success: false,
        billsFound: 0,
        vendorsFound: 0,
        paymentsFound: 0,
        interceptsCreated: 0,
        errors: ['Connection not found'],
      };
    }

    const errors: string[] = [];
    let billsFound = 0;
    let vendorsFound = 0;
    let paymentsFound = 0;

    try {
      switch (connection.provider) {
        case 'quickbooks':
          // QuickBooks sync
          try {
            const qbVendors = await quickbooks.fetchVendors(connectionId);
            for (const v of qbVendors) {
              await quickbooks.syncVendorToDatabase(connectionId, v);
              vendorsFound++;
            }
          } catch (e: any) {
            errors.push(`Vendor sync error: ${e.message}`);
          }

          try {
            const qbBills = await quickbooks.fetchBills(connectionId);
            for (const b of qbBills) {
              await quickbooks['syncBillToDatabase'](connectionId, b);
              billsFound++;
            }
          } catch (e: any) {
            errors.push(`Bill sync error: ${e.message}`);
          }
          break;

        case 'xero':
          // Xero sync
          try {
            const xeroContacts = await xero.fetchContacts(connectionId, true);
            for (const c of xeroContacts) {
              await xero.syncContactToDatabase(connectionId, c);
              vendorsFound++;
            }
          } catch (e: any) {
            errors.push(`Contact sync error: ${e.message}`);
          }

          try {
            const xeroInvoices = await xero.fetchInvoices(connectionId, 'ACCPAY', 'AUTHORISED');
            for (const i of xeroInvoices) {
              await xero['syncInvoiceToDatabase'](connectionId, i);
              billsFound++;
            }
          } catch (e: any) {
            errors.push(`Invoice sync error: ${e.message}`);
          }
          break;

        case 'netsuite':
          const nsResult = await netsuite.fullSync(connectionId);
          billsFound = nsResult.billsFound;
          vendorsFound = nsResult.vendorsFound;
          paymentsFound = nsResult.paymentsFound;
          break;

        case 'sap':
          const sapResult = await sap.fullSync(connectionId);
          billsFound = sapResult.billsFound;
          vendorsFound = sapResult.vendorsFound;
          paymentsFound = sapResult.paymentsFound;
          break;

        case 'oracle':
          const oracleResult = await oracle.fullSync(connectionId);
          billsFound = oracleResult.invoicesFound;
          vendorsFound = oracleResult.vendorsFound;
          paymentsFound = oracleResult.paymentsFound;
          if (oracleResult.errors?.length) errors.push(...oracleResult.errors);
          break;

        case 'dynamics365':
          const d365Result = await dynamics365.fullSync(connectionId);
          billsFound = d365Result.invoicesFound;
          vendorsFound = d365Result.vendorsFound;
          paymentsFound = d365Result.paymentsFound;
          if (d365Result.errors?.length) errors.push(...d365Result.errors);
          break;

        case 'workday':
          const wdResult = await workday.fullSync(connectionId);
          billsFound = wdResult.billsFound;
          vendorsFound = wdResult.vendorsFound;
          paymentsFound = wdResult.paymentsFound;
          break;

        case 'coupa':
          const coupaResult = await coupa.fullSync(connectionId);
          billsFound = coupaResult.invoicesFound;
          vendorsFound = coupaResult.vendorsFound;
          paymentsFound = coupaResult.paymentsFound;
          if (coupaResult.errors?.length) errors.push(...coupaResult.errors);
          break;

        case 'sage_intacct':
          const siResult = await sageIntacct.fullSync(connectionId);
          billsFound = siResult.billsFound;
          vendorsFound = siResult.vendorsFound;
          paymentsFound = siResult.paymentsFound;
          break;

        case 'acumatica':
          const acumResult = await acumatica.fullSync(connectionId);
          billsFound = acumResult.billsFound;
          vendorsFound = acumResult.vendorsFound;
          paymentsFound = acumResult.paymentsFound;
          if (acumResult.errors?.length) errors.push(...acumResult.errors);
          break;

        case 'infor':
          const inforResult = await infor.fullSync(connectionId);
          billsFound = inforResult.billsFound;
          vendorsFound = inforResult.vendorsFound;
          paymentsFound = inforResult.paymentsFound;
          if (inforResult.errors?.length) errors.push(...inforResult.errors);
          break;

        default:
          errors.push(`Unsupported provider: ${connection.provider}`);
      }
    } catch (e: any) {
      errors.push(`Sync failed: ${e.message}`);
    }

    // Update connection status
    await sql`
      UPDATE erp_connections
      SET
        last_sync_at = NOW(),
        last_sync_status = ${errors.length > 0 ? 'partial' : 'completed'},
        last_sync_error = ${errors.length > 0 ? errors.join('; ') : null},
        next_sync_at = NOW() + INTERVAL '4 hours',
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;

    return {
      success: errors.length === 0,
      billsFound,
      vendorsFound,
      paymentsFound,
      interceptsCreated: 0, // Will be updated by intercept service
      errors,
    };
  }

  /**
   * Test connection for any ERP
   */
  async testConnection(connectionId: string): Promise<boolean> {
    const [connection] = await sql`
      SELECT provider FROM erp_connections WHERE id = ${connectionId}
    `;

    if (!connection) {
      return false;
    }

    switch (connection.provider) {
      case 'quickbooks':
        try {
          await quickbooks.getCompanyInfo(connectionId);
          return true;
        } catch {
          return false;
        }

      case 'xero':
        try {
          await xero.getOrganisation(connectionId);
          return true;
        } catch {
          return false;
        }

      case 'netsuite':
        return await netsuite.testConnection(connectionId);

      case 'sap':
        return await sap.testConnection(connectionId);

      case 'oracle':
        return await oracle.testConnection(connectionId);

      case 'dynamics365':
        return await dynamics365.testConnection(connectionId);

      case 'workday':
        return await workday.testConnection(connectionId);

      case 'coupa':
        return await coupa.testConnection(connectionId);

      case 'sage_intacct':
        return await sageIntacct.testConnection(connectionId);

      case 'acumatica':
        return await acumatica.testConnection(connectionId);

      case 'infor':
        return await infor.testConnection(connectionId);

      default:
        return false;
    }
  }

  // ============================================================================
  // Data Normalization
  // ============================================================================

  private normalizeVendor(v: any): NormalizedVendor {
    return {
      id: v.id,
      externalId: v.external_vendor_id,
      name: v.vendor_name || v.vendor_display_name,
      email: v.email,
      phone: v.phone,
      address: {
        line1: v.address_line1,
        line2: v.address_line2,
        city: v.city,
        state: v.state,
        postalCode: v.postal_code,
        country: v.country,
      },
      taxId: v.tax_id,
      currency: v.default_currency || 'USD',
      paymentTerms: v.payment_terms,
      isActive: v.is_active,
      enrolledInWells: v.enrolled_in_wells || false,
      wellsSupplierId: v.wells_supplier_id,
      metadata: v.raw_data,
    };
  }

  private normalizeInvoice(b: any): NormalizedInvoice {
    return {
      id: b.id,
      externalId: b.external_bill_id,
      vendorId: b.external_vendor_id,
      vendorName: b.vendor_name,
      vendorEmail: b.vendor_email,
      invoiceNumber: b.bill_number,
      amount: parseFloat(b.total_amount),
      amountDue: parseFloat(b.total_amount) - parseFloat(b.amount_paid || 0),
      currency: b.currency || 'USD',
      invoiceDate: new Date(b.bill_date),
      dueDate: new Date(b.due_date),
      status: b.status === 'intercepted' ? 'paid' : (b.paid_status === 'paid' ? 'paid' : (b.paid_status === 'partial' ? 'partial' : 'pending')),
      lineItems: b.line_items,
      wellsFee: parseFloat(b.wells_fee_amount || 0),
      potentialSavings: parseFloat(b.net_customer_savings || 0),
      interceptProposed: b.intercept_proposed,
      interceptAccepted: b.intercept_accepted,
      metadata: b.raw_data,
    };
  }

  private normalizePayment(p: any): NormalizedPayment {
    return {
      id: p.id,
      externalId: p.external_payment_id,
      invoiceId: p.erp_bill_id,
      vendorId: p.external_vendor_id,
      vendorName: p.vendor_name,
      amount: parseFloat(p.payment_amount),
      currency: 'USD',
      paymentDate: new Date(p.payment_date),
      paymentMethod: p.payment_method,
      status: 'completed',
      processedByWells: p.processed_by_wells || false,
      wellsTransactionId: p.wells_transaction_id,
      wellsFeeCollected: parseFloat(p.wells_fee_collected || 0),
      reference: p.reference_number || p.memo,
      metadata: p.raw_data,
    };
  }
}

export const unifiedERP = new UnifiedERPService();
export default unifiedERP;
