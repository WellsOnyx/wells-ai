/**
 * Frictionless B2B Deal Service
 *
 * "Yes, proceed" = deal done, money escrowed, everyone wins
 *
 * Core Philosophy:
 * - Verbal/chat agreement is binding
 * - Instant escrow on confirmation
 * - Automatic settlement on delivery
 * - Zero paperwork for standard terms
 */

import { sql } from '@/lib/db'
import {
  B2BDeal,
  DealConfirmation,
  TrustedParty,
  InstantOffer,
  DealInvoice,
  DealTemplate,
  CreateDealInput,
  ConfirmDealInput,
  AcceptOfferInput,
  CreateOfferInput,
  AddTrustedPartyInput,
  IntentAnalysis,
  CONFIRMATION_PHRASES,
  REJECTION_PHRASES,
  DealStatus,
} from './types'

// ============================================================================
// FEE ALLOCATION (Correct Economics)
// ============================================================================

const PLATFORM_FEE_RATE = 0.01 // 1%

// After 10% tithe, remaining 90% split into thirds
const FEE_ALLOCATION = {
  tithe: 0.10,           // 10% to tithe
  operating: 0.30,       // 30% of remaining (27% of total)
  liquidity: 0.30,       // 30% of remaining (27% of total)
  partnerships: 0.30,    // 30% of remaining (27% of total)
} as const

function calculateFees(amount: number): {
  totalFee: number
  tithe: number
  operating: number
  liquidity: number
  partnerships: number
} {
  const totalFee = amount * PLATFORM_FEE_RATE
  const tithe = totalFee * FEE_ALLOCATION.tithe
  const afterTithe = totalFee - tithe

  return {
    totalFee,
    tithe,
    operating: afterTithe * FEE_ALLOCATION.operating,
    liquidity: afterTithe * FEE_ALLOCATION.liquidity,
    partnerships: afterTithe * FEE_ALLOCATION.partnerships,
  }
}

// ============================================================================
// DEAL CREATION & MANAGEMENT
// ============================================================================

export async function createDeal(input: CreateDealInput): Promise<B2BDeal> {
  const fees = calculateFees(input.amount)

  const result = await sql`
    INSERT INTO b2b_deals (
      buyer_id, seller_id, buyer_company, seller_company,
      title, description, amount, currency,
      payment_terms, payment_method, delivery_type,
      expected_delivery, auto_release, auto_release_days,
      platform_fee, rfq_id, quote_id, conversation_id,
      status
    ) VALUES (
      ${input.buyerId},
      ${input.sellerId},
      ${input.buyerCompany || null},
      ${input.sellerCompany || null},
      ${input.title},
      ${input.description || null},
      ${input.amount},
      ${input.currency || 'USD'},
      ${input.paymentTerms || 'immediate'},
      ${input.paymentMethod || 'escrow'},
      ${input.deliveryType || 'confirmation'},
      ${input.expectedDelivery || null},
      ${input.autoRelease !== false},
      ${input.autoReleaseDays || 3},
      ${fees.totalFee},
      ${input.rfqId || null},
      ${input.quoteId || null},
      ${input.conversationId || null},
      'proposed'
    )
    RETURNING *
  `

  return mapDealRow(result[0])
}

export async function getDeal(dealId: string): Promise<B2BDeal | null> {
  const result = await sql`
    SELECT * FROM b2b_deals WHERE id = ${dealId}
  `

  if (result.length === 0) return null
  return mapDealRow(result[0])
}

export async function getUserDeals(
  userId: string,
  role?: 'buyer' | 'seller',
  status?: DealStatus
): Promise<B2BDeal[]> {
  let result

  if (role === 'buyer') {
    result = status
      ? await sql`SELECT * FROM b2b_deals WHERE buyer_id = ${userId} AND status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM b2b_deals WHERE buyer_id = ${userId} ORDER BY created_at DESC`
  } else if (role === 'seller') {
    result = status
      ? await sql`SELECT * FROM b2b_deals WHERE seller_id = ${userId} AND status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM b2b_deals WHERE seller_id = ${userId} ORDER BY created_at DESC`
  } else {
    result = status
      ? await sql`SELECT * FROM b2b_deals WHERE (buyer_id = ${userId} OR seller_id = ${userId}) AND status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM b2b_deals WHERE (buyer_id = ${userId} OR seller_id = ${userId}) ORDER BY created_at DESC`
  }

  return result.map(mapDealRow)
}

