/**
 * Tasks API
 * GET: Get tasks (poster's tasks, open tasks, applications, assignments, deliverables)
 * POST: Create task, update task, apply, award, milestones, complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWorkerProfileByUserId } from '@/lib/jobs/worker-service';
import {
  createTask,
  updateTask,
  getTask,
  getTasksByPoster,
  getOpenTasks,
  parseTaskFromText,
  cancelTask,
  PosterType,
  applyToTask,
  getApplications,
  getMyApplications,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  getActiveAssignments,
  pauseAssignment,
  resumeAssignment,
  submitDeliverable,
  getDeliverables,
  approveDeliverable,
  requestRevision,
  rejectDeliverable,
  createReview,
  getReviews,
  TaskStatus,
} from '@/lib/jobs/task-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'my'; // my, open, applications, active_work, deliverables, reviews
    const status = searchParams.get('status') as TaskStatus | undefined;
    const taskId = searchParams.get('taskId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get single task by ID
    if (taskId) {
      const result = await getTask(taskId);
      return NextResponse.json({
        success: !!result.task,
        message: result.message,
        task: result.task,
      });
    }

    // Get worker profile for worker-specific views
    const workerProfile = await getWorkerProfileByUserId(userId);

    switch (view) {
      case 'open': {
        // Get open tasks (for workers browsing)
        const skills = searchParams.get('skills')?.split(',').filter(Boolean);
        const budgetMin = searchParams.get('budgetMin') ? parseFloat(searchParams.get('budgetMin')!) : undefined;
        const budgetMax = searchParams.get('budgetMax') ? parseFloat(searchParams.get('budgetMax')!) : undefined;

        const { tasks, message } = await getOpenTasks({
          skills,
          budgetMin,
          budgetMax,
          limit,
        });

        return NextResponse.json({
          success: true,
          tasks,
          total: tasks.length,
          message,
          view: 'open',
        });
      }

      case 'my': {
        // Get poster's own tasks
        const { tasks, message } = await getTasksByPoster(userId, {
          status,
          limit,
        });

        return NextResponse.json({
          success: true,
          tasks,
          total: tasks.length,
          message,
          view: 'my',
        });
      }

      case 'applications': {
        // Get applications for a task I posted OR my own applications
        const forTaskId = searchParams.get('forTaskId');

        if (forTaskId) {
          // Get applications for a specific task (poster view)
          const result = await getApplications(forTaskId);
          return NextResponse.json({
            success: true,
            message: result.message,
            applications: result.applications,
            count: result.applications.length,
          });
        }

        // Get my own applications (worker view)
        if (!workerProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You need a worker profile to view your applications.",
          });
        }

        const result = await getMyApplications(workerProfile.profile.id);
        return NextResponse.json({
          success: true,
          message: result.message,
          applications: result.applications,
          count: result.applications.length,
        });
      }

      case 'active_work': {
        // Get active assignments (for workers)
        if (!workerProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You need a worker profile to view active work.",
          });
        }

        const result = await getActiveAssignments(workerProfile.profile.id);
        return NextResponse.json({
          success: true,
          message: result.message,
          assignments: result.assignments,
          count: result.assignments.length,
        });
      }

      case 'deliverables': {
        // Get deliverables for an assignment
        const assignmentId = searchParams.get('assignmentId');
        if (!assignmentId) {
          return NextResponse.json({
            success: false,
            message: "Please specify an assignmentId to view deliverables.",
          });
        }

        const result = await getDeliverables(assignmentId);
        return NextResponse.json({
          success: true,
          message: result.message,
          deliverables: result.deliverables,
          count: result.deliverables.length,
        });
      }

      case 'reviews': {
        // Get reviews for a user
        const forUserId = searchParams.get('forUserId') || userId;
        const result = await getReviews(forUserId);
        return NextResponse.json({
          success: true,
          message: result.message,
          reviews: result.reviews,
          stats: result.stats,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown view. Try: my, open, applications, active_work, deliverables, reviews' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
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
    const { action, taskId, text, data } = body;

    // Get worker profile for worker actions
    const workerProfile = await getWorkerProfileByUserId(userId);

    switch (action) {
      // ========== APPLICATION WORKFLOW ==========

      case 'apply': {
        if (!workerProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You need a worker profile to apply for tasks. Want me to help you create one?",
          });
        }

        if (!taskId && !data?.taskId) {
          return NextResponse.json({
            success: false,
            message: "Which task would you like to apply to?",
          });
        }

        const result = await applyToTask(taskId || data.taskId, workerProfile.profile.id, {
          coverLetter: data?.coverLetter || text || '',
          proposedRate: data?.proposedRate || 0,
          estimatedDuration: data?.estimatedDuration || 'TBD',
          portfolioLinks: data?.portfolioLinks,
        });

        return NextResponse.json({
          success: !!result.application,
          message: result.message,
          application: result.application,
        });
      }

      case 'award': {
        // Accept an application (poster awards task to worker)
        if (!data?.applicationId) {
          return NextResponse.json({
            success: false,
            message: "Which application would you like to accept?",
          });
        }

        const posterAccountId = data.posterAccountId || userId;
        const result = await acceptApplication(data.applicationId, posterAccountId);

        return NextResponse.json({
          success: !!result.assignment,
          message: result.message,
          assignment: result.assignment,
        });
      }

      case 'reject_application': {
        if (!data?.applicationId) {
          return NextResponse.json({
            success: false,
            message: "Which application would you like to reject?",
          });
        }

        const result = await rejectApplication(
          data.applicationId,
          data.reason || 'Not selected'
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'withdraw_application': {
        if (!data?.applicationId) {
          return NextResponse.json({
            success: false,
            message: "Which application would you like to withdraw?",
          });
        }

        const result = await withdrawApplication(data.applicationId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      // ========== ASSIGNMENT WORKFLOW ==========

      case 'pause_assignment': {
        if (!data?.assignmentId) {
          return NextResponse.json({
            success: false,
            message: "Which assignment would you like to pause?",
          });
        }

        const result = await pauseAssignment(data.assignmentId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'resume_assignment': {
        if (!data?.assignmentId) {
          return NextResponse.json({
            success: false,
            message: "Which assignment would you like to resume?",
          });
        }

        const result = await resumeAssignment(data.assignmentId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      // ========== MILESTONE / DELIVERABLE WORKFLOW ==========

      case 'submit_milestone': {
        if (!data?.assignmentId) {
          return NextResponse.json({
            success: false,
            message: "Which assignment is this deliverable for?",
          });
        }

        const result = await submitDeliverable(data.assignmentId, {
          title: data.title || 'Deliverable',
          description: data.description || text || '',
          attachmentUrls: data.attachmentUrls,
        });

        return NextResponse.json({
          success: !!result.deliverable,
          message: result.message,
          deliverable: result.deliverable,
        });
      }

      case 'approve_milestone': {
        if (!data?.deliverableId) {
          return NextResponse.json({
            success: false,
            message: "Which deliverable would you like to approve?",
          });
        }

        const result = await approveDeliverable(data.deliverableId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'request_revision': {
        if (!data?.deliverableId) {
          return NextResponse.json({
            success: false,
            message: "Which deliverable needs revision?",
          });
        }

        const result = await requestRevision(
          data.deliverableId,
          data.notes || text || 'Please revise'
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'reject_deliverable': {
        if (!data?.deliverableId) {
          return NextResponse.json({
            success: false,
            message: "Which deliverable would you like to reject?",
          });
        }

        const result = await rejectDeliverable(
          data.deliverableId,
          data.reason || 'Does not meet requirements'
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      // ========== COMPLETE & REVIEW ==========

      case 'complete': {
        // Approve final deliverable (completes the task)
        if (!data?.deliverableId) {
          return NextResponse.json({
            success: false,
            message: "Which deliverable completes this task?",
          });
        }

        const result = await approveDeliverable(data.deliverableId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'review': {
        if (!data?.taskId || !data?.revieweeUserId) {
          return NextResponse.json({
            success: false,
            message: "Please provide taskId and revieweeUserId.",
          });
        }

        const result = await createReview(
          data.taskId,
          userId,
          data.revieweeUserId,
          {
            rating: data.rating || 5,
            title: data.title || 'Great work',
            content: data.content || text || '',
            wouldHireAgain: data.wouldHireAgain,
          }
        );

        return NextResponse.json({
          success: !!result.review,
          message: result.message,
          review: result.review,
        });
      }

      // ========== TASK MANAGEMENT ==========

      case 'create': {
        // Parse from natural language if provided
        let taskData = data || {};

        if (text) {
          const parsed = await parseTaskFromText(text);
          taskData = {
            ...taskData,
            title: taskData.title || parsed.title,
            description: taskData.description || parsed.description,
            skills: taskData.skills || parsed.skills,
            budgetMin: taskData.budgetMin || parsed.budgetMin,
            budgetMax: taskData.budgetMax || parsed.budgetMax,
            budgetType: taskData.budgetType || parsed.budgetType,
            estimatedHours: taskData.estimatedHours || parsed.estimatedHours,
          };
        }

        // Validate required fields
        const missing: string[] = [];
        if (!taskData.title) missing.push('title');
        if (!taskData.description) missing.push('description');
        if (!taskData.skills || taskData.skills.length === 0) missing.push('skills');
        if (!taskData.budgetMin && !taskData.budgetMax) missing.push('budget');

        if (missing.length > 0) {
          return NextResponse.json({
            success: false,
            error: `Missing required fields: ${missing.join(', ')}`,
            message: `I need more info to post this task. Missing: ${missing.join(', ')}. ${
              missing.includes('budget') ? "What's your budget?" :
              missing.includes('skills') ? "What skills are needed?" :
              "Can you provide more details?"
            }`,
            parsed: taskData,
          }, { status: 400 });
        }

        const posterType: PosterType = body.posterType || 'individual';

        const { task, message } = await createTask(userId, posterType, {
          title: taskData.title,
          description: taskData.description,
          skills: taskData.skills,
          budgetMin: taskData.budgetMin || taskData.budgetMax || 0,
          budgetMax: taskData.budgetMax || taskData.budgetMin || 0,
          budgetType: taskData.budgetType || 'fixed',
          estimatedHours: taskData.estimatedHours,
          deadline: taskData.deadline ? new Date(taskData.deadline) : undefined,
          status: taskData.status || 'open',
        });

        return NextResponse.json({
          success: true,
          task,
          message,
        });
      }

      case 'update': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        let updateData = data || {};

        if (text) {
          const parsed = await parseTaskFromText(text);
          updateData = { ...updateData, ...parsed };
        }

        const { task, message } = await updateTask(taskId, updateData);

        return NextResponse.json({
          success: !!task,
          task,
          message,
        });
      }

      case 'publish': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        const { task, message } = await updateTask(taskId, { status: 'open' });

        return NextResponse.json({
          success: !!task,
          task,
          message: task ? `Task "${task.title}" is now live and accepting applications.` : message,
        });
      }

      case 'close': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        const { task, message } = await updateTask(taskId, { status: 'completed' });

        return NextResponse.json({
          success: !!task,
          task,
          message,
        });
      }

      case 'cancel': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required' }, { status: 400 });
        }

        const reason = data?.reason || text || 'Cancelled by poster';
        const { success, message } = await cancelTask(taskId, reason);

        return NextResponse.json({
          success,
          message,
        });
      }

      case 'parse': {
        // Parse task from natural language without creating
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const parsed = await parseTaskFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
          message: parsed.message,
        });
      }

      case 'draft': {
        // Create as draft (not published)
        let taskData = data || {};

        if (text) {
          const parsed = await parseTaskFromText(text);
          taskData = { ...taskData, ...parsed };
        }

        const posterType: PosterType = body.posterType || 'individual';

        const { task, message } = await createTask(userId, posterType, {
          title: taskData.title || 'Untitled Task',
          description: taskData.description || '',
          skills: taskData.skills || [],
          budgetMin: taskData.budgetMin || 0,
          budgetMax: taskData.budgetMax || 0,
          budgetType: taskData.budgetType || 'negotiable',
          estimatedHours: taskData.estimatedHours,
          status: 'draft',
        });

        return NextResponse.json({
          success: true,
          task,
          message: `Draft saved. ${!taskData.skills?.length ? 'Add skills to help workers find it. ' : ''}${!taskData.budgetMin ? 'Set a budget when ready. ' : ''}Publish when complete.`,
        });
      }

      default:
        // Try to create task from text if no action specified
        if (text) {
          const parsed = await parseTaskFromText(text);

          if (parsed.title && parsed.skills && (parsed.budgetMin || parsed.budgetMax)) {
            // Has enough info to create
            const posterType: PosterType = body.posterType || 'individual';

            const { task, message } = await createTask(userId, posterType, {
              title: parsed.title,
              description: parsed.description || text,
              skills: parsed.skills,
              budgetMin: parsed.budgetMin || parsed.budgetMax || 0,
              budgetMax: parsed.budgetMax || parsed.budgetMin || 0,
              budgetType: parsed.budgetType || 'fixed',
              estimatedHours: parsed.estimatedHours,
              status: 'open',
            });

            return NextResponse.json({
              success: true,
              task,
              message,
            });
          } else {
            return NextResponse.json({
              success: false,
              parsed,
              message: parsed.message || "Tell me more about the task - what skills are needed and what's the budget?",
            });
          }
        }

        return NextResponse.json({
          error: 'Unknown action',
          available: [
            'create', 'update', 'publish', 'close', 'cancel', 'draft', 'parse',
            'apply', 'award', 'reject_application', 'withdraw_application',
            'pause_assignment', 'resume_assignment',
            'submit_milestone', 'approve_milestone', 'request_revision', 'reject_deliverable',
            'complete', 'review'
          ]
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling task action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
