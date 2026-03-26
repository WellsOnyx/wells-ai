// @ts-nocheck
/**
 * Conversational Help System
 *
 * Provides contextual, conversational guidance that feels like asking a knowledgeable friend.
 * Never feels like reading docs - always helpful, proactive, and context-aware.
 */

import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// TYPES
// ============================================================================

export type HelpIntent =
  | 'how_to'              // "How do I create an RFQ?"
  | 'contextual'          // "What can I do here?"
  | 'feature_explain'     // "What's GRAIN?"
  | 'tutorial'            // "Walk me through negotiation"
  | 'troubleshoot'        // "Why didn't my payment go through?"
  | 'best_practices'      // "What's the best way to find suppliers?"
  | 'discover'            // "What else can you do?"
  | 'pro_tip'             // Proactive suggestions based on context
  | 'onboarding'          // First-time user guidance
  | 'clarify'             // Need more info to help

export interface HelpContext {
  userId?: string
  currentPage?: string
  currentJourney?: 'buyer' | 'seller' | 'founder' | 'jobs' | 'treasury'
  recentActions?: string[]
  userExperienceLevel?: 'new' | 'intermediate' | 'advanced'
  activeFeatures?: string[]
  pendingItems?: Array<{
    type: string
    id: string
    status: string
  }>
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface HelpResponse {
  intent: HelpIntent
  response: string
  suggestedActions?: Array<{
    label: string
    action: string
    description?: string
  }>
  relatedTopics?: string[]
  proTips?: string[]
  followUpQuestions?: string[]
  confidence: number
}

// ============================================================================
// KNOWLEDGE BASE - Platform Features & Capabilities
// ============================================================================

export const PLATFORM_FEATURES = {
  // Core Features
  rfq: {
    name: 'RFQ (Request for Quote)',
    description: 'Create requests for suppliers to bid on your procurement needs',
    howTo: `Creating an RFQ is super easy - just tell me what you need. For example:

"I need 500 ball bearings, budget around $3000, need them by next Friday"

I'll take care of:
1. Creating the RFQ with all your specs
2. Matching you with qualified suppliers
3. Notifying them to submit quotes
4. Collecting and comparing responses for you

You can also be less specific - "I need office supplies" works too. I'll ask follow-up questions to get the details.`,
    bestPractices: [
      'Be specific about quantities and specs when you can - you\'ll get more accurate quotes',
      'Include your budget range - it helps suppliers know if they\'re a good fit',
      'Set realistic deadlines - rushed RFQs often get fewer responses',
      'Mention any certifications or requirements upfront',
    ],
    commonIssues: {
      'no_quotes': 'If you\'re not getting quotes, try broadening your specs or extending the deadline. I can also search for more suppliers in that category.',
      'high_quotes': 'Quotes higher than expected? We can negotiate - I can do it automatically or help you craft counter-offers.',
      'wrong_suppliers': 'Getting quotes from suppliers that don\'t fit? Let me know what\'s off and I\'ll refine the matching.',
    },
  },

  grain: {
    name: 'GRAIN',
    description: 'The treasury token that powers payments and earns yield on Grain & Vault',
    howTo: `GRAIN is your business treasury superpower. Here's the deal:

**What is GRAIN?**
GRAIN is backed 1:1 by USDC but with added benefits:
- Earn yield just by holding it (currently ~5% APY)
- Access credit lines based on your balance
- Faster settlements between Grain & Vault users
- Track all payments in one place

**Getting Started:**
1. Connect your bank or crypto wallet
2. Convert USD or USDC to GRAIN
3. Start paying vendors or receiving payments
4. Watch your treasury earn while it sits

Need to pay someone? Just say "Pay @vendor $5000" and I'll handle it.`,
    bestPractices: [
      'Keep operating cash in GRAIN to earn yield between payments',
      'Use credit lines for short-term needs instead of selling GRAIN',
      'Set up recurring payments to automate vendor relationships',
      'Monitor your GRAIN-to-USD ratio for treasury optimization',
    ],
    commonIssues: {
      'conversion_delay': 'GRAIN conversions typically settle in under a minute. If it\'s taking longer, check your verification status.',
      'credit_limit': 'Credit limits are based on your GRAIN balance and payment history. Keep a consistent balance to increase limits.',
      'payment_failed': 'Payment failed? Check: 1) Sufficient balance, 2) Recipient address is correct, 3) Your account is verified.',
    },
  },

  negotiation: {
    name: 'AI Negotiation',
    description: 'Let AI negotiate deals on your behalf, or get coaching for manual negotiations',
    howTo: `I can negotiate deals for you in two ways:

**Autonomous Mode (AI-to-AI):**
Tell me your target price and walk-away point, and I'll negotiate with the other party's AI:
"Negotiate that quote down to $4500, don't go above $5000"

I'll handle the back-and-forth and only close when we hit your terms.

**Coaching Mode:**
Want to negotiate yourself? I'll give you real-time advice:
"Help me negotiate with TechCorp"

I'll analyze their offer, suggest counter-points, and tell you when to push or accept.

**Starting a Negotiation:**
- From a quote: "Negotiate this quote"
- From scratch: "Help me negotiate a deal with [company]"
- Set limits: "My max is $X, target is $Y"`,
    bestPractices: [
      'Always set a walk-away point before starting - emotions run high in negotiations',
      'AI-to-AI negotiation works best for straightforward price negotiations',
      'For complex deals with multiple terms, use coaching mode',
      'Review AI negotiation transcripts to learn patterns for future deals',
    ],
    commonIssues: {
      'stuck_negotiation': 'Negotiation stalled? Try adding non-price terms (delivery, warranty, volume commits) to create movement.',
      'ai_too_aggressive': 'If AI is being too aggressive, adjust your target closer to market rate or switch to coaching mode.',
      'no_response': 'Other party not responding? They might not have AI enabled. I can send a direct message instead.',
    },
  },

  suppliers: {
    name: 'Supplier Discovery',
    description: 'Find, vet, and connect with suppliers across any category',
    howTo: `Finding suppliers is what I do best. Just tell me what you need:

"Find me steel suppliers in the Midwest"
"Who sells custom packaging?"
"I need a manufacturer for electronics"

**What I'll Do:**
1. Search our verified supplier network
2. Check ratings, response times, and specialties
3. Show you the best matches with context
4. Help you reach out or create an RFQ

**Pro Tip:** The more specific you are, the better matches you'll get. Include:
- Location preferences
- Volume requirements
- Quality certifications needed
- Budget range`,
    bestPractices: [
      'Start with 3-5 suppliers for competitive quotes',
      'Check supplier ratings and response times before engaging',
      'Ask for references, especially for large orders',
      'Build relationships with 2-3 reliable suppliers per category',
    ],
    commonIssues: {
      'no_suppliers': 'Can\'t find suppliers? Try broader category terms. I can also help you find suppliers outside our network.',
      'supplier_unresponsive': 'Supplier ghosting you? I\'ll follow up automatically. If they\'re consistently slow, I\'ll flag it.',
      'quality_issues': 'Had quality problems? Leave a review to help others and let me find alternatives.',
    },
  },

  jobs: {
    name: 'Jobs & Talent',
    description: 'Find roles, get hired, or recruit talent for your team',
    howTo: `**For Job Seekers:**
Tell me what you're looking for:
"Find me a CTO role in fintech"
"Remote engineering jobs, $150k+"
"I want to work at a startup"

I'll match you with opportunities, help with applications, and even negotiate your offer.

**For Hiring:**
"I need to hire a senior engineer"
"Find me a fractional CFO"
"Source candidates for marketing manager"

I'll post roles, source candidates, and help you evaluate them.

**Offer Negotiation:**
Got an offer? Say "Help me negotiate my offer from [company]" and I'll:
- Analyze the offer against market data
- Identify negotiation leverage
- Script your counter-offer
- Coach you through the process`,
    bestPractices: [
      'Keep your profile updated - it helps with matching',
      'Apply quickly to new postings - early applicants get more attention',
      'Always negotiate - even small gains compound over your career',
      'Use salary intel before interviews to set expectations',
    ],
    commonIssues: {
      'no_matches': 'Not finding good matches? Try adjusting experience level or expanding location/remote preferences.',
      'no_responses': 'Applications going nowhere? Let me review your materials - small tweaks can make a big difference.',
      'lowball_offer': 'Offer below expectations? I\'ll pull market data and help you make the case for more.',
    },
  },

  payments: {
    name: 'Payments & Treasury',
    description: 'Send payments, manage invoices, and track cash flow',
    howTo: `**Sending Payments:**
"Pay invoice #123"
"Send $5000 to Acme Corp"
"Pay @john 1000 GRAIN"

**Receiving Payments:**
Set up your payment details and I'll:
- Generate invoices
- Send payment reminders
- Track incoming funds
- Reconcile with your books

**Treasury Management:**
"What's my balance?"
"Show recent transactions"
"Draw $10k from credit line"

Everything syncs with your ERP if you've connected it.`,
    bestPractices: [
      'Set up payment terms upfront to avoid collection issues',
      'Use escrow for large deals or new relationships',
      'Automate recurring payments to save time',
      'Review treasury weekly to optimize cash position',
    ],
    commonIssues: {
      'payment_failed': 'Failed payment? Check balance, verify recipient details, and ensure your account is in good standing.',
      'missing_payment': 'Payment not received? I\'ll check the status and follow up with the sender.',
      'invoice_dispute': 'Invoice disputed? I can help mediate or set up escrow for resolution.',
    },
  },

  escrow: {
    name: 'Escrow Protection',
    description: 'Secure funds for deals with milestone-based releases',
    howTo: `Escrow protects both sides of a deal. Here's how it works:

**Creating Escrow:**
"Create escrow for $10,000 deal with TechCorp"

I'll help you set up:
1. Total amount and milestones
2. Release conditions
3. Dispute resolution terms

**Milestone Releases:**
Funds release as milestones complete:
- "Release milestone 1" (after you verify delivery)
- Automatic release after X days if no disputes
- Partial releases for progress payments

**Disputes:**
If something goes wrong:
- Either party can flag an issue
- I'll help mediate
- Funds stay locked until resolved`,
    bestPractices: [
      'Use escrow for first-time vendors or large orders',
      'Define clear, measurable milestones',
      'Include inspection periods before auto-release',
      'Document everything in case of disputes',
    ],
    commonIssues: {
      'funds_locked': 'Funds stuck? Check if all milestones are approved. I can show you the status.',
      'dispute_filed': 'Dispute filed against you? Respond quickly with documentation. I can guide you through it.',
      'release_delayed': 'Waiting for release? I\'ll remind the other party or check the auto-release timeline.',
    },
  },

  erp: {
    name: 'ERP Integration',
    description: 'Connect your accounting system for seamless data flow',
    howTo: `**Supported Systems:**
- QuickBooks Online
- Xero
- NetSuite
- Sage
- Custom via API

**Connecting:**
"Connect my QuickBooks"
"Set up ERP integration"

I'll walk you through OAuth and data mapping.

**What Syncs:**
- Invoices (created here appear there)
- Purchase orders
- Vendor records
- Payment status
- Bank transactions

**Two-Way Sync:**
Changes in either system sync automatically. No double-entry needed.`,
    bestPractices: [
      'Run a test transaction after connecting to verify data flow',
      'Map your chart of accounts before bulk syncing',
      'Set up alerts for sync errors',
      'Review reconciliation weekly',
    ],
    commonIssues: {
      'sync_failed': 'Sync failed? Check your ERP credentials haven\'t expired. I can help you reconnect.',
      'duplicate_entries': 'Seeing duplicates? Let\'s check your sync settings - might need to adjust matching rules.',
      'missing_data': 'Data not syncing? Verify the record types are included in your sync scope.',
    },
  },
}

// ============================================================================
// JOURNEY-SPECIFIC GUIDANCE
// ============================================================================

export const JOURNEY_GUIDANCE = {
  buyer: {
    quickStart: `As a buyer, here's your path to savings:

1. **Tell me what you need** - "I need 1000 widgets" or "Find me office supply vendors"
2. **I'll find suppliers** - Matching you with vetted options
3. **Review quotes** - I'll compare and highlight the best deals
4. **Negotiate** - I can do this for you or coach you
5. **Pay securely** - Use escrow for new vendors, GRAIN for trusted ones

What are you looking to source?`,
    commonTasks: [
      'Create RFQ for products/services',
      'Find and compare suppliers',
      'Negotiate better pricing',
      'Track orders and deliveries',
      'Manage vendor relationships',
      'Analyze spend by category',
    ],
    proTips: [
      'Consolidate orders with fewer suppliers for volume discounts',
      'Set up standing RFQs for recurring needs',
      'Build relationships with backup suppliers for critical items',
      'Use AI negotiation to save time on routine purchases',
    ],
  },

  seller: {
    quickStart: `As a seller, here's how to win more business:

1. **Set up your catalog** - "Add my products" or describe what you sell
2. **Get matched to RFQs** - I'll alert you to relevant opportunities
3. **Submit competitive quotes** - I'll help you price to win
4. **Negotiate deals** - Close faster with AI assistance
5. **Get paid** - Track invoices and collect in GRAIN

What do you sell?`,
    commonTasks: [
      'View incoming RFQs',
      'Submit quotes quickly',
      'Track quote status',
      'Negotiate with buyers',
      'Manage customer relationships',
      'View payment status',
    ],
    proTips: [
      'Respond to RFQs within 24 hours for 3x better win rates',
      'Include value-adds in your quotes to stand out',
      'Build your rating by delivering on time',
      'Use AI to monitor competitor pricing',
    ],
  },

  founder: {
    quickStart: `As a founder, I'm your operations co-pilot:

**Sourcing:** "I need to find a manufacturer"
**Hiring:** "Help me hire a CTO"
**Selling:** "Find me customers in healthcare"
**Financing:** "What's my runway?"

I handle the busy work so you can focus on building.

What's your biggest challenge right now?`,
    commonTasks: [
      'Source products and services',
      'Hire key talent',
      'Find customers and partners',
      'Manage cash flow',
      'Track key metrics',
      'Prepare for fundraising',
    ],
    proTips: [
      'Use Wells for sourcing AND selling - network effects work both ways',
      'Set up alerts for key metrics to catch issues early',
      'Let AI handle routine negotiations to save founder time',
      'Build your supplier relationships before you need them urgently',
    ],
  },

  jobs: {
    quickStart: `Looking for your next role? Let me help:

1. **Tell me what you want** - "Senior PM roles in fintech" or "Remote engineering, $150k+"
2. **I'll find matches** - Searching across our network
3. **Apply smart** - I'll optimize your materials for each role
4. **Track progress** - See all your applications in one place
5. **Negotiate offers** - Get paid what you're worth

What kind of role are you looking for?`,
    commonTasks: [
      'Search for jobs matching your profile',
      'Apply to interesting roles',
      'Track application status',
      'Get salary intelligence',
      'Negotiate offers',
      'Compare multiple offers',
    ],
    proTips: [
      'Keep your profile fresh - updated profiles get 2x more matches',
      'Apply to "stretch" roles too - you might be more qualified than you think',
      'Always negotiate - 87% of companies expect it',
      'Use salary intel before interviews to anchor high',
    ],
  },

  treasury: {
    quickStart: `Welcome to Grain & Vault treasury:

**Your GRAIN earns yield** just by sitting in your account (~5% APY)
**Pay anyone** with "Pay @vendor $5000"
**Check balance** anytime: "What's my balance?"
**Draw credit** when needed: "Draw $10k from credit line"

Your treasury should work as hard as you do.

What would you like to do?`,
    commonTasks: [
      'Check GRAIN balance',
      'Send payments',
      'View transactions',
      'Convert USD to GRAIN',
      'Draw from credit line',
      'Track incoming payments',
    ],
    proTips: [
      'Keep operating cash in GRAIN to earn yield between payments',
      'Use credit for short-term needs instead of converting GRAIN to USD',
      'Set up recurring payments to automate vendor relationships',
      'Monitor yield rates - they adjust based on market conditions',
    ],
  },
}

// ============================================================================
// CONTEXTUAL HELP PATTERNS
// ============================================================================

const HELP_PATTERNS = {
  how_to: [
    /how (do|can|should) i/i,
    /how to/i,
    /what's the (best )?way to/i,
    /can you (show|help|teach) me/i,
    /i want to learn/i,
    /walk me through/i,
    /guide me/i,
  ],
  contextual: [
    /what can i do (here|now)/i,
    /what('s| is) (available|possible)/i,
    /what are my options/i,
    /help$/i,
    /^help me$/i,
    /what should i do/i,
  ],
  feature_explain: [
    /what('s| is) (a |an |the )?(\w+)\??$/i,
    /explain (the )?(\w+)/i,
    /tell me about/i,
    /what does (\w+) (do|mean)/i,
  ],
  tutorial: [
    /walk me through/i,
    /tutorial/i,
    /step by step/i,
    /show me how/i,
    /guide me through/i,
    /teach me/i,
  ],
  troubleshoot: [
    /why (didn't|won't|can't|isn't)/i,
    /not working/i,
    /failed/i,
    /error/i,
    /problem with/i,
    /issue with/i,
    /stuck/i,
    /broken/i,
  ],
  best_practices: [
    /best (way|practice|approach)/i,
    /tips for/i,
    /advice on/i,
    /recommendations? for/i,
    /how should i/i,
    /what's the right way/i,
  ],
  discover: [
    /what (else )?can you do/i,
    /what are your capabilities/i,
    /what features/i,
    /show me everything/i,
    /what's available/i,
  ],
}

// ============================================================================
// INTENT DETECTION
// ============================================================================

export function detectHelpIntent(message: string): HelpIntent {
  const lowerMessage = message.toLowerCase().trim()

  for (const [intent, patterns] of Object.entries(HELP_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        return intent as HelpIntent
      }
    }
  }

  // Default to contextual help if unclear
  return 'contextual'
}

// ============================================================================
// FEATURE DETECTION
// ============================================================================

export function detectFeatureTopic(message: string): keyof typeof PLATFORM_FEATURES | null {
  const lowerMessage = message.toLowerCase()

  const featureKeywords: Record<keyof typeof PLATFORM_FEATURES, string[]> = {
    rfq: ['rfq', 'request for quote', 'quotes', 'quoting', 'procurement', 'sourcing'],
    grain: ['grain', 'token', 'yield', 'treasury token', 'grainvault', 'grain & vault'],
    negotiation: ['negotiat', 'counter-offer', 'deal', 'bargain', 'haggle'],
    suppliers: ['supplier', 'vendor', 'find supplier', 'source', 'manufacturer'],
    jobs: ['job', 'hire', 'hiring', 'recruit', 'talent', 'career', 'role', 'position', 'salary', 'offer'],
    payments: ['pay', 'payment', 'invoice', 'transfer', 'send money', 'transaction'],
    escrow: ['escrow', 'secure payment', 'milestone', 'hold funds'],
    erp: ['erp', 'quickbooks', 'xero', 'accounting', 'integration', 'sync'],
  }

  for (const [feature, keywords] of Object.entries(featureKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return feature as keyof typeof PLATFORM_FEATURES
      }
    }
  }

  return null
}

// ============================================================================
// CONTEXTUAL HELP GENERATOR
// ============================================================================

export function getContextualHelp(context: HelpContext): string {
  const journey = context.currentJourney || 'buyer'
  const guidance = JOURNEY_GUIDANCE[journey]

  let help = guidance.quickStart

  // Add pending items context
  if (context.pendingItems && context.pendingItems.length > 0) {
    const pending = context.pendingItems.slice(0, 3)
    help += `\n\n**You have some pending items:**\n`
    pending.forEach(item => {
      help += `- ${item.type}: ${item.status}\n`
    })
    help += `\nWant me to help with any of these?`
  }

  // Add page-specific context
  if (context.currentPage) {
    const pageHelp = getPageSpecificHelp(context.currentPage, journey)
    if (pageHelp) {
      help += `\n\n${pageHelp}`
    }
  }

  return help
}

function getPageSpecificHelp(page: string, journey: string): string | null {
  const pageHelpMap: Record<string, string> = {
    '/rfq': 'You\'re looking at RFQs. You can create new requests, check on existing ones, or review incoming quotes.',
    '/quotes': 'Here are your quotes. I can help you compare them, start negotiations, or accept the best offer.',
    '/suppliers': 'Browse suppliers or search for specific categories. I can help you find the perfect match.',
    '/jobs': 'Looking for your next opportunity? Tell me what you\'re looking for and I\'ll find matches.',
    '/treasury': 'Your treasury dashboard. I can help you check balances, make payments, or optimize your holdings.',
    '/deals': 'Active deals in progress. Need to take action on any of these?',
    '/settings': 'Settings and preferences. I can help you configure integrations, notifications, and more.',
  }

  return pageHelpMap[page] || null
}

// ============================================================================
// PRO TIPS GENERATOR
// ============================================================================

export function generateProTips(context: HelpContext): string[] {
  const tips: string[] = []

  // Journey-specific tips
  const journey = context.currentJourney || 'buyer'
  const journeyTips = JOURNEY_GUIDANCE[journey]?.proTips || []
  tips.push(...journeyTips.slice(0, 2))

  // Context-specific tips
  if (context.recentActions?.includes('created_rfq')) {
    tips.push('Set up email alerts for new quotes so you don\'t miss good offers')
  }

  if (context.recentActions?.includes('received_quote')) {
    tips.push('Try AI negotiation on quotes - it saves time and often gets you 5-15% better pricing')
  }

  if (context.userExperienceLevel === 'new') {
    tips.push('Tip: You can ask me anything in natural language - no need to navigate menus')
  }

  return tips.slice(0, 3) // Max 3 tips at a time
}

// ============================================================================
// TROUBLESHOOTING ENGINE
// ============================================================================

export function troubleshoot(issue: string, context: HelpContext): string {
  const lowerIssue = issue.toLowerCase()

  // Payment issues
  if (lowerIssue.includes('payment') || lowerIssue.includes('pay')) {
    if (lowerIssue.includes('failed') || lowerIssue.includes('didn\'t go through')) {
      return `Payment issues usually come down to a few things:

1. **Insufficient balance** - Check your GRAIN balance ("What's my balance?")
2. **Wrong recipient** - Double-check the address or email
3. **Verification needed** - Some payments require extra verification
4. **Network delay** - Blockchain transactions can take a few minutes

Want me to check the status of a specific payment? Just give me the transaction ID or recipient name.`
    }
  }

  // Quote issues
  if (lowerIssue.includes('quote') || lowerIssue.includes('rfq')) {
    if (lowerIssue.includes('no') || lowerIssue.includes('didn\'t receive')) {
      return `Not getting quotes? Here are the common reasons:

1. **Too specific** - Overly narrow specs limit supplier matches
2. **Short deadline** - Suppliers skip rushed RFQs
3. **Category mismatch** - Let me check if we have suppliers in your category
4. **Budget too low** - If budget is below market, suppliers may pass

Want me to look at your RFQ and suggest improvements?`
    }
  }

  // Sync/integration issues
  if (lowerIssue.includes('sync') || lowerIssue.includes('erp') || lowerIssue.includes('integration')) {
    return `Integration hiccups happen. Let's troubleshoot:

1. **Check credentials** - Your ERP connection might need re-authentication
2. **Verify scope** - Make sure the record types are included in sync settings
3. **Check for errors** - I can show you the sync log if helpful

Say "Check my ERP connection" and I'll run a diagnostic.`
  }

  // Generic troubleshooting
  return `I'd love to help fix this. Can you tell me:

1. What were you trying to do?
2. What happened instead?
3. Any error messages you saw?

The more details you give me, the faster I can help!`
}

// ============================================================================
// TUTORIAL GENERATOR
// ============================================================================

export function generateTutorial(topic: string, context: HelpContext): string {
  const feature = detectFeatureTopic(topic)

  if (feature && PLATFORM_FEATURES[feature]) {
    return PLATFORM_FEATURES[feature].howTo
  }

  // Generic onboarding tutorial
  return `Let me walk you through the basics:

**Step 1: Tell me what you need**
Just type naturally: "I need to buy X" or "Help me find Y"

**Step 2: I'll take action**
I'll search, create RFQs, or find matches based on your request

**Step 3: Review and decide**
I'll present options - you choose what works

**Step 4: I handle the rest**
Negotiations, payments, follow-ups - I've got it

Try it now! What would you like to accomplish?`
}

// ============================================================================
// DISCOVER CAPABILITIES
// ============================================================================

export function discoverCapabilities(context: HelpContext): string {
  const journey = context.currentJourney

  const coreCapabilities = `**Here's what I can do for you:**

**Sourcing & Procurement**
- Find and compare suppliers
- Create RFQs and collect quotes
- Negotiate better prices (AI or coached)
- Track orders and deliveries

**Payments & Treasury**
- Send GRAIN payments
- Manage invoices
- Track cash flow
- Earn yield on balances

**Hiring & Jobs**
- Search for talent or opportunities
- Post roles and source candidates
- Negotiate offers
- Get salary intelligence

**Deal Management**
- Track active deals
- Use escrow for security
- AI-to-AI negotiation
- Contract generation

**Integrations**
- Connect your ERP (QuickBooks, Xero, etc.)
- Sync invoices and POs
- Bank connections
- Calendar integration`

  const journeySpecific = journey ? `\n\n**For your ${journey} journey specifically:**\n${JOURNEY_GUIDANCE[journey]?.commonTasks.map(t => `- ${t}`).join('\n')}` : ''

  return coreCapabilities + journeySpecific + `\n\nJust ask! I understand natural language, so no need to memorize commands.`
}

// ============================================================================
// AI-POWERED CONVERSATIONAL HELP
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function getConversationalHelp(
  message: string,
  context: HelpContext
): Promise<HelpResponse> {
  const intent = detectHelpIntent(message)
  const feature = detectFeatureTopic(message)

  // Build context for AI
  const contextParts: string[] = []

  if (context.currentJourney) {
    contextParts.push(`User journey: ${context.currentJourney}`)
  }
  if (context.currentPage) {
    contextParts.push(`Current page: ${context.currentPage}`)
  }
  if (context.userExperienceLevel) {
    contextParts.push(`Experience level: ${context.userExperienceLevel}`)
  }
  if (context.recentActions?.length) {
    contextParts.push(`Recent actions: ${context.recentActions.slice(-3).join(', ')}`)
  }
  if (context.pendingItems?.length) {
    contextParts.push(`Pending items: ${context.pendingItems.map(i => i.type).join(', ')}`)
  }

  const systemPrompt = `You are Wells, a helpful AI assistant for the Wells Onyx business platform.

Your job is to help users understand and use the platform. Be:
- Conversational and friendly (like a knowledgeable colleague)
- Practical and action-oriented
- Concise but thorough
- Proactive with suggestions

NEVER be robotic or read like documentation. Speak naturally.

PLATFORM KNOWLEDGE:
${Object.entries(PLATFORM_FEATURES).map(([key, feat]) => `
${feat.name}: ${feat.description}
Best practices: ${feat.bestPractices.slice(0, 2).join('; ')}
`).join('\n')}

USER CONTEXT:
${contextParts.join('\n') || 'New user, no context yet'}

DETECTED INTENT: ${intent}
${feature ? `TOPIC: ${feature}` : ''}

Respond helpfully. Include:
1. Direct answer to their question
2. A relevant example or tip
3. A natural follow-up question or suggestion

Keep response under 300 words unless they asked for a tutorial.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...(context.conversationHistory || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: message,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const responseText = textBlock?.type === 'text' ? textBlock.text : 'I\'m here to help! What would you like to know?'

    // Generate additional context
    const suggestedActions = generateSuggestedActions(intent, feature, context)
    const relatedTopics = generateRelatedTopics(feature)
    const proTips = generateProTips(context)

    return {
      intent,
      response: responseText,
      suggestedActions,
      relatedTopics,
      proTips: intent === 'how_to' || intent === 'tutorial' ? proTips : undefined,
      followUpQuestions: generateFollowUpQuestions(intent, feature),
      confidence: 0.9,
    }
  } catch (error) {
    console.error('[ConversationalHelp] Error:', error)

    // Fallback to structured help
    let fallbackResponse: string

    switch (intent) {
      case 'how_to':
      case 'tutorial':
        fallbackResponse = feature ? PLATFORM_FEATURES[feature]?.howTo || generateTutorial(message, context) : generateTutorial(message, context)
        break
      case 'contextual':
        fallbackResponse = getContextualHelp(context)
        break
      case 'feature_explain':
        fallbackResponse = feature ? `${PLATFORM_FEATURES[feature]?.name}: ${PLATFORM_FEATURES[feature]?.description}\n\n${PLATFORM_FEATURES[feature]?.howTo}` : discoverCapabilities(context)
        break
      case 'troubleshoot':
        fallbackResponse = troubleshoot(message, context)
        break
      case 'best_practices':
        fallbackResponse = feature ? PLATFORM_FEATURES[feature]?.bestPractices.join('\n\n') || 'I can help with best practices! What area are you interested in?' : 'I can help with best practices! What area are you interested in?'
        break
      case 'discover':
        fallbackResponse = discoverCapabilities(context)
        break
      default:
        fallbackResponse = getContextualHelp(context)
    }

    return {
      intent,
      response: fallbackResponse,
      suggestedActions: generateSuggestedActions(intent, feature, context),
      confidence: 0.7,
    }
  }
}

// ============================================================================
// HELPER GENERATORS
// ============================================================================

function generateSuggestedActions(
  intent: HelpIntent,
  feature: keyof typeof PLATFORM_FEATURES | null,
  context: HelpContext
): Array<{ label: string; action: string; description?: string }> {
  const actions: Array<{ label: string; action: string; description?: string }> = []

  if (feature) {
    switch (feature) {
      case 'rfq':
        actions.push(
          { label: 'Create RFQ', action: 'create_rfq', description: 'Start a new request for quotes' },
          { label: 'View My RFQs', action: 'view_rfqs', description: 'Check status of existing RFQs' },
        )
        break
      case 'suppliers':
        actions.push(
          { label: 'Find Suppliers', action: 'find_suppliers', description: 'Search for suppliers by category' },
        )
        break
      case 'payments':
        actions.push(
          { label: 'Check Balance', action: 'check_balance', description: 'View your GRAIN balance' },
          { label: 'Send Payment', action: 'send_payment', description: 'Pay a vendor or contact' },
        )
        break
      case 'jobs':
        actions.push(
          { label: 'Search Jobs', action: 'search_jobs', description: 'Find matching opportunities' },
          { label: 'Post a Role', action: 'post_job', description: 'Hire for your team' },
        )
        break
    }
  }

  // Add journey-specific actions
  if (context.currentJourney === 'buyer' && actions.length < 3) {
    actions.push({ label: 'Analyze Spend', action: 'spend_analysis', description: 'Review your spending patterns' })
  }

  return actions.slice(0, 3)
}

function generateRelatedTopics(feature: keyof typeof PLATFORM_FEATURES | null): string[] {
  const topicMap: Record<string, string[]> = {
    rfq: ['Negotiation', 'Suppliers', 'Payments'],
    suppliers: ['RFQ', 'Escrow', 'Payments'],
    negotiation: ['RFQ', 'Escrow', 'Payments'],
    grain: ['Payments', 'Treasury', 'Credit Lines'],
    payments: ['GRAIN', 'Escrow', 'ERP Integration'],
    jobs: ['Salary Negotiation', 'Profile Optimization', 'Offer Comparison'],
    escrow: ['Payments', 'Suppliers', 'Deals'],
    erp: ['Payments', 'Invoices', 'Sync'],
  }

  return feature ? topicMap[feature] || [] : []
}

function generateFollowUpQuestions(
  intent: HelpIntent,
  feature: keyof typeof PLATFORM_FEATURES | null
): string[] {
  const questions: string[] = []

  switch (intent) {
    case 'how_to':
      questions.push('Want me to walk you through it step by step?')
      questions.push('Should I show you an example?')
      break
    case 'troubleshoot':
      questions.push('Did that help? What happened when you tried?')
      questions.push('Want me to check on something specific?')
      break
    case 'feature_explain':
      questions.push('Want to try it out?')
      questions.push('Any questions about how it works?')
      break
  }

  if (feature) {
    const featureQuestions: Record<string, string[]> = {
      rfq: ['What are you looking to source?', 'Want me to find suppliers for you?'],
      suppliers: ['What category are you looking for?', 'Any location preferences?'],
      payments: ['Need to send a payment?', 'Want to check your balance?'],
      jobs: ['What kind of role interests you?', 'Looking to hire or get hired?'],
    }
    questions.push(...(featureQuestions[feature] || []))
  }

  return questions.slice(0, 2)
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationalHelp = {
  detectHelpIntent,
  detectFeatureTopic,
  getContextualHelp,
  generateProTips,
  troubleshoot,
  generateTutorial,
  discoverCapabilities,
  getConversationalHelp,
  PLATFORM_FEATURES,
  JOURNEY_GUIDANCE,
}

export default ConversationalHelp
