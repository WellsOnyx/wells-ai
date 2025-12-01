# Product Split Strategy: Wells AI + Grain & Vault

**Created:** December 1, 2025
**Status:** Implementation Ready

---

## Executive Summary

Wells ecosystem consists of **two distinct products** serving different markets:

1. **Wells AI** - Conversational procurement platform (Product layer)
2. **Grain & Vault** - Blockchain payment infrastructure (Infrastructure layer)

**Key Insight:** Most customers will only use Wells AI. Grain & Vault is the invisible rails that power transactions.

---

## Product Positioning

### Wells AI
**Tagline:** "Procurement that talks back"

**Positioning:**
- **What:** Conversational B2B procurement platform
- **Who:** Founders, buyers, CFOs who need to source suppliers/talent/capital
- **Why:** Talk to Wells → Get suppliers matched → Close deals faster
- **How:** AI agent that orchestrates your entire procurement workflow

**Target Customer:**
- Founders sourcing equipment/talent
- Enterprise buyers sourcing suppliers
- Procurement teams managing RFQs

**Value Prop:**
- "Find 10 customers in 10 days"
- "Hire a CTO in 2 weeks"
- "Source equipment in 48 hours"

**URL:** wellsai.com

### Grain & Vault
**Tagline:** "Payment rails for B2B commerce"

**Positioning:**
- **What:** Blockchain escrow & treasury infrastructure
- **Who:** B2B platforms, marketplaces, procurement systems
- **Why:** Enable milestone-based payments with smart contracts
- **How:** API/SDK for integrating GRAIN token + Vault escrow

**Target Customer:**
- B2B marketplace platforms
- Procurement software companies
- Enterprise treasury teams
- Fintech builders

**Value Prop:**
- "Escrow that settles in seconds, not days"
- "33bps transaction fee vs 2.9% credit card"
- "Auto-revaluing stablecoin backed by real assets"

**URL:** grainandvault.com

---

## Product Architecture

### Shared Codebase Strategy

**Single Monorepo** (current setup works):
```
/app
  /wells-ai/          → Wells AI product pages
  /grain-vault/       → Grain & Vault product pages
  /api
    /chat/            → Wells AI endpoints
    /grain/           → Grain & Vault blockchain endpoints
    /escrow/          → Grain & Vault escrow endpoints
/lib
  /blockchain/        → Shared blockchain SDK
  /ai/                → Shared AI utilities
```

**Why monorepo?**
- Wells AI uses Grain & Vault for payments
- Shared authentication (Clerk)
- Code reuse for common utilities
- Single deployment pipeline

### Domain Strategy

**Production Domains:**
- `wellsai.com` → Wells AI landing + product
- `grainandvault.com` → Grain & Vault landing + docs
- `app.wellsai.com` → Wells AI application (procurement flows)
- `vault.grainandvault.com` → Grain & Vault dashboard (treasury)

**Development:**
- `localhost:3000` → Full stack (both products)
- Path-based routing: `/wells-ai/*` and `/grain-vault/*`

---

## Landing Pages

### Wells AI Landing (wellsai.com)

**Hero Section:**
```
Procurement That Talks Back

Talk to Wells. Get suppliers matched. Close deals faster.

[Start Sourcing →]  [Watch Demo]
```

**Social Proof:**
- "50+ suppliers already sourcing"
- "$2M in deals closed"
- "48hr average quote turnaround"

**Features:**
1. **Conversational RFQs** - Tell Wells what you need in plain English
2. **Instant Matching** - AI finds the right suppliers in seconds
3. **Automated Outreach** - Suppliers get SMS alerts immediately
4. **Deal Tracking** - See quotes, negotiate, close deals in one place

**Journeys:**
- Founder: "I need a CTO" → Executive search
- Buyer: "I need equipment" → Supplier sourcing
- CFO: "I need capital" → Investor matching

**CTA:** "Talk to Wells" → Redirects to `/founder/chat` or `/chat`

### Grain & Vault Landing (grainandvault.com)

**Hero Section:**
```
Payment Rails for B2B Commerce

Smart contract escrow. USDC-backed stablecoin. 33bps fees.

[Read Docs →]  [Try API]
```

**Stats:**
- "0.33% transaction fee"
- "5-second settlement"
- "$10M+ in escrows"

**Features:**
1. **GRAIN Token** - Auto-revaluing stablecoin backed by treasury NAV
2. **Vault** - Multi-asset treasury with yield generation
3. **Escrow** - Milestone-based smart contracts with dispute resolution
4. **SDK** - Integrate payments in 3 lines of code

