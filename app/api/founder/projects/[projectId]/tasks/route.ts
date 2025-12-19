/**
 * Founder Project Tasks API
 * GET: List project tasks
 * POST: Create task for project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface ParsedTask {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assignee?: string;
  category?: string;
  estimatedHours?: number;
}

function parseTaskFromText(text: string): ParsedTask {
  const result: ParsedTask = {};
  const lower = text.toLowerCase();

  // Priority
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical')) {
    result.priority = 'urgent';
  } else if (lower.includes('high priority') || lower.includes('important')) {
    result.priority = 'high';
  } else if (lower.includes('low priority') || lower.includes('whenever')) {
    result.priority = 'low';
  }

  // Due date patterns
  const datePatterns = [
    /(?:due|by|before|deadline)\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /(?:due|by|before|deadline)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /(today|tomorrow|next week|this week|end of week|eow|eod)/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.dueDate = match[1];
      break;
    }
  }

  // Estimated hours
  const hoursMatch = text.match(/(\d+)\s*(?:hours?|hrs?)/i);
  if (hoursMatch) {
    result.estimatedHours = parseInt(hoursMatch[1]);
  }

  // Assignee
  const assigneeMatch = text.match(/(?:assign(?:ed)?\s+(?:to)?|for)\s+@?(\w+)/i);
  if (assigneeMatch) {
    result.assignee = assigneeMatch[1];
  }

  // Category hints
  const categories = ['design', 'development', 'manufacturing', 'procurement', 'testing', 'documentation', 'review', 'planning'];
  for (const cat of categories) {
    if (lower.includes(cat)) {
      result.category = cat;
      break;
    }
  }

  // Clean text for title
  let cleanText = text
    .replace(/(?:due|by|before|deadline)\s+[\w\s,\/]+/gi, '')
    .replace(/(\d+)\s*(?:hours?|hrs?)/gi, '')
    .replace(/(?:assign(?:ed)?\s+(?:to)?|for)\s+@?\w+/gi, '')
    .replace(/(?:urgent|asap|critical|high priority|low priority|important)/gi, '')
    .trim();

  // First part is likely the title
  const parts = cleanText.split(/[.!?\n]/);
  if (parts[0] && parts[0].trim().length > 0) {
    result.title = parts[0].trim().slice(0, 200);
  }
  if (parts.length > 1) {
    result.description = parts.slice(1).join('. ').trim();
  }

  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as TaskStatus | null;
    const priority = searchParams.get('priority') as TaskPriority | null;
    const assignee = searchParams.get('assignee');

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    // Build query based on filters
    let result;
    if (status && priority) {
      result = await sql`
        SELECT * FROM founder_project_tasks
        WHERE project_id = ${projectId}
          AND status = ${status}
          AND priority = ${priority}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          due_date ASC NULLS LAST,
          created_at DESC
      `;
    } else if (status) {
      result = await sql`
        SELECT * FROM founder_project_tasks
        WHERE project_id = ${projectId} AND status = ${status}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          due_date ASC NULLS LAST,
          created_at DESC
      `;
    } else if (priority) {
      result = await sql`
        SELECT * FROM founder_project_tasks
        WHERE project_id = ${projectId} AND priority = ${priority}
        ORDER BY due_date ASC NULLS LAST, created_at DESC
      `;
    } else if (assignee) {
      result = await sql`
        SELECT * FROM founder_project_tasks
        WHERE project_id = ${projectId} AND assignee_id = ${assignee}
        ORDER BY
          CASE status
            WHEN 'in_progress' THEN 1
            WHEN 'pending' THEN 2
            WHEN 'blocked' THEN 3
            WHEN 'completed' THEN 4
            WHEN 'cancelled' THEN 5
          END,
          due_date ASC NULLS LAST
      `;
    } else {
      result = await sql`
        SELECT * FROM founder_project_tasks
        WHERE project_id = ${projectId}
        ORDER BY
          CASE status
            WHEN 'in_progress' THEN 1
            WHEN 'blocked' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'completed' THEN 4
            WHEN 'cancelled' THEN 5
          END,
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          due_date ASC NULLS LAST
      `;
    }

    const tasks = result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      category: row.category,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name,
      dueDate: row.due_date,
      estimatedHours: row.estimated_hours,
      actualHours: row.actual_hours,
      completedAt: row.completed_at,
      blockedReason: row.blocked_reason,
      parentTaskId: row.parent_task_id,
      milestoneId: row.milestone_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Calculate summary
    const summary = {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
      },
      byPriority: {
        urgent: tasks.filter(t => t.priority === 'urgent').length,
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      },
      overdue: tasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status)
      ).length,
      completionRate: tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : 0,
    };

    // Generate message
    let message: string;
    if (tasks.length === 0) {
      message = "No tasks yet. Tell me what needs to be done and I'll add it.";
    } else {
      const activeCount = summary.byStatus.inProgress + summary.byStatus.pending;
      message = `${tasks.length} tasks - ${summary.byStatus.completed} complete, ${activeCount} active.`;

      if (summary.byStatus.blocked > 0) {
        message += ` ${summary.byStatus.blocked} blocked.`;
      }
      if (summary.overdue > 0) {
        message += ` ${summary.overdue} overdue.`;
      }
      if (summary.byPriority.urgent > 0) {
        message += ` ${summary.byPriority.urgent} urgent.`;
      }
    }

    return NextResponse.json({
      success: true,
      tasks,
      summary,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const { action, text, data, tasks: bulkTasks } = body;

    // Verify project ownership
    const projectCheck = await sql`
      SELECT id, name FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Project not found or you don't have access.",
      }, { status: 404 });
    }

    const project = projectCheck.rows[0];

    switch (action) {
      case 'update_status': {
        // Quick status update
        const { taskId, status, blockedReason } = data || {};

        if (!taskId || !status) {
          return NextResponse.json({
            success: false,
            message: "Which task and what status?",
          });
        }

        const updateData: any = { status };
        if (status === 'completed') {
          updateData.completedAt = new Date();
        }
        if (status === 'blocked' && blockedReason) {
          updateData.blockedReason = blockedReason;
        }

        const result = await sql`
          UPDATE founder_project_tasks
          SET
            status = ${status},
            completed_at = ${status === 'completed' ? new Date() : null},
            blocked_reason = ${status === 'blocked' ? (blockedReason || null) : null},
            updated_at = NOW()
          WHERE id = ${taskId} AND project_id = ${projectId}
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Task not found.",
          }, { status: 404 });
        }

        const task = result.rows[0];
        let message = '';

        if (status === 'completed') {
          message = `Done! "${task.title}" marked complete.`;
        } else if (status === 'in_progress') {
          message = `"${task.title}" is now in progress. Good luck!`;
        } else if (status === 'blocked') {
          message = `"${task.title}" marked as blocked. ${blockedReason ? `Reason: ${blockedReason}` : 'What\'s blocking it?'}`;
        } else {
          message = `"${task.title}" status updated to ${status}.`;
        }

        return NextResponse.json({
          success: true,
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
          },
          message,
        });
      }

      case 'log_time': {
        // Log actual hours
        const { taskId, hours } = data || {};

        if (!taskId || !hours) {
          return NextResponse.json({
            success: false,
            message: "Which task and how many hours?",
          });
        }

        const result = await sql`
          UPDATE founder_project_tasks
          SET actual_hours = COALESCE(actual_hours, 0) + ${hours}, updated_at = NOW()
          WHERE id = ${taskId} AND project_id = ${projectId}
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Task not found.",
          }, { status: 404 });
        }

        const task = result.rows[0];

        return NextResponse.json({
          success: true,
          task: {
            id: task.id,
            title: task.title,
            actualHours: task.actual_hours,
            estimatedHours: task.estimated_hours,
          },
          message: `Logged ${hours}h on "${task.title}". Total: ${task.actual_hours}h${task.estimated_hours ? ` / ${task.estimated_hours}h estimated` : ''}.`,
        });
      }

      case 'create':
      default: {
        // Parse from text or use provided data
        let taskData = data || {};
        if (text) {
          const parsed = parseTaskFromText(text);
          taskData = { ...parsed, ...taskData };
        }

        // Handle bulk creation
        if (bulkTasks && Array.isArray(bulkTasks)) {
          const createdTasks = [];

          for (const t of bulkTasks) {
            if (!t.title) continue;

            const result = await sql`
              INSERT INTO founder_project_tasks (
                project_id,
                title,
                description,
                status,
                priority,
                category,
                assignee_id,
                assignee_name,
                due_date,
                estimated_hours,
                milestone_id,
                parent_task_id,
                created_at,
                updated_at
              ) VALUES (
                ${projectId},
                ${t.title},
                ${t.description || null},
                'pending',
                ${t.priority || 'medium'},
                ${t.category || null},
                ${t.assigneeId || null},
                ${t.assigneeName || null},
                ${t.dueDate ? new Date(t.dueDate) : null},
                ${t.estimatedHours || null},
                ${t.milestoneId || null},
                ${t.parentTaskId || null},
                NOW(),
                NOW()
              )
              RETURNING *
            `;

            createdTasks.push({
              id: result.rows[0].id,
              title: result.rows[0].title,
              status: result.rows[0].status,
              priority: result.rows[0].priority,
            });
          }

          return NextResponse.json({
            success: true,
            tasks: createdTasks,
            count: createdTasks.length,
            message: `Added ${createdTasks.length} tasks to "${project.name}".`,
          });
        }

        // Single task creation
        if (!taskData.title) {
          return NextResponse.json({
            success: false,
            message: "What's the task? Describe what needs to be done.",
          });
        }

        const result = await sql`
          INSERT INTO founder_project_tasks (
            project_id,
            title,
            description,
            status,
            priority,
            category,
            assignee_id,
            assignee_name,
            due_date,
            estimated_hours,
            milestone_id,
            parent_task_id,
            created_at,
            updated_at
          ) VALUES (
            ${projectId},
            ${taskData.title},
            ${taskData.description || null},
            'pending',
            ${taskData.priority || 'medium'},
            ${taskData.category || null},
            ${taskData.assigneeId || null},
            ${taskData.assigneeName || taskData.assignee || null},
            ${taskData.dueDate ? new Date(taskData.dueDate) : null},
            ${taskData.estimatedHours || null},
            ${taskData.milestoneId || null},
            ${taskData.parentTaskId || null},
            NOW(),
            NOW()
          )
          RETURNING *
        `;

        const task = result.rows[0];

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'task_create',
            ${`Added task: "${task.title}"`},
            ${JSON.stringify({ taskId: task.id })}::jsonb,
            NOW()
          )
        `;

        let message = `Added "${task.title}" to the task list.`;
        if (task.priority === 'urgent' || task.priority === 'high') {
          message += ` Marked as ${task.priority} priority.`;
        }
        if (task.due_date) {
          message += ` Due: ${new Date(task.due_date).toLocaleDateString()}.`;
        }

        return NextResponse.json({
          success: true,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.due_date,
            estimatedHours: task.estimated_hours,
          },
          message,
        });
      }
    }
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}
