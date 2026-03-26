// @ts-nocheck
/**
 * Founder Journey Intent Handler - Wells AI
 *
 * Handles all conversational intents for the founder journey:
 * - Project management ("Start a new hardware project")
 * - BOM management ("Add 500 motors to the BOM")
 * - Milestone tracking ("What's due this week?")
 * - Financial overview ("What's my runway?")
 * - Unified inbox ("Show me urgent messages")
 * - Network sourcing ("Find me a manufacturer")
 * - Hiring ("I need a frontend developer")
 * - Business insights ("How's the business doing?")
 * - Marketing content ("Draft a LinkedIn post")
 *
 * This handler translates natural language into actions across all founder services.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ConversationalFounder, type FounderContext } from '@/lib/founder/conversational-founder';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export type FounderIntentType =
  // Project intents
  | 'create_project'
  | 'list_projects'
  | 'project_status'
  | 'update_project'
  | 'delete_project'
  // BOM intents
  | 'add_bom_item'
  | 'list_bom'
  | 'update_bom_item'
  | 'source_bom'
  | 'bom_summary'
  // Milestone/Task intents
  | 'create_milestone'
  | 'list_milestones'
  | 'whats_due'
  | 'update_milestone'
  | 'complete_milestone'
  // Financial intents
  | 'runway_analysis'
  | 'financial_overview'
  | 'cash_flow'
  | 'expense_tracking'
  | 'budget_status'
  // Inbox intents
  | 'show_inbox'
  | 'urgent_messages'
  | 'unread_messages'
  | 'reply_message'
  | 'archive_message'
  // Sourcing intents
  | 'find_supplier'
  | 'find_manufacturer'
  | 'find_partner'
  | 'request_intro'
  | 'sourcing_status'
  // Hiring intents
  | 'create_job'
  | 'list_candidates'
  | 'hiring_status'
  | 'schedule_interview'
  | 'make_offer'
  // Insights intents
  | 'business_insights'
  | 'kpi_dashboard'
  | 'recommendations'
  | 'daily_digest'
  // Marketing intents
  | 'draft_content'
  | 'create_campaign'
  | 'marketing_analytics'
  // Universal
  | 'help'
  | 'clarify';

export interface FounderIntent {
  type: FounderIntentType;
  confidence: number;
  entities: FounderEntities;
  requiresConfirmation: boolean;
  suggestedAction?: string;
}

export interface FounderEntities {
  // Project entities
  projectName?: string;
  projectId?: string;
  projectBudget?: number;
  projectDeadline?: Date;
  projectType?: 'hardware' | 'software' | 'service' | 'hybrid';

  // BOM entities
  itemName?: string;
  itemQuantity?: number;
  itemUnit?: string;
  itemPrice?: number;
  itemCategory?: string;
  itemPriority?: 'low' | 'medium' | 'high' | 'critical';

  // Milestone entities
  milestoneName?: string;
  milestoneDate?: Date;
  milestoneStatus?: string;

  // Financial entities
  timeframe?: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'custom';
  amount?: number;
  category?: string;

  // Inbox entities
  channel?: string;
  priority?: string;
  sender?: string;
  messageId?: string;

  // Sourcing entities
  sourcingType?: 'supplier' | 'manufacturer' | 'partner' | 'customer' | 'talent' | 'investor';
  industry?: string;
  location?: string;
  criteria?: string[];

  // Hiring entities
  role?: string;
  skills?: string[];
  salary?: { min?: number; max?: number };
  hiringType?: 'full_time' | 'part_time' | 'contract' | 'freelance';

  // Marketing entities
  contentType?: 'linkedin_post' | 'twitter_post' | 'email' | 'blog' | 'ad_copy' | 'press_release';
  topic?: string;
  tone?: string;
  targetAudience?: string;

  // Raw values
  rawText?: string;
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

// ============================================================================
// INTENT PATTERNS
// ============================================================================

const INTENT_PATTERNS: Record<FounderIntentType, string[]> = {
  // Project patterns
  create_project: [
    'start a project', 'new project', 'create project', 'begin project',
    'launch project', 'start hardware project', 'start software project',
    'kick off', 'new venture', 'new initiative'
  ],
  list_projects: [
    'show projects', 'my projects', 'list projects', 'all projects',
    'project list', 'what projects', 'active projects'
  ],
  project_status: [
    'project status', 'how is the project', 'project progress',
    'project update', 'where are we on', 'project health'
  ],
  update_project: [
    'update project', 'change project', 'modify project',
    'edit project', 'adjust budget', 'extend deadline'
  ],
  delete_project: [
    'delete project', 'cancel project', 'close project',
    'end project', 'archive project'
  ],

  // BOM patterns
  add_bom_item: [
    'add to bom', 'add material', 'add component', 'add part',
    'need to order', 'add supplies', 'add item', 'put on bom',
    'motors', 'sensors', 'components', 'materials'
  ],
  list_bom: [
    'show bom', 'bill of materials', 'list materials',
    'what do we need', 'bom items', 'parts list'
  ],
  update_bom_item: [
    'update bom', 'change quantity', 'modify item',
    'adjust price', 'update priority'
  ],
  source_bom: [
    'source materials', 'find suppliers for bom', 'get quotes',
    'rfq for bom', 'order materials', 'procure'
  ],
  bom_summary: [
    'bom summary', 'bom status', 'material status',
    'bom cost', 'bom budget'
  ],

  // Milestone patterns
  create_milestone: [
    'add milestone', 'create milestone', 'new milestone',
    'set deadline', 'add deliverable'
  ],
  list_milestones: [
    'show milestones', 'list milestones', 'all milestones',
    'upcoming milestones', 'project timeline'
  ],
  whats_due: [
    "what's due", 'due this week', 'due today', 'upcoming deadlines',
    'what do i need to do', 'tasks due', 'deadlines',
    'this week', 'next week'
  ],
  update_milestone: [
    'update milestone', 'change milestone', 'push back',
    'reschedule', 'modify deadline'
  ],
  complete_milestone: [
    'complete milestone', 'mark done', 'finish milestone',
    'achieved', 'completed'
  ],

  // Financial patterns
  runway_analysis: [
    'runway', 'how long', 'burn rate', 'months left',
    'cash runway', 'when do we run out'
  ],
  financial_overview: [
    'financials', 'financial overview', 'money situation',
    'p&l', 'profit and loss', 'financial health'
  ],
  cash_flow: [
    'cash flow', 'cash position', 'liquidity',
    'money coming in', 'money going out'
  ],
  expense_tracking: [
    'expenses', 'spending', 'what did i spend',
    'track expense', 'log expense'
  ],
  budget_status: [
    'budget', 'budget status', 'over budget',
    'under budget', 'budget variance'
  ],

  // Inbox patterns
  show_inbox: [
    'show inbox', 'my messages', 'check messages',
    'inbox', 'communications', 'mail'
  ],
  urgent_messages: [
    'urgent messages', 'important messages', 'priority messages',
    'urgent', 'critical messages', 'need attention'
  ],
  unread_messages: [
    'unread', 'new messages', 'haven\'t read',
    'unread count', 'what\'s new'
  ],
  reply_message: [
    'reply to', 'respond to', 'answer',
    'write back', 'send message'
  ],
  archive_message: [
    'archive', 'dismiss', 'mark read',
    'clear message', 'done with'
  ],

  // Sourcing patterns
  find_supplier: [
    'find supplier', 'find vendor', 'source from',
    'need a supplier', 'supplier for'
  ],
  find_manufacturer: [
    'find manufacturer', 'find factory', 'who can make',
    'manufacturing partner', 'production facility'
  ],
  find_partner: [
    'find partner', 'strategic partner', 'partnership',
    'collaboration', 'joint venture'
  ],
  request_intro: [
    'introduce me', 'connect me', 'warm intro',
    'introduction to', 'meet'
  ],
  sourcing_status: [
    'sourcing status', 'intro status', 'match status',
    'sourcing progress', 'network matches'
  ],

  // Hiring patterns
  create_job: [
    'hire', 'need a', 'looking for', 'recruit',
    'find me a', 'job posting', 'open role',
    'developer', 'engineer', 'designer', 'cto', 'cfo'
  ],
  list_candidates: [
    'candidates', 'applicants', 'who applied',
    'candidate list', 'applications'
  ],
  hiring_status: [
    'hiring status', 'recruiting progress', 'pipeline',
    'hiring pipeline', 'open roles'
  ],
  schedule_interview: [
    'schedule interview', 'set up interview', 'interview',
    'meet candidate', 'talk to'
  ],
  make_offer: [
    'make offer', 'send offer', 'extend offer',
    'offer letter', 'hire them'
  ],

  // Insights patterns
  business_insights: [
    'how is the business', 'business doing', 'company status',
    'overall health', 'business health', 'how are we doing'
  ],
  kpi_dashboard: [
    'kpis', 'metrics', 'dashboard',
    'key metrics', 'performance'
  ],
  recommendations: [
    'recommendations', 'what should i', 'suggest',
    'advice', 'next steps'
  ],
  daily_digest: [
    'daily digest', 'morning brief', 'what do i need to know',
    'summary', 'catch me up'
  ],

  // Marketing patterns
  draft_content: [
    'draft', 'write', 'create post', 'linkedin post',
    'twitter post', 'blog post', 'email', 'copy',
    'marketing content', 'announcement'
  ],
  create_campaign: [
    'campaign', 'ad campaign', 'marketing campaign',
    'run ads', 'promote', 'advertising'
  ],
  marketing_analytics: [
    'marketing metrics', 'ad performance', 'campaign results',
    'marketing roi', 'engagement'
  ],

  // Universal
  help: [
    'help', 'what can you do', 'capabilities',
    'how do i', 'assist'
  ],
  clarify: []
};

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

/**
 * Quick pattern-based classification
 */
