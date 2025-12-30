/**
 * Grain & Vault Treasury SDK - ERP Adapters
 *
 * Native integrations for enterprise ERP systems.
 * Plug into your existing financial infrastructure. No rip-and-replace.
 * No data migration. Just add one SDK and unlock zero-friction treasury operations.
 *
 * Supported ERPs:
 * - SAP (S/4HANA, Business One)
 * - Oracle (Fusion Cloud, E-Business Suite)
 * - NetSuite (REST API, SuiteQL)
 * - Microsoft Dynamics 365 (Finance & Operations, Business Central)
 * - Workday (Financial Management)
 * - Coupa (Procurement, Treasury)
 * - Sage Intacct (Web Services API, Multi-Entity)
 * - Acumatica (REST API, OAuth 2.0)
 */

// Base types and interface
export * from './base'

// ERP-specific adapters
export { SAPAdapter, createSAPAdapter, type SAPConfig } from './sap'
export { OracleERPAdapter, createOracleAdapter, type OracleConfig } from './oracle'
export { NetSuiteAdapter, createNetSuiteAdapter, type NetSuiteConfig } from './netsuite'
export { Dynamics365Adapter, createDynamics365Adapter, type Dynamics365Config } from './dynamics365'
export { WorkdayAdapter, createWorkdayAdapter, type WorkdayConfig } from './workday'
export { CoupaAdapter, createCoupaAdapter, type CoupaConfig } from './coupa'
export { SageIntacctAdapter, createSageIntacctAdapter, type SageIntacctConfig } from './sage-intacct'
export { AcumaticaAdapter, createAcumaticaAdapter, type AcumaticaConfig } from './acumatica'

// Re-export base types for convenience
export type {
  ERPAdapter,
  ERPCredentials,
  ERPConnectionConfig,
  Vendor,
  Invoice,
  InvoiceLineItem,
  Payment,
  JournalEntry,
  JournalLine,
  GLAccount,
  CostCenter,
  SyncResult,
  BatchSyncResult,
} from './base'

// ============================================================================
// UNIFIED FACTORY
// ============================================================================

import { ERPAdapter, ERPConnectionConfig } from './base'
import { createSAPAdapter, SAPConfig } from './sap'
import { createOracleAdapter, OracleConfig } from './oracle'
import { createNetSuiteAdapter, NetSuiteConfig } from './netsuite'
import { createDynamics365Adapter, Dynamics365Config } from './dynamics365'
import { createWorkdayAdapter, WorkdayConfig } from './workday'
import { createCoupaAdapter, CoupaConfig } from './coupa'
import { createSageIntacctAdapter, SageIntacctConfig } from './sage-intacct'
import { createAcumaticaAdapter, AcumaticaConfig } from './acumatica'

export type ERPType = 'sap' | 'oracle' | 'netsuite' | 'dynamics365' | 'workday' | 'coupa' | 'sage-intacct' | 'acumatica'

export type ERPConfigMap = {
  sap: SAPConfig
  oracle: OracleConfig
  netsuite: NetSuiteConfig
  dynamics365: Dynamics365Config
  workday: WorkdayConfig
  coupa: CoupaConfig
  'sage-intacct': SageIntacctConfig
  acumatica: AcumaticaConfig
}

/**
 * Create an ERP adapter for the specified system
 *
 * @example
 * ```typescript
 * import { createERPAdapter } from '@grainandvault/treasury-sdk/adapters'
 *
 * // NetSuite
 * const netsuite = createERPAdapter('netsuite', {
 *   accountId: '1234567',
 *   consumerKey: 'xxx',
 *   consumerSecret: 'xxx',
 *   tokenId: 'xxx',
 *   tokenSecret: 'xxx',
 *   endpoint: 'https://1234567.suitetalk.api.netsuite.com',
 *   credentials: { type: 'oauth2' },
 * })
 *
 * // SAP S/4HANA
 * const sap = createERPAdapter('sap', {
 *   sapSystem: 's4hana',
 *   endpoint: 'https://mycompany.s4hana.ondemand.com',
 *   sapClient: '100',
 *   credentials: {
 *     type: 'oauth2',
 *     clientId: 'xxx',
 *     clientSecret: 'xxx',
 *     tokenUrl: 'https://mycompany.s4hana.ondemand.com/oauth/token',
 *   },
 * })
 *
 * await sap.connect()
 * const vendors = await sap.getVendors()
 * ```
 */
export function createERPAdapter<T extends ERPType>(
  type: T,
  config: ERPConfigMap[T]
): ERPAdapter {
  switch (type) {
    case 'sap':
      return createSAPAdapter(config as SAPConfig)
    case 'oracle':
      return createOracleAdapter(config as OracleConfig)
    case 'netsuite':
      return createNetSuiteAdapter(config as NetSuiteConfig)
    case 'dynamics365':
      return createDynamics365Adapter(config as Dynamics365Config)
    case 'workday':
      return createWorkdayAdapter(config as WorkdayConfig)
    case 'coupa':
      return createCoupaAdapter(config as CoupaConfig)
    case 'sage-intacct':
      return createSageIntacctAdapter(config as SageIntacctConfig)
    case 'acumatica':
      return createAcumaticaAdapter(config as AcumaticaConfig)
    default:
      throw new Error(`Unsupported ERP type: ${type}`)
  }
}

/**
 * Get available ERP types
 */
export function getSupportedERPs(): ERPType[] {
  return ['sap', 'oracle', 'netsuite', 'dynamics365', 'workday', 'coupa', 'sage-intacct', 'acumatica']
}

/**
 * Get ERP display name
 */
export function getERPDisplayName(type: ERPType): string {
  const names: Record<ERPType, string> = {
    sap: 'SAP',
    oracle: 'Oracle',
    netsuite: 'NetSuite',
    dynamics365: 'Dynamics 365',
    workday: 'Workday',
    coupa: 'Coupa',
    'sage-intacct': 'Sage Intacct',
    acumatica: 'Acumatica',
  }
  return names[type]
}

/**
 * Get ERP description
 */
export function getERPDescription(type: ERPType): string {
  const descriptions: Record<ERPType, string> = {
    sap: 'SAP S/4HANA Cloud and SAP Business One',
    oracle: 'Oracle Fusion Cloud and Oracle E-Business Suite',
    netsuite: 'Oracle NetSuite with REST API and SuiteQL',
    dynamics365: 'Microsoft Dynamics 365 Finance & Operations and Business Central',
    workday: 'Workday Financial Management',
    coupa: 'Coupa Procurement and Treasury',
    'sage-intacct': 'Sage Intacct with Web Services API and Multi-Entity support',
    acumatica: 'Acumatica Cloud ERP with REST API and OAuth 2.0',
  }
  return descriptions[type]
}

export default createERPAdapter
