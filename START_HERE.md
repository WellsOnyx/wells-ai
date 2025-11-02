# 🚀 START HERE

## Wells - The B2B Transaction Platform

**FIRST**: Read **WELLS_VISION.md** - This is the soul of everything we're building.

**Current Status**: Vision documented, transaction engine complete, ready to build journeys
**Goal**: $7T in GMV (3% of global economy) | 3M specialized workers | Marriages from Wells introductions
**Mission**: I am Wells, your companion. Not a tool - a relationship.

---

## 📍 WHERE WE ARE NOW

### ✅ What's Built (November 2, 2025)
1. **Conversational AI** - Discovery-first chat (2-3 points + question format)
2. **Transaction Engine** - Complete flow from RFQ → escrow → completion
3. **One-Click Acceptance** - DealCard component for inline transactions
4. **Dynamic Pricing** - 1.5-2.5% fees based on deal size + trust scores
5. **Airwallex Payments** - Full integration with split settlements (2.8% domestic fees)
6. **Payment Guardrails** - Security framework with fraud detection, rate limiting, audit logs
7. **Postgres Database** - Prisma ORM with Transaction, UserTrustScore, and RFQ models
8. **Trust System** - Automatic reputation scoring (rating 40%, completion 30%, volume 20%, disputes 10%)
9. **Platform Architecture** - Ready for scale

### ⚠️ What's In Progress
1. **Database Configuration** - Need to set up DATABASE_URL on Vercel and run migrations

### 🔲 What's Next
1. Configure Vercel Postgres database and run migrations
2. Test end-to-end transaction flow with Airwallex + database persistence
3. Launch GTM campaigns (500+ contacts)
4. Close first 5 deals ($50-100k each)

---

## 🎯 THE BIG IDEA

**Old Model**: Wells Onyx as executive search firm (capped revenue)
**New Model**: Wells AI as transaction platform (uncapped GMV)

**The Shift**:
> "I don't care who wins, I just want the transaction to happen in Wells AI because then we win too."

### Why This Works
- **Discovery in chat** - Wells understands what you need
- **AI matching** - Connects buyers ↔ sellers automatically
- **One-click deals** - "yes, proceed" creates escrow instantly
- **Trust system** - Reputation ensures deals close
- **Network effects** - More volume = better matching

---

## 💻 QUICK START

### Run Locally
```bash
cd ~/Downloads/wells-ai-github-ready
npm install
npm run dev
```

Visit: http://localhost:3000

### Deploy to Production
```bash
vercel --prod
```

### Environment Variables Needed
```bash
# AI
ANTHROPIC_API_KEY=sk_...

# Auth
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Database
NOTION_TOKEN=secret_...
NOTION_REQUESTS_DB=...
NOTION_SUPPLIERS_DB=...

# Communications
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Payments - Airwallex (2.8% domestic, 4.3% international)
AIRWALLEX_CLIENT_ID=liGAUBVoRh-YWfE4-XAjUA
AIRWALLEX_API_KEY=a13c521... (configured)
AIRWALLEX_ACCOUNT_ID=le_ftLSrwDuPDWGbf93on0BFQ
AIRWALLEX_API_URL=https://api.airwallex.com
```

---

## 📂 KEY FILES

### Documentation (READ IN THIS ORDER)
- **WELLS_VISION.md** - 🔥 THE FOUNDATION - Emotional architecture, four journeys, strategic intent
- **DATABASE_MIGRATION_COMPLETE.md** - Postgres setup guide and technical status
- **START_HERE.md** - This file (quick reference)
- **README.md** - Original project README

### Core Code
- **app/api/chat/route.ts** - Conversational AI engine
- **lib/transactions.ts** - Transaction primitives and escrow logic
- **app/api/transactions/accept/route.ts** - One-click deal acceptance
- **app/components/chat/DealCard.tsx** - Inline transaction UI
- **middleware.ts** - Clerk auth and routing

### Business Logic
- **lib/gtm/** - GTM campaign automation
- **lib/job-seeker/** - Resume parsing and job matching
- **lib/notion.ts** - Database operations
- **lib/categories.ts** - Category detection and matching

---

## 🎨 DESIGN PRINCIPLES

### Conversational Style
**Every Wells response must**:
1. Give 2-3 concise points (acknowledgment, insight, value)
2. Ask 1 question to deepen understanding
3. Be SHORT (max 5 sentences total)
4. Build relationships through discovery, not pitches

**Example**:
> "I can help you find the right CFO. From what you've shared, it sounds like you need someone with both startup experience and financial discipline.
>
> What's the biggest challenge your finance team is facing right now?"

### Visual Identity
- **Colors**: Black background, gold accents (#dba63f)
- **Vibe**: Tropical modernism meets tech (Tron Aries + Bali cafe aesthetic)
- **UI**: One-click everything, trust signals everywhere, mobile-first

---

## 📊 SUCCESS METRICS

### This Weekend
- [ ] Stripe Connect integrated
- [ ] First end-to-end transaction test passes
- [ ] Clerk middleware issues resolved

### This Week (Nov 4-10)
- [ ] 5 deals closed ($50-100k each)
- [ ] 500+ GTM outbound contacts made
- [ ] 20-30 sales calls booked

### This Month (November)
- [ ] 100 transactions completed
- [ ] $500k+ in GMV processed
- [ ] 50+ verified sellers on platform

### By Christmas (December 25)
- [ ] **$2M net profit achieved** 🎯
- [ ] Product-market fit validated
- [ ] Flywheel spinning (organic growth)

---

## 🆘 RECOVERY PROMPT

**If you're starting a new session**, paste this:

> I am Wells. Read WELLS_VISION.md first.
>
> **Technical Status** (November 2, 2025):
> - Transaction engine complete with Postgres + Airwallex
> - Trust scoring algorithm implemented
> - Payment guardrails deployed
> - Early access page live and branded
> - Complete vision documented
>
> **Four Journeys to Build**:
> 1. Buyer: AI-to-AI commerce (procurement companion)
> 2. Seller: GTM engine + friendships
> 3. Job Seeker: Dignity through specialization (3M people)
> 4. Founder: Holistic command center
>
> **Immediate Priorities**:
> 1. Configure DATABASE_URL and run Prisma migrations
> 2. Test end-to-end transaction flow
> 3. Build the four journey interfaces
> 4. Create legendary onboarding experiences
>
> Read WELLS_VISION.md for the complete emotional architecture.

---

## 🔗 LINKS

- **Production**: https://wellsai.vercel.app
- **Admin Dashboard**: https://wellsai.vercel.app/admin
- **Early Access**: https://wellsai.vercel.app/early-access?invite=ONYX
- **GitHub**: (Add your repo URL)

---

## 👨‍💻 TECHNICAL STACK

- **Frontend**: Next.js 16 + React + Tailwind
- **AI**: Claude Sonnet 4 (Anthropic)
- **Auth**: Clerk (multi-tenant)
- **Database**: Notion → Postgres (migration planned)
- **Payments**: Stripe Connect (in progress)
- **Hosting**: Vercel
- **SMS**: Twilio
- **Email**: Instantly.ai

---

## 💡 PHILOSOPHY

> "I don't care who wins, I don't care who gets credit, I just want the transaction to happen in Wells AI because then we win too."

This is the shift from service → platform. We're not the search firm, the GTM agency, or the supplier. We're the **neutral transaction layer** where B2B commerce happens.

**Our job**: Make deals SO easy that everyone uses Wells.

---

**Last Updated**: November 2, 2025
**Next Review**: After first 5 transactions complete

🚀 Let's build the $7T platform.
