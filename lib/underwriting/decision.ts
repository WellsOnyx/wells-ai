/**
 * Credit Decision Service
 * Wells AI: Instant credit approval and line management
 */

import { sql } from '@vercel/postgres';
import { analyzeTransactions } from './plaid';
import { getFinancialAnalysis } from './codat';
import { calculateCreditScore, CreditScore } from './scoring';

// Types
export interface CreditApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'activated';
  requestedAmount?: number;
  approvedAmount?: number;
  approvedAPR?: number;
  creditScore?: number;
  riskTier?: string;
  decisionFactors?: any;
  rejectionReason?: string;
  createdAt: Date;
  decidedAt?: Date;
  activatedAt?: Date;
}

export interface CreditLine {
  id: string;
  userId: string;
  creditLimit: number;
  availableCredit: number;
  apr: number;
  status: 'active' | 'suspended' | 'closed';
  riskTier: string;
  activatedAt: Date;
  autoPayEnabled: boolean;
}

export interface CreditDecision {
  approved: boolean;
  creditScore: CreditScore;
  approvedAmount: number;
  apr: number;
  rejectionReason?: string;
  conditions?: string[];
}

export interface DrawResult {
  success: boolean;
  drawId: string;
  amount: number;
  newAvailableCredit: number;
  disbursedAt?: Date;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  newAvailableCredit: number;
  processedAt?: Date;
  error?: string;
}

/**
 * Get instant credit decision
 */
export async function getInstantDecision(
  userId: string,
  plaidAccessToken?: string,
  codatCompanyId?: string
): Promise<CreditDecision> {
  try {
    // Fetch all data in parallel
    const [bankData, accountingData] = await Promise.all([
      plaidAccessToken ? analyzeTransactions(plaidAccessToken, 12) : Promise.resolve(undefined),
      codatCompanyId ? getFinancialAnalysis(codatCompanyId) : Promise.resolve(undefined),
    ]);

    // Calculate credit score
    const creditScore = await calculateCreditScore(userId, {
      bankData,
      financialRatios: accountingData?.ratios,
      revenueTrends: accountingData?.trends,
      arapAnalysis: accountingData?.arap,
    });

    // Make decision
    const approved = creditScore.score >= 400; // Minimum score for approval

    // Check for automatic rejection factors
    const rejectionReason = checkRejectionFactors(creditScore);

    // Apply policy conditions
    const conditions: string[] = [];
    if (creditScore.score < 600) {
      conditions.push('Personal guarantee required');
    }
    if (creditScore.riskTier === 'subprime') {
      conditions.push('Monthly payment verification required');
      conditions.push('Auto-pay from connected bank account required');
    }

    return {
      approved: approved && !rejectionReason,
      creditScore,
      approvedAmount: approved ? creditScore.recommendedLimit : 0,
      apr: creditScore.recommendedAPR,
      rejectionReason,
      conditions: conditions.length > 0 ? conditions : undefined,
    };
  } catch (error) {
    console.error('Error getting credit decision:', error);
    throw new Error('Failed to process credit decision');
  }
}

/**
 * Propose credit terms without full underwriting
 */
export async function proposeCredit(userId: string): Promise<{
  estimatedLimit: number;
  estimatedAPR: number;
  dataNeeded: string[];
}> {
  try {
    // Check for existing Wells history
    const historyResult = await sql`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_volume,
        COUNT(DISTINCT DATE_TRUNC('month', created_at)) as months_active
      FROM transactions
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '12 months'
    `;

    const history = historyResult.rows[0];
    const hasHistory = parseInt(history.transaction_count) > 10;

    const dataNeeded: string[] = [];
    if (!hasHistory) {
      dataNeeded.push('Connect your bank account for instant approval');
    }

    // Conservative estimate based on minimal data
    let estimatedLimit = 10000;
    let estimatedAPR = 14.99;

    if (hasHistory) {
      const volume = parseFloat(history.total_volume);
      estimatedLimit = Math.min(100000, Math.max(10000, volume * 0.2));
      estimatedAPR = 11.99;
    }

    return {
      estimatedLimit: Math.round(estimatedLimit / 1000) * 1000,
      estimatedAPR,
      dataNeeded,
    };
  } catch (error) {
    console.error('Error proposing credit:', error);
    throw new Error('Failed to propose credit terms');
  }
}

/**
 * Create credit application
 */