export async function getDealsRequiringAction(userId: string): Promise<B2BDeal[]> {
  const result = await sql`
    SELECT * FROM v_deals_requiring_action
    WHERE action_by = ${userId}
    ORDER BY created_at DESC
  `

  return result.map(mapDealRow)
}

// ============================================================================
// DEAL CONFIRMATION - The Magic Moment
// ============================================================================

/**
 * Confirm a deal - "yes, proceed" = deal done
 *
 * When both parties confirm:
 * 1. Deal status → 'accepted'
 * 2. If auto-fund enabled, escrow is funded
 * 3. Everyone notified
 */
export async function confirmDeal(input: ConfirmDealInput): Promise<{
  deal: B2BDeal
  confirmation: DealConfirmation
  fullyConfirmed: boolean
  escrowFunded: boolean
}> {
  const deal = await getDeal(input.dealId)
  if (!deal) throw new Error('Deal not found')

  // Validate role
  if (input.role === 'buyer' && deal.buyerId !== input.userId) {
    throw new Error('Not authorized as buyer')
  }
  if (input.role === 'seller' && deal.sellerId !== input.userId) {
    throw new Error('Not authorized as seller')
  }

  // Check if already confirmed
  if (input.role === 'buyer' && deal.buyerConfirmed) {
    throw new Error('Buyer already confirmed')
  }
  if (input.role === 'seller' && deal.sellerConfirmed) {
    throw new Error('Seller already confirmed')
  }

  // Analyze intent from message
  const intent = analyzeIntent(input.message || 'confirmed')
  if (intent.intent === 'reject') {
    throw new Error('Message appears to be a rejection, not confirmation')
  }
  if (intent.confidence < 0.7) {
    throw new Error('Confirmation intent unclear. Please explicitly confirm.')
  }

  // Record confirmation
  const confirmationResult = await sql`
    INSERT INTO deal_confirmations (
      deal_id, user_id, role, method, channel, message,
      intent_score, conversation_id, message_id, ip_address, user_agent
    ) VALUES (
      ${input.dealId},
      ${input.userId},
      ${input.role},
      ${input.method},
      ${input.channel || null},
      ${input.message || null},
      ${intent.confidence},
      ${input.conversationId || null},
      ${input.messageId || null},
      ${input.ipAddress || null},
      ${input.userAgent || null}
    )
    RETURNING *
  `

  // Update deal with confirmation
  const updateField = input.role === 'buyer'
    ? sql`
        buyer_confirmed = TRUE,
        buyer_confirmed_at = NOW(),
        buyer_confirmation_method = ${input.method},
        buyer_confirmation_message = ${input.message || null}
      `
    : sql`
        seller_confirmed = TRUE,
        seller_confirmed_at = NOW(),
        seller_confirmation_method = ${input.method},
        seller_confirmation_message = ${input.message || null}
      `

  await sql`
    UPDATE b2b_deals SET
      ${updateField},
      updated_at = NOW()
    WHERE id = ${input.dealId}
  `

  // Refresh deal
  const updatedDeal = await getDeal(input.dealId)
  if (!updatedDeal) throw new Error('Deal not found after update')

  // Check if both parties confirmed
  const fullyConfirmed = updatedDeal.buyerConfirmed && updatedDeal.sellerConfirmed
  let escrowFunded = false

  if (fullyConfirmed) {
    // Update status to accepted
    await sql`
      UPDATE b2b_deals SET
        status = 'accepted',
        updated_at = NOW()
      WHERE id = ${input.dealId}
    `

    // Check if we should auto-fund escrow
    const canAutoFund = await checkAutoFund(updatedDeal.buyerId, updatedDeal.sellerId, updatedDeal.amount)

    if (canAutoFund && updatedDeal.paymentMethod === 'escrow') {
      try {
        await fundDealEscrow(input.dealId)
        escrowFunded = true
      } catch (err) {
        console.error('Auto-fund failed:', err)
        // Non-blocking - buyer can fund manually
      }
    }
  }

  const finalDeal = await getDeal(input.dealId)

  return {
    deal: finalDeal!,
    confirmation: mapConfirmationRow(confirmationResult[0]),
    fullyConfirmed,
    escrowFunded,
  }
}

/**
 * Quick confirm - for trusted parties or simple confirmations
 */
