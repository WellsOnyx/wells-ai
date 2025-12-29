// @ts-nocheck
/**
 * Wells AI Onboarding Chat Handler
 *
 * Handles conversational onboarding flow with natural dialogue,
 * contextual actions, and seamless transitions between phases.
 *
 * This handler integrates with the conversation manager to provide
 * a consistent chat experience during onboarding.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  ConversationalOnboarding,
  OnboardingConversation,
  ConversationPhase,
  CollectedOnboardingData,
  SuggestedAction,
  UserPreferences,
  AutonomyLevel,
  NegotiationLimits,
} from '@/lib/onboarding/conversational-onboarding'
import { IntentClassification, classifyIntent } from '@/lib/chat/intent-router'
import { UserJourney } from '@/lib/onboarding/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface OnboardingHandlerInput {
  userId: string
  message: string
  action?: string // Quick action button pressed
  actionData?: Record<string, unknown>
}

export interface OnboardingHandlerOutput {
  message: string
  phase: ConversationPhase
  progress: number
  suggestedActions?: SuggestedAction[]
  collectedData: Partial<CollectedOnboardingData>
  isComplete: boolean
  redirectTo?: string // If onboarding is complete, where to send user
  toolUse?: {
    name: string
    input: Record<string, unknown>
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

type ActionHandler = (
  userId: string,
  conversation: OnboardingConversation,
  data?: Record<string, unknown>
) => Promise<{
  message?: string
  updateData?: Partial<CollectedOnboardingData>
  advancePhase?: boolean
  redirectTo?: string
}>

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // Journey selection actions
  select_journey_buyer: async (userId, conversation) => {
    return {
      updateData: { journey: 'buyer' as UserJourney },
      message: "Perfect! As a buyer, I'll help you find the best suppliers, negotiate deals, and streamline your procurement. What kind of products or services are you typically looking to source?",
      advancePhase: true,
    }
  },

  select_journey_seller: async (userId, conversation) => {
    return {
      updateData: { journey: 'seller' as UserJourney },
      message: "Excellent! As a seller, I'll help you connect with qualified buyers, respond to RFQs efficiently, and grow your customer base. What products or services do you offer?",
      advancePhase: true,
    }
  },

  select_journey_founder: async (userId, conversation) => {
    return {
      updateData: { journey: 'founder' as UserJourney },
      message: "Awesome! Founders wear many hats, and I'm here to help with all of them - hiring, sourcing, finding customers, you name it. What's your company building, and what's your most pressing need right now?",
      advancePhase: true,
    }
  },

  select_journey_jobs: async (userId, conversation) => {
    return {
      updateData: { journey: 'jobs' as UserJourney },
      message: "Great! I'll help you find amazing opportunities, negotiate offers to get what you deserve, and navigate your career. What kind of role are you looking for?",
      advancePhase: true,
    }
  },

  // Communication style actions
  set_style_casual: async (userId, conversation) => {
    return {
      updateData: {
        communicationStyle: 'casual' as const,
      },
      message: "Casual it is! I'll keep things friendly and to the point. No corporate-speak here. Should I be proactive about suggesting things, or wait for you to ask?",
    }
  },

  set_style_professional: async (userId, conversation) => {
    return {
      updateData: {
        communicationStyle: 'professional' as const,
      },
      message: "Professional works great - clear, efficient, and focused. I'll keep things balanced. How proactive would you like me to be?",
    }
  },

  set_style_formal: async (userId, conversation) => {
    return {
      updateData: {
        communicationStyle: 'formal' as const,
      },
      message: "Understood. I'll maintain a formal, executive-level communication style with detailed and thorough responses. Regarding proactivity - would you prefer minimal interruptions, or would you like me to actively surface opportunities?",
    }
  },

  // Proactivity actions
  set_proactivity_minimal: async (userId, conversation) => {
    return {
      updateData: { proactivityLevel: 'minimal' as const },
      message: "Got it - I'll only chime in when you ask. I'm always here when you need me.",
      advancePhase: true,
    }
  },

  set_proactivity_moderate: async (userId, conversation) => {
    return {
      updateData: { proactivityLevel: 'moderate' as const },
      message: "Perfect balance - I'll send important alerts and occasionally suggest things that might help, but I won't be overbearing.",
      advancePhase: true,
    }
  },

  set_proactivity_high: async (userId, conversation) => {
    return {
      updateData: { proactivityLevel: 'high' as const },
      message: "I love being proactive! I'll actively monitor for opportunities, alert you to important changes, and suggest optimizations.",
      advancePhase: true,
    }
  },

  // Autonomy actions (for buyers/founders)
  set_autonomy_supervised: async (userId, conversation) => {
    const autonomyLevel: AutonomyLevel = {
      level: 'supervised',
      description: 'I will always ask before taking any action',
    }
    return {
      updateData: { autonomyLevel },
      message: "Full control is yours - I'll always check with you before doing anything. Now, shall we set up some helpful integrations?",
      advancePhase: true,
    }
  },

  set_autonomy_semi: async (userId, conversation) => {
    const autonomyLevel: AutonomyLevel = {
      level: 'semi-autonomous',
      description: 'I can act within defined limits, asking approval for larger decisions',
    }
    return {
      updateData: { autonomyLevel },
      message: "Smart choice! To help me know when to act and when to ask, what's the maximum discount percentage I can negotiate on your behalf?",
    }
  },

  set_autonomy_autonomous: async (userId, conversation) => {
    const autonomyLevel: AutonomyLevel = {
      level: 'autonomous',
      description: 'I handle routine tasks automatically, only escalating unusual situations',
    }
    return {
      updateData: { autonomyLevel },
      message: "You trust me - I appreciate that! To be responsible with this trust, let me know: what's the max amount I should auto-approve without checking with you?",
    }
  },

  // Integration actions
  connect_google_calendar: async (userId, conversation) => {
    return {
      message: "I'll open the Google Calendar connection. Once you authorize it, I'll be able to schedule meetings, check your availability, and coordinate with others on your behalf.",
      updateData: {
        pendingIntegrations: [
          ...(conversation.collectedData.pendingIntegrations || []),
          'google-calendar' as const,
        ],
      },
      redirectTo: '/api/integrations/callback/google-calendar',
    }
  },

  connect_slack: async (userId, conversation) => {
    return {
      message: "Perfect! Slack integration means I can send you updates there and you can talk to me from Slack too. Let me get that set up.",
      updateData: {
        pendingIntegrations: [
          ...(conversation.collectedData.pendingIntegrations || []),
          'slack' as const,
        ],
      },
      redirectTo: '/api/integrations/callback/slack',
    }
  },

  connect_quickbooks: async (userId, conversation) => {
    return {
      message: "QuickBooks connection will let me see your vendors, track spending, and even help with invoice payments. Connecting now...",
      updateData: {
        erpChoice: 'quickbooks' as const,
        pendingIntegrations: [
          ...(conversation.collectedData.pendingIntegrations || []),
          'quickbooks' as const,
        ],
      },
      redirectTo: '/api/erp/quickbooks/connect',
    }
  },

  use_wells_erp: async (userId, conversation) => {
    return {
      updateData: { erpChoice: 'wells_native' as const },
      message: "Great choice! WellsAI as your ERP means no dashboards to navigate, no forms to fill out - just tell me what you need. I'll track your vendors, manage POs, and keep everything organized through our conversations.",
      advancePhase: true,
    }
  },

  skip_integrations: async (userId, conversation) => {
    return {
      message: "No problem! You can always connect integrations later from your settings. Let's talk about how you like to work...",
      advancePhase: true,
    }
  },

  // Treasury actions
  setup_treasury: async (userId, conversation) => {
    return {
      message: "Let's get your treasury set up! I'm creating your GRAIN wallet now. GRAIN is our stablecoin that earns yield and gives you access to credit lines. Would you like to add a funding source (bank account or card) to get started?",
      updateData: { treasurySetupComplete: true },
      redirectTo: '/grain-vault/onboard',
    }
  },

  treasury_info: async (userId, conversation) => {
    return {
      message: `Here's what Grain & Vault offers:

**GRAIN Wallet** - Hold GRAIN stablecoin (1:1 with USDC)
**Earn Yield** - Your balance earns competitive APY
**Credit Line** - Access working capital based on your activity
**Instant Payments** - Pay suppliers and get paid instantly within the Wells network

Want to set this up now, or skip for later?`,
    }
  },

  skip_treasury: async (userId, conversation) => {
    return {
      message: "No problem - treasury is there when you need it. You can set it up anytime from your account settings.",
      advancePhase: true,
    }
  },

  // Import actions
  import_linkedin: async (userId, conversation) => {
    return {
      message: "I'll import your LinkedIn connections to help you get started faster. This helps me understand your network and find relevant opportunities.",
      redirectTo: '/api/integrations/callback/linkedin',
    }
  },

  upload_csv: async (userId, conversation) => {
    return {
      message: "You can upload a CSV of your contacts, suppliers, or customers. I'll learn from this data to give you better recommendations. Drop your file when ready!",
    }
  },

  skip_import: async (userId, conversation) => {
    return {
      message: "All good! We can start fresh and build your network as you use Wells AI.",
      advancePhase: true,
    }
  },

  // Phase skip
  skip_phase: async (userId, conversation) => {
    return {
      message: "Skipping for now - we can always come back to this later!",
      advancePhase: true,
    }
  },

  // Completion actions
  create_rfq: async (userId, conversation) => {
    return {
      message: "Let's create your first RFQ! What product or service do you need?",
      redirectTo: '/command?action=create_rfq',
    }
  },

  explore_suppliers: async (userId, conversation) => {
    return {
      message: "Let's find some suppliers for you. What category are you interested in?",
      redirectTo: '/suppliers',
    }
  },

  view_rfqs: async (userId, conversation) => {
    return {
      message: "Let me show you the current opportunities available to you.",
      redirectTo: '/opportunities',
    }
  },

  setup_catalog: async (userId, conversation) => {
    return {
      message: "Let's set up your product catalog so buyers can find you.",
      redirectTo: '/seller/catalog',
    }
  },

  founder_dashboard: async (userId, conversation) => {
    return {
      message: "Here's your founder dashboard - your command center for everything.",
      redirectTo: '/command',
    }
  },

  post_job: async (userId, conversation) => {
    return {
      message: "Let's post a job and find you some great talent!",
      redirectTo: '/command?action=hire',
    }
  },

  search_jobs: async (userId, conversation) => {
    return {
      message: "Let's find your next opportunity! What kind of role interests you?",
      redirectTo: '/jobs',
    }
  },

  create_alerts: async (userId, conversation) => {
    return {
      message: "I'll set up alerts so you never miss a perfect match.",
      redirectTo: '/jobs/alerts',
    }
  },
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle onboarding conversation messages and actions
 */
