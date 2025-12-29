/**
 * WellsAI Conversational ERP Module
 *
 * AI-native ERP system - no forms, no dashboards, just talk to Wells.
 *
 * Instead of learning complex ERP interfaces, users simply converse:
 * - "Create an invoice for Acme Corp for $5000"
 * - "What POs are pending delivery?"
 * - "Show me my top 5 suppliers by volume"
 * - "What do I owe this month?"
 *
 * Features:
 * - Invoice Management (create, track, mark paid, send reminders)
 * - Purchase Order Management (create, receive, track, cancel)
 * - Vendor Registry (add, rate, track payment history)
 * - Financial Overview (spend, cash flow, accounts payable/receivable)
 *
 * Integrates with Wells fee system - 1% on all transactions.
 *
 * @example
 * ```typescript
 * import {
 *   WellsInvoiceService,
 *   WellsPOService,
 *   WellsVendorRegistry,
 *   WellsFinancialService,
 * } from '@/lib/wells-erp'
 *
 * // Create invoice conversationally
 * const result = await WellsInvoiceService.createInvoice(userId, {
 *   vendorName: 'Acme Corp',
 *   amount: 5000,
 *   aiCommand: 'Create an invoice for Acme Corp for $5000',
 * })
 * console.log(result.message) // "Invoice WELLS-2024-000001 created for Acme Corp..."
 *
 * // Get financial overview
 * const { summary, message } = await WellsFinancialService.getSpendSummary(userId, 'month')
 * console.log(message) // "Your spend this month: $45,000 across 12 purchase orders..."
 * ```
 */

// ============================================================================
// INVOICE SERVICE
// ============================================================================
export {
  WellsInvoiceService,
  parseInvoiceCommand,
  type WellsInvoice,
  type InvoiceLineItem,
  type InvoiceStatus,
  type CreateInvoiceRequest,
  type InvoiceSearchCriteria,
  type InvoiceSummary,
} from './invoice-service'

// ============================================================================
// PURCHASE ORDER SERVICE
// ============================================================================
export {
  WellsPOService,
  parsePOCommand,
  type WellsPurchaseOrder,
  type POLineItem,
  type POStatus,
  type CreatePORequest,
  type POSearchCriteria,
  type POSummary,
} from './po-service'

// ============================================================================
// VENDOR REGISTRY SERVICE
// ============================================================================
export {
  WellsVendorRegistry,
  parseVendorCommand,
  type WellsVendor,
  type VendorType,
  type VendorStatus,
  type VendorContact,
  type VendorAddress,
  type PaymentTerms,
  type PerformanceScore,
  type VendorRating,
  type PaymentHistoryItem,
  type CreateVendorRequest,
  type VendorSearchCriteria,
} from './vendor-registry'

// ============================================================================
// FINANCIAL OVERVIEW SERVICE
// ============================================================================
export {
  WellsFinancialService,
  parseFinancialCommand,
  type SpendSummary,
  type PaymentDue,
  type AccountsPayable,
  type AccountsReceivable,
  type CashFlowForecast,
  type FinancialPeriodSummary,
  type TransactionLedger,
} from './financial-overview'

// ============================================================================
// CHAT TOOLS FOR CLAUDE INTEGRATION
// ============================================================================
export {
  WELLS_ERP_TOOLS,
  WELLS_ERP_SYSTEM_PROMPT,
  formatToolResultForChat,
} from './chat-tools'

// ============================================================================
// UNIFIED CONVERSATIONAL PARSER
// ============================================================================

/**
 * Parse any ERP-related conversational command
 * Routes to the appropriate service based on intent
 */