**Use Cases:**
- B2B Marketplaces: "Escrow for equipment purchases"
- SaaS Platforms: "Milestone payments for services"
- Supply Chain: "Pay on delivery confirmation"

**CTA:** "Get API Key" → Developer onboarding

---

## Navigation Structure

### Wells AI (app.wellsai.com)

**Top Nav:**
- Home
- Find Suppliers
- My RFQs
- Deals
- Messages
- Profile

**Journeys:**
- `/founder` - Founder-specific flows
- `/buyer` - Enterprise buyer flows
- `/seller` - Supplier dashboard
- `/chat` - Conversational interface

### Grain & Vault (vault.grainandvault.com)

**Top Nav:**
- Dashboard
- My Vault
- Escrows
- Transactions
- API Docs
- Settings

**Features:**
- `/dashboard` - NAV, collateral ratio, yield
- `/grain/deposit` - Deposit USDC → get GRAIN
- `/grain/withdraw` - Withdraw GRAIN → get USDC
- `/escrow/create` - Create new escrow
- `/escrow/[id]` - Escrow details & milestones

---

## Pricing & Monetization

### Wells AI
**Free to use. Pay when you close deals.**

- **Sourcing Fee:** 33bps (0.33%) when deal closes
- **Payment Collection:** Via Grain & Vault escrow
- **Example:** $100k deal = $330 fee

**Future:**
- Premium subscriptions for high-volume buyers
- White-label for enterprise ($5k/mo)

### Grain & Vault
**Pay per transaction.**

- **Escrow Fee:** 33bps per transaction
- **Vault Management:** Free (yield shared)
- **API Access:** Free (pay gas + transaction fees)

**Example Pricing:**
| Transaction Size | Fee (33bps) |
|-----------------|-------------|
| $10,000         | $33         |
| $100,000        | $330        |
| $1,000,000      | $3,300      |

**Enterprise:**
- Custom fee arrangements for high-volume platforms
- Dedicated infrastructure
- Priority support

---

## Brand Strategy

### Wells AI
**Personality:** Conversational, helpful, no-nonsense

**Voice:**
- "Talk to Wells. I'll handle it."
- "I found 5 suppliers. Want to see quotes?"
- "Your CTO search is live. 12 candidates matched."

