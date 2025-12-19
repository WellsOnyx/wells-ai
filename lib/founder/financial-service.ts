/**
 * Founder P&L and Financial Management Service
 *
 * Aggregates all financial data for founders into a complete P&L view.
 * Pulls from:
 * - Treasury transactions (treasury-db.ts)
 * - GRAIN transactions (wells-payments.ts)
 * - Project expenses (founder projects)
 * - RFQ/procurement spend
 * - Worker/task payments
 * - Escrow releases
 * - Attribution earnings
 * - Success fees (network sourcing)
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

export type TransactionCategory =
  | 'revenue'
  | 'service_revenue'
  | 'product_revenue'
  | 'other_income'
  | 'cogs'
  | 'materials'
  | 'labor'
  | 'services'
  | 'opex'
  | 'payroll'
  | 'marketing'
  | 'software'
  | 'rent'
  | 'utilities'
  | 'travel'
  | 'professional_services'
  | 'fees'
  | 'platform_fees'
  | 'payment_fees'
  | 'success_fees'
  | 'financing'
  | 'interest'
  | 'loan_payment'
  | 'other';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'escrow' | 'fee';

export type TransactionSource =
  | 'treasury'
  | 'grain'
  | 'project'
  | 'rfq'
  | 'escrow'
  | 'task'
  | 'attribution'
  | 'manual'
  | 'import';

export interface FinancialTransaction {
  id: string;
  founderId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  description?: string;
  counterpartyId?: string;
  counterpartyName?: string;
  source: TransactionSource;
  sourceId?: string; // e.g., treasury tx ID, project ID, RFQ ID
  projectId?: string;
  date: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Period {
  start: Date;
  end: Date;
}

export interface PLStatement {
  period: Period;
  revenue: {
    total: number;
    byCategory: Record<string, number>;
    transactions: FinancialTransaction[];
  };
  cogs: {
    total: number;
    byCategory: Record<string, number>;
    transactions: FinancialTransaction[];
  };
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: {
    total: number;
    byCategory: Record<string, number>;
    transactions: FinancialTransaction[];
  };
  operatingIncome: number;
  otherIncome: number;
  otherExpenses: number;
  netIncome: number;
  netMargin: number;
}

export interface CashFlowStatement {
  period: Period;
  opening: number;
  operating: {
    inflows: number;
    outflows: number;
    net: number;
  };
  investing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  financing: {
    inflows: number;
    outflows: number;
    net: number;
  };
  closing: number;
  runway: {
    months: number;
    burnRate: number;
  };
}

export interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_track' | 'over';
}

export interface Budget {
  id: string;
  founderId: string;
  period: Period;
  categories: Record<string, number>;
  totalBudget: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialKPIs {
  grossMargin: number;
  netMargin: number;
  burnRate: number;
  runway: number;
  revenueGrowth?: number;
  expenseGrowth?: number;
  cac?: number;
  ltv?: number;
  averageTransactionSize: number;
  transactionCount: number;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType | TransactionType[];
  category?: TransactionCategory | TransactionCategory[];
  source?: TransactionSource | TransactionSource[];
  projectId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ParsedExpense {
  amount?: number;
  category?: TransactionCategory;
  description?: string;
  vendor?: string;
  date?: Date;
  projectId?: string;
  confidence: number;
}

export interface ForecastScenario {
  name: string;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  months: number;
}

export interface CashFlowForecast {
  months: Array<{
    month: Date;
    projectedInflows: number;
    projectedOutflows: number;
    projectedBalance: number;
    runwayRemaining: number;
  }>;
  breakEvenMonth?: Date;
  lowestBalance: number;
  endingBalance: number;
}

// ============================================================================
// CATEGORY MAPPINGS
// ============================================================================

const REVENUE_CATEGORIES: TransactionCategory[] = [
  'revenue',
  'service_revenue',
  'product_revenue',
  'other_income',
];

const COGS_CATEGORIES: TransactionCategory[] = [
  'cogs',
  'materials',
  'labor',
];

const OPEX_CATEGORIES: TransactionCategory[] = [
  'opex',
  'payroll',
  'marketing',
  'software',
  'rent',
  'utilities',
  'travel',
  'professional_services',
];

const FEE_CATEGORIES: TransactionCategory[] = [
  'fees',
  'platform_fees',
  'payment_fees',
  'success_fees',
];

const FINANCING_CATEGORIES: TransactionCategory[] = [
  'financing',
  'interest',
  'loan_payment',
];

// ============================================================================
// P&L FUNCTIONS
// ============================================================================

/**
 * Generate P&L statement for a period
 */
export async function getPLStatement(
  founderId: string,
  period: Period
): Promise<{ success: boolean; pl?: PLStatement; message: string }> {
  try {
    // Fetch all transactions for the period
    const result = await getTransactions(founderId, {
      startDate: period.start,
      endDate: period.end,
    });

    if (!result.success) {
      return { success: false, message: result.message };
    }

    const transactions = result.transactions!;

    // Categorize transactions
    const revenueTransactions = transactions.filter(
      (t) => t.type === 'income' && REVENUE_CATEGORIES.includes(t.category)
    );
    const cogsTransactions = transactions.filter(
      (t) => t.type === 'expense' && COGS_CATEGORIES.includes(t.category)
    );
    const opexTransactions = transactions.filter(
      (t) => t.type === 'expense' && OPEX_CATEGORIES.includes(t.category)
    );
    const feeTransactions = transactions.filter(
      (t) => t.type === 'fee' || FEE_CATEGORIES.includes(t.category)
    );
    const otherIncomeTransactions = transactions.filter(
      (t) => t.type === 'income' && !REVENUE_CATEGORIES.includes(t.category)
    );
    const otherExpenseTransactions = transactions.filter(
      (t) =>
        t.type === 'expense' &&
        !COGS_CATEGORIES.includes(t.category) &&
        !OPEX_CATEGORIES.includes(t.category) &&
        !FEE_CATEGORIES.includes(t.category)
    );

    // Calculate totals
    const revenueTotal = revenueTransactions.reduce((sum, t) => sum + t.amount, 0);
    const cogsTotal = cogsTransactions.reduce((sum, t) => sum + t.amount, 0);
    const opexTotal = opexTransactions.reduce((sum, t) => sum + t.amount, 0) +
      feeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const otherIncome = otherIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const otherExpenses = otherExpenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const grossProfit = revenueTotal - cogsTotal;
    const grossMargin = revenueTotal > 0 ? (grossProfit / revenueTotal) * 100 : 0;
    const operatingIncome = grossProfit - opexTotal;
    const netIncome = operatingIncome + otherIncome - otherExpenses;
    const netMargin = revenueTotal > 0 ? (netIncome / revenueTotal) * 100 : 0;

    // Group by category
    const groupByCategory = (txns: FinancialTransaction[]): Record<string, number> => {
      return txns.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
    };

    const pl: PLStatement = {
      period,
      revenue: {
        total: revenueTotal,
        byCategory: groupByCategory(revenueTransactions),
        transactions: revenueTransactions,
      },
      cogs: {
        total: cogsTotal,
        byCategory: groupByCategory(cogsTransactions),
        transactions: cogsTransactions,
      },
      grossProfit,
      grossMargin,
      operatingExpenses: {
        total: opexTotal,
        byCategory: groupByCategory([...opexTransactions, ...feeTransactions]),
        transactions: [...opexTransactions, ...feeTransactions],
      },
      operatingIncome,
      otherIncome,
      otherExpenses,
      netIncome,
      netMargin,
    };

    const periodStr = `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`;
    let message = `P&L for ${periodStr}: `;
    message += `Revenue $${revenueTotal.toLocaleString()}, `;
    message += `Gross Profit $${grossProfit.toLocaleString()} (${grossMargin.toFixed(1)}% margin), `;
    message += `Net Income $${netIncome.toLocaleString()} (${netMargin.toFixed(1)}% margin).`;

    return { success: true, pl, message };
  } catch (error: any) {
    console.error('Error generating P&L:', error);
    return {
      success: false,
      message: `Failed to generate P&L: ${error.message}`,
    };
  }
}

