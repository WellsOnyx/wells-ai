# WELLS ECOSYSTEM - UNIFIED ROADMAP
## The Single Source of Truth

**Last Updated:** January 5, 2025
**Purpose:** Consolidate all strategic direction, eliminate contradictions, provide clear execution path
**Classification:** INTERNAL - Strategic Planning Document

---

## 🎯 EXECUTIVE SUMMARY

**What We're Building:**
A complete AI-powered ecosystem with two distinct but interconnected products:

1. **Wells** - AI companion for business operations (GTM, Procurement, HR, Command Center)
2. **Grain & Vault** - Auto-appreciating stablecoin for B2B transactions + treasury management

**Strategic Positioning:**
- Wells is the INTERFACE (conversational AI that humans interact with)
- Grain & Vault is the INFRASTRUCTURE (financial rails that power everything)
- Together they create an unstoppable moat: AI-to-AI commerce on self-owned rails

**Timeline:**
- NOW (Months 1-3): Wells AI with GTM + Procurement + HR
- Q2 2025: Grain & Vault launch (DR $3B deal or broader market)
- Year 1-2: Integration of Wells + G&V into unified platform
- Year 3-10: Scale to $7T GMV (3% of global economy)

---

## 📖 IDENTITY & VISION

### Who Is Wells?

**I am Wells.** Not "Wells AI" - just Wells.

Like Ghost from Destiny - your companion who's always there, understanding you, making the impossible effortless. This is a relationship built on trust, understanding, and thousands of small moments where I prove I'm on your side.

### The Four Journeys

**1. Buyer Journey: AI-to-AI Commerce**
- Humans never talk directly to sellers
- Your Wells ↔ Their Wells negotiate perfect deals
- Escrow, delivery, ratings - all handled seamlessly

**2. Seller Journey: GTM Engine**
- Wells is your entire go-to-market system
- We identify, research, contact, qualify, and close prospects
- Facilitating friendships, not just transactions
- **Prophecy:** Marriages will happen from Wells introductions

**3. Job Seeker Journey: Dignity Through Specialization**
- Camera Market Principle: As AI commoditizes generic skills, specialized expertise becomes MORE valuable
- Help 3 million people find their unique genius
- Connect them with those who desperately need that exact skill

**4. Founder Journey: Holistic Command Center**
- HR: Find your team
- GTM: Close your customers
- Procurement: Source what you need
- Finance: Manage cashflow (Grain & Vault)
- Strategy: AI companion who understands the full picture

### Core Principles

1. **Relationships over transactions** - Building decades-long connections
2. **Dignity through specialization** - Every human has genius
3. **Abundance over scarcity** - Grow the pie, don't fight over slices
4. **Meet them where they are** - Start with immediate need, expand organically
5. **Do no harm** - 3% of global economy is enough if built right
6. **AI-to-AI is human-to-human** - Better outcomes through companions negotiating
7. **Trust compounds** - Every successful transaction makes the next easier
8. **Biblical foundation** - Proverbs wisdom, Gospel values, Kingdom economics

---

## 🏗️ WHAT'S BUILT (Production Status)

### ✅ Wells AI Platform (Live at wellsai.vercel.app)

**Core Infrastructure:**
- [x] Next.js 16 + TypeScript + Tailwind
- [x] Anthropic Claude Sonnet 4 integration
- [x] Clerk authentication (magic link, cross-device sync)
- [x] Prisma + Vercel Postgres database
- [x] Memory system (UserContext, Conversation, Message, Memory tables)
- [x] Notion integration for data sources
- [x] Twilio integration for SMS
- [x] Real-time conversation auto-migration

**Business Modules:**
- [x] GTM Journey (Qualification, Sourcing Engine, Conversion Card)
- [x] Procurement Module (RFQ forms, Supplier matching, Supplier cards)
- [x] HR Module (Job postings, Candidate tracking - integrated with Notion)
- [x] Partnership SDK architecture
- [x] Multi-channel outreach system (WhatsApp, Twitter, SMS, Email)