export async function handleOnboardingMessage(
  input: OnboardingHandlerInput
): Promise<OnboardingHandlerOutput> {
  const { userId, message, action, actionData } = input

  // Get current conversation
  const conversation = await ConversationalOnboarding.getOrCreateConversation(userId)

  // Handle action button press
  if (action && ACTION_HANDLERS[action]) {
    return handleAction(userId, conversation, action, actionData)
  }

  // Handle special commands in message
  const specialResponse = await handleSpecialCommands(userId, message, conversation)
  if (specialResponse) {
    return specialResponse
  }

  // Process normal conversation message
  const response = await ConversationalOnboarding.processOnboardingMessage(userId, message)

  return {
    message: response.message,
    phase: response.phase,
    progress: response.progress,
    suggestedActions: response.suggestedActions,
    collectedData: response.collectedData,
    isComplete: response.isComplete,
    redirectTo: response.isComplete ? getCompletionRedirect(response.collectedData) : undefined,
  }
}

/**
 * Handle action button press
 */
async function handleAction(
  userId: string,
  conversation: OnboardingConversation,
  action: string,
  actionData?: Record<string, unknown>
): Promise<OnboardingHandlerOutput> {
  const handler = ACTION_HANDLERS[action]
  if (!handler) {
    return {
      message: "I'm not sure what that action does. Can you tell me what you're trying to do?",
      phase: conversation.phase,
      progress: 0,
      collectedData: conversation.collectedData,
      isComplete: false,
    }
  }

  const result = await handler(userId, conversation, actionData)

  // Update conversation data
  if (result.updateData) {
    conversation.collectedData = {
      ...conversation.collectedData,
      ...result.updateData,
    }
  }

  // Advance phase if needed
  if (result.advancePhase) {
    await ConversationalOnboarding.skipCurrentPhase(userId)
  }

  // Save conversation
  await ConversationalOnboarding.saveConversation(conversation)

  // Calculate progress
  const phases: ConversationPhase[] = [
    'greeting', 'discovery', 'journey_selection', 'profile_building',
    'integrations', 'preferences', 'treasury', 'data_import', 'completion'
  ]
  const currentIndex = phases.indexOf(conversation.phase)
  const progress = Math.round((currentIndex / (phases.length - 1)) * 100)

  return {
    message: result.message || 'Done!',
    phase: conversation.phase,
    progress,
    collectedData: conversation.collectedData,
    isComplete: conversation.phase === 'completion',
    redirectTo: result.redirectTo,
  }
}

