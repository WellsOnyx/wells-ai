/**
 * Seller Performance Tracker
 *
 * Tracks and reports seller metrics:
 * - Win rate (deals won / RFQs received)
 * - Average response time
 * - Average margin achieved
 * - Customer satisfaction scores
 * - Repeat customer rate
 *
 * Provides insights and recommendations.
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { SellerAIConfig, getSellerConfig } from './ai-agent-config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface SellerMetrics {
  // Core performance
  totalRfqsReceived: number;
  totalQuotesSent: number;
  totalDealsWon: number;
  totalDealsClosed: number;
  totalRevenue: number;

  // Rates
  winRate: number;
  quoteRate: number;
  closeRate: number;

  // Timing
  averageResponseTimeHours: number;
  fastestResponseTimeHours: number;
  slowestResponseTimeHours: number;

  // Pricing
  averageMarginPercent: number;
  highestMarginPercent: number;
  lowestMarginPercent: number;
  averageDealSize: number;

  // Negotiation
  totalNegotiations: number;
  negotiationsWon: number;
  negotiationsLost: number;
  averageNegotiationRounds: number;
  averageDiscountGiven: number;

  // Customer satisfaction
  averageRating: number;
  totalReviews: number;
  repeatCustomerRate: number;
  repeatCustomerCount: number;

  // Time period
  periodStart: Date;
  periodEnd: Date;
}

export interface PerformanceTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  isPositive: boolean;
}

export interface PerformanceInsight {
  type: 'success' | 'warning' | 'opportunity' | 'action';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  recommendation?: string;
}

export interface PerformanceReport {
  sellerId: string;
  sellerName: string;
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  metrics: SellerMetrics;
  trends: PerformanceTrend[];
  insights: PerformanceInsight[];
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    dealCount: number;
    winRate: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    revenue: number;
    dealCount: number;
    lastDealDate: Date;
  }>;
  generatedAt: Date;
}

export interface DailySnapshot {
  date: Date;
  rfqsReceived: number;
  quotesSent: number;
  dealsWon: number;
  revenue: number;
  averageMargin: number;
  averageResponseHours: number;
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Get seller metrics for a time period
 */
