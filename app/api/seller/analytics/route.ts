/**
 * Seller Analytics API
 *
 * Provides performance metrics, insights, and historical data for sellers.
 *
 * Endpoints:
 * - GET: Retrieve performance metrics and analytics
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'quarter' | 'year' (default: 'month')
 * - includeInsights: boolean (default: false)
 * - includeHistory: boolean (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { SellerAgent, SellerMetricsResponse } from '@/lib/seller/seller-agent';
import {
  getSellerMetrics,
  generatePerformanceReport,
  generateInsights,
  PerformanceInsight,
} from '@/lib/seller/performance-tracker';

// Period mapping for date calculations
const PERIOD_DAYS: Record<string, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

export async function GET(request: NextRequest) {
  try {
    const sellerId = request.headers.get('x-seller-id') || request.nextUrl.searchParams.get('sellerId');
    const period = request.nextUrl.searchParams.get('period') || 'month';
    const includeInsights = request.nextUrl.searchParams.get('includeInsights') === 'true';
    const includeHistory = request.nextUrl.searchParams.get('includeHistory') === 'true';
    const includeCategories = request.nextUrl.searchParams.get('includeCategories') === 'true';

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Seller ID is required' },
        { status: 400 }
      );
    }

    // Calculate date range
    const days = PERIOD_DAYS[period] || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get seller agent for comprehensive metrics
    const agent = new SellerAgent();

    // Get performance metrics
    let metrics: SellerMetricsResponse;
    try {
      metrics = await agent.getPerformanceMetrics(sellerId);
    } catch {
      // Fallback to raw query if performance tracker fails
      metrics = await getRawMetrics(sellerId, startDate, endDate);
    }

    // Build response
    const response: {
      period: { label: string; start: Date; end: Date; days: number };
      metrics: SellerMetricsResponse;
      insights?: PerformanceInsight[];
      history?: unknown[];
      categories?: unknown[];
      comparison?: {
        previousPeriod: Partial<SellerMetricsResponse>;
        change: Record<string, number>;
      };
    } = {
      period: {
        label: period,
        start: startDate,
        end: endDate,
        days,
      },
      metrics,
    };

    // Add insights if requested
    if (includeInsights) {
      try {
        const report = await generatePerformanceReport(sellerId, {
          start: startDate,
          end: endDate,
          label: period,
        });
        response.insights = await generateInsights(sellerId, report.metrics, report.trends);
      } catch {
        response.insights = generateDefaultInsights(metrics);
      }
    }

    // Add history if requested
    if (includeHistory) {
      response.history = await getHistoricalData(sellerId, startDate, endDate);
    }

    // Add category breakdown if requested
    if (includeCategories) {
      response.categories = await getCategoryBreakdown(sellerId, startDate, endDate);
    }

    // Add period-over-period comparison
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);
    const previousEndDate = new Date(startDate);

    const previousMetrics = await getRawMetrics(sellerId, previousStartDate, previousEndDate);
    response.comparison = {
      previousPeriod: previousMetrics,
      change: calculateChange(metrics, previousMetrics),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching seller analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getRawMetrics(
  sellerId: string,
  startDate: Date,
  endDate: Date
): Promise<SellerMetricsResponse> {
  // Get quote metrics
  const quoteResult = await sql`
    SELECT
      COUNT(*) as total_quotes,
      COUNT(*) FILTER (WHERE status = 'sent') as quotes_sent,
      COUNT(*) FILTER (WHERE status = 'accepted') as quotes_accepted,
      COUNT(*) FILTER (WHERE status = 'rejected') as quotes_rejected,
      COALESCE(SUM(total) FILTER (WHERE status = 'accepted'), 0) as total_revenue,
      COALESCE(AVG(total) FILTER (WHERE status = 'accepted'), 0) as avg_order_value,
      COALESCE(AVG(calculated_margin), 0) as avg_margin,
      COALESCE(AVG(EXTRACT(EPOCH FROM (sent_at - created_at)) / 3600) FILTER (WHERE sent_at IS NOT NULL), 0) as avg_response_hours
    FROM seller_quotes
    WHERE seller_id = ${sellerId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
  `;

  const quoteData = quoteResult.rows[0] || {};

  // Get negotiation metrics
  const negotiationResult = await sql`
    SELECT
      COUNT(*) as total_negotiations,
      COUNT(*) FILTER (WHERE status IN ('seller_accepted', 'buyer_accepted')) as won,
      COALESCE(AVG(
        CASE WHEN final_price IS NOT NULL AND initial_seller_price > 0
        THEN ((initial_seller_price - final_price) / initial_seller_price) * 100
        ELSE 0 END
      ), 0) as avg_discount,
      COALESCE(AVG(round), 0) as avg_rounds
    FROM seller_negotiations
    WHERE seller_id = ${sellerId}
      AND started_at >= ${startDate.toISOString()}
      AND started_at <= ${endDate.toISOString()}
  `;

  const negData = negotiationResult.rows[0] || {};

  // Get RFQ count
  const rfqResult = await sql`
    SELECT COUNT(*) as rfq_count
    FROM seller_rfq_inbox
    WHERE seller_id = ${sellerId}
      AND received_at >= ${startDate.toISOString()}
      AND received_at <= ${endDate.toISOString()}
  `;

  const rfqCount = parseInt(rfqResult.rows[0]?.rfq_count as string) || parseInt(quoteData.total_quotes as string) || 0;

  // Calculate win rate
  const totalQuotes = parseInt(quoteData.quotes_sent as string) || 0;
  const quotesAccepted = parseInt(quoteData.quotes_accepted as string) || 0;
  const winRate = totalQuotes > 0 ? (quotesAccepted / totalQuotes) * 100 : 0;

  return {
    period: { start: startDate, end: endDate },
    rfqsReceived: rfqCount,
    quotesGenerated: parseInt(quoteData.total_quotes as string) || 0,
    quotesAccepted,
    winRate,
    totalRevenue: parseFloat(quoteData.total_revenue as string) || 0,
    averageOrderValue: parseFloat(quoteData.avg_order_value as string) || 0,
    averageMargin: parseFloat(quoteData.avg_margin as string) || 0,
    averageResponseTimeHours: parseFloat(quoteData.avg_response_hours as string) || 0,
    topCategories: [],
    negotiationStats: {
      total: parseInt(negData.total_negotiations as string) || 0,
      won: parseInt(negData.won as string) || 0,
      averageDiscount: parseFloat(negData.avg_discount as string) || 0,
      averageRounds: parseFloat(negData.avg_rounds as string) || 0,
    },
  };
}

async function getHistoricalData(
  sellerId: string,
  startDate: Date,
  endDate: Date
): Promise<unknown[]> {
  const result = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as quotes,
      COUNT(*) FILTER (WHERE status = 'accepted') as won,
      COALESCE(SUM(total) FILTER (WHERE status = 'accepted'), 0) as revenue
    FROM seller_quotes
    WHERE seller_id = ${sellerId}
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY DATE(created_at)
    ORDER BY date
  `;

  return result.rows.map(row => ({
    date: row.date,
    quotes: parseInt(row.quotes as string) || 0,
    won: parseInt(row.won as string) || 0,
    revenue: parseFloat(row.revenue as string) || 0,
  }));
}

async function getCategoryBreakdown(
  sellerId: string,
  startDate: Date,
  endDate: Date
): Promise<unknown[]> {
  // Get category data from quotes
  const result = await sql`
    SELECT
      COALESCE(sq.line_items->0->>'category', 'Unknown') as category,
      COUNT(*) as quote_count,
      COUNT(*) FILTER (WHERE sq.status = 'accepted') as won_count,
      COALESCE(SUM(sq.total), 0) as total_quoted,
      COALESCE(SUM(sq.total) FILTER (WHERE sq.status = 'accepted'), 0) as total_won,
      COALESCE(AVG(sq.calculated_margin), 0) as avg_margin
    FROM seller_quotes sq
    WHERE sq.seller_id = ${sellerId}
      AND sq.created_at >= ${startDate.toISOString()}
      AND sq.created_at <= ${endDate.toISOString()}
    GROUP BY sq.line_items->0->>'category'
    ORDER BY total_won DESC
    LIMIT 10
  `;

  return result.rows.map(row => ({
    category: row.category,
    quoteCount: parseInt(row.quote_count as string) || 0,
    wonCount: parseInt(row.won_count as string) || 0,
    totalQuoted: parseFloat(row.total_quoted as string) || 0,
    totalWon: parseFloat(row.total_won as string) || 0,
    avgMargin: parseFloat(row.avg_margin as string) || 0,
    winRate: parseInt(row.quote_count as string) > 0
      ? (parseInt(row.won_count as string) / parseInt(row.quote_count as string)) * 100
      : 0,
  }));
}

function calculateChange(
  current: SellerMetricsResponse,
  previous: SellerMetricsResponse
): Record<string, number> {
  const calc = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return {
    rfqsReceived: calc(current.rfqsReceived, previous.rfqsReceived),
    quotesGenerated: calc(current.quotesGenerated, previous.quotesGenerated),
    quotesAccepted: calc(current.quotesAccepted, previous.quotesAccepted),
    winRate: calc(current.winRate, previous.winRate),
    totalRevenue: calc(current.totalRevenue, previous.totalRevenue),
    averageOrderValue: calc(current.averageOrderValue, previous.averageOrderValue),
    averageMargin: calc(current.averageMargin, previous.averageMargin),
    averageResponseTimeHours: calc(current.averageResponseTimeHours, previous.averageResponseTimeHours),
  };
}

function generateDefaultInsights(metrics: SellerMetricsResponse): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  // Win rate insight
  if (metrics.winRate < 20) {
    insights.push({
      type: 'warning',
      category: 'win_rate',
      title: 'Low Win Rate',
      description: `Your win rate is ${metrics.winRate.toFixed(1)}%. Consider adjusting pricing or improving response times.`,
      priority: 'high',
      actionable: true,
      suggestedAction: 'Review your pricing strategy and consider more competitive rates for new customers.',
    });
  } else if (metrics.winRate > 60) {
    insights.push({
      type: 'opportunity',
      category: 'pricing',
      title: 'Strong Win Rate',
      description: `Your ${metrics.winRate.toFixed(1)}% win rate suggests you might have room to increase prices.`,
      priority: 'medium',
      actionable: true,
      suggestedAction: 'Test increasing prices by 5-10% on select products.',
    });
  }

  // Response time insight
  if (metrics.averageResponseTimeHours > 24) {
    insights.push({
      type: 'warning',
      category: 'response_time',
      title: 'Slow Response Times',
      description: `Average response time is ${metrics.averageResponseTimeHours.toFixed(1)} hours. Faster responses win more deals.`,
      priority: 'high',
      actionable: true,
      suggestedAction: 'Enable auto-quote generation for common RFQs to reduce response time.',
    });
  }

  // Margin insight
  if (metrics.averageMargin < 15) {
    insights.push({
      type: 'warning',
      category: 'margins',
      title: 'Low Margins',
      description: `Average margin is ${metrics.averageMargin.toFixed(1)}%. Consider raising minimum margin settings.`,
      priority: 'high',
      actionable: true,
      suggestedAction: 'Increase your minimum margin floor in agent settings.',
    });
  }

  // Negotiation insight
  if (metrics.negotiationStats.total > 0) {
    const negWinRate = (metrics.negotiationStats.won / metrics.negotiationStats.total) * 100;
    if (negWinRate < 50 && metrics.negotiationStats.averageDiscount > 15) {
      insights.push({
        type: 'insight',
        category: 'negotiations',
        title: 'Negotiation Strategy Review',
        description: `You're giving ${metrics.negotiationStats.averageDiscount.toFixed(1)}% average discount but only winning ${negWinRate.toFixed(0)}% of negotiations.`,
        priority: 'medium',
        actionable: true,
        suggestedAction: 'Consider a more conservative negotiation style with smaller concessions.',
      });
    }
  }

  // Revenue trend
  if (metrics.totalRevenue > 0) {
    insights.push({
      type: 'success',
      category: 'revenue',
      title: 'Revenue Summary',
      description: `Generated $${metrics.totalRevenue.toLocaleString()} in revenue with ${metrics.quotesAccepted} closed deals.`,
      priority: 'low',
      actionable: false,
    });
  }

  return insights;
}

// Performance insight type for consistency
interface PerformanceInsight {
  type: 'warning' | 'opportunity' | 'insight' | 'success';
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
}
