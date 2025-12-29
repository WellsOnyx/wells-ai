/**
 * AI Offer Negotiation Service
 *
 * When an offer comes in:
 * - Compare to candidate constraints
 * - If below target: counter with reasoning
 * - If acceptable: recommend acceptance
 * - Track negotiation history
 *
 * Example: "TechCorp offered $180K. Market rate is $200K. I'm countering at $195K + signing bonus"
 */

import { query } from '@/lib/db';
import {
  recordOffer,
  submitCounterOffer,
  acceptOffer,
  rejectOffer,
  type CandidateOffer,
  type CounterOffer,
} from '@/lib/hris/merge-hris-client';

// ============================================================================
// TYPES
// ============================================================================

export interface CandidateConstraints {
  minSalary: number;
  targetSalary: number;
  maxSalary?: number;
  mustHaveSigningBonus?: boolean;
  minSigningBonus?: number;
  mustHaveEquity?: boolean;
  minEquityPercent?: number;
  mustHaveRelocation?: boolean;
  minRelocationBonus?: number;
  preferredStartDate?: Date;
  earliestStartDate?: Date;
  latestStartDate?: Date;
  requiredBenefits?: string[];
  dealBreakers?: string[];
  flexibilityLevel?: 'strict' | 'moderate' | 'flexible';
}

export interface MarketData {
  role: string;
  location: string;
  experienceLevel: string;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  averageSigningBonus?: number;
  equityRange?: { min: number; max: number };
  source: string;
  asOfDate: Date;
}

export interface OfferAnalysis {
  offerId: string;
  offer: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    bonusTarget?: number;
    totalFirstYearComp: number;
  };

  // Comparison to constraints
  meetsMinSalary: boolean;
  meetsTargetSalary: boolean;
  salaryGap: number;
  salaryGapPercent: number;

  // Market comparison
  marketPercentile?: number;
  marketComparison: 'below_market' | 'at_market' | 'above_market';
  marketGap?: number;

  // Overall assessment
  recommendation: 'accept' | 'negotiate' | 'reject' | 'needs_review';
  confidenceScore: number; // 0-100
  reasoning: string[];

  // Suggested counter
  suggestedCounter?: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    startDate?: Date;
    rationale: string;
  };

  // Risk assessment
  negotiationRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

