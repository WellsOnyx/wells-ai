// @ts-nocheck
/**
 * Treasury Database Operations
 *
 * Handles all database operations for the Grain & Vault Treasury SDK
 * Persists accounts, wallets, transactions, vendors, and invoices
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface TreasuryAccount {
  id: string
  clerkUserId: string

  // Company Info
  companyName: string
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  industry: string
  country: string

  // ERP Integration
  erpSystem: 'sap' | 'oracle' | 'netsuite' | 'dynamics365' | 'workday' | 'coupa' | 'other' | 'none'
  erpVersion?: string
  erpConnected: boolean
  erpConfig?: Record<string, any>

  // Account Status
  tier: 'starter' | 'growth' | 'enterprise'
  status: 'pending' | 'active' | 'suspended' | 'closed'

  // API Access
  apiKey: string
  sdkEnabled: boolean

  // Balances
  grainBalance: number
  creditLine: number
  usedCredit: number

  // Metadata
  metadata?: Record<string, any>

  // Timestamps
  createdAt: Date
  updatedAt: Date
  onboardingCompletedAt?: Date
  lastActivityAt?: Date
}

export interface TreasuryWallet {
  id: string
  accountId: string
  walletId: string
  address: string
  blockchain: string
  currency: string
  balance: number
  grainValueAtDeposit: number
  currentGrainValue: number
  status: 'active' | 'inactive' | 'frozen'
  kycStatus: 'not-started' | 'pending' | 'approved' | 'rejected'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  lastSyncAt?: Date
}

export interface TreasuryTransaction {
  id: string
  accountId: string
  type: 'payment' | 'receipt' | 'credit_draw' | 'credit_repay' | 'conversion' | 'reserve'
  amount: number
  currency: 'GRAIN' | 'USDC' | 'USD'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  fromWallet?: string
  toWallet?: string
  circleTxId?: string
  circleTransferId?: string
  counterpartyId?: string
  counterpartyName?: string
  counterpartyWallet?: string
  erpReference?: string
  costCenter?: string
  glAccount?: string
  description?: string
  memo?: string
  metadata?: Record<string, any>
  errorCode?: string
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  failedAt?: Date
}

export interface TreasuryVendor {
  id: string
  accountId: string
  vendorId: string
  vendorName: string
  email?: string
  phone?: string
  walletId?: string
  walletAddress?: string
  paymentTerms?: string
  earlyPaymentDiscount?: number
  earlyPaymentDays?: number
  autoPayEnabled: boolean
  trustScore?: number
  status: 'active' | 'inactive' | 'blocked'
  onboardingStatus: 'invited' | 'pending' | 'completed' | 'declined'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  invitedAt?: Date
  onboardedAt?: Date
  lastPaymentAt?: Date
}

export interface TreasuryInvoice {
  id: string
  accountId: string
  vendorId?: string
  erpInvoiceId: string
  invoiceNumber: string
  amount: number
  currency: string
  invoiceDate: Date
  dueDate: Date
  status: 'pending' | 'approved' | 'paid' | 'cancelled' | 'overdue'
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'failed'
  paidAmount: number
  transactionId?: string
  erpPoNumber?: string
  costCenter?: string
  glAccount?: string
  description?: string
  metadata?: Record<string, any>
  syncedAt?: Date
  syncStatus: 'synced' | 'pending' | 'failed'
  createdAt: Date
  updatedAt: Date
  paidAt?: Date
}

export interface TreasuryCreditLine {
  id: string
  accountId: string
  limitAmount: number
  drawnAmount: number
  availableAmount: number
  interestRate: number
  gracePeriodDays: number
  status: 'active' | 'suspended' | 'closed'
  lastDrawAt?: Date
  lastRepayAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// ACCOUNT OPERATIONS
// ============================================================================

export async function createAccount(input: {
  clerkUserId: string
  companyName: string
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  industry: string
  country?: string
  erpSystem: TreasuryAccount['erpSystem']
  erpVersion?: string
  tier?: 'starter' | 'growth' | 'enterprise'
  walletAddress?: string
}): Promise<TreasuryAccount> {
  try {
    // Generate account ID and API key
    const accountId = `gv_${Date.now()}`
    const apiKey = `gv_live_${generateRandomString(32)}`

    const result = await sql`
      INSERT INTO treasury_accounts (
        id,
        clerk_user_id,
        company_name,
        company_size,
        industry,
        country,
        erp_system,
        erp_version,
        tier,
        api_key,
        onboarding_completed_at,
        last_activity_at
      ) VALUES (
        ${accountId},
        ${input.clerkUserId},
        ${input.companyName},
        ${input.companySize},
        ${input.industry},
        ${input.country || 'US'},
        ${input.erpSystem},
        ${input.erpVersion || null},
        ${input.tier || 'starter'},
        ${apiKey},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const account = mapAccountFromDb(result.rows[0])

    // Create default credit line
    await createCreditLine(accountId, 0)

    return account
  } catch (error) {
    console.error('Error creating treasury account:', error)
    throw new Error('Failed to create treasury account')
  }
}

export async function getAccount(accountId: string): Promise<TreasuryAccount | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_accounts WHERE id = ${accountId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapAccountFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury account:', error)
    throw new Error('Failed to fetch treasury account')
  }
}

export async function getAccountByClerkId(clerkUserId: string): Promise<TreasuryAccount | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_accounts WHERE clerk_user_id = ${clerkUserId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapAccountFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury account by clerk ID:', error)
    throw new Error('Failed to fetch treasury account')
  }
}

export async function getAccountByApiKey(apiKey: string): Promise<TreasuryAccount | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_accounts WHERE api_key = ${apiKey}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapAccountFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury account by API key:', error)
    throw new Error('Failed to fetch treasury account')
  }
}

export async function updateAccount(
  accountId: string,
  updates: Partial<{
    companyName: string
    status: TreasuryAccount['status']
    tier: TreasuryAccount['tier']
    erpConnected: boolean
    erpConfig: Record<string, any>
    sdkEnabled: boolean
    metadata: Record<string, any>
  }>
): Promise<TreasuryAccount> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.companyName !== undefined) {
      setClauses.push(`company_name = $${params.length + 1}`)
      params.push(updates.companyName)
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${params.length + 1}`)
      params.push(updates.status)
    }
    if (updates.tier !== undefined) {
      setClauses.push(`tier = $${params.length + 1}`)
      params.push(updates.tier)
    }
    if (updates.erpConnected !== undefined) {
      setClauses.push(`erp_connected = $${params.length + 1}`)
      params.push(updates.erpConnected)
    }
    if (updates.erpConfig !== undefined) {
      setClauses.push(`erp_config = $${params.length + 1}`)
      params.push(JSON.stringify(updates.erpConfig))
    }
    if (updates.sdkEnabled !== undefined) {
      setClauses.push(`sdk_enabled = $${params.length + 1}`)
      params.push(updates.sdkEnabled)
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${params.length + 1}`)
      params.push(JSON.stringify(updates.metadata))
    }

    setClauses.push(`last_activity_at = NOW()`)

    const updateQuery = `
      UPDATE treasury_accounts
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, accountId])

    if (result.rows.length === 0) {
      throw new Error('Account not found')
    }

    return mapAccountFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating treasury account:', error)
    throw new Error('Failed to update treasury account')
  }
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

export async function createWallet(input: {
  accountId: string
  walletId: string
  address: string
  blockchain?: string
  currency?: string
}): Promise<TreasuryWallet> {
  try {
    const result = await sql`
      INSERT INTO treasury_wallets (
        account_id,
        wallet_id,
        address,
        blockchain,
        currency,
        last_sync_at
      ) VALUES (
        ${input.accountId},
        ${input.walletId},
        ${input.address},
        ${input.blockchain || 'BASE'},
        ${input.currency || 'USDC'},
        NOW()
      )
      RETURNING *
    `

    return mapWalletFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating treasury wallet:', error)
    throw new Error('Failed to create treasury wallet')
  }
}

export async function getWallets(accountId: string): Promise<TreasuryWallet[]> {
  try {
    const result = await sql`
      SELECT * FROM treasury_wallets
      WHERE account_id = ${accountId}
      ORDER BY created_at DESC
    `

    return result.rows.map(mapWalletFromDb)
  } catch (error) {
    console.error('Error fetching treasury wallets:', error)
    throw new Error('Failed to fetch treasury wallets')
  }
}

export async function getWalletByAddress(address: string): Promise<TreasuryWallet | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_wallets WHERE address = ${address}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapWalletFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury wallet:', error)
    throw new Error('Failed to fetch treasury wallet')
  }
}

export async function getWalletByWalletId(walletId: string): Promise<TreasuryWallet | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_wallets WHERE wallet_id = ${walletId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapWalletFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury wallet:', error)
    throw new Error('Failed to fetch treasury wallet')
  }
}

export async function updateWalletBalance(
  walletId: string,
  balance: number,
  currentGrainValue?: number
): Promise<TreasuryWallet> {
  try {
    const result = await sql`
      UPDATE treasury_wallets
      SET
        balance = ${balance},
        current_grain_value = COALESCE(${currentGrainValue || null}, current_grain_value),
        last_sync_at = NOW()
      WHERE wallet_id = ${walletId}
      RETURNING *
    `

    if (result.rows.length === 0) {
      throw new Error('Wallet not found')
    }

    return mapWalletFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating wallet balance:', error)
    throw new Error('Failed to update wallet balance')
  }
}

// ============================================================================
// TRANSACTION OPERATIONS
// ============================================================================

export async function createTransaction(input: {
  accountId: string
  type: TreasuryTransaction['type']
  amount: number
  currency?: 'GRAIN' | 'USDC' | 'USD'
  fromWallet?: string
  toWallet?: string
  circleTxId?: string
  circleTransferId?: string
  counterpartyId?: string
  counterpartyName?: string
  counterpartyWallet?: string
  erpReference?: string
  costCenter?: string
  glAccount?: string
  description?: string
  memo?: string
  metadata?: Record<string, any>
}): Promise<TreasuryTransaction> {
  try {
    const result = await sql`
      INSERT INTO treasury_transactions (
        account_id,
        type,
        amount,
        currency,
        status,
        from_wallet,
        to_wallet,
        circle_tx_id,
        circle_transfer_id,
        counterparty_id,
        counterparty_name,
        counterparty_wallet,
        erp_reference,
        cost_center,
        gl_account,
        description,
        memo,
        metadata
      ) VALUES (
        ${input.accountId},
        ${input.type},
        ${input.amount},
        ${input.currency || 'GRAIN'},
        'pending',
        ${input.fromWallet || null},
        ${input.toWallet || null},
        ${input.circleTxId || null},
        ${input.circleTransferId || null},
        ${input.counterpartyId || null},
        ${input.counterpartyName || null},
        ${input.counterpartyWallet || null},
        ${input.erpReference || null},
        ${input.costCenter || null},
        ${input.glAccount || null},
        ${input.description || null},
        ${input.memo || null},
        ${JSON.stringify(input.metadata || {})}
      )
      RETURNING *
    `

    return mapTransactionFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating treasury transaction:', error)
    throw new Error('Failed to create treasury transaction')
  }
}

export async function getTransaction(transactionId: string): Promise<TreasuryTransaction | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_transactions WHERE id = ${transactionId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapTransactionFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury transaction:', error)
    throw new Error('Failed to fetch treasury transaction')
  }
}

export async function getTransactions(
  accountId: string,
  filters?: {
    type?: string
    status?: string
    limit?: number
    offset?: number
  }
): Promise<{ transactions: TreasuryTransaction[]; total: number }> {
  try {
    const conditions: string[] = [`account_id = $1`]
    const params: any[] = [accountId]

    if (filters?.type) {
      conditions.push(`type = $${params.length + 1}`)
      params.push(filters.type)
    }
    if (filters?.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(filters.status)
    }

    const whereClause = conditions.join(' AND ')
    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM treasury_transactions WHERE ${whereClause}`
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)

    // Get transactions
    const transactionsQuery = `
      SELECT * FROM treasury_transactions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `
    const transactionsResult = await sql.query(transactionsQuery, [...params, limit, offset])

    const transactions = transactionsResult.rows.map(mapTransactionFromDb)

    return { transactions, total }
  } catch (error) {
    console.error('Error fetching treasury transactions:', error)
    throw new Error('Failed to fetch treasury transactions')
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: TreasuryTransaction['status'],
  error?: { code: string; message: string }
): Promise<TreasuryTransaction> {
  try {
    let result

    if (status === 'completed') {
      result = await sql`
        UPDATE treasury_transactions
        SET
          status = ${status},
          completed_at = NOW()
        WHERE id = ${transactionId}
        RETURNING *
      `
    } else if (status === 'failed') {
      result = await sql`
        UPDATE treasury_transactions
        SET
          status = ${status},
          failed_at = NOW(),
          error_code = ${error?.code || null},
          error_message = ${error?.message || null}
        WHERE id = ${transactionId}
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE treasury_transactions
        SET status = ${status}
        WHERE id = ${transactionId}
        RETURNING *
      `
    }

    if (result.rows.length === 0) {
      throw new Error('Transaction not found')
    }

    return mapTransactionFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating transaction status:', error)
    throw new Error('Failed to update transaction status')
  }
}

// ============================================================================
// CREDIT LINE OPERATIONS
// ============================================================================

export async function createCreditLine(
  accountId: string,
  limitAmount: number
): Promise<TreasuryCreditLine> {
  try {
    const result = await sql`
      INSERT INTO treasury_credit_lines (account_id, limit_amount)
      VALUES (${accountId}, ${limitAmount})
      ON CONFLICT (account_id) DO UPDATE
      SET limit_amount = ${limitAmount}
      RETURNING *
    `

    return mapCreditLineFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating credit line:', error)
    throw new Error('Failed to create credit line')
  }
}

export async function getCreditLine(accountId: string): Promise<TreasuryCreditLine | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_credit_lines WHERE account_id = ${accountId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapCreditLineFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching credit line:', error)
    throw new Error('Failed to fetch credit line')
  }
}

export async function updateCreditLine(
  accountId: string,
  updates: {
    limitAmount?: number
    drawnAmount?: number
  }
): Promise<TreasuryCreditLine> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.limitAmount !== undefined) {
      setClauses.push(`limit_amount = $${params.length + 1}`)
      params.push(updates.limitAmount)
    }
    if (updates.drawnAmount !== undefined) {
      setClauses.push(`drawn_amount = $${params.length + 1}`)
      params.push(updates.drawnAmount)

      if (updates.drawnAmount > 0) {
        setClauses.push(`last_draw_at = NOW()`)
      } else {
        setClauses.push(`last_repay_at = NOW()`)
      }
    }

    const updateQuery = `
      UPDATE treasury_credit_lines
      SET ${setClauses.join(', ')}
      WHERE account_id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, accountId])

    if (result.rows.length === 0) {
      throw new Error('Credit line not found')
    }

    return mapCreditLineFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating credit line:', error)
    throw new Error('Failed to update credit line')
  }
}

// ============================================================================
// VENDOR OPERATIONS
// ============================================================================

export async function createVendor(input: {
  accountId: string
  vendorId: string
  vendorName: string
  email?: string
  phone?: string
  walletAddress?: string
  paymentTerms?: string
}): Promise<TreasuryVendor> {
  try {
    const result = await sql`
      INSERT INTO treasury_vendors (
        account_id,
        vendor_id,
        vendor_name,
        email,
        phone,
        wallet_address,
        payment_terms,
        invited_at
      ) VALUES (
        ${input.accountId},
        ${input.vendorId},
        ${input.vendorName},
        ${input.email || null},
        ${input.phone || null},
        ${input.walletAddress || null},
        ${input.paymentTerms || null},
        NOW()
      )
      RETURNING *
    `

    return mapVendorFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating treasury vendor:', error)
    throw new Error('Failed to create treasury vendor')
  }
}

export async function getVendor(vendorId: string): Promise<TreasuryVendor | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_vendors WHERE id = ${vendorId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapVendorFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury vendor:', error)
    throw new Error('Failed to fetch treasury vendor')
  }
}

export async function getVendors(accountId: string): Promise<TreasuryVendor[]> {
  try {
    const result = await sql`
      SELECT * FROM treasury_vendors
      WHERE account_id = ${accountId}
      ORDER BY vendor_name ASC
    `

    return result.rows.map(mapVendorFromDb)
  } catch (error) {
    console.error('Error fetching treasury vendors:', error)
    throw new Error('Failed to fetch treasury vendors')
  }
}

export async function updateVendor(
  vendorId: string,
  updates: Partial<{
    vendorName: string
    email: string
    walletAddress: string
    paymentTerms: string
    autoPayEnabled: boolean
    status: TreasuryVendor['status']
    onboardingStatus: TreasuryVendor['onboardingStatus']
  }>
): Promise<TreasuryVendor> {
  try {
    const setClauses: string[] = []
    const params: any[] = []

    if (updates.vendorName !== undefined) {
      setClauses.push(`vendor_name = $${params.length + 1}`)
      params.push(updates.vendorName)
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${params.length + 1}`)
      params.push(updates.email)
    }
    if (updates.walletAddress !== undefined) {
      setClauses.push(`wallet_address = $${params.length + 1}`)
      params.push(updates.walletAddress)
    }
    if (updates.paymentTerms !== undefined) {
      setClauses.push(`payment_terms = $${params.length + 1}`)
      params.push(updates.paymentTerms)
    }
    if (updates.autoPayEnabled !== undefined) {
      setClauses.push(`auto_pay_enabled = $${params.length + 1}`)
      params.push(updates.autoPayEnabled)
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${params.length + 1}`)
      params.push(updates.status)
    }
    if (updates.onboardingStatus !== undefined) {
      setClauses.push(`onboarding_status = $${params.length + 1}`)
      params.push(updates.onboardingStatus)

      if (updates.onboardingStatus === 'completed') {
        setClauses.push(`onboarded_at = NOW()`)
      }
    }

    const updateQuery = `
      UPDATE treasury_vendors
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length + 1}
      RETURNING *
    `

    const result = await sql.query(updateQuery, [...params, vendorId])

    if (result.rows.length === 0) {
      throw new Error('Vendor not found')
    }

    return mapVendorFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating treasury vendor:', error)
    throw new Error('Failed to update treasury vendor')
  }
}

// ============================================================================
// INVOICE OPERATIONS
// ============================================================================

export async function createInvoice(input: {
  accountId: string
  vendorId?: string
  erpInvoiceId: string
  invoiceNumber: string
  amount: number
  currency?: string
  invoiceDate: Date
  dueDate: Date
  erpPoNumber?: string
  costCenter?: string
  glAccount?: string
  description?: string
}): Promise<TreasuryInvoice> {
  try {
    const result = await sql`
      INSERT INTO treasury_invoices (
        account_id,
        vendor_id,
        erp_invoice_id,
        invoice_number,
        amount,
        currency,
        invoice_date,
        due_date,
        erp_po_number,
        cost_center,
        gl_account,
        description,
        synced_at
      ) VALUES (
        ${input.accountId},
        ${input.vendorId || null},
        ${input.erpInvoiceId},
        ${input.invoiceNumber},
        ${input.amount},
        ${input.currency || 'USD'},
        ${input.invoiceDate},
        ${input.dueDate},
        ${input.erpPoNumber || null},
        ${input.costCenter || null},
        ${input.glAccount || null},
        ${input.description || null},
        NOW()
      )
      ON CONFLICT (account_id, erp_invoice_id) DO UPDATE
      SET
        amount = ${input.amount},
        due_date = ${input.dueDate},
        synced_at = NOW()
      RETURNING *
    `

    return mapInvoiceFromDb(result.rows[0])
  } catch (error) {
    console.error('Error creating treasury invoice:', error)
    throw new Error('Failed to create treasury invoice')
  }
}

export async function getInvoice(invoiceId: string): Promise<TreasuryInvoice | null> {
  try {
    const result = await sql`
      SELECT * FROM treasury_invoices WHERE id = ${invoiceId}
    `

    if (result.rows.length === 0) {
      return null
    }

    return mapInvoiceFromDb(result.rows[0])
  } catch (error) {
    console.error('Error fetching treasury invoice:', error)
    throw new Error('Failed to fetch treasury invoice')
  }
}

export async function getInvoices(
  accountId: string,
  filters?: {
    status?: string
    paymentStatus?: string
    vendorId?: string
    limit?: number
    offset?: number
  }
): Promise<{ invoices: TreasuryInvoice[]; total: number }> {
  try {
    const conditions: string[] = [`account_id = $1`]
    const params: any[] = [accountId]

    if (filters?.status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(filters.status)
    }
    if (filters?.paymentStatus) {
      conditions.push(`payment_status = $${params.length + 1}`)
      params.push(filters.paymentStatus)
    }
    if (filters?.vendorId) {
      conditions.push(`vendor_id = $${params.length + 1}`)
      params.push(filters.vendorId)
    }

    const whereClause = conditions.join(' AND ')
    const limit = filters?.limit || 100
    const offset = filters?.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM treasury_invoices WHERE ${whereClause}`
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)

    // Get invoices
    const invoicesQuery = `
      SELECT * FROM treasury_invoices
      WHERE ${whereClause}
      ORDER BY due_date ASC, created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `
    const invoicesResult = await sql.query(invoicesQuery, [...params, limit, offset])

    const invoices = invoicesResult.rows.map(mapInvoiceFromDb)

    return { invoices, total }
  } catch (error) {
    console.error('Error fetching treasury invoices:', error)
    throw new Error('Failed to fetch treasury invoices')
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: TreasuryInvoice['status'],
  paymentStatus?: TreasuryInvoice['paymentStatus'],
  transactionId?: string
): Promise<TreasuryInvoice> {
  try {
    let result

    if (status === 'paid' && transactionId) {
      result = await sql`
        UPDATE treasury_invoices
        SET
          status = ${status},
          payment_status = 'paid',
          transaction_id = ${transactionId},
          paid_amount = amount,
          paid_at = NOW()
        WHERE id = ${invoiceId}
        RETURNING *
      `
    } else if (paymentStatus) {
      result = await sql`
        UPDATE treasury_invoices
        SET
          status = ${status},
          payment_status = ${paymentStatus}
        WHERE id = ${invoiceId}
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE treasury_invoices
        SET status = ${status}
        WHERE id = ${invoiceId}
        RETURNING *
      `
    }

    if (result.rows.length === 0) {
      throw new Error('Invoice not found')
    }

    return mapInvoiceFromDb(result.rows[0])
  } catch (error) {
    console.error('Error updating invoice status:', error)
    throw new Error('Failed to update invoice status')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapAccountFromDb(row: any): TreasuryAccount {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    companyName: row.company_name,
    companySize: row.company_size,
    industry: row.industry,
    country: row.country,
    erpSystem: row.erp_system,
    erpVersion: row.erp_version,
    erpConnected: row.erp_connected,
    erpConfig: row.erp_config,
    tier: row.tier,
    status: row.status,
    apiKey: row.api_key,
    sdkEnabled: row.sdk_enabled,
    grainBalance: parseFloat(row.grain_balance || '0'),
    creditLine: parseFloat(row.credit_line || '0'),
    usedCredit: parseFloat(row.used_credit || '0'),
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    onboardingCompletedAt: row.onboarding_completed_at,
    lastActivityAt: row.last_activity_at,
  }
}

function mapWalletFromDb(row: any): TreasuryWallet {
  return {
    id: row.id,
    accountId: row.account_id,
    walletId: row.wallet_id,
    address: row.address,
    blockchain: row.blockchain,
    currency: row.currency,
    balance: parseFloat(row.balance || '0'),
    grainValueAtDeposit: parseFloat(row.grain_value_at_deposit || '1'),
    currentGrainValue: parseFloat(row.current_grain_value || '1'),
    status: row.status,
    kycStatus: row.kyc_status,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncAt: row.last_sync_at,
  }
}

function mapTransactionFromDb(row: any): TreasuryTransaction {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    fromWallet: row.from_wallet,
    toWallet: row.to_wallet,
    circleTxId: row.circle_tx_id,
    circleTransferId: row.circle_transfer_id,
    counterpartyId: row.counterparty_id,
    counterpartyName: row.counterparty_name,
    counterpartyWallet: row.counterparty_wallet,
    erpReference: row.erp_reference,
    costCenter: row.cost_center,
    glAccount: row.gl_account,
    description: row.description,
    memo: row.memo,
    metadata: row.metadata,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
  }
}

function mapVendorFromDb(row: any): TreasuryVendor {
  return {
    id: row.id,
    accountId: row.account_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    email: row.email,
    phone: row.phone,
    walletId: row.wallet_id,
    walletAddress: row.wallet_address,
    paymentTerms: row.payment_terms,
    earlyPaymentDiscount: row.early_payment_discount ? parseFloat(row.early_payment_discount) : undefined,
    earlyPaymentDays: row.early_payment_days,
    autoPayEnabled: row.auto_pay_enabled,
    trustScore: row.trust_score,
    status: row.status,
    onboardingStatus: row.onboarding_status,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invitedAt: row.invited_at,
    onboardedAt: row.onboarded_at,
    lastPaymentAt: row.last_payment_at,
  }
}

function mapInvoiceFromDb(row: any): TreasuryInvoice {
  return {
    id: row.id,
    accountId: row.account_id,
    vendorId: row.vendor_id,
    erpInvoiceId: row.erp_invoice_id,
    invoiceNumber: row.invoice_number,
    amount: parseFloat(row.amount),
    currency: row.currency,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status,
    paymentStatus: row.payment_status,
    paidAmount: parseFloat(row.paid_amount || '0'),
    transactionId: row.transaction_id,
    erpPoNumber: row.erp_po_number,
    costCenter: row.cost_center,
    glAccount: row.gl_account,
    description: row.description,
    metadata: row.metadata,
    syncedAt: row.synced_at,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  }
}

function mapCreditLineFromDb(row: any): TreasuryCreditLine {
  return {
    id: row.id,
    accountId: row.account_id,
    limitAmount: parseFloat(row.limit_amount || '0'),
    drawnAmount: parseFloat(row.drawn_amount || '0'),
    availableAmount: parseFloat(row.available_amount || '0'),
    interestRate: parseFloat(row.interest_rate || '0'),
    gracePeriodDays: row.grace_period_days,
    status: row.status,
    lastDrawAt: row.last_draw_at,
    lastRepayAt: row.last_repay_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
