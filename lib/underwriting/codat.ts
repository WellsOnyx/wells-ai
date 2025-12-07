/**
 * Codat Integration for Credit Underwriting
 * Wells AI: Accounting data analysis for credit decisions
 */

// Types
export interface CodatConnection {
  companyId: string;
  connectionId: string;
  platformName: string;
  platformKey: string;
  dataConnections: string[];
}

export interface FinancialStatements {
  balanceSheet: BalanceSheet;
  profitAndLoss: ProfitAndLoss;
  cashFlowStatement: CashFlowStatement;
  period: {
    start: Date;
    end: Date;
  };
}

export interface BalanceSheet {
  assets: {
    current: number;
    fixed: number;
    total: number;
  };
  liabilities: {
    current: number;
    longTerm: number;
    total: number;
  };
  equity: number;
}

export interface ProfitAndLoss {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  netIncome: number;
}

export interface CashFlowStatement {
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netCashFlow: number;
}

export interface FinancialRatios {
  // Liquidity ratios
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;

  // Profitability ratios
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;

  // Leverage ratios
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;

  // Efficiency ratios
  assetTurnover: number;
  inventoryTurnover: number;
  receivablesTurnover: number;
  daysSalesOutstanding: number;
}

export interface ARAPAnalysis {
  accountsReceivable: {
    total: number;
    aging: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      days90Plus: number;
    };
    averageDaysOutstanding: number;
  };
  accountsPayable: {
    total: number;
    aging: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      days90Plus: number;
    };
    averageDaysOutstanding: number;
  };
}

export interface RevenueTrends {
  monthlyRevenue: { month: string; revenue: number }[];
  growthRate: number; // MoM average
  seasonality: number; // coefficient of variation
  trendDirection: 'growing' | 'stable' | 'declining';
  forecastNextMonth: number;
}

// Codat API base URL
const CODAT_API_BASE = 'https://api.codat.io';

/**
 * Get Codat API headers
 */
function getCodatHeaders(): HeadersInit {
  return {
    'Authorization': `Basic ${Buffer.from(process.env.CODAT_API_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a new Codat company
 */
export async function createCompany(name: string, userId: string): Promise<string> {
  try {
    const response = await fetch(`${CODAT_API_BASE}/companies`, {
      method: 'POST',
      headers: getCodatHeaders(),
      body: JSON.stringify({
        name,
        description: `Wells AI customer: ${userId}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Codat API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error creating Codat company:', error);
    throw new Error('Failed to create accounting connection');
  }
}

/**
 * Get Codat Link URL for connecting accounting platform
 */
export async function getLinkUrl(companyId: string): Promise<string> {
  return `https://link.codat.io/company/${companyId}`;
}

/**
 * Fetch balance sheet data
 */