export interface NegotiationHistory {
  offerId: string;
  applicationId: string;
  jobTitle: string;
  employerName: string;
  initialOffer: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    totalComp: number;
  };
  currentOffer: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    totalComp: number;
  };
  rounds: NegotiationRound[];
  status: 'active' | 'accepted' | 'rejected' | 'expired';
  improvement: {
    salaryIncrease: number;
    salaryIncreasePercent: number;
    additionalBonus: number;
    totalImprovementPercent: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NegotiationRound {
  round: number;
  fromParty: 'candidate' | 'employer';
  baseSalary: number;
  signingBonus?: number;
  equity?: string;
  otherTerms?: string;
  rationale: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded';
  createdAt: Date;
  respondedAt?: Date;
}

// ============================================================================
// OFFER ANALYSIS
// ============================================================================

/**
 * Analyze an offer against candidate constraints and market data
 */
export async function analyzeOffer(
  offerId: string,
  constraints: CandidateConstraints,
  marketData?: MarketData
): Promise<{
  success: boolean;
  message: string;
  analysis: OfferAnalysis;
}> {
  try {
    // Get offer details
    const offerResult = await query(
      `SELECT o.*, j.title, j.employer_name, j.location
       FROM hris_offers o
       JOIN hris_applications a ON o.application_id = a.id
       JOIN hris_job_postings j ON a.job_posting_id = j.id
       WHERE o.id = $1`,
      [offerId]
    );

    if (offerResult.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that offer.",
        analysis: {} as OfferAnalysis,
      };
    }

    const offer = offerResult.rows[0];
    const baseSalary = parseFloat(offer.base_salary);
    const signingBonus = offer.signing_bonus ? parseFloat(offer.signing_bonus) : undefined;
    const bonusTarget = offer.bonus_target ? parseFloat(offer.bonus_target) : undefined;
    const equity = offer.equity;

    // Calculate total first-year comp
    const totalFirstYearComp = baseSalary +
      (signingBonus || 0) +
      (bonusTarget ? baseSalary * (bonusTarget / 100) : 0);

    // Constraint analysis
    const meetsMinSalary = baseSalary >= constraints.minSalary;
    const meetsTargetSalary = baseSalary >= constraints.targetSalary;
    const salaryGap = constraints.targetSalary - baseSalary;
    const salaryGapPercent = (salaryGap / constraints.targetSalary) * 100;

    // Market analysis
    let marketPercentile: number | undefined;
    let marketComparison: OfferAnalysis['marketComparison'] = 'at_market';
    let marketGap: number | undefined;

    if (marketData) {
      if (baseSalary <= marketData.percentile25) {
        marketPercentile = 25;
        marketComparison = 'below_market';
        marketGap = marketData.percentile50 - baseSalary;
      } else if (baseSalary <= marketData.percentile50) {
        marketPercentile = 50;
        marketComparison = 'at_market';
      } else if (baseSalary <= marketData.percentile75) {
        marketPercentile = 75;
        marketComparison = 'above_market';
      } else {
        marketPercentile = 90;
        marketComparison = 'above_market';
      }
    }

    // Build reasoning
    const reasoning: string[] = [];
    const riskFactors: string[] = [];

    if (!meetsMinSalary) {
      reasoning.push(`Offer is $${salaryGap.toLocaleString()} below your minimum salary.`);
      riskFactors.push('Below minimum threshold');
    } else if (!meetsTargetSalary) {
      reasoning.push(`Offer is $${salaryGap.toLocaleString()} (${salaryGapPercent.toFixed(1)}%) below your target.`);
    } else {
      reasoning.push('Salary meets or exceeds your target!');
    }

    if (marketComparison === 'below_market') {
      reasoning.push(`This is below market rate (${marketPercentile}th percentile).`);
      riskFactors.push('Below market rate');
    } else if (marketComparison === 'above_market') {
      reasoning.push(`This is above market rate (${marketPercentile}th percentile).`);
    }

    if (constraints.mustHaveSigningBonus && !signingBonus) {
      reasoning.push('No signing bonus included (you wanted one).');
      riskFactors.push('Missing signing bonus');
    } else if (signingBonus) {
      reasoning.push(`Includes $${signingBonus.toLocaleString()} signing bonus.`);
    }

    if (constraints.mustHaveEquity && !equity) {
      reasoning.push('No equity included (you wanted equity).');
      riskFactors.push('Missing equity');
    } else if (equity) {
      reasoning.push(`Includes ${equity} equity.`);
    }

    // Determine recommendation
    let recommendation: OfferAnalysis['recommendation'];
    let confidenceScore: number;

    if (!meetsMinSalary) {
      recommendation = 'negotiate';
      confidenceScore = 90;
      reasoning.push('I recommend countering - this is below your minimum.');
    } else if (!meetsTargetSalary && salaryGapPercent > 5) {
      recommendation = 'negotiate';
      confidenceScore = 85;
      reasoning.push('Room to negotiate - gap is significant.');
    } else if (!meetsTargetSalary && salaryGapPercent <= 5) {
      recommendation = 'needs_review';
      confidenceScore = 70;
      reasoning.push('Close to target - worth a small counter or accept.');
    } else if (marketComparison === 'below_market') {
      recommendation = 'negotiate';
      confidenceScore = 80;
      reasoning.push('Market data suggests room for improvement.');
    } else {
      recommendation = 'accept';
      confidenceScore = 85;
      reasoning.push('This is a strong offer!');
    }

    // Calculate suggested counter
    let suggestedCounter: OfferAnalysis['suggestedCounter'];

    if (recommendation === 'negotiate') {
      const counterSalary = Math.max(
        constraints.targetSalary,
        marketData?.percentile75 || constraints.targetSalary,
        baseSalary * 1.10 // At least 10% improvement
      );

      const counterSigningBonus = signingBonus
        ? Math.round(signingBonus * 1.25)
        : constraints.mustHaveSigningBonus
          ? Math.round(baseSalary * 0.10)
          : undefined;

      const parts: string[] = [];
      if (counterSalary > baseSalary) {
        parts.push(`Based on market data and your experience, $${counterSalary.toLocaleString()} is fair`);
      }
      if (counterSigningBonus && counterSigningBonus > (signingBonus || 0)) {
        parts.push(`signing bonus of $${counterSigningBonus.toLocaleString()} helps offset any transition costs`);
      }

      suggestedCounter = {
        baseSalary: Math.round(counterSalary / 1000) * 1000, // Round to nearest $1K
        signingBonus: counterSigningBonus,
        rationale: parts.join('; ') || 'Counter based on your target compensation.',
      };
    }

    // Negotiation risk assessment
    let negotiationRisk: OfferAnalysis['negotiationRisk'];
    if (marketComparison === 'below_market' || salaryGapPercent > 15) {
      negotiationRisk = 'low'; // Strong grounds to negotiate
    } else if (meetsTargetSalary && marketComparison === 'above_market') {
      negotiationRisk = 'high'; // Already a good offer
    } else {
      negotiationRisk = 'medium';
    }

    const analysis: OfferAnalysis = {
      offerId,
      offer: {
        baseSalary,
        signingBonus,
        equity,
        bonusTarget,
        totalFirstYearComp,
      },
      meetsMinSalary,
      meetsTargetSalary,
      salaryGap,
      salaryGapPercent,
      marketPercentile,
      marketComparison,
      marketGap,
      recommendation,
      confidenceScore,
      reasoning,
      suggestedCounter,
      negotiationRisk,
      riskFactors,
    };

    // Generate conversational message
    let message = `${offer.employer_name} offered $${baseSalary.toLocaleString()} for ${offer.title}. `;

    if (recommendation === 'accept') {
      message += `This meets your target of $${constraints.targetSalary.toLocaleString()}! I recommend accepting.`;
    } else if (recommendation === 'negotiate') {
      if (!meetsMinSalary) {
        message += `That's $${Math.abs(salaryGap).toLocaleString()} below your minimum of $${constraints.minSalary.toLocaleString()}. `;
      } else {
        message += `That's ${salaryGapPercent.toFixed(0)}% below your target of $${constraints.targetSalary.toLocaleString()}. `;
      }
      if (suggestedCounter) {
        message += `I suggest countering at $${suggestedCounter.baseSalary.toLocaleString()}`;
        if (suggestedCounter.signingBonus) {
          message += ` + $${suggestedCounter.signingBonus.toLocaleString()} signing bonus`;
        }
        message += '. Want me to send the counter?';
      }
    } else {
      message += `It's close to your target. Total first-year comp is $${totalFirstYearComp.toLocaleString()}. What would you like to do?`;
    }

    return {
      success: true,
      message,
      analysis,
    };
  } catch (error) {
    console.error('Error analyzing offer:', error);
    return {
      success: false,
      message: "I had trouble analyzing that offer.",
      analysis: {} as OfferAnalysis,
    };
  }
}

