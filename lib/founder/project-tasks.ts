/**
 * Project Task Integration Service - Wells AI Founder Journey
 *
 * Links founder projects to the job marketplace task system for work execution.
 * Enables founders to:
 * - Create tasks directly from project needs
 * - Link existing marketplace tasks to projects
 * - Track project-level labor costs and progress
 * - Auto-match workers to project tasks
 * - Manage milestones with linked tasks and BOM items
 *
 * All functions return conversational messages for AI-first UX.
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  createTaskPosting,
  getTask,
  updateTask,
  getTaskById,
  TaskStatus,
} from '@/lib/jobs/task-service';
import {
  matchWorkersToTask,
  scoreMatch,
  MatchResult,
} from '@/lib/jobs/matching-engine';
import { getWorkerBalance, calculateFees, TaskType } from '@/lib/jobs/payment-service';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// =====================================================
// TYPES
// =====================================================

export type ProjectMilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface ProjectTask {
  id: string;
  projectId: string;
  taskId: string;
  milestoneId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  orderNum: number;
  linkedAt: Date;
  linkedBy: string;
  status: TaskStatus;
  notes?: string;
  // Joined data
  taskTitle?: string;
  taskDescription?: string;
  taskBudgetMin?: number;
  taskBudgetMax?: number;
  taskSkills?: string[];
  assignedWorkerId?: string;
  assignedWorkerName?: string;
}

export interface ProjectTaskDependency {
  id: string;
  projectTaskId: string;
  dependsOnProjectTaskId: string;
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
  lagDays: number;
  createdAt: Date;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  status: ProjectMilestoneStatus;
  orderNum: number;
  budgetAllocated: number;
  actualSpend: number;
  completedAt?: Date;
  linkedTaskIds: string[];
  linkedBomItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskProgress {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  blocked: number;
  completionPercent: number;
}

export interface WorkerMatch {
  taskId: string;
  taskTitle: string;
  matches: MatchResult[];
  topMatch?: MatchResult;
}

export interface ParsedTask {
  title: string;
  description?: string;
  skills: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetType: 'fixed' | 'hourly';
  duration?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface CriticalPathNode {
  projectTaskId: string;
  taskId: string;
  taskTitle: string;
  duration: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  isCritical: boolean;
  dependencies: string[];
}

// =====================================================
// TASK LINKING
// =====================================================

/**
 * 1. Link an existing task to a project
 */
export async function linkTaskToProject(
  projectId: string,
  taskId: string,
  options?: {
    milestoneId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    linkedBy?: string;
    notes?: string;
  }
): Promise<{ success: boolean; projectTask?: ProjectTask; message: string }> {
  try {
    // Verify task exists
    const taskResult = await getTask(taskId);
    if (!taskResult.task) {
      return { success: false, message: `Task not found. Please check the task ID.` };
    }

    // Verify project exists
    const projectResult = await sql`
      SELECT id, name FROM founder_projects WHERE id = ${projectId}
    `;
    if (projectResult.rows.length === 0) {
      return { success: false, message: `Project not found.` };
    }

    // Check if already linked
    const existing = await sql`
      SELECT id FROM project_tasks WHERE project_id = ${projectId} AND task_id = ${taskId}
    `;
    if (existing.rows.length > 0) {
      return { success: false, message: `This task is already linked to the project.` };
    }

    // Get next order number
    const orderResult = await sql`
      SELECT COALESCE(MAX(order_num), 0) + 1 as next_order
      FROM project_tasks WHERE project_id = ${projectId}
    `;
    const orderNum = parseInt(orderResult.rows[0].next_order);

    const projectTaskId = crypto.randomUUID();
    const priority = options?.priority || 'medium';

    await sql`
      INSERT INTO project_tasks (
        id, project_id, task_id, milestone_id,
        priority, order_num, linked_at, linked_by,
        status, notes
      ) VALUES (
        ${projectTaskId}, ${projectId}, ${taskId}, ${options?.milestoneId || null},
        ${priority}, ${orderNum}, NOW(), ${options?.linkedBy || null},
        ${taskResult.task.status}, ${options?.notes || null}
      )
    `;

    // Update milestone if specified
    if (options?.milestoneId) {
      await sql`
        UPDATE project_milestones
        SET linked_task_ids = array_append(COALESCE(linked_task_ids, ARRAY[]::text[]), ${taskId}),
            updated_at = NOW()
        WHERE id = ${options.milestoneId}
      `;
    }

    const projectTask: ProjectTask = {
      id: projectTaskId,
      projectId,
      taskId,
      milestoneId: options?.milestoneId,
      priority,
      orderNum,
      linkedAt: new Date(),
      linkedBy: options?.linkedBy || '',
      status: taskResult.task.status,
      notes: options?.notes,
      taskTitle: taskResult.task.title,
      taskDescription: taskResult.task.description,
      taskBudgetMin: taskResult.task.budgetMin,
      taskBudgetMax: taskResult.task.budgetMax,
      taskSkills: taskResult.task.skills,
    };

    const projectName = projectResult.rows[0].name;
    return {
      success: true,
      projectTask,
      message: `Linked "${taskResult.task.title}" to project "${projectName}". ${options?.milestoneId ? 'Added to milestone.' : ''} Priority: ${priority}.`,
    };
  } catch (error) {
    console.error('Error linking task to project:', error);
    return {
      success: false,
      message: `Something went wrong while linking the task. Please try again.`,
    };
  }
}

/**
 * 2. Remove task from project
 */
