// @ts-nocheck
/**
 * FLOAT TREASURY INTEGRATION
 *
 * The secret weapon: All Wells AI payment float flows through Grain & Vault
 *
 * FLYWHEEL:
 * 1. Wells AI captures B2B payments (viral, network effects)
 * 2. USDC sits in treasury during settlement window (3-day average)
 * 3. Float is deployed to Grain & Vault yield strategies
 * 4. Yield appreciates GRAIN tokens for users
 * 5. Better returns attract more users
 * 6. More users → More volume → More float → More yield
 *
 * MATH:
 * - $1T volume / 30 days = $33B/day
 * - 3-day average float = ~$100B constant balance
 * - 5% APY on float = $5B/year = $14M/day
 * - This is on TOP of the 1% transaction fee
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// FLOAT TRACKING
// ============================================================================

export interface FloatPosition {
  id: string;

  // Source of float
  source_type: 'viral_payment' | 'partner_transaction' | 'credit_draw' | 'erp_intercept';
  source_id: string;

  // Amount
  amount_usdc: number;

  // Timeline
  created_at: string;        // When payment initiated
  expected_settlement: string; // When recipient can withdraw
  actual_settlement?: string;  // When actually settled

  // Treasury deployment
  deployed_to_vault: boolean;
  vault_deposit_tx?: string;
  yield_earned: number;

  // Status
  status: 'pending' | 'deployed' | 'settling' | 'settled';
}

/**
 * Track new float from a payment
 * Called when any payment enters the system
 */
