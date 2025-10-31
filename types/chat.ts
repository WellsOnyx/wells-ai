/**
 * Chat Message Types - Support for Inline Components
 * Enables rendering ANY feature directly in the chat feed
 */

import { ConsentAction } from '@/lib/consent'

// ============================================================================
// BASE MESSAGE TYPES
// ============================================================================

export interface BaseMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
}

export interface TextMessage extends BaseMessage {
  type: 'text'
  content: string
}

// ============================================================================
// INLINE COMPONENT MESSAGES
// ============================================================================

export interface EmailComposerMessage extends BaseMessage {
  type: 'email_composer'
  data: {
    to?: string
    subject?: string
    prefilledContent?: string
    context?: string
  }
}

export interface ConsentApprovalMessage extends BaseMessage {
  type: 'consent_approval'
  data: {
    actions: ConsentAction[]
  }
}

export interface PartnerDashboardMessage extends BaseMessage {
  type: 'partner_dashboard'
  data: {
    partners: Array<{
      id: string
      name: string
      status: 'active' | 'pending' | 'ready'
      capabilities: string[]
    }>
  }
}

export interface RFQFormMessage extends BaseMessage {
  type: 'rfq_form'
  data: {
    category?: string
    prefilledRequirements?: string
  }
}

export interface SupplierMatchMessage extends BaseMessage {
  type: 'supplier_match'
  data: {
    category: string
    requirements: string
    matches: Array<{
      id: string
      name: string
      score: number
      capabilities: string[]
    }>
  }
}

export interface OnePagerGeneratorMessage extends BaseMessage {
  type: 'onepager_generator'
  data: {
    partnerId?: string
    generatedPdfUrl?: string
  }
}

export interface PaymentRequestMessage extends BaseMessage {
  type: 'payment_request'
  data: {
    amount: number
    description: string
    recipient?: string
  }
}

export interface GTMCampaignMessage extends BaseMessage {
  type: 'gtm_campaign'
  data: {
    practiceGroup: string
    prospects: Array<{
      name: string
      title: string
      company: string
    }>
  }
}

// ============================================================================
// UNION TYPE
// ============================================================================

export type ChatMessage =
  | TextMessage
  | EmailComposerMessage
  | ConsentApprovalMessage
  | PartnerDashboardMessage
  | RFQFormMessage
  | SupplierMatchMessage
  | OnePagerGeneratorMessage
  | PaymentRequestMessage
  | GTMCampaignMessage

// ============================================================================
// INTENT DETECTION
// ============================================================================

export interface DetectedIntent {
  intent: 'email' | 'consent' | 'partners' | 'rfq' | 'suppliers' | 'onepager' | 'payment' | 'gtm' | 'conversation'
  confidence: number
  params?: Record<string, any>
}

/**
 * Intent patterns for chat message analysis
 */
export const INTENT_PATTERNS = {
  email: [
    /send.*email/i,
    /compose.*email/i,
    /email.*to/i,
    /reach out.*email/i
  ],
  consent: [
    /pending.*approval/i,
    /show.*approvals/i,
    /what.*waiting/i,
    /consent.*queue/i
  ],
  partners: [
    /partner.*status/i,
    /show.*partners/i,
    /list.*partners/i,
    /partner.*dashboard/i
  ],
  rfq: [
    /request.*quote/i,
    /rfq/i,
    /submit.*rfq/i,
    /need.*quote/i
  ],
  suppliers: [
    /find.*supplier/i,
    /match.*supplier/i,
    /supplier.*for/i,
    /who.*can.*provide/i
  ],
  onepager: [
    /generate.*onepager/i,
    /create.*onepager/i,
    /onepager.*for/i,
    /partner.*pdf/i
  ],
  payment: [
    /send.*payment/i,
    /pay.*invoice/i,
    /process.*payment/i,
    /stripe.*payment/i
  ],
  gtm: [
    /gtm.*campaign/i,
    /find.*prospects/i,
    /outreach.*campaign/i,
    /generate.*leads/i
  ]
}

/**
 * Detect intent from user message
 */
export function detectIntent(message: string): DetectedIntent {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return {
          intent: intent as any,
          confidence: 0.9,
          params: {}
        }
      }
    }
  }

  return {
    intent: 'conversation',
    confidence: 1.0,
    params: {}
  }
}

// ============================================================================
// MESSAGE FACTORY
// ============================================================================

export function createTextMessage(content: string, role: 'user' | 'assistant' = 'assistant'): TextMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role,
    type: 'text',
    content,
    timestamp: new Date().toISOString()
  }
}

export function createComponentMessage(
  type: Exclude<ChatMessage['type'], 'text'>,
  data: any,
  role: 'assistant' = 'assistant'
): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role,
    type,
    data,
    timestamp: new Date().toISOString()
  } as ChatMessage
}
