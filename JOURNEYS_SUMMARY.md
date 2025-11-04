# Wells AI - Four Journeys Implementation

**Last Updated:** November 4, 2025
**Status:** All journeys have backend APIs ready. Frontend unified via Founder Journey.

---

## Overview

Wells AI supports **four distinct user journeys**, each with specialized features and workflows. All journeys are accessible through the **Founder Journey** command center at `/founder`.

---

## 🎯 1. SELLER JOURNEY (GTM)

**Route:** `/gtm`
**Purpose:** Sales and business development
**For:** Founders, sales teams, business developers

### Capabilities:

✅ **Campaign Builder** - Conversational GTM campaign creation
- Define target ICP (industry, role, company size)
- AI-generated outreach messages
- Multi-channel orchestration (email, LinkedIn, SMS when Twilio approved)
- Preview and approve before launch

✅ **Prospect Discovery** - Find and qualify leads
- Apollo integration for contact data
- LinkedIn prospecting
- ICP analysis and suggestions
- Automated qualification

✅ **Pipeline Management** - Track and close deals
- Deal stages and progression
- Meeting booking automation
- Proposal generation
- Close tracking with revenue attribution

✅ **Outreach Automation** - Set it and forget it
- Instantly.ai email integration
- Pending approval queue
- Response classification
- Auto-follow-ups

### Key APIs:
- `/api/gtm/discover` - Discover prospects
- `/api/gtm/preview` - Preview campaign messages
- `/api/gtm/launch` - Launch campaign
- `/api/gtm/outreach/*` - Manage outreach
- `/api/gtm/deals/*` - Manage deal flow
- `/api/gtm/campaign/*` - Campaign CRUD
- `/api/gtm/automation/*` - Automation runners

### Status: **INFRASTRUCTURE COMPLETE** ⚠️
- Backend complete with full email infrastructure
- Frontend exists at `/gtm`
- Email ready (needs Instantly.ai campaign setup - see `INSTANTLY_SETUP_GUIDE.md`)
- LinkedIn automation ready (Dripify + Zapier when configured)
- SMS blocked until Twilio A2P approval

---

## 👥 2. HIRING JOURNEY (Job Seekers + ATS)

**Routes:** `/hr`, `/job-seeker`
**Purpose:** Talent acquisition and candidate management
**For:** Founders, HR teams, job seekers

### Capabilities:

✅ **For Employers (Founders):**
- Job posting creation
- Candidate sourcing
- ATS integration (connect existing systems)
- Interview scheduling
- Offer generation and tracking
- Employment contract creation
- HRIS sync for payroll tracking

✅ **For Job Seekers:**
- Resume parsing and optimization
- Skill matching and recommendations
- Job application management
- Interview preparation
- Specialization discovery (help people find their "genius zone")
- Portfolio building

### Key APIs:

**Employer Side:**
- `/api/ats/jobs` - Job posting management
- `/api/ats/applications` - Application tracking
- `/api/ats/connect` - Connect external ATS
- `/api/ats/sync` - Sync candidate data
- `/api/hr/create-employment` - Employment contracts

**Job Seeker Side:**
- `/api/job-seeker/profile` - Profile management
- `/api/job-seeker/resume-parse` - Parse uploaded resumes
- `/api/job-seeker/resume-optimize` - AI-powered optimization
- `/api/job-seeker/match` - Match to opportunities
- `/api/job-seeker/apply` - One-click application

### Status: **FULLY FUNCTIONAL** ✅
- Backend complete
- Frontend pages exist (`/hr`, `/job-seeker`)
- Resume parsing works
- Matching algorithm ready
- Contract generation working

---

## 🛒 3. BUYER JOURNEY (Procurement)

**Route:** `/app`
**Purpose:** Procurement, sourcing, and supplier management
**For:** Founders, procurement teams, operations

### Capabilities:

✅ **Conversational Procurement** - No forms, just chat
- Describe what you need in natural language
- Wells asks clarifying questions
- Automatically creates RFQ

✅ **Supplier Matching** - Find the right vendors
- Match based on category, location, certifications
- Priority scoring (existing relationships ranked higher)
- Background supplier discovery (adds new options invisibly)

✅ **Real-Time Quoting** - Get quotes fast
- Ping suppliers via SMS/email
- Async response collection
- Quote comparison and analysis
- Negotiation tracking

✅ **Deal Management** - Close procurement deals
- Contract generation
- Payment processing integration
- Transaction tracking in Notion
- Pricing engine (33bps default, 3.3% sourced, 10% originated)

### Key APIs:
- `/api/rfqs` - RFQ creation and management
- `/api/suppliers/match` - Find matching suppliers
- `/api/suppliers/notify` - Notify suppliers of opportunities
- `/api/webhooks/sms` - Handle supplier SMS responses
- `/api/webhooks/supplier-response` - Process quotes
- `/api/chat` - Conversational procurement interface

### Status: **FULLY FUNCTIONAL** ✅
- Backend complete
- Frontend exists at `/app`
- Supplier matching works
- Notion integration complete
- SMS notifications blocked until Twilio A2P approval
- Email notifications work as alternative

---

## 👑 4. FOUNDER JOURNEY (Command Center)

**Route:** `/founder`
**Purpose:** Holistic view across all journeys
**For:** Founders, executives

