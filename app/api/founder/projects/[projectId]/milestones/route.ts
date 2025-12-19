/**
 * Founder Project Milestones API
 * GET: List milestones
 * POST: Create milestone
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'missed' | 'cancelled';

interface ParsedMilestone {
  name?: string;
  description?: string;
  targetDate?: string;
  budget?: number;
  deliverables?: string[];
}

function parseMilestoneFromText(text: string): ParsedMilestone {
  const result: ParsedMilestone = {};
  const lower = text.toLowerCase();

  // Date patterns
  const datePatterns = [
    /(?:by|before|target|due|deadline)\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /(?:by|before|target|due|deadline)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /(q[1-4]\s*\d{4})/i,
    /(end of (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.targetDate = match[1];
      break;
    }
  }

  // Budget
  const budgetMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:budget)?/i);
  if (budgetMatch) {
    result.budget = parseFloat(budgetMatch[1].replace(/,/g, ''));
  }

  // Deliverables (items after "deliverables:" or bullet points)
  const deliverablesMatch = text.match(/deliverables?:?\s*(.+)/i);
  if (deliverablesMatch) {
    result.deliverables = deliverablesMatch[1]
      .split(/[,;]/)
      .map(d => d.trim())
      .filter(d => d.length > 0);
  }

  // Clean text for name
  let cleanText = text
    .replace(/(?:by|before|target|due|deadline)\s+[\w\s,\/]+/gi, '')
    .replace(/\$[\d,]+(?:\.\d{2})?/g, '')
    .replace(/deliverables?:?\s*.+/gi, '')
    .trim();

  const parts = cleanText.split(/[.!?\n]/);
  if (parts[0] && parts[0].trim().length > 0) {
    result.name = parts[0].trim().slice(0, 100);
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
    const status = searchParams.get('status') as MilestoneStatus | null;

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

    // Get milestones with task counts
    let result;
    if (status) {
      result = await sql`
        SELECT
          m.*,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_tasks
        FROM founder_project_milestones m
        LEFT JOIN (
          SELECT milestone_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          WHERE milestone_id IS NOT NULL
          GROUP BY milestone_id
        ) t ON m.id = t.milestone_id
        WHERE m.project_id = ${projectId} AND m.status = ${status}
        ORDER BY m.target_date ASC NULLS LAST, m.created_at ASC
      `;
    } else {
      result = await sql`
        SELECT
          m.*,
          COALESCE(t.task_count, 0) as task_count,
          COALESCE(t.completed_tasks, 0) as completed_tasks
        FROM founder_project_milestones m
        LEFT JOIN (
          SELECT milestone_id, COUNT(*) as task_count,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
          FROM founder_project_tasks
          WHERE milestone_id IS NOT NULL
          GROUP BY milestone_id
        ) t ON m.id = t.milestone_id
        WHERE m.project_id = ${projectId}
        ORDER BY m.target_date ASC NULLS LAST, m.created_at ASC
      `;
    }

    const milestones = result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      status: row.status,
      targetDate: row.target_date,
      completedDate: row.completed_date,
      budget: row.budget ? parseFloat(row.budget) : null,
      actualSpend: row.actual_spend ? parseFloat(row.actual_spend) : null,
      deliverables: row.deliverables,
      tasks: {
        total: parseInt(row.task_count) || 0,
        completed: parseInt(row.completed_tasks) || 0,
        completionRate: parseInt(row.task_count) > 0
          ? Math.round((parseInt(row.completed_tasks) / parseInt(row.task_count)) * 100)
          : 0,
      },
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Calculate timeline summary
    const now = new Date();
    const upcoming = milestones.filter(m =>
      m.targetDate && new Date(m.targetDate) > now && m.status !== 'completed'
    );
    const overdue = milestones.filter(m =>
      m.targetDate && new Date(m.targetDate) < now && !['completed', 'cancelled'].includes(m.status)
    );
    const completed = milestones.filter(m => m.status === 'completed');

    const summary = {
      total: milestones.length,
      completed: completed.length,
      upcoming: upcoming.length,
      overdue: overdue.length,
      nextMilestone: upcoming.length > 0 ? {
        name: upcoming[0].name,
        targetDate: upcoming[0].targetDate,
        daysUntil: upcoming[0].targetDate
          ? Math.ceil((new Date(upcoming[0].targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      } : null,
    };

    // Generate message
    let message: string;
    if (milestones.length === 0) {
      message = "No milestones set yet. Add key dates to track your project timeline.";
    } else {
      message = `${milestones.length} milestones - ${completed.length} completed.`;

      if (overdue.length > 0) {
        message += ` ${overdue.length} overdue.`;
      }

      if (summary.nextMilestone) {
        message += ` Next: "${summary.nextMilestone.name}" in ${summary.nextMilestone.daysUntil} days.`;
      }
    }

    return NextResponse.json({
      success: true,
      milestones,
      summary,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch milestones' },
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
    const { action, text, data, milestoneId } = body;

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
      case 'complete': {
        // Mark milestone as completed
        if (!milestoneId && !data?.milestoneId) {
          return NextResponse.json({
            success: false,
            message: "Which milestone did you complete?",
          });
        }

        const result = await sql`
          UPDATE founder_project_milestones
          SET status = 'completed', completed_date = NOW(), updated_at = NOW()
          WHERE id = ${milestoneId || data.milestoneId} AND project_id = ${projectId}
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Milestone not found.",
          }, { status: 404 });
        }

        const milestone = result.rows[0];

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'milestone_complete',
            ${`Completed milestone: "${milestone.name}"`},
            ${JSON.stringify({ milestoneId: milestone.id })}::jsonb,
            NOW()
          )
        `;

        return NextResponse.json({
          success: true,
          milestone: {
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            completedDate: milestone.completed_date,
          },
          message: `Milestone "${milestone.name}" marked complete! Great progress.`,
        });
      }

      case 'update': {
        if (!milestoneId && !data?.milestoneId) {
          return NextResponse.json({
            success: false,
            message: "Which milestone do you want to update?",
          });
        }

        const updates = data || {};
        if (text) {
          const parsed = parseMilestoneFromText(text);
          Object.assign(updates, parsed);
        }

        const result = await sql`
          UPDATE founder_project_milestones
          SET
            name = COALESCE(${updates.name}, name),
            description = COALESCE(${updates.description}, description),
            target_date = COALESCE(${updates.targetDate ? new Date(updates.targetDate) : null}, target_date),
            budget = COALESCE(${updates.budget}, budget),
            status = COALESCE(${updates.status}, status),
            deliverables = COALESCE(${updates.deliverables ? JSON.stringify(updates.deliverables) : null}::jsonb, deliverables),
            updated_at = NOW()
          WHERE id = ${milestoneId || data.milestoneId} AND project_id = ${projectId}
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return NextResponse.json({
            success: false,
            message: "Milestone not found.",
          }, { status: 404 });
        }

        const milestone = result.rows[0];

        return NextResponse.json({
          success: true,
          milestone: {
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            targetDate: milestone.target_date,
          },
          message: `Updated "${milestone.name}".`,
        });
      }

      case 'create':
      default: {
        // Parse from text or use provided data
        let milestoneData = data || {};
        if (text) {
          const parsed = parseMilestoneFromText(text);
          milestoneData = { ...parsed, ...milestoneData };
        }

        if (!milestoneData.name) {
          return NextResponse.json({
            success: false,
            message: "What's the milestone? Give it a name and optional target date.",
            hint: "Example: 'Complete prototype by March 15'",
          });
        }

        // Create milestone
        const result = await sql`
          INSERT INTO founder_project_milestones (
            project_id,
            name,
            description,
            status,
            target_date,
            budget,
            deliverables,
            created_at,
            updated_at
          ) VALUES (
            ${projectId},
            ${milestoneData.name},
            ${milestoneData.description || null},
            'pending',
            ${milestoneData.targetDate ? new Date(milestoneData.targetDate) : null},
            ${milestoneData.budget || null},
            ${milestoneData.deliverables ? JSON.stringify(milestoneData.deliverables) : null}::jsonb,
            NOW(),
            NOW()
          )
          RETURNING *
        `;

        const milestone = result.rows[0];

        // Log activity
        await sql`
          INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
          VALUES (
            ${projectId},
            'milestone_create',
            ${`Added milestone: "${milestone.name}"`},
            ${JSON.stringify({ milestoneId: milestone.id })}::jsonb,
            NOW()
          )
        `;

        let message = `Added milestone "${milestone.name}" to "${project.name}".`;
        if (milestone.target_date) {
          const daysUntil = Math.ceil(
            (new Date(milestone.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          message += ` Target: ${new Date(milestone.target_date).toLocaleDateString()} (${daysUntil} days).`;
        }

        return NextResponse.json({
          success: true,
          milestone: {
            id: milestone.id,
            name: milestone.name,
            description: milestone.description,
            status: milestone.status,
            targetDate: milestone.target_date,
            budget: milestone.budget ? parseFloat(milestone.budget) : null,
            deliverables: milestone.deliverables,
          },
          message,
        });
      }
    }
  } catch (error: any) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create milestone' },
      { status: 500 }
    );
  }
}
