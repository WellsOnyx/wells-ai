/**
 * Seller Performance API
 *
 * GET /api/seller/performance - Get performance metrics and reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getSellerMetrics,
  getPerformanceTrends,
  generateInsights,
  generatePerformanceReport,
  getDailySnapshots,
  storePerformanceSnapshot,
  getTopSellers,
  SellerMetrics,
} from '@/lib/seller/performance-tracker';

// ============================================================================
// GET - Get performance data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'summary';
    const period = url.searchParams.get('period') || '30d';
    const days = parseInt(url.searchParams.get('days') || '30');

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let periodLabel: string;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 7 Days';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 30 Days';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 90 Days';
        break;
      case 'mtd':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = 'Month to Date';
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        periodLabel = 'Year to Date';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 30 Days';
    }

    const currentPeriod = { start: startDate, end: now };

    switch (view) {
      case 'summary': {
        // Quick summary with key metrics
        const metrics = await getSellerMetrics(userId, currentPeriod);

        return NextResponse.json({
          period: periodLabel,
          metrics: {
            winRate: `${metrics.winRate.toFixed(1)}%`,
            totalRevenue: metrics.totalRevenue,
            dealsWon: metrics.totalDealsWon,
            quotesOut: metrics.totalQuotesSent,
            avgMargin: `${metrics.averageMarginPercent.toFixed(1)}%`,
            avgResponseTime: `${metrics.averageResponseTimeHours.toFixed(1)} hours`,
            repeatRate: `${metrics.repeatCustomerRate.toFixed(1)}%`,
            avgRating: metrics.averageRating.toFixed(1),
          },
          raw: metrics,
        });
      }

      case 'detailed': {
        // Detailed metrics with all data
        const metrics = await getSellerMetrics(userId, currentPeriod);

        // Calculate previous period for comparison
        const periodLength = now.getTime() - startDate.getTime();
        const previousPeriod = {
          start: new Date(startDate.getTime() - periodLength),
          end: new Date(startDate.getTime() - 1),
        };

        const trends = await getPerformanceTrends(userId, currentPeriod, previousPeriod);

        return NextResponse.json({
          period: periodLabel,
          metrics,
          trends,
          comparePeriod: `Previous ${periodLabel.replace('Last ', '')}`,
        });
      }

      case 'report': {
        // Full performance report with insights
        const report = await generatePerformanceReport(userId, {
          start: startDate,
          end: now,
          label: periodLabel,
        });

        return NextResponse.json({
          report,
        });
      }

      case 'insights': {
        // AI-generated insights only
        const metrics = await getSellerMetrics(userId, currentPeriod);
        const periodLength = now.getTime() - startDate.getTime();
        const previousPeriod = {
          start: new Date(startDate.getTime() - periodLength),
          end: new Date(startDate.getTime() - 1),
        };
        const trends = await getPerformanceTrends(userId, currentPeriod, previousPeriod);
        const insights = await generateInsights(userId, metrics, trends);

        return NextResponse.json({
          period: periodLabel,
          insights,
        });
      }

      case 'daily': {
        // Daily snapshots for charts
        const snapshots = await getDailySnapshots(userId, days);

        return NextResponse.json({
          snapshots,
          days,
        });
      }

      case 'leaderboard': {
        // Top performing sellers
        const metric = url.searchParams.get('metric') as 'revenue' | 'win_rate' | 'rating' | 'response_time' || 'revenue';
        const limit = parseInt(url.searchParams.get('limit') || '10');

        const leaders = await getTopSellers(currentPeriod, metric, limit);

        // Find current user's rank
        const userRank = leaders.findIndex(l => l.sellerId === userId);

        return NextResponse.json({
          period: periodLabel,
          metric,
          leaders,
          yourRank: userRank >= 0 ? userRank + 1 : null,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid view parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error getting performance data:', error);
    return NextResponse.json(
      { error: 'Failed to get performance data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Store performance snapshot (for scheduled jobs)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const metrics = await getSellerMetrics(userId, {
      start: thirtyDaysAgo,
      end: now,
    });

    // Store snapshot
    await storePerformanceSnapshot(userId, metrics);

    return NextResponse.json({
      success: true,
      message: 'Performance snapshot stored',
      snapshotDate: now.toISOString(),
    });
  } catch (error) {
    console.error('Error storing snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to store snapshot' },
      { status: 500 }
    );
  }
}
