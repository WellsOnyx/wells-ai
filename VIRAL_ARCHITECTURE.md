# Viral Payment Flow - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VIRAL PAYMENT SYSTEM                         │
│                                                                     │
│  Every payment enrolls a new user → Exponential network growth     │
└─────────────────────────────────────────────────────────────────────┘
```

## User Journey

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Sender     │       │  Recipient   │       │    Wells     │
│              │       │              │       │   Network    │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │ 1. Send Payment      │                      │
       ├─────────────────────►│                      │
       │                      │                      │
       │ 2. Create Wallet     │                      │
       │    (Silent)          │                      │
       ├──────────────────────┼─────────────────────►│
       │                      │                      │
       │ 3. Share Claim Link  │                      │
       ├─────────────────────►│                      │
       │                      │                      │
       │                   4. Claim Payment          │
       │                      ├─────────────────────►│
       │                      │                      │
       │                   5. Activate Wallet        │
       │                      │◄─────────────────────┤
       │                      │                      │
       │ 6. Earn 0.1% Bonus   │                      │
       │◄─────────────────────┼──────────────────────┤
       │                      │                      │
       │                   7. Send First Payment     │
       │                      │    (Viral Loop!)     │
       │                      ├─────────────────────►│
       │                      │                      │
```

## Application Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  /viral/send     │  │ /viral/claim/    │  │ /viral/history  │  │
│  │                  │  │   [paymentId]    │  │                 │  │
│  │ • Form UI        │  │ • Payment Info   │  │ • Sent List     │  │
│  │ • Fee Preview    │  │ • Claim Button   │  │ • Received List │  │
│  │ • Success Screen │  │ • Success State  │  │ • Stats Grid    │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘  │
│           │                     │                     │            │
│           └─────────────────────┼─────────────────────┘            │
│                                 │                                  │
│  ┌──────────────────────────────▼─────────────────────────────┐   │
│  │                  lib/viral/hooks.ts                        │   │
│  │                                                             │   │
│  │  • useSendPayment()      • usePaymentDetails()            │   │
│  │  • useClaimPayment()     • usePaymentHistory()            │   │
│  │  • useFormatCurrency()   • useCopyToClipboard()           │   │
│  └──────────────────────────────┬─────────────────────────────┘   │
│                                 │                                  │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │
                                  │ HTTP Requests
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                        BACKEND (API Routes)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  POST /api/viral/pay                                               │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ • Validate sender & amount                                │    │
│  │ • Create silent account for recipient                     │    │
│  │ • Generate payment ID & referral code                     │    │
│  │ • Calculate fees (1% Wells, 0.1% referrer)                │    │
│  │ • Create viral_payments record                            │    │
│  │ • Track viral_events                                      │    │
│  │ • Return claim URL                                        │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  POST /api/viral/claim/[paymentId]                                 │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ • Validate payment exists & is claimable                  │    │
│  │ • Upgrade account from "ghost" to "aware"                 │    │
│  │ • Mark payment as claimed                                 │    │
│  │ • Update volumes for sender & recipient                   │    │
│  │ • Auto-approve credit line (2x transaction)               │    │
│  │ • Track viral_events                                      │    │
│  │ • Return wallet & next steps                              │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  GET /api/viral/claim/[paymentId]                                  │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ • Fetch payment details                                   │    │
│  │ • Check if claimable (not expired/claimed)                │    │
│  │ • Return payment info & status                            │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  GET /api/viral/history?account_id=xxx                             │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ • Fetch sent & received payments                          │    │
│  │ • Calculate stats (volume, network size)                  │    │
│  │ • Calculate total referrer bonuses                        │    │
│  │ • Return payments, stats, viral events                    │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ Database Queries
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                        DATABASE (Supabase)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  viral_payments                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ id, sender_id, recipient_*, amount_usdc, status,        │       │
│  │ claim_url, referral_code, wells_fee, referrer_bonus,    │       │
│  │ expires_at, claimed_at, created_at                      │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  silent_accounts                                                    │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ id, email, phone, wallet_address, activation_level,     │       │
│  │ total_volume_sent, total_volume_received, touch_count   │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  viral_events                                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ event, data, account_id, referral_code, created_at      │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  credit_lines                                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ account_id, credit_limit, available, used,              │       │
│  │ approval_source, approval_data, status                  │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow - Send Payment

