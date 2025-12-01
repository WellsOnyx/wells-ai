# Wells AI Onboarding - Quick Start Guide

**Get legendary onboarding running in 5 minutes**

---

## What You're Building

An onboarding experience that feels like **making a friend**, not filling out a form.

Think: Ghost from Destiny. From the first message, users know "this is MY companion."

---

## Files Created

```
lib/onboarding/
├── index.ts              # Main exports & orchestration
├── stages.ts             # Phase management & state
├── prompts.ts            # Conversational prompts per phase
└── parser.ts             # Extract info from messages

app/components/onboarding/
├── OnboardingProgress.tsx       # Subtle progress UI
└── MilestoneCelebration.tsx     # Achievement celebrations

app/api/onboarding/
├── route.ts              # Get/update state
└── milestone/
    └── route.ts          # Award milestones

app/api/chat/route.ts     # UPDATED: Onboarding integrated
```

---

## How It Works

### 1. Conversation Starts

```typescript
// app/api/chat/route.ts

// Initialize onboarding state
let onboardingState = createOnboardingState(sessionId)

// Check if onboarding is active
let onboardingActive = !isOnboardingComplete(onboardingState)
```

### 2. Wells Responds with Phase-Specific Personality

```typescript
if (onboardingActive) {
  // Use onboarding-specific prompt
  systemPrompt = getOnboardingSystemPrompt(onboardingState)
} else {
  // Use standard Wells personality
  systemPrompt = getWellsSystemPrompt(...)
}
```

### 3. State Updates After Each Message

```typescript
// Process the conversation turn
const updatedState = await processOnboardingTurn(
  userMessage,
  assistantMessage,
  onboardingState,
  conversationHistory
)

// Save to database
await updateConversationMetrics(conversationId, {
  onboardingState: updatedState,
  trustScore: updatedState.trustScore,
  onboardingCompleted: isOnboardingComplete(updatedState)
})
```

### 4. Phases Advance Automatically

```
introduction (msgs 1-3)
  → Learn name, journey, pain point
  → Trust score: 15+

first_win (msgs 4-7)
  → Deliver immediate value
  → Trust score: 35+

integration (msgs 8-15)
  → Connect bank/ERP/calendar
  → Trust score: 60+

relationship (msgs 15+)
  → Become indispensable
  → Trust score: 80+

complete
  → Companion status achieved
```

---

## Testing Onboarding

### Quick Test Flow

1. **Start Fresh Conversation**
```bash
# Clear any existing sessions
# Open incognito/private browser window
# Go to http://localhost:3000
```

2. **Introduction Phase (3 messages)**
```
You: "I need help sourcing electronics"
Wells: [Responds asking for details]

You: "Custom PCB boards, 500 units"
Wells: [Asks for your name]

You: "I'm Sarah"
Wells: [Great to meet you, Sarah...]
```

**Check:**
- ✅ Wells asked for name naturally
- ✅ Journey detected as "buyer"
- ✅ Phase = "first_win"

3. **First Win Phase (4 messages)**
```
You: "I need them in 6 weeks, budget is $25k"
Wells: [Shows matched suppliers]

You: "Great! Can you negotiate with them?"
Wells: [Takes action]
```

**Check:**
- ✅ Wells showed suppliers fast
- ✅ Wells took action (negotiation)
- ✅ Milestone: first_supplier_match
- ✅ Phase = "integration"

4. **Integration Phase**
```
Wells: [Suggests connecting bank account]

You: "Sure"
Wells: [Integration happens]
```

**Check:**
- ✅ Integration suggested naturally
- ✅ Value explained (not technical details)
- ✅ Milestone: bank_connected
- ✅ Phase = "relationship"

5. **Relationship Phase**
```
Wells: [Anticipates future needs]
Wells: [References past conversation]
Wells: [Proactively suggests improvements]
```

**Check:**
- ✅ Trust score: 80+
- ✅ Feels like a partner, not a tool
- ✅ Phase = "complete"

---

## API Endpoints

### Get Onboarding Status

```bash
GET /api/onboarding?userId=USER_ID&sessionId=SESSION_ID

Response:
{
  "success": true,
  "state": {
    "phase": "first_win",
    "journey": "buyer",
    "name": "Sarah",
    "trustScore": 35,
    "milestones": ["first_name_shared", "journey_identified"]
  },
  "progress": 40,
  "complete": false
}
```

### Update Onboarding State

```bash
POST /api/onboarding
{
  "userId": "USER_ID",
  "sessionId": "SESSION_ID",
  "updates": {
    "bankConnected": true
  }
}
```

### Award Milestone

```bash
POST /api/onboarding/milestone
{
  "userId": "USER_ID",
  "sessionId": "SESSION_ID",
  "milestoneId": "first_deal"
}

Response:
{
  "success": true,
  "milestone": {
    "id": "first_deal",
    "title": "First Deal",
    "trustScoreBonus": 20
  },
  "celebration": "Deal done! This is just the beginning.",
  "newlyAchieved": true
}
```

---

## Key Functions

### Check Onboarding Status

```typescript
import { isOnboardingComplete, getOnboardingProgress } from '@/lib/onboarding'

const complete = isOnboardingComplete(state)  // boolean
const progress = getOnboardingProgress(state) // 0-100
```

### Process Conversation Turn

