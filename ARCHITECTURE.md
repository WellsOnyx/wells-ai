# Wells AI - System Architecture

## Overview

Wells AI is a Next.js 14 application that provides conversational commerce capabilities for B2B procurement. It combines AI-powered conversations with real-time notifications, database integrations, and payment processing.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Browser  │  │ Mobile Web   │  │ Iframe Embed │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              App Router (Next.js 14)                  │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │  │
│  │  │ /chat  │  │ /gtm   │  │ /hr    │  │ /deals │     │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   API Routes                          │  │
│  │  /api/chat         - Claude AI conversations          │  │
│  │  /api/webhooks/sms - Twilio SMS handler              │  │
│  │  /api/suppliers    - Supplier matching & notify       │  │
│  │  /api/gtm/*        - GTM automation endpoints         │  │
│  │  /api/hr/*         - HR system endpoints             │  │
│  │  /api/payments/*   - Payment processing              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Anthropic│  │  Twilio  │  │  Notion  │  │  Stripe  │   │
│  │  Claude  │  │   SMS    │  │Database  │  │ Payments │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Vercel  │  │  Sentry  │  │  Pusher  │  │  Slack   │   │
│  │Postgres  │  │ Errors   │  │Real-time │  │Notifs    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 18
- **Styling:** Tailwind CSS
- **Real-time:** Pusher (WebSocket)
- **Charts:** Recharts
- **Language:** TypeScript

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Next.js API Routes
- **Database:** Vercel Postgres
- **AI:** Anthropic Claude (Sonnet 4.5)
- **SMS:** Twilio
- **Error Tracking:** Sentry
- **Payments:** Stripe

### Infrastructure
- **Hosting:** Vercel (Edge Functions)
- **Database:** Vercel Postgres
- **Cache:** Upstash Redis
- **CDN:** Vercel Edge Network
- **Monitoring:** Sentry

## Core Components

### 1. Conversation Engine

**Location:** `/app/api/chat/route.ts`

**Purpose:** AI-powered conversation interface for RFQ qualification

**Flow:**
```
User Message → Claude API → Context Building → Response Generation
                    ↓
              Data Extraction
                    ↓
              Notion Database
```

**Key Features:**
- Streaming responses for better UX
- Context-aware conversations
- Multi-turn dialogue
- Personality system (Professional, Conversational, Technical)
- Structured data extraction

### 2. Supplier Matching System

**Location:** `/app/api/suppliers/match/route.ts`

**Purpose:** Match buyer RFQs with qualified suppliers

**Algorithm:**
```typescript
1. Extract RFQ requirements (category, specs, budget, timeline)
2. Query supplier database for matches
3. Score suppliers based on:
   - Category alignment
   - Capability match
   - Past performance
   - Availability
4. Return ranked list of top 3-5 suppliers
```

### 3. Notification System

**Location:** `/app/api/suppliers/notify/route.ts`, `/app/api/webhooks/sms/route.ts`

**Purpose:** Real-time supplier alerts via SMS

**Flow:**
```
RFQ Created → Match Suppliers → Send SMS → Track Responses
                                     ↓
                              Webhook Handler
                                     ↓
                              Update Database
```

**Features:**
- Twilio SMS integration
- Response tracking
- Fallback handling
- Delivery confirmation

### 4. GTM Automation

**Location:** `/app/api/gtm/*`

**Purpose:** Go-to-market automation for partner ecosystem

**Modules:**
- Content generation (LinkedIn, blogs)
- Partner tracking
- Campaign management
- Lead scoring

### 5. HR System

**Location:** `/app/api/hr/*`

**Purpose:** Candidate tracking and placement automation

**Features:**
- Resume parsing
- Candidate matching
- Interview scheduling
- Placement tracking

## Data Models

### RFQ (Request for Quote)
```typescript
interface RFQ {
  id: string;
  buyerId: string;
  category: 'semiconductor' | 'executive-search' | 'custom';
  requirements: {
    quantity?: number;
    specifications: Record<string, any>;
    budget: number;
    timeline: string;
  };
  status: 'draft' | 'active' | 'quoted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}
```

### Supplier
```typescript
interface Supplier {
  id: string;
  name: string;
  categories: string[];
  capabilities: string[];
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  rating: number;
  responseRate: number;
}
```

### Quote
```typescript
interface Quote {
  id: string;
  rfqId: string;
  supplierId: string;
  pricing: {
    unitPrice: number;
    totalPrice: number;
    terms: string;
  };
  delivery: {
    timeline: string;
    terms: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  submittedAt: Date;
}
```

## API Endpoints

### Chat API
```
POST /api/chat
- Body: { message: string, conversationId?: string }
- Returns: Stream of AI responses
```

### Supplier APIs
```
POST /api/suppliers/match
- Body: { rfqData: RFQ }
- Returns: { suppliers: Supplier[] }

POST /api/suppliers/notify
- Body: { supplierId: string, rfqId: string }
- Returns: { success: boolean, messageId: string }
```

### Webhook APIs
```
POST /api/webhooks/sms
- Body: Twilio webhook payload
- Returns: TwiML response
```

### GTM APIs
```
POST /api/gtm/content/generate
POST /api/gtm/campaigns/create
GET  /api/gtm/partners/list
POST /api/gtm/leads/score
```

## Security

### Authentication
- API key validation for all routes
- Environment variable protection
- Rate limiting on endpoints

### Data Protection
- Encrypted environment variables
- HTTPS only
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Compliance
- GDPR considerations
- SOC 2 compliance path
- Data retention policies

## Performance

### Optimization Strategies
1. **Edge Functions:** Deploy API routes to Vercel Edge
2. **Caching:** Redis for frequently accessed data
3. **Streaming:** AI responses stream for better perceived performance
4. **Code Splitting:** Dynamic imports for large components
5. **Image Optimization:** Next.js Image component

### Monitoring
- Sentry for error tracking
- Vercel Analytics for performance metrics
- Custom logging for business events

## Scalability

### Current Capacity
- 1000+ concurrent conversations
- 10,000 RFQs/month
- Sub-second response times

### Scaling Path
1. **Phase 1 (Current):** Single region, edge functions
2. **Phase 2:** Multi-region deployment
3. **Phase 3:** Dedicated database clusters
4. **Phase 4:** Microservices architecture

## Development Workflow

### Local Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint code
```

### Testing
```bash
npm run test:load    # Load testing with Artillery
npm run db:migrate   # Run database migrations
npm run db:sync      # Sync Notion to Postgres
```

### Deployment
```bash
# Automatic via Vercel
git push origin main → Vercel Deploy → Production
```

## Integration Points

### Notion Integration
- **Purpose:** Primary database for RFQs, suppliers, quotes
- **Sync:** Bi-directional via API
- **Frequency:** Real-time + hourly batch

### Twilio Integration
- **Purpose:** SMS notifications to suppliers
- **Flow:** RFQ → Match → Notify → Webhook → Update
- **Cost:** $0.06 per message

### Stripe Integration
- **Purpose:** Payment processing (33bps fee collection)
- **Features:** Invoicing, subscriptions, payment tracking
- **Security:** PCI DSS compliant

## Future Architecture

### Planned Enhancements
1. **Vector Database:** Pinecone for semantic search
2. **Message Queue:** Redis pub/sub for async jobs
3. **API Gateway:** Rate limiting, auth, monitoring
4. **GraphQL:** Unified data layer
5. **Mobile Apps:** React Native for iOS/Android

### Microservices Migration
```
Current: Monolith Next.js App
Future:  API Gateway → Services (Chat, Match, Notify, Payment)
```

## Debugging

### Logs
- Vercel function logs: `vercel logs`
- Sentry errors: sentry.io dashboard
- Database queries: Vercel Postgres logs

### Common Issues
1. **API Key Errors:** Check .env.local
2. **Build Failures:** Clear .next cache
3. **Slow Responses:** Check Anthropic API status
4. **SMS Not Sending:** Verify Twilio credentials

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Vercel Platform Docs](https://vercel.com/docs)
- [Twilio API Reference](https://www.twilio.com/docs)

---

**Architecture Review:** Updated October 29, 2025
**Next Review:** January 2026
**Owner:** Wells Onyx Engineering Team