export async function getSellerMetrics(
  sellerId: string,
  period: {
    start: Date;
    end: Date;
  }
): Promise<SellerMetrics> {
  // Get RFQ and quote data
  const quoteStats = await sql`
    SELECT
      COUNT(DISTINCT sq.rfq_id) as total_rfqs,
      COUNT(*) as total_quotes,
      COUNT(*) FILTER (WHERE sq.status = 'accepted') as deals_won,
      COUNT(*) FILTER (WHERE sq.status IN ('accepted', 'rejected', 'expired')) as deals_closed,
      SUM(sq.total) FILTER (WHERE sq.status = 'accepted') as total_revenue,
      AVG(sq.calculated_margin) as avg_margin,
      MAX(sq.calculated_margin) as max_margin,
      MIN(sq.calculated_margin) FILTER (WHERE sq.calculated_margin > 0) as min_margin,
      AVG(sq.total) FILTER (WHERE sq.status = 'accepted') as avg_deal_size,
      AVG(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
        FILTER (WHERE sq.sent_at IS NOT NULL) as avg_response_hours,
      MIN(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
        FILTER (WHERE sq.sent_at IS NOT NULL) as min_response_hours,
      MAX(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
        FILTER (WHERE sq.sent_at IS NOT NULL) as max_response_hours
    FROM seller_quotes sq
    WHERE sq.seller_id = ${sellerId}
      AND sq.created_at >= ${period.start.toISOString()}
      AND sq.created_at <= ${period.end.toISOString()}
  `;

  // Get negotiation stats
  const negotiationStats = await sql`
    SELECT
      COUNT(*) as total_negotiations,
      COUNT(*) FILTER (WHERE status IN ('seller_accepted', 'buyer_accepted')) as negotiations_won,
      COUNT(*) FILTER (WHERE status = 'no_deal') as negotiations_lost,
      AVG(round) as avg_rounds,
      AVG(
        CASE WHEN final_price IS NOT NULL AND initial_seller_price > 0
        THEN ((initial_seller_price - final_price) / initial_seller_price) * 100
        ELSE 0 END
      ) as avg_discount
    FROM seller_negotiations
    WHERE seller_id = ${sellerId}
      AND started_at >= ${period.start.toISOString()}
      AND started_at <= ${period.end.toISOString()}
  `;

  // Get customer satisfaction data
  const customerStats = await sql`
    SELECT
      AVG(rating) as avg_rating,
      COUNT(*) as total_reviews
    FROM seller_reviews
    WHERE seller_id = ${sellerId}
      AND created_at >= ${period.start.toISOString()}
      AND created_at <= ${period.end.toISOString()}
  `;

  // Get repeat customer data
  const repeatStats = await sql`
    WITH customer_deals AS (
      SELECT
        sq.rfq_id,
        r.requestor_email as customer_id
      FROM seller_quotes sq
      JOIN rfqs r ON sq.rfq_id = r.id
      WHERE sq.seller_id = ${sellerId}
        AND sq.status = 'accepted'
        AND sq.created_at >= ${period.start.toISOString()}
        AND sq.created_at <= ${period.end.toISOString()}
    ),
    customer_counts AS (
      SELECT customer_id, COUNT(*) as deal_count
      FROM customer_deals
      GROUP BY customer_id
    )
    SELECT
      COUNT(*) as total_customers,
      COUNT(*) FILTER (WHERE deal_count > 1) as repeat_customers
    FROM customer_counts
  `;

  const qs = quoteStats.rows[0];
  const ns = negotiationStats.rows[0];
  const cs = customerStats.rows[0];
  const rs = repeatStats.rows[0];

  const totalRfqs = parseInt(qs.total_rfqs) || 0;
  const totalQuotes = parseInt(qs.total_quotes) || 0;
  const dealsWon = parseInt(qs.deals_won) || 0;
  const dealsClosed = parseInt(qs.deals_closed) || 0;

  return {
    totalRfqsReceived: totalRfqs,
    totalQuotesSent: totalQuotes,
    totalDealsWon: dealsWon,
    totalDealsClosed: dealsClosed,
    totalRevenue: parseFloat(qs.total_revenue) || 0,

    winRate: totalRfqs > 0 ? (dealsWon / totalRfqs) * 100 : 0,
    quoteRate: totalRfqs > 0 ? (totalQuotes / totalRfqs) * 100 : 0,
    closeRate: totalQuotes > 0 ? (dealsWon / totalQuotes) * 100 : 0,

    averageResponseTimeHours: parseFloat(qs.avg_response_hours) || 0,
    fastestResponseTimeHours: parseFloat(qs.min_response_hours) || 0,
    slowestResponseTimeHours: parseFloat(qs.max_response_hours) || 0,

    averageMarginPercent: parseFloat(qs.avg_margin) || 0,
    highestMarginPercent: parseFloat(qs.max_margin) || 0,
    lowestMarginPercent: parseFloat(qs.min_margin) || 0,
    averageDealSize: parseFloat(qs.avg_deal_size) || 0,

    totalNegotiations: parseInt(ns.total_negotiations) || 0,
    negotiationsWon: parseInt(ns.negotiations_won) || 0,
    negotiationsLost: parseInt(ns.negotiations_lost) || 0,
    averageNegotiationRounds: parseFloat(ns.avg_rounds) || 0,
    averageDiscountGiven: parseFloat(ns.avg_discount) || 0,

    averageRating: parseFloat(cs.avg_rating) || 0,
    totalReviews: parseInt(cs.total_reviews) || 0,
    repeatCustomerRate: parseInt(rs.total_customers) > 0
      ? (parseInt(rs.repeat_customers) / parseInt(rs.total_customers)) * 100
      : 0,
    repeatCustomerCount: parseInt(rs.repeat_customers) || 0,

    periodStart: period.start,
    periodEnd: period.end,
  };
}

/**
 * Calculate performance trends
 */