export function parseERPCommand(message: string): {
  domain: 'invoice' | 'po' | 'vendor' | 'financial' | 'unknown'
  action: string
  params: Record<string, unknown>
} {
  const lower = message.toLowerCase()

  // Invoice-related keywords
  if (
    lower.includes('invoice') ||
    lower.includes('billing') ||
    lower.includes('bill')
  ) {
    const { action, params } = parseInvoiceCommand(message)
    return { domain: 'invoice', action, params }
  }

  // PO-related keywords
  if (
    lower.includes('purchase order') ||
    lower.includes('po ') ||
    lower.includes('order from') ||
    (lower.includes('order') && (lower.includes('create') || lower.includes('buy') || lower.includes('receive')))
  ) {
    const { action, params } = parsePOCommand(message)
    return { domain: 'po', action, params }
  }

  // Vendor-related keywords
  if (
    lower.includes('vendor') ||
    lower.includes('supplier') ||
    lower.includes('rate ') ||
    (lower.includes('add') && (lower.includes('as a') || lower.includes('as supplier') || lower.includes('as customer')))
  ) {
    const { action, params } = parseVendorCommand(message)
    return { domain: 'vendor', action, params }
  }

  // Financial keywords
  if (
    lower.includes('spend') ||
    lower.includes('spent') ||
    lower.includes('cash flow') ||
    lower.includes('forecast') ||
    lower.includes('payment') ||
    lower.includes('accounts') ||
    lower.includes('financial') ||
    lower.includes('owe') ||
    lower.includes('due')
  ) {
    const { action, params } = parseFinancialCommand(message)
    return { domain: 'financial', action, params }
  }

  // Default: try financial (most common general query)
  const { action, params } = parseFinancialCommand(message)
  return { domain: action !== 'unknown' ? 'financial' : 'unknown', action, params }
}

// ============================================================================
// IMPORT HELPERS FOR CHAT INTEGRATION
// ============================================================================

import {
  WellsInvoiceService,
  parseInvoiceCommand,
} from './invoice-service'

import {
  WellsPOService,
  parsePOCommand,
} from './po-service'

import {
  WellsVendorRegistry,
  parseVendorCommand,
} from './vendor-registry'

import {
  WellsFinancialService,
  parseFinancialCommand,
} from './financial-overview'

/**
 * Handle conversational ERP command from chat
 * Returns AI response message and any structured data
 */
export async function handleERPCommand(
  userId: string,
  message: string,
  conversationId?: string
): Promise<{
  success: boolean
  message: string
  data?: unknown
  domain: string
  action: string
}> {
  const parsed = parseERPCommand(message)

  try {
    switch (parsed.domain) {
      case 'invoice':
        return await handleInvoiceCommand(userId, message, parsed.action, parsed.params, conversationId)
      case 'po':
        return await handlePOCommand(userId, message, parsed.action, parsed.params, conversationId)
      case 'vendor':
        return await handleVendorCommand(userId, message, parsed.action, parsed.params, conversationId)
      case 'financial':
        return await handleFinancialCommand(userId, parsed.action, parsed.params)
      default:
        return {
          success: false,
          message: `I'm not sure what you're asking about. You can ask me about:
- Invoices: "Create an invoice for Acme Corp for $5000"
- Purchase Orders: "Create a PO for 1000 bearings from Precision Bearings"
- Vendors: "Add Precision Bearings as a supplier"
- Financials: "What's my spend this month?"`,
          domain: 'unknown',
          action: 'unknown',
        }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred processing your request.',
      domain: parsed.domain,
      action: parsed.action,
    }
  }
}

