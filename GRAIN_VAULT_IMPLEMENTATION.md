# Grain & Vault Pricing System - Implementation Guide

**Status:** ✅ Core Implementation Complete
**Version:** 1.0.0
**Date:** November 6, 2025

---

## Overview

The Grain & Vault pricing system is now fully implemented in the Wells AI codebase. This document provides a complete guide to the implementation, including architecture, usage, and next steps.

## What Was Built

### 1. Core Pricing Engine (`lib/pricing/`)

#### `types.ts` - Type Definitions
- `DealType` enum: IN_NETWORK (0.33%), SOURCED (3.3%), ORIGINATED (7%)
- `PaymentRail` enum: GRAIN, USDC, ACH, WIRE, CARD
- `WalletStatus` interface: Tracks GRAIN wallet info
- `DealContext` interface: Context for deal type inference
- `FeeBreakdown` interface: Complete fee breakdown
- `SavingsCalculation` interface: Shows savings opportunities
- `GrainPriceInfo` interface: GRAIN token pricing info
- `CreditLineInfo` interface: Credit line details
- `PricingConfig` interface: Global configuration

#### `config.ts` - Configuration
- **Fee Rates:**
  - In-Network: 0.33% (33 bps)
  - Sourced: 3.3%
  - Originated: 7%
- **Rail Costs:** Pass-through pricing for each payment method
- **Pricing Guardrails:** Minimum fees, monthly minimums, caps
- **Requirements:** What's needed for each tier
- **Tithe Config:** 10% to Adullam Fund (non-negotiable)
- **Treasury Config:** Float investment strategy (target 10% APY)
- **Credit Line Config:** 3-tier system (1:1, 1.5:1, 2:1 leverage)
- **Wallet Config:** Base L2 addresses and settings
- **Feature Flags:** Gradual rollout controls

#### `calculator.ts` - Fee Calculation
- `calculateFee()` - Calculate complete fee breakdown
- `inferDealType()` - Auto-detect deal type from context
- `calculateSavings()` - Show savings if they went in-network
- `calculateGrainPrice()` - GRAIN token price tracking
- `estimateMonthlyFees()` - Project total cost of ownership
- `formatFeeBreakdown()` - Human-readable fee display

#### `validation.ts` - Validation & Guardrails
- `validatePricing()` - Validate fee calculations
- `validateInNetworkRequirements()` - Check in-network eligibility
- `validateSourcedRequirements()` - Check sourced eligibility
- `validateOriginatedRequirements()` - Check originated eligibility
- `validateDealType()` - Ensure deal type is appropriate
- `validateWallet()` - Check wallet health
- `validateMonthlyMinimum()` - Check monthly platform minimum

#### `tithe.ts` - Tithe System
- `calculateTithe()` - 10% of gross Wells fee
- `distributeFees()` - Split fees between Adullam, Wells, rail
- `createTitheRecord()` - Log tithe for transparency
- `executeTitheTransfer()` - Transfer to Adullam Fund
- `getTitheSummary()` - Summary statistics
- `generateTitheReport()` - Public transparency report
- `projectTithe()` - Estimate future tithes

### 2. Wallet Manager (`lib/wallet/`)

#### `manager.ts` - Wallet Operations
- `createWallet()` - Create GRAIN wallet on Base L2
- `fundWallet()` - Deposit USDC, optionally swap to GRAIN
- `getWalletBalance()` - Query current balances
- `calculateCreditLine()` - Determine credit multiplier & terms
- `swapTokens()` - Swap USDC <-> GRAIN on Base L2 DEX
- `autoSwapIfNeeded()` - Maintain minimum GRAIN balance
- `verifyWallet()` - Complete KYB verification
- `formatWalletInfo()` - Display wallet details
- `formatCreditLineInfo()` - Display credit line status

### 3. API Endpoints (`app/api/`)

#### `POST /api/pricing/estimate`
Estimate fees before transaction.