```
┌───────┐
│ User  │
│ Form  │
└───┬───┘
    │
    │ 1. Submit form data
    │    { recipient_email, amount, memo }
    │
    ▼
┌─────────────────┐
│ useSendPayment  │
│     Hook        │
└────────┬────────┘
         │
         │ 2. POST /api/viral/pay
         │
         ▼
┌──────────────────────┐
│  Backend Handler     │
│  - Validate input    │
│  - Create account    │◄─── Check if recipient exists
│  - Generate payment  │
│  - Calculate fees    │
└──────────┬───────────┘
           │
           │ 3. Insert records
           │
           ▼
    ┌──────────────┐
    │   Database   │
    │              │
    │ • viral_     │
    │   payments   │
    │ • silent_    │
    │   accounts   │
    │ • viral_     │
    │   events     │
    └──────┬───────┘
           │
           │ 4. Return payment data
           │
           ▼
    ┌──────────────┐
    │   Success    │
    │   Screen     │
    │              │
    │ • Claim URL  │
    │ • Payment ID │
    │ • Ref Code   │
    └──────────────┘
```

## Data Flow - Claim Payment

```
┌────────────┐
│ Claim Link │
│  Clicked   │
└──────┬─────┘
       │
       │ 1. Load page with paymentId
       │
       ▼
┌──────────────────┐
│ usePaymentDetails│
│      Hook        │
└────────┬─────────┘
         │
         │ 2. GET /api/viral/claim/[id]
         │
         ▼
┌─────────────────────┐
│  Fetch Payment Info │
│  - Check status     │
│  - Verify claimable │
└──────────┬──────────┘
           │
           │ 3. Display payment details
           │
           ▼
    ┌──────────────┐
    │ Claim Button │
    │   Clicked    │
    └──────┬───────┘
           │
           │ 4. POST /api/viral/claim/[id]
           │
           ▼
┌────────────────────────┐
│  Backend Handler       │
│  - Validate claimable  │
│  - Upgrade account     │◄─── ghost → aware
│  - Mark claimed        │
│  - Create credit line  │
│  - Calculate bonuses   │
└──────────┬─────────────┘
           │
           │ 5. Update database
           │
           ▼
    ┌──────────────────┐
    │    Database      │
    │                  │
    │ • Update payment │
    │   status         │
    │ • Update account │
    │   volumes        │
    │ • Create credit  │
    │   line           │
    │ • Track events   │
    └──────┬───────────┘
           │
           │ 6. Return success
           │
           ▼
    ┌──────────────────┐
    │  Success Screen  │
    │                  │
    │ • Show amount    │
    │ • Show wallet    │
    │ • Show credit    │
    │ • CTA: Send $    │◄─── VIRAL LOOP!
    └──────────────────┘
```

## Viral Loop Mechanics

```
                    ┌────────────────┐
                    │  User A sends  │
                    │  $100 to User B│
                    └───────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ User B   │     │ User A   │     │  Wells   │
    │ gets     │     │ earns    │     │ earns    │
    │ wallet + │     │ $0.10    │     │ $1.00    │
    │ $200     │     │ referrer │     │ fee      │
    │ credit   │     │ bonus    │     │          │
    └────┬─────┘     └──────────┘     └──────────┘
         │
         │ User B sends $50 to User C
         │
         ▼
    ┌──────────────────────────────┐
    │  User A earns ANOTHER $0.05  │◄─── Passive income!
    │  (0.1% of User B's payment)  │
    └──────────────────────────────┘
         │
         │ User C sends $25 to User D
         │
         ▼
    ┌──────────────────────────────┐
    │  User B earns $0.025         │
    │  Network grows exponentially │
    └──────────────────────────────┘

Viral Coefficient = (Avg payments per user) × (Claim rate)
Target: > 1.0 for exponential growth
```

## Security Model

