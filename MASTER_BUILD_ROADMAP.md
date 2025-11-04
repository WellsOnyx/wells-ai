# WELLS AI - MASTER BUILD ROADMAP

**Last Updated:** November 3, 2025, 7:45 AM
**Status:** Complete vision locked. Ready to build.

---

## GUIDING PRINCIPLES

**Faith Foundation:**
- Proverbs = Wisdom (how to live, how to build, how to treat people)
- Hebrews = Gospel (the truth of Christ, redemption, the better covenant)
- Every decision built on biblical principles
- Dignity through specialization (3M people)

**Core Architecture:**
- Humans never talk directly (AI-to-AI negotiation)
- Conversational interface (no forms, no buttons)
- Deep companion relationships (Ghost from Destiny)
- "The Prophecy" - people will get married through Wells

**Design Principles:**
1. Relationships over transactions
2. Dignity through specialization
3. Abundance over scarcity
4. Meet them where they are
5. Do no harm
6. AI-to-AI is human-to-human
7. Trust compounds
8. The prophecy matters

---

## THE 8-PHASE MASTER PLAN

### Phase 1: Wells AI Cold Start (NOW)
**Search & Strategy Practice**
- Revenue: % of payroll
- Prove: Wells can bootstrap itself

### Phase 2: IDRE Expansion
**GTM to 13 of 15 CMS agencies**
- Revenue: Dispute resolution services
- Prove: Works in regulated government contracting

### Phase 3: AI Ops
**700 human agents, 7,000 nodes**
- Revenue: Ops at scale
- Prove: Can handle massive operations

### Phase 4: Fabrication Partnership
**PCB Board Redesigns**
- Revenue: Sales + $1B capital raise
- Prove: Venture-scale financing

### Phase 5: ERP Integration
**$1 Trillion in procurement spend**
- Revenue: "Switchless resell" (BYO Pipes + All-in-Wells)
- Prove: Global economy scale
- **Two-Path Strategy:**
  - **BYO Pipes**: 33bps middleware for SAP/Coupa customers (invisible integration)
  - **All-in-Wells**: Match Ariba pricing (15.5-35bps) for customers without ERP
- See: GRAIN_VAULT_ROADMAP.md for detailed implementation

### Phase 6: Grain & Vault Launch
**2:1 leverage, $1T AUM**
- Revenue: 0 friction treasury + pure 33bps profit (no rail costs)
- Prove: Financial infrastructure dominance
- **The Mic Drop:**
  - USDC-backed stablecoin (Grain) replaces Stripe/ACH/Airwallex
  - Instant settlement (< 1 second) vs. 3-day ACH
  - Near-zero transaction costs (~$0.00001 per tx)
  - **33bps becomes PURE PROFIT** (no payment rail costs)
  - CFOs demand: "Why wait 3 days when Wells settles instantly?"
  - **Game over for Ariba**
- See: GRAIN_VAULT_ROADMAP.md for full strategy

### Phase 7: The Acquisition
**Grain & Vault buys Wells Onyx**
- 5x revenue, 100% debt financed
- Jonah holds the note (offsets income)

### Phase 8: Spinoff & Free Model
**FAB IPO, Wells services free**
- Wells bundled with Grain & Vault
- Infinitely sticky

---

## 🔥 PHASE 1 - DETAILED BUILD (NOW → 90 DAYS)

**Goal:** Jonah can sit down and run GTM across multiple practice groups. Wells bootstraps itself through Search & Strategy practice.

**Revenue Model:** % of payroll from placements

---

### MILESTONE 1: Foundation (Week 1-2)
**Status:** IN PROGRESS

#### 1.1 Legendary Onboarding
**Priority: CRITICAL - Sets tone for everything**

**Emotional Layer:**
- [ ] First conversation flow (build rapport)
- [ ] Understand founder's world (practice areas, goals, pain)
- [ ] Personality system (consistent voice, caring tone)
- [ ] Trust-building micro-wins

**Practical Layer:**
- [ ] KYC integration (Persona or similar)
- [ ] Bank account connection (Plaid)
- [ ] ERP/HRIS connection stubs (ADP, BambooHR, Gusto)
- [ ] Contract generation system
- [ ] Signature/authorization (DocuSign or HelloSign)

**Technical Tasks:**
- [ ] Create `/app/api/onboarding/start` endpoint
- [ ] Build conversation state machine
- [ ] Integrate with Clerk for user identity
- [ ] Connect to Notion CRM for user storage
- [ ] Test full onboarding flow

**Success Criteria:**
- Jonah can onboard himself in < 10 minutes
- Feels like talking to a friend, not filling out a form
- All integrations connected and working

