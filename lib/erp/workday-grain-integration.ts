// @ts-nocheck
/**
 * Workday GRAIN Integration
 *
 * The "first domino" strategy: contractor payroll flowing through GRAIN.
 *
 * Workday is critical because:
 * 1. It manages contractor payments for Fortune 500
 * 2. Contractors get paid faster via GRAIN
 * 3. Float from contractor payments earns yield
 * 4. Yield appreciates GRAIN for all holders
 *
 * Flow:
 * 1. Company connects Workday
 * 2. We pull contractor payment schedules
 * 3. Company pre-funds GRAIN for payroll
 * 4. Contractors receive GRAIN instantly
 * 5. Float earns yield during settlement window
 * 6. Everyone wins: faster payments + yield
 */

import { neon } from '@neondatabase/serverless'
import { credentialManager } from './credential-manager'
import { trackFloat, distributeYield } from '@/lib/scale/float-treasury-integration'

const sql = process.env.DATABASE_URL?.startsWith('postgres')
  ? neon(process.env.DATABASE_URL)
  : null

// ============================================================================
// TYPES
// ============================================================================

export interface ContractorPayment {
  id: string
  connectionId: string
  externalPaymentId: string

  // Contractor details
  contractorId: string
  contractorName: string
  contractorEmail?: string
  contractorPhone?: string

  // Payment details
  amount: number
  currency: string
  payPeriodStart: Date
  payPeriodEnd: Date
  scheduledPayDate: Date

  // GRAIN conversion
  grainAmount?: number
  grainRate?: number

  // Status
  status: 'pending' | 'funded' | 'processing' | 'paid' | 'failed'
  paidAt?: Date
  paidVia?: 'grain' | 'ach' | 'wire'

  // Float tracking
  floatPositionId?: string
  yieldEarned?: number

  // Metadata
  createdAt: Date
  updatedAt: Date
}

export interface PayrollFundingRequest {
  connectionId: string
  companyId: string
  payPeriodEnd: Date
  totalAmount: number
  contractorCount: number
  payments: ContractorPayment[]
}

export interface GrainPayrollResult {
  success: boolean
  fundingTxId?: string
  grainRate: number
  totalGrain: number
  floatPositionId?: string
  error?: string
}

// ============================================================================
// WORKDAY PAYROLL SYNC
// ============================================================================

/**
 * Sync contractor payments from Workday
 * Pulls upcoming payments and stages them for GRAIN funding
 */