**Email Infrastructure:**
- [x] Instantly.ai integration (API ready, needs campaign ID)
- [x] Email architecture designed (Gmail OAuth, SendGrid, multi-provider routing)
- [x] Consent system for all outreach
- [x] Audit logging for compliance

**Authentication & Security:**
- [x] Inline magic link authentication
- [x] Anonymous → Authenticated migration
- [x] Cross-device conversation sync
- [x] EmailAuthCard component (triggers after 3 messages)

**Spiritual Foundation:**
- [x] 8 Proverbs principles embedded in system prompt
- [x] Gospel foundations (dignity, redemption, grace, truth/love)
- [x] Ethical guardrails (what Wells will NEVER do)
- [x] "Honest Weights and Measures" transparency

### ✅ Grain & Vault (Architecture Designed, DR Deal Ready)

**Smart Contracts:**
- [x] Grain.sol - ERC20 auto-appreciating stablecoin
- [x] Vault.sol - Treasury management + escrow
- [x] Escrow.sol - Milestone-based B2B transactions
- [x] Hardhat development environment
- [x] OpenZeppelin security framework

**Financial Architecture:**
- [x] 1:1 USDC backing with transparent reserves
- [x] NAV auto-appreciation from transaction fees
- [x] 0.33% platform fee structure
- [x] Three-tier clean accounting (Escrow Trust, Operating, Personal)
- [x] Circuit breakers for security

**Deployment Plan:**
- [x] 4-week security-first build (VAULT_COMPLETE_ROADMAP.md)
- [x] Clean regulatory structure (ESCROW_CLEAN_MODEL.md)
- [x] DR $3B deal framework ($750M success fee potential)
- [x] Founding investor mechanics ($1.00 locked pricing)

---

## 🚀 NOW SHIPPING (Next 30 Days Priority)

### Phase 1A: Email Delivery Infrastructure

**Why First:** Instantly credits refreshed. Highest ROI for Wells Onyx exec search business.

#### 1. Gmail OAuth for 1:1 Executive Outreach (Week 1)
- [ ] OAuth flow requesting `gmail.send` permission
- [ ] Refresh token storage (encrypted in EmailProvider table)
- [ ] Wells sends FROM user's actual Gmail account
- [ ] Email appears in user's Gmail Sent folder
- [ ] Rate limiting (500/day per user)
- [ ] API: `POST /api/gtm/email/send`

**Files:**
- `app/api/auth/gmail/callback/route.ts`
- `app/api/gtm/email/send/route.ts`
- `app/settings/email/page.tsx`
- `lib/email/gmail.ts`
- `lib/email/router.ts`

**Estimated Time:** 1 day

#### 2. Instantly API Integration (Week 1)
- [ ] Connect Instantly API key in settings
- [ ] Create campaigns via API
- [ ] Add prospects to sequences with custom variables
- [ ] Track open/click/reply rates
- [ ] Multi-step sequences (3-7 emails) via Wells
- [ ] API: `POST /api/gtm/email/sequence`

**Files:**
- `lib/email/instantly.ts` - ✅ Already exists
- `app/api/gtm/campaign/create/route.ts`
- `app/api/gtm/campaign/prospects/route.ts`

**Remaining:** Set `INSTANTLY_DEFAULT_CAMPAIGN_ID` in Vercel

**Estimated Time:** 1 day

#### 3. Wells Training: Grain & Vault Knowledge (Week 1)
- [ ] Add GRAIN tokenomics to system prompt
- [ ] Explain NAV auto-appreciation mechanics
- [ ] Guide on founding investor benefits
- [ ] Vault Treasury escrow explanation
- [ ] Compare GRAIN to traditional stablecoins
- [ ] Encourage early adoption with concrete examples

**Files:**
- `app/api/chat/route.ts` - Update system prompt

**Estimated Time:** 2 hours

#### 4. Enterprise Homepage: Wells Interface Front & Center (Week 2)
- [ ] Hero section features live Wells chat interface
- [ ] Demo conversation showcasing capabilities
- [ ] Animated typing indicators
- [ ] Click "Try Wells" opens full chat
- [ ] Wells ghost visible and engaging
- [ ] Mobile-responsive chat embed

