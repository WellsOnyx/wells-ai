/**
 * Layer 3: Intent Classification Service
 *
 * Classifies user messages into ERP intents and extracts entities.
 * Uses pattern matching and keyword detection (can be enhanced with ML later).
 */

import type {
  ErpIntent,
  IntentConfidence,
  ExtractedEntities,
  INTENT_DEFINITIONS,
} from '../types'

// ============================================================================
// INTENT PATTERNS
// ============================================================================

interface IntentPattern {
  intent: ErpIntent
  patterns: RegExp[]
  keywords: string[]
  priority: number
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Vendor Intents
  {
    intent: 'create_vendor',
    patterns: [
      /(?:create|add|register|new)\s+(?:a\s+)?(?:vendor|supplier)/i,
      /(?:set\s+up|onboard)\s+(?:a\s+)?(?:vendor|supplier)/i,
    ],
    keywords: ['create vendor', 'add vendor', 'new supplier', 'register vendor', 'onboard supplier'],
    priority: 10,
  },
  {
    intent: 'search_vendor',
    patterns: [
      /(?:find|search|look\s+for|list)\s+(?:vendors?|suppliers?)/i,
      /(?:who|which)\s+(?:vendors?|suppliers?)/i,
    ],
    keywords: ['find vendor', 'search vendor', 'list vendors', 'vendor search'],
    priority: 8,
  },
  {
    intent: 'get_vendor_details',
    patterns: [
      /(?:get|show|display)\s+(?:vendor|supplier)\s+(?:details|info)/i,
      /(?:vendor|supplier)\s+(?:details|information)/i,
    ],
    keywords: ['vendor details', 'vendor info', 'supplier information'],
    priority: 8,
  },

  // Purchase Order Intents
  {
    intent: 'create_po',
    patterns: [
      /(?:create|make|generate|submit)\s+(?:a\s+)?(?:purchase\s+order|po|order)/i,
      /(?:order|buy|purchase)\s+(?:from|with)/i,
      /(?:i\s+(?:want|need)\s+to)\s+(?:order|purchase)/i,
    ],
    keywords: ['create po', 'new purchase order', 'place order', 'buy from', 'submit order'],
    priority: 10,
  },
  {
    intent: 'approve_po',
    patterns: [
      /(?:approve|sign\s+off|authorize)\s+(?:the\s+)?(?:purchase\s+order|po)/i,
      /(?:po|purchase\s+order)\s+approv/i,
    ],
    keywords: ['approve po', 'approve purchase order', 'sign off po', 'authorize order'],
    priority: 9,
  },
  {
    intent: 'get_po_status',
    patterns: [
      /(?:status|state|where)\s+(?:of\s+)?(?:po|purchase\s+order|order)/i,
      /(?:check|track)\s+(?:my\s+)?(?:po|order)/i,
    ],
    keywords: ['po status', 'order status', 'check order', 'track po'],
    priority: 8,
  },
  {
    intent: 'search_po',
    patterns: [
      /(?:find|search|list|show)\s+(?:purchase\s+orders?|pos|orders)/i,
    ],
    keywords: ['find po', 'search orders', 'list purchase orders'],
    priority: 7,
  },

  // Invoice Intents
  {
    intent: 'get_overdue_invoices',
    patterns: [
      /(?:overdue|past\s+due|unpaid|outstanding)\s+invoices?/i,
      /invoices?\s+(?:that\s+are\s+)?(?:overdue|past\s+due)/i,
    ],
    keywords: ['overdue invoices', 'past due', 'unpaid invoices', 'outstanding invoices'],
    priority: 9,
  },
  {
    intent: 'approve_invoice',
    patterns: [
      /(?:approve|authorize)\s+(?:the\s+)?invoice/i,
      /invoice\s+approv/i,
    ],
    keywords: ['approve invoice', 'authorize invoice'],
    priority: 9,
  },
  {
    intent: 'dispute_invoice',
    patterns: [
      /(?:dispute|reject|challenge)\s+(?:the\s+)?invoice/i,
      /(?:there\s+is\s+a\s+)?problem\s+with\s+(?:the\s+)?invoice/i,
    ],
    keywords: ['dispute invoice', 'reject invoice', 'invoice problem'],
    priority: 9,
  },
  {
    intent: 'search_invoices',
    patterns: [
      /(?:find|search|list|show)\s+invoices?/i,
    ],
    keywords: ['find invoices', 'search invoices', 'list invoices'],
    priority: 7,
  },
  {
    intent: 'get_invoice_status',
    patterns: [
      /(?:status|state)\s+(?:of\s+)?(?:invoice|inv)/i,
      /(?:check|where\s+is)\s+(?:the\s+)?invoice/i,
    ],
    keywords: ['invoice status', 'check invoice'],
    priority: 8,
  },