/**
 * Auto-negotiate based on analysis
 */
export async function autoNegotiate(
  offerId: string,
  constraints: CandidateConstraints,
  strategy: 'aggressive' | 'moderate' | 'conservative' = 'moderate'
): Promise<{
  success: boolean;
  message: string;
  action: 'accepted' | 'countered' | 'rejected' | 'needs_approval';
  counterOffer?: {
    baseSalary: number;
    signingBonus?: number;
    rationale: string;
  };
}> {
  const analysisResult = await analyzeOffer(offerId, constraints);

  if (!analysisResult.success) {
    return {
      success: false,
      message: analysisResult.message,
      action: 'needs_approval',
    };
  }

  const { analysis } = analysisResult;

  // Strategy adjustments
  const strategyMultipliers = {
    aggressive: { salaryBump: 1.15, acceptThreshold: 0.95, riskTolerance: 0.3 },
    moderate: { salaryBump: 1.10, acceptThreshold: 0.98, riskTolerance: 0.2 },
    conservative: { salaryBump: 1.05, acceptThreshold: 1.0, riskTolerance: 0.1 },
  };

  const strat = strategyMultipliers[strategy];

  // Decision logic
  if (analysis.meetsTargetSalary && analysis.salaryGapPercent <= -strat.riskTolerance * 100) {
    // Exceeds target significantly - accept
    return {
      success: true,
      message: `This offer exceeds your target by ${Math.abs(analysis.salaryGapPercent).toFixed(0)}%! Recommending immediate acceptance.`,
      action: 'needs_approval', // Still need user confirmation for acceptance
    };
  }

  if (analysis.offer.baseSalary < constraints.minSalary * 0.9) {
    // Way below minimum - reject
    return {
      success: true,
      message: `This offer is significantly below your minimum ($${(constraints.minSalary * 0.9).toLocaleString()}). I don't recommend pursuing this further.`,
      action: 'needs_approval',
    };
  }

  if (!analysis.meetsMinSalary || analysis.marketComparison === 'below_market') {
    // Counter offer
    const counterSalary = Math.round(
      Math.max(
        constraints.targetSalary * strat.salaryBump,
        analysis.offer.baseSalary * strat.salaryBump
      ) / 1000
    ) * 1000;

    const counterSigningBonus = analysis.offer.signingBonus
      ? Math.round(analysis.offer.signingBonus * 1.2)
      : constraints.mustHaveSigningBonus
        ? Math.round(counterSalary * 0.10)
        : undefined;

    const rationale = buildCounterRationale(
      analysis.offer.baseSalary,
      counterSalary,
      constraints,
      analysis.marketComparison,
      counterSigningBonus
    );

    // Submit the counter offer
    const counterResult = await submitCounterOffer(offerId, {
      baseSalary: counterSalary,
      signingBonus: counterSigningBonus,
      rationale,
    });

    if (counterResult.success) {
      // Log the negotiation round
      await logNegotiationRound(offerId, {
        round: 1, // Would need to query for actual round number
        fromParty: 'candidate',
        baseSalary: counterSalary,
        signingBonus: counterSigningBonus,
        rationale,
        status: 'proposed',
      });

      return {
        success: true,
        message: `Counter offer sent! I asked for $${counterSalary.toLocaleString()}${counterSigningBonus ? ` + $${counterSigningBonus.toLocaleString()} signing bonus` : ''}. ${rationale}`,
        action: 'countered',
        counterOffer: {
          baseSalary: counterSalary,
          signingBonus: counterSigningBonus,
          rationale,
        },
      };
    } else {
      return {
        success: false,
        message: counterResult.message,
        action: 'needs_approval',
      };
    }
  }

  // Close enough - needs human decision
  return {
    success: true,
    message: analysisResult.message,
    action: 'needs_approval',
  };
}