export async function syncContractorPayments(
  connectionId: string
): Promise<ContractorPayment[]> {
  // Get credentials
  const credentials = await credentialManager.getValidCredentials(connectionId)
  if (!credentials || credentials.provider !== 'workday') {
    throw new Error('Invalid Workday connection')
  }

  // Import Workday adapter
  const { workday } = await import('./workday')

  // Fetch contractors and their upcoming payments
  const contractors = await workday.fetchContractors(connectionId, credentials.accessToken!)
  const payments: ContractorPayment[] = []

  for (const contractor of contractors) {
    // Get next scheduled payment
    const paymentInfo = await workday.getContractorPayroll(
      connectionId,
      credentials.accessToken!,
      contractor.id
    )

    if (paymentInfo?.nextPayment) {
      const payment: ContractorPayment = {
        id: `${connectionId}_${contractor.id}_${paymentInfo.nextPayment.payPeriodEnd}`,
        connectionId,
        externalPaymentId: paymentInfo.nextPayment.id,
        contractorId: contractor.id,
        contractorName: contractor.name,
        contractorEmail: contractor.email,
        amount: paymentInfo.nextPayment.amount,
        currency: paymentInfo.nextPayment.currency || 'USD',
        payPeriodStart: new Date(paymentInfo.nextPayment.payPeriodStart),
        payPeriodEnd: new Date(paymentInfo.nextPayment.payPeriodEnd),
        scheduledPayDate: new Date(paymentInfo.nextPayment.scheduledPayDate),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      payments.push(payment)

      // Store in database
      await sql`
        INSERT INTO workday_contractor_payments (
          id, connection_id, external_payment_id,
          contractor_id, contractor_name, contractor_email,
          amount, currency, pay_period_start, pay_period_end, scheduled_pay_date,
          status, created_at, updated_at
        ) VALUES (
          ${payment.id}, ${payment.connectionId}, ${payment.externalPaymentId},
          ${payment.contractorId}, ${payment.contractorName}, ${payment.contractorEmail || null},
          ${payment.amount}, ${payment.currency}, ${payment.payPeriodStart}, ${payment.payPeriodEnd}, ${payment.scheduledPayDate},
          ${payment.status}, ${payment.createdAt}, ${payment.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          scheduled_pay_date = EXCLUDED.scheduled_pay_date,
          status = EXCLUDED.status,
          updated_at = NOW()
      `
    }
  }

  return payments
}

/**
 * Get pending payroll that needs GRAIN funding
 */
export async function getPendingPayroll(
  connectionId: string,
  daysAhead: number = 7
): Promise<PayrollFundingRequest | null> {
  if (!sql) return null

  // Get pending payments for the next N days
  const payments = await sql`
    SELECT * FROM workday_contractor_payments
    WHERE connection_id = ${connectionId}
      AND status = 'pending'
      AND scheduled_pay_date <= NOW() + INTERVAL '${daysAhead} days'
    ORDER BY scheduled_pay_date ASC
  `

  if (payments.length === 0) return null

  // Get company info
  const [connection] = await sql`
    SELECT company_id FROM erp_connections
    WHERE id = ${connectionId}
  `

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

  return {
    connectionId,
    companyId: connection?.company_id,
    payPeriodEnd: new Date(payments[0].pay_period_end),
    totalAmount,
    contractorCount: payments.length,
    payments: payments.map(p => ({
      id: p.id,
      connectionId: p.connection_id,
      externalPaymentId: p.external_payment_id,
      contractorId: p.contractor_id,
      contractorName: p.contractor_name,
      contractorEmail: p.contractor_email,
      amount: parseFloat(p.amount),
      currency: p.currency,
      payPeriodStart: new Date(p.pay_period_start),
      payPeriodEnd: new Date(p.pay_period_end),
      scheduledPayDate: new Date(p.scheduled_pay_date),
      status: p.status,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    })),
  }
}

// ============================================================================
// GRAIN FUNDING & PAYMENT
// ============================================================================

/**
 * Fund payroll with GRAIN
 * Company deposits USDC, receives GRAIN for contractor payments
 */
export async function fundPayrollWithGrain(
  request: PayrollFundingRequest
): Promise<GrainPayrollResult> {
  if (!sql) {
    return { success: false, error: 'Database not configured', grainRate: 1, totalGrain: 0 }
  }

  try {
    // Get current GRAIN rate
    const grainRate = await getCurrentGrainRate()
    const totalGrain = request.totalAmount / grainRate

    // Create float position for the funding
    // The float sits until payroll is actually distributed
    const floatPosition = await trackFloat(
      'erp_intercept',
      `payroll_${request.connectionId}_${request.payPeriodEnd.toISOString()}`,
      request.totalAmount,
      3 // 3-day settlement window average
    )

    // Create funding transaction
    const [fundingTx] = await sql`
      INSERT INTO grain_payroll_funding (
        connection_id,
        company_id,
        pay_period_end,
        total_usdc,
        grain_rate,
        total_grain,
        contractor_count,
        float_position_id,
        status,
        created_at
      ) VALUES (
        ${request.connectionId},
        ${request.companyId},
        ${request.payPeriodEnd},
        ${request.totalAmount},
        ${grainRate},
        ${totalGrain},
        ${request.contractorCount},
        ${floatPosition.id},
        'funded',
        NOW()
      )
      RETURNING id
    `

    // Update each payment with GRAIN amounts
    for (const payment of request.payments) {
      const grainAmount = payment.amount / grainRate

      await sql`
        UPDATE workday_contractor_payments
        SET
          status = 'funded',
          grain_amount = ${grainAmount},
          grain_rate = ${grainRate},
          float_position_id = ${floatPosition.id},
          updated_at = NOW()
        WHERE id = ${payment.id}
      `
    }

    return {
      success: true,
      fundingTxId: fundingTx.id,
      grainRate,
      totalGrain,
      floatPositionId: floatPosition.id,
    }
  } catch (error: any) {
    console.error('[Workday GRAIN] Funding error:', error)
    return {
      success: false,
      error: error.message,
      grainRate: 1,
      totalGrain: 0,
    }
  }
}

/**
 * Process GRAIN payment to contractor
 * Instant transfer - contractor receives GRAIN immediately
 */
export async function payContractorWithGrain(
  paymentId: string
): Promise<{
  success: boolean
  txId?: string
  grainAmount?: number
  error?: string
}> {
  if (!sql) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    // Get payment details
    const [payment] = await sql`
      SELECT * FROM workday_contractor_payments
      WHERE id = ${paymentId}
        AND status = 'funded'
    `

    if (!payment) {
      return { success: false, error: 'Payment not found or not funded' }
    }

    // Check if contractor has GRAIN wallet
    let contractorWallet = await getOrCreateContractorWallet(
      payment.contractor_id,
      payment.contractor_email,
      payment.contractor_name
    )

    // Transfer GRAIN to contractor
    const grainAmount = parseFloat(payment.grain_amount)

    const [transferTx] = await sql`
      INSERT INTO grain_transactions (
        from_user_id,
        to_user_id,
        amount,
        type,
        reference_type,
        reference_id,
        status,
        created_at
      ) VALUES (
        'PAYROLL_ESCROW',
        ${contractorWallet.userId},
        ${grainAmount},
        'payroll',
        'workday_payment',
        ${paymentId},
        'completed',
        NOW()
      )
      RETURNING id
    `

    // Credit contractor wallet
    await sql`
      UPDATE user_wallets
      SET balance = balance + ${grainAmount}, updated_at = NOW()
      WHERE user_id = ${contractorWallet.userId}
    `

    // Update payment status
    await sql`
      UPDATE workday_contractor_payments
      SET
        status = 'paid',
        paid_at = NOW(),
        paid_via = 'grain',
        updated_at = NOW()
      WHERE id = ${paymentId}
    `

    // Calculate and distribute yield from float
    // Float was held from funding time until now
    const floatPositionId = payment.float_position_id
    if (floatPositionId) {
      const yieldResult = await settlePaymentFloat(floatPositionId, parseFloat(payment.amount))

      // Update payment with yield earned
      await sql`
        UPDATE workday_contractor_payments
        SET yield_earned = ${yieldResult.yieldEarned}
        WHERE id = ${paymentId}
      `
    }

    return {
      success: true,
      txId: transferTx.id,
      grainAmount,
    }
  } catch (error: any) {
    console.error('[Workday GRAIN] Payment error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Batch process all funded payments for a payroll
 */
export async function processPayrollBatch(
  connectionId: string,
  payPeriodEnd: Date
): Promise<{
  totalProcessed: number
  totalGrain: number
  totalYield: number
  failed: string[]
}> {
  if (!sql) {
    return { totalProcessed: 0, totalGrain: 0, totalYield: 0, failed: [] }
  }

  // Get all funded payments for this payroll
  const payments = await sql`
    SELECT id FROM workday_contractor_payments
    WHERE connection_id = ${connectionId}
      AND pay_period_end = ${payPeriodEnd}
      AND status = 'funded'
  `

  let totalProcessed = 0
  let totalGrain = 0
  let totalYield = 0
  const failed: string[] = []

  for (const payment of payments) {
    const result = await payContractorWithGrain(payment.id)

    if (result.success) {
      totalProcessed++
      totalGrain += result.grainAmount || 0

      // Get yield earned
      const [updated] = await sql`
        SELECT yield_earned FROM workday_contractor_payments
        WHERE id = ${payment.id}
      `
      totalYield += parseFloat(updated?.yield_earned || 0)
    } else {
      failed.push(payment.id)
    }
  }

  return { totalProcessed, totalGrain, totalYield, failed }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current GRAIN rate from treasury
 */
async function getCurrentGrainRate(): Promise<number> {
  if (!sql) return 1.0

  try {
    const [treasury] = await sql`
      SELECT
        grain_value
      FROM grain_treasury_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 1
    `

    return parseFloat(treasury?.grain_value || 1.0)
  } catch (e) {
    return 1.0
  }
}

/**
 * Get or create contractor wallet
 */
async function getOrCreateContractorWallet(
  contractorId: string,
  email?: string,
  name?: string
): Promise<{ userId: string; walletId: string }> {
  if (!sql) {
    throw new Error('Database not configured')
  }

  // Check if contractor already has wallet
  const [existing] = await sql`
    SELECT user_id, id as wallet_id
    FROM user_wallets
    WHERE metadata->>'contractor_id' = ${contractorId}
  `

  if (existing) {
    return { userId: existing.user_id, walletId: existing.wallet_id }
  }

  // Create new wallet for contractor
  const userId = `contractor_${contractorId}`

  const [wallet] = await sql`
    INSERT INTO user_wallets (
      user_id,
      balance,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      ${userId},
      0,
      ${JSON.stringify({ contractor_id: contractorId, email, name, type: 'contractor' })},
      NOW(),
      NOW()
    )
    RETURNING id
  `

  return { userId, walletId: wallet.id }
}

/**
 * Settle float from a payment
 */
async function settlePaymentFloat(
  floatPositionId: string,
  paymentAmount: number
): Promise<{ yieldEarned: number }> {
  // Calculate pro-rata yield based on time and amount
  // In production, this would be more sophisticated

  const dailyYieldRate = 0.05 / 365 // 5% APY
  const avgFloatDays = 3
  const yieldEarned = paymentAmount * dailyYieldRate * avgFloatDays

  // Distribute the yield
  await distributeYield(yieldEarned, 'erp_intercept', floatPositionId)

  return { yieldEarned }
}

// ============================================================================
// GRAIN ELIGIBILITY CALCULATOR
// ============================================================================

/**
 * Calculate GRAIN eligibility for contractor spend
 * Used to show companies how much they can save
 */
export async function calculateGrainEligibility(
  connectionId: string
): Promise<{
  eligible: boolean
  monthlyVolume: number
  projectedGrainYield: number
  projectedContractorSavings: number
  recommendation: string
}> {
  if (!sql) {
    return {
      eligible: false,
      monthlyVolume: 0,
      projectedGrainYield: 0,
      projectedContractorSavings: 0,
      recommendation: 'Database not configured',
    }
  }

  try {
    // Get contractor payment history
    const [stats] = await sql`
      SELECT
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(DISTINCT contractor_id) as contractor_count
      FROM workday_contractor_payments
      WHERE connection_id = ${connectionId}
        AND created_at >= NOW() - INTERVAL '30 days'
    `

    const monthlyVolume = parseFloat(stats?.total_amount || 0)
    const contractorCount = parseInt(stats?.contractor_count || 0)

    // Calculate projected savings
    // Assume 5% APY on float, 3-day average settlement
    const dailyYieldRate = 0.05 / 365
    const avgFloatDays = 3
    const projectedGrainYield = monthlyVolume * dailyYieldRate * avgFloatDays

    // Contractor savings: faster payments, no wire fees
    // Estimate $25 wire fee saved per payment
    const wireFeesSaved = parseInt(stats?.payment_count || 0) * 25

    // Contractors also benefit from GRAIN appreciation
    // Estimate 30% of yield goes to GRAIN appreciation
    const grainAppreciation = projectedGrainYield * 0.30

    const projectedContractorSavings = wireFeesSaved + (grainAppreciation * 0.2) // 20% to participants

    // Determine eligibility
    const eligible = monthlyVolume >= 10000 // Minimum $10K monthly

    let recommendation = ''
    if (!eligible) {
      recommendation = `Minimum monthly volume of $10,000 required. Current: $${monthlyVolume.toLocaleString()}`
    } else if (monthlyVolume >= 1000000) {
      recommendation = 'Enterprise tier: Custom yield sharing and priority support available'
    } else if (monthlyVolume >= 100000) {
      recommendation = 'Growth tier: Standard yield sharing with monthly optimizations'
    } else {
      recommendation = 'Starter tier: Begin earning yield on contractor payments immediately'
    }

    return {
      eligible,
      monthlyVolume,
      projectedGrainYield,
      projectedContractorSavings,
      recommendation,
    }
  } catch (error: any) {
    console.error('[GRAIN Eligibility] Error:', error)
    return {
      eligible: false,
      monthlyVolume: 0,
      projectedGrainYield: 0,
      projectedContractorSavings: 0,
      recommendation: 'Unable to calculate eligibility',
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const workdayGrainIntegration = {
  syncContractorPayments,
  getPendingPayroll,
  fundPayrollWithGrain,
  payContractorWithGrain,
  processPayrollBatch,
  calculateGrainEligibility,
}

export default workdayGrainIntegration
