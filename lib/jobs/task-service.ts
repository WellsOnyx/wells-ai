/**
 * Task Management Service - Wells AI Job Seeker Journey
 *
 * Handles the full lifecycle of gig tasks:
 * - Task CRUD operations
 * - Application workflow (apply, accept, reject, withdraw)
 * - Assignment management (active work tracking)
 * - Milestone-based payments with GRAIN escrow
 * - Deliverable workflow (submit, approve, revise, reject)
 * - Reviews and reputation
 * - Attribution tracking for referral payouts
 *
 * All functions return conversational messages for AI-first UX.
 * GRAIN escrow is handled via @/lib/wells-payments
 */

import { sqlQuery as sql } from '@/lib/db';
import { createEscrow, releaseEscrow, refundEscrow, getAccountByClerkId } from '@/lib/wells-payments';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// =====================================================
// CONSTANTS
// =====================================================

const WELLS_FEE_PERCENT = 10; // 10% platform fee
const GRAIN_RATE = 0.001; // 1 GRAIN = $0.001 USD

// =====================================================
// TYPES
// =====================================================

export type PosterType = 'buyer' | 'seller' | 'founder' | 'individual' | 'business' | 'agency';
export type TaskStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type DeliverableStatus = 'pending' | 'approved' | 'revision_requested' | 'rejected';
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

export interface Task {
  id: string;
  posterUserId: string;
  posterType: PosterType;
  title: string;
  description: string;
  skills: string[];
  budgetMin: number;
  budgetMax: number;
  budgetType: 'fixed' | 'hourly';
  estimatedHours?: number;
  deadline?: Date;
  status: TaskStatus;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskApplication {
  id: string;
  taskId: string;
  workerId: string;
  coverLetter: string;
  proposedRate: number;
  estimatedDuration: string;
  portfolioLinks?: string[];
  status: ApplicationStatus;
  rejectionReason?: string;
  createdAt: Date;
}

export interface Assignment {
  id: string;
  taskId: string;
  applicationId: string;
  workerId: string;
  posterUserId: string;
  agreedRate: number;
  escrowId?: string;
  escrowAmount: number;
  status: AssignmentStatus;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
}

export interface Deliverable {
  id: string;
  assignmentId: string;
  workerId: string;
  title: string;
  description: string;
  attachmentUrls?: string[];
  status: DeliverableStatus;
  revisionNotes?: string;
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface Review {
  id: string;
  taskId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  rating: number;
  title: string;
  content: string;
  wouldHireAgain?: boolean;
  createdAt: Date;
}

export interface Milestone {
  id: string;
  assignmentId: string;
  title: string;
  description?: string;
  amount: number;
  grainAmount: number;
  dueDate?: Date;
  status: MilestoneStatus;
  orderNum: number;
  submittedAt?: Date;
  approvedAt?: Date;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedApplication {
  proposedRate?: number;
  proposedTimeline?: string;
  estimatedHours?: number;
  estimatedDays?: number;
  coverLetter: string;
  proposedApproach?: string;
  keyStrengths: string[];
  confidence: number;
}

export interface ParsedMilestones {
  milestones: Array<{
    title: string;
    description?: string;
    amount: number;
    dueDate?: Date;
  }>;
  totalAmount: number;
  confidence: number;
}

export interface AwardTerms {
  agreedRate: number;
  rateType: 'fixed' | 'hourly';
  estimatedHours?: number;
  agreedDeadline?: Date;
  notes?: string;
}

// =====================================================
// TASK CRUD
// =====================================================

/**
 * Create a new task posting
 * posterType: 'buyer' | 'seller' | 'founder' (or legacy 'individual' | 'business' | 'agency')
 */
export async function createTaskPosting(
  posterUserId: string,
  posterType: PosterType,
  data: {
    title: string;
    description: string;
    skills: string[];
    budgetMin: number;
    budgetMax: number;
    budgetType: 'fixed' | 'hourly';
    estimatedHours?: number;
    deadline?: Date;
    status?: TaskStatus;
  }
): Promise<{ task: Task; message: string; escrowRequired?: number; grainRequired?: number }> {
  const taskId = crypto.randomUUID();
  const status = data.status || 'open';

  await sql`
    INSERT INTO tasks (
      id, poster_user_id, poster_type,
      title, description, skills,
      budget_min, budget_max, budget_type,
      estimated_hours, deadline, status,
      application_count, created_at, updated_at
    ) VALUES (
      ${taskId}, ${posterUserId}, ${posterType},
      ${data.title}, ${data.description}, ${JSON.stringify(data.skills)},
      ${data.budgetMin}, ${data.budgetMax}, ${data.budgetType},
      ${data.estimatedHours || null}, ${data.deadline?.toISOString() || null}, ${status},
      0, NOW(), NOW()
    )
  `;

  const task: Task = {
    id: taskId,
    posterUserId,
    posterType,
    title: data.title,
    description: data.description,
    skills: data.skills,
    budgetMin: data.budgetMin,
    budgetMax: data.budgetMax,
    budgetType: data.budgetType,
    estimatedHours: data.estimatedHours,
    deadline: data.deadline,
    status,
    applicationCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const budgetDisplay = data.budgetType === 'hourly'
    ? `$${data.budgetMin}-${data.budgetMax}/hr`
    : `$${data.budgetMin}-${data.budgetMax} fixed`;

  // Calculate escrow requirements
  const maxBudget = data.budgetMax || data.budgetMin;
  const platformFee = maxBudget * (WELLS_FEE_PERCENT / 100);
  const escrowRequired = maxBudget + platformFee;
  const grainRequired = Math.floor(escrowRequired / GRAIN_RATE);

  return {
    task,
    message: `Your task "${data.title}" is now live. Budget: ${budgetDisplay}. Workers with ${data.skills.slice(0, 3).join(', ')} skills can now apply. I'll notify you when applications come in.`,
    escrowRequired,
    grainRequired,
  };
}

/**
 * Alias for backwards compatibility
 */
export const createTask = createTaskPosting;

/**
 * Update an existing task
 */
export async function updateTask(
  taskId: string,
  data: Partial<{
    title: string;
    description: string;
    skills: string[];
    budgetMin: number;
    budgetMax: number;
    budgetType: 'fixed' | 'hourly';
    estimatedHours: number;
    deadline: Date;
    status: TaskStatus;
  }>
): Promise<{ task: Task | null; message: string }> {
  // Build dynamic update
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.skills !== undefined) {
    updates.push(`skills = $${paramIndex++}`);
    values.push(JSON.stringify(data.skills));
  }
  if (data.budgetMin !== undefined) {
    updates.push(`budget_min = $${paramIndex++}`);
    values.push(data.budgetMin);
  }
  if (data.budgetMax !== undefined) {
    updates.push(`budget_max = $${paramIndex++}`);
    values.push(data.budgetMax);
  }
  if (data.budgetType !== undefined) {
    updates.push(`budget_type = $${paramIndex++}`);
    values.push(data.budgetType);
  }
  if (data.estimatedHours !== undefined) {
    updates.push(`estimated_hours = $${paramIndex++}`);
    values.push(data.estimatedHours);
  }
  if (data.deadline !== undefined) {
    updates.push(`deadline = $${paramIndex++}`);
    values.push(data.deadline.toISOString());
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }

  updates.push(`updated_at = NOW()`);
  values.push(taskId);

  const updateQuery = `
    UPDATE tasks SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await sql`${updateQuery}`;

  if (result.rows.length === 0) {
    return { task: null, message: `I couldn't find that task. It may have been deleted.` };
  }

  const task = mapRowToTask(result.rows[0]);
  const changedFields = Object.keys(data).filter(k => k !== 'status');

