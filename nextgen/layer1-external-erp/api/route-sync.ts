/**
 * Layer 1: Integration Sync API
 * POST /api/integrations/sync
 *
 * Trigger and manage data synchronization between ERPs and Grain & Vault
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  SyncRequest,
  SyncLog,
  IntegrationConnection,
  ObjectMapping,
  ErpSourceSystem,
} from '../types'
import {
  normalizeErpObject,
  calculateDataHash,
  ObjectType,
} from '../services/mapping-service'

// ============================================================================
// In-memory stores (replace with database in production)
// ============================================================================

const syncLogsStore: Map<string, SyncLog> = new Map()
const objectsStore: Map<string, Record<string, unknown>> = new Map()

// Mock connections store (would be shared with route-connect.ts)
const connectionsStore: Map<string, IntegrationConnection> = new Map()

// Mock mappings store
const mappingsStore: Map<string, ObjectMapping> = new Map()

// ============================================================================
// API HANDLERS
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json()
    const accountId = request.headers.get('x-account-id') || 'demo-account'

    // Validate connection
    if (!body.connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    // Get connection (in production, from database)
    const connection = connectionsStore.get(body.connectionId) || createMockConnection(body.connectionId, accountId)

    if (connection.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    if (connection.status !== 'connected') {
      return NextResponse.json(
        { error: 'Connection is not active' },
        { status: 400 }
      )
    }

    // Determine object types to sync
    const objectTypes: ObjectType[] = body.objectTypes ||
      ['purchase_order', 'invoice', 'vendor', 'ledger_entry']

    // Create sync log
    const syncLog: SyncLog = {
      id: crypto.randomUUID(),
      connectionId: body.connectionId,
      objectType: objectTypes[0], // Primary object type
      direction: connection.syncDirection || 'bidirectional',
      status: 'started',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    }

    syncLogsStore.set(syncLog.id, syncLog)

    // Start async sync process
    processSyncInBackground(syncLog.id, connection, objectTypes, body.fullSync, body.sinceDate)

    return NextResponse.json({
      success: true,
      syncId: syncLog.id,
      status: 'started',
      message: 'Sync initiated. Check status with GET /api/integrations/sync?id=' + syncLog.id,
    })
  } catch (error) {
    console.error('POST sync error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate sync' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const syncId = searchParams.get('id')
    const connectionId = searchParams.get('connectionId')
    const accountId = request.headers.get('x-account-id') || 'demo-account'

    if (syncId) {
      const syncLog = syncLogsStore.get(syncId)
      if (!syncLog) {
        return NextResponse.json(
          { error: 'Sync log not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(syncLog)
    }

    if (connectionId) {
      const logs = Array.from(syncLogsStore.values())
        .filter(l => l.connectionId === connectionId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 50) // Last 50 syncs

      return NextResponse.json({ logs })
    }

    // Return recent syncs for account
    const logs = Array.from(syncLogsStore.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 100)

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('GET sync error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    )
  }
}

// ============================================================================
// SYNC PROCESSOR
// ============================================================================

async function processSyncInBackground(
  syncId: string,
  connection: IntegrationConnection,
  objectTypes: ObjectType[],
  fullSync?: boolean,
  sinceDate?: string
): Promise<void> {
  const syncLog = syncLogsStore.get(syncId)!

  try {
    // Update status to in_progress
    syncLog.status = 'in_progress'
    syncLogsStore.set(syncId, syncLog)

    for (const objectType of objectTypes) {
      // Get mapping for this ERP and object type
      const mapping = getMapping(connection.erpSystem, objectType)

      // Fetch data from ERP (simulated)
      const rawRecords = await fetchFromErp(
        connection,
        objectType,
        fullSync ? undefined : sinceDate
      )

      for (const rawRecord of rawRecords) {
        syncLog.recordsProcessed++

        try {
          const externalId = extractExternalId(rawRecord, objectType)
          const normalized = normalizeErpObject(
            rawRecord,
            connection.erpSystem,
            objectType,
            mapping,
            externalId
          )

          const hash = calculateDataHash(rawRecord)
          const storeKey = `${connection.id}-${objectType}-${externalId}`

          // Check if record exists and has changed
          const existing = objectsStore.get(storeKey)
          if (existing) {
            const existingHash = existing.hash as string
            if (existingHash !== hash) {
              // Update
              objectsStore.set(storeKey, {
                ...normalized,
                hash,
                rawData: rawRecord,
                updatedAt: new Date().toISOString(),
              })
              syncLog.recordsUpdated++
            }
          } else {
            // Create
            objectsStore.set(storeKey, {
              ...normalized,
              hash,
              rawData: rawRecord,
            })
            syncLog.recordsCreated++
          }
        } catch (error) {
          syncLog.recordsFailed++
          syncLog.errors = syncLog.errors || []
          syncLog.errors.push({
            recordId: String(rawRecord.id || rawRecord.externalId || 'unknown'),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    // Update connection last sync
    connection.lastSyncAt = new Date().toISOString()
    connection.lastSyncStatus = syncLog.recordsFailed > 0 ? 'partial' : 'success'
    connectionsStore.set(connection.id, connection)

    // Mark sync complete
    syncLog.status = 'completed'
    syncLog.completedAt = new Date().toISOString()
    syncLog.duration_ms = Date.now() - new Date(syncLog.startedAt).getTime()

  } catch (error) {
    syncLog.status = 'failed'
    syncLog.errors = syncLog.errors || []
    syncLog.errors.push({
      recordId: 'sync',
      error: error instanceof Error ? error.message : 'Sync failed',
    })
    syncLog.completedAt = new Date().toISOString()
    syncLog.duration_ms = Date.now() - new Date(syncLog.startedAt).getTime()

    connection.lastSyncStatus = 'failed'
    connection.lastSyncError = error instanceof Error ? error.message : 'Unknown error'
    connectionsStore.set(connection.id, connection)
  }

  syncLogsStore.set(syncId, syncLog)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockConnection(id: string, accountId: string): IntegrationConnection {
  return {
    id,
    accountId,
    providerId: 'mock-provider',
    erpSystem: 'quickbooks',
    status: 'connected',
    syncDirection: 'bidirectional',
    syncFrequency: 'hourly',
    erpCompanyId: 'mock-company',
    erpCompanyName: 'Mock Company',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function getMapping(erpSystem: ErpSourceSystem, objectType: ObjectType): ObjectMapping {
  const key = `${erpSystem}-${objectType}`
  let mapping = mappingsStore.get(key)

  if (!mapping) {
    // Return default mapping
    mapping = {
      sourceSystem: erpSystem,
      objectType,
      fieldMappings: getDefaultFieldMappings(erpSystem, objectType),
      statusMapping: getDefaultStatusMapping(objectType),
    }
    mappingsStore.set(key, mapping)
  }

  return mapping
}

function getDefaultFieldMappings(
  erpSystem: ErpSourceSystem,
  objectType: ObjectType
): ObjectMapping['fieldMappings'] {
  // Basic field mappings that work for most ERPs
  const commonMappings: Record<ObjectType, ObjectMapping['fieldMappings']> = {
    purchase_order: [
      { sourceField: 'id', targetField: 'externalId' },
      { sourceField: 'number', targetField: 'poNumber' },
      { sourceField: 'vendor_id', targetField: 'vendorId' },
      { sourceField: 'vendor_name', targetField: 'vendorName' },
      { sourceField: 'total', targetField: 'totalAmount', transform: 'number' },
      { sourceField: 'currency', targetField: 'currency', transform: 'currency' },
      { sourceField: 'status', targetField: 'status' },
      { sourceField: 'created_at', targetField: 'createdAt', transform: 'date' },
    ],
    invoice: [
      { sourceField: 'id', targetField: 'externalId' },
      { sourceField: 'number', targetField: 'invoiceNumber' },
      { sourceField: 'vendor_id', targetField: 'vendorId' },
      { sourceField: 'vendor_name', targetField: 'vendorName' },
      { sourceField: 'total', targetField: 'totalAmount', transform: 'number' },
      { sourceField: 'amount_due', targetField: 'amountDue', transform: 'number' },
      { sourceField: 'currency', targetField: 'currency', transform: 'currency' },
      { sourceField: 'status', targetField: 'status' },
      { sourceField: 'date', targetField: 'invoiceDate', transform: 'date' },
      { sourceField: 'due_date', targetField: 'dueDate', transform: 'date' },
    ],
    vendor: [
      { sourceField: 'id', targetField: 'externalId' },
      { sourceField: 'name', targetField: 'name' },
      { sourceField: 'code', targetField: 'vendorCode' },
      { sourceField: 'status', targetField: 'status' },
      { sourceField: 'email', targetField: 'primaryContact.email' },
      { sourceField: 'phone', targetField: 'primaryContact.phone' },
    ],
    ledger_entry: [
      { sourceField: 'id', targetField: 'externalId' },
      { sourceField: 'journal_id', targetField: 'journalId' },
      { sourceField: 'account', targetField: 'accountCode' },
      { sourceField: 'account_name', targetField: 'accountName' },
      { sourceField: 'debit', targetField: 'debit', transform: 'number' },
      { sourceField: 'credit', targetField: 'credit', transform: 'number' },
      { sourceField: 'date', targetField: 'entryDate', transform: 'date' },
      { sourceField: 'description', targetField: 'description' },
    ],
  }

  return commonMappings[objectType] || []
}

function getDefaultStatusMapping(objectType: ObjectType): Record<string, string> {
  const statusMaps: Record<ObjectType, Record<string, string>> = {
    purchase_order: {
      draft: 'draft',
      pending: 'pending_approval',
      approved: 'approved',
      sent: 'sent',
      received: 'received',
      closed: 'closed',
      cancelled: 'cancelled',
    },
    invoice: {
      draft: 'draft',
      pending: 'pending_approval',
      approved: 'approved',
      paid: 'paid',
      overdue: 'overdue',
      cancelled: 'cancelled',
    },
    vendor: {
      active: 'active',
      inactive: 'inactive',
      pending: 'pending_approval',
      blocked: 'blocked',
    },
    ledger_entry: {},
  }

  return statusMaps[objectType] || {}
}

async function fetchFromErp(
  connection: IntegrationConnection,
  objectType: ObjectType,
  sinceDate?: string
): Promise<Record<string, unknown>[]> {
  // In production, this would make actual API calls to the ERP via the integration provider
  // For now, return mock data

  const mockData: Record<ObjectType, Record<string, unknown>[]> = {
    purchase_order: [
      {
        id: 'PO-001',
        number: 'PO-2024-001',
        vendor_id: 'V-001',
        vendor_name: 'Acme Supplies',
        total: 5000.00,
        currency: 'USD',
        status: 'approved',
        created_at: '2024-01-15T10:30:00Z',
        items: [
          { description: 'Widget A', quantity: 100, unit_price: 25.00, line_total: 2500.00 },
          { description: 'Widget B', quantity: 50, unit_price: 50.00, line_total: 2500.00 },
        ],
      },
      {
        id: 'PO-002',
        number: 'PO-2024-002',
        vendor_id: 'V-002',
        vendor_name: 'Tech Corp',
        total: 12500.00,
        currency: 'USD',
        status: 'pending',
        created_at: '2024-01-18T14:00:00Z',
        items: [
          { description: 'Server Hardware', quantity: 5, unit_price: 2500.00, line_total: 12500.00 },
        ],
      },
    ],
    invoice: [
      {
        id: 'INV-001',
        number: 'INV-2024-001',
        vendor_id: 'V-001',
        vendor_name: 'Acme Supplies',
        total: 5000.00,
        amount_due: 5000.00,
        currency: 'USD',
        status: 'pending',
        date: '2024-01-20',
        due_date: '2024-02-19',
      },
    ],
    vendor: [
      {
        id: 'V-001',
        name: 'Acme Supplies',
        code: 'ACME',
        status: 'active',
        email: 'ap@acme.com',
        phone: '+1-555-0100',
      },
      {
        id: 'V-002',
        name: 'Tech Corp',
        code: 'TECH',
        status: 'active',
        email: 'billing@techcorp.com',
        phone: '+1-555-0200',
      },
    ],
    ledger_entry: [
      {
        id: 'JE-001-1',
        journal_id: 'JE-001',
        account: '2000',
        account_name: 'Accounts Payable',
        debit: 0,
        credit: 5000.00,
        date: '2024-01-20',
        description: 'Invoice INV-2024-001',
      },
      {
        id: 'JE-001-2',
        journal_id: 'JE-001',
        account: '5100',
        account_name: 'Inventory',
        debit: 5000.00,
        credit: 0,
        date: '2024-01-20',
        description: 'Invoice INV-2024-001',
      },
    ],
  }

  // Filter by date if provided
  let records = mockData[objectType] || []
  if (sinceDate) {
    const since = new Date(sinceDate)
    records = records.filter(r => {
      const recordDate = new Date(String(r.created_at || r.date || '2024-01-01'))
      return recordDate >= since
    })
  }

  return records
}

function extractExternalId(record: Record<string, unknown>, objectType: ObjectType): string {
  return String(
    record.id ||
    record.externalId ||
    record.Id ||
    record.number ||
    crypto.randomUUID()
  )
}

// Export for Next.js App Router
export { GET as getSyncStatus, POST as triggerSync }