/**
 * Build a professional counter offer rationale
 */
function buildCounterRationale(
  currentSalary: number,
  proposedSalary: number,
  constraints: CandidateConstraints,
  marketPosition: string,
  signingBonus?: number
): string {
  const parts: string[] = [];

  const increasePercent = ((proposedSalary - currentSalary) / currentSalary) * 100;

  if (marketPosition === 'below_market') {
    parts.push(`Based on current market data for similar roles, $${proposedSalary.toLocaleString()} is more aligned with industry standards`);
  } else {
    parts.push(`Given my experience and the scope of this role, I believe $${proposedSalary.toLocaleString()} reflects the value I'll bring`);
  }

  if (signingBonus) {
    parts.push(`A signing bonus of $${signingBonus.toLocaleString()} would help offset transition costs`);
  }

  parts.push(`I'm very excited about this opportunity and confident we can find terms that work for both of us`);

  return parts.join('. ') + '.';
}

// ============================================================================
// NEGOTIATION HISTORY
// ============================================================================

/**
 * Get negotiation history for an offer
 */
export async function getNegotiationHistory(offerId: string): Promise<{
  success: boolean;
  message: string;
  history?: NegotiationHistory;
}> {
  try {
    const offerResult = await query(
      `SELECT o.*, j.title, j.employer_name,
              a.id as application_id
       FROM hris_offers o
       JOIN hris_applications a ON o.application_id = a.id
       JOIN hris_job_postings j ON a.job_posting_id = j.id
       WHERE o.id = $1`,
      [offerId]
    );

    if (offerResult.rows.length === 0) {
      return {
        success: false,
        message: "Offer not found.",
      };
    }

    const offer = offerResult.rows[0];

    // Get counter offers
    const countersResult = await query(
      `SELECT * FROM hris_counter_offers
       WHERE offer_id = $1
       ORDER BY created_at ASC`,
      [offerId]
    );

    const initialBaseSalary = parseFloat(offer.base_salary);
    const initialSigningBonus = offer.signing_bonus ? parseFloat(offer.signing_bonus) : undefined;
    const initialTotalComp = initialBaseSalary + (initialSigningBonus || 0);

    // Build rounds from counter offers
    const rounds: NegotiationRound[] = countersResult.rows.map((row, index) => ({
      round: index + 1,
      fromParty: row.from_party as 'candidate' | 'employer',
      baseSalary: row.base_salary ? parseFloat(row.base_salary) : initialBaseSalary,
      signingBonus: row.signing_bonus ? parseFloat(row.signing_bonus) : undefined,
      equity: row.equity,
      otherTerms: row.other_terms,
      rationale: row.rationale,
      status: row.status as NegotiationRound['status'],
      createdAt: new Date(row.created_at),
    }));

    // Calculate current offer (last accepted or most recent)
    let currentBaseSalary = initialBaseSalary;
    let currentSigningBonus = initialSigningBonus;
    let currentEquity = offer.equity;

    for (const round of rounds) {
      if (round.status === 'accepted' || round === rounds[rounds.length - 1]) {
        currentBaseSalary = round.baseSalary;
        currentSigningBonus = round.signingBonus;
        currentEquity = round.equity || currentEquity;
      }
    }

    const currentTotalComp = currentBaseSalary + (currentSigningBonus || 0);

    // Calculate improvements
    const salaryIncrease = currentBaseSalary - initialBaseSalary;
    const salaryIncreasePercent = (salaryIncrease / initialBaseSalary) * 100;
    const additionalBonus = (currentSigningBonus || 0) - (initialSigningBonus || 0);
    const totalImprovementPercent = ((currentTotalComp - initialTotalComp) / initialTotalComp) * 100;

    const history: NegotiationHistory = {
      offerId,
      applicationId: offer.application_id,
      jobTitle: offer.title,
      employerName: offer.employer_name,
      initialOffer: {
        baseSalary: initialBaseSalary,
        signingBonus: initialSigningBonus,
        equity: offer.equity,
        totalComp: initialTotalComp,
      },
      currentOffer: {
        baseSalary: currentBaseSalary,
        signingBonus: currentSigningBonus,
        equity: currentEquity,
        totalComp: currentTotalComp,
      },
      rounds,
      status: offer.status === 'accepted' ? 'accepted'
        : offer.status === 'rejected' ? 'rejected'
        : offer.status === 'expired' ? 'expired'
        : 'active',
      improvement: {
        salaryIncrease,
        salaryIncreasePercent,
        additionalBonus,
        totalImprovementPercent,
      },
      createdAt: new Date(offer.created_at),
      updatedAt: new Date(offer.updated_at),
    };

    let message = `Negotiation with ${history.employerName} for ${history.jobTitle}: `;

    if (rounds.length === 0) {
      message += `Initial offer of $${initialBaseSalary.toLocaleString()} (no counters yet).`;
    } else {
      message += `${rounds.length} round${rounds.length > 1 ? 's' : ''} of negotiation. `;
      if (salaryIncrease > 0) {
        message += `Improved by $${salaryIncrease.toLocaleString()} (+${salaryIncreasePercent.toFixed(1)}%). `;
      }
      message += `Current: $${currentBaseSalary.toLocaleString()}`;
      if (currentSigningBonus) {
        message += ` + $${currentSigningBonus.toLocaleString()} signing`;
      }
      message += '.';
    }

    return {
      success: true,
      message,
      history,
    };
  } catch (error) {
    console.error('Error getting negotiation history:', error);
    return {
      success: false,
      message: "I had trouble fetching the negotiation history.",
    };
  }
}