  // Payment Intents
  {
    intent: 'create_payment',
    patterns: [
      /(?:pay|send\s+payment|make\s+(?:a\s+)?payment)/i,
      /(?:transfer|send)\s+(?:\$[\d,]+|\d+)\s+(?:to|via)/i,
      /(?:i\s+(?:want|need)\s+to)\s+pay/i,
    ],
    keywords: ['pay', 'send payment', 'make payment', 'transfer money'],
    priority: 10,
  },
  {
    intent: 'authorize_payment',
    patterns: [
      /(?:authorize|approve)\s+(?:the\s+)?payment/i,
      /(?:yes,?\s+)?(?:send|process)\s+(?:the\s+)?payment/i,
    ],
    keywords: ['authorize payment', 'approve payment', 'confirm payment'],
    priority: 9,
  },
  {
    intent: 'schedule_payment',
    patterns: [
      /schedule\s+(?:a\s+)?payment/i,
      /(?:pay|payment)\s+(?:on|by|next)/i,
    ],
    keywords: ['schedule payment', 'future payment', 'pay on'],
    priority: 8,
  },
  {
    intent: 'get_payment_status',
    patterns: [
      /(?:status|state)\s+(?:of\s+)?payment/i,
      /(?:did|has)\s+(?:the\s+)?payment\s+(?:go\s+through|complete)/i,
    ],
    keywords: ['payment status', 'check payment'],
    priority: 8,
  },
  {
    intent: 'cancel_payment',
    patterns: [
      /(?:cancel|stop|void)\s+(?:the\s+)?payment/i,
    ],
    keywords: ['cancel payment', 'stop payment', 'void payment'],
    priority: 9,
  },

  // Balance/Ledger Intents
  {
    intent: 'get_balance',
    patterns: [
      /(?:what\s+is|check|show)\s+(?:my\s+)?(?:balance|account)/i,
      /(?:how\s+much)\s+(?:do\s+i\s+have|grain|money)/i,
    ],
    keywords: ['balance', 'account balance', 'how much', 'check account'],
    priority: 9,
  },
  {
    intent: 'get_float_balance',
    patterns: [
      /float\s+(?:balance|pool)/i,
      /(?:check|show)\s+float/i,
    ],
    keywords: ['float balance', 'float pool', 'treasury float'],
    priority: 8,
  },
  {
    intent: 'get_yield_summary',
    patterns: [
      /(?:yield|interest|earnings?)\s+(?:earned|summary)?/i,
      /(?:how\s+much)\s+(?:yield|interest)/i,
    ],
    keywords: ['yield', 'interest earned', 'earnings', 'yield summary'],
    priority: 8,
  },
  {
    intent: 'get_trial_balance',
    patterns: [
      /trial\s+balance/i,
    ],
    keywords: ['trial balance'],
    priority: 7,
  },
  {
    intent: 'get_ledger_summary',
    patterns: [
      /ledger\s+(?:summary|entries)/i,
      /(?:general\s+)?ledger/i,
    ],
    keywords: ['ledger summary', 'ledger entries', 'GL entries'],
    priority: 7,
  },

  // Escrow Intents
  {
    intent: 'create_escrow',
    patterns: [
      /(?:create|set\s+up|open)\s+(?:an?\s+)?escrow/i,
    ],
    keywords: ['create escrow', 'open escrow', 'escrow account'],
    priority: 10,
  },
  {
    intent: 'release_escrow',
    patterns: [
      /release\s+(?:the\s+)?escrow/i,
      /(?:close|complete)\s+(?:the\s+)?escrow/i,
    ],
    keywords: ['release escrow', 'close escrow'],
    priority: 9,
  },
  {
    intent: 'get_escrow_status',
    patterns: [
      /escrow\s+(?:status|balance)/i,
      /(?:check|show)\s+(?:the\s+)?escrow/i,
    ],
    keywords: ['escrow status', 'escrow balance'],
    priority: 8,
  },

