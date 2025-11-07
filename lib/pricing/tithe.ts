/**
 * Grain & Vault Tithe System
 *
 * Handles the 10% tithe to Adullam Fund.
 * All gross Wells fees contribute 10% to support the mission.
 *
 * This is non-negotiable and transparent - appears as separate line item
 * on all invoices and transaction records.
 */

import { TITHE_CONFIG, WALLET_CONFIG } from './config'
import { FeeBreakdown } from './types'

/**
 * Tithe Record
 *
 * Transparent record of every tithe distribution.
 * Stored in database for audit trail.
 */
export interface TitheRecord {
  id: string
  transactionId: string
  dealSourceTag: string
  grossWellsFee: number
  titheAmount: number
  tithePercentage: number
  destinationWallet: string
  destinationName: string
  status: 'pending' | 'completed' | 'failed'
  transactionHash?: string // On-chain transfer hash
  createdAt: string
  completedAt?: string
  error?: string
}

/**
 * Fee Distribution
 *
 * Shows where all the money goes.
 */
export interface FeeDistribution {
  transactionId: string
  totalFee: number
  titheAmount: number
  titheWallet: string
  wellsNetAmount: number
  wellsWallet: string
  railCost: number
  railProvider: string
  distributions: {
    destination: string
    amount: number
    percentage: number
    purpose: string
  }[]
}

/**
 * Calculate tithe amount
 *
 * Simple: 10% of gross Wells fee.
 *
 * @param grossWellsFee - Gross Wells fee in cents
 * @returns Tithe amount in cents
 */
export function calculateTithe(grossWellsFee: number): number {
  return Math.round(grossWellsFee * TITHE_CONFIG.RATE)
}

/**
 * Distribute fees
 *
 * Splits the transaction fee into:
 * 1. Tithe (10% of Wells fee) → Adullam Fund
 * 2. Net Wells fee (90% of Wells fee) → Wells Treasury
 * 3. Rail costs → Payment provider
 *
 * @param breakdown - Fee breakdown from calculator
 * @param transactionId - Transaction ID for record keeping
 * @returns Fee distribution with all destinations
 */
export function distributeFees(
  breakdown: FeeBreakdown,
  transactionId: string
): FeeDistribution {
  const titheAmount = calculateTithe(breakdown.wellsFeeGross)
  const wellsNetAmount = breakdown.wellsFeeGross - titheAmount

  return {
    transactionId,
    totalFee: breakdown.totalCharge,
    titheAmount,
    titheWallet: TITHE_CONFIG.WALLET_ADDRESS,
    wellsNetAmount,
    wellsWallet: WALLET_CONFIG.TREASURY_WALLET,
    railCost: breakdown.railCost,
    railProvider: breakdown.rail,
    distributions: [
      {
        destination: TITHE_CONFIG.DESTINATION,
        amount: titheAmount,
        percentage: TITHE_CONFIG.RATE * 100,
        purpose: TITHE_CONFIG.DESCRIPTION
      },
      {
        destination: 'Wells Treasury',
        amount: wellsNetAmount,
        percentage: (1 - TITHE_CONFIG.RATE) * 100,
        purpose: 'Platform operations and growth'
      },
      {
        destination: `Payment Rail (${breakdown.rail})`,
        amount: breakdown.railCost,
        percentage: (breakdown.railCost / breakdown.totalCharge) * 100,
        purpose: 'Payment processing costs (pass-through)'
      }
    ]
  }
}

/**
 * Create tithe record
 *
 * Logs the tithe for transparency and audit trail.
 *
 * @param transactionId - Transaction ID
 * @param breakdown - Fee breakdown
 * @returns Tithe record
 */
