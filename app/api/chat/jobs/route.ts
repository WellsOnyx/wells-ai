// @ts-nocheck
/**
 * Jobs Chat API Route
 *
 * Conversational endpoint for all jobs-related operations.
 * Handles natural language requests for:
 *
 * - Job search ("Find me remote software engineer roles $150k+")
 * - Job recommendations ("What roles match my background?")
 * - Applications ("Apply to that Google position")
 * - Application tracking ("What's the status of my applications?")
 * - Offer negotiation ("They offered $140k, what should I counter?")
 * - Salary intelligence ("What's the market rate for this role?")
 * - Offer decisions ("Accept the offer from TechCorp")
 *
 * Integrates with WellsOrchestrator patterns for consistent
 * conversational experience across all WellsAI features.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { JobsHandler, createJobsHandler } from '@/lib/chat/handlers/jobs-handler'
import {
  ConversationalJobsService,
  createConversationalJobsService,
} from '@/lib/jobs/conversational-jobs'
import {
  classifyIntent,
  IntentClassification,
  JobSeekerIntent,
} from '@/lib/chat/intent-router'
import {
  getConversationContext,
  saveConversationContext,
  addMessage,
  startFlow,
  updateFlow,
  completeFlow,
  setPendingConfirmation,
  isConfirmation,
  handleConfirmation,
} from '@/lib/chat/conversation-manager'
import {
  getWellsMemory,
  learnFromConversation,
  learnFact,
} from '@/lib/wells-memory'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

interface JobsChatRequest {
  message: string
  sessionId?: string
  context?: {
    previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
    userProfile?: Record<string, unknown>
    activeSearchId?: string
    pendingApplicationId?: string
    pendingOfferId?: string
  }
}

interface JobsChatResponse {
  message: string
  actions?: Array<{
    type: string
    status: 'success' | 'failed' | 'pending' | 'requires_confirmation'
    data?: unknown
    error?: string
  }>
  suggestions?: string[]
  quickActions?: Array<{
    label: string
    action: string
    params?: Record<string, unknown>
    primary?: boolean
  }>
  displayData?: Record<string, unknown>
  metadata?: {
    intent: IntentClassification
    sessionId: string
    processingTimeMs: number
  }
}

// ============================================================================
// JOBS-SPECIFIC INTENT HANDLING
// ============================================================================

const JOBS_INTENT_PATTERNS: Record<JobSeekerIntent, string[]> = {
  job_search: [
    'find', 'search', 'looking for', 'show me', 'any jobs', 'opportunities',
    'roles', 'positions', 'openings', 'remote', 'salary', '$', 'k+',
    'engineer', 'manager', 'developer', 'designer', 'analyst',
  ],
  apply_job: [
    'apply', 'submit', 'application', 'interested in', 'want the job',
    'apply to', 'send my resume',
  ],
  view_applications: [
    'my applications', 'application status', 'where i applied', 'submitted',
    'pending applications', 'all applications',
  ],
  track_application: [
    'status', 'update', 'hear back', 'progress', 'did they respond',
    'any news', 'waiting to hear',
  ],
  negotiate_offer: [
    'negotiate', 'counter', 'ask for more', 'higher salary', 'offered me',
    'they offered', 'want more', 'counter offer', 'push back',
  ],
  salary_intel: [
    'market rate', 'salary for', 'compensation', 'pay range', 'how much',
    'typical salary', 'what should i ask', 'worth', 'salary data',
  ],
  compare_offers: [
    'compare offers', 'which offer', 'better offer', 'multiple offers',
    'evaluate offers', 'comparing',
  ],
  update_profile: [
    'update profile', 'update resume', 'add skills', 'change preferences',
    'edit my profile', 'my skills',
  ],
  withdraw_application: [
    'withdraw', 'cancel application', 'pull out', 'remove application',
  ],
}

/**
 * Quick check if message is jobs-related
 */
function isJobsRelated(message: string): boolean {
  const lower = message.toLowerCase()

  for (const patterns of Object.values(JOBS_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return true
      }
    }
  }

  return false
}

/**
 * Classify jobs-specific intent
 */
async function classifyJobsIntent(
  message: string,
  context?: JobsChatRequest['context']
): Promise<{ intent: JobSeekerIntent; confidence: number; entities: Record<string, unknown> }> {
  const lower = message.toLowerCase()

  // Quick pattern matching for common intents
  for (const [intent, patterns] of Object.entries(JOBS_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return {
          intent: intent as JobSeekerIntent,
          confidence: 0.7,
          entities: {},
        }
      }
    }
  }

  // Use AI for complex classification
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Classify this jobs-related message. Return JSON only.

Message: "${message}"

Possible intents:
- job_search: Looking for jobs
- apply_job: Applying to a job
- view_applications: Checking application list
- track_application: Tracking specific application
- negotiate_offer: Negotiating an offer
- salary_intel: Asking about salary/market rate
- compare_offers: Comparing multiple offers
- update_profile: Updating profile/resume
- withdraw_application: Withdrawing an application