**Request:**
```json
{
  "amount": 100000,  // cents
  "dealType": "originated",  // optional, auto-inferred if omitted
  "rail": "ach",
  "context": {  // optional, for auto-inference
    "buyer": { "userId": "...", "wallet": {...} },
    "seller": { "userId": "...", "wallet": {...} },
    "platformMatched": true,
    "wellsNegotiated": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "breakdown": {
    "transactionAmount": 100000,
    "dealType": "originated",
    "wellsFeeGross": 7000,
    "titheAmount": 700,
    "wellsFeeNet": 6300,
    "railCost": 5,
    "totalCharge": 7005,
    "effectiveRate": 7.005
  },
  "savings": {
    "currentFee": 7005,
    "inNetworkFee": 335,
    "savingsAmount": 6670,
    "requirements": ["Create GRAIN wallet for buyer", "..."]
  }
}
```

#### `POST /api/wallet/create`
Create a GRAIN wallet for authenticated user.

**Request:**
```json
{
  "email": "user@example.com",
  "businessName": "Acme Corp",
  "initialDepositUSDC": 50000  // optional, in cents
}
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "address": "0x...",
    "grainBalance": 0,
    "usdcBalance": 50000,
    "isVerified": false,
    "creditLineAvailable": 50000
  },
  "message": "Wallet created successfully..."
}
```

#### `GET /api/wallet/balance?address=0x...`
Get wallet balance and credit line info.

**Response:**
```json
{
  "success": true,
  "wallet": {
    "address": "0x...",
    "grainBalance": 10000,
    "usdcBalance": 50000,
    "isVerified": true,
    "creditLineAvailable": 75000,
    "creditLineUsed": 0
  },
  "creditLine": {
    "tier": 2,
    "creditMultiplier": 1.5,
    "creditLineTotal": 75000,
    "creditAvailable": 75000,
    "interestRate": 0.06,
    "daysUntilInterest": 45
  }
}
```

#### `POST /api/wallet/fund`
Fund wallet with USDC.

**Request:**
```json
{
  "walletAddress": "0x...",
  "amountUSDC": 10000,  // cents
  "autoSwapToGrain": true
}
```

#### `POST /api/transactions/create`
Create transaction with fee distribution.

**Request:**
```json
{
  "amount": 100000,
  "dealType": "in_network",
  "rail": "grain",
  "buyerId": "user_...",
  "sellerId": "user_...",
  "context": {...}
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "txn_...",
  "breakdown": {...},
  "distribution": {
    "titheAmount": 33,
    "titheWallet": "0x...",
    "wellsNetAmount": 297,
    "wellsWallet": "0x..."
  },
  "titheRecord": {
    "status": "completed",
    "transactionHash": "0x..."
  }
}
```

### 4. React Component (`app/components/`)

#### `FeeEstimator.tsx`
Interactive fee estimator with savings calculator.

**Features:**
- Input transaction amount
- Select deal type and payment rail
- Real-time fee calculation
- Shows complete breakdown
- Displays savings opportunity
- Shows requirements for in-network
- Tithe transparency display
- Pricing tiers comparison table
- Call-to-action for wallet creation

**Usage:**
```tsx
import FeeEstimator from '@/app/components/FeeEstimator'

export default function PricingPage() {
  return <FeeEstimator />
}
```

---

## Architecture

### Fee Calculation Flow

```
1. User initiates transaction
   ↓
2. System determines deal type
   - Checks wallet status (both parties)
   - Checks verification status
   - Checks platform matching
   - Checks Wells negotiation
   ↓
3. Calculator computes fees
   - Wells fee (0.33%, 3.3%, or 7%)
   - Tithe (10% of Wells fee)
   - Rail costs (pass-through)
   ↓
4. Validation checks
   - Minimum fee floor ($25)
   - Tithe accuracy (exactly 10%)
   - Requirements met for tier
   ↓
5. Fee distribution
   - 10% to Adullam Fund
   - 90% to Wells Treasury
   - Rail costs to provider
   ↓
6. Transaction execution
   - Transfer funds via Circle or smart contract
   - Update credit lines
   - Log tithe for transparency
```

