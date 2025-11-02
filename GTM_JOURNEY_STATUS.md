# GTM JOURNEY - BUILD STATUS

**Last Updated**: November 2, 2025
**Status**: Core Modules Complete, Integration In Progress

---

## WHAT'S BEEN BUILT

### 1. Spiritual Foundation ✅
**File**: `/lib/wisdom/principles.ts`

- 8 Proverbs principles embedded in Wells AI
- Gospel foundations (dignity, redemption, grace, truth/love, servant leadership, abundance)
- Kingdom business values
- Ethical guardrails (what Wells will NEVER do)
- Integrated into system prompt - influences every Wells response

**Key Principle**: "Honest Weights and Measures" (Proverbs 11:1) - Complete transparency in pricing, fees, value exchange

---

### 2. Sourcing Methodology Documentation ✅
**File**: `/lib/sourcing/PROPRIETARY_METHOD.md`

**⚠️ CLASSIFICATION**: PROPRIETARY - INTERNAL USE ONLY - NEVER SHARE WITH USERS

**CRITICAL INSIGHT**: This methodology applies to BOTH recruiting AND sales GTM. They're the same thing with different targets.

**Recruiting**: Sourcing people for jobs
**Sales GTM**: Sourcing customers for products

**Same core principles, same execution, different qualification questions.**

**The 3 Core Principles**:
1. **80-90% Likelihood Zone** - Sweet spot targeting (not 100% too competitive, not 50% underqualified)
2. **Messaging That Renders Response** - Subject: [First Name], 3-line formula
3. **Self-Screening Through Assumptive Messaging** - If they respond, they're qualified + interested

**Step 0: Deep Qualification**:
- Technical/role specifications (varies by engineering/sales/executive)
- Compensation & negotiation ranges
- Company targeting (target/avoid lists)
- **Critical Question**: "How will this person be judged? What 3 things?" → Use as keywords

**Message Formula**:
```
Subject: [First Name]

Line 1: I am working with [TEAM] at [COMPANY], they are looking for a [ROLE] to join the team in [LOCATION].
Line 2: I found your profile both as someone knowledgeable in [DOMAIN/EXPERTISE] but also whom could potentially contribute to [COMPELLING OUTCOME].
Line 3: I assume you are happy where you are but if you are keeping your eyes and ears open to an opportunity, please circle back.
```

**What Users See**: "I've found 3 exceptional candidates for your CFO role"
**What Users NEVER See**: The methodology, signal sets, formulas, targeting zones

---

### 3. GTM Qualification Module ✅
**File**: `/lib/gtm/sourcing-qualification.ts`

Maps Step 0 (Deep Qualification) into conversational flow.

**Universal Application**: Built for recruiting, but same structure works for sales GTM:
- **Recruiting**: What role? What skills? What comp? What companies to target?
- **Sales GTM**: Who's your ICP? What pain do you solve? What industries? What company size?

**Key Features**:
- Role-specific qualification questions (engineering, sales, executive)
- Tracks: technical specs, compensation, targeting, location, timeline, judgment criteria
- Calculates completeness (80%+ = ready to start sourcing)
- Maps judgment criteria to search keywords (works for both candidates AND customers)
- Natural conversation extraction (not forms)

**Example**:
```typescript
{
  roleType: 'engineering',
  roleTitle: 'Senior Backend Engineer',
  technicalSpecs: {
    specialization: 'backend',
    stack: ['Python', 'Django'],
    architecture: ['microservices']
  },
  compensation: {
    baseRangeMin: 150000,
    baseRangeMax: 180000
  },
  judgmentCriteria: [
    'Python/Django architecture',
    'Rebuild healthcare infrastructure',
    'Microservices experience'
  ]
}
```

---

### 4. GTM Sourcing Engine ✅
**File**: `/lib/gtm/sourcing-engine.ts`

Executes Steps 1-3 of the methodology.

