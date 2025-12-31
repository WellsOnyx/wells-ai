/**
 * Wells AI Matching Engine Core
 *
 * The intelligence that connects buyers with suppliers and earns the 1% sourcing fee.
 *
 * Key functions:
 * - findMatchesForRequest: Find suppliers for a buyer request
 * - findOpportunitiesForSupplier: Find buyer requests for a supplier
 * - calculateMatchScore: Score with detailed breakdown
 *
 * This engine:
 * - Runs automatically when new requests come in
 * - Runs automatically when new suppliers join
 * - Can be manually triggered for re-matching
 * - Prioritizes GRAIN-enabled suppliers (our moat)
 * - Tracks success rate to improve over time
 */

import { sql } from '@vercel/postgres';
import {
  SourcingRequest,
  SupplierProfile,
  SourcingMatch,
  MatchScoreBreakdown,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  MatchRequest,
  MatchResponse,
  OpportunityRequest,
  OpportunityResponse,
  MatchStatus,
  RequestStatus,
} from './types';
import { calculateMatchScore, getMatchQuality, getCategoryWeights } from './scoring';
import { parseNaturalLanguageRequest, explainMatch } from './ai-assist';

// ============================================================================
// MAIN MATCHING FUNCTIONS
// ============================================================================

/**
 * Find matching suppliers for a sourcing request
 * This is the main entry point for buyer-initiated matching
 */
