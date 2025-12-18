// @ts-nocheck
/**
 * GRAIN Secondary Lending Market
 * 
 * Enables GRAIN holders to lend their GRAIN to back others' mortgages,
 * allowing borrowers to unlock their secondary GRAIN collateral while
 * lenders earn yield on their locked GRAIN.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface GrainLendingPool {
  id: string;
  lender_id: string;
  lender_email: string;
  lender_name?: string;
  grain_amount: number;
  grain_available: number;
  grain_locked: number;
  annual_rate: number;
  min_loan_amount?: number;
  max_loan_amount?: number;
  min_term_months: number;
  max_term_months: number;
  accepted_loan_types: string[];
  max_ltv: number;
  auto_approve: boolean;
  status: 'active' | 'paused' | 'closed';
  total_earnings: number;
  total_loans_backed: number;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface GrainCollateralLock {
  id: string;
  lock_type: 'primary_collateral' | 'secondary_lock' | 'lender_backing';
  grain_amount: number;
  owner_id: string;
  owner_email: string;
  owner_role: 'borrower' | 'lender';
  loan_id?: string;
  lending_pool_id?: string;
  match_id?: string;
  status: 'locked' | 'released' | 'liquidated';
  locked_at: string;
  released_at?: string;
  release_condition?: string;
  created_at: string;
  metadata?: any;
}

export interface GrainLendingMatch {
  id: string;
  lender_pool_id: string;
  lender_id: string;
  borrower_id: string;
  loan_id: string;
  grain_backed: number;
  backing_rate: number;
  borrower_lock_released_id?: string;
  lender_lock_id?: string;
  start_date: string;
  expected_end_date?: string;
  actual_end_date?: string;
  status: 'pending' | 'active' | 'completed' | 'defaulted' | 'cancelled';
  total_earnings_paid: number;
  last_payment_date?: string;
  approved_by_lender: boolean;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface GrainLenderEarnings {
  id: string;
  match_id: string;
  lender_pool_id: string;
  lender_id: string;
  loan_id: string;
  payment_date: string;
  loan_payment_amount: number;
  lender_earnings_amount: number;
  earnings_rate: number;
  grain_backed: number;
  days_backed: number;
  calculation_method: string;
  status: 'pending' | 'paid' | 'failed';
  paid_at?: string;
  created_at: string;
  metadata?: any;
}

/**
 * List GRAIN for lending in the pool
 */