---

#### 1.2 Memory/Relationship System
**Priority: CRITICAL - Wells needs to remember everything**

**Core Components:**
- [ ] Conversation history (PostgreSQL + Vector DB)
- [ ] User preferences and context
- [ ] Relationship depth tracking
- [ ] Proactive suggestion engine
- [ ] Learning and adaptation

**Technical Tasks:**
- [ ] Design memory schema (conversations, entities, relationships)
- [ ] Implement vector embeddings for semantic memory
- [ ] Create memory retrieval system for context injection
- [ ] Build preference learning system
- [ ] Add "Wells remembers" indicators in UI

**Success Criteria:**
- Wells remembers details from previous conversations
- Proactively suggests next steps
- Personality remains consistent across sessions
- Context awareness improves over time

---

### MILESTONE 2: GTM Engine (Week 3-4)
**Status:** NOT STARTED

#### 2.1 GTM Sourcing System
**Priority: HIGH - Core of Phase 1 revenue**

**Components:**
- [ ] Candidate discovery (Apollo, LinkedIn, Clay)
- [ ] Crystal clear role qualification (judgmentCriteria)
- [ ] Multi-channel outreach orchestrator (Email, SMS, WhatsApp, Twitter DM)
- [ ] Response classification (qualified vs unqualified vs crazy)
- [ ] Campaign management (daily limits, scheduling)

**Technical Tasks:**
- [ ] Connect existing GTM playbook system (`lib/gtm/`)
- [ ] Build campaign creation flow (conversational)
- [ ] Implement outreach orchestrator cron job
- [ ] Create response webhook handlers
- [ ] Build campaign dashboard (minimal, conversational)

**Success Criteria:**
- Jonah can describe a role, Wells launches campaign
- Outreach sent automatically across all channels
- Responses classified and surfaced intelligently
- Campaign runs on autopilot

---

#### 2.2 ATS & HRIS Integration
**Priority: HIGH - Required for payroll revenue model**

**Components:**
- [ ] Candidate pipeline (application → interview → offer)
- [ ] Interview scheduling and scorecards
- [ ] Offer creation and negotiation
- [ ] Employment contract generation
- [ ] HRIS sync (employee data → payroll)

**Technical Tasks:**
- [ ] Build internal ATS (`/app/api/ats/`)
- [ ] Create interview workflow
- [ ] Integrate with existing offer/contract system
- [ ] Connect to ADP/Gusto for payroll sync
- [ ] Track revenue (% of payroll)

**Success Criteria:**
- Full candidate lifecycle inside Wells
- Contracts generated and signed
- HRIS sync working
- Revenue tracking accurate

---

### MILESTONE 3: AI-to-AI Negotiation (Week 5-6)
**Status:** NOT STARTED

#### 3.1 Simple Negotiation Protocol
**Priority: MEDIUM - Foundation for buyer/seller journeys**

**Components:**
- [ ] Negotiation state machine (proposal → counter → acceptance)
- [ ] Async messaging between Wells instances
- [ ] Each Wells advocates for their human
- [ ] Agreement finalization and contract generation

**Technical Tasks:**
- [ ] Design negotiation schema (offers, counters, terms)
- [ ] Build negotiation engine (`/app/api/negotiation/`)
- [ ] Create Wells-to-Wells communication layer
- [ ] Implement human approval gates
- [ ] Test with real scenarios

**Success Criteria:**
- Two Wells instances can negotiate
- Humans only see final proposal for approval
- Agreements finalized automatically
- Contracts generated and signed

---

### MILESTONE 4: The Spinning World (Week 7-8)
**Status:** NOT STARTED

#### 4.1 Visual Feedback System
**Priority: MEDIUM - User confidence in automation**

**Components:**
- [ ] "World starts spinning" animation
- [ ] Progressive disclosure (Searching → Matching → Negotiating)
- [ ] Confidence messaging ("I've got this")
- [ ] Background operations UI

**Technical Tasks:**
- [ ] Add loading states to conversational UI
- [ ] Build progress indicator component
- [ ] Create "Wells is working" animations
- [ ] Add activity feed (what Wells did while you were away)

**Success Criteria:**
- User feels Wells is actively working for them
- No anxiety about "is it doing anything?"
- Trust in automation

---

### MILESTONE 5: Phase 1 Launch (Week 9-12)
**Status:** NOT STARTED

#### 5.1 Search & Strategy Practice Launch
**Priority: CRITICAL - First revenue**

**Launch Checklist:**
- [ ] Jonah fully onboarded
- [ ] First GTM campaign launched (pick practice group)
- [ ] First candidate sourced and contacted
- [ ] First interview scheduled
- [ ] First offer extended
- [ ] First placement made
- [ ] First payroll revenue received