/**
 * Log a negotiation round
 */
async function logNegotiationRound(
  offerId: string,
  round: Omit<NegotiationRound, 'createdAt'>
): Promise<void> {
  // This is already handled by hris_counter_offers table
  // Just adding for explicitness in the negotiation flow
}

// ============================================================================
// MARKET DATA
// ============================================================================

/**
 * Get market salary data for a role
 * In production, this would call a salary API (Levels.fyi, Glassdoor, etc.)
 */
export async function getMarketData(
  role: string,
  location: string,
  experienceYears: number
): Promise<MarketData> {
  // Simulated market data - in production, integrate with salary APIs
  const experienceLevel = experienceYears < 3 ? 'junior'
    : experienceYears < 6 ? 'mid'
    : experienceYears < 10 ? 'senior'
    : 'staff';

  // Base salaries by level (simplified)
  const baseSalaries: Record<string, { p25: number; p50: number; p75: number; p90: number }> = {
    junior: { p25: 80000, p50: 95000, p75: 115000, p90: 130000 },
    mid: { p25: 110000, p50: 130000, p75: 155000, p90: 180000 },
    senior: { p25: 150000, p50: 175000, p75: 200000, p90: 230000 },
    staff: { p25: 200000, p50: 240000, p75: 280000, p90: 320000 },
  };

  // Location adjustments
  const locationMultipliers: Record<string, number> = {
    'san francisco': 1.3,
    'new york': 1.25,
    'seattle': 1.2,
    'los angeles': 1.15,
    'austin': 1.1,
    'denver': 1.05,
    'remote': 1.0,
    'default': 1.0,
  };

  const locationLower = location.toLowerCase();
  const multiplier = Object.entries(locationMultipliers).find(
    ([loc]) => locationLower.includes(loc)
  )?.[1] || locationMultipliers.default;

  const base = baseSalaries[experienceLevel];

  return {
    role,
    location,
    experienceLevel,
    percentile25: Math.round(base.p25 * multiplier),
    percentile50: Math.round(base.p50 * multiplier),
    percentile75: Math.round(base.p75 * multiplier),
    percentile90: Math.round(base.p90 * multiplier),
    averageSigningBonus: Math.round(base.p50 * multiplier * 0.1),
    equityRange: {
      min: 0.01,
      max: experienceLevel === 'staff' ? 0.5 : experienceLevel === 'senior' ? 0.25 : 0.1,
    },
    source: 'wells_ai_market_model',
    asOfDate: new Date(),
  };
}