export async function listGrainForLending(options: {
  lender_id: string;
  lender_email: string;
  lender_name?: string;
  grain_amount: number;
  annual_rate: number;
  min_loan_amount?: number;
  max_loan_amount?: number;
  min_term_months?: number;
  max_term_months?: number;
  accepted_loan_types?: string[];
  max_ltv?: number;
  auto_approve?: boolean;
}) {
  try {
    const poolData = {
      lender_id: options.lender_id,
      lender_email: options.lender_email,
      lender_name: options.lender_name,
      grain_amount: options.grain_amount,
      grain_available: options.grain_amount, // Initially all available
      grain_locked: 0,
      annual_rate: options.annual_rate,
      min_loan_amount: options.min_loan_amount || 0,
      max_loan_amount: options.max_loan_amount,
      min_term_months: options.min_term_months || 12,
      max_term_months: options.max_term_months || 360,
      accepted_loan_types: options.accepted_loan_types || ['mortgage', 'auto', 'personal', 'business'],
      max_ltv: options.max_ltv || 80,
      auto_approve: options.auto_approve || false,
      status: 'active',
      total_earnings: 0,
      total_loans_backed: 0,
    };

    const { data, error } = await supabase
      .from('grain_lending_pool')
      .insert(poolData)
      .select()
      .single();

    if (error) throw error;

    return { success: true, pool: data };
  } catch (error) {
    console.error('Error listing GRAIN for lending:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Find available backers for a loan
 */
export async function findBackersForLoan(options: {
  loan_id: string;
  grain_needed: number;
  loan_type: string;
  loan_amount: number;
  term_months: number;
  ltv: number;
  borrower_id: string;
}) {
  try {
    const { data: pools, error } = await supabase
      .from('grain_lending_pool')
      .select('*')
      .eq('status', 'active')
      .gte('grain_available', options.grain_needed)
      .lte('min_term_months', options.term_months)
      .gte('max_term_months', options.term_months)
      .gte('max_ltv', options.ltv)
      .contains('accepted_loan_types', [options.loan_type])
      .order('annual_rate', { ascending: true }); // Best rates first

    if (error) throw error;

    // Filter by loan amount if specified
    const matchingPools = pools?.filter(pool => {
      if (pool.min_loan_amount && options.loan_amount < pool.min_loan_amount) return false;
      if (pool.max_loan_amount && options.loan_amount > pool.max_loan_amount) return false;
      return true;
    }) || [];

    return {
      success: true,
      backers: matchingPools,
      count: matchingPools.length,
    };
  } catch (error) {
    console.error('Error finding backers:', error);
    return { success: false, error: error.message, backers: [] };
  }
}

/**
 * Accept backing from a lender pool
 */
export async function acceptBacking(options: {
  loan_id: string;
  lender_pool_id: string;
  borrower_id: string;
  borrower_email: string;
  grain_backed: number;
  term_months: number;
  secondary_lock_id?: string; // The borrower's secondary lock to release
}) {
  try {
    // Get pool details
    const { data: pool, error: poolError } = await supabase
      .from('grain_lending_pool')
      .select('*')
      .eq('id', options.lender_pool_id)
      .single();

    if (poolError) throw poolError;
    if (!pool) throw new Error('Pool not found');
    if (pool.grain_available < options.grain_backed) {
      throw new Error('Insufficient GRAIN available in pool');
    }

    // Calculate expected end date
    const expectedEndDate = new Date();
    expectedEndDate.setMonth(expectedEndDate.getMonth() + options.term_months);

    // Create the match (pending if not auto-approved)
    const matchData = {
      lender_pool_id: options.lender_pool_id,
      lender_id: pool.lender_id,
      borrower_id: options.borrower_id,
      loan_id: options.loan_id,
      grain_backed: options.grain_backed,
      backing_rate: pool.annual_rate,
      expected_end_date: expectedEndDate.toISOString(),
      status: pool.auto_approve ? 'active' : 'pending',
      approved_by_lender: pool.auto_approve,
      approved_at: pool.auto_approve ? new Date().toISOString() : null,
      total_earnings_paid: 0,
    };

    const { data: match, error: matchError } = await supabase
      .from('grain_lending_matches')
      .insert(matchData)
      .select()
      .single();

    if (matchError) throw matchError;

    if (pool.auto_approve) {
      // Execute the backing immediately
      const result = await executeBackingLocks({
        match_id: match.id,
        lender_pool_id: options.lender_pool_id,
        lender_id: pool.lender_id,
        lender_email: pool.lender_email,
        borrower_id: options.borrower_id,
        borrower_email: options.borrower_email,
        loan_id: options.loan_id,
        grain_backed: options.grain_backed,
        secondary_lock_id: options.secondary_lock_id,
      });

      if (!result.success) throw new Error(result.error);
    }

    return {
      success: true,
      match,
      status: pool.auto_approve ? 'active' : 'pending_approval',
    };
  } catch (error) {
    console.error('Error accepting backing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute the actual locking/unlocking when backing is approved
 */
async function executeBackingLocks(options: {
  match_id: string;
  lender_pool_id: string;
  lender_id: string;
  lender_email: string;
  borrower_id: string;
  borrower_email: string;
  loan_id: string;
  grain_backed: number;
  secondary_lock_id?: string;
}) {
  try {
    // 1. Create lender's lock
    const { data: lenderLock, error: lenderLockError } = await supabase
      .from('grain_collateral_locks')
      .insert({
        lock_type: 'lender_backing',
        grain_amount: options.grain_backed,
        owner_id: options.lender_id,
        owner_email: options.lender_email,
        owner_role: 'lender',
        loan_id: options.loan_id,
        lending_pool_id: options.lender_pool_id,
        match_id: options.match_id,
        status: 'locked',
      })
      .select()
      .single();

    if (lenderLockError) throw lenderLockError;

    // 2. Release borrower's secondary lock (if provided)
    let borrowerLockReleased = null;
    if (options.secondary_lock_id) {
      const { data: released, error: releaseError } = await supabase
        .from('grain_collateral_locks')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          release_condition: 'backing_removed',
        })
        .eq('id', options.secondary_lock_id)
        .eq('owner_id', options.borrower_id)
        .select()
        .single();

      if (releaseError) throw releaseError;
      borrowerLockReleased = released;
    }

    // 3. Update pool availability
    const { error: poolUpdateError } = await supabase
      .from('grain_lending_pool')
      .update({
        grain_available: supabase.raw(`grain_available - ${options.grain_backed}`),
        grain_locked: supabase.raw(`grain_locked + ${options.grain_backed}`),
        total_loans_backed: supabase.raw('total_loans_backed + 1'),
      })
      .eq('id', options.lender_pool_id);

    if (poolUpdateError) throw poolUpdateError;

    // 4. Update match with lock references
    const { error: matchUpdateError } = await supabase
      .from('grain_lending_matches')
      .update({
        lender_lock_id: lenderLock.id,
        borrower_lock_released_id: borrowerLockReleased?.id,
      })
      .eq('id', options.match_id);

    if (matchUpdateError) throw matchUpdateError;

    return { success: true, lenderLock, borrowerLockReleased };
  } catch (error) {
    console.error('Error executing backing locks:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process lender earnings when borrower makes a loan payment
 */
export async function processLenderEarnings(options: {
  loan_id: string;
  payment_amount: number;
  payment_date?: Date;
}) {
  try {
    const paymentDate = options.payment_date || new Date();

    // Get all active matches for this loan
    const { data: matches, error: matchError } = await supabase
      .from('grain_lending_matches')
      .select('*')
      .eq('loan_id', options.loan_id)
      .eq('status', 'active');

    if (matchError) throw matchError;
    if (!matches || matches.length === 0) {
      return { success: true, message: 'No active backing for this loan' };
    }

    const earnings = [];

    for (const match of matches) {
      // Calculate days since last payment or start
      const lastPayment = match.last_payment_date
        ? new Date(match.last_payment_date)
        : new Date(match.start_date);
      const daysBacked = Math.floor(
        (paymentDate.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate earnings: (grain_backed * annual_rate * days) / 365
      const annualRate = match.backing_rate / 100;
      const earningsAmount =
        (match.grain_backed * annualRate * daysBacked) / 365;

      // Create earnings record
      const { data: earning, error: earningError } = await supabase
        .from('grain_lender_earnings')
        .insert({
          match_id: match.id,
          lender_pool_id: match.lender_pool_id,
          lender_id: match.lender_id,
          loan_id: options.loan_id,
          payment_date: paymentDate.toISOString(),
          loan_payment_amount: options.payment_amount,
          lender_earnings_amount: earningsAmount,
          earnings_rate: match.backing_rate,
          grain_backed: match.grain_backed,
          days_backed: daysBacked,
          calculation_method: 'proportional',
          status: 'paid',
          paid_at: paymentDate.toISOString(),
        })
        .select()
        .single();

      if (earningError) throw earningError;

      // Update match
      await supabase
        .from('grain_lending_matches')
        .update({
          total_earnings_paid: supabase.raw(
            `total_earnings_paid + ${earningsAmount}`
          ),
          last_payment_date: paymentDate.toISOString(),
        })
        .eq('id', match.id);

      // Update pool totals
      await supabase
        .from('grain_lending_pool')
        .update({
          total_earnings: supabase.raw(`total_earnings + ${earningsAmount}`),
        })
        .eq('id', match.lender_pool_id);

      earnings.push(earning);
    }

    return { success: true, earnings };
  } catch (error) {
    console.error('Error processing lender earnings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Release lender's collateral when loan is paid off
 */
export async function releaseLenderCollateral(loan_id: string) {
  try {
    // Get all active matches for this loan
    const { data: matches, error: matchError } = await supabase
      .from('grain_lending_matches')
      .select('*')
      .eq('loan_id', loan_id)
      .eq('status', 'active');

    if (matchError) throw matchError;
    if (!matches || matches.length === 0) {
      return { success: true, message: 'No active backing to release' };
    }

    for (const match of matches) {
      // Release lender's lock
      if (match.lender_lock_id) {
        await supabase
          .from('grain_collateral_locks')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            release_condition: 'loan_paid',
          })
          .eq('id', match.lender_lock_id);
      }

      // Update pool availability
      await supabase
        .from('grain_lending_pool')
        .update({
          grain_available: supabase.raw(`grain_available + ${match.grain_backed}`),
          grain_locked: supabase.raw(`grain_locked - ${match.grain_backed}`),
        })
        .eq('id', match.lender_pool_id);

      // Complete the match
      await supabase
        .from('grain_lending_matches')
        .update({
          status: 'completed',
          actual_end_date: new Date().toISOString(),
        })
        .eq('id', match.id);
    }

    return { success: true, matches };
  } catch (error) {
    console.error('Error releasing lender collateral:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get lending pool statistics
 */
export async function getLendingPoolStats() {
  try {
    const { data, error } = await supabase
      .from('grain_lending_pool_stats')
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, stats: data };
  } catch (error) {
    console.error('Error getting pool stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get lender's performance and earnings
 */
export async function getLenderPerformance(lender_id: string) {
  try {
    // Get performance summary
    const { data: performance, error: perfError } = await supabase
      .from('grain_lender_performance')
      .select('*')
      .eq('lender_id', lender_id)
      .single();

    if (perfError && perfError.code !== 'PGRST116') throw perfError;

    // Get active pools
    const { data: pools, error: poolsError } = await supabase
      .from('grain_lending_pool')
      .select('*')
      .eq('lender_id', lender_id)
      .order('created_at', { ascending: false });

    if (poolsError) throw poolsError;

    // Get active matches
    const { data: matches, error: matchesError } = await supabase
      .from('active_grain_matches')
      .select('*')
      .eq('lender_id', lender_id);

    if (matchesError) throw matchesError;

    // Get earnings history
    const { data: earnings, error: earningsError } = await supabase
      .from('grain_lender_earnings')
      .select('*')
      .eq('lender_id', lender_id)
      .order('payment_date', { ascending: false })
      .limit(100);

    if (earningsError) throw earningsError;

    return {
      success: true,
      performance: performance || {
        pools_count: 0,
        total_grain: 0,
        grain_in_use: 0,
        lifetime_earnings: 0,
        loans_backed: 0,
        avg_rate: 0,
      },
      pools: pools || [],
      active_matches: matches || [],
      earnings_history: earnings || [],
    };
  } catch (error) {
    console.error('Error getting lender performance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update pool status
 */
export async function updatePoolStatus(
  pool_id: string,
  lender_id: string,
  status: 'active' | 'paused' | 'closed'
) {
  try {
    const { data, error } = await supabase
      .from('grain_lending_pool')
      .update({ status })
      .eq('id', pool_id)
      .eq('lender_id', lender_id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, pool: data };
  } catch (error) {
    console.error('Error updating pool status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Withdraw GRAIN from pool (only available amount)
 */
export async function withdrawFromPool(
  pool_id: string,
  lender_id: string,
  amount?: number
) {
  try {
    const { data: pool, error: poolError } = await supabase
      .from('grain_lending_pool')
      .select('*')
      .eq('id', pool_id)
      .eq('lender_id', lender_id)
      .single();

    if (poolError) throw poolError;
    if (!pool) throw new Error('Pool not found');

    const withdrawAmount = amount || pool.grain_available;

    if (withdrawAmount > pool.grain_available) {
      throw new Error('Insufficient available GRAIN');
    }

    const { data, error } = await supabase
      .from('grain_lending_pool')
      .update({
        grain_amount: pool.grain_amount - withdrawAmount,
        grain_available: pool.grain_available - withdrawAmount,
        status: pool.grain_available - withdrawAmount === 0 ? 'closed' : pool.status,
      })
      .eq('id', pool_id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, pool: data, withdrawn: withdrawAmount };
  } catch (error) {
    console.error('Error withdrawing from pool:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve a pending match (for non-auto-approve pools)
 */
export async function approvePendingMatch(
  match_id: string,
  lender_id: string
) {
  try {
    const { data: match, error: matchError } = await supabase
      .from('grain_lending_matches')
      .select('*, grain_lending_pool(*)')
      .eq('id', match_id)
      .eq('lender_id', lender_id)
      .single();

    if (matchError) throw matchError;
    if (!match) throw new Error('Match not found');
    if (match.status !== 'pending') throw new Error('Match is not pending');

    // Get borrower info from loan
    const { data: loan, error: loanError } = await supabase
      .from('deals')
      .select('customer_email')
      .eq('id', match.loan_id)
      .single();

    if (loanError) throw loanError;

    // Execute the backing
    const result = await executeBackingLocks({
      match_id: match.id,
      lender_pool_id: match.lender_pool_id,
      lender_id: match.lender_id,
      lender_email: match.grain_lending_pool.lender_email,
      borrower_id: match.borrower_id,
      borrower_email: loan.customer_email,
      loan_id: match.loan_id,
      grain_backed: match.grain_backed,
    });

    if (!result.success) throw new Error(result.error);

    // Update match status
    const { data, error } = await supabase
      .from('grain_lending_matches')
      .update({
        status: 'active',
        approved_by_lender: true,
        approved_at: new Date().toISOString(),
      })
      .eq('id', match_id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, match: data };
  } catch (error) {
    console.error('Error approving match:', error);
    return { success: false, error: error.message };
  }
}