export async function createCreditApplication(
  userId: string,
  requestedAmount?: number,
  plaidAccessToken?: string,
  codatCompanyId?: string
): Promise<CreditApplication> {
  try {
    // Create application record
    const result = await sql`
      INSERT INTO credit_applications (
        user_id,
        status,
        requested_amount,
        plaid_access_token,
        codat_company_id
      ) VALUES (
        ${userId},
        'pending',
        ${requestedAmount || null},
        ${plaidAccessToken || null},
        ${codatCompanyId || null}
      )
      RETURNING *
    `;

    return mapApplicationRow(result.rows[0]);
  } catch (error) {
    console.error('Error creating credit application:', error);
    throw new Error('Failed to create credit application');
  }
}

/**
 * Process credit application and make decision
 */
export async function processCreditApplication(applicationId: string): Promise<CreditDecision> {
  try {
    // Get application
    const appResult = await sql`
      SELECT * FROM credit_applications
      WHERE id = ${applicationId}
    `;

    if (appResult.rowCount === 0) {
      throw new Error('Application not found');
    }

    const app = mapApplicationRow(appResult.rows[0]);

    // Get decision
    const decision = await getInstantDecision(
      app.userId,
      appResult.rows[0].plaid_access_token,
      appResult.rows[0].codat_company_id
    );

    // Update application
    await sql`
      UPDATE credit_applications
      SET
        status = ${decision.approved ? 'approved' : 'rejected'},
        approved_amount = ${decision.approvedAmount},
        approved_apr = ${decision.apr},
        credit_score = ${decision.creditScore.score},
        risk_tier = ${decision.creditScore.riskTier},
        decision_factors = ${JSON.stringify(decision.creditScore)},
        rejection_reason = ${decision.rejectionReason || null},
        decided_at = NOW()
      WHERE id = ${applicationId}
    `;

    return decision;
  } catch (error) {
    console.error('Error processing credit application:', error);
    throw new Error('Failed to process credit application');
  }
}

/**
 * Activate approved credit line
 */
export async function activateCreditLine(
  applicationId: string,
  autoPayEnabled: boolean = false,
  autoPayAccountId?: string
): Promise<CreditLine> {
  try {
    // Get approved application
    const appResult = await sql`
      SELECT * FROM credit_applications
      WHERE id = ${applicationId}
        AND status = 'approved'
    `;

    if (appResult.rowCount === 0) {
      throw new Error('No approved application found');
    }

    const app = appResult.rows[0];

    // Create credit line
    const result = await sql`
      INSERT INTO credit_lines (
        user_id,
        application_id,
        credit_limit,
        available_credit,
        apr,
        risk_tier,
        auto_pay_enabled,
        auto_pay_account_id,
        next_review_date
      ) VALUES (
        ${app.user_id},
        ${applicationId},
        ${app.approved_amount},
        ${app.approved_amount},
        ${app.approved_apr},
        ${app.risk_tier},
        ${autoPayEnabled},
        ${autoPayAccountId || null},
        NOW() + INTERVAL '90 days'
      )
      RETURNING *
    `;

    // Update application status
    await sql`
      UPDATE credit_applications
      SET status = 'activated', activated_at = NOW()
      WHERE id = ${applicationId}
    `;

    // Set up payment intercept if auto-pay enabled
    if (autoPayEnabled) {
      await setupPaymentIntercept(result.rows[0].id, 10); // 10% intercept
    }

    return mapCreditLineRow(result.rows[0]);
  } catch (error) {
    console.error('Error activating credit line:', error);
    throw new Error('Failed to activate credit line');
  }
}

/**
 * Draw on credit line
 */