// ============================================================================
// CONVERSATION HELPERS
// ============================================================================

/**
 * Generate a conversational response for offer negotiation
 */
export function generateNegotiationResponse(
  analysis: OfferAnalysis,
  userIntent: 'accept' | 'counter' | 'reject' | 'ask_advice'
): string {
  const { offer, recommendation, suggestedCounter, negotiationRisk } = analysis;

  switch (userIntent) {
    case 'accept':
      if (recommendation === 'negotiate') {
        return `You can accept, but this is ${analysis.salaryGapPercent.toFixed(0)}% below your target. Want me to counter first? There's ${negotiationRisk === 'low' ? 'low' : 'some'} risk in trying.`;
      }
      return `Great choice! I'll send the acceptance. Looking forward to your start date!`;

    case 'counter':
      if (suggestedCounter) {
        return `I'll counter at $${suggestedCounter.baseSalary.toLocaleString()}${suggestedCounter.signingBonus ? ` + $${suggestedCounter.signingBonus.toLocaleString()} signing bonus` : ''}. My rationale: "${suggestedCounter.rationale}"`;
      }
      return `What salary would you like to counter with? Based on market data, I'd suggest around $${Math.round(offer.baseSalary * 1.1 / 1000) * 1000}.`;

    case 'reject':
      if (recommendation !== 'reject') {
        return `This offer is worth considering - it's ${analysis.meetsMinSalary ? 'above' : 'close to'} your minimum. Sure you want to walk away?`;
      }
      return `Understood. I'll politely decline and keep searching for better opportunities.`;

    case 'ask_advice':
    default:
      if (recommendation === 'accept') {
        return `This is a strong offer! $${offer.baseSalary.toLocaleString()} meets your target, and the total first-year comp of $${offer.totalFirstYearComp.toLocaleString()} is solid. I'd recommend accepting.`;
      } else if (recommendation === 'negotiate') {
        return `The offer of $${offer.baseSalary.toLocaleString()} is ${analysis.salaryGapPercent.toFixed(0)}% below your target. ${negotiationRisk === 'low' ? "There's room to negotiate safely." : "Negotiating has some risk, but I think it's worth trying."} Want me to counter at $${suggestedCounter?.baseSalary.toLocaleString()}?`;
      } else {
        return `The offer is close to your target. It's really your call - I'd slightly lean toward ${analysis.salaryGapPercent < 5 ? 'accepting' : 'a small counter'}. What feels right?`;
      }
  }
}

export default {
  // Analysis
  analyzeOffer,
  autoNegotiate,
  getMarketData,

  // History
  getNegotiationHistory,

  // Helpers
  generateNegotiationResponse,
};
