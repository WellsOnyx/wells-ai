// @ts-nocheck
/**
 * Wells AI Intent Router
 *
 * The brain of Wells - understands user intent and routes to the right service.
 * Users never navigate menus. They just talk to Wells.
 *
 * Intent Categories:
 * - BUYER: RFQ, supplier search, spend analysis, PO creation, payments
 * - SELLER: Catalog, quotes, quote acceptance, performance metrics
 * - FOUNDER: Multi-journey, runway analysis, hiring, sourcing
 * - JOB_SEEKER: Job search, applications, offer negotiation, salary intel
 * - UNIVERSAL: Help, capabilities, status, undo
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// INTENT TYPES
// ============================================================================

export type IntentCategory = 'buyer' | 'seller' | 'founder' | 'jobs' | 'universal' | 'treasury' | 'unknown'

export type BuyerIntent =
  | 'create_rfq'           // "I need to order ball bearings"
  | 'supplier_search'      // "Find me a cheaper supplier for office supplies"
  | 'spend_analysis'       // "What's my spend this month?"
  | 'create_po'            // "Create a PO for Acme"
  | 'pay_invoice'          // "Pay invoice #123"
  | 'track_order'          // "Where's my order from Precision?"
  | 'compare_quotes'       // "Compare these quotes"
  | 'approve_quote'        // "Accept the quote from Acme"
  | 'reject_quote'         // "Pass on that supplier"
  | 'budget_check'         // "Do I have budget for this?"
  | 'vendor_history'       // "Show me our history with Acme"

export type SellerIntent =
  | 'setup_catalog'        // "Set up my catalog"
  | 'view_quotes'          // "Show me my pending quotes"
  | 'create_quote'         // "Quote $5000 for that order"
  | 'accept_offer'         // "Accept the offer from TechCorp"
  | 'reject_offer'         // "Decline that RFQ"
  | 'counter_offer'        // "Counter at $6000"
  | 'performance_metrics'  // "What's my win rate?"
  | 'view_rfqs'            // "Any new RFQs today?"
  | 'update_pricing'       // "Update my pricing for bearings"
  | 'check_payments'       // "Did TechCorp pay yet?"

export type FounderIntent =
  | 'multi_journey_setup'  // "I need suppliers AND customers"
  | 'runway_analysis'      // "What's my runway?"
  | 'hire_talent'          // "Find me a CTO"
  | 'source_products'      // "Source 1000 units of X"
  | 'financial_overview'   // "How's the business doing?"
  | 'growth_strategy'      // "Help me grow faster"
  | 'investor_prep'        // "Prepare for investor meeting"
  | 'team_status'          // "How's my team doing?"

export type JobSeekerIntent =
  | 'job_search'           // "Find me a senior engineer role"
  | 'apply_job'            // "Apply to TechCorp"
  | 'negotiate_offer'      // "Negotiate this offer higher"
  | 'salary_intel'         // "What's market rate for my role?"
  | 'view_applications'    // "Show my applications"
  | 'update_profile'       // "Update my resume"
  | 'track_application'    // "Any updates on my TechCorp app?"
  | 'withdraw_application' // "Withdraw from that role"
  | 'compare_offers'       // "Compare these two offers"

export type TreasuryIntent =
  | 'check_balance'        // "What's my GRAIN balance?"
  | 'send_payment'         // "Send $1000 to @user"
  | 'view_transactions'    // "Show my recent transactions"
  | 'credit_status'        // "What's my credit line?"
  | 'earn_grain'           // "How do I earn more GRAIN?"

export type UniversalIntent =
  | 'help'                 // "Help"
  | 'capabilities'         // "What can you do?"
  | 'status_update'        // "Status update"
  | 'undo_action'          // "Cancel that"
  | 'clarify'              // Ambiguous, need more info
  | 'greeting'             // "Hello" / "Hey Wells"
  | 'feedback'             // "Great job!" / "That's wrong"
  | 'switch_journey'       // "Switch to buyer mode"
  | 'settings'             // "Change my preferences"

export type Intent =
  | BuyerIntent
  | SellerIntent
  | FounderIntent
  | JobSeekerIntent
  | TreasuryIntent
  | UniversalIntent

export interface IntentClassification {
  category: IntentCategory
  intent: Intent
  confidence: number // 0-1
  entities: ExtractedEntities
  requiresConfirmation: boolean
  suggestedAction?: string
  alternativeIntents?: Array<{ intent: Intent; confidence: number }>
}

export interface ExtractedEntities {
  // Common
  amount?: number
  quantity?: number
  currency?: string
  deadline?: Date
  urgency?: 'low' | 'normal' | 'high' | 'critical'

  // Product/Service
  productName?: string
  productCategory?: string
  specifications?: Record<string, unknown>

  // People/Organizations
  companyName?: string
  supplierName?: string
  vendorName?: string
  personName?: string
  email?: string

  // References
  rfqId?: string
  quoteId?: string
  orderId?: string
  invoiceId?: string
  jobId?: string
  applicationId?: string
  transactionId?: string

  // Job-specific
  role?: string
  skills?: string[]
  salary?: {
    min?: number
    max?: number
    currency?: string
  }
  location?: string
  remote?: boolean

  // Time
  timeframe?: string
  startDate?: Date
  endDate?: Date

  // Raw extracted values
  rawValues?: Record<string, string>
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

const INTENT_PATTERNS: Record<IntentCategory, Record<string, string[]>> = {
  buyer: {
    create_rfq: [
      'need to order', 'want to buy', 'purchase', 'source', 'get me',
      'find suppliers for', 'need supplies', 'order', 'procurement',
      'looking for', 'where can i get', 'i need', 'require'
    ],
    supplier_search: [
      'find supplier', 'cheaper supplier', 'alternative vendor',
      'who sells', 'supplier for', 'vendors for', 'compare suppliers'
    ],
    spend_analysis: [
      'spend this month', 'spending', 'expenditure', 'what did i spend',
      'budget usage', 'costs so far', 'total spent'
    ],
    create_po: [
      'create po', 'purchase order', 'generate po', 'po for'
    ],
    pay_invoice: [
      'pay invoice', 'pay bill', 'make payment', 'settle invoice',
      'pay #', 'payment for'
    ],
    track_order: [
      'where is my order', 'track', 'shipment status', 'delivery status',
      'when will', 'eta on'
    ],
    compare_quotes: [
      'compare quotes', 'which quote', 'best offer', 'compare prices'
    ],
    approve_quote: [
      'accept quote', 'approve', 'go with', 'choose', 'select',
      'proceed with', 'take the offer'
    ],
    reject_quote: [
      'reject', 'decline', 'pass on', 'not interested', 'no thanks'
    ],
  },
  seller: {
    setup_catalog: [
      'set up catalog', 'add products', 'create listing', 'add to catalog',
      'list my products', 'product catalog'
    ],
    view_quotes: [
      'pending quotes', 'my quotes', 'quote status', 'outgoing quotes',
      'quotes i sent'
    ],
    create_quote: [
      'quote', 'send quote', 'price at', 'quote at', 'offer'
    ],
    accept_offer: [
      'accept offer', 'accept order', 'confirm order', 'take the order'
    ],
    reject_offer: [
      'decline rfq', 'reject request', 'pass on this', 'can\'t fulfill'
    ],
    counter_offer: [
      'counter', 'negotiate', 'propose', 'counter offer'
    ],
    performance_metrics: [
      'win rate', 'conversion', 'my stats', 'performance', 'how am i doing',
      'metrics', 'sales stats'
    ],
    view_rfqs: [
      'new rfqs', 'incoming requests', 'rfq today', 'buyer requests',
      'opportunities'
    ],
    check_payments: [
      'did they pay', 'payment status', 'received payment', 'incoming payment'
    ],
  },
  founder: {
    multi_journey_setup: [
      'suppliers and customers', 'both buy and sell', 'marketplace',
      'two-sided', 'buy and sell'
    ],
    runway_analysis: [
      'runway', 'burn rate', 'how long', 'cash runway', 'months left'
    ],
    hire_talent: [
      'hire', 'find me a', 'recruit', 'need a cto', 'need an engineer',
      'hiring', 'looking for talent'
    ],
    source_products: [
      'source', 'manufacturing', 'produce', 'make', 'get made'
    ],
    financial_overview: [
      'business doing', 'financials', 'p&l', 'revenue', 'overall status'
    ],
    growth_strategy: [
      'grow faster', 'scale', 'expansion', 'growth strategy'
    ],
    team_status: [
      'team doing', 'team performance', 'employee', 'staff'
    ],
  },
  jobs: {
    job_search: [
      'find job', 'looking for role', 'job opportunities', 'openings',
      'positions', 'hiring for', 'work as'
    ],
    apply_job: [
      'apply to', 'submit application', 'apply for', 'interested in the role'
    ],
    negotiate_offer: [
      'negotiate offer', 'counter offer', 'ask for more', 'higher salary',
      'negotiate salary', 'want more'
    ],
    salary_intel: [
      'market rate', 'salary for', 'compensation', 'pay range',
      'what should i ask for', 'typical salary'
    ],
    view_applications: [
      'my applications', 'application status', 'applied to', 'where i applied'
    ],
    update_profile: [
      'update resume', 'update profile', 'add experience', 'change bio'
    ],
    track_application: [
      'updates on', 'hear back', 'application progress', 'did they respond'
    ],
    compare_offers: [
      'compare offers', 'which offer', 'better offer', 'evaluate offers'
    ],
  },
  treasury: {
    check_balance: [
      'grain balance', 'my balance', 'how much grain', 'wallet balance'
    ],
    send_payment: [
      'send', 'transfer', 'pay @', 'send grain', 'pay user'
    ],
    view_transactions: [
      'transactions', 'history', 'recent payments', 'what did i send'
    ],
    credit_status: [
      'credit line', 'credit limit', 'available credit', 'borrowing'
    ],
    earn_grain: [
      'earn grain', 'get grain', 'how to earn', 'more grain'
    ],
  },
  universal: {
    help: [
      'help', 'how do i', 'what can i', 'stuck', 'confused', 'assist'
    ],
    capabilities: [
      'what can you do', 'capabilities', 'features', 'what do you do'
    ],
    status_update: [
      'status', 'update', 'what\'s happening', 'summary', 'overview'
    ],
    undo_action: [
      'cancel', 'undo', 'never mind', 'stop', 'forget that', 'don\'t'
    ],
    greeting: [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon'
    ],
    feedback: [
      'great job', 'thanks', 'that\'s wrong', 'incorrect', 'perfect'
    ],
    switch_journey: [
      'switch to', 'change mode', 'i want to be a', 'as a buyer', 'as a seller'
    ],
  },
  unknown: {},
}

/**
 * Quick pattern-based intent classification
 * Used as a first pass before AI classification for common patterns
 */