export async function unlinkTask(
  projectId: string,
  taskId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get project task info first
    const ptResult = await sql`
      SELECT pt.id, pt.milestone_id, t.title
      FROM project_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.project_id = ${projectId} AND pt.task_id = ${taskId}
    `;

    if (ptResult.rows.length === 0) {
      return { success: false, message: `This task is not linked to the project.` };
    }

    const projectTaskId = ptResult.rows[0].id;
    const milestoneId = ptResult.rows[0].milestone_id;
    const taskTitle = ptResult.rows[0].title;

    // Remove dependencies
    await sql`
      DELETE FROM project_task_dependencies
      WHERE project_task_id = ${projectTaskId} OR depends_on_project_task_id = ${projectTaskId}
    `;

    // Remove from milestone if linked
    if (milestoneId) {
      await sql`
        UPDATE project_milestones
        SET linked_task_ids = array_remove(linked_task_ids, ${taskId}),
            updated_at = NOW()
        WHERE id = ${milestoneId}
      `;
    }

    // Delete the project task link
    await sql`
      DELETE FROM project_tasks WHERE id = ${projectTaskId}
    `;

    return {
      success: true,
      message: `Removed "${taskTitle}" from the project. The task still exists in the marketplace.`,
    };
  } catch (error) {
    console.error('Error unlinking task:', error);
    return { success: false, message: `Something went wrong while removing the task.` };
  }
}

/**
 * 3. Get all tasks linked to project with status
 */
export async function getProjectTasks(
  projectId: string,
  options?: {
    milestoneId?: string;
    status?: TaskStatus;
    includeDetails?: boolean;
  }
): Promise<{ tasks: ProjectTask[]; progress: TaskProgress; message: string }> {
  try {
    let query;
    if (options?.milestoneId) {
      query = await sql`
        SELECT pt.*, t.title, t.description, t.budget_min, t.budget_max, t.skills, t.status as task_status,
               ta.worker_id as assigned_worker_id,
               wp.display_name as assigned_worker_name
        FROM project_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.status = 'active'
        LEFT JOIN worker_profiles wp ON ta.worker_id = wp.user_id
        WHERE pt.project_id = ${projectId} AND pt.milestone_id = ${options.milestoneId}
        ORDER BY pt.order_num ASC
      `;
    } else if (options?.status) {
      query = await sql`
        SELECT pt.*, t.title, t.description, t.budget_min, t.budget_max, t.skills, t.status as task_status,
               ta.worker_id as assigned_worker_id,
               wp.display_name as assigned_worker_name
        FROM project_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.status = 'active'
        LEFT JOIN worker_profiles wp ON ta.worker_id = wp.user_id
        WHERE pt.project_id = ${projectId} AND t.status = ${options.status}
        ORDER BY pt.order_num ASC
      `;
    } else {
      query = await sql`
        SELECT pt.*, t.title, t.description, t.budget_min, t.budget_max, t.skills, t.status as task_status,
               ta.worker_id as assigned_worker_id,
               wp.display_name as assigned_worker_name
        FROM project_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.status = 'active'
        LEFT JOIN worker_profiles wp ON ta.worker_id = wp.user_id
        WHERE pt.project_id = ${projectId}
        ORDER BY pt.order_num ASC
      `;
    }

    const tasks: ProjectTask[] = query.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      milestoneId: row.milestone_id,
      priority: row.priority,
      orderNum: row.order_num,
      linkedAt: new Date(row.linked_at),
      linkedBy: row.linked_by,
      status: row.task_status,
      notes: row.notes,
      taskTitle: row.title,
      taskDescription: row.description,
      taskBudgetMin: row.budget_min ? parseFloat(row.budget_min) : undefined,
      taskBudgetMax: row.budget_max ? parseFloat(row.budget_max) : undefined,
      taskSkills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
      assignedWorkerId: row.assigned_worker_id,
      assignedWorkerName: row.assigned_worker_name,
    }));

    // Calculate progress
    const progress: TaskProgress = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => ['draft', 'open'].includes(t.status)).length,
      blocked: tasks.filter(t => t.status === 'cancelled').length,
      completionPercent: tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : 0,
    };

    const statusSummary = `${progress.completed} completed, ${progress.in_progress} in progress, ${progress.pending} pending`;
    const message = tasks.length > 0
      ? `Found ${tasks.length} task(s) for this project. ${statusSummary}. ${progress.completionPercent}% complete.`
      : `No tasks linked to this project yet. Create or link tasks to get started.`;

    return { tasks, progress, message };
  } catch (error) {
    console.error('Error getting project tasks:', error);
    return {
      tasks: [],
      progress: { total: 0, completed: 0, in_progress: 0, pending: 0, blocked: 0, completionPercent: 0 },
      message: `Something went wrong while fetching tasks.`,
    };
  }
}

// =====================================================
// TASK CREATION FROM PROJECT
// =====================================================

/**
 * 4. Create new task and link to project
 */
export async function createTaskForProject(
  projectId: string,
  founderId: string,
  taskData: {
    title: string;
    description: string;
    skills: string[];
    budgetMin: number;
    budgetMax: number;
    budgetType: 'fixed' | 'hourly';
    estimatedHours?: number;
    deadline?: Date;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    milestoneId?: string;
  }
): Promise<{ success: boolean; taskId?: string; projectTaskId?: string; message: string }> {
  try {
    // Verify project exists and belongs to founder
    const projectResult = await sql`
      SELECT id, name, founder_id FROM founder_projects WHERE id = ${projectId}
    `;
    if (projectResult.rows.length === 0) {
      return { success: false, message: `Project not found.` };
    }

    // Create the task using task-service
    const result = await createTaskPosting(founderId, 'founder', {
      title: taskData.title,
      description: `[Project: ${projectResult.rows[0].name}]\n\n${taskData.description}`,
      skills: taskData.skills,
      budgetMin: taskData.budgetMin,
      budgetMax: taskData.budgetMax,
      budgetType: taskData.budgetType,
      estimatedHours: taskData.estimatedHours,
      deadline: taskData.deadline,
      status: 'open',
    });

    if (!result.task) {
      return { success: false, message: `Failed to create task. Please try again.` };
    }

    // Link task to project
    const linkResult = await linkTaskToProject(projectId, result.task.id, {
      milestoneId: taskData.milestoneId,
      priority: taskData.priority || 'medium',
      linkedBy: founderId,
    });

    if (!linkResult.success) {
      return {
        success: true,
        taskId: result.task.id,
        message: `Task "${taskData.title}" created but couldn't auto-link to project. ${linkResult.message}`,
      };
    }

    return {
      success: true,
      taskId: result.task.id,
      projectTaskId: linkResult.projectTask?.id,
      message: `Created and linked "${taskData.title}" to project "${projectResult.rows[0].name}". ${result.message}`,
    };
  } catch (error) {
    console.error('Error creating task for project:', error);
    return { success: false, message: `Something went wrong while creating the task.` };
  }
}

