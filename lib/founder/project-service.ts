/**
 * Founder Project Service - Wells AI
 *
 * Manages the full lifecycle of founder projects:
 * - Project CRUD operations
 * - Team member management
 * - Budget and timeline tracking
 * - Activity logging and audit trail
 * - Dashboard aggregation
 * - Natural language parsing
 *
 * All functions return conversational messages for AI-first UX.
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// =====================================================
// TYPES
// =====================================================

export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type MemberRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'member'
  | 'viewer';

export type EntityType =
  | 'project'
  | 'bom_item'
  | 'task'
  | 'milestone'
  | 'member'
  | 'budget'
  | 'timeline';

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  budget: number;
  budgetSpent: number;
  currency: string;
  startDate?: Date;
  endDate?: Date;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  addedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: EntityType;
  entityId?: string;
  changes?: Record<string, unknown>;
  createdAt: Date;
}

export interface BudgetStatus {
  total: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  currency: string;
  isOverBudget: boolean;
}

export interface TimelineStatus {
  startDate?: Date;
  endDate?: Date;
  daysTotal?: number;
  daysElapsed?: number;
  daysRemaining?: number;
  percentComplete?: number;
  isOnTrack: boolean;
  isOverdue: boolean;
}

export interface ProjectDashboard {
  project: Project;
  budget: BudgetStatus;
  timeline: TimelineStatus;
  bomStatus: {
    total: number;
    draft: number;
    pending: number;
    ordered: number;
    received: number;
    cancelled: number;
  };
  taskStatus: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  };
  milestoneProgress: {
    total: number;
    completed: number;
    upcoming: number;
    overdue: number;
  };
  recentActivity: ProjectActivity[];
  memberCount: number;
}

export interface ParsedProject {
  name?: string;
  description?: string;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  timeline?: string;
  confidence: number;
}

export interface ProjectFilters {
  status?: ProjectStatus | ProjectStatus[];
  limit?: number;
  offset?: number;
}

// =====================================================
// PROJECT CRUD
// =====================================================

/**
 * Create a new founder project
 */