export function quickClassifyIntent(message: string): IntentClassification | null {
  const lowerMessage = message.toLowerCase().trim()

  for (const [category, intents] of Object.entries(INTENT_PATTERNS)) {
    for (const [intent, patterns] of Object.entries(intents)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          return {
            category: category as IntentCategory,
            intent: intent as Intent,
            confidence: 0.7, // Pattern match confidence
            entities: {},
            requiresConfirmation: false,
          }
        }
      }
    }
  }

  return null
}

/**
 * Full AI-powered intent classification with entity extraction
 */
export async function classifyIntent(
  message: string,
  context: {
    userJourney?: IntentCategory
    recentMessages?: Array<{ role: string; content: string }>
    activeDeals?: Array<{ id: string; type: string; status: string }>
    userPreferences?: Record<string, unknown>
  } = {}
): Promise<IntentClassification> {
  // Try quick classification first
  const quickResult = quickClassifyIntent(message)

  // Build context for AI
  const contextString = buildContextString(context)

  const systemPrompt = `You are an intent classification system for Wells AI, a conversational commerce platform.

Your job is to understand what the user wants and extract relevant entities.

USER CONTEXT:
${contextString}

INTENT CATEGORIES:
1. buyer - Purchasing, sourcing, payments (RFQs, POs, invoices, suppliers)
2. seller - Selling, quoting, catalog management (quotes, RFQs, orders)
3. founder - Business operations, hiring, multi-sided needs
4. jobs - Job searching, applications, salary negotiation
5. treasury - GRAIN balance, payments, transactions
6. universal - Help, status, capabilities, greetings

RESPOND WITH JSON ONLY:
{
  "category": "buyer|seller|founder|jobs|treasury|universal|unknown",
  "intent": "specific_intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "amount": number or null,
    "quantity": number or null,
    "productName": "string or null",
    "companyName": "string or null",
    "role": "string or null",
    "rfqId": "string or null",
    "invoiceId": "string or null",
    "deadline": "ISO date or null",
    "urgency": "low|normal|high|critical or null",
    "skills": ["array"] or null,
    "salary": { "min": number, "max": number } or null
  },
  "requiresConfirmation": boolean,
  "suggestedAction": "what Wells should do next"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Classify this message: "${message}"`,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : '{}'

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[0] || '{}')

      // Merge with quick classification if available for higher confidence
      if (quickResult && quickResult.intent === parsed.intent) {
        parsed.confidence = Math.min(1, (parsed.confidence || 0.7) + 0.1)
      }

      return {
        category: parsed.category || 'unknown',
        intent: parsed.intent || 'clarify',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        requiresConfirmation: parsed.requiresConfirmation || false,
        suggestedAction: parsed.suggestedAction,
      }
    } catch {
      // Fallback to quick classification
      return quickResult || {
        category: 'universal',
        intent: 'clarify',
        confidence: 0.3,
        entities: {},
        requiresConfirmation: true,
      }
    }
  } catch (error) {
    console.error('[IntentRouter] Error classifying intent:', error)
    return quickResult || {
      category: 'universal',
      intent: 'clarify',
      confidence: 0.3,
      entities: {},
      requiresConfirmation: true,
    }
  }
}