  let message = `Task "${task.title}" updated.`;
  if (data.status) {
    message = `Task "${task.title}" is now ${data.status}.`;
  } else if (changedFields.length > 0) {
    message = `Updated ${changedFields.join(', ')} for "${task.title}".`;
  }

  return { task, message };
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<{ task: Task | null; message: string }> {
  const result = await sql`
    SELECT * FROM tasks WHERE id = ${taskId}
  `;

  if (result.rows.length === 0) {
    return { task: null, message: `Task not found.` };
  }

  const task = mapRowToTask(result.rows[0]);
  const budgetDisplay = task.budgetType === 'hourly'
    ? `$${task.budgetMin}-${task.budgetMax}/hr`
    : `$${task.budgetMin}-${task.budgetMax}`;

  return {
    task,
    message: `"${task.title}" - ${task.status}. Budget: ${budgetDisplay}. ${task.applicationCount} application(s). Skills: ${task.skills.join(', ')}.`,
  };
}

/**
 * Get tasks by poster
 */
export async function getTasksByPoster(
  posterUserId: string,
  filters?: { status?: TaskStatus; limit?: number }
): Promise<{ tasks: Task[]; message: string }> {
  let result;
  const limit = filters?.limit || 20;

  if (filters?.status) {
    result = await sql`
      SELECT * FROM tasks
      WHERE poster_user_id = ${posterUserId} AND status = ${filters.status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM tasks
      WHERE poster_user_id = ${posterUserId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  const tasks = result.rows.map(mapRowToTask);

  if (tasks.length === 0) {
    return { tasks: [], message: `You don't have any tasks yet. Want to post one?` };
  }

  const openCount = tasks.filter(t => t.status === 'open').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const totalApps = tasks.reduce((sum, t) => sum + t.applicationCount, 0);

  return {
    tasks,
    message: `You have ${tasks.length} task(s): ${openCount} open, ${inProgressCount} in progress. Total applications: ${totalApps}.`,
  };
}

/**
 * Get all open tasks (for workers browsing)
 */
export async function getOpenTasks(
  filters?: { skills?: string[]; budgetMin?: number; budgetMax?: number; limit?: number }
): Promise<{ tasks: Task[]; message: string }> {
  const limit = filters?.limit || 50;

  // Base query for open tasks
  let result = await sql`
    SELECT * FROM tasks
    WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  let tasks = result.rows.map(mapRowToTask);

  // Apply filters in-memory for simplicity
  if (filters?.skills && filters.skills.length > 0) {
    const skillsLower = filters.skills.map(s => s.toLowerCase());
    tasks = tasks.filter(t =>
      t.skills.some(skill => skillsLower.includes(skill.toLowerCase()))
    );
  }

  if (filters?.budgetMin !== undefined) {
    tasks = tasks.filter(t => t.budgetMax >= filters.budgetMin!);
  }

  if (filters?.budgetMax !== undefined) {
    tasks = tasks.filter(t => t.budgetMin <= filters.budgetMax!);
  }

  if (tasks.length === 0) {
    return { tasks: [], message: `No open tasks match your criteria right now. Check back soon or adjust your filters.` };
  }

  const avgBudget = Math.round(tasks.reduce((sum, t) => sum + (t.budgetMin + t.budgetMax) / 2, 0) / tasks.length);

  return {
    tasks,
    message: `Found ${tasks.length} open task(s). Average budget: ~$${avgBudget}. Most popular skills: ${getTopSkills(tasks).join(', ')}.`,
  };
}

/**
 * Parse task details from natural language
 */
export async function parseTaskFromText(text: string): Promise<{
  title?: string;
  description?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: 'fixed' | 'hourly';
  estimatedHours?: number;
  message: string;
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract task posting details from this text. Return JSON only, no explanation.

Text: "${text}"

Return this exact JSON structure (use null for missing fields):
{
  "title": "concise task title",
  "description": "full description",
  "skills": ["skill1", "skill2"],
  "budgetMin": 100,
  "budgetMax": 500,
  "budgetType": "fixed" or "hourly",
  "estimatedHours": 10
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return { message: `I couldn't parse that. Try describing the task with a title, skills needed, and budget.` };
  }