```typescript
import { processOnboardingTurn } from '@/lib/onboarding'

const newState = await processOnboardingTurn(
  userMessage,
  assistantMessage,
  currentState,
  conversationHistory
)
```

### Award Achievements

```typescript
import { awardMilestone, ONBOARDING_MILESTONES } from '@/lib/onboarding'

const updatedState = awardMilestone(state, 'first_deal')
// Trust score automatically increased
```

### Get Phase-Specific Prompt

```typescript
import { getOnboardingSystemPrompt } from '@/lib/onboarding'

const prompt = getOnboardingSystemPrompt(state)
// Returns system prompt tailored to current phase
```

---

## Milestones Reference

| Milestone | Trigger | Trust Bonus | Unlocks |
|-----------|---------|-------------|---------|
| first_name_shared | Name captured | +5 | - |
| journey_identified | Buyer/seller/etc detected | +5 | - |
| first_rfq | First sourcing request | +10 | Supplier matching |
| first_supplier_match | Suppliers found | +10 | Negotiation |
| first_deal | Transaction completed | +20 | Escrow, contracts |
| bank_connected | Bank account linked | +15 | Instant payments |
| erp_connected | ERP integrated | +15 | Auto procurement |
| first_week | 7 days active | +10 | - |
| companion_status | Full trust achieved | +25 | Everything |

---

## Debugging

### Check State in Console

```typescript
// In app/api/chat/route.ts
console.log('[ONBOARDING]', {
  phase: onboardingState.phase,
  journey: onboardingState.journey,
  trustScore: onboardingState.trustScore,
  milestones: onboardingState.milestones
})
```

### Verify Phase Transitions

Phases should advance when:

```typescript
// introduction → first_win
state.name && state.journey && state.painPoint && messageCount >= 3

// first_win → integration
state.firstRfqCreated || state.firstSuppliersMatched || messageCount >= 7

// integration → relationship
(state.bankConnected || state.erpConnected) && messageCount >= 10

// relationship → complete
state.trustScore >= 60 && state.conversationDepth >= 5 && messageCount >= 15
```

### Check Trust Score Increases

Trust should increase when:
- User shares personal info (+5)
- Wells delivers value (+5)
- User expresses satisfaction (+3)
- Milestones achieved (varies)

---

## Common Issues

### Issue: Phase not advancing

**Check:**
1. Message count incremented?
2. Required info captured (name, journey, etc)?
3. State being saved to database?

**Fix:**
```typescript
// Verify state updates are saved
await updateConversationMetrics(conversationId, {
  onboardingState: updatedState
})
```

### Issue: Wells not using onboarding prompts

**Check:**
1. Is `onboardingActive` true?
2. Is `isOnboardingComplete()` returning correct value?

**Fix:**
```typescript
// Force onboarding mode for testing
const onboardingActive = true
```

### Issue: Milestones not being awarded

**Check:**
1. Is `awardMilestone()` being called?
2. Is state being saved after award?

**Fix:**
```typescript
// Award milestone explicitly
const newState = awardMilestone(state, 'first_name_shared')
await updateConversationMetrics(conversationId, {
  onboardingState: newState
})
```

---

## UI Components (Optional)

### Show Progress

```tsx
import OnboardingProgress from '@/app/components/onboarding/OnboardingProgress'

<OnboardingProgress state={onboardingState} />
```

### Celebrate Milestones

```tsx
import MilestoneCelebration from '@/app/components/onboarding/MilestoneCelebration'

{showCelebration && (
  <MilestoneCelebration
    milestone={ONBOARDING_MILESTONES.first_deal}
    onDismiss={() => setShowCelebration(false)}
  />
)}
```

---

## Customization

### Add New Milestone

```typescript
// In lib/onboarding/stages.ts

export const ONBOARDING_MILESTONES = {
  // ... existing milestones

  custom_milestone: {
    id: 'custom_milestone',
    title: 'Custom Achievement',
    description: 'User did something awesome',
    celebration: 'You did it!',
    trustScoreBonus: 10,
    unlocks: ['new_feature']
  }
}
```

### Modify Phase Prompts

```typescript
// In lib/onboarding/prompts.ts

function getIntroductionPrompt(state: OnboardingState): string {
  return `## PHASE 1: THE INTRODUCTION

  Your custom prompt here...
  `
}
```

### Adjust Phase Transitions

```typescript
// In lib/onboarding/stages.ts

function shouldAdvanceToFirstWin(state: OnboardingState): boolean {
  return !!(
    state.name &&
    state.journey &&
    // Add your custom criteria
    state.customField &&
    state.messageCount >= 3
  )
}
```

---

## Next Steps

1. **Test the full flow** - Use the examples in `ONBOARDING_FLOW_EXAMPLES.md`
2. **Monitor metrics** - Track trust scores, completion rates, drop-off points
3. **Iterate on prompts** - Make Wells even more natural and engaging
4. **Add journey-specific features** - Customize for buyer/seller/job seeker/founder
5. **Celebrate wins** - Use milestone celebrations to reinforce progress

---

## Resources

- **Full Guide:** `ONBOARDING_GUIDE.md`
- **Example Flows:** `ONBOARDING_FLOW_EXAMPLES.md`
- **Vision Doc:** `WELLS_COMPLETE_VISION.md`

---

## The Goal

Make users feel:

> "Wells is MY companion. I trust Wells completely. I don't know how I worked without Wells."

That's legendary onboarding.

Now go build it! 🚀