export async function quickConfirm(
  dealId: string,
  userId: string,
  message: string = 'Confirmed'
): Promise<B2BDeal> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  const role = deal.buyerId === userId ? 'buyer' : deal.sellerId === userId ? 'seller' : null
  if (!role) throw new Error('Not a party to this deal')

  const result = await confirmDeal({
    dealId,
    userId,
    role,
    method: 'api',
    message,
  })

  return result.deal
}

// ============================================================================
// ESCROW MANAGEMENT
// ============================================================================

export async function fundDealEscrow(dealId: string): Promise<B2BDeal> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  if (deal.status !== 'accepted') {
    throw new Error('Deal must be accepted before funding')
  }

  if (deal.escrowFunded) {
    throw new Error('Escrow already funded')
  }

  // Create escrow (integrate with existing escrow system)
  // For now, we'll create a grain_escrow record
  const escrowResult = await sql`
    INSERT INTO grain_escrows (
      from_user_id, to_user_id, usd_amount, reference_type, reference_id,
      status
    ) VALUES (
      ${deal.buyerId},
      ${deal.sellerId},
      ${deal.amount},
      'deal',
      ${dealId},
      'locked'
    )
    RETURNING id
  `

  const escrowId = escrowResult[0].id

  // Update deal
  await sql`
    UPDATE b2b_deals SET
      escrow_id = ${escrowId},
      escrow_funded = TRUE,
      escrow_funded_at = NOW(),
      status = 'funded',
      updated_at = NOW()
    WHERE id = ${dealId}
  `

  // Update trusted party stats
  await updateTrustedPartyStats(deal.buyerId, deal.sellerId, deal.amount, 'funded')

  return (await getDeal(dealId))!
}

export async function markDelivered(
  dealId: string,
  userId: string,
  deliveryInfo?: {
    trackingNumber?: string
    carrier?: string
    notes?: string
  }
): Promise<B2BDeal> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  if (deal.sellerId !== userId) {
    throw new Error('Only seller can mark as delivered')
  }

  if (deal.status !== 'funded') {
    throw new Error('Deal must be funded before marking delivered')
  }

  // Record delivery
  await sql`
    INSERT INTO deal_deliveries (
      deal_id, delivery_type, tracking_number, carrier,
      completion_notes, delivered_at, confirmed_by, confirmation_method
    ) VALUES (
      ${dealId},
      ${deal.deliveryType},
      ${deliveryInfo?.trackingNumber || null},
      ${deliveryInfo?.carrier || null},
      ${deliveryInfo?.notes || null},
      NOW(),
      ${userId},
      'manual'
    )
  `

  // Update deal
  await sql`
    UPDATE b2b_deals SET
      status = 'delivered',
      actual_delivery = NOW(),
      updated_at = NOW()
    WHERE id = ${dealId}
  `

  // If auto-release is enabled, schedule release
  if (deal.autoRelease) {
    // In production, this would schedule a job
    // For now, we'll note that auto-release is pending
    console.log(`Auto-release scheduled for deal ${dealId} in ${deal.autoReleaseDays} days`)
  }

  return (await getDeal(dealId))!
}

export async function confirmDelivery(dealId: string, userId: string): Promise<B2BDeal> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  if (deal.buyerId !== userId) {
    throw new Error('Only buyer can confirm delivery')
  }

  if (deal.status !== 'delivered') {
    throw new Error('Deal must be in delivered status')
  }

  // Release escrow
  await releaseDealEscrow(dealId)

  return (await getDeal(dealId))!
}

export async function releaseDealEscrow(dealId: string): Promise<B2BDeal> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  if (!deal.escrowId) {
    throw new Error('No escrow to release')
  }

  // Release escrow
  await sql`
    UPDATE grain_escrows SET
      status = 'released',
      released_at = NOW(),
      updated_at = NOW()
    WHERE id = ${deal.escrowId}
  `

  // Update deal
  await sql`
    UPDATE b2b_deals SET
      status = 'completed',
      fee_paid = TRUE,
      updated_at = NOW()
    WHERE id = ${dealId}
  `

  // Update trusted party stats
  await updateTrustedPartyStats(deal.buyerId, deal.sellerId, deal.amount, 'completed')

  // Generate invoice
  await generateInvoice(dealId)

  return (await getDeal(dealId))!
}

// ============================================================================
// INSTANT OFFERS
// ============================================================================