/**
 * 5. Create multiple tasks for a milestone
 */
export async function createTasksFromMilestone(
  projectId: string,
  milestoneId: string,
  founderId: string,
  taskDescriptions: Array<{
    title: string;
    description?: string;
    skills?: string[];
    budgetMin?: number;
    budgetMax?: number;
  }>
): Promise<{ success: boolean; createdCount: number; taskIds: string[]; message: string }> {
  try {
    // Verify milestone exists
    const milestoneResult = await sql`
      SELECT id, title, budget_allocated FROM project_milestones
      WHERE id = ${milestoneId} AND project_id = ${projectId}
    `;
    if (milestoneResult.rows.length === 0) {
      return { success: false, createdCount: 0, taskIds: [], message: `Milestone not found.` };
    }

    const milestone = milestoneResult.rows[0];
    const milestoneBudget = parseFloat(milestone.budget_allocated || 0);
    const budgetPerTask = milestoneBudget > 0 ? Math.floor(milestoneBudget / taskDescriptions.length) : 500;

    const taskIds: string[] = [];
    let createdCount = 0;

    for (const desc of taskDescriptions) {
      const result = await createTaskForProject(projectId, founderId, {
        title: desc.title,
        description: desc.description || `Task for milestone: ${milestone.title}`,
        skills: desc.skills || [],
        budgetMin: desc.budgetMin || Math.floor(budgetPerTask * 0.8),
        budgetMax: desc.budgetMax || budgetPerTask,
        budgetType: 'fixed',
        milestoneId,
      });

      if (result.success && result.taskId) {
        taskIds.push(result.taskId);
        createdCount++;
      }
    }

    if (createdCount === 0) {
      return {
        success: false,
        createdCount: 0,
        taskIds: [],
        message: `Failed to create any tasks. Please check the input and try again.`,
      };
    }

    return {
      success: true,
      createdCount,
      taskIds,
      message: `Created ${createdCount} of ${taskDescriptions.length} tasks for milestone "${milestone.title}". ${createdCount < taskDescriptions.length ? 'Some tasks failed to create.' : ''}`,
    };
  } catch (error) {
    console.error('Error creating tasks from milestone:', error);
    return {
      success: false,
      createdCount: 0,
      taskIds: [],
      message: `Something went wrong while creating tasks.`,
    };
  }
}

// =====================================================
// DEPENDENCIES
// =====================================================

/**
 * 6. Set task dependencies
 */
export async function setTaskDependencies(
  projectTaskId: string,
  dependsOnTaskIds: string[],
  options?: {
    dependencyType?: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
    lagDays?: number;
  }
): Promise<{ success: boolean; dependencies: ProjectTaskDependency[]; message: string }> {
  try {
    // Verify project task exists
    const ptResult = await sql`
      SELECT pt.id, pt.project_id, t.title
      FROM project_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.id = ${projectTaskId}
    `;
    if (ptResult.rows.length === 0) {
      return { success: false, dependencies: [], message: `Project task not found.` };
    }

    const projectId = ptResult.rows[0].project_id;
    const taskTitle = ptResult.rows[0].title;

    // Clear existing dependencies for this task
    await sql`
      DELETE FROM project_task_dependencies WHERE project_task_id = ${projectTaskId}
    `;

    const dependencies: ProjectTaskDependency[] = [];
    const dependencyType = options?.dependencyType || 'finish_to_start';
    const lagDays = options?.lagDays || 0;

    for (const depTaskId of dependsOnTaskIds) {
      // Verify dependency task exists in same project
      const depResult = await sql`
        SELECT id FROM project_tasks WHERE task_id = ${depTaskId} AND project_id = ${projectId}
      `;
      if (depResult.rows.length === 0) {
        continue; // Skip if not in same project
      }

      const dependsOnProjectTaskId = depResult.rows[0].id;

      // Prevent self-dependency
      if (dependsOnProjectTaskId === projectTaskId) {
        continue;
      }

      const depId = crypto.randomUUID();
      await sql`
        INSERT INTO project_task_dependencies (
          id, project_task_id, depends_on_project_task_id,
          dependency_type, lag_days, created_at
        ) VALUES (
          ${depId}, ${projectTaskId}, ${dependsOnProjectTaskId},
          ${dependencyType}, ${lagDays}, NOW()
        )
      `;

      dependencies.push({
        id: depId,
        projectTaskId,
        dependsOnProjectTaskId,
        dependencyType,
        lagDays,
        createdAt: new Date(),
      });
    }

    return {
      success: true,
      dependencies,
      message: `Set ${dependencies.length} dependencies for "${taskTitle}". Type: ${dependencyType}.`,
    };
  } catch (error) {
    console.error('Error setting task dependencies:', error);
    return { success: false, dependencies: [], message: `Failed to set dependencies.` };
  }
}

/**
 * 7. Get dependencies for a task
 */