function buildContextString(context: {
  userJourney?: IntentCategory
  recentMessages?: Array<{ role: string; content: string }>
  activeDeals?: Array<{ id: string; type: string; status: string }>
  userPreferences?: Record<string, unknown>
}): string {
  const parts: string[] = []

  if (context.userJourney) {
    parts.push(`Primary Journey: ${context.userJourney}`)
  }

  if (context.recentMessages && context.recentMessages.length > 0) {
    const recent = context.recentMessages.slice(-3)
    parts.push(`Recent conversation:\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`)
  }

  if (context.activeDeals && context.activeDeals.length > 0) {
    parts.push(`Active deals: ${context.activeDeals.map(d => `${d.type}(${d.id}): ${d.status}`).join(', ')}`)
  }

  return parts.join('\n\n') || 'New conversation'
}

// ============================================================================
// INTENT ROUTING
// ============================================================================

export interface RouteResult {
  handler: string
  toolGroup: string
  action: string
  params: Record<string, unknown>
  confirmationRequired: boolean
  confirmationMessage?: string
}

/**
 * Route a classified intent to the appropriate handler
 */
export function routeIntent(classification: IntentClassification): RouteResult {
  const { category, intent, entities, requiresConfirmation } = classification

  switch (category) {
    case 'buyer':
      return routeBuyerIntent(intent as BuyerIntent, entities, requiresConfirmation)
    case 'seller':
      return routeSellerIntent(intent as SellerIntent, entities, requiresConfirmation)
    case 'founder':
      return routeFounderIntent(intent as FounderIntent, entities, requiresConfirmation)
    case 'jobs':
      return routeJobsIntent(intent as JobSeekerIntent, entities, requiresConfirmation)
    case 'treasury':
      return routeTreasuryIntent(intent as TreasuryIntent, entities, requiresConfirmation)
    case 'universal':
      return routeUniversalIntent(intent as UniversalIntent, entities)
    default:
      return {
        handler: 'clarification',
        toolGroup: 'universal',
        action: 'clarify',
        params: { originalIntent: intent },
        confirmationRequired: true,
        confirmationMessage: 'I want to make sure I understand correctly. Could you tell me more about what you need?',
      }
  }
}

