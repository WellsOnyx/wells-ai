# Wells AI Routes & Pages

## Production URL
**https://wellsai.vercel.app**

---

## 🌐 Public Pages

### Homepage
- **URL:** https://wellsai.vercel.app
- **File:** `app/page.tsx`
- **Description:** Main landing page with feature overview

### Quotes Dashboard
- **URL:** https://wellsai.vercel.app/quotes
- **File:** `app/quotes/page.tsx`
- **Description:** View and manage supplier quotes
- **Features:**
  - Filter by status (all/pending/accepted/rejected)
  - Compare quote prices and delivery times
  - View Wells AI fees (0.33%)
  - Accept/reject/counter offer functionality

### Quote Details (Dynamic)
- **URL:** https://wellsai.vercel.app/quotes/[rfqId]
- **File:** `app/quotes/[rfqId]/page.tsx`
- **Description:** Detailed view of specific RFQ quotes

### Payment Page
- **URL:** https://wellsai.vercel.app/payment
- **File:** `app/payment/page.tsx`
- **Description:** Payment processing and checkout

### Dashboard
- **URL:** https://wellsai.vercel.app/dashboard
- **File:** `app/dashboard/page.tsx`
- **Description:** Main dashboard overview

### Admin Panel
- **URL:** https://wellsai.vercel.app/admin
- **File:** `app/admin/page.tsx`
- **Description:** Administrative controls

---

## 🤖 GTM (Go-To-Market) Module

### GTM Dashboard
- **URL:** https://wellsai.vercel.app/gtm
- **File:** `app/gtm/page.tsx`
- **Description:** GTM automation overview and controls

---

## 👥 HR Module

### HR Dashboard
- **URL:** https://wellsai.vercel.app/hr
- **File:** `app/hr/page.tsx`
- **Description:** HR operations dashboard

---

## 🤝 Partnerships Module

### Partnerships Dashboard
- **URL:** https://wellsai.vercel.app/partnerships
- **File:** `app/partnerships/page.tsx`
- **Description:** Partner relationship management

### Learning Center (Phase 2)
- **URL:** https://wellsai.vercel.app/learn
- **File:** `app/learn/page.tsx`
- **Description:** Interactive category learning interface
- **Features:**
  - Smart category detection
  - User-guided training mode
  - Real-time progress tracking
  - Conversational learning

### Category Mastery Dashboard (Phase 2)
- **URL:** https://wellsai.vercel.app/categories
- **File:** `app/categories/page.tsx`
- **Description:** Track learned categories and mastery scores
- **Features:**
  - Mastery scoring (0-100%)
  - Search and filtering
  - Phase 2A progress tracking
  - Supplier counts per category

### Supplier Onboarding (Phase 2)
- **URL:** https://wellsai.vercel.app/suppliers/onboard
- **File:** `app/suppliers/onboard/page.tsx`
- **Description:** Self-service supplier registration portal
- **Features:**
  - 4-step wizard interface
  - Category and capability selection
  - Certification tracking
  - Automatic vector DB indexing

---

## 🔌 API Endpoints

### 💬 Chat API
- **POST** `/api/chat`
  - AI-powered conversational interface
  - Handles natural language requests

### 💰 Payments API

#### Create Payment
- **POST** `/api/payments/create`
  - Create Stripe payment intent
  - Body: `{ amount, currency, buyerEmail, dealId }`

#### Payment Webhook
- **POST** `/api/payments/webhook`
  - Stripe webhook handler
  - Handles: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled

#### Create Payment Intent (Legacy)
- **POST** `/api/payments/create-intent`
  - Alternative payment intent creation

### 📋 Quotes API

#### Counter Offer
- **POST** `/api/quotes/counter`
  - Submit counter-offer to supplier
  - Body: `{ quoteId, targetPrice, targetDelivery, message }`
  - Triggers SMS notification to supplier

#### Accept Quote
- **POST** `/api/quotes/accept`
  - Accept supplier quote and initiate payment
  - Body: `{ quoteId, buyerEmail }`
  - Creates Stripe payment intent

### 🏢 Suppliers API

#### Match Suppliers
- **POST** `/api/suppliers/match`
  - Match suppliers to RFQ requirements
  - Returns ranked list of suppliers

#### Notify Suppliers
- **POST** `/api/suppliers/notify`
  - Send SMS notifications to matched suppliers
  - Body: `{ supplierId, rfqId, message }`

### 🤖 GTM API

#### Run GTM Flow
- **POST** `/api/gtm/flows/run`
  - Execute complete GTM automation
  - Body: `{ practiceGroup?: string }` (optional - runs all if not specified)
  - Features:
    - ICP development from past deals
    - Multi-source prospect discovery
    - AI-generated personalized outreach
    - Automatic Notion CRM tracking

#### Discover Prospects
- **POST** `/api/gtm/discover`
  - Run prospect discovery for specific practice group
  - Body: `{ practiceGroup: string }`

#### Generate Outreach
- **POST** `/api/gtm/outreach/generate`
  - Generate AI-powered outreach messages
  - Body: `{ prospect, dealHistory, practiceGroup }`
  - Uses Claude Sonnet 4 for personalization