export async function createOffer(
  fromUserId: string,
  input: CreateOfferInput
): Promise<InstantOffer> {
  const validUntil = input.validForHours
    ? new Date(Date.now() + input.validForHours * 60 * 60 * 1000)
    : null

  const result = await sql`
    INSERT INTO instant_offers (
      from_user_id, from_company, to_user_id, to_company,
      title, description, amount, currency,
      payment_terms, delivery_terms, valid_until
    ) VALUES (
      ${fromUserId},
      ${null},
      ${input.toUserId || null},
      ${input.toCompany || null},
      ${input.title},
      ${input.description || null},
      ${input.amount},
      ${input.currency || 'USD'},
      ${input.paymentTerms || 'immediate'},
      ${input.deliveryTerms || null},
      ${validUntil}
    )
    RETURNING *
  `

  return mapOfferRow(result[0])
}

export async function acceptOffer(input: AcceptOfferInput): Promise<{
  offer: InstantOffer
  deal: B2BDeal
}> {
  const offerResult = await sql`
    SELECT * FROM instant_offers WHERE id = ${input.offerId}
  `

  if (offerResult.length === 0) throw new Error('Offer not found')

  const offer = mapOfferRow(offerResult[0])

  if (offer.status !== 'open') {
    throw new Error('Offer is no longer available')
  }

  if (offer.validUntil && new Date(offer.validUntil) < new Date()) {
    // Mark as expired
    await sql`UPDATE instant_offers SET status = 'expired' WHERE id = ${input.offerId}`
    throw new Error('Offer has expired')
  }

  if (offer.toUserId && offer.toUserId !== input.userId) {
    throw new Error('This offer is not for you')
  }

  // Create deal from offer
  const deal = await createDeal({
    buyerId: input.userId,
    sellerId: offer.fromUserId,
    buyerCompany: input.company,
    sellerCompany: offer.fromCompany,
    title: offer.title,
    description: offer.description,
    amount: offer.amount,
    currency: offer.currency,
    paymentTerms: offer.paymentTerms,
  })

  // Auto-confirm both parties since offer was explicit
  await sql`
    UPDATE b2b_deals SET
      buyer_confirmed = TRUE,
      buyer_confirmed_at = NOW(),
      buyer_confirmation_method = 'button',
      buyer_confirmation_message = 'Accepted offer',
      seller_confirmed = TRUE,
      seller_confirmed_at = NOW(),
      seller_confirmation_method = 'api',
      seller_confirmation_message = 'Created offer',
      status = 'accepted',
      updated_at = NOW()
    WHERE id = ${deal.id}
  `

  // Update offer
  await sql`
    UPDATE instant_offers SET
      status = 'accepted',
      accepted_by = ${input.userId},
      accepted_at = NOW(),
      deal_id = ${deal.id}
    WHERE id = ${input.offerId}
  `

  const updatedOffer = mapOfferRow((await sql`SELECT * FROM instant_offers WHERE id = ${input.offerId}`)[0])
  const updatedDeal = await getDeal(deal.id)

  return {
    offer: updatedOffer,
    deal: updatedDeal!,
  }
}

export async function getOffers(
  userId: string,
  direction: 'sent' | 'received' | 'open'
): Promise<InstantOffer[]> {
  let result

  if (direction === 'sent') {
    result = await sql`
      SELECT * FROM instant_offers
      WHERE from_user_id = ${userId}
      ORDER BY created_at DESC
    `
  } else if (direction === 'received') {
    result = await sql`
      SELECT * FROM instant_offers
      WHERE to_user_id = ${userId} AND status = 'open'
      ORDER BY created_at DESC
    `
  } else {
    result = await sql`
      SELECT * FROM instant_offers
      WHERE to_user_id IS NULL AND status = 'open'
      AND (valid_until IS NULL OR valid_until > NOW())
      ORDER BY created_at DESC
    `
  }

  return result.map(mapOfferRow)
}

// ============================================================================
// TRUSTED PARTIES
// ============================================================================

