/**
 * Credit Scoring Engine
 * Wells AI: Proprietary credit scoring leveraging transaction visibility
 */

import { sql } from '@vercel/postgres';
import { TransactionAnalysis } from './plaid';
import { FinancialRatios, RevenueTrends, ARAPAnalysis } from './codat';

// Types
export interface CreditScoreInputs {
  // Bank data (from Plaid)
  bankData?: TransactionAnalysis;

  // Accounting data (from Codat)
  financialRatios?: FinancialRatios;
  revenueTrends?: RevenueTrends;
  arapAnalysis?: ARAPAnalysis;

  // Wells platform history
  wellsHistory?: WellsTransactionHistory;

  // Business info
  industry?: string;
  businessAge?: number; // months
}

export interface WellsTransactionHistory {
  totalVolume: number;
  transactionCount: number;
  avgTransactionSize: number;
  monthsActive: number;
  disputeRate: number;
  chargebackRate: number;
  avgSettlementTime: number; // days
  topCustomers: { name: string; volume: number }[];
  topSuppliers: { name: string; volume: number }[];
}

export interface CreditScore {
  score: number; // 0-1000
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  riskTier: 'prime' | 'near_prime' | 'subprime' | 'high_risk';

  // Recommended terms
  recommendedLimit: number;
  recommendedAPR: number;

  // Score breakdown
  breakdown: {
    cashFlowScore: number; // 40%
    revenueGrowthScore: number; // 20%
    wellsHistoryScore: number; // 20%
    accountAgeScore: number; // 10%
    industryRiskScore: number; // 10%
  };

  // Confidence and factors
  confidence: number; // 0-1
  positiveFactors: string[];
  negativeFactors: string[];
  missingData: string[];
}

// Industry risk multipliers
const INDUSTRY_RISK: Record<string, number> = {
  'software': 0.8,
  'saas': 0.7,
  'technology': 0.8,
  'professional_services': 0.85,
  'healthcare': 0.9,
  'manufacturing': 1.0,
  'retail': 1.1,
  'restaurant': 1.3,
  'construction': 1.2,
  'real_estate': 1.15,
  'default': 1.0,
};

/**
 * Calculate comprehensive credit score
 */
export async function calculateCreditScore(
  userId: string,
  inputs: CreditScoreInputs
): Promise<CreditScore> {
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const missingData: string[] = [];

  // 1. Cash Flow Score (40 points max)
  let cashFlowScore = 0;
  if (inputs.bankData) {
    cashFlowScore = scoreCashFlow(inputs.bankData, positiveFactors, negativeFactors);
  } else if (inputs.financialRatios) {
    // Fallback to accounting data
    cashFlowScore = scoreCashFlowFromAccounting(
      inputs.financialRatios,
      positiveFactors,
      negativeFactors
    );
  } else {
    missingData.push('Cash flow data');
    cashFlowScore = 0;
  }

  // 2. Revenue Growth Score (20 points max)
  let revenueGrowthScore = 0;
  if (inputs.revenueTrends) {
    revenueGrowthScore = scoreRevenueGrowth(inputs.revenueTrends, positiveFactors, negativeFactors);
  } else if (inputs.bankData) {
    // Fallback to bank data
    revenueGrowthScore = scoreRevenueGrowthFromBank(
      inputs.bankData,
      positiveFactors,
      negativeFactors
    );
  } else {
    missingData.push('Revenue trends');
    revenueGrowthScore = 0;
  }

  // 3. Wells History Score (20 points max)
  let wellsHistoryScore = 0;
  if (inputs.wellsHistory) {
    wellsHistoryScore = scoreWellsHistory(inputs.wellsHistory, positiveFactors, negativeFactors);
  } else {
    // Fetch from database
    const wellsHistory = await fetchWellsHistory(userId);
    if (wellsHistory) {
      wellsHistoryScore = scoreWellsHistory(wellsHistory, positiveFactors, negativeFactors);
    } else {
      missingData.push('Wells transaction history');
      wellsHistoryScore = 10; // Neutral for new users
    }
  }

  // 4. Account Age Score (10 points max)
  let accountAgeScore = 0;
  if (inputs.bankData?.accountAge) {
    accountAgeScore = scoreAccountAge(inputs.bankData.accountAge, positiveFactors, negativeFactors);
  } else if (inputs.businessAge) {
    accountAgeScore = scoreAccountAge(inputs.businessAge, positiveFactors, negativeFactors);
  } else {
    missingData.push('Business age');
    accountAgeScore = 0;
  }

  // 5. Industry Risk Score (10 points max)
  const industry = inputs.industry || 'default';
  const industryRiskScore = scoreIndustryRisk(industry, positiveFactors, negativeFactors);

  // Calculate total score
  const totalScore = Math.round(
    cashFlowScore + revenueGrowthScore + wellsHistoryScore + accountAgeScore + industryRiskScore
  );

  // Determine grade and risk tier
  const grade = getGrade(totalScore);
  const riskTier = getRiskTier(totalScore);

  // Calculate recommended terms
  const { limit, apr } = calculateRecommendedTerms(
    totalScore,
    inputs.bankData,
    inputs.wellsHistory
  );

  // Calculate confidence based on data completeness
  const confidence = 1 - missingData.length * 0.15;

  return {
    score: totalScore,
    grade,
    riskTier,
    recommendedLimit: limit,
    recommendedAPR: apr,
    breakdown: {
      cashFlowScore,
      revenueGrowthScore,
      wellsHistoryScore,
      accountAgeScore,
      industryRiskScore,
    },
    confidence,
    positiveFactors,
    negativeFactors,
    missingData,
  };
}

