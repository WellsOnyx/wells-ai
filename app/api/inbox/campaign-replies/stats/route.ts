/**
 * Campaign Reply Stats API
 *
 * GET /api/inbox/campaign-replies/stats
 *
 * Get detailed reply statistics for campaigns including:
 * - Sentiment breakdown
 * - Intent distribution
 * - A/B test variant performance
 * - Hot lead metrics
 * - Time-based analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const campaignId = searchParams.get('campaignId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Base date filter
    const dateFilter = dateFrom && dateTo
      ? sql`AND crm.reply_received_at BETWEEN ${dateFrom} AND ${dateTo}`
      : sql``;

    // Campaign filter
    const campaignFilter = campaignId
      ? sql`AND crm.campaign_id = ${campaignId}`
      : sql``;

    // Overall stats
    const overallResult = await sql`
      SELECT
        COUNT(*) as total_replies,
        COUNT(DISTINCT crm.contact_id) as unique_repliers,
        COUNT(*) FILTER (WHERE crm.sentiment = 'positive') as positive_count,
        COUNT(*) FILTER (WHERE crm.sentiment = 'negative') as negative_count,
        COUNT(*) FILTER (WHERE crm.sentiment = 'neutral') as neutral_count,
        COUNT(*) FILTER (WHERE crm.is_hot_lead = true) as hot_leads_count,
        AVG(crm.lead_score) FILTER (WHERE crm.lead_score IS NOT NULL) as avg_lead_score,
        COUNT(*) FILTER (WHERE crm.intent = 'interested') as interested_count,
        COUNT(*) FILTER (WHERE crm.intent = 'not_interested') as not_interested_count,
        COUNT(*) FILTER (WHERE crm.intent = 'meeting_request') as meeting_requests,
        COUNT(*) FILTER (WHERE crm.intent = 'question') as questions_count,
        COUNT(*) FILTER (WHERE crm.intent = 'pricing_inquiry') as pricing_inquiries,
        COUNT(*) FILTER (WHERE crm.intent = 'unsubscribe') as unsubscribes,
        COUNT(*) FILTER (WHERE crm.intent = 'out_of_office') as out_of_office_count,
        AVG(EXTRACT(EPOCH FROM (crm.reply_received_at - om.sent_at)) / 3600)
          FILTER (WHERE om.sent_at IS NOT NULL) as avg_reply_time_hours
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      LEFT JOIN outreach_messages om ON crm.original_message_id = om.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        ${campaignFilter}
        ${dateFilter}
    `;

    const overall = overallResult.rows[0];

    // Sentiment distribution over time (daily)
    const sentimentTrendResult = await sql`
      SELECT
        DATE(crm.reply_received_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE crm.sentiment = 'positive') as positive,
        COUNT(*) FILTER (WHERE crm.sentiment = 'negative') as negative,
        COUNT(*) FILTER (WHERE crm.sentiment = 'neutral') as neutral
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        AND crm.reply_received_at > NOW() - INTERVAL '30 days'
        ${campaignFilter}
      GROUP BY DATE(crm.reply_received_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    // Intent distribution
    const intentResult = await sql`
      SELECT
        crm.intent,
        COUNT(*) as count,
        ROUND(COUNT(*)::DECIMAL / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) as percentage
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        AND crm.intent IS NOT NULL
        ${campaignFilter}
        ${dateFilter}
      GROUP BY crm.intent
      ORDER BY count DESC
    `;

    // A/B test variant performance
    const variantResult = await sql`
      SELECT
        cv.id as variant_id,
        cv.name as variant_name,
        oc.name as campaign_name,
        cv.total_sent,
        cv.total_replied,
        cv.total_positive_replies,
        cv.total_negative_replies,
        cv.total_neutral_replies,
        cv.reply_rate,
        cv.positive_reply_rate,
        cv.is_winner
      FROM campaign_variants cv
      JOIN outreach_campaigns oc ON cv.campaign_id = oc.id
      WHERE oc.user_id = ${userId}
        ${campaignId ? sql`AND cv.campaign_id = ${campaignId}` : sql``}
      ORDER BY cv.reply_rate DESC NULLS LAST
    `;

    // Top performing campaigns by reply rate
    const topCampaignsResult = await sql`
      SELECT
        oc.id,
        oc.name,
        oc.total_sent,
        oc.total_replied,
        oc.reply_rate,
        oc.total_positive_replies,
        oc.total_hot_leads,
        crs.meeting_request_replies,
        crs.avg_reply_time_hours
      FROM outreach_campaigns oc
      LEFT JOIN campaign_reply_stats crs ON oc.id = crs.campaign_id
      WHERE oc.user_id = ${userId}
        AND oc.total_sent > 0
      ORDER BY oc.reply_rate DESC NULLS LAST
      LIMIT 10
    `;

    // Reply time distribution (hour of day)
    const replyTimeResult = await sql`
      SELECT
        EXTRACT(HOUR FROM crm.reply_received_at) as hour,
        COUNT(*) as count
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        ${campaignFilter}
        ${dateFilter}
      GROUP BY EXTRACT(HOUR FROM crm.reply_received_at)
      ORDER BY hour
    `;

    // Reply day distribution
    const replyDayResult = await sql`
      SELECT
        TO_CHAR(crm.reply_received_at, 'Day') as day_name,
        EXTRACT(DOW FROM crm.reply_received_at) as day_number,
        COUNT(*) as count
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        ${campaignFilter}
        ${dateFilter}
      GROUP BY TO_CHAR(crm.reply_received_at, 'Day'), EXTRACT(DOW FROM crm.reply_received_at)
      ORDER BY day_number
    `;

    // Common objections
    const objectionsResult = await sql`
      SELECT
        obj->>'objection' as objection,
        obj->>'type' as type,
        COUNT(*) as count
      FROM campaign_reply_matches crm,
        jsonb_array_elements(crm.objections) as obj
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        AND crm.objections IS NOT NULL
        AND jsonb_array_length(crm.objections) > 0
        ${campaignFilter}
        ${dateFilter}
      GROUP BY obj->>'objection', obj->>'type'
      ORDER BY count DESC
      LIMIT 10
    `;

    // Buying signals frequency
    const buyingSignalsResult = await sql`
      SELECT
        sig->>'signal' as signal,
        sig->>'strength' as strength,
        COUNT(*) as count
      FROM campaign_reply_matches crm,
        jsonb_array_elements(crm.buying_signals) as sig
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        AND crm.buying_signals IS NOT NULL
        AND jsonb_array_length(crm.buying_signals) > 0
        ${campaignFilter}
        ${dateFilter}
      GROUP BY sig->>'signal', sig->>'strength'
      ORDER BY count DESC
      LIMIT 10
    `;

    // Channel performance
    const channelResult = await sql`
      SELECT
        crm.channel,
        COUNT(*) as total_replies,
        COUNT(*) FILTER (WHERE crm.sentiment = 'positive') as positive,
        COUNT(*) FILTER (WHERE crm.is_hot_lead = true) as hot_leads,
        AVG(crm.lead_score) as avg_lead_score
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.campaign_id IS NULL)
        ${campaignFilter}
        ${dateFilter}
      GROUP BY crm.channel
      ORDER BY total_replies DESC
    `;

    return NextResponse.json({
      overview: {
        totalReplies: parseInt(overall.total_replies),
        uniqueRepliers: parseInt(overall.unique_repliers),
        avgLeadScore: parseFloat(overall.avg_lead_score) || 0,
        avgReplyTimeHours: parseFloat(overall.avg_reply_time_hours) || 0,
        hotLeadsCount: parseInt(overall.hot_leads_count),
      },
      sentiment: {
        positive: parseInt(overall.positive_count),
        negative: parseInt(overall.negative_count),
        neutral: parseInt(overall.neutral_count),
        positiveRate: overall.total_replies > 0
          ? (parseInt(overall.positive_count) / parseInt(overall.total_replies) * 100).toFixed(1)
          : 0,
      },
      intent: {
        interested: parseInt(overall.interested_count),
        notInterested: parseInt(overall.not_interested_count),
        meetingRequests: parseInt(overall.meeting_requests),
        questions: parseInt(overall.questions_count),
        pricingInquiries: parseInt(overall.pricing_inquiries),
        unsubscribes: parseInt(overall.unsubscribes),
        outOfOffice: parseInt(overall.out_of_office_count),
        distribution: intentResult.rows.map(row => ({
          intent: row.intent,
          count: parseInt(row.count),
          percentage: parseFloat(row.percentage),
        })),
      },
      sentimentTrend: sentimentTrendResult.rows.map(row => ({
        date: row.date,
        total: parseInt(row.total),
        positive: parseInt(row.positive),
        negative: parseInt(row.negative),
        neutral: parseInt(row.neutral),
      })),
      variantPerformance: variantResult.rows.map(row => ({
        variantId: row.variant_id,
        variantName: row.variant_name,
        campaignName: row.campaign_name,
        sent: row.total_sent,
        replied: row.total_replied,
        positiveReplies: row.total_positive_replies,
        negativeReplies: row.total_negative_replies,
        neutralReplies: row.total_neutral_replies,
        replyRate: parseFloat(row.reply_rate) || 0,
        positiveReplyRate: parseFloat(row.positive_reply_rate) || 0,
        isWinner: row.is_winner,
      })),
      topCampaigns: topCampaignsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        sent: row.total_sent,
        replied: row.total_replied,
        replyRate: parseFloat(row.reply_rate) || 0,
        positiveReplies: row.total_positive_replies,
        hotLeads: row.total_hot_leads,
        meetingRequests: row.meeting_request_replies,
        avgReplyTimeHours: parseFloat(row.avg_reply_time_hours) || 0,
      })),
      replyTiming: {
        byHour: replyTimeResult.rows.map(row => ({
          hour: parseInt(row.hour),
          count: parseInt(row.count),
        })),
        byDay: replyDayResult.rows.map(row => ({
          day: row.day_name.trim(),
          dayNumber: parseInt(row.day_number),
          count: parseInt(row.count),
        })),
      },
      commonObjections: objectionsResult.rows.map(row => ({
        objection: row.objection,
        type: row.type,
        count: parseInt(row.count),
      })),
      buyingSignals: buyingSignalsResult.rows.map(row => ({
        signal: row.signal,
        strength: row.strength,
        count: parseInt(row.count),
      })),
      channelPerformance: channelResult.rows.map(row => ({
        channel: row.channel,
        totalReplies: parseInt(row.total_replies),
        positiveReplies: parseInt(row.positive),
        hotLeads: parseInt(row.hot_leads),
        avgLeadScore: parseFloat(row.avg_lead_score) || 0,
      })),
    });
  } catch (error) {
    console.error('[CampaignReplyStats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reply stats' },
      { status: 500 }
    );
  }
}