### Credit Line Flow

```
1. User deposits USDC
   ↓
2. System calculates tier
   - Tier 1: 1:1 leverage (new users)
   - Tier 2: 1.5:1 leverage (3+ months)
   - Tier 3: 2:1 leverage (12+ months)
   ↓
3. Credit line opened
   - Based on deposit × multiplier
   - Interest-free period (30-60 days)
   - APR after period (5-8%)
   ↓
4. User makes payment with credit
   - Credit line reduced
   - No additional deposit needed
   ↓
5. User repays credit
   - Deposit USDC to vault
   - Credit line restored
   - Cycle continues
```

### Treasury Yield Flow

```
1. User deposits collateral (USDC)
   ↓
2. Vault mints GRAIN (1:1)
   ↓
3. Treasury invests float
   - 65% conservative (Aave/Compound: 4.5% APY)
   - 25% moderate (Uniswap LP: 12.5% APY)
   - 10% aggressive (RWA: 15% APY)
   - Blended target: 10% APY
   ↓
4. Yield accumulates
   - Revenue without transaction fees
   - Maintains 110% collateralization
   ↓
5. User withdraws
   - Burns GRAIN
   - Returns USDC from vault
   - Exit any time (liquidity preserved)
```

---

## Integration Points

### Existing Systems

The Grain & Vault system integrates with:

1. **Circle Payments** (`lib/circle-payments.ts`)
   - Uses Circle API for USDC transfers
   - Wallet creation via Circle
   - Fiat on/off-ramps

2. **Seller Onboarding** (`lib/seller-onboarding.ts`)
   - Add wallet creation step
   - Show in-network pricing incentive
   - Display potential savings

3. **Fee Structure** (`lib/fee-structure.ts`)
   - Existing 0.33%/3.3%/7% rates
   - Can be replaced or run in parallel
   - Smooth migration path

4. **Transactions** (`lib/transactions.ts`)
   - Transaction logging
   - Fee tracking
   - Audit trail

5. **Audit Ledger** (`lib/audit-ledger.ts`)
   - Tithe transparency records
   - Fee distribution logs
   - Compliance reporting

### Smart Contracts (Future)

When smart contracts are deployed:

1. **Grain Token Contract** (ERC-20 on Base L2)
   - Mint/burn controlled by Vault
   - Freeze/unfreeze for compliance
   - Standard ERC-20 transfers

2. **Grain Vault Contract**
   - USDC collateral management
   - GRAIN minting/burning
   - Credit line tracking
   - Multi-sig controls
   - Treasury yield strategies

3. **Base L2 Integration**
   - Low gas fees ($0.01-$0.50 per tx)
   - Fast finality (2-5 seconds)
   - Coinbase backing
   - DEX for USDC/GRAIN swaps

---

## Usage Examples

### Basic Fee Calculation

```typescript
import { calculateFee } from '@/lib/pricing/calculator'
import { DealType, PaymentRail } from '@/lib/pricing/types'

// Calculate fee for $1,000 originated deal via ACH
const breakdown = calculateFee(
  100000,  // $1,000 in cents
  DealType.ORIGINATED,
  PaymentRail.ACH
)

console.log(breakdown)
// {
//   wellsFeeGross: 7000,  // $70 (7%)
//   titheAmount: 700,     // $7 (10% of $70)
//   wellsFeeNet: 6300,    // $63 (to Wells)
//   railCost: 5,          // $0.05 (ACH capped at $5)
//   totalCharge: 7005,    // $70.05 total
//   effectiveRate: 7.005  // 7.005%
// }
```

### Auto-Infer Deal Type

