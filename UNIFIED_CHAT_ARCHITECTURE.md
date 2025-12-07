# Unified Chat Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLERK USER                                  │
│                      (user_2abc123xyz)                              │
└───────────────────┬────────────────────┬────────────────────────────┘
                    │                    │
                    ▼                    ▼
        ┌───────────────────┐  ┌───────────────────┐
        │   Wells AI        │  │  Grain & Vault    │
        │ (wellsonyx.io)    │  │(grainandvault.com)│
        └───────┬───────────┘  └────────┬──────────┘
                │                       │
                │    BOTH USE SAME API  │
                │                       │
                └──────────┬────────────┘
                           ▼
                ┌──────────────────────┐
                │  /api/chat/unified   │
                │  (Next.js API)       │
                └──────────┬───────────┘
                           │
            ┏━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┓
            ▼                              ▼
   ┌────────────────┐            ┌──────────────────┐
   │ PostgreSQL DB  │            │  Claude API      │
   │ Unified Schema │            │  (Anthropic)     │
   └────────────────┘            └──────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                    unified_conversations                         │
├──────────────────┬──────────────────────────────────────────────┤
│ id               │ UUID (primary key)                           │
│ clerk_user_id    │ Links to Clerk user                         │
│ product_origin   │ 'wellsai' | 'grainvault'                    │
│ current_product  │ 'wellsai' | 'grainvault'                    │
│ journey          │ founder/buyer/seller/jobs/treasury/master   │
│ message_count    │ Auto-incremented by trigger                 │
│ last_message_at  │ Auto-updated by trigger                     │
└──────────────────┴──────────────────────────────────────────────┘
                              │
                              │ 1:N relationship
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      unified_messages                            │
├──────────────────┬──────────────────────────────────────────────┤
│ id               │ UUID (primary key)                           │
│ conversation_id  │ References conversation                      │
│ role             │ 'user' | 'assistant' | 'system'             │
│ content          │ Message text                                 │
│ product_context  │ Which product user was on                   │
│ tool_use         │ JSONB (Claude tool execution)               │
│ action_type      │ capture_lead, prepare_payment, etc.         │
│ action_status    │ pending/completed/failed                    │
└──────────────────┴──────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    unified_user_context                          │
├──────────────────┬──────────────────────────────────────────────┤
│ clerk_user_id    │ Links to Clerk user (unique)                │
│ wellsai_profile  │ JSONB (Wells AI specific context)           │
│ grainvault_profile│ JSONB (Grain & Vault specific context)     │
│ recent_topics    │ TEXT[] (Array of recent topics)             │
│ key_entities     │ JSONB (Companies, amounts, products)        │
│ *_message_count  │ Activity tracking per product               │
│ last_*_activity  │ Timestamp tracking per product              │
└──────────────────┴──────────────────────────────────────────────┘
```

## Request Flow

### Scenario 1: New User on Wells AI

```
1. User visits wellsonyx.io
   │
2. User types: "I need a CTO"
   │
3. Frontend → POST /api/chat/unified
   {
     messages: [{ role: 'user', content: 'I need a CTO' }],
     product: 'wellsai',
     journey: 'founder'
   }
   │
4. API creates conversation in DB
   │
   ├─ unified_conversations (new row)
   │  ├─ product_origin: 'wellsai'
   │  └─ journey: 'founder'
   │
5. API builds system prompt
   │
   ├─ Base: Wells AI persona
   ├─ Journey: Founder prompts
   └─ Context: First-time user
   │
6. API calls Claude
   │
   └─ Tools: capture_lead, start_negotiation
   │
7. Claude responds: "Let me help you find a CTO..."
   │
8. API saves messages to DB
   │
   ├─ unified_messages (user message)
   └─ unified_messages (assistant message)
   │
9. API returns response
   │
   └─ { message: "...", conversationId: "uuid" }
```

### Scenario 2: Same User on Grain & Vault

```
1. User visits grainandvault.com
   │
2. User types: "What's my balance?"
   │
3. Frontend → POST /api/chat/unified
   {
     messages: [{ role: 'user', content: "What's my balance?" }],
     product: 'grainvault',
     journey: 'treasury'
   }
   │
4. API creates NEW conversation
   │
   ├─ unified_conversations (new row)
   │  ├─ product_origin: 'grainvault'
   │  └─ Same clerk_user_id
   │
5. API fetches user context
   │
   ├─ Sees wellsai_message_count > 0
   ├─ Loads recent_topics from Wells AI
   └─ Knows user is active on both products
   │
6. API builds system prompt
   │
   ├─ Base: Grain & Vault persona
   ├─ Journey: Treasury prompts
   ├─ Context: User also uses Wells AI
   └─ Cross-product awareness added
   │
7. API calls Claude
   │
   └─ Tools: get_balance, prepare_payment
   │
8. Claude responds with balance info
   │
   └─ May reference Wells AI context naturally
   │
9. API saves to DB and returns
```

## Cross-Product Context Flow

```
User Journey:

Day 1 (Wells AI):
  "I need suppliers for industrial motors"
    ↓
  Conversation saved:
    - product: wellsai
    - topics: [suppliers, industrial motors]
    - entities: { product_type: "motors" }

