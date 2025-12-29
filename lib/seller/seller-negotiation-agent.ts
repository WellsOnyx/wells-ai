/**
 * Seller Negotiation Agent
 *
 * Represents the seller in AI-to-AI negotiations.
 * Receives buyer offers, evaluates against pricing rules,
 * counter-offers within constraints, and escalates to human when needed.
 *
 * Integration with Wells AI-to-AI Negotiation Engine.
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { SellerAIConfig, getSellerConfig } from './ai-agent-config';
import { GeneratedQuote, getQuote, getSellerQuotes } from './quote-generator';
import { CatalogProduct, getProduct } from './catalog-service';
import { notify } from '@/lib/notifications';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface NegotiationSession {
  id: string;
  quoteId: string;
  sellerId: string;
  buyerId: string;

  // Initial positions
  initialSellerPrice: number;
  initialBuyerOffer?: number;
  currentSellerPrice: number;
  currentBuyerOffer?: number;

  // Negotiation state
  status: 'active' | 'seller_accepted' | 'buyer_accepted' | 'no_deal' | 'escalated' | 'expired';
  round: number;
  maxRounds: number;

  // History
  messages: NegotiationMessage[];

  // Constraints
  sellerFloorPrice: number;
  sellerTargetPrice: number;
  buyerCeilingPrice?: number;

  // Outcome
  finalPrice?: number;
  finalTerms?: NegotiationTerms;
  dealId?: string;

  // Timing
  startedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  completedAt?: Date;
}

export interface NegotiationMessage {
  id: string;
  round: number;
  from: 'seller_ai' | 'buyer_ai' | 'seller' | 'buyer' | 'system';
  type: 'offer' | 'counter' | 'accept' | 'reject' | 'escalate' | 'message';
  content: {
    price?: number;
    terms?: Partial<NegotiationTerms>;
    message: string;
    reasoning?: string; // Internal reasoning (visible to own party)
  };
  timestamp: Date;
}

export interface NegotiationTerms {
  price: number;
  quantity: number;
  deliveryDays: number;
  paymentTerms: string;
  warranty?: string;
  additionalTerms?: string[];
}

export interface BuyerOffer {
  price: number;
  quantity?: number;
  deliveryDays?: number;
  paymentTerms?: string;
  message?: string;
  justification?: string;
}

export interface SellerResponse {
  action: 'accept' | 'counter' | 'reject' | 'escalate';
  counterPrice?: number;
  counterTerms?: Partial<NegotiationTerms>;
  message: string;
  reasoning: string;
  requiresHumanApproval: boolean;
}

// ============================================================================
// NEGOTIATION SESSION MANAGEMENT
// ============================================================================

/**
 * Start a new negotiation session
 */
export async function startNegotiation(
  quoteId: string,
  initialBuyerOffer?: BuyerOffer
): Promise<NegotiationSession> {
  const quote = await getQuote(quoteId);
  if (!quote) {
    throw new Error('Quote not found');
  }

  const config = await getSellerConfig(quote.sellerId);
  if (!config) {
    throw new Error('Seller configuration not found');
  }

  // Calculate floor price based on minimum margin
  const { pricingStrategy, negotiationStyle } = config;
  const costEstimate = quote.total / (1 + quote.targetMargin / 100);
  const floorPrice = costEstimate * (1 + pricingStrategy.walkAwayMargin / 100);

  const sessionId = `neg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const session: NegotiationSession = {
    id: sessionId,
    quoteId,
    sellerId: quote.sellerId,
    buyerId: '', // Will be set from quote context

    initialSellerPrice: quote.total,
    initialBuyerOffer: initialBuyerOffer?.price,
    currentSellerPrice: quote.total,
    currentBuyerOffer: initialBuyerOffer?.price,

    status: 'active',
    round: 0,
    maxRounds: negotiationStyle.maxConcessions + 2,

    messages: [],

    sellerFloorPrice: floorPrice,
    sellerTargetPrice: quote.total,

    startedAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };

  // Add initial buyer offer if provided
  if (initialBuyerOffer) {
    session.messages.push({
      id: `msg_${Date.now()}`,
      round: 0,
      from: 'buyer_ai',
      type: 'offer',
      content: {
        price: initialBuyerOffer.price,
        message: initialBuyerOffer.message || `We'd like to offer $${initialBuyerOffer.price.toFixed(2)} for this order.`,
        reasoning: initialBuyerOffer.justification,
      },
      timestamp: new Date(),
    });
  }

  // Save session
  await saveNegotiationSession(session);

  // If there's an initial offer, process it
  if (initialBuyerOffer) {
    const response = await processOfferInternal(session, initialBuyerOffer, config);
    session.round = 1;
    session.lastActivityAt = new Date();

    session.messages.push({
      id: `msg_${Date.now()}`,
      round: 1,
      from: 'seller_ai',
      type: response.action === 'accept' ? 'accept' : response.action === 'counter' ? 'counter' : 'reject',
      content: {
        price: response.counterPrice,
        message: response.message,
        reasoning: response.reasoning,
      },
      timestamp: new Date(),
    });

    if (response.counterPrice) {
      session.currentSellerPrice = response.counterPrice;
    }

    if (response.action === 'accept') {
      session.status = 'seller_accepted';
      session.finalPrice = initialBuyerOffer.price;
      session.completedAt = new Date();
    } else if (response.action === 'escalate') {
      session.status = 'escalated';
      await notifySellerOfEscalation(config, session, initialBuyerOffer);
    }

    await updateNegotiationSession(session);
  }

  return session;
}