/**
 * Handle special commands that might come through as messages
 */
async function handleSpecialCommands(
  userId: string,
  message: string,
  conversation: OnboardingConversation
): Promise<OnboardingHandlerOutput | null> {
  const lowerMessage = message.toLowerCase().trim()

  // Skip commands
  if (lowerMessage === 'skip' || lowerMessage === 'next' || lowerMessage === 'skip this') {
    const response = await ConversationalOnboarding.skipCurrentPhase(userId)
    return {
      message: response.message,
      phase: response.phase,
      progress: response.progress,
      suggestedActions: response.suggestedActions,
      collectedData: response.collectedData,
      isComplete: response.isComplete,
    }
  }

  // Back commands
  if (lowerMessage === 'back' || lowerMessage === 'previous' || lowerMessage === 'go back') {
    return {
      message: "Let me know if you want to revisit anything specific - I remember everything we've discussed!",
      phase: conversation.phase,
      progress: 0,
      collectedData: conversation.collectedData,
      isComplete: false,
    }
  }

  // Help commands
  if (lowerMessage === 'help' || lowerMessage === '?') {
    const helpMessage = getPhaseHelpMessage(conversation.phase)
    return {
      message: helpMessage,
      phase: conversation.phase,
      progress: 0,
      collectedData: conversation.collectedData,
      isComplete: false,
    }
  }

  return null
}