function routeBuyerIntent(
  intent: BuyerIntent,
  entities: ExtractedEntities,
  requiresConfirmation: boolean
): RouteResult {
  switch (intent) {
    case 'create_rfq':
      return {
        handler: 'rfq.create',
        toolGroup: 'rfq',
        action: 'createRFQ',
        params: {
          product: entities.productName,
          quantity: entities.quantity,
          budget: entities.amount,
          deadline: entities.deadline,
          urgency: entities.urgency || 'normal',
          specifications: entities.specifications,
        },
        confirmationRequired: requiresConfirmation,
        confirmationMessage: entities.productName
          ? `I'll create an RFQ for ${entities.quantity || 'some'} ${entities.productName}. Should I proceed?`
          : 'What product or service do you need?',
      }

    case 'supplier_search':
      return {
        handler: 'rfq.supplierSearch',
        toolGroup: 'rfq',
        action: 'searchSuppliers',
        params: {
          category: entities.productCategory || entities.productName,
          location: entities.location,
        },
        confirmationRequired: false,
      }

    case 'spend_analysis':
      return {
        handler: 'erp.spendAnalysis',
        toolGroup: 'erp',
        action: 'getSpendAnalysis',
        params: {
          timeframe: entities.timeframe || 'this_month',
          category: entities.productCategory,
        },
        confirmationRequired: false,
      }

    case 'create_po':
      return {
        handler: 'erp.createPO',
        toolGroup: 'erp',
        action: 'createPurchaseOrder',
        params: {
          vendor: entities.vendorName || entities.companyName,
          amount: entities.amount,
          items: entities.specifications,
        },
        confirmationRequired: true,
        confirmationMessage: `Create a PO for ${entities.vendorName || entities.companyName || 'this vendor'}?`,
      }

    case 'pay_invoice':
      return {
        handler: 'payments.payInvoice',
        toolGroup: 'payments',
        action: 'initiatePayment',
        params: {
          invoiceId: entities.invoiceId,
          amount: entities.amount,
          vendor: entities.vendorName,
        },
        confirmationRequired: true,
        confirmationMessage: entities.invoiceId
          ? `Pay invoice ${entities.invoiceId}${entities.amount ? ` ($${entities.amount})` : ''}?`
          : 'Which invoice would you like to pay?',
      }

    case 'track_order':
      return {
        handler: 'rfq.trackOrder',
        toolGroup: 'rfq',
        action: 'trackFulfillment',
        params: {
          orderId: entities.orderId,
          vendor: entities.vendorName,
        },
        confirmationRequired: false,
      }

    case 'compare_quotes':
      return {
        handler: 'rfq.compareQuotes',
        toolGroup: 'rfq',
        action: 'compareQuotes',
        params: {
          rfqId: entities.rfqId,
        },
        confirmationRequired: false,
      }

    case 'approve_quote':
      return {
        handler: 'rfq.approveQuote',
        toolGroup: 'rfq',
        action: 'awardQuote',
        params: {
          quoteId: entities.quoteId,
          vendor: entities.vendorName || entities.companyName,
        },
        confirmationRequired: true,
        confirmationMessage: `Accept the quote from ${entities.vendorName || entities.companyName || 'this supplier'}?`,
      }

    case 'reject_quote':
      return {
        handler: 'rfq.rejectQuote',
        toolGroup: 'rfq',
        action: 'rejectQuote',
        params: {
          quoteId: entities.quoteId,
          vendor: entities.vendorName,
        },
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'buyer.general',
        toolGroup: 'rfq',
        action: 'handleBuyerRequest',
        params: { entities },
        confirmationRequired: true,
      }
  }
}