export async function drawOnCredit(
  creditLineId: string,
  amount: number,
  purpose?: string,
  disbursementAccountId?: string
): Promise<DrawResult> {
  try {
    // Get credit line
    const lineResult = await sql`
      SELECT * FROM credit_lines
      WHERE id = ${creditLineId}
        AND status = 'active'
    `;

    if (lineResult.rowCount === 0) {
      return {
        success: false,
        drawId: '',
        amount: 0,
        newAvailableCredit: 0,
        error: 'Credit line not found or inactive',
      };
    }

    const line = lineResult.rows[0];
    const availableCredit = parseFloat(line.available_credit);

    // Check available credit
    if (amount > availableCredit) {
      return {
        success: false,
        drawId: '',
        amount: 0,
        newAvailableCredit: availableCredit,
        error: `Insufficient credit. Available: $${availableCredit.toFixed(2)}`,
      };
    }

    // Create draw
    const drawResult = await sql`
      INSERT INTO credit_draws (
        credit_line_id,
        amount,
        purpose,
        disbursed_to_account,
        status
      ) VALUES (
        ${creditLineId},
        ${amount},
        ${purpose || null},
        ${disbursementAccountId || null},
        'pending'
      )
      RETURNING *
    `;

    const drawId = drawResult.rows[0].id;

    // Update available credit
    const newAvailableCredit = availableCredit - amount;
    await sql`
      UPDATE credit_lines
      SET available_credit = ${newAvailableCredit}
      WHERE id = ${creditLineId}
    `;

    // Record transaction
    await sql`
      INSERT INTO credit_transactions (
        credit_line_id,
        draw_id,
        transaction_type,
        amount,
        balance_after,
        description
      ) VALUES (
        ${creditLineId},
        ${drawId},
        'draw',
        ${amount},
        ${newAvailableCredit},
        ${purpose || 'Credit draw'}
      )
    `;

    // Process disbursement (in real system, this would integrate with ACH)
    await sql`
      UPDATE credit_draws
      SET status = 'disbursed', disbursed_at = NOW()
      WHERE id = ${drawId}
    `;

    return {
      success: true,
      drawId,
      amount,
      newAvailableCredit,
      disbursedAt: new Date(),
    };
  } catch (error) {
    console.error('Error drawing on credit:', error);
    return {
      success: false,
      drawId: '',
      amount: 0,
      newAvailableCredit: 0,
      error: 'Failed to process credit draw',
    };
  }
}

/**
 * Make payment on credit line
 */
export async function makePayment(
  creditLineId: string,
  amount: number,
  paymentMethod: string = 'ach',
  sourceAccountId?: string
): Promise<PaymentResult> {
  try {
    // Get credit line
    const lineResult = await sql`
      SELECT * FROM credit_lines
      WHERE id = ${creditLineId}
    `;

    if (lineResult.rowCount === 0) {
      return {
        success: false,
        paymentId: '',
        amount: 0,
        principalAmount: 0,
        interestAmount: 0,
        newAvailableCredit: 0,
        error: 'Credit line not found',
      };
    }

    const line = lineResult.rows[0];
    const currentBalance = parseFloat(line.credit_limit) - parseFloat(line.available_credit);

    if (currentBalance <= 0) {
      return {
        success: false,
        paymentId: '',
        amount: 0,
        principalAmount: 0,
        interestAmount: 0,
        newAvailableCredit: parseFloat(line.available_credit),
        error: 'No balance to pay',
      };
    }

    // Calculate interest (simple daily calculation)
    const apr = parseFloat(line.apr) / 100;
    const dailyRate = apr / 365;
    const daysOutstanding = 30; // Simplified - would calculate from draw dates
    const interestAmount = Math.min(amount, currentBalance * dailyRate * daysOutstanding);
    const principalAmount = Math.min(amount - interestAmount, currentBalance);

    // Create payment
    const paymentResult = await sql`
      INSERT INTO credit_payments (
        credit_line_id,
        amount,
        principal_amount,
        interest_amount,
        payment_method,
        payment_source_account,
        status,
        scheduled_date
      ) VALUES (
        ${creditLineId},
        ${amount},
        ${principalAmount},
        ${interestAmount},
        ${paymentMethod},
        ${sourceAccountId || null},
        'pending',
        CURRENT_DATE
      )
      RETURNING *
    `;

    const paymentId = paymentResult.rows[0].id;

    // Update available credit
    const newAvailableCredit = parseFloat(line.available_credit) + principalAmount;
    await sql`
      UPDATE credit_lines
      SET available_credit = ${newAvailableCredit}
      WHERE id = ${creditLineId}
    `;

    // Record transaction
    await sql`
      INSERT INTO credit_transactions (
        credit_line_id,
        payment_id,
        transaction_type,
        amount,
        balance_after,
        description
      ) VALUES (
        ${creditLineId},
        ${paymentId},
        'payment',
        ${-amount},
        ${newAvailableCredit},
        'Credit payment'
      )
    `;

    // Process payment (in real system, this would integrate with ACH)
    await sql`
      UPDATE credit_payments
      SET status = 'completed', processed_at = NOW()
      WHERE id = ${paymentId}
    `;

    return {
      success: true,
      paymentId,
      amount,
      principalAmount,
      interestAmount,
      newAvailableCredit,
      processedAt: new Date(),
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      paymentId: '',
      amount: 0,
      principalAmount: 0,
      interestAmount: 0,
      newAvailableCredit: 0,
      error: 'Failed to process payment',
    };
  }
}

/**
 * Get credit line details
 */
