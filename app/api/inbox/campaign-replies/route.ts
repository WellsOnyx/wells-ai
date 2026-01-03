/**
 * Campaign Replies API
 *
 * GET /api/inbox/campaign-replies - Get replies for campaigns
 * POST /api/inbox/campaign-replies - Process incoming message for campaign matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { replyMatcher, IncomingMessage, MatchResult } from '@/lib/inbox/reply-matcher';
import { replyAnalyzer, ReplyAnalysis } from '@/lib/inbox/reply-analyzer';
import { hotLeadNotifications, ReplyNotification } from '@/lib/inbox/hot-lead-notifications';

// =====================================================
// GET - Fetch campaign replies
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const campaignId = searchParams.get('campaignId');
    const status = searchParams.get('status');
    const sentiment = searchParams.get('sentiment');
    const intent = searchParams.get('intent');
    const isHotLead = searchParams.get('isHotLead');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Build query
    let query = `
      SELECT
        crm.id,
        crm.inbox_message_id,
        crm.inbox_thread_id,
        crm.campaign_id,
        crm.variant_id,
        crm.original_message_id,
        crm.contact_id,
        crm.match_method,
        crm.match_confidence,
        crm.channel,
        crm.reply_from,
        crm.reply_subject,
        crm.reply_body,
        crm.reply_received_at,
        crm.sentiment,
        crm.sentiment_score,
        crm.intent,
        crm.intent_confidence,
        crm.buying_signals,
        crm.objections,
        crm.key_phrases,
        crm.suggested_response,
        crm.is_hot_lead,
        crm.lead_score,
        crm.lead_score_reasons,
        crm.analysis_metadata,
        crm.notification_sent,
        crm.status,
        crm.created_at,
        oc.name AS campaign_name,
        cv.name AS variant_name,
        ct.first_name AS contact_first_name,
        ct.last_name AS contact_last_name,
        ct.company_name AS contact_company,
        ct.title AS contact_title,
        ct.email AS contact_email
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      LEFT JOIN campaign_variants cv ON crm.variant_id = cv.id
      LEFT JOIN outreach_contacts ct ON crm.contact_id = ct.id
      WHERE oc.user_id = $1 OR ct.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (campaignId) {
      query += ` AND crm.campaign_id = $${paramIndex}`;
      params.push(campaignId);
      paramIndex++;
    }

    if (status) {
      query += ` AND crm.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (sentiment) {
      query += ` AND crm.sentiment = $${paramIndex}`;
      params.push(sentiment);
      paramIndex++;
    }

    if (intent) {
      query += ` AND crm.intent = $${paramIndex}`;
      params.push(intent);
      paramIndex++;
    }

    if (isHotLead === 'true') {
      query += ` AND crm.is_hot_lead = true`;
    }

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) FROM (${query}) AS count_query`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add sorting and pagination
    query += ` ORDER BY crm.reply_received_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await sql.query(query, params);

    const replies = result.rows.map(row => ({
      id: row.id,
      inboxMessageId: row.inbox_message_id,
      inboxThreadId: row.inbox_thread_id,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      variantId: row.variant_id,
      variantName: row.variant_name,
      originalMessageId: row.original_message_id,
      contactId: row.contact_id,
      contact: row.contact_id ? {
        id: row.contact_id,
        name: `${row.contact_first_name || ''} ${row.contact_last_name || ''}`.trim(),
        company: row.contact_company,
        title: row.contact_title,
        email: row.contact_email,
      } : null,
      matchMethod: row.match_method,
      matchConfidence: parseFloat(row.match_confidence),
      channel: row.channel,
      replyFrom: row.reply_from,
      replySubject: row.reply_subject,
      replyBody: row.reply_body,
      replyReceivedAt: row.reply_received_at,
      analysis: row.sentiment ? {
        sentiment: row.sentiment,
        sentimentScore: parseFloat(row.sentiment_score || '0'),
        intent: row.intent,
        intentConfidence: parseFloat(row.intent_confidence || '0'),
        buyingSignals: row.buying_signals || [],
        objections: row.objections || [],
        keyPhrases: row.key_phrases || [],
        suggestedResponse: row.suggested_response,
        isHotLead: row.is_hot_lead,
        leadScore: row.lead_score,
        leadScoreReasons: row.lead_score_reasons || [],
        metadata: row.analysis_metadata || {},
      } : null,
      notificationSent: row.notification_sent,
      status: row.status,
      createdAt: row.created_at,
    }));

    // Get aggregate stats
    const statsResult = await sql`
      SELECT
        COUNT(*) as total_replies,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
        COUNT(*) FILTER (WHERE is_hot_lead = true) as hot_leads_count,
        COUNT(*) FILTER (WHERE intent = 'meeting_request') as meeting_requests,
        COUNT(*) FILTER (WHERE intent = 'interested') as interested_count,
        COUNT(*) FILTER (WHERE intent = 'question') as questions_count,
        AVG(lead_score) as avg_lead_score
      FROM campaign_reply_matches crm
      LEFT JOIN outreach_campaigns oc ON crm.campaign_id = oc.id
      WHERE (oc.user_id = ${userId} OR crm.contact_id IN (
        SELECT id FROM outreach_contacts WHERE user_id = ${userId}
      ))
      ${campaignId ? sql`AND crm.campaign_id = ${campaignId}` : sql``}
    `;

    const stats = statsResult.rows[0];

    return NextResponse.json({
      replies,
      total,
      hasMore: offset + limit < total,
      stats: {
        totalReplies: parseInt(stats.total_replies),
        positiveCount: parseInt(stats.positive_count),
        negativeCount: parseInt(stats.negative_count),
        neutralCount: parseInt(stats.neutral_count),
        hotLeadsCount: parseInt(stats.hot_leads_count),
        meetingRequests: parseInt(stats.meeting_requests),
        interestedCount: parseInt(stats.interested_count),
        questionsCount: parseInt(stats.questions_count),
        avgLeadScore: parseFloat(stats.avg_lead_score) || 0,
      },
    });
  } catch (error) {
    console.error('[CampaignReplies] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign replies' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Process incoming message for campaign matching
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messageId,
      threadId,
      channel,
      fromAddress,
      toAddress,
      subject,
      bodyText,
      bodyHtml,
      receivedAt,
      inReplyTo,
      references,
      externalMessageId,
      provider,
      userId, // For notification lookup
    } = body;

    if (!messageId || !channel || !fromAddress || !bodyText) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, channel, fromAddress, bodyText' },
        { status: 400 }
      );
    }

    // Build incoming message
    const incomingMessage: IncomingMessage = {
      id: messageId,
      threadId,
      channel,
      fromAddress,
      toAddress,
      subject,
      body: bodyText,
      bodyHtml,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      inReplyTo,
      references,
      messageId: externalMessageId,
      provider,
      externalId: externalMessageId,
    };

    // Step 1: Match to campaign
    const matchResult = await replyMatcher.matchReply(incomingMessage);

    if (!matchResult.matched) {
      return NextResponse.json({
        matched: false,
        message: 'No matching campaign found for this message',
      });
    }

    // Step 2: Get the stored match
    const match = await replyMatcher.getMatch(matchResult.metadata?.matchId || messageId);

    if (!match) {
      return NextResponse.json({
        matched: true,
        analyzed: false,
        message: 'Match stored but not found for analysis',
        matchResult,
      });
    }

    // Step 3: Analyze the reply
    let analysis: ReplyAnalysis | null = null;
    try {
      analysis = await replyAnalyzer.analyzeAndStore(match);
    } catch (analyzeError) {
      console.error('[CampaignReplies] Analysis error:', analyzeError);
    }

    // Step 4: Send notifications if hot lead
    let notificationResults = [];
    if (analysis?.isHotLead && userId) {
      const settings = await hotLeadNotifications.getSettings(userId);

      if (settings) {
        // Get contact info for notification
        let contactInfo: any = {};
        if (match.contactId) {
          const contactResult = await sql`
            SELECT first_name, last_name, company_name, title, email, phone
            FROM outreach_contacts WHERE id = ${match.contactId}
          `;
          if (contactResult.rows.length > 0) {
            const c = contactResult.rows[0];
            contactInfo = {
              contactName: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              contactEmail: c.email,
              contactPhone: c.phone,
              contactCompany: c.company_name,
              contactTitle: c.title,
            };
          }
        }

        // Get campaign info
        let campaignName;
        let variantName;
        if (match.campaignId) {
          const campaignResult = await sql`
            SELECT name FROM outreach_campaigns WHERE id = ${match.campaignId}
          `;
          if (campaignResult.rows.length > 0) {
            campaignName = campaignResult.rows[0].name;
          }
        }
        if (match.variantId) {
          const variantResult = await sql`
            SELECT name FROM campaign_variants WHERE id = ${match.variantId}
          `;
          if (variantResult.rows.length > 0) {
            variantName = variantResult.rows[0].name;
          }
        }

        const notification: ReplyNotification = {
          matchId: match.id,
          userId,
          campaignId: match.campaignId,
          campaignName,
          variantName,
          ...contactInfo,
          replyChannel: match.channel,
          replyPreview: match.replyBody.slice(0, 500),
          replyReceivedAt: match.replyReceivedAt,
          sentiment: analysis.sentiment,
          intent: analysis.intent,
          leadScore: analysis.leadScore,
          isHotLead: analysis.isHotLead,
          suggestedResponse: analysis.suggestedResponse,
          keyPhrases: analysis.keyPhrases,
        };

        notificationResults = await hotLeadNotifications.notifyHotLead(notification, settings);
      }
    }

    return NextResponse.json({
      matched: true,
      analyzed: !!analysis,
      matchId: match.id,
      matchMethod: matchResult.method,
      matchConfidence: matchResult.confidence,
      campaignId: match.campaignId,
      contactId: match.contactId,
      analysis: analysis ? {
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        leadScore: analysis.leadScore,
        isHotLead: analysis.isHotLead,
        suggestedResponse: analysis.suggestedResponse,
      } : null,
      notifications: notificationResults,
    });
  } catch (error) {
    console.error('[CampaignReplies] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