export async function getTaskDependencies(
  projectTaskId: string
): Promise<{ dependencies: ProjectTaskDependency[]; dependentTasks: string[]; message: string }> {
  try {
    // Get tasks this task depends on
    const depsResult = await sql`
      SELECT d.*, t.title as depends_on_title
      FROM project_task_dependencies d
      JOIN project_tasks pt ON d.depends_on_project_task_id = pt.id
      JOIN tasks t ON pt.task_id = t.id
      WHERE d.project_task_id = ${projectTaskId}
    `;

    // Get tasks that depend on this task
    const dependentsResult = await sql`
      SELECT pt.task_id, t.title
      FROM project_task_dependencies d
      JOIN project_tasks pt ON d.project_task_id = pt.id
      JOIN tasks t ON pt.task_id = t.id
      WHERE d.depends_on_project_task_id = ${projectTaskId}
    `;

    const dependencies: ProjectTaskDependency[] = depsResult.rows.map(row => ({
      id: row.id,
      projectTaskId: row.project_task_id,
      dependsOnProjectTaskId: row.depends_on_project_task_id,
      dependencyType: row.dependency_type,
      lagDays: row.lag_days,
      createdAt: new Date(row.created_at),
    }));

    const dependentTasks = dependentsResult.rows.map(row => row.task_id);
    const depNames = depsResult.rows.map(row => row.depends_on_title);
    const dependerNames = dependentsResult.rows.map(row => row.title);

    let message = '';
    if (dependencies.length > 0) {
      message += `Depends on: ${depNames.join(', ')}. `;
    }
    if (dependentTasks.length > 0) {
      message += `Blocking: ${dependerNames.join(', ')}.`;
    }
    if (!message) {
      message = 'No dependencies set for this task.';
    }

    return { dependencies, dependentTasks, message };
  } catch (error) {
    console.error('Error getting task dependencies:', error);
    return { dependencies: [], dependentTasks: [], message: `Failed to get dependencies.` };
  }
}

/**
 * 8. Calculate critical path through tasks
 */
export async function getCriticalPath(
  projectId: string
): Promise<{ criticalPath: CriticalPathNode[]; projectDuration: number; message: string }> {
  try {
    // Get all tasks with their estimated hours as duration
    const tasksResult = await sql`
      SELECT pt.id as project_task_id, pt.task_id, t.title, t.estimated_hours
      FROM project_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.project_id = ${projectId}
      ORDER BY pt.order_num
    `;

    if (tasksResult.rows.length === 0) {
      return {
        criticalPath: [],
        projectDuration: 0,
        message: 'No tasks in this project to calculate critical path.',
      };
    }

    // Get all dependencies
    const depsResult = await sql`
      SELECT d.project_task_id, d.depends_on_project_task_id, d.lag_days
      FROM project_task_dependencies d
      JOIN project_tasks pt ON d.project_task_id = pt.id
      WHERE pt.project_id = ${projectId}
    `;

    // Build dependency map
    const dependencyMap: Record<string, string[]> = {};
    const lagMap: Record<string, number> = {};
    for (const dep of depsResult.rows) {
      if (!dependencyMap[dep.project_task_id]) {
        dependencyMap[dep.project_task_id] = [];
      }
      dependencyMap[dep.project_task_id].push(dep.depends_on_project_task_id);
      lagMap[`${dep.project_task_id}_${dep.depends_on_project_task_id}`] = dep.lag_days || 0;
    }

    // Build nodes
    const nodes: Record<string, CriticalPathNode> = {};
    for (const row of tasksResult.rows) {
      const duration = parseFloat(row.estimated_hours || '8'); // Default 8 hours if not specified
      nodes[row.project_task_id] = {
        projectTaskId: row.project_task_id,
        taskId: row.task_id,
        taskTitle: row.title,
        duration,
        earliestStart: 0,
        earliestFinish: duration,
        latestStart: 0,
        latestFinish: duration,
        slack: 0,
        isCritical: false,
        dependencies: dependencyMap[row.project_task_id] || [],
      };
    }

    // Forward pass - calculate earliest start/finish
    const sortedNodes = topologicalSort(Object.values(nodes), dependencyMap);
    for (const node of sortedNodes) {
      const deps = dependencyMap[node.projectTaskId] || [];
      if (deps.length > 0) {
        let maxPredFinish = 0;
        for (const depId of deps) {
          const predNode = nodes[depId];
          if (predNode) {
            const lag = lagMap[`${node.projectTaskId}_${depId}`] || 0;
            maxPredFinish = Math.max(maxPredFinish, predNode.earliestFinish + lag);
          }
        }
        node.earliestStart = maxPredFinish;
        node.earliestFinish = node.earliestStart + node.duration;
      }
    }

    // Find project duration
    const projectDuration = Math.max(...Object.values(nodes).map(n => n.earliestFinish));

    // Backward pass - calculate latest start/finish
    for (const node of sortedNodes.reverse()) {
      // Find successors
      const successors = Object.values(nodes).filter(n =>
        (dependencyMap[n.projectTaskId] || []).includes(node.projectTaskId)
      );

      if (successors.length === 0) {
        node.latestFinish = projectDuration;
        node.latestStart = node.latestFinish - node.duration;
      } else {
        let minSuccStart = Infinity;
        for (const succ of successors) {
          const lag = lagMap[`${succ.projectTaskId}_${node.projectTaskId}`] || 0;
          minSuccStart = Math.min(minSuccStart, succ.latestStart - lag);
        }
        node.latestFinish = minSuccStart;
        node.latestStart = node.latestFinish - node.duration;
      }

      node.slack = node.latestStart - node.earliestStart;
      node.isCritical = node.slack === 0;
    }

    // Extract critical path
    const criticalPath = Object.values(nodes)
      .filter(n => n.isCritical)
      .sort((a, b) => a.earliestStart - b.earliestStart);

    const criticalTaskNames = criticalPath.map(n => n.taskTitle);
    const message = criticalPath.length > 0
      ? `Critical path: ${criticalTaskNames.join(' -> ')}. Total duration: ${projectDuration} hours.`
      : `No critical path identified. Check task dependencies.`;

    return { criticalPath, projectDuration, message };
  } catch (error) {
    console.error('Error calculating critical path:', error);
    return {
      criticalPath: [],
      projectDuration: 0,
      message: `Failed to calculate critical path.`,
    };
  }
}

// =====================================================
// WORKER INTEGRATION
// =====================================================

