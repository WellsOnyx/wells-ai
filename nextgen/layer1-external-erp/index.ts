/**
 * Layer 1: External ERP Connector Network
 *
 * Provides unified integration with 200+ external ERP systems via
 * connector platforms (Merge, Workato, Tray, Celigo, Boomi).
 *
 * Key capabilities:
 * - Integration provider configuration
 * - OAuth/API key connection management
 * - Normalized ERP object schema (PO, Invoice, Vendor, Ledger)
 * - Polling + webhook ingestion
 * - Field mapping layer
 */

// Types and interfaces
export * from './types'

// Services
export {
  normalizeErpObject,
  normalizePurchaseOrder,
  normalizeInvoice,
  normalizeVendor,
  normalizeLedgerEntry,
  calculateDataHash,
} from './services/mapping-service'

// API route handlers
export { GET as getProviders, POST as createProvider } from './api/route-providers'
export { POST as initiateConnection, GET as getConnections } from './api/route-connect'
export { POST as triggerSync, GET as getSyncStatus } from './api/route-sync'
export { GET as getObjects } from './api/route-objects'

// Re-export key types for convenience
export type {
  IntegrationProviderConfig,
  IntegrationConnection,
  NormalizedErpObject,
  ErpPurchaseOrder,
  ErpInvoice,
  ErpVendor,
  ErpLedgerEntry,
  ObjectMapping,
  SyncLog,
  WebhookEvent,
} from './types'
