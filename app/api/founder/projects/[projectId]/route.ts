/**
 * Founder Project Detail API
 * GET: Get project details with dashboard
 * PATCH: Update project
 * DELETE: Cancel/delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sqlQuery as sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type ProjectStatus = 'draft' | 'planning' | 'sourcing' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface ParsedProjectUpdate {
  name?: string;
  description?: string;
  category?: string;
  status?: ProjectStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  targetBudget?: number;
  targetLaunchDate?: string;
}

function parseUpdateFromText(text: string): ParsedProjectUpdate {
  const result: ParsedProjectUpdate = {};
  const lower = text.toLowerCase();

  // Status changes
  if (lower.includes('pause') || lower.includes('hold')) {
    result.status = 'on_hold';
  } else if (lower.includes('resume') || lower.includes('continue') || lower.includes('start')) {
    result.status = 'in_progress';
  } else if (lower.includes('complete') || lower.includes('done') || lower.includes('finish')) {
    result.status = 'completed';
  } else if (lower.includes('cancel')) {
    result.status = 'cancelled';
  } else if (lower.includes('sourcing') || lower.includes('source')) {
    result.status = 'sourcing';
  } else if (lower.includes('planning') || lower.includes('plan')) {
    result.status = 'planning';
  }

  // Priority changes
  if (lower.includes('urgent') || lower.includes('asap')) {
    result.priority = 'urgent';
  } else if (lower.includes('high priority')) {
    result.priority = 'high';
  } else if (lower.includes('low priority')) {
    result.priority = 'low';
  } else if (lower.includes('normal priority') || lower.includes('medium priority')) {
    result.priority = 'medium';
  }

  // Budget update
  const budgetMatch = text.match(/(?:budget|cost)\s*(?:to|:)?\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (budgetMatch) {
    result.targetBudget = parseFloat(budgetMatch[1].replace(/,/g, ''));
  }

  // Name update
  const renameMatch = text.match(/(?:rename|name)\s*(?:to|:)?\s*["\']?([^"\']+)["\']?/i);
  if (renameMatch) {
    result.name = renameMatch[1].trim();
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

    // Get project with all related data for dashboard
    const projectResult = await sql`
      SELECT * FROM founder_projects
      WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (projectResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "I couldn't find that project. It may have been deleted or you might not have access.",
      }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Get BOM summary
    const bomResult = await sql`
      SELECT
        COUNT(*) as item_count,
        SUM(unit_cost * quantity) as total_cost,
        COUNT(*) FILTER (WHERE status = 'sourced') as sourced_count,
        COUNT(*) FILTER (WHERE status = 'ordered') as ordered_count,
        COUNT(*) FILTER (WHERE status = 'received') as received_count
      FROM founder_project_bom
      WHERE project_id = ${projectId}
    `;
    const bomStats = bomResult.rows[0];

    // Get task summary
    const taskResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked
      FROM founder_project_tasks
      WHERE project_id = ${projectId}
    `;
    const taskStats = taskResult.rows[0];

    // Get milestone summary
    const milestoneResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        MIN(target_date) FILTER (WHERE status != 'completed') as next_milestone_date,
        (SELECT name FROM founder_project_milestones
         WHERE project_id = ${projectId} AND status != 'completed'
         ORDER BY target_date ASC LIMIT 1) as next_milestone_name
      FROM founder_project_milestones
      WHERE project_id = ${projectId}
    `;
    const milestoneStats = milestoneResult.rows[0];

    // Get financial summary
    const financialResult = await sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'budget'), 0) as total_budget,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as total_spent,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND category = 'materials'), 0) as materials_spent,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND category = 'labor'), 0) as labor_spent
      FROM founder_project_financials
      WHERE project_id = ${projectId}
    `;
    const financialStats = financialResult.rows[0];

    // Recent activity
    const activityResult = await sql`
      SELECT * FROM founder_project_activity
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const dashboard = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        priority: project.priority,
        targetBudget: project.target_budget ? parseFloat(project.target_budget) : null,
        targetLaunchDate: project.target_launch_date,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        metadata: project.metadata,
      },
      bom: {
        itemCount: parseInt(bomStats.item_count) || 0,
        totalCost: parseFloat(bomStats.total_cost) || 0,
        sourced: parseInt(bomStats.sourced_count) || 0,
        ordered: parseInt(bomStats.ordered_count) || 0,
        received: parseInt(bomStats.received_count) || 0,
      },
      tasks: {
        total: parseInt(taskStats.total) || 0,
        pending: parseInt(taskStats.pending) || 0,
        inProgress: parseInt(taskStats.in_progress) || 0,
        completed: parseInt(taskStats.completed) || 0,
        blocked: parseInt(taskStats.blocked) || 0,
        completionRate: parseInt(taskStats.total) > 0
          ? Math.round((parseInt(taskStats.completed) / parseInt(taskStats.total)) * 100)
          : 0,
      },
      milestones: {
        total: parseInt(milestoneStats.total) || 0,
        completed: parseInt(milestoneStats.completed) || 0,
        nextMilestone: milestoneStats.next_milestone_name ? {
          name: milestoneStats.next_milestone_name,
          targetDate: milestoneStats.next_milestone_date,
        } : null,
      },
      financials: {
        totalBudget: parseFloat(financialStats.total_budget) || 0,
        totalSpent: parseFloat(financialStats.total_spent) || 0,
        materialsSpent: parseFloat(financialStats.materials_spent) || 0,
        laborSpent: parseFloat(financialStats.labor_spent) || 0,
        remaining: (parseFloat(financialStats.total_budget) || 0) - (parseFloat(financialStats.total_spent) || 0),
        budgetUtilization: parseFloat(financialStats.total_budget) > 0
          ? Math.round((parseFloat(financialStats.total_spent) / parseFloat(financialStats.total_budget)) * 100)
          : 0,
      },
      recentActivity: activityResult.rows.map(a => ({
        id: a.id,
        type: a.type,
        description: a.description,
        createdAt: a.created_at,
        metadata: a.metadata,
      })),
    };

    // Generate conversational summary
    let message = `"${project.name}" - ${project.status}.`;

    if (dashboard.tasks.total > 0) {
      message += ` ${dashboard.tasks.completionRate}% of tasks complete.`;
    }

    if (dashboard.bom.itemCount > 0) {
      const bomProgress = dashboard.bom.itemCount > 0
        ? Math.round((dashboard.bom.received / dashboard.bom.itemCount) * 100)
        : 0;
      message += ` BOM: ${bomProgress}% received.`;
    }

    if (dashboard.financials.totalBudget > 0) {
      message += ` Budget: ${dashboard.financials.budgetUtilization}% used ($${dashboard.financials.remaining.toLocaleString()} remaining).`;
    }

    if (dashboard.milestones.nextMilestone) {
      message += ` Next milestone: "${dashboard.milestones.nextMilestone.name}".`;
    }

    return NextResponse.json({
      success: true,
      ...dashboard,
      message,
    });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { text, data } = body;

    // Verify ownership
    const existing = await sql`
      SELECT * FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "I couldn't find that project or you don't have access to it.",
      }, { status: 404 });
    }

    const oldProject = existing.rows[0];

    // Parse updates from text and merge with data
    let updates = data || {};
    if (text) {
      const parsed = parseUpdateFromText(text);
      updates = { ...parsed, ...updates };
    }

    // Build update object
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description');
      updateValues.push(updates.description);
    }
    if (updates.category !== undefined) {
      updateFields.push('category');
      updateValues.push(updates.category);
    }
    if (updates.status !== undefined) {
      updateFields.push('status');
      updateValues.push(updates.status);
    }
    if (updates.priority !== undefined) {
      updateFields.push('priority');
      updateValues.push(updates.priority);
    }
    if (updates.targetBudget !== undefined) {
      updateFields.push('target_budget');
      updateValues.push(updates.targetBudget);
    }
    if (updates.targetLaunchDate !== undefined) {
      updateFields.push('target_launch_date');
      updateValues.push(updates.targetLaunchDate ? new Date(updates.targetLaunchDate) : null);
    }
    if (updates.metadata !== undefined) {
      updateFields.push('metadata');
      updateValues.push(JSON.stringify(updates.metadata));
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        message: "What would you like to update? You can change the name, status, budget, priority, or other details.",
      });
    }

    // Execute update
    const result = await sql`
      UPDATE founder_projects
      SET
        name = COALESCE(${updates.name}, name),
        description = COALESCE(${updates.description}, description),
        category = COALESCE(${updates.category}, category),
        status = COALESCE(${updates.status}, status),
        priority = COALESCE(${updates.priority}, priority),
        target_budget = COALESCE(${updates.targetBudget}, target_budget),
        target_launch_date = COALESCE(${updates.targetLaunchDate ? new Date(updates.targetLaunchDate) : null}, target_launch_date),
        metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
        updated_at = NOW()
      WHERE id = ${projectId} AND user_id = ${userId}
      RETURNING *
    `;

    const project = result.rows[0];

    // Log activity
    const changes: string[] = [];
    if (updates.status && updates.status !== oldProject.status) {
      changes.push(`status changed to ${updates.status}`);
    }
    if (updates.priority && updates.priority !== oldProject.priority) {
      changes.push(`priority changed to ${updates.priority}`);
    }
    if (updates.name && updates.name !== oldProject.name) {
      changes.push(`renamed to "${updates.name}"`);
    }
    if (updates.targetBudget !== undefined && updates.targetBudget !== parseFloat(oldProject.target_budget || '0')) {
      changes.push(`budget updated to $${updates.targetBudget.toLocaleString()}`);
    }

    if (changes.length > 0) {
      await sql`
        INSERT INTO founder_project_activity (project_id, type, description, metadata, created_at)
        VALUES (${projectId}, 'update', ${changes.join(', ')}, ${JSON.stringify({ updates })}::jsonb, NOW())
      `;
    }

    // Generate conversational message
    let message: string;
    if (updates.status === 'on_hold') {
      message = `"${project.name}" is now on hold. Let me know when you're ready to resume.`;
    } else if (updates.status === 'completed') {
      message = `Congrats! "${project.name}" is now marked as complete.`;
    } else if (updates.status === 'cancelled') {
      message = `"${project.name}" has been cancelled. The project data is preserved if you need it later.`;
    } else if (updates.status === 'in_progress') {
      message = `"${project.name}" is now in progress. Let's get it done!`;
    } else if (changes.length > 0) {
      message = `Updated "${project.name}": ${changes.join(', ')}.`;
    } else {
      message = `"${project.name}" has been updated.`;
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        priority: project.priority,
        targetBudget: project.target_budget ? parseFloat(project.target_budget) : null,
        targetLaunchDate: project.target_launch_date,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
      changes,
      message,
    });
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const hard = searchParams.get('hard') === 'true';

    // Verify ownership
    const existing = await sql`
      SELECT * FROM founder_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "I couldn't find that project or you don't have access to it.",
      }, { status: 404 });
    }

    const project = existing.rows[0];

    if (hard) {
      // Hard delete - remove all related data
      await sql`DELETE FROM founder_project_activity WHERE project_id = ${projectId}`;
      await sql`DELETE FROM founder_project_financials WHERE project_id = ${projectId}`;
      await sql`DELETE FROM founder_project_milestones WHERE project_id = ${projectId}`;
      await sql`DELETE FROM founder_project_tasks WHERE project_id = ${projectId}`;
      await sql`DELETE FROM founder_project_bom WHERE project_id = ${projectId}`;
      await sql`DELETE FROM founder_projects WHERE id = ${projectId}`;

      return NextResponse.json({
        success: true,
        message: `"${project.name}" and all its data have been permanently deleted.`,
      });
    } else {
      // Soft delete - just cancel
      await sql`
        UPDATE founder_projects
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${projectId}
      `;

      await sql`
        INSERT INTO founder_project_activity (project_id, type, description, created_at)
        VALUES (${projectId}, 'cancelled', 'Project cancelled', NOW())
      `;

      return NextResponse.json({
        success: true,
        message: `"${project.name}" has been cancelled. You can still access the project data. Use ?hard=true to permanently delete.`,
      });
    }
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
