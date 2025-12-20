/**
 * RFQ Quote Service
 * Handles quote creation (manual and AI-generated), retrieval, comparison,
 * status updates, and quote details for buyer transactions.
 */

import { sql } from '@vercel/postgres';
import {
  RFQQuote,
  CreateQuoteInput,
  QuoteStatus,
  QuoteComparison,
  RFQConstraints,
  LineItem,
} from './types';

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const LOG_PREFIX = '[QuoteService]';

function logInfo(message: string, data?: Record<string, unknown>): void {
  console.log(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data) : '');
}

function logError(message: string, error: unknown, data?: Record<string, unknown>): void {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    ...data,
  });
}

function logWarn(message: string, data?: Record<string, unknown>): void {
  console.warn(`${LOG_PREFIX} WARN: ${message}`, data ? JSON.stringify(data) : '');
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class QuoteServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QuoteServiceError';
  }
}

export class QuoteNotFoundError extends QuoteServiceError {
  constructor(quoteId: string) {
    super(`Quote not found: ${quoteId}`, 'QUOTE_NOT_FOUND', 404, { quoteId });
  }
}

export class QuoteValidationError extends QuoteServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUOTE_VALIDATION_ERROR', 400, details);
  }
}

export class QuoteStatusError extends QuoteServiceError {
  constructor(message: string, currentStatus: QuoteStatus, attemptedStatus: QuoteStatus) {
    super(message, 'QUOTE_STATUS_ERROR', 409, { currentStatus, attemptedStatus });
  }
}

// ============================================================================
// QUOTE CREATION
// ============================================================================

/**
 * Create a new quote for an RFQ (manual or AI-generated)
 */
