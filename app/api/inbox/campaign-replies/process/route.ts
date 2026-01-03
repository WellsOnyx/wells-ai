/**
 * Process Pending Campaign Replies
 *
 * POST /api/inbox/campaign-replies/process
 *
 * Batch process pending reply matches:
 * 1. Run AI analysis on unanalyzed replies
 * 2. Send notifications for hot leads
 * 3. Update campaign stats
 *
 * This endpoint can be called via cron job or manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { replyMatcher, CampaignReplyMatch } from '@/lib/inbox/reply-matcher';
import { replyAnalyzer, ReplyAnalysis } from '@/lib/inbox/reply-analyzer';
import { hotLeadNotifications, ReplyNotification, NotificationSettings } from '@/lib/inbox/hot-lead-notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 20, notifyHotLeads = true } = body;

    // Get pending matches
    const pendingMatches = await replyMatcher.getPendingMatches(limit);

    if (pendingMatches.length === 0) {
      return NextResponse.json({
        message: 'No pending replies to process',
        processed: 0,
        analyzed: 0,
        hotLeads: 0,
        notificationsSent: 0,
      });
    }

    let analyzed = 0;
    let hotLeads = 0;
    let notificationsSent = 0;
    const errors: string[] = [];

    for (const match of pendingMatches) {
      try {
        // Run AI analysis
        const analysis = await replyAnalyzer.analyzeAndStore(match);
        analyzed++;

        if (analysis.isHotLead) {
          hotLeads++;

          // Send notifications if enabled
          if (notifyHotLeads) {
            const notificationsResult = await sendHotLeadNotifications(match, analysis);
            notificationsSent += notificationsResult.sent;
          }
        }
      } catch (error) {
        console.error(`[ProcessReplies] Error processing match ${match.id}:`, error);
        errors.push(`${match.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update campaign aggregate stats
    await updateCampaignStats();

    return NextResponse.json({
      message: `Processed ${pendingMatches.length} pending replies`,
      processed: pendingMatches.length,
      analyzed,
      hotLeads,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[ProcessReplies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process pending replies' },
      { status: 500 }
    );
  }
}

/**
 * Send notifications for a hot lead
 */
async function sendHotLeadNotifications(
  match: CampaignReplyMatch,
  analysis: ReplyAnalysis
): Promise<{ sent: number }> {
  // Get the user ID from the campaign or contact
  let userId: string | null = null;

  if (match.campaignId) {
    const campaignResult = await sql`
      SELECT user_id FROM outreach_campaigns WHERE id = ${match.campaignId}
    `;
    if (campaignResult.rows.length > 0) {
      userId = campaignResult.rows[0].user_id;
    }
  }

  if (!userId && match.contactId) {
    const contactResult = await sql`
      SELECT user_id FROM outreach_contacts WHERE id = ${match.contactId}
    `;
    if (contactResult.rows.length > 0) {
      userId = contactResult.rows[0].user_id;
    }
  }

  if (!userId) {
    return { sent: 0 };
  }

  // Get notification settings
  const settings = await hotLeadNotifications.getSettings(userId);
  if (!settings) {
    return { sent: 0 };
  }

  // Get contact and campaign info
  let contactInfo: Partial<ReplyNotification> = {};
  if (match.contactId) {
    const contactResult = await sql`
      SELECT first_name, last_name, company_name, title, email, phone
      FROM outreach_contacts WHERE id = ${match.contactId}
    `;
    if (contactResult.rows.length > 0) {
      const c = contactResult.rows[0];
      contactInfo = {
        contactName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || undefined,
        contactEmail: c.email,
        contactPhone: c.phone,
        contactCompany: c.company_name,
        contactTitle: c.title,
      };
    }
  }

  let campaignName: string | undefined;
  let variantName: string | undefined;

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

  const results = await hotLeadNotifications.notifyHotLead(notification, settings);
  const sent = results.filter(r => r.success).length;

  return { sent };
}

/**
 * Update aggregate stats for all campaigns with new replies
 */
