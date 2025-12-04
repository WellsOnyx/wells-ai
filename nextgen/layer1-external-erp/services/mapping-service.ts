/**
 * Layer 1: ERP Data Mapping Service
 *
 * Transforms raw ERP data from any source system into normalized
 * Grain & Vault financial objects.
 *
 * Flow: raw_data → normalized_erp_schema → grain_vault_financial_object
 */

import type {
  ErpSourceSystem,
  ErpPurchaseOrder,
  ErpInvoice,
  ErpVendor,
  ErpLedgerEntry,
  ErpLineItem,
  FieldMapping,
  ObjectMapping,
  PoStatus,
  InvoiceStatus,
  VendorStatus,
  Address,
  Contact,
  BankAccount,
} from '../types'

// ============================================================================
// MAPPING ENGINE
// ============================================================================

/**
 * Apply a single field mapping to extract and transform a value
 */
function applyFieldMapping(
  rawData: Record<string, unknown>,
  mapping: FieldMapping
): unknown {
  // Get value from nested path (e.g., "entity.name")
  const pathParts = mapping.sourceField.split('.')
  let value: unknown = rawData

  for (const part of pathParts) {
    if (value === null || value === undefined) break
    if (typeof value === 'object' && value !== null) {
      value = (value as Record<string, unknown>)[part]
    } else {
      value = undefined
      break
    }
  }

  // Apply default if value is missing
  if (value === null || value === undefined) {
    return mapping.defaultValue
  }

  // Apply transform
  if (mapping.transform) {
    value = applyTransform(value, mapping.transform, mapping.customTransform)
  }

  return value
}

/**
 * Apply a transform to a value
 */
function applyTransform(
  value: unknown,
  transform: FieldMapping['transform'],
  customTransform?: string
): unknown {
  if (value === null || value === undefined) return value

  switch (transform) {
    case 'lowercase':
      return String(value).toLowerCase()

    case 'uppercase':
      return String(value).toUpperCase()

    case 'date':
      return parseDate(value)

    case 'currency':
      // Normalize currency codes
      const currency = String(value).toUpperCase().trim()
      return currency.length === 3 ? currency : 'USD'

    case 'number':
      const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
      return isNaN(num) ? 0 : num

    case 'custom':
      if (customTransform) {
        try {
          // Create a safe function to evaluate the transform
          const fn = new Function('value', `return ${customTransform}`)
          return fn(value)
        } catch {
          console.error('Custom transform error:', customTransform)
          return value
        }
      }
      return value

    default:
      return value
  }
}

/**
 * Parse various date formats into ISO string
 */
function parseDate(value: unknown): string | undefined {
  if (!value) return undefined

  try {
    // Handle SAP date format (YYYYMMDD)
    if (typeof value === 'string' && /^\d{8}$/.test(value)) {
      const year = value.substring(0, 4)
      const month = value.substring(4, 6)
      const day = value.substring(6, 8)
      return `${year}-${month}-${day}`
    }

    // Handle Unix timestamp
    if (typeof value === 'number') {
      // If it's in seconds (< 10000000000), convert to ms
      const ms = value < 10000000000 ? value * 1000 : value
      return new Date(ms).toISOString()
    }

    // Standard date parsing
    const date = new Date(String(value))
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  } catch {
    console.error('Date parse error:', value)
  }

  return undefined
}

/**
 * Apply status mapping
 */
function mapStatus<T extends string>(
  rawStatus: unknown,
  statusMapping: Record<string, string> | undefined,
  defaultStatus: T
): T {
  if (!rawStatus || !statusMapping) return defaultStatus

  const normalizedStatus = String(rawStatus).toLowerCase().trim()

  // Try exact match first
  if (statusMapping[String(rawStatus)]) {
    return statusMapping[String(rawStatus)] as T
  }

  // Try lowercase match
  for (const [key, value] of Object.entries(statusMapping)) {
    if (key.toLowerCase() === normalizedStatus) {
      return value as T
    }
  }

  return defaultStatus
}

// ============================================================================
// OBJECT NORMALIZERS
// ============================================================================

/**
 * Normalize raw data into an ErpPurchaseOrder
 */