export async function getPerformanceTrends(
  sellerId: string,
  currentPeriod: { start: Date; end: Date },
  previousPeriod: { start: Date; end: Date }
): Promise<PerformanceTrend[]> {
  const current = await getSellerMetrics(sellerId, currentPeriod);
  const previous = await getSellerMetrics(sellerId, previousPeriod);

  const trends: PerformanceTrend[] = [];

  const addTrend = (
    metric: string,
    currentValue: number,
    previousValue: number,
    higherIsBetter: boolean = true
  ) => {
    const change = currentValue - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
    const trend = Math.abs(changePercent) < 5 ? 'stable' : change > 0 ? 'up' : 'down';
    const isPositive = higherIsBetter ? change >= 0 : change <= 0;

    trends.push({
      metric,
      current: currentValue,
      previous: previousValue,
      change,
      changePercent,
      trend,
      isPositive,
    });
  };

  addTrend('Win Rate', current.winRate, previous.winRate, true);
  addTrend('Total Revenue', current.totalRevenue, previous.totalRevenue, true);
  addTrend('Average Margin', current.averageMarginPercent, previous.averageMarginPercent, true);
  addTrend('Response Time (hours)', current.averageResponseTimeHours, previous.averageResponseTimeHours, false);
  addTrend('Deal Count', current.totalDealsWon, previous.totalDealsWon, true);
  addTrend('Average Deal Size', current.averageDealSize, previous.averageDealSize, true);
  addTrend('Repeat Customer Rate', current.repeatCustomerRate, previous.repeatCustomerRate, true);
  addTrend('Customer Rating', current.averageRating, previous.averageRating, true);

  return trends;
}

/**
 * Generate AI-powered insights
 */
export async function generateInsights(
  sellerId: string,
  metrics: SellerMetrics,
  trends: PerformanceTrend[]
): Promise<PerformanceInsight[]> {
  const config = await getSellerConfig(sellerId);

  const prompt = `You are Wells, analyzing seller performance metrics to provide actionable insights.

Seller: ${config?.companyName || 'Unknown'}
Period: ${metrics.periodStart.toDateString()} - ${metrics.periodEnd.toDateString()}

Key Metrics:
- Win Rate: ${metrics.winRate.toFixed(1)}%
- Total Revenue: $${metrics.totalRevenue.toFixed(2)}
- Average Margin: ${metrics.averageMarginPercent.toFixed(1)}% (target: ${config?.pricingStrategy.targetMargin || 30}%)
- Average Response Time: ${metrics.averageResponseTimeHours.toFixed(1)} hours
- Average Deal Size: $${metrics.averageDealSize.toFixed(2)}
- Repeat Customer Rate: ${metrics.repeatCustomerRate.toFixed(1)}%
- Average Rating: ${metrics.averageRating.toFixed(1)}/5

Trends (vs previous period):
${trends.map(t => `- ${t.metric}: ${t.changePercent > 0 ? '+' : ''}${t.changePercent.toFixed(1)}% (${t.trend})`).join('\n')}

Generate 4-6 insights. Return JSON array:
[
  {
    "type": "success|warning|opportunity|action",
    "title": "Short title",
    "description": "1-2 sentences explaining the insight",
    "metric": "metric name if applicable",
    "value": number if applicable,
    "recommendation": "What to do about it"
  }
]

Focus on:
- Celebrating wins (success)
- Identifying problems (warning)
- Spotting opportunities (opportunity)
- Suggesting specific actions (action)`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch?.[0] || '[]');
  } catch {
    // Fallback insights
    const insights: PerformanceInsight[] = [];

    if (metrics.winRate > 50) {
      insights.push({
        type: 'success',
        title: 'Strong Win Rate',
        description: `Your ${metrics.winRate.toFixed(1)}% win rate is excellent!`,
        metric: 'Win Rate',
        value: metrics.winRate,
      });
    } else if (metrics.winRate < 30) {
      insights.push({
        type: 'warning',
        title: 'Low Win Rate',
        description: 'Consider adjusting pricing or response times.',
        metric: 'Win Rate',
        value: metrics.winRate,
        recommendation: 'Review lost deals to identify common patterns.',
      });
    }

    if (metrics.averageResponseTimeHours > 4) {
      insights.push({
        type: 'action',
        title: 'Response Time Could Improve',
        description: `Average response time is ${metrics.averageResponseTimeHours.toFixed(1)} hours.`,
        recommendation: 'Enable auto-response for faster quotes.',
      });
    }

    return insights;
  }
}

// ============================================================================
// PERFORMANCE REPORT
// ============================================================================

/**
 * Generate comprehensive performance report
 */