function routeSellerIntent(
  intent: SellerIntent,
  entities: ExtractedEntities,
  requiresConfirmation: boolean
): RouteResult {
  switch (intent) {
    case 'view_rfqs':
      return {
        handler: 'rfq.viewIncoming',
        toolGroup: 'rfq',
        action: 'getIncomingRFQs',
        params: {},
        confirmationRequired: false,
      }

    case 'view_quotes':
      return {
        handler: 'rfq.viewOutgoingQuotes',
        toolGroup: 'rfq',
        action: 'getOutgoingQuotes',
        params: { status: 'pending' },
        confirmationRequired: false,
      }

    case 'create_quote':
      return {
        handler: 'rfq.createQuote',
        toolGroup: 'rfq',
        action: 'createQuote',
        params: {
          rfqId: entities.rfqId,
          amount: entities.amount,
          leadTime: entities.timeframe,
        },
        confirmationRequired: requiresConfirmation,
        confirmationMessage: entities.amount
          ? `Send a quote for $${entities.amount}?`
          : 'What price would you like to quote?',
      }

    case 'accept_offer':
      return {
        handler: 'rfq.acceptOrder',
        toolGroup: 'rfq',
        action: 'acknowledgeAward',
        params: {
          buyer: entities.companyName,
        },
        confirmationRequired: true,
        confirmationMessage: `Accept the order from ${entities.companyName || 'this buyer'}?`,
      }

    case 'counter_offer':
      return {
        handler: 'rfq.counterOffer',
        toolGroup: 'rfq',
        action: 'submitCounterOffer',
        params: {
          amount: entities.amount,
          rfqId: entities.rfqId,
        },
        confirmationRequired: true,
        confirmationMessage: entities.amount
          ? `Counter at $${entities.amount}?`
          : 'What price would you like to counter with?',
      }

    case 'performance_metrics':
      return {
        handler: 'insights.sellerMetrics',
        toolGroup: 'insights',
        action: 'getSellerMetrics',
        params: { timeframe: entities.timeframe || 'all_time' },
        confirmationRequired: false,
      }

    case 'setup_catalog':
      return {
        handler: 'rfq.catalogSetup',
        toolGroup: 'rfq',
        action: 'setupCatalog',
        params: {},
        confirmationRequired: false,
      }

    case 'check_payments':
      return {
        handler: 'payments.checkIncoming',
        toolGroup: 'payments',
        action: 'getIncomingPayments',
        params: {
          buyer: entities.companyName,
        },
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'seller.general',
        toolGroup: 'rfq',
        action: 'handleSellerRequest',
        params: { entities },
        confirmationRequired: true,
      }
  }
}