/**
 * 9. Match workers to all open project tasks
 */
export async function findWorkersForProjectTasks(
  projectId: string,
  options?: { minScore?: number; limit?: number }
): Promise<{ matches: WorkerMatch[]; message: string }> {
  try {
    // Get all open tasks for the project
    const tasksResult = await sql`
      SELECT pt.task_id, t.title
      FROM project_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.project_id = ${projectId}
        AND t.status = 'open'
    `;

    if (tasksResult.rows.length === 0) {
      return {
        matches: [],
        message: `No open tasks in this project. All tasks may already be assigned or completed.`,
      };
    }

    const matches: WorkerMatch[] = [];
    const minScore = options?.minScore || 60;
    const limit = options?.limit || 5;

    for (const row of tasksResult.rows) {
      const matchResult = await matchWorkersToTask(row.task_id, { minScore, limit });

      matches.push({
        taskId: row.task_id,
        taskTitle: row.title,
        matches: matchResult.matches,
        topMatch: matchResult.matches[0],
      });
    }

    const totalMatches = matches.reduce((sum, m) => sum + m.matches.length, 0);
    const tasksWithMatches = matches.filter(m => m.matches.length > 0).length;

    return {
      matches,
      message: `Found ${totalMatches} worker match(es) across ${tasksWithMatches} of ${tasksResult.rows.length} open tasks. Ready to assign?`,
    };
  } catch (error) {
    console.error('Error finding workers:', error);
    return { matches: [], message: `Something went wrong while finding workers.` };
  }
}

/**
 * 10. Auto-assign best-matched workers to tasks
 */
export async function autoAssignTasks(
  projectId: string,
  options?: {
    minScore?: number;
    maxAssignments?: number;
    dryRun?: boolean;
  }
): Promise<{
  success: boolean;
  assignments: Array<{ taskId: string; workerId: string; score: number }>;
  message: string;
}> {
  try {
    const minScore = options?.minScore || 75;
    const maxAssignments = options?.maxAssignments || 10;
    const dryRun = options?.dryRun ?? false;

    const matchesResult = await findWorkersForProjectTasks(projectId, { minScore });
    const assignments: Array<{ taskId: string; workerId: string; score: number }> = [];

    for (const taskMatch of matchesResult.matches) {
      if (assignments.length >= maxAssignments) break;
      if (!taskMatch.topMatch || !taskMatch.topMatch.worker) continue;

      const worker = taskMatch.topMatch.worker;
      const score = taskMatch.topMatch.score.score;

      if (score >= minScore) {
        if (!dryRun) {
          // Create application on behalf of worker (auto-apply)
          await sql`
            INSERT INTO task_applications (
              id, task_id, worker_id, cover_letter, proposed_rate,
              estimated_duration, status, match_score, ai_generated, created_at
            ) VALUES (
              ${crypto.randomUUID()}, ${taskMatch.taskId}, ${worker.userId},
              'Auto-matched by Wells AI based on skill alignment',
              ${worker.preferredRate || 0}, '1 week', 'pending',
              ${score}, true, NOW()
            )
            ON CONFLICT (task_id, worker_id) DO NOTHING
          `;
        }

        assignments.push({
          taskId: taskMatch.taskId,
          workerId: worker.userId,
          score,
        });
      }
    }

    const action = dryRun ? 'would assign' : 'assigned';
    return {
      success: true,
      assignments,
      message: `${dryRun ? '[DRY RUN] ' : ''}Auto-${action} ${assignments.length} worker(s) to project tasks. Min score: ${minScore}%.`,
    };
  } catch (error) {
    console.error('Error auto-assigning tasks:', error);
    return {
      success: false,
      assignments: [],
      message: `Failed to auto-assign workers.`,
    };
  }
}

// =====================================================
// STATUS SYNC
// =====================================================

/**
 * 11. Sync task statuses from job_tasks table
 */
export async function syncTaskStatuses(
  projectId: string
): Promise<{ updated: number; message: string }> {
  try {
    // Get all project tasks and their current marketplace status
    const result = await sql`
      UPDATE project_tasks pt
      SET status = t.status
      FROM tasks t
      WHERE pt.task_id = t.id
        AND pt.project_id = ${projectId}
        AND pt.status != t.status
      RETURNING pt.id
    `;

    const updated = result.rows.length;

    return {
      updated,
      message: updated > 0
        ? `Synced ${updated} task status(es) with the marketplace.`
        : `All task statuses are up to date.`,
    };
  } catch (error) {
    console.error('Error syncing task statuses:', error);
    return { updated: 0, message: `Failed to sync statuses.` };
  }
}

/**
 * 12. Get task progress for project
 */
export async function getTaskProgress(
  projectId: string
): Promise<{ progress: TaskProgress; message: string }> {
  const { progress, message } = await getProjectTasks(projectId);
  return { progress, message };
}

// =====================================================
// MILESTONE MANAGEMENT
// =====================================================

/**
 * 13. Create project milestone
 */