export async function generatePerformanceReport(
  sellerId: string,
  period: {
    start: Date;
    end: Date;
    label?: string;
  }
): Promise<PerformanceReport> {
  const config = await getSellerConfig(sellerId);

  // Calculate previous period for comparison
  const periodLength = period.end.getTime() - period.start.getTime();
  const previousPeriod = {
    start: new Date(period.start.getTime() - periodLength),
    end: new Date(period.start.getTime() - 1),
  };

  // Get metrics and trends
  const metrics = await getSellerMetrics(sellerId, period);
  const trends = await getPerformanceTrends(sellerId, period, previousPeriod);
  const insights = await generateInsights(sellerId, metrics, trends);

  // Get top products
  const topProductsResult = await sql`
    SELECT
      p.id as product_id,
      p.name as product_name,
      SUM(sq.total) FILTER (WHERE sq.status = 'accepted') as revenue,
      COUNT(*) FILTER (WHERE sq.status = 'accepted') as deal_count,
      COUNT(*) FILTER (WHERE sq.status = 'accepted')::float /
        NULLIF(COUNT(*), 0) * 100 as win_rate
    FROM seller_quotes sq
    JOIN LATERAL (
      SELECT (jsonb_array_elements(sq.matched_products::jsonb)::text)::uuid as product_id
    ) mp ON true
    LEFT JOIN seller_catalog p ON p.id::text = mp.product_id::text
    WHERE sq.seller_id = ${sellerId}
      AND sq.created_at >= ${period.start.toISOString()}
      AND sq.created_at <= ${period.end.toISOString()}
    GROUP BY p.id, p.name
    ORDER BY revenue DESC NULLS LAST
    LIMIT 5
  `;

  // Get top customers
  const topCustomersResult = await sql`
    SELECT
      r.requestor_email as customer_id,
      r.requestor_name as customer_name,
      SUM(sq.total) FILTER (WHERE sq.status = 'accepted') as revenue,
      COUNT(*) FILTER (WHERE sq.status = 'accepted') as deal_count,
      MAX(sq.created_at) as last_deal_date
    FROM seller_quotes sq
    JOIN rfqs r ON sq.rfq_id = r.id
    WHERE sq.seller_id = ${sellerId}
      AND sq.created_at >= ${period.start.toISOString()}
      AND sq.created_at <= ${period.end.toISOString()}
      AND sq.status = 'accepted'
    GROUP BY r.requestor_email, r.requestor_name
    ORDER BY revenue DESC NULLS LAST
    LIMIT 5
  `;

  return {
    sellerId,
    sellerName: config?.companyName || 'Unknown',
    period: {
      start: period.start,
      end: period.end,
      label: period.label || 'Custom Period',
    },
    metrics,
    trends,
    insights,
    topProducts: topProductsResult.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name || 'Unknown Product',
      revenue: parseFloat(row.revenue) || 0,
      dealCount: parseInt(row.deal_count) || 0,
      winRate: parseFloat(row.win_rate) || 0,
    })),
    topCustomers: topCustomersResult.rows.map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name || 'Unknown Customer',
      revenue: parseFloat(row.revenue) || 0,
      dealCount: parseInt(row.deal_count) || 0,
      lastDealDate: new Date(row.last_deal_date),
    })),
    generatedAt: new Date(),
  };
}

// ============================================================================
// DAILY SNAPSHOTS
// ============================================================================

/**
 * Get daily performance snapshots
 */
export async function getDailySnapshots(
  sellerId: string,
  days: number = 30
): Promise<DailySnapshot[]> {
  const result = await sql`
    WITH daily_data AS (
      SELECT
        DATE(sq.created_at) as date,
        COUNT(DISTINCT sq.rfq_id) as rfqs_received,
        COUNT(*) FILTER (WHERE sq.sent_at IS NOT NULL) as quotes_sent,
        COUNT(*) FILTER (WHERE sq.status = 'accepted') as deals_won,
        SUM(sq.total) FILTER (WHERE sq.status = 'accepted') as revenue,
        AVG(sq.calculated_margin) as avg_margin,
        AVG(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
          FILTER (WHERE sq.sent_at IS NOT NULL) as avg_response_hours
      FROM seller_quotes sq
      WHERE sq.seller_id = ${sellerId}
        AND sq.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(sq.created_at)
    )
    SELECT * FROM daily_data
    ORDER BY date DESC
  `;

  return result.rows.map(row => ({
    date: new Date(row.date),
    rfqsReceived: parseInt(row.rfqs_received) || 0,
    quotesSent: parseInt(row.quotes_sent) || 0,
    dealsWon: parseInt(row.deals_won) || 0,
    revenue: parseFloat(row.revenue) || 0,
    averageMargin: parseFloat(row.avg_margin) || 0,
    averageResponseHours: parseFloat(row.avg_response_hours) || 0,
  }));
}

/**
 * Store performance snapshot for historical tracking
 */