function routeFounderIntent(
  intent: FounderIntent,
  entities: ExtractedEntities,
  requiresConfirmation: boolean
): RouteResult {
  switch (intent) {
    case 'multi_journey_setup':
      return {
        handler: 'founder.multiJourney',
        toolGroup: 'founder',
        action: 'setupMultiJourney',
        params: {},
        confirmationRequired: false,
        confirmationMessage: 'I can help you set up as both a buyer and seller. Let\'s start - which side is more urgent for you right now?',
      }

    case 'runway_analysis':
      return {
        handler: 'insights.runway',
        toolGroup: 'insights',
        action: 'analyzeRunway',
        params: {},
        confirmationRequired: false,
      }

    case 'hire_talent':
      return {
        handler: 'jobs.postRole',
        toolGroup: 'jobs',
        action: 'createJobPosting',
        params: {
          role: entities.role,
          skills: entities.skills,
          salary: entities.salary,
        },
        confirmationRequired: requiresConfirmation,
        confirmationMessage: entities.role
          ? `Let's find you a ${entities.role}. What skills are most important?`
          : 'What role are you looking to fill?',
      }

    case 'source_products':
      return {
        handler: 'rfq.create',
        toolGroup: 'rfq',
        action: 'createRFQ',
        params: {
          product: entities.productName,
          quantity: entities.quantity,
          isManufacturing: true,
        },
        confirmationRequired: requiresConfirmation,
      }

    case 'financial_overview':
      return {
        handler: 'insights.financialOverview',
        toolGroup: 'insights',
        action: 'getFinancialOverview',
        params: {},
        confirmationRequired: false,
      }

    case 'team_status':
      return {
        handler: 'insights.teamStatus',
        toolGroup: 'insights',
        action: 'getTeamStatus',
        params: {},
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'founder.general',
        toolGroup: 'founder',
        action: 'handleFounderRequest',
        params: { entities },
        confirmationRequired: true,
      }
  }
}

function routeJobsIntent(
  intent: JobSeekerIntent,
  entities: ExtractedEntities,
  requiresConfirmation: boolean
): RouteResult {
  switch (intent) {
    case 'job_search':
      return {
        handler: 'jobs.search',
        toolGroup: 'jobs',
        action: 'searchJobs',
        params: {
          role: entities.role,
          skills: entities.skills,
          location: entities.location,
          remote: entities.remote,
          salary: entities.salary,
        },
        confirmationRequired: false,
      }

    case 'apply_job':
      return {
        handler: 'jobs.apply',
        toolGroup: 'jobs',
        action: 'submitApplication',
        params: {
          jobId: entities.jobId,
          company: entities.companyName,
        },
        confirmationRequired: true,
        confirmationMessage: `Apply to ${entities.companyName || 'this role'}?`,
      }

    case 'negotiate_offer':
      return {
        handler: 'jobs.negotiate',
        toolGroup: 'jobs',
        action: 'negotiateOffer',
        params: {
          company: entities.companyName,
          currentOffer: entities.amount,
          targetSalary: entities.salary?.max,
        },
        confirmationRequired: true,
        confirmationMessage: entities.salary?.max
          ? `I'll negotiate for ${entities.salary.currency || '$'}${entities.salary.max.toLocaleString()}. Proceed?`
          : 'What salary are you targeting?',
      }

    case 'salary_intel':
      return {
        handler: 'jobs.salaryIntel',
        toolGroup: 'jobs',
        action: 'getSalaryData',
        params: {
          role: entities.role,
          location: entities.location,
          skills: entities.skills,
        },
        confirmationRequired: false,
      }

    case 'view_applications':
      return {
        handler: 'jobs.viewApplications',
        toolGroup: 'jobs',
        action: 'getApplications',
        params: {},
        confirmationRequired: false,
      }

    case 'track_application':
      return {
        handler: 'jobs.trackApplication',
        toolGroup: 'jobs',
        action: 'getApplicationStatus',
        params: {
          company: entities.companyName,
          applicationId: entities.applicationId,
        },
        confirmationRequired: false,
      }

    case 'compare_offers':
      return {
        handler: 'jobs.compareOffers',
        toolGroup: 'jobs',
        action: 'compareOffers',
        params: {},
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'jobs.general',
        toolGroup: 'jobs',
        action: 'handleJobsRequest',
        params: { entities },
        confirmationRequired: true,
      }
  }
}

