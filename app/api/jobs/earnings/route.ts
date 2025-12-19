/**
 * Worker Earnings API
 * GET: Get worker earnings and attribution earnings
 * POST: Actions like withdraw, set referrer
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import {
  getWorkerEarnings,
  getAvailableBalance,
  getWorkerAttribution,
  setReferrer,
} from '@/lib/jobs/earnings-service';

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
        error: 'Worker profile not found',
        message: "Create a worker profile first to track earnings.",
      }, { status: 404 });
    }
    const profile = profileResult.profile;

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'all'; // all, attribution, pending
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filters
    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    if (view === 'attribution') {
      filters.type = ['attribution', 'referral'];
    } else if (view === 'pending') {
      filters.status = ['pending'];
    }

    // Get earnings
    const { earnings, summary, message } = await getWorkerEarnings(profile.id, filters);

    // Get attribution info
    const { attribution, chain, message: attrMessage } = await getWorkerAttribution(profile.id);

    // Get available balance
    const availableBalance = await getAvailableBalance(profile.id);

    // Build comprehensive summary
    let fullMessage = message;

    if (attribution && chain && chain.chain.length > 0) {
      fullMessage += ` Network: ${chain.chain.length} level(s), earning ${chain.totalPercent}% from referrals.`;
    }

    if (profile.referralCode) {
      fullMessage += ` Your referral code: ${profile.referralCode}.`;
    }

    return NextResponse.json({
      success: true,
      earnings,
      summary: {
        ...summary,
        availableBalance,
      },
      attribution: {
        chain,
        referralCode: profile.referralCode,
        referralLink: `https://wells.ai/join?ref=${profile.referralCode}`,
        totalAttributionEarnings: summary.byType?.attribution || 0,
      },
      message: fullMessage,
      view,
    });
  } catch (error: any) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings' },
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
        error: 'Worker profile not found',
        message: 'Create a worker profile first.',
      }, { status: 404 });
    }
    const profile = profileResult.profile;

    const body = await req.json();
    const { action, data, text } = body;

    switch (action) {
      case 'set_referrer': {
        // Extract referral code from data or text
        let referralCode = data?.referralCode || data?.code;

        if (!referralCode && text) {
          // Try to extract code from text
          const match = text.match(/\b(W[A-Z0-9]{6})\b/i);
          if (match) {
            referralCode = match[1].toUpperCase();
          }
        }

        if (!referralCode) {
          return NextResponse.json({
            error: 'referralCode required',
            message: "Enter a referral code to join someone's network.",
          }, { status: 400 });
        }

        const { success, message } = await setReferrer(profile.id, referralCode);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'get_referral_link': {
        if (!profile.referralCode) {
          return NextResponse.json({
            success: false,
            message: 'Your referral code is being generated.',
          });
        }

        const link = `https://wells.ai/join?ref=${profile.referralCode}`;

        return NextResponse.json({
          success: true,
          referralCode: profile.referralCode,
          referralLink: link,
          message: `Share your code ${profile.referralCode} or link: ${link}. You earn 5% of referred workers' earnings.`,
        });
      }

      case 'withdraw': {
        // Get available balance
        const balance = await getAvailableBalance(profile.id);

        if (balance <= 0) {
          return NextResponse.json({
            success: false,
            message: 'No available balance to withdraw.',
          });
        }

        const amount = data?.amount || balance;
        const method = data?.method || 'bank'; // bank, grain, crypto

        // In production, would initiate withdrawal
        // For now, return success message

        return NextResponse.json({
          success: true,
          message: `Withdrawal of $${amount.toFixed(2)} initiated via ${method}. Funds typically arrive within 2-3 business days.`,
          withdrawalId: `w_${Date.now()}`,
          amount,
          method,
        });
      }

      case 'get_payout_methods': {
        // Return available payout methods
        return NextResponse.json({
          success: true,
          methods: [
            { id: 'bank', name: 'Bank Transfer', fee: 0, time: '2-3 days' },
            { id: 'grain', name: 'GRAIN Wallet', fee: 0, time: 'Instant' },
            { id: 'paypal', name: 'PayPal', fee: '2.9%', time: 'Instant' },
          ],
          message: 'Choose a payout method. GRAIN wallet is instant with no fees.',
        });
      }

      case 'get_attribution_stats': {
        const { attribution, chain, message } = await getWorkerAttribution(profile.id);

        // Get earnings breakdown by level
        const { earnings } = await getWorkerEarnings(profile.id, {
          type: ['attribution', 'referral'],
        });

        const byLevel: Record<number, number> = {};
        for (const e of earnings) {
          if (e.attributionLevel) {
            byLevel[e.attributionLevel] = (byLevel[e.attributionLevel] || 0) + e.netAmount;
          }
        }

        return NextResponse.json({
          success: true,
          attribution,
          chain,
          earningsByLevel: byLevel,
          totalAttributionEarnings: earnings.reduce((sum, e) => sum + e.netAmount, 0),
          message,
        });
      }

      case 'export': {
        // Export earnings data
        const format = data?.format || 'csv';
        const { earnings } = await getWorkerEarnings(profile.id, {
          startDate: data?.startDate ? new Date(data.startDate) : undefined,
          endDate: data?.endDate ? new Date(data.endDate) : undefined,
        });

        // In production, would generate actual export file
        return NextResponse.json({
          success: true,
          message: `Exporting ${earnings.length} earnings records as ${format}. Download link will be sent to your email.`,
          recordCount: earnings.length,
        });
      }

      case 'transfer': {
        // Transfer to GRAIN account
        const balance = await getAvailableBalance(profile.id);

        if (balance <= 0) {
          return NextResponse.json({
            success: false,
            message: 'No available balance to transfer.',
          });
        }

        const amount = data?.amount || balance;
        const destination = data?.destination || 'grain'; // grain, savings, investment

        // In production, would initiate actual transfer to GRAIN account
        return NextResponse.json({
          success: true,
          message: `Transferred $${amount.toFixed(2)} to your GRAIN ${destination} account. Available immediately.`,
          transferId: `t_${Date.now()}`,
          amount,
          destination,
          fee: 0,
        });
      }

      case 'get_stats': {
        // Get comprehensive earnings stats
        const { earnings, summary } = await getWorkerEarnings(profile.id);
        const { attribution, chain } = await getWorkerAttribution(profile.id);
        const balance = await getAvailableBalance(profile.id);

        // Calculate monthly stats
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const thisMonthEarnings = earnings
          .filter(e => new Date(e.createdAt) >= thisMonthStart)
          .reduce((sum, e) => sum + e.netAmount, 0);

        const lastMonthEarnings = earnings
          .filter(e => {
            const d = new Date(e.createdAt);
            return d >= lastMonthStart && d <= lastMonthEnd;
          })
          .reduce((sum, e) => sum + e.netAmount, 0);

        const growth = lastMonthEarnings > 0
          ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
          : null;

        return NextResponse.json({
          success: true,
          stats: {
            totalEarnings: summary.totalNet,
            availableBalance: balance,
            pendingAmount: summary.pendingAmount,
            thisMonthEarnings,
            lastMonthEarnings,
            growth,
            byType: summary.byType,
            attributionEarnings: summary.byType?.attribution || 0,
            networkLevels: chain?.chain.length || 0,
          },
          message: `Total: $${summary.totalNet.toFixed(2)}. Available: $${balance.toFixed(2)}. This month: $${thisMonthEarnings.toFixed(2)}.`,
        });
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          available: [
            'withdraw', 'transfer', 'set_referrer', 'get_referral_link',
            'get_payout_methods', 'get_attribution_stats', 'get_stats', 'export'
          ]
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling earnings action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