#### Approve & Send Outreach
- **POST** `/api/gtm/outreach/approve`
  - Approve and send AI-generated outreach
  - Body: `{ prospectId, message, channel }`

#### Get Relationship
- **GET** `/api/gtm/relationships/[id]`
  - Retrieve relationship details from Notion CRM

#### GTM Analytics
- **GET** `/api/gtm/analytics`
  - Real-time GTM system metrics
  - Returns: discovery stats, outreach performance, conversion rates

### 👥 HR API

#### Screen Resume
- **POST** `/api/hr/screen`
  - AI-powered resume screening
  - Body: `{ resumeText, jobDescription }`

#### Check References
- **POST** `/api/hr/references`
  - Automated reference checking
  - Body: `{ candidateId, references[] }`

#### Create Offer
- **POST** `/api/hr/offers`
  - Generate and send offer letters
  - Body: `{ candidateId, salary, benefits }`

### 🤝 Partnerships API

#### Submit Partnership Request
- **POST** `/api/partnerships/submit`
  - Submit new partnership opportunity
  - Body: `{ companyName, contactInfo, partnershipType }`

### 💵 Deals API

#### Create Deal
- **POST** `/api/deals/create`
  - Create new deal in Notion
  - Body: `{ dealName, amount, stage, company }`

#### Update Deal Stage
- **PATCH** `/api/deals/[id]/stage`
  - Update deal pipeline stage
  - Body: `{ stage: string }`

### 📝 RFQs API

#### Submit RFQ
- **POST** `/api/rfqs/submit`
  - Submit new RFQ
  - Body: `{ requirements, quantity, deadline }`

### 📱 Webhooks

#### Twilio SMS Webhook
- **POST** `/api/webhooks/sms`
  - Handles incoming SMS messages
  - Processes supplier responses
  - Updates Notion CRM

### 🧠 Category Learning API (Phase 2)

#### Learn Category
- **POST** `/api/categories/learn`
  - Detect if category is known
  - Guide user through training
  - Store knowledge in vector DB
  - Body: `{ userMessage, mode: 'detect'|'train', category?, conversationId }`

#### Category Statistics
- **GET** `/api/categories/stats`
  - Get mastery scores for all categories
  - Returns: total, categories[], summary stats

#### Supplier Onboarding
- **POST** `/api/suppliers/onboard`
  - Self-service supplier registration
  - Stores in Postgres, Notion, and vector DB
  - Body: `{ companyName, email, categories, capabilities, ... }`

---

## 📊 Key Features by Module

### Week 1: Core Platform ✅
- AI chat interface
- Notion integration
- Basic supplier matching

### Week 2: Supplier Activation ✅
- Automated SMS notifications
- Twilio integration
- Supplier response handling

### Week 3: Quote System & First Transactions ✅
- Quote comparison interface
- Counter-offer negotiation
- Stripe payment integration
- 0.33% fee calculation

### Week 4+: GTM Automation 🚀
- ICP development from historical deals
- Multi-channel prospect discovery (LinkedIn, Twitter, Instagram, Articles)
- AI-powered personalized outreach
- Full Notion CRM integration
- Real-time analytics dashboard

---

## 💳 Payment Flow

1. Buyer reviews quotes at `/quotes`
2. Buyer accepts quote → POST `/api/quotes/accept`
3. Payment intent created via Stripe
4. Buyer enters card details at `/payment`
5. Payment processed
6. Webhook confirms payment → POST `/api/payments/webhook`
7. Deal marked complete in Notion

**Wells AI Fee:** 0.33% (33 basis points) on all transactions

---

## 🔐 Environment Variables Required

```bash
# Notion
NOTION_API_KEY=secret_***
NOTION_DATABASE_ID=***

# Anthropic (AI)
ANTHROPIC_API_KEY=sk-ant-***

# Twilio (SMS)
TWILIO_ACCOUNT_SID=***
TWILIO_AUTH_TOKEN=***
TWILIO_PHONE_NUMBER=+1***

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_***
STRIPE_WEBHOOK_SECRET=whsec_***
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_***
```

---

## 📈 Current Status

### ✅ Live & Working
- Homepage
- Quotes dashboard with filtering
- Payment processing
- GTM automation system
- HR screening
- Partnerships portal

### 🔧 In Development
- Enhanced quote comparison with side-by-side view
- Real-time payment status updates
- Advanced analytics dashboard

### 📊 Metrics
- 28+ API endpoints
- 10+ page routes
- 12 Wells Onyx practice groups supported
- 150K+ supplier network capacity

---

## 🚀 Quick Links

- **Production:** https://wellsai.vercel.app
- **Quotes:** https://wellsai.vercel.app/quotes
- **GTM:** https://wellsai.vercel.app/gtm
- **HR:** https://wellsai.vercel.app/hr
- **Partnerships:** https://wellsai.vercel.app/partnerships

---

## 📝 Notes

- All pages use Next.js 14 App Router
- API routes follow RESTful conventions
- Real-time updates via Notion webhooks (where applicable)
- Mobile-responsive design
- Dark mode support (where implemented)

**Last Updated:** October 29, 2025
**Build Status:** ✅ All systems operational