export async function createMilestone(
  projectId: string,
  data: {
    title: string;
    description?: string;
    dueDate?: Date;
    budgetAllocated?: number;
  }
): Promise<{ success: boolean; milestone?: ProjectMilestone; message: string }> {
  try {
    // Verify project exists
    const projectResult = await sql`
      SELECT id, name FROM founder_projects WHERE id = ${projectId}
    `;
    if (projectResult.rows.length === 0) {
      return { success: false, message: `Project not found.` };
    }

    // Get next order number
    const orderResult = await sql`
      SELECT COALESCE(MAX(order_num), 0) + 1 as next_order
      FROM project_milestones WHERE project_id = ${projectId}
    `;
    const orderNum = parseInt(orderResult.rows[0].next_order);

    const milestoneId = crypto.randomUUID();

    await sql`
      INSERT INTO project_milestones (
        id, project_id, title, description, due_date,
        status, order_num, budget_allocated, actual_spend,
        linked_task_ids, linked_bom_item_ids, created_at, updated_at
      ) VALUES (
        ${milestoneId}, ${projectId}, ${data.title}, ${data.description || null}, ${data.dueDate?.toISOString() || null},
        'pending', ${orderNum}, ${data.budgetAllocated || 0}, 0,
        ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW()
      )
    `;

    const milestone: ProjectMilestone = {
      id: milestoneId,
      projectId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: 'pending',
      orderNum,
      budgetAllocated: data.budgetAllocated || 0,
      actualSpend: 0,
      linkedTaskIds: [],
      linkedBomItemIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dueDateStr = data.dueDate ? ` Due: ${data.dueDate.toLocaleDateString()}.` : '';

    return {
      success: true,
      milestone,
      message: `Created milestone "${data.title}" for project "${projectResult.rows[0].name}".${dueDateStr}`,
    };
  } catch (error) {
    console.error('Error creating milestone:', error);
    return { success: false, message: `Failed to create milestone.` };
  }
}

/**
 * 14. Get all milestones for project
 */
export async function getMilestones(
  projectId: string
): Promise<{ milestones: ProjectMilestone[]; message: string }> {
  try {
    const result = await sql`
      SELECT * FROM project_milestones
      WHERE project_id = ${projectId}
      ORDER BY order_num ASC
    `;

    const milestones: ProjectMilestone[] = result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      status: row.status,
      orderNum: row.order_num,
      budgetAllocated: parseFloat(row.budget_allocated || 0),
      actualSpend: parseFloat(row.actual_spend || 0),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      linkedTaskIds: row.linked_task_ids || [],
      linkedBomItemIds: row.linked_bom_item_ids || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    const completed = milestones.filter(m => m.status === 'completed').length;
    const inProgress = milestones.filter(m => m.status === 'in_progress').length;

    return {
      milestones,
      message: milestones.length > 0
        ? `Found ${milestones.length} milestone(s): ${completed} completed, ${inProgress} in progress.`
        : `No milestones for this project yet. Create milestones to track progress.`,
    };
  } catch (error) {
    console.error('Error getting milestones:', error);
    return { milestones: [], message: `Failed to get milestones.` };
  }
}

/**
 * 15. Update milestone
 */
export async function updateMilestone(
  milestoneId: string,
  updates: Partial<{
    title: string;
    description: string;
    dueDate: Date;
    status: ProjectMilestoneStatus;
    budgetAllocated: number;
    orderNum: number;
  }>
): Promise<{ success: boolean; milestone?: ProjectMilestone; message: string }> {
  try {
    // Build update query dynamically
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.dueDate !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`);
      values.push(updates.dueDate.toISOString());
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
      if (updates.status === 'completed') {
        setClauses.push(`completed_at = NOW()`);
      }
    }
    if (updates.budgetAllocated !== undefined) {
      setClauses.push(`budget_allocated = $${paramIndex++}`);
      values.push(updates.budgetAllocated);
    }
    if (updates.orderNum !== undefined) {
      setClauses.push(`order_num = $${paramIndex++}`);
      values.push(updates.orderNum);
    }

    values.push(milestoneId);

    const result = await sql`
      UPDATE project_milestones
      SET ${sql.raw(setClauses.join(', '))}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return { success: false, message: `Milestone not found.` };
    }

    const row = result.rows[0];
    const milestone: ProjectMilestone = {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      status: row.status,
      orderNum: row.order_num,
      budgetAllocated: parseFloat(row.budget_allocated || 0),
      actualSpend: parseFloat(row.actual_spend || 0),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      linkedTaskIds: row.linked_task_ids || [],
      linkedBomItemIds: row.linked_bom_item_ids || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    return {
      success: true,
      milestone,
      message: `Updated milestone "${milestone.title}".`,
    };
  } catch (error) {
    console.error('Error updating milestone:', error);
    return { success: false, message: `Failed to update milestone.` };
  }
}

/**
 * 16. Mark milestone complete
 */
export async function completeMilestone(
  milestoneId: string
): Promise<{ success: boolean; message: string }> {
  const result = await updateMilestone(milestoneId, { status: 'completed' });
  if (result.success) {
    return {
      success: true,
      message: `Milestone "${result.milestone?.title}" marked complete. Great progress!`,
    };
  }
  return result;
}

/**
 * 17. Link tasks to milestone
 */
export async function linkTasksToMilestone(
  milestoneId: string,
  taskIds: string[]
): Promise<{ success: boolean; linkedCount: number; message: string }> {
  try {
    const milestoneResult = await sql`
      SELECT id, project_id, title FROM project_milestones WHERE id = ${milestoneId}
    `;
    if (milestoneResult.rows.length === 0) {
      return { success: false, linkedCount: 0, message: `Milestone not found.` };
    }

    const projectId = milestoneResult.rows[0].project_id;
    let linkedCount = 0;

    for (const taskId of taskIds) {
      // Update project_tasks to set milestone
      const updateResult = await sql`
        UPDATE project_tasks
        SET milestone_id = ${milestoneId}
        WHERE project_id = ${projectId} AND task_id = ${taskId}
        RETURNING id
      `;

      if (updateResult.rows.length > 0) {
        linkedCount++;
      }
    }

    // Update milestone's linked_task_ids array
    await sql`
      UPDATE project_milestones
      SET linked_task_ids = (
        SELECT array_agg(task_id) FROM project_tasks WHERE milestone_id = ${milestoneId}
      ),
      updated_at = NOW()
      WHERE id = ${milestoneId}
    `;

    return {
      success: true,
      linkedCount,
      message: `Linked ${linkedCount} task(s) to milestone "${milestoneResult.rows[0].title}".`,
    };
  } catch (error) {
    console.error('Error linking tasks to milestone:', error);
    return { success: false, linkedCount: 0, message: `Failed to link tasks.` };
  }
}

/**
 * 18. Link BOM items to milestone
 */
export async function linkBOMToMilestone(
  milestoneId: string,
  bomItemIds: string[]
): Promise<{ success: boolean; linkedCount: number; message: string }> {
  try {
    const result = await sql`
      UPDATE project_milestones
      SET linked_bom_item_ids = array_cat(
        COALESCE(linked_bom_item_ids, ARRAY[]::text[]),
        ${bomItemIds}::text[]
      ),
      updated_at = NOW()
      WHERE id = ${milestoneId}
      RETURNING title
    `;

    if (result.rows.length === 0) {
      return { success: false, linkedCount: 0, message: `Milestone not found.` };
    }

    return {
      success: true,
      linkedCount: bomItemIds.length,
      message: `Linked ${bomItemIds.length} BOM item(s) to milestone "${result.rows[0].title}".`,
    };
  } catch (error) {
    console.error('Error linking BOM to milestone:', error);
    return { success: false, linkedCount: 0, message: `Failed to link BOM items.` };
  }
}

/**
 * 19. Get milestone progress based on linked tasks/BOM
 */
export async function getMilestoneProgress(
  milestoneId: string
): Promise<{
  taskProgress: TaskProgress;
  bomProgress: { total: number; procured: number; received: number };
  overallProgress: number;
  message: string;
}> {
  try {
    const milestoneResult = await sql`
      SELECT * FROM project_milestones WHERE id = ${milestoneId}
    `;

    if (milestoneResult.rows.length === 0) {
      return {
        taskProgress: { total: 0, completed: 0, in_progress: 0, pending: 0, blocked: 0, completionPercent: 0 },
        bomProgress: { total: 0, procured: 0, received: 0 },
        overallProgress: 0,
        message: `Milestone not found.`,
      };
    }

    const milestone = milestoneResult.rows[0];
    const projectId = milestone.project_id;

    // Get task progress
    const { progress: taskProgress } = await getProjectTasks(projectId, { milestoneId });

    // Get BOM progress
    const bomItemIds = milestone.linked_bom_item_ids || [];
    let bomProgress = { total: 0, procured: 0, received: 0 };

    if (bomItemIds.length > 0) {
      const bomResult = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status IN ('ordered', 'shipped', 'received')) as procured,
          COUNT(*) FILTER (WHERE status = 'received') as received
        FROM project_bom_items
        WHERE id = ANY(${bomItemIds}::text[])
      `;
      if (bomResult.rows.length > 0) {
        bomProgress = {
          total: parseInt(bomResult.rows[0].total || 0),
          procured: parseInt(bomResult.rows[0].procured || 0),
          received: parseInt(bomResult.rows[0].received || 0),
        };
      }
    }

    // Calculate overall progress (weighted average)
    const taskWeight = 0.7;
    const bomWeight = 0.3;
    const taskPercent = taskProgress.completionPercent;
    const bomPercent = bomProgress.total > 0 ? (bomProgress.received / bomProgress.total) * 100 : 100;
    const overallProgress = Math.round(taskPercent * taskWeight + bomPercent * bomWeight);

    return {
      taskProgress,
      bomProgress,
      overallProgress,
      message: `Milestone "${milestone.title}" is ${overallProgress}% complete. Tasks: ${taskProgress.completionPercent}% done. BOM: ${bomProgress.received}/${bomProgress.total} items received.`,
    };
  } catch (error) {
    console.error('Error getting milestone progress:', error);
    return {
      taskProgress: { total: 0, completed: 0, in_progress: 0, pending: 0, blocked: 0, completionPercent: 0 },
      bomProgress: { total: 0, procured: 0, received: 0 },
      overallProgress: 0,
      message: `Failed to get milestone progress.`,
    };
  }
}

// =====================================================
// NATURAL LANGUAGE PARSING
// =====================================================

/**
 * 20. Extract tasks from natural language
 */
export async function parseTasksFromText(
  text: string,
  context?: { projectBudget?: number; projectDeadline?: Date }
): Promise<{ tasks: ParsedTask[]; message: string }> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extract individual tasks from this text. Return JSON array of tasks.

Text: "${text}"

Project context:
- Budget: ${context?.projectBudget ? `$${context.projectBudget}` : 'Not specified'}
- Deadline: ${context?.projectDeadline ? context.projectDeadline.toLocaleDateString() : 'Not specified'}

For each task, extract:
{
  "title": "concise task title (max 60 chars)",
  "description": "detailed description if mentioned",
  "skills": ["relevant skills needed"],
  "budgetMin": estimated minimum budget (number),
  "budgetMax": estimated maximum budget (number),
  "budgetType": "fixed" or "hourly",
  "duration": "estimated duration (e.g., '2 days', '1 week')",
  "priority": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0 confidence in extraction
}

Return array of tasks in this format. Be specific about skills needed.
If hiring/contracting is mentioned, set budgetType to "hourly".
Return JSON only, no explanation.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { tasks: [], message: `Couldn't parse tasks from the text. Please try rephrasing.` };
    }

    let tasks: ParsedTask[];
    try {
      const parsed = JSON.parse(content.text);
      tasks = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      } else {
        return { tasks: [], message: `Couldn't parse the response. Please try again.` };
      }
    }

    // Validate and clean tasks
    const validTasks: ParsedTask[] = tasks
      .filter(t => t.title && t.title.length > 0)
      .map(t => ({
        title: t.title.slice(0, 60),
        description: t.description,
        skills: Array.isArray(t.skills) ? t.skills : [],
        budgetMin: typeof t.budgetMin === 'number' ? t.budgetMin : undefined,
        budgetMax: typeof t.budgetMax === 'number' ? t.budgetMax : undefined,
        budgetType: t.budgetType === 'hourly' ? 'hourly' : 'fixed',
        duration: t.duration,
        priority: ['low', 'medium', 'high', 'critical'].includes(t.priority) ? t.priority : 'medium',
        confidence: typeof t.confidence === 'number' ? t.confidence : 0.7,
      }));

    if (validTasks.length === 0) {
      return { tasks: [], message: `Couldn't identify any tasks. Try being more specific about what work needs to be done.` };
    }

    const taskTitles = validTasks.map(t => `"${t.title}"`).join(', ');
    const totalBudget = validTasks.reduce((sum, t) => sum + (t.budgetMax || t.budgetMin || 0), 0);

    return {
      tasks: validTasks,
      message: `Extracted ${validTasks.length} task(s): ${taskTitles}. Estimated total: $${totalBudget.toLocaleString()}. Ready to create these?`,
    };
  } catch (error) {
    console.error('Error parsing tasks from text:', error);
    return { tasks: [], message: `Something went wrong while parsing. Please try again.` };
  }
}