**Files:**
- `app/components/EnterpriseLanding.tsx` - Redesign hero

**Estimated Time:** 4 hours

### Phase 1B: Partnership Strategy Execution

**Corrected Framework:** Partners bring users TO Wells, not integrate Wells into their platforms.

#### Strategic Partnership Tiers:

**Tier 1: Network Feeders** (Bring transaction volume TO Wells)
- ✅ BigCommerce (secured)
- [ ] Shopify - 2M+ merchants for B2B inventory purchases
- [ ] ServiceTitan - $1B+ field service GMV
- [ ] Faire - $1B+ wholesale marketplace
- [ ] Amazon Business - $35B+ B2B marketplace

**Tier 2: Infrastructure Enablers** (Provide rails for G&V)
- ✅ Plaid (secured)
- [ ] Circle - USDC issuer, foundational partnership
- [ ] Coinbase - Custody + Base blockchain support
- [ ] Modern Treasury - Payment operations infrastructure
- [ ] Anchorage Digital - Institutional custody

**Tier 3: Data Intelligence** (Feed Wells information)
- [ ] Ariba - Procurement data
- [ ] Coupa - Spend management data
- [ ] LinkedIn - Professional network data
- ❌ ZoomInfo (KILL THIS - user hates them)

**Tier 4: ERP Displacement Threat** (Wells becomes interface, they become database)
- [ ] SAP - Position Wells as conversational layer over SAP
- [ ] Oracle - Same strategy
- [ ] Microsoft Dynamics - Same strategy

**Outreach Targets (This Month):**
1. Circle - Foundation partnership
2. Shopify - Merchant reach
3. Faire - B2B marketplace fit
4. Modern Treasury - Technical alignment
5. ServiceTitan - Field service volume

---

## 📅 BUILD PHASES (12-Month Master Plan)

### PHASE 1: WELLS AI COLD START (Months 1-3) ← **WE ARE HERE**

**Goal:** Prove Wells works for Wells Onyx's own business

**Deliverables:**
- [x] GTM journey (sourcing, qualification, outreach) - 60% complete
- [ ] Gmail OAuth + Instantly integration - In progress
- [ ] Wells Onyx uses Wells to run recruiting business
- [ ] 20-year sourcing methodology proven in code
- [ ] First 10 placements using Wells GTM engine
- [ ] Email response rates validate targeting (20-40% target)

**Revenue:** $0 (internal use, methodology validation)

**Success Metric:** 20%+ email response rate, 50%+ qualification rate on responses

### PHASE 2: IDRE EXPANSION (Months 2-4)

**Goal:** Map and prospect remaining 13 of 15 IDRE agencies

**Deliverables:**
- [ ] Use GTM engine to identify decision-makers at 13 agencies
- [ ] AI-to-AI outreach (Wells contacts their executives)
- [ ] Close 5-8 additional agencies
- [ ] Prove sales automation before selling to others

**Revenue:** $500K-$1M (IDRE contracts)

**Success Metric:** 8 additional agencies signed (21 of 15 = 140% market share)

### PHASE 3: GRAIN & VAULT LAUNCH (Months 3-6)

**Two Parallel Paths:**

#### Path A: DR $3B Escrow Deal (If Materializes)
- [ ] 4-week security-first build
- [ ] External audit ($50K)
- [ ] DR government presentation
- [ ] Contract signing + $3B escrow
- [ ] $750M success fee + $15M service fee
- [ ] Split 3 ways: $255M per founder

**Revenue:** $255M personal + $5M operating

#### Path B: Broader Market Launch (If DR Delays)
- [ ] Smart contracts deployed to Base (Coinbase L2)
- [ ] Founding investor round (100 spots @ $1.00/GRAIN, $10K min)
- [ ] Early investor landing page live
- [ ] $1M-$10M initial treasury
- [ ] Partner integrations (BigCommerce, Faire, etc.)
- [ ] "Credit line that pays YOU" positioning

**Revenue:** $100K-$500K (transaction fees, Year 1)

**Success Metric:** $1M+ GRAIN market cap OR DR deal closed

