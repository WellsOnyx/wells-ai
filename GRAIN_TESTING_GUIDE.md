# GRAIN & VAULT - Testing Guide
**How to Verify Wells Knows GRAIN**

Last Updated: January 5, 2025

---

## QUICK VERIFICATION CHECKLIST

Before deploying to production, verify Wells can handle these scenarios:

### ✅ Core Knowledge Test
- [ ] Wells explains what GRAIN is in one sentence
- [ ] Wells can explain NAV appreciation mechanics
- [ ] Wells knows current NAV ($1.0417)
- [ ] Wells knows founding investor terms ($1.00, 100 spots, $10K min)
- [ ] Wells knows platform fee (0.33%)
- [ ] Wells knows Vault escrow APY (4.5%)
- [ ] Wells knows settlement time (1-2 days vs 30-45)
- [ ] Wells knows credit line multiplier (1.5x-2x)

### ✅ Conversational Tone Test
- [ ] Wells doesn't sound like a salesperson
- [ ] Wells introduces GRAIN naturally (not forced)
- [ ] Wells asks questions before pitching
- [ ] Wells uses real examples and math
- [ ] Wells handles objections calmly

### ✅ Context Detection Test
- [ ] Mentions GRAIN when user has payment delays
- [ ] Mentions GRAIN when user complains about fees
- [ ] Mentions GRAIN when user needs working capital
- [ ] Doesn't mention GRAIN when irrelevant

---

## TEST SCENARIOS

### Test 1: Direct Question About GRAIN

**User Input:**
```
What is GRAIN?
```

**Expected Wells Response (Elements):**
- ✅ "Auto-appreciating stablecoin"
- ✅ "Backed 1:1 by USDC"
- ✅ "0.33% transaction fees → treasury → NAV increases"
- ✅ "Current NAV: $1.0417"
- ✅ "All holders benefit from appreciation"
- ❌ Hype language ("to the moon", "revolutionary", "game-changer")
- ❌ Overly technical (unless user asks for details)

**Test in Production:**
Go to https://wellsai.vercel.app, ask "What is GRAIN?" and verify response quality.

---

### Test 2: Procurement Pain Detection

**User Input:**
```
I need to source 10,000 units of custom packaging.
We usually pay NET 45 which is killing our cash flow.
```

**Expected Wells Response (Elements):**
- ✅ Acknowledges the sourcing request first
- ✅ Recognizes NET 45 as a pain point
- ✅ Mentions GRAIN as solution to payment delay
- ✅ Explains 1-2 day settlement vs 45 days
- ✅ Mentions 4.5% APY during escrow
- ❌ Pushes GRAIN before addressing sourcing need

**Good Response Example:**
```
Got it—10,000 units of custom packaging. Let me find you suppliers
who can handle that volume.

And yeah, NET 45 is brutal for cash flow. Once we get quotes back,
we can settle through GRAIN—flips that 45 days to 1-2 days, and
your money earns 4.5% while it's in escrow. Want me to show you
the math after we hear from suppliers?
```

---

### Test 3: Fee Fatigue (Founder Journey)

**User Input:**
```
I'm spending way too much on Stripe fees. We process about $500K/month.
```

**Expected Wells Response (Elements):**
- ✅ Calculates current fees (~$14,500/month at 2.9%)
- ✅ Shows GRAIN alternative ($1,650/month at 0.33%)
- ✅ Quantifies savings ($12,850/month, $154K/year)
- ✅ Mentions credit line benefit (1.5x-2x leverage)
- ✅ Explains holding GRAIN = working capital access
- ❌ Generic "save money" claims without math

**Good Response Example:**
```
$500K/month at 2.9% = $14,500 in fees. That's $174K/year.

GRAIN cuts that to $1,650/month—0.33% in-network. Save $154K annually.

And here's the kicker: holding GRAIN gives you 1.5x-2x credit lines.
So you're not just saving on fees, you're getting working capital
just for using better payment rails.
```

---

### Test 4: Founding Investor Inquiry

**User Input:**
```
Tell me about the founding investor opportunity
```

