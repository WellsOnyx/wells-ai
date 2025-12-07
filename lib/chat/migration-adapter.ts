// @ts-nocheck
/**
 * Migration Adapter
 * Helper functions to gradually migrate from existing chat to unified chat
 */

import { NextRequest } from 'next/server'

/**
 * Detect product from hostname or explicit parameter
 */
export function detectProduct(request: NextRequest): 'wellsai' | 'grainvault' {
  const hostname = request.headers.get('host') || ''

  if (hostname.includes('grainandvault.com')) {
    return 'grainvault'
  }

  // Check if explicitly passed in body (for development)
  // This will be read by the calling route
  return 'wellsai'
}

/**
 * Convert legacy chat request to unified format
 */
export interface LegacyChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  journey?: string
  triggerNegotiation?: boolean
  userProfile?: any
  context?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
    masterKey?: string
  }
}

export interface UnifiedChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  product: 'wellsai' | 'grainvault'
  journey?: string
  conversationId?: string
  treasuryContext?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
  masterKey?: string
}

export function adaptLegacyRequest(
  legacy: LegacyChatRequest,
  product: 'wellsai' | 'grainvault'
): UnifiedChatRequest {
  // Map journey
  let journey = legacy.journey

  // Detect treasury mode
  if (legacy.context?.accountId || legacy.context?.grainBalance !== undefined) {
    journey = 'treasury'
  }

  return {
    messages: legacy.messages,
    product,
    journey,
    treasuryContext: legacy.context
      ? {
          accountId: legacy.context.accountId,
          companyName: legacy.context.companyName,
          grainBalance: legacy.context.grainBalance,
          creditLine: legacy.context.creditLine,
        }
      : undefined,
    masterKey: legacy.context?.masterKey,
  }
}

/**
 * Example: Update existing Wells AI chat route to use unified system
 *
 * Before (app/api/chat/route.ts):
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const body = await request.json()
 *   // ... existing chat logic ...
 * }
 * ```
 *
 * After (gradual migration):
 * ```typescript
 * import { adaptLegacyRequest, detectProduct } from '@/lib/chat/migration-adapter'
 *
 * export async function POST(request: NextRequest) {
 *   const body = await request.json()
 *   const product = detectProduct(request)
 *
 *   // Convert to unified format
 *   const unifiedRequest = adaptLegacyRequest(body, product)
 *
 *   // Delegate to unified API
 *   const unifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/chat/unified`, {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': request.headers.get('Authorization') || '',
 *     },
 *     body: JSON.stringify(unifiedRequest),
 *   })
 *
 *   return unifiedResponse
 * }
 * ```
 */

/**
 * Backward compatibility: Convert unified response to legacy format
 */
export interface UnifiedChatResponse {
  message: string
  conversationId?: string
  toolUse?: any
  tokensUsed?: number
  latencyMs?: number
}

export interface LegacyChatResponse {
  message: string
  negotiation?: any
  leadCaptured?: boolean
  treasuryAction?: any
  // ... other legacy fields
}

export function adaptUnifiedResponse(
  unified: UnifiedChatResponse,
  toolResults?: any
): LegacyChatResponse {
  const response: LegacyChatResponse = {
    message: unified.message,
  }

  // Map tool use to legacy format
  if (unified.toolUse) {
    switch (unified.toolUse.name) {
      case 'capture_lead':
        response.leadCaptured = true
        break
      case 'prepare_payment':
        response.treasuryAction = {
          type: 'payment',
          status: 'pending',
          details: unified.toolUse.input,
        }
        break
      // ... other tool mappings
    }
  }

  return response
}

/**
 * Feature flag: Gradually roll out unified chat
 */
export function shouldUseUnifiedChat(userId?: string): boolean {
  // Environment flag
  if (process.env.UNIFIED_CHAT_ENABLED === 'true') {
    return true
  }

  // Gradual rollout based on user ID (10% rollout)
  if (userId) {
    const hash = hashUserId(userId)
    return hash % 100 < 10 // 10% of users
  }

  return false
}

function hashUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Hybrid mode: Use unified chat for new conversations, legacy for existing
 */
export async function getOrCreateUnifiedConversation(
  userId: string,
  product: 'wellsai' | 'grainvault',
  journey?: string
): Promise<string | null> {
  try {
    // Check if user has existing unified conversations
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_URL}/api/chat/unified?product=${product}`,
      {
        headers: {
          Authorization: `Bearer ${userId}`, // Adjust based on your auth
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      if (data.conversations && data.conversations.length > 0) {
        // Return most recent conversation
        return data.conversations[0].id
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching unified conversations:', error)
    return null
  }
}