/**
 * Process a buyer offer and generate seller response
 */
export async function processBuyerOffer(
  sessionId: string,
  offer: BuyerOffer
): Promise<{ session: NegotiationSession; response: SellerResponse }> {
  const session = await getNegotiationSession(sessionId);
  if (!session) {
    throw new Error('Negotiation session not found');
  }

  if (session.status !== 'active') {
    throw new Error(`Negotiation is ${session.status}`);
  }

  const config = await getSellerConfig(session.sellerId);
  if (!config) {
    throw new Error('Seller configuration not found');
  }

  // Add buyer message
  session.round++;
  session.currentBuyerOffer = offer.price;
  session.lastActivityAt = new Date();

  session.messages.push({
    id: `msg_${Date.now()}`,
    round: session.round,
    from: 'buyer_ai',
    type: session.round === 1 && !session.initialBuyerOffer ? 'offer' : 'counter',
    content: {
      price: offer.price,
      message: offer.message || `Counter offer: $${offer.price.toFixed(2)}`,
      reasoning: offer.justification,
    },
    timestamp: new Date(),
  });

  // Process the offer
  const response = await processOfferInternal(session, offer, config);

  // Add seller response
  session.messages.push({
    id: `msg_${Date.now() + 1}`,
    round: session.round,
    from: 'seller_ai',
    type: response.action === 'accept' ? 'accept' : response.action === 'counter' ? 'counter' : 'reject',
    content: {
      price: response.counterPrice,
      terms: response.counterTerms,
      message: response.message,
      reasoning: response.reasoning,
    },
    timestamp: new Date(),
  });

  // Update session state
  if (response.counterPrice) {
    session.currentSellerPrice = response.counterPrice;
  }

  switch (response.action) {
    case 'accept':
      session.status = 'seller_accepted';
      session.finalPrice = offer.price;
      session.completedAt = new Date();
      break;
    case 'reject':
      session.status = 'no_deal';
      session.completedAt = new Date();
      break;
    case 'escalate':
      session.status = 'escalated';
      await notifySellerOfEscalation(config, session, offer);
      break;
  }

  // Check if max rounds reached
  if (session.round >= session.maxRounds && session.status === 'active') {
    session.status = 'escalated';
    await notifySellerOfEscalation(config, session, offer);
  }

  await updateNegotiationSession(session);

  return { session, response };
}

/**
 * Internal offer processing logic
 */
