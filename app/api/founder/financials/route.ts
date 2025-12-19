/**
 * Founder Financials API
 * GET: Get P&L, cash flow, budget, transactions
 * POST: Manage transactions, budgets, sync sources, generate reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  FinancialService,
  TransactionCategory,
  TransactionType,
  Period,
} from '@/lib/founder/financial-service';

export const dynamic = 'force-dynamic';

// Parse period from query params or natural language
function parsePeriod(periodStr: string | null, start: string | null, end: string | null): Period {
  if (start && end) {
    return {
      start: new Date(start),
      end: new Date(end),
    };
  }

  const now = new Date();

  switch (periodStr) {
    case 'today':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: now,
      };
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart, end: now };
    case 'month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };
    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { start: quarterStart, end: now };
    case 'ytd':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: now,
      };
    case 'year':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
      };
    default:
      // Default to current month
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };
  }
}

// Parse transaction from natural language
function parseTransactionFromText(text: string): {
  amount?: number;
  type?: TransactionType;
  category?: TransactionCategory;
  description?: string;
  counterpartyName?: string;
  date?: Date;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof parseTransactionFromText> = {};

  // Parse amount
  const amountMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:k|K)?/);
  if (amountMatch) {
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (lower.includes('k') && amount < 1000) amount *= 1000;
    result.amount = amount;
  }

  // Parse type
  if (lower.includes('revenue') || lower.includes('income') || lower.includes('received') || lower.includes('earned')) {
    result.type = 'income';
  } else if (lower.includes('spent') || lower.includes('paid') || lower.includes('expense') || lower.includes('bought')) {
    result.type = 'expense';
  }

  // Parse category
  const categoryKeywords: Record<string, TransactionCategory> = {
    'revenue': 'revenue',
    'sales': 'revenue',
    'service': 'service_revenue',
    'product': 'product_revenue',
    'materials': 'materials',
    'inventory': 'materials',
    'labor': 'labor',
    'contractor': 'labor',
    'payroll': 'payroll',
    'salary': 'payroll',
    'marketing': 'marketing',
    'ads': 'marketing',
    'software': 'software',
    'subscription': 'software',
    'saas': 'software',
    'rent': 'rent',
    'office': 'rent',
    'utilities': 'utilities',
    'travel': 'travel',
    'legal': 'professional_services',
    'accounting': 'professional_services',
    'consulting': 'professional_services',
    'fee': 'fees',
    'platform fee': 'platform_fees',
    'payment fee': 'payment_fees',
    'stripe': 'payment_fees',
    'interest': 'interest',
    'loan': 'loan_payment',
  };

  for (const [keyword, category] of Object.entries(categoryKeywords)) {
    if (lower.includes(keyword)) {
      result.category = category;
      break;
    }
  }

  // Parse date
  if (lower.includes('yesterday')) {
    result.date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (lower.includes('today')) {
    result.date = new Date();
  } else if (lower.includes('last week')) {
    result.date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  // Use text as description
  result.description = text;

  // Try to extract vendor/counterparty
  const vendorMatch = text.match(/(?:to|from|at|paid)\s+([A-Z][A-Za-z\s]+?)(?:\s+for|\s+\$|$)/i);
  if (vendorMatch) {
    result.counterpartyName = vendorMatch[1].trim();
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'summary';
    const periodStr = searchParams.get('period');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const period = parsePeriod(periodStr, startDate, endDate);

    switch (view) {
      case 'pl':
      case 'profit_loss': {
        const result = await FinancialService.getPLStatement(userId, period);
        return NextResponse.json({
          success: result.success,
          pl: result.pl,
          period,
          message: result.message,
        });
      }

      case 'monthly_pl': {
        const months = parseInt(searchParams.get('months') || '6');
        const result = await FinancialService.getMonthlyPL(userId, months);
        return NextResponse.json({
          success: result.success,
          statements: result.statements,
          message: result.message,
        });
      }

      case 'quarterly_pl': {
        const quarters = parseInt(searchParams.get('quarters') || '4');
        const result = await FinancialService.getQuarterlyPL(userId, quarters);
        return NextResponse.json({
          success: result.success,
          statements: result.statements,
          message: result.message,
        });
      }

      case 'ytd': {
        const result = await FinancialService.getYTDPL(userId);
        return NextResponse.json({
          success: result.success,
          pl: result.pl,
          message: result.message,
        });
      }

      case 'cash_flow': {
        const result = await FinancialService.getCashFlowStatement(userId, period);
        return NextResponse.json({
          success: result.success,
          cashFlow: result.cashFlow,
          period,
          message: result.message,
        });
      }

      case 'cash_position': {
        const result = await FinancialService.getCashPosition(userId);
        return NextResponse.json({
          success: result.success,
          usdBalance: result.usdBalance,
          grainBalance: result.grainBalance,
          totalBalance: result.totalBalance,
          escrowHeld: result.escrowHeld,
          message: result.message,
        });
      }

      case 'burn_rate': {
        const result = await FinancialService.getBurnRate(userId);
        return NextResponse.json({
          success: result.success,
          burnRate: result.burnRate,
          trend: result.trend,
          message: result.message,
        });
      }

      case 'runway': {
        const result = await FinancialService.getRunway(userId);
        return NextResponse.json({
          success: result.success,
          runway: result.runway,
          burnRate: result.burnRate,
          balance: result.balance,
          message: result.message,
        });
      }

      case 'budget': {
        const result = await FinancialService.getBudget(userId, period);
        return NextResponse.json({
          success: result.success,
          budget: result.budget,
          message: result.message,
        });
      }

      case 'budget_comparison': {
        const result = await FinancialService.getBudgetComparison(userId, period);
        return NextResponse.json({
          success: result.success,
          comparisons: result.comparisons,
          totalVariance: result.totalVariance,
          message: result.message,
        });
      }

      case 'budget_alerts': {
        const result = await FinancialService.getBudgetAlerts(userId);
        return NextResponse.json({
          success: result.success,
          alerts: result.alerts,
          message: result.message,
        });
      }

      case 'transactions': {
        const type = searchParams.get('type') as TransactionType | null;
        const category = searchParams.get('category') as TransactionCategory | null;
        const source = searchParams.get('source');
        const projectId = searchParams.get('projectId');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        const filters: any = {
          startDate: period.start,
          endDate: period.end,
          limit,
          offset,
        };
        if (type) filters.type = type;
        if (category) filters.category = category;
        if (source) filters.source = source;
        if (projectId) filters.projectId = projectId;
        if (search) filters.search = search;

        const result = await FinancialService.getTransactions(userId, filters);
        return NextResponse.json({
          success: result.success,
          transactions: result.transactions,
          total: result.total,
          message: result.message,
        });
      }

      case 'kpis': {
        const result = await FinancialService.getKPIs(userId);
        return NextResponse.json({
          success: result.success,
          kpis: result.kpis,
          message: result.message,
        });
      }

      case 'summary':
      default: {
        // Return comprehensive financial summary
        const [plResult, cashResult, burnResult, kpisResult] = await Promise.all([
          FinancialService.getPLStatement(userId, period),
          FinancialService.getCashPosition(userId),
          FinancialService.getBurnRate(userId),
          FinancialService.getKPIs(userId),
        ]);

        return NextResponse.json({
          success: true,
          pl: plResult.pl,
          cash: {
            usdBalance: cashResult.usdBalance,
            grainBalance: cashResult.grainBalance,
            totalBalance: cashResult.totalBalance,
          },
          burnRate: burnResult.burnRate,
          kpis: kpisResult.kpis,
          period,
          message: `Financial summary for ${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}. ${plResult.message}`,
        });
      }
    }
  } catch (error: any) {
    console.error('Error in financials GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, data } = body;

    // Parse from natural language if provided
    let parsedData = data || {};
    if (text) {
      const parsed = parseTransactionFromText(text);
      parsedData = { ...parsed, ...parsedData };
    }

    switch (action) {
      case 'set_budget': {
        const { period, categories, totalBudget } = parsedData;
        if (!period) {
          const now = new Date();
          parsedData.period = {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          };
        }

        if (!categories || Object.keys(categories).length === 0) {
          return NextResponse.json({
            success: false,
            message: "What's your budget by category? E.g., marketing: $5000, software: $2000, payroll: $20000",
          });
        }

        const periodObj = typeof period === 'string'
          ? parsePeriod(period, null, null)
          : period || parsedData.period;

        const result = await FinancialService.setBudget(userId, periodObj, categories);

        return NextResponse.json({
          success: result.success,
          budget: result.budget,
          message: result.message,
        });
      }

      case 'add_transaction': {
        if (!parsedData.amount) {
          // Try AI parsing
          const parseResult = await FinancialService.parseExpenseFromText(text || '');
          if (parseResult.success && parseResult.parsed?.amount) {
            parsedData = { ...parseResult.parsed, ...parsedData };
          } else {
            return NextResponse.json({
              success: false,
              message: "How much was it? Tell me the amount and what it was for.",
              parsed: parsedData,
            });
          }
        }

        if (!parsedData.type) {
          parsedData.type = 'expense'; // Default to expense
        }

        if (!parsedData.category) {
          parsedData.category = 'other';
        }

        const result = await FinancialService.addManualTransaction(userId, {
          type: parsedData.type,
          category: parsedData.category,
          amount: parsedData.amount,
          description: parsedData.description,
          counterpartyName: parsedData.counterpartyName || parsedData.vendor,
          date: parsedData.date ? new Date(parsedData.date) : undefined,
          projectId: parsedData.projectId,
          metadata: parsedData.metadata,
        });

        return NextResponse.json({
          success: result.success,
          transaction: result.transaction,
          message: result.message,
        });
      }

      case 'categorize': {
        const { transactionId, transactionIds, category } = parsedData;

        if (!category) {
          return NextResponse.json({
            success: false,
            message: "What category? Options: revenue, materials, labor, payroll, marketing, software, rent, utilities, travel, professional_services, fees, other.",
          });
        }

        if (transactionIds && Array.isArray(transactionIds)) {
          const result = await FinancialService.bulkCategorize(transactionIds, category);
          return NextResponse.json({
            success: result.success,
            updated: result.updated,
            message: result.message,
          });
        }

        if (!transactionId) {
          return NextResponse.json({
            success: false,
            message: "Which transaction should I categorize?",
          });
        }

        const result = await FinancialService.categorizeTransaction(transactionId, category);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'sync_sources': {
        const result = await FinancialService.syncAllSources(userId);

        return NextResponse.json({
          success: result.success,
          total: result.total,
          message: result.message,
        });
      }

      case 'forecast': {
        const { months } = parsedData;
        const result = await FinancialService.forecastCashFlow(userId, months || 6);

        return NextResponse.json({
          success: result.success,
          forecast: result.forecast,
          message: result.message,
        });
      }

      case 'forecast_burn': {
        const result = await FinancialService.forecastBurnRate(userId);

        return NextResponse.json({
          success: result.success,
          current: result.current,
          projected: result.projected,
          trend: result.trend,
          message: result.message,
        });
      }

      case 'scenario_analysis': {
        const { scenarios } = parsedData;
        if (!scenarios || !Array.isArray(scenarios)) {
          // Default scenarios
          parsedData.scenarios = [
            { name: 'Conservative', revenueGrowthRate: 5, expenseGrowthRate: 3, months: 12 },
            { name: 'Moderate', revenueGrowthRate: 15, expenseGrowthRate: 8, months: 12 },
            { name: 'Aggressive', revenueGrowthRate: 30, expenseGrowthRate: 15, months: 12 },
          ];
        }

        const result = await FinancialService.scenarioAnalysis(userId, parsedData.scenarios);

        return NextResponse.json({
          success: result.success,
          results: result.results,
          message: result.message,
        });
      }

      case 'generate_report': {
        const periodStr = parsedData.period;
        const period = parsePeriod(periodStr, parsedData.start, parsedData.end);
        const format = parsedData.format || 'summary';

        const result = await FinancialService.generateFinancialReport(userId, period, format);

        return NextResponse.json({
          success: result.success,
          report: result.report,
          message: result.message,
        });
      }

      case 'import': {
        const { source, transactions } = parsedData;
        if (!source || !transactions || !Array.isArray(transactions)) {
          return NextResponse.json({
            success: false,
            message: "I need the source name and transaction data to import. Format: {source: 'bank', transactions: [{date, amount, description}, ...]}",
          });
        }

        const result = await FinancialService.importTransactions(userId, source, transactions);

        return NextResponse.json({
          success: result.success,
          imported: result.imported,
          skipped: result.skipped,
          message: result.message,
        });
      }

      case 'parse': {
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Tell me about the expense and I'll help categorize it. E.g., 'Spent $500 on Facebook ads yesterday'.",
          });
        }

        const result = await FinancialService.parseExpenseFromText(text);

        return NextResponse.json({
          success: result.success,
          parsed: result.parsed,
          message: result.message,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "I can help with your financials. Try: 'Add $500 marketing expense', 'Show me this month's P&L', or 'What's my runway?'",
          availableActions: [
            'set_budget', 'add_transaction', 'categorize', 'sync_sources',
            'forecast', 'forecast_burn', 'scenario_analysis', 'generate_report',
            'import', 'parse',
          ],
        });
    }
  } catch (error: any) {
    console.error('Error in financials POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process financial action' },
      { status: 500 }
    );
  }
}
