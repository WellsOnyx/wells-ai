/**
 * Placement Fee Service - 1% Fee on Successful Placements
 *
 * Fee structure:
 * - 1% of first year salary
 * - Split: candidate pays 0.5%, employer pays 0.5% (or configurable)
 * - Invoice both parties
 * - Track in placement_fees table
 *
 * This is drastically lower than traditional 20-25% recruiter fees,
 * making Wells AI a no-brainer for both candidates and employers.
 */

import { query, withTransaction } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface PlacementFee {
  id: string;
  placementId: string;

  // Parties
  candidateUserId: string;
  candidateName: string;
  employerId: string;
  employerName: string;

  // Job details
  jobTitle: string;
  startDate: Date;

  // Salary basis
  annualSalary: number;
  currency: string;

  // Fee breakdown
  totalFeePercent: number; // Default 1%
  totalFeeAmount: number;

  candidateFeePercent: number; // Default 0.5%
  candidateFeeAmount: number;
  candidateFeeStatus: FeeStatus;
  candidateFeeInvoiceId?: string;
  candidateFeePaidAt?: Date;

  employerFeePercent: number; // Default 0.5%
  employerFeeAmount: number;
  employerFeeStatus: FeeStatus;
  employerFeeInvoiceId?: string;
  employerFeePaidAt?: Date;

  // Payment terms
  paymentDueDays: number; // Default 30 days after start
  candidatePaymentDue?: Date;
  employerPaymentDue?: Date;

  // Guarantee period
  guaranteeDays: number; // Default 90 days
  guaranteeEndsAt?: Date;
  isGuaranteeActive: boolean;

  // Status
  status: PlacementFeeStatus;
  waived: boolean;
  waivedReason?: string;
  waivedAt?: Date;
  waivedBy?: string;

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type FeeStatus =
  | 'pending'       // Not yet due
  | 'invoiced'      // Invoice sent
  | 'partial'       // Partially paid
  | 'paid'          // Fully paid
  | 'overdue'       // Past due date
  | 'waived'        // Fee waived
  | 'refunded';     // Refunded (guarantee triggered)

export type PlacementFeeStatus =
  | 'pending_start'    // Candidate hasn't started yet
  | 'active'           // Candidate has started, fees due
  | 'collecting'       // Actively collecting fees
  | 'collected'        // All fees paid
  | 'guarantee_claim'  // Guarantee period issue
  | 'refunded'         // Fees refunded
  | 'waived'           // Fees waived
  | 'cancelled';       // Placement cancelled

export interface FeeConfiguration {
  totalPercent: number;
  candidatePercent: number;
  employerPercent: number;
  paymentDueDays: number;
  guaranteeDays: number;
}

export interface PlacementFeeSummary {
  totalPlacements: number;
  totalSalaryVolume: number;
  totalFeesEarned: number;
  totalFeesCollected: number;
  totalFeesPending: number;
  totalFeesWaived: number;
  averageSalary: number;
  averageFee: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_FEE_CONFIG: FeeConfiguration = {
  totalPercent: 1.0,
  candidatePercent: 0.5,
  employerPercent: 0.5,
  paymentDueDays: 30,
  guaranteeDays: 90,
};

// ============================================================================
// FEE CALCULATION
// ============================================================================

/**
 * Calculate placement fees
 */
export function calculatePlacementFee(
  annualSalary: number,
  config: Partial<FeeConfiguration> = {}
): {
  totalFeePercent: number;
  totalFeeAmount: number;
  candidateFeePercent: number;
  candidateFeeAmount: number;
  employerFeePercent: number;
  employerFeeAmount: number;
  breakdown: string;
} {
  const cfg = { ...DEFAULT_FEE_CONFIG, ...config };

  const totalFeeAmount = Math.round(annualSalary * (cfg.totalPercent / 100) * 100) / 100;
  const candidateFeeAmount = Math.round(annualSalary * (cfg.candidatePercent / 100) * 100) / 100;
  const employerFeeAmount = Math.round(annualSalary * (cfg.employerPercent / 100) * 100) / 100;

  const breakdown = `Total fee: $${totalFeeAmount.toLocaleString()} (${cfg.totalPercent}% of $${annualSalary.toLocaleString()})\n` +
    `- Candidate pays: $${candidateFeeAmount.toLocaleString()} (${cfg.candidatePercent}%)\n` +
    `- Employer pays: $${employerFeeAmount.toLocaleString()} (${cfg.employerPercent}%)`;

  return {
    totalFeePercent: cfg.totalPercent,
    totalFeeAmount,
    candidateFeePercent: cfg.candidatePercent,
    candidateFeeAmount,
    employerFeePercent: cfg.employerPercent,
    employerFeeAmount,
    breakdown,
  };
}

// ============================================================================
// FEE CREATION & MANAGEMENT
// ============================================================================

/**
 * Create a placement fee record when an offer is accepted
 */
export async function createPlacementFee(
  placement: {
    id: string;
    candidateUserId: string;
    candidateName: string;
    employerId: string;
    employerName: string;
    jobTitle: string;
    annualSalary: number;
    currency?: string;
    startDate?: Date;
  },
  config?: Partial<FeeConfiguration>
): Promise<{
  success: boolean;
  message: string;
  fee?: PlacementFee;
}> {
  try {
    const feeCalc = calculatePlacementFee(placement.annualSalary, config);
    const cfg = { ...DEFAULT_FEE_CONFIG, ...config };

    const feeId = `pfee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startDate = placement.startDate || new Date();
    const candidatePaymentDue = new Date(startDate);
    candidatePaymentDue.setDate(candidatePaymentDue.getDate() + cfg.paymentDueDays);
    const employerPaymentDue = new Date(startDate);
    employerPaymentDue.setDate(employerPaymentDue.getDate() + cfg.paymentDueDays);
    const guaranteeEndsAt = new Date(startDate);
    guaranteeEndsAt.setDate(guaranteeEndsAt.getDate() + cfg.guaranteeDays);

    await query(
      `INSERT INTO placement_fees (
        id, placement_id,
        candidate_user_id, candidate_name, employer_id, employer_name,
        job_title, start_date,
        annual_salary, currency,
        total_fee_percent, total_fee_amount,
        candidate_fee_percent, candidate_fee_amount, candidate_fee_status,
        employer_fee_percent, employer_fee_amount, employer_fee_status,
        payment_due_days, candidate_payment_due, employer_payment_due,
        guarantee_days, guarantee_ends_at, is_guarantee_active,
        status, waived
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
      [
        feeId,
        placement.id,
        placement.candidateUserId,
        placement.candidateName,
        placement.employerId,
        placement.employerName,
        placement.jobTitle,
        startDate,
        placement.annualSalary,
        placement.currency || 'USD',
        feeCalc.totalFeePercent,
        feeCalc.totalFeeAmount,
        feeCalc.candidateFeePercent,
        feeCalc.candidateFeeAmount,
        'pending',
        feeCalc.employerFeePercent,
        feeCalc.employerFeeAmount,
        'pending',
        cfg.paymentDueDays,
        candidatePaymentDue,
        employerPaymentDue,
        cfg.guaranteeDays,
        guaranteeEndsAt,
        true,
        'pending_start',
        false,
      ]
    );

    // Log the fee creation event
    await logFeeEvent(feeId, 'created', null, 'pending_start', null, {
      salary: placement.annualSalary,
      totalFee: feeCalc.totalFeeAmount,
    });

    const fee = await getPlacementFee(feeId);

    return {
      success: true,
      message: `Placement fee created! Total: $${feeCalc.totalFeeAmount.toLocaleString()} (${feeCalc.candidateFeePercent}% from you, ${feeCalc.employerFeePercent}% from ${placement.employerName}). Due ${cfg.paymentDueDays} days after your start date.`,
      fee: fee || undefined,
    };
  } catch (error) {
    console.error('Error creating placement fee:', error);
    return {
      success: false,
      message: "I had trouble setting up the placement fee.",
    };
  }
}

/**
 * Get a placement fee by ID
 */
export async function getPlacementFee(feeId: string): Promise<PlacementFee | null> {
  const result = await query(
    `SELECT * FROM placement_fees WHERE id = $1`,
    [feeId]
  );

  if (result.rows.length === 0) return null;
  return mapRowToPlacementFee(result.rows[0]);
}

/**
 * Get placement fees for a user (candidate)
 */
export async function getCandidateFees(userId: string): Promise<{
  success: boolean;
  message: string;
  fees: PlacementFee[];
  summary: {
    totalOwed: number;
    totalPaid: number;
    totalPending: number;
  };
}> {
  try {
    const result = await query(
      `SELECT * FROM placement_fees
       WHERE candidate_user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const fees = result.rows.map(mapRowToPlacementFee);

    const summary = {
      totalOwed: fees.reduce((sum, f) => sum + f.candidateFeeAmount, 0),
      totalPaid: fees
        .filter(f => f.candidateFeeStatus === 'paid')
        .reduce((sum, f) => sum + f.candidateFeeAmount, 0),
      totalPending: fees
        .filter(f => ['pending', 'invoiced'].includes(f.candidateFeeStatus))
        .reduce((sum, f) => sum + f.candidateFeeAmount, 0),
    };

    let message = '';
    if (fees.length === 0) {
      message = "No placement fees yet. When you get hired through me, there's just a 0.5% fee - way less than traditional recruiters!";
    } else {
      message = `You have ${fees.length} placement fee${fees.length > 1 ? 's' : ''}. `;
      if (summary.totalPending > 0) {
        message += `$${summary.totalPending.toLocaleString()} pending. `;
      }
      if (summary.totalPaid > 0) {
        message += `$${summary.totalPaid.toLocaleString()} paid.`;
      }
    }

    return {
      success: true,
      message,
      fees,
      summary,
    };
  } catch (error) {
    console.error('Error fetching candidate fees:', error);
    return {
      success: false,
      message: "I had trouble fetching your fees.",
      fees: [],
      summary: { totalOwed: 0, totalPaid: 0, totalPending: 0 },
    };
  }
}

/**
 * Get placement fees for an employer
 */
export async function getEmployerFees(employerId: string): Promise<{
  success: boolean;
  message: string;
  fees: PlacementFee[];
  summary: {
    totalOwed: number;
    totalPaid: number;
    totalPending: number;
    totalPlacements: number;
  };
}> {
  try {
    const result = await query(
      `SELECT * FROM placement_fees
       WHERE employer_id = $1
       ORDER BY created_at DESC`,
      [employerId]
    );

    const fees = result.rows.map(mapRowToPlacementFee);

    const summary = {
      totalOwed: fees.reduce((sum, f) => sum + f.employerFeeAmount, 0),
      totalPaid: fees
        .filter(f => f.employerFeeStatus === 'paid')
        .reduce((sum, f) => sum + f.employerFeeAmount, 0),
      totalPending: fees
        .filter(f => ['pending', 'invoiced'].includes(f.employerFeeStatus))
        .reduce((sum, f) => sum + f.employerFeeAmount, 0),
      totalPlacements: fees.length,
    };

    let message = '';
    if (fees.length === 0) {
      message = "No placement fees yet. When you hire through Wells AI, you only pay 0.5% - 50x cheaper than traditional recruiters!";
    } else {
      const avgSavings = fees.reduce((sum, f) => {
        const traditionalFee = f.annualSalary * 0.20; // 20% traditional fee
        return sum + (traditionalFee - f.employerFeeAmount);
      }, 0);

      message = `${fees.length} placement${fees.length > 1 ? 's' : ''} through Wells AI. `;
      message += `Total fees: $${summary.totalOwed.toLocaleString()}. `;
      message += `You saved $${avgSavings.toLocaleString()} compared to traditional recruiters!`;
    }

    return {
      success: true,
      message,
      fees,
      summary,
    };
  } catch (error) {
    console.error('Error fetching employer fees:', error);
    return {
      success: false,
      message: "I had trouble fetching your fees.",
      fees: [],
      summary: { totalOwed: 0, totalPaid: 0, totalPending: 0, totalPlacements: 0 },
    };
  }
}

// ============================================================================
// FEE STATUS UPDATES
// ============================================================================

/**
 * Mark candidate started (triggers fee due)
 */
export async function markCandidateStarted(
  feeId: string,
  actualStartDate?: Date
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const fee = await getPlacementFee(feeId);
    if (!fee) {
      return { success: false, message: "Placement fee not found." };
    }

    const startDate = actualStartDate || new Date();
    const candidatePaymentDue = new Date(startDate);
    candidatePaymentDue.setDate(candidatePaymentDue.getDate() + fee.paymentDueDays);
    const employerPaymentDue = new Date(startDate);
    employerPaymentDue.setDate(employerPaymentDue.getDate() + fee.paymentDueDays);

    await query(
      `UPDATE placement_fees SET
        start_date = $1,
        candidate_payment_due = $2,
        employer_payment_due = $3,
        status = 'active',
        candidate_fee_status = 'invoiced',
        employer_fee_status = 'invoiced',
        updated_at = NOW()
       WHERE id = $4`,
      [startDate, candidatePaymentDue, employerPaymentDue, feeId]
    );

    await logFeeEvent(feeId, 'candidate_started', 'pending_start', 'active', null, {
      startDate: startDate.toISOString(),
    });

    return {
      success: true,
      message: `Congratulations on starting at ${fee.employerName}! Your placement fee of $${fee.candidateFeeAmount.toLocaleString()} is due in ${fee.paymentDueDays} days.`,
    };
  } catch (error) {
    console.error('Error marking candidate started:', error);
    return {
      success: false,
      message: "I had trouble updating the placement status.",
    };
  }
}

/**
 * Record a fee payment
 */
export async function recordFeePayment(
  feeId: string,
  party: 'candidate' | 'employer',
  amount: number,
  paymentReference?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const fee = await getPlacementFee(feeId);
    if (!fee) {
      return { success: false, message: "Placement fee not found." };
    }

    const expectedAmount = party === 'candidate'
      ? fee.candidateFeeAmount
      : fee.employerFeeAmount;

    if (amount < expectedAmount) {
      // Partial payment
      await query(
        `UPDATE placement_fees SET
          ${party}_fee_status = 'partial',
          updated_at = NOW()
         WHERE id = $1`,
        [feeId]
      );

      await logFeeEvent(feeId, 'partial_payment', null, 'partial', amount, {
        party,
        paymentReference,
        remaining: expectedAmount - amount,
      });

      return {
        success: true,
        message: `Received partial payment of $${amount.toLocaleString()}. Remaining: $${(expectedAmount - amount).toLocaleString()}.`,
      };
    }

    // Full payment
    await query(
      `UPDATE placement_fees SET
        ${party}_fee_status = 'paid',
        ${party}_fee_paid_at = NOW(),
        updated_at = NOW()
       WHERE id = $1`,
      [feeId]
    );

    // Check if both parties have paid
    const updatedFee = await getPlacementFee(feeId);
    if (updatedFee?.candidateFeeStatus === 'paid' && updatedFee?.employerFeeStatus === 'paid') {
      await query(
        `UPDATE placement_fees SET status = 'collected', updated_at = NOW() WHERE id = $1`,
        [feeId]
      );
    }

    await logFeeEvent(feeId, 'payment_received', null, 'paid', amount, {
      party,
      paymentReference,
    });

    return {
      success: true,
      message: `Payment received! $${amount.toLocaleString()} from ${party}. ${party === 'candidate' ? 'Thank you!' : 'Placement fee complete.'}`,
    };
  } catch (error) {
    console.error('Error recording fee payment:', error);
    return {
      success: false,
      message: "I had trouble recording that payment.",
    };
  }
}

/**
 * Waive a fee (for promotions, disputes, etc.)
 */
export async function waiveFee(
  feeId: string,
  party: 'candidate' | 'employer' | 'both',
  reason: string,
  waivedBy: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const fee = await getPlacementFee(feeId);
    if (!fee) {
      return { success: false, message: "Placement fee not found." };
    }

    let updateQuery = `UPDATE placement_fees SET waived_reason = $1, waived_at = NOW(), waived_by = $2, updated_at = NOW()`;
    const params: unknown[] = [reason, waivedBy];

    if (party === 'candidate' || party === 'both') {
      updateQuery += `, candidate_fee_status = 'waived'`;
    }
    if (party === 'employer' || party === 'both') {
      updateQuery += `, employer_fee_status = 'waived'`;
    }
    if (party === 'both') {
      updateQuery += `, waived = true, status = 'waived'`;
    }

    updateQuery += ` WHERE id = $3`;
    params.push(feeId);

    await query(updateQuery, params);

    await logFeeEvent(feeId, 'fee_waived', null, 'waived', null, {
      party,
      reason,
      waivedBy,
    });

    const waivedAmount = party === 'both'
      ? fee.totalFeeAmount
      : party === 'candidate' ? fee.candidateFeeAmount : fee.employerFeeAmount;

    return {
      success: true,
      message: `Fee waived! $${waivedAmount.toLocaleString()} ${party === 'both' ? 'total' : `for ${party}`}. Reason: ${reason}`,
    };
  } catch (error) {
    console.error('Error waiving fee:', error);
    return {
      success: false,
      message: "I had trouble waiving that fee.",
    };
  }
}

/**
 * Process guarantee claim (candidate left early)
 */
export async function processGuaranteeClaim(
  feeId: string,
  terminationDate: Date,
  reason: string
): Promise<{
  success: boolean;
  message: string;
  refundAmount?: number;
}> {
  try {
    const fee = await getPlacementFee(feeId);
    if (!fee) {
      return { success: false, message: "Placement fee not found." };
    }

    if (!fee.isGuaranteeActive) {
      return {
        success: false,
        message: "The guarantee period has already ended.",
      };
    }

    // Calculate pro-rated refund
    const daysWorked = Math.ceil(
      (terminationDate.getTime() - fee.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = Math.max(0, fee.guaranteeDays - daysWorked);
    const refundPercent = daysRemaining / fee.guaranteeDays;

    // Refund to employer only (candidate keeps their job, employer gets refund)
    const refundAmount = Math.round(fee.employerFeeAmount * refundPercent * 100) / 100;

    await query(
      `UPDATE placement_fees SET
        status = 'guarantee_claim',
        employer_fee_status = 'refunded',
        is_guarantee_active = false,
        updated_at = NOW()
       WHERE id = $1`,
      [feeId]
    );

    await logFeeEvent(feeId, 'guarantee_claim', fee.status, 'guarantee_claim', refundAmount, {
      terminationDate: terminationDate.toISOString(),
      reason,
      daysWorked,
      refundPercent,
    });

    return {
      success: true,
      message: `Guarantee claim processed. ${daysWorked} days worked out of ${fee.guaranteeDays} day guarantee. Refunding $${refundAmount.toLocaleString()} to ${fee.employerName}.`,
      refundAmount,
    };
  } catch (error) {
    console.error('Error processing guarantee claim:', error);
    return {
      success: false,
      message: "I had trouble processing the guarantee claim.",
    };
  }
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get overall fee summary
 */
export async function getFeeSummary(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    employerId?: string;
  }
): Promise<{
  success: boolean;
  summary: PlacementFeeSummary;
}> {
  try {
    let conditions = '1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.startDate) {
      conditions += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters?.employerId) {
      conditions += ` AND employer_id = $${paramIndex++}`;
      params.push(filters.employerId);
    }

    const result = await query(
      `SELECT
        COUNT(*) as total_placements,
        COALESCE(SUM(annual_salary), 0) as total_salary_volume,
        COALESCE(SUM(total_fee_amount), 0) as total_fees_earned,
        COALESCE(SUM(
          CASE WHEN candidate_fee_status = 'paid' THEN candidate_fee_amount ELSE 0 END +
          CASE WHEN employer_fee_status = 'paid' THEN employer_fee_amount ELSE 0 END
        ), 0) as total_fees_collected,
        COALESCE(SUM(
          CASE WHEN candidate_fee_status IN ('pending', 'invoiced') THEN candidate_fee_amount ELSE 0 END +
          CASE WHEN employer_fee_status IN ('pending', 'invoiced') THEN employer_fee_amount ELSE 0 END
        ), 0) as total_fees_pending,
        COALESCE(SUM(
          CASE WHEN waived = true THEN total_fee_amount ELSE 0 END
        ), 0) as total_fees_waived,
        COALESCE(AVG(annual_salary), 0) as average_salary,
        COALESCE(AVG(total_fee_amount), 0) as average_fee
       FROM placement_fees
       WHERE ${conditions}`,
      params
    );

    const row = result.rows[0];

    return {
      success: true,
      summary: {
        totalPlacements: parseInt(row.total_placements),
        totalSalaryVolume: parseFloat(row.total_salary_volume),
        totalFeesEarned: parseFloat(row.total_fees_earned),
        totalFeesCollected: parseFloat(row.total_fees_collected),
        totalFeesPending: parseFloat(row.total_fees_pending),
        totalFeesWaived: parseFloat(row.total_fees_waived),
        averageSalary: parseFloat(row.average_salary),
        averageFee: parseFloat(row.average_fee),
      },
    };
  } catch (error) {
    console.error('Error getting fee summary:', error);
    return {
      success: false,
      summary: {
        totalPlacements: 0,
        totalSalaryVolume: 0,
        totalFeesEarned: 0,
        totalFeesCollected: 0,
        totalFeesPending: 0,
        totalFeesWaived: 0,
        averageSalary: 0,
        averageFee: 0,
      },
    };
  }
}

/**
 * Get overdue fees for collection
 */
export async function getOverdueFees(): Promise<{
  success: boolean;
  overdueFees: PlacementFee[];
  totalOverdue: number;
}> {
  try {
    const result = await query(
      `SELECT * FROM placement_fees
       WHERE (
         (candidate_fee_status IN ('pending', 'invoiced') AND candidate_payment_due < NOW())
         OR
         (employer_fee_status IN ('pending', 'invoiced') AND employer_payment_due < NOW())
       )
       AND status NOT IN ('waived', 'cancelled', 'refunded')
       ORDER BY LEAST(candidate_payment_due, employer_payment_due) ASC`
    );

    const fees = result.rows.map(mapRowToPlacementFee);

    // Mark them as overdue
    for (const fee of fees) {
      if (fee.candidateFeeStatus === 'invoiced' && fee.candidatePaymentDue && fee.candidatePaymentDue < new Date()) {
        await query(
          `UPDATE placement_fees SET candidate_fee_status = 'overdue', updated_at = NOW() WHERE id = $1`,
          [fee.id]
        );
        fee.candidateFeeStatus = 'overdue';
      }
      if (fee.employerFeeStatus === 'invoiced' && fee.employerPaymentDue && fee.employerPaymentDue < new Date()) {
        await query(
          `UPDATE placement_fees SET employer_fee_status = 'overdue', updated_at = NOW() WHERE id = $1`,
          [fee.id]
        );
        fee.employerFeeStatus = 'overdue';
      }
    }

    const totalOverdue = fees.reduce((sum, f) => {
      let amount = 0;
      if (f.candidateFeeStatus === 'overdue') amount += f.candidateFeeAmount;
      if (f.employerFeeStatus === 'overdue') amount += f.employerFeeAmount;
      return sum + amount;
    }, 0);

    return {
      success: true,
      overdueFees: fees,
      totalOverdue,
    };
  } catch (error) {
    console.error('Error getting overdue fees:', error);
    return {
      success: false,
      overdueFees: [],
      totalOverdue: 0,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function logFeeEvent(
  feeId: string,
  eventType: string,
  oldStatus: string | null,
  newStatus: string | null,
  amount: number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO placement_fee_events (
      fee_id, event_type, old_status, new_status, amount, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [feeId, eventType, oldStatus, newStatus, amount, metadata ? JSON.stringify(metadata) : null]
  );
}

function mapRowToPlacementFee(row: Record<string, unknown>): PlacementFee {
  return {
    id: row.id as string,
    placementId: row.placement_id as string,
    candidateUserId: row.candidate_user_id as string,
    candidateName: row.candidate_name as string,
    employerId: row.employer_id as string,
    employerName: row.employer_name as string,
    jobTitle: row.job_title as string,
    startDate: new Date(row.start_date as string),
    annualSalary: parseFloat(row.annual_salary as string),
    currency: row.currency as string,
    totalFeePercent: parseFloat(row.total_fee_percent as string),
    totalFeeAmount: parseFloat(row.total_fee_amount as string),
    candidateFeePercent: parseFloat(row.candidate_fee_percent as string),
    candidateFeeAmount: parseFloat(row.candidate_fee_amount as string),
    candidateFeeStatus: row.candidate_fee_status as FeeStatus,
    candidateFeeInvoiceId: row.candidate_fee_invoice_id as string,
    candidateFeePaidAt: row.candidate_fee_paid_at ? new Date(row.candidate_fee_paid_at as string) : undefined,
    employerFeePercent: parseFloat(row.employer_fee_percent as string),
    employerFeeAmount: parseFloat(row.employer_fee_amount as string),
    employerFeeStatus: row.employer_fee_status as FeeStatus,
    employerFeeInvoiceId: row.employer_fee_invoice_id as string,
    employerFeePaidAt: row.employer_fee_paid_at ? new Date(row.employer_fee_paid_at as string) : undefined,
    paymentDueDays: row.payment_due_days as number,
    candidatePaymentDue: row.candidate_payment_due ? new Date(row.candidate_payment_due as string) : undefined,
    employerPaymentDue: row.employer_payment_due ? new Date(row.employer_payment_due as string) : undefined,
    guaranteeDays: row.guarantee_days as number,
    guaranteeEndsAt: row.guarantee_ends_at ? new Date(row.guarantee_ends_at as string) : undefined,
    isGuaranteeActive: row.is_guarantee_active as boolean,
    status: row.status as PlacementFeeStatus,
    waived: row.waived as boolean,
    waivedReason: row.waived_reason as string,
    waivedAt: row.waived_at ? new Date(row.waived_at as string) : undefined,
    waivedBy: row.waived_by as string,
    notes: row.notes as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export default {
  // Calculation
  calculatePlacementFee,

  // Management
  createPlacementFee,
  getPlacementFee,
  getCandidateFees,
  getEmployerFees,

  // Status updates
  markCandidateStarted,
  recordFeePayment,
  waiveFee,
  processGuaranteeClaim,

  // Reporting
  getFeeSummary,
  getOverdueFees,
};