```typescript
import { inferDealType, calculateFee } from '@/lib/pricing/calculator'

const context = {
  amount: 100000,
  buyer: {
    userId: 'user_123',
    wallet: {
      address: '0x...',
      grainBalance: 50000,
      usdcBalance: 10000,
      isVerified: true,
      creditLineAvailable: 50000,
      creditLineUsed: 0,
      createdAt: '2024-01-01'
    }
  },
  seller: {
    userId: 'user_456',
    wallet: {
      address: '0x...',
      grainBalance: 20000,
      usdcBalance: 5000,
      isVerified: true,
      creditLineAvailable: 20000,
      creditLineUsed: 0,
      createdAt: '2024-01-01'
    }
  },
  platformMatched: false,
  wellsNegotiated: false
}

// Auto-infer: Both have wallets + verified = IN_NETWORK
const dealType = inferDealType(context)
console.log(dealType)  // 'in_network'

const breakdown = calculateFee(100000, dealType, PaymentRail.GRAIN)
console.log(breakdown.wellsFeeGross)  // 330 ($3.30 at 0.33%)
```

### Calculate Savings

```typescript
import { calculateSavings } from '@/lib/pricing/calculator'

// Show how much they'd save by going in-network
const savings = calculateSavings(
  100000,  // $1,000
  DealType.ORIGINATED,  // Currently paying 7%
  PaymentRail.ACH
)

console.log(savings)
// {
//   currentFee: 7005,
//   inNetworkFee: 335,
//   savingsAmount: 6670,      // Save $66.70!
//   savingsPercentage: 95.2,  // 95% savings
//   requirements: [
//     'Create GRAIN wallet for buyer',
//     'Create GRAIN wallet for seller',
//     'Complete KYB verification for buyer',
//     'Complete KYB verification for seller'
//   ],
//   callToAction: 'Save $66.70 on this transaction...'
// }
```

### Validate Pricing

```typescript
import { validatePricing } from '@/lib/pricing/validation'

const validation = validatePricing(breakdown)

if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
  // Handle errors
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings)
  // Show warnings to user
}
```

### Create Wallet

```typescript
import { createWallet } from '@/lib/wallet/manager'

const result = await createWallet({
  userId: 'user_123',
  email: 'buyer@acme.com',
  businessName: 'Acme Corp',
  initialDepositUSDC: 50000  // $500
})

if (result.success) {
  console.log('Wallet:', result.wallet)
  // wallet.address: '0x...'
  // wallet.creditLineAvailable: 50000 (1:1 leverage)
}
```

### Calculate Credit Line

```typescript
import { calculateCreditLine } from '@/lib/wallet/manager'

const creditLine = await calculateCreditLine(
  'user_123',
  50000  // $500 deposited
)

console.log(creditLine)
// {
//   tier: 1,
//   creditMultiplier: 1.0,
//   creditLineTotal: 50000,    // $500 credit (1:1)
//   creditAvailable: 50000,
//   interestRate: 0.08,         // 8% APR
//   daysUntilInterest: 30,      // 30 days interest-free
//   upgradeRequirements: [...]
// }
```

### Distribute Fees

```typescript
import { distributeFees, executeTitheTransfer } from '@/lib/pricing/tithe'

const distribution = distributeFees(breakdown, 'txn_123')

console.log(distribution)
// {
//   titheAmount: 700,              // $7 to Adullam
//   titheWallet: '0x...',
//   wellsNetAmount: 6300,          // $63 to Wells
//   wellsWallet: '0x...',
//   railCost: 5,                   // $0.05 to ACH provider
//   distributions: [...]
// }

// Execute tithe transfer
const titheRecord = createTitheRecord('txn_123', breakdown)
const result = await executeTitheTransfer(titheRecord)

console.log(result.transactionHash)  // On-chain proof
```

---

## Environment Variables

Add these to your `.env` file:

