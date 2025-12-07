# Unified Chat System

A shared conversation infrastructure that provides seamless continuity between Wells AI (wellsonyx.io) and Grain & Vault (grainandvault.com).

## Overview

The unified chat system allows users to have persistent, context-aware conversations across both products. The same Clerk user can:

- Start a conversation on Wells AI about finding suppliers
- Continue that conversation on Grain & Vault to make a payment
- Reference past conversations from either product
- Maintain context and memory across products

## Architecture

### Database Schema (`scripts/schema-unified-chat.sql`)

Four main tables power the system:

1. **unified_conversations** - All conversations across both products
   - `product_origin` - Where conversation started (wellsai/grainvault)
   - `current_product` - Current product context
   - `journey` - User journey (founder/buyer/seller/jobs/treasury/master)
   - Auto-updates message count and timestamps

2. **unified_messages** - Individual messages within conversations
   - `product_context` - Which product user was on when sending message
   - `tool_use` and `tool_results` - Claude tool execution tracking
   - `action_type` and `action_data` - Business actions (payments, leads, etc.)

3. **unified_user_context** - Cross-product user memory and preferences
   - Tracks activity on both products
   - Stores recent topics and key entities
   - Product-specific profiles (wellsai_profile, grainvault_profile)

4. **unified_conversation_summaries** - Pre-computed conversation summaries
   - Auto-generated summaries for context retrieval
   - Key topics and entities extracted

### Core Services

#### Product Personas (`lib/chat/personas.ts`)

Defines different AI personalities for each product:

- **Wells AI**: Business commerce focus (suppliers, hiring, deals)
- **Grain & Vault**: Treasury focus (payments, credit, transactions)

Each persona has:
- Specific capabilities
- Appropriate tone
- Product-specific context awareness

#### Unified Chat Service (`lib/chat/unified-chat-service.ts`)

Main database operations:

```typescript
// Create new conversation
createConversation({ userId, product, journey })

// Add message
addMessage({ conversationId, role, content, productContext })

// Get conversation history (with product filtering)
getConversationHistory(userId, { product: 'wellsai' })

// Get recent context (for personalizing responses)
getRecentContext(userId)

// Switch product context mid-conversation
switchProduct(conversationId, 'grainvault')
```

#### Context Builder (`lib/chat/context-builder.ts`)

Builds enhanced system prompts with:

```typescript
buildSystemPrompt({
  product: 'grainvault',
  journey: 'treasury',
  userContext,
  conversationId,
  treasuryContext: {
    grainBalance: 10000,
    creditLine: 5000
  }
})
```

Features:
- Product-specific system prompts
- Cross-product awareness
- User profile and preferences
- Conversation memory
- Recent topics and entities

### API Routes

#### Unified Chat API (`app/api/chat/unified/route.ts`)

Main chat endpoint:

**POST /api/chat/unified**
```typescript
{
  messages: [{ role: 'user', content: 'Check my balance' }],
  product: 'grainvault',
  journey: 'treasury',
  conversationId: 'uuid', // optional
  treasuryContext: { ... }  // optional, for Grain & Vault
}
```

Response:
```typescript
{
  message: "Your GRAIN balance is 10,000...",
  conversationId: "uuid",
  tokensUsed: 342,
  latencyMs: 1234
}
```

**GET /api/chat/unified**

Retrieve conversations:
- `?conversationId=xxx` - Get specific conversation with messages
- `?product=wellsai` - Filter by product
- No params - Get all user's conversations

### React Component

#### UnifiedChat (`components/chat/UnifiedChat.tsx`)

Shared chat UI that works on both products:

```tsx
<UnifiedChat
  product="grainvault"
  journey="treasury"
  conversationId="optional-existing-conversation"
  onConversationCreated={(id) => console.log('New conversation:', id)}
  treasuryContext={{
    accountId: 'gv_123',
    grainBalance: 10000,
    creditLine: 5000
  }}
  welcomeMessage="Hi! I'm Wells, your treasury assistant..."
  placeholder="Ask about balance, send payment..."
/>
```

Features:
- Auto-saves conversations to database
- Shows product context indicator
- Handles loading states
- Error handling with retry
- Keyboard shortcuts (Enter to send)

## Integration Guide

### 1. Deploy Database Schema

```bash
psql $POSTGRES_URL < scripts/schema-unified-chat.sql
```

### 2. Wells AI Integration

Update existing chat route to delegate to unified system:

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Parse request
  const body = await request.json()

  // Delegate to unified chat
  return fetch(`${process.env.NEXT_PUBLIC_URL}/api/chat/unified`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      product: 'wellsai'
    })
  })
}
```

Or use the shared component directly:

```tsx
// app/page.tsx (Wells AI chat)
import UnifiedChat from '@/components/chat/UnifiedChat'