Day 2 (Grain & Vault):
  "Can I make a payment for motors?"
    ↓
  System loads context:
    - Sees Wells AI conversation about motors
    - recent_topics includes "industrial motors"
    - key_entities has "motors"
    ↓
  Claude response:
    "Yes! Based on your supplier search for industrial
     motors on Wells AI, I can prepare a payment.
     How much should I send?"
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedChat Component                     │
│                      (React/TypeScript)                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Props:                                                      │
│    - product: 'wellsai' | 'grainvault'                      │
│    - journey: string                                         │
│    - conversationId: string (optional)                       │
│    - treasuryContext: object (for Grain & Vault)            │
│                                                              │
│  State:                                                      │
│    - messages: Message[]                                     │
│    - conversationId: string                                  │
│    - isLoading: boolean                                      │
│                                                              │
│  Features:                                                   │
│    ✓ Auto-saves to database                                 │
│    ✓ Product indicator badge                                │
│    ✓ Loading states                                         │
│    ✓ Error handling                                         │
│    ✓ Keyboard shortcuts                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Service Layer Architecture

```
┌────────────────────────────────────────────────────────────┐
│                  Context Builder                           │
├────────────────────────────────────────────────────────────┤
│  buildSystemPrompt()                                       │
│    ├─ Product persona                                      │
│    ├─ Journey-specific prompts                             │
│    ├─ User profile context                                 │
│    ├─ Cross-product awareness                              │
│    └─ Conversation memory                                  │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│              Unified Chat Service                          │
├────────────────────────────────────────────────────────────┤
│  createConversation()                                      │
│  addMessage()                                              │
│  getConversationHistory()                                  │
│  getRecentContext()                                        │
│  switchProduct()                                           │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│               PostgreSQL Database                          │
│           (Unified Schema with Triggers)                   │
└────────────────────────────────────────────────────────────┘
```

## Tool Selection Logic

```
                    User Request
                         │
                         ▼
              ┌──────────────────┐
              │  Product Check   │
              └─────────┬────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌───────────────┐            ┌─────────────────┐
│   wellsai     │            │   grainvault    │
└───────┬───────┘            └────────┬────────┘
        │                             │
        ▼                             ▼
  Journey Check                 Journey Check
        │                             │
  ┌─────┴─────┐                      │
  ▼     ▼     ▼                      ▼
founder buyer seller            treasury
  │     │     │                      │
  ▼     ▼     ▼                      ▼
┌─────────────────┐          ┌──────────────┐
│ Wells AI Tools  │          │ Treasury     │
│                 │          │ Tools        │
│ - capture_lead  │          │              │
│ - negotiate     │          │ - get_balance│
│ - match         │          │ - pay        │
│ - ...           │          │ - transact   │
└─────────────────┘          └──────────────┘
```

## Data Flow Example

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User Message: "I need a CTO"                              │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Extract Context                                           │
│    - Topics: [hiring, CTO]                                   │
│    - Entities: { role: "CTO" }                               │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Build System Prompt                                       │
│    + Wells AI persona                                        │
│    + Founder journey prompts                                 │
│    + User profile (if available)                             │
│    + Recent topics (if any)                                  │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Call Claude with Tools                                    │
│    - capture_lead                                            │
│    - start_negotiation                                       │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Claude Response                                           │
│    "Let me help you find a CTO. What's your budget?"         │
│    [May use capture_lead tool]                               │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Save to Database                                          │
│    - unified_conversations (create or update)                │
│    - unified_messages (user + assistant)                     │
│    - unified_user_context (update topics/entities)           │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Return Response                                           │
│    { message: "...", conversationId: "uuid" }                │
└──────────────────────────────────────────────────────────────┘
```

## Migration Strategy

```
Phase 1: Deploy Infrastructure
  ├─ Deploy database schema
  ├─ Deploy unified API endpoint
  └─ Keep existing chat working

Phase 2: Soft Launch (Feature Flag)
  ├─ 10% of users → Unified system
  ├─ 90% of users → Legacy system
  └─ Monitor for issues

Phase 3: Gradual Rollout
  ├─ Increase to 25%
  ├─ Increase to 50%
  ├─ Increase to 75%
  └─ Monitor metrics

Phase 4: Full Migration
  ├─ 100% of users → Unified system
  ├─ Update frontend to UnifiedChat component
  └─ Remove legacy code

Phase 5: Enhancement
  ├─ Add vector search
  ├─ Add auto-summarization
  └─ Add analytics dashboard
```

## Security Model

```
Request Flow:
  │
  ├─ 1. Clerk Auth Middleware
  │     └─ Extracts userId from session
  │
  ├─ 2. Conversation Access Check
  │     └─ WHERE clerk_user_id = {userId}
  │
  ├─ 3. Product Context Validation
  │     └─ Ensure product matches hostname
  │
  ├─ 4. Master Mode Validation
  │     └─ Require COLD_START_MASTER_KEY
  │
  └─ 5. Tool Authorization
        └─ Check permissions for tool use
```

## Performance Optimizations

```
Database Level:
  ├─ Indexes on clerk_user_id
  ├─ Indexes on product_origin
  ├─ Indexes on created_at (DESC)
  ├─ Triggers for auto-updates
  └─ Pre-computed aggregations

Application Level:
  ├─ Recent messages limit (10-20)
  ├─ Conversation summaries (cached)
  ├─ Async topic extraction
  └─ Lazy loading of context

API Level:
  ├─ Response streaming (future)
  ├─ Request coalescing
  └─ Rate limiting per user
```
