/**
 * Job Opportunities API
 * GET: Get matched opportunities for worker
 * POST: Actions like apply, withdraw
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import {
  getOpenTasks,
  applyToTask,
  getMyApplications,
  withdrawApplication,
  parseTaskFromText,
} from '@/lib/jobs/task-service';

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
        message: "Create a worker profile first to see matched opportunities.",
      }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'browse'; // browse, applied, matches

    if (view === 'applied') {
      // Get user's applications
      const { applications, message } = await getMyApplications(profile.id);

      return NextResponse.json({
        success: true,
        applications,
        message,
        view: 'applied',
      });
    }

    // Get matching open tasks
    const skills = profile.skills || [];
    const budgetMin = profile.hourlyRateMin;

    const { tasks, message } = await getOpenTasks({
      skills: skills.length > 0 ? skills : undefined,
      budgetMin,
      limit: 50,
    });

    // Calculate match scores for each task
    const scoredTasks = tasks.map(task => {
      const taskSkills = (task.skills || []).map(s => s.toLowerCase());
      const workerSkills = skills.map(s => s.toLowerCase());
      const matchedSkills = taskSkills.filter(s => workerSkills.includes(s));

      let matchScore = 50; // Base score
      if (taskSkills.length > 0) {
        matchScore += (matchedSkills.length / taskSkills.length) * 40;
      }

      // Rate compatibility bonus
      if (profile.preferredRate && task.budgetMax) {
        if (profile.preferredRate <= task.budgetMax) {
          matchScore += 10;
        }
      }

      return {
        ...task,
        matchScore: Math.min(100, Math.round(matchScore)),
        matchedSkills,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // Generate conversational summary
    const highMatches = scoredTasks.filter(t => t.matchScore >= 70);
    const avgBudget = scoredTasks.length > 0
      ? scoredTasks.reduce((sum, t) => sum + ((t.budgetMin || 0) + (t.budgetMax || 0)) / 2, 0) / scoredTasks.length
      : 0;

    let summary = '';
    if (scoredTasks.length === 0) {
      summary = "No matching opportunities right now. I'll keep looking based on your skills.";
    } else {
      summary = `Found ${scoredTasks.length} opportunities. `;
      if (highMatches.length > 0) {
        summary += `${highMatches.length} are strong matches (70%+). `;
        const top = highMatches[0];
        summary += `Top pick: "${top.title}" (${top.matchScore}% match, $${top.budgetMin || 0}-${top.budgetMax || 0}).`;
      } else {
        summary += `Average budget: ~$${Math.round(avgBudget)}.`;
      }
    }

    return NextResponse.json({
      success: true,
      tasks: scoredTasks,
      total: scoredTasks.length,
      highMatches: highMatches.length,
      message: summary,
      view: 'browse',
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
    const { action, taskId, applicationId, text, data } = body;

    switch (action) {
      case 'apply': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        // Parse application from natural language if provided
        let applicationData = {
          coverLetter: data?.coverLetter || '',
          proposedRate: data?.proposedRate || profile.preferredRate || 0,
          estimatedDuration: data?.estimatedDuration || 'To be discussed',
          portfolioLinks: data?.portfolioLinks,
        };

        if (text) {
          // Extract rate and duration from text
          const rateMatch = text.match(/\$?(\d+)\s*(?:\/|\s*per\s*)?(?:hr|hour)/i);
          if (rateMatch) {
            applicationData.proposedRate = parseInt(rateMatch[1]);
          }

          const durationMatch = text.match(/(\d+)\s*(?:day|week|hour|month)s?/i);
          if (durationMatch) {
            applicationData.estimatedDuration = durationMatch[0];
          }

          // Use text as cover letter if no explicit cover letter
          if (!data?.coverLetter) {
            applicationData.coverLetter = text;
          }
        }

        const { application, message } = await applyToTask(
          taskId,
          profile.id,
          applicationData
        );

        return NextResponse.json({
          success: !!application,
          application,
          message,
        });
      }

      case 'withdraw': {
        if (!applicationId) {
          return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
        }

        const { success, message } = await withdrawApplication(applicationId);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'search': {
        // Search with natural language
        let filters: any = {};

        if (text) {
          // Parse search intent from text
          const parsed = await parseTaskFromText(text);
          if (parsed.skills) filters.skills = parsed.skills;
          if (parsed.budgetMin) filters.budgetMin = parsed.budgetMin;
          if (parsed.budgetMax) filters.budgetMax = parsed.budgetMax;
        }

        if (data) {
          filters = { ...filters, ...data };
        }

        const { tasks, message } = await getOpenTasks(filters);

        return NextResponse.json({
          success: true,
          tasks,
          message,
          filters,
        });
      }

      case 'refresh_matches': {
        // Re-fetch and score opportunities
        const skills = profile.skills || [];
        const { tasks, message } = await getOpenTasks({
          skills: skills.length > 0 ? skills : undefined,
          limit: 50,
        });

        return NextResponse.json({
          success: true,
          tasks,
          message: `Refreshed. ${tasks.length} opportunities available.`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling opportunity action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