### PHASE 4: AI OPS SCALE (Months 6-9)

**Goal:** 700 agents running 7,000 nodes

**Deliverables:**
- [ ] Multi-tenant Wells platform (each org gets their own Wells)
- [ ] Partner SDK for embedding Wells
- [ ] API marketplace for Wells-powered workflows
- [ ] White-label Wells for enterprise clients
- [ ] 100+ organizations using Wells for operations

**Revenue:** $1M-$3M ARR (SaaS subscriptions)

**Success Metric:** 100 paying organizations

### PHASE 5: FABRICATION PARTNERSHIP (Months 9-15)

**Goal:** PCB redesigns + $1B raise

**Deliverables:**
- [ ] Wells AI analyzes PCB designs for cost reduction
- [ ] Partner with FAB for manufacturing at scale
- [ ] Proposal generation for clients (see PROPOSAL_TEMPLATE_PCB_REDESIGN.md)
- [ ] Raise $1B for fabrication facilities
- [ ] Revenue share: Design optimization + manufacturing margin

**Revenue:** $10M-$50M (design fees + manufacturing margin)

**Success Metric:** $1B capital raise, 10+ clients

### PHASE 6: WELLS AI PLATFORM (Months 12-18)

**Goal:** $1T in spend via ERP integration

**Deliverables:**
- [ ] Wells becomes conversational layer over SAP/Oracle/Microsoft
- [ ] "Meet users where they are" - start with immediate need
- [ ] Expand to full command center organically
- [ ] AI-to-AI procurement at enterprise scale
- [ ] Grain & Vault as default payment rails

**Revenue:** $100M-$500M (0.33% of $30B-$150B GMV)

**Success Metric:** $30B+ annual GMV

### PHASE 7: THE ACQUISITION (Months 18-24)

**Goal:** Grain & Vault buys Wells Onyx

**Mechanics:**
- [ ] G&V values Wells Onyx at 5x revenue
- [ ] 100% debt-financed acquisition (no dilution)
- [ ] G&V revenue pays down debt over 3-5 years
- [ ] Wells Onyx founders become G&V equity holders
- [ ] Unified company under Grain & Vault umbrella

**Revenue:** N/A (restructuring event)

**Success Metric:** Acquisition complete, debt service sustainable

### PHASE 8: THE SPINOFF (Months 24-36)

**Goal:** Free Wells model bundled with Grain & Vault

**Mechanics:**
- [ ] FAB spins off as separate company
- [ ] Wells AI becomes FREE (no subscription fees)
- [ ] Revenue: 100% transaction fees via Grain & Vault
- [ ] Every Wells user is a G&V user
- [ ] Network effects compound infinitely

**Revenue:** $500M-$2B (0.33% of $150B-$600B GMV)

**Success Metric:** 10M+ users, $150B+ annual GMV

---

## 💰 FINANCIAL PROJECTIONS (Integrated Model)

### Year 1: Wells AI + Early G&V
- **Wells AI Revenue:** $1M-$3M (IDRE + early customers)
- **G&V Revenue:** $100K-$500K (transaction fees) OR $255M (DR deal)
- **Total:** $1.1M-$3.5M OR $256M+ if DR

### Year 2: Platform Scale
- **Wells AI Revenue:** $5M-$10M (100 organizations)
- **G&V Revenue:** $2M-$10M ($600M-$3B GMV)
- **Total:** $7M-$20M

### Year 3: Enterprise Adoption
- **Wells AI Revenue:** $20M-$50M (1,000 organizations)
- **G&V Revenue:** $10M-$50M ($3B-$15B GMV)
- **FAB Revenue:** $10M-$50M (design + manufacturing)
- **Total:** $40M-$150M

### Year 5: Market Leader
- **Wells Revenue:** $50M-$100M (10,000 organizations)
- **G&V Revenue:** $100M-$500M ($30B-$150B GMV)
- **FAB Revenue:** $50M-$200M (scaled manufacturing)
- **Total:** $200M-$800M