// =====================================================
// FINANCIAL INTEGRATION
// =====================================================

/**
 * 21. Get total labor cost from all project tasks
 */
export async function getProjectLaborCost(
  projectId: string
): Promise<{
  totalCost: number;
  paidCost: number;
  pendingCost: number;
  inEscrow: number;
  byStatus: Record<string, number>;
  message: string;
}> {
  try {
    // Get all task assignments for project tasks
    const result = await sql`
      SELECT
        ta.status,
        ta.agreed_rate,
        ta.escrow_amount,
        t.budget_type,
        ta.escrow_id,
        (SELECT COALESCE(SUM(amount), 0) FROM job_escrow_transactions
         WHERE escrow_id = ta.escrow_id AND type IN ('milestone_release', 'full_release')) as released_amount
      FROM project_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      WHERE pt.project_id = ${projectId}
    `;

    let totalCost = 0;
    let paidCost = 0;
    let pendingCost = 0;
    let inEscrow = 0;
    const byStatus: Record<string, number> = {};

    for (const row of result.rows) {
      const cost = parseFloat(row.agreed_rate || 0);
      const escrowAmount = parseFloat(row.escrow_amount || 0);
      const releasedAmount = parseFloat(row.released_amount || 0);
      const status = row.status || 'unassigned';

      totalCost += cost;
      byStatus[status] = (byStatus[status] || 0) + cost;

      if (status === 'completed') {
        paidCost += cost;
      } else if (status === 'active') {
        inEscrow += escrowAmount - releasedAmount;
        paidCost += releasedAmount;
      } else if (status !== 'cancelled') {
        pendingCost += cost;
      }
    }

    return {
      totalCost,
      paidCost,
      pendingCost,
      inEscrow,
      byStatus,
      message: `Total labor: $${totalCost.toLocaleString()}. Paid: $${paidCost.toLocaleString()}, In escrow: $${inEscrow.toLocaleString()}, Pending: $${pendingCost.toLocaleString()}.`,
    };
  } catch (error) {
    console.error('Error getting project labor cost:', error);
    return {
      totalCost: 0,
      paidCost: 0,
      pendingCost: 0,
      inEscrow: 0,
      byStatus: {},
      message: `Failed to calculate labor costs.`,
    };
  }
}