/**
 * Score cash flow from bank data (40 points max)
 */
function scoreCashFlow(
  data: TransactionAnalysis,
  positive: string[],
  negative: string[]
): number {
  let score = 0;

  // 1. Net cash flow (15 points)
  if (data.netCashFlow > 10000) {
    score += 15;
    positive.push(`Strong net cash flow: $${Math.round(data.netCashFlow).toLocaleString()}/mo`);
  } else if (data.netCashFlow > 5000) {
    score += 12;
    positive.push(`Positive cash flow: $${Math.round(data.netCashFlow).toLocaleString()}/mo`);
  } else if (data.netCashFlow > 0) {
    score += 8;
  } else {
    score += 0;
    negative.push(`Negative cash flow: $${Math.round(data.netCashFlow).toLocaleString()}/mo`);
  }

  // 2. Cash flow stability (10 points)
  const stabilityRatio = data.cashFlowVolatility / data.avgMonthlyInflow;
  if (stabilityRatio < 0.2) {
    score += 10;
    positive.push('Very stable cash flow');
  } else if (stabilityRatio < 0.4) {
    score += 7;
    positive.push('Stable cash flow');
  } else if (stabilityRatio < 0.6) {
    score += 4;
  } else {
    score += 0;
    negative.push('Volatile cash flow');
  }

  // 3. Recurring revenue (10 points)
  const recurringPercentage = data.recurringRevenue / data.avgMonthlyInflow;
  if (recurringPercentage > 0.7) {
    score += 10;
    positive.push(`${Math.round(recurringPercentage * 100)}% recurring revenue`);
  } else if (recurringPercentage > 0.5) {
    score += 7;
    positive.push(`${Math.round(recurringPercentage * 100)}% recurring revenue`);
  } else if (recurringPercentage > 0.3) {
    score += 4;
  } else {
    score += 0;
  }

  // 4. Account health (5 points)
  if (data.overdraftCount === 0 && data.insufficientFundsFees === 0) {
    score += 5;
    positive.push('No overdrafts or NSF fees');
  } else if (data.overdraftCount < 3) {
    score += 2;
  } else {
    score += 0;
    negative.push(`${data.overdraftCount} overdrafts in past year`);
  }

  return score;
}

/**
 * Score cash flow from accounting data (fallback)
 */
function scoreCashFlowFromAccounting(
  ratios: FinancialRatios,
  positive: string[],
  negative: string[]
): number {
  let score = 0;

  // Current ratio (15 points)
  if (ratios.currentRatio > 2.0) {
    score += 15;
    positive.push(`Strong current ratio: ${ratios.currentRatio.toFixed(2)}`);
  } else if (ratios.currentRatio > 1.5) {
    score += 12;
    positive.push(`Good current ratio: ${ratios.currentRatio.toFixed(2)}`);
  } else if (ratios.currentRatio > 1.0) {
    score += 8;
  } else {
    score += 0;
    negative.push(`Low current ratio: ${ratios.currentRatio.toFixed(2)}`);
  }

  // Quick ratio (10 points)
  if (ratios.quickRatio > 1.5) {
    score += 10;
    positive.push(`Strong quick ratio: ${ratios.quickRatio.toFixed(2)}`);
  } else if (ratios.quickRatio > 1.0) {
    score += 7;
  } else if (ratios.quickRatio > 0.5) {
    score += 4;
  } else {
    score += 0;
    negative.push(`Low quick ratio: ${ratios.quickRatio.toFixed(2)}`);
  }

  // Profitability (10 points)
  if (ratios.netMargin > 0.15) {
    score += 10;
    positive.push(`Strong profit margin: ${(ratios.netMargin * 100).toFixed(1)}%`);
  } else if (ratios.netMargin > 0.1) {
    score += 7;
    positive.push(`Good profit margin: ${(ratios.netMargin * 100).toFixed(1)}%`);
  } else if (ratios.netMargin > 0.05) {
    score += 4;
  } else {
    score += 0;
    negative.push(`Low profit margin: ${(ratios.netMargin * 100).toFixed(1)}%`);
  }

  // Leverage (5 points)
  if (ratios.debtToEquity < 0.5) {
    score += 5;
    positive.push('Low debt leverage');
  } else if (ratios.debtToEquity < 1.0) {
    score += 3;
  } else if (ratios.debtToEquity < 2.0) {
    score += 1;
  } else {
    score += 0;
    negative.push(`High debt leverage: ${ratios.debtToEquity.toFixed(2)}`);
  }

  return score;
}

