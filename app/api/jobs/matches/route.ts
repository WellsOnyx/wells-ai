/**
 * Jobs Matches API
 * Proactive matching between workers and tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import {
  matchWorkersToTask,
  scanForOpportunities,
  getMatchesForTask,
  scoreMatch,
} from '@/lib/jobs/matching-engine';
import {
  getProactiveOpportunities,
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

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'opportunities'; // opportunities, for_task, for_worker
    const taskId = searchParams.get('taskId');
    const workerId = searchParams.get('workerId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : 50;
    const status = searchParams.get('status')?.split(',').filter(Boolean) as any[];
    const type = searchParams.get('type')?.split(',').filter(Boolean) as any[];

    // Get worker profile
    const workerProfile = await getWorkerProfileByUserId(userId);

    switch (view) {
      case 'opportunities': {
        // Get proactive opportunities for the current worker
        if (!workerProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You need a worker profile to see opportunities. Want me to help you create one?",
            suggestions: ["Create a worker profile", "Tell me about your skills"],
          });
        }

        const result = await getProactiveOpportunities(workerProfile.profile.id, {
          status,
          type,
          limit,
        });

        return NextResponse.json({
          success: true,
          message: result.message,
          opportunities: result.opportunities,
          topMatch: result.topMatch,
          count: result.opportunities.length,
        });
      }

      case 'for_task': {
        // Find matching workers for a task (poster view)
        if (!taskId) {
          return NextResponse.json({
            success: false,
            message: "Please provide a taskId to find matching workers.",
          });
        }

        const result = await matchWorkersToTask(taskId, { limit, minScore });

        return NextResponse.json({
          success: true,
          message: result.message,
          matches: result.matches,
          count: result.matches.length,
        });
      }

      case 'for_worker': {
        // Find matching tasks for a worker
        const targetWorkerId = workerId || workerProfile.profile?.id;

        if (!targetWorkerId) {
          return NextResponse.json({
            success: false,
            message: "No worker profile found. Create one to see matching tasks.",
          });
        }

        const result = await scanForOpportunities(targetWorkerId, {
          limit,
          minScore,
          includePosted: true,
          includeProactive: false,
        });

        return NextResponse.json({
          success: true,
          message: result.message,
          matches: result.matches,
          count: result.matches.length,
        });
      }

      case 'rank_workers': {
        // Rank specific workers for a task - use getMatchesForTask and filter
        if (!taskId) {
          return NextResponse.json({
            success: false,
            message: "Please provide a taskId.",
          });
        }

        const workerIds = searchParams.get('workerIds')?.split(',').filter(Boolean) || [];
        if (workerIds.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Please provide workerIds to rank.",
          });
        }

        // Get all matches for the task, then filter to requested workers
        const result = await getMatchesForTask(taskId, { limit: 100, minScore: 0 });
        const filteredWorkers = result.workers.filter(w => workerIds.includes(w.worker.id));
        const rankings = filteredWorkers
          .sort((a, b) => b.score.score - a.score.score)
          .map((w, index) => ({
            rank: index + 1,
            workerId: w.worker.id,
            workerName: w.worker.displayName,
            score: w.score.score,
            breakdown: w.score.breakdown,
            highlights: w.score.highlights,
            concerns: w.score.concerns,
          }));

        return NextResponse.json({
          success: true,
          message: rankings.length > 0
            ? `Ranked ${rankings.length} workers. Top: ${rankings[0].workerName} (${rankings[0].score}%)`
            : "No matching workers found for the provided IDs.",
          rankings,
        });
      }

      case 'rank_tasks': {
        // Rank specific tasks for a worker - use scanForOpportunities and filter
        const targetWorkerId = workerId || workerProfile.profile?.id;

        if (!targetWorkerId) {
          return NextResponse.json({
            success: false,
            message: "No worker profile found.",
          });
        }

        const taskIds = searchParams.get('taskIds')?.split(',').filter(Boolean) || [];
        if (taskIds.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Please provide taskIds to rank.",
          });
        }

        // Get all matches for the worker, then filter to requested tasks
        const result = await scanForOpportunities(targetWorkerId, {
          limit: 100,
          minScore: 0,
          includePosted: true,
          includeProactive: false,
        });
        const filteredTasks = result.matches.filter(m => m.task && taskIds.includes(m.task.id));
        const rankings = filteredTasks
          .sort((a, b) => b.score.score - a.score.score)
          .map((m, index) => ({
            rank: index + 1,
            taskId: m.task?.id,
            taskTitle: m.task?.title,
            score: m.score.score,
            breakdown: m.score.breakdown,
            highlights: m.score.highlights,
            concerns: m.score.concerns,
          }));

        return NextResponse.json({
          success: true,
          message: rankings.length > 0
            ? `Ranked ${rankings.length} tasks. Top: "${rankings[0].taskTitle}" (${rankings[0].score}%)`
            : "No matching tasks found for the provided IDs.",
          rankings,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown view. Try: opportunities, for_task, for_worker, rank_workers, rank_tasks' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch matches' },
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

    const body = await req.json();
    const { action, opportunityId, reason, ...data } = body;

    // Get worker profile
    const workerProfile = await getWorkerProfileByUserId(userId);

    switch (action) {
      case 'accept_match': {
        // View and act on an opportunity
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            message: "Which opportunity would you like to accept?",
          });
        }

        // First view it, then act on it
        const viewResult = await viewOpportunity(opportunityId);
        const actResult = await actOnOpportunity(opportunityId, data.outcome || 'Accepted by user');

        // If there's a related task, return info about it
        const convertResult = await convertToTask(opportunityId);

        return NextResponse.json({
          success: actResult.success,
          message: actResult.success
            ? `Great! ${convertResult.taskId ? `Opening task "${viewResult.opportunity.title}". Ready to apply?` : viewResult.opportunity.title}`
            : actResult.message,
          opportunity: viewResult.opportunity,
          taskId: convertResult.taskId,
        });
      }

      case 'dismiss_match': {
        // Dismiss an opportunity
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            message: "Which opportunity would you like to dismiss?",
          });
        }

        const result = await dismissOpportunity(opportunityId, reason);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'scan_opportunities': {
        // Trigger a scan for new opportunities
        if (!workerProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You need a worker profile to scan for opportunities.",
          });
        }

        const result = await discoverOpportunities(workerProfile.profile.id);

        return NextResponse.json({
          success: true,
          message: result.message,
          newOpportunities: result.count,
        });
      }

      case 'view_opportunity': {
        // Mark opportunity as viewed and get details
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            message: "Which opportunity would you like to view?",
          });
        }

        const result = await viewOpportunity(opportunityId);

        return NextResponse.json({
          success: true,
          message: result.message,
          opportunity: result.opportunity,
        });
      }

      case 'convert_to_task': {
        // Convert an opportunity to a task (for poster opportunities)
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            message: "Which opportunity would you like to convert?",
          });
        }

        const result = await convertToTask(opportunityId);

        return NextResponse.json({
          success: !!result.taskId,
          message: result.message,
          taskId: result.taskId,
        });
      }

      case 'find_workers': {
        // Find workers for a specific task
        if (!data.taskId) {
          return NextResponse.json({
            success: false,
            message: "Please provide a taskId to find matching workers.",
          });
        }

        const result = await matchWorkersToTask(data.taskId, {
          limit: data.limit || 10,
          minScore: data.minScore || 50,
        });

        return NextResponse.json({
          success: true,
          message: result.message,
          matches: result.matches,
        });
      }

      case 'find_tasks': {
        // Find tasks for current worker
        const targetWorkerId = data.workerId || workerProfile.profile?.id;

        if (!targetWorkerId) {
          return NextResponse.json({
            success: false,
            message: "No worker profile found.",
          });
        }

        const result = await scanForOpportunities(targetWorkerId, {
          limit: data.limit || 10,
          minScore: data.minScore || 50,
          includePosted: true,
          includeProactive: false,
        });

        return NextResponse.json({
          success: true,
          message: result.message,
          matches: result.matches,
        });
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          available: [
            'accept_match', 'dismiss_match', 'scan_opportunities',
            'view_opportunity', 'convert_to_task',
            'find_workers', 'find_tasks'
          ]
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling match action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