export function createTitheRecord(
  transactionId: string,
  breakdown: FeeBreakdown
): TitheRecord {
  return {
    id: `tithe_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    transactionId,
    dealSourceTag: breakdown.attribution.dealSourceTag,
    grossWellsFee: breakdown.wellsFeeGross,
    titheAmount: breakdown.titheAmount,
    tithePercentage: TITHE_CONFIG.RATE,
    destinationWallet: TITHE_CONFIG.WALLET_ADDRESS,
    destinationName: TITHE_CONFIG.DESTINATION,
    status: 'pending',
    createdAt: new Date().toISOString()
  }
}

/**
 * Execute tithe transfer
 *
 * Actually transfers the tithe to Adullam Fund wallet.
 * This would call the smart contract or payment API.
 *
 * @param record - Tithe record to execute
 * @returns Updated record with status
 */
export async function executeTitheTransfer(
  record: TitheRecord
): Promise<TitheRecord> {
  try {
    // TODO: Implement actual transfer when smart contracts are deployed
    // For now, just mark as completed

    // In production, this would:
    // 1. Call Grain Vault contract to transfer GRAIN
    // 2. Or use Circle API to transfer USDC
    // 3. Wait for transaction confirmation
    // 4. Update record with transaction hash

    const txHash = `0x${Math.random().toString(16).substring(2)}` // Mock hash

    return {
      ...record,
      status: 'completed',
      transactionHash: txHash,
      completedAt: new Date().toISOString()
    }
  } catch (error) {
    return {
      ...record,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get tithe summary for a period
 *
 * Shows total tithes for transparency reporting.
 *
 * @param records - Array of tithe records
 * @returns Summary statistics
 */
export function getTitheSummary(records: TitheRecord[]): {
  totalTithes: number
  totalGrossFees: number
  transactionCount: number
  averageTithe: number
  completedCount: number
  pendingCount: number
  failedCount: number
} {
  const completed = records.filter((r) => r.status === 'completed')
  const pending = records.filter((r) => r.status === 'pending')
  const failed = records.filter((r) => r.status === 'failed')

  const totalTithes = completed.reduce((sum, r) => sum + r.titheAmount, 0)
  const totalGrossFees = completed.reduce((sum, r) => sum + r.grossWellsFee, 0)

  return {
    totalTithes,
    totalGrossFees,
    transactionCount: records.length,
    averageTithe: records.length > 0 ? totalTithes / records.length : 0,
    completedCount: completed.length,
    pendingCount: pending.length,
    failedCount: failed.length
  }
}

/**
 * Format tithe record for display
 *
 * Human-readable tithe information.
 */
export function formatTitheRecord(record: TitheRecord): string {
  const lines = [
    `Tithe Record: ${record.id}`,
    `Transaction: ${record.transactionId}`,
    `Deal Source: ${record.dealSourceTag}`,
    ``,
    `Gross Wells Fee: $${(record.grossWellsFee / 100).toFixed(2)}`,
    `Tithe Amount: $${(record.titheAmount / 100).toFixed(2)} (${(record.tithePercentage * 100).toFixed(0)}%)`,
    `Destination: ${record.destinationName}`,
    `Wallet: ${record.destinationWallet}`,
    ``,
    `Status: ${record.status.toUpperCase()}`,
    `Created: ${new Date(record.createdAt).toLocaleString()}`
  ]

  if (record.completedAt) {
    lines.push(`Completed: ${new Date(record.completedAt).toLocaleString()}`)
  }

  if (record.transactionHash) {
    lines.push(`Transaction Hash: ${record.transactionHash}`)
  }

  if (record.error) {
    lines.push(`Error: ${record.error}`)
  }

  return lines.join('\n')
}

/**
 * Format fee distribution for display
 *
 * Shows where all the money goes.
 */
export function formatFeeDistribution(distribution: FeeDistribution): string {
  const lines = [
    `Fee Distribution for Transaction: ${distribution.transactionId}`,
    `Total Fee: $${(distribution.totalFee / 100).toFixed(2)}`,
    ``,
    `Distribution Breakdown:`
  ]

  distribution.distributions.forEach((dist) => {
    lines.push(
      `  ${dist.destination}: $${(dist.amount / 100).toFixed(2)} (${dist.percentage.toFixed(2)}%)`
    )
    lines.push(`    Purpose: ${dist.purpose}`)
  })

  return lines.join('\n')
}

/**
 * Validate tithe configuration
 *
 * Ensures tithe wallet is configured correctly.
 */
export function validateTitheConfig(): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!TITHE_CONFIG.WALLET_ADDRESS) {
    errors.push('ADULLAM_WALLET_ADDRESS not configured')
  } else if (!TITHE_CONFIG.WALLET_ADDRESS.startsWith('0x')) {
    errors.push('ADULLAM_WALLET_ADDRESS is not a valid Ethereum address')
  }

  if (TITHE_CONFIG.RATE !== 0.10) {
    errors.push(`Tithe rate is ${TITHE_CONFIG.RATE}, expected 0.10`)
  }

  if (!WALLET_CONFIG.TREASURY_WALLET) {
    errors.push('WELLS_TREASURY_WALLET not configured')
  } else if (!WALLET_CONFIG.TREASURY_WALLET.startsWith('0x')) {
    errors.push('WELLS_TREASURY_WALLET is not a valid Ethereum address')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get tithe transparency report
 *
 * Public-facing report showing all tithes.
 * This builds trust and shows we're serious about the mission.
 */
export function generateTitheReport(
  records: TitheRecord[],
  startDate: Date,
  endDate: Date
): string {
  const filtered = records.filter((r) => {
    const date = new Date(r.createdAt)
    return date >= startDate && date <= endDate
  })

  const summary = getTitheSummary(filtered)

  const lines = [
    `Adullam Fund Tithe Report`,
    `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    ``,
    `Summary:`,
    `  Total Tithes: $${(summary.totalTithes / 100).toFixed(2)}`,
    `  Total Gross Fees: $${(summary.totalGrossFees / 100).toFixed(2)}`,
    `  Transactions: ${summary.transactionCount}`,
    `  Average Tithe: $${(summary.averageTithe / 100).toFixed(2)}`,
    ``,
    `Status Breakdown:`,
    `  Completed: ${summary.completedCount}`,
    `  Pending: ${summary.pendingCount}`,
    `  Failed: ${summary.failedCount}`,
    ``,
    `Destination: ${TITHE_CONFIG.DESTINATION}`,
    `Wallet: ${TITHE_CONFIG.WALLET_ADDRESS}`,
    ``,
    `All tithes are publicly auditable on Base L2 blockchain.`
  ]

  return lines.join('\n')
}

/**
 * Calculate projected tithe for volume
 *
 * Helps estimate total tithe contribution over time.
 */
export function projectTithe(
  monthlyVolume: number,
  averageWellsFeePercentage: number
): {
  monthlyTithe: number
  annualTithe: number
  averageWellsFee: number
} {
  const averageWellsFee = Math.round(monthlyVolume * averageWellsFeePercentage)
  const monthlyTithe = calculateTithe(averageWellsFee)
  const annualTithe = monthlyTithe * 12

  return {
    monthlyTithe,
    annualTithe,
    averageWellsFee
  }
}