/**
 * Score revenue growth (20 points max)
 */
function scoreRevenueGrowth(
  trends: RevenueTrends,
  positive: string[],
  negative: string[]
): number {
  let score = 0;

  // Growth rate (15 points)
  const annualGrowth = trends.growthRate * 12;
  if (annualGrowth > 0.5) {
    score += 15;
    positive.push(`Strong growth: ${(annualGrowth * 100).toFixed(1)}% annually`);
  } else if (annualGrowth > 0.25) {
    score += 12;
    positive.push(`Good growth: ${(annualGrowth * 100).toFixed(1)}% annually`);
  } else if (annualGrowth > 0.1) {
    score += 8;
    positive.push(`Moderate growth: ${(annualGrowth * 100).toFixed(1)}% annually`);
  } else if (annualGrowth > 0) {
    score += 5;
  } else {
    score += 0;
    negative.push(`Declining revenue: ${(annualGrowth * 100).toFixed(1)}% annually`);
  }

  // Trend direction (5 points)
  if (trends.trendDirection === 'growing') {
    score += 5;
  } else if (trends.trendDirection === 'stable') {
    score += 3;
  } else {
    score += 0;
    negative.push('Declining revenue trend');
  }

  return score;
}

/**
 * Score revenue growth from bank data (fallback)
 */
function scoreRevenueGrowthFromBank(
  data: TransactionAnalysis,
  positive: string[],
  negative: string[]
): number {
  let score = 0;

  if (data.revenueGrowthRate > 0.5) {
    score += 15;
    positive.push(`Strong revenue growth: ${(data.revenueGrowthRate * 100).toFixed(1)}%`);
  } else if (data.revenueGrowthRate > 0.25) {
    score += 12;
    positive.push(`Good revenue growth: ${(data.revenueGrowthRate * 100).toFixed(1)}%`);
  } else if (data.revenueGrowthRate > 0.1) {
    score += 8;
  } else if (data.revenueGrowthRate > 0) {
    score += 5;
  } else {
    score += 0;
    negative.push(`Declining revenue: ${(data.revenueGrowthRate * 100).toFixed(1)}%`);
  }

  return score;
}

/**
 * Score Wells platform history (20 points max)
 */
function scoreWellsHistory(
  history: WellsTransactionHistory,
  positive: string[],
  negative: string[]
): number {
  let score = 0;

  // Transaction volume (8 points)
  if (history.totalVolume > 1000000) {
    score += 8;
    positive.push(`Strong Wells history: $${(history.totalVolume / 1000000).toFixed(1)}M volume`);
  } else if (history.totalVolume > 500000) {
    score += 6;
    positive.push(`Good Wells history: $${(history.totalVolume / 1000).toFixed(0)}K volume`);
  } else if (history.totalVolume > 100000) {
    score += 4;
  } else {
    score += 2;
  }

  // Activity duration (5 points)
  if (history.monthsActive > 12) {
    score += 5;
    positive.push(`${history.monthsActive} months on Wells platform`);
  } else if (history.monthsActive > 6) {
    score += 3;
  } else {
    score += 1;
  }

  // Dispute rate (4 points)
  if (history.disputeRate < 0.01) {
    score += 4;
    positive.push('Excellent dispute history');
  } else if (history.disputeRate < 0.05) {
    score += 2;
  } else {
    score += 0;
    negative.push(`${(history.disputeRate * 100).toFixed(1)}% dispute rate`);
  }

  // Settlement speed (3 points)
  if (history.avgSettlementTime < 7) {
    score += 3;
    positive.push('Fast payment settlements');
  } else if (history.avgSettlementTime < 14) {
    score += 2;
  } else {
    score += 0;
  }

  return score;
}

/**
 * Score account age (10 points max)
 */