function quickClassify(message: string): FounderIntent | null {
  const lower = message.toLowerCase().trim();

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return {
          type: intentType as FounderIntentType,
          confidence: 0.7,
          entities: { rawText: message },
          requiresConfirmation: false,
        };
      }
    }
  }

  return null;
}

/**
 * AI-powered intent classification with entity extraction
 */
export async function classifyFounderIntent(
  message: string,
  context?: FounderContext
): Promise<FounderIntent> {
  // Try quick classification first
  const quickResult = quickClassify(message);

  const systemPrompt = `You are an intent classifier for Wells AI, helping founders manage their business.

USER CONTEXT:
${context ? `
- Active Project: ${context.activeProjectId || 'None'}
- Primary Journey: ${context.primaryJourney || 'founder'}
- Recent Topic: ${context.recentTopic || 'None'}
` : 'New conversation'}

INTENT TYPES:
1. PROJECT: create_project, list_projects, project_status, update_project, delete_project
2. BOM: add_bom_item, list_bom, update_bom_item, source_bom, bom_summary
3. MILESTONES: create_milestone, list_milestones, whats_due, update_milestone, complete_milestone
4. FINANCIAL: runway_analysis, financial_overview, cash_flow, expense_tracking, budget_status
5. INBOX: show_inbox, urgent_messages, unread_messages, reply_message, archive_message
6. SOURCING: find_supplier, find_manufacturer, find_partner, request_intro, sourcing_status
7. HIRING: create_job, list_candidates, hiring_status, schedule_interview, make_offer
8. INSIGHTS: business_insights, kpi_dashboard, recommendations, daily_digest
9. MARKETING: draft_content, create_campaign, marketing_analytics
10. UNIVERSAL: help, clarify

RESPOND WITH JSON ONLY:
{
  "type": "intent_type",
  "confidence": 0.0-1.0,
  "entities": {
    "projectName": "string or null",
    "projectBudget": number or null,
    "projectType": "hardware|software|service|hybrid or null",
    "itemName": "string or null",
    "itemQuantity": number or null,
    "itemUnit": "string or null",
    "itemPrice": number or null,
    "milestoneName": "string or null",
    "milestoneDate": "ISO date or null",
    "timeframe": "today|this_week|this_month|this_quarter|this_year or null",
    "amount": number or null,
    "category": "string or null",
    "channel": "string or null",
    "priority": "string or null",
    "sourcingType": "supplier|manufacturer|partner|customer|talent|investor or null",
    "industry": "string or null",
    "location": "string or null",
    "role": "string or null",
    "skills": ["array"] or null,
    "salary": { "min": number, "max": number } or null,
    "hiringType": "full_time|part_time|contract|freelance or null",
    "contentType": "linkedin_post|twitter_post|email|blog|ad_copy|press_release or null",
    "topic": "string or null",
    "tone": "string or null",
    "targetAudience": "string or null"
  },
  "requiresConfirmation": boolean,
  "suggestedAction": "what Wells should do next"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Classify this founder request: "${message}"`,
        },
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      // Boost confidence if quick classification agrees
      if (quickResult && quickResult.type === parsed.type) {
        parsed.confidence = Math.min(1, (parsed.confidence || 0.7) + 0.15);
      }

      return {
        type: parsed.type || 'clarify',
        confidence: parsed.confidence || 0.5,
        entities: {
          ...parsed.entities,
          rawText: message,
        },
        requiresConfirmation: parsed.requiresConfirmation || false,
        suggestedAction: parsed.suggestedAction,
      };
    } catch {
      return quickResult || {
        type: 'clarify',
        confidence: 0.3,
        entities: { rawText: message },
        requiresConfirmation: true,
      };
    }
  } catch (error) {
    console.error('[FounderHandler] Classification error:', error);
    return quickResult || {
      type: 'clarify',
      confidence: 0.3,
      entities: { rawText: message },
      requiresConfirmation: true,
    };
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * Handle a classified founder intent
 */
export async function handleFounderIntent(
  intent: FounderIntent,
  context: FounderContext
): Promise<HandlerResult> {
  const founder = new ConversationalFounder(context);

  switch (intent.type) {
    // ========== PROJECT HANDLERS ==========
    case 'create_project':
      return founder.handleCreateProject(intent.entities);

    case 'list_projects':
      return founder.handleListProjects(intent.entities);

    case 'project_status':
      return founder.handleProjectStatus(intent.entities);

    case 'update_project':
      return founder.handleUpdateProject(intent.entities);

    case 'delete_project':
      return founder.handleDeleteProject(intent.entities);

    // ========== BOM HANDLERS ==========
    case 'add_bom_item':
      return founder.handleAddBOMItem(intent.entities);

    case 'list_bom':
      return founder.handleListBOM(intent.entities);

    case 'update_bom_item':
      return founder.handleUpdateBOMItem(intent.entities);

    case 'source_bom':
      return founder.handleSourceBOM(intent.entities);

    case 'bom_summary':
      return founder.handleBOMSummary(intent.entities);

    // ========== MILESTONE HANDLERS ==========
    case 'create_milestone':
      return founder.handleCreateMilestone(intent.entities);

    case 'list_milestones':
      return founder.handleListMilestones(intent.entities);

    case 'whats_due':
      return founder.handleWhatsDue(intent.entities);

    case 'update_milestone':
      return founder.handleUpdateMilestone(intent.entities);

    case 'complete_milestone':
      return founder.handleCompleteMilestone(intent.entities);

    // ========== FINANCIAL HANDLERS ==========
    case 'runway_analysis':
      return founder.handleRunwayAnalysis(intent.entities);

    case 'financial_overview':
      return founder.handleFinancialOverview(intent.entities);

    case 'cash_flow':
      return founder.handleCashFlow(intent.entities);

    case 'expense_tracking':
      return founder.handleExpenseTracking(intent.entities);

    case 'budget_status':
      return founder.handleBudgetStatus(intent.entities);

    // ========== INBOX HANDLERS ==========
    case 'show_inbox':
      return founder.handleShowInbox(intent.entities);

    case 'urgent_messages':
      return founder.handleUrgentMessages(intent.entities);

    case 'unread_messages':
      return founder.handleUnreadMessages(intent.entities);

    case 'reply_message':
      return founder.handleReplyMessage(intent.entities);

    case 'archive_message':
      return founder.handleArchiveMessage(intent.entities);

    // ========== SOURCING HANDLERS ==========
    case 'find_supplier':
    case 'find_manufacturer':
    case 'find_partner':
      return founder.handleNetworkSourcing(intent.type, intent.entities);

    case 'request_intro':
      return founder.handleRequestIntro(intent.entities);

    case 'sourcing_status':
      return founder.handleSourcingStatus(intent.entities);

    // ========== HIRING HANDLERS ==========
    case 'create_job':
      return founder.handleCreateJob(intent.entities);

    case 'list_candidates':
      return founder.handleListCandidates(intent.entities);

    case 'hiring_status':
      return founder.handleHiringStatus(intent.entities);

    case 'schedule_interview':
      return founder.handleScheduleInterview(intent.entities);

    case 'make_offer':
      return founder.handleMakeOffer(intent.entities);

    // ========== INSIGHTS HANDLERS ==========
    case 'business_insights':
      return founder.handleBusinessInsights(intent.entities);

    case 'kpi_dashboard':
      return founder.handleKPIDashboard(intent.entities);

    case 'recommendations':
      return founder.handleRecommendations(intent.entities);

    case 'daily_digest':
      return founder.handleDailyDigest(intent.entities);

    // ========== MARKETING HANDLERS ==========
    case 'draft_content':
      return founder.handleDraftContent(intent.entities);

    case 'create_campaign':
      return founder.handleCreateCampaign(intent.entities);

    case 'marketing_analytics':
      return founder.handleMarketingAnalytics(intent.entities);

    // ========== UNIVERSAL HANDLERS ==========
    case 'help':
      return founder.handleHelp();

    case 'clarify':
    default:
      return founder.handleClarify(intent.entities);
  }
}

// ============================================================================
// MAIN PROCESS FUNCTION
// ============================================================================

/**
 * Process a founder message through classification and handling
 */
export async function processFounderMessage(
  message: string,
  userId: string,
  sessionId: string,
  existingContext?: Partial<FounderContext>
): Promise<{
  response: string;
  intent: FounderIntent;
  result: HandlerResult;
  context: FounderContext;
}> {
  // Build context
  const context: FounderContext = {
    userId,
    sessionId,
    primaryJourney: 'founder',
    ...existingContext,
  };

  // Classify intent
  const intent = await classifyFounderIntent(message, context);

  // Handle intent
  const result = await handleFounderIntent(intent, context);

  // Update context based on result
  if (result.data?.projectId) {
    context.activeProjectId = result.data.projectId as string;
  }
  if (result.data?.topic) {
    context.recentTopic = result.data.topic as string;
  }

  return {
    response: result.message,
    intent,
    result,
    context,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FounderHandler = {
  classifyFounderIntent,
  handleFounderIntent,
  processFounderMessage,
};

export default FounderHandler;