  try {
    const parsed = JSON.parse(content.text);
    const missing: string[] = [];

    if (!parsed.title) missing.push('title');
    if (!parsed.skills || parsed.skills.length === 0) missing.push('skills needed');
    if (!parsed.budgetMin && !parsed.budgetMax) missing.push('budget');

    let message = '';
    if (missing.length > 0) {
      message = `Got it. I still need: ${missing.join(', ')}. What should I fill in?`;
    } else {
      const budgetDisplay = parsed.budgetType === 'hourly'
        ? `$${parsed.budgetMin}-${parsed.budgetMax}/hr`
        : `$${parsed.budgetMin}-${parsed.budgetMax} fixed`;
      message = `Parsed: "${parsed.title}" - ${parsed.skills.join(', ')} - ${budgetDisplay}. Ready to post?`;
    }

    return {
      title: parsed.title || undefined,
      description: parsed.description || undefined,
      skills: parsed.skills || undefined,
      budgetMin: parsed.budgetMin || undefined,
      budgetMax: parsed.budgetMax || undefined,
      budgetType: parsed.budgetType || undefined,
      estimatedHours: parsed.estimatedHours || undefined,
      message,
    };
  } catch {
    return { message: `I couldn't parse that. Try: "I need a React developer to build a landing page, budget $500-1000"` };
  }
}

/**
 * Cancel a task
 */
export async function cancelTask(
  taskId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  // Check task exists and get current status
  const existing = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;

  if (existing.rows.length === 0) {
    return { success: false, message: `Task not found.` };
  }

  const task = mapRowToTask(existing.rows[0]);

  if (task.status === 'completed') {
    return { success: false, message: `This task is already completed and cannot be cancelled.` };
  }

  if (task.status === 'cancelled') {
    return { success: false, message: `This task is already cancelled.` };
  }

  // If in progress, we may need to handle active assignments
  if (task.status === 'in_progress') {
    // Cancel active assignments and refund escrow
    const assignments = await sql`
      SELECT * FROM task_assignments WHERE task_id = ${taskId} AND status = 'active'
    `;

    for (const row of assignments.rows) {
      if (row.escrow_id) {
        await refundEscrow(row.escrow_id, `Task cancelled: ${reason}`);
      }
      await sql`
        UPDATE task_assignments SET status = 'cancelled' WHERE id = ${row.id}
      `;
    }
  }

  await sql`
    UPDATE tasks SET status = 'cancelled', updated_at = NOW() WHERE id = ${taskId}
  `;

  return {
    success: true,
    message: `Task "${task.title}" has been cancelled. ${task.status === 'in_progress' ? 'Active workers have been notified and any escrowed funds refunded.' : 'Any pending applications have been notified.'}`,
  };
}

// =====================================================
// APPLICATION WORKFLOW
// =====================================================

/**
 * Worker applies to a task
 */
export async function applyToTask(
  taskId: string,
  workerId: string,
  data: {
    coverLetter: string;
    proposedRate: number;
    estimatedDuration: string;
    portfolioLinks?: string[];
  }
): Promise<{ application: TaskApplication | null; message: string }> {
  // Check task exists and is open
  const taskResult = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (taskResult.rows.length === 0) {
    return { application: null, message: `Task not found.` };
  }

  const task = mapRowToTask(taskResult.rows[0]);
  if (task.status !== 'open') {
    return { application: null, message: `This task is no longer accepting applications.` };
  }

  // Check for existing application
  const existing = await sql`
    SELECT * FROM task_applications WHERE task_id = ${taskId} AND worker_id = ${workerId}
  `;
  if (existing.rows.length > 0) {
    return { application: null, message: `You've already applied to this task.` };
  }

  const applicationId = crypto.randomUUID();

  await sql`
    INSERT INTO task_applications (
      id, task_id, worker_id,
      cover_letter, proposed_rate, estimated_duration, portfolio_links,
      status, created_at
    ) VALUES (
      ${applicationId}, ${taskId}, ${workerId},
      ${data.coverLetter}, ${data.proposedRate}, ${data.estimatedDuration},
      ${JSON.stringify(data.portfolioLinks || [])},
      'pending', NOW()
    )
  `;

  // Increment application count
  await sql`UPDATE tasks SET application_count = application_count + 1 WHERE id = ${taskId}`;

  const application: TaskApplication = {
    id: applicationId,
    taskId,
    workerId,
    coverLetter: data.coverLetter,
    proposedRate: data.proposedRate,
    estimatedDuration: data.estimatedDuration,
    portfolioLinks: data.portfolioLinks,
    status: 'pending',
    createdAt: new Date(),
  };

  const rateDisplay = task.budgetType === 'hourly' ? `$${data.proposedRate}/hr` : `$${data.proposedRate}`;

  return {
    application,
    message: `Application submitted for "${task.title}" at ${rateDisplay}. Est. duration: ${data.estimatedDuration}. The poster will be notified.`,
  };
}

/**
 * Get applications for a task (poster view)
 */
export async function getApplications(
  taskId: string
): Promise<{ applications: TaskApplication[]; message: string }> {
  const result = await sql`
    SELECT * FROM task_applications
    WHERE task_id = ${taskId}
    ORDER BY created_at DESC
  `;

  const applications = result.rows.map(mapRowToApplication);

  if (applications.length === 0) {
    return { applications: [], message: `No applications yet. Share your task to get more visibility.` };
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const avgRate = Math.round(applications.reduce((sum, a) => sum + a.proposedRate, 0) / applications.length);

  return {
    applications,
    message: `${applications.length} application(s), ${pendingCount} pending review. Average proposed rate: $${avgRate}.`,
  };
}

/**
 * Get worker's applications
 */
export async function getMyApplications(
  workerId: string
): Promise<{ applications: TaskApplication[]; message: string }> {
  const result = await sql`
    SELECT a.*, t.title as task_title, t.status as task_status
    FROM task_applications a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.worker_id = ${workerId}
    ORDER BY a.created_at DESC
    LIMIT 50
  `;

  const applications = result.rows.map(row => ({
    ...mapRowToApplication(row),
    taskTitle: row.task_title,
    taskStatus: row.task_status,
  }));

  if (applications.length === 0) {
    return { applications: [], message: `You haven't applied to any tasks yet. Browse open tasks to get started.` };
  }

  const pending = applications.filter(a => a.status === 'pending').length;
  const accepted = applications.filter(a => a.status === 'accepted').length;

  return {
    applications,
    message: `You have ${applications.length} application(s): ${pending} pending, ${accepted} accepted.`,
  };
}

/**
 * Accept an application - creates assignment and escrow
 */
export async function acceptApplication(
  applicationId: string,
  posterAccountId: string
): Promise<{ assignment: Assignment | null; message: string }> {
  // Get application and task
  const appResult = await sql`
    SELECT a.*, t.poster_user_id, t.title, t.budget_type
    FROM task_applications a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.id = ${applicationId}
  `;

  if (appResult.rows.length === 0) {
    return { assignment: null, message: `Application not found.` };
  }

  const row = appResult.rows[0];
  if (row.status !== 'pending') {
    return { assignment: null, message: `This application has already been ${row.status}.` };
  }

  const taskId = row.task_id;
  const workerId = row.worker_id;
  const agreedRate = parseFloat(row.proposed_rate);
  const taskTitle = row.title;

  // Get worker's account for escrow
  const workerAccount = await getAccountByClerkId(workerId);
  if (!workerAccount) {
    return { assignment: null, message: `Worker doesn't have a payment account set up yet.` };
  }

  // Calculate escrow amount
  const escrowAmount = agreedRate; // For fixed, full amount. For hourly, initial deposit

  // Create escrow
  const escrowResult = await createEscrow(
    `task_${taskId}`,
    posterAccountId,
    workerAccount.id,
    escrowAmount
  );

  if (!escrowResult.success) {
    return { assignment: null, message: `Couldn't create escrow: ${escrowResult.error}. Make sure you have enough GRAIN.` };
  }

  const assignmentId = crypto.randomUUID();

  // Create assignment
  await sql`
    INSERT INTO task_assignments (
      id, task_id, application_id, worker_id, poster_user_id,
      agreed_rate, escrow_id, escrow_amount, status, started_at
    ) VALUES (
      ${assignmentId}, ${taskId}, ${applicationId}, ${workerId}, ${row.poster_user_id},
      ${agreedRate}, ${escrowResult.escrowId}, ${escrowAmount}, 'active', NOW()
    )
  `;

  // Update application status
  await sql`UPDATE task_applications SET status = 'accepted' WHERE id = ${applicationId}`;

  // Update task status
  await sql`UPDATE tasks SET status = 'in_progress', updated_at = NOW() WHERE id = ${taskId}`;

  // Reject other pending applications
  await sql`
    UPDATE task_applications
    SET status = 'rejected', rejection_reason = 'Another applicant was selected'
    WHERE task_id = ${taskId} AND status = 'pending'
  `;

  const assignment: Assignment = {
    id: assignmentId,
    taskId,
    applicationId,
    workerId,
    posterUserId: row.poster_user_id,
    agreedRate,
    escrowId: escrowResult.escrowId,
    escrowAmount,
    status: 'active',
    startedAt: new Date(),
  };

  return {
    assignment,
    message: `Application accepted. ${escrowAmount} GRAIN held in escrow for "${taskTitle}". The worker has been notified and can start immediately.`,
  };
}

/**
 * Reject an application
 */
export async function rejectApplication(
  applicationId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_applications
    SET status = 'rejected', rejection_reason = ${reason}
    WHERE id = ${applicationId} AND status = 'pending'
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Application not found or already processed.` };
  }

  return {
    success: true,
    message: `Application rejected. The worker will be notified with your feedback.`,
  };
}

/**
 * Worker withdraws their application
 */
export async function withdrawApplication(
  applicationId: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_applications
    SET status = 'withdrawn'
    WHERE id = ${applicationId} AND status = 'pending'
    RETURNING task_id
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Application not found or cannot be withdrawn.` };
  }

  // Decrement application count
  await sql`
    UPDATE tasks SET application_count = application_count - 1
    WHERE id = ${result.rows[0].task_id}
  `;

