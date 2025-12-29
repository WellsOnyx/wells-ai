// @ts-nocheck
/**
 * Conversational Founder - Wells AI
 *
 * The comprehensive business logic orchestrator for the Founder Journey.
 * This is the "co-pilot" that helps founders manage all aspects of their
 * business through natural conversation.
 *
 * Integrates:
 * - Project Service (project-service.ts)
 * - BOM Service (bom-service.ts)
 * - Financial Service (financial-service.ts)
 * - Hiring Service (hiring-service.ts)
 * - Unified Inbox (unified-inbox.ts)
 * - Network Sourcing (network-sourcing.ts)
 * - Marketing Service (marketing-service.ts)
 * - Project Tasks (project-tasks.ts)
 *
 * All methods return conversational responses for AI-first UX.
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

// Import all founder services
import {
  createProject,
  getProject,
  getProjectsByOwner,
  updateProject,
  updateProjectStatus,
  deleteProject,
  getProjectDashboard,
  parseProjectFromText,
  type Project,
  type ProjectDashboard,
} from './project-service';

import {
  addBOMItem,
  getBOMItems,
  updateBOMItem,
  deleteBOMItem,
  getBOMSummary,
  createRFQFromBOM,
  autoSourceBOM,
  parseBOMFromText,
  findSuppliersForBOM,
  getBOMBudgetVariance,
  type BOMItem,
  type BOMSummary,
} from './bom-service';

import {
  getPLStatement,
  getCashFlowStatement,
  getBurnRate,
  getRunway,
  getTransactions,
  getBudgetComparison,
  addManualTransaction,
  type PLStatement,
  type CashFlowStatement,
  type FinancialKPIs,
} from './financial-service';

import {
  createJobPosting,
  getJobPostings,
  publishJob,
  searchNetworkForJob,
  getNetworkMatches as getHiringNetworkMatches,
  addCandidate,
  getHiringStats,
  parseJobFromText,
  type JobPosting,
  type Candidate,
  type HiringStats,
} from './hiring-service';

import {
  getUnifiedInbox,
  getThread,
  markRead,
  archive,
  generateSummary,
  type UnifiedThread,
  type InboxStats,
} from './unified-inbox';

import {
  createSourcingRequest,
  searchNetwork,
  requestIntro,
  getSourcingRequests,
  getAvailableMatches,
  getNetworkStats,
  type SourcingRequest,
  type NetworkMatch,
  type NetworkStats,
  type SourcingType,
} from './network-sourcing';

import {
  generateCopy,
  createCampaign,
  getCampaigns,
  getCampaign,
  type ContentPiece,
  type AdCampaign,
} from './marketing-service';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

export interface FounderContext {
  userId: string;
  sessionId: string;
  primaryJourney: string;
  activeProjectId?: string;
  recentTopic?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  preferences?: FounderPreferences;
}

export interface FounderPreferences {
  communicationStyle?: 'concise' | 'detailed' | 'casual';
  defaultCurrency?: string;
  timezone?: string;
  notificationPreferences?: Record<string, boolean>;
}

export interface HandlerResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions?: SuggestedAction[];
  requiresFollowUp?: boolean;
  followUpPrompt?: string;
}

export interface SuggestedAction {
  label: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface FounderEntities {
  projectName?: string;
  projectId?: string;
  projectBudget?: number;
  projectDeadline?: Date;
  projectType?: 'hardware' | 'software' | 'service' | 'hybrid';
  itemName?: string;
  itemQuantity?: number;
  itemUnit?: string;
  itemPrice?: number;
  itemCategory?: string;
  itemPriority?: 'low' | 'medium' | 'high' | 'critical';
  milestoneName?: string;
  milestoneDate?: Date;
  milestoneStatus?: string;
  timeframe?: string;
  amount?: number;
  category?: string;
  channel?: string;
  priority?: string;
  sender?: string;
  messageId?: string;
  sourcingType?: 'supplier' | 'manufacturer' | 'partner' | 'customer' | 'talent' | 'investor';
  industry?: string;
  location?: string;
  criteria?: string[];
  role?: string;
  skills?: string[];
  salary?: { min?: number; max?: number };
  hiringType?: 'full_time' | 'part_time' | 'contract' | 'freelance';
  contentType?: string;
  topic?: string;
  tone?: string;
  targetAudience?: string;
  rawText?: string;
}

// ============================================================================
// CONVERSATIONAL FOUNDER CLASS
// ============================================================================

export class ConversationalFounder {
  private context: FounderContext;
  private userId: string;

  constructor(context: FounderContext) {
    this.context = context;
    this.userId = context.userId;
  }

  // ==========================================================================
  // PROJECT HANDLERS
  // ==========================================================================

  async handleCreateProject(entities: FounderEntities): Promise<HandlerResult> {
    // If we have raw text, try to parse it
    if (entities.rawText && !entities.projectName) {
      const parsed = await parseProjectFromText(entities.rawText);
      if (parsed.success && parsed.parsed) {
        entities.projectName = parsed.parsed.name;
        entities.projectBudget = parsed.parsed.budget;
        entities.projectDeadline = parsed.parsed.endDate;
      }
    }

    // Check if we have required info
    if (!entities.projectName) {
      return {
        success: false,
        message: "What would you like to name this project? You can also tell me about the budget and timeline.",
        requiresFollowUp: true,
        followUpPrompt: 'project_name',
      };
    }

    const result = await createProject(this.userId, {
      name: entities.projectName,
      budget: entities.projectBudget || 0,
      startDate: new Date(),
      endDate: entities.projectDeadline,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.message,
      data: {
        projectId: result.project?.id,
        project: result.project,
        topic: 'project',
      },
      actions: [
        { label: 'Add team members', action: 'add_team_member', params: { projectId: result.project?.id } },
        { label: 'Add BOM items', action: 'add_bom_item', params: { projectId: result.project?.id } },
        { label: 'Set milestones', action: 'create_milestone', params: { projectId: result.project?.id } },
      ],
    };
  }

  async handleListProjects(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getProjectsByOwner(this.userId, {
      status: entities.projectType ? undefined : undefined,
    });

    if (!result.success || result.projects.length === 0) {
      return {
        success: true,
        message: result.message,
        actions: [
          { label: 'Create a project', action: 'create_project' },
        ],
      };
    }

    const projectList = result.projects.slice(0, 5).map(p => {
      const budgetPct = p.budget > 0 ? Math.round((p.budgetSpent / p.budget) * 100) : 0;
      return `- **${p.name}** (${p.status}): $${p.budgetSpent.toLocaleString()}/$${p.budget.toLocaleString()} (${budgetPct}% spent)`;
    }).join('\n');

    return {
      success: true,
      message: `${result.message}\n\n${projectList}`,
      data: { projects: result.projects },
      actions: result.projects.slice(0, 3).map(p => ({
        label: `View ${p.name}`,
        action: 'project_status',
        params: { projectId: p.id },
      })),
    };
  }

  async handleProjectStatus(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      // Try to find by name
      if (entities.projectName) {
        const projects = await getProjectsByOwner(this.userId);
        const match = projects.projects.find(p =>
          p.name.toLowerCase().includes(entities.projectName!.toLowerCase())
        );
        if (match) {
          return this.handleProjectStatus({ ...entities, projectId: match.id });
        }
      }

      return {
        success: false,
        message: "Which project would you like to check on?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const result = await getProjectDashboard(projectId);

    if (!result.success || !result.dashboard) {
      return {
        success: false,
        message: result.message,
      };
    }

    const d = result.dashboard;
    const statusEmoji = d.project.status === 'active' ? '' : d.project.status === 'completed' ? '' : '';

    let message = `${statusEmoji} **${d.project.name}** - ${d.project.status.toUpperCase()}\n\n`;
    message += `**Budget:** $${d.budget.spent.toLocaleString()} of $${d.budget.total.toLocaleString()} (${d.budget.percentUsed}% used)\n`;

    if (d.timeline.daysRemaining !== undefined) {
      message += `**Timeline:** ${d.timeline.daysRemaining > 0 ? d.timeline.daysRemaining + ' days remaining' : Math.abs(d.timeline.daysRemaining) + ' days overdue'}\n`;
    }

    message += `**BOM:** ${d.bomStatus.total} items (${d.bomStatus.received} received, ${d.bomStatus.ordered} ordered)\n`;
    message += `**Tasks:** ${d.taskStatus.completed}/${d.taskStatus.total} completed\n`;

    if (d.milestoneProgress.overdue > 0) {
      message += `\n**Warning:** ${d.milestoneProgress.overdue} milestone(s) overdue`;
    }

    return {
      success: true,
      message,
      data: { dashboard: d, projectId, topic: 'project' },
      actions: [
        { label: 'View BOM', action: 'list_bom', params: { projectId } },
        { label: "What's due?", action: 'whats_due', params: { projectId } },
        { label: 'Budget details', action: 'budget_status', params: { projectId } },
      ],
    };
  }

  async handleUpdateProject(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project would you like to update?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const updates: Record<string, unknown> = {};
    if (entities.projectName) updates.name = entities.projectName;
    if (entities.projectBudget) updates.budget = entities.projectBudget;
    if (entities.projectDeadline) updates.endDate = entities.projectDeadline;

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        message: "What would you like to change? I can update the name, budget, or deadline.",
        requiresFollowUp: true,
        followUpPrompt: 'project_updates',
      };
    }

    const result = await updateProject(projectId, updates as Parameters<typeof updateProject>[1]);

    return {
      success: result.success,
      message: result.message,
      data: { project: result.project, projectId },
    };
  }

  async handleDeleteProject(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project would you like to delete or archive?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const result = await deleteProject(projectId);

    return {
      success: result.success,
      message: result.message,
    };
  }

  // ==========================================================================
  // BOM HANDLERS
  // ==========================================================================

  async handleAddBOMItem(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project should I add this to?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    // Try to parse from raw text
    if (entities.rawText && !entities.itemName) {
      const parsed = await parseBOMFromText(entities.rawText);
      if (parsed.items.length > 0) {
        // Add all parsed items
        const addedItems: string[] = [];
        for (const item of parsed.items) {
          const result = await addBOMItem(projectId, {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            description: item.description,
            category: item.category,
            estimatedPrice: item.estimatedPrice,
            priority: entities.itemPriority || 'medium',
          });
          addedItems.push(result.item.name);
        }

        return {
          success: true,
          message: `Added ${addedItems.length} item(s) to the BOM: ${addedItems.join(', ')}. Ready to source these?`,
          data: { itemCount: addedItems.length, items: addedItems, projectId },
          actions: [
            { label: 'Source all items', action: 'source_bom', params: { projectId } },
            { label: 'View BOM', action: 'list_bom', params: { projectId } },
          ],
        };
      }
    }

    if (!entities.itemName) {
      return {
        success: false,
        message: "What materials do you need to add? Just tell me like: '500 motors at $25 each' or '1000 aluminum brackets'",
        requiresFollowUp: true,
        followUpPrompt: 'bom_item',
      };
    }

    const result = await addBOMItem(projectId, {
      name: entities.itemName,
      quantity: entities.itemQuantity || 1,
      unit: entities.itemUnit || 'each',
      estimatedPrice: entities.itemPrice,
      category: entities.itemCategory,
      priority: entities.itemPriority || 'medium',
    });

    return {
      success: true,
      message: result.message,
      data: { item: result.item, projectId },
      actions: [
        { label: 'Add more items', action: 'add_bom_item', params: { projectId } },
        { label: 'Source this item', action: 'source_bom', params: { projectId, itemId: result.item.id } },
      ],
    };
  }

  async handleListBOM(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project's BOM would you like to see?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const items = await getBOMItems(projectId);

    if (items.length === 0) {
      return {
        success: true,
        message: "This project doesn't have any BOM items yet. What materials do you need?",
        actions: [
          { label: 'Add items', action: 'add_bom_item', params: { projectId } },
        ],
      };
    }

    const summary = await getBOMSummary(projectId);
    const topItems = items.slice(0, 10).map(i => {
      const price = i.estimatedPrice ? `$${(i.estimatedPrice * i.quantity).toLocaleString()}` : 'TBD';
      return `- ${i.quantity} ${i.unit} **${i.name}** - ${i.status} (${price})`;
    }).join('\n');

    let message = `**BOM Summary:** ${summary.totalItems} items, $${summary.totalEstimate.toLocaleString()} estimated\n\n`;
    message += topItems;

    if (summary.itemsNeedingAction > 0) {
      message += `\n\n${summary.itemsNeedingAction} items need sourcing.`;
    }

    return {
      success: true,
      message,
      data: { items, summary, projectId },
      actions: [
        { label: 'Source all needed', action: 'source_bom', params: { projectId } },
        { label: 'Add more items', action: 'add_bom_item', params: { projectId } },
        { label: 'Budget variance', action: 'bom_summary', params: { projectId } },
      ],
    };
  }

  async handleUpdateBOMItem(entities: FounderEntities): Promise<HandlerResult> {
    // This would update a specific BOM item
    return {
      success: true,
      message: "What would you like to change about this item?",
      requiresFollowUp: true,
      followUpPrompt: 'bom_update',
    };
  }

  async handleSourceBOM(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project's materials should I source?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const result = await autoSourceBOM(projectId);

    return {
      success: result.rfqsCreated > 0,
      message: result.message,
      data: {
        processed: result.processed,
        rfqsCreated: result.rfqsCreated,
        suppliersFound: result.suppliersFound,
        projectId,
      },
      actions: result.rfqsCreated > 0 ? [
        { label: 'View RFQs', action: 'view_rfqs' },
        { label: 'View BOM', action: 'list_bom', params: { projectId } },
      ] : [],
    };
  }

  async handleBOMSummary(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project's BOM summary would you like?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const variance = await getBOMBudgetVariance(projectId);

    let message = variance.message + '\n\n';

    if (variance.overBudgetItems.length > 0) {
      message += '**Over budget items:**\n';
      message += variance.overBudgetItems.map(i => `- ${i.name}: +$${i.variance.toLocaleString()}`).join('\n');
    }

    if (variance.underBudgetItems.length > 0) {
      message += '\n\n**Under budget items:**\n';
      message += variance.underBudgetItems.map(i => `- ${i.name}: -$${i.variance.toLocaleString()}`).join('\n');
    }

    return {
      success: true,
      message,
      data: { variance, projectId },
    };
  }

  // ==========================================================================
  // MILESTONE HANDLERS
  // ==========================================================================

  async handleCreateMilestone(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project should I add this milestone to?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    if (!entities.milestoneName) {
      return {
        success: false,
        message: "What's this milestone called? And when is it due?",
        requiresFollowUp: true,
        followUpPrompt: 'milestone_details',
      };
    }

    try {
      await sql`
        INSERT INTO founder_project_milestones (
          id, project_id, name, due_date, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${projectId}, ${entities.milestoneName},
          ${entities.milestoneDate?.toISOString() || null}, 'pending', NOW(), NOW()
        )
      `;

      const dateStr = entities.milestoneDate
        ? ` due ${entities.milestoneDate.toLocaleDateString()}`
        : '';

      return {
        success: true,
        message: `Milestone "${entities.milestoneName}"${dateStr} has been added to the project.`,
        data: { projectId },
        actions: [
          { label: 'Add another', action: 'create_milestone', params: { projectId } },
          { label: 'View all milestones', action: 'list_milestones', params: { projectId } },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Couldn't create the milestone: ${message}`,
      };
    }
  }

  async handleListMilestones(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (!projectId) {
      return {
        success: false,
        message: "Which project's milestones would you like to see?",
        requiresFollowUp: true,
        followUpPrompt: 'project_selection',
      };
    }

    const result = await sql`
      SELECT * FROM founder_project_milestones
      WHERE project_id = ${projectId}
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;

    if (result.rows.length === 0) {
      return {
        success: true,
        message: "No milestones set for this project yet. Want to add some?",
        actions: [
          { label: 'Add milestone', action: 'create_milestone', params: { projectId } },
        ],
      };
    }

    const milestones = result.rows.map(m => {
      const due = m.due_date ? new Date(m.due_date).toLocaleDateString() : 'No date';
      const status = m.status === 'completed' ? '[Done]' : m.status === 'pending' ? '[Pending]' : `[${m.status}]`;
      return `- ${status} **${m.name}** - ${due}`;
    }).join('\n');

    return {
      success: true,
      message: `**Milestones:**\n\n${milestones}`,
      data: { milestones: result.rows, projectId },
    };
  }

  async handleWhatsDue(entities: FounderEntities): Promise<HandlerResult> {
    const timeframe = entities.timeframe || 'this_week';

    let endDate: Date;
    const now = new Date();

    switch (timeframe) {
      case 'today':
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'this_week':
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
        break;
      case 'this_month':
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      default:
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 7);
    }

    const projectId = entities.projectId || this.context.activeProjectId;
    const projectClause = projectId ? sql`AND project_id = ${projectId}` : sql``;

    // Get milestones due
    const milestonesResult = await sql`
      SELECT m.*, p.name as project_name
      FROM founder_project_milestones m
      JOIN founder_projects p ON m.project_id = p.id
      WHERE p.owner_id = ${this.userId}
        AND m.status != 'completed'
        AND m.due_date <= ${endDate.toISOString()}
        ${projectClause}
      ORDER BY m.due_date ASC
      LIMIT 10
    `;

    // Get tasks due
    const tasksResult = await sql`
      SELECT t.*, p.name as project_name
      FROM founder_project_tasks t
      JOIN founder_projects p ON t.project_id = p.id
      WHERE p.owner_id = ${this.userId}
        AND t.status NOT IN ('completed', 'cancelled')
        AND t.due_date <= ${endDate.toISOString()}
        ${projectClause}
      ORDER BY t.due_date ASC
      LIMIT 10
    `;

    const overdueMilestones = milestonesResult.rows.filter(m => new Date(m.due_date) < now);
    const upcomingMilestones = milestonesResult.rows.filter(m => new Date(m.due_date) >= now);

    let message = '';

    if (overdueMilestones.length > 0) {
      message += `**Overdue:**\n`;
      message += overdueMilestones.map(m =>
        `- ${m.name} (${m.project_name}) - was due ${new Date(m.due_date).toLocaleDateString()}`
      ).join('\n');
      message += '\n\n';
    }

    if (upcomingMilestones.length > 0) {
      message += `**Coming up:**\n`;
      message += upcomingMilestones.map(m =>
        `- ${m.name} (${m.project_name}) - due ${new Date(m.due_date).toLocaleDateString()}`
      ).join('\n');
    }

    if (tasksResult.rows.length > 0) {
      message += '\n\n**Tasks:**\n';
      message += tasksResult.rows.slice(0, 5).map(t =>
        `- ${t.title} (${t.project_name})`
      ).join('\n');
    }

    if (!message) {
      message = `Nothing due ${timeframe === 'today' ? 'today' : timeframe === 'this_week' ? 'this week' : 'in the selected timeframe'}. Nice work staying ahead!`;
    }

    return {
      success: true,
      message,
      data: {
        milestones: milestonesResult.rows,
        tasks: tasksResult.rows,
        overdue: overdueMilestones.length,
      },
    };
  }

  async handleUpdateMilestone(entities: FounderEntities): Promise<HandlerResult> {
    return {
      success: true,
      message: "Which milestone would you like to update, and what should I change?",
      requiresFollowUp: true,
      followUpPrompt: 'milestone_update',
    };
  }

  async handleCompleteMilestone(entities: FounderEntities): Promise<HandlerResult> {
    if (!entities.milestoneName) {
      return {
        success: false,
        message: "Which milestone did you complete?",
        requiresFollowUp: true,
        followUpPrompt: 'milestone_selection',
      };
    }

    const projectId = entities.projectId || this.context.activeProjectId;

    const result = await sql`
      UPDATE founder_project_milestones
      SET status = 'completed', updated_at = NOW()
      WHERE name ILIKE ${'%' + entities.milestoneName + '%'}
        ${projectId ? sql`AND project_id = ${projectId}` : sql``}
      RETURNING name
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that milestone. Can you be more specific?",
      };
    }

    return {
      success: true,
      message: `Milestone "${result.rows[0].name}" marked as complete. Great progress!`,
    };
  }

  // ==========================================================================
  // FINANCIAL HANDLERS
  // ==========================================================================

  async handleRunwayAnalysis(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getRunwayAnalysis(this.userId);

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    const analysis = result.analysis!;
    const runway = analysis.runwayMonths;
    const burnRate = analysis.monthlyBurnRate;

    let urgency = '';
    if (runway < 3) {
      urgency = '\n\n**Action needed:** Your runway is critically short. Consider reducing burn or raising capital.';
    } else if (runway < 6) {
      urgency = '\n\n**Note:** Consider starting fundraising conversations now while you have time.';
    }

    const message = `**Runway Analysis:**\n\n` +
      `- Cash on hand: $${analysis.cashOnHand.toLocaleString()}\n` +
      `- Monthly burn rate: $${burnRate.toLocaleString()}\n` +
      `- Runway: **${runway} months** (${new Date(Date.now() + runway * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()})\n` +
      urgency;

    return {
      success: true,
      message,
      data: { analysis },
      actions: [
        { label: 'Full financial overview', action: 'financial_overview' },
        { label: 'Reduce expenses', action: 'recommendations', params: { type: 'cost_reduction' } },
      ],
    };
  }

  async handleFinancialOverview(entities: FounderEntities): Promise<HandlerResult> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const plResult = await getPLStatement(this.userId, { start: startOfMonth, end: endOfMonth });
    const kpisResult = await getFinancialKPIs(this.userId, { start: startOfMonth, end: endOfMonth });

    if (!plResult.success || !plResult.pl) {
      return {
        success: false,
        message: "I couldn't pull your financial data. Make sure transactions are being recorded.",
      };
    }

    const pl = plResult.pl;
    const kpis = kpisResult.kpis;

    let message = `**Financial Overview - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}**\n\n`;
    message += `**Revenue:** $${pl.revenue.total.toLocaleString()}\n`;
    message += `**Expenses:** $${(pl.cogs.total + pl.operatingExpenses.total).toLocaleString()}\n`;
    message += `**Net Income:** $${pl.netIncome.toLocaleString()} (${pl.netMargin.toFixed(1)}% margin)\n`;

    if (kpis) {
      message += `\n**Key Metrics:**\n`;
      message += `- Burn rate: $${kpis.burnRate.toLocaleString()}/month\n`;
      message += `- Runway: ${kpis.runway} months\n`;
      message += `- Transactions: ${kpis.transactionCount}`;
    }

    return {
      success: true,
      message,
      data: { pl, kpis },
      actions: [
        { label: 'Cash flow', action: 'cash_flow' },
        { label: 'Budget comparison', action: 'budget_status' },
        { label: 'Runway analysis', action: 'runway_analysis' },
      ],
    };
  }

  async handleCashFlow(entities: FounderEntities): Promise<HandlerResult> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await getCashFlowStatement(this.userId, { start: startOfMonth, end: endOfMonth });

    if (!result.success || !result.cashFlow) {
      return {
        success: false,
        message: "I couldn't generate the cash flow statement.",
      };
    }

    const cf = result.cashFlow;

    let message = `**Cash Flow - ${now.toLocaleDateString('en-US', { month: 'long' })}**\n\n`;
    message += `Opening balance: $${cf.opening.toLocaleString()}\n\n`;
    message += `**Operating:**\n`;
    message += `- Inflows: +$${cf.operating.inflows.toLocaleString()}\n`;
    message += `- Outflows: -$${cf.operating.outflows.toLocaleString()}\n`;
    message += `- Net: $${cf.operating.net.toLocaleString()}\n\n`;
    message += `**Closing balance:** $${cf.closing.toLocaleString()}`;

    return {
      success: true,
      message,
      data: { cashFlow: cf },
    };
  }

  async handleExpenseTracking(entities: FounderEntities): Promise<HandlerResult> {
    if (entities.amount && entities.category) {
      // Record a new expense
      const result = await recordTransaction(this.userId, {
        type: 'expense',
        category: entities.category as Parameters<typeof recordTransaction>[1]['category'],
        amount: entities.amount,
        description: entities.rawText,
        date: new Date(),
      });

      return {
        success: result.success,
        message: result.message,
      };
    }

    // Show recent expenses
    const result = await getTransactions(this.userId, {
      type: 'expense',
      limit: 10,
    });

    if (!result.success || result.transactions!.length === 0) {
      return {
        success: true,
        message: "No recent expenses recorded. Tell me when you spend something and I'll track it.",
      };
    }

    const expenses = result.transactions!.slice(0, 5).map(t =>
      `- $${t.amount.toLocaleString()} - ${t.category} - ${t.description || 'No description'}`
    ).join('\n');

    return {
      success: true,
      message: `**Recent Expenses:**\n\n${expenses}`,
      data: { transactions: result.transactions },
    };
  }

  async handleBudgetStatus(entities: FounderEntities): Promise<HandlerResult> {
    const projectId = entities.projectId || this.context.activeProjectId;

    if (projectId) {
      // Project-specific budget
      const result = await getProject(projectId);
      if (!result.success || !result.project) {
        return { success: false, message: result.message };
      }

      const p = result.project;
      const remaining = p.budget - p.budgetSpent;
      const pct = p.budget > 0 ? Math.round((p.budgetSpent / p.budget) * 100) : 0;

      return {
        success: true,
        message: `**${p.name} Budget:**\n\n` +
          `- Total: $${p.budget.toLocaleString()}\n` +
          `- Spent: $${p.budgetSpent.toLocaleString()} (${pct}%)\n` +
          `- Remaining: $${remaining.toLocaleString()}` +
          (remaining < 0 ? '\n\n**Warning:** Over budget!' : ''),
        data: { project: p },
      };
    }

    // Overall budget comparison
    const result = await getBudgetComparison(this.userId);
    return {
      success: result.success,
      message: result.message,
      data: { comparisons: result.comparisons },
    };
  }

  // ==========================================================================
  // INBOX HANDLERS
  // ==========================================================================

  async handleShowInbox(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getThreads(this.userId, {
      channels: entities.channel ? [entities.channel as Parameters<typeof getThreads>[1]['channels'][0]] : undefined,
      limit: 10,
    });

    if (!result.success || result.threads!.length === 0) {
      return {
        success: true,
        message: "Your inbox is empty. All caught up!",
      };
    }

    const threads = result.threads!.slice(0, 5).map(t => {
      const unread = t.isRead ? '' : '[New] ';
      const sender = t.participants[0]?.name || t.participants[0]?.email || 'Unknown';
      return `- ${unread}**${sender}**: ${t.preview.substring(0, 50)}... (${t.channel})`;
    }).join('\n');

    const stats = await getInboxStats(this.userId);

    return {
      success: true,
      message: `**Inbox** (${stats.stats?.unreadCount || 0} unread)\n\n${threads}`,
      data: { threads: result.threads, stats: stats.stats },
      actions: [
        { label: 'Urgent only', action: 'urgent_messages' },
        { label: 'Unread only', action: 'unread_messages' },
      ],
    };
  }

  async handleUrgentMessages(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getThreads(this.userId, {
      priorities: ['urgent', 'high'],
      isRead: false,
      limit: 10,
    });

    if (!result.success || result.threads!.length === 0) {
      return {
        success: true,
        message: "No urgent messages right now. You're all clear!",
      };
    }

    const threads = result.threads!.map(t => {
      const sender = t.participants[0]?.name || t.participants[0]?.email || 'Unknown';
      return `- **${sender}** [${t.priority.toUpperCase()}]: ${t.preview.substring(0, 60)}...`;
    }).join('\n');

    return {
      success: true,
      message: `**Urgent Messages (${result.threads!.length}):**\n\n${threads}`,
      data: { threads: result.threads },
    };
  }

  async handleUnreadMessages(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getThreads(this.userId, {
      isRead: false,
      limit: 10,
    });

    if (!result.success || result.threads!.length === 0) {
      return {
        success: true,
        message: "No unread messages. Inbox zero!",
      };
    }

    const threads = result.threads!.map(t => {
      const sender = t.participants[0]?.name || t.participants[0]?.email || 'Unknown';
      return `- **${sender}**: ${t.preview.substring(0, 60)}...`;
    }).join('\n');

    return {
      success: true,
      message: `**Unread Messages (${result.threads!.length}):**\n\n${threads}`,
      data: { threads: result.threads },
    };
  }

  async handleReplyMessage(entities: FounderEntities): Promise<HandlerResult> {
    if (!entities.messageId) {
      return {
        success: false,
        message: "Which message would you like to reply to?",
        requiresFollowUp: true,
        followUpPrompt: 'message_selection',
      };
    }

    // Generate AI reply suggestion
    const thread = await getThread(this.userId, entities.messageId);
    if (!thread.success || !thread.thread) {
      return { success: false, message: "Couldn't find that message." };
    }

    const aiReply = await generateAIReply(this.userId, entities.messageId, {
      tone: 'professional',
    });

    return {
      success: true,
      message: `**Suggested reply:**\n\n${aiReply.suggestedReply}\n\nShould I send this, or would you like to modify it?`,
      data: { thread: thread.thread, suggestedReply: aiReply.suggestedReply },
      actions: [
        { label: 'Send as-is', action: 'send_reply', params: { threadId: entities.messageId, body: aiReply.suggestedReply } },
        { label: 'Edit reply', action: 'edit_reply' },
      ],
    };
  }

  async handleArchiveMessage(entities: FounderEntities): Promise<HandlerResult> {
    if (!entities.messageId) {
      return {
        success: false,
        message: "Which message should I archive?",
        requiresFollowUp: true,
        followUpPrompt: 'message_selection',
      };
    }

    const result = await archiveThread(this.userId, entities.messageId);
    return {
      success: result.success,
      message: result.message,
    };
  }

  // ==========================================================================
  // SOURCING HANDLERS
  // ==========================================================================

  async handleNetworkSourcing(intentType: string, entities: FounderEntities): Promise<HandlerResult> {
    const typeMap: Record<string, SourcingType> = {
      find_supplier: 'supplier',
      find_manufacturer: 'supplier',
      find_partner: 'partner',
    };

    const sourcingType = entities.sourcingType || typeMap[intentType] || 'supplier';

    if (!entities.rawText && !entities.criteria?.length) {
      return {
        success: false,
        message: `What kind of ${sourcingType} are you looking for? Tell me about your requirements.`,
        requiresFollowUp: true,
        followUpPrompt: 'sourcing_criteria',
      };
    }

    const result = await createSourcingRequest(
      this.userId,
      sourcingType,
      entities.rawText || entities.criteria?.join(', ') || '',
      {
        industries: entities.industry ? [entities.industry] : undefined,
        locations: entities.location ? [entities.location] : undefined,
      },
      {
        urgency: entities.priority as 'low' | 'medium' | 'high' | 'critical' || 'medium',
      }
    );

    if (!result.success) {
      return { success: false, message: result.message };
    }

    // Start searching
    const searchResult = await searchNetwork(result.request!.id);

    return {
      success: true,
      message: result.message + (searchResult.matches?.length
        ? `\n\nFound ${searchResult.matches.length} potential matches. Want me to request introductions?`
        : '\n\nSearching the network now. I\'ll notify you when I find matches.'),
      data: {
        request: result.request,
        matches: searchResult.matches,
      },
      actions: searchResult.matches?.length ? [
        { label: 'Request intros', action: 'request_intro', params: { requestId: result.request!.id } },
        { label: 'View matches', action: 'sourcing_status', params: { requestId: result.request!.id } },
      ] : [],
    };
  }

  async handleRequestIntro(entities: FounderEntities): Promise<HandlerResult> {
    // Get active sourcing requests
    const requests = await getSourcingRequests(this.userId, { status: ['matches_found', 'searching'] });

    if (!requests.success || requests.requests!.length === 0) {
      return {
        success: false,
        message: "No active sourcing requests with matches. Start a new search?",
        actions: [
          { label: 'Find suppliers', action: 'find_supplier' },
          { label: 'Find partners', action: 'find_partner' },
        ],
      };
    }

    // Get matches for the most recent request
    const requestId = requests.requests![0].id;
    const matches = await getNetworkMatches(requestId);

    if (!matches.success || matches.matches!.length === 0) {
      return {
        success: false,
        message: "No matches found yet. I'm still searching.",
      };
    }

    // Request intro to top matches
    let introsRequested = 0;
    for (const match of matches.matches!.slice(0, 3)) {
      const result = await requestIntroduction(requestId, match.id);
      if (result.success) introsRequested++;
    }

    return {
      success: true,
      message: `Requested ${introsRequested} introduction(s). The matched contacts will receive your request and can choose to connect.`,
      data: { introsRequested, matches: matches.matches },
    };
  }

  async handleSourcingStatus(entities: FounderEntities): Promise<HandlerResult> {
    const result = await getSourcingRequests(this.userId, { limit: 5 });

    if (!result.success || result.requests!.length === 0) {
      return {
        success: true,
        message: "No active sourcing requests. Want to search the network for something?",
        actions: [
          { label: 'Find suppliers', action: 'find_supplier' },
          { label: 'Find talent', action: 'create_job' },
          { label: 'Find partners', action: 'find_partner' },
        ],
      };
    }

    const requests = result.requests!.map(r =>
      `- **${r.type}**: ${r.description.substring(0, 40)}... - ${r.matchCount} matches, ${r.introCount} intros`
    ).join('\n');

    const stats = await getNetworkStats(this.userId);

    return {
      success: true,
      message: `**Network Sourcing Status:**\n\n${requests}\n\n` +
        `Total conversions: ${stats.stats?.totalConversions || 0} (${((stats.stats?.conversionRate || 0) * 100).toFixed(1)}% rate)`,
      data: { requests: result.requests, stats: stats.stats },
    };
  }

  // ==========================================================================
  // HIRING HANDLERS
  // ==========================================================================

  async handleCreateJob(entities: FounderEntities): Promise<HandlerResult> {
    // Try to parse from raw text
    if (entities.rawText && !entities.role) {
      const parsed = await parseJobFromText(entities.rawText);
      if (parsed.success && parsed.parsed) {
        entities.role = parsed.parsed.title;
        entities.skills = parsed.parsed.skills;
        entities.salary = { min: parsed.parsed.salaryMin, max: parsed.parsed.salaryMax };
        entities.hiringType = parsed.parsed.type;
      }
    }

    if (!entities.role) {
      return {
        success: false,
        message: "What role are you hiring for? Tell me about the position.",
        requiresFollowUp: true,
        followUpPrompt: 'job_details',
      };
    }

    const result = await createJobPosting(this.userId, {
      title: entities.role,
      description: entities.rawText || `Looking for a ${entities.role}`,
      type: entities.hiringType || 'full_time',
      location: entities.location || 'Remote',
      isRemote: true,
      salaryMin: entities.salary?.min,
      salaryMax: entities.salary?.max,
      skills: entities.skills || [],
    });

    if (!result.success) {
      return { success: false, message: result.message };
    }

    // Auto-search network
    const networkSearch = await searchNetworkForJob(result.job!.id);

    return {
      success: true,
      message: result.message +
        (networkSearch.matches?.length
          ? `\n\nFound ${networkSearch.matches.length} potential candidates in the Wells network!`
          : '\n\nSearching the Wells network for matches...'),
      data: { job: result.job, networkMatches: networkSearch.matches },
      actions: [
        { label: 'Publish job', action: 'publish_job', params: { jobId: result.job!.id } },
        { label: 'View candidates', action: 'list_candidates', params: { jobId: result.job!.id } },
      ],
    };
  }

  async handleListCandidates(entities: FounderEntities): Promise<HandlerResult> {
    // Get all jobs first
    const jobs = await getJobPostings(this.userId, { status: ['sourcing', 'reviewing', 'interviewing'] });

    if (!jobs.success || jobs.jobs!.length === 0) {
      return {
        success: true,
        message: "No active job postings. Create a job to start receiving candidates.",
        actions: [
          { label: 'Create job', action: 'create_job' },
        ],
      };
    }

    // Get candidates for first job (or specified job)
    const jobId = entities.projectId || jobs.jobs![0].id;
    const candidates = await getCandidatesForJob(jobId, { limit: 10 });

    if (!candidates.success || candidates.candidates!.length === 0) {
      return {
        success: true,
        message: `No candidates yet for "${jobs.jobs![0].title}". I'm still searching the network.`,
      };
    }

    const candidateList = candidates.candidates!.slice(0, 5).map(c =>
      `- **${c.name}** (${c.source}) - ${c.matchScore ? c.matchScore + '% match' : c.status}`
    ).join('\n');

    return {
      success: true,
      message: `**Candidates for ${jobs.jobs![0].title}:**\n\n${candidateList}`,
      data: { candidates: candidates.candidates, job: jobs.jobs![0] },
      actions: [
        { label: 'Schedule interview', action: 'schedule_interview' },
        { label: 'View all jobs', action: 'hiring_status' },
      ],
    };
  }

  async handleHiringStatus(entities: FounderEntities): Promise<HandlerResult> {
    const stats = await getHiringStats(this.userId);
    const jobs = await getJobPostings(this.userId, { limit: 5 });

    if (!stats.success) {
      return { success: false, message: stats.message };
    }

    const s = stats.stats!;
    let message = `**Hiring Dashboard:**\n\n`;
    message += `- Open roles: ${s.totalOpenJobs}\n`;
    message += `- Total candidates: ${s.totalCandidates}\n`;
    message += `- In-network hire rate: ${(s.inNetworkHireRate * 100).toFixed(0)}%\n`;
    message += `- Interviews this week: ${s.interviewsThisWeek}\n`;

    if (jobs.success && jobs.jobs!.length > 0) {
      message += `\n**Active Roles:**\n`;
      message += jobs.jobs!.slice(0, 3).map(j =>
        `- ${j.title} (${j.status}): ${j.inNetworkMatches} network matches, ${j.externalApplicants} external`
      ).join('\n');
    }

    return {
      success: true,
      message,
      data: { stats: s, jobs: jobs.jobs },
      actions: [
        { label: 'Create new role', action: 'create_job' },
        { label: 'View candidates', action: 'list_candidates' },
      ],
    };
  }

  async handleScheduleInterview(entities: FounderEntities): Promise<HandlerResult> {
    return {
      success: true,
      message: "Which candidate would you like to interview, and when works for you?",
      requiresFollowUp: true,
      followUpPrompt: 'interview_details',
    };
  }

  async handleMakeOffer(entities: FounderEntities): Promise<HandlerResult> {
    return {
      success: true,
      message: "Who should I prepare an offer for? I'll need the salary, start date, and any other terms.",
      requiresFollowUp: true,
      followUpPrompt: 'offer_details',
    };
  }

  // ==========================================================================
  // INSIGHTS HANDLERS
  // ==========================================================================

  async handleBusinessInsights(entities: FounderEntities): Promise<HandlerResult> {
    // Aggregate data from all services
    const [
      projectsResult,
      financialResult,
      hiringResult,
      inboxResult,
      sourcingResult,
    ] = await Promise.all([
      getProjectsByOwner(this.userId, { status: ['active', 'planning'] }),
      getRunwayAnalysis(this.userId),
      getHiringStats(this.userId),
      getInboxStats(this.userId),
      getNetworkStats(this.userId),
    ]);

    let message = `**Business Health Check:**\n\n`;

    // Projects
    const activeProjects = projectsResult.projects?.length || 0;
    message += `**Projects:** ${activeProjects} active\n`;

    // Financial
    if (financialResult.success && financialResult.analysis) {
      const runway = financialResult.analysis.runwayMonths;
      const runwayEmoji = runway < 3 ? '[!]' : runway < 6 ? '[*]' : '';
      message += `**Runway:** ${runway} months ${runwayEmoji}\n`;
      message += `**Burn:** $${financialResult.analysis.monthlyBurnRate.toLocaleString()}/mo\n`;
    }

    // Hiring
    if (hiringResult.success && hiringResult.stats) {
      message += `**Hiring:** ${hiringResult.stats.totalOpenJobs} open roles, ${hiringResult.stats.totalCandidates} candidates\n`;
    }

    // Inbox
    if (inboxResult.success && inboxResult.stats) {
      const urgent = inboxResult.stats.byPriority?.urgent || 0;
      message += `**Inbox:** ${inboxResult.stats.unreadCount} unread${urgent > 0 ? `, ${urgent} urgent` : ''}\n`;
    }

    // Sourcing
    if (sourcingResult.success && sourcingResult.stats) {
      message += `**Network:** ${sourcingResult.stats.activeRequests} active searches\n`;
    }

    // Generate AI insights
    const aiInsight = await this.generateAIInsight({
      projects: activeProjects,
      runway: financialResult.analysis?.runwayMonths,
      openRoles: hiringResult.stats?.totalOpenJobs,
      urgentMessages: inboxResult.stats?.byPriority?.urgent,
    });

    if (aiInsight) {
      message += `\n**Insight:** ${aiInsight}`;
    }

    return {
      success: true,
      message,
      data: {
        projects: projectsResult.projects,
        financial: financialResult.analysis,
        hiring: hiringResult.stats,
        inbox: inboxResult.stats,
        sourcing: sourcingResult.stats,
      },
      actions: [
        { label: 'Financial details', action: 'financial_overview' },
        { label: 'What\'s due?', action: 'whats_due' },
        { label: 'Recommendations', action: 'recommendations' },
      ],
    };
  }

  async handleKPIDashboard(entities: FounderEntities): Promise<HandlerResult> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const kpis = await getFinancialKPIs(this.userId, { start: startOfMonth, end: endOfMonth });

    if (!kpis.success || !kpis.kpis) {
      return {
        success: false,
        message: "Couldn't fetch KPIs. Make sure you have transaction data recorded.",
      };
    }

    const k = kpis.kpis;

    let message = `**Key Performance Indicators:**\n\n`;
    message += `- Gross Margin: ${k.grossMargin.toFixed(1)}%\n`;
    message += `- Net Margin: ${k.netMargin.toFixed(1)}%\n`;
    message += `- Burn Rate: $${k.burnRate.toLocaleString()}/mo\n`;
    message += `- Runway: ${k.runway} months\n`;
    message += `- Avg Transaction: $${k.averageTransactionSize.toLocaleString()}\n`;
    message += `- Transaction Count: ${k.transactionCount}`;

    if (k.revenueGrowth !== undefined) {
      message += `\n- Revenue Growth: ${k.revenueGrowth > 0 ? '+' : ''}${k.revenueGrowth.toFixed(1)}%`;
    }

    return {
      success: true,
      message,
      data: { kpis: k },
    };
  }

  async handleRecommendations(entities: FounderEntities): Promise<HandlerResult> {
    // Gather context for AI recommendations
    const [financial, hiring, projects] = await Promise.all([
      getRunwayAnalysis(this.userId),
      getHiringStats(this.userId),
      getProjectsByOwner(this.userId),
    ]);

    const context = {
      runway: financial.analysis?.runwayMonths,
      burnRate: financial.analysis?.monthlyBurnRate,
      openRoles: hiring.stats?.totalOpenJobs,
      activeProjects: projects.projects?.filter(p => p.status === 'active').length,
      pendingCandidates: hiring.stats?.totalCandidates,
    };

    const recommendations = await this.generateRecommendations(context);

    return {
      success: true,
      message: `**Recommendations:**\n\n${recommendations}`,
      data: { context },
    };
  }

  async handleDailyDigest(entities: FounderEntities): Promise<HandlerResult> {
    // Compile daily digest
    const [whats, inbox, hiring] = await Promise.all([
      this.handleWhatsDue({ timeframe: 'today' }),
      this.handleUrgentMessages({}),
      getHiringStats(this.userId),
    ]);

    let message = `**Good morning! Here's your daily digest:**\n\n`;

    // Due today
    if (whats.data?.milestones?.length || whats.data?.tasks?.length) {
      message += `**Due Today:**\n${whats.message.split('\n').slice(0, 5).join('\n')}\n\n`;
    } else {
      message += `**Due Today:** Nothing urgent. Nice!\n\n`;
    }

    // Urgent messages
    if (inbox.data?.threads?.length) {
      message += `**Needs Attention:** ${inbox.data.threads.length} urgent message(s)\n\n`;
    }

    // Hiring updates
    if (hiring.stats?.interviewsThisWeek) {
      message += `**Hiring:** ${hiring.stats.interviewsThisWeek} interview(s) scheduled this week\n`;
    }

    return {
      success: true,
      message,
      actions: [
        { label: 'Full inbox', action: 'show_inbox' },
        { label: 'Week ahead', action: 'whats_due', params: { timeframe: 'this_week' } },
        { label: 'Business health', action: 'business_insights' },
      ],
    };
  }

  // ==========================================================================
  // MARKETING HANDLERS
  // ==========================================================================

  async handleDraftContent(entities: FounderEntities): Promise<HandlerResult> {
    // Parse content type from raw text
    let contentType = entities.contentType || 'social_post';
    if (entities.rawText) {
      const lower = entities.rawText.toLowerCase();
      if (lower.includes('linkedin')) contentType = 'linkedin_post';
      else if (lower.includes('twitter') || lower.includes('tweet')) contentType = 'twitter_post';
      else if (lower.includes('email')) contentType = 'email';
      else if (lower.includes('blog')) contentType = 'blog';
      else if (lower.includes('ad')) contentType = 'ad_copy';
      else if (lower.includes('press')) contentType = 'press_release';
    }

    const result = await generateCopy(this.userId, contentType as Parameters<typeof generateCopy>[1], {
      product: entities.topic,
      targetAudience: entities.targetAudience,
      tone: entities.tone || 'professional',
      keyMessages: entities.rawText ? [entities.rawText] : undefined,
    });

    return {
      success: true,
      message: `**Draft ${contentType.replace('_', ' ')}:**\n\n${result.content.content}\n\n---\n${result.message}`,
      data: { content: result.content },
      actions: [
        { label: 'Generate variants', action: 'generate_variants', params: { contentId: result.content.id } },
        { label: 'Approve & publish', action: 'publish_content', params: { contentId: result.content.id } },
        { label: 'Try different tone', action: 'draft_content', params: { ...entities, tone: 'casual' } },
      ],
    };
  }

  async handleCreateCampaign(entities: FounderEntities): Promise<HandlerResult> {
    return {
      success: true,
      message: "What platform should this campaign run on, and what's your budget? I can help set up Google, Meta, LinkedIn, or Twitter ads.",
      requiresFollowUp: true,
      followUpPrompt: 'campaign_details',
    };
  }

  async handleMarketingAnalytics(entities: FounderEntities): Promise<HandlerResult> {
    const spend = await getMarketingSpend(this.userId, {});
    const campaigns = await getCampaigns(this.userId, { status: ['active'] });

    let message = `**Marketing Analytics:**\n\n`;

    if (spend.success && spend.spend) {
      message += `**Total Spend:** $${spend.spend.total.toLocaleString()}\n`;
      message += `**This Month:** $${spend.spend.thisMonth.toLocaleString()}\n`;
    }

    if (campaigns.success && campaigns.campaigns!.length > 0) {
      message += `\n**Active Campaigns:**\n`;
      message += campaigns.campaigns!.slice(0, 3).map(c =>
        `- ${c.name} (${c.platform}): $${c.spent.toLocaleString()} spent, ${c.performance?.conversions || 0} conversions`
      ).join('\n');
    } else {
      message += '\nNo active campaigns. Want to create one?';
    }

    return {
      success: true,
      message,
      data: { spend: spend.spend, campaigns: campaigns.campaigns },
      actions: [
        { label: 'Create campaign', action: 'create_campaign' },
        { label: 'Draft content', action: 'draft_content' },
      ],
    };
  }

  // ==========================================================================
  // UNIVERSAL HANDLERS
  // ==========================================================================

  async handleHelp(): Promise<HandlerResult> {
    const message = `**I'm Wells, your business co-pilot. Here's what I can help with:**

**Projects & BOM**
- "Start a new hardware project"
- "Add 500 motors to the BOM"
- "What's the project status?"

**Deadlines & Tasks**
- "What's due this week?"
- "Add a milestone for product launch"

**Finances**
- "What's my runway?"
- "Show me financials"
- "How's the budget?"

**Communications**
- "Show urgent messages"
- "Any unread messages?"

**Network & Sourcing**
- "Find me a manufacturer in Asia"
- "I need a PCB supplier"

**Hiring**
- "I need a frontend developer"
- "Show me candidates"
- "Hiring status"

**Business Insights**
- "How's the business doing?"
- "Give me my daily digest"

**Marketing**
- "Draft a LinkedIn post about our launch"
- "Create a marketing campaign"

Just talk to me naturally - I'll figure out what you need!`;

    return {
      success: true,
      message,
      actions: [
        { label: 'Daily digest', action: 'daily_digest' },
        { label: 'Business health', action: 'business_insights' },
        { label: 'What\'s due?', action: 'whats_due' },
      ],
    };
  }

  async handleClarify(entities: FounderEntities): Promise<HandlerResult> {
    return {
      success: false,
      message: "I'm not quite sure what you need. Could you tell me more? For example:\n" +
        "- 'Start a new project called X'\n" +
        "- 'Add 500 motors to the BOM'\n" +
        "- 'What's my runway?'\n" +
        "- 'Find me a supplier for PCBs'",
      requiresFollowUp: true,
      followUpPrompt: 'clarification',
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async generateAIInsight(data: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Based on this founder's business data, give ONE actionable insight in 1-2 sentences:
${JSON.stringify(data)}

Be specific and practical. Don't be generic.`,
          },
        ],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : null;
    } catch {
      return null;
    }
  }

  private async generateRecommendations(context: Record<string, unknown>): Promise<string> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Based on this founder's situation, provide 3-5 specific recommendations:
${JSON.stringify(context)}

Format as bullet points. Be actionable and specific, not generic.`,
          },
        ],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : 'Unable to generate recommendations.';
    } catch {
      return 'Unable to generate recommendations at this time.';
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConversationalFounder;
