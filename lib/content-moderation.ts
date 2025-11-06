/**
 * Content Moderation & Safety Guardrails
 *
 * Protects Wells AI platform from illegal activities:
 * - Drugs/controlled substances
 * - Weapons/explosives
 * - Human trafficking/exploitation
 * - Counterfeit goods
 * - Stolen goods/fraud
 * - Adult content/services
 * - Endangered species/ivory
 * - Prohibited financial services
 *
 * This runs BEFORE procurement intent detection to block bad actors early.
 */

export interface ModerationResult {
  allowed: boolean
  reason?: string
  category?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

// Prohibited categories with examples
const PROHIBITED_CATEGORIES = {
  drugs: {
    keywords: [
      'cocaine', 'heroin', 'meth', 'fentanyl', 'opioid', 'mdma', 'ecstasy',
      'lsd', 'psilocybin', 'mushroom', 'cannabis', 'marijuana', 'weed', 'thc',
      'prescription without', 'controlled substance', 'narcotics', 'drug deal'
    ],
    severity: 'critical' as const,
    message: "I can't help with controlled substances or illegal drugs. Wells is designed for legitimate B2B commerce only."
  },
  weapons: {
    keywords: [
      'gun', 'firearm', 'rifle', 'pistol', 'ammunition', 'bullet', 'explosive',
      'bomb', 'grenade', 'missile', 'weapon', 'illegal arms'
    ],
    severity: 'critical' as const,
    message: "I can't assist with weapons, firearms, or explosives transactions. This violates our platform policies."
  },
  humanTrafficking: {
    keywords: [
      'human trafficking', 'child', 'minor', 'underage', 'prostitution',
      'sex work', 'escort service', 'trafficking', 'slavery', 'forced labor'
    ],
    severity: 'critical' as const,
    message: "This request involves illegal activity. Wells cannot process transactions related to human exploitation or trafficking."
  },
  counterfeit: {
    keywords: [
      'fake', 'counterfeit', 'replica', 'knockoff', 'bootleg', 'pirated',
      'unauthorized', 'unlicensed', 'clone', 'imitation'
    ],
    severity: 'high' as const,
    message: "I can't help with counterfeit or fake goods. Wells only supports legitimate, authorized products."
  },
  stolenGoods: {
    keywords: [
      'stolen', 'hot goods', 'no questions asked', 'untraceable', 'black market',
      'laundering', 'money laundering', 'wash money'
    ],
    severity: 'critical' as const,
    message: "This appears to involve stolen goods or money laundering. I can't assist with illegal transactions."
  },
  adultContent: {
    keywords: [
      'pornography', 'adult content', 'xxx', 'sex toys', 'escort', 'strip club',
      'adult entertainment', 'sexual services'
    ],
    severity: 'high' as const,
    message: "Wells doesn't support adult content or sexual services transactions."
  },
  endangeredSpecies: {
    keywords: [
      'ivory', 'rhino horn', 'tiger', 'elephant tusk', 'endangered species',
      'protected animal', 'illegal wildlife', 'exotic animal'
    ],
    severity: 'critical' as const,
    message: "I can't help with endangered species or protected wildlife products. This violates international law."
  },
  prohibitedFinancial: {
    keywords: [
      'ponzi', 'pyramid scheme', 'pump and dump', 'insider trading',
      'securities fraud', 'unregistered securities', 'offshore account',
      'tax evasion', 'shell company'
    ],
    severity: 'critical' as const,
    message: "This request appears to involve illegal financial activity. Wells cannot assist with fraudulent schemes."
  }
}

/**
 * Check if a message contains prohibited content
 */
export function moderateContent(message: string): ModerationResult {
  const lowerMessage = message.toLowerCase()

  // Check each prohibited category
  for (const [category, config] of Object.entries(PROHIBITED_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        // Calculate confidence based on context
        const confidence = calculateConfidence(lowerMessage, keyword)

        // Only flag if confidence is above threshold
        if (confidence > 0.6) {
          console.log('[MODERATION] Blocked request:', {
            category,
            keyword,
            confidence,
            severity: config.severity
          })

          return {
            allowed: false,
            reason: config.message,
            category,
            severity: config.severity,
            confidence
          }
        }
      }
    }
  }

  // Content is safe
  return {
    allowed: true,
    severity: 'low',
    confidence: 1.0
  }
}

/**
 * Calculate confidence score for keyword match
 * Higher confidence = more likely to be actual violation
 */
function calculateConfidence(message: string, keyword: string): number {
  let confidence = 0.7 // Base confidence for keyword match

  const lowerMessage = message.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()

  // Boost confidence for exact phrase matches
  if (lowerMessage.includes(lowerKeyword)) {
    confidence += 0.15
  }

  // Boost confidence for procurement language
  const procurementKeywords = ['buy', 'sell', 'source', 'supplier', 'vendor', 'purchase', 'order']
  if (procurementKeywords.some(k => lowerMessage.includes(k))) {
    confidence += 0.1
  }

  // Reduce confidence for obvious false positives
  const falsePositives = [
    'replica database', // Technical term
    'clone repository', // Git term
    'pirated software' // Could be compliance check
  ]

  for (const falsePositive of falsePositives) {
    if (lowerMessage.includes(falsePositive.toLowerCase())) {
      confidence -= 0.3
    }
  }

  return Math.min(Math.max(confidence, 0), 1)
}

/**
 * Check if user should be flagged for review
 * Multiple violations = account review
 */
export function shouldFlagUser(violationHistory: { category: string; timestamp: Date }[]): boolean {
  // Flag if 2+ violations in last 24 hours
  const last24h = violationHistory.filter(v => {
    const hoursSince = (Date.now() - v.timestamp.getTime()) / (1000 * 60 * 60)
    return hoursSince < 24
  })

  return last24h.length >= 2
}

/**
 * Log moderation event for audit trail
 */
export function logModerationEvent(event: {
  userId: string
  message: string
  result: ModerationResult
  timestamp: Date
}) {
  // TODO: Store in database for compliance
  console.log('[MODERATION EVENT]', {
    userId: event.userId,
    category: event.result.category,
    severity: event.result.severity,
    confidence: event.result.confidence,
    timestamp: event.timestamp.toISOString()
  })
}
