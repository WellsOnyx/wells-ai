/**
 * Blockchain Event Listener
 *
 * Listens for smart contract events and processes them:
 * - GrainMinted
 * - GrainBurned
 * - GrainTransferred
 * - NAVUpdated
 * - EscrowCreated
 * - MilestoneCompleted
 * - DisputeRaised
 * - Deposit
 * - Withdrawal
 */

import {
  publicClient,
  CONTRACTS,
  GRAIN_TOKEN_ABI,
  PRICE_ORACLE_ABI,
  VAULT_ABI,
  ESCROW_ABI,
  fromGRAIN,
  fromUSDC,
} from './contracts'
import { query } from '../db'
import { invalidateAllCaches, incrementVolume24h } from './cache'

interface EventHandler {
  (event: any): Promise<void>
}

/**
 * Start listening to all contract events
 */
export async function startEventListener() {
  console.log('[EventListener] Starting blockchain event listener...')

  // Listen to GRAIN Token events
  listenToGrainEvents()

  // Listen to Price Oracle events
  listenToPriceOracleEvents()

  // Listen to Vault events
  listenToVaultEvents()

  // Listen to Escrow events
  listenToEscrowEvents()

  console.log('[EventListener] All event listeners started successfully')
}

/**
 * GRAIN Token Events
 */
function listenToGrainEvents() {
  // GrainMinted
  publicClient.watchContractEvent({
    address: CONTRACTS.GRAIN_TOKEN,
    abi: GRAIN_TOKEN_ABI,
    eventName: 'GrainMinted',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleGrainMinted(log)
      }
    },
  })

  // GrainBurned
  publicClient.watchContractEvent({
    address: CONTRACTS.GRAIN_TOKEN,
    abi: GRAIN_TOKEN_ABI,
    eventName: 'GrainBurned',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleGrainBurned(log)
      }
    },
  })

  // Transfer (for tracking all GRAIN movements)
  publicClient.watchContractEvent({
    address: CONTRACTS.GRAIN_TOKEN,
    abi: GRAIN_TOKEN_ABI,
    eventName: 'Transfer',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleGrainTransfer(log)
      }
    },
  })

  console.log('[EventListener] Listening to GRAIN token events')
}

/**
 * Price Oracle Events
 */
function listenToPriceOracleEvents() {
  publicClient.watchContractEvent({
    address: CONTRACTS.PRICE_ORACLE,
    abi: PRICE_ORACLE_ABI,
    eventName: 'NAVUpdated',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleNAVUpdated(log)
      }
    },
  })

  console.log('[EventListener] Listening to Price Oracle events')
}

/**
 * Vault Events
 */
function listenToVaultEvents() {
  // Deposit
  publicClient.watchContractEvent({
    address: CONTRACTS.GRAIN_VAULT,
    abi: VAULT_ABI,
    eventName: 'Deposit',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleDeposit(log)
      }
    },
  })

  // Withdrawal
  publicClient.watchContractEvent({
    address: CONTRACTS.GRAIN_VAULT,
    abi: VAULT_ABI,
    eventName: 'Withdrawal',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleWithdrawal(log)
      }
    },
  })

  console.log('[EventListener] Listening to Vault events')
}

/**
 * Escrow Events
 */
function listenToEscrowEvents() {
  // EscrowCreated
  publicClient.watchContractEvent({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    eventName: 'EscrowCreated',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleEscrowCreated(log)
      }
    },
  })

  // MilestoneCompleted
  publicClient.watchContractEvent({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    eventName: 'MilestoneCompleted',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleMilestoneCompleted(log)
      }
    },
  })

  // DisputeRaised
  publicClient.watchContractEvent({
    address: CONTRACTS.ESCROW,
    abi: ESCROW_ABI,
    eventName: 'DisputeRaised',
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleDisputeRaised(log)
      }
    },
  })

  console.log('[EventListener] Listening to Escrow events')
}

/**
 * Event Handlers
 */