/**
 * Get contextual help message for current phase
 */
function getPhaseHelpMessage(phase: ConversationPhase): string {
  const helpMessages: Record<ConversationPhase, string> = {
    greeting: "I'm Wells, here to help you get the most out of this platform. Just tell me a bit about yourself to get started!",
    discovery: "I'm learning about you to personalize your experience. Share whatever feels relevant - your company, role, industry, or what brings you here.",
    journey_selection: "I need to understand your main goal. Are you here to buy products/services, sell to businesses, run a startup, or find a job?",
    profile_building: "I'm gathering details specific to your journey to give you better recommendations. Feel free to share as much or as little as you like.",
    integrations: "Connecting your tools helps me work better for you. You can skip this and do it later from settings.",
    preferences: "I'm learning how you like to work - communication style, how proactive I should be, and how much autonomy you want me to have.",
    treasury: "Grain & Vault is our treasury system for payments and credit. It's optional but powerful for transactions on the platform.",
    data_import: "Importing existing data helps me get to know your network and give better recommendations. Totally optional!",
    completion: "You're all set! I've learned about you and I'm ready to help. What would you like to tackle first?",
  }

  return helpMessages[phase] + "\n\nSay 'skip' to move to the next step, or just keep chatting!"
}

/**
 * Get redirect URL based on completed onboarding data
 */
