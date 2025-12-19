/**
 * Seller Pipeline API
 * Opportunity and deal tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSellerProfileByUserId } from '@/lib/seller/profile-service';
import {
  getOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  moveOpportunityStage,
  closeOpportunityWon,
  closeOpportunityLost,
  getPipelineStages,
  getPipelineSummary,
  logActivity,
  parseOpportunityFromText,
  parseStageActionFromText,
} from '@/lib/seller/pipeline-service';

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
    const type = searchParams.get('type') || 'opportunities';

    if (type === 'summary') {
      const summary = await getPipelineSummary(profile.id);

      let message = '';
      if (summary.totalValue > 0) {
        message = `Your pipeline: $${summary.totalValue.toLocaleString()} total value across ${summary.totalCount} opportunities. `;
        if (summary.byStage.length > 0) {
          const top = summary.byStage[0];
          message += `Most activity in ${top.stage}: ${top.count} deals worth $${top.value.toLocaleString()}. `;
        }
        message += `Weighted forecast: $${summary.weightedValue.toLocaleString()}. Want to focus on any particular stage?`;
      } else {
        message = "Your pipeline is empty. Want to discover some prospects or check your RFQ queue?";
      }

      return NextResponse.json({
        success: true,
        summary,
        message,
      });
    }

    if (type === 'stages') {
      const stages = await getPipelineStages(profile.id);

      return NextResponse.json({
        success: true,
        stages,
        message: `You have ${stages.length} pipeline stages: ${stages.map((s) => s.name).join(' → ')}.`,
      });
    }

    // Default: get opportunities
    const stageId = searchParams.get('stageId') || undefined;
    const opportunities = await getOpportunities(profile.id, { stageId });

    const openOpps = opportunities.filter((o) => o.status === 'open');
    const hotOpps = openOpps.filter((o) => (o.probability || 0) >= 70);

    let message = '';
    if (openOpps.length > 0) {
      message = `${openOpps.length} open opportunit${openOpps.length > 1 ? 'ies' : 'y'} in your pipeline. `;
      if (hotOpps.length > 0) {
        const topOpp = hotOpps[0];
        message += `${hotOpps.length} are high probability. Top one: ${topOpp.companyName} ($${topOpp.value?.toLocaleString() || 0}). Want to work on closing it?`;
      } else {
        message += 'Want me to help move any of these forward?';
      }
    } else {
      message = "No open opportunities right now. Want to convert some leads or check your RFQs?";
    }

    return NextResponse.json({
      success: true,
      opportunities,
      message,
      stats: {
        total: opportunities.length,
        open: openOpps.length,
        hot: hotOpps.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pipeline' },
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
    const { action, opportunityId, stageId, text, data } = body;

    switch (action) {
      case 'create': {
        // Parse from natural language if provided
        let oppData = data || {};
        if (text) {
          const parsed = parseOpportunityFromText(text);
          oppData = { ...oppData, ...parsed };
        }

        const opportunity = await createOpportunity(profile.id, oppData);

        return NextResponse.json({
          success: true,
          opportunity,
          message: `Created opportunity: ${opportunity.title} with ${opportunity.companyName}. $${opportunity.value?.toLocaleString() || 0} potential. I'll track it in your pipeline.`,
        });
      }

      case 'update': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        let oppData = data || {};
        if (text) {
          const parsed = parseOpportunityFromText(text);
          oppData = { ...oppData, ...parsed };
        }

        const opportunity = await updateOpportunity(opportunityId, oppData);

        return NextResponse.json({
          success: true,
          opportunity,
          message: `Updated ${opportunity.companyName}. ${opportunity.probability}% probability at $${opportunity.value?.toLocaleString() || 0}.`,
        });
      }

      case 'move_stage': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        // Parse stage from text if needed
        let targetStageId = stageId;
        if (text && !targetStageId) {
          const parsed = parseStageActionFromText(text);
          // In production, would look up stage by name
          targetStageId = parsed.stageName;
        }

        if (!targetStageId) {
          return NextResponse.json({ error: 'stageId or stage name required' }, { status: 400 });
        }

        const opportunity = await moveOpportunityStage(opportunityId, targetStageId);

        return NextResponse.json({
          success: true,
          opportunity,
          message: `Moved ${opportunity.companyName} forward. Keep the momentum going!`,
        });
      }

      case 'log_activity': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const activity = await logActivity(opportunityId, {
          type: body.activityType || 'note',
          notes: text || body.notes,
          data: data,
        });

        return NextResponse.json({
          success: true,
          activity,
          message: `Logged ${activity.type}. I'll remember this for context.`,
        });
      }

      case 'close_won': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const opportunity = await closeOpportunityWon(opportunityId, {
          dealValue: body.dealValue,
          notes: text || body.notes,
        });

        return NextResponse.json({
          success: true,
          opportunity,
          message: `Congrats! Closed ${opportunity.companyName} for $${opportunity.value?.toLocaleString() || 0}. Another win for the books!`,
        });
      }

      case 'close_lost': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const opportunity = await closeOpportunityLost(opportunityId, {
          lostReason: body.lostReason || text || 'Not specified',
          notes: body.notes,
        });

        return NextResponse.json({
          success: true,
          opportunity,
          message: `Marked ${opportunity.companyName} as lost. I'll add them to nurture for future opportunities.`,
        });
      }

      case 'parse_action': {
        // Parse action from natural language
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const parsed = parseStageActionFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling pipeline action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
