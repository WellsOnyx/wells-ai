// @ts-nocheck
/**
 * Founder Chat API Route - Wells AI
 *
 * Conversational API endpoint for the Founder Journey.
 * Enables founders to manage their entire business through chat:
 *
 * - Project management
 * - BOM building
 * - Milestone tracking
 * - Financial overview
 * - Inbox management
 * - Network sourcing
 * - Hiring
 * - Business insights
 * - Marketing content
 *
 * POST /api/chat/founder
 * Body: { message: string, sessionId?: string, context?: object }
 *
 * Returns: { response, intent, actions, sessionId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { processFounderMessage, type FounderIntent } from '@/lib/chat/handlers/founder-handler';
import { ConversationalFounder, type FounderContext, type HandlerResult } from '@/lib/founder/conversational-founder';
import { sqlQuery as sql } from '@/lib/db';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: Partial<FounderContext>;
  confirmAction?: {
    action: string;
    params?: Record<string, unknown>;
    confirmed: boolean;
  };
}

interface ChatResponse {
  success: boolean;
  response: string;
  intent?: FounderIntent;
  actions?: Array<{
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }>;
  sessionId: string;
  requiresFollowUp?: boolean;
  followUpPrompt?: string;
  data?: Record<string, unknown>;
  error?: string;
}

interface SessionContext {
  userId: string;
  sessionId: string;
  activeProjectId?: string;
  recentTopic?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    intent?: string;
  }>;
  pendingAction?: {
    action: string;
    params?: Record<string, unknown>;
    expiresAt: Date;
  };
  preferences?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get or create a session context
 */
