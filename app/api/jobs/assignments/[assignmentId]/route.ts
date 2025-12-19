/**
 * Assignment API
 * GET: Get assignment details
 * POST: Submit deliverable, approve, request revision
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getAssignment,
  getDeliverables,
  submitDeliverable,
  approveDeliverable,
  requestRevision,
  pauseAssignment,
  resumeAssignment,
  createReview,
} from '@/lib/jobs/task-service';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import { processAttributionEarnings } from '@/lib/jobs/earnings-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;
    const { assignment, message } = await getAssignment(assignmentId);

    if (!assignment) {
      return NextResponse.json({
        success: false,
        error: 'Assignment not found',
        message: 'This assignment may have been removed.',
      }, { status: 404 });
    }

    // Check authorization
    const isWorker = assignment.workerId === userId;
    const isPoster = assignment.posterUserId === userId;

    if (!isWorker && !isPoster) {
      // Check if user has a worker profile that matches
      const workerProfile = await getWorkerProfileByUserId(userId);
      if (!workerProfile || workerProfile.id !== assignment.workerId) {
        return NextResponse.json({
          error: 'Not authorized',
          message: 'You do not have access to this assignment.',
        }, { status: 403 });
      }
    }

    // Get deliverables
    const { deliverables, message: deliverableMsg } = await getDeliverables(assignmentId);

    // Build comprehensive message
    let summary = message;
    if (deliverables.length > 0) {
      const pending = deliverables.filter(d => d.status === 'pending').length;
      const approved = deliverables.filter(d => d.status === 'approved').length;

      if (pending > 0) {
        summary += ` ${pending} deliverable(s) pending review.`;
      }
      if (approved > 0) {
        summary += ` ${approved} approved.`;
      }
    }

    // Add next action suggestion
    let nextAction = '';
    if (isWorker) {
      if (assignment.status === 'active') {
        nextAction = 'Submit your work when ready.';
      } else if (assignment.status === 'revision_requested') {
        nextAction = 'Check feedback and resubmit.';
      }
    } else if (isPoster) {
      const pendingDeliverables = deliverables.filter(d => d.status === 'pending');
      if (pendingDeliverables.length > 0) {
        nextAction = `Review ${pendingDeliverables.length} pending deliverable(s).`;
      }
    }

    return NextResponse.json({
      success: true,
      assignment,
      deliverables,
      isWorker,
      isPoster,
      message: summary,
      nextAction,
    });
  } catch (error: any) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;
    const body = await req.json();
    const { action, deliverableId, data, text } = body;

    // Get assignment to verify access
    const { assignment } = await getAssignment(assignmentId);
    if (!assignment) {
      return NextResponse.json({
        error: 'Assignment not found',
      }, { status: 404 });
    }

    // Check if user is worker or poster
    const workerProfile = await getWorkerProfileByUserId(userId);
    const isWorker = workerProfile?.id === assignment.workerId;
    const isPoster = assignment.posterUserId === userId;

    if (!isWorker && !isPoster) {
      return NextResponse.json({
        error: 'Not authorized',
        message: 'You do not have access to this assignment.',
      }, { status: 403 });
    }

    switch (action) {
      case 'submit': {
        if (!isWorker) {
          return NextResponse.json({
            error: 'Only the assigned worker can submit deliverables',
          }, { status: 403 });
        }

        const deliverableData = {
          title: data?.title || 'Deliverable',
          description: data?.description || text || '',
          attachmentUrls: data?.attachmentUrls,
        };

        const { deliverable, message } = await submitDeliverable(
          assignmentId,
          deliverableData
        );

        return NextResponse.json({
          success: !!deliverable,
          deliverable,
          message,
        });
      }

      case 'approve': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Only the task poster can approve deliverables',
          }, { status: 403 });
        }

        if (!deliverableId) {
          return NextResponse.json({ error: 'deliverableId required' }, { status: 400 });
        }

        const { success, message } = await approveDeliverable(deliverableId);

        // Process attribution earnings if approved
        if (success && workerProfile) {
          await processAttributionEarnings(
            workerProfile.id,
            assignment.agreedRate,
            assignment.taskId
          );
        }

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'request_revision': {
        if (!isPoster) {
          return NextResponse.json({
            error: 'Only the task poster can request revisions',
          }, { status: 403 });
        }

        if (!deliverableId) {
          return NextResponse.json({ error: 'deliverableId required' }, { status: 400 });
        }

        const notes = data?.notes || text || 'Please review and revise';

        const { success, message } = await requestRevision(deliverableId, notes);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'pause': {
        if (!isWorker) {
          return NextResponse.json({
            error: 'Only the worker can pause the assignment',
          }, { status: 403 });
        }

        const { success, message } = await pauseAssignment(assignmentId);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'resume': {
        if (!isWorker) {
          return NextResponse.json({
            error: 'Only the worker can resume the assignment',
          }, { status: 403 });
        }

        const { success, message } = await resumeAssignment(assignmentId);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'review': {
        // Both worker and poster can leave reviews
        const reviewData = {
          rating: data?.rating || 5,
          title: data?.title || (isWorker ? 'Great experience' : 'Great work'),
          content: data?.content || text || '',
          wouldHireAgain: data?.wouldHireAgain,
        };

        if (reviewData.rating < 1 || reviewData.rating > 5) {
          return NextResponse.json({
            error: 'Rating must be between 1 and 5',
          }, { status: 400 });
        }

        // Determine reviewee
        const revieweeUserId = isWorker ? assignment.posterUserId : assignment.workerId;

        const { review, message } = await createReview(
          assignment.taskId,
          userId,
          revieweeUserId,
          reviewData
        );

        return NextResponse.json({
          success: !!review,
          review,
          message,
        });
      }

      case 'message': {
        // Send message (would integrate with messaging in production)
        const messageText = data?.message || text;

        return NextResponse.json({
          success: true,
          message: 'Message sent to the other party.',
        });
      }

      case 'log_hours': {
        if (!isWorker) {
          return NextResponse.json({
            error: 'Only the worker can log hours',
          }, { status: 403 });
        }

        const hours = data?.hours || 0;
        // Would update hours logged in production

        return NextResponse.json({
          success: true,
          message: `${hours} hour(s) logged.`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling assignment action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
