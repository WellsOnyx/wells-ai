// @ts-nocheck
/**
 * Help Handler
 *
 * Handles all help, guidance, and assistance intents in the Wells AI chat system.
 * Routes to the conversational help system for contextual, friendly guidance.
 */

import {
  ConversationalHelp,
  HelpContext,
  HelpResponse,
  HelpIntent,
  PLATFORM_FEATURES,
  JOURNEY_GUIDANCE,
  detectHelpIntent,
  detectFeatureTopic,
  getConversationalHelp,
  getContextualHelp,
  generateProTips,
  troubleshoot,
  generateTutorial,
  discoverCapabilities,
} from '@/lib/help/conversational-help'
import { IntentClassification, ExtractedEntities } from '../intent-router'
import { ConversationContext } from '../conversation-manager'

// ============================================================================
// TYPES
// ============================================================================

export interface HelpHandlerInput {
  message: string
  intent?: IntentClassification
  entities?: ExtractedEntities
  conversationContext?: ConversationContext
  pageContext?: {
    currentPage?: string
    activeFeatures?: string[]
    pendingItems?: Array<{ type: string; id: string; status: string }>
  }
}

export interface HelpHandlerResult {
  success: boolean
  response: string
  helpType: HelpIntent
  suggestedActions?: Array<{
    label: string
    action: string
    description?: string
  }>
  relatedTopics?: string[]
  proTips?: string[]
  followUpQuestions?: string[]
  showTutorial?: boolean
  tutorialSteps?: string[]
  quickActions?: Array<{
    label: string
    command: string
  }>
  metadata?: {
    feature?: string
    confidence: number
    intent: HelpIntent
    fallback: boolean
  }
}

// ============================================================================
// HELP INTENT PATTERNS
// ============================================================================