async function getSession(sessionId: string, userId: string): Promise<SessionContext> {
  try {
    const result = await sql`
      SELECT * FROM founder_chat_sessions
      WHERE session_id = ${sessionId} AND user_id = ${userId}
    `;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        userId: row.user_id,
        sessionId: row.session_id,
        activeProjectId: row.active_project_id,
        recentTopic: row.recent_topic,
        conversationHistory: typeof row.conversation_history === 'string'
          ? JSON.parse(row.conversation_history)
          : row.conversation_history || [],
        pendingAction: row.pending_action
          ? (typeof row.pending_action === 'string'
            ? JSON.parse(row.pending_action)
            : row.pending_action)
          : undefined,
        preferences: row.preferences
          ? (typeof row.preferences === 'string'
            ? JSON.parse(row.preferences)
            : row.preferences)
          : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    }

    // Create new session
    const newSession: SessionContext = {
      userId,
      sessionId,
      conversationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await sql`
      INSERT INTO founder_chat_sessions (
        session_id, user_id, conversation_history, created_at, updated_at
      ) VALUES (
        ${sessionId}, ${userId}, ${JSON.stringify([])}, NOW(), NOW()
      )
      ON CONFLICT (session_id) DO NOTHING
    `;

    return newSession;
  } catch (error) {
    console.error('[FounderChat] Session error:', error);
    // Return a new in-memory session if DB fails
    return {
      userId,
      sessionId,
      conversationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Save session context
 */
async function saveSession(session: SessionContext): Promise<void> {
  try {
    await sql`
      INSERT INTO founder_chat_sessions (
        session_id, user_id, active_project_id, recent_topic,
        conversation_history, pending_action, preferences,
        created_at, updated_at
      ) VALUES (
        ${session.sessionId}, ${session.userId},
        ${session.activeProjectId || null}, ${session.recentTopic || null},
        ${JSON.stringify(session.conversationHistory.slice(-50))},
        ${session.pendingAction ? JSON.stringify(session.pendingAction) : null},
        ${session.preferences ? JSON.stringify(session.preferences) : null},
        ${session.createdAt.toISOString()}, NOW()
      )
      ON CONFLICT (session_id) DO UPDATE SET
        active_project_id = EXCLUDED.active_project_id,
        recent_topic = EXCLUDED.recent_topic,
        conversation_history = EXCLUDED.conversation_history,
        pending_action = EXCLUDED.pending_action,
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error('[FounderChat] Save session error:', error);
  }
}

/**
 * Add message to conversation history
 */
function addToHistory(
  session: SessionContext,
  role: 'user' | 'assistant',
  content: string,
  intent?: string
): void {
  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
    intent,
  });

  // Keep only last 50 messages
  if (session.conversationHistory.length > 50) {
    session.conversationHistory = session.conversationHistory.slice(-50);
  }

  session.updatedAt = new Date();
}

// ============================================================================
// CONFIRMATION HANDLING
// ============================================================================

/**
 * Check if the message is a confirmation response
 */
function isConfirmation(message: string): boolean | null {
  const lower = message.toLowerCase().trim();
  const yes = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'confirm', 'do it', 'go ahead', 'proceed', 'y'];
  const no = ['no', 'nope', 'nah', 'cancel', 'stop', 'don\'t', 'never mind', 'n'];

  if (yes.some(y => lower === y || lower.startsWith(y + ' '))) return true;
  if (no.some(n => lower === n || lower.startsWith(n + ' '))) return false;
  return null;
}

/**
 * Handle a pending action confirmation
 */
async function handleConfirmation(
  session: SessionContext,
  confirmed: boolean
): Promise<HandlerResult> {
  if (!session.pendingAction) {
    return {
      success: false,
      message: "There's nothing pending confirmation. How can I help you?",
    };
  }

  const { action, params } = session.pendingAction;

  // Clear the pending action
  session.pendingAction = undefined;

  if (!confirmed) {
    return {
      success: true,
      message: "Okay, cancelled. What else can I help with?",
    };
  }

  // Execute the confirmed action
  const context: FounderContext = {
    userId: session.userId,
    sessionId: session.sessionId,
    primaryJourney: 'founder',
    activeProjectId: session.activeProjectId,
    recentTopic: session.recentTopic,
  };

  const founder = new ConversationalFounder(context);

  // Route to the appropriate handler based on action
  switch (action) {
    case 'delete_project':
      return founder.handleDeleteProject(params as Record<string, unknown>);
    case 'source_bom':
      return founder.handleSourceBOM(params as Record<string, unknown>);
    case 'request_intro':
      return founder.handleRequestIntro(params as Record<string, unknown>);
    case 'make_offer':
      return founder.handleMakeOffer(params as Record<string, unknown>);
    default:
      return {
        success: true,
        message: `Action "${action}" confirmed. Processing...`,
      };
  }
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Handle quick action buttons from UI
 */
async function handleQuickAction(
  userId: string,
  session: SessionContext,
  action: string,
  params?: Record<string, unknown>
): Promise<HandlerResult> {
  const context: FounderContext = {
    userId,
    sessionId: session.sessionId,
    primaryJourney: 'founder',
    activeProjectId: params?.projectId as string || session.activeProjectId,
    recentTopic: session.recentTopic,
  };

  const founder = new ConversationalFounder(context);
  const entities = params as Record<string, unknown> || {};

  switch (action) {
    case 'create_project':
      return founder.handleCreateProject(entities);
    case 'list_projects':
      return founder.handleListProjects(entities);
    case 'project_status':
      return founder.handleProjectStatus(entities);
    case 'add_bom_item':
      return founder.handleAddBOMItem(entities);
    case 'list_bom':
      return founder.handleListBOM(entities);
    case 'source_bom':
      return founder.handleSourceBOM(entities);
    case 'whats_due':
      return founder.handleWhatsDue(entities);
    case 'financial_overview':
      return founder.handleFinancialOverview(entities);
    case 'runway_analysis':
      return founder.handleRunwayAnalysis(entities);
    case 'show_inbox':
      return founder.handleShowInbox(entities);
    case 'urgent_messages':
      return founder.handleUrgentMessages(entities);
    case 'business_insights':
      return founder.handleBusinessInsights(entities);
    case 'daily_digest':
      return founder.handleDailyDigest(entities);
    case 'hiring_status':
      return founder.handleHiringStatus(entities);
    case 'list_candidates':
      return founder.handleListCandidates(entities);
    case 'recommendations':
      return founder.handleRecommendations(entities);
    case 'help':
      return founder.handleHelp();
    default:
      return {
        success: false,
        message: `Unknown action: ${action}. How can I help you?`,
      };
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    // Authenticate
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          response: 'Authentication required. Please sign in.',
          sessionId: '',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Parse request
    const body: ChatRequest = await request.json();
    const { message, sessionId: providedSessionId, context, confirmAction } = body;

    // Get or create session
    const sessionId = providedSessionId || crypto.randomUUID();
    const session = await getSession(sessionId, userId);

    // Handle quick action if provided
    if (confirmAction) {
      const result = await handleQuickAction(
        userId,
        session,
        confirmAction.action,
        confirmAction.params
      );

      // Add to history
      addToHistory(session, 'user', `[Action: ${confirmAction.action}]`);
      addToHistory(session, 'assistant', result.message, confirmAction.action);

      // Update context from result
      if (result.data?.projectId) {
        session.activeProjectId = result.data.projectId as string;
      }
      if (result.data?.topic) {
        session.recentTopic = result.data.topic as string;
      }

      await saveSession(session);

      return NextResponse.json({
        success: result.success,
        response: result.message,
        actions: result.actions,
        sessionId,
        requiresFollowUp: result.requiresFollowUp,
        followUpPrompt: result.followUpPrompt,
        data: result.data,
      });
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          response: 'Message is required.',
          sessionId,
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Check for confirmation response if there's a pending action
    if (session.pendingAction) {
      const confirmed = isConfirmation(message);
      if (confirmed !== null) {
        const result = await handleConfirmation(session, confirmed);

        addToHistory(session, 'user', message);
        addToHistory(session, 'assistant', result.message);

        await saveSession(session);

        return NextResponse.json({
          success: result.success,
          response: result.message,
          actions: result.actions,
          sessionId,
          data: result.data,
        });
      }
    }

    // Build context from session and provided context
    const founderContext: FounderContext = {
      userId,
      sessionId,
      primaryJourney: 'founder',
      activeProjectId: context?.activeProjectId || session.activeProjectId,
      recentTopic: context?.recentTopic || session.recentTopic,
      conversationHistory: session.conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    // Process the message
    const result = await processFounderMessage(
      message,
      userId,
      sessionId,
      founderContext
    );

    // Update session
    addToHistory(session, 'user', message);
    addToHistory(session, 'assistant', result.response, result.intent.type);

    // Update context from result
    if (result.context.activeProjectId) {
      session.activeProjectId = result.context.activeProjectId;
    }
    if (result.context.recentTopic) {
      session.recentTopic = result.context.recentTopic;
    }

    // Set pending action if confirmation required
    if (result.result.requiresFollowUp && result.result.actions?.length) {
      const primaryAction = result.result.actions[0];
      session.pendingAction = {
        action: primaryAction.action,
        params: primaryAction.params,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      };
    }

    await saveSession(session);

    return NextResponse.json({
      success: result.result.success,
      response: result.response,
      intent: result.intent,
      actions: result.result.actions,
      sessionId,
      requiresFollowUp: result.result.requiresFollowUp,
      followUpPrompt: result.result.followUpPrompt,
      data: result.result.data,
    });

  } catch (error) {
    console.error('[FounderChat] Error:', error);

    return NextResponse.json(
      {
        success: false,
        response: "I encountered an error processing your request. Please try again.",
        sessionId: '',
        error: error instanceof Error ? error.message : 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER - Session Info
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      // Return recent sessions
      const result = await sql`
        SELECT session_id, active_project_id, recent_topic, updated_at
        FROM founder_chat_sessions
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT 10
      `;

      return NextResponse.json({
        sessions: result.rows.map(r => ({
          sessionId: r.session_id,
          activeProjectId: r.active_project_id,
          recentTopic: r.recent_topic,
          updatedAt: r.updated_at,
        })),
      });
    }

    // Return specific session
    const session = await getSession(sessionId, userId);

    return NextResponse.json({
      session: {
        sessionId: session.sessionId,
        activeProjectId: session.activeProjectId,
        recentTopic: session.recentTopic,
        messageCount: session.conversationHistory.length,
        hasPendingAction: !!session.pendingAction,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });

  } catch (error) {
    console.error('[FounderChat] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE HANDLER - Clear Session
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM founder_chat_sessions
      WHERE session_id = ${sessionId} AND user_id = ${userId}
    `;

    return NextResponse.json({ success: true, message: 'Session cleared' });

  } catch (error) {
    console.error('[FounderChat] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