export async function addTrustedParty(
  userId: string,
  input: AddTrustedPartyInput
): Promise<TrustedParty> {
  const result = await sql`
    INSERT INTO trusted_parties (
      user_id, trusted_user_id, trust_level,
      max_deal_amount, daily_limit, monthly_limit,
      auto_approve, auto_fund, auto_release
    ) VALUES (
      ${userId},
      ${input.trustedUserId},
      ${input.trustLevel || 'standard'},
      ${input.maxDealAmount || null},
      ${input.dailyLimit || null},
      ${input.monthlyLimit || null},
      ${input.autoApprove || false},
      ${input.autoFund || false},
      ${input.autoRelease !== false}
    )
    ON CONFLICT (user_id, trusted_user_id) DO UPDATE SET
      trust_level = EXCLUDED.trust_level,
      max_deal_amount = EXCLUDED.max_deal_amount,
      daily_limit = EXCLUDED.daily_limit,
      monthly_limit = EXCLUDED.monthly_limit,
      auto_approve = EXCLUDED.auto_approve,
      auto_fund = EXCLUDED.auto_fund,
      auto_release = EXCLUDED.auto_release,
      updated_at = NOW()
    RETURNING *
  `

  return mapTrustedPartyRow(result[0])
}

export async function getTrustedParties(userId: string): Promise<TrustedParty[]> {
  const result = await sql`
    SELECT * FROM trusted_parties
    WHERE user_id = ${userId} AND is_active = TRUE
    ORDER BY total_volume DESC
  `

  return result.map(mapTrustedPartyRow)
}

export async function checkAutoFund(
  buyerId: string,
  sellerId: string,
  amount: number
): Promise<boolean> {
  const result = await sql`
    SELECT * FROM trusted_parties
    WHERE user_id = ${buyerId}
    AND trusted_user_id = ${sellerId}
    AND is_active = TRUE
    AND auto_fund = TRUE
  `

  if (result.length === 0) return false

  const trust = mapTrustedPartyRow(result[0])

  // Check limits
  if (trust.maxDealAmount && amount > trust.maxDealAmount) return false

  // Could add daily/monthly limit checks here

  return true
}

async function updateTrustedPartyStats(
  buyerId: string,
  sellerId: string,
  amount: number,
  event: 'funded' | 'completed' | 'disputed'
): Promise<void> {
  if (event === 'funded') {
    await sql`
      UPDATE trusted_parties SET
        total_deals = total_deals + 1,
        total_volume = total_volume + ${amount},
        updated_at = NOW()
      WHERE user_id = ${buyerId} AND trusted_user_id = ${sellerId}
    `
  } else if (event === 'completed') {
    await sql`
      UPDATE trusted_parties SET
        successful_deals = successful_deals + 1,
        updated_at = NOW()
      WHERE user_id = ${buyerId} AND trusted_user_id = ${sellerId}
    `
  } else if (event === 'disputed') {
    await sql`
      UPDATE trusted_parties SET
        disputed_deals = disputed_deals + 1,
        updated_at = NOW()
      WHERE user_id = ${buyerId} AND trusted_user_id = ${sellerId}
    `
  }
}

// ============================================================================
// INVOICE GENERATION
// ============================================================================

async function generateInvoice(dealId: string): Promise<DealInvoice> {
  const deal = await getDeal(dealId)
  if (!deal) throw new Error('Deal not found')

  const invoiceNumber = await generateInvoiceNumber()

  const result = await sql`
    INSERT INTO deal_invoices (
      deal_id, invoice_number,
      from_user_id, from_company,
      to_user_id, to_company,
      subtotal, tax_amount, total, currency,
      status, issue_date
    ) VALUES (
      ${dealId},
      ${invoiceNumber},
      ${deal.sellerId},
      ${deal.sellerCompany || null},
      ${deal.buyerId},
      ${deal.buyerCompany || null},
      ${deal.amount},
      0,
      ${deal.amount},
      ${deal.currency},
      'paid',
      CURRENT_DATE
    )
    RETURNING *
  `

  // Update deal with invoice reference
  await sql`
    UPDATE b2b_deals SET invoice_id = ${result[0].id} WHERE id = ${dealId}
  `

  return mapInvoiceRow(result[0])
}

async function generateInvoiceNumber(): Promise<string> {
  const result = await sql`SELECT generate_invoice_number() as num`
  return result[0].num
}

// ============================================================================
// INTENT ANALYSIS
// ============================================================================