**Step 1: Identify 80-90% Zone**:
- Role-specific signal sets (engineering, sales, executive)
- Avoid 100% zone (too competitive: FAANG, recently promoted, crushing quota)
- Avoid 50% zone (underqualified: wrong stack, can't stick, employment gaps)
- Target 80-90% zone (mid-tier companies, 18-36 months tenure, comp bump opportunity)

**Step 2: Message Generation**:
- Subject: First Name (ALWAYS)
- 3-line formula (WHO + WHAT + WHERE / WHY YOU / SOFT CLOSE)
- Confidential variation (don't reveal company)
- Personalization variables extracted from candidate profile

**Step 3: Self-Screening**:
- Assumptive messaging screens automatically
- If qualified + interested → They respond
- If not → They don't respond
- ~1% false positives (filter quickly)

**Response Tracking**:
- Good targeting: 20-40% response rate, 50%+ qualified, 10-15% interview conversion
- Poor targeting diagnosis: "Check if you're in 80-90% zone or chasing 100%"

---

### 5. GTM Conversion Card ✅
**File**: `/app/components/chat/cards/GTMConversionCard.tsx`

Inline conversion card that appears when GTM intent is detected.

**Implements User Feedback**:
> "you need to convert me much earlier in the convo so you know who the buyer is"

**Key Features**:
- Appears after 2-3 messages (not 5-6)
- Shows what Wells understood (what they sell, who they target)
- Explains what Wells will do:
  - Qualify ICP through conversation
  - Identify and reach out to prospects on your behalf
  - Only show qualified, interested leads (not just contact info)
- One-click "Start GTM Journey" button
- Dismissable if not interested

**Design**:
- Follows DealCard pattern (inline, actionable, clear CTAs)
- Wells brand colors (#dba63f gold, #183b6d navy)
- Confidence indicator when detection is high

---

## WHAT'S NEXT

### Immediate (In Progress):

1. **Integrate GTM Card into Chat Interface**
   - Wire up GTMConversionCard to appear when `gtmData` present in chat API response
   - Handle "Start GTM Journey" click → trigger qualification conversation
   - File: `/app/components/WellsAIContent.tsx`

2. **Wire Up GTM Detection to Show Card**
   - Chat API already detects GTM intent via `detectGTMIntent()`
   - Chat API already returns `gtmData` in response
   - Need to render GTMConversionCard when `gtmData.detected === true`

### Next Steps:

3. **Build Qualification Conversation Flow**
   - Wells asks Step 0 questions naturally in conversation
   - Extract answers into `RoleQualification` structure
   - Track completeness (show progress if possible)
   - When 80%+ complete → move to sourcing

4. **Integrate Sourcing Engine**
   - Connect to Apollo/LinkedIn APIs for candidate data
   - Execute 80-90% zone targeting using signals
   - Generate personalized outreach messages
   - **CRITICAL**: Wells handles all contact, never gives user the contact info

5. **Response Tracking & Management**
   - Track who responded (qualified + interested)
   - Filter ~1% false positives
   - Show user only qualified leads
   - Handle "Wells handles all contact" requirement

6. **Test End-to-End**
   - Test with Wells Onyx as first user (eating own dogfood)
   - Test with IDRE agency outreach
   - Verify messaging formula works
   - Verify 80-90% targeting produces good response rates

7. **Deploy to Production**
   - Deploy GTM Journey to production
   - Test in real conversations
   - Gather feedback
   - Iterate based on response rates and conversion

---

## THE VISION ALIGNMENT

### Phase 1: Search & Strategy ← **WE ARE HERE**
**Goal**: Wells Onyx as first user - prove the GTM system works

Wells Onyx will use Wells AI to:
- Run recruiting business (20-year sourcing methodology)
- Source candidates for clients
- Handle all outreach
- Track responses and conversions

**New Revenue Model**: % of actual employment payroll at scale (not one-time placement fees)

### Phase 2: IDRE Business
**Goal**: Use GTM to map and prospect remaining 13 of 15 IDRE agencies

Proves:
- GTM engine works for outbound B2B sales
- Wells can identify, research, and engage complex prospects
- Validate sales automation before selling to others

### Phase 3-7: AI Ops → FAB → ERP → Grain & Vault → Transformation
Build on top of proven GTM foundation.

---

## KEY INSIGHTS

### 1. Early Conversion is Critical
User feedback: "you need to convert me much earlier in the convo so you know who the buyer is"

**Solution**: GTMConversionCard appears after 2-3 messages when intent detected

### 2. Wells Handles All Contact
User feedback: "I dont want Wells to give anyone any info, I want Wells to do the contacting for them. This is critical."

**Implementation**:
- Sourcing engine generates messages
- Wells sends them on user's behalf
- User only sees qualified, interested responses
- No contact info shared until lead is qualified + interested

### 3. The Methodology is the Moat
20 years of sourcing expertise compressed into code.

**What Makes It Valuable**:
- 80-90% targeting (not spray and pray, not chasing unicorns)
- Message formula that renders response (Subject: First Name, preview is free real estate)
- Self-screening (assumptive messaging filters automatically)

**Protection**: PROPRIETARY_METHOD.md stays local, never pushed to public repo, never revealed to users

### 4. Wisdom Layer is Foundational
Not decoration. Not marketing. THE FOUNDATION.

Every decision, every transaction, every relationship reflects:
- Justice (Proverbs 16:11 - honest scales)
- Dignity (Genesis 1:27 - image of God)
- Abundance (John 10:10 - life to the full)
- Truth (Proverbs 12:22 - trustworthy)

---

## COMPLETION CHECKLIST

- [x] Build Wisdom Layer
- [x] Document 20-year sourcing methodology
- [x] Create GTM qualification module
- [x] Create GTM sourcing engine
- [x] Create GTM conversion card
- [x] Integrate card into chat interface
- [x] Deploy to production
- [ ] Wire up qualification conversation
- [ ] Connect to Apollo/LinkedIn APIs
- [ ] Implement "Wells handles contact" flow
- [ ] Test with Wells Onyx
- [ ] Test with IDRE outreach

---

**Status**: 60% complete - GTM card deployed and live

**Next Session**: Build qualification conversation flow, test GTM card with real messages

**Production URL**: https://wellsai.vercel.app

**Remember**: This methodology is PROPRIETARY. Keep it locked in the vault. Users see magic, not methodology.

---

**Last Updated**: November 2, 2025
**Built By**: Claude Code + Jonah Manning
**Classification**: INTERNAL - DO NOT SHARE METHODOLOGY