async function processOfferInternal(
  session: NegotiationSession,
  offer: BuyerOffer,
  config: SellerAIConfig
): Promise<SellerResponse> {
  const { negotiationStyle, pricingStrategy } = config;

  const priceGap = session.currentSellerPrice - offer.price;
  const gapPercent = (priceGap / session.currentSellerPrice) * 100;

  // Calculate margin at offered price
  const costEstimate = session.sellerTargetPrice / (1 + pricingStrategy.targetMargin / 100);
  const marginAtOffer = ((offer.price - costEstimate) / offer.price) * 100;

  // Decision logic based on negotiation style
  const decisions = await aiNegotiationDecision(session, offer, config, {
    priceGap,
    gapPercent,
    marginAtOffer,
    roundsRemaining: session.maxRounds - session.round,
  });

  // Accept if meets minimum margin
  if (marginAtOffer >= pricingStrategy.minMargin) {
    return {
      action: 'accept',
      message: decisions.acceptMessage || "We accept your offer. Let's finalize the deal!",
      reasoning: `Offer meets minimum margin requirement (${marginAtOffer.toFixed(1)}% >= ${pricingStrategy.minMargin}%)`,
      requiresHumanApproval: false,
    };
  }

  // Below walk-away threshold - escalate or reject
  if (marginAtOffer < pricingStrategy.walkAwayMargin) {
    if (session.round < 2) {
      // Early rounds - make a counter-offer
      const counterPrice = calculateCounterOffer(session, offer, config, decisions);
      return {
        action: 'counter',
        counterPrice,
        message: decisions.counterMessage || `We appreciate the offer, but we need $${counterPrice.toFixed(2)} to make this work.`,
        reasoning: `Offer margin (${marginAtOffer.toFixed(1)}%) is below walk-away threshold. Countering higher.`,
        requiresHumanApproval: false,
      };
    }

    // Later rounds - escalate to human
    return {
      action: 'escalate',
      message: "I need to check with my team on this one. I'll get back to you shortly.",
      reasoning: `Offer is below walk-away margin and we've had ${session.round} rounds. Escalating.`,
      requiresHumanApproval: true,
    };
  }

  // In the negotiation zone - calculate counter based on style
  const counterPrice = calculateCounterOffer(session, offer, config, decisions);

  // Check if counter is worthwhile (not too close to current offer)
  const counterGap = counterPrice - offer.price;
  if (counterGap < session.sellerTargetPrice * 0.01) {
    // Less than 1% difference - just accept
    return {
      action: 'accept',
      message: decisions.acceptMessage || "You drive a hard bargain! We have a deal.",
      reasoning: `Counter would be too close to offer. Accepting to close the deal.`,
      requiresHumanApproval: false,
    };
  }

  return {
    action: 'counter',
    counterPrice,
    message: decisions.counterMessage || `How about we meet at $${counterPrice.toFixed(2)}?`,
    reasoning: decisions.counterReasoning || `Countering based on ${negotiationStyle.aggression} strategy.`,
    requiresHumanApproval: false,
  };
}

/**
 * AI-powered negotiation decision making
 */
