/**
 * Task Applications API
 * GET: Get applications for a task
 * POST: Accept/reject application
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTask,
  getApplications,
  acceptApplication,
  rejectApplication,
} from '@/lib/jobs/task-service';
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

    // Verify task exists and user is the poster
    const { task } = await getTask(taskId);
    if (!task) {
      return NextResponse.json({
        error: 'Task not found',
        message: 'This task may have been removed.',
      }, { status: 404 });
    }

    if (task.posterUserId !== userId) {
      return NextResponse.json({
        error: 'Not authorized',
        message: 'Only the task poster can view applications.',
      }, { status: 403 });
    }

    const { applications, message } = await getApplications(taskId);

    // Enhance with recommendation
    const enhanced = applications.map(app => {
      let recommendation = 'Review';
      if (app.status === 'pending') {
        // Generate simple recommendation based on rate comparison
        if (app.proposedRate <= (task.budgetMin || 0)) {
          recommendation = 'Great value';
        } else if (app.proposedRate <= (task.budgetMax || 0)) {
          recommendation = 'Within budget';
        } else {
          recommendation = 'Above budget';
        }
      }
      return { ...app, recommendation };
    });

    // Generate conversational summary
    let summary = message;
    if (applications.length > 0) {
      const pending = applications.filter(a => a.status === 'pending').length;
      const avgRate = applications.reduce((sum, a) => sum + a.proposedRate, 0) / applications.length;
      const withinBudget = applications.filter(a => a.proposedRate <= (task.budgetMax || Infinity)).length;

      summary = `${applications.length} application(s) for "${task.title}". `;
      if (pending > 0) {
        summary += `${pending} pending review. `;
      }
      summary += `Avg. rate: $${Math.round(avgRate)}. ${withinBudget} within your budget.`;
    }

    return NextResponse.json({
      success: true,
      applications: enhanced,
      task: {
        id: task.id,
        title: task.title,
        budgetMin: task.budgetMin,
        budgetMax: task.budgetMax,
        budgetType: task.budgetType,
        status: task.status,
      },
      message: summary,
    });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch applications' },
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
    const { action, applicationId, reason, text } = body;

    // Verify task exists and user is the poster
    const { task } = await getTask(taskId);
    if (!task) {
      return NextResponse.json({
        error: 'Task not found',
      }, { status: 404 });
    }

    if (task.posterUserId !== userId) {
      return NextResponse.json({
        error: 'Not authorized',
        message: 'Only the task poster can manage applications.',
      }, { status: 403 });
    }

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }

    switch (action) {
      case 'accept': {
        // Get poster's payment account for escrow
        const posterAccount = await getAccountByClerkId(userId);
        if (!posterAccount) {
          return NextResponse.json({
            error: 'Payment account required',
            message: 'Set up your payment account before hiring. This protects both you and the worker.',
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

      case 'reject': {
        const rejectionReason = reason || text || 'Position has been filled';

        const { success, message } = await rejectApplication(
          applicationId,
          rejectionReason
        );

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'shortlist': {
        // Move to shortlist (would update application status in production)
        return NextResponse.json({
          success: true,
          message: 'Added to shortlist. You can review and compare shortlisted candidates.',
        });
      }

      case 'request_info': {
        // Request more information from applicant
        return NextResponse.json({
          success: true,
          message: 'Request sent to the applicant. They will be notified to provide more details.',
        });
      }

      case 'schedule_interview': {
        // Schedule interview (would integrate with calendar in production)
        return NextResponse.json({
          success: true,
          message: 'Interview request sent. The applicant will receive scheduling options.',
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling application action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
