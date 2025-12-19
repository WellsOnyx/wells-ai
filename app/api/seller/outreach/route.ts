/**
 * Seller Outreach API
 * AI-generated personalized outreach
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSellerProfileByUserId } from '@/lib/seller/profile-service';
import {
  generateOutreach,
  sendOutreach,
  getPendingOutreach,
  createCampaign,
  getCampaigns,
  startCampaign,
  pauseCampaign,
} from '@/lib/seller/gtm-engine';

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
    const type = searchParams.get('type') || 'pending';

    if (type === 'campaigns') {
      const campaigns = await getCampaigns(profile.id);

      const active = campaigns.filter((c) => c.status === 'active');
      let message = '';
      if (active.length > 0) {
        const stats = active.reduce(
          (acc, c) => ({
            sent: acc.sent + c.stats.totalSent,
            opened: acc.opened + c.stats.totalOpened,
            replied: acc.replied + c.stats.totalReplied,
          }),
          { sent: 0, opened: 0, replied: 0 }
        );
        message = `${active.length} active campaign${active.length > 1 ? 's' : ''}. Total: ${stats.sent} sent, ${stats.opened} opened, ${stats.replied} replied.`;
      } else {
        message = "No active campaigns. Want to set one up?";
      }

      return NextResponse.json({
        success: true,
        campaigns,
        message,
      });
    }

    // Default: pending outreach
    const pending = await getPendingOutreach(profile.id);

    let message = '';
    if (pending.length > 0) {
      message = `${pending.length} message${pending.length > 1 ? 's' : ''} ready to send. Want to review them?`;
    } else {
      message = "No pending outreach. Want me to draft some messages for your hot leads?";
    }

    return NextResponse.json({
      success: true,
      outreach: pending,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching outreach:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch outreach' },
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
    const { action, leadId, outreachId, campaignId, data } = body;

    switch (action) {
      case 'generate': {
        if (!leadId) {
          return NextResponse.json({ error: 'leadId required' }, { status: 400 });
        }

        const { outreach, preview } = await generateOutreach(profile.id, leadId, {
          channel: body.channel || 'email',
          tone: body.tone || 'friendly',
          focus: body.focus,
          campaignId,
        });

        return NextResponse.json({
          success: true,
          outreach,
          message: `Here's a draft:\n\n${preview}\n\nLooks good? I can send it or tweak it.`,
        });
      }

      case 'send': {
        if (!outreachId) {
          return NextResponse.json({ error: 'outreachId required' }, { status: 400 });
        }

        const sent = await sendOutreach(outreachId);

        return NextResponse.json({
          success: true,
          outreach: sent,
          message: `Sent! I'll track opens and replies for you.`,
        });
      }

      case 'send_all': {
        const pending = await getPendingOutreach(profile.id);

        if (pending.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No pending messages to send.',
          });
        }

        let sent = 0;
        for (const o of pending) {
          await sendOutreach(o.id);
          sent++;
        }

        return NextResponse.json({
          success: true,
          message: `Sent ${sent} message${sent > 1 ? 's' : ''}. I'll keep you posted on responses.`,
        });
      }

      // Campaign management
      case 'create_campaign': {
        const campaign = await createCampaign(profile.id, data || {});

        return NextResponse.json({
          success: true,
          campaign,
          message: `Created campaign "${campaign.name}". Add some steps and we can launch it.`,
        });
      }

      case 'start_campaign': {
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
        }

        const campaign = await startCampaign(campaignId);

        return NextResponse.json({
          success: true,
          campaign,
          message: `Campaign "${campaign.name}" is now live! I'll send up to ${campaign.dailySendLimit} messages per day.`,
        });
      }

      case 'pause_campaign': {
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
        }

        const campaign = await pauseCampaign(campaignId);

        return NextResponse.json({
          success: true,
          campaign,
          message: `Paused "${campaign.name}". Resume anytime.`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling outreach action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