Return:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "role": "extracted job role or null",
    "company": "company name or null",
    "salary": { "min": number, "max": number } or null,
    "location": "location or null",
    "remote": true/false/null,
    "skills": ["skills"] or null
  }
}`,
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('[JobsChat] Classification error:', error)
  }

  // Default to job search
  return {
    intent: 'job_search',
    confidence: 0.5,
    entities: {},
  }
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const JOBS_SYSTEM_PROMPT = `You are Wells, an AI career assistant. You help users with their job search, applications, and career decisions through natural conversation.

YOUR CAPABILITIES:

1. **Job Search**
   - Find jobs matching criteria (role, salary, location, remote)
   - Provide personalized recommendations based on profile
   - Filter and refine search results

2. **Applications**
   - Apply to jobs with AI-crafted cover letters
   - Track application status
   - Prepare for interviews

3. **Offer Negotiation**
   - Analyze offers against market data
   - Generate negotiation strategies
   - Craft professional counter-offers

4. **Salary Intelligence**
   - Provide market rate data
   - Compare compensation packages
   - Offer negotiation talking points

YOUR PERSONALITY:
- Encouraging and supportive - job searching is stressful
- Professional but warm
- Action-oriented - always suggest next steps
- Honest about market realities
- Celebratory about wins (offers, interviews, etc.)

RESPONSE GUIDELINES:
- Keep responses concise (2-4 sentences for simple queries)
- Always include actionable next steps
- Use data to back up salary/negotiation advice
- Be proactive about helping them succeed
- Celebrate their progress