**Colors:**
- Primary: Amber (#F59E0B)
- Secondary: Black (#000000)
- Accent: White (#FFFFFF)

**Imagery:**
- People talking (conversational)
- Fast-moving imagery (speed)
- B2B office environments

### Grain & Vault
**Personality:** Technical, secure, reliable

**Voice:**
- "Built on Base L2"
- "110% collateralized"
- "Audited by Trail of Bits"

**Colors:**
- Primary: Green (#10B981) - money, growth
- Secondary: Dark Gray (#1F2937)
- Accent: Blue (#3B82F6) - trust, tech

**Imagery:**
- Infrastructure (rails, pipes)
- Security (vaults, locks)
- Financial charts/data

---

## Go-to-Market

### Wells AI
**Target Segments:**
1. **Founders** - First 100 customers (vertical: equipment, talent, capital)
2. **Enterprise Buyers** - Next 1000 (verticals: manufacturing, construction, tech)
3. **Procurement Teams** - Scale to 10k (full procurement automation)

**Channels:**
- LinkedIn content (founder pain points)
- Partnerships with accelerators (Y Combinator, Techstars)
- Referral program (1 month free for referrals)

**Launch Timeline:**
- Week 1-2: Founder journey live
- Week 3-4: Buyer journey live
- Week 5-8: GTM automation running

### Grain & Vault
**Target Segments:**
1. **B2B Marketplaces** - Alibaba, ThomasNet competitors
2. **Procurement SaaS** - Coupa, Ivalua, SAP Ariba
3. **Fintech Builders** - Anyone building B2B payments

**Channels:**
- Developer relations (docs, SDKs, tutorials)
- Partnerships with B2B platforms
- Blockchain/fintech conferences

**Launch Timeline:**
- Month 1: Smart contracts audited & deployed
- Month 2: API/SDK published
- Month 3: First integration partners live

---

## Integration Flow

### How Wells AI Uses Grain & Vault

**Deal Flow:**
```
1. Buyer creates RFQ on Wells AI
2. Wells AI matches suppliers
3. Supplier submits quote
4. Buyer accepts quote
5. Wells AI creates Grain & Vault escrow
6. Buyer deposits USDC → GRAIN in escrow
7. Supplier delivers (milestones completed)
8. GRAIN released to supplier
9. 33bps fee captured by Vault
```

**Why this works:**
- Wells AI handles the product experience
- Grain & Vault handles the money movement
- Customers don't need to know about blockchain

### How External Platforms Use Grain & Vault

**API Integration:**
```typescript
import { GrainVault } from '@grainvault/sdk'

const vault = new GrainVault({ apiKey: process.env.GRAIN_API_KEY })

// Create escrow
const escrow = await vault.escrow.create({
  depositor: '0x...',
  beneficiary: '0x...',
  amount: 100000, // $100k
  milestones: [
    { description: 'Delivery', percentage: 5000 }, // 50%
    { description: 'Installation', percentage: 5000 } // 50%
  ]
})

// Fund escrow
await vault.escrow.fund(escrow.id, { token: 'USDC' })

// Complete milestone
await vault.escrow.completeMilestone(escrow.id, 0)
```

---

## Success Metrics

### Wells AI
**Product Metrics:**
- Active users (DAU, MAU)
- RFQs created per month
- Match success rate
- Quote response rate
- Deal close rate

**Business Metrics:**
- GMV (Gross Merchandise Value)
- Take rate (fees collected)
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)

**Target (Month 6):**
- 1,000 active buyers
- 500 active suppliers
- $10M GMV
- $33k monthly revenue (33bps)

### Grain & Vault
**Product Metrics:**
- Total GRAIN circulating
- NAV growth rate
- Collateral ratio
- Escrows created per month
- Average escrow size

**Business Metrics:**
- Transaction volume
- Fee revenue
- Integration partners
- API usage (calls per day)

**Target (Month 6):**
- $50M in escrows
- 10 integration partners
- $165k monthly revenue (33bps)

---

## Technical Implementation

### Phase 1: Landing Pages (This Week)
- ✅ Create Wells AI landing at `app/wells-ai/page.tsx`
- ✅ Create Grain & Vault landing at `app/grain-vault/page.tsx`
- ✅ Update routing to support both products
- ✅ Deploy to wellsai.com and grainandvault.com

### Phase 2: Navigation Split (Next Week)
- Separate navigation for each product
- Product-specific dashboards
- Cross-product linking (Wells AI → Grain for payments)

### Phase 3: Documentation (Week 3)
- Wells AI user guide
- Grain & Vault API docs
- Integration tutorials
- Video demos

### Phase 4: Marketing Sites (Week 4)
- SEO optimization
- Content marketing
- Social proof sections
- Case studies

---

## Domain Configuration

### DNS Setup

**wellsai.com:**
```
A     @         76.76.21.21        (Vercel)
CNAME www       cname.vercel-dns.com
CNAME app       cname.vercel-dns.com
```

**grainandvault.com:**
```
A     @         76.76.21.21        (Vercel)
CNAME www       cname.vercel-dns.com
CNAME vault     cname.vercel-dns.com
CNAME docs      cname.vercel-dns.com
```

### Vercel Project Setup

**Option 1: Single Project (Current)**
- Deploy to: `wellsai-github-ready.vercel.app`
- Add domains: `wellsai.com`, `grainandvault.com`
- Use path-based routing

**Option 2: Separate Projects (Future)**
- Project 1: `wells-ai` → wellsai.com
- Project 2: `grain-vault` → grainandvault.com
- Shared packages via npm workspace

---

## Open Questions

1. **Should we create separate GitHub repos?**
   - Current: Monorepo
   - Future: Could split for cleaner boundaries
   - Recommendation: Stay monorepo for now

2. **How do we handle shared authentication?**
   - Option A: Single Clerk instance, shared users
   - Option B: Separate Clerk instances, SSO
   - Recommendation: Single instance (simpler)

3. **Should Grain & Vault be open source?**
   - Smart contracts: Yes (security through transparency)
   - SDK: Yes (boost adoption)
   - API backend: No (competitive advantage)

4. **How do we price enterprise deals?**
   - Wells AI: Custom fee structures for high-volume
   - Grain & Vault: Volume discounts (e.g. 20bps for $100M+)
   - Decision: Build pricing calculator

---

## Next Steps

**Immediate (This Week):**
1. ✅ Create product split strategy doc (this file)
2. Build Wells AI landing page
3. Build Grain & Vault landing page
4. Update routing configuration
5. Deploy to production domains

**Short-term (Next 2 Weeks):**
1. Write Wells AI user documentation
2. Write Grain & Vault API documentation
3. Create integration tutorials
4. Set up analytics tracking per product

**Medium-term (Month 2-3):**
1. Onboard first 10 Wells AI customers
2. Onboard first 3 Grain & Vault integration partners
3. Launch referral program
4. Build case studies

---

**Status:** ✅ **Ready to Build**

We have clear product positioning, technical architecture, and go-to-market strategy. Time to execute.