  // Summary
  {
    intent: 'get_summary',
    patterns: [
      /(?:give\s+me\s+a\s+)?(?:summary|overview|dashboard)/i,
      /(?:what|how)\s+(?:is|are)\s+(?:things|my\s+(?:finances?|status))/i,
    ],
    keywords: ['summary', 'overview', 'dashboard', 'financial summary'],
    priority: 6,
  },
]

// ============================================================================
// ENTITY EXTRACTION PATTERNS
// ============================================================================

const ENTITY_PATTERNS = {
  // Money amounts: $5,000.00 or 5000 USD or $5k
  amount: /\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:k|K)?\s*(?:dollars?|USD|usd)?|\b(\d+(?:\.\d{2})?)\s*(?:dollars?|USD)/gi,

  // Quantities: 100 units, 50 items, qty: 25
  quantity: /(?:qty:?\s*|quantity:?\s*)?(\d+)\s*(?:units?|items?|pieces?|pcs?|ea)?/gi,

  // PO numbers: PO-2024-001, PO#12345
  poNumber: /(?:po|purchase\s*order)[#:\s-]*([A-Z0-9-]+)/gi,

  // Invoice numbers: INV-2024-001, Invoice #12345
  invoiceNumber: /(?:inv(?:oice)?)[#:\s-]*([A-Z0-9-]+)/gi,

  // Payment numbers: PAY-2024-001
  paymentNumber: /(?:pay(?:ment)?)[#:\s-]*([A-Z0-9-]+)/gi,

  // Vendor names (after "from", "to", "vendor", "supplier")
  vendorName: /(?:from|to|vendor|supplier|called|named)\s+["\']?([A-Z][A-Za-z0-9\s&.,'-]+?)["\']?(?:\s+(?:for|at|with|via)|$|\.)/gi,

  // Email addresses
  email: /[\w.-]+@[\w.-]+\.\w+/gi,

  // Phone numbers
  phone: /(?:\+1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g,

  // Dates: 2024-01-15, Jan 15, January 15 2024, 1/15/24
  date: /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)/gi,

  // Payment methods
  paymentMethod: /\b(grain|ach|wire|check|virtual\s*card)\b/gi,

  // Currency codes
  currency: /\b(USD|EUR|GBP|CAD|AUD|JPY|CNY)\b/gi,
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

export interface IntentClassificationResult {
  intent: ErpIntent
  confidence: IntentConfidence
  score: number
  entities: ExtractedEntities
  alternativeIntents: Array<{ intent: ErpIntent; score: number }>
}

export function classifyIntent(message: string): IntentClassificationResult {
  const normalizedMessage = message.toLowerCase().trim()
  const scores: Map<ErpIntent, number> = new Map()

  // Score each intent
  for (const pattern of INTENT_PATTERNS) {
    let score = 0

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(message)) {
        score += 100 * pattern.priority
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalizedMessage.includes(keyword.toLowerCase())) {
        score += 50 * pattern.priority
      }
    }

    if (score > 0) {
      scores.set(pattern.intent, score)
    }
  }

  // Sort by score
  const sortedIntents = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])

  // Determine top intent and confidence
  let topIntent: ErpIntent = 'unknown'
  let topScore = 0
  let confidence: IntentConfidence = 'low'

  if (sortedIntents.length > 0) {
    [topIntent, topScore] = sortedIntents[0]

    // Determine confidence
    if (topScore >= 500) {
      confidence = 'high'
    } else if (topScore >= 200) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }
  }

  // Extract entities
  const entities = extractEntities(message)

  // Get alternative intents
  const alternativeIntents = sortedIntents
    .slice(1, 4)
    .map(([intent, score]) => ({ intent, score }))

  return {
    intent: topIntent,
    confidence,
    score: topScore,
    entities,
    alternativeIntents,
  }
}