export function normalizePurchaseOrder(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem,
  mapping: ObjectMapping,
  externalId: string
): ErpPurchaseOrder {
  const normalized: Partial<ErpPurchaseOrder> = {
    id: crypto.randomUUID(),
    sourceSystem,
    externalId,
    rawData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  }

  // Apply field mappings
  for (const fieldMapping of mapping.fieldMappings) {
    const value = applyFieldMapping(rawData, fieldMapping)
    if (value !== undefined) {
      setNestedValue(normalized, fieldMapping.targetField, value)
    }
  }

  // Map status
  const rawStatus = getNestedValue(rawData, findSourceField(mapping, 'status') || 'status')
  normalized.status = mapStatus<PoStatus>(rawStatus, mapping.statusMapping, 'draft')

  // Ensure required fields
  if (!normalized.poNumber) {
    normalized.poNumber = externalId
  }
  if (!normalized.vendorId) {
    normalized.vendorId = 'unknown'
  }
  if (!normalized.totalAmount) {
    normalized.totalAmount = 0
  }
  if (!normalized.currency) {
    normalized.currency = 'USD'
  }

  // Parse line items if present
  normalized.lineItems = parseLineItems(rawData, sourceSystem)

  return normalized as ErpPurchaseOrder
}

/**
 * Normalize raw data into an ErpInvoice
 */
export function normalizeInvoice(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem,
  mapping: ObjectMapping,
  externalId: string
): ErpInvoice {
  const normalized: Partial<ErpInvoice> = {
    id: crypto.randomUUID(),
    sourceSystem,
    externalId,
    rawData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  }

  // Apply field mappings
  for (const fieldMapping of mapping.fieldMappings) {
    const value = applyFieldMapping(rawData, fieldMapping)
    if (value !== undefined) {
      setNestedValue(normalized, fieldMapping.targetField, value)
    }
  }

  // Map status
  const rawStatus = getNestedValue(rawData, findSourceField(mapping, 'status') || 'status')
  normalized.status = mapStatus<InvoiceStatus>(rawStatus, mapping.statusMapping, 'draft')

  // Ensure required fields
  if (!normalized.invoiceNumber) {
    normalized.invoiceNumber = externalId
  }
  if (!normalized.vendorId) {
    normalized.vendorId = 'unknown'
  }
  if (!normalized.totalAmount) {
    normalized.totalAmount = 0
  }
  if (!normalized.currency) {
    normalized.currency = 'USD'
  }
  if (!normalized.invoiceDate) {
    normalized.invoiceDate = new Date().toISOString().split('T')[0]
  }
  if (!normalized.dueDate) {
    // Default to 30 days from invoice date
    const invoiceDate = new Date(normalized.invoiceDate)
    invoiceDate.setDate(invoiceDate.getDate() + 30)
    normalized.dueDate = invoiceDate.toISOString().split('T')[0]
  }

  // Calculate amount due
  if (normalized.amountDue === undefined) {
    normalized.amountDue = normalized.totalAmount - (normalized.amountPaid || 0)
  }

  // Parse line items
  normalized.lineItems = parseLineItems(rawData, sourceSystem)

  return normalized as ErpInvoice
}

/**
 * Normalize raw data into an ErpVendor
 */
export function normalizeVendor(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem,
  mapping: ObjectMapping,
  externalId: string
): ErpVendor {
  const normalized: Partial<ErpVendor> = {
    id: crypto.randomUUID(),
    sourceSystem,
    externalId,
    rawData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  }

  // Apply field mappings
  for (const fieldMapping of mapping.fieldMappings) {
    const value = applyFieldMapping(rawData, fieldMapping)
    if (value !== undefined) {
      setNestedValue(normalized, fieldMapping.targetField, value)
    }
  }

  // Map status
  const rawStatus = getNestedValue(rawData, findSourceField(mapping, 'status') || 'status')
  normalized.status = mapStatus<VendorStatus>(rawStatus, mapping.statusMapping, 'active')

  // Ensure required fields
  if (!normalized.name) {
    normalized.name = externalId
  }

  // Parse contacts and addresses
  normalized.contacts = parseContacts(rawData, sourceSystem)
  normalized.addresses = parseAddresses(rawData, sourceSystem)
  normalized.bankAccounts = parseBankAccounts(rawData, sourceSystem)

  return normalized as ErpVendor
}

/**
 * Normalize raw data into an ErpLedgerEntry
 */
