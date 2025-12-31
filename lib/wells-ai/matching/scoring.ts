/**
 * Wells AI Match Scoring System
 *
 * Weighted scoring model with explainable scores.
 * This determines which suppliers are the best match for each request.
 *
 * Score interpretation:
 * - 80+ = Strong match (high confidence, prioritize)
 * - 60-79 = Good match (solid option)
 * - 40-59 = Possible match (review needed)
 * - <40 = Weak match (usually filtered out)
 */

import {
  SourcingRequest,
  SupplierProfile,
  MatchScoreBreakdown,
  ScoreComponent,
  ScoringConfig,
  ScoringWeights,
  DEFAULT_SCORING_CONFIG,
} from './types';

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate comprehensive match score between a request and supplier
 */
export function calculateMatchScore(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): MatchScoreBreakdown {
  // Calculate each component
  const categoryMatch = scoreCategoryMatch(request, supplier, config);
  const capabilityMatch = scoreCapabilityMatch(request, supplier, config);
  const locationMatch = scoreLocationMatch(request, supplier, config);
  const capacityMatch = scoreCapacityMatch(request, supplier, config);
  const grainBonus = scoreGrainBonus(request, supplier, config);
  const trustScore = scoreTrustScore(supplier, config);
  const priceCompetitiveness = scorePriceCompetitiveness(request, supplier, config);

  // Calculate weighted total
  const weightedTotal =
    categoryMatch.weighted +
    capabilityMatch.weighted +
    locationMatch.weighted +
    capacityMatch.weighted +
    grainBonus.weighted +
    trustScore.weighted +
    priceCompetitiveness.weighted;

  // Determine confidence
  const { confidence, confidenceReasons } = determineConfidence({
    categoryMatch,
    capabilityMatch,
    locationMatch,
    capacityMatch,
    grainBonus,
    trustScore,
    priceCompetitiveness,
  });

  return {
    categoryMatch,
    capabilityMatch,
    locationMatch,
    capacityMatch,
    grainBonus,
    trustScore,
    priceCompetitiveness,
    weightedTotal: Math.round(weightedTotal * 100) / 100,
    confidence,
    confidenceReasons,
  };
}

// ============================================================================
// SCORING COMPONENTS
// ============================================================================

/**
 * Score category match (exact, parent, or related)
 */