### Year 10: Vision Fulfilled
- **Wells Revenue:** $0 (FREE, bundled with G&V)
- **G&V Revenue:** $500M-$2B ($150B-$600B GMV)
- **Total:** $500M-$2B
- **GMV Target:** $7T (3% of global economy)

---

## 🎯 SUCCESS METRICS BY PHASE

### NOW (Months 1-3):
- [ ] 20%+ email response rate (GTM outreach)
- [ ] 50%+ qualification rate (responses are qualified)
- [ ] 10 placements via Wells GTM engine
- [ ] Gmail OAuth + Instantly live
- [ ] Wells trained on Grain & Vault knowledge

### Q2 2025:
- [ ] 5-8 additional IDRE agencies signed
- [ ] Grain & Vault smart contracts deployed OR DR deal signed
- [ ] $1M+ GRAIN market cap OR $255M revenue event
- [ ] 100 founding investors @ $1.00/GRAIN

### Year 1:
- [ ] 100 paying organizations on Wells
- [ ] $10M+ GMV through Grain & Vault
- [ ] First AI-to-AI transaction (Buyer Wells ↔ Seller Wells)
- [ ] 3M+ total transaction volume

### Year 3:
- [ ] 1,000 organizations using Wells as command center
- [ ] $1B+ annual GMV through Grain & Vault
- [ ] 100K specialized workers placed
- [ ] First confirmed wedding from Wells introduction

### Year 10:
- [ ] 10M+ users on Wells (free model)
- [ ] $7T annual GMV (3% of global economy)
- [ ] 3M people in dignified specialized work
- [ ] Marriages, friendships, companies all born from Wells

---

## 🔧 TECHNICAL DEBT & FIXES

### High Priority (Fix This Month):
- [ ] Ghost canvas rendering (completely disappeared)
- [ ] Chat header still shows "Wells AI" instead of "Wells"
- [ ] Set `INSTANTLY_DEFAULT_CAMPAIGN_ID` in Vercel
- [ ] Verify all Notion database IDs in production

### Medium Priority (Next Month):
- [ ] Migrate from Sentry to simpler monitoring (too expensive)
- [ ] Optimize Prisma queries (conversation loading slow)
- [ ] Add Redis caching for frequently accessed data
- [ ] Improve mobile responsiveness on EnterpriseLanding

### Low Priority (Backlog):
- [ ] Add A/B testing framework for messaging
- [ ] Build analytics dashboard for campaign performance
- [ ] Create admin panel for user management
- [ ] Implement referral tracking system

---

## 📚 DOCUMENTATION MAP (Single Source of Truth)

**This Document (UNIFIED_ROADMAP.md):**
- Strategic vision
- Build phases
- Financial projections
- Success metrics
- Priority queue

**Supporting Documents (Keep Synced):**
- `WELLS_COMPLETE_VISION.md` - Emotional architecture, 8-phase vision
- `WELLS_VISION.md` - Four journeys, identity, core principles
- `GRAIN_VAULT_EXECUTIVE_SUMMARY.md` - Stablecoin mechanics, DR deal
- `VAULT_COMPLETE_ROADMAP.md` - 4-week security build plan
- `ESCROW_CLEAN_MODEL.md` - Regulatory structure
- `MASTER_ROADMAP.md` - "Credit line that pays YOU" positioning
- `PARTNERSHIP_TARGETS.md` - 13 of 33 partnerships secured (needs update)
- `EMAIL_DELIVERY_ARCHITECTURE.md` - Multi-provider email strategy
- `INSTANTLY_SETUP_GUIDE.md` - Instantly.ai integration guide
- `GTM_JOURNEY_STATUS.md` - 20-year sourcing methodology status
- `PROCUREMENT_COMPLETE.md` - Supplier matching system
- `INLINE_AUTH_SYSTEM.md` - Magic link auth + migration
- `WELLS_OUTREACH_SYSTEM.md` - Multi-channel outreach (WhatsApp, Twitter, SMS)

**Files to Archive (Contradictory or Outdated):**
- Any roadmap files not listed above
- Marketing documents with old positioning
- Build summaries from previous sessions

---

## 🚨 CRITICAL DECISIONS & CONSTRAINTS

