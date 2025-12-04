# Wells AI Architecture Guide

> **For Context Continuity**: This document captures the current architecture so any new Claude session can quickly understand the codebase.

## Two Products, One Codebase

This monorepo contains **two distinct products** with separate domains and branding:

### 1. Wells Onyx (wellsonyx.io)
AI-powered commerce platform with conversational AI for founders, buyers, sellers, and job seekers.

**Key Features:**
- 4 Journeys: Founder, Buyer, Seller, Jobs
- First Mover status for early adopters
- AI-to-AI negotiations (future)
- 1% success fee model

**Routes:**
- `/` - Wells Onyx homepage
- `/dashboard` - User dashboard
- `/onboarding/*` - Multi-step onboarding
- `/sign-in`, `/sign-up` - Clerk auth

### 2. Grain & Vault (grainandvault.com)
Treasury infrastructure SDK for enterprise finance teams.

**Key Features:**
- GRAIN stablecoin (110% collateralized)
- VAULT automatic price protection
- 1:1 credit line against deposits
- Treasury SDK with 6 ERP adapters

**Routes:**
- `/grain-vault` - Landing page
- `/grain-vault/signup` - Account creation
- `/grain-vault/signin` - Login
- `/grain-vault/onboarding` - Company/ERP setup
- `/grain-vault/account` - Dashboard with Wells AI chat
- `/grain-vault/demo` - Interactive SDK demo

---

## Core Technologies

```
Framework:     Next.js 16.0.7 (React 19.2.1)
Auth:          Clerk
Database:      PostgreSQL (Prisma ORM)
AI:            Anthropic Claude
Styling:       Tailwind CSS
Deployment:    Vercel
```

---

## Directory Structure

```
app/
├── api/
│   ├── chat/route.ts              # Wells AI conversations (all journeys)
│   ├── grain-vault/account/       # G&V account CRUD
│   ├── leads/                     # Lead capture
│   └── deals/                     # Deal management
├── components/
│   ├── ChatInterface.tsx          # Wells AI chat (Wells Onyx)
│   └── TreasuryChat.tsx           # Wells AI chat (Grain & Vault)
├── grain-vault/                   # All G&V pages
│   ├── page.tsx                   # Landing page
│   ├── signup/page.tsx
│   ├── signin/page.tsx
│   ├── onboarding/page.tsx
│   └── account/page.tsx           # Dashboard with chat
├── onboarding/                    # Wells Onyx onboarding
├── dashboard/                     # Wells Onyx dashboard
└── page.tsx                       # Wells Onyx homepage

lib/
├── grain-vault/
│   └── types.ts                   # G&V types and interfaces
├── treasury-sdk/                  # SDK source code
│   └── adapters/                  # ERP-specific adapters
│       ├── sap.ts
│       ├── oracle.ts
│       ├── netsuite.ts
│       ├── dynamics365.ts
│       ├── workday.ts
│       └── coupa.ts
├── ai-negotiation.ts              # AI-to-AI negotiation logic
├── leads-db.ts                    # Lead management
└── notifications.ts               # Email/Slack notifications
```

---

## Chat API Journeys

The `/api/chat` route supports multiple journeys:

| Journey    | Use Case                          |
|------------|-----------------------------------|
| `founder`  | Founders seeking talent/funding   |
| `buyer`    | Procurement requests              |
| `seller`   | Sales opportunities               |
| `jobs`     | Job seekers                       |
| `treasury` | Grain & Vault balance/payments    |
| `default`  | General inquiry                   |

---

## Grain & Vault Treasury SDK

The SDK provides zero-friction payments via GRAIN stablecoin with native ERP integration.

**Supported ERPs:**
- SAP (S/4HANA, ECC)
- Oracle (Fusion, E-Business)
- NetSuite
- Microsoft Dynamics 365
- Workday
- Coupa

**Core Concepts:**
- **GRAIN**: Stablecoin for instant settlement
- **VAULT**: Protection mechanism that freezes price on manipulation, runs 7-day blockchain audit
- **1:1 Credit Line**: Borrow against deposits while they appreciate

---

## Authentication

- **Wells Onyx**: Clerk with journey-based profiles
- **Grain & Vault**: Separate Clerk flow at `/grain-vault/signin`

Both use the same Clerk project but different redirect flows.

---

## Environment Variables

Required in Vercel:
```
ANTHROPIC_API_KEY         # Claude API
CLERK_SECRET_KEY          # Clerk auth
NEXT_PUBLIC_CLERK_*       # Clerk public keys
DATABASE_URL              # PostgreSQL
SENDGRID_API_KEY          # Emails
NOTION_API_KEY            # Notion integration
```

---

## Recent Changes (Dec 2024)

1. **Security Update**: Next.js 16.0.7, React 19.2.1 (CVE-2025-66478)
2. **Wells AI in G&V**: TreasuryChat component in account dashboard
3. **Treasury Journey**: Chat API supports balance checks, payments
4. **G&V Onboarding**: Full signup → onboarding → dashboard flow

---

## Key Principles

1. **Don't break launch-ready code** - Both products are close to launch
2. **Conversational first** - Users can do everything via Wells AI
3. **Two products, one codebase** - Domain routing in vercel.json
4. **ERP-native** - Treasury SDK adapts to each ERP's native APIs

---

## Quick Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run type-check   # TypeScript validation
vercel --prod        # Deploy to production
```
