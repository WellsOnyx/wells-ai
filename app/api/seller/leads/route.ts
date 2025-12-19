/**
 * Seller Leads API
 * Proactive GTM - lead discovery and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSellerProfileByUserId } from '@/lib/seller/profile-service';
import {
  discoverLeads,
  getLeads,
  qualifyLead,
  updateLeadStatus,
  getICPs,
  createICP,
  updateICP,
  parseICPFromText,
  parseLeadActionFromText,
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
    const status = searchParams.get('status');
    const minScore = searchParams.get('minScore');

    const leads = await getLeads(profile.id, {
      status: status as any,
      minScore: minScore ? parseInt(minScore) : undefined,
    });

    // Generate conversational summary
    const hotLeads = leads.filter((l) => l.leadScore >= 70);
    const newLeads = leads.filter((l) => l.status === 'new');

    let summary = '';
    if (newLeads.length > 0) {
      summary = `You have ${newLeads.length} new lead${newLeads.length > 1 ? 's' : ''} to review. `;
      if (hotLeads.length > 0) {
        summary += `${hotLeads.length} are hot prospects (score 70+). `;
        const topLead = hotLeads[0];
        summary += `Top one: ${topLead.contactName} at ${topLead.companyName} (${topLead.contactTitle}). Want to draft an outreach?`;
      }
    } else if (leads.length > 0) {
      summary = `${leads.length} leads in your pipeline. ${hotLeads.length} are hot. Want me to find more prospects or work on outreach?`;
    } else {
      summary = "Your lead queue is empty. Want me to discover some prospects matching your ideal customer profile?";
    }

    return NextResponse.json({
      success: true,
      leads,
      summary,
      stats: {
        total: leads.length,
        new: newLeads.length,
        hot: hotLeads.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
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
    const { action, leadId, icpId, text, data } = body;

    switch (action) {
      case 'discover': {
        const { leads, summary } = await discoverLeads(profile.id, {
          icpId,
          limit: body.limit || 20,
        });

        return NextResponse.json({
          success: true,
          leads,
          message: summary,
        });
      }

      case 'qualify': {
        if (!leadId) {
          return NextResponse.json({ error: 'leadId required' }, { status: 400 });
        }

        const lead = await qualifyLead(leadId, true);

        return NextResponse.json({
          success: true,
          lead,
          message: `${lead.companyName} is now qualified. Ready to reach out?`,
        });
      }

      case 'disqualify': {
        if (!leadId) {
          return NextResponse.json({ error: 'leadId required' }, { status: 400 });
        }

        const lead = await qualifyLead(leadId, false);

        return NextResponse.json({
          success: true,
          lead,
          message: `Moved to nurture. I'll keep them warm for later.`,
        });
      }

      case 'update_status': {
        if (!leadId || !body.status) {
          return NextResponse.json({ error: 'leadId and status required' }, { status: 400 });
        }

        const lead = await updateLeadStatus(leadId, body.status);

        return NextResponse.json({
          success: true,
          lead,
          message: `Updated ${lead.companyName} to ${lead.status}.`,
        });
      }

      case 'parse_action': {
        // Parse action from natural language
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const parsed = parseLeadActionFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
        });
      }

      // ICP Management
      case 'get_icps': {
        const icps = await getICPs(profile.id);

        let message = '';
        if (icps.length === 0) {
          message = "You don't have any ICPs defined yet. Tell me about your ideal customer and I'll set one up.";
        } else {
          message = `You have ${icps.length} ICP${icps.length > 1 ? 's' : ''}: ${icps.map((i) => i.name).join(', ')}. Which one should we focus on?`;
        }

        return NextResponse.json({
          success: true,
          icps,
          message,
        });
      }

      case 'create_icp': {
        // Parse from natural language if provided
        let icpData = data || {};
        if (text) {
          const parsed = parseICPFromText(text);
          icpData = { ...icpData, ...parsed };
        }

        const icp = await createICP(profile.id, icpData);

        return NextResponse.json({
          success: true,
          icp,
          message: `Created ICP: "${icp.name}". Targeting ${icp.industries?.join(', ') || 'various industries'}, ${icp.companySizes?.join(', ') || 'all sizes'}. Want me to find leads matching this profile?`,
        });
      }

      case 'update_icp': {
        if (!icpId) {
          return NextResponse.json({ error: 'icpId required' }, { status: 400 });
        }

        let icpData = data || {};
        if (text) {
          const parsed = parseICPFromText(text);
          icpData = { ...icpData, ...parsed };
        }

        const icp = await updateICP(icpId, icpData);

        return NextResponse.json({
          success: true,
          icp,
          message: `Updated "${icp.name}". Ready to discover leads with the new criteria?`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling lead action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