function getCompletionRedirect(data: Partial<CollectedOnboardingData>): string {
  switch (data.journey) {
    case 'buyer':
      return '/command?welcome=buyer'
    case 'seller':
      return '/opportunities?welcome=seller'
    case 'founder':
      return '/command?welcome=founder'
    case 'jobs':
      return '/jobs?welcome=candidate'
    default:
      return '/command'
  }
}

// ============================================================================
// INITIALIZE ONBOARDING
// ============================================================================

/**
 * Start a new onboarding conversation
 */
export async function initializeOnboarding(userId: string): Promise<OnboardingHandlerOutput> {
  const response = await ConversationalOnboarding.generateWelcomeMessage(userId)

  return {
    message: response.message,
    phase: response.phase,
    progress: response.progress,
    suggestedActions: response.suggestedActions,
    collectedData: response.collectedData,
    isComplete: response.isComplete,
  }
}

// ============================================================================
// INTENT-AWARE MESSAGE HANDLING
// ============================================================================

/**
 * Handle a message with intent awareness
 * This allows users to express intents naturally and have them routed appropriately
 */
export async function handleIntentAwareMessage(
  input: OnboardingHandlerInput
): Promise<OnboardingHandlerOutput> {
  const { userId, message } = input

  // First, check if this looks like a clear intent that should exit onboarding
  const intent = await classifyIntent(message, {})

  // If high-confidence intent that's not onboarding-related, note it
  if (intent.confidence > 0.8 && !isOnboardingIntent(intent)) {
    // Store the intent for after onboarding
    const conversation = await ConversationalOnboarding.getOrCreateConversation(userId)
    conversation.collectedData = {
      ...conversation.collectedData,
      // Store noted intent for later
    }
    await ConversationalOnboarding.saveConversation(conversation)

    // Continue with onboarding but acknowledge the intent
    const response = await handleOnboardingMessage(input)
    response.message = `I noted that you want to ${formatIntent(intent)}. Let me finish getting to know you first so I can help you better with that!\n\n${response.message}`
    return response
  }

  // Normal onboarding flow
  return handleOnboardingMessage(input)
}

function isOnboardingIntent(intent: IntentClassification): boolean {
  const onboardingIntents = ['greeting', 'help', 'capabilities', 'settings']
  return onboardingIntents.includes(intent.intent)
}

function formatIntent(intent: IntentClassification): string {
  return intent.intent.replace(/_/g, ' ')
}

// ============================================================================
// NEGOTIATION LIMITS COLLECTOR
// ============================================================================

/**
 * Parse negotiation limits from user message
 */
export function parseNegotiationLimits(message: string): Partial<NegotiationLimits> | null {
  const limits: Partial<NegotiationLimits> = {}

  // Parse percentage
  const percentMatch = message.match(/(\d+)\s*%/)
  if (percentMatch) {
    limits.maxDiscountPercent = parseInt(percentMatch[1])
  }

  // Parse dollar amounts
  const amountMatches = message.match(/\$?([\d,]+)/g)
  if (amountMatches) {
    const amounts = amountMatches
      .map(a => parseInt(a.replace(/[$,]/g, '')))
      .filter(a => !isNaN(a))
      .sort((a, b) => a - b)

    if (amounts.length >= 1) {
      limits.maxAutoApproveAmount = amounts[0]
    }
    if (amounts.length >= 2) {
      limits.requireApprovalAbove = amounts[1]
    }
  }

  return Object.keys(limits).length > 0 ? limits : null
}

// ============================================================================
// EXPORTS
// ============================================================================

export const OnboardingHandler = {
  handleOnboardingMessage,
  initializeOnboarding,
  handleIntentAwareMessage,
  parseNegotiationLimits,
}

export default OnboardingHandler
