# GRAIN Secondary Lending Market

A DeFi lending market that allows GRAIN holders to lend their GRAIN to back others' mortgages, earning yield while their GRAIN is locked as collateral.

## Concept

When someone takes a GRAIN-backed mortgage:
1. Their GRAIN is locked as collateral (e.g., 50% LTV = $100K GRAIN for $50K loan)
2. The REMAINING 50% of their GRAIN is ALSO locked by default (secondary lock)
3. UNLESS another GRAIN holder agrees to "back" the loan by lending their GRAIN
4. If they get backing, they can access their remaining GRAIN

This creates a secondary market where:
- GRAIN holders can lend their GRAIN to back others' mortgages
- Lenders earn yield (portion of interest or flat fee)
- Borrowers can unlock their remaining GRAIN or get higher LTV
- All GRAIN (borrower's + lender's) stays locked until loan repayment

## Example Flow

1. **Alice** has 100K GRAIN, wants $50K mortgage
2. System locks ALL 100K GRAIN (50K primary, 50K secondary lock)
3. Alice sees: "Your remaining 50K GRAIN is locked. Find backers to unlock."
4. **Bob** has 50K GRAIN in lending pool at 2% APR
5. Alice accepts Bob's backing
6. Bob's 50K GRAIN locked, Alice's secondary 50K unlocked
7. Alice pays mortgage, Bob earns 2% on his locked GRAIN
8. Loan paid off → Bob's GRAIN unlocked with earnings

## Database Schema

### Tables

- **grain_lending_pool**: Lenders offering GRAIN for backing loans
- **grain_collateral_locks**: All locked GRAIN tracking (both collateral and backing)
- **grain_lending_matches**: Matches between GRAIN lenders and loan borrowers
- **grain_lender_earnings**: Historical earnings paid to GRAIN lenders

See `/scripts/schema-grain-lending-market.sql` for full schema.

## API Endpoints

### Pool Management

- `GET /api/grain-market/pool` - List all active lending pools
  - Query params: `status`, `lender_id`, `min_amount`, `loan_type`
- `POST /api/grain-market/pool` - Create a new lending pool
- `GET /api/grain-market/pool/[id]` - Get pool details
- `PATCH /api/grain-market/pool/[id]` - Update pool status
- `DELETE /api/grain-market/pool/[id]` - Withdraw GRAIN from pool

### Matching

- `POST /api/grain-market/match` - Find or accept backing
  - `action: 'find'` - Find available backers for a loan
  - `action: 'accept'` - Accept a specific backer

### Loan Backing

- `GET /api/grain-market/loans/[loanId]/backing` - Get backing details for a loan
- `POST /api/grain-market/loans/[loanId]/backing` - Process loan payment or release collateral
  - `action: 'payment'` - Distribute earnings from loan payment
  - `action: 'release'` - Release collateral when loan is paid off

### Earnings

- `GET /api/grain-market/earnings` - Get lender earnings and performance
  - `action: 'stats'` - Global pool statistics
  - `action: 'performance'` - Lender-specific performance (requires `lender_id`)
  - `action: 'history'` - Detailed earnings history (requires `lender_id`)

## Core Functions

See `/lib/lending/grain-market.ts`:

- `listGrainForLending()` - Create a lending pool
- `findBackersForLoan()` - Find available backers for a loan
- `acceptBacking()` - Accept backing from a lender
- `processLenderEarnings()` - Distribute earnings when borrower makes payment
- `releaseLenderCollateral()` - Release all collateral when loan is paid
- `getLendingPoolStats()` - Get global market statistics
- `getLenderPerformance()` - Get lender's performance and earnings
- `updatePoolStatus()` - Pause/activate a pool
- `withdrawFromPool()` - Withdraw available GRAIN
- `approvePendingMatch()` - Approve a pending backing request

## UI Pages

### Landing Page (`/grain-market`)
- Market statistics (total pooled, active pools, avg APR, earnings)
- How it works explanation
- List of active lending pools
- Best rates shown first

### Lend Page (`/grain-market/lend`)
- Create a new lending pool
- Set terms: amount, rate, loan types, LTV, terms
- Auto-approve option for instant matching

### Dashboard (`/grain-market/dashboard`)
- Lender performance overview
- Manage lending pools (pause/activate)
- View active matches
- Earnings history

## Usage Example

### As a Lender

```typescript
// 1. Create a lending pool
const result = await fetch('/api/grain-market/pool', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lender_id: 'bob@example.com',
    lender_email: 'bob@example.com',
    lender_name: 'Bob',
    grain_amount: 50000,
    annual_rate: 2.0,
    max_ltv: 80,
    auto_approve: true,
    accepted_loan_types: ['mortgage', 'auto']
  })
});

// 2. View your performance
const dashboard = await fetch(
  '/api/grain-market/earnings?action=performance&lender_id=bob@example.com'
);
```

### As a Borrower

```typescript
// 1. Find available backers
const backers = await fetch('/api/grain-market/match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'find',
    loan_id: 'loan-123',
    grain_needed: 50000,
    loan_type: 'mortgage',
    loan_amount: 50000,
    term_months: 360,
    ltv: 50
  })
});

// 2. Accept a backer
const match = await fetch('/api/grain-market/match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'accept',
    loan_id: 'loan-123',
    lender_pool_id: 'pool-456',
    borrower_id: 'alice@example.com',
    borrower_email: 'alice@example.com',
    grain_backed: 50000,
    term_months: 360,
    secondary_lock_id: 'lock-789' // The lock to release
  })
});
```

### Processing Payments

```typescript
// When borrower makes a loan payment
const result = await fetch('/api/grain-market/loans/loan-123/backing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'payment',
    payment_amount: 1000
  })
});

// When loan is paid off
const release = await fetch('/api/grain-market/loans/loan-123/backing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'release'
  })
});
```

## Key Features

1. **Auto-Approve**: Lenders can enable instant matching without manual approval
2. **Flexible Terms**: Set your own rates, loan types, LTV limits, and terms
3. **Real-time Earnings**: Earnings calculated and distributed with each payment
4. **Collateral Tracking**: Complete visibility into locked GRAIN
5. **Performance Analytics**: Detailed dashboard with earnings history
6. **Multi-Lender Support**: Multiple lenders can back a single loan
7. **Smart Matching**: Automatic matching based on loan requirements

## Security Considerations

- All GRAIN locks are tracked in `grain_collateral_locks`
- Borrower's secondary lock only releases when lender's GRAIN locks
- Atomic operations ensure consistency
- Status checks prevent double-locking
- Owner verification on all operations

## Installation

1. Run the schema migration:
```bash
psql $DATABASE_URL -f scripts/schema-grain-lending-market.sql
```

2. Ensure environment variables are set:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Navigate to `/grain-market` to start using the platform

## Future Enhancements

- Rating system for lenders
- Insurance pools for default protection
- Secondary market for trading locked positions
- Automated rebalancing
- Dynamic rate adjustment based on demand
- Integration with external GRAIN price feeds