export async function trackFloat(
  sourceType: 'viral_payment' | 'partner_transaction' | 'credit_draw' | 'erp_intercept',
  sourceId: string,
  amount: number,
  settlementDelayDays: number = 3
): Promise<FloatPosition> {
  const expectedSettlement = new Date(
    Date.now() + settlementDelayDays * 24 * 60 * 60 * 1000
  );

  const { data: position, error } = await supabase
    .from('float_positions')
    .insert({
      source_type: sourceType,
      source_id: sourceId,
      amount_usdc: amount,
      expected_settlement: expectedSettlement.toISOString(),
      deployed_to_vault: false,
      yield_earned: 0,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  // Immediately queue for vault deployment
  await queueVaultDeployment(position.id);

  // Update daily float metrics
  await updateFloatMetrics(amount, 'add');

  return position;
}

/**
 * Deploy float to Grain & Vault treasury
 * This is where the magic happens - float earns yield
 */
export async function deployToVault(floatPositionId: string): Promise<{
  success: boolean;
  vault_tx_id?: string;
  apy_at_deployment?: number;
}> {
  const { data: position } = await supabase
    .from('float_positions')
    .select('*')
    .eq('id', floatPositionId)
    .eq('status', 'pending')
    .single();

  if (!position) {
    return { success: false };
  }

  // Get current vault APY
  const vaultApy = await getCurrentVaultApy();

  // Deposit to Grain & Vault
  // In production, this calls Circle APIs to move USDC to yield-bearing position
  const vaultTxId = await depositToYieldVault(position.amount_usdc);

  // Update position
  await supabase
    .from('float_positions')
    .update({
      deployed_to_vault: true,
      vault_deposit_tx: vaultTxId,
      status: 'deployed',
      metadata: {
        apy_at_deployment: vaultApy,
        deployed_at: new Date().toISOString()
      }
    })
    .eq('id', floatPositionId);

  // Track vault deposit
  await trackVaultDeposit(position.amount_usdc, vaultApy);

  return {
    success: true,
    vault_tx_id: vaultTxId,
    apy_at_deployment: vaultApy
  };
}

/**
 * Settle float - withdraw from vault and release to recipient
 */
export async function settleFloat(floatPositionId: string): Promise<{
  amount_settled: number;
  yield_earned: number;
  total_payout: number;
}> {
  const { data: position } = await supabase
    .from('float_positions')
    .select('*')
    .eq('id', floatPositionId)
    .eq('status', 'deployed')
    .single();

  if (!position) {
    throw new Error('Float position not found or not deployed');
  }

  // Calculate yield earned during float period
  const deployedAt = new Date(position.metadata?.deployed_at || position.created_at);
  const settledAt = new Date();
  const daysDeployed = (settledAt.getTime() - deployedAt.getTime()) / (24 * 60 * 60 * 1000);
  const apy = position.metadata?.apy_at_deployment || 0.05;
  const yieldEarned = position.amount_usdc * (apy / 365) * daysDeployed;

  // Withdraw from vault
  await withdrawFromYieldVault(position.amount_usdc + yieldEarned);

  // Update position
  await supabase
    .from('float_positions')
    .update({
      actual_settlement: settledAt.toISOString(),
      yield_earned: yieldEarned,
      status: 'settled'
    })
    .eq('id', floatPositionId);

  // Update metrics
  await updateFloatMetrics(position.amount_usdc, 'remove');
  await trackYieldEarned(yieldEarned);

  // Distribute yield (split between Wells and GRAIN holders)
  await distributeYield(yieldEarned, position.source_type, position.source_id);

  return {
    amount_settled: position.amount_usdc,
    yield_earned: yieldEarned,
    total_payout: position.amount_usdc + yieldEarned
  };
}

// ============================================================================
// YIELD DISTRIBUTION
// ============================================================================

/**
 * Distribute yield from float
 * - 50% to Wells treasury (revenue)
 * - 30% to GRAIN stakers (appreciation)
 * - 20% back to payment participants (rewards)
 */
export async function distributeYield(
  yieldAmount: number,
  sourceType: string,
  sourceId: string
): Promise<{
  wells_share: number;
  grain_share: number;
  participant_share: number;
}> {
  const wellsShare = yieldAmount * 0.50;   // 50% to Wells
  const grainShare = yieldAmount * 0.30;   // 30% to GRAIN appreciation
  const participantShare = yieldAmount * 0.20; // 20% to users

  // Record distribution
  await supabase.from('yield_distributions').insert({
    source_type: sourceType,
    source_id: sourceId,
    total_yield: yieldAmount,
    wells_share: wellsShare,
    grain_share: grainShare,
    participant_share: participantShare,
    created_at: new Date().toISOString()
  });

  // Credit GRAIN appreciation pool
  await creditGrainPool(grainShare);

  // Credit participant rewards (based on source type)
  await creditParticipantRewards(sourceType, sourceId, participantShare);

  return {
    wells_share: wellsShare,
    grain_share: grainShare,
    participant_share: participantShare
  };
}

/**
 * Credit GRAIN appreciation pool
 * This increases the backing value of GRAIN tokens
 */
async function creditGrainPool(amount: number): Promise<void> {
  // Get current GRAIN pool
  const { data: pool } = await supabase
    .from('grain_pools')
    .select('*')
    .eq('pool_type', 'appreciation')
    .single();

  if (pool) {
    await supabase
      .from('grain_pools')
      .update({
        balance: pool.balance + amount,
        total_yield_added: pool.total_yield_added + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', pool.id);
  } else {
    await supabase.from('grain_pools').insert({
      pool_type: 'appreciation',
      balance: amount,
      total_yield_added: amount
    });
  }

  // Update GRAIN price (backing value)
  await updateGrainPrice();
}

/**
 * Credit participant rewards based on payment type
 */
async function creditParticipantRewards(
  sourceType: string,
  sourceId: string,
  amount: number
): Promise<void> {
  // Get sender and recipient from source
  let senderId: string | null = null;
  let recipientId: string | null = null;

  if (sourceType === 'viral_payment') {
    const { data } = await supabase
      .from('viral_payments')
      .select('sender_id, recipient_account_id')
      .eq('id', sourceId)
      .single();
    senderId = data?.sender_id;
    recipientId = data?.recipient_account_id;
  } else if (sourceType === 'partner_transaction') {
    const { data } = await supabase
      .from('white_label_transactions')
      .select('sender_account_id, recipient_account_id')
      .eq('id', sourceId)
      .single();
    senderId = data?.sender_account_id;
    recipientId = data?.recipient_account_id;
  }

  // Split 50/50 between sender and recipient
  const perParty = amount / 2;

  if (senderId) {
    await creditAccountRewards(senderId, perParty, 'float_yield');
  }
  if (recipientId) {
    await creditAccountRewards(recipientId, perParty, 'float_yield');
  }
}

async function creditAccountRewards(
  accountId: string,
  amount: number,
  rewardType: string
): Promise<void> {
  await supabase.from('account_rewards').insert({
    account_id: accountId,
    amount,
    reward_type: rewardType,
    status: 'pending',
    created_at: new Date().toISOString()
  });
}

// ============================================================================
// GRAIN PRICE MECHANICS
// ============================================================================

/**
 * Update GRAIN price based on backing value
 * GRAIN = Backed by yield pool / Total GRAIN supply
 */
async function updateGrainPrice(): Promise<number> {
  // Get total GRAIN supply
  const { data: supplyData } = await supabase
    .from('grain_supply')
    .select('total_supply, circulating_supply')
    .single();

  // Get total backing (appreciation pool + reserves)
  const { data: pools } = await supabase
    .from('grain_pools')
    .select('balance, pool_type');

  const totalBacking = pools?.reduce((sum, p) => sum + (p.balance || 0), 0) || 0;
  const circulatingSupply = supplyData?.circulating_supply || 1000000;

  // GRAIN price = backing / supply
  const grainPrice = totalBacking / circulatingSupply;

  // Record price update
  await supabase.from('grain_price_history').insert({
    price: grainPrice,
    total_backing: totalBacking,
    circulating_supply: circulatingSupply,
    timestamp: new Date().toISOString()
  });

  return grainPrice;
}

// ============================================================================
// FLOAT METRICS
// ============================================================================

export interface FloatMetrics {
  // Current state
  current_float_balance: number;
  deployed_to_vault: number;
  pending_deployment: number;

  // Volume
  total_float_processed: number;
  daily_float_volume: number;

  // Yield
  total_yield_earned: number;
  daily_yield: number;
  current_apy: number;

  // Distribution
  total_wells_revenue: number;
  total_grain_appreciation: number;
  total_participant_rewards: number;

  // Projections
  projected_monthly_yield: number;
  projected_annual_yield: number;
}

export async function getFloatMetrics(): Promise<FloatMetrics> {
  // Get current float positions
  const { data: activePositions } = await supabase
    .from('float_positions')
    .select('amount_usdc, deployed_to_vault, status')
    .in('status', ['pending', 'deployed']);

  const currentFloat = activePositions?.reduce((sum, p) => sum + p.amount_usdc, 0) || 0;
  const deployedFloat = activePositions
    ?.filter(p => p.deployed_to_vault)
    .reduce((sum, p) => sum + p.amount_usdc, 0) || 0;

  // Get settled positions for yield data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { data: settledPositions } = await supabase
    .from('float_positions')
    .select('amount_usdc, yield_earned, actual_settlement')
    .eq('status', 'settled')
    .gt('actual_settlement', thirtyDaysAgo.toISOString());

  const totalYield = settledPositions?.reduce((sum, p) => sum + (p.yield_earned || 0), 0) || 0;
  const dailyYield = totalYield / 30;

  // Get yield distributions
  const { data: distributions } = await supabase
    .from('yield_distributions')
    .select('wells_share, grain_share, participant_share');

  const totalWellsRevenue = distributions?.reduce((sum, d) => sum + d.wells_share, 0) || 0;
  const totalGrainAppreciation = distributions?.reduce((sum, d) => sum + d.grain_share, 0) || 0;
  const totalParticipantRewards = distributions?.reduce((sum, d) => sum + d.participant_share, 0) || 0;

  // Get current APY
  const currentApy = await getCurrentVaultApy();

  // Projections based on current float
  const projectedMonthlyYield = deployedFloat * (currentApy / 12);
  const projectedAnnualYield = deployedFloat * currentApy;

  return {
    current_float_balance: currentFloat,
    deployed_to_vault: deployedFloat,
    pending_deployment: currentFloat - deployedFloat,

    total_float_processed: 0, // TODO: Sum all historical
    daily_float_volume: currentFloat / 3, // Assume 3-day average float

    total_yield_earned: totalYield,
    daily_yield: dailyYield,
    current_apy: currentApy,

    total_wells_revenue: totalWellsRevenue,
    total_grain_appreciation: totalGrainAppreciation,
    total_participant_rewards: totalParticipantRewards,

    projected_monthly_yield: projectedMonthlyYield,
    projected_annual_yield: projectedAnnualYield
  };
}

// ============================================================================
// FLYWHEEL METRICS
// ============================================================================

export interface FlywheelMetrics {
  // Wells AI side
  wells_daily_volume: number;
  wells_viral_coefficient: number;
  wells_network_growth_rate: number;

  // Float bridge
  float_balance: number;
  float_velocity: number; // How fast float turns over

  // Grain & Vault side
  vault_apy: number;
  grain_price: number;
  grain_appreciation_rate: number;

  // Flywheel momentum
  flywheel_score: number; // 0-100 composite score
  acceleration: number;   // Rate of change
}

export async function getFlywheelMetrics(): Promise<FlywheelMetrics> {
  // Get Wells AI metrics
  const { data: viralPayments } = await supabase
    .from('viral_payments')
    .select('amount_usdc, status, created_at')
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const wellsDailyVolume = viralPayments
    ?.filter(p => p.status === 'claimed')
    .reduce((sum, p) => sum + p.amount_usdc, 0) || 0;

  const totalPayments = viralPayments?.length || 1;
  const claimedPayments = viralPayments?.filter(p => p.status === 'claimed').length || 0;
  const viralCoefficient = claimedPayments / totalPayments;

  // Get float metrics
  const floatMetrics = await getFloatMetrics();

  // Get Grain & Vault metrics
  const vaultApy = await getCurrentVaultApy();

  const { data: grainPrice } = await supabase
    .from('grain_price_history')
    .select('price')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  // Calculate flywheel score (0-100)
  // Components: volume growth, viral coefficient, float utilization, yield efficiency
  const volumeScore = Math.min(wellsDailyVolume / 1_000_000_000, 1) * 25; // 25 points for $1B daily
  const viralScore = viralCoefficient * 25; // 25 points for 100% conversion
  const floatScore = (floatMetrics.deployed_to_vault / Math.max(floatMetrics.current_float_balance, 1)) * 25;
  const yieldScore = Math.min(vaultApy / 0.10, 1) * 25; // 25 points for 10% APY

  const flywheelScore = volumeScore + viralScore + floatScore + yieldScore;

  return {
    wells_daily_volume: wellsDailyVolume,
    wells_viral_coefficient: viralCoefficient,
    wells_network_growth_rate: 0, // TODO: Calculate

    float_balance: floatMetrics.current_float_balance,
    float_velocity: floatMetrics.daily_float_volume / Math.max(floatMetrics.current_float_balance, 1),

    vault_apy: vaultApy,
    grain_price: grainPrice?.price || 1.0,
    grain_appreciation_rate: 0, // TODO: Calculate from history

    flywheel_score: flywheelScore,
    acceleration: 0 // TODO: Calculate rate of change
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function queueVaultDeployment(floatPositionId: string): Promise<void> {
  // In production, this would queue for batch deployment
  // For now, deploy immediately
  setTimeout(() => deployToVault(floatPositionId), 1000);
}

async function updateFloatMetrics(amount: number, operation: 'add' | 'remove'): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('daily_float_metrics')
    .select('*')
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('daily_float_metrics')
      .update({
        float_balance: operation === 'add'
          ? existing.float_balance + amount
          : existing.float_balance - amount,
        updated_at: new Date().toISOString()
      })
      .eq('date', today);
  } else {
    await supabase.from('daily_float_metrics').insert({
      date: today,
      float_balance: amount,
      yield_earned: 0
    });
  }
}

async function trackVaultDeposit(amount: number, apy: number): Promise<void> {
  await supabase.from('vault_deposits').insert({
    amount,
    apy_at_deposit: apy,
    created_at: new Date().toISOString()
  });
}

async function trackYieldEarned(amount: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_daily_yield', {
    p_date: today,
    p_amount: amount
  }).catch(() => {
    // Fallback if RPC doesn't exist
    supabase.from('daily_float_metrics')
      .update({ yield_earned: amount })
      .eq('date', today);
  });
}

async function getCurrentVaultApy(): Promise<number> {
  // In production, this would fetch from actual vault strategies
  // For now, return baseline + dynamic component
  const baseApy = 0.05; // 5% base
  const dynamicApy = Math.random() * 0.02; // 0-2% dynamic
  return baseApy + dynamicApy;
}

async function depositToYieldVault(amount: number): Promise<string> {
  // In production, this calls Circle/DeFi APIs
  return `vault_deposit_${Date.now().toString(36)}`;
}

async function withdrawFromYieldVault(amount: number): Promise<string> {
  // In production, this calls Circle/DeFi APIs
  return `vault_withdraw_${Date.now().toString(36)}`;
}

export default {
  trackFloat,
  deployToVault,
  settleFloat,
  distributeYield,
  getFloatMetrics,
  getFlywheelMetrics
};
