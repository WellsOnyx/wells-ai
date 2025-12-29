// @ts-nocheck
/**
 * Conversational ERP - Business Logic
 *
 * Provides the core business logic for conversational ERP operations.
 * Connects with QuickBooks, Xero, and other accounting systems to enable
 * natural language financial management.
 *
 * Features:
 * - Multi-provider ERP connection (QuickBooks, Xero, Sage, NetSuite)
 * - Real-time financial data queries
 * - Conversational invoice and bill management
 * - Spending analysis and P&L insights
 * - Transaction sync and reconciliation
 * - Vendor/customer management
 *
 * All operations include 1% Wells AI fee on transactions.
 */

import { sql } from '@vercel/postgres';
import { quickbooks } from './quickbooks';
import { xero } from './xero';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ERPConnection,
  ERPBill,
  ERPVendor,
  ERPPayment,
  ERPProvider,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

export type ERPProviderType = 'quickbooks' | 'xero' | 'sage' | 'netsuite' | 'freshbooks';

export interface ERPChatContext {
  userId: string;
  sessionId: string;
  companyId?: string;
  previousMessages?: Array<{ role: string; content: string }>;
  userPreferences?: Record<string, any>;
}

export interface ERPOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface CreateInvoiceParams {
  customerName: string;
  amount?: number;
  description?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount?: number;
  }>;
  dueDate?: string;
  customerEmail?: string;
}

export interface RecordPaymentParams {
  invoiceIdentifier: string;
  amount?: number;
  paymentDate?: string;
  paymentMethod?: 'ach' | 'wire' | 'check' | 'card' | 'grain';
}

export interface PayBillParams {
  billIdentifier: string;
  amount?: number;
  paymentMethod?: 'ach' | 'wire' | 'check' | 'card' | 'grain';
  paymentDate?: string;
}

export interface SchedulePaymentParams {
  billIdentifier: string;
  paymentDate: string;
  paymentMethod?: 'ach' | 'wire' | 'check' | 'card' | 'grain';
}

export interface AddVendorParams {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  paymentTerms?: string;
  category?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface AddCustomerParams {
  name: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
}

// ============================================================================
// CONVERSATIONAL ERP SERVICE
// ============================================================================

export class ConversationalERP {
  private userId: string;
  private companyId: string | undefined;
  private anthropic: Anthropic;
  private connectionCache: Map<string, ERPConnection> = new Map();

