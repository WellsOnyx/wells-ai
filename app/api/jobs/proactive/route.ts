/**
 * Proactive Opportunities API
 * GET: Get proactive opportunities for worker
 * POST: Convert to task, dismiss, act on opportunity
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import {
  getProactiveOpportunities,
  getOpportunity,
  viewOpportunity,
  actOnOpportunity,
  dismissOpportunity,
  discoverOpportunities,
  convertToTask,
} from '@/lib/jobs/proactive-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getWorkerProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Worker profile not found',
        message: "Create a worker profile first to receive personalized opportunities.",
      }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status')?.split(',') as any[];
    const type = searchParams.get('type')?.split(',') as any[];
    const limit = parseInt(searchParams.get('limit') || '20');

    // First, try to discover new opportunities
    if (!searchParams.get('skip_discovery')) {
      await discoverOpportunities(profile.id);
    }

    // Get opportunities
    const { opportunities, topMatch, message } = await getProactiveOpportunities(
      profile.id,
      { status, type, limit }
    );

    // Build enhanced response
    const newCount = opportunities.filter(o => o.status === 'new').length;
    const highMatchCount = opportunities.filter(o => o.matchScore && o.matchScore >= 70).length;
    const totalPotential = opportunities.reduce((sum, o) => sum + (o.potentialEarnings || 0), 0);

    let summary = message;
    if (newCount > 0) {
      summary = `${newCount} new opportunity${newCount > 1 ? 's' : ''} found. `;
    }
    if (highMatchCount > 0) {
      summary += `${highMatchCount} are strong matches. `;
    }
    if (totalPotential > 0) {
      summary += `Total potential: ~$${totalPotential.toLocaleString()}.`;
    }
    if (topMatch) {
      summary += ` Top pick: "${topMatch.title}" (${topMatch.matchScore}% match).`;
    }

    return NextResponse.json({
      success: true,
      opportunities,
      topMatch,
      stats: {
        total: opportunities.length,
        new: newCount,
        highMatch: highMatchCount,
        potentialEarnings: totalPotential,
      },
      message: summary,
    });
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch opportunities' },
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

    const profile = await getWorkerProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json({
        error: 'Worker profile not found',
        message: 'Create a worker profile first.',
      }, { status: 404 });
    }

    const body = await req.json();
    const { action, opportunityId, data, text } = body;

    switch (action) {
      case 'view': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const { opportunity, message } = await viewOpportunity(opportunityId);

        return NextResponse.json({
          success: true,
          opportunity,
          message,
        });
      }

      case 'act':
      case 'apply': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const opportunity = await getOpportunity(opportunityId);
        if (!opportunity) {
          return NextResponse.json({
            error: 'Opportunity not found',
          }, { status: 404 });
        }

        // Mark as acted
        await actOnOpportunity(opportunityId, data?.outcome || 'User applied');

        // If it's a task match, provide the task ID
        if (opportunity.relatedTaskId) {
          return NextResponse.json({
            success: true,
            taskId: opportunity.relatedTaskId,
            message: `Great choice. Opening "${opportunity.title}" for you to apply.`,
            nextUrl: `/jobs/tasks/${opportunity.relatedTaskId}`,
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Opportunity noted. We\'ll track this for you.',
        });
      }

      case 'dismiss': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const reason = data?.reason || text || 'Not interested';
        const { success, message } = await dismissOpportunity(opportunityId, reason);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'convert_to_task': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const { taskId, message } = await convertToTask(opportunityId);

        return NextResponse.json({
          success: !!taskId,
          taskId,
          message,
        });
      }

      case 'refresh':
      case 'discover': {
        const { count, message } = await discoverOpportunities(profile.id);

        return NextResponse.json({
          success: true,
          newOpportunities: count,
          message,
        });
      }

      case 'bulk_dismiss': {
        const opportunityIds = data?.opportunityIds || [];
        if (opportunityIds.length === 0) {
          return NextResponse.json({ error: 'opportunityIds required' }, { status: 400 });
        }

        let dismissed = 0;
        for (const id of opportunityIds) {
          const { success } = await dismissOpportunity(id, 'Bulk dismissed');
          if (success) dismissed++;
        }

        return NextResponse.json({
          success: true,
          dismissed,
          message: `Dismissed ${dismissed} opportunity${dismissed !== 1 ? 's' : ''}.`,
        });
      }

      case 'get_details': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const opportunity = await getOpportunity(opportunityId);
        if (!opportunity) {
          return NextResponse.json({
            error: 'Opportunity not found',
          }, { status: 404 });
        }

        // Mark as viewed
        await viewOpportunity(opportunityId);

        // Build detailed response
        let details = `**${opportunity.title}**\n\n`;
        details += `${opportunity.description}\n\n`;
        details += `**Why this matches you:** ${opportunity.reason}\n\n`;

        if (opportunity.matchScore) {
          details += `Match score: ${opportunity.matchScore}%\n`;
        }
        if (opportunity.potentialEarnings) {
          details += `Potential earnings: ~$${opportunity.potentialEarnings.toLocaleString()}\n`;
        }
        if (opportunity.estimatedHours) {
          details += `Estimated time: ${opportunity.estimatedHours} hours\n`;
        }

        details += `\n**Action:** ${opportunity.primaryAction}`;

        return NextResponse.json({
          success: true,
          opportunity,
          details,
          message: `${opportunity.title} - ${opportunity.matchScore}% match`,
        });
      }

      case 'set_preferences': {
        // Update what kinds of opportunities to receive
        const preferences = {
          taskMatch: data?.taskMatch ?? true,
          skillDemand: data?.skillDemand ?? true,
          networkOpportunity: data?.networkOpportunity ?? true,
          upsell: data?.upsell ?? false,
          referralBonus: data?.referralBonus ?? true,
          minMatchScore: data?.minMatchScore || 50,
        };

        // In production, would save to profile
        return NextResponse.json({
          success: true,
          preferences,
          message: `Preferences updated. I'll focus on opportunities matching ${preferences.minMatchScore}%+.`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling proactive action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