### Capabilities:

✅ **Overview Dashboard** - See everything at a glance
- Key metrics across all areas (revenue, campaigns, hiring, RFQs)
- Unified activity feed
- Wells Insights (proactive AI suggestions)
- Quick links to all journeys

✅ **Journey Switcher** - Seamless context switching
- Tab navigation between GTM, Hiring, Procurement, Finance
- Maintain state and context
- Unified notifications

✅ **Cross-Journey Intelligence** - Wells connects the dots
- "Your PCB supplier also needs engineers - want me to introduce them?"
- "This candidate worked at a company you're targeting for GTM"
- "Your best performing GTM persona matches your ideal hire profile"

### Key Features:
- **Overview Panel** - Metrics, activity feed, Wells insights
- **GTM Panel** - Campaign performance and pipeline
- **Hiring Panel** - Open positions and candidate pipeline
- **Procurement Panel** - Active RFQs and deals
- **Finance Panel** - Revenue tracking and analytics

### Status: **JUST BUILT** ✅
- Frontend created at `/founder`
- Links to all other journeys
- Overview dashboard functional
- Ready for enhancement with real data

---

## 🔗 Journey Integration Points

### Data Sharing Across Journeys:
1. **Notion CRM** - Central source of truth for all entities
   - Suppliers, Deals, Transactions (Procurement)
   - Campaigns, Leads, Opportunities (GTM)
   - Jobs, Candidates, Applications (Hiring)
   - Partnerships, Contacts (All)

2. **Pricing Engine** (`lib/pricing.ts`) - Unified fee calculation
   - Default routed: 33bps
   - Sourced by Wells: 3.3%
   - Originated by Wells: 10%
   - Automatic tithe (10% gross fees to Adullam Fund)

3. **Memory System** (Postgres + Vector DB)
   - Remembers user preferences across journeys
   - Tracks relationships and context
   - Enables proactive suggestions

4. **Conversational AI** (`/api/chat`)
   - Single chat interface adapts to context
   - Understands which journey user is in
   - Maintains personality consistency

---

## 🚀 What's Working Right Now

### ✅ **Fully Operational:**
1. Conversational AI with memory
2. Pricing engine with contract compliance
3. Notion integration for all data
4. Database (Postgres) with Prisma migrations
5. Founder Journey command center
6. GTM campaign builder and launch
7. Job seeker resume parsing and matching
8. Procurement RFQ creation and supplier matching
9. Contract generation

### ⚠️  **Infrastructure Complete (Needs Configuration):**
10. Email sending via Instantly.ai - Code ready, needs campaign setup (see `INSTANTLY_SETUP_GUIDE.md`)

### 🔒 **Blocked by Twilio A2P Approval:**
- SMS notifications to suppliers
- SMS outreach for GTM campaigns
- Real-time SMS negotiation

### 🛠️ **Ready to Build (No Blockers):**
- Frontend polish (animations, loading states)
- Wells-to-Wells negotiation protocol (email-based for now)
- Activity feed with real data
- Advanced analytics dashboards
- Mobile responsive improvements

---

## 📍 Navigation Map

```
/                          → Landing page
/early-access              → Waitlist signup
/founder                   → Command center (all journeys)
├── /gtm                   → Seller journey (campaigns, pipeline)
├── /hr                    → Hiring journey (jobs, candidates)
├── /job-seeker            → Job seeker portal
├── /app                   → Buyer journey (procurement)
├── /analytics             → Finance dashboard
└── /settings              → User preferences

/api/chat                  → Conversational AI (all journeys)
/api/gtm/*                 → GTM automation
/api/ats/*                 → ATS integrations
/api/job-seeker/*          → Job seeker features
/api/rfqs                  → Procurement requests
/api/suppliers/*           → Supplier management
/api/negotiation/*         → AI-to-AI negotiation
/api/webhooks/*            → External integrations
```

---

## 💡 Next Steps

### Immediate (This Week):
1. **Polish Founder Journey** - Add real data from Notion
2. **Test End-to-End** - Walk through each journey with real scenarios
3. **Wells Insights** - Make proactive suggestions more intelligent
4. **Activity Feed** - Show what Wells has been doing

### Short-Term (Next 2 Weeks):
1. **Spinning World Animation** - Visual feedback for background work
2. **Email-Based Negotiation** - Enable Wells-to-Wells via email until SMS approved
3. **Dashboard Analytics** - Real metrics and charts
4. **Mobile Responsiveness** - Ensure all journeys work on mobile

### Medium-Term (Next Month):
1. **Twilio A2P Approval** - Unlock SMS features
2. **Full Negotiation Protocol** - Complete AI-to-AI with SMS
3. **Payment Integration** - Stripe Connect for escrow
4. **Advanced Matching** - ML-powered supplier and candidate matching

---

## 🎯 The Vision

**By the end of Phase 1**, you (Jonah) can:
1. **Launch a GTM campaign** → Wells finds prospects and starts outreach
2. **Post a job opening** → Wells sources candidates and schedules interviews
3. **Request a product** → Wells finds suppliers, negotiates, closes deal
4. **Switch contexts seamlessly** → Everything in one place

**The world starts spinning**, and Wells handles it all while you focus on what matters most.

---

**Status:** Ready to use. Keep shipping! 🚀