const HELP_INTENT_KEYWORDS = {
  how_to: [
    'how do i', 'how can i', 'how to', 'what\'s the way', 'show me how',
    'teach me', 'help me', 'i want to', 'i need to', 'guide me',
  ],
  contextual: [
    'what can i do', 'help', 'what now', 'what next', 'what should i',
    'options', 'what\'s available', 'what are my',
  ],
  feature_explain: [
    'what is', 'what\'s', 'explain', 'tell me about', 'what does',
    'define', 'meaning of', 'what are',
  ],
  tutorial: [
    'walk me through', 'tutorial', 'step by step', 'walkthrough',
    'demonstration', 'demo', 'show me the process',
  ],
  troubleshoot: [
    'why', 'not working', 'doesn\'t work', 'can\'t', 'failed',
    'error', 'problem', 'issue', 'wrong', 'broken', 'stuck',
  ],
  best_practices: [
    'best way', 'best practice', 'tips', 'advice', 'recommend',
    'should i', 'better way', 'optimal', 'improve',
  ],
  discover: [
    'what else', 'what can you', 'capabilities', 'features',
    'what do you do', 'everything you can', 'all your',
  ],
  onboarding: [
    'new here', 'first time', 'getting started', 'just started',
    'beginner', 'intro', 'introduction', 'start',
  ],
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleHelpIntent(input: HelpHandlerInput): Promise<HelpHandlerResult> {
  const { message, intent, entities, conversationContext, pageContext } = input

  // Build help context from available information
  const helpContext: HelpContext = buildHelpContext(conversationContext, pageContext)

  // Detect the specific help intent
  const helpIntent = detectHelpIntent(message)

  // Route to appropriate handler
  try {
    switch (helpIntent) {
      case 'how_to':
        return await handleHowTo(message, helpContext)

      case 'contextual':
        return handleContextualHelp(helpContext)

      case 'feature_explain':
        return handleFeatureExplain(message, helpContext)

      case 'tutorial':
        return await handleTutorial(message, helpContext)

      case 'troubleshoot':
        return handleTroubleshoot(message, helpContext)

      case 'best_practices':
        return handleBestPractices(message, helpContext)

      case 'discover':
        return handleDiscover(helpContext)

      case 'onboarding':
        return handleOnboarding(helpContext)

      case 'pro_tip':
        return handleProTip(helpContext)

      default:
        return await handleGenericHelp(message, helpContext)
    }
  } catch (error) {
    console.error('[HelpHandler] Error:', error)
    return createFallbackResponse(message, helpIntent, helpContext)
  }
}

// ============================================================================
// INTENT HANDLERS
// ============================================================================

async function handleHowTo(message: string, context: HelpContext): Promise<HelpHandlerResult> {
  const feature = detectFeatureTopic(message)

  // Get AI-powered conversational response
  const helpResponse = await getConversationalHelp(message, context)

  // Extract actionable steps if a feature is detected
  let tutorialSteps: string[] | undefined
  if (feature && PLATFORM_FEATURES[feature]) {
    const featureHelp = PLATFORM_FEATURES[feature].howTo
    // Extract numbered steps if present
    const stepMatches = featureHelp.match(/\d+\.\s+[^\n]+/g)
    if (stepMatches) {
      tutorialSteps = stepMatches
    }
  }

  return {
    success: true,
    response: helpResponse.response,
    helpType: 'how_to',
    suggestedActions: helpResponse.suggestedActions,
    relatedTopics: helpResponse.relatedTopics,
    proTips: helpResponse.proTips,
    followUpQuestions: helpResponse.followUpQuestions,
    showTutorial: !!tutorialSteps,
    tutorialSteps,
    quickActions: generateQuickActions(feature, context),
    metadata: {
      feature: feature || undefined,
      confidence: helpResponse.confidence,
      intent: 'how_to',
      fallback: false,
    },
  }
}

function handleContextualHelp(context: HelpContext): HelpHandlerResult {
  const response = getContextualHelp(context)
  const journey = context.currentJourney || 'buyer'
  const guidance = JOURNEY_GUIDANCE[journey]

  return {
    success: true,
    response,
    helpType: 'contextual',
    suggestedActions: guidance?.commonTasks.slice(0, 4).map(task => ({
      label: task,
      action: task.toLowerCase().replace(/\s+/g, '_'),
    })),
    proTips: generateProTips(context),
    quickActions: [
      { label: 'Show my status', command: 'What\'s my status?' },
      { label: 'Find something', command: 'Help me find...' },
      { label: 'Get started', command: 'Walk me through getting started' },
    ],
    metadata: {
      confidence: 0.9,
      intent: 'contextual',
      fallback: false,
    },
  }
}

function handleFeatureExplain(message: string, context: HelpContext): HelpHandlerResult {
  const feature = detectFeatureTopic(message)

  if (feature && PLATFORM_FEATURES[feature]) {
    const featureInfo = PLATFORM_FEATURES[feature]

    const response = `**${featureInfo.name}**

${featureInfo.description}

${featureInfo.howTo}

**Best Practices:**
${featureInfo.bestPractices.slice(0, 3).map(bp => `- ${bp}`).join('\n')}

Want me to help you get started with this?`

    return {
      success: true,
      response,
      helpType: 'feature_explain',
      suggestedActions: [
        { label: 'Try it now', action: `start_${feature}`, description: `Get started with ${featureInfo.name}` },
        { label: 'See tutorial', action: `tutorial_${feature}`, description: 'Step-by-step guide' },
      ],
      relatedTopics: getRelatedFeatures(feature),
      quickActions: generateQuickActions(feature, context),
      metadata: {
        feature,
        confidence: 0.95,
        intent: 'feature_explain',
        fallback: false,
      },
    }
  }

  // Feature not found - provide general capabilities
  return {
    success: true,
    response: `I'm not sure which feature you're asking about. Here's what I can help you understand:

**Core Features:**
${Object.values(PLATFORM_FEATURES).map(f => `- **${f.name}**: ${f.description}`).join('\n')}

Which one would you like to learn more about?`,
    helpType: 'feature_explain',
    suggestedActions: Object.entries(PLATFORM_FEATURES).slice(0, 4).map(([key, feat]) => ({
      label: feat.name,
      action: `explain_${key}`,
      description: feat.description,
    })),
    metadata: {
      confidence: 0.7,
      intent: 'feature_explain',
      fallback: true,
    },
  }
}

async function handleTutorial(message: string, context: HelpContext): Promise<HelpHandlerResult> {
  const feature = detectFeatureTopic(message)
  const tutorial = generateTutorial(message, context)

  // Build structured tutorial steps
  const steps = extractTutorialSteps(tutorial, feature)

  return {
    success: true,
    response: tutorial,
    helpType: 'tutorial',
    showTutorial: true,
    tutorialSteps: steps,
    suggestedActions: [
      { label: 'Let\'s do it', action: 'start_tutorial', description: 'Begin the tutorial' },
      { label: 'Skip to action', action: 'skip_tutorial', description: 'I\'ll figure it out' },
    ],
    proTips: feature ? PLATFORM_FEATURES[feature]?.bestPractices.slice(0, 2) : generateProTips(context),
    followUpQuestions: ['Ready to try it?', 'Need me to explain any step in more detail?'],
    metadata: {
      feature: feature || undefined,
      confidence: 0.9,
      intent: 'tutorial',
      fallback: false,
    },
  }
}

function handleTroubleshoot(message: string, context: HelpContext): HelpHandlerResult {
  const response = troubleshoot(message, context)
  const feature = detectFeatureTopic(message)

  // Check for known issues
  let knownIssue: string | undefined
  if (feature && PLATFORM_FEATURES[feature]?.commonIssues) {
    const issues = PLATFORM_FEATURES[feature].commonIssues
    for (const [issueKey, issueFix] of Object.entries(issues)) {
      if (message.toLowerCase().includes(issueKey.replace('_', ' '))) {
        knownIssue = issueFix
        break
      }
    }
  }

  const finalResponse = knownIssue
    ? `${knownIssue}\n\n${response}`
    : response

  return {
    success: true,
    response: finalResponse,
    helpType: 'troubleshoot',
    suggestedActions: [
      { label: 'Check status', action: 'check_status', description: 'View system status' },
      { label: 'Contact support', action: 'contact_support', description: 'Get human help' },
    ],
    followUpQuestions: [
      'Did that help?',
      'Can you share more details about what happened?',
      'Want me to run a diagnostic?',
    ],
    quickActions: [
      { label: 'Check system status', command: 'System status' },
      { label: 'View logs', command: 'Show recent activity' },
    ],
    metadata: {
      feature: feature || undefined,
      confidence: knownIssue ? 0.9 : 0.7,
      intent: 'troubleshoot',
      fallback: !knownIssue,
    },
  }
}

function handleBestPractices(message: string, context: HelpContext): HelpHandlerResult {
  const feature = detectFeatureTopic(message)

  if (feature && PLATFORM_FEATURES[feature]) {
    const practices = PLATFORM_FEATURES[feature].bestPractices

    return {
      success: true,
      response: `**Best Practices for ${PLATFORM_FEATURES[feature].name}:**

${practices.map((p, i) => `${i + 1}. ${p}`).join('\n\n')}

These come from patterns we've seen work well across thousands of users. Want me to help you implement any of these?`,
      helpType: 'best_practices',
      proTips: practices.slice(0, 3),
      suggestedActions: [
        { label: 'Apply these tips', action: `apply_practices_${feature}` },
        { label: 'See examples', action: `examples_${feature}` },
      ],
      relatedTopics: getRelatedFeatures(feature),
      metadata: {
        feature,
        confidence: 0.95,
        intent: 'best_practices',
        fallback: false,
      },
    }
  }

  // General best practices
  const journey = context.currentJourney || 'buyer'
  const journeyTips = JOURNEY_GUIDANCE[journey]?.proTips || []

  return {
    success: true,
    response: `**Best Practices for ${journey.charAt(0).toUpperCase() + journey.slice(1)}s:**

${journeyTips.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}

These tips come from our most successful ${journey}s. What specific area would you like advice on?`,
    helpType: 'best_practices',
    proTips: journeyTips,
    suggestedActions: Object.keys(PLATFORM_FEATURES).slice(0, 4).map(key => ({
      label: `${PLATFORM_FEATURES[key as keyof typeof PLATFORM_FEATURES].name} tips`,
      action: `best_practices_${key}`,
    })),
    metadata: {
      confidence: 0.8,
      intent: 'best_practices',
      fallback: true,
    },
  }
}

function handleDiscover(context: HelpContext): HelpHandlerResult {
  const response = discoverCapabilities(context)
  const journey = context.currentJourney || 'buyer'

  return {
    success: true,
    response,
    helpType: 'discover',
    suggestedActions: [
      { label: 'Source products', action: 'start_rfq', description: 'Find what you need' },
      { label: 'Find suppliers', action: 'find_suppliers', description: 'Search our network' },
      { label: 'Manage treasury', action: 'treasury_overview', description: 'GRAIN and payments' },
      { label: 'Find talent', action: 'search_jobs', description: 'Jobs and hiring' },
    ],
    relatedTopics: Object.values(PLATFORM_FEATURES).map(f => f.name),
    quickActions: JOURNEY_GUIDANCE[journey]?.commonTasks.slice(0, 4).map(task => ({
      label: task.split(' ').slice(0, 3).join(' '),
      command: task,
    })) || [],
    metadata: {
      confidence: 0.95,
      intent: 'discover',
      fallback: false,
    },
  }
}

function handleOnboarding(context: HelpContext): HelpHandlerResult {
  const journey = context.currentJourney || 'buyer'
  const guidance = JOURNEY_GUIDANCE[journey]

  const response = `**Welcome! Let me get you set up.**

${guidance?.quickStart || 'I\'m here to help you accomplish whatever you need. Just tell me what you\'re trying to do.'}

**Quick ways to get started:**
1. **Just tell me what you need** - "I need to buy X" or "Help me find Y"
2. **Ask me anything** - I understand natural language
3. **Explore** - Say "What can you do?" to see all features

No menus to learn. No buttons to find. Just talk to me like a colleague.

What brings you here today?`

  return {
    success: true,
    response,
    helpType: 'onboarding',
    showTutorial: true,
    tutorialSteps: [
      'Tell me what you need in plain English',
      'I\'ll take action or ask clarifying questions',
      'Review my suggestions and approve actions',
      'I handle the execution and follow-ups',
    ],
    suggestedActions: guidance?.commonTasks.slice(0, 3).map(task => ({
      label: task,
      action: task.toLowerCase().replace(/\s+/g, '_'),
    })) || [
      { label: 'Source something', action: 'create_rfq' },
      { label: 'Find suppliers', action: 'find_suppliers' },
      { label: 'Explore features', action: 'discover' },
    ],
    proTips: [
      'You can always say "help" to get guidance on what to do next',
      'Try natural language - "I need 500 widgets by Friday" works great',
    ],
    quickActions: [
      { label: 'Quick tour', command: 'Give me a quick tour' },
      { label: 'Start sourcing', command: 'I need to buy something' },
      { label: 'See everything', command: 'What can you do?' },
    ],
    metadata: {
      confidence: 0.95,
      intent: 'onboarding',
      fallback: false,
    },
  }
}

function handleProTip(context: HelpContext): HelpHandlerResult {
  const tips = generateProTips(context)

  // Generate a contextual pro tip
  let proTipResponse: string

  if (context.recentActions?.includes('created_rfq')) {
    proTipResponse = `**Pro Tip:** Now that you've created an RFQ, you can speed up the process by:

- Adding more specifics to attract better quotes
- Setting up alerts for when quotes come in
- Letting me auto-negotiate for you once quotes arrive

I can do any of these for you - just say the word!`
  } else if (context.pendingItems && context.pendingItems.length > 0) {
    proTipResponse = `**Pro Tip:** You have ${context.pendingItems.length} pending items. I can help you:

- Review and take action on each one
- Set up automated responses for common scenarios
- Prioritize by urgency or value

Want me to walk through your pending items?`
  } else {
    proTipResponse = `**Pro Tips for You:**

${tips.map((t, i) => `${i + 1}. ${t}`).join('\n\n')}

These are based on what works well for users like you. Want to try any of these?`
  }

  return {
    success: true,
    response: proTipResponse,
    helpType: 'pro_tip',
    proTips: tips,
    suggestedActions: [
      { label: 'Apply this tip', action: 'apply_tip' },
      { label: 'More tips', action: 'more_tips' },
    ],
    metadata: {
      confidence: 0.85,
      intent: 'pro_tip',
      fallback: false,
    },
  }
}

async function handleGenericHelp(message: string, context: HelpContext): Promise<HelpHandlerResult> {
  // Use AI for generic/unclear help requests
  const helpResponse = await getConversationalHelp(message, context)

  return {
    success: true,
    response: helpResponse.response,
    helpType: helpResponse.intent,
    suggestedActions: helpResponse.suggestedActions,
    relatedTopics: helpResponse.relatedTopics,
    proTips: helpResponse.proTips,
    followUpQuestions: helpResponse.followUpQuestions,
    metadata: {
      confidence: helpResponse.confidence,
      intent: helpResponse.intent,
      fallback: false,
    },
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildHelpContext(
  conversationContext?: ConversationContext,
  pageContext?: {
    currentPage?: string
    activeFeatures?: string[]
    pendingItems?: Array<{ type: string; id: string; status: string }>
  }
): HelpContext {
  return {
    userId: conversationContext?.userId,
    currentPage: pageContext?.currentPage,
    currentJourney: conversationContext?.journey as HelpContext['currentJourney'],
    recentActions: conversationContext?.recentActions,
    userExperienceLevel: determineExperienceLevel(conversationContext),
    activeFeatures: pageContext?.activeFeatures,
    pendingItems: pageContext?.pendingItems,
    conversationHistory: conversationContext?.messages?.map(m => ({
      role: m.role,
      content: m.content,
    })),
  }
}

function determineExperienceLevel(
  context?: ConversationContext
): 'new' | 'intermediate' | 'advanced' {
  if (!context) return 'new'

  const messageCount = context.messages?.length || 0
  const actionCount = context.recentActions?.length || 0

  if (messageCount < 5 && actionCount < 2) return 'new'
  if (messageCount < 20 || actionCount < 10) return 'intermediate'
  return 'advanced'
}

function extractTutorialSteps(tutorial: string, feature: string | null): string[] {
  // Try to extract numbered steps
  const stepMatches = tutorial.match(/(?:^|\n)(?:\*\*)?(?:Step\s*)?\d+[.):]\s*(?:\*\*)?([^\n]+)/gi)
  if (stepMatches && stepMatches.length > 0) {
    return stepMatches.map(s => s.replace(/^[\n\*]*(?:Step\s*)?\d+[.):]\s*\**\s*/i, '').trim())
  }

  // Try to extract bulleted items
  const bulletMatches = tutorial.match(/(?:^|\n)[-*]\s+([^\n]+)/g)
  if (bulletMatches && bulletMatches.length > 0) {
    return bulletMatches.slice(0, 5).map(s => s.replace(/^[\n\-\*]\s*/, '').trim())
  }

  // Default steps based on feature
  if (feature && PLATFORM_FEATURES[feature as keyof typeof PLATFORM_FEATURES]) {
    return [
      `Open the ${PLATFORM_FEATURES[feature as keyof typeof PLATFORM_FEATURES].name} feature`,
      'Tell me what you need in natural language',
      'Review my suggestions',
      'Confirm to proceed',
    ]
  }

  return [
    'Tell me what you want to accomplish',
    'I\'ll gather any missing details',
    'Review my proposed action',
    'Confirm to execute',
  ]
}

function generateQuickActions(
  feature: string | null,
  context: HelpContext
): Array<{ label: string; command: string }> {
  if (feature) {
    const featureActions: Record<string, Array<{ label: string; command: string }>> = {
      rfq: [
        { label: 'Create RFQ', command: 'I need to source...' },
        { label: 'My RFQs', command: 'Show my RFQs' },
        { label: 'Compare quotes', command: 'Compare my quotes' },
      ],
      suppliers: [
        { label: 'Find suppliers', command: 'Find suppliers for...' },
        { label: 'My suppliers', command: 'Show my suppliers' },
      ],
      payments: [
        { label: 'Send payment', command: 'Pay...' },
        { label: 'My balance', command: 'What\'s my balance?' },
        { label: 'Transactions', command: 'Show transactions' },
      ],
      jobs: [
        { label: 'Find jobs', command: 'Find jobs in...' },
        { label: 'My applications', command: 'Show my applications' },
      ],
      negotiation: [
        { label: 'Start negotiation', command: 'Negotiate...' },
        { label: 'Active deals', command: 'Show my deals' },
      ],
      grain: [
        { label: 'GRAIN balance', command: 'What\'s my GRAIN balance?' },
        { label: 'Convert to GRAIN', command: 'Convert USD to GRAIN' },
      ],
      escrow: [
        { label: 'Create escrow', command: 'Set up escrow for...' },
        { label: 'My escrows', command: 'Show my escrows' },
      ],
      erp: [
        { label: 'Connect ERP', command: 'Connect my QuickBooks' },
        { label: 'Sync status', command: 'Check ERP sync status' },
      ],
    }

    return featureActions[feature] || []
  }

  // Default actions based on journey
  const journey = context.currentJourney || 'buyer'
  const journeyActions: Record<string, Array<{ label: string; command: string }>> = {
    buyer: [
      { label: 'Source products', command: 'I need to buy...' },
      { label: 'Find suppliers', command: 'Find suppliers' },
      { label: 'View spend', command: 'Show my spending' },
    ],
    seller: [
      { label: 'View RFQs', command: 'Show incoming RFQs' },
      { label: 'My quotes', command: 'Show my quotes' },
      { label: 'Sales metrics', command: 'How am I doing?' },
    ],
    founder: [
      { label: 'Overview', command: 'Business overview' },
      { label: 'Hire', command: 'I need to hire...' },
      { label: 'Source', command: 'I need to source...' },
    ],
    jobs: [
      { label: 'Find jobs', command: 'Find jobs matching...' },
      { label: 'Applications', command: 'My applications' },
      { label: 'Salary info', command: 'Salary for...' },
    ],
    treasury: [
      { label: 'Balance', command: 'My balance' },
      { label: 'Pay', command: 'Pay...' },
      { label: 'Transactions', command: 'Recent transactions' },
    ],
  }

  return journeyActions[journey] || journeyActions.buyer
}

function getRelatedFeatures(feature: string): string[] {
  const relatedMap: Record<string, string[]> = {
    rfq: ['Suppliers', 'Negotiation', 'Payments', 'Escrow'],
    suppliers: ['RFQ', 'Payments', 'ERP Integration'],
    negotiation: ['RFQ', 'Escrow', 'Payments'],
    payments: ['GRAIN', 'Escrow', 'ERP Integration'],
    grain: ['Payments', 'Treasury', 'Credit'],
    jobs: ['Salary Intel', 'Negotiation', 'Profile'],
    escrow: ['Payments', 'Suppliers', 'Negotiation'],
    erp: ['Payments', 'Invoices', 'Suppliers'],
  }

  return relatedMap[feature] || []
}

function createFallbackResponse(
  message: string,
  intent: HelpIntent,
  context: HelpContext
): HelpHandlerResult {
  return {
    success: true,
    response: `I'd love to help with that! Could you tell me a bit more about what you're trying to do?

Here are some things I can help with:
- **Sourcing**: "I need to find suppliers for X"
- **Payments**: "Pay invoice #123" or "What's my balance?"
- **Jobs**: "Find me a role in..." or "Help negotiate my offer"
- **General**: "What can you do?" or "Walk me through..."

What would be most helpful?`,
    helpType: intent,
    suggestedActions: [
      { label: 'See all features', action: 'discover' },
      { label: 'Get started', action: 'onboarding' },
    ],
    quickActions: [
      { label: 'Show features', command: 'What can you do?' },
      { label: 'Get help', command: 'Help' },
    ],
    metadata: {
      confidence: 0.5,
      intent,
      fallback: true,
    },
  }
}

// ============================================================================
// PROACTIVE HELP (for context-aware suggestions)
// ============================================================================

export function generateProactiveSuggestion(context: HelpContext): string | null {
  // Check for opportunities to help based on context

  // New user
  if (context.userExperienceLevel === 'new') {
    return 'Tip: You can ask me anything in plain English. Try "I need to buy office supplies" or "Find me suppliers for packaging".'
  }

  // Has pending items
  if (context.pendingItems && context.pendingItems.length > 3) {
    return `You have ${context.pendingItems.length} items waiting for action. Want me to walk through them with you?`
  }

  // On specific pages
  if (context.currentPage?.includes('rfq') && !context.recentActions?.includes('created_rfq')) {
    return 'Looking to source something? Just tell me what you need and I\'ll create an RFQ and match you with suppliers.'
  }

  if (context.currentPage?.includes('treasury') || context.currentPage?.includes('grain')) {
    return 'Pro tip: GRAIN earns yield while you hold it. You can also use it as collateral for credit lines.'
  }

  // Recent actions
  if (context.recentActions?.includes('received_quote')) {
    return 'Got quotes? I can compare them for you and even negotiate automatically. Just say "Compare my quotes" or "Negotiate for me".'
  }

  return null
}

export function shouldShowHelp(context: HelpContext): boolean {
  // Show help for new users
  if (context.userExperienceLevel === 'new') return true

  // Show if user seems stuck (no recent actions)
  if (!context.recentActions || context.recentActions.length === 0) return true

  // Don't interrupt experienced users in flow
  if (context.userExperienceLevel === 'advanced' && context.recentActions.length > 0) return false

  return false
}

// ============================================================================
// EXPORTS
// ============================================================================

export const HelpHandler = {
  handleHelpIntent,
  generateProactiveSuggestion,
  shouldShowHelp,
  detectHelpIntent,
  detectFeatureTopic,
}

export default HelpHandler