async function aiNegotiationDecision(
  session: NegotiationSession,
  offer: BuyerOffer,
  config: SellerAIConfig,
  context: {
    priceGap: number;
    gapPercent: number;
    marginAtOffer: number;
    roundsRemaining: number;
  }
): Promise<{
  acceptMessage?: string;
  counterMessage?: string;
  counterReasoning?: string;
  suggestedCounterPercent?: number;
}> {
  const { negotiationStyle, agentTone } = config;

  const prompt = `You are a ${agentTone} AI negotiating on behalf of a seller.

Current situation:
- Your asking price: $${session.currentSellerPrice.toFixed(2)}
- Buyer's offer: $${offer.price.toFixed(2)}
- Price gap: ${context.gapPercent.toFixed(1)}%
- Margin at buyer's price: ${context.marginAtOffer.toFixed(1)}%
- Minimum acceptable margin: ${config.pricingStrategy.minMargin}%
- Negotiation round: ${session.round} of ${session.maxRounds}
- Your style: ${negotiationStyle.aggression}

${offer.justification ? `Buyer's justification: "${offer.justification}"` : ''}

Generate appropriate responses. Return JSON:
{
  "acceptMessage": "message if accepting (${agentTone} tone)",
  "counterMessage": "message if countering (${agentTone} tone)",
  "counterReasoning": "internal reasoning for counter",
  "suggestedCounterPercent": number (what % of the gap to close, 0-100)
}

For ${negotiationStyle.aggression} style:
- conservative: close 20-30% of gap, hold firm
- balanced: close 40-50% of gap, be reasonable
- aggressive: close 60-70% of gap, push for deal`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || '{}');
  } catch {
    // Fallback values based on style
    const stylePercentages = {
      conservative: 25,
      balanced: 45,
      aggressive: 65,
    };

    return {
      acceptMessage: "Great, we have a deal!",
      counterMessage: "Let's find a middle ground that works for both of us.",
      counterReasoning: `Standard ${negotiationStyle.aggression} negotiation.`,
      suggestedCounterPercent: stylePercentages[negotiationStyle.aggression],
    };
  }
}

/**
 * Calculate counter-offer price
 */
function calculateCounterOffer(
  session: NegotiationSession,
  offer: BuyerOffer,
  config: SellerAIConfig,
  decisions: { suggestedCounterPercent?: number }
): number {
  const { negotiationStyle } = config;

  // Base concession percentages by style
  const baseConcession = {
    conservative: 20,
    balanced: 40,
    aggressive: 60,
  }[negotiationStyle.aggression];

  // Use AI suggestion if available, otherwise use base
  const concessionPercent = decisions.suggestedCounterPercent || baseConcession;

  // Calculate gap and apply concession
  const gap = session.currentSellerPrice - offer.price;
  const concession = gap * (concessionPercent / 100);
  const counterPrice = session.currentSellerPrice - concession;

  // Ensure we don't go below floor price
  return Math.max(counterPrice, session.sellerFloorPrice);
}

// ============================================================================
// SELLER MANUAL INTERVENTION
// ============================================================================

/**
 * Seller manually responds to negotiation
 */
export async function sellerManualResponse(
  sessionId: string,
  sellerId: string,
  response: {
    action: 'accept' | 'counter' | 'reject';
    counterPrice?: number;
    message?: string;
  }
): Promise<NegotiationSession> {
  const session = await getNegotiationSession(sessionId);
  if (!session || session.sellerId !== sellerId) {
    throw new Error('Session not found');
  }

  session.round++;
  session.lastActivityAt = new Date();

  session.messages.push({
    id: `msg_${Date.now()}`,
    round: session.round,
    from: 'seller',
    type: response.action === 'accept' ? 'accept' : response.action === 'counter' ? 'counter' : 'reject',
    content: {
      price: response.counterPrice,
      message: response.message || (
        response.action === 'accept' ? 'Deal accepted!' :
        response.action === 'reject' ? 'Sorry, we cannot proceed at this price.' :
        `Counter offer: $${response.counterPrice?.toFixed(2)}`
      ),
    },
    timestamp: new Date(),
  });

  switch (response.action) {
    case 'accept':
      session.status = 'seller_accepted';
      session.finalPrice = session.currentBuyerOffer;
      session.completedAt = new Date();
      break;
    case 'reject':
      session.status = 'no_deal';
      session.completedAt = new Date();
      break;
    case 'counter':
      if (response.counterPrice) {
        session.currentSellerPrice = response.counterPrice;
      }
      session.status = 'active';
      break;
  }

  await updateNegotiationSession(session);
  return session;
}

/**
 * Buyer accepts seller's counter-offer
 */
export async function buyerAcceptsCounter(
  sessionId: string
): Promise<NegotiationSession> {
  const session = await getNegotiationSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  session.status = 'buyer_accepted';
  session.finalPrice = session.currentSellerPrice;
  session.completedAt = new Date();
  session.lastActivityAt = new Date();

  session.messages.push({
    id: `msg_${Date.now()}`,
    round: session.round,
    from: 'buyer_ai',
    type: 'accept',
    content: {
      price: session.currentSellerPrice,
      message: 'We accept your offer!',
    },
    timestamp: new Date(),
  });

  await updateNegotiationSession(session);

  // Notify seller of successful deal
  const config = await getSellerConfig(session.sellerId);
  if (config) {
    await notifySellerOfDeal(config, session);
  }

  return session;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

async function notifySellerOfEscalation(
  config: SellerAIConfig,
  session: NegotiationSession,
  offer: BuyerOffer
): Promise<void> {
  const message = `Negotiation needs your input! ` +
    `Buyer offered $${offer.price.toFixed(2)} (your price: $${session.currentSellerPrice.toFixed(2)}). ` +
    `Reply: ACCEPT, COUNTER [amount], or REJECT`;

  if (config.notifications.sms && config.contactPhone) {
    await notify({
      type: 'sms',
      to: config.contactPhone,
      message,
    });
  }

  if (config.notifications.email) {
    await notify({
      type: 'email',
      to: config.contactEmail,
      subject: '[Wells] Negotiation Escalated - Your Input Needed',
      message,
    });
  }
}

async function notifySellerOfDeal(
  config: SellerAIConfig,
  session: NegotiationSession
): Promise<void> {
  const message = `Deal closed! Final price: $${session.finalPrice?.toFixed(2)}. ` +
    `Started at $${session.initialSellerPrice.toFixed(2)}.`;

  if (config.notifications.sms && config.contactPhone) {
    await notify({
      type: 'sms',
      to: config.contactPhone,
      message,
    });
  }

  if (config.notifications.email) {
    await notify({
      type: 'email',
      to: config.contactEmail,
      subject: '[Wells] Deal Closed!',
      message,
    });
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function saveNegotiationSession(session: NegotiationSession): Promise<void> {
  await sql`
    INSERT INTO seller_negotiations (
      id, quote_id, seller_id, buyer_id,
      initial_seller_price, initial_buyer_offer, current_seller_price, current_buyer_offer,
      status, round, max_rounds,
      messages,
      seller_floor_price, seller_target_price, buyer_ceiling_price,
      final_price, final_terms, deal_id,
      started_at, last_activity_at, expires_at, completed_at
    ) VALUES (
      ${session.id}, ${session.quoteId}, ${session.sellerId}, ${session.buyerId},
      ${session.initialSellerPrice}, ${session.initialBuyerOffer || null}, ${session.currentSellerPrice}, ${session.currentBuyerOffer || null},
      ${session.status}, ${session.round}, ${session.maxRounds},
      ${JSON.stringify(session.messages)},
      ${session.sellerFloorPrice}, ${session.sellerTargetPrice}, ${session.buyerCeilingPrice || null},
      ${session.finalPrice || null}, ${JSON.stringify(session.finalTerms || null)}, ${session.dealId || null},
      ${session.startedAt.toISOString()}, ${session.lastActivityAt.toISOString()}, ${session.expiresAt.toISOString()}, ${session.completedAt?.toISOString() || null}
    )
  `;
}

async function updateNegotiationSession(session: NegotiationSession): Promise<void> {
  await sql`
    UPDATE seller_negotiations SET
      current_seller_price = ${session.currentSellerPrice},
      current_buyer_offer = ${session.currentBuyerOffer || null},
      status = ${session.status},
      round = ${session.round},
      messages = ${JSON.stringify(session.messages)},
      final_price = ${session.finalPrice || null},
      final_terms = ${JSON.stringify(session.finalTerms || null)},
      deal_id = ${session.dealId || null},
      last_activity_at = ${session.lastActivityAt.toISOString()},
      completed_at = ${session.completedAt?.toISOString() || null}
    WHERE id = ${session.id}
  `;
}

export async function getNegotiationSession(sessionId: string): Promise<NegotiationSession | null> {
  const result = await sql`
    SELECT * FROM seller_negotiations WHERE id = ${sessionId}
  `;

  if (result.rows.length === 0) return null;
  return rowToSession(result.rows[0]);
}

export async function getSellerNegotiations(
  sellerId: string,
  options?: { status?: NegotiationSession['status']; limit?: number }
): Promise<NegotiationSession[]> {
  let result;

  if (options?.status) {
    result = await sql`
      SELECT * FROM seller_negotiations
      WHERE seller_id = ${sellerId} AND status = ${options.status}
      ORDER BY last_activity_at DESC
      LIMIT ${options.limit || 50}
    `;
  } else {
    result = await sql`
      SELECT * FROM seller_negotiations
      WHERE seller_id = ${sellerId}
      ORDER BY last_activity_at DESC
      LIMIT ${options?.limit || 50}
    `;
  }

  return result.rows.map(rowToSession);
}

function rowToSession(row: Record<string, unknown>): NegotiationSession {
  return {
    id: row.id as string,
    quoteId: row.quote_id as string,
    sellerId: row.seller_id as string,
    buyerId: row.buyer_id as string,
    initialSellerPrice: parseFloat(row.initial_seller_price as string) || 0,
    initialBuyerOffer: row.initial_buyer_offer ? parseFloat(row.initial_buyer_offer as string) : undefined,
    currentSellerPrice: parseFloat(row.current_seller_price as string) || 0,
    currentBuyerOffer: row.current_buyer_offer ? parseFloat(row.current_buyer_offer as string) : undefined,
    status: row.status as NegotiationSession['status'],
    round: row.round as number,
    maxRounds: row.max_rounds as number,
    messages: parseJson(row.messages) || [],
    sellerFloorPrice: parseFloat(row.seller_floor_price as string) || 0,
    sellerTargetPrice: parseFloat(row.seller_target_price as string) || 0,
    buyerCeilingPrice: row.buyer_ceiling_price ? parseFloat(row.buyer_ceiling_price as string) : undefined,
    finalPrice: row.final_price ? parseFloat(row.final_price as string) : undefined,
    finalTerms: parseJson(row.final_terms) || undefined,
    dealId: row.deal_id as string | undefined,
    startedAt: new Date(row.started_at as string),
    lastActivityAt: new Date(row.last_activity_at as string),
    expiresAt: new Date(row.expires_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
  };
}

function parseJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SellerNegotiationAgent = {
  startNegotiation,
  processBuyerOffer,
  sellerManualResponse,
  buyerAcceptsCounter,
  getNegotiationSession,
  getSellerNegotiations,
};

export default SellerNegotiationAgent;
