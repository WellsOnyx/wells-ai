/**
 * Plaid Integration for Credit Underwriting
 * Wells AI: Bank account connection and transaction analysis
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

// Types
export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
}

export interface BankConnection {
  accessToken: string;
  itemId: string;
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccount[];
}

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  currentBalance: number;
  availableBalance: number;
}

export interface TransactionAnalysis {
  // Cash flow metrics
  avgMonthlyInflow: number;
  avgMonthlyOutflow: number;
  netCashFlow: number;
  cashFlowVolatility: number; // standard deviation

  // Revenue detection
  recurringRevenue: number;
  revenueGrowthRate: number;
  largestCustomers: CustomerRevenue[];

  // Expenses
  avgMonthlyExpenses: number;
  expenseCategories: Record<string, number>;

  // Risk indicators
  insufficientFundsFees: number;
  overdraftCount: number;
  negativeDays: number;

  // Banking behavior
  accountAge: number; // months
  avgBalance: number;
  minBalance: number;
  maxBalance: number;

  // Transaction patterns
  totalTransactions: number;
  transactionFrequency: number; // per month
}

export interface CustomerRevenue {
  name: string;
  monthlyAverage: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  reliability: number; // 0-1
}

// Initialize Plaid client
const getPlaidClient = (): PlaidApi => {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(config);
};

/**
 * Create Plaid Link token for bank connection
 */