  constructor(userId: string, companyId?: string) {
    this.userId = userId;
    this.companyId = companyId;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // =========================================================================
  // CONNECTION MANAGEMENT
  // =========================================================================

  /**
   * Initialize connection to an ERP provider
   */
  async connectERP(
    provider: ERPProviderType,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Generate a unique state token for OAuth
      const state = `${context.userId}_${provider}_${Date.now()}`;

      // Store the state for verification later
      await sql`
        INSERT INTO erp_oauth_states (
          state_token,
          user_id,
          provider,
          created_at,
          expires_at
        ) VALUES (
          ${state},
          ${context.userId},
          ${provider},
          NOW(),
          NOW() + INTERVAL '1 hour'
        )
      `;

      // Get authorization URL based on provider
      let authUrl: string;
      switch (provider) {
        case 'quickbooks':
          authUrl = quickbooks.getAuthorizationUrl(state);
          break;
        case 'xero':
          authUrl = xero.getAuthorizationUrl(state);
          break;
        default:
          // For providers not yet implemented, return a placeholder
          authUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://wellsai.app'}/api/erp/${provider}/connect?state=${state}`;
      }

      return {
        success: true,
        message: `Ready to connect to ${provider}. Please authorize access.`,
        data: {
          authUrl,
          provider,
          state,
        },
      };
    } catch (error) {
      console.error('Error initiating ERP connection:', error);
      return {
        success: false,
        message: `Failed to initiate connection to ${provider}.`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect an ERP provider
   */
  async disconnectERP(
    provider: ERPProviderType | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      if (provider) {
        await sql`
          UPDATE erp_connections
          SET connection_status = 'disconnected', updated_at = NOW()
          WHERE company_id = ${this.companyId || context.userId}
            AND provider = ${provider}
        `;
      } else {
        // Disconnect all
        await sql`
          UPDATE erp_connections
          SET connection_status = 'disconnected', updated_at = NOW()
          WHERE company_id = ${this.companyId || context.userId}
        `;
      }

      return {
        success: true,
        message: provider
          ? `Disconnected from ${provider}.`
          : 'Disconnected from all accounting systems.',
      };
    } catch (error) {
      console.error('Error disconnecting ERP:', error);
      return {
        success: false,
        message: 'Failed to disconnect.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connection status for all providers
   */
  async getConnectionStatus(context: ERPChatContext): Promise<ERPOperationResult> {
    try {
      const result = await sql`
        SELECT
          provider,
          connection_status as status,
          company_name,
          last_sync_at as "lastSync",
          last_sync_status as "lastSyncStatus"
        FROM erp_connections
        WHERE company_id = ${this.companyId || context.userId}
        ORDER BY created_at DESC
      `;

      return {
        success: true,
        message: 'Connection status retrieved.',
        data: {
          connections: result.rows,
        },
      };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        success: false,
        message: 'Failed to get connection status.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get active connection for making API calls
   */
  private async getActiveConnection(provider?: ERPProviderType): Promise<ERPConnection | null> {
    try {
      const cacheKey = `${this.companyId || this.userId}_${provider || 'any'}`;
      if (this.connectionCache.has(cacheKey)) {
        return this.connectionCache.get(cacheKey)!;
      }

      let query = `
        SELECT * FROM erp_connections
        WHERE company_id = $1
          AND connection_status = 'active'
      `;
      const params: any[] = [this.companyId || this.userId];

      if (provider) {
        query += ' AND provider = $2';
        params.push(provider);
      }

      query += ' LIMIT 1';

      const result = await sql.query(query, params);

      if (result.rows.length > 0) {
        this.connectionCache.set(cacheKey, result.rows[0]);
        return result.rows[0];
      }

      return null;
    } catch (error) {
      console.error('Error getting active connection:', error);
      return null;
    }
  }

  // =========================================================================
  // TRANSACTION SYNC
  // =========================================================================

  /**
   * Sync transactions from connected ERP
   */
  async syncTransactions(
    provider: ERPProviderType | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const connection = await this.getActiveConnection(provider);
      if (!connection) {
        return {
          success: false,
          message: 'No active accounting connection found. Would you like to connect QuickBooks or Xero?',
        };
      }

      // Start sync log
      const syncLogResult = await sql`
        INSERT INTO erp_sync_logs (
          erp_connection_id,
          sync_type,
          status,
          started_at
        ) VALUES (
          ${connection.id},
          'incremental',
          'started',
          NOW()
        )
        RETURNING id
      `;
      const syncLogId = syncLogResult.rows[0].id;

      let invoicesAdded = 0;
      let billsAdded = 0;
      let paymentsRecorded = 0;
      let vendorsUpdated = 0;

      // Sync based on provider
      if (connection.provider === 'quickbooks') {
        // Fetch bills
        const bills = await quickbooks.fetchBills(connection.id, connection.last_sync_at);
        for (const bill of bills) {
          await quickbooks.syncBillToDatabase(connection.id, bill);
          billsAdded++;
        }

        // Fetch vendors
        const vendors = await quickbooks.fetchVendors(connection.id);
        for (const vendor of vendors) {
          await quickbooks.syncVendorToDatabase(connection.id, vendor);
          vendorsUpdated++;
        }

        // Fetch payments
        const payments = await quickbooks.fetchPayments(connection.id, connection.last_sync_at);
        paymentsRecorded = payments.length;
      } else if (connection.provider === 'xero') {
        // Fetch bills (ACCPAY invoices)
        const bills = await xero.fetchInvoices(connection.id, 'ACCPAY');
        for (const bill of bills) {
          await xero.syncInvoiceToDatabase(connection.id, bill);
          billsAdded++;
        }

        // Fetch AR invoices
        const invoices = await xero.fetchInvoices(connection.id, 'ACCREC');
        invoicesAdded = invoices.length;

        // Fetch contacts
        const contacts = await xero.fetchContacts(connection.id, true);
        for (const contact of contacts) {
          await xero.syncContactToDatabase(connection.id, contact);
          vendorsUpdated++;
        }
      }

      // Update sync log
      await sql`
        UPDATE erp_sync_logs
        SET
          status = 'completed',
          bills_found = ${billsAdded},
          vendors_found = ${vendorsUpdated},
          records_created = ${invoicesAdded + billsAdded},
          completed_at = NOW()
        WHERE id = ${syncLogId}
      `;

      // Update connection last sync time
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'success'
        WHERE id = ${connection.id}
      `;

      return {
        success: true,
        message: 'Sync completed successfully.',
        data: {
          invoicesAdded,
          billsAdded,
          paymentsRecorded,
          vendorsUpdated,
          provider: connection.provider,
        },
      };
    } catch (error) {
      console.error('Error syncing transactions:', error);
      return {
        success: false,
        message: 'Failed to sync transactions.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // ACCOUNTS PAYABLE / RECEIVABLE
  // =========================================================================

  /**
   * Get accounts payable summary
   */
  async getAccountsPayable(
    period: string | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const connection = await this.getActiveConnection();

      // If no ERP connection, use Wells ERP data
      const query = connection
        ? `
          SELECT
            SUM(total_amount - amount_paid) as total_due,
            SUM(CASE WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN total_amount - amount_paid ELSE 0 END) as due_this_week,
            SUM(CASE WHEN due_date < CURRENT_DATE THEN total_amount - amount_paid ELSE 0 END) as overdue,
            COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_count
          FROM erp_bills
          WHERE erp_connection_id = $1
            AND status != 'paid_external'
            AND paid_status != 'paid'
        `
        : `
          SELECT
            SUM(total_amount - amount_paid) as total_due,
            SUM(CASE WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN total_amount - amount_paid ELSE 0 END) as due_this_week,
            SUM(CASE WHEN due_date < CURRENT_DATE THEN total_amount - amount_paid ELSE 0 END) as overdue,
            COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_count
          FROM wells_purchase_orders
          WHERE user_id = $1
            AND status NOT IN ('completed', 'cancelled')
        `;

      const result = await sql.query(query, [connection?.id || this.userId]);
      const ap = result.rows[0];

      // Get top vendors
      const topVendorsQuery = connection
        ? `
          SELECT
            vendor_name as name,
            SUM(total_amount - amount_paid) as amount
          FROM erp_bills
          WHERE erp_connection_id = $1
            AND status != 'paid_external'
            AND paid_status != 'paid'
          GROUP BY vendor_name
          ORDER BY amount DESC
          LIMIT 5
        `
        : `
          SELECT
            supplier_name as name,
            SUM(total_amount - amount_paid) as amount
          FROM wells_purchase_orders
          WHERE user_id = $1
            AND status NOT IN ('completed', 'cancelled')
          GROUP BY supplier_name
          ORDER BY amount DESC
          LIMIT 5
        `;

      const topVendorsResult = await sql.query(topVendorsQuery, [connection?.id || this.userId]);

      return {
        success: true,
        message: 'Accounts payable retrieved.',
        data: {
          totalDue: parseFloat(ap.total_due) || 0,
          dueThisWeek: parseFloat(ap.due_this_week) || 0,
          overdue: parseFloat(ap.overdue) || 0,
          overdueCount: parseInt(ap.overdue_count) || 0,
          topVendors: topVendorsResult.rows.map(v => ({
            name: v.name,
            amount: parseFloat(v.amount) || 0,
          })),
        },
      };
    } catch (error) {
      console.error('Error getting AP:', error);
      return {
        success: false,
        message: 'Failed to get accounts payable.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get accounts receivable summary
   */
  async getAccountsReceivable(
    period: string | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Use Wells ERP invoices
      const result = await sql`
        SELECT
          SUM(total_amount - amount_paid) as total_due,
          SUM(CASE WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN total_amount - amount_paid ELSE 0 END) as due_this_week,
          SUM(CASE WHEN due_date < CURRENT_DATE THEN total_amount - amount_paid ELSE 0 END) as overdue,
          COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_count
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND status NOT IN ('paid', 'cancelled')
      `;

      const ar = result.rows[0];

      // Get top customers
      const topCustomersResult = await sql`
        SELECT
          vendor_name as name,
          SUM(total_amount - amount_paid) as amount
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND status NOT IN ('paid', 'cancelled')
        GROUP BY vendor_name
        ORDER BY amount DESC
        LIMIT 5
      `;

      return {
        success: true,
        message: 'Accounts receivable retrieved.',
        data: {
          totalDue: parseFloat(ar.total_due) || 0,
          dueThisWeek: parseFloat(ar.due_this_week) || 0,
          overdue: parseFloat(ar.overdue) || 0,
          overdueCount: parseInt(ar.overdue_count) || 0,
          topCustomers: topCustomersResult.rows.map(c => ({
            name: c.name,
            amount: parseFloat(c.amount) || 0,
          })),
        },
      };
    } catch (error) {
      console.error('Error getting AR:', error);
      return {
        success: false,
        message: 'Failed to get accounts receivable.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get cash position
   */
  async getCashPosition(context: ERPChatContext): Promise<ERPOperationResult> {
    try {
      // Get from treasury/grain balance if available
      const treasuryResult = await sql`
        SELECT
          grain_balance,
          credit_balance,
          credit_limit
        FROM treasury_accounts
        WHERE clerk_user_id = ${this.userId}
        LIMIT 1
      `;

      // Get projected inflows (AR due in 30 days)
      const inflowsResult = await sql`
        SELECT COALESCE(SUM(total_amount - amount_paid), 0) as projected_inflows
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND status NOT IN ('paid', 'cancelled')
          AND due_date <= CURRENT_DATE + INTERVAL '30 days'
      `;

      // Get projected outflows (AP due in 30 days)
      const outflowsResult = await sql`
        SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) as projected_outflows
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND status NOT IN ('completed', 'cancelled')
      `;

      const treasury = treasuryResult.rows[0] || {};
      const totalCash = parseFloat(treasury.grain_balance || 0);
      const projectedInflows = parseFloat(inflowsResult.rows[0].projected_inflows || 0);
      const projectedOutflows = parseFloat(outflowsResult.rows[0].projected_outflows || 0);

      return {
        success: true,
        message: 'Cash position retrieved.',
        data: {
          totalCash,
          accounts: [
            { name: 'GRAIN Balance', balance: totalCash },
            { name: 'Credit Available', balance: parseFloat(treasury.credit_limit || 0) - parseFloat(treasury.credit_balance || 0) },
          ],
          projectedInflows,
          projectedOutflows,
          projectedNet: projectedInflows - projectedOutflows,
        },
      };
    } catch (error) {
      console.error('Error getting cash position:', error);
      return {
        success: false,
        message: 'Failed to get cash position.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // P&L AND FINANCIAL METRICS
  // =========================================================================

  /**
   * Get profit and loss statement
   */
  async getProfitAndLoss(
    period: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const dateRange = this.getDateRange(period);

      // Get revenue (paid invoices)
      const revenueResult = await sql`
        SELECT COALESCE(SUM(amount_paid), 0) as revenue
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND status = 'paid'
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
      `;

      // Get COGS from POs with specific categories
      const cogsResult = await sql`
        SELECT COALESCE(SUM(total_amount), 0) as cogs
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND status = 'completed'
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
      `;

      // Get operating expenses from Wells transactions
      const expensesResult = await sql`
        SELECT COALESCE(SUM(amount), 0) as expenses
        FROM wells_transactions
        WHERE user_id = ${this.userId}
          AND type = 'expense'
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
      `;

      const revenue = parseFloat(revenueResult.rows[0].revenue || 0);
      const cogs = parseFloat(cogsResult.rows[0].cogs || 0) * 0.7; // Estimate COGS as 70% of PO value
      const operatingExpenses = parseFloat(expensesResult.rows[0].expenses || 0);
      const grossProfit = revenue - cogs;
      const netIncome = grossProfit - operatingExpenses;
      const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0';
      const netMargin = revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : '0';

      return {
        success: true,
        message: 'P&L retrieved.',
        data: {
          revenue,
          cogs,
          grossProfit,
          grossMargin: parseFloat(grossMargin),
          operatingExpenses,
          netIncome,
          netMargin: parseFloat(netMargin),
          period,
        },
      };
    } catch (error) {
      console.error('Error getting P&L:', error);
      return {
        success: false,
        message: 'Failed to get P&L.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get gross margin
   */
  async getGrossMargin(
    period: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    const pnl = await this.getProfitAndLoss(period, context);

    if (pnl.success && pnl.data) {
      // Get previous period for trend
      const previousPeriod = this.getPreviousPeriod(period);
      const previousPnl = await this.getProfitAndLoss(previousPeriod, context);

      let trend: number | undefined;
      if (previousPnl.success && previousPnl.data?.grossMargin > 0) {
        trend = pnl.data.grossMargin - previousPnl.data.grossMargin;
      }

      return {
        success: true,
        message: 'Gross margin retrieved.',
        data: {
          grossMargin: pnl.data.grossMargin,
          revenue: pnl.data.revenue,
          cogs: pnl.data.cogs,
          grossProfit: pnl.data.grossProfit,
          trend,
        },
      };
    }

    return pnl;
  }

  /**
   * Get spending analysis
   */
  async getSpendingAnalysis(
    period: string,
    category: string | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const dateRange = this.getDateRange(period);

      // If specific category requested
      if (category) {
        const categoryResult = await sql`
          SELECT
            SUM(total_amount) as total,
            supplier_name as vendor_name
          FROM wells_purchase_orders
          WHERE user_id = ${this.userId}
            AND LOWER(category) LIKE ${`%${category.toLowerCase()}%`}
            AND created_at >= ${dateRange.start}
            AND created_at <= ${dateRange.end}
          GROUP BY supplier_name
          ORDER BY total DESC
        `;

        const totalSpendResult = await sql`
          SELECT COALESCE(SUM(total_amount), 0) as total
          FROM wells_purchase_orders
          WHERE user_id = ${this.userId}
            AND created_at >= ${dateRange.start}
            AND created_at <= ${dateRange.end}
        `;

        const categoryTotal = categoryResult.rows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
        const totalSpend = parseFloat(totalSpendResult.rows[0].total || 0);

        return {
          success: true,
          message: `Spending on ${category} retrieved.`,
          data: {
            categoryTotal,
            percentOfTotal: totalSpend > 0 ? ((categoryTotal / totalSpend) * 100).toFixed(1) : '0',
            categoryVendors: categoryResult.rows.map(r => ({
              name: r.vendor_name,
              amount: parseFloat(r.total || 0),
            })),
          },
        };
      }

      // General spending breakdown
      const categoriesResult = await sql`
        SELECT
          COALESCE(category, 'Uncategorized') as name,
          SUM(total_amount) as amount
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
        GROUP BY category
        ORDER BY amount DESC
      `;

      const topVendorsResult = await sql`
        SELECT
          supplier_name as name,
          SUM(total_amount) as amount
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
        GROUP BY supplier_name
        ORDER BY amount DESC
        LIMIT 10
      `;

      const totalSpend = categoriesResult.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

      return {
        success: true,
        message: 'Spending analysis retrieved.',
        data: {
          totalSpend,
          categories: categoriesResult.rows.map(c => ({
            name: c.name,
            amount: parseFloat(c.amount || 0),
            percent: totalSpend > 0 ? ((parseFloat(c.amount || 0) / totalSpend) * 100).toFixed(1) : '0',
          })),
          topVendors: topVendorsResult.rows.map(v => ({
            name: v.name,
            amount: parseFloat(v.amount || 0),
          })),
        },
      };
    } catch (error) {
      console.error('Error getting spending analysis:', error);
      return {
        success: false,
        message: 'Failed to get spending analysis.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get revenue breakdown
   */
  async getRevenueBreakdown(
    period: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const dateRange = this.getDateRange(period);

      const byCustomerResult = await sql`
        SELECT
          vendor_name as name,
          SUM(amount_paid) as amount
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND created_at >= ${dateRange.start}
          AND created_at <= ${dateRange.end}
        GROUP BY vendor_name
        ORDER BY amount DESC
        LIMIT 10
      `;

      const totalRevenue = byCustomerResult.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

      return {
        success: true,
        message: 'Revenue breakdown retrieved.',
        data: {
          totalRevenue,
          byCustomer: byCustomerResult.rows.map(c => ({
            name: c.name,
            amount: parseFloat(c.amount || 0),
            percent: totalRevenue > 0 ? ((parseFloat(c.amount || 0) / totalRevenue) * 100).toFixed(1) : '0',
          })),
          byCategory: [], // Would need invoice categories
        },
      };
    } catch (error) {
      console.error('Error getting revenue breakdown:', error);
      return {
        success: false,
        message: 'Failed to get revenue breakdown.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // INVOICE OPERATIONS
  // =========================================================================

  /**
   * Create a new invoice
   */
  async createInvoice(
    params: CreateInvoiceParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const invoiceNumber = `WELLS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const amount = params.amount || params.lineItems?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
      const wellsFee = amount * 0.01;
      const totalAmount = amount + wellsFee;
      const dueDate = params.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await sql`
        INSERT INTO wells_invoices (
          user_id,
          invoice_number,
          vendor_name,
          vendor_email,
          subtotal,
          wells_fee,
          total_amount,
          amount_paid,
          due_date,
          status,
          line_items,
          description,
          created_at,
          updated_at
        ) VALUES (
          ${this.userId},
          ${invoiceNumber},
          ${params.customerName},
          ${params.customerEmail || null},
          ${amount},
          ${wellsFee},
          ${totalAmount},
          0,
          ${dueDate},
          'draft',
          ${JSON.stringify(params.lineItems || [{ description: params.description || 'Services', quantity: 1, unitPrice: amount, amount }])},
          ${params.description || null},
          NOW(),
          NOW()
        )
        RETURNING id, invoice_number
      `;

      return {
        success: true,
        message: 'Invoice created successfully.',
        data: {
          id: result.rows[0].id,
          invoiceNumber: result.rows[0].invoice_number,
          customerName: params.customerName,
          amount,
          wellsFee,
          totalAmount,
          dueDate,
        },
      };
    } catch (error) {
      console.error('Error creating invoice:', error);
      return {
        success: false,
        message: 'Failed to create invoice.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List invoices
   */
  async listInvoices(
    criteria: { status?: string; customerName?: string },
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      let query = `
        SELECT
          id,
          invoice_number as "invoiceNumber",
          vendor_name as "customerName",
          vendor_email as "customerEmail",
          total_amount as total,
          amount_paid as "amountPaid",
          total_amount - amount_paid as "amountDue",
          due_date as "dueDate",
          status,
          created_at as "createdAt"
        FROM wells_invoices
        WHERE user_id = $1
      `;
      const params: any[] = [this.userId];

      if (criteria.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(criteria.status);
      }

      if (criteria.customerName) {
        query += ` AND LOWER(vendor_name) LIKE $${params.length + 1}`;
        params.push(`%${criteria.customerName.toLowerCase()}%`);
      }

      query += ' ORDER BY created_at DESC LIMIT 50';

      const result = await sql.query(query, params);

      return {
        success: true,
        message: 'Invoices retrieved.',
        data: {
          invoices: result.rows.map(inv => ({
            ...inv,
            total: parseFloat(inv.total || 0),
            amountPaid: parseFloat(inv.amountPaid || 0),
            amountDue: parseFloat(inv.amountDue || 0),
          })),
        },
      };
    } catch (error) {
      console.error('Error listing invoices:', error);
      return {
        success: false,
        message: 'Failed to list invoices.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an invoice
   */
  async sendInvoice(
    invoiceIdentifier: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Find invoice by number or customer name
      const invoiceResult = await sql`
        SELECT id, invoice_number, vendor_email, status
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND (invoice_number = ${invoiceIdentifier} OR LOWER(vendor_name) LIKE ${`%${invoiceIdentifier.toLowerCase()}%`})
        LIMIT 1
      `;

      if (invoiceResult.rows.length === 0) {
        return {
          success: false,
          message: `Invoice "${invoiceIdentifier}" not found.`,
        };
      }

      const invoice = invoiceResult.rows[0];

      // Update status to sent
      await sql`
        UPDATE wells_invoices
        SET status = 'sent', updated_at = NOW()
        WHERE id = ${invoice.id}
      `;

      // TODO: Actually send email via notification service

      return {
        success: true,
        message: 'Invoice sent successfully.',
        data: {
          invoiceNumber: invoice.invoice_number,
          sentTo: invoice.vendor_email,
        },
      };
    } catch (error) {
      console.error('Error sending invoice:', error);
      return {
        success: false,
        message: 'Failed to send invoice.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record a payment for an invoice
   */
  async recordPayment(
    params: RecordPaymentParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Find invoice
      const invoiceResult = await sql`
        SELECT id, invoice_number, total_amount, amount_paid
        FROM wells_invoices
        WHERE user_id = ${this.userId}
          AND (invoice_number = ${params.invoiceIdentifier} OR LOWER(vendor_name) LIKE ${`%${params.invoiceIdentifier.toLowerCase()}%`})
        LIMIT 1
      `;

      if (invoiceResult.rows.length === 0) {
        return {
          success: false,
          message: `Invoice "${params.invoiceIdentifier}" not found.`,
        };
      }

      const invoice = invoiceResult.rows[0];
      const amountDue = parseFloat(invoice.total_amount) - parseFloat(invoice.amount_paid);
      const paymentAmount = params.amount || amountDue;
      const newAmountPaid = parseFloat(invoice.amount_paid) + paymentAmount;
      const newStatus = newAmountPaid >= parseFloat(invoice.total_amount) ? 'paid' : 'partial';

      await sql`
        UPDATE wells_invoices
        SET
          amount_paid = ${newAmountPaid},
          status = ${newStatus},
          updated_at = NOW()
        WHERE id = ${invoice.id}
      `;

      return {
        success: true,
        message: 'Payment recorded.',
        data: {
          invoiceNumber: invoice.invoice_number,
          amountPaid: paymentAmount,
          totalPaid: newAmountPaid,
          status: newStatus,
        },
      };
    } catch (error) {
      console.error('Error recording payment:', error);
      return {
        success: false,
        message: 'Failed to record payment.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // BILL OPERATIONS
  // =========================================================================

  /**
   * List bills
   */
  async listBills(
    criteria: { status?: string; vendorName?: string },
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const connection = await this.getActiveConnection();

      if (connection) {
        // From ERP
        let query = `
          SELECT
            id,
            bill_number as "billNumber",
            vendor_name as "vendorName",
            total_amount as total,
            amount_paid as "amountPaid",
            total_amount - amount_paid as "amountDue",
            due_date as "dueDate",
            status
          FROM erp_bills
          WHERE erp_connection_id = $1
            AND paid_status != 'paid'
        `;
        const params: any[] = [connection.id];

        if (criteria.vendorName) {
          query += ` AND LOWER(vendor_name) LIKE $${params.length + 1}`;
          params.push(`%${criteria.vendorName.toLowerCase()}%`);
        }

        query += ' ORDER BY due_date ASC LIMIT 50';

        const result = await sql.query(query, params);

        return {
          success: true,
          message: 'Bills retrieved.',
          data: {
            bills: result.rows.map(bill => ({
              ...bill,
              total: parseFloat(bill.total || 0),
              amountPaid: parseFloat(bill.amountPaid || 0),
              amountDue: parseFloat(bill.amountDue || 0),
            })),
          },
        };
      }

      // From Wells POs
      let query = `
        SELECT
          id,
          po_number as "billNumber",
          supplier_name as "vendorName",
          total_amount as total,
          COALESCE(amount_paid, 0) as "amountPaid",
          total_amount - COALESCE(amount_paid, 0) as "amountDue",
          expected_delivery_date as "dueDate",
          status
        FROM wells_purchase_orders
        WHERE user_id = $1
          AND status NOT IN ('completed', 'cancelled')
      `;
      const params: any[] = [this.userId];

      if (criteria.vendorName) {
        query += ` AND LOWER(supplier_name) LIKE $${params.length + 1}`;
        params.push(`%${criteria.vendorName.toLowerCase()}%`);
      }

      query += ' ORDER BY expected_delivery_date ASC LIMIT 50';

      const result = await sql.query(query, params);

      return {
        success: true,
        message: 'Bills retrieved.',
        data: {
          bills: result.rows.map(bill => ({
            ...bill,
            total: parseFloat(bill.total || 0),
            amountPaid: parseFloat(bill.amountPaid || 0),
            amountDue: parseFloat(bill.amountDue || 0),
          })),
        },
      };
    } catch (error) {
      console.error('Error listing bills:', error);
      return {
        success: false,
        message: 'Failed to list bills.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pay a bill
   */
  async payBill(
    params: PayBillParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Find bill in ERP or Wells POs
      const connection = await this.getActiveConnection();

      if (connection) {
        const billResult = await sql`
          SELECT id, bill_number, vendor_name, total_amount, amount_paid
          FROM erp_bills
          WHERE erp_connection_id = ${connection.id}
            AND (bill_number = ${params.billIdentifier} OR LOWER(vendor_name) LIKE ${`%${params.billIdentifier.toLowerCase()}%`})
          LIMIT 1
        `;

        if (billResult.rows.length > 0) {
          const bill = billResult.rows[0];
          const amountDue = parseFloat(bill.total_amount) - parseFloat(bill.amount_paid);
          const paymentAmount = params.amount || amountDue;

          // Record payment through Wells (1% fee)
          const wellsFee = paymentAmount * 0.01;

          // Update bill status
          await sql`
            UPDATE erp_bills
            SET
              amount_paid = amount_paid + ${paymentAmount},
              paid_status = CASE WHEN amount_paid + ${paymentAmount} >= total_amount THEN 'paid' ELSE 'partial' END,
              intercept_executed = true,
              intercept_executed_at = NOW(),
              wells_fee_amount = ${wellsFee},
              updated_at = NOW()
            WHERE id = ${bill.id}
          `;

          // Log transaction
          await sql`
            INSERT INTO wells_transactions (
              user_id,
              type,
              amount,
              currency,
              description,
              reference_type,
              reference_id,
              wells_fee,
              created_at
            ) VALUES (
              ${this.userId},
              'payment',
              ${paymentAmount},
              'USD',
              ${`Bill payment to ${bill.vendor_name}`},
              'erp_bill',
              ${bill.id},
              ${wellsFee},
              NOW()
            )
          `;

          return {
            success: true,
            message: 'Payment processed.',
            data: {
              billNumber: bill.bill_number,
              vendorName: bill.vendor_name,
              amount: paymentAmount,
              wellsFee,
              paymentMethod: params.paymentMethod || 'grain',
            },
          };
        }
      }

      // Try Wells POs
      const poResult = await sql`
        SELECT id, po_number, supplier_name, total_amount, COALESCE(amount_paid, 0) as amount_paid
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND (po_number = ${params.billIdentifier} OR LOWER(supplier_name) LIKE ${`%${params.billIdentifier.toLowerCase()}%`})
        LIMIT 1
      `;

      if (poResult.rows.length === 0) {
        return {
          success: false,
          message: `Bill "${params.billIdentifier}" not found.`,
        };
      }

      const po = poResult.rows[0];
      const amountDue = parseFloat(po.total_amount) - parseFloat(po.amount_paid);
      const paymentAmount = params.amount || amountDue;
      const wellsFee = paymentAmount * 0.01;

      // Update PO
      await sql`
        UPDATE wells_purchase_orders
        SET
          amount_paid = COALESCE(amount_paid, 0) + ${paymentAmount},
          status = CASE WHEN COALESCE(amount_paid, 0) + ${paymentAmount} >= total_amount THEN 'completed' ELSE status END,
          updated_at = NOW()
        WHERE id = ${po.id}
      `;

      return {
        success: true,
        message: 'Payment processed.',
        data: {
          billNumber: po.po_number,
          vendorName: po.supplier_name,
          amount: paymentAmount,
          wellsFee,
          paymentMethod: params.paymentMethod || 'grain',
        },
      };
    } catch (error) {
      console.error('Error paying bill:', error);
      return {
        success: false,
        message: 'Failed to process payment.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Schedule a payment
   */
  async schedulePayment(
    params: SchedulePaymentParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Create scheduled payment record
      await sql`
        INSERT INTO wells_scheduled_payments (
          user_id,
          bill_identifier,
          scheduled_date,
          payment_method,
          status,
          created_at
        ) VALUES (
          ${this.userId},
          ${params.billIdentifier},
          ${params.paymentDate},
          ${params.paymentMethod || 'grain'},
          'scheduled',
          NOW()
        )
      `;

      return {
        success: true,
        message: 'Payment scheduled.',
        data: {
          scheduledDate: params.paymentDate,
          paymentMethod: params.paymentMethod || 'grain',
        },
      };
    } catch (error) {
      console.error('Error scheduling payment:', error);
      return {
        success: false,
        message: 'Failed to schedule payment.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve a bill
   */
  async approveBill(
    billIdentifier: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      await sql`
        UPDATE wells_purchase_orders
        SET
          status = 'approved',
          updated_at = NOW()
        WHERE user_id = ${this.userId}
          AND (po_number = ${billIdentifier} OR LOWER(supplier_name) LIKE ${`%${billIdentifier.toLowerCase()}%`})
      `;

      return {
        success: true,
        message: 'Bill approved.',
      };
    } catch (error) {
      console.error('Error approving bill:', error);
      return {
        success: false,
        message: 'Failed to approve bill.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // VENDOR/CUSTOMER MANAGEMENT
  // =========================================================================

  /**
   * Add a vendor
   */
  async addVendor(
    params: AddVendorParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const result = await sql`
        INSERT INTO wells_vendors (
          user_id,
          name,
          email,
          phone,
          website,
          payment_terms,
          vendor_type,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${this.userId},
          ${params.name},
          ${params.email || null},
          ${params.phone || null},
          ${params.website || null},
          ${params.paymentTerms || 'NET30'},
          'supplier',
          'active',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        message: 'Vendor added.',
        data: {
          id: result.rows[0].id,
          name: params.name,
        },
      };
    } catch (error) {
      console.error('Error adding vendor:', error);
      return {
        success: false,
        message: 'Failed to add vendor.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a customer
   */
  async addCustomer(
    params: AddCustomerParams,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const result = await sql`
        INSERT INTO wells_vendors (
          user_id,
          name,
          email,
          phone,
          payment_terms,
          vendor_type,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${this.userId},
          ${params.name},
          ${params.email || null},
          ${params.phone || null},
          ${params.paymentTerms || 'NET30'},
          'customer',
          'active',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        message: 'Customer added.',
        data: {
          id: result.rows[0].id,
          name: params.name,
        },
      };
    } catch (error) {
      console.error('Error adding customer:', error);
      return {
        success: false,
        message: 'Failed to add customer.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List vendors
   */
  async listVendors(
    criteria: { category?: string; query?: string },
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Try ERP vendors first
      const connection = await this.getActiveConnection();

      if (connection) {
        let query = `
          SELECT
            id,
            vendor_name as name,
            email,
            phone,
            total_amount_paid as "totalSpend"
          FROM erp_vendors
          WHERE erp_connection_id = $1
            AND is_active = true
        `;
        const params: any[] = [connection.id];

        if (criteria.query) {
          query += ` AND LOWER(vendor_name) LIKE $${params.length + 1}`;
          params.push(`%${criteria.query.toLowerCase()}%`);
        }

        query += ' ORDER BY total_amount_paid DESC NULLS LAST LIMIT 50';

        const result = await sql.query(query, params);

        return {
          success: true,
          message: 'Vendors retrieved.',
          data: {
            vendors: result.rows.map(v => ({
              ...v,
              totalSpend: parseFloat(v.totalSpend || 0),
            })),
          },
        };
      }

      // Wells vendors
      let query = `
        SELECT
          id,
          name,
          email,
          phone,
          total_spend as "totalSpend"
        FROM wells_vendors
        WHERE user_id = $1
          AND vendor_type IN ('supplier', 'both')
          AND status = 'active'
      `;
      const params: any[] = [this.userId];

      if (criteria.query) {
        query += ` AND LOWER(name) LIKE $${params.length + 1}`;
        params.push(`%${criteria.query.toLowerCase()}%`);
      }

      query += ' ORDER BY total_spend DESC NULLS LAST LIMIT 50';

      const result = await sql.query(query, params);

      return {
        success: true,
        message: 'Vendors retrieved.',
        data: {
          vendors: result.rows.map(v => ({
            ...v,
            totalSpend: parseFloat(v.totalSpend || 0),
          })),
        },
      };
    } catch (error) {
      console.error('Error listing vendors:', error);
      return {
        success: false,
        message: 'Failed to list vendors.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List customers
   */
  async listCustomers(
    criteria: { query?: string },
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      let query = `
        SELECT
          id,
          name,
          email,
          phone,
          total_revenue as "totalRevenue"
        FROM wells_vendors
        WHERE user_id = $1
          AND vendor_type IN ('customer', 'both')
          AND status = 'active'
      `;
      const params: any[] = [this.userId];

      if (criteria.query) {
        query += ` AND LOWER(name) LIKE $${params.length + 1}`;
        params.push(`%${criteria.query.toLowerCase()}%`);
      }

      query += ' ORDER BY total_revenue DESC NULLS LAST LIMIT 50';

      const result = await sql.query(query, params);

      return {
        success: true,
        message: 'Customers retrieved.',
        data: {
          customers: result.rows.map(c => ({
            ...c,
            totalRevenue: parseFloat(c.totalRevenue || 0),
          })),
        },
      };
    } catch (error) {
      console.error('Error listing customers:', error);
      return {
        success: false,
        message: 'Failed to list customers.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get vendor details
   */
  async getVendorDetails(
    vendorName: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Try ERP vendors first
      const connection = await this.getActiveConnection();

      if (connection) {
        const vendorResult = await sql`
          SELECT
            v.*,
            (SELECT SUM(total_amount) FROM erp_bills WHERE external_vendor_id = v.external_vendor_id) as open_bills
          FROM erp_vendors v
          WHERE v.erp_connection_id = ${connection.id}
            AND LOWER(v.vendor_name) LIKE ${`%${vendorName.toLowerCase()}%`}
          LIMIT 1
        `;

        if (vendorResult.rows.length > 0) {
          const vendor = vendorResult.rows[0];
          return {
            success: true,
            message: 'Vendor details retrieved.',
            data: {
              name: vendor.vendor_name,
              email: vendor.email,
              phone: vendor.phone,
              totalSpend: parseFloat(vendor.total_amount_paid || 0),
              openBills: parseFloat(vendor.open_bills || 0),
              paymentTerms: vendor.payment_terms,
              averageOrderValue: parseFloat(vendor.average_invoice_amount || 0),
              lastPaymentDate: vendor.last_payment_date,
            },
          };
        }
      }

      // Wells vendors
      const vendorResult = await sql`
        SELECT * FROM wells_vendors
        WHERE user_id = ${this.userId}
          AND LOWER(name) LIKE ${`%${vendorName.toLowerCase()}%`}
        LIMIT 1
      `;

      if (vendorResult.rows.length === 0) {
        return {
          success: false,
          message: `Vendor "${vendorName}" not found.`,
        };
      }

      const vendor = vendorResult.rows[0];

      // Get open bills
      const openBillsResult = await sql`
        SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) as open_bills
        FROM wells_purchase_orders
        WHERE user_id = ${this.userId}
          AND LOWER(supplier_name) LIKE ${`%${vendorName.toLowerCase()}%`}
          AND status NOT IN ('completed', 'cancelled')
      `;

      return {
        success: true,
        message: 'Vendor details retrieved.',
        data: {
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          totalSpend: parseFloat(vendor.total_spend || 0),
          openBills: parseFloat(openBillsResult.rows[0].open_bills || 0),
          paymentTerms: vendor.payment_terms,
          categories: vendor.categories,
        },
      };
    } catch (error) {
      console.error('Error getting vendor details:', error);
      return {
        success: false,
        message: 'Failed to get vendor details.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // RECONCILIATION
  // =========================================================================

  /**
   * Start reconciliation
   */
  async startReconciliation(
    accountName: string | undefined,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Get uncleared transactions
      const unclearedResult = await sql`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM wells_transactions
        WHERE user_id = ${this.userId}
          AND reconciled = false
      `;

      const uncleared = unclearedResult.rows[0];

      // Get book balance
      const balanceResult = await sql`
        SELECT COALESCE(grain_balance, 0) as balance
        FROM treasury_accounts
        WHERE clerk_user_id = ${this.userId}
        LIMIT 1
      `;

      return {
        success: true,
        message: 'Reconciliation started.',
        data: {
          accountName: accountName || 'GRAIN Account',
          bookBalance: parseFloat(balanceResult.rows[0]?.balance || 0),
          unclearedCount: parseInt(uncleared.count || 0),
          unclearedAmount: parseFloat(uncleared.total || 0),
        },
      };
    } catch (error) {
      console.error('Error starting reconciliation:', error);
      return {
        success: false,
        message: 'Failed to start reconciliation.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get reconciliation status
   */
  async getReconciliationStatus(context: ERPChatContext): Promise<ERPOperationResult> {
    try {
      const result = await sql`
        SELECT
          'GRAIN Account' as name,
          (SELECT MAX(reconciled_at) FROM wells_transactions WHERE user_id = ${this.userId} AND reconciled = true) as "lastReconciled",
          (SELECT COUNT(*) = 0 FROM wells_transactions WHERE user_id = ${this.userId} AND reconciled = false) as "isReconciled"
      `;

      return {
        success: true,
        message: 'Reconciliation status retrieved.',
        data: {
          accounts: result.rows,
        },
      };
    } catch (error) {
      console.error('Error getting reconciliation status:', error);
      return {
        success: false,
        message: 'Failed to get reconciliation status.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Match transactions
   */
  async matchTransactions(context: ERPChatContext): Promise<ERPOperationResult> {
    try {
      // Find unmatched transactions
      const unmatchedResult = await sql`
        SELECT
          id,
          amount,
          description,
          created_at as date
        FROM wells_transactions
        WHERE user_id = ${this.userId}
          AND reconciled = false
        ORDER BY created_at DESC
        LIMIT 20
      `;

      // Simple matching logic - in production would use AI
      const suggestions = unmatchedResult.rows.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        date: tx.date,
        description: tx.description,
        matchedWith: null, // Would be filled by matching algorithm
        confidence: 0,
      }));

      return {
        success: true,
        message: 'Transaction matches found.',
        data: {
          matchedCount: 0,
          suggestions,
        },
      };
    } catch (error) {
      console.error('Error matching transactions:', error);
      return {
        success: false,
        message: 'Failed to match transactions.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  /**
   * Generate a report
   */
  async generateReport(
    reportType: string,
    period: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    // Route to specific report type
    switch (reportType) {
      case 'pnl':
      case 'profit_loss':
        return this.getProfitAndLoss(period, context);
      case 'ap':
      case 'accounts_payable':
        return this.getAccountsPayable(period, context);
      case 'ar':
      case 'accounts_receivable':
        return this.getAccountsReceivable(period, context);
      case 'cash':
      case 'cash_flow':
        return this.getCashPosition(context);
      case 'spending':
        return this.getSpendingAnalysis(period, undefined, context);
      default:
        return this.getFinancialSummary(period, context);
    }
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary(
    period: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      // Get P&L
      const pnl = await this.getProfitAndLoss(period, context);
      const cash = await this.getCashPosition(context);
      const ar = await this.getAccountsReceivable(period, context);
      const ap = await this.getAccountsPayable(period, context);

      if (!pnl.success || !cash.success || !ar.success || !ap.success) {
        return {
          success: false,
          message: 'Failed to get complete financial summary.',
        };
      }

      // Generate insights using AI
      const insights = this.generateInsights(pnl.data, cash.data, ar.data, ap.data);

      return {
        success: true,
        message: 'Financial summary retrieved.',
        data: {
          revenue: pnl.data.revenue,
          expenses: pnl.data.cogs + pnl.data.operatingExpenses,
          netIncome: pnl.data.netIncome,
          profitMargin: pnl.data.netMargin,
          cashBalance: cash.data.totalCash,
          arBalance: ar.data.totalDue,
          apBalance: ap.data.totalDue,
          insights,
        },
      };
    } catch (error) {
      console.error('Error getting financial summary:', error);
      return {
        success: false,
        message: 'Failed to get financial summary.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Compare periods
   */
  async comparePeriods(
    currentPeriod: string,
    previousPeriod: string,
    context: ERPChatContext
  ): Promise<ERPOperationResult> {
    try {
      const current = await this.getProfitAndLoss(currentPeriod, context);
      const previous = await this.getProfitAndLoss(previousPeriod, context);

      if (!current.success || !previous.success) {
        return {
          success: false,
          message: 'Failed to compare periods.',
        };
      }

      const revenueChange = previous.data.revenue > 0
        ? ((current.data.revenue - previous.data.revenue) / previous.data.revenue * 100).toFixed(1)
        : '0';
      const expensesChange = previous.data.operatingExpenses > 0
        ? ((current.data.operatingExpenses - previous.data.operatingExpenses) / previous.data.operatingExpenses * 100).toFixed(1)
        : '0';
      const netIncomeChange = previous.data.netIncome !== 0
        ? ((current.data.netIncome - previous.data.netIncome) / Math.abs(previous.data.netIncome) * 100).toFixed(1)
        : '0';

      return {
        success: true,
        message: 'Period comparison complete.',
        data: {
          currentRevenue: current.data.revenue,
          previousRevenue: previous.data.revenue,
          revenueChange: parseFloat(revenueChange),
          currentExpenses: current.data.operatingExpenses,
          previousExpenses: previous.data.operatingExpenses,
          expensesChange: parseFloat(expensesChange),
          currentNetIncome: current.data.netIncome,
          previousNetIncome: previous.data.netIncome,
          netIncomeChange: parseFloat(netIncomeChange),
          highlights: this.generateComparisonHighlights(current.data, previous.data),
        },
      };
    } catch (error) {
      console.error('Error comparing periods:', error);
      return {
        success: false,
        message: 'Failed to compare periods.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  private getDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_quarter':
        const lastQuarterStart = Math.floor(now.getMonth() / 3) * 3 - 3;
        start = new Date(now.getFullYear(), lastQuarterStart, 1);
        end = new Date(now.getFullYear(), lastQuarterStart + 3, 0);
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start, end };
  }

  private getPreviousPeriod(period: string): string {
    const map: Record<string, string> = {
      week: 'last_week',
      month: 'last_month',
      quarter: 'last_quarter',
      year: 'last_year',
    };
    return map[period] || 'last_month';
  }

  private generateInsights(pnl: any, cash: any, ar: any, ap: any): string[] {
    const insights: string[] = [];

    // Profitability insight
    if (pnl.netMargin > 20) {
      insights.push('Strong profit margins - business is performing well');
    } else if (pnl.netMargin < 5) {
      insights.push('Low profit margins - consider reviewing pricing or costs');
    }

    // Cash flow insight
    if (cash.projectedNet < 0) {
      insights.push('Cash flow projection is negative - monitor closely');
    }

    // AR insight
    if (ar.overdueCount > 3) {
      insights.push(`${ar.overdueCount} invoices overdue - consider following up`);
    }

    // AP insight
    if (ap.overdue > 0) {
      insights.push(`$${ap.overdue.toLocaleString()} in overdue bills - review payment priorities`);
    }

    return insights;
  }

  private generateComparisonHighlights(current: any, previous: any): string[] {
    const highlights: string[] = [];

    const revenueChange = ((current.revenue - previous.revenue) / previous.revenue * 100);
    if (revenueChange > 10) {
      highlights.push(`Revenue up ${revenueChange.toFixed(0)}% - strong growth`);
    } else if (revenueChange < -10) {
      highlights.push(`Revenue down ${Math.abs(revenueChange).toFixed(0)}% - review sales strategy`);
    }

    const marginChange = current.netMargin - previous.netMargin;
    if (marginChange > 5) {
      highlights.push(`Profit margin improved by ${marginChange.toFixed(1)} points`);
    } else if (marginChange < -5) {
      highlights.push(`Profit margin declined by ${Math.abs(marginChange).toFixed(1)} points`);
    }

    return highlights;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createConversationalERP(userId: string, companyId?: string): ConversationalERP {
  return new ConversationalERP(userId, companyId);
}