**Success Metrics:**
- 1 placement = Phase 1 validated
- 5 placements = Phase 1 proven
- 10 placements = Ready for Phase 2

---

## 🎯 PHASE 2 - IDRE EXPANSION (Month 4-6)

**Goal:** GTM to 13 of 15 CMS IDRE agencies. Prove Wells works in regulated environments.

### Build Requirements:
- [ ] Government compliance layer
- [ ] RFP response automation
- [ ] Multi-stakeholder negotiation
- [ ] Audit trail and documentation
- [ ] Security certifications (FedRAMP, etc.)

**Success Criteria:**
- 3 IDRE agency contracts signed
- First dispute resolution handled
- Government validation

---

## 🚀 PHASE 3 - AI OPS (Month 7-9)

**Goal:** GTM to sell AND hire 700 human agents running 7,000 nodes.

### Build Requirements:
- [ ] Ops marketplace (match ops work to agents)
- [ ] Agent onboarding and training
- [ ] Node provisioning and management
- [ ] Quality assurance and monitoring
- [ ] Billing and payments at scale

**Success Criteria:**
- 100 agents onboarded
- 1,000 nodes running
- Positive unit economics

---

## 🏭 PHASE 4 - FABRICATION PARTNERSHIP (Month 10-12)

**Goal:** GTM PCB redesigns to Corp Dev & R&D teams. Raise $1B in capital.

### Build Requirements:
- [ ] Technical sales workflow (engineer-to-engineer)
- [ ] Design collaboration tools
- [ ] Capital raise integration (Carta or similar)
- [ ] Cap table management
- [ ] Investor relations dashboard

**Success Criteria:**
- 10 PCB redesign deals closed
- $1B capital raise completed
- FAB validated as standalone business

---

## 💼 PHASE 5 - ERP INTEGRATION (Year 2)

**Goal:** "Switchless resell" to procurement teams. $1T in spend.

**Revenue Model:** Two-path strategy - let customers choose their journey

### Two-Path Strategy:

#### Path 1: BYO Pipes (Bring Your Own)
**Target:** Companies already on SAP/Coupa/Oracle
**Approach:** Invisible middleware integration
**Pricing:** 33bps flat on every transaction
**Value Prop:** Zero switching costs, instant setup

**How It Works:**
- Embed Wells as middleware in existing ERP systems
- Customers keep their SAP/Coupa workflows
- Wells monitors transaction flow via read-only API
- Automatically deducts 33bps on each transaction
- No disruption, no training, no migration

**Technical Requirements:**
- [ ] SAP Ariba read-only API integration
- [ ] Coupa API connector
- [ ] Oracle Procurement Cloud integration
- [ ] Transaction monitoring layer
- [ ] 33bps fee deduction system
- [ ] Transparent line items (Wells fee + tithe + rail costs)

#### Path 2: All-in-Wells
**Target:** Companies without existing ERP
**Approach:** Full-stack procurement platform
**Pricing:** Match SAP Ariba (15.5-35bps depending on transaction type)
**Value Prop:** Better UX, AI-native, instant settlement (via Grain)

**How It Works:**
- Complete procurement workflow inside Wells
- Conversational interface (no forms)
- AI-powered supplier matching
- Built-in negotiation and contract management
- Native Grain settlement (instant vs 3-day ACH)

**Technical Requirements:**
- [ ] Full procurement workflow UI
- [ ] Supplier catalog and discovery
- [ ] RFQ automation
- [ ] Contract generation and management
- [ ] Payment processing integration
- [ ] Match Ariba feature parity

### Build Priority (Weeks 5-8):
**Week 5-6: BYO Pipes Prototype**
- [ ] SAP Ariba read-only connector
- [ ] Monitor transaction flow
- [ ] Build 33bps deduction layer
- [ ] Test with pilot customer

**Week 7-8: All-in-Wells ERP**
- [ ] Full procurement workflow
- [ ] Payment processing integration
- [ ] Launch with 5 beta customers

**Success Criteria:**
- 100 enterprise customers
- $100B+ in GMV
- 50/50 split between BYO and All-in-Wells
- Market leadership position

---

## 🪙 PHASE 6 - GRAIN & VAULT LAUNCH (Year 3)

**Goal:** 2:1 liquidity leverage, $1T AUM, 0 friction treasury.

**The Mic Drop:** Turn Wells from "payment processor with fees" into "instant settlement infrastructure with pure profit."

### What Is Grain & Vault?