/**
 * Get monthly P&L for last N months
 */
export async function getMonthlyPL(
  founderId: string,
  months: number = 6
): Promise<{ success: boolean; statements?: PLStatement[]; message: string }> {
  try {
    const statements: PLStatement[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const result = await getPLStatement(founderId, { start, end });
      if (result.success && result.pl) {
        statements.push(result.pl);
      }
    }

    const totalRevenue = statements.reduce((sum, s) => sum + s.revenue.total, 0);
    const totalNetIncome = statements.reduce((sum, s) => sum + s.netIncome, 0);
    const avgMonthlyRevenue = totalRevenue / statements.length;

    let message = `${months}-month P&L summary: `;
    message += `Total Revenue $${totalRevenue.toLocaleString()}, `;
    message += `Avg Monthly $${avgMonthlyRevenue.toLocaleString()}, `;
    message += `Net Income $${totalNetIncome.toLocaleString()}.`;

    return { success: true, statements, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to generate monthly P&L: ${error.message}`,
    };
  }
}

/**
 * Get quarterly P&L for last N quarters
 */
export async function getQuarterlyPL(
  founderId: string,
  quarters: number = 4
): Promise<{ success: boolean; statements?: PLStatement[]; message: string }> {
  try {
    const statements: PLStatement[] = [];
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);

    for (let i = quarters - 1; i >= 0; i--) {
      const quarterOffset = currentQuarter - i;
      const year = now.getFullYear() + Math.floor(quarterOffset / 4);
      const quarter = ((quarterOffset % 4) + 4) % 4;

      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59);

      const result = await getPLStatement(founderId, { start, end });
      if (result.success && result.pl) {
        statements.push(result.pl);
      }
    }

    const totalRevenue = statements.reduce((sum, s) => sum + s.revenue.total, 0);
    const avgQuarterlyRevenue = totalRevenue / statements.length;

    let message = `${quarters}-quarter P&L: Total Revenue $${totalRevenue.toLocaleString()}, `;
    message += `Avg Quarterly $${avgQuarterlyRevenue.toLocaleString()}.`;

    return { success: true, statements, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to generate quarterly P&L: ${error.message}`,
    };
  }
}

/**
 * Get year-to-date P&L
 */
export async function getYTDPL(
  founderId: string
): Promise<{ success: boolean; pl?: PLStatement; message: string }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = now;

  const result = await getPLStatement(founderId, { start, end });

  if (result.success && result.pl) {
    const daysElapsed = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const projectedAnnual = result.pl.netIncome * (365 / daysElapsed);

    result.message += ` Projected annual net income: $${projectedAnnual.toLocaleString()}.`;
  }

  return result;
}

// ============================================================================
// CASH FLOW FUNCTIONS
// ============================================================================

/**
 * Generate cash flow statement for a period
 */
