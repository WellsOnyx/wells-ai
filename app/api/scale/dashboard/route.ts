// @ts-nocheck
/**
 * GET /api/scale/dashboard
 *
 * Trillion Dollar Scale Dashboard
 * Real-time metrics on the path to $1T in 30 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Launch date - adjust when ready
const LAUNCH_DATE = new Date('2025-01-06'); // Monday launch
const TARGET_VOLUME = 1_000_000_000_000; // $1 Trillion
const TARGET_DAYS = 30;

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const daysSinceLaunch = Math.max(0, Math.floor(
      (now.getTime() - LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000)
    ));

    // Get account metrics
    const { data: accountData } = await supabase
      .from('silent_accounts')
      .select('activation_level');

    const accounts = {
      total: accountData?.length || 0,
      ghost: accountData?.filter(a => a.activation_level === 'ghost').length || 0,
      aware: accountData?.filter(a => a.activation_level === 'aware').length || 0,
      active: accountData?.filter(a => a.activation_level === 'active').length || 0,
      power: accountData?.filter(a => a.activation_level === 'power').length || 0
    };

    // Get volume from viral payments
    const { data: viralPayments } = await supabase
      .from('viral_payments')
      .select('amount_usdc, status, created_at, claimed_at, wells_fee');

    const viralMetrics = {
      total_created: viralPayments?.length || 0,
      total_claimed: viralPayments?.filter(p => p.status === 'claimed').length || 0,
      total_pending: viralPayments?.filter(p => p.status === 'pending').length || 0,
      total_volume: viralPayments?.filter(p => p.status === 'claimed')
        .reduce((sum, p) => sum + (p.amount_usdc || 0), 0) || 0,
      pending_volume: viralPayments?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount_usdc || 0), 0) || 0,
      fees_collected: viralPayments?.filter(p => p.status === 'claimed')
        .reduce((sum, p) => sum + (p.wells_fee || 0), 0) || 0
    };

    // Calculate viral coefficient
    const viralCoefficient = viralMetrics.total_created > 0
      ? viralMetrics.total_claimed / viralMetrics.total_created
      : 0;

    // Get white-label partner volume
    const { data: partners } = await supabase
      .from('white_label_partners')
      .select('total_volume, transaction_count, total_fees_collected, status');

    const partnerMetrics = {
      active_partners: partners?.filter(p => p.status === 'active').length || 0,
      total_volume: partners?.reduce((sum, p) => sum + (p.total_volume || 0), 0) || 0,
      total_transactions: partners?.reduce((sum, p) => sum + (p.transaction_count || 0), 0) || 0,
      total_fees: partners?.reduce((sum, p) => sum + (p.total_fees_collected || 0), 0) || 0
    };

    // Get credit line metrics
    const { data: creditLines } = await supabase
      .from('credit_lines')
      .select('credit_limit, available, used, status');

    const creditMetrics = {
      total_lines: creditLines?.filter(c => c.status === 'active').length || 0,
      total_limit: creditLines?.reduce((sum, c) => sum + (c.credit_limit || 0), 0) || 0,
      total_used: creditLines?.reduce((sum, c) => sum + (c.used || 0), 0) || 0,
      total_available: creditLines?.reduce((sum, c) => sum + (c.available || 0), 0) || 0
    };

    // Calculate totals
    const totalVolume = viralMetrics.total_volume + partnerMetrics.total_volume + creditMetrics.total_used;
    const totalFees = viralMetrics.fees_collected + partnerMetrics.total_fees;

    // Daily run rate (based on last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dailyVolume = viralPayments
      ?.filter(p => p.status === 'claimed' && new Date(p.claimed_at) > oneDayAgo)
      .reduce((sum, p) => sum + (p.amount_usdc || 0), 0) || 0;

    // Target trajectory
    const dailyTarget = TARGET_VOLUME / TARGET_DAYS;
    const currentTarget = dailyTarget * daysSinceLaunch;
    const requiredDailyRunRate = daysSinceLaunch > 0
      ? (TARGET_VOLUME - totalVolume) / (TARGET_DAYS - daysSinceLaunch)
      : dailyTarget;

    // Projections based on viral growth
    const cyclesRemaining = (TARGET_DAYS - daysSinceLaunch) / 3; // 3-day cycle
    const projectedAccounts = accounts.total * Math.pow(1 + viralCoefficient, cyclesRemaining);
    const avgVolumePerAccount = accounts.total > 0 ? totalVolume / accounts.total : 50000;
    const projected30DayVolume = projectedAccounts * avgVolumePerAccount;

    // On track calculation
    const onTrack = totalVolume >= currentTarget * 0.8; // Within 80% of target

    // Growth rates
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyNewAccounts = accountData
      ?.filter(a => new Date((a as any).created_at) > sevenDaysAgo).length || 0;
    const weeklyGrowthRate = accounts.total > weeklyNewAccounts
      ? weeklyNewAccounts / (accounts.total - weeklyNewAccounts)
      : 0;

    return NextResponse.json({
      // Time
      launch_date: LAUNCH_DATE.toISOString(),
      current_day: daysSinceLaunch,
      days_remaining: Math.max(0, TARGET_DAYS - daysSinceLaunch),

      // Target
      target: {
        total: TARGET_VOLUME,
        daily: dailyTarget,
        current_day_target: currentTarget,
        required_daily_run_rate: requiredDailyRunRate
      },

      // Actual
      actual: {
        total_volume: totalVolume,
        daily_volume: dailyVolume,
        variance: totalVolume - currentTarget,
        variance_percent: currentTarget > 0 ? ((totalVolume - currentTarget) / currentTarget) * 100 : 0,
        on_track: onTrack
      },

      // Accounts
      accounts: {
        ...accounts,
        weekly_new: weeklyNewAccounts,
        weekly_growth_rate: weeklyGrowthRate
      },

      // Viral
      viral: {
        ...viralMetrics,
        coefficient: viralCoefficient,
        claim_rate: viralMetrics.total_created > 0
          ? (viralMetrics.total_claimed / viralMetrics.total_created) * 100
          : 0
      },

      // Partners
      partners: partnerMetrics,

      // Credit
      credit: creditMetrics,

      // Revenue
      revenue: {
        total_fees: totalFees,
        daily_fees: totalFees / Math.max(1, daysSinceLaunch),
        projected_30_day_fees: totalFees * (30 / Math.max(1, daysSinceLaunch))
      },

      // Projections
      projections: {
        volume_30_day: projected30DayVolume,
        accounts_30_day: Math.floor(projectedAccounts),
        on_track_for_trillion: projected30DayVolume >= TARGET_VOLUME * 0.5 // 50% confidence
      },

      // Key levers (what to focus on)
      key_levers: getKeyLevers(viralCoefficient, partnerMetrics, creditMetrics, dailyVolume, requiredDailyRunRate)
    });
  } catch (error) {
    console.error('Error getting scale dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard' },
      { status: 500 }
    );
  }
}

function getKeyLevers(
  viralCoefficient: number,
  partnerMetrics: any,
  creditMetrics: any,
  dailyVolume: number,
  requiredRunRate: number
): Array<{
  lever: string;
  current: string;
  target: string;
  impact: string;
  priority: 'critical' | 'high' | 'medium';
}> {
  const levers = [];

  // Viral coefficient
  if (viralCoefficient < 0.3) {
    levers.push({
      lever: 'Viral Coefficient',
      current: `${(viralCoefficient * 100).toFixed(1)}%`,
      target: '30%+',
      impact: 'Improving claim rate compounds network growth exponentially',
      priority: 'critical' as const
    });
  }

  // Partner volume
  if (partnerMetrics.active_partners < 10) {
    levers.push({
      lever: 'White-Label Partners',
      current: `${partnerMetrics.active_partners} partners`,
      target: '10+ partners',
      impact: 'Each partner multiplies reach without marketing spend',
      priority: 'critical' as const
    });
  }

  // Credit utilization
  const creditUtilization = creditMetrics.total_limit > 0
    ? creditMetrics.total_used / creditMetrics.total_limit
    : 0;
  if (creditUtilization < 0.5) {
    levers.push({
      lever: 'Credit Utilization',
      current: `${(creditUtilization * 100).toFixed(1)}%`,
      target: '50%+',
      impact: 'Credit drives transaction frequency and supplier enrollment',
      priority: 'high' as const
    });
  }

  // Daily run rate
  if (dailyVolume < requiredRunRate * 0.5) {
    levers.push({
      lever: 'Daily Run Rate',
      current: `$${(dailyVolume / 1_000_000).toFixed(2)}M`,
      target: `$${(requiredRunRate / 1_000_000).toFixed(2)}M+`,
      impact: 'Need to increase daily volume to stay on track',
      priority: 'critical' as const
    });
  }

  // Add network seeding if early
  if (partnerMetrics.total_transactions < 1000) {
    levers.push({
      lever: 'Seed Network',
      current: `${partnerMetrics.total_transactions} transactions`,
      target: '1,000+ seed transactions',
      impact: 'Initial transactions create network effects',
      priority: 'high' as const
    });
  }

  return levers;
}