export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Wells AI',
      products: [Products.Transactions, Products.Auth, Products.Balance],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/plaid`,
    });

    return response.data.link_token;
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    throw new Error('Failed to create bank connection link');
  }
}

/**
 * Exchange public token for access token
 */
export async function exchangePublicToken(publicToken: string): Promise<BankConnection> {
  const client = getPlaidClient();

  try {
    // Exchange token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const itemResponse = await client.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id!;

    const institutionResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    // Get accounts
    const accountsResponse = await client.accountsGet({ access_token: accessToken });

    const accounts: PlaidAccount[] = accountsResponse.data.accounts.map((acc) => ({
      accountId: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype || '',
      mask: acc.mask || '',
      currentBalance: acc.balances.current || 0,
      availableBalance: acc.balances.available || 0,
    }));

    return {
      accessToken,
      itemId,
      institutionId,
      institutionName: institutionResponse.data.institution.name,
      accounts,
    };
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw new Error('Failed to connect bank account');
  }
}

/**
 * Fetch and analyze transaction history
 */
export async function analyzeTransactions(
  accessToken: string,
  lookbackMonths: number = 12
): Promise<TransactionAnalysis> {
  const client = getPlaidClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - lookbackMonths);

  try {
    // Fetch all transactions
    let allTransactions: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
      });

      const added = response.data.added.filter((t) => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
      });

      allTransactions = allTransactions.concat(added);
      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    // Get account info for balance history
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts;

    // Calculate metrics
    return calculateTransactionMetrics(allTransactions, accounts, lookbackMonths);
  } catch (error) {
    console.error('Error analyzing transactions:', error);
    throw new Error('Failed to analyze bank transactions');
  }
}

/**
 * Calculate comprehensive transaction metrics
 */
function calculateTransactionMetrics(
  transactions: any[],
  accounts: any[],
  lookbackMonths: number
): TransactionAnalysis {
  // Group transactions by month
  const monthlyData: Record<
    string,
    { inflow: number; outflow: number; transactions: any[] }
  > = {};

  let totalInflow = 0;
  let totalOutflow = 0;
  let insufficientFundsFees = 0;
  let overdraftCount = 0;

  // Revenue patterns (track incoming payments)
  const revenueBySource: Record<string, number[]> = {};

  transactions.forEach((tx) => {
    const month = tx.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = { inflow: 0, outflow: 0, transactions: [] };
    }

    const amount = Math.abs(tx.amount);

    if (tx.amount < 0) {
      // Negative amount = money in (Plaid convention)
      monthlyData[month].inflow += amount;
      totalInflow += amount;

      // Track revenue sources
      const source = tx.merchant_name || tx.name || 'Unknown';
      if (!revenueBySource[source]) {
        revenueBySource[source] = [];
      }
      revenueBySource[source].push(amount);
    } else {
      // Positive amount = money out
      monthlyData[month].outflow += amount;
      totalOutflow += amount;

      // Check for NSF fees
      if (
        tx.category?.includes('Bank Fees') &&
        (tx.name.toLowerCase().includes('insufficient') ||
          tx.name.toLowerCase().includes('nsf') ||
          tx.name.toLowerCase().includes('overdraft'))
      ) {
        insufficientFundsFees += amount;
        overdraftCount++;
      }
    }

    monthlyData[month].transactions.push(tx);
  });

  const months = Object.keys(monthlyData).sort();
  const avgMonthlyInflow = totalInflow / lookbackMonths;
  const avgMonthlyOutflow = totalOutflow / lookbackMonths;
  const netCashFlow = avgMonthlyInflow - avgMonthlyOutflow;

  // Calculate cash flow volatility
  const monthlyNetFlows = months.map(
    (m) => monthlyData[m].inflow - monthlyData[m].outflow
  );
  const cashFlowVolatility = calculateStdDev(monthlyNetFlows);

  // Detect recurring revenue
  const largestCustomers: CustomerRevenue[] = Object.entries(revenueBySource)
    .filter(([_, amounts]) => amounts.length >= 3) // At least 3 transactions
    .map(([name, amounts]) => ({
      name,
      monthlyAverage: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      frequency: detectFrequency(amounts.length, lookbackMonths),
      reliability: calculateReliability(amounts),
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
    .slice(0, 10);

  const recurringRevenue = largestCustomers.reduce(
    (sum, c) => sum + c.monthlyAverage,
    0
  );

  // Calculate revenue growth
  const recentMonths = months.slice(-3);
  const olderMonths = months.slice(0, 3);
  const recentRevenue =
    recentMonths.reduce((sum, m) => sum + monthlyData[m].inflow, 0) / recentMonths.length;
  const olderRevenue =
    olderMonths.reduce((sum, m) => sum + monthlyData[m].inflow, 0) / olderMonths.length;
  const revenueGrowthRate = olderRevenue > 0 ? (recentRevenue - olderRevenue) / olderRevenue : 0;

  // Expense analysis
  const avgMonthlyExpenses = avgMonthlyOutflow;
  const expenseCategories: Record<string, number> = {};
  transactions
    .filter((t) => t.amount > 0)
    .forEach((t) => {
      const category = t.category?.[0] || 'Uncategorized';
      expenseCategories[category] = (expenseCategories[category] || 0) + t.amount;
    });

  // Balance metrics
  const currentBalances = accounts.map((a) => a.balances.current || 0);
  const avgBalance = currentBalances.reduce((a, b) => a + b, 0) / accounts.length;
  const minBalance = Math.min(...currentBalances);
  const maxBalance = Math.max(...currentBalances);

  // Account age (estimate from oldest transaction)
  const oldestTransaction = transactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];
  const accountAge = oldestTransaction
    ? Math.floor(
        (Date.now() - new Date(oldestTransaction.date).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    : 0;

  // Negative balance days (estimate)
  const negativeDays = overdraftCount * 3; // Rough estimate

  return {
    avgMonthlyInflow,
    avgMonthlyOutflow,
    netCashFlow,
    cashFlowVolatility,
    recurringRevenue,
    revenueGrowthRate,
    largestCustomers,
    avgMonthlyExpenses,
    expenseCategories,
    insufficientFundsFees,
    overdraftCount,
    negativeDays,
    accountAge,
    avgBalance,
    minBalance,
    maxBalance,
    totalTransactions: transactions.length,
    transactionFrequency: transactions.length / lookbackMonths,
  };
}

/**
 * Get real-time account balance
 */
export async function getAccountBalance(accessToken: string): Promise<number> {
  const client = getPlaidClient();

  try {
    const response = await client.accountsBalanceGet({ access_token: accessToken });
    return response.data.accounts.reduce((sum, acc) => sum + (acc.balances.current || 0), 0);
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw new Error('Failed to fetch account balance');
  }
}

/**
 * Verify account for ACH
 */
export async function verifyAccountForACH(accessToken: string, accountId: string): Promise<{
  accountNumber: string;
  routingNumber: string;
  verified: boolean;
}> {
  const client = getPlaidClient();

  try {
    const response = await client.authGet({ access_token: accessToken });
    const account = response.data.accounts.find((a) => a.account_id === accountId);
    const numbers = response.data.numbers.ach?.find((n) => n.account_id === accountId);

    if (!account || !numbers) {
      throw new Error('Account not found or not verified');
    }

    return {
      accountNumber: numbers.account,
      routingNumber: numbers.routing,
      verified: true,
    };
  } catch (error) {
    console.error('Error verifying account:', error);
    throw new Error('Failed to verify account for ACH');
  }
}

// Helper functions

function calculateStdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

function detectFrequency(
  count: number,
  months: number
): 'weekly' | 'biweekly' | 'monthly' | 'irregular' {
  const perMonth = count / months;
  if (perMonth >= 3.5) return 'weekly';
  if (perMonth >= 1.5) return 'biweekly';
  if (perMonth >= 0.8) return 'monthly';
  return 'irregular';
}

function calculateReliability(amounts: number[]): number {
  if (amounts.length < 2) return 0;

  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / avg;

  // Lower CV = higher reliability
  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}
