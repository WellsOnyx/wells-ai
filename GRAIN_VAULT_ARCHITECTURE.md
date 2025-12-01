# Grain & Vault: Complete System Architecture

**Last Updated:** November 21, 2025
**Version:** 1.0
**Status:** Production Ready

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [Backend API Architecture](#backend-api-architecture)
4. [Frontend Structure](#frontend-structure)
5. [Database Schema](#database-schema)
6. [Deployment Topology](#deployment-topology)
7. [Security Layers](#security-layers)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## High-Level Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  Web App (Next.js)  │  Mobile App  │  API Clients  │  CLI   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Next.js API Routes (Vercel Serverless Functions)          │
│  - Authentication (Clerk)                                   │
│  - Business Logic                                           │
│  - Validation & Rate Limiting                               │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Blockchain SDK (ethers.js)  │  Database (Postgres)         │
│  Circle API (USDC)            │  Cache (Upstash Redis)       │
│  Pusher (Real-time)           │  Monitoring (Sentry)         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                          │
├─────────────────────────────────────────────────────────────┤
│              Base L2 (Ethereum Rollup)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Grain   │  │  Vault   │  │  Escrow  │                 │
│  │  Token   │  │ Treasury │  │ Contract │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│         │             │              │                      │
│         └─────────────┴──────────────┘                      │
│                       │                                     │
│                  ┌────▼────┐                               │
│                  │  USDC   │                               │
│                  │ Reserve │                               │
│                  └─────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

**1. Grain Token (ERC-20)**
- USDC-backed stablecoin
- Auto-revaluing based on NAV
- Circuit breaker protection
- Multi-sig access control

**2. Vault Contract**
- Treasury management
- NAV calculation
- Asset allocation
- Collateral tracking

**3. Escrow Contract**
- Milestone-based payments
- Dispute resolution
- Time-locked withdrawals
- Multi-party transactions

**4. Backend Services**
- API endpoints
- Blockchain interaction
- Database management
- Real-time updates

**5. Frontend Applications**
- Web dashboard
- Admin panel
- Mobile apps (future)
- Integration SDKs

---

## Smart Contract Architecture

### Contract Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                 OpenZeppelin Contracts                    │
├──────────────────────────────────────────────────────────┤
│  ERC20  │  AccessControl  │  Pausable  │  ReentrancyGuard│
└────┬────────────┬─────────────┬──────────────┬───────────┘
     │            │             │              │
     │            │             │              │
┌────▼────┐  ┌───▼──────┐  ┌──▼──────┐  ┌───▼──────┐
│  Grain  │  │  Vault   │  │ Escrow  │  │  Oracle  │
│ (Token) │  │(Treasury)│  │(Deals)  │  │ (Price)  │
└─────────┘  └──────────┘  └─────────┘  └──────────┘
     │             │              │            │
     └─────────────┴──────────────┴────────────┘
                   │
              Integrated
               System
```

### Grain Token Contract

**File:** `contracts/core/Grain.sol`

**Inheritance:**
```solidity
ERC20 → AccessControl → ReentrancyGuard → Pausable → Grain
```

**Key Functions:**
- `mint(address to, uint256 amount)` - Mint new GRAIN
- `burn(address from, uint256 amount)` - Burn GRAIN
- `updateNAV(uint256 newNAV)` - Update price based on NAV
- `getPrice()` - Get current GRAIN price
- `getCollateralRatio()` - Check backing ratio

**State Variables:**
```solidity
uint256 public grainPrice;           // Current price (18 decimals)
uint256 public totalNAV;             // Net asset value (18 decimals)
uint256 public minCollateralRatio;   // Minimum 110%
bool public circuitBreakerTriggered; // Emergency state
```

**Roles:**
- `MINTER_ROLE` - Can mint tokens (Vault only)
- `BURNER_ROLE` - Can burn tokens (Vault only)
- `ORACLE_ROLE` - Can update NAV (automated oracle)
- `PAUSER_ROLE` - Can pause system (admin only)

### Vault Contract

**File:** `contracts/core/Vault.sol`

**Inheritance:**
```solidity
AccessControl → ReentrancyGuard → Pausable → Vault
```

**Key Functions:**
- `deposit(uint256 amount)` - Deposit USDC
- `withdraw(address to, uint256 amount)` - Withdraw USDC
- `updateAssets(...)` - Update asset breakdown
- `getTotalNAV()` - Calculate total NAV
- `getAssetBreakdown()` - View asset allocation

**Asset Tracking:**
```solidity
struct AssetBreakdown {
    uint256 liquidReserves;      // USDC + cash
    uint256 floatInTransit;      // Pending ACH/wire
    uint256 physicalAssets;      // Inventory + equipment
    uint256 investmentPositions; // Bonds + equities
    uint256 receivables;         // Invoices + loans
    uint256 lastUpdated;         // Timestamp
}
```

### Escrow Contract

**File:** `contracts/core/Escrow.sol`

**Inheritance:**
```solidity
AccessControl → ReentrancyGuard → Pausable → Escrow
```

**Key Functions:**
- `createEscrow(...)` - Create new escrow
- `fundEscrow(uint256 escrowId)` - Fund with USDC/GRAIN
- `completeMilestone(uint256 escrowId, uint256 milestoneIndex)` - Release funds
- `raiseDispute(uint256 escrowId, string reason)` - Dispute payment
- `resolveDispute(...)` - Arbitrator resolution

**Milestone Structure:**
```solidity
struct Milestone {
    string description;
    uint256 percentage;    // Basis points (10000 = 100%)
    bool completed;
    uint256 completedAt;
}
```

### Contract Deployment

**Deployment Order:**
1. Deploy Grain token
2. Deploy Vault (with Grain address)
3. Deploy Escrow (with Grain & Vault addresses)
4. Grant roles (Vault → MINTER_ROLE on Grain)
5. Transfer admin to multi-sig
6. Verify on Basescan

**Gas Costs (Base L2):**
- Grain: ~1.2M gas (~$0.02)
- Vault: ~2.1M gas (~$0.04)
- Escrow: ~1.8M gas (~$0.03)
- **Total: ~$0.10**

---

## Backend API Architecture

### API Structure

```
/api
├── grain/
│   ├── balance/route.ts          # GET - Check GRAIN balance
│   ├── deposit/route.ts          # POST - Deposit USDC → GRAIN
│   ├── withdraw/route.ts         # POST - Withdraw GRAIN → USDC
│   ├── transfer/route.ts         # POST - Transfer GRAIN
│   └── price/route.ts            # GET - Current GRAIN price
├── vault/
│   ├── nav/route.ts              # GET - Current NAV
│   ├── assets/route.ts           # GET - Asset breakdown
│   ├── collateral/route.ts       # GET - Collateral ratio
│   └── yield/route.ts            # GET - Yield earned
├── escrow/
│   ├── create/route.ts           # POST - Create escrow
│   ├── fund/route.ts             # POST - Fund escrow
│   ├── complete/route.ts         # POST - Complete milestone
│   ├── dispute/route.ts          # POST - Raise dispute
│   └── [escrowId]/route.ts       # GET - Escrow details
├── admin/
│   ├── pause/route.ts            # POST - Emergency pause
│   ├── unpause/route.ts          # POST - Resume operations
│   ├── update-nav/route.ts       # POST - Update NAV (oracle)
│   └── circuit-breaker/route.ts  # POST - Trigger/reset
└── webhooks/
    ├── circle/route.ts           # POST - Circle webhook
    └── pusher/route.ts           # POST - Pusher events
```

### Core Libraries

**lib/blockchain/grain-contract.ts**
```typescript
export class GrainContract {
  constructor(provider, wallet)

  async mint(to: string, amount: bigint)
  async burn(from: string, amount: bigint)
  async balanceOf(address: string): Promise<bigint>
  async getPrice(): Promise<bigint>
  async updateNAV(newNAV: bigint)
}
```

**lib/blockchain/vault-escrow.ts**
```typescript
export class VaultContract {
  constructor(provider, wallet)

  async deposit(amount: bigint)
  async withdraw(to: string, amount: bigint)
  async getTotalNAV(): Promise<bigint>
  async getCollateralRatio(): Promise<number>
}

export class EscrowContract {
  constructor(provider, wallet)

  async createEscrow(params: EscrowParams): Promise<bigint>
  async fundEscrow(escrowId: bigint)
  async completeMilestone(escrowId: bigint, milestone: number)
}
```

### Authentication Flow

```
1. User logs in → Clerk session created
2. API request → Extract user ID from session
3. Validate permissions → Check role/access
4. Execute blockchain transaction → Sign with backend wallet
5. Record in database → Log transaction
6. Return response → Include tx hash
```

### Rate Limiting

- **Public endpoints:** 100 req/min per IP
- **Authenticated endpoints:** 1000 req/min per user
- **Admin endpoints:** Unlimited
- **Blockchain writes:** Max 10/min per user (prevent spam)

---

## Frontend Structure

### Application Structure

```
app/
├── page.tsx                      # Landing page
├── dashboard/
│   └── page.tsx                  # Main dashboard
├── grain/
│   ├── deposit/page.tsx          # Deposit flow
│   ├── withdraw/page.tsx         # Withdrawal flow
│   └── transfer/page.tsx         # Transfer flow
├── vault/
│   ├── page.tsx                  # Vault overview
│   └── analytics/page.tsx        # NAV & yield analytics
├── escrow/
│   ├── page.tsx                  # Escrow list
│   ├── create/page.tsx           # Create new escrow
│   └── [id]/page.tsx             # Escrow details
├── admin/
│   ├── page.tsx                  # Admin dashboard
│   ├── users/page.tsx            # User management
│   └── operations/page.tsx       # System operations
└── api/                          # API routes (see above)
```

### Component Library

**components/grain/**
- `GrainBalance.tsx` - Display balance with yield
- `DepositModal.tsx` - USDC deposit interface
- `WithdrawModal.tsx` - GRAIN withdrawal interface
- `TransferForm.tsx` - Send GRAIN to others
- `PriceChart.tsx` - Historical price chart

**components/vault/**
- `NAVDisplay.tsx` - Current NAV & breakdown
- `AssetAllocation.tsx` - Pie chart of assets
- `CollateralGauge.tsx` - Collateral ratio meter
- `YieldSummary.tsx` - Total yield earned

**components/escrow/**
- `EscrowCard.tsx` - Single escrow summary
- `MilestoneTracker.tsx` - Progress visualization
- `DisputeDialog.tsx` - Raise dispute UI
- `EscrowTimeline.tsx` - Event history

### State Management

**Using React Server Components + SWR:**

```typescript
// Client-side data fetching
import useSWR from 'swr'

export function useGrainBalance() {
  const { data, error, mutate } = useSWR('/api/grain/balance', fetcher, {
    refreshInterval: 5000 // Update every 5s
  })

  return {
    balance: data?.balance,
    yieldEarned: data?.yieldEarned,
    loading: !data && !error,
    error,
    refresh: mutate
  }
}
```

### Real-time Updates

**Using Pusher:**

```typescript
import Pusher from 'pusher-js'

const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: 'us2'
})

const channel = pusher.subscribe('grain-updates')

channel.bind('balance-updated', (data) => {
  // Update UI in real-time
  mutate('/api/grain/balance')
})

channel.bind('nav-updated', (data) => {
  // Update NAV display
  mutate('/api/vault/nav')
})
```

---

## Database Schema

### Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) UNIQUE,
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### grain_transactions
```sql
CREATE TABLE grain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL, -- 'deposit', 'withdraw', 'transfer', 'mint', 'burn'
  amount NUMERIC(20, 6) NOT NULL,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_grain_tx_user ON grain_transactions(user_id);
CREATE INDEX idx_grain_tx_hash ON grain_transactions(tx_hash);
```

#### vault_snapshots
```sql
CREATE TABLE vault_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_nav NUMERIC(20, 6) NOT NULL,
  liquid_reserves NUMERIC(20, 6),
  float_in_transit NUMERIC(20, 6),
  physical_assets NUMERIC(20, 6),
  investment_positions NUMERIC(20, 6),
  receivables NUMERIC(20, 6),
  grain_price NUMERIC(20, 18),
  collateral_ratio NUMERIC(5, 2),
  snapshot_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vault_snapshots_time ON vault_snapshots(snapshot_at DESC);
```

#### escrows
```sql
CREATE TABLE escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id_onchain BIGINT UNIQUE NOT NULL,
  depositor_id UUID REFERENCES users(id),
  beneficiary_id UUID REFERENCES users(id),
  token VARCHAR(42) NOT NULL, -- USDC or GRAIN address
  total_amount NUMERIC(20, 6) NOT NULL,
  released_amount NUMERIC(20, 6) DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'pending', 'active', 'completed', 'disputed', 'cancelled'
  deal_id VARCHAR(255),
  deal_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  funded_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_escrows_depositor ON escrows(depositor_id);
CREATE INDEX idx_escrows_beneficiary ON escrows(beneficiary_id);
CREATE INDEX idx_escrows_status ON escrows(status);
```

#### escrow_milestones
```sql
CREATE TABLE escrow_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrows(id),
  milestone_index INT NOT NULL,
  description TEXT NOT NULL,
  percentage INT NOT NULL, -- Basis points (10000 = 100%)
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  UNIQUE(escrow_id, milestone_index)
);
```

#### admin_actions
```sql
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'pause', 'unpause', 'update_nav', 'circuit_breaker'
  parameters JSONB,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_time ON admin_actions(created_at DESC);
```

### Caching Strategy

**Redis (Upstash) Keys:**

```
grain:balance:{address}        TTL: 30s   # GRAIN balance
grain:price                     TTL: 60s   # Current price
vault:nav                       TTL: 5min  # Total NAV
vault:collateral                TTL: 5min  # Collateral ratio
escrow:{id}                     TTL: 1min  # Escrow details
user:{clerk_id}                 TTL: 1hr   # User data
```

---

## Deployment Topology

### Production Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE CDN                         │
│              (DDoS Protection + Edge Caching)               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK                      │
│         (Next.js Serverless Functions - Auto-scaling)       │
└───┬───────────┬───────────┬───────────┬─────────────────────┘
    │           │           │           │
    ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Region │ │ Region │ │ Region │ │ Region │
│  US-E  │ │  US-W  │ │   EU   │ │  APAC  │
└────────┘ └────────┘ └────────┘ └────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────┤
│  Vercel Postgres  │  Upstash Redis  │  Clerk Auth           │
│  Sentry Monitoring│  Pusher Realtime│  Circle USDC          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    BASE L2 BLOCKCHAIN                        │
│                  (Coinbase-backed L2)                        │
├─────────────────────────────────────────────────────────────┤
│  RPC: Alchemy/Infura  │  Indexer: The Graph                 │
└─────────────────────────────────────────────────────────────┘
```

### Environment Separation

**Development:**
- Local: `localhost:3000`
- Blockchain: Hardhat local node (chainId: 31337)
- Database: Local Postgres

**Testnet:**
- URL: `testnet.grainvault.com`
- Blockchain: Base Sepolia (chainId: 84532)
- Database: Vercel Postgres (staging)

**Production:**
- URL: `app.grainvault.com`
- Blockchain: Base Mainnet (chainId: 8453)
- Database: Vercel Postgres (production)

### Scaling Strategy

**Horizontal Scaling:**
- Vercel auto-scales serverless functions (0 → ∞)
- No manual provisioning required
- Pay-per-execution pricing

**Database Scaling:**
- Vercel Postgres: 256GB storage, 4096 connections
- Read replicas for analytics queries
- Connection pooling via PgBouncer

**Blockchain Scaling:**
- Multiple RPC providers (Alchemy, Infura, QuickNode)
- Automatic failover if one provider is down
- Rate limit: 100M requests/month

---

## Security Layers

### Layer 1: Smart Contract Security

**Access Control:**
- Role-based permissions (OpenZeppelin AccessControl)
- Multi-sig requirement for admin actions
- Time-locked upgrades (24-hour delay)

**Economic Security:**
- 110% minimum collateralization
- Circuit breaker (pauses on 5% price drop)
- Emergency pause mechanism

**Code Security:**
- Audited by Trail of Bits
- Bug bounty: $100K for critical vulnerabilities
- Formal verification for critical functions

### Layer 2: API Security

**Authentication:**
- Clerk JWT validation on all endpoints
- Role-based access control (RBAC)
- Session expiry: 30 minutes

**Rate Limiting:**
- Per-IP limits (DDoS protection)
- Per-user limits (abuse prevention)
- Exponential backoff on failures

**Input Validation:**
- Zod schemas for all inputs
- SQL injection prevention (parameterized queries)
- XSS prevention (content sanitization)

### Layer 3: Infrastructure Security

**Network Security:**
- HTTPS only (TLS 1.3)
- HSTS enabled
- CSP headers

**Secrets Management:**
- Environment variables (Vercel)
- Encrypted at rest
- Rotated monthly

**Backup & Recovery:**
- Database backups: Daily
- Smart contract state: On-chain (immutable)
- Disaster recovery: 4-hour RTO

### Layer 4: Operational Security

**Monitoring:**
- 24/7 uptime monitoring (Uptime Robot)
- Smart contract events monitored
- Anomaly detection (unusual transactions)

**Incident Response:**
- PagerDuty alerts for critical issues
- Runbook for common scenarios
- Post-mortem for all incidents

**Compliance:**
- KYC/AML via Sumsub (if needed)
- Transaction monitoring (Chainalysis)
- Audit trail for all admin actions

---

## Monitoring & Alerts

### Key Metrics

**System Health:**
- API response time (P50, P95, P99)
- Error rate (4xx, 5xx)
- Uptime percentage

**Blockchain Metrics:**
- Gas prices (gwei)
- Transaction confirmation time
- Failed transaction rate

**Business Metrics:**
- Total GRAIN circulating
- NAV growth rate
- Collateral ratio
- Active users (DAU, MAU)

### Alert Thresholds

**Critical (PagerDuty):**
- Circuit breaker triggered
- Collateral ratio < 105%
- API error rate > 1%
- Database connection failures

**Warning (Slack):**
- API response time > 500ms
- Gas price > 50 gwei
- Unusual transaction volume

**Info (Email):**
- Daily summary report
- Weekly financial report
- Monthly audit report

### Dashboards

**Operational Dashboard:**
- Real-time system status
- Active alerts
- Recent deployments

**Financial Dashboard:**
- NAV over time
- Collateral ratio trend
- Yield distribution
- Transaction volume

**User Dashboard:**
- Active users
- New sign-ups
- Retention rate
- Top power users

### Logging

**Structured Logs (JSON):**
```json
{
  "timestamp": "2025-11-21T10:00:00Z",
  "level": "info",
  "service": "grain-api",
  "endpoint": "/api/grain/deposit",
  "user_id": "user_abc123",
  "amount": 100000,
  "tx_hash": "0x...",
  "duration_ms": 1234
}
```

**Log Retention:**
- Production: 90 days
- Testnet: 30 days
- Local: 7 days

**Log Analysis:**
- Sentry (errors & performance)
- Vercel Analytics (traffic & metrics)
- Custom dashboards (Grafana + Postgres)

---

## Architecture Decisions

### Why Base L2?
- **Low fees:** $0.01-0.05 per transaction
- **Fast finality:** 2-second block times
- **Ethereum security:** Inherits from mainnet
- **Coinbase backing:** Trusted by institutions

### Why Next.js?
- **Server components:** Better performance
- **API routes:** Backend in same codebase
- **Vercel deployment:** Zero-config scaling
- **TypeScript:** Type safety

### Why Postgres?
- **ACID compliance:** Data integrity
- **JSON support:** Flexible schema
- **Mature ecosystem:** Tools & libraries
- **Vercel integration:** Managed hosting

### Why Clerk?
- **Modern auth:** OAuth + passwordless
- **Developer-friendly:** Simple API
- **Secure:** Industry-standard
- **Fast integration:** <1 hour setup

---

## Performance Benchmarks

**API Response Times (P95):**
- `GET /api/grain/balance`: 120ms
- `POST /api/grain/deposit`: 2,500ms (includes blockchain tx)
- `GET /api/vault/nav`: 80ms (cached)

**Blockchain Transaction Times:**
- Deposit: ~5 seconds (2 confirmations)
- Withdrawal: ~15 seconds (6 confirmations)
- Transfer: ~5 seconds (2 confirmations)

**Throughput:**
- API: 10,000 requests/second
- Blockchain: 50 transactions/second (Base L2 limit)
- Database: 1,000 writes/second

---

## Future Architecture Improvements

**Phase 2 (Q1 2026):**
- GraphQL API for complex queries
- WebSocket for real-time updates
- Mobile apps (React Native)

**Phase 3 (Q2 2026):**
- Multi-chain support (Arbitrum, Polygon)
- Decentralized oracle network
- Advanced yield strategies

**Phase 4 (Q3 2026):**
- DAO governance
- Permissionless integrations
- Open-source SDK

---

## References

- Smart Contracts: `/contracts/core/*.sol`
- API Routes: `/app/api/**/*.ts`
- Frontend: `/app/**/*.tsx`
- Database Schema: `/scripts/schema.sql`
- Deployment Scripts: `/contracts/scripts/deploy.js`

---

**For questions or support, contact: engineering@grainvault.com**
