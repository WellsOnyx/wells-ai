// @ts-nocheck
/**
 * GET /api/flywheel
 *
 * FLYWHEEL DASHBOARD
 *
 * Real-time metrics for the Wells AI → Grain & Vault treasury flywheel:
 *
 * 1. Wells AI processes payments → Creates float (settlement delay)
 * 2. Float deployed to Grain & Vault → Generates yield
 * 3. Yield distributed → 50% Wells, 30% GRAIN, 20% participants
 * 4. GRAIN appreciation → Better rates → More volume → More float
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// APY assumptions
const TREASURY_BILL_APY = 0.045; // 4.5%
const AVG_FLOAT_DAYS = 3;

export async function GET(request: NextRequest) {
  try {
    // Get float positions
    const { data: floatPositions } = await supabase
      .from('float_positions')
      .select('*');

    const floatMetrics = {
      total_positions: floatPositions?.length || 0,
      pending: floatPositions?.filter(f => f.status === 'pending').length || 0,
      deployed: floatPositions?.filter(f => f.status === 'deployed').length || 0,
      settled: floatPositions?.filter(f => f.status === 'settled').length || 0,
      total_amount: floatPositions?.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0) || 0,
      pending_amount: floatPositions?.filter(f => f.status === 'pending')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0) || 0,
      deployed_amount: floatPositions?.filter(f => f.status === 'deployed')
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0) || 0,
      total_yield: floatPositions?.reduce((sum, f) => sum + (parseFloat(f.yield_earned) || 0), 0) || 0
    };

    // Get vault deposits
    const { data: vaultDeposits } = await supabase
      .from('vault_deposits')
      .select('*');

    const vaultMetrics = {
      total_deposits: vaultDeposits?.length || 0,
      active: vaultDeposits?.filter(v => v.status === 'active').length || 0,
      total_deposited: vaultDeposits?.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0) || 0,
      current_value: vaultDeposits?.filter(v => v.status === 'active')
        .reduce((sum, v) => sum + (parseFloat(v.current_value) || 0), 0) || 0,
      yield_accrued: vaultDeposits?.reduce((sum, v) => sum + (parseFloat(v.yield_accrued) || 0), 0) || 0,
      avg_apy: vaultDeposits?.length
        ? vaultDeposits.reduce((sum, v) => sum + (parseFloat(v.apy_at_deposit) || 0), 0) / vaultDeposits.length
        : TREASURY_BILL_APY
    };

    // Get grain pool
    const { data: grainPool } = await supabase
      .from('grain_pools')
      .select('*')
      .eq('pool_name', 'primary_treasury')
      .single();

    // Get latest grain price
    const { data: latestPrice } = await supabase
      .from('grain_price_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    // Get yield distributions
    const { data: yieldDistributions } = await supabase
      .from('yield_distributions')
      .select('*');

    const yieldMetrics = {
      total_distributions: yieldDistributions?.length || 0,
      total_yield_distributed: yieldDistributions?.reduce((sum, y) => sum + (parseFloat(y.total_yield) || 0), 0) || 0,
      wells_share_total: yieldDistributions?.reduce((sum, y) => sum + (parseFloat(y.wells_share) || 0), 0) || 0,
      grain_appreciation_total: yieldDistributions?.reduce((sum, y) => sum + (parseFloat(y.grain_appreciation) || 0), 0) || 0,
      participant_rewards_total: yieldDistributions?.reduce((sum, y) => sum + (parseFloat(y.participant_rewards) || 0), 0) || 0
    };

    // Get account rewards
    const { data: accountRewards } = await supabase
      .from('account_rewards')
      .select('*');

    const rewardMetrics = {
      total_rewards: accountRewards?.length || 0,
      pending: accountRewards?.filter(r => r.status === 'pending').length || 0,
      credited: accountRewards?.filter(r => r.status === 'credited').length || 0,
      claimed: accountRewards?.filter(r => r.status === 'claimed').length || 0,
      total_amount: accountRewards?.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0,
      unique_recipients: new Set(accountRewards?.map(r => r.account_id)).size
    };

    // Get daily metrics (last 7 days)
    const { data: dailyMetrics } = await supabase
      .from('daily_float_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(7);

    // Calculate flywheel velocity
    const currentFloatOutstanding = floatMetrics.pending_amount + floatMetrics.deployed_amount;
    const dailyYieldRate = TREASURY_BILL_APY / 365;
    const projectedDailyYield = currentFloatOutstanding * dailyYieldRate;
    const projectedMonthlyYield = projectedDailyYield * 30;
    const projectedAnnualYield = currentFloatOutstanding * TREASURY_BILL_APY;

    // GRAIN metrics
    const grainTotalSupply = 1_000_000_000; // 1B total
    const grainCirculating = parseFloat(grainPool?.total_grain_allocated) || 0;
    const grainBackingValue = parseFloat(grainPool?.total_backing_value) || 0;
    const grainPrice = grainBackingValue > 0 && grainCirculating > 0
      ? grainBackingValue / grainCirculating
      : parseFloat(latestPrice?.price_usd) || 1.00;

    // Flywheel health indicators
    const flywheelHealth = {
      float_utilization: floatMetrics.total_amount > 0
        ? floatMetrics.deployed_amount / floatMetrics.total_amount
        : 0,
      yield_efficiency: vaultMetrics.total_deposited > 0
        ? vaultMetrics.yield_accrued / vaultMetrics.total_deposited
        : 0,
      participant_engagement: rewardMetrics.total_rewards > 0
        ? rewardMetrics.claimed / rewardMetrics.total_rewards
        : 0,
      grain_backing_ratio: grainCirculating > 0
        ? grainBackingValue / grainCirculating
        : 1.0
    };

    // Growth projections
    const growthProjections = calculateGrowthProjections(
      currentFloatOutstanding,
      TREASURY_BILL_APY,
      AVG_FLOAT_DAYS
    );

    return NextResponse.json({
      // Overview
      overview: {
        flywheel_status: currentFloatOutstanding > 0 ? 'active' : 'initializing',
        current_float_outstanding: currentFloatOutstanding,
        total_yield_generated: vaultMetrics.yield_accrued,
        total_rewards_distributed: rewardMetrics.total_amount,
        grain_price: grainPrice,
        blended_apy: vaultMetrics.avg_apy
      },

      // Float
      float: floatMetrics,

      // Vault
      vault: vaultMetrics,

      // GRAIN
      grain: {
        total_supply: grainTotalSupply,
        circulating_supply: grainCirculating,
        backing_value: grainBackingValue,
        price_usd: grainPrice,
        market_cap: grainCirculating * grainPrice,
        appreciation_fund: parseFloat(grainPool?.grain_appreciation_fund) || 0,
        yield_to_date: parseFloat(grainPool?.yield_to_date) || 0
      },

      // Yield Distribution
      yield: {
        ...yieldMetrics,
        distribution_split: {
          wells: '50%',
          grain_appreciation: '30%',
          participant_rewards: '20%'
        }
      },

      // Rewards
      rewards: rewardMetrics,

      // Health
      health: flywheelHealth,

      // Projections
      projections: {
        daily_yield: projectedDailyYield,
        monthly_yield: projectedMonthlyYield,
        annual_yield: projectedAnnualYield,
        ...growthProjections
      },

      // Recent daily metrics
      daily_metrics: dailyMetrics || [],

      // How it works
      flywheel_mechanics: {
        step_1: 'Wells AI processes payments → Settlement delay creates float',
        step_2: 'Float deployed to Grain & Vault treasury strategies',
        step_3: 'Treasury generates yield (T-bills, money market, stablecoin)',
        step_4: 'Yield distributed: 50% Wells, 30% GRAIN backing, 20% participants',
        step_5: 'GRAIN appreciates → Better rates → More volume → More float',
        virtuous_cycle: 'Repeat'
      }
    });
  } catch (error) {
    console.error('Error getting flywheel dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to get flywheel dashboard' },
      { status: 500 }
    );
  }
}

function calculateGrowthProjections(
  currentFloat: number,
  apy: number,
  avgFloatDays: number
): {
  float_30_day: number;
  float_90_day: number;
  yield_30_day: number;
  yield_90_day: number;
  grain_price_30_day: number;
  grain_price_90_day: number;
} {
  // Assume 20% monthly growth in float volume (viral growth)
  const monthlyGrowthRate = 0.20;
  const dailyGrowthRate = Math.pow(1 + monthlyGrowthRate, 1/30) - 1;

  // Project float
  const float30Day = currentFloat * Math.pow(1 + dailyGrowthRate, 30);
  const float90Day = currentFloat * Math.pow(1 + dailyGrowthRate, 90);

  // Project yield (simplified)
  const dailyYieldRate = apy / 365;
  const yield30Day = float30Day * dailyYieldRate * 30 * 0.5; // 50% goes to Wells
  const yield90Day = float90Day * dailyYieldRate * 90 * 0.5;

  // Project GRAIN price (30% of yield goes to backing)
  const grainAppreciation30 = float30Day * dailyYieldRate * 30 * 0.3;
  const grainAppreciation90 = float90Day * dailyYieldRate * 90 * 0.3;

  // Assume 100M GRAIN circulating, price = backing / circulating
  const baseGrainCirculating = 100_000_000;
  const grainPrice30Day = 1.0 + (grainAppreciation30 / baseGrainCirculating);
  const grainPrice90Day = 1.0 + (grainAppreciation90 / baseGrainCirculating);

  return {
    float_30_day: float30Day,
    float_90_day: float90Day,
    yield_30_day: yield30Day,
    yield_90_day: yield90Day,
    grain_price_30_day: grainPrice30Day,
    grain_price_90_day: grainPrice90Day
  };
}