```bash
# Grain & Vault Pricing System
ADULLAM_WALLET_ADDRESS=0x...  # Base L2 wallet for 10% tithe
WELLS_TREASURY_WALLET=0x...    # Base L2 wallet for Wells net fees
GRAIN_VAULT_ADDRESS=0x...      # Grain Vault smart contract address
GRAIN_TOKEN_ADDRESS=0x...      # GRAIN ERC-20 token address on Base L2

# Feature Flags
GRAIN_ENABLED=false            # Enable GRAIN payments
CREDIT_LINES_ENABLED=false     # Enable credit lines
TREASURY_YIELD_ENABLED=false   # Enable treasury yield
IN_NETWORK_ENABLED=false       # Enable in-network pricing
```

---

## Next Steps

### Phase 1: Testing & Refinement (Weeks 1-2)
- [ ] Add unit tests for calculator
- [ ] Add integration tests for API endpoints
- [ ] Test FeeEstimator component thoroughly
- [ ] Add error handling and edge cases
- [ ] Performance optimization
- [ ] Security audit of validation logic

### Phase 2: Database Integration (Weeks 3-4)
- [ ] Create database schema for wallets
- [ ] Create schema for transactions
- [ ] Create schema for tithe records
- [ ] Create schema for credit lines
- [ ] Add PostgreSQL queries
- [ ] Migration scripts

### Phase 3: Smart Contracts (Months 2-3)
- [ ] Design Grain token contract (ERC-20)
- [ ] Design Grain Vault contract
- [ ] Write Solidity code
- [ ] Unit tests in Hardhat
- [ ] Deploy to Base Sepolia testnet
- [ ] External audit (Trail of Bits or OpenZeppelin)
- [ ] Fix audit findings
- [ ] Deploy to Base mainnet

### Phase 4: Circle Integration (Month 4)
- [ ] Integrate Circle wallet creation
- [ ] Integrate Circle USDC transfers
- [ ] Test fiat on-ramps
- [ ] Test fiat off-ramps
- [ ] Multi-currency support

### Phase 5: Treasury Yield (Month 5)
- [ ] Integrate with Aave for USDC staking
- [ ] Integrate with Uniswap for LP yields
- [ ] Integrate with Ondo/Maple for RWA yields
- [ ] Automated rebalancing
- [ ] Monitoring dashboard

### Phase 6: Beta Launch (Month 6)
- [ ] Select 10 beta customers
- [ ] White-glove onboarding
- [ ] Monitor closely
- [ ] Gather feedback
- [ ] Iterate based on learnings

### Phase 7: Public Launch (Month 7+)
- [ ] Open to all Wells AI customers
- [ ] Marketing campaign
- [ ] Wallet creation in onboarding
- [ ] Credit line underwriting automation
- [ ] Scale to $50M+ float

---

## Key Files Reference

### Core Pricing
- `lib/pricing/types.ts` - Type definitions
- `lib/pricing/config.ts` - Configuration
- `lib/pricing/calculator.ts` - Fee calculation
- `lib/pricing/validation.ts` - Validation
- `lib/pricing/tithe.ts` - Tithe system

### Wallet Management
- `lib/wallet/manager.ts` - Wallet operations

### API Endpoints
- `app/api/pricing/estimate/route.ts` - Fee estimation
- `app/api/wallet/create/route.ts` - Wallet creation
- `app/api/wallet/balance/route.ts` - Balance queries
- `app/api/wallet/fund/route.ts` - Wallet funding
- `app/api/transactions/create/route.ts` - Transaction creation

### UI Components
- `app/components/FeeEstimator.tsx` - Fee calculator component

### Documentation
- `GRAIN_TOKENOMICS.md` - Full tokenomics strategy
- `GRAIN_VAULT_IMPLEMENTATION.md` - This file

---

## Support & Questions

For questions about the implementation:
- **Technical:** Review code comments in each file
- **Strategy:** See `GRAIN_TOKENOMICS.md`
- **Integration:** See "Integration Points" section above

---

**Built with faith and excellence.** 🙏

*"The fear of the Lord is the beginning of wisdom." - Proverbs 9:10*