function scoreCategoryMatch(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.categoryMatch;
  let score = 0;
  let explanation = '';
  const details: Record<string, unknown> = {};

  // Exact category match
  if (supplier.categories.includes(request.category)) {
    score = 100 + config.bonuses.exactCategoryMatch;
    explanation = `Exact category match: ${request.category}`;
    details.matchType = 'exact';
  }
  // Parent category match
  else if (request.parentCategory && supplier.categories.includes(request.parentCategory)) {
    score = 80;
    explanation = `Parent category match: ${request.parentCategory}`;
    details.matchType = 'parent';
  }
  // Related category match
  else if (request.relatedCategories?.some((cat) => supplier.categories.includes(cat))) {
    const matchedRelated = request.relatedCategories.filter((cat) =>
      supplier.categories.includes(cat)
    );
    score = 60 + Math.min(matchedRelated.length * 5, 20);
    explanation = `Related categories: ${matchedRelated.join(', ')}`;
    details.matchType = 'related';
    details.matchedCategories = matchedRelated;
  }
  // Product-level match
  else if (supplier.products.some((p) => p.toLowerCase().includes(request.category.toLowerCase()))) {
    score = 50;
    explanation = `Product-level match found`;
    details.matchType = 'product';
  } else {
    score = 0;
    explanation = `No category match found`;
    details.matchType = 'none';
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score capability match (specs, certifications)
 */
function scoreCapabilityMatch(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.capabilityMatch;
  let score = 50; // Base score
  let explanation = '';
  const details: Record<string, unknown> = {
    certsMet: [] as string[],
    certsMissing: [] as string[],
    capabilities: [] as string[],
  };

  // Check required certifications
  const requiredCerts = request.requiredCertifications || [];
  const supplierCerts = supplier.certifications || [];

  if (requiredCerts.length > 0) {
    const metCerts = requiredCerts.filter((cert) =>
      supplierCerts.some((sc) => sc.toLowerCase().includes(cert.toLowerCase()))
    );
    const missingCerts = requiredCerts.filter((cert) => !metCerts.includes(cert));

    (details.certsMet as string[]).push(...metCerts);
    (details.certsMissing as string[]).push(...missingCerts);

    if (missingCerts.length === 0) {
      score += config.bonuses.allCertificationsMet;
    } else {
      score += config.penalties.missingCertification * missingCerts.length;
    }
  }

  // Check preferred certifications (bonus only)
  const preferredCerts = request.preferredCertifications || [];
  const metPreferred = preferredCerts.filter((cert) =>
    supplierCerts.some((sc) => sc.toLowerCase().includes(cert.toLowerCase()))
  );
  score += metPreferred.length * 5;

  // Check capabilities
  const capabilities = supplier.capabilities;
  const capabilityNotes: string[] = [];

  // Customization capability
  if (capabilities.customizationLevel === 'full' || capabilities.customizationLevel === 'advanced') {
    score += 10;
    capabilityNotes.push('Advanced customization available');
  }

  // Rush order capability for urgent requests
  if (request.urgency !== 'standard' && capabilities.rushOrderCapable) {
    score += 10;
    capabilityNotes.push('Rush orders supported');
  }

  // Drop shipping
  if (capabilities.dropShipCapable) {
    score += 5;
    capabilityNotes.push('Drop shipping available');
  }

  // White label
  if (capabilities.whiteLabelCapable) {
    score += 5;
    capabilityNotes.push('White label available');
  }

  (details.capabilities as string[]).push(...capabilityNotes);

  // Cap score
  score = Math.min(100, Math.max(0, score));

  // Build explanation
  const certStatus =
    (details.certsMissing as string[]).length === 0
      ? 'All certifications met'
      : `Missing: ${(details.certsMissing as string[]).join(', ')}`;
  explanation = `${certStatus}. ${capabilityNotes.length} capability matches.`;

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score location/logistics match
 */
function scoreLocationMatch(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.locationMatch;
  let score = 50; // Base score
  let explanation = '';
  const details: Record<string, unknown> = {};

  const requestLocation = (request.deliveryLocation || '').toLowerCase();
  const requestCity = (request.deliveryCity || '').toLowerCase();
  const requestRegion = (request.deliveryRegion || '').toLowerCase();
  const requestCountry = (request.deliveryCountry || '').toLowerCase();

  const shippingLocations = supplier.shippingLocations.map((l) => l.toLowerCase());
  const warehouses = (supplier.warehouses || []).map((w) => w.toLowerCase());

  // Check if supplier ships to the requested location
  const canShipDirect = shippingLocations.some(
    (loc) =>
      loc.includes(requestLocation) ||
      loc.includes(requestCity) ||
      loc.includes(requestRegion) ||
      loc.includes(requestCountry) ||
      requestLocation.includes(loc)
  );

  if (canShipDirect) {
    score = 80;
    explanation = 'Supplier ships to delivery location';
    details.shipsToLocation = true;
  }

  // Bonus for local warehouse
  const hasLocalWarehouse = warehouses.some(
    (wh) =>
      wh.includes(requestCity) ||
      wh.includes(requestRegion) ||
      (requestCity && wh.includes(requestCity))
  );

  if (hasLocalWarehouse) {
    score += 20;
    explanation = 'Local warehouse available for faster delivery';
    details.localWarehouse = true;
  }

  // Check for same country
  const sameCountry = shippingLocations.some(
    (loc) => requestCountry && loc.includes(requestCountry)
  );

  if (sameCountry && !canShipDirect) {
    score = 70;
    explanation = 'Ships within same country';
    details.sameCountry = true;
  }

  // International shipping penalty
  if (!canShipDirect && !sameCountry && shippingLocations.length > 0) {
    score = 40;
    explanation = 'May require international shipping';
    details.international = true;
  }

  // No shipping info
  if (shippingLocations.length === 0) {
    score = 30;
    explanation = 'Shipping locations unknown';
    details.unknown = true;
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score capacity match (can they fulfill the volume?)
 */
function scoreCapacityMatch(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.capacityMatch;
  let score = 50;
  let explanation = '';
  const details: Record<string, unknown> = {};

  const requestedQuantity = request.quantity || 0;
  const capacity = supplier.capacity;
  const monthlyCapacity = capacity.monthlyVolume;
  const utilization = capacity.currentUtilization / 100;
  const availableCapacity = monthlyCapacity * (1 - utilization);

  details.requestedQuantity = requestedQuantity;
  details.monthlyCapacity = monthlyCapacity;
  details.availableCapacity = availableCapacity;
  details.utilization = capacity.currentUtilization;

  // Calculate how much of their available capacity this would use
  const capacityUsage = requestedQuantity / availableCapacity;

  if (capacityUsage <= 0.3) {
    // Uses less than 30% of available capacity
    score = 100;
    explanation = 'Excellent capacity fit - supplier can easily handle volume';
    details.fit = 'exact';
  } else if (capacityUsage <= 0.5) {
    // Uses 30-50% of available capacity
    score = 85;
    explanation = 'Good capacity fit';
    details.fit = 'good';
  } else if (capacityUsage <= 0.7) {
    // Uses 50-70% of available capacity
    score = 70;
    explanation = 'Moderate capacity fit';
    details.fit = 'possible';
  } else if (capacityUsage <= 1.0) {
    // Uses 70-100% of available capacity
    score = 50 + config.penalties.capacityStrain;
    explanation = 'Tight capacity fit - may strain supplier';
    details.fit = 'stretch';
  } else {
    // Exceeds available capacity
    score = 20;
    explanation = 'Exceeds available capacity';
    details.fit = 'exceed';
  }

  // Check lead time against urgency
  const leadTime =
    request.urgency !== 'standard' ? capacity.leadTimeRush : capacity.leadTimeStandard;

  if (request.urgency === 'critical' && leadTime > 3) {
    score += config.penalties.longLeadTime;
    explanation += '. Lead time may be too long for critical urgency.';
    details.leadTimeIssue = true;
  } else if (request.urgency === 'urgent' && leadTime > 7) {
    score += config.penalties.longLeadTime / 2;
    explanation += '. Lead time may be tight for urgent request.';
    details.leadTimeIssue = true;
  } else if (leadTime <= 3 && request.urgency !== 'standard') {
    score += config.bonuses.fastDelivery;
    explanation += ' Fast delivery available.';
    details.fastDelivery = true;
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score GRAIN enablement bonus
 * This is our moat - GRAIN suppliers get priority
 */
function scoreGrainBonus(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.grainBonus;
  let score = 0;
  let explanation = '';
  const details: Record<string, unknown> = {};

  if (supplier.grainEnabled) {
    score = 100;
    explanation = 'GRAIN-enabled supplier - preferred for faster payments and lower fees';
    details.grainEnabled = true;
    details.grainAccountId = supplier.grainAccountId;

    // Extra bonus if buyer prefers GRAIN
    if (request.preferGrainEnabled) {
      score += 20;
      explanation += '. Buyer prefers GRAIN suppliers.';
      details.buyerPreference = true;
    }
  } else {
    if (request.requireGrainEnabled) {
      // Buyer requires GRAIN - this is a disqualifier
      score = -100; // This will effectively disqualify the match
      explanation = 'Buyer requires GRAIN-enabled suppliers only';
      details.disqualified = true;
    } else if (request.preferGrainEnabled) {
      // Buyer prefers but doesn't require GRAIN
      score = 30;
      explanation = 'Not GRAIN-enabled. Buyer prefers GRAIN suppliers.';
      details.grainEnabled = false;
    } else {
      // No GRAIN preference
      score = 50;
      explanation = 'Not GRAIN-enabled. Consider encouraging onboarding.';
      details.grainEnabled = false;
    }
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score based on trust and reputation
 */
function scoreTrustScore(supplier: SupplierProfile, config: ScoringConfig): ScoreComponent {
  const weight = config.weights.trustScore;
  let score = supplier.trustScore || 50;
  let explanation = '';
  const details: Record<string, unknown> = {};

  details.trustScore = supplier.trustScore;
  details.trustTier = supplier.trustTier;
  details.performance = supplier.performance;

  // Tier-based bonuses
  const tierBonuses: Record<string, number> = {
    legendary: 15,
    elite: 12,
    trusted: 8,
    established: 4,
    verified: 0,
    new: -5,
  };

  const tierBonus = tierBonuses[supplier.trustTier] || 0;
  score += tierBonus;

  // Performance metrics
  const perf = supplier.performance;

  if (perf) {
    // On-time delivery rate
    if (perf.onTimeDeliveryRate >= 98) {
      score += 5;
    } else if (perf.onTimeDeliveryRate < 90) {
      score -= 10;
    }

    // Quality rating
    if (perf.qualityRating >= 4.5) {
      score += 5;
    } else if (perf.qualityRating < 3.5) {
      score -= 10;
    }

    // Dispute rate
    if (perf.disputeRate > 5) {
      score += config.penalties.lowTrustScore;
    }

    // Response time
    if (perf.responseTimeHours <= 2) {
      score += 5;
    } else if (perf.responseTimeHours > 24) {
      score -= 5;
    }
  }

  // Cap and determine explanation
  score = Math.min(100, Math.max(0, score));

  if (score >= 90) {
    explanation = `Exceptional trust: ${supplier.trustTier} tier with excellent track record`;
  } else if (score >= 70) {
    explanation = `Good trust: ${supplier.trustTier} tier with solid performance`;
  } else if (score >= 50) {
    explanation = `Average trust: ${supplier.trustTier} tier`;
  } else {
    explanation = `Lower trust: ${supplier.trustTier} tier - proceed with caution`;
  }

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

/**
 * Score price competitiveness (if known)
 */
function scorePriceCompetitiveness(
  request: SourcingRequest,
  supplier: SupplierProfile,
  config: ScoringConfig
): ScoreComponent {
  const weight = config.weights.priceCompetitiveness;
  let score = 50; // Default when no price info
  let explanation = 'Price information not available for comparison';
  const details: Record<string, unknown> = {};

  const pricing = supplier.pricing;
  const targetPrice = request.targetPrice;
  const maxPrice = request.maxPrice;

  details.minimumOrder = pricing.minimumOrder;
  details.targetPrice = targetPrice;
  details.maxPrice = maxPrice;

  // Check minimum order requirement
  if (targetPrice && pricing.minimumOrder > targetPrice) {
    score = 20;
    explanation = 'Minimum order exceeds target price';
    details.minimumOrderIssue = true;
    return { score, weight, weighted: score * weight, explanation, details };
  }

  // Use competitive index if available
  if (pricing.competitiveIndex !== undefined) {
    score = pricing.competitiveIndex;
    details.competitiveIndex = pricing.competitiveIndex;

    if (score >= 80) {
      explanation = 'Highly competitive pricing in category';
    } else if (score >= 60) {
      explanation = 'Competitive pricing';
    } else if (score >= 40) {
      explanation = 'Average pricing';
    } else {
      explanation = 'Above-average pricing';
      score += config.penalties.pricePremium;
    }
  }

  // Check against price ranges if available
  if (pricing.priceRanges && pricing.priceRanges.length > 0) {
    const relevantRange = pricing.priceRanges.find(
      (pr) =>
        pr.productCategory.toLowerCase() === request.category.toLowerCase() ||
        request.relatedCategories?.some((rc) => rc.toLowerCase() === pr.productCategory.toLowerCase())
    );

    if (relevantRange && targetPrice) {
      const avgPrice = (relevantRange.minPrice + relevantRange.maxPrice) / 2;
      const priceRatio = avgPrice / targetPrice;

      if (priceRatio <= 0.8) {
        score = 90;
        explanation = 'Pricing well below target';
      } else if (priceRatio <= 1.0) {
        score = 75;
        explanation = 'Pricing within target';
      } else if (priceRatio <= 1.2) {
        score = 55;
        explanation = 'Pricing slightly above target';
      } else {
        score = 30;
        explanation = 'Pricing significantly above target';
      }

      details.priceRatio = priceRatio;
    }
  }

  // Discount tier bonus
  if (pricing.discountTiers && pricing.discountTiers.length > 0) {
    const applicableTier = pricing.discountTiers
      .filter((tier) => request.quantity >= tier.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];

    if (applicableTier) {
      score += Math.min(applicableTier.discountPct, 15);
      explanation += `. ${applicableTier.discountPct}% volume discount available.`;
      details.discountAvailable = applicableTier.discountPct;
    }
  }

  score = Math.min(100, Math.max(0, score));

  return {
    score,
    weight,
    weighted: score * weight,
    explanation,
    details,
  };
}

// ============================================================================
// CONFIDENCE DETERMINATION
// ============================================================================

interface ScoreComponents {
  categoryMatch: ScoreComponent;
  capabilityMatch: ScoreComponent;
  locationMatch: ScoreComponent;
  capacityMatch: ScoreComponent;
  grainBonus: ScoreComponent;
  trustScore: ScoreComponent;
  priceCompetitiveness: ScoreComponent;
}

function determineConfidence(
  components: ScoreComponents
): { confidence: 'high' | 'medium' | 'low'; confidenceReasons: string[] } {
  const reasons: string[] = [];
  let confidenceScore = 0;

  // Strong category match = high confidence
  if (components.categoryMatch.score >= 80) {
    confidenceScore += 2;
    reasons.push('Strong category alignment');
  } else if (components.categoryMatch.score < 50) {
    confidenceScore -= 1;
    reasons.push('Weak category match may affect relevance');
  }

  // Known capacity = higher confidence
  if (
    components.capacityMatch.details &&
    (components.capacityMatch.details as Record<string, unknown>).fit === 'exact'
  ) {
    confidenceScore += 1;
    reasons.push('Verified capacity fit');
  }

  // Trust score matters
  if (components.trustScore.score >= 80) {
    confidenceScore += 1;
    reasons.push('High trust supplier');
  } else if (components.trustScore.score < 40) {
    confidenceScore -= 1;
    reasons.push('Limited trust history');
  }

  // Price info available
  if (components.priceCompetitiveness.explanation !== 'Price information not available for comparison') {
    confidenceScore += 1;
    reasons.push('Pricing data available');
  } else {
    reasons.push('Price comparison not possible');
  }

  // GRAIN bonus
  if (components.grainBonus.score >= 100) {
    confidenceScore += 1;
    reasons.push('GRAIN-enabled for secure transactions');
  }

  // Determine final confidence
  let confidence: 'high' | 'medium' | 'low';
  if (confidenceScore >= 4) {
    confidence = 'high';
  } else if (confidenceScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { confidence, confidenceReasons: reasons };
}

// ============================================================================
// SCORE INTERPRETATION
// ============================================================================

/**
 * Get human-readable match quality from score
 */
export function getMatchQuality(score: number): {
  quality: 'strong' | 'good' | 'possible' | 'weak';
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { quality: 'strong', label: 'Strong Match', color: 'green' };
  } else if (score >= 60) {
    return { quality: 'good', label: 'Good Match', color: 'blue' };
  } else if (score >= 40) {
    return { quality: 'possible', label: 'Possible Match', color: 'yellow' };
  } else {
    return { quality: 'weak', label: 'Weak Match', color: 'gray' };
  }
}

/**
 * Generate human-readable match explanation
 */
export function explainMatchScore(breakdown: MatchScoreBreakdown): string {
  const quality = getMatchQuality(breakdown.weightedTotal);
  const parts: string[] = [];

  parts.push(`${quality.label} (${breakdown.weightedTotal.toFixed(0)}/100)`);
  parts.push('');
  parts.push('Score Breakdown:');

  // Sort by weighted score to show most impactful first
  const components = [
    { name: 'Category', ...breakdown.categoryMatch },
    { name: 'Capabilities', ...breakdown.capabilityMatch },
    { name: 'Location', ...breakdown.locationMatch },
    { name: 'Capacity', ...breakdown.capacityMatch },
    { name: 'GRAIN Status', ...breakdown.grainBonus },
    { name: 'Trust', ...breakdown.trustScore },
    { name: 'Pricing', ...breakdown.priceCompetitiveness },
  ].sort((a, b) => b.weighted - a.weighted);

  for (const comp of components) {
    parts.push(`- ${comp.name}: ${comp.score.toFixed(0)}/100 - ${comp.explanation}`);
  }

  parts.push('');
  parts.push(`Confidence: ${breakdown.confidence.toUpperCase()}`);
  if (breakdown.confidenceReasons.length > 0) {
    parts.push(`Reasons: ${breakdown.confidenceReasons.join(', ')}`);
  }

  return parts.join('\n');
}

// ============================================================================
// CUSTOM WEIGHTS
// ============================================================================

/**
 * Get scoring weights for a specific category
 * Different categories may need different weight distributions
 */
export function getCategoryWeights(category: string): ScoringWeights {
  const categoryWeightOverrides: Record<string, Partial<ScoringWeights>> = {
    // For regulated products, certifications matter more
    medical: { capabilityMatch: 0.25, trustScore: 0.20 },
    pharmaceutical: { capabilityMatch: 0.25, trustScore: 0.20 },
    food: { capabilityMatch: 0.20, trustScore: 0.18 },

    // For commodities, price matters more
    raw_materials: { priceCompetitiveness: 0.25, capacityMatch: 0.20 },
    packaging: { priceCompetitiveness: 0.22, capacityMatch: 0.18 },

    // For specialized products, capability matters more
    custom_manufacturing: { capabilityMatch: 0.25, categoryMatch: 0.22 },
    electronics: { capabilityMatch: 0.22, trustScore: 0.18 },

    // For urgent needs, capacity and location matter more
    emergency_supplies: { capacityMatch: 0.25, locationMatch: 0.20 },
  };

  const overrides = categoryWeightOverrides[category.toLowerCase()];
  if (overrides) {
    return {
      ...DEFAULT_SCORING_CONFIG.weights,
      ...overrides,
    };
  }

  return DEFAULT_SCORING_CONFIG.weights;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ScoringSystem = {
  calculateMatchScore,
  getMatchQuality,
  explainMatchScore,
  getCategoryWeights,
};

export default ScoringSystem;