function routeTreasuryIntent(
  intent: TreasuryIntent,
  entities: ExtractedEntities,
  requiresConfirmation: boolean
): RouteResult {
  switch (intent) {
    case 'check_balance':
      return {
        handler: 'treasury.balance',
        toolGroup: 'treasury',
        action: 'getBalance',
        params: {},
        confirmationRequired: false,
      }

    case 'send_payment':
      return {
        handler: 'treasury.send',
        toolGroup: 'treasury',
        action: 'initiateTransfer',
        params: {
          recipient: entities.personName || entities.email,
          amount: entities.amount,
          currency: entities.currency || 'GRAIN',
        },
        confirmationRequired: true,
        confirmationMessage: entities.amount && (entities.personName || entities.email)
          ? `Send ${entities.amount} ${entities.currency || 'GRAIN'} to ${entities.personName || entities.email}?`
          : 'Who would you like to send to and how much?',
      }

    case 'view_transactions':
      return {
        handler: 'treasury.transactions',
        toolGroup: 'treasury',
        action: 'getTransactions',
        params: {
          timeframe: entities.timeframe || 'recent',
        },
        confirmationRequired: false,
      }

    case 'credit_status':
      return {
        handler: 'treasury.creditStatus',
        toolGroup: 'treasury',
        action: 'getCreditStatus',
        params: {},
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'treasury.general',
        toolGroup: 'treasury',
        action: 'handleTreasuryRequest',
        params: { entities },
        confirmationRequired: true,
      }
  }
}

function routeUniversalIntent(
  intent: UniversalIntent,
  entities: ExtractedEntities
): RouteResult {
  switch (intent) {
    case 'help':
      return {
        handler: 'universal.help',
        toolGroup: 'universal',
        action: 'provideHelp',
        params: {},
        confirmationRequired: false,
      }

    case 'capabilities':
      return {
        handler: 'universal.capabilities',
        toolGroup: 'universal',
        action: 'showCapabilities',
        params: {},
        confirmationRequired: false,
      }

    case 'status_update':
      return {
        handler: 'universal.status',
        toolGroup: 'universal',
        action: 'getStatusUpdate',
        params: {},
        confirmationRequired: false,
      }

    case 'undo_action':
      return {
        handler: 'universal.undo',
        toolGroup: 'universal',
        action: 'undoLastAction',
        params: {},
        confirmationRequired: true,
        confirmationMessage: 'Cancel the last action?',
      }

    case 'greeting':
      return {
        handler: 'universal.greeting',
        toolGroup: 'universal',
        action: 'respondToGreeting',
        params: {},
        confirmationRequired: false,
      }

    case 'switch_journey':
      return {
        handler: 'universal.switchJourney',
        toolGroup: 'universal',
        action: 'switchJourney',
        params: {
          targetJourney: entities.rawValues?.journey,
        },
        confirmationRequired: false,
      }

    default:
      return {
        handler: 'universal.clarify',
        toolGroup: 'universal',
        action: 'requestClarification',
        params: {},
        confirmationRequired: true,
        confirmationMessage: 'Could you tell me more about what you need?',
      }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const IntentRouter = {
  classifyIntent,
  quickClassifyIntent,
  routeIntent,
}

export default IntentRouter
