/**
 * Jobs Attribution API
 * Manage referral network and attribution earnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId, updateWorkerProfile } from '@/lib/jobs/worker-service';
import {
  getWorkerEarnings,
  getWorkerAttribution,
  setReferrer,
} from '@/lib/jobs/earnings-service';
import { sqlQuery as sql } from '@/lib/db';
import { DEFAULT_ATTRIBUTION_PERCENTS } from '@/lib/jobs/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileResult = await getWorkerProfileByUserId(userId);
    if (!profileResult.profile) {
      return NextResponse.json({
        success: false,
        message: "Create a worker profile first to see your referral network.",
      });
    }
    const profile = profileResult.profile;

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'overview'; // overview, history, network, referred

    switch (view) {
      case 'overview': {
        // Get attribution chain and earnings summary
        const { attribution, chain, message } = await getWorkerAttribution(profile.id);

        // Get attribution earnings
        const { earnings } = await getWorkerEarnings(profile.id, {
          type: ['attribution', 'referral'],
        });

        const totalAttributionEarnings = earnings.reduce((sum, e) => sum + e.netAmount, 0);

        // Get earnings by level
        const byLevel: Record<number, number> = {};
        for (const e of earnings) {
          if (e.attributionLevel) {
            byLevel[e.attributionLevel] = (byLevel[e.attributionLevel] || 0) + e.netAmount;
          }
        }

        // Get count of people I've referred
        const referredResult = await sql`
          SELECT COUNT(*) as count FROM worker_profiles WHERE referred_by = ${profile.id}
        `;
        const referredCount = parseInt(referredResult.rows[0].count) || 0;

        return NextResponse.json({
          success: true,
          overview: {
            chain,
            totalAttributionEarnings,
            earningsByLevel: byLevel,
            referredCount,
            referralCode: profile.referralCode,
            referralLink: `https://wells.ai/join?ref=${profile.referralCode}`,
            defaultRates: DEFAULT_ATTRIBUTION_PERCENTS,
          },
          message: message || `Your referral code: ${profile.referralCode}. ${referredCount} people referred.`,
        });
      }

      case 'history': {
        // Get attribution earnings history
        const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
        const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

        const { earnings, summary } = await getWorkerEarnings(profile.id, {
          type: ['attribution', 'referral'],
          startDate,
          endDate,
        });

        // Group by source worker
        const bySource: Record<string, { amount: number; count: number; name?: string }> = {};
        for (const e of earnings) {
          const sourceId = e.attributedFromId || 'unknown';
          if (!bySource[sourceId]) {
            bySource[sourceId] = { amount: 0, count: 0, name: e.attributedFromName };
          }
          bySource[sourceId].amount += e.netAmount;
          bySource[sourceId].count += 1;
        }

        return NextResponse.json({
          success: true,
          earnings,
          summary: {
            total: summary.totalNet,
            count: earnings.length,
            bySource,
          },
          message: `${earnings.length} attribution earnings totaling $${summary.totalNet.toFixed(2)}.`,
        });
      }

      case 'network': {
        // Get the full network tree (who I'm connected to)
        const { attribution, chain } = await getWorkerAttribution(profile.id);

        // Get who referred me and their chain
        let upline: any[] = [];
        if (chain && chain.chain.length > 0) {
          upline = chain.chain.map(level => ({
            level: level.level,
            referrerId: level.referrerId,
            referrerName: level.referrerName,
            percent: level.percent,
          }));
        }

        // Get my downline (people I referred, and their referrals, etc.)
        const downline = await getDownline(profile.id, 4);

        return NextResponse.json({
          success: true,
          network: {
            upline,
            downline,
            myReferralCode: profile.referralCode,
            myReferralLink: `https://wells.ai/join?ref=${profile.referralCode}`,
          },
          message: `Upline: ${upline.length} level(s). Downline: ${downline.length} direct referrals.`,
        });
      }

      case 'referred': {
        // Get list of people I've referred
        const result = await sql`
          SELECT
            id, display_name, created_at,
            total_earnings, completed_tasks, average_rating
          FROM worker_profiles
          WHERE referred_by = ${profile.id}
          ORDER BY created_at DESC
          LIMIT 50
        `;

        const referred = result.rows.map(row => ({
          id: row.id,
          displayName: row.display_name,
          joinedAt: row.created_at,
          totalEarnings: parseFloat(row.total_earnings) || 0,
          completedTasks: row.completed_tasks || 0,
          rating: parseFloat(row.average_rating) || null,
        }));

        // Calculate total earnings from referrals
        const { earnings } = await getWorkerEarnings(profile.id, {
          type: ['attribution', 'referral'],
        });

        const earningsFromReferred = earnings.reduce((sum, e) => {
          if (e.attributionLevel === 1) {
            return sum + e.netAmount;
          }
          return sum;
        }, 0);

        return NextResponse.json({
          success: true,
          referred,
          stats: {
            totalReferred: referred.length,
            earningsFromReferred,
          },
          message: `${referred.length} people joined using your code. You've earned $${earningsFromReferred.toFixed(2)} from them.`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown view. Try: overview, history, network, referred' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error fetching attribution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attribution data' },
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

    const profileResult = await getWorkerProfileByUserId(userId);
    if (!profileResult.profile) {
      return NextResponse.json({
        success: false,
        message: "Create a worker profile first.",
      });
    }
    const profile = profileResult.profile;

    const body = await req.json();
    const { action, text, ...data } = body;

    switch (action) {
      case 'record_referral': {
        // Record that someone used my referral code (called when new user signs up)
        // This would typically be called from the signup flow, not directly
        const referralCode = data.referralCode;
        const newWorkerId = data.workerId;

        if (!referralCode || !newWorkerId) {
          return NextResponse.json({
            success: false,
            message: "Please provide referralCode and workerId.",
          });
        }

        const result = await setReferrer(newWorkerId, referralCode);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'set_default_terms': {
        // Update default attribution rates (for platform admins or custom agreements)
        // Regular users can't change the default rates, but this is a placeholder
        // for future functionality where top performers might negotiate better rates

        return NextResponse.json({
          success: false,
          message: "Custom attribution rates are not available yet. Default rates apply: " +
            `Level 1: ${DEFAULT_ATTRIBUTION_PERCENTS.level1}%, ` +
            `Level 2: ${DEFAULT_ATTRIBUTION_PERCENTS.level2}%, ` +
            `Level 3: ${DEFAULT_ATTRIBUTION_PERCENTS.level3}%, ` +
            `Level 4: ${DEFAULT_ATTRIBUTION_PERCENTS.level4}%`,
          defaultRates: DEFAULT_ATTRIBUTION_PERCENTS,
        });
      }

      case 'get_referral_link': {
        // Generate or get referral link
        if (!profile.referralCode) {
          // Generate a new referral code
          const code = `W${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await updateWorkerProfile(profile.id, { referralCode: code });

          return NextResponse.json({
            success: true,
            referralCode: code,
            referralLink: `https://wells.ai/join?ref=${code}`,
            message: `Your new referral code is ${code}. Share it to earn 5% of referred workers' earnings.`,
          });
        }

        return NextResponse.json({
          success: true,
          referralCode: profile.referralCode,
          referralLink: `https://wells.ai/join?ref=${profile.referralCode}`,
          message: `Share your code: ${profile.referralCode}. You earn ${DEFAULT_ATTRIBUTION_PERCENTS.level1}% of referred workers' earnings.`,
        });
      }

      case 'apply_referral': {
        // Apply a referral code to my account
        let referralCode = data.referralCode || data.code;

        // Try to extract from text
        if (!referralCode && text) {
          const match = text.match(/\b(W[A-Z0-9]{6})\b/i);
          if (match) {
            referralCode = match[1].toUpperCase();
          }
        }

        if (!referralCode) {
          return NextResponse.json({
            success: false,
            message: "Please provide a referral code. It looks like W followed by 6 characters.",
          });
        }

        const result = await setReferrer(profile.id, referralCode);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'get_network_stats': {
        // Get comprehensive network statistics
        const { attribution, chain } = await getWorkerAttribution(profile.id);

        // Get all attribution earnings
        const { earnings } = await getWorkerEarnings(profile.id, {
          type: ['attribution', 'referral'],
        });

        // Get downline
        const downline = await getDownline(profile.id, 4);

        // Calculate network stats
        const totalNetworkMembers = await countNetworkMembers(profile.id, 4);
        const totalEarningsFromNetwork = earnings.reduce((sum, e) => sum + e.netAmount, 0);

        // Get this month's attribution earnings
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEarnings = earnings
          .filter(e => new Date(e.createdAt) >= thisMonthStart)
          .reduce((sum, e) => sum + e.netAmount, 0);

        return NextResponse.json({
          success: true,
          stats: {
            totalNetworkMembers,
            directReferrals: downline.length,
            totalEarningsFromNetwork,
            thisMonthEarnings,
            averagePerReferral: downline.length > 0
              ? totalEarningsFromNetwork / downline.length
              : 0,
            chainDepth: chain?.chain.length || 0,
            myReferrer: chain?.chain[0]?.referrerName || null,
          },
          message: `Network: ${totalNetworkMembers} members. Earned $${totalEarningsFromNetwork.toFixed(2)} total, $${thisMonthEarnings.toFixed(2)} this month.`,
        });
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          available: [
            'record_referral', 'set_default_terms', 'get_referral_link',
            'apply_referral', 'get_network_stats'
          ]
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling attribution action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}

// Helper function to get downline (people I referred, recursively)
async function getDownline(workerId: string, maxDepth: number): Promise<any[]> {
  const result = await sql`
    SELECT
      id, display_name, created_at,
      total_earnings, completed_tasks
    FROM worker_profiles
    WHERE referred_by = ${workerId}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const directReferrals = result.rows.map(row => ({
    id: row.id,
    displayName: row.display_name,
    joinedAt: row.created_at,
    totalEarnings: parseFloat(row.total_earnings) || 0,
    completedTasks: row.completed_tasks || 0,
    level: 1,
    referrals: [] as any[],
  }));

  // Recursively get their referrals (up to maxDepth)
  if (maxDepth > 1) {
    for (const referral of directReferrals) {
      const subReferrals = await getDownline(referral.id, maxDepth - 1);
      referral.referrals = subReferrals.map(r => ({ ...r, level: referral.level + 1 }));
    }
  }

  return directReferrals;
}

// Helper function to count total network members
async function countNetworkMembers(workerId: string, maxDepth: number): Promise<number> {
  let total = 0;
  let currentLevel = [workerId];

  for (let depth = 0; depth < maxDepth && currentLevel.length > 0; depth++) {
    const result = await sql`
      SELECT id FROM worker_profiles
      WHERE referred_by = ANY(${currentLevel})
    `;

    currentLevel = result.rows.map(r => r.id);
    total += currentLevel.length;
  }

  return total;
}
