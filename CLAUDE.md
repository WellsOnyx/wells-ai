# Wells AI - Project Guide for Claude

## Overview

This is a **fintech monorepo** with two products sharing one Next.js codebase:

1. **Wells Onyx** (wellsonyx.io) - AI-powered conversational commerce platform
2. **Grain & Vault** (grainandvault.com) - Treasury infrastructure SDK with GRAIN stablecoin

## Tech Stack

- **Framework**: Next.js 16 / React 19 / TypeScript
- **Database**: PostgreSQL (Vercel Postgres/Neon) with Prisma ORM
- **Auth**: Clerk (separate flows per product)
- **AI**: Anthropic Claude SDK
- **Blockchain**: Solidity/Hardhat on Base L2
- **Payments**: Circle SDK (USDC), Stripe, Airwallex
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## GRAIN Stablecoin - Critical Rules

**NEVER modify these invariants in `lib/grain/treasury.ts`:**

1. GRAIN supply can **NEVER** exceed USDC backing (1:1 minimum)
2. Interest/yield sweeps daily to Asset Vault wallet
3. Asset Vault buys appreciating assets (real estate, DeFi yields)
4. GRAIN value = (USDC + Asset Value) / Supply
5. GRAIN can only go UP in value, never down
6. `MIN_BACKING_RATIO = 1.0` is immutable

The smart contract is at `contracts/GRAIN.sol` (ERC-20 on Base L2).

## Key Directories

```
app/
  api/chat/route.ts          # Main Wells AI chat (all journeys)
  api/grain-vault/            # G&V account, deposits, payments
  api/grain/                  # Minting, burning, credit, treasury
  api/deals/                  # Escrow, release, payment orchestration
  api/treasury/               # Balance, transactions, credit lines
  api/erp/                    # SAP, Oracle, NetSuite adapters
  grain-vault/                # All G&V frontend pages

lib/
  grain/treasury.ts           # GRAIN treasury logic (HARD CODED RULES)
  grain/vault.ts              # VAULT principal protection
  grain-vault/                # G&V account services
  treasury-db.ts              # 30+ DB functions for treasury
  treasury-sdk.ts             # ERP adapter orchestration
  treasury-sdk/adapters/      # SAP, Oracle, NetSuite, Dynamics, Workday
  chat/                       # Conversational AI interfaces
  wells-ai/                   # Matching, sourcing, AI agents

contracts/
  GRAIN.sol                   # ERC-20 stablecoin smart contract

nextgen/
  layer1-external-erp/        # 200+ ERP system connectors
  layer2-internal-erp/        # Lightweight side-car ERP
  layer3-conversational/       # Natural language ERP interface
```

## Domain Routing

- **grainandvault.com** routes to `/grain-vault/*` pages
- **wellsonyx.io** routes to `/` (root) pages
- Configured in `vercel.json`

## Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Lint check
npm run lint:fix         # Auto-fix lint issues
npm run type-check       # TypeScript type check
npm run validate:all     # type-check + lint
npm run test:circle      # Test Circle deposit flow
npm run db:migrate       # Run database migrations
```

## Environment Variables

See `.env.example`, `.env.payments.example`, `.env.credit.example`, and `.env.notifications.example` for required variables. Key ones:

- `ANTHROPIC_API_KEY` - Claude API
- `DATABASE_URL` / `POSTGRES_URL` - PostgreSQL
- `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_*` - Auth
- `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET` - USDC/GRAIN payments
- `STRIPE_SECRET_KEY` - Card payments

## Architecture Docs

- `ARCHITECTURE.md` - Full system architecture
- `GRAIN_ARCHITECTURE.md` - Payment system design
- `GRAIN_VAULT_BUILD_SUMMARY.md` - Build history
- `TREASURY_DATABASE.md` - DB schema and design
- `PRODUCTION_SETUP.md` - Deployment checklist
