/**
 * Layer 2: Grain & Vault Internal ERP (Side-car ERP)
 *
 * Complete lightweight ERP subsystem that works standalone or
 * synchronized with external ERPs from Layer 1.
 *
 * Key capabilities:
 * - Chart of accounts management
 * - Vendor master data
 * - Purchase order lifecycle
 * - Invoice processing and matching
 * - GL entry posting
 * - Payment instruction generation
 * - GRAIN stablecoin settlements
 * - Float pool and yield tracking
 * - Escrow accounts for trade protection
 */

// Types and interfaces
export * from './types'

// API route handlers - Vendors
export {
  GET as getVendors,
  POST as createVendor,
  vendorById,
} from './api/route-vendors'

// API route handlers - Purchase Orders
export {
  GET as getPurchaseOrders,
  POST as createPurchaseOrder,
  purchaseOrderById,
  approvePurchaseOrder,
  receivePurchaseOrder,
} from './api/route-purchase-orders'

// API route handlers - Invoices
export {
  GET as getInvoices,
  POST as createInvoice,
  invoiceById,
  matchInvoice,
  approveInvoice,
} from './api/route-invoices'

// API route handlers - Payments
export {
  GET as getPayments,
  POST as createPayment,
  paymentById,
  authorizePayment,
  executePayment,
} from './api/route-payments'

// API route handlers - Ledger
export {
  GET as getGlEntries,
  getFloatLedger,
  getYieldLedger,
  getEscrowAccounts,
  getTrialBalance,
} from './api/route-ledger'

// Re-export key types for convenience
export type {
  GvChartOfAccount,
  GvVendor,
  GvPurchaseOrder,
  GvPurchaseOrderLineItem,
  GvInvoice,
  GvInvoiceLineItem,
  GvGlEntry,
  GvPaymentInstruction,
  GvReconciliation,
  GvFloatLedger,
  GvYieldLedger,
  GvEscrowAccount,
  GvEscrowTransaction,
} from './types'