export async function createProject(
  ownerId: string,
  data: {
    name: string;
    description?: string;
    budget: number;
    startDate?: Date;
    endDate?: Date;
    currency?: string;
  }
): Promise<{ success: boolean; project?: Project; message: string }> {
  const projectId = crypto.randomUUID();
  const currency = data.currency || 'USD';

  try {
    await sql`
      INSERT INTO founder_projects (
        id, owner_id, name, description,
        budget, budget_spent, currency,
        start_date, end_date, status,
        created_at, updated_at
      ) VALUES (
        ${projectId}, ${ownerId}, ${data.name}, ${data.description || null},
        ${data.budget}, 0, ${currency},
        ${data.startDate?.toISOString() || null}, ${data.endDate?.toISOString() || null}, 'draft',
        NOW(), NOW()
      )
    `;

    const project: Project = {
      id: projectId,
      ownerId,
      name: data.name,
      description: data.description,
      budget: data.budget,
      budgetSpent: 0,
      currency,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add owner as project member
    await sql`
      INSERT INTO founder_project_members (
        id, project_id, user_id, role, added_by, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${projectId}, ${ownerId}, 'owner', ${ownerId}, NOW(), NOW()
      )
    `;

    // Log activity
    await logActivity(projectId, ownerId, 'created', 'project', projectId);

    const budgetDisplay = `$${data.budget.toLocaleString()}`;
    let timelineNote = '';
    if (data.endDate) {
      const daysRemaining = Math.ceil((data.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      timelineNote = ` You have ${daysRemaining} days to complete it.`;
    }

    return {
      success: true,
      project,
      message: `Your project "${data.name}" has been created with a ${budgetDisplay} budget.${timelineNote} Ready to add team members and start planning?`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't create the project. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Get a project by ID with all details
 */
export async function getProject(
  projectId: string
): Promise<{ success: boolean; project?: Project; message: string }> {
  try {
    const result = await sql`
      SELECT * FROM founder_projects WHERE id = ${projectId}
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project. It may have been deleted or you don't have access.`,
      };
    }

    const project = mapRowToProject(result.rows[0]);
    const budgetRemaining = project.budget - project.budgetSpent;
    const percentUsed = project.budget > 0 ? Math.round((project.budgetSpent / project.budget) * 100) : 0;

    let statusNote = '';
    if (project.status === 'active') {
      statusNote = `Currently active with ${percentUsed}% of budget used.`;
    } else if (project.status === 'completed') {
      statusNote = 'This project has been completed.';
    } else if (project.status === 'on_hold') {
      statusNote = 'This project is currently on hold.';
    } else {
      statusNote = `Status: ${project.status}.`;
    }

    return {
      success: true,
      project,
      message: `"${project.name}" - ${statusNote} Budget: $${project.budgetSpent.toLocaleString()} spent of $${project.budget.toLocaleString()} ($${budgetRemaining.toLocaleString()} remaining).`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Something went wrong fetching the project. ${error.message || ''}`,
    };
  }
}

/**
 * Get all projects for an owner with optional filters
 */
export async function getProjectsByOwner(
  ownerId: string,
  filters?: ProjectFilters
): Promise<{ success: boolean; projects: Project[]; message: string }> {
  try {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let result;
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      result = await sql`
        SELECT * FROM founder_projects
        WHERE owner_id = ${ownerId} AND status = ANY(${statuses})
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT * FROM founder_projects
        WHERE owner_id = ${ownerId}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const projects = result.rows.map(mapRowToProject);

    if (projects.length === 0) {
      return {
        success: true,
        projects: [],
        message: filters?.status
          ? `You don't have any ${filters.status} projects yet. Want to create one?`
          : `You don't have any projects yet. Let's create your first one.`,
      };
    }

    const activeCount = projects.filter(p => p.status === 'active').length;
    const draftCount = projects.filter(p => p.status === 'draft').length;
    const completedCount = projects.filter(p => p.status === 'completed').length;
    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const totalSpent = projects.reduce((sum, p) => sum + p.budgetSpent, 0);

    return {
      success: true,
      projects,
      message: `You have ${projects.length} project(s): ${activeCount} active, ${draftCount} in draft, ${completedCount} completed. Total budget: $${totalBudget.toLocaleString()} with $${totalSpent.toLocaleString()} spent.`,
    };
  } catch (error: any) {
    return {
      success: false,
      projects: [],
      message: `I couldn't fetch your projects. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Update project details
 */
export async function updateProject(
  projectId: string,
  updates: Partial<{
    name: string;
    description: string;
    budget: number;
    startDate: Date;
    endDate: Date;
    currency: string;
  }>
): Promise<{ success: boolean; project?: Project; message: string }> {
  try {
    // Get current project first
    const existing = await sql`SELECT * FROM founder_projects WHERE id = ${projectId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project. It may have been deleted.`,
      };
    }

    const result = await sql`
      UPDATE founder_projects
      SET
        name = COALESCE(${updates.name || null}, name),
        description = COALESCE(${updates.description || null}, description),
        budget = COALESCE(${updates.budget || null}, budget),
        start_date = COALESCE(${updates.startDate?.toISOString() || null}, start_date),
        end_date = COALESCE(${updates.endDate?.toISOString() || null}, end_date),
        currency = COALESCE(${updates.currency || null}, currency),
        updated_at = NOW()
      WHERE id = ${projectId}
      RETURNING *
    `;

    const project = mapRowToProject(result.rows[0]);
    const changedFields = Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined);

    // Log the update
    await logActivity(projectId, project.ownerId, 'updated', 'project', projectId, updates);

    return {
      success: true,
      project,
      message: `Updated ${changedFields.join(', ')} for "${project.name}". Your changes have been saved.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't update the project. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Update project status with validation
 */
export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<{ success: boolean; project?: Project; message: string }> {
  try {
    // Get current project
    const existing = await sql`SELECT * FROM founder_projects WHERE id = ${projectId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project.`,
      };
    }

    const currentStatus = existing.rows[0].status as ProjectStatus;

    // Validate status transitions
    const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
      draft: ['planning', 'active', 'cancelled'],
      planning: ['active', 'on_hold', 'cancelled'],
      active: ['on_hold', 'completed', 'cancelled'],
      on_hold: ['active', 'cancelled'],
      completed: [], // Can't change from completed
      cancelled: [], // Can't change from cancelled
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return {
        success: false,
        message: `You can't change a ${currentStatus} project to ${status}. ${
          currentStatus === 'completed' ? 'Completed projects cannot be modified.' :
          currentStatus === 'cancelled' ? 'Cancelled projects cannot be reactivated.' :
          `Valid next statuses are: ${validTransitions[currentStatus].join(', ') || 'none'}.`
        }`,
      };
    }

    const result = await sql`
      UPDATE founder_projects
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${projectId}
      RETURNING *
    `;

    const project = mapRowToProject(result.rows[0]);

    // Log the status change
    await logActivity(projectId, project.ownerId, 'status_changed', 'project', projectId, {
      from: currentStatus,
      to: status,
    });

    const statusMessages: Record<ProjectStatus, string> = {
      draft: 'moved back to draft',
      planning: 'now in planning phase',
      active: 'now active - let\'s get to work',
      on_hold: 'on hold - I\'ll keep everything ready for when you resume',
      completed: 'marked as completed - nice work',
      cancelled: 'cancelled',
    };

    return {
      success: true,
      project,
      message: `"${project.name}" is ${statusMessages[status]}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't update the status. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Soft delete a project (set to cancelled)
 */
export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await sql`SELECT * FROM founder_projects WHERE id = ${projectId}`;
    if (existing.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project.`,
      };
    }

    const project = mapRowToProject(existing.rows[0]);

    if (project.status === 'cancelled') {
      return {
        success: false,
        message: `"${project.name}" is already cancelled.`,
      };
    }

    await sql`
      UPDATE founder_projects
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${projectId}
    `;

    await logActivity(projectId, project.ownerId, 'deleted', 'project', projectId);

    return {
      success: true,
      message: `"${project.name}" has been cancelled. All project data is preserved in case you need to reference it later.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't delete the project. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// TEAM MANAGEMENT
// =====================================================

/**
 * Add a team member to a project
 */
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: MemberRole
): Promise<{ success: boolean; member?: ProjectMember; message: string }> {
  try {
    // Check if project exists
    const projectResult = await sql`SELECT * FROM founder_projects WHERE id = ${projectId}`;
    if (projectResult.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project.`,
      };
    }

    const project = mapRowToProject(projectResult.rows[0]);

    // Check if user is already a member
    const existing = await sql`
      SELECT * FROM founder_project_members
      WHERE project_id = ${projectId} AND user_id = ${userId}
    `;
    if (existing.rows.length > 0) {
      return {
        success: false,
        message: `This person is already a member of "${project.name}".`,
      };
    }

    // Can't add another owner
    if (role === 'owner') {
      const ownerCheck = await sql`
        SELECT * FROM founder_project_members
        WHERE project_id = ${projectId} AND role = 'owner'
      `;
      if (ownerCheck.rows.length > 0) {
        return {
          success: false,
          message: `"${project.name}" already has an owner. You can add them as an admin instead.`,
        };
      }
    }

    const memberId = crypto.randomUUID();
    await sql`
      INSERT INTO founder_project_members (
        id, project_id, user_id, role, added_by, created_at, updated_at
      ) VALUES (
        ${memberId}, ${projectId}, ${userId}, ${role}, ${project.ownerId}, NOW(), NOW()
      )
    `;

    const member: ProjectMember = {
      id: memberId,
      projectId,
      userId,
      role,
      addedBy: project.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await logActivity(projectId, project.ownerId, 'member_added', 'member', memberId, { userId, role });

    const roleDescriptions: Record<MemberRole, string> = {
      owner: 'full control',
      admin: 'can manage everything except ownership',
      manager: 'can manage tasks and BOMs',
      member: 'can view and update assigned items',
      viewer: 'read-only access',
    };

    return {
      success: true,
      member,
      message: `Team member added to "${project.name}" as ${role} (${roleDescriptions[role]}). They'll be notified shortly.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't add the team member. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Remove a team member from a project
 */
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check member exists and isn't the owner
    const memberResult = await sql`
      SELECT m.*, p.name as project_name
      FROM founder_project_members m
      JOIN founder_projects p ON m.project_id = p.id
      WHERE m.project_id = ${projectId} AND m.user_id = ${userId}
    `;

    if (memberResult.rows.length === 0) {
      return {
        success: false,
        message: `That person isn't a member of this project.`,
      };
    }

    const member = memberResult.rows[0];
    if (member.role === 'owner') {
      return {
        success: false,
        message: `You can't remove the project owner. Transfer ownership first if you need to make this change.`,
      };
    }

    await sql`
      DELETE FROM founder_project_members
      WHERE project_id = ${projectId} AND user_id = ${userId}
    `;

    await logActivity(projectId, member.added_by, 'member_removed', 'member', member.id, { userId });

    return {
      success: true,
      message: `Team member removed from "${member.project_name}". Their access has been revoked.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't remove the team member. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Update a team member's role
 */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  newRole: MemberRole
): Promise<{ success: boolean; member?: ProjectMember; message: string }> {
  try {
    const memberResult = await sql`
      SELECT m.*, p.name as project_name, p.owner_id
      FROM founder_project_members m
      JOIN founder_projects p ON m.project_id = p.id
      WHERE m.project_id = ${projectId} AND m.user_id = ${userId}
    `;

    if (memberResult.rows.length === 0) {
      return {
        success: false,
        message: `That person isn't a member of this project.`,
      };
    }

    const currentMember = memberResult.rows[0];
    const oldRole = currentMember.role;

    if (oldRole === 'owner' && newRole !== 'owner') {
      return {
        success: false,
        message: `You can't demote the project owner. Transfer ownership first.`,
      };
    }

    if (newRole === 'owner' && oldRole !== 'owner') {
      return {
        success: false,
        message: `To transfer ownership, use the transfer ownership function instead.`,
      };
    }

    const result = await sql`
      UPDATE founder_project_members
      SET role = ${newRole}, updated_at = NOW()
      WHERE project_id = ${projectId} AND user_id = ${userId}
      RETURNING *
    `;

    const member = mapRowToMember(result.rows[0]);

    await logActivity(projectId, currentMember.owner_id, 'role_changed', 'member', member.id, {
      from: oldRole,
      to: newRole,
    });

    return {
      success: true,
      member,
      message: `Role updated from ${oldRole} to ${newRole} for "${currentMember.project_name}".`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't update the role. ${error.message || 'Please try again.'}`,
    };
  }
}

/**
 * Get all members of a project
 */
export async function getProjectMembers(
  projectId: string
): Promise<{ success: boolean; members: ProjectMember[]; message: string }> {
  try {
    const projectResult = await sql`SELECT name FROM founder_projects WHERE id = ${projectId}`;
    if (projectResult.rows.length === 0) {
      return {
        success: false,
        members: [],
        message: `I couldn't find that project.`,
      };
    }

    const projectName = projectResult.rows[0].name;

    const result = await sql`
      SELECT * FROM founder_project_members
      WHERE project_id = ${projectId}
      ORDER BY
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'manager' THEN 3
          WHEN 'member' THEN 4
          ELSE 5
        END
    `;

    const members = result.rows.map(mapRowToMember);

    if (members.length === 0) {
      return {
        success: true,
        members: [],
        message: `"${projectName}" has no team members yet. Add someone to get started.`,
      };
    }

    const roleCount = members.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const roleSummary = Object.entries(roleCount)
      .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
      .join(', ');

    return {
      success: true,
      members,
      message: `"${projectName}" has ${members.length} team member(s): ${roleSummary}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      members: [],
      message: `I couldn't fetch team members. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// PROJECT DASHBOARD
// =====================================================

/**
 * Get comprehensive project dashboard data
 */
export async function getProjectDashboard(
  projectId: string
): Promise<{ success: boolean; dashboard?: ProjectDashboard; message: string }> {
  try {
    // Get project
    const projectResult = await sql`SELECT * FROM founder_projects WHERE id = ${projectId}`;
    if (projectResult.rows.length === 0) {
      return {
        success: false,
        message: `I couldn't find that project.`,
      };
    }

    const project = mapRowToProject(projectResult.rows[0]);

    // Get budget status
    const budget = await calculateBudgetStatus(projectId);

    // Get timeline status
    const timeline = await calculateTimelineStatus(projectId);

    // Get BOM status counts
    const bomResult = await sql`
      SELECT status, COUNT(*) as count
      FROM founder_bom_items
      WHERE project_id = ${projectId}
      GROUP BY status
    `;
    const bomStatus = {
      total: 0,
      draft: 0,
      pending: 0,
      ordered: 0,
      received: 0,
      cancelled: 0,
    };
    for (const row of bomResult.rows) {
      const status = row.status as keyof typeof bomStatus;
      const count = parseInt(row.count);
      if (status in bomStatus) {
        bomStatus[status] = count;
      }
      bomStatus.total += count;
    }

    // Get task status counts
    const taskResult = await sql`
      SELECT status, COUNT(*) as count
      FROM founder_project_tasks
      WHERE project_id = ${projectId}
      GROUP BY status
    `;
    const taskStatus = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    };
    const taskStatusMap: Record<string, keyof typeof taskStatus> = {
      pending: 'pending',
      in_progress: 'inProgress',
      completed: 'completed',
      blocked: 'blocked',
    };
    for (const row of taskResult.rows) {
      const status = taskStatusMap[row.status] || 'pending';
      const count = parseInt(row.count);
      taskStatus[status] = count;
      taskStatus.total += count;
    }

    // Get milestone progress
    const milestoneResult = await sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status != 'completed' AND due_date > NOW() THEN 1 ELSE 0 END) as upcoming,
        SUM(CASE WHEN status != 'completed' AND due_date <= NOW() THEN 1 ELSE 0 END) as overdue
      FROM founder_project_milestones
      WHERE project_id = ${projectId}
    `;
    const milestoneRow = milestoneResult.rows[0] || {};
    const milestoneProgress = {
      total: parseInt(milestoneRow.total || '0'),
      completed: parseInt(milestoneRow.completed || '0'),
      upcoming: parseInt(milestoneRow.upcoming || '0'),
      overdue: parseInt(milestoneRow.overdue || '0'),
    };

    // Get recent activity
    const activityResult = await sql`
      SELECT * FROM founder_project_activity
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const recentActivity = activityResult.rows.map(mapRowToActivity);

    // Get member count
    const memberResult = await sql`
      SELECT COUNT(*) as count FROM founder_project_members WHERE project_id = ${projectId}
    `;
    const memberCount = parseInt(memberResult.rows[0]?.count || '0');

    const dashboard: ProjectDashboard = {
      project,
      budget,
      timeline,
      bomStatus,
      taskStatus,
      milestoneProgress,
      recentActivity,
      memberCount,
    };

    // Build summary message
    const summaryParts: string[] = [];

    // Budget summary
    if (budget.isOverBudget) {
      summaryParts.push(`Budget: Over by $${Math.abs(budget.remaining).toLocaleString()}`);
    } else {
      summaryParts.push(`Budget: ${budget.percentUsed}% used, $${budget.remaining.toLocaleString()} left`);
    }

    // Timeline summary
    if (timeline.isOverdue) {
      summaryParts.push(`Timeline: Overdue by ${Math.abs(timeline.daysRemaining || 0)} days`);
    } else if (timeline.daysRemaining) {
      summaryParts.push(`Timeline: ${timeline.daysRemaining} days remaining`);
    }

    // Task summary
    if (taskStatus.total > 0) {
      summaryParts.push(`Tasks: ${taskStatus.completed}/${taskStatus.total} done`);
    }

    // Milestone summary
    if (milestoneProgress.overdue > 0) {
      summaryParts.push(`${milestoneProgress.overdue} overdue milestone(s)`);
    }

    return {
      success: true,
      dashboard,
      message: `Dashboard for "${project.name}": ${summaryParts.join('. ')}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `I couldn't build the dashboard. ${error.message || 'Please try again.'}`,
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate budget status for a project
 */
export async function calculateBudgetStatus(projectId: string): Promise<BudgetStatus> {
  const result = await sql`
    SELECT budget, budget_spent, currency FROM founder_projects WHERE id = ${projectId}
  `;

  if (result.rows.length === 0) {
    return {
      total: 0,
      spent: 0,
      remaining: 0,
      percentUsed: 0,
      currency: 'USD',
      isOverBudget: false,
    };
  }

  const row = result.rows[0];
  const total = parseFloat(row.budget) || 0;
  const spent = parseFloat(row.budget_spent) || 0;
  const remaining = total - spent;
  const percentUsed = total > 0 ? Math.round((spent / total) * 100) : 0;

  return {
    total,
    spent,
    remaining,
    percentUsed,
    currency: row.currency || 'USD',
    isOverBudget: remaining < 0,
  };
}

/**
 * Calculate timeline status for a project
 */
export async function calculateTimelineStatus(projectId: string): Promise<TimelineStatus> {
  const result = await sql`
    SELECT start_date, end_date FROM founder_projects WHERE id = ${projectId}
  `;

  if (result.rows.length === 0) {
    return {
      isOnTrack: true,
      isOverdue: false,
    };
  }

  const row = result.rows[0];
  const startDate = row.start_date ? new Date(row.start_date) : undefined;
  const endDate = row.end_date ? new Date(row.end_date) : undefined;
  const now = new Date();

  if (!startDate || !endDate) {
    return {
      startDate,
      endDate,
      isOnTrack: true,
      isOverdue: false,
    };
  }

  const daysTotal = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const percentComplete = daysTotal > 0 ? Math.min(100, Math.max(0, Math.round((daysElapsed / daysTotal) * 100))) : 0;
  const isOverdue = daysRemaining < 0;

  // Rough "on track" calculation - would be better with task completion %
  const isOnTrack = !isOverdue && percentComplete <= 100;

  return {
    startDate,
    endDate,
    daysTotal: Math.max(0, daysTotal),
    daysElapsed: Math.max(0, daysElapsed),
    daysRemaining,
    percentComplete,
    isOnTrack,
    isOverdue,
  };
}

/**
 * Log an activity event for audit trail
 */
export async function logActivity(
  projectId: string,
  userId: string,
  action: string,
  entityType: EntityType,
  entityId?: string,
  changes?: Record<string, unknown>
): Promise<{ success: boolean; activity?: ProjectActivity; message: string }> {
  try {
    const activityId = crypto.randomUUID();

    await sql`
      INSERT INTO founder_project_activity (
        id, project_id, user_id, action, entity_type, entity_id, changes, created_at
      ) VALUES (
        ${activityId}, ${projectId}, ${userId}, ${action}, ${entityType},
        ${entityId || null}, ${changes ? JSON.stringify(changes) : null}, NOW()
      )
    `;

    const activity: ProjectActivity = {
      id: activityId,
      projectId,
      userId,
      action,
      entityType,
      entityId,
      changes,
      createdAt: new Date(),
    };

    return {
      success: true,
      activity,
      message: 'Activity logged.',
    };
  } catch (error: any) {
    // Don't fail the main operation if activity logging fails
    console.error('Activity logging failed:', error);
    return {
      success: false,
      message: 'Activity logging failed.',
    };
  }
}

/**
 * Get recent activity for a project
 */
export async function getProjectActivity(
  projectId: string,
  limit: number = 20
): Promise<{ success: boolean; activities: ProjectActivity[]; message: string }> {
  try {
    const result = await sql`
      SELECT * FROM founder_project_activity
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const activities = result.rows.map(mapRowToActivity);

    if (activities.length === 0) {
      return {
        success: true,
        activities: [],
        message: `No activity recorded yet for this project.`,
      };
    }

    const latestAction = activities[0];
    const actionDescriptions: Record<string, string> = {
      created: 'created',
      updated: 'updated',
      deleted: 'deleted',
      status_changed: 'changed status',
      member_added: 'added a team member',
      member_removed: 'removed a team member',
      role_changed: 'changed a role',
    };

    const latestDesc = actionDescriptions[latestAction.action] || latestAction.action;

    return {
      success: true,
      activities,
      message: `${activities.length} activity entries. Most recent: ${latestDesc} ${latestAction.entityType}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      activities: [],
      message: `I couldn't fetch the activity log. ${error.message || ''}`,
    };
  }
}

// =====================================================
// NATURAL LANGUAGE PARSING
// =====================================================

/**
 * Parse project details from natural language
 * Examples:
 * - "Launch my new product by March with $50k budget"
 * - "Client project for Acme Corp, 3 month timeline"
 */
export async function parseProjectFromText(text: string): Promise<{
  success: boolean;
  parsed?: ParsedProject;
  message: string;
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Extract project details from this text. Return JSON only, no explanation.

Text: "${text}"

Today's date: ${new Date().toISOString().split('T')[0]}

Return this exact JSON structure (use null for missing fields):
{
  "name": "short project name",
  "description": "longer description if provided",
  "budget": 50000,
  "startDate": "2025-01-15",
  "endDate": "2025-03-15",
  "timeline": "3 months"
}

For dates:
- Parse relative dates like "next month", "by March", "in 3 months"
- Return ISO date strings (YYYY-MM-DD)
- If only end date is mentioned, set startDate to today
- If timeline is given without end date, calculate endDate from today`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {
        success: false,
        message: `I couldn't parse that. Try something like: "New product launch with $50k budget, due in March"`,
      };
    }

    const parsed = JSON.parse(content.text);

    // Process dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (parsed.startDate) {
      startDate = new Date(parsed.startDate);
      if (isNaN(startDate.getTime())) startDate = undefined;
    }

    if (parsed.endDate) {
      endDate = new Date(parsed.endDate);
      if (isNaN(endDate.getTime())) endDate = undefined;
    }

    // Calculate confidence
    let confidence = 0.5;
    if (parsed.name) confidence += 0.2;
    if (parsed.budget) confidence += 0.15;
    if (endDate) confidence += 0.15;

    const result: ParsedProject = {
      name: parsed.name || undefined,
      description: parsed.description || undefined,
      budget: parsed.budget || undefined,
      startDate,
      endDate,
      timeline: parsed.timeline || undefined,
      confidence: Math.min(confidence, 1),
    };

    // Build summary message
    const missing: string[] = [];
    if (!result.name) missing.push('project name');
    if (!result.budget) missing.push('budget');

    let message: string;
    if (missing.length > 0) {
      message = `Got it. I still need: ${missing.join(', ')}. What should I fill in?`;
    } else {
      const budgetStr = result.budget ? `$${result.budget.toLocaleString()}` : 'unspecified budget';
      const timelineStr = result.timeline || (endDate ? `due ${endDate.toLocaleDateString()}` : 'no deadline');
      message = `Parsed: "${result.name}" - ${budgetStr}, ${timelineStr}. Ready to create this project?`;
    }

    return {
      success: true,
      parsed: result,
      message,
    };
  } catch (error: any) {
    // Fallback to simple regex parsing
    const budgetMatch = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:k|K|thousand)?/);
    let budget: number | undefined;
    if (budgetMatch) {
      budget = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (text.toLowerCase().includes('k') && budget < 1000) {
        budget *= 1000;
      }
    }

    // Try to extract a name (first quoted string or capitalized phrase)
    const nameMatch = text.match(/["']([^"']+)["']/) ||
                      text.match(/(?:project|launch|build|create)\s+(?:a\s+)?(.+?)(?:\s+with|\s+by|\s+in|\s*$)/i);
    const name = nameMatch ? nameMatch[1].trim() : undefined;

    return {
      success: true,
      parsed: {
        name,
        budget,
        confidence: (name ? 0.3 : 0) + (budget ? 0.3 : 0),
      },
      message: name && budget
        ? `I found: "${name}" with $${budget.toLocaleString()} budget. Add more details or confirm to create.`
        : `I couldn't fully parse that. Try: "Project name with $X budget, due by date"`,
    };
  }
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToProject(row: any): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    budget: parseFloat(row.budget) || 0,
    budgetSpent: parseFloat(row.budget_spent) || 0,
    currency: row.currency || 'USD',
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToMember(row: any): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    addedBy: row.added_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToActivity(row: any): ProjectActivity {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes,
    createdAt: new Date(row.created_at),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export const ProjectService = {
  // Project CRUD
  createProject,
  getProject,
  getProjectsByOwner,
  updateProject,
  updateProjectStatus,
  deleteProject,

  // Team Management
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
  getProjectMembers,

  // Dashboard
  getProjectDashboard,

  // Helpers
  calculateBudgetStatus,
  calculateTimelineStatus,
  logActivity,
  getProjectActivity,

  // Natural Language
  parseProjectFromText,
};

export default ProjectService;