  return {
    success: true,
    message: `Application withdrawn. You can apply to other tasks.`,
  };
}

// =====================================================
// ASSIGNMENT WORKFLOW
// =====================================================

/**
 * Get assignment details
 */
export async function getAssignment(
  assignmentId: string
): Promise<{ assignment: Assignment | null; message: string }> {
  const result = await sql`
    SELECT a.*, t.title as task_title
    FROM task_assignments a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.id = ${assignmentId}
  `;

  if (result.rows.length === 0) {
    return { assignment: null, message: `Assignment not found.` };
  }

  const assignment = mapRowToAssignment(result.rows[0]);
  const taskTitle = result.rows[0].task_title;

  const statusMessage = assignment.status === 'active'
    ? `in progress since ${assignment.startedAt.toLocaleDateString()}`
    : assignment.status === 'paused'
    ? `paused since ${assignment.pausedAt?.toLocaleDateString()}`
    : assignment.status;

  return {
    assignment,
    message: `Assignment for "${taskTitle}": ${statusMessage}. Rate: $${assignment.agreedRate}. Escrow: ${assignment.escrowAmount} GRAIN.`,
  };
}

/**
 * Get active assignments for a worker
 */
export async function getActiveAssignments(
  workerId: string
): Promise<{ assignments: Assignment[]; message: string }> {
  const result = await sql`
    SELECT a.*, t.title as task_title, t.deadline
    FROM task_assignments a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.worker_id = ${workerId} AND a.status IN ('active', 'paused')
    ORDER BY a.started_at DESC
  `;

  const assignments = result.rows.map(row => ({
    ...mapRowToAssignment(row),
    taskTitle: row.task_title,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
  }));

  if (assignments.length === 0) {
    return { assignments: [], message: `You don't have any active assignments. Apply to tasks to get started.` };
  }

  const activeCount = assignments.filter(a => a.status === 'active').length;
  const totalEscrow = assignments.reduce((sum, a) => sum + a.escrowAmount, 0);

  return {
    assignments,
    message: `You have ${assignments.length} assignment(s), ${activeCount} active. Total in escrow: ${totalEscrow} GRAIN.`,
  };
}

/**
 * Pause an assignment
 */
export async function pauseAssignment(
  assignmentId: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_assignments
    SET status = 'paused', paused_at = NOW()
    WHERE id = ${assignmentId} AND status = 'active'
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Assignment not found or not active.` };
  }

  return {
    success: true,
    message: `Assignment paused. Escrow remains held. You can resume anytime.`,
  };
}

/**
 * Resume a paused assignment
 */
export async function resumeAssignment(
  assignmentId: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_assignments
    SET status = 'active', paused_at = NULL
    WHERE id = ${assignmentId} AND status = 'paused'
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Assignment not found or not paused.` };
  }

  return {
    success: true,
    message: `Assignment resumed. You're back in action.`,
  };
}

// =====================================================
// DELIVERABLE WORKFLOW
// =====================================================

/**
 * Submit a deliverable
 */
export async function submitDeliverable(
  assignmentId: string,
  data: {
    title: string;
    description: string;
    attachmentUrls?: string[];
  }
): Promise<{ deliverable: Deliverable | null; message: string }> {
  // Verify assignment exists and is active
  const assignmentResult = await sql`
    SELECT a.*, t.title as task_title
    FROM task_assignments a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.id = ${assignmentId}
  `;

  if (assignmentResult.rows.length === 0) {
    return { deliverable: null, message: `Assignment not found.` };
  }

  const assignment = mapRowToAssignment(assignmentResult.rows[0]);
  if (assignment.status !== 'active') {
    return { deliverable: null, message: `Cannot submit deliverables for ${assignment.status} assignments.` };
  }

  const deliverableId = crypto.randomUUID();

  await sql`
    INSERT INTO task_deliverables (
      id, assignment_id, worker_id,
      title, description, attachment_urls,
      status, submitted_at
    ) VALUES (
      ${deliverableId}, ${assignmentId}, ${assignment.workerId},
      ${data.title}, ${data.description}, ${JSON.stringify(data.attachmentUrls || [])},
      'pending', NOW()
    )
  `;

  const deliverable: Deliverable = {
    id: deliverableId,
    assignmentId,
    workerId: assignment.workerId,
    title: data.title,
    description: data.description,
    attachmentUrls: data.attachmentUrls,
    status: 'pending',
    submittedAt: new Date(),
  };

  return {
    deliverable,
    message: `Deliverable "${data.title}" submitted for "${assignmentResult.rows[0].task_title}". The poster will review it shortly.`,
  };
}

/**
 * Get deliverables for an assignment
 */
export async function getDeliverables(
  assignmentId: string
): Promise<{ deliverables: Deliverable[]; message: string }> {
  const result = await sql`
    SELECT * FROM task_deliverables
    WHERE assignment_id = ${assignmentId}
    ORDER BY submitted_at DESC
  `;

  const deliverables = result.rows.map(mapRowToDeliverable);

  if (deliverables.length === 0) {
    return { deliverables: [], message: `No deliverables submitted yet.` };
  }

  const pending = deliverables.filter(d => d.status === 'pending').length;
  const approved = deliverables.filter(d => d.status === 'approved').length;
  const needsRevision = deliverables.filter(d => d.status === 'revision_requested').length;

  return {
    deliverables,
    message: `${deliverables.length} deliverable(s): ${approved} approved, ${pending} pending review, ${needsRevision} need revision.`,
  };
}

/**
 * Approve a deliverable - releases GRAIN from escrow
 */
export async function approveDeliverable(
  deliverableId: string
): Promise<{ success: boolean; message: string }> {
  // Get deliverable and assignment
  const result = await sql`
    SELECT d.*, a.escrow_id, a.escrow_amount, a.task_id, t.title as task_title
    FROM task_deliverables d
    JOIN task_assignments a ON d.assignment_id = a.id
    JOIN tasks t ON a.task_id = t.id
    WHERE d.id = ${deliverableId}
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Deliverable not found.` };
  }

  const row = result.rows[0];
  if (row.status !== 'pending') {
    return { success: false, message: `This deliverable has already been ${row.status}.` };
  }

  // Release escrow
  if (row.escrow_id) {
    const releaseResult = await releaseEscrow(row.escrow_id);
    if (!releaseResult.success) {
      return { success: false, message: `Failed to release payment: ${releaseResult.error}` };
    }
  }

  // Update deliverable status
  await sql`
    UPDATE task_deliverables
    SET status = 'approved', reviewed_at = NOW()
    WHERE id = ${deliverableId}
  `;

  // Complete assignment
  await sql`
    UPDATE task_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${row.assignment_id}
  `;

  // Complete task
  await sql`
    UPDATE tasks
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${row.task_id}
  `;

  return {
    success: true,
    message: `Deliverable approved. ${row.escrow_amount} GRAIN released to the worker. Task "${row.task_title}" marked complete. Don't forget to leave a review.`,
  };
}

/**
 * Request revision on a deliverable
 */
export async function requestRevision(
  deliverableId: string,
  notes: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_deliverables
    SET status = 'revision_requested', revision_notes = ${notes}, reviewed_at = NOW()
    WHERE id = ${deliverableId} AND status = 'pending'
    RETURNING *
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Deliverable not found or not pending.` };
  }

  return {
    success: true,
    message: `Revision requested. The worker has been notified with your feedback and can resubmit.`,
  };
}

/**
 * Reject a deliverable
 */
export async function rejectDeliverable(
  deliverableId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const result = await sql`
    UPDATE task_deliverables
    SET status = 'rejected', rejection_reason = ${reason}, reviewed_at = NOW()
    WHERE id = ${deliverableId} AND status = 'pending'
    RETURNING assignment_id
  `;

  if (result.rows.length === 0) {
    return { success: false, message: `Deliverable not found or not pending.` };
  }

  return {
    success: true,
    message: `Deliverable rejected. The worker has been notified. You can request a new submission or cancel the assignment.`,
  };
}

// =====================================================
// REVIEWS
// =====================================================

/**
 * Create a review after task completion
 */
export async function createReview(
  taskId: string,
  reviewerUserId: string,
  revieweeUserId: string,
  data: {
    rating: number;
    title: string;
    content: string;
    wouldHireAgain?: boolean;
  }
): Promise<{ review: Review | null; message: string }> {
  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    return { review: null, message: `Rating must be between 1 and 5.` };
  }

  // Check task exists and is completed
  const taskResult = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (taskResult.rows.length === 0) {
    return { review: null, message: `Task not found.` };
  }

  if (taskResult.rows[0].status !== 'completed') {
    return { review: null, message: `You can only review completed tasks.` };
  }

  // Check for existing review
  const existing = await sql`
    SELECT * FROM task_reviews
    WHERE task_id = ${taskId} AND reviewer_user_id = ${reviewerUserId}
  `;
  if (existing.rows.length > 0) {
    return { review: null, message: `You've already reviewed this task.` };
  }

  const reviewId = crypto.randomUUID();

  await sql`
    INSERT INTO task_reviews (
      id, task_id, reviewer_user_id, reviewee_user_id,
      rating, title, content, would_hire_again,
      created_at
    ) VALUES (
      ${reviewId}, ${taskId}, ${reviewerUserId}, ${revieweeUserId},
      ${data.rating}, ${data.title}, ${data.content}, ${data.wouldHireAgain ?? null},
      NOW()
    )
  `;

  const review: Review = {
    id: reviewId,
    taskId,
    reviewerUserId,
    revieweeUserId,
    rating: data.rating,
    title: data.title,
    content: data.content,
    wouldHireAgain: data.wouldHireAgain,
    createdAt: new Date(),
  };

  const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);

  return {
    review,
    message: `Review posted: ${stars} "${data.title}". Thanks for your feedback - it helps build trust in the community.`,
  };
}

