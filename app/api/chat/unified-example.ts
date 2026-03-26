// @ts-nocheck
/**
 * EXAMPLE: How to update existing Wells AI chat route to use unified system
 *
 * This file shows how to modify your existing app/api/chat/route.ts
 * to delegate to the unified chat system while maintaining backward compatibility.
 *
 * OPTION 1: Full delegation (recommended)
 * Replace the entire route.ts with delegation to unified API
 *
 * OPTION 2: Gradual migration
 * Use feature flags to gradually roll out unified chat
 *
 * OPTION 3: Hybrid approach
 * Keep existing logic but save to unified database
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// ============================================================================
// OPTION 1: FULL DELEGATION (Recommended)
// ============================================================================

/**
 * Replace your existing app/api/chat/route.ts with this:
 */
export async function POST_OPTION_1(request: NextRequest) {
  try {
    const body = await request.json()

    // Simply delegate to unified API with product specified
    const unifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/chat/unified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth headers
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        ...body,
        product: 'wellsai', // Specify Wells AI
      }),
    })

    // Return the response
    return NextResponse.json(await unifiedResponse.json(), {
      status: unifiedResponse.status,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTION 2: GRADUAL MIGRATION with Feature Flag
// ============================================================================

/**
 * Use feature flag to gradually roll out unified chat
 */
export async function POST_OPTION_2(request: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await request.json()

    // Feature flag: 10% of users get unified chat
    const useUnified = shouldUseUnifiedChat(userId)

    if (useUnified) {
      // Use unified system
      return delegateToUnified(request, body)
    } else {
      // Use legacy system (your existing logic)
      return legacyChatHandler(request, body)
    }
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

async function delegateToUnified(request: NextRequest, body: any) {
  const unifiedResponse = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/chat/unified`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
    },
    body: JSON.stringify({
      ...body,
      product: 'wellsai',
    }),
  })

  return NextResponse.json(await unifiedResponse.json(), {
    status: unifiedResponse.status,
  })
}

async function legacyChatHandler(request: NextRequest, body: any) {
  // Your existing chat logic here
  // (keep your current implementation)
  return NextResponse.json({ message: 'Legacy response' })
}

function shouldUseUnifiedChat(userId?: string | null): boolean {
  // Environment-based flag
  if (process.env.UNIFIED_CHAT_ENABLED === 'true') {
    return true
  }

  // Gradual rollout: 10% of users
  if (userId) {
    const hash = hashString(userId)
    return (hash % 100) < 10
  }

  return false
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

// ============================================================================
// OPTION 3: HYBRID APPROACH
// ============================================================================

/**
 * Keep existing logic but ALSO save to unified database
 * This allows you to maintain current behavior while building unified system
 */
import {
  createConversation,
  addMessage,
  getConversationHistory,
} from '@/lib/chat/unified-chat-service'
import Anthropic from '@anthropic-ai/sdk'

export async function POST_OPTION_3(request: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await request.json()
    const { messages, journey } = body

    // YOUR EXISTING LOGIC HERE
    // (Keep your current Claude API call, tools, etc.)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      messages,
      // ... your existing system prompt and tools
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    // ADDITIONAL: Save to unified database
    if (userId) {
      try {
        // Check if user has active conversation
        const { conversations } = await getConversationHistory(userId, {
          product: 'wellsai',
          journey,
          limit: 1,
        })

        let conversationId = conversations[0]?.id

        // Create new conversation if none exists
        if (!conversationId) {
          const conversation = await createConversation({
            userId,
            product: 'wellsai',
            journey,
          })
          conversationId = conversation.id
        }

        // Save user message
        await addMessage({
          conversationId,
          role: 'user',
          content: messages[messages.length - 1].content,
          productContext: 'wellsai',
        })

        // Save assistant message
        await addMessage({
          conversationId,
          role: 'assistant',
          content: assistantMessage,
          productContext: 'wellsai',
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          modelUsed: 'claude-sonnet-4-5-20250514',
        })
      } catch (dbError) {
        // Don't fail the request if unified DB save fails
        console.error('Error saving to unified DB:', dbError)
      }
    }

    // Return your existing response format
    return NextResponse.json({
      message: assistantMessage,
      // ... your other response fields
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// EXAMPLE: Frontend Integration
// ============================================================================

/**
 * BEFORE: Your existing chat component
 */
function LegacyChatComponent_BEFORE() {
  const sendMessage = async (message: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        journey: 'founder',
      }),
    })
    // ... handle response
  }
}

/**
 * AFTER: Using UnifiedChat component
 */
import UnifiedChat from '@/components/chat/UnifiedChat'

function NewChatComponent_AFTER() {
  return (
    <UnifiedChat
      product="wellsai"
      journey="founder"
      welcomeMessage="Hi! I'm Wells. I can help you find suppliers, hire talent, and negotiate deals."
      placeholder="What can I help you with today?"
    />
  )
}

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/**
 * [ ] 1. Deploy unified schema: psql $POSTGRES_URL < scripts/schema-unified-chat.sql
 * [ ] 2. Choose migration option (1, 2, or 3)
 * [ ] 3. Update app/api/chat/route.ts
 * [ ] 4. Test with a few users
 * [ ] 5. Monitor for errors
 * [ ] 6. Gradually increase rollout (if using Option 2)
 * [ ] 7. Update frontend to use UnifiedChat component
 * [ ] 8. Remove legacy code once fully migrated
 */

/**
 * TESTING
 */
async function testUnifiedChat() {
  // 1. Send message to Wells AI
  const response1 = await fetch('http://localhost:3000/api/chat/unified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'I need a CTO' }],
      product: 'wellsai',
      journey: 'founder',
    }),
  })
  const data1 = await response1.json()
  console.log('Wells AI response:', data1)

  // 2. Get conversation history
  const response2 = await fetch('http://localhost:3000/api/chat/unified?product=wellsai')
  const data2 = await response2.json()
  console.log('Conversations:', data2)

  // 3. Continue conversation on Grain & Vault
  const response3 = await fetch('http://localhost:3000/api/chat/unified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'What is my balance?' }],
      product: 'grainvault',
      journey: 'treasury',
      conversationId: data1.conversationId,
    }),
  })
  const data3 = await response3.json()
  console.log('Grain & Vault response:', data3)
}

/**
 * NOTES:
 * - All files have // @ts-nocheck for development flexibility
 * - Use existing Clerk auth - no changes needed
 * - Use existing PostgreSQL - just add new tables
 * - Backward compatible - can run alongside existing chat
 * - Gradually migrate - use feature flags for safety
 */