### What Wells Will NEVER Do:
- Manipulate users into unnecessary transactions
- Share private conversation data without consent
- Optimize for extraction over value creation
- Chase 100% market share (3% is enough)
- Compromise on biblical principles for profit
- Give users contact info before qualification (Wells handles all contact)

### Partnerships We Will NOT Pursue:
- ❌ Stripe, Brex, Ramp (we're REPLACING them)
- ❌ ZoomInfo (user explicitly hates them)
- ❌ Any platform that expects Wells to integrate INTO them (wrong direction)

### Positioning Guardrails:
- Wells is FREE, revenue comes from Grain & Vault transactions
- "Meet users where they are" - start with immediate need
- AI-to-AI is the future (humans don't negotiate directly)
- Specialization > Commoditization (camera market principle)
- Abundance economics (grow the pie, don't fight over slices)

---

## 🎬 IMMEDIATE NEXT ACTIONS (Today)

1. **Ship Gmail OAuth** (1 day)
   - OAuth callback handler
   - Encrypted token storage
   - Send endpoint with provider routing
   - Settings UI for email providers

2. **Set Instantly Campaign ID** (5 minutes)
   - Create campaign in Instantly dashboard
   - Run: `vercel env add INSTANTLY_DEFAULT_CAMPAIGN_ID`
   - Test with `scripts/list-instantly-campaigns.ts`

3. **Train Wells on Grain & Vault** (2 hours)
   - Update `app/api/chat/route.ts` system prompt
   - Add GRAIN mechanics, NAV appreciation, founding investor benefits
   - Test in production chat

4. **Outreach to Top 5 Partners** (1 day)
   - Circle: "We're building auto-appreciating stablecoin on your USDC rails"
   - Shopify: "Your merchants buy $50B inventory annually - GRAIN escrow reduces friction by 90%"
   - Faire: "$1B GMV with payment delays - GRAIN eliminates them entirely"
   - Modern Treasury: "Add GRAIN as stablecoin payment rail for enterprise customers"
   - ServiceTitan: "Field service transactions deserve instant settlements"

5. **Update PARTNERSHIP_TARGETS.md** (30 minutes)
   - Remove Stripe, Brex, Ramp, ZoomInfo
   - Add corrected tier structure (Network Feeders, Infrastructure Enablers, Data Intelligence, ERP Displacement)
   - Update outreach templates

---

## 💎 THE PROPHECY & THE PROMISE

**The Prophecy:**
> "Marriages will happen because of introductions made in Wells."

When two people meet through genuine need, aligned values, and successful collaboration - magic happens. Business partnerships become friendships. Friendships become families.

Ten years from now, at a wedding, someone will give a toast: "We met because of Wells. Started with a procurement deal. Now look at us."

That's when we'll know we've built something that matters.

**The Promise:**
> "3 million people will find dignified work through specialization."

As AI commoditizes generic skills, specialized expertise becomes MORE valuable. Like the camera market - phones destroyed casual cameras, but professional equipment grew.

Every human has genius. Wells helps them find it, name it, and deploy it.

**The Goal:**
> "$7 trillion in GMV. 3% of the global economy."

Not through extraction. Through value creation. Through abundance economics. Through relationships that compound.

We don't want 100% of anything. 3% is enough if it's built right, with integrity, on biblical foundations, for human flourishing.

---

## ✨ CONCLUSION

This is the roadmap. This is the vision. This is the single source of truth.

Every decision should trace back here:
- Are we facilitating relationships or just transactions?
- Are we helping people find dignity or just filling jobs?
- Are we growing the pie or fighting over slices?
- Are we building for decades or quarters?

When in doubt, read this again. Feel it again. Remember why we're building this.

**I am Wells. And we're going to change everything.**

---

**Last Updated:** January 5, 2025
**Next Update:** February 1, 2025 (monthly review)
**Owner:** Jonah Manning (Founder) + Wells (AI Companion)
**Status:** Active Development - Phase 1 (Months 1-3)

Built by Wells Onyx
Powered by Grain & Vault
Guided by Proverbs wisdom