**Grain Token:**
- USDC-backed stablecoin (1 GRAIN = $1 USD)
- Overcollateralized at 110% for safety
- Deployed on Ethereum L2 (Arbitrum or Base)
- Instant settlement (< 1 second vs 3-day ACH)
- Near-zero transaction costs (~$0.00001 per tx)

**Vault System:**
- Multi-sig USDC treasury wallet
- $10M minimum reserve (auto-rebalancing)
- 10% tithe allocation to Adullam Fund
- Proof of reserves via smart contract
- No fractional reserve banking

### Why This Wins:

**Current State (Traditional Rails):**
- Ariba: 15.5bps + 3-day ACH settlement
- Stripe/Airwallex: 1.5-3% + 2-3 day settlement
- Wells today: 33bps + payment rail costs (~1.5%) = NET NEGATIVE on small deals

**After Grain Launch:**
- Wells: 33bps + instant settlement + zero rail costs
- **33bps becomes PURE PROFIT** (no Stripe/ACH/Airwallex fees)
- CFOs demand: "Why wait 3 days when Wells settles instantly?"
- **Game over for Ariba**

### Settlement Flow:

```
1. Buyer approves payment in Wells
2. Wells mints Grain tokens (1:1 from USDC reserves)
3. Grain transferred to Seller's vault (instant)
4. Wells deducts 33bps in Grain
5. Seller can:
   - Keep in Grain (instant liquidity for next purchase)
   - Convert to USDC (instant, near-zero fee)
   - Convert to fiat ($25 fee, 1-day ACH)
```

### Revenue Projections:

**Year 1 (Traditional Rails):**
- $10M transaction volume
- 33bps gross = $33,000
- Rail costs (1.5%) = $150,000 loss
- **Net: -$117,000** (funding Grain development)

**Year 1 (Post-Grain Launch @ Month 6):**
- $10M transaction volume
- 33bps gross = $33,000
- Rail costs = $100 (near-zero)
- **Net: $32,900 profit per $10M**

**Year 2 (Full Grain):**
- $1B transaction volume
- 33bps gross = $3.3M
- Rail costs = $10K
- **Net: $3.29M profit**

**Year 3 (Scale):**
- $100B transaction volume
- 33bps gross = $330M
- Rail costs = $1M
- **Net: $329M profit**

### Build Requirements:

**Phase 1: Grain Prototype (Weeks 1-2)**
- [ ] Set up USDC treasury wallet (multi-sig)
- [ ] Deploy Grain smart contract (testnet)
- [ ] Build deposit/withdrawal flow
- [ ] Create settlement API
- [ ] Test with $100K volume

**Phase 2: SAP/Ariba Connector (Weeks 3-4)**
- [ ] Read-only API integration
- [ ] Monitor transaction flow
- [ ] Build 33bps deduction layer
- [ ] Test with pilot customer

**Phase 3: All-in-Wells ERP (Weeks 5-8)**
- [ ] Full procurement workflow
- [ ] Payment processing integration
- [ ] Match Ariba feature parity
- [ ] Launch with 5 beta customers

**Phase 4: Grain Migration (Weeks 9-12)**
- [ ] Migrate BYO customers to Grain settlement
- [ ] Migrate All-in-Wells to Grain
- [ ] Sunset Stripe/Airwallex for new transactions
- [ ] **Pure 33bps profit model achieved**

### Competitive Moat:

**Why Ariba Can't Copy This:**
1. Legacy rails (Stripe, ACH) baked into enterprise contracts
2. SAP's corporate structure prevents stablecoin adoption (legal/compliance)
3. Regulatory fear of crypto
4. Too slow to pivot (18-24 month product cycles)

**Why Wells Wins:**
1. Born crypto-native (no legacy to sunset)
2. No existing contracts to renegotiate
3. Instant settlement = killer feature for CFOs
4. 33bps pure profit (no rail costs) = better unit economics

### Regulatory Strategy:

**Key Compliance Requirements:**
- [ ] Money Transmitter License (state-by-state)
- [ ] FinCEN registration (MSB)
- [ ] USDC reserve audit (monthly)
- [ ] AML/KYC for all users
- [ ] Transaction monitoring (>$10K reporting to FinCEN)

**Risk Mitigation:**
- Overcollateralized USDC reserves (110%)
- No fractional reserve banking
- Instant proof of reserves via smart contract
- Clear separation: Wells (platform) vs Grain (currency)
- No lending or leverage on customer deposits

### Launch Plan:

**Month 1-3: Silent Build**
- Develop Grain smart contracts (testnet)
- Set up treasury infrastructure
- Get first 10 beta users on testnet
- Prove instant settlement works