async function handleInvoiceCommand(
  userId: string,
  originalMessage: string,
  action: string,
  params: Record<string, unknown>,
  conversationId?: string
): Promise<{ success: boolean; message: string; data?: unknown; domain: string; action: string }> {
  switch (action) {
    case 'create':
      if (!params.vendorName) {
        return { success: false, message: 'Please specify a vendor name.', domain: 'invoice', action }
      }
      const createResult = await WellsInvoiceService.createInvoice(userId, {
        vendorName: params.vendorName as string,
        amount: params.amount as number,
        aiConversationId: conversationId,
        aiCommand: originalMessage,
      })
      return { success: true, message: createResult.message, data: createResult.invoice, domain: 'invoice', action }

    case 'list':
      if (params.overdue) {
        const overdueResult = await WellsInvoiceService.listInvoices(userId, { overdue: true })
        return { success: true, message: overdueResult.summary, data: overdueResult.invoices, domain: 'invoice', action }
      }
      if (params.unpaid) {
        const unpaidResult = await WellsInvoiceService.getUnpaidInvoices(userId)
        return { success: true, message: unpaidResult.summary, data: unpaidResult.invoices, domain: 'invoice', action }
      }
      const listResult = await WellsInvoiceService.listInvoices(userId)
      return { success: true, message: listResult.summary, data: listResult.invoices, domain: 'invoice', action }

    case 'mark_paid':
      if (!params.invoiceIdentifier) {
        return { success: false, message: 'Please specify which invoice to mark as paid.', domain: 'invoice', action }
      }
      const paidResult = await WellsInvoiceService.markAsPaid(userId, params.invoiceIdentifier as string)
      return { success: true, message: paidResult.message, data: paidResult.invoice, domain: 'invoice', action }

    case 'send_reminder':
      const reminderIdentifier = (params.invoiceIdentifier || params.vendorName) as string
      if (!reminderIdentifier) {
        return { success: false, message: 'Please specify which invoice or vendor to remind.', domain: 'invoice', action }
      }
      const reminderResult = await WellsInvoiceService.sendReminder(userId, reminderIdentifier)
      return { success: true, message: reminderResult.message, data: reminderResult.invoice, domain: 'invoice', action }

    case 'cancel':
      if (!params.invoiceIdentifier) {
        return { success: false, message: 'Please specify which invoice to cancel.', domain: 'invoice', action }
      }
      const cancelResult = await WellsInvoiceService.cancelInvoice(userId, params.invoiceIdentifier as string)
      return { success: true, message: cancelResult.message, data: cancelResult.invoice, domain: 'invoice', action }

    case 'summary':
      const summaryResult = await WellsInvoiceService.getInvoiceSummary(userId)
      return { success: true, message: summaryResult.message, data: summaryResult.summary, domain: 'invoice', action }

    default:
      return { success: false, message: 'I didn\'t understand that invoice command.', domain: 'invoice', action }
  }
}

async function handlePOCommand(
  userId: string,
  originalMessage: string,
  action: string,
  params: Record<string, unknown>,
  conversationId?: string
): Promise<{ success: boolean; message: string; data?: unknown; domain: string; action: string }> {
  switch (action) {
    case 'create':
      if (!params.supplierName) {
        return { success: false, message: 'Please specify a supplier name.', domain: 'po', action }
      }
      const createResult = await WellsPOService.createPO(userId, {
        supplierName: params.supplierName as string,
        items: [
          {
            description: (params.description as string) || 'Items',
            quantity: (params.quantity as number) || 1,
            unitPrice: (params.unitPrice as number) || 0,
          },
        ],
        aiConversationId: conversationId,
        aiCommand: originalMessage,
      })
      return { success: true, message: createResult.message, data: createResult.po, domain: 'po', action }

    case 'list':
      if (params.pendingDelivery) {
        const pendingResult = await WellsPOService.getPendingDeliveryPOs(userId)
        return { success: true, message: pendingResult.summary, data: pendingResult.orders, domain: 'po', action }
      }
      const listResult = await WellsPOService.listPOs(userId)
      return { success: true, message: listResult.summary, data: listResult.orders, domain: 'po', action }

    case 'receive':
      if (!params.poIdentifier) {
        return { success: false, message: 'Please specify which PO to mark as received.', domain: 'po', action }
      }
      const receiveResult = await WellsPOService.markAsReceived(userId, params.poIdentifier as string)
      return { success: true, message: receiveResult.message, data: receiveResult.po, domain: 'po', action }

    case 'send':
      if (!params.poIdentifier) {
        return { success: false, message: 'Please specify which PO to send.', domain: 'po', action }
      }
      const sendResult = await WellsPOService.sendToSupplier(userId, params.poIdentifier as string)
      return { success: true, message: sendResult.message, data: sendResult.po, domain: 'po', action }

    case 'cancel':
      if (!params.poIdentifier) {
        return { success: false, message: 'Please specify which PO to cancel.', domain: 'po', action }
      }
      const cancelResult = await WellsPOService.cancelPO(userId, params.poIdentifier as string)
      return { success: true, message: cancelResult.message, data: cancelResult.po, domain: 'po', action }

    case 'summary':
      const summaryResult = await WellsPOService.getPOSummary(userId)
      return { success: true, message: summaryResult.message, data: summaryResult.summary, domain: 'po', action }

    default:
      return { success: false, message: 'I didn\'t understand that purchase order command.', domain: 'po', action }
  }
}