export function analyzeIntent(message: string): IntentAnalysis {
  const normalized = message.toLowerCase().trim()

  // Check for confirmation
  for (const phrase of CONFIRMATION_PHRASES) {
    if (normalized.includes(phrase) || normalized === phrase) {
      return {
        intent: 'confirm',
        confidence: 0.95,
        suggestedResponse: 'Deal confirmed! Proceeding with escrow.',
      }
    }
  }

  // Check for rejection
  for (const phrase of REJECTION_PHRASES) {
    if (normalized.includes(phrase) || normalized === phrase) {
      return {
        intent: 'reject',
        confidence: 0.95,
        suggestedResponse: 'Understood. Deal cancelled.',
      }
    }
  }

  // Check for negotiation signals
  const negotiationSignals = ['but', 'however', 'if', 'would you', 'can we', 'what about', 'how about', 'instead']
  for (const signal of negotiationSignals) {
    if (normalized.includes(signal)) {
      return {
        intent: 'negotiate',
        confidence: 0.8,
        suggestedResponse: "I understand you'd like to discuss terms. What would work better for you?",
      }
    }
  }

  // Check for clarification
  const clarificationSignals = ['?', 'what', 'how', 'when', 'where', 'why', 'explain', 'clarify']
  for (const signal of clarificationSignals) {
    if (normalized.includes(signal)) {
      return {
        intent: 'clarify',
        confidence: 0.7,
        suggestedResponse: 'Happy to clarify. What would you like to know?',
      }
    }
  }

  return {
    intent: 'unknown',
    confidence: 0.3,
    suggestedResponse: 'Could you please confirm if you want to proceed with this deal?',
  }
}

// ============================================================================
// CONVERSATIONAL DEAL CREATION
// ============================================================================

export async function processDealMessage(
  userId: string,
  message: string,
  context?: {
    activeDealId?: string
    counterpartyId?: string
    conversationId?: string
  }
): Promise<{
  action: 'created' | 'confirmed' | 'updated' | 'clarify' | 'none'
  deal?: B2BDeal
  response: string
}> {
  const intent = analyzeIntent(message)

  // If there's an active deal and user confirms
  if (context?.activeDealId && intent.intent === 'confirm') {
    const deal = await getDeal(context.activeDealId)
    if (deal) {
      const role = deal.buyerId === userId ? 'buyer' : deal.sellerId === userId ? 'seller' : null

      if (role) {
        const result = await confirmDeal({
          dealId: context.activeDealId,
          userId,
          role,
          method: 'chat',
          message,
          conversationId: context.conversationId,
        })

        if (result.fullyConfirmed) {
          return {
            action: 'confirmed',
            deal: result.deal,
            response: result.escrowFunded
              ? `Deal confirmed and funded! $${result.deal.amount.toLocaleString()} is now in escrow. Awaiting delivery.`
              : `Deal confirmed by both parties! Ready for funding.`,
          }
        } else {
          return {
            action: 'confirmed',
            deal: result.deal,
            response: `You've confirmed the deal. Waiting for the other party to confirm.`,
          }
        }
      }
    }
  }

  // TODO: Add NLP to extract deal terms from message
  // For now, return clarification needed

  return {
    action: 'clarify',
    response: intent.suggestedResponse || 'Could you provide more details about the deal?',
  }
}

// ============================================================================
// ROW MAPPERS
// ============================================================================