export function normalizeLedgerEntry(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem,
  mapping: ObjectMapping,
  externalId: string
): ErpLedgerEntry {
  const normalized: Partial<ErpLedgerEntry> = {
    id: crypto.randomUUID(),
    sourceSystem,
    externalId,
    rawData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  }

  // Apply field mappings
  for (const fieldMapping of mapping.fieldMappings) {
    const value = applyFieldMapping(rawData, fieldMapping)
    if (value !== undefined) {
      setNestedValue(normalized, fieldMapping.targetField, value)
    }
  }

  // Ensure required fields
  if (!normalized.accountCode) {
    normalized.accountCode = 'unknown'
  }
  if (!normalized.entryDate) {
    normalized.entryDate = new Date().toISOString().split('T')[0]
  }
  if (!normalized.currency) {
    normalized.currency = 'USD'
  }

  // Calculate amount from debit/credit if not set
  if (normalized.amount === undefined) {
    const debit = normalized.debit || 0
    const credit = normalized.credit || 0
    normalized.amount = debit - credit
  }

  return normalized as ErpLedgerEntry
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set a value at a nested path in an object
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

/**
 * Get a value from a nested path in an object
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * Find the source field for a target field in a mapping
 */
function findSourceField(
  mapping: ObjectMapping,
  targetField: string
): string | undefined {
  const fieldMapping = mapping.fieldMappings.find(m => m.targetField === targetField)
  return fieldMapping?.sourceField
}

/**
 * Parse line items from raw data (ERP-specific handling)
 */
function parseLineItems(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem
): ErpLineItem[] {
  const lineItems: ErpLineItem[] = []

  // Common paths for line items in different ERPs
  const lineItemPaths = {
    sap: ['ITEMS', 'items', 'PO_ITEM', 'INV_ITEM'],
    netsuite: ['item', 'items', 'lineItems'],
    quickbooks: ['Line', 'Lines', 'lineItems'],
    oracle: ['lines', 'invoiceLines', 'orderLines'],
    dynamics: ['lines', 'salesOrderLines', 'purchaseOrderLines'],
    default: ['lineItems', 'items', 'lines', 'Line'],
  }

  const paths = lineItemPaths[sourceSystem] || lineItemPaths.default

  let rawLines: unknown[] = []
  for (const path of paths) {
    const items = getNestedValue(rawData, path)
    if (Array.isArray(items)) {
      rawLines = items
      break
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const item = rawLines[i] as Record<string, unknown>
    lineItems.push({
      lineNumber: i + 1,
      productCode: String(item.productCode || item.ItemCode || item.sku || item.id || ''),
      description: String(item.description || item.Description || item.name || item.ItemName || ''),
      quantity: Number(item.quantity || item.Qty || item.MENGE || 1),
      unitOfMeasure: String(item.unit || item.UnitOfMeasure || item.MEINS || 'EA'),
      unitPrice: Number(item.unitPrice || item.Rate || item.NETPR || 0),
      discount: Number(item.discount || item.DiscountAmt || 0),
      discountPercent: Number(item.discountPercent || item.DiscountPercent || 0),
      taxRate: Number(item.taxRate || item.TaxPercent || 0),
      taxAmount: Number(item.taxAmount || item.TaxAmt || 0),
      lineTotal: Number(item.lineTotal || item.Amount || item.NETWR || 0),
      accountCode: String(item.accountCode || item.AccountRef?.value || item.SAKTO || ''),
      costCenter: String(item.costCenter || item.KOSTL || ''),
      project: String(item.project || item.POSID || ''),
    })
  }

  return lineItems
}

/**
 * Parse contacts from raw vendor data
 */
function parseContacts(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem
): Contact[] {
  const contacts: Contact[] = []

  // Try various paths for contact data
  const contactPaths = ['contacts', 'contactList', 'primaryContact', 'contact']

  for (const path of contactPaths) {
    const contactData = getNestedValue(rawData, path)
    if (contactData) {
      if (Array.isArray(contactData)) {
        for (const c of contactData) {
          contacts.push(parseContact(c as Record<string, unknown>))
        }
      } else if (typeof contactData === 'object') {
        contacts.push(parseContact(contactData as Record<string, unknown>))
      }
    }
  }

  // Also check for flat contact fields
  if (contacts.length === 0) {
    const name = rawData.contactName || rawData.ContactName || rawData.NAME1
    if (name) {
      contacts.push({
        name: String(name),
        email: String(rawData.email || rawData.Email || rawData.SMTP_ADDR || ''),
        phone: String(rawData.phone || rawData.Phone || rawData.TEL_NUMBER || ''),
        isPrimary: true,
      })
    }
  }

  return contacts
}

function parseContact(data: Record<string, unknown>): Contact {
  return {
    name: String(data.name || data.Name || data.fullName || ''),
    title: String(data.title || data.Title || data.jobTitle || ''),
    email: String(data.email || data.Email || data.emailAddress || ''),
    phone: String(data.phone || data.Phone || data.phoneNumber || ''),
    mobile: String(data.mobile || data.Mobile || data.cellPhone || ''),
    isPrimary: Boolean(data.isPrimary || data.IsPrimary || data.primary),
    role: (data.role || data.Role || 'other') as Contact['role'],
  }
}

/**
 * Parse addresses from raw vendor data
 */
function parseAddresses(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem
): Address[] {
  const addresses: Address[] = []

  const addressPaths = ['addresses', 'addressList', 'address', 'billingAddress', 'shippingAddress']

  for (const path of addressPaths) {
    const addressData = getNestedValue(rawData, path)
    if (addressData) {
      if (Array.isArray(addressData)) {
        for (const a of addressData) {
          addresses.push(parseAddress(a as Record<string, unknown>, path))
        }
      } else if (typeof addressData === 'object') {
        addresses.push(parseAddress(addressData as Record<string, unknown>, path))
      }
    }
  }

  return addresses
}

function parseAddress(data: Record<string, unknown>, pathHint: string): Address {
  let type: Address['type'] = 'other'
  if (pathHint.includes('billing')) type = 'billing'
  else if (pathHint.includes('shipping')) type = 'shipping'
  else if (data.type) type = data.type as Address['type']

  return {
    type,
    street1: String(data.street1 || data.Line1 || data.Address1 || data.STREET || ''),
    street2: String(data.street2 || data.Line2 || data.Address2 || ''),
    city: String(data.city || data.City || data.CITY1 || ''),
    state: String(data.state || data.State || data.Region || data.REGION || ''),
    postalCode: String(data.postalCode || data.PostalCode || data.Zip || data.POST_CODE1 || ''),
    country: String(data.country || data.Country || data.LAND1 || 'US').substring(0, 2).toUpperCase(),
    isPrimary: Boolean(data.isPrimary || data.IsPrimary || data.primary),
  }
}

/**
 * Parse bank accounts from raw vendor data
 */
function parseBankAccounts(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem
): BankAccount[] {
  const accounts: BankAccount[] = []

  const bankPaths = ['bankAccounts', 'bankDetails', 'paymentInfo', 'BNKA']

  for (const path of bankPaths) {
    const bankData = getNestedValue(rawData, path)
    if (bankData) {
      if (Array.isArray(bankData)) {
        for (const b of bankData) {
          accounts.push(parseBankAccount(b as Record<string, unknown>))
        }
      } else if (typeof bankData === 'object') {
        accounts.push(parseBankAccount(bankData as Record<string, unknown>))
      }
    }
  }

  return accounts
}

function parseBankAccount(data: Record<string, unknown>): BankAccount {
  return {
    bankName: String(data.bankName || data.BankName || data.BANKA || ''),
    accountName: String(data.accountName || data.AccountName || data.KOINH || ''),
    accountNumber: String(data.accountNumber || data.AccountNumber || data.BANKN || ''),
    routingNumber: String(data.routingNumber || data.RoutingNumber || data.ABA || ''),
    swiftCode: String(data.swiftCode || data.SwiftCode || data.SWIFT || ''),
    iban: String(data.iban || data.IBAN || ''),
    accountType: (data.accountType || 'checking') as BankAccount['accountType'],
    currency: String(data.currency || data.Currency || 'USD'),
    isPrimary: Boolean(data.isPrimary || data.IsPrimary),
    isVerified: Boolean(data.isVerified || data.IsVerified),
  }
}

// ============================================================================
// MAIN EXPORT: Universal Normalizer
// ============================================================================

export type ObjectType = 'purchase_order' | 'invoice' | 'vendor' | 'ledger_entry'

export function normalizeErpObject(
  rawData: Record<string, unknown>,
  sourceSystem: ErpSourceSystem,
  objectType: ObjectType,
  mapping: ObjectMapping,
  externalId: string
): ErpPurchaseOrder | ErpInvoice | ErpVendor | ErpLedgerEntry {
  switch (objectType) {
    case 'purchase_order':
      return normalizePurchaseOrder(rawData, sourceSystem, mapping, externalId)
    case 'invoice':
      return normalizeInvoice(rawData, sourceSystem, mapping, externalId)
    case 'vendor':
      return normalizeVendor(rawData, sourceSystem, mapping, externalId)
    case 'ledger_entry':
      return normalizeLedgerEntry(rawData, sourceSystem, mapping, externalId)
  }
}

/**
 * Calculate a hash for change detection
 */
export function calculateDataHash(data: Record<string, unknown>): string {
  const str = JSON.stringify(data, Object.keys(data).sort())
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