async function handleVendorCommand(
  userId: string,
  originalMessage: string,
  action: string,
  params: Record<string, unknown>,
  conversationId?: string
): Promise<{ success: boolean; message: string; data?: unknown; domain: string; action: string }> {
  switch (action) {
    case 'add':
      if (!params.name) {
        return { success: false, message: 'Please specify a vendor name.', domain: 'vendor', action }
      }
      const addResult = await WellsVendorRegistry.addVendor(userId, {
        name: params.name as string,
        vendorType: params.vendorType as 'supplier' | 'customer' | 'both',
        email: params.email as string,
        aiConversationId: conversationId,
        aiCommand: originalMessage,
      })
      return { success: true, message: addResult.message, data: addResult.vendor, domain: 'vendor', action }

    case 'rate':
      if (!params.vendorName || !params.rating) {
        return { success: false, message: 'Please specify vendor and rating (1-5 stars).', domain: 'vendor', action }
      }
      const rateResult = await WellsVendorRegistry.rateVendor(
        userId,
        params.vendorName as string,
        params.rating as number,
        (params.category as 'delivery' | 'quality' | 'pricing' | 'communication' | 'overall') || 'overall'
      )
      return { success: true, message: rateResult.message, data: rateResult.vendor, domain: 'vendor', action }

    case 'history':
      if (!params.vendorName) {
        return { success: false, message: 'Please specify which vendor.', domain: 'vendor', action }
      }
      const historyResult = await WellsVendorRegistry.getPaymentHistory(userId, params.vendorName as string)
      return { success: true, message: historyResult.summary, data: historyResult.history, domain: 'vendor', action }

    case 'top':
      const topResult = await WellsVendorRegistry.getTopSuppliers(userId, (params.limit as number) || 10)
      return { success: true, message: topResult.summary, data: topResult.vendors, domain: 'vendor', action }

    case 'search':
      const searchResult = await WellsVendorRegistry.searchVendors(userId, { query: params.query as string })
      return { success: true, message: searchResult.summary, data: searchResult.vendors, domain: 'vendor', action }

    case 'summary':
      const summaryResult = await WellsVendorRegistry.getVendorSummary(userId)
      return { success: true, message: summaryResult.message, domain: 'vendor', action }

    default:
      return { success: false, message: 'I didn\'t understand that vendor command.', domain: 'vendor', action }
  }
}

async function handleFinancialCommand(
  userId: string,
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: unknown; domain: string; action: string }> {
  switch (action) {
    case 'spend':
      const spendResult = await WellsFinancialService.getSpendSummary(
        userId,
        (params.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
      )
      return { success: true, message: spendResult.message, data: spendResult.summary, domain: 'financial', action }

    case 'payments_due':
      const paymentsResult = await WellsFinancialService.getPaymentsDue(
        userId,
        (params.period as 'today' | 'week' | 'month') || 'week'
      )
      return { success: true, message: paymentsResult.summary, data: paymentsResult.payments, domain: 'financial', action }

    case 'accounts_payable':
      const apResult = await WellsFinancialService.getAccountsPayable(userId)
      return { success: true, message: apResult.message, data: apResult.ap, domain: 'financial', action }

    case 'cash_flow':
      const cfResult = await WellsFinancialService.forecastCashFlow(
        userId,
        (params.period as 'week' | 'month' | 'quarter') || 'month'
      )
      return { success: true, message: cfResult.message, data: cfResult.forecast, domain: 'financial', action }

    case 'top_suppliers':
      const topResult = await WellsFinancialService.getTopSuppliersByVolume(
        userId,
        (params.limit as number) || 5
      )
      return { success: true, message: topResult.message, data: topResult.suppliers, domain: 'financial', action }

    case 'ledger':
      const ledgerResult = await WellsFinancialService.getTransactionLedger(userId)
      return { success: true, message: ledgerResult.message, data: ledgerResult.transactions, domain: 'financial', action }

    case 'summary':
      const summaryResult = await WellsFinancialService.getFinancialPeriodSummary(
        userId,
        (params.period as 'week' | 'month' | 'quarter' | 'year') || 'month'
      )
      return { success: true, message: summaryResult.message, data: summaryResult.summary, domain: 'financial', action }

    default:
      const defaultResult = await WellsFinancialService.getFinancialPeriodSummary(userId, 'month')
      return { success: true, message: defaultResult.message, data: defaultResult.summary, domain: 'financial', action: 'summary' }
  }
}
