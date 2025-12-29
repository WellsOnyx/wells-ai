// @ts-nocheck
/**
 * GRAIN Transfer Service
 *
 * Handles GRAIN token transfers between users and external wallets.
 */

import { sql } from '@vercel/postgres'

export interface Transaction {
  id: string
  userId: string
  type: 'credit' | 'debit' | 'transfer_in' | 'transfer_out'
  amount: number
  currency: string
  description: string
  recipientId?: string
  senderId?: string
  reference?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  metadata?: Record<string, unknown>
  createdAt: Date
  completedAt?: Date
}

export interface TransferParams {
  fromUserId: string
  toUserId: string
  amount: number
  currency?: string
  description?: string
  reference?: string
  metadata?: Record<string, unknown>
}

export interface GetTransactionsParams {
  userId: string
  limit?: number
  offset?: number
  type?: Transaction['type']
  status?: Transaction['status']
  startDate?: Date
  endDate?: Date
}

/**
 * Get transactions for a user
 */
export async function getTransactions(params: GetTransactionsParams): Promise<{
  transactions: Transaction[]
  total: number
}> {
  const {
    userId,
    limit = 50,
    offset = 0,
    type,
    status,
    startDate,
    endDate,
  } = params

  try {
    // Build base query
    let whereClause = 'WHERE (user_id = $1 OR recipient_id = $1 OR sender_id = $1)'
    const queryParams: (string | number | Date)[] = [userId]
    let paramIndex = 2

    if (type) {
      whereClause += ` AND type = $${paramIndex}`
      queryParams.push(type)
      paramIndex++
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`
      queryParams.push(startDate)
      paramIndex++
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`
      queryParams.push(endDate)
      paramIndex++
    }

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM grain_transactions ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.total || '0', 10)

    // Get transactions
    queryParams.push(limit, offset)
    const result = await sql.query(
      `SELECT * FROM grain_transactions ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    )

    const transactions: Transaction[] = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      amount: parseFloat(row.amount),
      currency: row.currency || 'GRAIN',
      description: row.description || '',
      recipientId: row.recipient_id,
      senderId: row.sender_id,
      reference: row.reference,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }))

    return { transactions, total }
  } catch (error) {
    console.error('Error fetching transactions:', error)
    // Return empty result on error
    return { transactions: [], total: 0 }
  }
}

/**
 * Get a single transaction by ID
 */
export async function getTransaction(transactionId: string): Promise<Transaction | null> {
  try {
    const result = await sql`
      SELECT * FROM grain_transactions WHERE id = ${transactionId} LIMIT 1
    `

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      amount: parseFloat(row.amount),
      currency: row.currency || 'GRAIN',
      description: row.description || '',
      recipientId: row.recipient_id,
      senderId: row.sender_id,
      reference: row.reference,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    }
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return null
  }
}

/**
 * Create a transfer between users
 */
export async function createTransfer(params: TransferParams): Promise<{
  success: boolean
  transactionId?: string
  error?: string
}> {
  const {
    fromUserId,
    toUserId,
    amount,
    currency = 'GRAIN',
    description = 'Transfer',
    reference,
    metadata,
  } = params

  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' }
  }

  if (fromUserId === toUserId) {
    return { success: false, error: 'Cannot transfer to self' }
  }

  try {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2)}`

    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        currency,
        description,
        recipient_id,
        sender_id,
        reference,
        status,
        metadata,
        created_at
      ) VALUES (
        ${transactionId},
        ${fromUserId},
        'transfer_out',
        ${amount},
        ${currency},
        ${description},
        ${toUserId},
        ${fromUserId},
        ${reference || null},
        'completed',
        ${JSON.stringify(metadata || {})},
        NOW()
      )
    `

    // Create corresponding credit for recipient
    await sql`
      INSERT INTO grain_transactions (
        id,
        user_id,
        type,
        amount,
        currency,
        description,
        recipient_id,
        sender_id,
        reference,
        status,
        metadata,
        created_at
      ) VALUES (
        ${transactionId + '_credit'},
        ${toUserId},
        'transfer_in',
        ${amount},
        ${currency},
        ${description},
        ${toUserId},
        ${fromUserId},
        ${reference || null},
        'completed',
        ${JSON.stringify(metadata || {})},
        NOW()
      )
    `

    return { success: true, transactionId }
  } catch (error) {
    console.error('Error creating transfer:', error)
    return { success: false, error: 'Failed to create transfer' }
  }
}

/**
 * Get balance for a user
 */
export async function getBalance(userId: string): Promise<{
  available: number
  pending: number
  total: number
}> {
  try {
    const result = await sql`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN type IN ('credit', 'transfer_in') AND status = 'completed' THEN amount
            WHEN type IN ('debit', 'transfer_out') AND status = 'completed' THEN -amount
            ELSE 0
          END
        ), 0) as available,
        COALESCE(SUM(
          CASE
            WHEN status = 'pending' THEN amount
            ELSE 0
          END
        ), 0) as pending
      FROM grain_transactions
      WHERE user_id = ${userId}
    `

    const available = parseFloat(result.rows[0]?.available || '0')
    const pending = parseFloat(result.rows[0]?.pending || '0')

    return {
      available,
      pending,
      total: available + pending,
    }
  } catch (error) {
    console.error('Error fetching balance:', error)
    return { available: 0, pending: 0, total: 0 }
  }
}