export function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {}

  // Extract amounts
  const amountMatches = [...message.matchAll(ENTITY_PATTERNS.amount)]
  if (amountMatches.length > 0) {
    const match = amountMatches[0]
    let amount = parseFloat((match[1] || match[2]).replace(/,/g, ''))
    if (message.toLowerCase().includes('k')) {
      amount *= 1000
    }
    entities.amount = amount
  }

  // Extract quantities
  const qtyMatch = message.match(ENTITY_PATTERNS.quantity)
  if (qtyMatch) {
    entities.quantity = parseInt(qtyMatch[1])
  }

  // Extract PO number
  const poMatch = [...message.matchAll(ENTITY_PATTERNS.poNumber)]
  if (poMatch.length > 0) {
    entities.poNumber = poMatch[0][1].toUpperCase()
  }

  // Extract invoice number
  const invMatch = [...message.matchAll(ENTITY_PATTERNS.invoiceNumber)]
  if (invMatch.length > 0) {
    entities.invoiceNumber = invMatch[0][1].toUpperCase()
  }

  // Extract payment number
  const payMatch = [...message.matchAll(ENTITY_PATTERNS.paymentNumber)]
  if (payMatch.length > 0) {
    entities.paymentNumber = payMatch[0][1].toUpperCase()
  }

  // Extract vendor name
  const vendorMatches = [...message.matchAll(ENTITY_PATTERNS.vendorName)]
  if (vendorMatches.length > 0) {
    entities.vendorName = vendorMatches[0][1].trim()
  }

  // Extract email
  const emailMatch = message.match(ENTITY_PATTERNS.email)
  if (emailMatch) {
    entities.contactEmail = emailMatch[0]
  }

  // Extract phone
  const phoneMatch = message.match(ENTITY_PATTERNS.phone)
  if (phoneMatch) {
    entities.contactPhone = phoneMatch[0]
  }

  // Extract payment method
  const methodMatch = message.match(ENTITY_PATTERNS.paymentMethod)
  if (methodMatch) {
    entities.paymentMethod = methodMatch[0].toLowerCase().replace(/\s+/g, '_') as ExtractedEntities['paymentMethod']
  }

  // Extract currency
  const currencyMatch = message.match(ENTITY_PATTERNS.currency)
  if (currencyMatch) {
    entities.currency = currencyMatch[0].toUpperCase()
  }

  // Extract dates
  const dateMatches = [...message.matchAll(ENTITY_PATTERNS.date)]
  if (dateMatches.length > 0) {
    const dateStr = dateMatches[0][0]
    const parsed = parseDate(dateStr)
    if (parsed) {
      entities.date = parsed
    }
  }

  // Extract line items from structured input
  const lineItemMatch = message.match(/(\d+)\s+([^@]+)\s+@\s+\$?([\d,.]+)/g)
  if (lineItemMatch) {
    entities.lineItems = lineItemMatch.map(item => {
      const parts = item.match(/(\d+)\s+(.+?)\s+@\s+\$?([\d,.]+)/)
      if (parts) {
        return {
          quantity: parseInt(parts[1]),
          description: parts[2].trim(),
          unitPrice: parseFloat(parts[3].replace(/,/g, '')),
        }
      }
      return null
    }).filter(Boolean) as ExtractedEntities['lineItems']
  }

  return entities
}

function parseDate(dateStr: string): string | undefined {
  try {
    // Handle ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }

    // Handle MM/DD/YY or MM/DD/YYYY
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    if (slashMatch) {
      let year = parseInt(slashMatch[3])
      if (year < 100) year += 2000
      const month = slashMatch[1].padStart(2, '0')
      const day = slashMatch[2].padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Handle month name formats
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    // Ignore parse errors
  }
  return undefined
}

export function getMissingFields(
  intent: ErpIntent,
  entities: ExtractedEntities,
  intentDefinitions: typeof INTENT_DEFINITIONS
): string[] {
  const definition = intentDefinitions.find(d => d.intent === intent)
  if (!definition) return []

  const missing: string[] = []

  for (const field of definition.requiredFields) {
    const value = entities[field as keyof ExtractedEntities]
    if (value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      missing.push(field)
    }
  }

  return missing
}
