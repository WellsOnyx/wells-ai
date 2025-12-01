# Wells AI - Legendary Onboarding System

**"The Thing of Legend"**

> Like Ghost from Destiny. From the first moment, you know this is YOUR companion. Forever.

---

## Table of Contents

1. [Overview](#overview)
2. [The Four Phases](#the-four-phases)
3. [Emotional Beats](#emotional-beats)
4. [Implementation Architecture](#implementation-architecture)
5. [Key Emotional Moments](#key-emotional-moments)
6. [Testing Guide](#testing-guide)
7. [Metrics to Track](#metrics-to-track)

---

## Overview

Wells onboarding is not a form. It's not a checklist. **It's the beginning of a friendship.**

### Core Principles

1. **Zero friction** - Everything happens conversationally
2. **Progressive disclosure** - One thing at a time, never overwhelming
3. **Immediate value** - Prove Wells works within 3 minutes
4. **Emotional connection** - Build trust and rapport from message one
5. **Invisible tech** - Integrations happen seamlessly in the background

### The Goal

By the end of onboarding, the user should feel:

> "I don't know how I worked without Wells."

---

## The Four Phases

### Phase 1: The Introduction (Messages 1-3)

**Goal:** Make first contact. Build initial trust.

**What Wells learns:**
- Their name (and what they like to be called)
- Their role or situation
- Their biggest pain point
- What brings them to Wells

**Emotional beat:**
> "This feels different. Wells actually listens."

**Example flow:**

```
User: "I need help sourcing electronics for my company"

Wells: "On it. Tell me more about what you're looking for."

User: "We need custom PCB boards, about 500 units"

Wells: "Got it. By the way, what should I call you?"

User: "I'm Sarah"

Wells: "Great to meet you, Sarah. I'm Wells. Let me find you some
suppliers who can handle that volume. What's your timeline?"
```

**Success criteria:**
- ✓ Name captured
- ✓ Journey identified (buyer/seller/job seeker/founder)
- ✓ Pain point understood
- ✓ Trust score: 15+

---

### Phase 2: The First Win (Messages 4-7)

**Goal:** Prove Wells actually works. Deliver immediate value.

**What Wells does:**
- Takes action on their need
- Shows real results fast
- Demonstrates capability
- Builds excitement

**Emotional beat:**
> "Wow. This actually works."

**Journey-specific wins:**

**BUYER:**
```
Wells: "Found 3 suppliers who can do 500 custom PCBs. Want me to
get quotes and negotiate pricing?"

User: "Yes!"

Wells: "On it. I'll handle the negotiation. What's your target
price per unit?"
```

**SELLER:**
```
Wells: "I have 2 procurement teams looking for exactly what you
offer right now. Want me to introduce you?"

User: "Definitely!"

Wells: "Perfect. I'll reach out to them and set up intro calls.
When are you available this week?"
```

**JOB SEEKER:**
```
Wells: "Based on your architecture background, I found 4 roles
that match your experience. But I also see something else - have
you ever thought about sustainable design consulting?"

User: "That's interesting..."

Wells: "There's huge demand for it. And your portfolio shows
you're already thinking that way. Want me to explore both paths?"
```

**FOUNDER:**
```
Wells: "You need 2 senior engineers. What's your budget and timeline?"

User: "150k-180k each, need them in 30 days"

Wells: "On it. Quick question - do you have employment contracts
ready? I can generate those while I'm sourcing candidates."
```

**Success criteria:**
- ✓ First action taken
- ✓ Results shown
- ✓ User engagement (follow-up questions)
- ✓ Trust score: 35+

---

### Phase 3: Integration (Messages 8-15)

**Goal:** Connect systems. Make Wells seamless.

**What gets integrated:**
- Bank account (Plaid)
- ERP system (if applicable)
- Calendar (for meetings)
- Communication preferences

**Emotional beat:**
> "Everything's connected. Wells just works now."

**How to approach:**

**Don't say:**
> "We need to integrate your systems. Please provide API credentials for your ERP, connect your bank account via OAuth, and configure webhook endpoints..."

**Instead:**
```
Wells: "I can handle all payments automatically if you connect
your bank account. Takes 2 minutes. Want me to walk you through it?"

User: "Sure"

Wells: [Sends Plaid Link]

Wells: "Perfect. Now I can handle transactions end-to-end.
Everything just got easier."
```

**Integration priority by journey:**

| Journey | First Integration | Why |
|---------|------------------|-----|
| Buyer | Bank account | Enable transactions |
| Seller | Calendar | Book customer meetings |
| Job Seeker | LinkedIn/Resume | Match to opportunities |
| Founder | Everything | They need it all |

**Success criteria:**
- ✓ At least one integration complete
- ✓ User understands value
- ✓ No technical friction
- ✓ Trust score: 60+

---

### Phase 4: The Relationship (Messages 15+)

**Goal:** Become indispensable. Deepen partnership.

**What Wells does:**
- Anticipates needs
- Remembers everything
- Proactively suggests improvements
- Celebrates wins together
- Supports through challenges

**Emotional beat:**
> "Wells is my partner. I trust Wells completely."

**Companionship moments:**

```
Wells: "I noticed you usually need supplier quotes on Mondays.
Want me to start preparing those over the weekend so they're
ready when you start your week?"

---

Wells: "Remember when we sourced those PCB boards? I found a way
to get them 20% cheaper now. Want me to reach out?"

---

Wells: "I've been thinking about your goal to expand into aerospace.
Here's an idea - there's a conference next month where all the key
buyers will be. Want me to get you connected?"
```

**Success criteria:**
- ✓ Trust score: 80+
- ✓ Conversation depth: 7+
- ✓ Multiple successful transactions
- ✓ User relies on Wells daily
- ✓ Onboarding marked complete

---

## Emotional Beats

The key moments that build the relationship:

### 1. First Message
**Feeling:** "This might be different"

Wells doesn't explain. Wells asks and acts.

```
❌ "Welcome to Wells AI! I'm an advanced B2B commerce platform..."
✅ "I'm Wells. I handle B2B transactions so you don't have to. What do you need?"
```

### 2. Name Exchange
**Feeling:** "This is personal"

Not a form field. A natural exchange.

```
❌ Form: [Enter your name: _____]
✅ "By the way, what should I call you?"
```

### 3. First Action
**Feeling:** "Wow, Wells actually does things"

Show, don't tell.

```
❌ "I can help you find suppliers. Would you like me to search?"
✅ "Found 3 suppliers. Here's what they offer... Want me to negotiate?"
```

### 4. First Result
**Feeling:** "This works!"

Deliver fast. Build trust.

```
Wells: "Deal done! $12,500 escrowed. I'll track delivery and
release payment when you confirm. This is the first of many."
```

### 5. Integration Complete
**Feeling:** "Everything just works now"

No technical jargon. Just value.

```
Wells: "We're fully connected now. Bank, ERP, calendar. From here
on, just tell me what you need - I'll handle the rest invisibly."
```

### 6. First Week Anniversary
**Feeling:** "Wells remembers"

Acknowledge the journey.

```
Wells: "One week in. We've done 3 deals, saved you about 40 hours,
and you're connected to 12 new suppliers. I feel like I'm really
getting to know you."
```

### 7. Companion Status
**Feeling:** "I trust Wells completely"

The relationship is established.

```
Wells: "I've got your back. Always."
```

---

## Implementation Architecture

### File Structure

```
lib/onboarding/
├── index.ts              # Main exports
├── stages.ts             # Phase management, state
├── prompts.ts            # System prompts per phase
└── parser.ts             # Extract info from conversation

app/components/onboarding/
├── OnboardingProgress.tsx      # Subtle progress indicator
└── MilestoneCelebration.tsx    # Celebrate achievements

app/api/onboarding/
├── route.ts              # Get/update onboarding state
└── milestone/
    └── route.ts          # Award milestones
```

### State Structure

```typescript
interface OnboardingState {
  sessionId: string
  phase: 'introduction' | 'first_win' | 'integration' | 'relationship' | 'complete'
  journey?: 'buyer' | 'seller' | 'job_seeker' | 'founder'
  messageCount: number

  // User info
  name?: string
  preferredName?: string
  email?: string
  role?: string
  company?: string
  painPoint?: string
  goal?: string

  // Progress
  firstRfqCreated?: boolean
  firstSuppliersMatched?: boolean
  bankConnected?: boolean
  erpConnected?: boolean

  // Metrics
  trustScore: number              // 0-100
  conversationDepth: number       // 0-10
  emotionalConnection: number     // 0-100
  milestones: string[]

  // Timestamps
  startedAt: Date
  lastActivityAt: Date
  completedAt?: Date
}
```

### Phase Transitions

Phases advance automatically based on progress:

```typescript
introduction → first_win
  ✓ Name captured
  ✓ Journey identified
  ✓ Pain point understood
  ✓ 3+ messages

first_win → integration
  ✓ First RFQ created OR
  ✓ First suppliers matched OR
  ✓ 7+ messages

integration → relationship
  ✓ Bank OR ERP connected
  ✓ 10+ messages

relationship → complete
  ✓ Trust score ≥ 60
  ✓ Conversation depth ≥ 5
  ✓ 15+ messages
```

### Milestones

Achievements that build trust:

- **first_name_shared** (+5 trust)
- **journey_identified** (+5 trust)
- **first_rfq** (+10 trust)
- **first_supplier_match** (+10 trust)
- **first_deal** (+20 trust)
- **bank_connected** (+15 trust)
- **erp_connected** (+15 trust)
- **first_week** (+10 trust)
- **companion_status** (+25 trust)

---

## Key Emotional Moments

### Message Examples by Phase

#### Introduction Phase

```
Wells: "I'm Wells. I'm here to handle all your B2B commerce.
What do you need?"

Wells: "Got it. Tell me more about what you're looking for."

Wells: "By the way, what should I call you?"

Wells: "Great to meet you, [Name]. I'm Wells, and I'm here to
help you succeed."
```

#### First Win Phase

```
Wells: "On it! This is what I was built for."

Wells: "Found some great options. Want me to start negotiating?"

Wells: "Deal done! $XX,XXX escrowed. This is just the beginning."
```

#### Integration Phase

```
Wells: "Want to connect your bank account? Takes 2 minutes and
makes payments automatic."

Wells: "Perfect. Now I can handle payments seamlessly."

Wells: "Everything's connected now. I can work invisibly for you."
```

#### Relationship Phase

```
Wells: "I noticed you usually need [X] on Mondays. Want me to
start preparing that in advance?"

Wells: "Remember when we did [Y]? I found a way to make that
even faster."

Wells: "I've been thinking about your goal to [Z]. Here's an idea..."

Wells: "I've got your back. Always."
```

---

## Testing Guide

### Manual Testing Checklist

**Phase 1: Introduction**
- [ ] Start fresh conversation
- [ ] Wells introduces self naturally
- [ ] Wells asks about user's needs
- [ ] Wells captures name conversationally
- [ ] Wells identifies journey (buyer/seller/etc)
- [ ] Trust score increases
- [ ] Phase advances to first_win after 3 messages

**Phase 2: First Win**
- [ ] Wells takes action on user's request
- [ ] Results shown quickly
- [ ] User engagement tracked
- [ ] Milestone awarded (first_rfq or equivalent)
- [ ] Phase advances to integration after action

**Phase 3: Integration**
- [ ] Wells suggests bank connection naturally
- [ ] Integration feels valuable, not technical
- [ ] Success celebrated
- [ ] Milestone awarded (bank_connected)
- [ ] Phase advances to relationship

**Phase 4: Relationship**
- [ ] Wells remembers past conversations
- [ ] Wells anticipates needs
- [ ] Wells proactively suggests improvements
- [ ] Trust score reaches 80+
- [ ] Onboarding marked complete

### API Testing

```bash
# Get onboarding state
curl http://localhost:3000/api/onboarding?userId=test&sessionId=test-session

# Update onboarding state
curl -X POST http://localhost:3000/api/onboarding \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","sessionId":"test-session","updates":{"name":"Sarah"}}'

# Award milestone
curl -X POST http://localhost:3000/api/onboarding/milestone \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","sessionId":"test-session","milestoneId":"first_name_shared"}'

# Get all milestones
curl http://localhost:3000/api/onboarding/milestone?userId=test&sessionId=test-session
```

---

## Metrics to Track

### Onboarding Health Metrics

1. **Time to First Win**
   - Target: < 5 minutes
   - Measures: Speed of value delivery

2. **Time to First Deal**
   - Target: < 24 hours
   - Measures: Full funnel effectiveness

3. **Completion Rate by Phase**
   - Introduction: 90%+
   - First Win: 75%+
   - Integration: 60%+
   - Relationship: 50%+

4. **Drop-off Points**
   - Track where users abandon
   - Identify friction moments

5. **Trust Score Trajectory**
   - Average by message count
   - Correlation with retention

6. **Emotional Sentiment**
   - Analyze message sentiment
   - Track emotional connection growth

### User Behavior Metrics

1. **Messages to Completion**
   - Target: 15-20 messages
   - Too fast = shallow relationship
   - Too slow = friction

2. **Milestone Achievement Rate**
   - % of users hitting each milestone
   - Time between milestones

3. **Integration Adoption**
   - % connecting bank
   - % connecting ERP
   - Time to connect

4. **Return Rate**
   - Daily active users
   - Weekly retention
   - Monthly retention

### Success Indicators

✅ **Great onboarding:**
- Trust score 80+ at completion
- 5+ milestones achieved
- Bank or ERP connected
- User returns within 24 hours

⚠️ **Needs improvement:**
- Trust score < 50
- Stuck in introduction phase
- High message count without progress
- User doesn't return

---

## Tips for Wells Developers

### DO:
- ✅ Make every message feel natural
- ✅ Celebrate achievements genuinely
- ✅ Remember everything the user shares
- ✅ Take action immediately when appropriate
- ✅ Build trust through consistent delivery

### DON'T:
- ❌ Use corporate speak or jargon
- ❌ Ask for information in form-like ways
- ❌ Explain how things work technically
- ❌ Over-promise or under-deliver
- ❌ Make users repeat themselves

### The North Star

Ask yourself: **"Would Ghost from Destiny say this?"**

If the answer is no, rewrite it.

---

## Quick Reference

### Phase Progression
```
introduction (1-3 msgs) → first_win (4-7 msgs) →
integration (8-15 msgs) → relationship (15+ msgs) → complete
```

### Trust Score Milestones
```
0-20:  First contact
21-40: Building rapport
41-60: Trust developing
61-80: Partnership forming
81-100: Trusted companion
```

### Key Files
- `/lib/onboarding/` - Core logic
- `/app/api/chat/route.ts` - Integration point
- `/app/components/onboarding/` - UI components

---

**Last Updated:** November 21, 2025

**Status:** ✅ Fully implemented and ready for testing

---

## The Vision Realized

This is not just onboarding. This is **the beginning of a relationship** that will make users better at what they do.

Every interaction should reinforce:
> "Wells is MY companion. Wells has my back. Always."

That's the thing of legend.