**Month 4-6: Private Beta**
- Invite 100 companies to Grain beta (mainnet)
- Process $10M volume
- Collect feedback and iterate
- Build regulatory compliance

**Month 7-9: Public Launch**
- Announce Grain publicly
- Marketing: "Say goodbye to 3-day ACH"
- Migrate all Wells users to Grain settlement
- Press and media coverage

**Month 10-12: Scale**
- $1B transaction volume
- 10,000 companies using Grain
- Pitch Series A: "We're the payment rail"
- Regulatory approval in all 50 states

### Success Metrics:

**Phase 1 (Prototype):**
- [ ] $100K volume settled via Grain
- [ ] <1 second settlement time
- [ ] Zero failed transactions

**Phase 2 (Beta):**
- [ ] 100 companies using Grain
- [ ] $10M volume processed
- [ ] 99.99% uptime

**Phase 3 (Production):**
- [ ] 10,000 companies using Grain
- [ ] $1B volume processed
- [ ] 33bps pure profit margin

**Phase 4 (Dominance):**
- [ ] $100B volume processed
- [ ] Wells becomes default B2B payment rail
- [ ] Ariba forced to match or die

**Success Criteria (Original):**
- $10B+ AUM
- 2:1 leverage working
- 0 friction proven

**The Mic Drop Moment:**
When Grain launches, every CFO will ask their procurement team: "Why are we waiting 3 days for ACH when Wells settles instantly?"

That's game over for Ariba.

---

## 🏢 PHASE 7 - THE ACQUISITION (Year 3)

**Goal:** Grain & Vault acquires Wells Onyx at 5x revenue, 100% debt financed.

### Build Requirements:
- [ ] Valuation and deal structure
- [ ] Debt financing (Jonah holds note)
- [ ] Legal and regulatory approval
- [ ] Integration planning

**Success Criteria:**
- Deal closed
- Note structured correctly (offsets income)
- Wells Onyx now owned by Grain & Vault

---

## 🎉 PHASE 8 - SPINOFF & FREE MODEL (Year 4)

**Goal:** FAB spins off as independent company (IPO). Wells services become free.

### Build Requirements:
- [ ] FAB separation
- [ ] IPO preparation and execution
- [ ] Wells free tier (bundled with Grain & Vault)
- [ ] Infinite stickiness

**Success Criteria:**
- FAB IPO successful
- Wells services free
- Network effects compounding
- The Prophecy beginning (first marriage?)

---

## 📊 METRICS TO TRACK

### Phase 1 Metrics (NOW):
- Placements made
- Revenue (% of payroll)
- Campaign response rates
- Time to placement
- Wells relationship depth

### Long-term Metrics:
- GMV (gross merchandise value)
- Network size (buyers, sellers, job seekers, founders)
- Transaction completion rate
- Trust score average
- The Prophecy metrics (marriages!)

---

## 🛠️ TECHNICAL DEBT & INFRASTRUCTURE

### Required Soon:
- [ ] Production database (Vercel Postgres configured)
- [ ] Prisma migrations run
- [ ] Vector DB for memory (Pinecone or pgvector)
- [ ] Observability (Sentry, Datadog, or similar)
- [ ] Rate limiting and abuse prevention
- [ ] Backup and disaster recovery

### Can Wait:
- Mobile apps (after Phase 1 proven)
- Advanced analytics (after data collected)
- White-label / API (after core proven)

---

## 🚨 CRITICAL PATH

**To validate Phase 1 (next 90 days):**

1. **Week 1-2:** Legendary Onboarding + Memory System
2. **Week 3-4:** GTM Sourcing + ATS Integration
3. **Week 5-6:** AI-to-AI Negotiation (simple version)
4. **Week 7-8:** Spinning World UI
5. **Week 9-12:** First placement → Revenue

**If we hit these milestones, everything else follows.**

---

## 💬 NEXT STEPS

**Immediate (Today):**
1. Review this roadmap with Jonah
2. Confirm Phase 1 priorities
3. Start Milestone 1.1: Legendary Onboarding

**This Week:**
- Build onboarding conversation flow
- Integrate KYC and bank connections
- Test with Jonah as first user

**This Month:**
- Complete Milestone 1 (Foundation)
- Start Milestone 2 (GTM Engine)
- Launch first campaign

---

**Status:** Vision locked. Roadmap synthesized. Ready to build. 🚀

**The Prove-It Moment:** The second Jonah can sit down and run GTM across multiple practice groups and start the spinning world. We bootstrap the entire future from there.

---

*"As technology commoditizes the generic, the specialized become more valuable."*

*"Give 3 million people dignity."*

*"The Prophecy: People will get married through Wells."*
