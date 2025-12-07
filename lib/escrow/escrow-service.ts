/**
 * Wells AI Escrow Service
 *
 * Secure escrow operations using Circle USDC.
 * Integrates with deal flow for automated payment protection.
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk'
import { sql } from '@vercel/postgres'
import {
  EscrowDeal,
  EscrowMilestone,
  EscrowDispute,
  EscrowTransaction,
  EscrowStatus,
  MilestoneStatus,
  DisputeStatus,
  CreateEscrowRequest,
  FundEscrowRequest,
  ReleaseEscrowRequest,
  DisputeEscrowRequest,
  RefundEscrowRequest,
} from './types'

// Initialize Circle SDK
const circle = new Circle(
  process.env.CIRCLE_API_KEY || '',
  process.env.CIRCLE_ENV === 'production'
    ? CircleEnvironments.production
    : CircleEnvironments.sandbox
)

// ============================================================================
// ESCROW CREATION
// ============================================================================

/**
 * Create a new escrow for a deal
 * Creates dedicated Circle wallet to hold funds
 */
export async function createEscrow(
  params: CreateEscrowRequest
): Promise<EscrowDeal> {
  // Create dedicated escrow wallet via Circle
  const walletResponse = await circle.wallets.createWallet({
    idempotencyKey: `escrow_${params.dealId}_${Date.now()}`,
    description: `Escrow - Deal ${params.dealId}`,
  })

  const wallet = walletResponse.data?.data
  if (!wallet) {
    throw new Error('Failed to create escrow wallet')
  }

  // Generate wallet address on Base L2
  const addressResponse = await circle.wallets.generateAddress(wallet.walletId!)

  const escrowId = `escrow_${params.dealId}_${Date.now()}`
  const totalAmount = params.amount + params.platformFee

  // Create milestones if provided
  const milestones: EscrowMilestone[] = (params.milestones || []).map((m, index) => ({
    id: `milestone_${escrowId}_${index}`,
    escrowId,
    title: m.title,
    description: m.description,
    amount: m.amount,
    dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
    deliverables: m.deliverables,
    completedDeliverables: [],
    status: 'pending' as MilestoneStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  // Validate milestone amounts if present
  if (milestones.length > 0) {
    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + m.amount, 0)
    if (Math.abs(totalMilestoneAmount - params.amount) > 0.01) {
      throw new Error(
        `Milestone amounts (${totalMilestoneAmount}) must equal deal amount (${params.amount})`
      )
    }
  }

  const escrow: EscrowDeal = {
    id: escrowId,
    dealId: params.dealId,
    buyerId: params.buyerId,
    buyerEmail: params.buyerEmail,
    sellerId: params.sellerId,
    sellerEmail: params.sellerEmail,
    amount: params.amount,
    platformFee: params.platformFee,
    totalAmount,
    escrowWalletId: wallet.walletId!,
    escrowWalletAddress: addressResponse.data?.data?.address || '',
    status: 'created',
    description: params.description,
    metadata: params.metadata || {},
    milestones,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Persist to database
  await sql`
    INSERT INTO escrow_deals (
      id, deal_id, buyer_id, buyer_email, seller_id, seller_email,
      amount, platform_fee, total_amount,
      escrow_wallet_id, escrow_wallet_address,
      status, description, metadata,
      created_at, updated_at
    ) VALUES (
      ${escrow.id}, ${escrow.dealId}, ${escrow.buyerId}, ${escrow.buyerEmail},
      ${escrow.sellerId}, ${escrow.sellerEmail},
      ${escrow.amount}, ${escrow.platformFee}, ${escrow.totalAmount},
      ${escrow.escrowWalletId}, ${escrow.escrowWalletAddress},
      ${escrow.status}, ${escrow.description}, ${JSON.stringify(escrow.metadata)},
      ${escrow.createdAt.toISOString()}, ${escrow.updatedAt.toISOString()}
    )
  `

  // Insert milestones
  for (const milestone of milestones) {
    await sql`
      INSERT INTO escrow_milestones (
        id, escrow_id, title, description, amount, due_date,
        deliverables, completed_deliverables, status,
        created_at, updated_at
      ) VALUES (
        ${milestone.id}, ${milestone.escrowId}, ${milestone.title},
        ${milestone.description}, ${milestone.amount},
        ${milestone.dueDate?.toISOString() || null},
        ${JSON.stringify(milestone.deliverables)},
        ${JSON.stringify(milestone.completedDeliverables)},
        ${milestone.status},
        ${milestone.createdAt.toISOString()}, ${milestone.updatedAt.toISOString()}
      )
    `
  }

  return escrow
}

// ============================================================================
// FUNDING
// ============================================================================

/**
 * Fund escrow with USDC
 * Verifies Circle transfer and updates escrow status
 */
export async function fundEscrow(
  escrowId: string,
  params: FundEscrowRequest
): Promise<{ escrow: EscrowDeal; transaction: EscrowTransaction }> {
  // Get escrow
  const escrowResult = await sql`
    SELECT * FROM escrow_deals WHERE id = ${escrowId}
  `

  if (escrowResult.rows.length === 0) {
    throw new Error('Escrow not found')
  }

  const escrowData = escrowResult.rows[0]

  if (escrowData.status !== 'created') {
    throw new Error(`Escrow already ${escrowData.status}`)
  }

  // Verify wallet balance
  const balanceResponse = await circle.wallets.getWallet(escrowData.escrow_wallet_id)
  const balances = balanceResponse.data?.data?.balances || []
  const usdcBalance = balances.find((b: any) => b.currency === 'USD')
  const balance = parseFloat(usdcBalance?.amount || '0')

  if (balance < escrowData.total_amount) {
    throw new Error(
      `Insufficient funds. Required: ${escrowData.total_amount} USDC, Found: ${balance} USDC`
    )
  }

  // Create transaction record
  const transaction: EscrowTransaction = {
    id: `tx_${escrowId}_fund_${Date.now()}`,
    escrowId,
    type: 'fund',
    amount: escrowData.total_amount,
    currency: 'USDC',
    circleTransferId: params.paymentDetails.fromWalletId,
    circleTransactionHash: params.paymentDetails.transactionHash,
    fromWalletId: params.paymentDetails.fromWalletId,
    toWalletId: escrowData.escrow_wallet_id,
    toWalletAddress: escrowData.escrow_wallet_address,
    status: 'completed',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
  }

  // Update escrow status
  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_deals
    SET status = 'funded',
        funded_at = ${now},
        funding_transfer_id = ${transaction.circleTransferId},
        buyer_wallet_id = ${params.paymentDetails.fromWalletId},
        updated_at = ${now}
    WHERE id = ${escrowId}
  `

  // Record transaction
  await sql`
    INSERT INTO escrow_transactions (
      id, escrow_id, type, amount, currency,
      circle_transfer_id, circle_transaction_hash,
      from_wallet_id, to_wallet_id, to_wallet_address,
      status, metadata, created_at, updated_at, completed_at
    ) VALUES (
      ${transaction.id}, ${transaction.escrowId}, ${transaction.type},
      ${transaction.amount}, ${transaction.currency},
      ${transaction.circleTransferId}, ${transaction.circleTransactionHash || null},
      ${transaction.fromWalletId || null}, ${transaction.toWalletId || null},
      ${transaction.toWalletAddress || null},
      ${transaction.status}, ${JSON.stringify(transaction.metadata)},
      ${transaction.createdAt.toISOString()}, ${transaction.updatedAt.toISOString()},
      ${transaction.completedAt!.toISOString()}
    )
  `

  const updatedEscrow = await getEscrow(escrowId)
  return { escrow: updatedEscrow, transaction }
}

// ============================================================================
// RELEASE
// ============================================================================

/**
 * Release escrow funds to seller
 * Can be full release or milestone-based
 */
export async function releaseEscrow(
  escrowId: string,
  params: ReleaseEscrowRequest,
  releasedBy: string
): Promise<{ escrow: EscrowDeal; transaction: EscrowTransaction; releasedAmount: number }> {
  const escrow = await getEscrow(escrowId)

  if (escrow.status !== 'funded') {
    throw new Error(`Cannot release escrow with status: ${escrow.status}`)
  }

  if (!escrow.sellerWalletAddress) {
    throw new Error('Seller wallet address not set')
  }

  let releaseAmount = params.amount || escrow.amount
  let milestoneId: string | undefined

  // Handle milestone release
  if (params.milestoneId) {
    const milestone = escrow.milestones.find(m => m.id === params.milestoneId)
    if (!milestone) {
      throw new Error('Milestone not found')
    }
    if (milestone.status !== 'approved') {
      throw new Error('Milestone must be approved before release')
    }
    releaseAmount = milestone.amount
    milestoneId = milestone.id
  }

  // Transfer funds via Circle
  const transferResponse = await circle.transfers.createTransfer({
    idempotencyKey: `release_${escrowId}_${milestoneId || 'full'}_${Date.now()}`,
    source: {
      type: 'wallet',
      id: escrow.escrowWalletId,
    },
    destination: {
      type: 'blockchain',
      address: escrow.sellerWalletAddress,
      chain: 'BASE',
    },
    amount: {
      amount: releaseAmount.toFixed(2),
      currency: 'USD',
    },
  })

  const transferId = transferResponse.data?.data?.id || ''

  // Create transaction record
  const transaction: EscrowTransaction = {
    id: `tx_${escrowId}_release_${Date.now()}`,
    escrowId,
    type: milestoneId ? 'milestone_release' : 'release',
    amount: releaseAmount,
    currency: 'USDC',
    circleTransferId: transferId,
    fromWalletId: escrow.escrowWalletId,
    fromWalletAddress: escrow.escrowWalletAddress,
    toWalletId: escrow.sellerWalletId,
    toWalletAddress: escrow.sellerWalletAddress,
    status: 'completed',
    milestoneId,
    metadata: { releasedBy, notes: params.notes },
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
  }

  const now = new Date().toISOString()

  // Update milestone if applicable
  if (milestoneId) {
    await sql`
      UPDATE escrow_milestones
      SET status = 'released',
          released_at = ${now},
          release_transfer_id = ${transferId},
          updated_at = ${now}
      WHERE id = ${milestoneId}
    `
  }

  // Check if all milestones released (or full release)
  const allMilestonesReleased =
    escrow.milestones.length === 0 ||
    (milestoneId &&
      escrow.milestones.every(m => m.id === milestoneId || m.status === 'released'))

  if (allMilestonesReleased || !milestoneId) {
    await sql`
      UPDATE escrow_deals
      SET status = 'released',
          released_at = ${now},
          release_transfer_id = ${transferId},
          updated_at = ${now}
      WHERE id = ${escrowId}
    `
  }

  // Record transaction
  await sql`
    INSERT INTO escrow_transactions (
      id, escrow_id, type, amount, currency,
      circle_transfer_id,
      from_wallet_id, from_wallet_address,
      to_wallet_id, to_wallet_address,
      status, milestone_id, metadata,
      created_at, updated_at, completed_at
    ) VALUES (
      ${transaction.id}, ${transaction.escrowId}, ${transaction.type},
      ${transaction.amount}, ${transaction.currency},
      ${transaction.circleTransferId},
      ${transaction.fromWalletId || null}, ${transaction.fromWalletAddress || null},
      ${transaction.toWalletId || null}, ${transaction.toWalletAddress || null},
      ${transaction.status}, ${transaction.milestoneId || null},
      ${JSON.stringify(transaction.metadata)},
      ${transaction.createdAt.toISOString()}, ${transaction.updatedAt.toISOString()},
      ${transaction.completedAt!.toISOString()}
    )
  `

  const updatedEscrow = await getEscrow(escrowId)
  return { escrow: updatedEscrow, transaction, releasedAmount: releaseAmount }
}

// ============================================================================
// DISPUTE
// ============================================================================

/**
 * File a dispute on an escrow
 */
export async function disputeEscrow(
  escrowId: string,
  filedBy: 'buyer' | 'seller',
  filedByUserId: string,
  params: DisputeEscrowRequest
): Promise<{ dispute: EscrowDispute; escrow: EscrowDeal }> {
  const escrow = await getEscrow(escrowId)

  if (escrow.status !== 'funded') {
    throw new Error(`Cannot dispute escrow with status: ${escrow.status}`)
  }

  const dispute: EscrowDispute = {
    id: `dispute_${escrowId}_${Date.now()}`,
    escrowId,
    filedBy,
    filedByUserId,
    reason: params.reason,
    description: params.description,
    evidence: params.evidence || [],
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Update escrow status
  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_deals
    SET status = 'disputed',
        disputed_at = ${now},
        updated_at = ${now}
    WHERE id = ${escrowId}
  `

  // Create dispute record
  await sql`
    INSERT INTO escrow_disputes (
      id, escrow_id, filed_by, filed_by_user_id,
      reason, description, evidence, status,
      created_at, updated_at
    ) VALUES (
      ${dispute.id}, ${dispute.escrowId}, ${dispute.filedBy},
      ${dispute.filedByUserId}, ${dispute.reason}, ${dispute.description},
      ${JSON.stringify(dispute.evidence)}, ${dispute.status},
      ${dispute.createdAt.toISOString()}, ${dispute.updatedAt.toISOString()}
    )
  `

  const updatedEscrow = await getEscrow(escrowId)
  return { dispute, escrow: updatedEscrow }
}

// ============================================================================
// REFUND
// ============================================================================

/**
 * Refund escrow to buyer
 * Can be full or partial refund
 */
export async function refundEscrow(
  escrowId: string,
  params: RefundEscrowRequest,
  refundedBy: string
): Promise<{ escrow: EscrowDeal; transaction: EscrowTransaction; refundedAmount: number }> {
  const escrow = await getEscrow(escrowId)

  if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
    throw new Error(`Cannot refund escrow with status: ${escrow.status}`)
  }

  if (!escrow.buyerWalletAddress) {
    throw new Error('Buyer wallet address not set')
  }

  const refundAmount = params.amount || escrow.amount

  // Transfer funds back to buyer via Circle
  const transferResponse = await circle.transfers.createTransfer({
    idempotencyKey: `refund_${escrowId}_${Date.now()}`,
    source: {
      type: 'wallet',
      id: escrow.escrowWalletId,
    },
    destination: {
      type: 'blockchain',
      address: escrow.buyerWalletAddress,
      chain: 'BASE',
    },
    amount: {
      amount: refundAmount.toFixed(2),
      currency: 'USD',
    },
  })

  const transferId = transferResponse.data?.data?.id || ''

  const transaction: EscrowTransaction = {
    id: `tx_${escrowId}_refund_${Date.now()}`,
    escrowId,
    type: 'refund',
    amount: refundAmount,
    currency: 'USDC',
    circleTransferId: transferId,
    fromWalletId: escrow.escrowWalletId,
    fromWalletAddress: escrow.escrowWalletAddress,
    toWalletId: escrow.buyerWalletId,
    toWalletAddress: escrow.buyerWalletAddress,
    status: 'completed',
    metadata: { refundedBy, reason: params.reason },
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
  }

  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_deals
    SET status = 'refunded',
        refunded_at = ${now},
        updated_at = ${now}
    WHERE id = ${escrowId}
  `

  await sql`
    INSERT INTO escrow_transactions (
      id, escrow_id, type, amount, currency,
      circle_transfer_id,
      from_wallet_id, from_wallet_address,
      to_wallet_id, to_wallet_address,
      status, metadata,
      created_at, updated_at, completed_at
    ) VALUES (
      ${transaction.id}, ${transaction.escrowId}, ${transaction.type},
      ${transaction.amount}, ${transaction.currency},
      ${transaction.circleTransferId},
      ${transaction.fromWalletId || null}, ${transaction.fromWalletAddress || null},
      ${transaction.toWalletId || null}, ${transaction.toWalletAddress || null},
      ${transaction.status}, ${JSON.stringify(transaction.metadata)},
      ${transaction.createdAt.toISOString()}, ${transaction.updatedAt.toISOString()},
      ${transaction.completedAt!.toISOString()}
    )
  `

  const updatedEscrow = await getEscrow(escrowId)
  return { escrow: updatedEscrow, transaction, refundedAmount: refundAmount }
}

// ============================================================================
// MILESTONE MANAGEMENT
// ============================================================================

/**
 * Complete a milestone (called by seller)
 */
export async function completeMilestone(
  milestoneId: string,
  deliverables: string[],
  completedBy: string
): Promise<EscrowMilestone> {
  const milestoneResult = await sql`
    SELECT * FROM escrow_milestones WHERE id = ${milestoneId}
  `

  if (milestoneResult.rows.length === 0) {
    throw new Error('Milestone not found')
  }

  const milestone = milestoneResult.rows[0]

  if (milestone.status !== 'pending') {
    throw new Error(`Milestone already ${milestone.status}`)
  }

  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_milestones
    SET status = 'completed',
        completed_deliverables = ${JSON.stringify(deliverables)},
        completed_at = ${now},
        updated_at = ${now}
    WHERE id = ${milestoneId}
  `

  const updatedResult = await sql`
    SELECT * FROM escrow_milestones WHERE id = ${milestoneId}
  `

  return mapMilestone(updatedResult.rows[0])
}

/**
 * Approve a milestone (called by buyer)
 */
export async function approveMilestone(
  milestoneId: string,
  approvedBy: string
): Promise<EscrowMilestone> {
  const milestoneResult = await sql`
    SELECT * FROM escrow_milestones WHERE id = ${milestoneId}
  `

  if (milestoneResult.rows.length === 0) {
    throw new Error('Milestone not found')
  }

  const milestone = milestoneResult.rows[0]

  if (milestone.status !== 'completed') {
    throw new Error('Milestone must be completed before approval')
  }

  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_milestones
    SET status = 'approved',
        approved_by = ${approvedBy},
        approved_at = ${now},
        updated_at = ${now}
    WHERE id = ${milestoneId}
  `

  const updatedResult = await sql`
    SELECT * FROM escrow_milestones WHERE id = ${milestoneId}
  `

  return mapMilestone(updatedResult.rows[0])
}

/**
 * Reject a milestone (called by buyer)
 */
export async function rejectMilestone(
  milestoneId: string,
  rejectedBy: string,
  reason: string
): Promise<EscrowMilestone> {
  const now = new Date().toISOString()
  await sql`
    UPDATE escrow_milestones
    SET status = 'rejected',
        rejected_by = ${rejectedBy},
        rejected_at = ${now},
        rejection_reason = ${reason},
        updated_at = ${now}
    WHERE id = ${milestoneId}
  `

  const result = await sql`
    SELECT * FROM escrow_milestones WHERE id = ${milestoneId}
  `

  return mapMilestone(result.rows[0])
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get escrow by ID
 */
export async function getEscrow(escrowId: string): Promise<EscrowDeal> {
  const result = await sql`
    SELECT * FROM escrow_deals WHERE id = ${escrowId}
  `

  if (result.rows.length === 0) {
    throw new Error('Escrow not found')
  }

  const escrowData = result.rows[0]

  // Get milestones
  const milestonesResult = await sql`
    SELECT * FROM escrow_milestones WHERE escrow_id = ${escrowId} ORDER BY created_at ASC
  `

  return {
    id: escrowData.id,
    dealId: escrowData.deal_id,
    buyerId: escrowData.buyer_id,
    buyerEmail: escrowData.buyer_email,
    sellerId: escrowData.seller_id,
    sellerEmail: escrowData.seller_email,
    amount: parseFloat(escrowData.amount),
    platformFee: parseFloat(escrowData.platform_fee),
    totalAmount: parseFloat(escrowData.total_amount),
    escrowWalletId: escrowData.escrow_wallet_id,
    escrowWalletAddress: escrowData.escrow_wallet_address,
    fundingTransferId: escrowData.funding_transfer_id,
    releaseTransferId: escrowData.release_transfer_id,
    status: escrowData.status,
    buyerWalletId: escrowData.buyer_wallet_id,
    buyerWalletAddress: escrowData.buyer_wallet_address,
    sellerWalletId: escrowData.seller_wallet_id,
    sellerWalletAddress: escrowData.seller_wallet_address,
    description: escrowData.description,
    metadata: escrowData.metadata || {},
    milestones: milestonesResult.rows.map(mapMilestone),
    createdAt: new Date(escrowData.created_at),
    updatedAt: new Date(escrowData.updated_at),
    fundedAt: escrowData.funded_at ? new Date(escrowData.funded_at) : undefined,
    releasedAt: escrowData.released_at ? new Date(escrowData.released_at) : undefined,
    refundedAt: escrowData.refunded_at ? new Date(escrowData.refunded_at) : undefined,
    disputedAt: escrowData.disputed_at ? new Date(escrowData.disputed_at) : undefined,
    resolvedAt: escrowData.resolved_at ? new Date(escrowData.resolved_at) : undefined,
  }
}

/**
 * Get escrow by deal ID
 */
export async function getEscrowByDealId(dealId: string): Promise<EscrowDeal | null> {
  const result = await sql`
    SELECT * FROM escrow_deals WHERE deal_id = ${dealId} LIMIT 1
  `

  if (result.rows.length === 0) {
    return null
  }

  return getEscrow(result.rows[0].id)
}

/**
 * List escrows for a user
 */
export async function listEscrows(
  userId: string,
  role: 'buyer' | 'seller' | 'both' = 'both'
): Promise<EscrowDeal[]> {
  let query
  if (role === 'buyer') {
    query = sql`SELECT * FROM escrow_deals WHERE buyer_id = ${userId} ORDER BY created_at DESC`
  } else if (role === 'seller') {
    query = sql`SELECT * FROM escrow_deals WHERE seller_id = ${userId} ORDER BY created_at DESC`
  } else {
    query = sql`
      SELECT * FROM escrow_deals
      WHERE buyer_id = ${userId} OR seller_id = ${userId}
      ORDER BY created_at DESC
    `
  }

  const result = await query
  return Promise.all(result.rows.map(row => getEscrow(row.id)))
}

// ============================================================================
// HELPERS
// ============================================================================

function mapMilestone(row: any): EscrowMilestone {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    title: row.title,
    description: row.description,
    amount: parseFloat(row.amount),
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    deliverables: row.deliverables || [],
    completedDeliverables: row.completed_deliverables || [],
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
    rejectionReason: row.rejection_reason,
    releasedAt: row.released_at ? new Date(row.released_at) : undefined,
    releaseTransferId: row.release_transfer_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  }
}