function scoreAccountAge(ageMonths: number, positive: string[], negative: string[]): number {
  let score = 0;

  if (ageMonths > 36) {
    score = 10;
    positive.push(`Established business: ${Math.round(ageMonths / 12)} years`);
  } else if (ageMonths > 24) {
    score = 8;
    positive.push(`${Math.round(ageMonths / 12)} years in business`);
  } else if (ageMonths > 12) {
    score = 6;
  } else if (ageMonths > 6) {
    score = 3;
  } else {
    score = 0;
    negative.push('New business (<6 months)');
  }

  return score;
}

/**
 * Score industry risk (10 points max)
 */
function scoreIndustryRisk(industry: string, positive: string[], negative: string[]): number {
  const riskMultiplier = INDUSTRY_RISK[industry.toLowerCase()] || INDUSTRY_RISK['default'];

  // Lower risk = higher score
  const score = Math.round(10 / riskMultiplier);

  if (riskMultiplier < 1.0) {
    positive.push(`Low-risk industry: ${industry}`);
  } else if (riskMultiplier > 1.2) {
    negative.push(`Higher-risk industry: ${industry}`);
  }

  return score;
}

/**
 * Calculate recommended credit terms
 */
function calculateRecommendedTerms(
  score: number,
  bankData?: TransactionAnalysis,
  wellsHistory?: WellsTransactionHistory
): { limit: number; apr: number } {
  // Base limit on score
  let baseLimit = 0;
  if (score >= 900) baseLimit = 500000;
  else if (score >= 800) baseLimit = 250000;
  else if (score >= 700) baseLimit = 100000;
  else if (score >= 600) baseLimit = 50000;
  else if (score >= 500) baseLimit = 25000;
  else if (score >= 400) baseLimit = 10000;
  else baseLimit = 5000;

  // Adjust based on cash flow
  if (bankData) {
    const cashFlowMultiplier = Math.max(1, Math.min(3, bankData.netCashFlow / 5000));
    baseLimit *= cashFlowMultiplier;
  }

  // Adjust based on Wells history
  if (wellsHistory && wellsHistory.totalVolume > 0) {
    const volumeMultiplier = Math.max(1, Math.min(2, wellsHistory.totalVolume / 100000));
    baseLimit *= volumeMultiplier;
  }

  // Round to nearest $1000
  const limit = Math.round(baseLimit / 1000) * 1000;

  // Calculate APR based on risk tier
  let apr = 0;
  if (score >= 850) apr = 6.99;
  else if (score >= 750) apr = 8.99;
  else if (score >= 650) apr = 11.99;
  else if (score >= 550) apr = 14.99;
  else if (score >= 450) apr = 18.99;
  else apr = 24.99;

  return { limit, apr };
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 950) return 'A+';
  if (score >= 850) return 'A';
  if (score >= 700) return 'B';
  if (score >= 550) return 'C';
  if (score >= 400) return 'D';
  return 'F';
}

/**
 * Get risk tier from score
 */
function getRiskTier(score: number): 'prime' | 'near_prime' | 'subprime' | 'high_risk' {
  if (score >= 750) return 'prime';
  if (score >= 600) return 'near_prime';
  if (score >= 450) return 'subprime';
  return 'high_risk';
}

/**
 * Fetch Wells transaction history from database
 */
async function fetchWellsHistory(userId: string): Promise<WellsTransactionHistory | null> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(AVG(amount), 0) as avg_transaction_size,
        COUNT(DISTINCT DATE_TRUNC('month', created_at)) as months_active,
        COUNT(CASE WHEN status = 'disputed' THEN 1 END)::float / NULLIF(COUNT(*), 0) as dispute_rate,
        COUNT(CASE WHEN status = 'chargeback' THEN 1 END)::float / NULLIF(COUNT(*), 0) as chargeback_rate,
        COALESCE(AVG(EXTRACT(DAY FROM (settled_at - created_at))), 0) as avg_settlement_time
      FROM transactions
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '12 months'
        AND status NOT IN ('cancelled', 'failed')
    `;

    if (result.rowCount === 0) return null;

    const row = result.rows[0];

    return {
      totalVolume: parseFloat(row.total_volume) || 0,
      transactionCount: parseInt(row.transaction_count) || 0,
      avgTransactionSize: parseFloat(row.avg_transaction_size) || 0,
      monthsActive: parseInt(row.months_active) || 0,
      disputeRate: parseFloat(row.dispute_rate) || 0,
      chargebackRate: parseFloat(row.chargeback_rate) || 0,
      avgSettlementTime: parseFloat(row.avg_settlement_time) || 0,
      topCustomers: [],
      topSuppliers: [],
    };
  } catch (error) {
    console.error('Error fetching Wells history:', error);
    return null;
  }
}