export async function storePerformanceSnapshot(
  sellerId: string,
  metrics: SellerMetrics
): Promise<void> {
  await sql`
    INSERT INTO seller_performance_snapshots (
      seller_id, snapshot_date,
      total_rfqs, total_quotes, deals_won, deals_closed, total_revenue,
      win_rate, quote_rate, close_rate,
      avg_response_hours, avg_margin, avg_deal_size,
      total_negotiations, negotiations_won, avg_discount,
      avg_rating, total_reviews, repeat_customer_rate
    ) VALUES (
      ${sellerId}, ${new Date().toISOString()},
      ${metrics.totalRfqsReceived}, ${metrics.totalQuotesSent}, ${metrics.totalDealsWon},
      ${metrics.totalDealsClosed}, ${metrics.totalRevenue},
      ${metrics.winRate}, ${metrics.quoteRate}, ${metrics.closeRate},
      ${metrics.averageResponseTimeHours}, ${metrics.averageMarginPercent}, ${metrics.averageDealSize},
      ${metrics.totalNegotiations}, ${metrics.negotiationsWon}, ${metrics.averageDiscountGiven},
      ${metrics.averageRating}, ${metrics.totalReviews}, ${metrics.repeatCustomerRate}
    )
    ON CONFLICT (seller_id, snapshot_date) DO UPDATE SET
      total_rfqs = EXCLUDED.total_rfqs,
      total_quotes = EXCLUDED.total_quotes,
      deals_won = EXCLUDED.deals_won,
      total_revenue = EXCLUDED.total_revenue,
      win_rate = EXCLUDED.win_rate,
      avg_margin = EXCLUDED.avg_margin
  `;
}

// ============================================================================
// LEADERBOARDS
// ============================================================================

/**
 * Get top performing sellers
 */
export async function getTopSellers(
  period: { start: Date; end: Date },
  metric: 'revenue' | 'win_rate' | 'rating' | 'response_time' = 'revenue',
  limit: number = 10
): Promise<Array<{
  sellerId: string;
  sellerName: string;
  value: number;
  rank: number;
}>> {
  const orderByClause = {
    revenue: 'SUM(sq.total) FILTER (WHERE sq.status = \'accepted\') DESC NULLS LAST',
    win_rate: 'COUNT(*) FILTER (WHERE sq.status = \'accepted\')::float / NULLIF(COUNT(*), 0) DESC NULLS LAST',
    rating: 'AVG(sr.rating) DESC NULLS LAST',
    response_time: 'AVG(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600) ASC NULLS LAST',
  }[metric];

  const result = await sql`
    SELECT
      sac.seller_id,
      sac.company_name,
      CASE
        WHEN ${metric} = 'revenue' THEN SUM(sq.total) FILTER (WHERE sq.status = 'accepted')
        WHEN ${metric} = 'win_rate' THEN COUNT(*) FILTER (WHERE sq.status = 'accepted')::float / NULLIF(COUNT(*), 0) * 100
        WHEN ${metric} = 'response_time' THEN AVG(EXTRACT(EPOCH FROM (sq.sent_at - sq.created_at)) / 3600)
        ELSE 0
      END as value,
      ROW_NUMBER() OVER (ORDER BY ${sql.raw(orderByClause)}) as rank
    FROM seller_ai_configs sac
    LEFT JOIN seller_quotes sq ON sac.seller_id = sq.seller_id
      AND sq.created_at >= ${period.start.toISOString()}
      AND sq.created_at <= ${period.end.toISOString()}
    LEFT JOIN seller_reviews sr ON sac.seller_id = sr.seller_id
    WHERE sac.is_active = true
    GROUP BY sac.seller_id, sac.company_name
    ORDER BY value ${metric === 'response_time' ? sql`ASC` : sql`DESC`} NULLS LAST
    LIMIT ${limit}
  `;

  return result.rows.map(row => ({
    sellerId: row.seller_id,
    sellerName: row.company_name,
    value: parseFloat(row.value) || 0,
    rank: parseInt(row.rank),
  }));
}

// ============================================================================
// ACTIONABLE INSIGHTS
// ============================================================================

