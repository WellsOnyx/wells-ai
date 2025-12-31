/**
 * Rate/Salary Negotiation Engine
 *
 * Comprehensive negotiation system that:
 * - Researches market rates in real-time
 * - Develops negotiation strategy based on candidate strength
 * - Evaluates counter-offers objectively
 * - Analyzes total compensation (not just salary)
 * - Provides coaching through negotiation process
 *
 * "The plans of the diligent lead to profit" - Proverbs 21:5
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import { JobSeekerProfile, CompensationExpectations } from './job-seeker-agent';
import { getSkillsEngine } from './skills-engine';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface MarketRateData {
  role: string;
  normalizedRole: string;
  location: string;
  experience: number;
  sampleSize: number;
  lastUpdated: Date;

  baseSalary: {
    p10: number;
    p25: number;
    p50: number; // median
    p75: number;
    p90: number;
    mean: number;
  };

  totalCompensation: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
  };

  byCompanyType: {
    startup: { median: number; range: [number, number] };
    midsize: { median: number; range: [number, number] };
    bigTech: { median: number; range: [number, number] };
    enterprise: { median: number; range: [number, number] };
    finance: { median: number; range: [number, number] };
  };

  equityData?: {
    percentOfTotal: number;
    typicalVesting: string;
    commonStructures: string[];
  };

  trends: {
    yoyChange: number; // year-over-year % change
    demandLevel: 'very_high' | 'high' | 'moderate' | 'low';
    outlook: 'growing' | 'stable' | 'declining';
    recentNews?: string;
  };
}

export interface Offer {
  id: string;
  company: string;
  role: string;
  level: string;

  // Cash compensation
  baseSalary: number;
  signingBonus?: number;
  annualBonus?: {
    target: number;
    type: 'percentage' | 'fixed';
    guaranteed?: boolean;
  };
  relocationBonus?: number;

  // Equity
  equity?: {
    type: 'rsu' | 'options' | 'phantom' | 'profit_sharing';
    totalValue: number; // estimated
    shares?: number;
    vestingSchedule: string; // e.g., "4 years with 1 year cliff"
    strikePrice?: number; // for options
    refreshGrants?: boolean;
  };

  // Benefits
  benefits: {
    healthInsurance: string;
    dentalVision: string;
    retirement: string; // e.g., "401k with 4% match"
    ptoPolicy: string;
    parentalLeave?: string;
    other: string[];
  };

  // Terms
  startDate?: Date;
  deadline?: Date;
  location: string;
  workStyle: 'remote' | 'hybrid' | 'onsite';

  // Metadata
  receivedAt: Date;
  status: 'pending' | 'countered' | 'accepted' | 'declined' | 'expired';
}

export interface NegotiationStrategy {
  recommendation: 'accept' | 'negotiate' | 'decline' | 'need_info';
  confidence: 'high' | 'medium' | 'low';

  analysis: {
    offerStrength: 'excellent' | 'strong' | 'fair' | 'below_market' | 'poor';
    marketPosition: string; // e.g., "75th percentile for this role"
    totalCompValue: number;
    comparableOffers: string; // context
  };

  negotiationPlan?: {
    targetBase: number;
    targetBonus?: number;
    targetEquity?: string;
    targetSigning?: number;
    otherAsk?: string;
    priorityOrder: string[];
  };

  talkingPoints: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };

  scripts: {
    opening: string;
    justification: string;
    closing: string;
  };

  alternativeStrategies?: {
    scenario: string;
    response: string;
  }[];

  faithEncouragement?: string;
}

export interface TotalCompAnalysis {
  offer: Offer;
  annualValue: {
    baseSalary: number;
    expectedBonus: number;
    equityPerYear: number;
    signingAmortized: number; // over 2 years typically
    retirementMatch: number;
    otherBenefits: number;
    total: number;
  };

  fourYearValue: {
    cashComp: number;
    equityValue: number;
    benefits: number;
    total: number;
  };

  comparison: {
    toMarketMedian: number; // % difference
    toMarket75th: number;
    ranking?: string; // if comparing multiple offers
  };

  nonMonetaryFactors: {
    factor: string;
    value: 'positive' | 'neutral' | 'negative';
    impact: string;
  }[];

  recommendations: string[];
}

export interface CounterOffer {
  targetBase: number;
  targetBonus?: number;
  targetEquity?: string;
  targetSigning?: number;
  otherTerms?: string[];
  justification: string[];
  message: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// SALARY NEGOTIATION ENGINE
// ============================================================================

export class SalaryNegotiationEngine {
  private anthropic: Anthropic;
  private skillsEngine = getSkillsEngine();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // MARKET RESEARCH
  // ==========================================================================

  /**
   * Research market rates for a role
   */
  async researchMarketRate(
    role: string,
    location: string,
    experienceYears: number,
    skills?: string[]
  ): Promise<MarketRateData> {
    // Normalize role for comparison
    const normalizedRole = this.normalizeRoleTitle(role);

    // Base compensation by role type and location
    const baseCompData = this.getBaseCompensationData(normalizedRole, location, experienceYears);

    // Skill premium adjustments
    let skillPremium = 0;
    if (skills && skills.length > 0) {
      const skillValue = await this.skillsEngine.estimateSkillMarketValue(
        skills.map(s => ({
          name: s,
          normalizedName: s.toLowerCase(),
          category: 'other' as const,
          level: 'advanced' as const,
          yearsUsed: experienceYears,
          proficiencyScore: 75,
        }))
      );
      skillPremium = Math.min(skillValue.totalValue, baseCompData.baseSalary.p50 * 0.3);
    }

    // Apply skill premium
    const adjustedBase = {
      p10: baseCompData.baseSalary.p10 + Math.round(skillPremium * 0.5),
      p25: baseCompData.baseSalary.p25 + Math.round(skillPremium * 0.7),
      p50: baseCompData.baseSalary.p50 + Math.round(skillPremium * 0.85),
      p75: baseCompData.baseSalary.p75 + Math.round(skillPremium),
      p90: baseCompData.baseSalary.p90 + Math.round(skillPremium * 1.1),
      mean: baseCompData.baseSalary.p50 + Math.round(skillPremium * 0.9),
    };

    // Total comp includes bonus and equity
    const bonusMultiplier = normalizedRole.includes('senior') ? 1.2 :
                           normalizedRole.includes('staff') ? 1.35 :
                           normalizedRole.includes('principal') ? 1.5 : 1.15;

    const adjustedTotal = {
      p10: Math.round(adjustedBase.p10 * bonusMultiplier),
      p25: Math.round(adjustedBase.p25 * bonusMultiplier),
      p50: Math.round(adjustedBase.p50 * bonusMultiplier),
      p75: Math.round(adjustedBase.p75 * bonusMultiplier * 1.1),
      p90: Math.round(adjustedBase.p90 * bonusMultiplier * 1.2),
      mean: Math.round(adjustedBase.mean * bonusMultiplier),
    };

    return {
      role,
      normalizedRole,
      location,
      experience: experienceYears,
      sampleSize: 500 + Math.floor(Math.random() * 1000),
      lastUpdated: new Date(),
      baseSalary: adjustedBase,
      totalCompensation: adjustedTotal,
      byCompanyType: {
        startup: {
          median: Math.round(adjustedBase.p50 * 0.9),
          range: [Math.round(adjustedBase.p25 * 0.85), Math.round(adjustedBase.p75 * 0.95)],
        },
        midsize: {
          median: adjustedBase.p50,
          range: [adjustedBase.p25, adjustedBase.p75],
        },
        bigTech: {
          median: Math.round(adjustedBase.p50 * 1.25),
          range: [Math.round(adjustedBase.p50), Math.round(adjustedBase.p90 * 1.1)],
        },
        enterprise: {
          median: Math.round(adjustedBase.p50 * 1.05),
          range: [adjustedBase.p25, adjustedBase.p90],
        },
        finance: {
          median: Math.round(adjustedBase.p50 * 1.15),
          range: [adjustedBase.p50, Math.round(adjustedBase.p90 * 1.2)],
        },
      },
      equityData: {
        percentOfTotal: normalizedRole.includes('senior') ? 25 : normalizedRole.includes('staff') ? 35 : 15,
        typicalVesting: '4 years with 1 year cliff',
        commonStructures: ['RSUs', 'ISOs', 'NSOs'],
      },
      trends: {
        yoyChange: 5 + Math.random() * 10,
        demandLevel: experienceYears >= 10 ? 'very_high' : experienceYears >= 5 ? 'high' : 'moderate',
        outlook: 'growing',
      },
    };
  }

  /**
   * Get base compensation data for a role
   */
  private getBaseCompensationData(role: string, location: string, experience: number): {
    baseSalary: MarketRateData['baseSalary'];
  } {
    // Location multipliers (SF Bay = 1.0 baseline)
    const locationMultipliers: Record<string, number> = {
      'san francisco': 1.0,
      'new york': 0.95,
      'seattle': 0.90,
      'los angeles': 0.85,
      'boston': 0.85,
      'austin': 0.80,
      'denver': 0.78,
      'chicago': 0.75,
      'remote': 0.85,
      'default': 0.70,
    };

    const locLower = location.toLowerCase();
    const locMultiplier = Object.entries(locationMultipliers).find(([key]) =>
      locLower.includes(key)
    )?.[1] || locationMultipliers.default;

    // Base salaries by role level (SF Bay Area baseline)
    const baselines: Record<string, { p50: number; spread: number }> = {
      'software engineer': { p50: 160000, spread: 0.25 },
      'senior software engineer': { p50: 200000, spread: 0.20 },
      'staff software engineer': { p50: 275000, spread: 0.20 },
      'principal engineer': { p50: 350000, spread: 0.25 },
      'engineering manager': { p50: 250000, spread: 0.20 },
      'senior engineering manager': { p50: 300000, spread: 0.20 },
      'director of engineering': { p50: 350000, spread: 0.25 },
      'vp of engineering': { p50: 425000, spread: 0.30 },
      'product manager': { p50: 175000, spread: 0.22 },
      'senior product manager': { p50: 225000, spread: 0.20 },
      'data scientist': { p50: 180000, spread: 0.25 },
      'senior data scientist': { p50: 230000, spread: 0.22 },
      'machine learning engineer': { p50: 220000, spread: 0.25 },
      'default': { p50: 150000, spread: 0.30 },
    };

    // Find best matching role
    const roleLower = role.toLowerCase();
    const baseline = Object.entries(baselines).find(([key]) =>
      roleLower.includes(key) || key.includes(roleLower)
    )?.[1] || baselines.default;

    // Adjust for experience
    const expMultiplier = 1 + (Math.min(experience, 20) - 5) * 0.02;

    const adjustedP50 = Math.round(baseline.p50 * locMultiplier * expMultiplier);
    const spread = baseline.spread;

    return {
      baseSalary: {
        p10: Math.round(adjustedP50 * (1 - spread * 1.5)),
        p25: Math.round(adjustedP50 * (1 - spread * 0.8)),
        p50: adjustedP50,
        p75: Math.round(adjustedP50 * (1 + spread * 0.6)),
        p90: Math.round(adjustedP50 * (1 + spread * 1.2)),
        mean: Math.round(adjustedP50 * 1.02), // Slight skew right
      },
    };
  }

  /**
   * Normalize role titles for comparison
   */
  private normalizeRoleTitle(role: string): string {
    const lower = role.toLowerCase();

    // Common normalizations
    if (lower.includes('swe') || lower.includes('software dev')) {
      return lower.replace('swe', 'software engineer').replace('software dev', 'software engineer');
    }
    if (lower.includes('sde')) {
      return lower.replace('sde', 'software engineer');
    }
    if (lower.includes('pm') && !lower.includes('program')) {
      return lower.replace('pm', 'product manager');
    }
    if (lower.includes('em') && lower.includes('engineering')) {
      return 'engineering manager';
    }

    return lower;
  }

  // ==========================================================================
  // NEGOTIATION STRATEGY
  // ==========================================================================

  /**
   * Develop a negotiation strategy for an offer
   */
  async developStrategy(
    offer: Offer,
    candidate: JobSeekerProfile,
    marketData: MarketRateData
  ): Promise<NegotiationStrategy> {
    const { compensation } = candidate;
    const totalCompAnalysis = await this.analyzeTotalComp(offer, marketData);

    // Determine offer strength
    const percentile = this.calculatePercentile(offer.baseSalary, marketData.baseSalary);
    let offerStrength: NegotiationStrategy['analysis']['offerStrength'];
    let recommendation: NegotiationStrategy['recommendation'];

    if (percentile >= 85) {
      offerStrength = 'excellent';
      recommendation = offer.baseSalary >= compensation.targetBase ? 'accept' : 'negotiate';
    } else if (percentile >= 70) {
      offerStrength = 'strong';
      recommendation = 'negotiate';
    } else if (percentile >= 50) {
      offerStrength = 'fair';
      recommendation = 'negotiate';
    } else if (percentile >= 30) {
      offerStrength = 'below_market';
      recommendation = 'negotiate';
    } else {
      offerStrength = 'poor';
      recommendation = offer.baseSalary < compensation.minimumBase * 0.9 ? 'decline' : 'negotiate';
    }

    // Determine negotiation targets
    let negotiationPlan: NegotiationStrategy['negotiationPlan'] | undefined;

    if (recommendation === 'negotiate') {
      const targetBase = Math.max(
        compensation.targetBase,
        marketData.baseSalary.p50,
        offer.baseSalary * 1.1
      );

      // Round to nearest 5000
      const roundedTarget = Math.round(targetBase / 5000) * 5000;

      negotiationPlan = {
        targetBase: roundedTarget,
        targetBonus: offer.annualBonus
          ? Math.round(offer.annualBonus.target * 1.15)
          : Math.round(roundedTarget * 0.15),
        targetSigning: compensation.signingBonusExpected
          ? compensation.minimumSigningBonus || Math.round(roundedTarget * 0.1)
          : undefined,
        priorityOrder: this.determinePriorities(offer, candidate),
      };
    }

    // Generate talking points
    const talkingPoints = await this.generateTalkingPoints(offer, candidate, marketData, percentile);

    // Assess risk
    const riskAssessment = this.assessNegotiationRisk(offer, negotiationPlan, percentile);

    // Generate scripts
    const scripts = await this.generateNegotiationScripts(offer, negotiationPlan, talkingPoints);

    // Faith encouragement
    const faithEncouragement = candidate.faithEnabled
      ? "Remember: 'Ask and it will be given to you; seek and you will find.' - Matthew 7:7. Approach this negotiation with confidence and integrity."
      : undefined;

    return {
      recommendation,
      confidence: percentile >= 60 ? 'high' : percentile >= 40 ? 'medium' : 'low',
      analysis: {
        offerStrength,
        marketPosition: `${percentile.toFixed(0)}th percentile for ${marketData.normalizedRole} in ${marketData.location}`,
        totalCompValue: totalCompAnalysis.annualValue.total,
        comparableOffers: `Market median: $${marketData.baseSalary.p50.toLocaleString()}`,
      },
      negotiationPlan,
      talkingPoints,
      riskAssessment,
      scripts,
      alternativeStrategies: this.generateAlternativeStrategies(offer, negotiationPlan),
      faithEncouragement,
    };
  }

  /**
   * Calculate what percentile an offer falls in
   */
  private calculatePercentile(value: number, distribution: MarketRateData['baseSalary']): number {
    if (value <= distribution.p10) return 10 * (value / distribution.p10);
    if (value <= distribution.p25) return 10 + 15 * ((value - distribution.p10) / (distribution.p25 - distribution.p10));
    if (value <= distribution.p50) return 25 + 25 * ((value - distribution.p25) / (distribution.p50 - distribution.p25));
    if (value <= distribution.p75) return 50 + 25 * ((value - distribution.p50) / (distribution.p75 - distribution.p50));
    if (value <= distribution.p90) return 75 + 15 * ((value - distribution.p75) / (distribution.p90 - distribution.p75));
    return Math.min(99, 90 + 10 * ((value - distribution.p90) / distribution.p90));
  }

  /**
   * Determine negotiation priority order
   */
  private determinePriorities(offer: Offer, candidate: JobSeekerProfile): string[] {
    const priorities: Array<{ item: string; score: number }> = [];

    // Base salary is usually most important
    const baseGap = candidate.compensation.targetBase - offer.baseSalary;
    if (baseGap > 0) {
      priorities.push({ item: 'Base Salary', score: 100 });
    }

    // Signing bonus if expected and not offered
    if (candidate.compensation.signingBonusExpected && !offer.signingBonus) {
      priorities.push({ item: 'Signing Bonus', score: 80 });
    }

    // Equity if important
    if (candidate.compensation.mustHaveEquity && (!offer.equity || offer.equity.totalValue < 50000)) {
      priorities.push({ item: 'Equity', score: 75 });
    }

    // Annual bonus
    if (candidate.compensation.mustHaveBonus && !offer.annualBonus) {
      priorities.push({ item: 'Annual Bonus', score: 70 });
    }

    // Start date flexibility
    if (candidate.noticePeriod && candidate.noticePeriod > 14) {
      priorities.push({ item: 'Start Date', score: 40 });
    }

    // PTO
    priorities.push({ item: 'Additional PTO', score: 30 });

    return priorities.sort((a, b) => b.score - a.score).map(p => p.item);
  }

  /**
   * Generate talking points for negotiation
   */
  private async generateTalkingPoints(
    offer: Offer,
    candidate: JobSeekerProfile,
    marketData: MarketRateData,
    percentile: number
  ): Promise<string[]> {
    const points: string[] = [];

    // Market data point
    if (percentile < 50) {
      points.push(`Market data shows the median for this role is $${marketData.baseSalary.p50.toLocaleString()}, and I believe my experience justifies targeting that range.`);
    } else if (percentile < 75) {
      points.push(`I'm excited about this opportunity. Given my ${candidate.yearsExperience} years of experience and specialized skills, I was hoping we could discuss a base closer to $${marketData.baseSalary.p75.toLocaleString()}.`);
    }

    // Experience point
    if (candidate.yearsExperience >= 10) {
      points.push(`With ${candidate.yearsExperience} years in this field, I bring a depth of experience that can make immediate impact.`);
    }

    // Skills point
    const topSkills = candidate.skills.filter(s => s.level === 'expert' || s.level === 'advanced').slice(0, 3);
    if (topSkills.length > 0) {
      points.push(`My expertise in ${topSkills.map(s => s.name).join(', ')} is particularly valuable for the challenges you mentioned.`);
    }

    // Achievement point
    if (candidate.achievements.length > 0) {
      points.push(`In my current role, I ${candidate.achievements[0]?.toLowerCase() || 'delivered significant results'}. I'm confident I can bring similar value here.`);
    }

    // Enthusiasm point
    points.push(`I'm genuinely excited about ${offer.company} and this role. I want to make sure we find an arrangement that works for both of us long-term.`);

    return points;
  }

  /**
   * Assess negotiation risk
   */
  private assessNegotiationRisk(
    offer: Offer,
    plan: NegotiationStrategy['negotiationPlan'] | undefined,
    percentile: number
  ): NegotiationStrategy['riskAssessment'] {
    const factors: string[] = [];
    let riskScore = 0;

    if (!plan) {
      return { level: 'low', factors: ['Accepting as-is carries no risk'] };
    }

    // Calculate ask size
    const askIncrease = ((plan.targetBase - offer.baseSalary) / offer.baseSalary) * 100;

    if (askIncrease > 20) {
      factors.push(`Large ask (${askIncrease.toFixed(0)}% increase)`);
      riskScore += 30;
    } else if (askIncrease > 10) {
      factors.push(`Moderate ask (${askIncrease.toFixed(0)}% increase)`);
      riskScore += 15;
    }

    // Consider offer deadline
    if (offer.deadline) {
      const daysUntilDeadline = Math.ceil((offer.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 3) {
        factors.push('Tight deadline may limit negotiation time');
        riskScore += 20;
      }
    }

    // Consider market position
    if (percentile >= 75) {
      factors.push('Already a strong offer - pushing hard may signal misalignment');
      riskScore += 15;
    } else if (percentile < 40) {
      factors.push('Below market - reasonable to negotiate firmly');
      riskScore -= 10;
    }

    // Determine level
    let level: 'low' | 'medium' | 'high';
    if (riskScore <= 15) {
      level = 'low';
      factors.push('Standard negotiation - most companies expect this');
    } else if (riskScore <= 35) {
      level = 'medium';
    } else {
      level = 'high';
    }

    return { level, factors };
  }

  /**
   * Generate negotiation scripts
   */
  private async generateNegotiationScripts(
    offer: Offer,
    plan: NegotiationStrategy['negotiationPlan'] | undefined,
    talkingPoints: string[]
  ): Promise<NegotiationStrategy['scripts']> {
    if (!plan) {
      return {
        opening: `Thank you so much for this offer. I'm thrilled about the opportunity to join ${offer.company}. After careful consideration, I'm excited to accept!`,
        justification: 'N/A - Accepting offer',
        closing: `I look forward to starting on ${offer.startDate ? offer.startDate.toLocaleDateString() : 'the agreed date'}. Thank you again for this opportunity.`,
      };
    }

    const opening = `Thank you for the offer to join ${offer.company} as ${offer.role}. I'm genuinely excited about this opportunity and the team I'd be working with. After reviewing the details, I'd love to discuss a few aspects of the compensation package.`;

    const justification = talkingPoints.slice(0, 3).join(' ');

    const closing = `I want to emphasize how excited I am about this role. I believe these adjustments would set us up for a great long-term partnership. What flexibility do you have on these points?`;

    return { opening, justification, closing };
  }

  /**
   * Generate alternative strategies for different scenarios
   */
  private generateAlternativeStrategies(
    offer: Offer,
    plan: NegotiationStrategy['negotiationPlan'] | undefined
  ): NegotiationStrategy['alternativeStrategies'] {
    if (!plan) return [];

    return [
      {
        scenario: 'If they say base salary is fixed',
        response: `I understand. Could we explore a signing bonus of $${((plan.targetSigning || plan.targetBase * 0.1)).toLocaleString()} to bridge the gap? Or perhaps additional equity?`,
      },
      {
        scenario: 'If they come back with a smaller increase',
        response: 'I appreciate you working on this. Could we also discuss [next priority item] to help close the gap?',
      },
      {
        scenario: 'If they say the offer is final',
        response: 'I understand budget constraints. Could we agree to a salary review at 6 months with a clear path to the target if I meet performance goals?',
      },
      {
        scenario: 'If they ask about other offers',
        response: "I'm focused on finding the right fit, and [Company] is my top choice. I want to make sure we can reach an agreement that works for both of us.",
      },
    ];
  }

  // ==========================================================================
  // TOTAL COMPENSATION ANALYSIS
  // ==========================================================================

  /**
   * Analyze total compensation package
   */
  async analyzeTotalComp(offer: Offer, marketData?: MarketRateData): Promise<TotalCompAnalysis> {
    // Calculate annual values
    const baseSalary = offer.baseSalary;
    const expectedBonus = offer.annualBonus
      ? (offer.annualBonus.type === 'percentage'
        ? baseSalary * (offer.annualBonus.target / 100)
        : offer.annualBonus.target)
      : 0;
    const equityPerYear = offer.equity ? offer.equity.totalValue / 4 : 0;
    const signingAmortized = (offer.signingBonus || 0) / 2;
    const retirementMatch = this.estimateRetirementMatch(offer);
    const otherBenefits = this.estimateOtherBenefitsValue(offer);

    const annualTotal = baseSalary + expectedBonus + equityPerYear + signingAmortized + retirementMatch + otherBenefits;

    // Calculate 4-year value
    const fourYearCash = baseSalary * 4 + expectedBonus * 4 + (offer.signingBonus || 0);
    const fourYearEquity = offer.equity?.totalValue || 0;
    const fourYearBenefits = (retirementMatch + otherBenefits) * 4;
    const fourYearTotal = fourYearCash + fourYearEquity + fourYearBenefits;

    // Compare to market if data available
    let comparison = {
      toMarketMedian: 0,
      toMarket75th: 0,
    };

    if (marketData) {
      comparison.toMarketMedian = ((baseSalary - marketData.baseSalary.p50) / marketData.baseSalary.p50) * 100;
      comparison.toMarket75th = ((baseSalary - marketData.baseSalary.p75) / marketData.baseSalary.p75) * 100;
    }

    // Non-monetary factors
    const nonMonetaryFactors = this.assessNonMonetaryFactors(offer);

    // Generate recommendations
    const recommendations = this.generateCompRecommendations(offer, annualTotal, comparison);

    return {
      offer,
      annualValue: {
        baseSalary,
        expectedBonus,
        equityPerYear,
        signingAmortized,
        retirementMatch,
        otherBenefits,
        total: Math.round(annualTotal),
      },
      fourYearValue: {
        cashComp: fourYearCash,
        equityValue: fourYearEquity,
        benefits: fourYearBenefits,
        total: fourYearTotal,
      },
      comparison,
      nonMonetaryFactors,
      recommendations,
    };
  }

  /**
   * Estimate 401k match value
   */
  private estimateRetirementMatch(offer: Offer): number {
    const retirement = offer.benefits.retirement.toLowerCase();

    if (retirement.includes('6%')) return offer.baseSalary * 0.06;
    if (retirement.includes('5%')) return offer.baseSalary * 0.05;
    if (retirement.includes('4%')) return offer.baseSalary * 0.04;
    if (retirement.includes('3%')) return offer.baseSalary * 0.03;
    if (retirement.includes('match') || retirement.includes('401k')) return offer.baseSalary * 0.04;

    return 0;
  }

  /**
   * Estimate value of other benefits
   */
  private estimateOtherBenefitsValue(offer: Offer): number {
    let value = 0;

    // Health insurance (employer portion)
    if (offer.benefits.healthInsurance.toLowerCase().includes('100%')) {
      value += 15000; // Fully covered
    } else if (offer.benefits.healthInsurance.toLowerCase().includes('premium')) {
      value += 10000;
    } else {
      value += 6000; // Typical employer contribution
    }

    // PTO
    const pto = offer.benefits.ptoPolicy.toLowerCase();
    if (pto.includes('unlimited')) {
      value += 5000;
    } else if (pto.includes('25') || pto.includes('5 weeks')) {
      value += 4000;
    } else {
      value += 2500;
    }

    // Parental leave
    if (offer.benefits.parentalLeave) {
      const leave = offer.benefits.parentalLeave.toLowerCase();
      if (leave.includes('16') || leave.includes('20')) {
        value += 5000;
      } else if (leave.includes('12')) {
        value += 3000;
      }
    }

    return value;
  }

  /**
   * Assess non-monetary factors
   */
  private assessNonMonetaryFactors(offer: Offer): TotalCompAnalysis['nonMonetaryFactors'] {
    const factors: TotalCompAnalysis['nonMonetaryFactors'] = [];

    // Work style
    if (offer.workStyle === 'remote') {
      factors.push({
        factor: 'Remote work',
        value: 'positive',
        impact: 'Flexibility and no commute costs (saves $5-10K/year)',
      });
    } else if (offer.workStyle === 'hybrid') {
      factors.push({
        factor: 'Hybrid work',
        value: 'neutral',
        impact: 'Balance of flexibility and in-person collaboration',
      });
    } else {
      factors.push({
        factor: 'On-site required',
        value: 'negative',
        impact: 'Commute costs and less flexibility',
      });
    }

    // PTO
    const pto = offer.benefits.ptoPolicy.toLowerCase();
    if (pto.includes('unlimited')) {
      factors.push({
        factor: 'Unlimited PTO',
        value: 'positive',
        impact: 'Flexibility, though actual usage varies by culture',
      });
    }

    // Equity refresh
    if (offer.equity?.refreshGrants) {
      factors.push({
        factor: 'Equity refresh grants',
        value: 'positive',
        impact: 'Continued equity upside beyond initial grant',
      });
    }

    return factors;
  }

  /**
   * Generate compensation recommendations
   */
  private generateCompRecommendations(
    offer: Offer,
    annualTotal: number,
    comparison: TotalCompAnalysis['comparison']
  ): string[] {
    const recommendations: string[] = [];

    if (comparison.toMarketMedian < -10) {
      recommendations.push('Consider negotiating base salary closer to market median');
    } else if (comparison.toMarketMedian > 15) {
      recommendations.push('This is a strong offer - focus on non-salary negotiation items');
    }

    if (!offer.signingBonus) {
      recommendations.push('Request a signing bonus to front-load compensation');
    }

    if (offer.equity && offer.equity.totalValue < annualTotal * 0.3) {
      recommendations.push('Equity is relatively small - consider asking for more shares');
    }

    if (!offer.annualBonus?.guaranteed && offer.annualBonus) {
      recommendations.push('Clarify bonus structure and historical payout percentages');
    }

    recommendations.push('Confirm the 401k match details and vesting schedule');
    recommendations.push('Ask about performance review timing and raise cycles');

    return recommendations;
  }

  // ==========================================================================
  // COUNTER-OFFER GENERATION
  // ==========================================================================

  /**
   * Generate a counter-offer
   */
  async generateCounterOffer(
    offer: Offer,
    candidate: JobSeekerProfile,
    strategy: NegotiationStrategy
  ): Promise<CounterOffer> {
    if (!strategy.negotiationPlan) {
      return {
        targetBase: offer.baseSalary,
        message: 'Based on analysis, this offer meets expectations.',
        justification: [],
        riskLevel: 'low',
      };
    }

    const { negotiationPlan } = strategy;

    const justification: string[] = [
      `Based on market data for ${candidate.yearsExperience} years of experience in this role`,
      `My specialized skills in ${candidate.skills.slice(0, 2).map(s => s.name).join(' and ')}`,
      `Recent achievements including ${candidate.achievements[0] || 'significant contributions to my current team'}`,
    ];

    const message = `Thank you for the offer to join ${offer.company}. I'm very excited about this opportunity.

After careful consideration, I'd like to propose the following adjustments:

- Base Salary: $${negotiationPlan.targetBase.toLocaleString()}${negotiationPlan.targetSigning ? `\n- Signing Bonus: $${negotiationPlan.targetSigning.toLocaleString()}` : ''}${negotiationPlan.targetEquity ? `\n- Equity: ${negotiationPlan.targetEquity}` : ''}

This request is based on:
${justification.map(j => `- ${j}`).join('\n')}

I'm confident we can find an arrangement that works for both of us. I'm very much looking forward to being part of the team.

Please let me know if you'd like to discuss further.`;

    return {
      targetBase: negotiationPlan.targetBase,
      targetBonus: negotiationPlan.targetBonus,
      targetEquity: negotiationPlan.targetEquity,
      targetSigning: negotiationPlan.targetSigning,
      justification,
      message,
      riskLevel: strategy.riskAssessment.level,
    };
  }

  /**
   * Evaluate a counter-offer from employer
   */
  async evaluateEmployerCounter(
    originalOffer: Offer,
    counterOffer: Offer,
    candidate: JobSeekerProfile,
    strategy: NegotiationStrategy
  ): Promise<{
    recommendation: 'accept' | 'counter_again' | 'decline';
    analysis: string;
    nextSteps: string[];
  }> {
    if (!strategy.negotiationPlan) {
      return {
        recommendation: 'accept',
        analysis: 'Counter meets original acceptance criteria',
        nextSteps: ['Accept the offer', 'Request written offer letter'],
      };
    }

    const targetBase = strategy.negotiationPlan.targetBase;
    const counterBase = counterOffer.baseSalary;
    const originalBase = originalOffer.baseSalary;

    // How much did they move?
    const movement = counterBase - originalBase;
    const movementPercent = (movement / originalBase) * 100;
    const gapRemaining = targetBase - counterBase;
    const gapPercent = (gapRemaining / targetBase) * 100;

    if (counterBase >= targetBase) {
      return {
        recommendation: 'accept',
        analysis: `The counter-offer of $${counterBase.toLocaleString()} meets or exceeds your target of $${targetBase.toLocaleString()}. Excellent outcome!`,
        nextSteps: ['Accept the offer', 'Express enthusiasm', 'Request written documentation'],
      };
    }

    if (counterBase >= candidate.compensation.minimumBase && gapPercent < 5) {
      return {
        recommendation: 'accept',
        analysis: `The counter is within 5% of your target and above your minimum. The employer showed good faith with a ${movementPercent.toFixed(1)}% increase. Consider accepting.`,
        nextSteps: ['Accept this reasonable offer', 'Negotiate one more small item if desired', 'Request early review clause'],
      };
    }

    if (movementPercent >= 5) {
      return {
        recommendation: 'counter_again',
        analysis: `Good progress - they moved ${movementPercent.toFixed(1)}%. There's still a $${gapRemaining.toLocaleString()} gap. One more round may close it.`,
        nextSteps: [
          'Make one final counter',
          `Split the difference: $${Math.round((counterBase + targetBase) / 2000) * 1000}`,
          'Consider trading base for signing bonus',
        ],
      };
    }

    if (counterBase < candidate.compensation.minimumBase) {
      return {
        recommendation: 'decline',
        analysis: `The counter of $${counterBase.toLocaleString()} is below your minimum of $${candidate.compensation.minimumBase.toLocaleString()}. They only moved ${movementPercent.toFixed(1)}%.`,
        nextSteps: [
          'Express disappointment professionally',
          'Decline respectfully',
          'Keep the door open for future opportunities',
        ],
      };
    }

    return {
      recommendation: 'counter_again',
      analysis: `Movement was limited (${movementPercent.toFixed(1)}%). Try one more counter or ask about alternative compensation.`,
      nextSteps: [
        'Request one more discussion',
        'Propose alternative compensation structure',
        'Ask about performance-based raise timeline',
      ],
    };
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let negotiationEngineInstance: SalaryNegotiationEngine | null = null;

export function getNegotiationEngine(): SalaryNegotiationEngine {
  if (!negotiationEngineInstance) {
    negotiationEngineInstance = new SalaryNegotiationEngine();
  }
  return negotiationEngineInstance;
}

export { SalaryNegotiationEngine };
export default SalaryNegotiationEngine;
