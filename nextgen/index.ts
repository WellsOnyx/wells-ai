/**
 * NextGen ERP & Finance Integration Framework
 *
 * A comprehensive three-layer integration architecture for
 * Wells Onyx and Grain & Vault platforms.
 *
 * LAYERS:
 *
 * Layer 1: External ERP Connector Network
 * - Unified integration with 200+ external ERP systems
 * - Merge, Workato, Tray, Celigo, Boomi connectors
 * - Normalized procurement schemas
 * - OAuth/API key management
 *
 * Layer 2: Internal ERP (Side-car ERP)
 * - Complete lightweight ERP subsystem
 * - Chart of accounts, Vendors, POs, Invoices, GL
 * - GRAIN stablecoin payments
 * - Float pool and yield tracking
 * - Escrow accounts
 *
 * Layer 3: Conversational ERP Mode
 * - WellsAI natural language interface
 * - Intent detection and entity extraction
 * - Multi-turn conversation state machine
 * - Authorization flow integration
 *
 * SAFETY NOTE:
 * This module is self-contained in /nextgen and does not
 * modify any existing WellsAI or Grain & Vault code.
 */

// Layer 1: External ERP Connector Network
export * as ExternalErp from './layer1-external-erp'

// Layer 2: Internal ERP (Side-car ERP)
export * as InternalErp from './layer2-internal-erp'

// Layer 3: Conversational ERP Mode
export * as ConversationalErp from './layer3-conversational'

// Version and metadata
export const NEXTGEN_VERSION = '1.0.0'
export const NEXTGEN_BUILD_DATE = '2025-12-04'

export const SUPPORTED_ERP_SYSTEMS = [
  'SAP S/4HANA',
  'SAP Business One',
  'Oracle NetSuite',
  'Oracle Fusion',
  'Microsoft Dynamics 365',
  'Microsoft Dynamics GP',
  'Sage Intacct',
  'Sage 100',
  'QuickBooks Online',
  'QuickBooks Desktop',
  'Xero',
  'Workday Financials',
  'Infor CloudSuite',
  'Epicor',
  'Acumatica',
  'FreshBooks',
  'Wave',
  'Zoho Books',
] as const

export const SUPPORTED_CONNECTORS = [
  { name: 'Merge', type: 'unified-api', coverage: 'accounting' },
  { name: 'Workato', type: 'ipaas', coverage: 'full-erp' },
  { name: 'Tray.io', type: 'ipaas', coverage: 'full-erp' },
  { name: 'Celigo', type: 'ipaas', coverage: 'full-erp' },
  { name: 'Boomi', type: 'ipaas', coverage: 'enterprise' },
] as const

export type SupportedErpSystem = typeof SUPPORTED_ERP_SYSTEMS[number]
export type SupportedConnector = typeof SUPPORTED_CONNECTORS[number]
