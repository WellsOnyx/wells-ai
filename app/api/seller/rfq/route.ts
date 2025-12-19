/**
 * Seller RFQ API
 * Reactive selling - manage RFQ matches and quotes
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSellerProfileByUserId } from '@/lib/seller/profile-service';
import {
  getMatchedRFQs,
  getRFQMatch,
  markRFQViewed,
  declineRFQ,
  generateQuoteSuggestion,
  submitQuote,
  adjustQuoteDraft,
  parseQuoteAdjustmentsFromText,
} from '@/lib/seller/rfq-response-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getSellerProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    const matches = await getMatchedRFQs(profile.id, status);

    // Generate conversational summary
    const pending = matches.filter((m) => m.status === 'pending');
    const quoted = matches.filter((m) => m.status === 'quoted');

    let summary = '';
    if (pending.length > 0) {
      summary = `You have ${pending.length} new RFQ${pending.length > 1 ? 's' : ''} to review. `;
      const topRfq = pending[0];
      summary += `The most recent is for ${topRfq.rfq?.category} - ${topRfq.rfq?.quantity} units. Want me to help you quote it?`;
    } else if (quoted.length > 0) {
      summary = `No new RFQs right now. You have ${quoted.length} pending quote${quoted.length > 1 ? 's' : ''} waiting for buyer response.`;
    } else {
      summary = "No RFQs in your queue right now. I'll let you know when matching opportunities come in. Want to focus on proactive outreach instead?";
    }

    return NextResponse.json({
      success: true,
      matches,
      summary,
      stats: {
        pending: pending.length,
        quoted: quoted.length,
        total: matches.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching RFQ matches:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch RFQs' },
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

    const profile = await getSellerProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, matchId, draftId, text, reason } = body;

    switch (action) {
      case 'view': {
        if (!matchId) {
          return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }
        await markRFQViewed(matchId);
        const match = await getRFQMatch(matchId);

        return NextResponse.json({
          success: true,
          match,
          message: `This is a request for ${match?.rfq?.quantity} units of ${match?.rfq?.category}. ${match?.rfq?.description}. ${match?.rfq?.targetPrice ? `They have a target budget of $${match.rfq.targetPrice.toLocaleString()}.` : ''} Want me to suggest a quote?`,
        });
      }

      case 'generate_quote': {
        if (!matchId) {
          return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }

        const { draft, explanation, competitiveInsight } = await generateQuoteSuggestion(
          profile.id,
          matchId
        );

        return NextResponse.json({
          success: true,
          draft,
          message: `Here's what I suggest:\n\n**Total: $${draft.totalPrice.toLocaleString()}** (${draft.leadTimeDays} day lead time)\n\n${explanation}\n\n${competitiveInsight}\n\nShould I submit this, or would you like to adjust anything?`,
        });
      }

      case 'adjust_quote': {
        if (!draftId) {
          return NextResponse.json({ error: 'draftId required' }, { status: 400 });
        }

        // Parse adjustments from natural language
        const adjustments = text ? parseQuoteAdjustmentsFromText(text) : body.adjustments;

        const updated = await adjustQuoteDraft(draftId, adjustments);

        return NextResponse.json({
          success: true,
          draft: updated,
          message: `Updated. New total: $${updated.totalPrice.toLocaleString()}, ${updated.leadTimeDays} day lead time, ${updated.paymentTerms}. Ready to submit?`,
        });
      }

      case 'submit_quote': {
        if (!draftId) {
          return NextResponse.json({ error: 'draftId required' }, { status: 400 });
        }

        const result = await submitQuote(profile.id, draftId);

        return NextResponse.json({
          success: true,
          quoteId: result.quoteId,
          message: result.message,
        });
      }

      case 'decline': {
        if (!matchId) {
          return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }

        await declineRFQ(matchId, reason || 'Not a fit');

        return NextResponse.json({
          success: true,
          message: "Got it, I've declined this RFQ. Moving on to the next one?",
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling RFQ action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