/**
 * 22. Get budget allocated to labor
 */
export async function getProjectLaborBudget(
  projectId: string
): Promise<{
  laborBudget: number;
  totalBudget: number;
  laborPercent: number;
  remaining: number;
  message: string;
}> {
  try {
    // Get project budget
    const projectResult = await sql`
      SELECT budget, labor_budget_percent, name FROM founder_projects WHERE id = ${projectId}
    `;

    if (projectResult.rows.length === 0) {
      return {
        laborBudget: 0,
        totalBudget: 0,
        laborPercent: 0,
        remaining: 0,
        message: `Project not found.`,
      };
    }

    const totalBudget = parseFloat(projectResult.rows[0].budget || 0);
    const laborPercent = parseFloat(projectResult.rows[0].labor_budget_percent || 40);
    const laborBudget = (totalBudget * laborPercent) / 100;

    // Get actual labor costs
    const { totalCost } = await getProjectLaborCost(projectId);
    const remaining = laborBudget - totalCost;

    return {
      laborBudget,
      totalBudget,
      laborPercent,
      remaining,
      message: `Labor budget: $${laborBudget.toLocaleString()} (${laborPercent}% of $${totalBudget.toLocaleString()}). Spent: $${totalCost.toLocaleString()}. Remaining: $${remaining.toLocaleString()}.`,
    };
  } catch (error) {
    console.error('Error getting labor budget:', error);
    return {
      laborBudget: 0,
      totalBudget: 0,
      laborPercent: 0,
      remaining: 0,
      message: `Failed to get labor budget.`,
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Topological sort for critical path calculation
 */
function topologicalSort(
  nodes: CriticalPathNode[],
  dependencyMap: Record<string, string[]>
): CriticalPathNode[] {
  const visited = new Set<string>();
  const result: CriticalPathNode[] = [];
  const nodeMap = new Map(nodes.map(n => [n.projectTaskId, n]));

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const deps = dependencyMap[nodeId] || [];
    for (const depId of deps) {
      visit(depId);
    }

    const node = nodeMap.get(nodeId);
    if (node) result.push(node);
  }

  for (const node of nodes) {
    visit(node.projectTaskId);
  }

  return result;
}

// =====================================================
// EXPORTS
// =====================================================

export const ProjectTaskService = {
  // Task Linking
  linkTaskToProject,
  unlinkTask,
  getProjectTasks,

  // Task Creation
  createTaskForProject,
  createTasksFromMilestone,

  // Dependencies
  setTaskDependencies,
  getTaskDependencies,
  getCriticalPath,

  // Worker Integration
  findWorkersForProjectTasks,
  autoAssignTasks,

  // Status Sync
  syncTaskStatuses,
  getTaskProgress,

  // Milestone Management
  createMilestone,
  getMilestones,
  updateMilestone,
  completeMilestone,
  linkTasksToMilestone,
  linkBOMToMilestone,
  getMilestoneProgress,

  // Natural Language
  parseTasksFromText,

  // Financial
  getProjectLaborCost,
  getProjectLaborBudget,
};

export default ProjectTaskService;