async function updateCampaignStats(): Promise<void> {
  // Get campaigns with recent replies that need stats update
  const campaignsResult = await sql`
    SELECT DISTINCT campaign_id
    FROM campaign_reply_matches
    WHERE campaign_id IS NOT NULL
      AND analyzed_at > NOW() - INTERVAL '1 hour'
  `;

  for (const row of campaignsResult.rows) {
    const campaignId = row.campaign_id;

    // Calculate stats
    const statsResult = await sql`
      SELECT
        COUNT(*) as total_replies,
        COUNT(DISTINCT contact_id) as unique_repliers,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_replies,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_replies,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_replies,
        COUNT(*) FILTER (WHERE intent = 'interested') as interested_replies,
        COUNT(*) FILTER (WHERE intent = 'not_interested') as not_interested_replies,
        COUNT(*) FILTER (WHERE intent = 'meeting_request') as meeting_request_replies,
        COUNT(*) FILTER (WHERE intent = 'question') as question_replies,
        COUNT(*) FILTER (WHERE intent = 'forward_request') as forward_request_replies,
        COUNT(*) FILTER (WHERE intent = 'unsubscribe') as unsubscribe_replies,
        COUNT(*) FILTER (WHERE intent = 'out_of_office') as out_of_office_replies,
        COUNT(*) FILTER (WHERE is_hot_lead = true) as hot_leads_generated,
        AVG(EXTRACT(EPOCH FROM (reply_received_at - created_at)) / 3600) as avg_reply_time_hours,
        EXTRACT(HOUR FROM reply_received_at) as reply_hour
      FROM campaign_reply_matches
      WHERE campaign_id = ${campaignId}
        AND status = 'analyzed'
      GROUP BY EXTRACT(HOUR FROM reply_received_at)
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `;

    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];

      // Upsert campaign reply stats
      await sql`
        INSERT INTO campaign_reply_stats (
          campaign_id,
          total_replies,
          unique_repliers,
          positive_replies,
          negative_replies,
          neutral_replies,
          interested_replies,
          not_interested_replies,
          meeting_request_replies,
          question_replies,
          forward_request_replies,
          unsubscribe_replies,
          out_of_office_replies,
          hot_leads_generated,
          avg_reply_time_hours,
          peak_reply_hour,
          last_analyzed_at
        ) VALUES (
          ${campaignId},
          ${stats.total_replies},
          ${stats.unique_repliers},
          ${stats.positive_replies},
          ${stats.negative_replies},
          ${stats.neutral_replies},
          ${stats.interested_replies},
          ${stats.not_interested_replies},
          ${stats.meeting_request_replies},
          ${stats.question_replies},
          ${stats.forward_request_replies},
          ${stats.unsubscribe_replies},
          ${stats.out_of_office_replies},
          ${stats.hot_leads_generated},
          ${stats.avg_reply_time_hours},
          ${stats.reply_hour},
          NOW()
        )
        ON CONFLICT (campaign_id) DO UPDATE SET
          total_replies = EXCLUDED.total_replies,
          unique_repliers = EXCLUDED.unique_repliers,
          positive_replies = EXCLUDED.positive_replies,
          negative_replies = EXCLUDED.negative_replies,
          neutral_replies = EXCLUDED.neutral_replies,
          interested_replies = EXCLUDED.interested_replies,
          not_interested_replies = EXCLUDED.not_interested_replies,
          meeting_request_replies = EXCLUDED.meeting_request_replies,
          question_replies = EXCLUDED.question_replies,
          forward_request_replies = EXCLUDED.forward_request_replies,
          unsubscribe_replies = EXCLUDED.unsubscribe_replies,
          out_of_office_replies = EXCLUDED.out_of_office_replies,
          hot_leads_generated = EXCLUDED.hot_leads_generated,
          avg_reply_time_hours = EXCLUDED.avg_reply_time_hours,
          peak_reply_hour = EXCLUDED.peak_reply_hour,
          last_analyzed_at = NOW(),
          updated_at = NOW()
      `;
    }
  }
}
