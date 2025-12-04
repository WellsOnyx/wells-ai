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
} from './api/route-vendors'

// API route handlers - Purchase Orders
export {
  GET as getPurchaseOrders,
  POST as createPurchaseOrder,
} from './api/route-purchase-orders'

// API route handlers - Invoices
export {
  GET as getInvoices,
  POST as createInvoice,
} from './api/route-invoices'

// API route handlers - Payments
export {
  GET as getPayments,
  POST as createPayment,
} from './api/route-payments'

// API route handlers - Ledger
export {
  GET as getGlEntries,
} from './api/route-ledger'