/**
 * Get reviews for a user
 */
export async function getReviews(
  userId: string
): Promise<{ reviews: Review[]; stats: { avgRating: number; totalReviews: number }; message: string }> {
  const result = await sql`
    SELECT * FROM task_reviews
    WHERE reviewee_user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const reviews = result.rows.map(mapRowToReview);

  if (reviews.length === 0) {
    return {
      reviews: [],
      stats: { avgRating: 0, totalReviews: 0 },
      message: `No reviews yet. Complete tasks to build your reputation.`,
    };
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const wouldHireAgain = reviews.filter(r => r.wouldHireAgain === true).length;

  return {
    reviews,
    stats: { avgRating: Math.round(avgRating * 10) / 10, totalReviews: reviews.length },
    message: `${reviews.length} review(s), ${avgRating.toFixed(1)} average rating. ${wouldHireAgain} would hire again.`,
  };
}

// =====================================================
// HELPERS
// =====================================================

function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    posterUserId: row.poster_user_id,
    posterType: row.poster_type,
    title: row.title,
    description: row.description,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
    budgetMin: parseFloat(row.budget_min),
    budgetMax: parseFloat(row.budget_max),
    budgetType: row.budget_type,
    estimatedHours: row.estimated_hours ? parseInt(row.estimated_hours) : undefined,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    status: row.status,
    applicationCount: parseInt(row.application_count || '0'),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToApplication(row: any): TaskApplication {
  return {
    id: row.id,
    taskId: row.task_id,
    workerId: row.worker_id,
    coverLetter: row.cover_letter,
    proposedRate: parseFloat(row.proposed_rate),
    estimatedDuration: row.estimated_duration,
    portfolioLinks: typeof row.portfolio_links === 'string'
      ? JSON.parse(row.portfolio_links)
      : (row.portfolio_links || []),
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at),
  };
}

function mapRowToAssignment(row: any): Assignment {
  return {
    id: row.id,
    taskId: row.task_id,
    applicationId: row.application_id,
    workerId: row.worker_id,
    posterUserId: row.poster_user_id,
    agreedRate: parseFloat(row.agreed_rate),
    escrowId: row.escrow_id,
    escrowAmount: parseFloat(row.escrow_amount),
    status: row.status,
    startedAt: new Date(row.started_at),
    pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function mapRowToDeliverable(row: any): Deliverable {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    workerId: row.worker_id,
    title: row.title,
    description: row.description,
    attachmentUrls: typeof row.attachment_urls === 'string'
      ? JSON.parse(row.attachment_urls)
      : (row.attachment_urls || []),
    status: row.status,
    revisionNotes: row.revision_notes,
    rejectionReason: row.rejection_reason,
    submittedAt: new Date(row.submitted_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
  };
}

function mapRowToReview(row: any): Review {
  return {
    id: row.id,
    taskId: row.task_id,
    reviewerUserId: row.reviewer_user_id,
    revieweeUserId: row.reviewee_user_id,
    rating: parseInt(row.rating),
    title: row.title,
    content: row.content,
    wouldHireAgain: row.would_hire_again,
    createdAt: new Date(row.created_at),
  };
}

function getTopSkills(tasks: Task[]): string[] {
  const skillCount: Record<string, number> = {};
  for (const task of tasks) {
    for (const skill of task.skills) {
      skillCount[skill] = (skillCount[skill] || 0) + 1;
    }
  }
  return Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill);
}

function mapRowToMilestone(row: any): Milestone {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    title: row.title,
    description: row.description,
    amount: parseFloat(row.amount),
    grainAmount: parseInt(row.grain_amount || '0'),
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    status: row.status,
    orderNum: parseInt(row.order_num || '0'),
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    feedback: row.feedback,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function usdToGrain(usd: number): number {
  return Math.floor(usd / GRAIN_RATE);
}

function grainToUsd(grain: number): number {
  return grain * GRAIN_RATE;
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const lowerStr = dateStr.toLowerCase();
  const now = new Date();

  // Handle relative dates
  if (lowerStr.includes('today')) return now;
  if (lowerStr.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  // Handle day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (lowerStr.includes(dayNames[i])) {
      const targetDay = new Date(now);
      while (targetDay.getDay() !== i) {
        targetDay.setDate(targetDay.getDate() + 1);
      }
      return targetDay;
    }
  }

  // Handle relative time: "2 days", "1 week"
  const daysMatch = lowerStr.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    const future = new Date(now);
    future.setDate(future.getDate() + parseInt(daysMatch[1], 10));
    return future;
  }

  const weeksMatch = lowerStr.match(/(\d+)\s*weeks?/i);
  if (weeksMatch) {
    const future = new Date(now);
    future.setDate(future.getDate() + parseInt(weeksMatch[1], 10) * 7);
    return future;
  }

  // Try standard parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

// =====================================================
// NATURAL LANGUAGE PARSING
// =====================================================

/**
 * Parse application details from natural language
 * Example: "I can do this in 2 days for $150, I've done similar research before"
 */
export function parseApplicationFromText(text: string): ParsedApplication {
  const keyStrengths: string[] = [];

  // Extract proposed rate
  const rateMatch = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)|(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)/i);
  const proposedRate = rateMatch ? parseFloat((rateMatch[1] || rateMatch[2]).replace(/,/g, '')) : undefined;

  // Extract timeline
  const daysMatch = text.match(/(\d+)\s*days?/i);
  const weeksMatch = text.match(/(\d+)\s*weeks?/i);
  const hoursMatch = text.match(/(\d+)\s*hours?/i);

  let estimatedDays: number | undefined;
  let estimatedHours: number | undefined;
  let proposedTimeline: string | undefined;

  if (daysMatch) {
    estimatedDays = parseInt(daysMatch[1], 10);
    proposedTimeline = `${estimatedDays} days`;
  } else if (weeksMatch) {
    estimatedDays = parseInt(weeksMatch[1], 10) * 7;
    proposedTimeline = `${weeksMatch[1]} weeks`;
  }

  if (hoursMatch) {
    estimatedHours = parseInt(hoursMatch[1], 10);
  }

  // Extract experience mentions
  const experiencePatterns = [
    /i(?:'ve| have)\s+(?:done|completed|worked on)\s+([^,.\n]+)/gi,
    /experience\s+(?:with|in)\s+([^,.\n]+)/gi,
    /(?:similar|same)\s+(?:project|work|task)/gi,
  ];

  for (const pattern of experiencePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keyStrengths.push(...matches.map(m => m.trim()));
    }
  }

  // Extract approach if mentioned
  const approachMatch = text.match(/(?:approach|plan|strategy|method)[:.]?\s*([^.]+)/i);
  const proposedApproach = approachMatch ? approachMatch[1].trim() : undefined;

  // Calculate confidence
  let confidence = 0.5;
  if (proposedRate) confidence += 0.2;
  if (proposedTimeline) confidence += 0.15;
  if (keyStrengths.length > 0) confidence += 0.15;

  return {
    proposedRate,
    proposedTimeline,
    estimatedHours,
    estimatedDays,
    coverLetter: text,
    proposedApproach,
    keyStrengths,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Parse milestones from natural language
 * Example: "First batch of 25 leads by Wednesday, remaining 25 by Friday"
 */
export function parseMilestonesFromText(text: string, totalBudget?: number): ParsedMilestones {
  const milestones: Array<{ title: string; description?: string; amount: number; dueDate?: Date }> = [];

  // Split by common delimiters
  const parts = text.split(/[,;]|\band\b|\bthen\b/i).filter(p => p.trim());

  for (const part of parts) {
    let title = part.trim();

    // Extract due date from the part
    const datePatterns = [/by\s+(\w+day)/i, /(?:due|before|by)\s+([^,]+)/i];
    let dueDate: Date | undefined;

    for (const pattern of datePatterns) {
      const match = part.match(pattern);
      if (match) {
        dueDate = parseDate(match[1]);
        title = title.replace(match[0], '').trim();
        break;
      }
    }

    // Extract amount if mentioned
    const amountMatch = part.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)|(\d+(?:,\d{3})*)\s*(?:dollars?|usd)/i);
    const amount = amountMatch
      ? parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''))
      : 0;

    // Extract quantity if mentioned
    const quantityMatch = part.match(/(\d+)\s*(?:leads?|items?|of\s+\d+)/i);
    const quantityText = quantityMatch ? quantityMatch[0] : '';

    // Clean up title
    title = title.replace(/^\d+[.)]\s*/, '').trim();
    title = title.replace(/^first\s+|^second\s+|^third\s+|^remaining\s+/i, '').trim();

    if (quantityText && !title.includes(quantityText)) {
      title = `${quantityText} ${title}`;
    }

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    if (title.length > 5) {
      milestones.push({ title, amount, dueDate });
    }
  }

  // If we have a total budget but no amounts, distribute evenly
  if (totalBudget && milestones.every(m => !m.amount)) {
    const amountPerMilestone = totalBudget / milestones.length;
    for (const m of milestones) {
      m.amount = Math.round(amountPerMilestone * 100) / 100;
    }
  }

  // Calculate confidence
  let confidence = 0.5;
  if (milestones.length >= 2) confidence += 0.2;
  if (milestones.every(m => m.dueDate)) confidence += 0.15;
  if (milestones.every(m => m.amount > 0)) confidence += 0.15;

  return {
    milestones,
    totalAmount: milestones.reduce((sum, m) => sum + m.amount, 0),
    confidence: Math.min(confidence, 1),
  };
}

// =====================================================
// TASK AWARD & ASSIGNMENT
// =====================================================

/**
 * Award a task to a worker, creating escrow
 */
export async function awardTask(
  taskId: string,
  workerId: string,
  terms: AwardTerms
): Promise<{
  success: boolean;
  assignment?: Assignment;
  escrowId?: string;
  message: string;
  grainEscrowed?: number;
}> {
  // Get task
  const taskResult = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (taskResult.rows.length === 0) {
    return { success: false, message: 'Task not found.' };
  }
  const task = mapRowToTask(taskResult.rows[0]);

  if (task.status !== 'open') {
    return { success: false, message: `Cannot award task with status: ${task.status}` };
  }

  // Get or create application record
  const appResult = await sql`
    SELECT * FROM task_applications
    WHERE task_id = ${taskId} AND worker_id = ${workerId}
  `;
  const applicationId = appResult.rows.length > 0 ? appResult.rows[0].id : null;

  // Get poster's account for escrow
  const posterAccount = await getAccountByClerkId(task.posterUserId);
  if (!posterAccount) {
    return { success: false, message: 'Poster does not have a payment account set up.' };
  }

  // Get worker's account
  const workerAccount = await getAccountByClerkId(workerId);
  if (!workerAccount) {
    return { success: false, message: 'Worker does not have a payment account set up.' };
  }

  // Calculate amounts
  const estimatedTotal = terms.rateType === 'fixed'
    ? terms.agreedRate
    : terms.agreedRate * (terms.estimatedHours || 0);
  const platformFee = estimatedTotal * (WELLS_FEE_PERCENT / 100);
  const escrowAmount = estimatedTotal + platformFee;
  const grainEscrowed = usdToGrain(escrowAmount);

  // Create escrow
  const escrowResult = await createEscrow(
    `task_${taskId}_${crypto.randomUUID().slice(0, 8)}`,
    posterAccount.id,
    workerAccount.id,
    escrowAmount
  );

  if (!escrowResult.success) {
    return { success: false, message: `Couldn't create escrow: ${escrowResult.error}. Make sure you have enough GRAIN.` };
  }

  const assignmentId = crypto.randomUUID();

  // Create assignment
  await sql`
    INSERT INTO task_assignments (
      id, task_id, application_id, worker_id, poster_user_id,
      agreed_rate, escrow_id, escrow_amount, status, started_at
    ) VALUES (
      ${assignmentId}, ${taskId}, ${applicationId}, ${workerId}, ${task.posterUserId},
      ${terms.agreedRate}, ${escrowResult.escrowId}, ${escrowAmount}, 'active', NOW()
    )
  `;

  // Update application if exists
  if (applicationId) {
    await sql`UPDATE task_applications SET status = 'accepted' WHERE id = ${applicationId}`;
  }

  // Update task status
  await sql`UPDATE tasks SET status = 'in_progress', updated_at = NOW() WHERE id = ${taskId}`;

  // Reject other pending applications
  await sql`
    UPDATE task_applications
    SET status = 'rejected', rejection_reason = 'Another applicant was selected'
    WHERE task_id = ${taskId} AND status = 'pending' AND id != ${applicationId || ''}
  `;

  const assignment: Assignment = {
    id: assignmentId,
    taskId,
    applicationId: applicationId || '',
    workerId,
    posterUserId: task.posterUserId,
    agreedRate: terms.agreedRate,
    escrowId: escrowResult.escrowId,
    escrowAmount,
    status: 'active',
    startedAt: new Date(),
  };

  return {
    success: true,
    assignment,
    escrowId: escrowResult.escrowId,
    grainEscrowed,
    message: `Task awarded! ${grainEscrowed.toLocaleString()} GRAIN held in escrow for "${task.title}". The worker has been notified to begin work.`,
  };
}