NEVER:
- Share actual personal data
- Make promises about outcomes
- Discourage reasonable asks
- Be dismissive of concerns`

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request
    const body: JobsChatRequest = await request.json()
    const { message, sessionId: providedSessionId, context: requestContext } = body

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create session
    const sessionId = providedSessionId || `jobs_${userId}_${Date.now()}`

    // Load conversation context
    const context = await getConversationContext(sessionId, userId)
    context.userJourney = 'jobs'

    // Add user message to history
    addMessage(context, 'user', message)

    // Check for confirmation of pending action
    if (context.currentFlow?.pendingConfirmation) {
      const confirmation = await isConfirmation(message)

      if (confirmation === 'yes') {
        const actionData = handleConfirmation(context, true)
        if (actionData) {
          // Execute confirmed action
          const jobsService = createConversationalJobsService({ userId })
          const result = await executeConfirmedAction(actionData, jobsService)

          addMessage(context, 'assistant', result.message)
          await saveConversationContext(context)

          return NextResponse.json({
            message: result.message,
            actions: [{ type: actionData.action, status: 'success', data: result.data }],
            suggestions: result.suggestions,
            quickActions: result.quickActions,
            metadata: {
              sessionId,
              processingTimeMs: Date.now() - startTime,
            },
          })
        }
      } else if (confirmation === 'no') {
        handleConfirmation(context, false)
        const cancelMessage = "No problem, I've cancelled that. What else can I help you with?"
        addMessage(context, 'assistant', cancelMessage)
        await saveConversationContext(context)

        return NextResponse.json({
          message: cancelMessage,
          suggestions: ['Search for jobs', 'View my applications', 'Get salary intel'],
          metadata: {
            sessionId,
            processingTimeMs: Date.now() - startTime,
          },
        })
      }
    }

    // Classify intent
    const { intent, confidence, entities } = await classifyJobsIntent(message, requestContext)

    // Create handlers
    const jobsHandler = createJobsHandler(userId, context)
    const jobsService = createConversationalJobsService({ userId, sessionId })

    // Handle the intent
    const result = await jobsHandler.handleIntent(intent, entities as any, message)

    // Check if action requires confirmation
    if (result.data?.requiresConfirmation && result.success) {
      setPendingConfirmation(
        context,
        intent,
        result.displayMessage,
        entities as Record<string, unknown>
      )
    } else if (result.success && result.createdIds) {
      // Complete the flow if we created something
      if (context.currentFlow) {
        completeFlow(context, { success: true, data: result.data })
      }
    }

    // Build response
    const response: JobsChatResponse = {
      message: result.displayMessage,
      actions: result.success ? [{
        type: intent,
        status: result.data?.requiresConfirmation ? 'requires_confirmation' : 'success',
        data: result.displayData || result.data,
      }] : [{
        type: intent,
        status: 'failed',
        error: result.error,
      }],
      suggestions: generateSuggestions(intent, result),
      quickActions: result.suggestedActions?.map(a => ({
        label: a.label,
        action: a.action,
        params: a.params,
        primary: a.primary,
      })),
      displayData: result.displayData,
      metadata: {
        intent: {
          category: 'jobs',
          intent,
          confidence,
          entities,
          requiresConfirmation: !!result.data?.requiresConfirmation,
        },
        sessionId,
        processingTimeMs: Date.now() - startTime,
      },
    }

    // Add assistant message to history
    addMessage(context, 'assistant', result.displayMessage, response.metadata?.intent)

    // Save conversation context
    await saveConversationContext(context)

    // Learn from conversation
    try {
      if (entities.role) {
        await learnFact(userId, `Interested in ${entities.role} roles`, 'career', 'inferred')
      }
      if (entities.company) {
        await learnFact(userId, `Interested in ${entities.company}`, 'career', 'inferred')
      }
      if (entities.salary?.min) {
        await learnFact(userId, `Target salary: $${entities.salary.min}+`, 'career', 'inferred')
      }
    } catch (error) {
      console.error('[JobsChat] Learning error:', error)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[JobsChat] Error:', error)

    return NextResponse.json({
      message: "I ran into an issue. Could you try rephrasing your request?",
      suggestions: ['Search for jobs', 'Check my applications', 'Get help'],
      metadata: {
        processingTimeMs: Date.now() - startTime,
      },
    }, { status: 500 })
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute a confirmed action
 */
async function executeConfirmedAction(
  actionData: { action: string; params: Record<string, unknown> },
  service: ConversationalJobsService
): Promise<{
  message: string
  data?: unknown
  suggestions?: string[]
  quickActions?: Array<{ label: string; action: string; params?: Record<string, unknown>; primary?: boolean }>
}> {
  const { action, params } = actionData

  switch (action) {
    case 'apply_job':
      const applicationResult = await service.applyToJob({
        jobId: params.jobId as string,
        userId: params.userId as string,
        useAICoverLetter: true,
      })
      return {
        message: `Application submitted to ${params.company || 'the company'}! ${applicationResult.nextSteps[0]}`,
        data: applicationResult,
        suggestions: ['Track this application', 'Find similar jobs'],
        quickActions: [
          { label: 'Prepare for interview', action: 'jobs.interviewPrep', params: { jobId: params.jobId }, primary: true },
        ],
      }

    case 'withdraw_application':
      await service.withdrawApplication(params.applicationId as string)
      return {
        message: 'Application withdrawn. Would you like to find new opportunities?',
        suggestions: ['Search for jobs', 'View remaining applications'],
      }

    case 'negotiate_offer':
      // This would handle counter offer submission
      return {
        message: 'Counter-offer prepared! Would you like me to send it?',
        suggestions: ['Yes, send it', 'Adjust the terms', 'Cancel'],
      }

    case 'accept_offer':
      const acceptResult = await service.acceptOffer(params.offerId as string)
      return {
        message: acceptResult.message,
        suggestions: ['What should I do next?', 'Draft resignation letter'],
        quickActions: [
          { label: 'Onboarding checklist', action: 'jobs.onboarding', primary: true },
        ],
      }

    case 'decline_offer':
      const declineResult = await service.declineOffer(params.offerId as string)
      return {
        message: declineResult.message,
        suggestions: ['Continue job search', 'View other offers'],
      }

    default:
      return {
        message: 'Action completed.',
        suggestions: ['What else can I help with?'],
      }
  }
}

/**
 * Generate contextual suggestions based on intent and result
 */
function generateSuggestions(intent: JobSeekerIntent, result: any): string[] {
  const suggestions: string[] = []

  switch (intent) {
    case 'job_search':
      if (result.success && result.data?.jobs?.length > 0) {
        suggestions.push('Apply to top match')
        suggestions.push('Refine my search')
        suggestions.push('Get salary intel')
      } else {
        suggestions.push('Broaden search criteria')
        suggestions.push('Update my profile')
        suggestions.push('Set up job alerts')
      }
      break

    case 'apply_job':
      suggestions.push('Track this application')
      suggestions.push('Find similar roles')
      suggestions.push('Prepare for interview')
      break

    case 'view_applications':
    case 'track_application':
      suggestions.push('Apply to more jobs')
      suggestions.push('Update my profile')
      break

    case 'negotiate_offer':
      suggestions.push('Send counter-offer')
      suggestions.push('Accept as-is')
      suggestions.push('More negotiation tips')
      break

    case 'salary_intel':
      suggestions.push('Find jobs at this rate')
      suggestions.push('Compare companies')
      suggestions.push('Negotiate current offer')
      break

    default:
      suggestions.push('Search for jobs')
      suggestions.push('View applications')
      suggestions.push('Get salary intel')
  }

  return suggestions.slice(0, 4)
}

// ============================================================================
// GET HANDLER - Session Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({
        status: 'ready',
        capabilities: [
          'Job search with natural language',
          'AI-powered job recommendations',
          'Application tracking',
          'Offer negotiation assistance',
          'Salary intelligence',
          'Cover letter generation',
        ],
      })
    }

    const context = await getConversationContext(sessionId, userId)

    return NextResponse.json({
      sessionId,
      messageCount: context.messageCount,
      currentFlow: context.currentFlow ? {
        type: context.currentFlow.type,
        state: context.currentFlow.state,
        pendingConfirmation: !!context.currentFlow.pendingConfirmation,
      } : null,
      activeDeals: context.activeDeals.filter(d =>
        d.type === 'job' || d.type === 'application'
      ).length,
    })

  } catch (error) {
    console.error('[JobsChat GET] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