function mapDealRow(row: Record<string, unknown>): B2BDeal {
  return {
    id: row.id as string,
    buyerId: row.buyer_id as string,
    buyerCompany: row.buyer_company as string | undefined,
    buyerEmail: row.buyer_email as string | undefined,
    sellerId: row.seller_id as string,
    sellerCompany: row.seller_company as string | undefined,
    sellerEmail: row.seller_email as string | undefined,
    title: row.title as string,
    description: row.description as string | undefined,
    amount: Number(row.amount),
    currency: row.currency as string,
    grainAmount: row.grain_amount ? Number(row.grain_amount) : undefined,
    grainPriceAtDeal: row.grain_price_at_deal ? Number(row.grain_price_at_deal) : undefined,
    paymentTerms: row.payment_terms as B2BDeal['paymentTerms'],
    paymentMethod: row.payment_method as B2BDeal['paymentMethod'],
    escrowId: row.escrow_id as string | undefined,
    escrowFunded: row.escrow_funded as boolean,
    escrowFundedAt: row.escrow_funded_at ? new Date(row.escrow_funded_at as string) : undefined,
    deliveryType: row.delivery_type as B2BDeal['deliveryType'],
    expectedDelivery: row.expected_delivery ? new Date(row.expected_delivery as string) : undefined,
    actualDelivery: row.actual_delivery ? new Date(row.actual_delivery as string) : undefined,
    status: row.status as DealStatus,
    buyerConfirmed: row.buyer_confirmed as boolean,
    buyerConfirmedAt: row.buyer_confirmed_at ? new Date(row.buyer_confirmed_at as string) : undefined,
    buyerConfirmationMethod: row.buyer_confirmation_method as B2BDeal['buyerConfirmationMethod'],
    buyerConfirmationMessage: row.buyer_confirmation_message as string | undefined,
    sellerConfirmed: row.seller_confirmed as boolean,
    sellerConfirmedAt: row.seller_confirmed_at ? new Date(row.seller_confirmed_at as string) : undefined,
    sellerConfirmationMethod: row.seller_confirmation_method as B2BDeal['sellerConfirmationMethod'],
    sellerConfirmationMessage: row.seller_confirmation_message as string | undefined,
    autoRelease: row.auto_release as boolean,
    autoReleaseDays: Number(row.auto_release_days),
    platformFee: row.platform_fee ? Number(row.platform_fee) : undefined,
    feePaid: row.fee_paid as boolean,
    rfqId: row.rfq_id as string | undefined,
    quoteId: row.quote_id as string | undefined,
    invoiceId: row.invoice_id as string | undefined,
    contractId: row.contract_id as string | undefined,
    conversationId: row.conversation_id as string | undefined,
    termsSnapshot: row.terms_snapshot as Record<string, unknown> | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapConfirmationRow(row: Record<string, unknown>): DealConfirmation {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    userId: row.user_id as string,
    role: row.role as 'buyer' | 'seller',
    method: row.method as DealConfirmation['method'],
    channel: row.channel as string | undefined,
    message: row.message as string | undefined,
    intentScore: row.intent_score ? Number(row.intent_score) : undefined,
    conversationId: row.conversation_id as string | undefined,
    messageId: row.message_id as string | undefined,
    isBinding: row.is_binding as boolean,
    ipAddress: row.ip_address as string | undefined,
    userAgent: row.user_agent as string | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

function mapTrustedPartyRow(row: Record<string, unknown>): TrustedParty {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    trustedUserId: row.trusted_user_id as string,
    trustLevel: row.trust_level as TrustedParty['trustLevel'],
    maxDealAmount: row.max_deal_amount ? Number(row.max_deal_amount) : undefined,
    dailyLimit: row.daily_limit ? Number(row.daily_limit) : undefined,
    monthlyLimit: row.monthly_limit ? Number(row.monthly_limit) : undefined,
    autoApprove: row.auto_approve as boolean,
    autoFund: row.auto_fund as boolean,
    autoRelease: row.auto_release as boolean,
    totalDeals: Number(row.total_deals),
    totalVolume: Number(row.total_volume),
    successfulDeals: Number(row.successful_deals),
    disputedDeals: Number(row.disputed_deals),
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapOfferRow(row: Record<string, unknown>): InstantOffer {
  return {
    id: row.id as string,
    fromUserId: row.from_user_id as string,
    fromCompany: row.from_company as string | undefined,
    toUserId: row.to_user_id as string | undefined,
    toCompany: row.to_company as string | undefined,
    title: row.title as string,
    description: row.description as string | undefined,
    amount: Number(row.amount),
    currency: row.currency as string,
    paymentTerms: row.payment_terms as InstantOffer['paymentTerms'],
    deliveryTerms: row.delivery_terms as string | undefined,
    validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
    status: row.status as InstantOffer['status'],
    acceptedBy: row.accepted_by as string | undefined,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    dealId: row.deal_id as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
  }
}

function mapInvoiceRow(row: Record<string, unknown>): DealInvoice {
  return {
    id: row.id as string,
    dealId: row.deal_id as string,
    invoiceNumber: row.invoice_number as string,
    fromUserId: row.from_user_id as string,
    fromCompany: row.from_company as string | undefined,
    fromAddress: row.from_address as Record<string, unknown> | undefined,
    toUserId: row.to_user_id as string,
    toCompany: row.to_company as string | undefined,
    toAddress: row.to_address as Record<string, unknown> | undefined,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    taxRate: row.tax_rate ? Number(row.tax_rate) : undefined,
    total: Number(row.total),
    currency: row.currency as string,
    status: row.status as DealInvoice['status'],
    issueDate: new Date(row.issue_date as string),
    dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
    pdfUrl: row.pdf_url as string | undefined,
    createdAt: new Date(row.created_at as string),
  }
}