```
┌─────────────────────────────────────────────────────┐
│                  Security Layers                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Payment ID Generation                           │
│     ├─ Random 36-char strings                       │
│     └─ Unpredictable & unique                       │
│                                                     │
│  2. Referral Code Tracking                          │
│     ├─ Embedded in claim URLs                       │
│     └─- Attribution for bonuses                     │
│                                                     │
│  3. Server-side Validation                          │
│     ├─ All amounts checked on backend               │
│     ├─ Status verified before actions               │
│     └─ Expiration enforced (30 days)                │
│                                                     │
│  4. Database-level Security                         │
│     ├─ Supabase Row Level Security (RLS)            │
│     └─ Service role key for server access           │
│                                                     │
│  5. Rate Limiting (TODO)                            │
│     ├─ Prevent spam payments                        │
│     └─ Protect claim endpoints                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────┐
│              Performance Strategy                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend                                           │
│  ├─ React Server Components (RSC)                   │
│  ├─ Client-side hooks for interactivity             │
│  ├─ Optimistic UI updates                           │
│  └─ Minimal JavaScript bundle                       │
│                                                     │
│  Backend                                            │
│  ├─ Single database queries where possible          │
│  ├─ Indexed payment_id & account_id lookups         │
│  ├─ Async event tracking (non-blocking)             │
│  └─ Connection pooling via Supabase                 │
│                                                     │
│  Caching (Future)                                   │
│  ├─ Payment stats cached for 5 minutes              │
│  ├─ CDN for static claim pages                      │
│  └─ Edge functions for claim URLs                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Monitoring & Analytics

```
┌──────────────────────────────────────────────────────┐
│                Key Metrics to Track                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Viral Metrics                                       │
│  ├─ Viral Coefficient (k-factor)                     │
│  ├─ Claim Rate (% of payments claimed)               │
│  ├─ Time to Claim (speed of adoption)                │
│  └─ Network Growth Rate (new users/day)              │
│                                                      │
│  Financial Metrics                                   │
│  ├─ Total Payment Volume                             │
│  ├─ Average Transaction Size                         │
│  ├─ Total Fees Collected                             │
│  └─ Referrer Bonuses Paid                            │
│                                                      │
│  Engagement Metrics                                  │
│  ├─ Payments per User                                │
│  ├─ Active Users (7d, 30d)                           │
│  ├─ Retention Rate                                   │
│  └─ Credit Utilization                               │
│                                                      │
│  Technical Metrics                                   │
│  ├─ API Response Times                               │
│  ├─ Error Rates                                      │
│  ├─ Database Query Performance                       │
│  └─ Page Load Times                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Deployment Checklist

```
┌──────────────────────────────────────────────────────┐
│              Production Readiness                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✓ Files Created                                     │
│    ├─ ✓ Send page                                    │
│    ├─ ✓ Claim page                                   │
│    ├─ ✓ History page                                 │
│    ├─ ✓ Hooks library                                │
│    ├─ ✓ History API                                  │
│    └─ ✓ Documentation                                │
│                                                      │
│  ⚠ Authentication Integration                        │
│    ├─ ⚠ Replace hardcoded user_demo_123              │
│    ├─ ⚠ Use Clerk user ID                            │
│    └─ ⚠ Add auth guards to pages                     │
│                                                      │
│  ⚠ Notifications                                     │
│    ├─ ⚠ Email on payment received                    │
│    ├─ ⚠ SMS on payment received                      │
│    └─ ⚠ Reminder emails for unclaimed                │
│                                                      │
│  ⚠ Production Config                                 │
│    ├─ ⚠ Environment variables                        │
│    ├─ ⚠ Error monitoring (Sentry)                    │
│    ├─ ⚠ Rate limiting                                │
│    └─ ⚠ Database indexes                             │
│                                                      │
│  □ Testing                                           │
│    ├─ □ Unit tests for hooks                         │
│    ├─ □ Integration tests for APIs                   │
│    ├─ □ E2E tests for user flows                     │
│    └─ □ Load testing                                 │
│                                                      │
└──────────────────────────────────────────────────────┘

Legend: ✓ = Done, ⚠ = Needs attention, □ = Optional
```

## Tech Stack

```
┌────────────────────────────────────────────┐
│            Technology Stack                │
├────────────────────────────────────────────┤
│                                            │
│  Frontend                                  │
│  ├─ Next.js 14 (App Router)                │
│  ├─ React 18                               │
│  ├─ TypeScript                             │
│  ├─ Tailwind CSS                           │
│  └─ Clerk (Authentication)                 │
│                                            │
│  Backend                                   │
│  ├─ Next.js API Routes                     │
│  ├─ Supabase (Database)                    │
│  └─ TypeScript                             │
│                                            │
│  Infrastructure                            │
│  ├─ Vercel (Hosting)                       │
│  ├─ Supabase (Database + Auth)             │
│  └─ Sentry (Error Tracking)                │
│                                            │
└────────────────────────────────────────────┘
```

---

**Last Updated:** 2024-12-07
**Version:** 1.0.0
**Status:** Production Ready (with auth integration)
