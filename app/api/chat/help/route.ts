// @ts-nocheck
/**
 * Help Chat API Route
 *
 * Provides contextual, conversational help and guidance through chat.
 * Users can ask how to do things, get contextual help, understand features,
 * get tutorials, troubleshoot issues, learn best practices, and discover capabilities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  HelpHandler,
  handleHelpIntent,
  generateProactiveSuggestion,
  shouldShowHelp,
} from '@/lib/chat/handlers/help-handler'
import {
  ConversationalHelp,
  getConversationalHelp,
  HelpContext,
  HelpIntent,
  PLATFORM_FEATURES,
  JOURNEY_GUIDANCE,
} from '@/lib/help/conversational-help'
import {
  createConversation,
  getConversation,
  addMessage,
  getMessages,
  getUserContext,
} from '@/lib/chat/unified-chat-service'

// ============================================================================
// TYPES
// ============================================================================

interface HelpChatRequest {
  message: string
  conversationId?: string
  context?: {
    currentPage?: string
    currentJourney?: 'buyer' | 'seller' | 'founder' | 'jobs' | 'treasury'
    activeFeatures?: string[]
    pendingItems?: Array<{ type: string; id: string; status: string }>
    recentActions?: string[]
  }
  options?: {
    includeProTips?: boolean
    includeSuggestions?: boolean
    tutorialMode?: boolean
  }
}

interface HelpChatResponse {
  message: string
  helpType: HelpIntent
  conversationId?: string
  suggestedActions?: Array<{
    label: string
    action: string
    description?: string
  }>
  relatedTopics?: string[]
  proTips?: string[]
  followUpQuestions?: string[]
  quickActions?: Array<{
    label: string
    command: string
  }>
  tutorial?: {
    active: boolean
    steps?: string[]
    currentStep?: number
  }
  proactiveSuggestion?: string
  metadata?: {
    feature?: string
    confidence: number
    intent: HelpIntent
  }
}

// ============================================================================
// POST - Handle help chat messages
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get user auth (optional for anonymous users)
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as HelpChatRequest
    const { message, conversationId, context, options } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create conversation for context
    let conversation
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (conversationId && userId) {
      conversation = await getConversation(conversationId)
      if (conversation) {
        const messages = await getMessages(conversationId, { limit: 10 })
        conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      }
    } else if (userId) {
      // Create new help conversation
      conversation = await createConversation({
        userId,
        product: 'wellsai',
        journey: context?.currentJourney,
        mode: 'help',
        metadata: {
          type: 'help_conversation',
          startedAt: new Date().toISOString(),
        },
      })
    }

    // Get user context if available
    let userContext
    if (userId) {
      userContext = await getUserContext(userId)
    }

    // Determine user experience level
    const experienceLevel = determineExperienceLevel(userContext)

    // Build help context
    const helpContext: HelpContext = {
      userId: userId || undefined,
      currentPage: context?.currentPage,
      currentJourney: context?.currentJourney,
      recentActions: context?.recentActions || [],
      userExperienceLevel: experienceLevel,
      activeFeatures: context?.activeFeatures,
      pendingItems: context?.pendingItems,
      conversationHistory,
    }

    // Process the help request
    const startTime = Date.now()
    const helpResult = await handleHelpIntent({
      message: message.trim(),
      conversationContext: {
        userId: userId || undefined,
        journey: context?.currentJourney,
        messages: conversationHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
        recentActions: context?.recentActions,
      },
      pageContext: {
        currentPage: context?.currentPage,
        activeFeatures: context?.activeFeatures,
        pendingItems: context?.pendingItems,
      },
    })
    const latencyMs = Date.now() - startTime

    // Save messages to conversation if authenticated
    if (conversation && userId) {
      // Save user message
      await addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message.trim(),
        productContext: 'wellsai',
        metadata: {
          helpIntent: helpResult.helpType,
        },
      })

      // Save assistant response
      await addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: helpResult.response,
        productContext: 'wellsai',
        latencyMs,
        metadata: {
          helpType: helpResult.helpType,
          confidence: helpResult.metadata?.confidence,
          feature: helpResult.metadata?.feature,
        },
      })
    }

    // Generate proactive suggestion if appropriate
    let proactiveSuggestion: string | undefined
    if (options?.includeSuggestions && shouldShowHelp(helpContext)) {
      proactiveSuggestion = generateProactiveSuggestion(helpContext) || undefined
    }

    // Build response
    const response: HelpChatResponse = {
      message: helpResult.response,
      helpType: helpResult.helpType,
      conversationId: conversation?.id,
      suggestedActions: helpResult.suggestedActions,
      relatedTopics: helpResult.relatedTopics,
      quickActions: helpResult.quickActions,
      metadata: helpResult.metadata ? {
        feature: helpResult.metadata.feature,
        confidence: helpResult.metadata.confidence,
        intent: helpResult.metadata.intent,
      } : undefined,
    }

    // Include pro tips if requested
    if (options?.includeProTips && helpResult.proTips) {
      response.proTips = helpResult.proTips
    }

    // Include follow-up questions
    if (helpResult.followUpQuestions) {
      response.followUpQuestions = helpResult.followUpQuestions
    }

    // Include tutorial if in tutorial mode
    if (helpResult.showTutorial || options?.tutorialMode) {
      response.tutorial = {
        active: true,
        steps: helpResult.tutorialSteps,
        currentStep: 0,
      }
    }

    // Include proactive suggestion
    if (proactiveSuggestion) {
      response.proactiveSuggestion = proactiveSuggestion
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Help API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process help request',
        message: 'I had trouble processing that. Try asking in a different way, or say "help" to see what I can do.',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get help topics, features, or continue conversation
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth().catch(() => ({ userId: null }))

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic')
    const feature = searchParams.get('feature')
    const journey = searchParams.get('journey')
    const conversationId = searchParams.get('conversationId')
    const action = searchParams.get('action')

    // Get specific feature help
    if (feature && PLATFORM_FEATURES[feature as keyof typeof PLATFORM_FEATURES]) {
      const featureInfo = PLATFORM_FEATURES[feature as keyof typeof PLATFORM_FEATURES]
      return NextResponse.json({
        feature: feature,
        name: featureInfo.name,
        description: featureInfo.description,
        howTo: featureInfo.howTo,
        bestPractices: featureInfo.bestPractices,
        commonIssues: featureInfo.commonIssues,
      })
    }

    // Get journey-specific guidance
    if (journey && JOURNEY_GUIDANCE[journey as keyof typeof JOURNEY_GUIDANCE]) {
      const journeyInfo = JOURNEY_GUIDANCE[journey as keyof typeof JOURNEY_GUIDANCE]
      return NextResponse.json({
        journey,
        quickStart: journeyInfo.quickStart,
        commonTasks: journeyInfo.commonTasks,
        proTips: journeyInfo.proTips,
      })
    }

    // Get conversation history
    if (conversationId && userId) {
      const conversation = await getConversation(conversationId)
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      if (conversation.clerkUserId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      const messages = await getMessages(conversationId)
      return NextResponse.json({
        conversation,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          metadata: m.metadata,
        })),
      })
    }

    // Get all help topics
    if (action === 'topics' || !topic) {
      return NextResponse.json({
        features: Object.entries(PLATFORM_FEATURES).map(([key, feat]) => ({
          id: key,
          name: feat.name,
          description: feat.description,
        })),
        journeys: Object.entries(JOURNEY_GUIDANCE).map(([key, guide]) => ({
          id: key,
          commonTasks: guide.commonTasks.slice(0, 3),
        })),
        quickHelp: {
          howTo: 'Ask "How do I..." for step-by-step guidance',
          contextual: 'Ask "What can I do here?" for contextual options',
          features: 'Ask "What is [feature]?" to learn about features',
          tutorial: 'Ask "Walk me through..." for tutorials',
          troubleshoot: 'Ask "Why isn\'t... working?" for troubleshooting',
          bestPractices: 'Ask "Best way to..." for tips',
          discover: 'Ask "What can you do?" to see all capabilities',
        },
      })
    }

    // Get specific topic
    return NextResponse.json({
      topic,
      message: `Tell me more about what you'd like to know about "${topic}"`,
      suggestedQuestions: [
        `How do I ${topic}?`,
        `What is ${topic}?`,
        `Best practices for ${topic}`,
        `Troubleshoot ${topic}`,
      ],
    })
  } catch (error) {
    console.error('[Help API GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help information' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// ============================================================================
// HELPERS
// ============================================================================

function determineExperienceLevel(
  userContext: any
): 'new' | 'intermediate' | 'advanced' {
  if (!userContext) return 'new'

  const totalMessages = userContext.totalMessageCount || 0
  const wellsAIMessages = userContext.wellsaiMessageCount || 0

  if (totalMessages < 10) return 'new'
  if (totalMessages < 50) return 'intermediate'
  return 'advanced'
}
