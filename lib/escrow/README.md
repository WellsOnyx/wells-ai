# Escrow System

Secure USDC escrow for deal payments with Circle integration. Holds funds until delivery confirmation.

## Features

- **USDC Escrow**: Secure funds in dedicated Circle wallets
- **Multi-stage Milestones**: Break deals into phases with approval workflow
- **Dispute Resolution**: Built-in dispute system with arbitration
- **Circle Integration**: Real USDC transfers on Base L2 blockchain
- **Automatic Release**: Release funds upon delivery confirmation
- **Refund Support**: Full or partial refunds to buyers

## Database Schema

Run the schema creation:

```bash
psql $POSTGRES_URL < scripts/schema-escrow.sql
```

This creates:
- `escrow_deals` - Main escrow table
- `escrow_milestones` - Multi-stage payment milestones
- `escrow_disputes` - Dispute resolution
- `escrow_transactions` - All fund movements

## API Endpoints

### Create Escrow

```
POST /api/escrow/create
```

**Request:**
```json
{
  "dealId": "deal_123",
  "buyerId": "user_buyer",
  "buyerEmail": "buyer@example.com",
  "sellerId": "user_seller",
  "sellerEmail": "seller@example.com",
  "amount": 1000,
  "platformFee": 25,
  "description": "Website development",
  "milestones": [
    {
      "title": "Design Phase",
      "description": "Wireframes and mockups",
      "amount": 400,
      "deliverables": ["Figma designs", "Style guide"]
    },
    {
      "title": "Development Phase",
      "description": "Frontend implementation",
      "amount": 600,
      "deliverables": ["Deployed website", "Source code"]
    }
  ]
}
```

**Response:**
```json
{
  "escrow": {
    "id": "escrow_deal_123_1234567890",
    "escrowWalletAddress": "0x...",
    "status": "created"
  },
  "depositInstructions": {
    "walletAddress": "0x...",
    "amount": 1025,
    "currency": "USDC",
    "network": "BASE"
  }
}
```

### Fund Escrow

```
POST /api/escrow/[id]/fund
```

**Request:**
```json
{
  "paymentDetails": {
    "fromWalletId": "circle_wallet_123",
    "transactionHash": "0x..."
  }
}
```

### Release Funds

```
POST /api/escrow/[id]/release
```

**Request:**
```json
{
  "milestoneId": "milestone_123", // Optional - for milestone releases
  "amount": 500, // Optional - for partial releases
  "notes": "Great work!"
}
```

### File Dispute

```
POST /api/escrow/[id]/dispute
```

**Request:**
```json
{
  "reason": "Quality issues",
  "description": "Deliverables do not match agreed specifications",
  "evidence": ["https://...", "https://..."]
}
```

### Refund

```
POST /api/escrow/[id]/refund
```

**Request:**
```json
{
  "amount": 500, // Optional - defaults to full amount
  "reason": "Project cancelled"
}
```

### Milestone Management

**Complete Milestone (Seller):**
```
POST /api/escrow/[id]/milestones/[milestoneId]/complete
```

**Approve Milestone (Buyer):**
```
POST /api/escrow/[id]/milestones/[milestoneId]/approve
```

**Reject Milestone (Buyer):**
```
POST /api/escrow/[id]/milestones/[milestoneId]/reject
```

## Escrow Flow

### Single-Stage Deal

1. **Create Escrow** - Buyer accepts deal, escrow created
2. **Fund Escrow** - Buyer deposits USDC to escrow wallet
3. **Work Begins** - Seller delivers work
4. **Release** - Buyer confirms delivery, funds released to seller

### Multi-Stage Deal (Milestones)

1. **Create Escrow** - With milestone breakdown
2. **Fund Escrow** - Full amount deposited
3. **Milestone 1:**
   - Seller completes milestone
   - Buyer approves
   - Funds released for milestone 1
4. **Milestone 2:**
   - Repeat process
5. **Complete** - All milestones released

### Dispute Flow

1. Either party files dispute
2. Escrow status → `disputed`
3. Evidence submitted
4. Arbitration (manual or automated)
5. Resolution → Full refund, full release, or split

## Code Example

```typescript
import { createEscrow, fundEscrow, releaseEscrow } from '@/lib/escrow'

// Create escrow
const escrow = await createEscrow({
  dealId: 'deal_123',
  buyerId: 'buyer_123',
  buyerEmail: 'buyer@example.com',
  sellerId: 'seller_456',
  sellerEmail: 'seller@example.com',
  amount: 1000,
  platformFee: 25,
  description: 'Website development',
})

// Fund escrow (after buyer sends USDC)
const funded = await fundEscrow(escrow.id, {
  paymentDetails: {
    fromWalletId: 'buyer_wallet_id',
    transactionHash: '0x...',
  },
})

// Release to seller (after delivery)
const released = await releaseEscrow(escrow.id, {}, buyerId)
```

## Circle Integration

The escrow system uses Circle's Programmable Wallets API:

- **Base L2** blockchain for low fees
- **USDC** stablecoin for payments
- **Real-time transfers** with on-chain settlement
- **Wallet generation** for each escrow
- **Transaction tracking** via Circle API

## Security Features

1. **Dedicated Wallets** - Each escrow has isolated Circle wallet
2. **Authorization Checks** - Only parties can access escrow
3. **Status Guards** - Strict state machine for escrow lifecycle
4. **Amount Validation** - Ensures correct funding before release
5. **Audit Trail** - All transactions logged in database

## Status Lifecycle

```
created → funded → released
                 ↘ disputed → refunded
                            ↘ resolved → released
```

## Database Views

### Escrow Dashboard
```sql
SELECT * FROM escrow_dashboard;
```

Shows active escrows with milestone progress and transaction counts.

### Pending Approvals
```sql
SELECT * FROM pending_milestone_approvals;
```

Lists completed milestones awaiting buyer approval.