export async function findMatchesForRequest(
  sourcingRequestId: string,
  options: {
    maxResults?: number;
    minScore?: number;
    requireGrain?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<MatchResponse> {
  const startTime = Date.now();

  // Get the sourcing request
  const request = await getSourcingRequest(sourcingRequestId);
  if (!request) {
    throw new Error(`Sourcing request not found: ${sourcingRequestId}`);
  }

  // Update request status to matching
  await updateRequestStatus(sourcingRequestId, 'matching');

  // Get all eligible suppliers
  const suppliers = await getEligibleSuppliers({
    categories: [request.category, ...(request.relatedCategories || [])],
    requireGrain: options.requireGrain || request.requireGrainEnabled,
  });

  // Get category-specific weights
  const config: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    weights: getCategoryWeights(request.category),
  };

  // Score and rank all suppliers
  const scoredMatches: Array<{
    supplier: SupplierProfile;
    score: MatchScoreBreakdown;
    overallScore: number;
  }> = [];

  for (const supplier of suppliers) {
    const score = calculateMatchScore(request, supplier, config);

    // Apply GRAIN requirement filter
    if (request.requireGrainEnabled && !supplier.grainEnabled) {
      continue; // Skip non-GRAIN suppliers if required
    }

    scoredMatches.push({
      supplier,
      score,
      overallScore: score.weightedTotal,
    });
  }

  // Sort by score descending
  scoredMatches.sort((a, b) => b.overallScore - a.overallScore);

  // Apply filters
  const minScore = options.minScore || DEFAULT_SCORING_CONFIG.thresholds.minimumScore;
  const maxResults = options.maxResults || 10;

  const filteredMatches = scoredMatches
    .filter((m) => m.overallScore >= minScore)
    .slice(0, maxResults);

  // Create match records
  const matches: SourcingMatch[] = [];
  for (const m of filteredMatches) {
    const matchQuality = getMatchQuality(m.overallScore);

    // Generate explanation with AI
    let explanation;
    try {
      explanation = await explainMatch(request, m.supplier, m.score as unknown as Record<string, unknown>);
    } catch {
      explanation = {
        strengths: ['Matches category requirements'],
        concerns: [],
      };
    }

    const match: SourcingMatch = {
      id: generateId(),
      requestId: sourcingRequestId,
      supplierId: m.supplier.id,
      overallScore: Math.round(m.overallScore),
      scoreBreakdown: m.score,
      reasoning: `${matchQuality.label} - ${m.score.confidence} confidence`,
      strengths: explanation.strengths,
      concerns: explanation.concerns,
      estimatedLeadTime: m.supplier.capacity.leadTimeStandard,
      estimatedCapacityFit: determineCapacityFit(request, m.supplier),
      status: 'pending' as MatchStatus,
      matchedAt: new Date(),
      updatedAt: new Date(),
    };

    matches.push(match);

    // Store match in database
    await storeMatch(match);
  }

  // Update request status
  await updateRequestStatus(
    sourcingRequestId,
    matches.length > 0 ? 'matched' : 'active'
  );

  return {
    matches,
    request,
    totalSuppliersConsidered: suppliers.length,
    matchingDuration: Date.now() - startTime,
    timestamp: new Date(),
  };
}

/**
 * Find opportunities for a supplier (buyer requests they could fulfill)
 */
export async function findOpportunitiesForSupplier(
  supplierId: string,
  options: {
    maxResults?: number;
    minScore?: number;
    categories?: string[];
  } = {}
): Promise<OpportunityResponse> {
  // Get the supplier profile
  const supplier = await getSupplierProfile(supplierId);
  if (!supplier) {
    throw new Error(`Supplier not found: ${supplierId}`);
  }

  // Get active sourcing requests
  const requests = await getActiveSourcingRequests({
    categories: options.categories || supplier.categories,
  });

  // Get category-specific weights for primary category
  const config: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    weights: getCategoryWeights(supplier.categories[0] || 'general'),
  };

  // Score opportunities
  const scoredOpportunities: Array<{
    request: SourcingRequest;
    score: MatchScoreBreakdown;
    overallScore: number;
  }> = [];

  for (const request of requests) {
    // Skip if buyer requires GRAIN and supplier isn't enabled
    if (request.requireGrainEnabled && !supplier.grainEnabled) {
      continue;
    }

    const score = calculateMatchScore(request, supplier, config);

    scoredOpportunities.push({
      request,
      score,
      overallScore: score.weightedTotal,
    });
  }

  // Sort by score
  scoredOpportunities.sort((a, b) => b.overallScore - a.overallScore);

  // Filter and limit
  const minScore = options.minScore || DEFAULT_SCORING_CONFIG.thresholds.minimumScore;
  const maxResults = options.maxResults || 10;

  const filteredOpportunities = scoredOpportunities
    .filter((o) => o.overallScore >= minScore)
    .slice(0, maxResults);

  // Convert to matches
  const opportunities: SourcingMatch[] = filteredOpportunities.map((o) => ({
    id: generateId(),
    requestId: o.request.id,
    supplierId,
    overallScore: Math.round(o.overallScore),
    scoreBreakdown: o.score,
    reasoning: `Opportunity in ${o.request.category}`,
    strengths: [],
    concerns: [],
    estimatedCapacityFit: determineCapacityFit(o.request, supplier),
    status: 'pending' as MatchStatus,
    matchedAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    opportunities,
    supplier,
    totalRequestsConsidered: requests.length,
    timestamp: new Date(),
  };
}

/**
 * Process a match request (can be from natural language or structured)
 */
export async function processMatchRequest(req: MatchRequest): Promise<MatchResponse> {
  let request: SourcingRequest;

  if (req.requestId) {
    // Existing request - run matching
    return findMatchesForRequest(req.requestId, {
      maxResults: req.maxResults,
      minScore: req.minScore,
      requireGrain: req.requireGrain,
    });
  }

  if (req.rawRequest) {
    // Parse natural language request
    const parsed = await parseNaturalLanguageRequest(req.rawRequest);

    // Create sourcing request from parsed data
    request = await createSourcingRequest({
      title: parsed.title,
      description: parsed.description,
      rawRequest: req.rawRequest,
      category: req.categoryOverride || parsed.inferredCategory,
      specifications: parsed.extractedSpecs,
      requiredCertifications: [],
      quantity: parsed.quantity || 0,
      quantityUnit: parsed.quantityUnit || 'units',
      frequency: parsed.frequency || 'one-time',
      deliveryDeadline: parsed.deliveryDeadline,
      urgency: parsed.urgency,
      deliveryLocation: parsed.deliveryLocation || '',
      targetPrice: parsed.targetPrice,
      maxPrice: parsed.maxPrice,
      currency: parsed.currency,
      preferGrainEnabled: true,
      requireGrainEnabled: req.requireGrain || false,
    });
  } else if (req.parsedRequest) {
    // Create from parsed request
    request = await createSourcingRequest(req.parsedRequest);
  } else {
    throw new Error('Must provide requestId, rawRequest, or parsedRequest');
  }

  // Run matching
  return findMatchesForRequest(request.id, {
    maxResults: req.maxResults,
    minScore: req.minScore,
    requireGrain: req.requireGrain,
  });
}

// ============================================================================
// AUTOMATIC MATCHING TRIGGERS
// ============================================================================

/**
 * Trigger matching when a new request is created
 */
export async function onNewRequest(requestId: string): Promise<MatchResponse> {
  console.log(`[Matching Engine] New request trigger: ${requestId}`);
  return findMatchesForRequest(requestId);
}

/**
 * Trigger matching when a new supplier joins
 * Finds all active requests that this supplier could fulfill
 */
export async function onNewSupplier(supplierId: string): Promise<{
  opportunities: OpportunityResponse;
  notificationsSent: number;
}> {
  console.log(`[Matching Engine] New supplier trigger: ${supplierId}`);

  const opportunities = await findOpportunitiesForSupplier(supplierId);

  // Store opportunities as matches
  for (const opp of opportunities.opportunities) {
    await storeMatch(opp);
  }

  // In a real implementation, send notifications to buyers
  const notificationsSent = 0; // Would send notifications here

  return {
    opportunities,
    notificationsSent,
  };
}

/**
 * Re-run matching for a request (manual trigger)
 */
export async function reMatch(
  requestId: string,
  options?: {
    forceRefresh?: boolean;
    expandSearch?: boolean;
  }
): Promise<MatchResponse> {
  console.log(`[Matching Engine] Re-match trigger: ${requestId}`);

  // Clear existing pending matches if force refresh
  if (options?.forceRefresh) {
    await clearPendingMatches(requestId);
  }

  return findMatchesForRequest(requestId, {
    forceRefresh: options?.forceRefresh,
  });
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function getSourcingRequest(id: string): Promise<SourcingRequest | null> {
  try {
    const result = await sql`
      SELECT * FROM sourcing_requests WHERE id = ${id}
    `;

    if (result.rows.length === 0) return null;

    return rowToSourcingRequest(result.rows[0]);
  } catch (error) {
    console.error('Error fetching sourcing request:', error);
    // Return mock data for development
    return createMockRequest(id);
  }
}

async function getSupplierProfile(id: string): Promise<SupplierProfile | null> {
  try {
    const result = await sql`
      SELECT s.*,
             COALESCE(t.trust_score, 50) as trust_score,
             COALESCE(t.trust_tier, 'new') as trust_tier
      FROM suppliers s
      LEFT JOIN trust_scores t ON s.id = t.entity_id
      WHERE s.id = ${id} AND s.status = 'active'
    `;

    if (result.rows.length === 0) return null;

    return rowToSupplierProfile(result.rows[0]);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return null;
  }
}

async function getEligibleSuppliers(options: {
  categories?: string[];
  requireGrain?: boolean;
}): Promise<SupplierProfile[]> {
  try {
    let query;
    if (options.requireGrain) {
      query = sql`
        SELECT s.*,
               COALESCE(t.trust_score, 50) as trust_score,
               COALESCE(t.trust_tier, 'new') as trust_tier
        FROM suppliers s
        LEFT JOIN trust_scores t ON s.id = t.entity_id
        WHERE s.status = 'active' AND s.grain_enabled = true
        ORDER BY t.trust_score DESC NULLS LAST
      `;
    } else {
      query = sql`
        SELECT s.*,
               COALESCE(t.trust_score, 50) as trust_score,
               COALESCE(t.trust_tier, 'new') as trust_tier
        FROM suppliers s
        LEFT JOIN trust_scores t ON s.id = t.entity_id
        WHERE s.status = 'active'
        ORDER BY s.grain_enabled DESC, t.trust_score DESC NULLS LAST
      `;
    }

    const result = await query;
    return result.rows.map(rowToSupplierProfile);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    // Return mock data for development
    return createMockSuppliers();
  }
}

async function getActiveSourcingRequests(options: {
  categories?: string[];
}): Promise<SourcingRequest[]> {
  try {
    const result = await sql`
      SELECT * FROM sourcing_requests
      WHERE status IN ('active', 'matched')
      ORDER BY urgency DESC, created_at DESC
    `;

    return result.rows.map(rowToSourcingRequest);
  } catch (error) {
    console.error('Error fetching active requests:', error);
    return [];
  }
}

async function createSourcingRequest(
  data: Partial<SourcingRequest>
): Promise<SourcingRequest> {
  const id = generateId();
  const now = new Date();

  try {
    await sql`
      INSERT INTO sourcing_requests (
        id, buyer_id, title, description, raw_request,
        category, specifications, required_certifications,
        quantity, quantity_unit, frequency, delivery_deadline,
        urgency, delivery_location, target_price, max_price, currency,
        prefer_grain_enabled, require_grain_enabled, status,
        created_at, updated_at
      ) VALUES (
        ${id}, ${data.buyerId || null}, ${data.title || ''},
        ${data.description || ''}, ${data.rawRequest || null},
        ${data.category || 'general'}, ${JSON.stringify(data.specifications || [])},
        ${data.requiredCertifications || []},
        ${data.quantity || 0}, ${data.quantityUnit || 'units'},
        ${data.frequency || 'one-time'}, ${data.deliveryDeadline || null},
        ${data.urgency || 'standard'}, ${data.deliveryLocation || ''},
        ${data.targetPrice || null}, ${data.maxPrice || null}, ${data.currency || 'USD'},
        ${data.preferGrainEnabled !== false}, ${data.requireGrainEnabled || false},
        'active', ${now}, ${now}
      )
    `;
  } catch (error) {
    console.error('Error creating sourcing request:', error);
  }

  return {
    id,
    buyerId: data.buyerId || '',
    title: data.title || '',
    description: data.description || '',
    rawRequest: data.rawRequest,
    category: data.category || 'general',
    specifications: data.specifications || [],
    requiredCertifications: data.requiredCertifications || [],
    quantity: data.quantity || 0,
    quantityUnit: data.quantityUnit || 'units',
    frequency: data.frequency || 'one-time',
    deliveryDeadline: data.deliveryDeadline,
    urgency: data.urgency || 'standard',
    deliveryLocation: data.deliveryLocation || '',
    targetPrice: data.targetPrice,
    maxPrice: data.maxPrice,
    currency: data.currency || 'USD',
    preferGrainEnabled: data.preferGrainEnabled !== false,
    requireGrainEnabled: data.requireGrainEnabled || false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

async function updateRequestStatus(
  id: string,
  status: RequestStatus
): Promise<void> {
  try {
    await sql`
      UPDATE sourcing_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Error updating request status:', error);
  }
}

async function storeMatch(match: SourcingMatch): Promise<void> {
  try {
    await sql`
      INSERT INTO sourcing_matches (
        id, request_id, supplier_id, overall_score, score_breakdown,
        reasoning, strengths, concerns, estimated_lead_time, estimated_capacity_fit,
        status, matched_at, updated_at
      ) VALUES (
        ${match.id}, ${match.requestId}, ${match.supplierId},
        ${match.overallScore}, ${JSON.stringify(match.scoreBreakdown)},
        ${match.reasoning}, ${match.strengths}, ${match.concerns || []},
        ${match.estimatedLeadTime || null}, ${match.estimatedCapacityFit},
        ${match.status}, ${match.matchedAt}, ${match.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        score_breakdown = EXCLUDED.score_breakdown,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error('Error storing match:', error);
  }
}

async function clearPendingMatches(requestId: string): Promise<void> {
  try {
    await sql`
      DELETE FROM sourcing_matches
      WHERE request_id = ${requestId} AND status = 'pending'
    `;
  } catch (error) {
    console.error('Error clearing pending matches:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function determineCapacityFit(
  request: SourcingRequest,
  supplier: SupplierProfile
): 'exact' | 'good' | 'possible' | 'stretch' {
  const ratio = request.quantity / supplier.capacity.monthlyVolume;

  if (ratio <= 0.3) return 'exact';
  if (ratio <= 0.5) return 'good';
  if (ratio <= 0.8) return 'possible';
  return 'stretch';
}

function rowToSourcingRequest(row: Record<string, unknown>): SourcingRequest {
  return {
    id: row.id as string,
    buyerId: row.buyer_id as string,
    buyerName: row.buyer_name as string | undefined,
    buyerEmail: row.buyer_email as string | undefined,
    title: row.title as string,
    description: row.description as string,
    rawRequest: row.raw_request as string | undefined,
    category: row.category as string,
    parentCategory: row.parent_category as string | undefined,
    relatedCategories: row.related_categories as string[] | undefined,
    specifications: (typeof row.specifications === 'string'
      ? JSON.parse(row.specifications)
      : row.specifications) || [],
    requiredCertifications: row.required_certifications as string[] || [],
    preferredCertifications: row.preferred_certifications as string[] | undefined,
    quantity: row.quantity as number,
    quantityUnit: row.quantity_unit as string,
    frequency: row.frequency as SourcingRequest['frequency'],
    deliveryDeadline: row.delivery_deadline
      ? new Date(row.delivery_deadline as string)
      : undefined,
    urgency: row.urgency as SourcingRequest['urgency'],
    deliveryLocation: row.delivery_location as string,
    deliveryCity: row.delivery_city as string | undefined,
    deliveryRegion: row.delivery_region as string | undefined,
    deliveryCountry: row.delivery_country as string | undefined,
    targetPrice: row.target_price as number | undefined,
    maxPrice: row.max_price as number | undefined,
    currency: row.currency as string,
    preferGrainEnabled: row.prefer_grain_enabled as boolean,
    requireGrainEnabled: row.require_grain_enabled as boolean,
    status: row.status as RequestStatus,
    matchingStartedAt: row.matching_started_at
      ? new Date(row.matching_started_at as string)
      : undefined,
    matchingCompletedAt: row.matching_completed_at
      ? new Date(row.matching_completed_at as string)
      : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToSupplierProfile(row: Record<string, unknown>): SupplierProfile {
  const pricing = typeof row.pricing === 'string'
    ? JSON.parse(row.pricing)
    : row.pricing || {};
  const capacity = typeof row.capacity === 'string'
    ? JSON.parse(row.capacity)
    : row.capacity || {};
  const capabilities = typeof row.capabilities === 'string'
    ? JSON.parse(row.capabilities)
    : row.capabilities || {};
  const performance = typeof row.performance === 'string'
    ? JSON.parse(row.performance)
    : row.performance || {};

  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactEmail: row.contact_email as string,
    phone: row.phone as string | undefined,
    website: row.website as string | undefined,
    categories: row.categories as string[] || row.products as string[] || [],
    products: row.products as string[] || [],
    productDescriptions: row.product_descriptions as Record<string, string> | undefined,
    capabilities: {
      dropShipCapable: capabilities.dropShipCapable || row.drop_ship_capable || false,
      whiteLabelCapable: capabilities.whiteLabelCapable || row.white_label_capable || false,
      customizationLevel: capabilities.customizationLevel || 'basic',
      minOrderFlexibility: capabilities.minOrderFlexibility || 'negotiable',
      rushOrderCapable: capabilities.rushOrderCapable || false,
      technicalSpecs: capabilities.technicalSpecs,
    },
    certifications: row.certifications as string[] || [],
    capacity: {
      monthlyVolume: capacity.monthlyVolume || 10000,
      monthlyVolumeUnit: capacity.monthlyVolumeUnit || 'units',
      currentUtilization: capacity.currentUtilization || 50,
      leadTimeStandard: capacity.leadTime || row.lead_time as number || 7,
      leadTimeRush: capacity.leadTimeRush || Math.ceil((row.lead_time as number || 7) / 2),
      canHandleVolume: () => true,
    },
    pricing: {
      minimumOrder: pricing.minimumOrder || row.minimum_order as number || 100,
      currency: pricing.currency || 'USD',
      paymentTerms: pricing.paymentTerms || 'NET30',
      priceRanges: pricing.priceRanges,
      discountTiers: pricing.discountTiers,
      competitiveIndex: pricing.competitiveIndex,
    },
    headquarters: row.headquarters as string || '',
    shippingLocations: capacity.locations as string[] || [],
    warehouses: row.warehouses as string[] | undefined,
    grainEnabled: row.grain_enabled as boolean || false,
    grainAccountId: row.grain_account_id as string | undefined,
    trustScore: row.trust_score as number || 50,
    trustTier: row.trust_tier as SupplierProfile['trustTier'] || 'new',
    performance: {
      totalDeals: performance.totalDeals || 0,
      completedDeals: performance.completedDeals || 0,
      onTimeDeliveryRate: performance.onTimeDeliveryRate || 95,
      qualityRating: performance.qualityRating || 4,
      responseTimeHours: performance.responseTimeHours || 24,
      disputeRate: performance.disputeRate || 0,
      repeatCustomerRate: performance.repeatCustomerRate || 0,
    },
    status: row.status as SupplierProfile['status'],
    onboardedAt: row.onboarded_at ? new Date(row.onboarded_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

function createMockRequest(id: string): SourcingRequest {
  return {
    id,
    buyerId: 'buyer_mock',
    buyerName: 'Mock Buyer Co',
    buyerEmail: 'buyer@example.com',
    title: 'Packaging Materials',
    description: 'Need sustainable packaging for e-commerce shipments',
    category: 'packaging',
    specifications: [
      { name: 'Material', value: 'Recycled cardboard', required: true },
      { name: 'Size', value: '12x8x4 inches', required: true },
    ],
    requiredCertifications: ['FSC'],
    quantity: 10000,
    quantityUnit: 'units',
    frequency: 'monthly',
    urgency: 'standard',
    deliveryLocation: 'Los Angeles, CA',
    deliveryCity: 'Los Angeles',
    deliveryRegion: 'California',
    deliveryCountry: 'USA',
    targetPrice: 15000,
    currency: 'USD',
    preferGrainEnabled: true,
    requireGrainEnabled: false,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockSuppliers(): SupplierProfile[] {
  return [
    {
      id: 'supplier_1',
      companyName: 'EcoPack Solutions',
      contactEmail: 'sales@ecopack.com',
      categories: ['packaging', 'sustainable_materials'],
      products: ['cardboard boxes', 'mailers', 'eco packaging'],
      capabilities: {
        dropShipCapable: true,
        whiteLabelCapable: true,
        customizationLevel: 'advanced',
        minOrderFlexibility: 'flexible',
        rushOrderCapable: true,
      },
      certifications: ['FSC', 'ISO14001', 'B-Corp'],
      capacity: {
        monthlyVolume: 100000,
        monthlyVolumeUnit: 'units',
        currentUtilization: 60,
        leadTimeStandard: 5,
        leadTimeRush: 2,
        canHandleVolume: () => true,
      },
      pricing: {
        minimumOrder: 500,
        currency: 'USD',
        paymentTerms: 'NET30',
        competitiveIndex: 85,
      },
      headquarters: 'Los Angeles, CA',
      shippingLocations: ['California', 'Western US'],
      grainEnabled: true,
      grainAccountId: 'grain_eco',
      trustScore: 92,
      trustTier: 'elite',
      performance: {
        totalDeals: 150,
        completedDeals: 148,
        onTimeDeliveryRate: 98,
        qualityRating: 4.8,
        responseTimeHours: 2,
        disputeRate: 0.5,
        repeatCustomerRate: 75,
      },
      status: 'active',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date(),
    },
    {
      id: 'supplier_2',
      companyName: 'PackRight Industries',
      contactEmail: 'orders@packright.com',
      categories: ['packaging', 'industrial'],
      products: ['boxes', 'tape', 'packaging materials'],
      capabilities: {
        dropShipCapable: false,
        whiteLabelCapable: false,
        customizationLevel: 'basic',
        minOrderFlexibility: 'strict',
        rushOrderCapable: false,
      },
      certifications: ['ISO9001'],
      capacity: {
        monthlyVolume: 200000,
        monthlyVolumeUnit: 'units',
        currentUtilization: 75,
        leadTimeStandard: 10,
        leadTimeRush: 5,
        canHandleVolume: () => true,
      },
      pricing: {
        minimumOrder: 1000,
        currency: 'USD',
        paymentTerms: 'NET45',
        competitiveIndex: 70,
      },
      headquarters: 'Chicago, IL',
      shippingLocations: ['Midwest US', 'Eastern US'],
      grainEnabled: false,
      trustScore: 75,
      trustTier: 'established',
      performance: {
        totalDeals: 80,
        completedDeals: 75,
        onTimeDeliveryRate: 90,
        qualityRating: 4.2,
        responseTimeHours: 12,
        disputeRate: 3,
        repeatCustomerRate: 50,
      },
      status: 'active',
      createdAt: new Date('2023-06-01'),
      updatedAt: new Date(),
    },
  ];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MatchingEngine = {
  findMatchesForRequest,
  findOpportunitiesForSupplier,
  processMatchRequest,
  onNewRequest,
  onNewSupplier,
  reMatch,
};

export default MatchingEngine;
