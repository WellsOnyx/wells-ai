// @ts-nocheck
/**
 * Layer 2: G&V Internal ERP - Ledger API
 * GET /api/gv/erp/ledger
 * GET /api/gv/erp/programs/:id/ledger
 *
 * Query GL entries, float ledger, yield ledger, and escrow ledgers
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  GvGlEntry,
  GvFloatLedger,
  GvYieldLedger,
  GvEscrowAccount,
  GvEscrowTransaction,
  LedgerQueryParams,
  PaginatedResponse,
} from '../types'

// In-memory stores
const glEntriesStore: Map<string, GvGlEntry> = new Map()
const floatLedgerStore: Map<string, GvFloatLedger> = new Map()
const yieldLedgerStore: Map<string, GvYieldLedger> = new Map()
const escrowAccountsStore: Map<string, GvEscrowAccount> = new Map()
const escrowTransactionsStore: Map<string, GvEscrowTransaction> = new Map()

// Initialize sample data
initializeSampleData()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ledgerType = searchParams.get('ledgerType') || 'operating'
    const accountId = searchParams.get('accountId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const referenceType = searchParams.get('referenceType')
    const isReconciled = searchParams.get('isReconciled')
    const programId = searchParams.get('programId') // For escrow
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    let entries: (GvGlEntry | GvFloatLedger | GvYieldLedger | GvEscrowTransaction)[] = []

    switch (ledgerType) {
      case 'operating':
        entries = Array.from(glEntriesStore.values()).filter(e => e.ledgerType === 'operating')
        break
      case 'float':
        entries = Array.from(floatLedgerStore.values())
        break
      case 'yield':
        entries = Array.from(yieldLedgerStore.values())
        break
      case 'escrow':
        if (programId) {
          entries = Array.from(escrowTransactionsStore.values())
            .filter(t => t.escrowAccountId === programId)
        } else {
          entries = Array.from(escrowTransactionsStore.values())
        }
        break
      default:
        entries = Array.from(glEntriesStore.values())
    }

    // Apply filters
    if (accountId) {
      entries = entries.filter((e: Record<string, unknown>) =>
        e.accountId === accountId || e.account_id === accountId
      )
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      entries = entries.filter((e: Record<string, unknown>) => {
        const entryDate = new Date(String(e.entryDate || e.entry_date || e.createdAt))
        return entryDate >= from
      })
    }

    if (dateTo) {
      const to = new Date(dateTo)
      entries = entries.filter((e: Record<string, unknown>) => {
        const entryDate = new Date(String(e.entryDate || e.entry_date || e.createdAt))
        return entryDate <= to
      })
    }

    if (referenceType && ledgerType === 'operating') {
      entries = entries.filter((e: GvGlEntry) => e.referenceType === referenceType)
    }

    if (isReconciled !== null && ledgerType === 'operating') {
      entries = entries.filter((e: GvGlEntry) => e.isReconciled === (isReconciled === 'true'))
    }

    // Sort by date descending
    entries.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const dateA = new Date(String(a.entryDate || a.entry_date || a.createdAt))
      const dateB = new Date(String(b.entryDate || b.entry_date || b.createdAt))
      return dateB.getTime() - dateA.getTime()
    })

    // Calculate summary
    const summary = calculateSummary(entries, ledgerType)

    // Pagination
    const total = entries.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const paginatedEntries = entries.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      ledgerType,
      summary,
      data: paginatedEntries,
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    })
  } catch (error) {
    console.error('GET ledger error:', error)
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 })
  }
}

// Get escrow account summary
export async function getEscrowPrograms(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const status = searchParams.get('status')

    let accounts = Array.from(escrowAccountsStore.values())

    if (accountId) accounts = accounts.filter(a => a.accountId === accountId)
    if (status) accounts = accounts.filter(a => a.status === status)

    return NextResponse.json({
      data: accounts,
      total: accounts.length,
    })
  } catch (error) {
    console.error('GET escrow programs error:', error)
    return NextResponse.json({ error: 'Failed to fetch escrow programs' }, { status: 500 })
  }
}

// Get trial balance
export async function getTrialBalance(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0]

    const entries = Array.from(glEntriesStore.values())
      .filter(e => e.entryDate <= asOfDate && e.isPosted)

    // Group by account
    const accountBalances: Map<string, {
      accountCode: string
      accountName: string
      debits: number
      credits: number
      balance: number
    }> = new Map()

    for (const entry of entries) {
      const key = entry.accountCode
      const existing = accountBalances.get(key) || {
        accountCode: entry.accountCode,
        accountName: entry.accountName || entry.accountCode,
        debits: 0,
        credits: 0,
        balance: 0,
      }

      existing.debits += entry.debit
      existing.credits += entry.credit
      existing.balance = existing.debits - existing.credits

      accountBalances.set(key, existing)
    }

    const trialBalance = Array.from(accountBalances.values())
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

    const totalDebits = trialBalance.reduce((sum, a) => sum + a.debits, 0)
    const totalCredits = trialBalance.reduce((sum, a) => sum + a.credits, 0)

    return NextResponse.json({
      asOfDate,
      accounts: trialBalance,
      totals: {
        debits: totalDebits,
        credits: totalCredits,
        difference: totalDebits - totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    })
  } catch (error) {
    console.error('GET trial balance error:', error)
    return NextResponse.json({ error: 'Failed to fetch trial balance' }, { status: 500 })
  }
}

function calculateSummary(
  entries: (GvGlEntry | GvFloatLedger | GvYieldLedger | GvEscrowTransaction)[],
  ledgerType: string
): Record<string, number> {
  switch (ledgerType) {
    case 'operating':
      return {
        totalDebits: (entries as GvGlEntry[]).reduce((sum, e) => sum + e.debit, 0),
        totalCredits: (entries as GvGlEntry[]).reduce((sum, e) => sum + e.credit, 0),
        entryCount: entries.length,
      }
    case 'float':
      const floatEntries = entries as GvFloatLedger[]
      return {
        totalDeposits: floatEntries.filter(e => e.transactionType === 'deposit').reduce((sum, e) => sum + e.amount, 0),
        totalWithdrawals: floatEntries.filter(e => e.transactionType === 'withdrawal').reduce((sum, e) => sum + Math.abs(e.amount), 0),
        currentBalance: floatEntries.length > 0 ? floatEntries[0].runningBalance : 0,
      }
    case 'yield':
      return {
        totalYieldEarned: (entries as GvYieldLedger[]).reduce((sum, e) => sum + e.yieldAmount, 0),
        averageRate: entries.length > 0
          ? (entries as GvYieldLedger[]).reduce((sum, e) => sum + e.yieldRate, 0) / entries.length
          : 0,
      }
    case 'escrow':
      return {
        totalDeposits: (entries as GvEscrowTransaction[])
          .filter(e => e.transactionType === 'deposit')
          .reduce((sum, e) => sum + e.amount, 0),
        totalReleases: (entries as GvEscrowTransaction[])
          .filter(e => e.transactionType === 'release')
          .reduce((sum, e) => sum + e.amount, 0),
      }
    default:
      return {}
  }
}

function initializeSampleData() {
  // Sample GL entries
  const glEntries: Partial<GvGlEntry>[] = [
    {
      id: 'gl-001',
      journalId: 'JE-2024-001',
      journalNumber: 'JE-2024-001',
      entryNumber: 1,
      ledgerType: 'operating',
      entryDate: '2024-01-22',
      postingDate: '2024-01-22',
      period: '2024-01',
      fiscalYear: 2024,
      accountId: 'acc-2000',
      accountCode: '2000',
      accountName: 'Accounts Payable',
      debit: 0,
      credit: 15750.00,
      amount: -15750.00,
      currency: 'USD',
      description: 'Invoice INV-2024-05001 from Acme Industrial',
      referenceType: 'invoice',
      referenceId: 'inv-001',
      isPosted: true,
      isReversed: false,
      isReconciled: false,
      createdAt: '2024-01-22T10:00:00Z',
      createdBy: 'system',
    },
    {
      id: 'gl-002',
      journalId: 'JE-2024-001',
      journalNumber: 'JE-2024-001',
      entryNumber: 2,
      ledgerType: 'operating',
      entryDate: '2024-01-22',
      postingDate: '2024-01-22',
      period: '2024-01',
      fiscalYear: 2024,
      accountId: 'acc-1200',
      accountCode: '1200',
      accountName: 'Inventory',
      debit: 15750.00,
      credit: 0,
      amount: 15750.00,
      currency: 'USD',
      description: 'Invoice INV-2024-05001 from Acme Industrial',
      referenceType: 'invoice',
      referenceId: 'inv-001',
      isPosted: true,
      isReversed: false,
      isReconciled: false,
      createdAt: '2024-01-22T10:00:00Z',
      createdBy: 'system',
    },
  ]

  glEntries.forEach(e => glEntriesStore.set(e.id!, e as GvGlEntry))

  // Sample Float Ledger
  const floatEntries: Partial<GvFloatLedger>[] = [
    {
      id: 'float-001',
      accountId: 'gv-account-001',
      entryDate: '2024-01-15',
      transactionType: 'deposit',
      amount: 100000,
      runningBalance: 100000,
      currency: 'USD',
      sourceType: 'grain_deposit',
      description: 'Initial GRAIN deposit',
      isSettled: true,
      createdAt: '2024-01-15T09:00:00Z',
    },
    {
      id: 'float-002',
      accountId: 'gv-account-001',
      entryDate: '2024-01-20',
      transactionType: 'payment_in_flight',
      amount: -15750,
      runningBalance: 84250,
      currency: 'USD',
      destinationType: 'payment_sent',
      description: 'Payment to Acme Industrial',
      isSettled: false,
      expectedSettlementDate: '2024-01-20',
      createdAt: '2024-01-20T14:30:00Z',
    },
  ]

  floatEntries.forEach(e => floatLedgerStore.set(e.id!, e as GvFloatLedger))

  // Sample Yield Ledger
  const yieldEntries: Partial<GvYieldLedger>[] = [
    {
      id: 'yield-001',
      accountId: 'gv-account-001',
      entryDate: '2024-01-31',
      yieldType: 'interest',
      principalAmount: 100000,
      yieldAmount: 410.96,
      yieldRate: 0.05,
      runningYieldBalance: 410.96,
      currency: 'USD',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      daysInPeriod: 31,
      sourceProgram: 'GRAIN Float Pool',
      isPosted: true,
      isWithdrawn: false,
      createdAt: '2024-01-31T23:59:59Z',
    },
  ]

  yieldEntries.forEach(e => yieldLedgerStore.set(e.id!, e as GvYieldLedger))

  // Sample Escrow
  const escrowAccount: GvEscrowAccount = {
    id: 'escrow-001',
    escrowCode: 'ESC-DEAL-001',
    escrowType: 'trade_escrow',
    accountId: 'gv-account-001',
    status: 'active',
    depositorId: 'buyer-001',
    depositorName: 'ABC Corp',
    beneficiaryId: 'vendor-001',
    beneficiaryName: 'Acme Industrial',
    totalDeposited: 50000,
    totalReleased: 0,
    totalRefunded: 0,
    currentBalance: 50000,
    currency: 'USD',
    releaseConditions: 'Goods received and inspected',
    dealId: 'deal-001',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  }

  escrowAccountsStore.set(escrowAccount.id, escrowAccount)

  const escrowTx: GvEscrowTransaction = {
    id: 'escrow-tx-001',
    escrowAccountId: 'escrow-001',
    transactionType: 'deposit',
    amount: 50000,
    currency: 'USD',
    runningBalance: 50000,
    fromParty: 'ABC Corp',
    description: 'Initial escrow deposit for Deal-001',
    authorizedBy: 'system',
    authorizedAt: '2024-01-10T10:00:00Z',
    createdAt: '2024-01-10T10:00:00Z',
  }

  escrowTransactionsStore.set(escrowTx.id, escrowTx)
}

export { GET as getLedger, getEscrowPrograms, getTrialBalance }