export async function createQuote(input: CreateQuoteInput): Promise<RFQQuote> {
  logInfo('Creating quote', { rfqId: input.rfqId, supplierId: input.supplierId, aiGenerated: input.aiGenerated });

  try {
    // Validate required fields
    if (!input.rfqId || !input.supplierId) {
      throw new QuoteValidationError('rfqId and supplierId are required');
    }

    if (input.unitPrice <= 0) {
      throw new QuoteValidationError('unitPrice must be greater than 0', { unitPrice: input.unitPrice });
    }

    if (input.quantity <= 0) {
      throw new QuoteValidationError('quantity must be greater than 0', { quantity: input.quantity });
    }

    // Calculate total price
    const totalPrice = input.unitPrice * input.quantity + (input.shippingCost || 0);

    // Determine negotiation round based on parent quote
    const negotiationRound = input.parentQuoteId ? 1 : 0;
    const isInitialQuote = !input.parentQuoteId;

    const result = await sql`
      INSERT INTO rfq_quotes (
        rfq_id,
        supplier_id,
        unit_price,
        quantity,
        total_price,
        lead_time_days,
        payment_terms,
        warranty_months,
        shipping_cost,
        shipping_method,
        valid_until,
        notes,
        line_items,
        ai_generated,
        ai_confidence_score,
        source_catalog_id,
        parent_quote_id,
        negotiation_round,
        is_initial_quote,
        status
      ) VALUES (
        ${input.rfqId},
        ${input.supplierId},
        ${input.unitPrice},
        ${input.quantity},
        ${totalPrice},
        ${input.leadTimeDays},
        ${input.paymentTerms || null},
        ${input.warrantyMonths || null},
        ${input.shippingCost || 0},
        ${input.shippingMethod || null},
        ${input.validUntil ? new Date(input.validUntil).toISOString() : null},
        ${input.notes || null},
        ${JSON.stringify(input.lineItems || [])},
        ${input.aiGenerated || false},
        ${input.aiConfidenceScore || null},
        ${input.sourceCatalogId || null},
        ${input.parentQuoteId || null},
        ${negotiationRound},
        ${isInitialQuote},
        'pending'
      )
      RETURNING *
    `;

    if (result.rows.length === 0) {
      throw new QuoteServiceError('Failed to create quote', 'CREATE_FAILED');
    }

    // Update RFQ status to quoting if still in open/matched state
    await sql`
      UPDATE rfqs
      SET status = 'quoting', updated_at = NOW()
      WHERE id = ${input.rfqId} AND status IN ('open', 'matched')
    `;

    const quote = mapQuoteRow(result.rows[0]);
    logInfo('Quote created successfully', { quoteId: quote.id, totalPrice: quote.totalPrice });

    return quote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to create quote', error, { input });
    throw new QuoteServiceError(
      'Failed to create quote',
      'CREATE_ERROR',
      500,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Create an AI-generated quote from supplier catalog
 */
export async function createAIQuote(
  rfqId: string,
  supplierId: string,
  catalogId: string,
  quantity: number,
  confidenceScore: number,
  overrides?: Partial<CreateQuoteInput>
): Promise<RFQQuote> {
  logInfo('Creating AI-generated quote', { rfqId, supplierId, catalogId, quantity, confidenceScore });

  try {
    // Fetch catalog item for pricing
    const catalogResult = await sql`
      SELECT * FROM supplier_catalog
      WHERE id = ${catalogId} AND supplier_id = ${supplierId} AND active = true
    `;

    if (catalogResult.rows.length === 0) {
      throw new QuoteValidationError('Catalog item not found or inactive', { catalogId, supplierId });
    }

    const catalog = catalogResult.rows[0];

    // Check minimum order quantity
    if (quantity < catalog.minimum_order_qty) {
      throw new QuoteValidationError(
        `Quantity ${quantity} is below minimum order quantity ${catalog.minimum_order_qty}`,
        { quantity, minimumOrderQty: catalog.minimum_order_qty }
      );
    }

    // Calculate price with volume discounts
    let unitPrice = parseFloat(catalog.base_unit_price);
    const volumeDiscounts = catalog.volume_discounts || [];

    for (const discount of volumeDiscounts) {
      if (quantity >= discount.minQuantity && (!discount.maxQuantity || quantity <= discount.maxQuantity)) {
        unitPrice = unitPrice * (1 - discount.discountPercentage / 100);
        break;
      }
    }

    // Create the quote
    return createQuote({
      rfqId,
      supplierId,
      unitPrice,
      quantity,
      leadTimeDays: catalog.standard_lead_time_days,
      paymentTerms: catalog.default_payment_terms || undefined,
      warrantyMonths: catalog.warranty_months || undefined,
      aiGenerated: true,
      aiConfidenceScore: confidenceScore,
      sourceCatalogId: catalogId,
      ...overrides,
    });
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to create AI quote', error, { rfqId, supplierId, catalogId });
    throw new QuoteServiceError(
      'Failed to create AI-generated quote',
      'AI_QUOTE_ERROR',
      500,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// QUOTE RETRIEVAL
// ============================================================================

/**
 * Get a quote by ID with full details
 */
export async function getQuoteById(quoteId: string): Promise<RFQQuote | null> {
  logInfo('Fetching quote by ID', { quoteId });

  try {
    const result = await sql`
      SELECT
        q.*,
        s.company_name,
        s.contact_email
      FROM rfq_quotes q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.id = ${quoteId}
    `;

    if (result.rows.length === 0) {
      logWarn('Quote not found', { quoteId });
      return null;
    }

    return mapQuoteRow(result.rows[0]);
  } catch (error) {
    logError('Failed to fetch quote', error, { quoteId });
    throw new QuoteServiceError(
      'Failed to fetch quote',
      'FETCH_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get quote details with negotiation history
 */
export async function getQuoteDetails(quoteId: string): Promise<{
  quote: RFQQuote;
  history: RFQQuote[];
  negotiation?: {
    id: string;
    status: string;
    currentRound: number;
    maxRounds: number;
  };
}> {
  logInfo('Fetching quote details', { quoteId });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    // Get negotiation history (all quotes in the chain)
    const historyResult = await sql`
      WITH RECURSIVE quote_chain AS (
        -- Start with the initial quote
        SELECT q.*, 0 as depth
        FROM rfq_quotes q
        WHERE q.id = ${quote.isInitialQuote ? quoteId : quote.parentQuoteId || quoteId}

        UNION ALL

        -- Get all child quotes
        SELECT q.*, qc.depth + 1
        FROM rfq_quotes q
        INNER JOIN quote_chain qc ON q.parent_quote_id = qc.id
      )
      SELECT qc.*, s.company_name, s.contact_email
      FROM quote_chain qc
      LEFT JOIN suppliers s ON qc.supplier_id = s.id
      ORDER BY qc.depth ASC, qc.created_at ASC
    `;

    const history = historyResult.rows.map(mapQuoteRow);

    // Get associated negotiation if any
    const negotiationResult = await sql`
      SELECT id, status, current_round, max_rounds
      FROM rfq_negotiations
      WHERE quote_id = ${quoteId} OR quote_id IN (
        SELECT id FROM rfq_quotes WHERE parent_quote_id = ${quoteId}
      )
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const negotiation = negotiationResult.rows.length > 0
      ? {
          id: negotiationResult.rows[0].id,
          status: negotiationResult.rows[0].status,
          currentRound: negotiationResult.rows[0].current_round,
          maxRounds: negotiationResult.rows[0].max_rounds,
        }
      : undefined;

    return { quote, history, negotiation };
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to fetch quote details', error, { quoteId });
    throw new QuoteServiceError(
      'Failed to fetch quote details',
      'DETAILS_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get all quotes for an RFQ
 */
export async function getQuotesByRFQ(rfqId: string): Promise<RFQQuote[]> {
  logInfo('Fetching quotes for RFQ', { rfqId });

  try {
    const result = await sql`
      SELECT
        q.*,
        s.company_name,
        s.contact_email
      FROM rfq_quotes q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.rfq_id = ${rfqId}
      ORDER BY q.total_price ASC, q.lead_time_days ASC
    `;

    logInfo('Found quotes for RFQ', { rfqId, count: result.rows.length });
    return result.rows.map(mapQuoteRow);
  } catch (error) {
    logError('Failed to fetch quotes for RFQ', error, { rfqId });
    throw new QuoteServiceError(
      'Failed to fetch quotes for RFQ',
      'FETCH_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get active quotes for an RFQ (excludes rejected, expired, withdrawn)
 */
export async function getActiveQuotesByRFQ(rfqId: string): Promise<RFQQuote[]> {
  logInfo('Fetching active quotes for RFQ', { rfqId });

  try {
    const result = await sql`
      SELECT
        q.*,
        s.company_name,
        s.contact_email
      FROM rfq_quotes q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.rfq_id = ${rfqId}
        AND q.status NOT IN ('rejected', 'expired', 'withdrawn')
      ORDER BY q.total_price ASC, q.lead_time_days ASC
    `;

    logInfo('Found active quotes for RFQ', { rfqId, count: result.rows.length });
    return result.rows.map(mapQuoteRow);
  } catch (error) {
    logError('Failed to fetch active quotes for RFQ', error, { rfqId });
    throw new QuoteServiceError(
      'Failed to fetch active quotes',
      'FETCH_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get the latest quote in a negotiation chain for a supplier
 */
export async function getLatestNegotiatedQuote(
  rfqId: string,
  supplierId: string
): Promise<RFQQuote | null> {
  logInfo('Fetching latest negotiated quote', { rfqId, supplierId });

  try {
    const result = await sql`
      SELECT
        q.*,
        s.company_name,
        s.contact_email
      FROM rfq_quotes q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.rfq_id = ${rfqId}
        AND q.supplier_id = ${supplierId}
      ORDER BY q.negotiation_round DESC, q.created_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapQuoteRow(result.rows[0]);
  } catch (error) {
    logError('Failed to fetch latest negotiated quote', error, { rfqId, supplierId });
    throw new QuoteServiceError(
      'Failed to fetch latest negotiated quote',
      'FETCH_ERROR',
      500,
      { rfqId, supplierId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get quotes by supplier across all RFQs
 */
export async function getQuotesBySupplier(
  supplierId: string,
  options?: { status?: QuoteStatus; limit?: number; offset?: number }
): Promise<{ quotes: RFQQuote[]; total: number }> {
  logInfo('Fetching quotes by supplier', { supplierId, options });

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM rfq_quotes
      WHERE supplier_id = ${supplierId}
        ${options?.status ? sql`AND status = ${options.status}` : sql``}
    `;

    const result = await sql`
      SELECT
        q.*,
        s.company_name,
        s.contact_email
      FROM rfq_quotes q
      LEFT JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.supplier_id = ${supplierId}
        ${options?.status ? sql`AND q.status = ${options.status}` : sql``}
      ORDER BY q.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      quotes: result.rows.map(mapQuoteRow),
      total: parseInt(countResult.rows[0].total, 10),
    };
  } catch (error) {
    logError('Failed to fetch quotes by supplier', error, { supplierId, options });
    throw new QuoteServiceError(
      'Failed to fetch quotes by supplier',
      'FETCH_ERROR',
      500,
      { supplierId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// QUOTE COMPARISON
// ============================================================================

/**
 * Compare all quotes for an RFQ against buyer constraints
 */
export async function compareQuotes(
  rfqId: string,
  constraints?: RFQConstraints
): Promise<QuoteComparison> {
  logInfo('Comparing quotes for RFQ', { rfqId, hasConstraints: !!constraints });

  try {
    const quotes = await getActiveQuotesByRFQ(rfqId);

    if (quotes.length === 0) {
      logWarn('No active quotes to compare', { rfqId });
      return {
        rfqId,
        quotes: [],
        constraints,
        analysis: {
          lowestPrice: { quoteId: '', totalPrice: 0 },
          fastestDelivery: { quoteId: '', leadTimeDays: 0 },
          bestValue: { quoteId: '', score: 0, reason: 'No quotes available' },
        },
      };
    }

    // Find lowest price quote
    const lowestPrice = quotes.reduce((min, q) =>
      q.totalPrice < min.totalPrice ? q : min
    );

    // Find fastest delivery quote
    const fastestDelivery = quotes.reduce((min, q) =>
      q.leadTimeDays < min.leadTimeDays ? q : min
    );

    // Calculate value scores for all quotes
    const scoredQuotes = quotes.map((quote) => ({
      quote,
      score: calculateValueScore(quote, constraints),
    }));

    // Find best value quote
    const bestValue = scoredQuotes.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // Generate recommendation
    const recommendation = generateRecommendation(scoredQuotes, constraints);

    const comparison: QuoteComparison = {
      rfqId,
      quotes,
      constraints,
      recommendation,
      analysis: {
        lowestPrice: {
          quoteId: lowestPrice.id,
          totalPrice: lowestPrice.totalPrice,
        },
        fastestDelivery: {
          quoteId: fastestDelivery.id,
          leadTimeDays: fastestDelivery.leadTimeDays,
        },
        bestValue: {
          quoteId: bestValue.quote.id,
          score: bestValue.score,
          reason: generateValueReason(bestValue.quote, constraints),
        },
      },
    };

    logInfo('Quote comparison complete', {
      rfqId,
      quoteCount: quotes.length,
      bestValueScore: bestValue.score,
    });

    return comparison;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to compare quotes', error, { rfqId });
    throw new QuoteServiceError(
      'Failed to compare quotes',
      'COMPARE_ERROR',
      500,
      { rfqId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get a side-by-side comparison of specific quotes
 */
export async function compareSpecificQuotes(quoteIds: string[]): Promise<{
  quotes: RFQQuote[];
  comparison: {
    field: string;
    values: { quoteId: string; value: string | number; isBest: boolean }[];
  }[];
}> {
  logInfo('Comparing specific quotes', { quoteIds });

  try {
    if (quoteIds.length < 2) {
      throw new QuoteValidationError('At least 2 quotes are required for comparison');
    }

    const quotes: RFQQuote[] = [];
    for (const quoteId of quoteIds) {
      const quote = await getQuoteById(quoteId);
      if (!quote) {
        throw new QuoteNotFoundError(quoteId);
      }
      quotes.push(quote);
    }

    // Build comparison matrix
    const comparison = [
      {
        field: 'Total Price',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.totalPrice,
          isBest: q.totalPrice === Math.min(...quotes.map((x) => x.totalPrice)),
        })),
      },
      {
        field: 'Unit Price',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.unitPrice,
          isBest: q.unitPrice === Math.min(...quotes.map((x) => x.unitPrice)),
        })),
      },
      {
        field: 'Lead Time (Days)',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.leadTimeDays,
          isBest: q.leadTimeDays === Math.min(...quotes.map((x) => x.leadTimeDays)),
        })),
      },
      {
        field: 'Warranty (Months)',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.warrantyMonths || 0,
          isBest: (q.warrantyMonths || 0) === Math.max(...quotes.map((x) => x.warrantyMonths || 0)),
        })),
      },
      {
        field: 'Shipping Cost',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.shippingCost,
          isBest: q.shippingCost === Math.min(...quotes.map((x) => x.shippingCost)),
        })),
      },
      {
        field: 'Payment Terms',
        values: quotes.map((q) => ({
          quoteId: q.id,
          value: q.paymentTerms || 'N/A',
          isBest: false,
        })),
      },
    ];

    return { quotes, comparison };
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to compare specific quotes', error, { quoteIds });
    throw new QuoteServiceError(
      'Failed to compare quotes',
      'COMPARE_ERROR',
      500,
      { quoteIds, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// QUOTE STATUS UPDATES
// ============================================================================

/**
 * Update quote status
 */
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus
): Promise<RFQQuote> {
  logInfo('Updating quote status', { quoteId, status });

  try {
    // Verify quote exists
    const existing = await getQuoteById(quoteId);
    if (!existing) {
      throw new QuoteNotFoundError(quoteId);
    }

    // Validate status transition
    validateStatusTransition(existing.status, status);

    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = ${status},
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    const quote = mapQuoteRow(result.rows[0]);
    logInfo('Quote status updated', { quoteId, oldStatus: existing.status, newStatus: status });

    return quote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to update quote status', error, { quoteId, status });
    throw new QuoteServiceError(
      'Failed to update quote status',
      'STATUS_UPDATE_ERROR',
      500,
      { quoteId, status, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Accept a quote (rejects all other quotes for the RFQ)
 */
export async function acceptQuote(quoteId: string): Promise<RFQQuote> {
  logInfo('Accepting quote', { quoteId });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    // Validate current status allows acceptance
    if (!['pending', 'active', 'negotiating'].includes(quote.status)) {
      throw new QuoteStatusError(
        `Cannot accept quote with status '${quote.status}'`,
        quote.status,
        'accepted'
      );
    }

    // Reject all other active quotes for this RFQ
    await sql`
      UPDATE rfq_quotes
      SET
        status = 'rejected',
        updated_at = NOW()
      WHERE rfq_id = ${quote.rfqId}
        AND id != ${quoteId}
        AND status NOT IN ('rejected', 'expired', 'withdrawn')
    `;

    // Accept this quote
    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = 'accepted',
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    // Update RFQ status to awarded
    await sql`
      UPDATE rfqs
      SET
        status = 'awarded',
        updated_at = NOW()
      WHERE id = ${quote.rfqId}
    `;

    const acceptedQuote = mapQuoteRow(result.rows[0]);
    logInfo('Quote accepted successfully', { quoteId, rfqId: quote.rfqId });

    return acceptedQuote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to accept quote', error, { quoteId });
    throw new QuoteServiceError(
      'Failed to accept quote',
      'ACCEPT_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Reject a quote
 */
export async function rejectQuote(quoteId: string, reason?: string): Promise<RFQQuote> {
  logInfo('Rejecting quote', { quoteId, reason });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (['accepted', 'rejected', 'expired', 'withdrawn'].includes(quote.status)) {
      throw new QuoteStatusError(
        `Cannot reject quote with status '${quote.status}'`,
        quote.status,
        'rejected'
      );
    }

    const notes = reason
      ? `${quote.notes || ''}\n[REJECTED: ${reason}]`.trim()
      : quote.notes;

    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = 'rejected',
        notes = ${notes},
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    const rejectedQuote = mapQuoteRow(result.rows[0]);
    logInfo('Quote rejected', { quoteId, reason });

    return rejectedQuote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to reject quote', error, { quoteId, reason });
    throw new QuoteServiceError(
      'Failed to reject quote',
      'REJECT_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Expire a quote (or batch expire old quotes)
 */
export async function expireQuote(quoteId: string): Promise<RFQQuote> {
  logInfo('Expiring quote', { quoteId });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (['accepted', 'rejected', 'expired', 'withdrawn'].includes(quote.status)) {
      throw new QuoteStatusError(
        `Cannot expire quote with status '${quote.status}'`,
        quote.status,
        'expired'
      );
    }

    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    const expiredQuote = mapQuoteRow(result.rows[0]);
    logInfo('Quote expired', { quoteId });

    return expiredQuote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to expire quote', error, { quoteId });
    throw new QuoteServiceError(
      'Failed to expire quote',
      'EXPIRE_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Batch expire quotes that have passed their valid_until date
 */
export async function expireOldQuotes(): Promise<{ expiredCount: number; expiredIds: string[] }> {
  logInfo('Running batch quote expiration');

  try {
    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = 'expired',
        updated_at = NOW()
      WHERE status IN ('pending', 'active')
        AND valid_until IS NOT NULL
        AND valid_until < NOW()
      RETURNING id
    `;

    const expiredIds = result.rows.map((r) => r.id);
    logInfo('Batch quote expiration complete', { expiredCount: expiredIds.length });

    return { expiredCount: expiredIds.length, expiredIds };
  } catch (error) {
    logError('Failed to batch expire quotes', error);
    throw new QuoteServiceError(
      'Failed to expire old quotes',
      'BATCH_EXPIRE_ERROR',
      500,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Supplier confirms their quote
 */
export async function confirmQuote(quoteId: string): Promise<RFQQuote> {
  logInfo('Supplier confirming quote', { quoteId });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (quote.supplierConfirmed) {
      logWarn('Quote already confirmed', { quoteId });
      return quote;
    }

    const result = await sql`
      UPDATE rfq_quotes
      SET
        supplier_confirmed = true,
        supplier_confirmed_at = NOW(),
        status = 'active',
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    const confirmedQuote = mapQuoteRow(result.rows[0]);
    logInfo('Quote confirmed by supplier', { quoteId });

    return confirmedQuote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to confirm quote', error, { quoteId });
    throw new QuoteServiceError(
      'Failed to confirm quote',
      'CONFIRM_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Supplier withdraws their quote
 */
export async function withdrawQuote(quoteId: string, reason?: string): Promise<RFQQuote> {
  logInfo('Withdrawing quote', { quoteId, reason });

  try {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (['accepted', 'rejected', 'expired', 'withdrawn'].includes(quote.status)) {
      throw new QuoteStatusError(
        `Cannot withdraw quote with status '${quote.status}'`,
        quote.status,
        'withdrawn'
      );
    }

    const notes = reason
      ? `${quote.notes || ''}\n[WITHDRAWN: ${reason}]`.trim()
      : quote.notes;

    const result = await sql`
      UPDATE rfq_quotes
      SET
        status = 'withdrawn',
        notes = ${notes},
        updated_at = NOW()
      WHERE id = ${quoteId}
      RETURNING *
    `;

    const withdrawnQuote = mapQuoteRow(result.rows[0]);
    logInfo('Quote withdrawn', { quoteId, reason });

    return withdrawnQuote;
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to withdraw quote', error, { quoteId, reason });
    throw new QuoteServiceError(
      'Failed to withdraw quote',
      'WITHDRAW_ERROR',
      500,
      { quoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Create a counter-offer quote (for negotiation)
 */
export async function createCounterOffer(
  parentQuoteId: string,
  newTerms: {
    unitPrice: number;
    leadTimeDays?: number;
    paymentTerms?: string;
    warrantyMonths?: number;
    shippingCost?: number;
    notes?: string;
  }
): Promise<RFQQuote> {
  logInfo('Creating counter-offer', { parentQuoteId, newTerms });

  try {
    const parent = await getQuoteById(parentQuoteId);
    if (!parent) {
      throw new QuoteNotFoundError(parentQuoteId);
    }

    // Update parent quote status to indicate it's been countered
    await sql`
      UPDATE rfq_quotes
      SET
        status = 'negotiating',
        updated_at = NOW()
      WHERE id = ${parentQuoteId}
    `;

    // Create the counter-offer
    return createQuote({
      rfqId: parent.rfqId,
      supplierId: parent.supplierId,
      unitPrice: newTerms.unitPrice,
      quantity: parent.quantity,
      leadTimeDays: newTerms.leadTimeDays ?? parent.leadTimeDays,
      paymentTerms: newTerms.paymentTerms ?? parent.paymentTerms,
      warrantyMonths: newTerms.warrantyMonths ?? parent.warrantyMonths,
      shippingCost: newTerms.shippingCost ?? parent.shippingCost,
      shippingMethod: parent.shippingMethod,
      notes: newTerms.notes,
      parentQuoteId: parentQuoteId,
      aiGenerated: true,
    });
  } catch (error) {
    if (error instanceof QuoteServiceError) {
      throw error;
    }
    logError('Failed to create counter-offer', error, { parentQuoteId, newTerms });
    throw new QuoteServiceError(
      'Failed to create counter-offer',
      'COUNTER_OFFER_ERROR',
      500,
      { parentQuoteId, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database row to RFQQuote type
 */
function mapQuoteRow(row: Record<string, unknown>): RFQQuote {
  return {
    id: row.id as string,
    rfqId: row.rfq_id as string,
    supplierId: row.supplier_id as string,
    unitPrice: parseFloat(row.unit_price as string),
    quantity: row.quantity as number,
    totalPrice: parseFloat(row.total_price as string),
    currency: (row.currency as string) || 'USD',
    leadTimeDays: row.lead_time_days as number,
    paymentTerms: row.payment_terms as string | undefined,
    warrantyMonths: row.warranty_months as number | undefined,
    shippingCost: parseFloat((row.shipping_cost as string) || '0'),
    shippingMethod: row.shipping_method as string | undefined,
    validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
    notes: row.notes as string | undefined,
    lineItems: (row.line_items as LineItem[]) || [],
    aiGenerated: row.ai_generated as boolean,
    aiConfidenceScore: row.ai_confidence_score
      ? parseFloat(row.ai_confidence_score as string)
      : undefined,
    sourceCatalogId: row.source_catalog_id as string | undefined,
    isInitialQuote: row.is_initial_quote as boolean,
    parentQuoteId: row.parent_quote_id as string | undefined,
    negotiationRound: row.negotiation_round as number,
    status: row.status as QuoteStatus,
    supplierConfirmed: row.supplier_confirmed as boolean,
    supplierConfirmedAt: row.supplier_confirmed_at
      ? new Date(row.supplier_confirmed_at as string)
      : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    supplier: row.company_name
      ? {
          id: row.supplier_id as string,
          companyName: row.company_name as string,
          contactEmail: row.contact_email as string,
        }
      : undefined,
  };
}

/**
 * Validate status transitions
 */
function validateStatusTransition(currentStatus: QuoteStatus, newStatus: QuoteStatus): void {
  const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
    pending: ['active', 'rejected', 'expired', 'withdrawn', 'negotiating'],
    active: ['accepted', 'rejected', 'expired', 'withdrawn', 'negotiating'],
    negotiating: ['accepted', 'rejected', 'expired', 'withdrawn', 'active'],
    accepted: [], // Terminal state
    rejected: [], // Terminal state
    expired: [], // Terminal state
    withdrawn: [], // Terminal state
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new QuoteStatusError(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
      currentStatus,
      newStatus
    );
  }
}

/**
 * Calculate value score for a quote (0-100)
 */
function calculateValueScore(quote: RFQQuote, constraints?: RFQConstraints): number {
  let score = 50; // Base score

  if (!constraints) return score;

  // Price scoring (40 points max)
  if (constraints.targetTotalPrice) {
    const priceRatio = quote.totalPrice / constraints.targetTotalPrice;
    if (priceRatio <= 0.9) score += 40;
    else if (priceRatio <= 1.0) score += 30;
    else if (priceRatio <= 1.1) score += 15;
    else if (priceRatio <= 1.2) score += 5;
  } else if (constraints.maxTotalBudget) {
    if (quote.totalPrice <= constraints.maxTotalBudget) {
      const savings =
        (constraints.maxTotalBudget - quote.totalPrice) / constraints.maxTotalBudget;
      score += Math.min(40, savings * 100);
    }
  }

  // Lead time scoring (30 points max)
  if (constraints.preferredLeadTimeDays) {
    if (quote.leadTimeDays <= constraints.preferredLeadTimeDays) {
      score += 30;
    } else if (
      constraints.maxLeadTimeDays &&
      quote.leadTimeDays <= constraints.maxLeadTimeDays
    ) {
      const ratio =
        (constraints.maxLeadTimeDays - quote.leadTimeDays) /
        (constraints.maxLeadTimeDays - constraints.preferredLeadTimeDays);
      score += 15 + ratio * 15;
    }
  } else if (constraints.maxLeadTimeDays) {
    if (quote.leadTimeDays <= constraints.maxLeadTimeDays) {
      score += 20;
    }
  }

  // Warranty scoring (15 points max)
  if (constraints.minimumWarrantyMonths && quote.warrantyMonths) {
    if (quote.warrantyMonths >= constraints.minimumWarrantyMonths) {
      score += 10;
      const extraMonths = quote.warrantyMonths - constraints.minimumWarrantyMonths;
      score += Math.min(5, extraMonths);
    }
  }

  // Payment terms scoring (15 points max)
  if (constraints.preferredPaymentTerms && quote.paymentTerms) {
    if (quote.paymentTerms === constraints.preferredPaymentTerms) {
      score += 15;
    } else if (constraints.acceptablePaymentTerms.includes(quote.paymentTerms)) {
      score += 10;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Generate recommendation based on scored quotes
 */
function generateRecommendation(
  scoredQuotes: { quote: RFQQuote; score: number }[],
  constraints?: RFQConstraints
): { quoteId: string; reason: string; score: number } | undefined {
  if (scoredQuotes.length === 0) return undefined;

  const best = scoredQuotes.reduce((a, b) => (a.score > b.score ? a : b));

  if (best.score < 30) {
    return {
      quoteId: best.quote.id,
      reason:
        'Best available option, but none meet all requirements. Consider negotiating.',
      score: best.score,
    };
  }

  return {
    quoteId: best.quote.id,
    reason: generateValueReason(best.quote, constraints),
    score: best.score,
  };
}

/**
 * Generate explanation for why a quote is good value
 */
function generateValueReason(quote: RFQQuote, constraints?: RFQConstraints): string {
  const reasons: string[] = [];

  if (constraints?.targetTotalPrice && quote.totalPrice <= constraints.targetTotalPrice) {
    const savings = constraints.targetTotalPrice - quote.totalPrice;
    reasons.push(`$${savings.toFixed(2)} under target price`);
  }

  if (
    constraints?.preferredLeadTimeDays &&
    quote.leadTimeDays <= constraints.preferredLeadTimeDays
  ) {
    reasons.push(`Meets ${quote.leadTimeDays}-day delivery requirement`);
  }

  if (
    quote.warrantyMonths &&
    constraints?.minimumWarrantyMonths &&
    quote.warrantyMonths >= constraints.minimumWarrantyMonths
  ) {
    reasons.push(`${quote.warrantyMonths}-month warranty included`);
  }

  if (reasons.length === 0) {
    return 'Competitive pricing with acceptable terms';
  }

  return reasons.join('. ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Creation
  createQuote,
  createAIQuote,
  createCounterOffer,

  // Retrieval
  getQuoteById,
  getQuoteDetails,
  getQuotesByRFQ,
  getActiveQuotesByRFQ,
  getLatestNegotiatedQuote,
  getQuotesBySupplier,

  // Comparison
  compareQuotes,
  compareSpecificQuotes,

  // Status updates
  updateQuoteStatus,
  acceptQuote,
  rejectQuote,
  expireQuote,
  expireOldQuotes,
  confirmQuote,
  withdrawQuote,
};