export async function getCashFlowStatement(
  founderId: string,
  period: Period
): Promise<{ success: boolean; cashFlow?: CashFlowStatement; message: string }> {
  try {
    // Get opening balance (sum of all transactions before period start)
    const openingResult = await sql`
      SELECT COALESCE(SUM(
        CASE WHEN type = 'income' THEN amount
             WHEN type IN ('expense', 'fee') THEN -amount
             ELSE 0 END
      ), 0) as opening
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND date < ${period.start.toISOString()}
    `;
    const opening = parseFloat(openingResult.rows[0]?.opening || '0');

    // Get period transactions
    const txnResult = await getTransactions(founderId, {
      startDate: period.start,
      endDate: period.end,
    });

    if (!txnResult.success) {
      return { success: false, message: txnResult.message };
    }

    const transactions = txnResult.transactions!;

    // Categorize for cash flow
    const operatingInflows = transactions
      .filter((t) => t.type === 'income' && !FINANCING_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0);

    const operatingOutflows = transactions
      .filter(
        (t) =>
          (t.type === 'expense' || t.type === 'fee') &&
          !FINANCING_CATEGORIES.includes(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // For now, investing is equipment/assets (can be expanded)
    const investingInflows = transactions
      .filter((t) => t.type === 'income' && t.category === 'other')
      .reduce((sum, t) => sum + t.amount, 0);

    const investingOutflows = transactions
      .filter((t) => t.type === 'expense' && t.category === 'equipment')
      .reduce((sum, t) => sum + t.amount, 0);

    // Financing activities
    const financingInflows = transactions
      .filter(
        (t) => t.type === 'income' && FINANCING_CATEGORIES.includes(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const financingOutflows = transactions
      .filter(
        (t) => t.type === 'expense' && FINANCING_CATEGORIES.includes(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const operatingNet = operatingInflows - operatingOutflows;
    const investingNet = investingInflows - investingOutflows;
    const financingNet = financingInflows - financingOutflows;
    const closing = opening + operatingNet + investingNet + financingNet;

    // Calculate burn rate and runway
    const periodDays = Math.ceil(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthlyBurn = (operatingOutflows / periodDays) * 30;
    const runway = monthlyBurn > 0 ? closing / monthlyBurn : Infinity;

    const cashFlow: CashFlowStatement = {
      period,
      opening,
      operating: {
        inflows: operatingInflows,
        outflows: operatingOutflows,
        net: operatingNet,
      },
      investing: {
        inflows: investingInflows,
        outflows: investingOutflows,
        net: investingNet,
      },
      financing: {
        inflows: financingInflows,
        outflows: financingOutflows,
        net: financingNet,
      },
      closing,
      runway: {
        months: isFinite(runway) ? runway : 999,
        burnRate: monthlyBurn,
      },
    };

    let message = `Cash Flow: Opening $${opening.toLocaleString()}, `;
    message += `Operating ${operatingNet >= 0 ? '+' : ''}$${operatingNet.toLocaleString()}, `;
    message += `Closing $${closing.toLocaleString()}. `;

    if (isFinite(runway) && runway < 12) {
      message += `Runway: ${runway.toFixed(1)} months at $${monthlyBurn.toLocaleString()}/mo burn.`;
    } else if (monthlyBurn <= 0) {
      message += 'Cash flow positive - no burn.';
    }

    return { success: true, cashFlow, message };
  } catch (error: any) {
    console.error('Error generating cash flow:', error);
    return {
      success: false,
      message: `Failed to generate cash flow: ${error.message}`,
    };
  }
}

/**
 * Calculate monthly burn rate
 */
export async function getBurnRate(
  founderId: string
): Promise<{ success: boolean; burnRate?: number; trend?: number; message: string }> {
  try {
    // Get last 3 months of expenses
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const result = await sql`
      SELECT
        DATE_TRUNC('month', date) as month,
        SUM(amount) as total
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND type IN ('expense', 'fee')
        AND date >= ${threeMonthsAgo.toISOString()}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month ASC
    `;

    if (result.rows.length === 0) {
      return {
        success: true,
        burnRate: 0,
        message: 'No expense data yet. Start tracking expenses to calculate burn rate.',
      };
    }

    const monthlyTotals = result.rows.map((r) => parseFloat(r.total));
    const avgBurn = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;

    // Calculate trend (change from first to last month)
    let trend: number | undefined;
    if (monthlyTotals.length >= 2) {
      const first = monthlyTotals[0];
      const last = monthlyTotals[monthlyTotals.length - 1];
      trend = first > 0 ? ((last - first) / first) * 100 : 0;
    }

    let message = `Monthly burn rate: $${avgBurn.toLocaleString()}.`;
    if (trend !== undefined) {
      message += ` Trend: ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}% over ${monthlyTotals.length} months.`;
    }

    return { success: true, burnRate: avgBurn, trend, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to calculate burn rate: ${error.message}`,
    };
  }
}

/**
 * Get runway in months based on current burn
 */
export async function getRunway(
  founderId: string
): Promise<{ success: boolean; runway?: number; burnRate?: number; balance?: number; message: string }> {
  try {
    // Get current cash position
    const cashResult = await getCashPosition(founderId);
    if (!cashResult.success) {
      return cashResult;
    }

    const balance = cashResult.totalBalance!;

    // Get burn rate
    const burnResult = await getBurnRate(founderId);
    const burnRate = burnResult.burnRate || 0;

    const runway = burnRate > 0 ? balance / burnRate : Infinity;

    let message: string;
    if (burnRate <= 0) {
      message = `Cash position: $${balance.toLocaleString()}. No burn - cash flow positive or neutral.`;
    } else if (runway < 3) {
      message = `Warning: Only ${runway.toFixed(1)} months runway! $${balance.toLocaleString()} at $${burnRate.toLocaleString()}/mo burn.`;
    } else if (runway < 12) {
      message = `Runway: ${runway.toFixed(1)} months. $${balance.toLocaleString()} at $${burnRate.toLocaleString()}/mo burn.`;
    } else {
      message = `Runway: ${Math.round(runway)}+ months. Strong cash position.`;
    }

    return {
      success: true,
      runway: isFinite(runway) ? runway : 999,
      burnRate,
      balance,
      message,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to calculate runway: ${error.message}`,
    };
  }
}

/**
 * Get current cash + GRAIN balance
 */
export async function getCashPosition(
  founderId: string
): Promise<{
  success: boolean;
  usdBalance?: number;
  grainBalance?: number;
  totalBalance?: number;
  escrowHeld?: number;
  message: string;
}> {
  try {
    // Get treasury account balance
    const treasuryResult = await sql`
      SELECT
        COALESCE(usd_balance, 0) as usd,
        COALESCE(grain_balance, 0) as grain
      FROM treasury_accounts
      WHERE clerk_user_id = ${founderId}
      LIMIT 1
    `;

    let usdBalance = 0;
    let grainBalance = 0;

    if (treasuryResult.rows.length > 0) {
      usdBalance = parseFloat(treasuryResult.rows[0].usd) || 0;
      grainBalance = parseFloat(treasuryResult.rows[0].grain) || 0;
    }

    // Get escrow held amount
    const escrowResult = await sql`
      SELECT COALESCE(SUM(grain_amount + fee_amount), 0) as held
      FROM grain_transactions
      WHERE account_id IN (
        SELECT id FROM treasury_accounts WHERE clerk_user_id = ${founderId}
      )
      AND type = 'escrow_hold'
      AND status = 'held'
    `;

    const escrowHeld = parseFloat(escrowResult.rows[0]?.held || '0');
    const totalBalance = usdBalance + grainBalance; // GRAIN is 1:1 with USD

    let message = `Cash position: $${usdBalance.toLocaleString()} USD + $${grainBalance.toLocaleString()} GRAIN = $${totalBalance.toLocaleString()} total.`;
    if (escrowHeld > 0) {
      message += ` ($${escrowHeld.toLocaleString()} in escrow)`;
    }

    return {
      success: true,
      usdBalance,
      grainBalance,
      totalBalance,
      escrowHeld,
      message,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get cash position: ${error.message}`,
    };
  }
}

// ============================================================================
// BUDGET FUNCTIONS
// ============================================================================

/**
 * Set budget for a period by category
 */
export async function setBudget(
  founderId: string,
  period: Period,
  categoryBudgets: Record<string, number>
): Promise<{ success: boolean; budget?: Budget; message: string }> {
  try {
    const budgetId = crypto.randomUUID();
    const totalBudget = Object.values(categoryBudgets).reduce((a, b) => a + b, 0);

    await sql`
      INSERT INTO founder_budgets (
        id, founder_id, period_start, period_end,
        categories, total_budget, created_at, updated_at
      ) VALUES (
        ${budgetId}, ${founderId},
        ${period.start.toISOString()}, ${period.end.toISOString()},
        ${JSON.stringify(categoryBudgets)}::jsonb, ${totalBudget},
        NOW(), NOW()
      )
      ON CONFLICT (founder_id, period_start, period_end)
      DO UPDATE SET
        categories = ${JSON.stringify(categoryBudgets)}::jsonb,
        total_budget = ${totalBudget},
        updated_at = NOW()
    `;

    const budget: Budget = {
      id: budgetId,
      founderId,
      period,
      categories: categoryBudgets,
      totalBudget,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const categoryCount = Object.keys(categoryBudgets).length;
    let message = `Set budget of $${totalBudget.toLocaleString()} for ${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}. `;
    message += `${categoryCount} categories defined.`;

    return { success: true, budget, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to set budget: ${error.message}`,
    };
  }
}

/**
 * Get budget for a period
 */
export async function getBudget(
  founderId: string,
  period: Period
): Promise<{ success: boolean; budget?: Budget; message: string }> {
  try {
    const result = await sql`
      SELECT * FROM founder_budgets
      WHERE founder_id = ${founderId}
        AND period_start <= ${period.start.toISOString()}
        AND period_end >= ${period.end.toISOString()}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'No budget found for this period. Set one to track against.',
      };
    }

    const row = result.rows[0];
    const budget: Budget = {
      id: row.id,
      founderId: row.founder_id,
      period: {
        start: new Date(row.period_start),
        end: new Date(row.period_end),
      },
      categories: row.categories,
      totalBudget: parseFloat(row.total_budget),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    return {
      success: true,
      budget,
      message: `Budget: $${budget.totalBudget.toLocaleString()} across ${Object.keys(budget.categories).length} categories.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get budget: ${error.message}`,
    };
  }
}

/**
 * Compare actuals vs budget
 */
export async function getBudgetComparison(
  founderId: string,
  period: Period
): Promise<{ success: boolean; comparisons?: BudgetComparison[]; totalVariance?: number; message: string }> {
  try {
    // Get budget
    const budgetResult = await getBudget(founderId, period);
    if (!budgetResult.success || !budgetResult.budget) {
      return budgetResult;
    }

    const budget = budgetResult.budget;

    // Get actuals
    const actualsResult = await sql`
      SELECT category, SUM(amount) as actual
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND type IN ('expense', 'fee')
        AND date >= ${period.start.toISOString()}
        AND date <= ${period.end.toISOString()}
      GROUP BY category
    `;

    const actuals: Record<string, number> = {};
    for (const row of actualsResult.rows) {
      actuals[row.category] = parseFloat(row.actual);
    }

    // Build comparisons
    const comparisons: BudgetComparison[] = [];
    let totalBudgeted = 0;
    let totalActual = 0;

    // All budgeted categories
    for (const [category, budgeted] of Object.entries(budget.categories)) {
      const actual = actuals[category] || 0;
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

      let status: 'under' | 'on_track' | 'over';
      if (variance > budgeted * 0.1) {
        status = 'under';
      } else if (variance < -budgeted * 0.05) {
        status = 'over';
      } else {
        status = 'on_track';
      }

      comparisons.push({
        category,
        budgeted,
        actual,
        variance,
        variancePercent,
        status,
      });

      totalBudgeted += budgeted;
      totalActual += actual;
    }

    // Add categories with spend but no budget
    for (const [category, actual] of Object.entries(actuals)) {
      if (!budget.categories[category]) {
        comparisons.push({
          category,
          budgeted: 0,
          actual,
          variance: -actual,
          variancePercent: -100,
          status: 'over',
        });
        totalActual += actual;
      }
    }

    const totalVariance = totalBudgeted - totalActual;
    const overCount = comparisons.filter((c) => c.status === 'over').length;

    let message: string;
    if (totalVariance >= 0) {
      message = `Under budget by $${totalVariance.toLocaleString()} overall. `;
    } else {
      message = `Over budget by $${Math.abs(totalVariance).toLocaleString()} overall. `;
    }
    message += `${overCount} of ${comparisons.length} categories over budget.`;

    return { success: true, comparisons, totalVariance, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to compare budget: ${error.message}`,
    };
  }
}

/**
 * Get categories that are over budget
 */
export async function getBudgetAlerts(
  founderId: string
): Promise<{ success: boolean; alerts?: BudgetComparison[]; message: string }> {
  try {
    // Get current month budget comparison
    const now = new Date();
    const period: Period = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };

    const result = await getBudgetComparison(founderId, period);

    if (!result.success || !result.comparisons) {
      return result;
    }

    const alerts = result.comparisons.filter((c) => c.status === 'over');

    if (alerts.length === 0) {
      return {
        success: true,
        alerts: [],
        message: 'All categories on track or under budget this month.',
      };
    }

    let message = `${alerts.length} budget alerts: `;
    message += alerts
      .map((a) => `${a.category} ($${Math.abs(a.variance).toLocaleString()} over)`)
      .join(', ');
    message += '.';

    return { success: true, alerts, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get budget alerts: ${error.message}`,
    };
  }
}

// ============================================================================
// TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Get all transactions with filtering
 */
export async function getTransactions(
  founderId: string,
  filters?: TransactionFilters
): Promise<{ success: boolean; transactions?: FinancialTransaction[]; total?: number; message: string }> {
  try {
    let whereConditions = ['founder_id = $1'];
    const params: any[] = [founderId];
    let paramIndex = 2;

    if (filters?.startDate) {
      whereConditions.push(`date >= $${paramIndex}`);
      params.push(filters.startDate.toISOString());
      paramIndex++;
    }

    if (filters?.endDate) {
      whereConditions.push(`date <= $${paramIndex}`);
      params.push(filters.endDate.toISOString());
      paramIndex++;
    }

    if (filters?.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      whereConditions.push(`type = ANY($${paramIndex})`);
      params.push(types);
      paramIndex++;
    }

    if (filters?.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      whereConditions.push(`category = ANY($${paramIndex})`);
      params.push(categories);
      paramIndex++;
    }

    if (filters?.source) {
      const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
      whereConditions.push(`source = ANY($${paramIndex})`);
      params.push(sources);
      paramIndex++;
    }

    if (filters?.projectId) {
      whereConditions.push(`project_id = $${paramIndex}`);
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters?.minAmount !== undefined) {
      whereConditions.push(`amount >= $${paramIndex}`);
      params.push(filters.minAmount);
      paramIndex++;
    }

    if (filters?.maxAmount !== undefined) {
      whereConditions.push(`amount <= $${paramIndex}`);
      params.push(filters.maxAmount);
      paramIndex++;
    }

    if (filters?.search) {
      whereConditions.push(`(description ILIKE $${paramIndex} OR counterparty_name ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM founder_financial_transactions
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await sql.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get transactions
    const query = `
      SELECT * FROM founder_financial_transactions
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY date DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await sql.query(query, params);

    const transactions: FinancialTransaction[] = result.rows.map(mapRowToTransaction);

    let message = `Found ${total} transaction(s)`;
    if (filters?.startDate || filters?.endDate) {
      message += ' in period';
    }
    message += '.';

    if (transactions.length > 0) {
      const totalAmount = transactions.reduce((sum, t) =>
        t.type === 'income' ? sum + t.amount : sum - t.amount, 0);
      message += ` Net: ${totalAmount >= 0 ? '+' : ''}$${totalAmount.toLocaleString()}.`;
    }

    return { success: true, transactions, total, message };
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return {
      success: false,
      message: `Failed to fetch transactions: ${error.message}`,
    };
  }
}

/**
 * Categorize a transaction
 */
export async function categorizeTransaction(
  transactionId: string,
  category: TransactionCategory
): Promise<{ success: boolean; message: string }> {
  try {
    await sql`
      UPDATE founder_financial_transactions
      SET category = ${category}, updated_at = NOW()
      WHERE id = ${transactionId}
    `;

    return {
      success: true,
      message: `Transaction categorized as ${category}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to categorize: ${error.message}`,
    };
  }
}

/**
 * Bulk categorize transactions
 */
export async function bulkCategorize(
  transactionIds: string[],
  category: TransactionCategory
): Promise<{ success: boolean; updated?: number; message: string }> {
  try {
    const result = await sql`
      UPDATE founder_financial_transactions
      SET category = ${category}, updated_at = NOW()
      WHERE id = ANY(${transactionIds})
    `;

    const updated = result.rowCount || 0;

    return {
      success: true,
      updated,
      message: `Categorized ${updated} transaction(s) as ${category}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to bulk categorize: ${error.message}`,
    };
  }
}

/**
 * Add a manual transaction entry
 */
export async function addManualTransaction(
  founderId: string,
  data: {
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    description?: string;
    counterpartyName?: string;
    date?: Date;
    projectId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; transaction?: FinancialTransaction; message: string }> {
  try {
    const txId = crypto.randomUUID();
    const txDate = data.date || new Date();

    await sql`
      INSERT INTO founder_financial_transactions (
        id, founder_id, type, category, amount, currency,
        description, counterparty_name, source, project_id,
        date, metadata, created_at, updated_at
      ) VALUES (
        ${txId}, ${founderId}, ${data.type}, ${data.category}, ${data.amount}, 'USD',
        ${data.description || null}, ${data.counterpartyName || null}, 'manual', ${data.projectId || null},
        ${txDate.toISOString()}, ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb,
        NOW(), NOW()
      )
    `;

    const transaction: FinancialTransaction = {
      id: txId,
      founderId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      currency: 'USD',
      description: data.description,
      counterpartyName: data.counterpartyName,
      source: 'manual',
      projectId: data.projectId,
      date: txDate,
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const typeWord = data.type === 'income' ? 'income' : 'expense';
    let message = `Added $${data.amount.toLocaleString()} ${typeWord}`;
    if (data.category) {
      message += ` (${data.category})`;
    }
    if (data.counterpartyName) {
      message += ` - ${data.counterpartyName}`;
    }
    message += '.';

    return { success: true, transaction, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to add transaction: ${error.message}`,
    };
  }
}

/**
 * Import transactions from bank or CSV
 */
export async function importTransactions(
  founderId: string,
  source: string,
  transactions: Array<{
    date: Date;
    amount: number;
    description: string;
    type?: TransactionType;
    category?: TransactionCategory;
    counterpartyName?: string;
  }>
): Promise<{ success: boolean; imported?: number; skipped?: number; message: string }> {
  try {
    let imported = 0;
    let skipped = 0;

    for (const tx of transactions) {
      // Skip duplicates based on date + amount + description
      const existing = await sql`
        SELECT id FROM founder_financial_transactions
        WHERE founder_id = ${founderId}
          AND date = ${tx.date.toISOString()}
          AND amount = ${Math.abs(tx.amount)}
          AND description = ${tx.description}
        LIMIT 1
      `;

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      const txType = tx.type || (tx.amount >= 0 ? 'income' : 'expense');
      const txCategory = tx.category || 'other';

      await sql`
        INSERT INTO founder_financial_transactions (
          id, founder_id, type, category, amount, currency,
          description, counterparty_name, source,
          date, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, ${founderId}, ${txType}, ${txCategory},
          ${Math.abs(tx.amount)}, 'USD',
          ${tx.description}, ${tx.counterpartyName || null}, 'import',
          ${tx.date.toISOString()}, NOW(), NOW()
        )
      `;
      imported++;
    }

    let message = `Imported ${imported} transaction(s) from ${source}.`;
    if (skipped > 0) {
      message += ` Skipped ${skipped} duplicate(s).`;
    }

    return { success: true, imported, skipped, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to import: ${error.message}`,
    };
  }
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Pull transactions from treasury
 */
export async function aggregateFromTreasury(
  founderId: string,
  period: Period
): Promise<{ success: boolean; synced?: number; message: string }> {
  try {
    // Get treasury account ID
    const accountResult = await sql`
      SELECT id FROM treasury_accounts WHERE clerk_user_id = ${founderId} LIMIT 1
    `;

    if (accountResult.rows.length === 0) {
      return {
        success: true,
        synced: 0,
        message: 'No treasury account found. Nothing to sync.',
      };
    }

    const accountId = accountResult.rows[0].id;

    // Get treasury transactions not yet synced
    const txResult = await sql`
      SELECT t.*
      FROM treasury_transactions t
      LEFT JOIN founder_financial_transactions f ON f.source_id = t.id AND f.source = 'treasury'
      WHERE t.account_id = ${accountId}
        AND t.created_at >= ${period.start.toISOString()}
        AND t.created_at <= ${period.end.toISOString()}
        AND t.status = 'completed'
        AND f.id IS NULL
    `;

    let synced = 0;

    for (const row of txResult.rows) {
      const txType: TransactionType = row.type === 'receipt' ? 'income' : 'expense';
      let category: TransactionCategory = 'other';

      if (row.type === 'payment') category = 'services';
      if (row.type === 'credit_draw') category = 'financing';
      if (row.type === 'credit_repay') category = 'loan_payment';

      await sql`
        INSERT INTO founder_financial_transactions (
          id, founder_id, type, category, amount, currency,
          description, counterparty_name, source, source_id,
          date, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, ${founderId}, ${txType}, ${category},
          ${parseFloat(row.amount)}, ${row.currency || 'USD'},
          ${row.description || row.memo}, ${row.counterparty_name}, 'treasury', ${row.id},
          ${row.created_at}, NOW(), NOW()
        )
      `;
      synced++;
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} treasury transaction(s).`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to sync treasury: ${error.message}`,
    };
  }
}

/**
 * Pull transactions from project financials
 */
export async function aggregateFromProjects(
  founderId: string,
  period: Period
): Promise<{ success: boolean; synced?: number; message: string }> {
  try {
    // Get projects owned by founder
    const projectsResult = await sql`
      SELECT id, name FROM founder_projects WHERE owner_id = ${founderId}
    `;

    if (projectsResult.rows.length === 0) {
      return {
        success: true,
        synced: 0,
        message: 'No projects found. Nothing to sync.',
      };
    }

    const projectIds = projectsResult.rows.map((r) => r.id);
    let synced = 0;

    // Get project financials not yet synced
    const finResult = await sql`
      SELECT pf.*, p.name as project_name
      FROM founder_project_financials pf
      JOIN founder_projects p ON pf.project_id = p.id
      LEFT JOIN founder_financial_transactions f ON f.source_id = pf.id AND f.source = 'project'
      WHERE pf.project_id = ANY(${projectIds})
        AND pf.date >= ${period.start.toISOString()}
        AND pf.date <= ${period.end.toISOString()}
        AND f.id IS NULL
    `;

    for (const row of finResult.rows) {
      const txType: TransactionType = row.type === 'income' ? 'income' : 'expense';
      const category = mapProjectCategory(row.category);

      await sql`
        INSERT INTO founder_financial_transactions (
          id, founder_id, type, category, amount, currency,
          description, counterparty_name, source, source_id, project_id,
          date, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, ${founderId}, ${txType}, ${category},
          ${parseFloat(row.amount)}, 'USD',
          ${row.description || `${row.project_name} - ${row.category}`},
          ${row.vendor || null}, 'project', ${row.id}, ${row.project_id},
          ${row.date}, NOW(), NOW()
        )
      `;
      synced++;
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} project transaction(s) from ${projectsResult.rows.length} project(s).`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to sync projects: ${error.message}`,
    };
  }
}

/**
 * Pull transactions from escrow releases
 */
export async function aggregateFromEscrow(
  founderId: string,
  period: Period
): Promise<{ success: boolean; synced?: number; message: string }> {
  try {
    // Get escrow transactions where founder is buyer or seller
    const escrowResult = await sql`
      SELECT et.*, ed.buyer_id, ed.seller_id
      FROM escrow_transactions et
      JOIN escrow_deals ed ON et.escrow_id = ed.id
      LEFT JOIN founder_financial_transactions f ON f.source_id = et.id AND f.source = 'escrow'
      WHERE (ed.buyer_id = ${founderId} OR ed.seller_id = ${founderId})
        AND et.created_at >= ${period.start.toISOString()}
        AND et.created_at <= ${period.end.toISOString()}
        AND et.status = 'completed'
        AND f.id IS NULL
    `;

    let synced = 0;

    for (const row of escrowResult.rows) {
      let txType: TransactionType;
      let category: TransactionCategory;

      if (row.type === 'release' || row.type === 'milestone_release') {
        // Seller receives payment
        if (row.seller_id === founderId) {
          txType = 'income';
          category = 'service_revenue';
        } else {
          // Buyer paid (already deducted during escrow creation)
          continue;
        }
      } else if (row.type === 'refund') {
        // Buyer gets refund
        if (row.buyer_id === founderId) {
          txType = 'income';
          category = 'other_income';
        } else {
          continue;
        }
      } else if (row.type === 'fund') {
        // Buyer funded escrow
        if (row.buyer_id === founderId) {
          txType = 'expense';
          category = 'services';
        } else {
          continue;
        }
      } else {
        continue;
      }

      await sql`
        INSERT INTO founder_financial_transactions (
          id, founder_id, type, category, amount, currency,
          description, source, source_id,
          date, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, ${founderId}, ${txType}, ${category},
          ${parseFloat(row.amount)}, 'USDC',
          ${`Escrow ${row.type}: ${row.escrow_id}`},
          'escrow', ${row.id},
          ${row.created_at}, NOW(), NOW()
        )
      `;
      synced++;
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} escrow transaction(s).`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to sync escrow: ${error.message}`,
    };
  }
}

/**
 * Pull GRAIN transactions
 */
export async function aggregateFromGrain(
  founderId: string,
  period: Period
): Promise<{ success: boolean; synced?: number; message: string }> {
  try {
    // Get treasury account
    const accountResult = await sql`
      SELECT id FROM treasury_accounts WHERE clerk_user_id = ${founderId} LIMIT 1
    `;

    if (accountResult.rows.length === 0) {
      return {
        success: true,
        synced: 0,
        message: 'No GRAIN account found. Nothing to sync.',
      };
    }

    const accountId = accountResult.rows[0].id;

    // Get GRAIN transactions not yet synced
    const grainResult = await sql`
      SELECT g.*
      FROM grain_transactions g
      LEFT JOIN founder_financial_transactions f ON f.source_id = g.id AND f.source = 'grain'
      WHERE g.account_id = ${accountId}
        AND g.created_at >= ${period.start.toISOString()}
        AND g.created_at <= ${period.end.toISOString()}
        AND g.status = 'completed'
        AND f.id IS NULL
    `;

    let synced = 0;

    for (const row of grainResult.rows) {
      let txType: TransactionType;
      let category: TransactionCategory;

      switch (row.type) {
        case 'deposit':
        case 'transfer_in':
          txType = 'income';
          category = 'other_income';
          break;
        case 'withdraw':
        case 'transfer_out':
          txType = 'expense';
          category = 'other';
          break;
        case 'platform_fee':
          txType = 'fee';
          category = 'platform_fees';
          break;
        case 'escrow_hold':
        case 'escrow_release':
          // Skip - handled by escrow sync
          continue;
        default:
          txType = 'expense';
          category = 'other';
      }

      await sql`
        INSERT INTO founder_financial_transactions (
          id, founder_id, type, category, amount, currency,
          description, source, source_id,
          date, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}, ${founderId}, ${txType}, ${category},
          ${parseFloat(row.grain_amount || row.usd_amount || 0)}, 'GRAIN',
          ${row.description || `GRAIN ${row.type}`},
          'grain', ${row.id},
          ${row.created_at}, NOW(), NOW()
        )
      `;
      synced++;
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} GRAIN transaction(s).`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to sync GRAIN: ${error.message}`,
    };
  }
}

/**
 * Sync all financial sources
 */
export async function syncAllSources(
  founderId: string
): Promise<{ success: boolean; total?: number; message: string }> {
  try {
    // Default to last 90 days
    const now = new Date();
    const period: Period = {
      start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      end: now,
    };

    const results = await Promise.all([
      aggregateFromTreasury(founderId, period),
      aggregateFromProjects(founderId, period),
      aggregateFromEscrow(founderId, period),
      aggregateFromGrain(founderId, period),
    ]);

    const total = results.reduce((sum, r) => sum + (r.synced || 0), 0);

    const details = results
      .filter((r) => (r.synced || 0) > 0)
      .map((r) => r.message)
      .join(' ');

    return {
      success: true,
      total,
      message: total > 0
        ? `Synced ${total} total transaction(s). ${details}`
        : 'All sources already synced. No new transactions.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to sync all sources: ${error.message}`,
    };
  }
}

// ============================================================================
// FORECASTING FUNCTIONS
// ============================================================================

/**
 * Project future cash flow
 */
export async function forecastCashFlow(
  founderId: string,
  months: number = 6
): Promise<{ success: boolean; forecast?: CashFlowForecast; message: string }> {
  try {
    // Get current cash position
    const cashResult = await getCashPosition(founderId);
    if (!cashResult.success) {
      return cashResult;
    }

    const currentBalance = cashResult.totalBalance!;

    // Get historical averages
    const burnResult = await getBurnRate(founderId);
    const avgBurn = burnResult.burnRate || 0;

    // Get average revenue (last 3 months)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const revenueResult = await sql`
      SELECT
        AVG(monthly_revenue) as avg_revenue
      FROM (
        SELECT DATE_TRUNC('month', date) as month, SUM(amount) as monthly_revenue
        FROM founder_financial_transactions
        WHERE founder_id = ${founderId}
          AND type = 'income'
          AND date >= ${threeMonthsAgo.toISOString()}
        GROUP BY DATE_TRUNC('month', date)
      ) monthly
    `;

    const avgRevenue = parseFloat(revenueResult.rows[0]?.avg_revenue || '0');

    // Build forecast
    const forecastMonths: CashFlowForecast['months'] = [];
    let runningBalance = currentBalance;
    let lowestBalance = currentBalance;
    let breakEvenMonth: Date | undefined;

    for (let i = 1; i <= months; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const projectedInflows = avgRevenue;
      const projectedOutflows = avgBurn;
      const netChange = projectedInflows - projectedOutflows;

      runningBalance += netChange;
      if (runningBalance < lowestBalance) {
        lowestBalance = runningBalance;
      }

      const runwayRemaining = projectedOutflows > 0
        ? Math.max(0, runningBalance / projectedOutflows)
        : Infinity;

      // Check for break-even
      if (!breakEvenMonth && projectedInflows >= projectedOutflows) {
        breakEvenMonth = month;
      }

      forecastMonths.push({
        month,
        projectedInflows,
        projectedOutflows,
        projectedBalance: runningBalance,
        runwayRemaining: isFinite(runwayRemaining) ? runwayRemaining : 999,
      });
    }

    const forecast: CashFlowForecast = {
      months: forecastMonths,
      breakEvenMonth,
      lowestBalance,
      endingBalance: runningBalance,
    };

    let message = `${months}-month forecast: `;
    if (lowestBalance < 0) {
      const negativeMonth = forecastMonths.find((m) => m.projectedBalance < 0);
      message += `Warning: Cash runs out in ${negativeMonth ? Math.ceil((negativeMonth.month.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)) : '?'} months. `;
    }
    message += `Projected ending balance: $${runningBalance.toLocaleString()}.`;

    return { success: true, forecast, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to forecast: ${error.message}`,
    };
  }
}

/**
 * Projected burn rate changes
 */
export async function forecastBurnRate(
  founderId: string
): Promise<{ success: boolean; current?: number; projected?: number; trend?: string; message: string }> {
  try {
    const burnResult = await getBurnRate(founderId);

    if (!burnResult.success) {
      return burnResult;
    }

    const current = burnResult.burnRate || 0;
    const trend = burnResult.trend || 0;

    // Project next month based on trend
    const projected = current * (1 + trend / 100);

    let trendDescription: string;
    if (trend > 10) {
      trendDescription = 'increasing significantly';
    } else if (trend > 0) {
      trendDescription = 'slightly increasing';
    } else if (trend < -10) {
      trendDescription = 'decreasing significantly';
    } else if (trend < 0) {
      trendDescription = 'slightly decreasing';
    } else {
      trendDescription = 'stable';
    }

    let message = `Burn rate: $${current.toLocaleString()}/mo (${trendDescription}). `;
    message += `Projected next month: $${projected.toLocaleString()}/mo.`;

    return {
      success: true,
      current,
      projected,
      trend: trendDescription,
      message,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to forecast burn rate: ${error.message}`,
    };
  }
}

/**
 * What-if scenario analysis
 */
export async function scenarioAnalysis(
  founderId: string,
  scenarios: ForecastScenario[]
): Promise<{ success: boolean; results?: Array<{ scenario: ForecastScenario; forecast: CashFlowForecast }>; message: string }> {
  try {
    // Get baseline metrics
    const cashResult = await getCashPosition(founderId);
    const burnResult = await getBurnRate(founderId);

    if (!cashResult.success || !burnResult.success) {
      return {
        success: false,
        message: 'Need financial history to run scenarios.',
      };
    }

    const currentBalance = cashResult.totalBalance!;
    const currentBurn = burnResult.burnRate || 0;

    // Get baseline revenue
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const revenueResult = await sql`
      SELECT SUM(amount) as revenue
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND type = 'income'
        AND date >= ${lastMonth.toISOString()}
    `;
    const baselineRevenue = parseFloat(revenueResult.rows[0]?.revenue || '0');

    const results: Array<{ scenario: ForecastScenario; forecast: CashFlowForecast }> = [];

    for (const scenario of scenarios) {
      const forecastMonths: CashFlowForecast['months'] = [];
      let runningBalance = currentBalance;
      let revenue = baselineRevenue;
      let expenses = currentBurn;
      let lowestBalance = currentBalance;
      let breakEvenMonth: Date | undefined;

      for (let i = 1; i <= scenario.months; i++) {
        revenue *= (1 + scenario.revenueGrowthRate / 100);
        expenses *= (1 + scenario.expenseGrowthRate / 100);

        const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const netChange = revenue - expenses;
        runningBalance += netChange;

        if (runningBalance < lowestBalance) {
          lowestBalance = runningBalance;
        }

        if (!breakEvenMonth && revenue >= expenses) {
          breakEvenMonth = month;
        }

        const runwayRemaining = expenses > 0 ? Math.max(0, runningBalance / expenses) : Infinity;

        forecastMonths.push({
          month,
          projectedInflows: revenue,
          projectedOutflows: expenses,
          projectedBalance: runningBalance,
          runwayRemaining: isFinite(runwayRemaining) ? runwayRemaining : 999,
        });
      }

      results.push({
        scenario,
        forecast: {
          months: forecastMonths,
          breakEvenMonth,
          lowestBalance,
          endingBalance: runningBalance,
        },
      });
    }

    const bestScenario = results.reduce((best, r) =>
      r.forecast.endingBalance > best.forecast.endingBalance ? r : best
    );
    const worstScenario = results.reduce((worst, r) =>
      r.forecast.endingBalance < worst.forecast.endingBalance ? r : worst
    );

    let message = `Analyzed ${scenarios.length} scenarios. `;
    message += `Best: "${bestScenario.scenario.name}" ($${bestScenario.forecast.endingBalance.toLocaleString()} ending). `;
    message += `Worst: "${worstScenario.scenario.name}" ($${worstScenario.forecast.endingBalance.toLocaleString()} ending).`;

    return { success: true, results, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to run scenarios: ${error.message}`,
    };
  }
}

// ============================================================================
// REPORTING FUNCTIONS
// ============================================================================

/**
 * Generate financial report
 */
export async function generateFinancialReport(
  founderId: string,
  period: Period,
  format: 'json' | 'summary' = 'summary'
): Promise<{ success: boolean; report?: unknown; message: string }> {
  try {
    // Gather all data
    const [plResult, cashFlowResult, kpisResult, budgetResult] = await Promise.all([
      getPLStatement(founderId, period),
      getCashFlowStatement(founderId, period),
      getKPIs(founderId),
      getBudgetComparison(founderId, period),
    ]);

    const report = {
      period,
      generatedAt: new Date(),
      profitAndLoss: plResult.pl,
      cashFlow: cashFlowResult.cashFlow,
      kpis: kpisResult.kpis,
      budgetComparison: budgetResult.comparisons,
    };

    if (format === 'json') {
      return {
        success: true,
        report,
        message: 'Financial report generated.',
      };
    }

    // Generate summary
    let summary = `Financial Report (${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()})\n\n`;

    if (plResult.pl) {
      summary += `P&L Summary:\n`;
      summary += `  Revenue: $${plResult.pl.revenue.total.toLocaleString()}\n`;
      summary += `  Gross Profit: $${plResult.pl.grossProfit.toLocaleString()} (${plResult.pl.grossMargin.toFixed(1)}% margin)\n`;
      summary += `  Net Income: $${plResult.pl.netIncome.toLocaleString()} (${plResult.pl.netMargin.toFixed(1)}% margin)\n\n`;
    }

    if (cashFlowResult.cashFlow) {
      summary += `Cash Flow:\n`;
      summary += `  Operating: $${cashFlowResult.cashFlow.operating.net.toLocaleString()}\n`;
      summary += `  Closing Balance: $${cashFlowResult.cashFlow.closing.toLocaleString()}\n`;
      summary += `  Runway: ${cashFlowResult.cashFlow.runway.months.toFixed(1)} months\n\n`;
    }

    if (kpisResult.kpis) {
      summary += `Key Metrics:\n`;
      summary += `  Burn Rate: $${kpisResult.kpis.burnRate.toLocaleString()}/mo\n`;
      summary += `  Avg Transaction: $${kpisResult.kpis.averageTransactionSize.toLocaleString()}\n`;
    }

    return {
      success: true,
      report: format === 'json' ? report : summary,
      message: 'Financial report generated successfully.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to generate report: ${error.message}`,
    };
  }
}

/**
 * Get key financial metrics
 */
export async function getKPIs(
  founderId: string
): Promise<{ success: boolean; kpis?: FinancialKPIs; message: string }> {
  try {
    // Get last month's P&L for margins
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const plResult = await getPLStatement(founderId, { start: lastMonthStart, end: lastMonthEnd });
    const burnResult = await getBurnRate(founderId);
    const runwayResult = await getRunway(founderId);

    // Get transaction stats
    const statsResult = await sql`
      SELECT
        COUNT(*) as tx_count,
        AVG(amount) as avg_amount
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND date >= ${lastMonthStart.toISOString()}
    `;

    // Get revenue growth (month over month)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const growthResult = await sql`
      SELECT
        DATE_TRUNC('month', date) as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type IN ('expense', 'fee') THEN amount ELSE 0 END) as expenses
      FROM founder_financial_transactions
      WHERE founder_id = ${founderId}
        AND date >= ${twoMonthsAgo.toISOString()}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month ASC
    `;

    let revenueGrowth: number | undefined;
    let expenseGrowth: number | undefined;

    if (growthResult.rows.length >= 2) {
      const prev = growthResult.rows[0];
      const curr = growthResult.rows[1];

      const prevRevenue = parseFloat(prev.revenue) || 0;
      const currRevenue = parseFloat(curr.revenue) || 0;
      const prevExpenses = parseFloat(prev.expenses) || 0;
      const currExpenses = parseFloat(curr.expenses) || 0;

      if (prevRevenue > 0) {
        revenueGrowth = ((currRevenue - prevRevenue) / prevRevenue) * 100;
      }
      if (prevExpenses > 0) {
        expenseGrowth = ((currExpenses - prevExpenses) / prevExpenses) * 100;
      }
    }

    const kpis: FinancialKPIs = {
      grossMargin: plResult.pl?.grossMargin || 0,
      netMargin: plResult.pl?.netMargin || 0,
      burnRate: burnResult.burnRate || 0,
      runway: runwayResult.runway || 0,
      revenueGrowth,
      expenseGrowth,
      averageTransactionSize: parseFloat(statsResult.rows[0]?.avg_amount || '0'),
      transactionCount: parseInt(statsResult.rows[0]?.tx_count || '0'),
    };

    let message = `KPIs: `;
    message += `Gross Margin ${kpis.grossMargin.toFixed(1)}%, `;
    message += `Burn $${kpis.burnRate.toLocaleString()}/mo, `;
    message += `Runway ${kpis.runway.toFixed(1)} months.`;

    if (revenueGrowth !== undefined) {
      message += ` Revenue ${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}% MoM.`;
    }

    return { success: true, kpis, message };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to calculate KPIs: ${error.message}`,
    };
  }
}

// ============================================================================
// NATURAL LANGUAGE FUNCTIONS
// ============================================================================

/**
 * Parse expense entry from natural language
 */
export async function parseExpenseFromText(
  text: string
): Promise<{ success: boolean; parsed?: ParsedExpense; message: string }> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Extract expense details from this text. Return JSON only, no explanation.

Text: "${text}"

Today's date: ${new Date().toISOString().split('T')[0]}

Return this exact JSON structure (use null for missing fields):
{
  "amount": 500.00,
  "category": "marketing",
  "description": "Facebook ads campaign",
  "vendor": "Meta",
  "date": "2025-01-15",
  "projectId": null
}

Valid categories:
revenue, service_revenue, product_revenue, other_income,
cogs, materials, labor, services,
opex, payroll, marketing, software, rent, utilities, travel, professional_services,
fees, platform_fees, payment_fees, success_fees,
financing, interest, loan_payment, other

Parse amounts from formats like "$500", "500 dollars", "five hundred", "$5k"
Parse dates from formats like "yesterday", "last week", "January 15th"`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {
        success: false,
        message: 'Could not parse expense. Try: "Spent $500 on marketing yesterday"',
      };
    }

    const parsed = JSON.parse(content.text);

    let date: Date | undefined;
    if (parsed.date) {
      date = new Date(parsed.date);
      if (isNaN(date.getTime())) date = undefined;
    }

    // Calculate confidence
    let confidence = 0.5;
    if (parsed.amount) confidence += 0.25;
    if (parsed.category && parsed.category !== 'other') confidence += 0.15;
    if (parsed.vendor) confidence += 0.1;

    const result: ParsedExpense = {
      amount: parsed.amount || undefined,
      category: parsed.category || undefined,
      description: parsed.description || undefined,
      vendor: parsed.vendor || undefined,
      date,
      projectId: parsed.projectId || undefined,
      confidence: Math.min(confidence, 1),
    };

    let message: string;
    if (result.amount) {
      message = `Parsed: $${result.amount.toLocaleString()}`;
      if (result.category) message += ` (${result.category})`;
      if (result.vendor) message += ` to ${result.vendor}`;
      if (result.description) message += ` - "${result.description}"`;
      message += `. Ready to add?`;
    } else {
      message = 'Could not find amount. Try: "Spent $500 on marketing"';
    }

    return { success: true, parsed: result, message };
  } catch (error: any) {
    // Fallback to regex parsing
    const amountMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:k|K)?/);
    let amount: number | undefined;

    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (text.toLowerCase().includes('k') && amount < 1000) {
        amount *= 1000;
      }
    }

    // Try to extract category
    let category: TransactionCategory | undefined;
    const categoryKeywords: Record<string, TransactionCategory> = {
      marketing: 'marketing',
      ads: 'marketing',
      advertising: 'marketing',
      software: 'software',
      saas: 'software',
      subscription: 'software',
      rent: 'rent',
      office: 'rent',
      payroll: 'payroll',
      salary: 'payroll',
      wages: 'payroll',
      contractor: 'labor',
      freelance: 'labor',
      materials: 'materials',
      supplies: 'materials',
      travel: 'travel',
      flight: 'travel',
      hotel: 'travel',
      legal: 'professional_services',
      accounting: 'professional_services',
    };

    const lowerText = text.toLowerCase();
    for (const [keyword, cat] of Object.entries(categoryKeywords)) {
      if (lowerText.includes(keyword)) {
        category = cat;
        break;
      }
    }

    // Vendor extraction
    const vendorMatch = text.match(/(?:to|from|at|paid)\s+([A-Z][A-Za-z\s]+?)(?:\s+for|\s+\$|$)/i);
    const vendor = vendorMatch ? vendorMatch[1].trim() : undefined;

    return {
      success: true,
      parsed: {
        amount,
        category,
        vendor,
        confidence: (amount ? 0.4 : 0) + (category ? 0.2 : 0) + (vendor ? 0.1 : 0),
      },
      message: amount
        ? `Found $${amount}${category ? ` (${category})` : ''}${vendor ? ` to ${vendor}` : ''}. Confirm to add.`
        : 'Could not find amount. Please specify like: "$500 for marketing"',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapRowToTransaction(row: any): FinancialTransaction {
  return {
    id: row.id,
    founderId: row.founder_id,
    type: row.type,
    category: row.category,
    amount: parseFloat(row.amount),
    currency: row.currency || 'USD',
    description: row.description,
    counterpartyId: row.counterparty_id,
    counterpartyName: row.counterparty_name,
    source: row.source,
    sourceId: row.source_id,
    projectId: row.project_id,
    date: new Date(row.date),
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapProjectCategory(projectCategory: string): TransactionCategory {
  const mapping: Record<string, TransactionCategory> = {
    materials: 'materials',
    labor: 'labor',
    equipment: 'cogs',
    services: 'services',
    overhead: 'opex',
    contingency: 'other',
    other: 'other',
  };
  return mapping[projectCategory] || 'other';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FinancialService = {
  // P&L
  getPLStatement,
  getMonthlyPL,
  getQuarterlyPL,
  getYTDPL,

  // Cash Flow
  getCashFlowStatement,
  getBurnRate,
  getRunway,
  getCashPosition,

  // Budget
  setBudget,
  getBudget,
  getBudgetComparison,
  getBudgetAlerts,

  // Transactions
  getTransactions,
  categorizeTransaction,
  bulkCategorize,
  addManualTransaction,
  importTransactions,

  // Aggregation
  aggregateFromTreasury,
  aggregateFromProjects,
  aggregateFromEscrow,
  aggregateFromGrain,
  syncAllSources,

  // Forecasting
  forecastCashFlow,
  forecastBurnRate,
  scenarioAnalysis,

  // Reporting
  generateFinancialReport,
  getKPIs,

  // Natural Language
  parseExpenseFromText,
};

export default FinancialService;