export async function fetchBalanceSheet(
  companyId: string,
  periodMonths: number = 1
): Promise<BalanceSheet> {
  try {
    const response = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/financials/balanceSheet?periodLength=${periodMonths}&periodsToCompare=0`,
      {
        headers: getCodatHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Codat API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse Codat's nested structure
    const report = data.reports?.[0];
    if (!report) {
      throw new Error('No balance sheet data available');
    }

    const assets = report.assets || {};
    const liabilities = report.liabilities || {};
    const equity = report.equity || {};

    return {
      assets: {
        current: parseFinancialValue(assets.current),
        fixed: parseFinancialValue(assets.nonCurrent),
        total: parseFinancialValue(assets.total),
      },
      liabilities: {
        current: parseFinancialValue(liabilities.current),
        longTerm: parseFinancialValue(liabilities.nonCurrent),
        total: parseFinancialValue(liabilities.total),
      },
      equity: parseFinancialValue(equity.total),
    };
  } catch (error) {
    console.error('Error fetching balance sheet:', error);
    throw new Error('Failed to fetch balance sheet');
  }
}

/**
 * Fetch profit and loss data
 */
export async function fetchProfitAndLoss(
  companyId: string,
  periodMonths: number = 1
): Promise<ProfitAndLoss> {
  try {
    const response = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/financials/profitAndLoss?periodLength=${periodMonths}&periodsToCompare=0`,
      {
        headers: getCodatHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Codat API error: ${response.statusText}`);
    }

    const data = await response.json();
    const report = data.reports?.[0];
    if (!report) {
      throw new Error('No P&L data available');
    }

    const income = report.income || {};
    const costOfSales = report.costOfSales || {};
    const expenses = report.expenses || {};

    const revenue = parseFinancialValue(income.total);
    const cogs = parseFinancialValue(costOfSales.total);
    const grossProfit = revenue - cogs;
    const opex = parseFinancialValue(expenses.total);
    const operatingIncome = grossProfit - opex;
    const netIncome = parseFinancialValue(report.netProfit);

    return {
      revenue,
      costOfGoodsSold: cogs,
      grossProfit,
      operatingExpenses: opex,
      operatingIncome,
      netIncome,
    };
  } catch (error) {
    console.error('Error fetching P&L:', error);
    throw new Error('Failed to fetch profit and loss');
  }
}

/**
 * Fetch cash flow statement
 */
export async function fetchCashFlowStatement(
  companyId: string,
  periodMonths: number = 1
): Promise<CashFlowStatement> {
  try {
    const response = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/financials/cashFlow?periodLength=${periodMonths}&periodsToCompare=0`,
      {
        headers: getCodatHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Codat API error: ${response.statusText}`);
    }

    const data = await response.json();
    const report = data.reports?.[0];
    if (!report) {
      throw new Error('No cash flow data available');
    }

    return {
      operatingActivities: parseFinancialValue(report.operatingActivities?.total),
      investingActivities: parseFinancialValue(report.investingActivities?.total),
      financingActivities: parseFinancialValue(report.financingActivities?.total),
      netCashFlow: parseFinancialValue(report.netCashFlow),
    };
  } catch (error) {
    console.error('Error fetching cash flow:', error);
    throw new Error('Failed to fetch cash flow statement');
  }
}

/**
 * Calculate financial ratios from statements
 */
export function calculateFinancialRatios(
  balanceSheet: BalanceSheet,
  profitAndLoss: ProfitAndLoss
): FinancialRatios {
  const { assets, liabilities, equity } = balanceSheet;
  const { revenue, costOfGoodsSold, grossProfit, operatingIncome, netIncome } = profitAndLoss;

  return {
    // Liquidity
    currentRatio: safeDivide(assets.current, liabilities.current),
    quickRatio: safeDivide(assets.current - 0, liabilities.current), // Simplified (no inventory breakdown)
    cashRatio: safeDivide(0, liabilities.current), // Would need cash breakdown

    // Profitability
    grossMargin: safeDivide(grossProfit, revenue),
    operatingMargin: safeDivide(operatingIncome, revenue),
    netMargin: safeDivide(netIncome, revenue),
    returnOnAssets: safeDivide(netIncome, assets.total),
    returnOnEquity: safeDivide(netIncome, equity),

    // Leverage
    debtToEquity: safeDivide(liabilities.total, equity),
    debtToAssets: safeDivide(liabilities.total, assets.total),
    interestCoverage: 0, // Would need interest expense breakdown

    // Efficiency
    assetTurnover: safeDivide(revenue, assets.total),
    inventoryTurnover: 0, // Would need inventory breakdown
    receivablesTurnover: 0, // Calculated separately
    daysSalesOutstanding: 0, // Calculated separately
  };
}

/**
 * Analyze accounts receivable and payable aging
 */
export async function analyzeARAPAging(companyId: string): Promise<ARAPAnalysis> {
  try {
    // Fetch AR aging
    const arResponse = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/aged/receivables`,
      {
        headers: getCodatHeaders(),
      }
    );

    // Fetch AP aging
    const apResponse = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/aged/payables`,
      {
        headers: getCodatHeaders(),
      }
    );

    const arData = arResponse.ok ? await arResponse.json() : null;
    const apData = apResponse.ok ? await apResponse.json() : null;

    // Parse AR aging
    const arAging = parseAgingData(arData);
    const arTotal = Object.values(arAging).reduce((sum, val) => sum + val, 0);
    const arDSO = calculateDSO(arAging, arTotal);

    // Parse AP aging
    const apAging = parseAgingData(apData);
    const apTotal = Object.values(apAging).reduce((sum, val) => sum + val, 0);
    const apDSO = calculateDSO(apAging, apTotal);

    return {
      accountsReceivable: {
        total: arTotal,
        aging: arAging,
        averageDaysOutstanding: arDSO,
      },
      accountsPayable: {
        total: apTotal,
        aging: apAging,
        averageDaysOutstanding: apDSO,
      },
    };
  } catch (error) {
    console.error('Error analyzing AR/AP aging:', error);
    throw new Error('Failed to analyze AR/AP aging');
  }
}

/**
 * Analyze revenue trends over time
 */
export async function analyzeRevenueTrends(companyId: string): Promise<RevenueTrends> {
  try {
    // Fetch 12 months of P&L data
    const response = await fetch(
      `${CODAT_API_BASE}/companies/${companyId}/data/financials/profitAndLoss?periodLength=1&periodsToCompare=11`,
      {
        headers: getCodatHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Codat API error: ${response.statusText}`);
    }

    const data = await response.json();
    const reports = data.reports || [];

    // Extract monthly revenue
    const monthlyRevenue = reports
      .map((report: any) => ({
        month: report.fromDate.substring(0, 7),
        revenue: parseFinancialValue(report.income?.total),
      }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

    if (monthlyRevenue.length < 3) {
      throw new Error('Insufficient revenue history');
    }

    // Calculate growth rates
    const growthRates = [];
    for (let i = 1; i < monthlyRevenue.length; i++) {
      const prev = monthlyRevenue[i - 1].revenue;
      const curr = monthlyRevenue[i].revenue;
      if (prev > 0) {
        growthRates.push((curr - prev) / prev);
      }
    }

    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

    // Calculate seasonality (coefficient of variation)
    const revenues = monthlyRevenue.map((m: any) => m.revenue);
    const avgRevenue = revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length;
    const variance =
      revenues.reduce((sum: number, r: number) => sum + Math.pow(r - avgRevenue, 2), 0) /
      revenues.length;
    const seasonality = Math.sqrt(variance) / avgRevenue;

    // Determine trend direction
    let trendDirection: 'growing' | 'stable' | 'declining' = 'stable';
    if (avgGrowthRate > 0.05) trendDirection = 'growing';
    else if (avgGrowthRate < -0.05) trendDirection = 'declining';

    // Simple forecast (last month * (1 + avg growth))
    const lastRevenue = monthlyRevenue[monthlyRevenue.length - 1].revenue;
    const forecastNextMonth = lastRevenue * (1 + avgGrowthRate);

    return {
      monthlyRevenue,
      growthRate: avgGrowthRate,
      seasonality,
      trendDirection,
      forecastNextMonth,
    };
  } catch (error) {
    console.error('Error analyzing revenue trends:', error);
    throw new Error('Failed to analyze revenue trends');
  }
}

/**
 * Get comprehensive financial analysis
 */
export async function getFinancialAnalysis(companyId: string): Promise<{
  statements: FinancialStatements;
  ratios: FinancialRatios;
  arap: ARAPAnalysis;
  trends: RevenueTrends;
}> {
  try {
    // Fetch all data in parallel
    const [balanceSheet, profitAndLoss, cashFlow, arap, trends] = await Promise.all([
      fetchBalanceSheet(companyId, 1),
      fetchProfitAndLoss(companyId, 1),
      fetchCashFlowStatement(companyId, 1),
      analyzeARAPAging(companyId),
      analyzeRevenueTrends(companyId),
    ]);

    // Calculate ratios
    const ratios = calculateFinancialRatios(balanceSheet, profitAndLoss);

    // Update receivables turnover and DSO
    if (arap.accountsReceivable.total > 0) {
      ratios.receivablesTurnover = safeDivide(
        profitAndLoss.revenue * 12,
        arap.accountsReceivable.total
      );
      ratios.daysSalesOutstanding = arap.accountsReceivable.averageDaysOutstanding;
    }

    const now = new Date();
    const period = {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0),
    };

    return {
      statements: {
        balanceSheet,
        profitAndLoss,
        cashFlowStatement: cashFlow,
        period,
      },
      ratios,
      arap,
      trends,
    };
  } catch (error) {
    console.error('Error getting financial analysis:', error);
    throw new Error('Failed to get financial analysis');
  }
}

// Helper functions

function parseFinancialValue(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    return parseFloat(value.value || value.amount || 0);
  }
  return 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function parseAgingData(data: any): {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
} {
  if (!data || !data.data) {
    return { current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0 };
  }

  const items = data.data;
  const aging = { current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0 };

  items.forEach((item: any) => {
    const amount = parseFinancialValue(item.amount);
    const days = parseInt(item.period) || 0;

    if (days <= 30) aging.current += amount;
    else if (days <= 60) aging.days30 += amount;
    else if (days <= 90) aging.days60 += amount;
    else aging.days90Plus += amount;
  });

  return aging;
}

function calculateDSO(
  aging: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    days90Plus: number;
  },
  total: number
): number {
  if (total === 0) return 0;

  // Weighted average
  const weightedDays =
    aging.current * 15 +
    aging.days30 * 45 +
    aging.days60 * 75 +
    aging.days90 * 90 +
    aging.days90Plus * 120;

  return weightedDays / total;
}