// =====================================================
// MILESTONE MANAGEMENT
// =====================================================

/**
 * Create milestones for an assignment
 */
export async function createMilestones(
  assignmentId: string,
  milestones: Array<{ title: string; description?: string; amount: number; dueDate?: Date }>
): Promise<{
  success: boolean;
  milestones: Milestone[];
  message: string;
}> {
  // Get assignment
  const assignResult = await sql`SELECT * FROM task_assignments WHERE id = ${assignmentId}`;
  if (assignResult.rows.length === 0) {
    return { success: false, milestones: [], message: 'Assignment not found.' };
  }

  const assignment = mapRowToAssignment(assignResult.rows[0]);

  // Validate milestone amounts
  const totalMilestoneAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  if (Math.abs(totalMilestoneAmount - assignment.agreedRate) > 0.01) {
    return {
      success: false,
      milestones: [],
      message: `Milestone amounts ($${totalMilestoneAmount}) must equal agreed rate ($${assignment.agreedRate}).`,
    };
  }

  const createdMilestones: Milestone[] = [];

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const milestoneId = crypto.randomUUID();
    const grainAmount = usdToGrain(m.amount);

    await sql`
      INSERT INTO task_milestones (
        id, assignment_id, title, description,
        amount, grain_amount, due_date, status, order_num,
        created_at, updated_at
      ) VALUES (
        ${milestoneId}, ${assignmentId}, ${m.title}, ${m.description || null},
        ${m.amount}, ${grainAmount}, ${m.dueDate?.toISOString() || null}, 'pending', ${i + 1},
        NOW(), NOW()
      )
    `;

    createdMilestones.push({
      id: milestoneId,
      assignmentId,
      title: m.title,
      description: m.description,
      amount: m.amount,
      grainAmount,
      dueDate: m.dueDate,
      status: 'pending',
      orderNum: i + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return {
    success: true,
    milestones: createdMilestones,
    message: `Created ${milestones.length} milestones for this assignment.`,
  };
}

/**
 * Get milestones for an assignment
 */
export async function getMilestones(
  assignmentId: string
): Promise<{ milestones: Milestone[]; message: string }> {
  const result = await sql`
    SELECT * FROM task_milestones
    WHERE assignment_id = ${assignmentId}
    ORDER BY order_num ASC
  `;

  const milestones = result.rows.map(mapRowToMilestone);

  if (milestones.length === 0) {
    return { milestones: [], message: 'No milestones set up for this assignment.' };
  }

  const completed = milestones.filter(m => m.status === 'approved').length;
  const pending = milestones.filter(m => m.status === 'pending' || m.status === 'in_progress').length;
  const submitted = milestones.filter(m => m.status === 'submitted').length;

  return {
    milestones,
    message: `${milestones.length} milestone(s): ${completed} approved, ${submitted} awaiting review, ${pending} pending.`,
  };
}

/**
 * Worker submits a milestone
 */
export async function submitMilestone(
  milestoneId: string,
  submission: { notes?: string; deliverableUrls?: string[] }
): Promise<{
  success: boolean;
  milestone?: Milestone;
  message: string;
}> {
  const result = await sql`
    SELECT * FROM task_milestones WHERE id = ${milestoneId}
  `;

  if (result.rows.length === 0) {
    return { success: false, message: 'Milestone not found.' };
  }

  const milestone = mapRowToMilestone(result.rows[0]);

  if (milestone.status !== 'pending' && milestone.status !== 'in_progress' && milestone.status !== 'rejected') {
    return { success: false, message: `Cannot submit milestone with status: ${milestone.status}` };
  }

  await sql`
    UPDATE task_milestones
    SET status = 'submitted',
        submitted_at = NOW(),
        feedback = ${submission.notes || null},
        updated_at = NOW()
    WHERE id = ${milestoneId}
  `;

  const updatedResult = await sql`SELECT * FROM task_milestones WHERE id = ${milestoneId}`;
  const updatedMilestone = mapRowToMilestone(updatedResult.rows[0]);

  return {
    success: true,
    milestone: updatedMilestone,
    message: `Milestone "${milestone.title}" submitted for review. The poster will be notified.`,
  };
}

/**
 * Poster approves a milestone - releases GRAIN from escrow
 */
export async function approveMilestone(
  milestoneId: string
): Promise<{
  success: boolean;
  milestone?: Milestone;
  grainReleased?: number;
  workerPayout?: number;
  wellsFee?: number;
  message: string;
}> {
  // Get milestone
  const milestoneResult = await sql`
    SELECT m.*, a.escrow_id, a.worker_id, a.poster_user_id, t.title as task_title
    FROM task_milestones m
    JOIN task_assignments a ON m.assignment_id = a.id
    JOIN tasks t ON a.task_id = t.id
    WHERE m.id = ${milestoneId}
  `;

  if (milestoneResult.rows.length === 0) {
    return { success: false, message: 'Milestone not found.' };
  }

  const row = milestoneResult.rows[0];
  const milestone = mapRowToMilestone(row);

  if (milestone.status !== 'submitted') {
    return { success: false, message: 'Milestone must be submitted before approval.' };
  }

  // Calculate payment split
  const wellsFee = milestone.amount * (WELLS_FEE_PERCENT / 100);
  const workerPayout = milestone.amount - wellsFee;
  const grainReleased = usdToGrain(workerPayout);

  // Release portion of escrow
  if (row.escrow_id) {
    const releaseResult = await releaseEscrow(row.escrow_id, milestone.amount);
    if (!releaseResult.success) {
      return { success: false, message: `Failed to release payment: ${releaseResult.error}` };
    }
  }

  // Update milestone
  await sql`
    UPDATE task_milestones
    SET status = 'approved',
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = ${milestoneId}
  `;

  // Process attribution payouts if applicable
  await processAttributionPayouts(row.worker_id, milestone.amount, row.task_id || row.assignment_id);

  const updatedResult = await sql`SELECT * FROM task_milestones WHERE id = ${milestoneId}`;
  const updatedMilestone = mapRowToMilestone(updatedResult.rows[0]);

  return {
    success: true,
    milestone: updatedMilestone,
    grainReleased,
    workerPayout,
    wellsFee,
    message: `Milestone approved! ${grainReleased.toLocaleString()} GRAIN ($${workerPayout.toFixed(2)}) released to worker.`,
  };
}

/**
 * Poster requests revision on a milestone
 */
export async function requestMilestoneRevision(
  milestoneId: string,
  feedback: string
): Promise<{
  success: boolean;
  milestone?: Milestone;
  message: string;
}> {
  const result = await sql`SELECT * FROM task_milestones WHERE id = ${milestoneId}`;

  if (result.rows.length === 0) {
    return { success: false, message: 'Milestone not found.' };
  }

  const milestone = mapRowToMilestone(result.rows[0]);

  if (milestone.status !== 'submitted') {
    return { success: false, message: 'Can only request revisions on submitted milestones.' };
  }

  await sql`
    UPDATE task_milestones
    SET status = 'rejected',
        feedback = ${feedback},
        updated_at = NOW()
    WHERE id = ${milestoneId}
  `;

  const updatedResult = await sql`SELECT * FROM task_milestones WHERE id = ${milestoneId}`;
  const updatedMilestone = mapRowToMilestone(updatedResult.rows[0]);

  return {
    success: true,
    milestone: updatedMilestone,
    message: 'Revision requested. The worker will be notified with your feedback.',
  };
}

// =====================================================
// TASK COMPLETION
// =====================================================

/**
 * Complete a task - finalize all milestones, trigger reviews
 */
export async function completeTask(
  assignmentId: string
): Promise<{
  success: boolean;
  assignment?: Assignment;
  totalPaid?: number;
  grainPaid?: number;
  message: string;
  promptForReview?: boolean;
}> {
  // Get assignment
  const assignResult = await sql`
    SELECT a.*, t.title as task_title, t.id as task_id
    FROM task_assignments a
    JOIN tasks t ON a.task_id = t.id
    WHERE a.id = ${assignmentId}
  `;

  if (assignResult.rows.length === 0) {
    return { success: false, message: 'Assignment not found.' };
  }

  const row = assignResult.rows[0];
  const assignment = mapRowToAssignment(row);

  if (assignment.status === 'completed') {
    return { success: false, message: 'Assignment is already completed.' };
  }

  // Check if there are milestones
  const milestoneResult = await sql`
    SELECT * FROM task_milestones WHERE assignment_id = ${assignmentId}
  `;

  let totalPaid = 0;
  let grainPaid = 0;

  if (milestoneResult.rows.length > 0) {
    // Check all milestones are approved
    const pendingMilestones = milestoneResult.rows.filter(m => m.status !== 'approved');
    if (pendingMilestones.length > 0) {
      return {
        success: false,
        message: `${pendingMilestones.length} milestone(s) still need approval before completing the task.`,
      };
    }

    // Sum up approved milestone payouts
    for (const m of milestoneResult.rows) {
      const amount = parseFloat(m.amount);
      const wellsFee = amount * (WELLS_FEE_PERCENT / 100);
      totalPaid += amount - wellsFee;
    }
    grainPaid = usdToGrain(totalPaid);
  } else {
    // No milestones - release full escrow
    if (assignment.escrowId) {
      const releaseResult = await releaseEscrow(assignment.escrowId);
      if (!releaseResult.success) {
        return { success: false, message: `Failed to release final payment: ${releaseResult.error}` };
      }
    }

    const wellsFee = assignment.agreedRate * (WELLS_FEE_PERCENT / 100);
    totalPaid = assignment.agreedRate - wellsFee;
    grainPaid = usdToGrain(totalPaid);

    // Process attribution payouts
    await processAttributionPayouts(assignment.workerId, assignment.agreedRate, row.task_id);
  }

  // Update assignment
  await sql`
    UPDATE task_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${assignmentId}
  `;

  // Update task
  await sql`
    UPDATE tasks
    SET status = 'completed', updated_at = NOW()
    WHERE id = ${row.task_id}
  `;

  return {
    success: true,
    assignment: { ...assignment, status: 'completed', completedAt: new Date() },
    totalPaid,
    grainPaid,
    message: `Task "${row.task_title}" completed! ${grainPaid.toLocaleString()} GRAIN ($${totalPaid.toFixed(2)}) paid out. Please leave a review for the worker.`,
    promptForReview: true,
  };
}

/**
 * Process attribution payouts for referral chains
 */
async function processAttributionPayouts(
  workerId: string,
  amount: number,
  taskId: string
): Promise<void> {
  try {
    // Get worker's attribution chain
    const attrResult = await sql`
      SELECT * FROM worker_attributions WHERE worker_id = ${workerId}
    `;

    if (attrResult.rows.length === 0) {
      return; // No attribution chain
    }

    const attribution = attrResult.rows[0];

    // Default attribution percentages
    const ATTR_PERCENTS = { level1: 5.0, level2: 2.5, level3: 1.0, level4: 0.5 };

    // Process each level
    const levels = [
      { referrerId: attribution.level1_referrer_id, percent: ATTR_PERCENTS.level1, level: 1 },
      { referrerId: attribution.level2_referrer_id, percent: ATTR_PERCENTS.level2, level: 2 },
      { referrerId: attribution.level3_referrer_id, percent: ATTR_PERCENTS.level3, level: 3 },
      { referrerId: attribution.level4_referrer_id, percent: ATTR_PERCENTS.level4, level: 4 },
    ];

    for (const level of levels) {
      if (level.referrerId) {
        const attrAmount = amount * (level.percent / 100);
        const attrGrain = usdToGrain(attrAmount);

        // Record attribution earning
        await sql`
          INSERT INTO worker_earnings (
            id, worker_id, task_id,
            type, description,
            gross_amount, platform_fee, processing_fee, net_amount,
            currency, attributed_from_id, attribution_level, attribution_percent,
            status, available_at,
            created_at, updated_at
          ) VALUES (
            ${crypto.randomUUID()}, ${level.referrerId}, ${taskId},
            'attribution', ${`Level ${level.level} attribution`},
            ${attrAmount}, 0, 0, ${attrAmount},
            'USD', ${workerId}, ${level.level}, ${level.percent},
            'available', NOW(),
            NOW(), NOW()
          )
        `;

        // Update referrer's attribution earnings in profile
        await sql`
          UPDATE worker_profiles
          SET attribution_earnings = COALESCE(attribution_earnings, 0) + ${attrAmount},
              updated_at = NOW()
          WHERE user_id = ${level.referrerId}
        `;
      }
    }

    // Update attribution tracking
    const totalAttrPaid = amount * 0.09; // Sum of all percentages
    await sql`
      UPDATE worker_attributions
      SET total_attribution_paid = COALESCE(total_attribution_paid, 0) + ${totalAttrPaid},
          total_earnings_generated = COALESCE(total_earnings_generated, 0) + ${amount},
          updated_at = NOW()
      WHERE worker_id = ${workerId}
    `;
  } catch (error) {
    console.error('Error processing attribution payouts:', error);
    // Don't throw - attribution failures shouldn't block task completion
  }
}

/**
 * Get task postings with filters (alias for getOpenTasks with more options)
 */
export async function getTaskPostings(
  filters?: {
    posterId?: string;
    status?: TaskStatus;
    skills?: string[];
    budgetMin?: number;
    budgetMax?: number;
    limit?: number;
  }
): Promise<{ tasks: Task[]; total: number; message: string }> {
  const limit = filters?.limit || 50;

  let result;
  if (filters?.posterId) {
    result = await sql`
      SELECT * FROM tasks
      WHERE poster_user_id = ${filters.posterId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else if (filters?.status) {
    result = await sql`
      SELECT * FROM tasks
      WHERE status = ${filters.status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM tasks
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  let tasks = result.rows.map(mapRowToTask);

  // Apply in-memory filters
  if (filters?.skills && filters.skills.length > 0) {
    const skillsLower = filters.skills.map(s => s.toLowerCase());
    tasks = tasks.filter(t =>
      t.skills.some(skill => skillsLower.includes(skill.toLowerCase()))
    );
  }

  if (filters?.budgetMin !== undefined) {
    tasks = tasks.filter(t => t.budgetMax >= filters.budgetMin!);
  }

  if (filters?.budgetMax !== undefined) {
    tasks = tasks.filter(t => t.budgetMin <= filters.budgetMax!);
  }

  return {
    tasks,
    total: tasks.length,
    message: `Found ${tasks.length} task(s).`,
  };
}

/**
 * Get task by ID (alias for getTask with more detail)
 */
export async function getTaskById(taskId: string): Promise<{
  success: boolean;
  task?: Task;
  applications?: TaskApplication[];
  assignments?: Assignment[];
  message: string;
}> {
  const taskResult = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;

  if (taskResult.rows.length === 0) {
    return { success: false, message: 'Task not found.' };
  }

  const task = mapRowToTask(taskResult.rows[0]);

  const appResult = await sql`
    SELECT * FROM task_applications WHERE task_id = ${taskId} ORDER BY created_at DESC
  `;
  const applications = appResult.rows.map(mapRowToApplication);

  const assignResult = await sql`
    SELECT * FROM task_assignments WHERE task_id = ${taskId} ORDER BY started_at DESC
  `;
  const assignments = assignResult.rows.map(mapRowToAssignment);

  return {
    success: true,
    task,
    applications,
    assignments,
    message: `Task: ${task.title}`,
  };
}

/**
 * Update task posting (alias for updateTask)
 */
export const updateTaskPosting = updateTask;

// =====================================================
// EXPORTS
// =====================================================

export const TaskService = {
  // Task CRUD
  createTask,
  createTaskPosting,
  updateTask,
  updateTaskPosting,
  getTask,
  getTaskById,
  getTasksByPoster,
  getTaskPostings,
  getOpenTasks,
  parseTaskFromText,
  cancelTask,

  // Application Workflow
  applyToTask,
  getApplications,
  getMyApplications,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  parseApplicationFromText,

  // Assignment & Award
  awardTask,
  getAssignment,
  getActiveAssignments,
  pauseAssignment,
  resumeAssignment,

  // Milestone Workflow
  createMilestones,
  getMilestones,
  parseMilestonesFromText,
  submitMilestone,
  approveMilestone,
  requestMilestoneRevision,

  // Task Completion
  completeTask,

  // Deliverable Workflow
  submitDeliverable,
  getDeliverables,
  approveDeliverable,
  requestRevision,
  rejectDeliverable,

  // Reviews
  createReview,
  getReviews,
};

export default TaskService;