export default function WellsAIChat() {
  return (
    <UnifiedChat
      product="wellsai"
      journey={userJourney} // founder, buyer, seller, jobs, master
      welcomeMessage="Hi! I'm Wells. I can help you find suppliers, hire talent..."
    />
  )
}
```

### 3. Grain & Vault Integration

Already created! See `app/grain-vault/chat/page.tsx`

## Product Detection

The system detects which product a user is on:

1. **Explicit parameter**: `product: 'wellsai' | 'grainvault'` in API request
2. **Hostname detection** (if needed):
```typescript
const hostname = request.headers.get('host')
const product = hostname?.includes('grainandvault.com')
  ? 'grainvault'
  : 'wellsai'
```

## Cross-Product Features

### Context Awareness

When a user has activity on both products, the AI is aware:

```
User on Wells AI:
"I can help you find suppliers, and once you're ready to pay,
your Grain & Vault account can handle the GRAIN payment seamlessly."

User on Grain & Vault:
"I can process this payment. By the way, if you need to find
new suppliers, Wells AI can help you source and negotiate deals."
```

### Conversation Continuity

User starts on Wells AI:
```
User: I need to find a supplier for industrial motors
Wells: Let me help you find suppliers... [captures lead]
```

Later, on Grain & Vault:
```
User: Can I pay the motor supplier now?
Wells: Yes! Based on your Wells AI conversation about industrial
motors, I can prepare a payment. How much should I send?
```

### Recent Context

The system tracks:
- Last 10 messages across all conversations
- Recent topics discussed
- Key entities mentioned (companies, amounts, products)
- Activity on each product

## Tools and Actions

Different tools are available based on product:

### Wells AI Tools
- `capture_lead` - Save user requirements
- `start_negotiation` - Trigger AI-to-AI negotiation
- `cold_start_command` - Master mode automation

### Grain & Vault Tools
- `get_balance` - Check GRAIN balance and credit
- `prepare_payment` - Stage payment for authorization
- `get_transactions` - View transaction history
- `get_credit_info` - Credit line details

### Action Tracking

Messages can track business actions:
```typescript
await addMessage({
  conversationId,
  role: 'assistant',
  content: "Payment prepared...",
  actionType: 'prepare_payment',
  actionData: { recipient, amount },
  actionStatus: 'pending'
})
```

## Personalization

The system personalizes responses using:

1. **User Profile** (from Clerk)
   - Name, company, role
   - Journey preference

2. **Conversation History**
   - Past messages
   - Topics discussed
   - Entities mentioned

3. **Cross-Product Activity**
   - Activity on both products
   - Recent context from other product

4. **Product-Specific Context**
   - Wells AI: Company stage, hiring needs, suppliers
   - Grain & Vault: GRAIN balance, credit line, transactions

## Performance

- **Database Triggers**: Auto-update message counts and timestamps
- **Context Caching**: Pre-computed conversation summaries
- **Indexed Queries**: Fast retrieval by user, product, and date
- **Recent Memory**: Only fetch last 10-20 messages for context

## Testing

Test conversation flow:

```bash
# 1. Create conversation on Wells AI
curl -X POST http://localhost:3000/api/chat/unified \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "I need a CTO"}],
    "product": "wellsai",
    "journey": "founder"
  }'

# 2. Continue on Grain & Vault
curl -X POST http://localhost:3000/api/chat/unified \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is my balance?"}],
    "product": "grainvault",
    "journey": "treasury",
    "conversationId": "uuid-from-step-1"
  }'

# 3. Get conversation history
curl http://localhost:3000/api/chat/unified?conversationId=uuid
```

## Migration Path

For existing chat systems:

1. Deploy unified schema
2. Keep existing chat route active
3. Gradually migrate to unified API:
   ```typescript
   // Old: app/api/chat/route.ts
   // New: Delegates to /api/chat/unified
   ```
4. Update frontend to use UnifiedChat component
5. Migrate historical conversations (optional)

## Future Enhancements

- **Vector search**: Semantic search across conversations
- **Auto-summarization**: Trigger summarization every N messages
- **Smart suggestions**: Suggest actions based on conversation
- **Multi-turn planning**: Break complex requests into steps
- **Conversation branching**: Fork conversations to try different approaches
- **Analytics**: Track conversation quality, resolution time, user satisfaction

## Security

- All conversations scoped to Clerk user ID
- Row-level security checks
- No cross-user data leakage
- API rate limiting (via existing middleware)
- Sensitive data redaction in logs

## Monitoring

Key metrics to track:
- Conversations created per product
- Messages per conversation
- Cross-product conversation switches
- Response latency
- Tool usage frequency
- User satisfaction (thumbs up/down)