export interface ActionableRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'pricing' | 'response_time' | 'negotiation' | 'customer_retention' | 'product_mix';
  title: string;
  description: string;
  expectedImpact: {
    metric: string;
    estimatedChange: number;
    timeframe: string;
  };
  action: {
    type: 'config_change' | 'pricing_adjustment' | 'process_improvement' | 'manual_review';
    automatable: boolean;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Generate specific, actionable recommendations based on performance data
 */
export async function generateActionableRecommendations(
  sellerId: string,
  metrics: SellerMetrics,
  trends: PerformanceTrend[]
): Promise<ActionableRecommendation[]> {
  const config = await getSellerConfig(sellerId);
  const recommendations: ActionableRecommendation[] = [];

  // Response time recommendations
  if (metrics.averageResponseTimeHours > 4) {
    recommendations.push({
      id: `rec_${Date.now()}_response`,
      priority: 'high',
      category: 'response_time',
      title: 'Enable Auto-Response to Win More Deals',
      description: `Your average response time is ${metrics.averageResponseTimeHours.toFixed(1)} hours. Top sellers respond in under 2 hours. Enabling auto-response could improve your win rate by 15-20%.`,
      expectedImpact: {
        metric: 'win_rate',
        estimatedChange: 15,
        timeframe: '30 days',
      },
      action: {
        type: 'config_change',
        automatable: true,
        parameters: {
          setting: 'autoResponse.enabled',
          value: true,
          autoApproveUnder: config?.autoResponse?.autoApproveUnder || 5000,
        },
      },
    });
  } else if (metrics.averageResponseTimeHours < 1 && !config?.autoResponse?.enabled) {
    recommendations.push({
      id: `rec_${Date.now()}_fast_response`,
      priority: 'low',
      category: 'response_time',
      title: 'Great Response Time - Consider Raising Auto-Approval Threshold',
      description: `Your fast response times are working well. Consider raising your auto-approval threshold from $${config?.autoResponse?.autoApproveUnder || 5000} to capture more deals automatically.`,
      expectedImpact: {
        metric: 'deals_won',
        estimatedChange: 10,
        timeframe: '30 days',
      },
      action: {
        type: 'config_change',
        automatable: true,
        parameters: {
          setting: 'autoResponse.autoApproveUnder',
          value: (config?.autoResponse?.autoApproveUnder || 5000) * 1.5,
        },
      },
    });
  }

  // Pricing recommendations based on win rate
  const winRateTrend = trends.find(t => t.metric === 'Win Rate');
  if (metrics.winRate < 25 && metrics.averageMarginPercent > (config?.pricingStrategy?.targetMargin || 30)) {
    recommendations.push({
      id: `rec_${Date.now()}_pricing_high`,
      priority: 'high',
      category: 'pricing',
      title: 'Lower Prices to Win More Deals',
      description: `Your win rate is ${metrics.winRate.toFixed(1)}% but your margin is ${metrics.averageMarginPercent.toFixed(1)}%. Consider reducing prices by 5-10% to win more volume.`,
      expectedImpact: {
        metric: 'win_rate',
        estimatedChange: 20,
        timeframe: '30 days',
      },
      action: {
        type: 'pricing_adjustment',
        automatable: true,
        parameters: {
          adjustmentType: 'percentage',
          adjustmentValue: -7,
          applyTo: 'all_products',
        },
      },
    });
  } else if (metrics.winRate > 60 && metrics.averageMarginPercent < (config?.pricingStrategy?.targetMargin || 30)) {
    recommendations.push({
      id: `rec_${Date.now()}_pricing_low`,
      priority: 'medium',
      category: 'pricing',
      title: 'Increase Prices to Improve Margins',
      description: `Your ${metrics.winRate.toFixed(1)}% win rate suggests you may be underpricing. Your margin is ${metrics.averageMarginPercent.toFixed(1)}% vs target of ${config?.pricingStrategy?.targetMargin || 30}%. Consider a 5% price increase.`,
      expectedImpact: {
        metric: 'margin',
        estimatedChange: 4,
        timeframe: '30 days',
      },
      action: {
        type: 'pricing_adjustment',
        automatable: true,
        parameters: {
          adjustmentType: 'percentage',
          adjustmentValue: 5,
          applyTo: 'all_products',
        },
      },
    });
  }

  // Negotiation recommendations
  if (metrics.totalNegotiations > 5 && metrics.negotiationsWon / metrics.totalNegotiations < 0.4) {
    const negotiationStyle = config?.negotiationStyle?.aggression || 'balanced';
    const suggestedStyle = negotiationStyle === 'conservative' ? 'balanced' : 'aggressive';

    recommendations.push({
      id: `rec_${Date.now()}_negotiation`,
      priority: 'medium',
      category: 'negotiation',
      title: 'Adjust Negotiation Strategy',
      description: `You're winning only ${((metrics.negotiationsWon / metrics.totalNegotiations) * 100).toFixed(0)}% of negotiations. Consider switching from "${negotiationStyle}" to "${suggestedStyle}" negotiation style.`,
      expectedImpact: {
        metric: 'negotiation_win_rate',
        estimatedChange: 15,
        timeframe: '30 days',
      },
      action: {
        type: 'config_change',
        automatable: true,
        parameters: {
          setting: 'negotiationStyle.aggression',
          value: suggestedStyle,
        },
      },
    });
  }

  // Customer retention recommendations
  if (metrics.repeatCustomerRate < 20 && metrics.totalDealsWon > 10) {
    recommendations.push({
      id: `rec_${Date.now()}_retention`,
      priority: 'medium',
      category: 'customer_retention',
      title: 'Improve Customer Retention',
      description: `Only ${metrics.repeatCustomerRate.toFixed(0)}% of your customers order again. Consider adding a repeat customer discount to encourage loyalty.`,
      expectedImpact: {
        metric: 'repeat_customer_rate',
        estimatedChange: 25,
        timeframe: '60 days',
      },
      action: {
        type: 'config_change',
        automatable: true,
        parameters: {
          setting: 'pricingStrategy.repeatCustomerDiscount',
          value: 10,
        },
      },
    });
  }

  // Volume discount recommendations
  if (metrics.averageDealSize > 1000 && !config?.pricingStrategy?.volumeDiscountTiers?.length) {
    recommendations.push({
      id: `rec_${Date.now()}_volume`,
      priority: 'medium',
      category: 'pricing',
      title: 'Add Volume Discounts',
      description: 'Your average deal size suggests buyers order in bulk. Adding volume discounts could increase deal sizes and win rate.',
      expectedImpact: {
        metric: 'deal_size',
        estimatedChange: 20,
        timeframe: '30 days',
      },
      action: {
        type: 'config_change',
        automatable: true,
        parameters: {
          setting: 'pricingStrategy.volumeDiscountTiers',
          value: [
            { minQuantity: 100, discountPercent: 5 },
            { minQuantity: 500, discountPercent: 10 },
            { minQuantity: 1000, discountPercent: 15 },
          ],
        },
      },
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Apply an automated recommendation
 */
export async function applyRecommendation(
  sellerId: string,
  recommendation: ActionableRecommendation
): Promise<{ success: boolean; message: string }> {
  if (!recommendation.action.automatable) {
    return {
      success: false,
      message: 'This recommendation requires manual action',
    };
  }

  const config = await getSellerConfig(sellerId);
  if (!config) {
    return { success: false, message: 'Seller configuration not found' };
  }

  try {
    if (recommendation.action.type === 'config_change' && recommendation.action.parameters) {
      const { setting, value } = recommendation.action.parameters;
      const settingPath = (setting as string).split('.');

      // Deep update the config
      let current: Record<string, unknown> = config as unknown as Record<string, unknown>;
      for (let i = 0; i < settingPath.length - 1; i++) {
        current = current[settingPath[i]] as Record<string, unknown>;
      }
      current[settingPath[settingPath.length - 1]] = value;

      // Save updated config
      const { saveSellerConfig } = await import('./ai-agent-config');
      await saveSellerConfig(config);

      return {
        success: true,
        message: `Applied recommendation: ${recommendation.title}`,
      };
    }

    if (recommendation.action.type === 'pricing_adjustment' && recommendation.action.parameters) {
      const { adjustmentValue } = recommendation.action.parameters;
      const { bulkUpdatePrices } = await import('./catalog-service');
      const count = await bulkUpdatePrices(sellerId, {
        type: 'percentage',
        amount: adjustmentValue as number,
      });

      return {
        success: true,
        message: `Updated pricing for ${count} products`,
      };
    }

    return { success: false, message: 'Unknown action type' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to apply recommendation',
    };
  }
}

/**
 * Get performance comparison with peers/industry
 */
export async function getBenchmarkComparison(
  sellerId: string,
  period: { start: Date; end: Date }
): Promise<{
  seller: SellerMetrics;
  industry: {
    avgWinRate: number;
    avgMargin: number;
    avgResponseTime: number;
    avgDealSize: number;
    avgRating: number;
  };
  percentiles: {
    winRate: number;
    margin: number;
    responseTime: number;
    dealSize: number;
    rating: number;
  };
  ranking: {
    overall: number;
    totalSellers: number;
    tier: 'top10' | 'top25' | 'average' | 'below_average';
  };
}> {
  const sellerMetrics = await getSellerMetrics(sellerId, period);

  // Get industry averages
  const industryResult = await sql`
    SELECT
      AVG(sps.win_rate) as avg_win_rate,
      AVG(sps.avg_margin) as avg_margin,
      AVG(sps.avg_response_hours) as avg_response_time,
      AVG(sps.avg_deal_size) as avg_deal_size,
      AVG(sps.avg_rating) as avg_rating,
      COUNT(DISTINCT seller_id) as total_sellers
    FROM seller_performance_snapshots sps
    WHERE snapshot_date >= ${period.start.toISOString()}::date
      AND snapshot_date <= ${period.end.toISOString()}::date
  `;

  // Get percentile rankings
  const percentileResult = await sql`
    WITH seller_ranks AS (
      SELECT
        seller_id,
        PERCENT_RANK() OVER (ORDER BY win_rate DESC) as win_rate_percentile,
        PERCENT_RANK() OVER (ORDER BY avg_margin DESC) as margin_percentile,
        PERCENT_RANK() OVER (ORDER BY avg_response_hours ASC) as response_percentile,
        PERCENT_RANK() OVER (ORDER BY avg_deal_size DESC) as deal_size_percentile,
        PERCENT_RANK() OVER (ORDER BY avg_rating DESC) as rating_percentile
      FROM seller_performance_snapshots
      WHERE snapshot_date = (
        SELECT MAX(snapshot_date) FROM seller_performance_snapshots
        WHERE snapshot_date <= ${period.end.toISOString()}::date
      )
    )
    SELECT * FROM seller_ranks
    WHERE seller_id = ${sellerId}
  `;

  const industry = industryResult.rows[0];
  const percentiles = percentileResult.rows[0] || {};
  const totalSellers = parseInt(industry.total_sellers) || 1;

  // Calculate overall ranking
  const avgPercentile = (
    (1 - (parseFloat(percentiles.win_rate_percentile) || 0.5)) +
    (1 - (parseFloat(percentiles.margin_percentile) || 0.5)) +
    (1 - (parseFloat(percentiles.response_percentile) || 0.5)) +
    (1 - (parseFloat(percentiles.deal_size_percentile) || 0.5)) +
    (1 - (parseFloat(percentiles.rating_percentile) || 0.5))
  ) / 5;

  const overallRank = Math.round(avgPercentile * totalSellers);
  let tier: 'top10' | 'top25' | 'average' | 'below_average';
  if (avgPercentile <= 0.1) tier = 'top10';
  else if (avgPercentile <= 0.25) tier = 'top25';
  else if (avgPercentile <= 0.5) tier = 'average';
  else tier = 'below_average';

  return {
    seller: sellerMetrics,
    industry: {
      avgWinRate: parseFloat(industry.avg_win_rate) || 0,
      avgMargin: parseFloat(industry.avg_margin) || 0,
      avgResponseTime: parseFloat(industry.avg_response_time) || 0,
      avgDealSize: parseFloat(industry.avg_deal_size) || 0,
      avgRating: parseFloat(industry.avg_rating) || 0,
    },
    percentiles: {
      winRate: Math.round((1 - (parseFloat(percentiles.win_rate_percentile) || 0.5)) * 100),
      margin: Math.round((1 - (parseFloat(percentiles.margin_percentile) || 0.5)) * 100),
      responseTime: Math.round((1 - (parseFloat(percentiles.response_percentile) || 0.5)) * 100),
      dealSize: Math.round((1 - (parseFloat(percentiles.deal_size_percentile) || 0.5)) * 100),
      rating: Math.round((1 - (parseFloat(percentiles.rating_percentile) || 0.5)) * 100),
    },
    ranking: {
      overall: overallRank,
      totalSellers,
      tier,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const PerformanceTracker = {
  getSellerMetrics,
  getPerformanceTrends,
  generateInsights,
  generatePerformanceReport,
  getDailySnapshots,
  storePerformanceSnapshot,
  getTopSellers,
  generateActionableRecommendations,
  applyRecommendation,
  getBenchmarkComparison,
};

export default PerformanceTracker;