export async function getCreditLine(userId: string): Promise<CreditLine | null> {
  try {
    const result = await sql`
      SELECT * FROM credit_lines
      WHERE user_id = ${userId}
        AND status = 'active'
      ORDER BY activated_at DESC
      LIMIT 1
    `;

    if (result.rowCount === 0) return null;

    return mapCreditLineRow(result.rows[0]);
  } catch (error) {
    console.error('Error getting credit line:', error);
    return null;
  }
}

/**
 * Get credit line transaction history
 */
export async function getCreditTransactions(creditLineId: string, limit: number = 50) {
  try {
    const result = await sql`
      SELECT * FROM credit_transactions
      WHERE credit_line_id = ${creditLineId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return result.rows.map((row) => ({
      id: row.id,
      transactionType: row.transaction_type,
      amount: parseFloat(row.amount),
      balanceAfter: parseFloat(row.balance_after),
      description: row.description,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('Error getting credit transactions:', error);
    return [];
  }
}

/**
 * Setup payment intercept (Wells advantage)
 */
async function setupPaymentIntercept(
  creditLineId: string,
  percentage: number
): Promise<void> {
  try {
    await sql`
      INSERT INTO payment_intercepts (
        credit_line_id,
        intercept_percentage,
        enabled
      ) VALUES (
        ${creditLineId},
        ${percentage},
        true
      )
      ON CONFLICT (credit_line_id) DO UPDATE
      SET intercept_percentage = ${percentage}, enabled = true
    `;
  } catch (error) {
    console.error('Error setting up payment intercept:', error);
  }
}

/**
 * Process payment intercept (called when transaction settles)
 */
export async function processPaymentIntercept(
  userId: string,
  transactionAmount: number
): Promise<void> {
  try {
    // Get active credit line with intercept
    const result = await sql`
      SELECT cl.*, pi.intercept_percentage, pi.min_intercept_amount, pi.max_intercept_amount
      FROM credit_lines cl
      JOIN payment_intercepts pi ON pi.credit_line_id = cl.id
      WHERE cl.user_id = ${userId}
        AND cl.status = 'active'
        AND pi.enabled = true
        AND cl.available_credit < cl.credit_limit
    `;

    if (result.rowCount === 0) return;

    const line = result.rows[0];
    const interceptPercentage = parseFloat(line.intercept_percentage) / 100;
    const interceptAmount = Math.min(
      transactionAmount * interceptPercentage,
      parseFloat(line.credit_limit) - parseFloat(line.available_credit)
    );

    if (interceptAmount < 1) return; // Skip small amounts

    // Make automatic payment
    await makePayment(line.id, interceptAmount, 'intercept');

    // Update intercept stats
    await sql`
      UPDATE payment_intercepts
      SET
        total_intercepted = total_intercepted + ${interceptAmount},
        intercept_count = intercept_count + 1
      WHERE credit_line_id = ${line.id}
    `;
  } catch (error) {
    console.error('Error processing payment intercept:', error);
  }
}

// Helper functions

function checkRejectionFactors(creditScore: CreditScore): string | undefined {
  // Hard rejections
  if (creditScore.score < 300) {
    return 'Credit score too low for approval';
  }

  // Check negative factors
  const negatives = creditScore.negativeFactors.join(', ').toLowerCase();

  if (negatives.includes('negative cash flow')) {
    return 'Insufficient cash flow to support credit line';
  }

  if (negatives.includes('declining revenue trend')) {
    return 'Declining revenue trend indicates increased risk';
  }

  return undefined;
}

function mapApplicationRow(row: any): CreditApplication {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    requestedAmount: row.requested_amount ? parseFloat(row.requested_amount) : undefined,
    approvedAmount: row.approved_amount ? parseFloat(row.approved_amount) : undefined,
    approvedAPR: row.approved_apr ? parseFloat(row.approved_apr) : undefined,
    creditScore: row.credit_score ? parseInt(row.credit_score) : undefined,
    riskTier: row.risk_tier,
    decisionFactors: row.decision_factors,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at),
    decidedAt: row.decided_at ? new Date(row.decided_at) : undefined,
    activatedAt: row.activated_at ? new Date(row.activated_at) : undefined,
  };
}

function mapCreditLineRow(row: any): CreditLine {
  return {
    id: row.id,
    userId: row.user_id,
    creditLimit: parseFloat(row.credit_limit),
    availableCredit: parseFloat(row.available_credit),
    apr: parseFloat(row.apr),
    status: row.status,
    riskTier: row.risk_tier,
    activatedAt: new Date(row.activated_at),
    autoPayEnabled: row.auto_pay_enabled,
  };
}