async function handleGrainMinted(event: any) {
  try {
    const { to, amount, timestamp } = event.args
    const grainAmount = fromGRAIN(amount)

    console.log(`[Event] GrainMinted: ${grainAmount} GRAIN to ${to}`)

    // Update database
    await query(
      `UPDATE founding_investors
       SET status = 'minted', updated_at = NOW()
       WHERE address = $1 AND status = 'pending'`,
      [to.toLowerCase()]
    )

    // Send notification
    await sendNotification(to, {
      type: 'grain_minted',
      amount: grainAmount,
      txHash: event.transactionHash,
    })
  } catch (error) {
    console.error('[EventListener] Error handling GrainMinted:', error)
  }
}

async function handleGrainBurned(event: any) {
  try {
    const { from, amount, timestamp } = event.args
    const grainAmount = fromGRAIN(amount)

    console.log(`[Event] GrainBurned: ${grainAmount} GRAIN from ${from}`)

    // Track burn event
    await query(
      `INSERT INTO grain_events (event_type, address, amount, tx_hash, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['burn', from.toLowerCase(), grainAmount, event.transactionHash]
    )
  } catch (error) {
    console.error('[EventListener] Error handling GrainBurned:', error)
  }
}

async function handleGrainTransfer(event: any) {
  try {
    const { from, to, value } = event.args
    const amount = fromGRAIN(value)

    // Skip zero address transfers (mints/burns are handled separately)
    if (from === '0x0000000000000000000000000000000000000000' ||
        to === '0x0000000000000000000000000000000000000000') {
      return
    }

    console.log(`[Event] GrainTransfer: ${amount} GRAIN from ${from} to ${to}`)

    // Track transfer
    await query(
      `INSERT INTO grain_events (event_type, address, to_address, amount, tx_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      ['transfer', from.toLowerCase(), to.toLowerCase(), amount, event.transactionHash]
    )
  } catch (error) {
    console.error('[EventListener] Error handling GrainTransfer:', error)
  }
}

async function handleNAVUpdated(event: any) {
  try {
    const { newNAV, totalAssets, timestamp } = event.args
    const nav = fromUSDC(newNAV)
    const assets = fromUSDC(totalAssets)

    console.log(`[Event] NAVUpdated: New NAV = $${nav}, Total Assets = $${assets}`)

    // Invalidate all price caches
    await invalidateAllCaches()

    // Send alerts to investors if significant change (>1%)
    const previousNAV = await getPreviousNAV()
    const changePercent = ((nav - previousNAV) / previousNAV) * 100

    if (Math.abs(changePercent) > 1) {
      await sendNAVChangeAlert({
        oldNAV: previousNAV,
        newNAV: nav,
        changePercent,
        totalAssets: assets,
      })
    }
  } catch (error) {
    console.error('[EventListener] Error handling NAVUpdated:', error)
  }
}

async function handleDeposit(event: any) {
  try {
    const { user, usdcAmount, grainAmount, fee } = event.args
    const usdc = fromUSDC(usdcAmount)
    const grain = fromGRAIN(grainAmount)
    const feeAmount = fromUSDC(fee)

    console.log(`[Event] Deposit: ${usdc} USDC → ${grain} GRAIN (fee: ${feeAmount})`)

    // Update transaction status
    await query(
      `UPDATE vault_transactions
       SET status = 'completed', completed_at = NOW()
       WHERE tx_hash = $1`,
      [event.transactionHash]
    )

    // Update volume
    await incrementVolume24h(usdc)

    // Send confirmation
    await sendNotification(user, {
      type: 'deposit_confirmed',
      usdcAmount: usdc,
      grainAmount: grain,
      fee: feeAmount,
      txHash: event.transactionHash,
    })
  } catch (error) {
    console.error('[EventListener] Error handling Deposit:', error)
  }
}

async function handleWithdrawal(event: any) {
  try {
    const { user, grainAmount, usdcAmount, fee } = event.args
    const grain = fromGRAIN(grainAmount)
    const usdc = fromUSDC(usdcAmount)
    const feeAmount = fromUSDC(fee)

    console.log(`[Event] Withdrawal: ${grain} GRAIN → ${usdc} USDC (fee: ${feeAmount})`)

    // Update transaction status
    await query(
      `UPDATE vault_transactions
       SET status = 'completed', completed_at = NOW()
       WHERE tx_hash = $1`,
      [event.transactionHash]
    )

    // Update volume
    await incrementVolume24h(usdc)

    // Send confirmation
    await sendNotification(user, {
      type: 'withdrawal_confirmed',
      grainAmount: grain,
      usdcAmount: usdc,
      fee: feeAmount,
      txHash: event.transactionHash,
    })
  } catch (error) {
    console.error('[EventListener] Error handling Withdrawal:', error)
  }
}

async function handleEscrowCreated(event: any) {
  try {
    const { escrowId, seller, buyer, amount, currency } = event.args

    console.log(`[Event] EscrowCreated: ID=${escrowId}, Amount=${amount}`)

    // Update escrow status
    await query(
      `UPDATE escrows
       SET status = 'active', updated_at = NOW()
       WHERE escrow_id = $1`,
      [escrowId.toString()]
    )

    // Notify both parties
    await sendNotification(seller, {
      type: 'escrow_created',
      escrowId: escrowId.toString(),
      amount,
      counterparty: buyer,
    })

    await sendNotification(buyer, {
      type: 'escrow_created',
      escrowId: escrowId.toString(),
      amount,
      counterparty: seller,
    })
  } catch (error) {
    console.error('[EventListener] Error handling EscrowCreated:', error)
  }
}

async function handleMilestoneCompleted(event: any) {
  try {
    const { escrowId, milestoneIndex, amountReleased } = event.args

    console.log(`[Event] MilestoneCompleted: Escrow=${escrowId}, Milestone=${milestoneIndex}`)

    // Already handled by API, just log
    console.log(`Milestone ${milestoneIndex} completed, ${amountReleased} released`)
  } catch (error) {
    console.error('[EventListener] Error handling MilestoneCompleted:', error)
  }
}

async function handleDisputeRaised(event: any) {
  try {
    const { escrowId, reason, raisedBy } = event.args

    console.log(`[Event] DisputeRaised: Escrow=${escrowId}`)

    // Update dispute status
    await query(
      `UPDATE escrow_disputes
       SET status = 'active', updated_at = NOW()
       WHERE escrow_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [escrowId.toString()]
    )

    // Send critical alert to resolver
    await sendDisputeAlert(escrowId.toString(), reason, raisedBy)
  } catch (error) {
    console.error('[EventListener] Error handling DisputeRaised:', error)
  }
}

/**
 * Helper functions
 */

async function getPreviousNAV(): Promise<number> {
  const result = await query(
    `SELECT new_nav FROM nav_updates ORDER BY created_at DESC LIMIT 1`
  )
  return result.rows.length > 0 ? parseFloat(result.rows[0].new_nav) : 1.0
}

async function sendNotification(address: string, data: any) {
  console.log(`[Notification] Sending to ${address}:`, data)
  // TODO: Implement actual notification system
  // - Email via Resend
  // - SMS via Twilio
  // - Push notifications
  // - Webhooks
}

async function sendNAVChangeAlert(data: {
  oldNAV: number
  newNAV: number
  changePercent: number
  totalAssets: number
}) {
  console.log('[Alert] NAV Change:', data)
  // TODO: Send to all investors
}

async function sendDisputeAlert(escrowId: string, reason: string, raisedBy: string) {
  console.log('[Alert] Dispute Raised:', { escrowId, reason, raisedBy })
  // TODO: Critical alert to dispute resolver
}

/**
 * Stop all listeners (for graceful shutdown)
 */
export async function stopEventListener() {
  console.log('[EventListener] Stopping all event listeners...')
  // Viem watchers are automatically cleaned up
}
