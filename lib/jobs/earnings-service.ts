/**
 * Worker Earnings Service
 * Handles earnings, payouts, and attribution earnings
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  WorkerEarnings,
  EarningsType,
  EarningsStatus,
  EarningsFilters,
  EarningsSummary,
  WorkerAttribution,
  AttributionChain,
  AttributionLevel,
  DEFAULT_ATTRIBUTION_PERCENTS,
} from './types';

// =====================================================
// EARNINGS MANAGEMENT
// =====================================================

export async function getWorkerEarnings(
  workerId: string,
  filters?: EarningsFilters
): Promise<{ earnings: WorkerEarnings[]; summary: EarningsSummary; message: string }> {
  let query = sql`
    SELECT * FROM worker_earnings
    WHERE worker_id = ${workerId}
  `;

  // Apply filters
  if (filters?.startDate) {
    query = sql`${query} AND created_at >= ${filters.startDate}`;
  }
  if (filters?.endDate) {
    query = sql`${query} AND created_at <= ${filters.endDate}`;
  }
  if (filters?.type && filters.type.length > 0) {
    query = sql`${query} AND type = ANY(${filters.type})`;
  }
  if (filters?.status && filters.status.length > 0) {
    query = sql`${query} AND status = ANY(${filters.status})`;
  }

  const result = await sql`
    SELECT * FROM worker_earnings
    WHERE worker_id = ${workerId}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const earnings = result.rows.map(mapRowToEarnings);

  // Calculate summary
  const summary = calculateEarningsSummary(earnings);

  // Generate message
  let message = '';
  if (earnings.length === 0) {
    message = "You don't have any earnings yet. Complete tasks to start earning.";
  } else {
    const available = summary.availableBalance;
    const pending = summary.pendingAmount;
    message = `Total earnings: $${summary.totalNet.toFixed(2)}. Available: $${available.toFixed(2)}`;
    if (pending > 0) {
      message += `. Pending: $${pending.toFixed(2)}`;
    }
    if (summary.byType.attribution && summary.byType.attribution > 0) {
      message += `. Attribution earnings: $${summary.byType.attribution.toFixed(2)}`;
    }
  }

  return { earnings, summary, message };
}

export async function getEarningsById(earningsId: string): Promise<WorkerEarnings | null> {
  const result = await sql`
    SELECT * FROM worker_earnings WHERE id = ${earningsId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToEarnings(result.rows[0]);
}

export async function createEarnings(
  workerId: string,
  data: {
    assignmentId?: string;
    taskId?: string;
    type: EarningsType;
    description: string;
    grossAmount: number;
    platformFee?: number;
    processingFee?: number;
    attributedFromId?: string;
    attributionLevel?: number;
    attributionPercent?: number;
  }
): Promise<{ earnings: WorkerEarnings; message: string }> {
  const platformFee = data.platformFee ?? data.grossAmount * 0.10; // 10% platform fee
  const processingFee = data.processingFee ?? 0;
  const netAmount = data.grossAmount - platformFee - processingFee;

  const result = await sql`
    INSERT INTO worker_earnings (
      worker_id, assignment_id, task_id,
      type, description,
      gross_amount, platform_fee, processing_fee, net_amount, currency,
      attributed_from_id, attribution_level, attribution_percent,
      status, available_at
    ) VALUES (
      ${workerId},
      ${data.assignmentId || null},
      ${data.taskId || null},
      ${data.type},
      ${data.description},
      ${data.grossAmount},
      ${platformFee},
      ${processingFee},
      ${netAmount},
      'USD',
      ${data.attributedFromId || null},
      ${data.attributionLevel || null},
      ${data.attributionPercent || null},
      'available',
      NOW()
    )
    RETURNING *
  `;

  const earnings = mapRowToEarnings(result.rows[0]);

  return {
    earnings,
    message: `$${netAmount.toFixed(2)} added to your balance (${data.type}).`,
  };
}

export async function getAvailableBalance(workerId: string): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(net_amount), 0) as balance
    FROM worker_earnings
    WHERE worker_id = ${workerId} AND status = 'available'
  `;

  return parseFloat(result.rows[0].balance) || 0;
}

// =====================================================
// ATTRIBUTION MANAGEMENT
// =====================================================

export async function getWorkerAttribution(workerId: string): Promise<{
  attribution: WorkerAttribution | null;
  chain: AttributionChain | null;
  message: string;
}> {
  const result = await sql`
    SELECT * FROM worker_attributions WHERE worker_id = ${workerId}
  `;

  if (result.rows.length === 0) {
    return {
      attribution: null,
      chain: null,
      message: "You don't have any referrers in your attribution chain. Share your referral code to earn from your network.",
    };
  }

  const attribution = mapRowToAttribution(result.rows[0]);
  const chain = await buildAttributionChain(workerId, attribution);

  // Get attribution earnings
  const earningsResult = await sql`
    SELECT COALESCE(SUM(net_amount), 0) as total
    FROM worker_earnings
    WHERE worker_id = ${workerId} AND type IN ('attribution', 'referral')
  `;

  const totalAttributionEarnings = parseFloat(earningsResult.rows[0].total) || 0;

  let message = '';
  if (chain && chain.chain.length > 0) {
    message = `Your network has ${chain.chain.length} level(s). `;
    message += `You've earned $${totalAttributionEarnings.toFixed(2)} from referrals.`;
  } else {
    message = "Share your referral code to start building your earning network.";
  }

  return { attribution, chain, message };
}

export async function processAttributionEarnings(
  workerId: string,
  earningsAmount: number,
  taskId: string
): Promise<{ attributionsPaid: number; message: string }> {
  // Get attribution chain
  const result = await sql`
    SELECT * FROM worker_attributions WHERE worker_id = ${workerId}
  `;

  if (result.rows.length === 0) {
    return { attributionsPaid: 0, message: 'No attribution chain.' };
  }

  const attr = result.rows[0];
  let totalPaid = 0;

  // Process each level
  const levels = [
    { referrerId: attr.level1_referrer_id, percent: parseFloat(attr.level1_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level1 },
    { referrerId: attr.level2_referrer_id, percent: parseFloat(attr.level2_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level2 },
    { referrerId: attr.level3_referrer_id, percent: parseFloat(attr.level3_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level3 },
    { referrerId: attr.level4_referrer_id, percent: parseFloat(attr.level4_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level4 },
  ];

  for (let i = 0; i < levels.length; i++) {
    const { referrerId, percent } = levels[i];
    if (!referrerId || percent <= 0) continue;

    const attributionAmount = earningsAmount * (percent / 100);
    if (attributionAmount < 0.01) continue; // Skip tiny amounts

    await createEarnings(referrerId, {
      taskId,
      type: 'attribution',
      description: `Attribution from network (Level ${i + 1})`,
      grossAmount: attributionAmount,
      platformFee: 0, // No platform fee on attribution
      processingFee: 0,
      attributedFromId: workerId,
      attributionLevel: i + 1,
      attributionPercent: percent,
    });

    totalPaid += attributionAmount;
  }

  return {
    attributionsPaid: totalPaid,
    message: totalPaid > 0 ? `$${totalPaid.toFixed(2)} distributed to your referral network.` : '',
  };
}

export async function setReferrer(
  workerId: string,
  referralCode: string
): Promise<{ success: boolean; message: string }> {
  // Find referrer by code
  const referrerResult = await sql`
    SELECT id FROM worker_profiles WHERE referral_code = ${referralCode}
  `;

  if (referrerResult.rows.length === 0) {
    return { success: false, message: "Invalid referral code." };
  }

  const referrerId = referrerResult.rows[0].id;

  if (referrerId === workerId) {
    return { success: false, message: "You can't use your own referral code." };
  }

  // Check if already has referrer
  const existing = await sql`
    SELECT * FROM worker_attributions WHERE worker_id = ${workerId}
  `;

  if (existing.rows.length > 0 && existing.rows[0].level1_referrer_id) {
    return { success: false, message: "You already have a referrer." };
  }

  // Get referrer's chain to build our chain
  const referrerChain = await sql`
    SELECT * FROM worker_attributions WHERE worker_id = ${referrerId}
  `;

  const refChain = referrerChain.rows[0] || {};

  // Create or update attribution
  if (existing.rows.length > 0) {
    await sql`
      UPDATE worker_attributions
      SET
        level1_referrer_id = ${referrerId},
        level1_percent = ${DEFAULT_ATTRIBUTION_PERCENTS.level1},
        level2_referrer_id = ${refChain.level1_referrer_id || null},
        level2_percent = ${refChain.level1_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level2 : 0},
        level3_referrer_id = ${refChain.level2_referrer_id || null},
        level3_percent = ${refChain.level2_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level3 : 0},
        level4_referrer_id = ${refChain.level3_referrer_id || null},
        level4_percent = ${refChain.level3_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level4 : 0},
        updated_at = NOW()
      WHERE worker_id = ${workerId}
    `;
  } else {
    await sql`
      INSERT INTO worker_attributions (
        worker_id,
        level1_referrer_id, level1_percent,
        level2_referrer_id, level2_percent,
        level3_referrer_id, level3_percent,
        level4_referrer_id, level4_percent,
        is_active
      ) VALUES (
        ${workerId},
        ${referrerId}, ${DEFAULT_ATTRIBUTION_PERCENTS.level1},
        ${refChain.level1_referrer_id || null}, ${refChain.level1_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level2 : 0},
        ${refChain.level2_referrer_id || null}, ${refChain.level2_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level3 : 0},
        ${refChain.level3_referrer_id || null}, ${refChain.level3_referrer_id ? DEFAULT_ATTRIBUTION_PERCENTS.level4 : 0},
        true
      )
    `;
  }

  // Update referred_by on profile
  await sql`
    UPDATE worker_profiles SET referred_by = ${referrerId} WHERE id = ${workerId}
  `;

  return {
    success: true,
    message: "Referrer set. You're now part of their network and they'll earn from your success.",
  };
}

// =====================================================
// HELPERS
// =====================================================

function calculateEarningsSummary(earnings: WorkerEarnings[]): EarningsSummary {
  const summary: EarningsSummary = {
    totalGross: 0,
    totalNet: 0,
    totalFees: 0,
    totalPlatformFee: 0,
    totalProcessingFee: 0,
    byType: {},
    byStatus: {},
    availableBalance: 0,
    pendingAmount: 0,
  };

  for (const e of earnings) {
    summary.totalGross += e.grossAmount;
    summary.totalNet += e.netAmount;
    summary.totalPlatformFee += e.platformFee;
    summary.totalProcessingFee += e.processingFee;
    summary.totalFees += e.platformFee + e.processingFee;

    summary.byType[e.type] = (summary.byType[e.type] || 0) + e.netAmount;
    summary.byStatus[e.status] = (summary.byStatus[e.status] || 0) + e.netAmount;

    if (e.status === 'available') {
      summary.availableBalance += e.netAmount;
    }
    if (e.status === 'pending') {
      summary.pendingAmount += e.netAmount;
    }
  }

  return summary;
}

async function buildAttributionChain(
  workerId: string,
  attribution: WorkerAttribution
): Promise<AttributionChain | null> {
  const chain: AttributionLevel[] = [];

  const levels = [
    { referrerId: attribution.level1ReferrerId, percent: attribution.level1Percent },
    { referrerId: attribution.level2ReferrerId, percent: attribution.level2Percent },
    { referrerId: attribution.level3ReferrerId, percent: attribution.level3Percent },
    { referrerId: attribution.level4ReferrerId, percent: attribution.level4Percent },
  ];

  for (let i = 0; i < levels.length; i++) {
    const { referrerId, percent } = levels[i];
    if (!referrerId) continue;

    const profileResult = await sql`
      SELECT display_name, avatar_url FROM worker_profiles WHERE id = ${referrerId}
    `;

    const profile = profileResult.rows[0];

    chain.push({
      level: i + 1,
      referrerId,
      referrerName: profile?.display_name,
      referrerAvatarUrl: profile?.avatar_url,
      percent,
    });
  }

  if (chain.length === 0) return null;

  const totalPercent = chain.reduce((sum, l) => sum + l.percent, 0);

  return {
    workerId,
    chain,
    totalPercent,
  };
}

function mapRowToEarnings(row: any): WorkerEarnings {
  return {
    id: row.id,
    workerId: row.worker_id,
    assignmentId: row.assignment_id,
    taskId: row.task_id,
    type: row.type,
    description: row.description,
    grossAmount: parseFloat(row.gross_amount),
    platformFee: parseFloat(row.platform_fee),
    processingFee: parseFloat(row.processing_fee || 0),
    netAmount: parseFloat(row.net_amount),
    currency: row.currency || 'USD',
    attributedFromId: row.attributed_from_id,
    attributedFromName: row.attributed_from_name,
    attributionLevel: row.attribution_level,
    attributionPercent: row.attribution_percent ? parseFloat(row.attribution_percent) : undefined,
    status: row.status,
    availableAt: row.available_at ? new Date(row.available_at) : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
    payoutId: row.payout_id,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

function mapRowToAttribution(row: any): WorkerAttribution {
  return {
    id: row.id,
    workerId: row.worker_id,
    level1ReferrerId: row.level1_referrer_id,
    level1Percent: parseFloat(row.level1_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level1,
    level2ReferrerId: row.level2_referrer_id,
    level2Percent: parseFloat(row.level2_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level2,
    level3ReferrerId: row.level3_referrer_id,
    level3Percent: parseFloat(row.level3_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level3,
    level4ReferrerId: row.level4_referrer_id,
    level4Percent: parseFloat(row.level4_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level4,
    totalEarningsGenerated: parseFloat(row.total_earnings_generated) || 0,
    totalAttributionPaid: parseFloat(row.total_attribution_paid) || 0,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