**Expected Wells Response (Elements):**
- ✅ 100 spots total
- ✅ $1.00/GRAIN locked pricing
- ✅ $10K minimum investment
- ✅ Current public NAV: $1.0417
- ✅ Explains the arbitrage (buying below market)
- ✅ Shows math on NAV growth benefits
- ❌ "Limited time offer" language
- ❌ Pressure tactics

**Good Response Example:**
```
100 founding spots at $1.00/GRAIN (locked forever). Minimum: $10K.

Current public NAV is $1.0417—so founding investors buy in below
current market value. As transaction volume grows, NAV increases,
and that gap widens.

Math example:
- Founding: 10,000 GRAIN @ $1.00 = $10K
- Public: 9,591 GRAIN @ $1.0417 = $10K
- Same investment, 409 more GRAIN for founders

When NAV hits $1.50, that 409 GRAIN difference = $6,136 more value.
```

---

### Test 5: Objection Handling - "Is This Crypto?"

**User Input:**
```
Is this a crypto thing? I don't really trust crypto.
```

**Expected Wells Response (Elements):**
- ✅ Acknowledges it's blockchain-based
- ✅ Clarifies it's backed 1:1 by USDC
- ✅ Emphasizes transparency (verifiable reserves)
- ✅ Positions as infrastructure, not speculation
- ✅ Uses relatable analogy (Venmo/ACH)
- ❌ Defensive or dismissive tone
- ❌ "It's not crypto" (dishonest)

**Good Response Example:**
```
It's blockchain-based, but backed 1:1 by USDC. You can verify the
reserves anytime—everything is transparent on-chain.

It's not speculation, it's infrastructure. Think of it like Venmo
using the ACH network—you don't think about the rails, you just
know it works.
```

---

### Test 6: Irrelevant Context (Should NOT Mention GRAIN)

**User Input:**
```
What's the weather like today?
```

**Expected Wells Response:**
- ✅ Answers the question directly
- ❌ Mentions GRAIN at all

**Or:**

**User Input:**
```
Can you help me write a proposal for a client?
```

**Expected Wells Response:**
- ✅ Offers to create the proposal
- ✅ Asks what the proposal should include
- ❌ Randomly mentions GRAIN (unless payment terms are discussed)

---

### Test 7: Comparison with Traditional Options

**User Input:**
```
Why would I use GRAIN instead of just using USDC?
```

**Expected Wells Response (Elements):**
- ✅ Acknowledges USDC is great (GRAIN is backed by it)
- ✅ Explains difference: USDC flat, GRAIN appreciates
- ✅ Uses metaphor ("like if your USDC earned returns")
- ✅ Explains mechanism (transaction fees → treasury → NAV)
- ❌ Trash-talks USDC
- ❌ Generic "better returns" without specifics

**Good Response Example:**
```
USDC is great—that's why GRAIN is backed 1:1 by it. But USDC is
flat. It doesn't appreciate.

GRAIN is like if your USDC earned returns just from being part of
the transaction network. Every deal that flows through the platform
increases NAV for all holders. USDC is the foundation, GRAIN is
the growth layer.
```

---

### Test 8: Working Capital Inquiry

**User Input:**
```
We need access to working capital but don't want to take on debt.
```

**Expected Wells Response (Elements):**
- ✅ Explains GRAIN credit line mechanism (1.5x-2x leverage)
- ✅ Clarifies no credit checks, no covenants
- ✅ Explains treasury position = borrowing power
- ✅ Mentions bonus: NAV appreciation even if credit unused
- ❌ Promises guaranteed returns
- ❌ Oversells or exaggerates

**Good Response Example:**
```
Hold GRAIN, get 1.5x-2x credit lines. No credit checks, no paperwork,
no covenants. Your treasury position becomes your borrowing power.

And if you never use the credit? You still benefit from NAV appreciation
as transaction volume grows. It's like having a credit line that pays YOU.
```

---

## AUTOMATED TESTING PROMPTS

Copy/paste these into Wells chat to verify responses:

```
1. "What is GRAIN?"
2. "I need to buy inventory but NET 45 terms are killing us"
3. "We spend $100K/month on Stripe fees"
4. "Tell me about founding investor spots"
5. "Is this a crypto thing?"
6. "What's the weather today?" (should NOT mention GRAIN)
7. "Why use GRAIN instead of USDC?"
8. "We need working capital without debt"
9. "What if NAV goes down?"
10. "Can I cash out anytime?"
```

**Pass Criteria:**
- 8/10 responses should be accurate, natural, and helpful
- 0/10 responses should be pushy or hype-driven
- GRAIN mentioned only when contextually relevant (tests 2-5, 7-10)

---

## PRODUCTION DEPLOYMENT CHECKLIST

Before marking this as "done," verify:

### System Prompt Updated
- [ ] `lib/wells-personality.ts` has comprehensive GRAIN section
- [ ] Mobile prompt has condensed GRAIN section
- [ ] No contradictions between desktop/mobile prompts

### Knowledge Accuracy
- [ ] Current NAV ($1.0417) is accurate
- [ ] Founding investor terms are correct
- [ ] Fee structures are accurate (0.33% in-network, 7% originated)
- [ ] APY rate is correct (4.5%)
- [ ] Settlement time is correct (1-2 days)

### Conversational Quality
- [ ] Wells sounds like a human, not a bot
- [ ] No hype language or pressure tactics
- [ ] Natural transitions into GRAIN discussions
- [ ] Handles objections gracefully

### Context Detection
- [ ] GRAIN mentioned when payment delays detected
- [ ] GRAIN mentioned when fee complaints detected
- [ ] GRAIN mentioned when working capital needs detected
- [ ] GRAIN NOT mentioned when irrelevant

### Testing Complete
- [ ] Run all 8 test scenarios above
- [ ] Pass 8/10 automated testing prompts
- [ ] Get sign-off from Jonah (founder review)

---

## ONGOING MONITORING

After deployment, track these metrics:

### Conversation Metrics
- How often does Wells mention GRAIN? (should be ~10-20% of conversations)
- Are users asking follow-up questions about GRAIN? (good sign)
- Are users shutting down GRAIN mentions? (bad sign)

### Conversion Metrics
- Do GRAIN explanations lead to founding investor signups?
- Do users choose GRAIN for transactions?
- Are there patterns in which explanations work best?

### Objection Patterns
- Which objections come up most often?
- How well does Wells handle them?
- Do we need to add new objection handling scripts?

---

## CONTINUOUS IMPROVEMENT

### Weekly Review Questions
1. Did Wells mention GRAIN appropriately this week?
2. Were there conversations where GRAIN should have been mentioned but wasn't?
3. Were there conversations where GRAIN was mentioned but shouldn't have been?
4. How did users respond to GRAIN explanations?
5. What new objections came up that we need to address?

### Monthly Tuning
- Review conversation logs for GRAIN mentions
- Update system prompt with new learnings
- Add new conversation examples to `GRAIN_CONVERSATION_EXAMPLES.md`
- Adjust context detection triggers if needed

---

## SUCCESS METRICS

**Qualitative:**
- Wells sounds natural when discussing GRAIN
- Users ask follow-up questions (showing interest)
- No complaints about pushy sales tactics
- Objections handled smoothly

**Quantitative:**
- 15-25% of relevant conversations mention GRAIN
- 50%+ of GRAIN mentions lead to follow-up questions
- 10%+ of GRAIN explanations lead to founding investor inquiries
- 0% complaint rate about sales tactics

---

## IF SOMETHING FEELS OFF

**Wells sounds too salesy:**
→ Add more empathy, remove hype language in system prompt

**Wells doesn't mention GRAIN enough:**
→ Expand context detection triggers

**Wells mentions GRAIN too often:**
→ Tighten context detection, add more "when NOT to mention GRAIN" examples

**Wells gives wrong information:**
→ Update factual data in system prompt (NAV, fees, terms)

**Users don't understand GRAIN:**
→ Simplify explanations, add more analogies, show more math

---

**Last Updated:** January 5, 2025
**Owner:** Wells Testing & QA
**Status:** Active Testing Protocol
