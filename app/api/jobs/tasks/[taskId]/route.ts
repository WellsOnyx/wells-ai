/**
 * Single Task API
 * GET: Get task details
 * POST: Actions (assign, cancel, update status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTask,
  updateTask,
  cancelTask,
  acceptApplication,
} from '@/lib/jobs/task-service';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import { getAccountByClerkId } from '@/lib/wells-payments';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const { task, message } = await getTask(taskId);

    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task not found',
        message: 'This task may have been removed or is no longer available.',
      }, { status: 404 });
    }

    // Check if user is the poster
    const isPoster = task.posterUserId === userId;

    // Get worker profile if exists (for match scoring)
    const workerProfile = await getWorkerProfileByUserId(userId);
    let matchScore = null;
    let matchReasons: string[] = [];

    if (workerProfile && !isPoster) {
      // Calculate match score
      const taskSkills = (task.skills || []).map(s => s.toLowerCase());
      const workerSkills = (workerProfile.skills || []).map(s => s.toLowerCase());
      const matchedSkills = taskSkills.filter(s => workerSkills.includes(s));

      let score = 50;
      if (taskSkills.length > 0) {
        score += (matchedSkills.length / taskSkills.length) * 35;
        if (matchedSkills.length > 0) {
          matchReasons.push(`Matches ${matchedSkills.length} skills: ${matchedSkills.join(', ')}`);
        }
      }

      // Experience match
      if (workerProfile.experienceYears) {
        score += 10;
        matchReasons.push(`${workerProfile.experienceYears}+ years experience`);
      }

      // Rate compatibility
      if (workerProfile.preferredRate && task.budgetMax) {
        if (workerProfile.preferredRate <= task.budgetMax) {
          score += 5;
          matchReasons.push('Rate within budget');
        }
      }

      matchScore = Math.min(100, Math.round(score));
    }

    // Build detailed message
    let detailedMessage = message;
    if (matchScore !== null) {
      detailedMessage += ` Your match score: ${matchScore}%.`;
      if (matchReasons.length > 0) {
        detailedMessage += ` (${matchReasons.join(', ')})`;
      }
    }

    return NextResponse.json({
      success: true,
      task,
      isPoster,
      matchScore,
      matchReasons,
      message: detailedMessage,
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await req.json();
    const { action, applicationId, data, text } = body;

    // Get task to verify ownership for certain actions
    const { task } = await getTask(taskId);
    if (!task) {
      return NextResponse.json({
        error: 'Task not found',
        message: 'This task may have been removed.',
      }, { status: 404 });
    }

    const isPoster = task.posterUserId === userId;

    switch (action) {
      case 'assign': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Not authorized',
            message: 'Only the task poster can assign workers.',
          }, { status: 403 });
        }

        if (!applicationId) {
          return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
        }

        // Get poster's account for escrow
        const posterAccount = await getAccountByClerkId(userId);
        if (!posterAccount) {
          return NextResponse.json({
            error: 'Payment account required',
            message: 'Set up your payment account to hire workers.',
          }, { status: 400 });
        }

        const { assignment, message } = await acceptApplication(
          applicationId,
          posterAccount.id
        );

        return NextResponse.json({
          success: !!assignment,
          assignment,
          message,
        });
      }

      case 'cancel': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Not authorized',
            message: 'Only the task poster can cancel.',
          }, { status: 403 });
        }

        const reason = data?.reason || text || 'Cancelled by poster';
        const { success, message } = await cancelTask(taskId, reason);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'close': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Not authorized',
          }, { status: 403 });
        }

        const { task: updatedTask, message } = await updateTask(taskId, {
          status: 'completed',
        });

        return NextResponse.json({
          success: !!updatedTask,
          task: updatedTask,
          message,
        });
      }

      case 'reopen': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Not authorized',
          }, { status: 403 });
        }

        if (task.status !== 'cancelled' && task.status !== 'completed') {
          return NextResponse.json({
            error: 'Task cannot be reopened',
            message: `Task is currently ${task.status}. Only cancelled or completed tasks can be reopened.`,
          }, { status: 400 });
        }

        const { task: updatedTask, message } = await updateTask(taskId, {
          status: 'open',
        });

        return NextResponse.json({
          success: !!updatedTask,
          task: updatedTask,
          message: `Task "${task.title}" is now open again for applications.`,
        });
      }

      case 'update': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Not authorized',
            message: 'Only the task poster can edit.',
          }, { status: 403 });
        }

        const { task: updatedTask, message } = await updateTask(taskId, data);

        return NextResponse.json({
          success: !!updatedTask,
          task: updatedTask,
          message,
        });
      }

      case 'increment_view': {
        // Track view (no auth required for this)
        // In production, would update view_count
        return NextResponse.json({
          success: true,
          message: 'View counted.',
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling task action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
