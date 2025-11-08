# GRAIN Tokenomics V2 - Auto-Appreciating Float Model

**Date:** November 8, 2025
**Status:** CORRECTED - Building the right way

---

## The Breakthrough: GRAIN Appreciates Automatically

### ❌ Old Wrong Model (8% APY Distribution)
```
User deposits $100K → Gets 100K GRAIN
We pay 8% APY → User has 108K GRAIN after 1 year
Problem: We're PAYING out yield (negative cash flow)
```

### ✅ New Correct Model (Float Investment + Appreciation)
```
User deposits $100K → Gets 100K GRAIN
We invest the $100K float → Earns yield
GRAIN value increases → 100K GRAIN now worth $104.5K
Problem: SOLVED - We're EARNING on float (positive cash flow)
```

---

## How It Actually Works

### The Virtuous Cycle

**Day 1:**
- Total deposits: $10M USDC
- GRAIN supply: 10M GRAIN
- **GRAIN price: $1.00** (1:1 with USDC)
- Float invested: $10M @ 4.5% APY (Circle USDC)

**Day 365 (1 Year Later):**
- Total deposits: $10M USDC (same)
- Circle yield earned: $450K (4.5% on $10M)
- **Total reserves: $10.45M**
- GRAIN supply: 10M GRAIN (unchanged)
- **GRAIN price: $1.045** (auto-appreciation!)

**User Experience:**
- User deposited 100K GRAIN (was $100K)
- User now has 100K GRAIN (worth $104.5K)
- **User gained $4.5K without doing anything**
- User can cash out for $104.5K anytime

---

## The Math: Why This Works

### Traditional Stablecoin (USDC)
```
Reserves: $10M
Supply: 10M USDC
Price: $1.00 (always)

Circle earns 4.5% on $10M = $450K/year
Circle keeps all $450K (profit)
Users get: $0
```

### GRAIN (Auto-Appreciating)
```
Reserves: $10M → $10.45M (after 1 year)
Supply: 10M GRAIN (constant)
Price: $10.45M / 10M = $1.045

GRAIN holders earn: 4.5% value appreciation
Wells earns: Transaction fees (0.33%)
Everyone wins
```

---

## Revenue Model (Corrected)

### Phase 1: Circle Integration (Launch)

**Float Yield:**
- Circle USDC earns 4.5% APY automatically
- 100% passes through to GRAIN holders (auto-appreciation)
- Wells takes 0% of float yield

**Transaction Fees:**
- 0.33% on all GRAIN transactions
- This is our revenue
- Example: $100M GMV → $330K revenue

**Platform Revenue:**
```
Transaction fees: 0.33% of GMV
Escrow fees: 0.5% on large deals
Service fees: Custom enterprise features
```

**User Value:**
```
GRAIN appreciation: 4.5%/year (from Circle)
Zero transaction fees (vs 2.8% cards)
Instant settlement (vs 60 days)
```

### Phase 2: Own Treasury (Future - More Leverage)

**Why Build Our Own:**
- Circle takes 4.5% from us (we pass to users)
- If we manage treasury ourselves, we can earn 7-10%
- Higher yield to GRAIN holders = more value = more adoption

**Example Treasury Strategy:**
```
Tier 1 (80%): Ultra-safe, liquid
  - US Treasuries: 5.3% APY
  - Money market: 5.0% APY
  - Corporate bonds (AAA): 5.5% APY
  Average: 5.3%

Tier 2 (15%): Safe, productive
  - DeFi yield (Aave): 6-8% APY
  - Staked ETH: 4% APY
  Average: 7%

Tier 3 (5%): Strategic investments
  - Early-stage equity
  - Real estate
  - Physical assets
  Target: 15%+ long-term

Blended yield: ~6.5%/year
GRAIN appreciates 6.5% instead of 4.5%
```

**With Leverage (2:1):**
```
If we leverage 2:1 on safe assets:
- Borrow at 3% (low risk)
- Earn at 5.3% (Treasuries)
- Net spread: 2.3%
- Leveraged yield: 5.3% + 2.3% = 7.6%

GRAIN appreciates 7.6%/year
Becomes THE place to hold B2B capital
```

---

## Smart Contract Design (Corrected)

### Grain.sol - Auto-Appreciating Value

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVault {
    function getTotalReserves() external view returns (uint256);
}

contract Grain is ERC20 {
    IVault public vault;

    // GRAIN balance is constant, but VALUE increases
    function balanceOf(address account) public view override returns (uint256) {
        return super.balanceOf(account); // Unchanged
    }

    // The magic: GRAIN price increases as reserves grow
    function getGrainPrice() public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) return 1e6; // $1.00 (6 decimals)

        uint256 totalReserves = vault.getTotalReserves();
        // Price = Total Reserves / Total Supply
        return (totalReserves * 1e6) / totalSupply;
    }

    // Redeem GRAIN for USDC at current price
    function redeem(uint256 grainAmount) external {
        uint256 price = getGrainPrice();
        uint256 usdcAmount = (grainAmount * price) / 1e6;

        _burn(msg.sender, grainAmount);
        vault.withdraw(msg.sender, usdcAmount);
    }

    // Deposit USDC for GRAIN at current price
    function deposit(uint256 usdcAmount) external {
        uint256 price = getGrainPrice();
        uint256 grainAmount = (usdcAmount * 1e6) / price;

        vault.deposit(msg.sender, usdcAmount);
        _mint(msg.sender, grainAmount);
    }
}
```

### Vault.sol - Reserve Management

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault {
    IERC20 public usdc;

    // Circle USDC Yield Account (Phase 1)
    address public circleYieldAccount;

    // Track reserves
    uint256 public totalDeposits;
    uint256 public yieldEarned;

    function getTotalReserves() external view returns (uint256) {
        // Phase 1: Query Circle balance
        uint256 circleBalance = usdc.balanceOf(circleYieldAccount);

        // Total reserves = principal + yield
        return circleBalance;
    }

    function deposit(address from, uint256 amount) external {
        usdc.transferFrom(from, circleYieldAccount, amount);
        totalDeposits += amount;
    }

    function withdraw(address to, uint256 amount) external {
        // Withdraw from Circle USDC account
        // Circle automatically handles yield
        usdc.transferFrom(circleYieldAccount, to, amount);
    }

    // Update yield (Circle does this automatically)
    function syncYield() external {
        uint256 currentBalance = usdc.balanceOf(circleYieldAccount);
        yieldEarned = currentBalance - totalDeposits;
    }
}
```

---

## Circle Integration (Phase 1)

### Circle Business Account Features

**What Circle Provides:**
- USDC deposits earn 4.5% APY automatically
- No manual yield distribution needed
- Balance increases daily
- Instant liquidity (can withdraw anytime)
- Regulatory compliant (licensed money transmitter)

**Integration:**
```typescript
// lib/grain-vault/circle.ts

import { Circle, CircleEnvironment } from '@circle-fin/circle-sdk'

const circle = new Circle({
  apiKey: process.env.CIRCLE_API_KEY,
  environment: CircleEnvironment.production
})

// Get current USDC balance (includes yield)
export async function getCircleBalance(): Promise<number> {
  const wallet = await circle.wallets.get(CIRCLE_WALLET_ID)
  const usdcBalance = wallet.balances.find(b => b.currency === 'USD')
  return parseFloat(usdcBalance.amount)
}

// Calculate yield earned
export async function calculateYieldEarned(): Promise<{
  totalDeposits: number
  currentBalance: number
  yieldEarned: number
  yieldRate: number
}> {
  const currentBalance = await getCircleBalance()
  const totalDeposits = await getTotalDepositsFromDB()

  const yieldEarned = currentBalance - totalDeposits
  const yieldRate = (yieldEarned / totalDeposits) * 100

  return {
    totalDeposits,
    currentBalance,
    yieldEarned,
    yieldRate
  }
}

// Deposit USDC to Circle (starts earning 4.5%)
export async function depositToCircle(amount: number): Promise<void> {
  await circle.transfers.create({
    source: { type: 'wallet', id: USER_WALLET_ID },
    destination: { type: 'wallet', id: CIRCLE_YIELD_WALLET_ID },
    amount: { amount: amount.toString(), currency: 'USD' }
  })
}
```

### GRAIN Price Calculation

```typescript
// lib/grain-vault/pricing.ts

export async function getGrainPrice(): Promise<number> {
  // Get total reserves (USDC in Circle, earning yield)
  const totalReserves = await getCircleBalance()

  // Get total GRAIN supply
  const totalSupply = await getTotalGrainSupply()

  // Price = Reserves / Supply
  const price = totalReserves / totalSupply

  return price // e.g., $1.045 after 1 year
}

export async function calculateUserValue(grainAmount: number): Promise<{
  grainAmount: number
  currentPrice: number
  usdValue: number
  yieldEarned: number
}> {
  const price = await getGrainPrice()
  const usdValue = grainAmount * price

  // Calculate yield (vs $1.00 initial price)
  const initialValue = grainAmount * 1.00
  const yieldEarned = usdValue - initialValue

  return {
    grainAmount,
    currentPrice: price,
    usdValue,
    yieldEarned
  }
}
```

---

## User Experience

### Deposit Flow
```
User: "I want to deposit $100K"

Wells AI: "I'll deposit $100K USDC to GRAIN."
  ↓
Current GRAIN price: $1.045
100K USDC = 95,694 GRAIN
  ↓
Confirm?

User: "Yes, proceed"
  ↓
✓ 95,694 GRAIN deposited
✓ Now earning 4.5% APY (auto-appreciating)
✓ Can spend or withdraw anytime
```

### Value Growth (Passive)
```
Day 1:
- Balance: 95,694 GRAIN
- GRAIN price: $1.045
- USD value: $100,000

Day 30 (1 month later):
- Balance: 95,694 GRAIN (unchanged)
- GRAIN price: $1.0489 (appreciation from yield)
- USD value: $100,373
- Earned: $373 (0.37%)

Day 365 (1 year later):
- Balance: 95,694 GRAIN (unchanged)
- GRAIN price: $1.092 (4.5% appreciation)
- USD value: $104,500
- Earned: $4,500 (4.5%)
```

### Spending Flow
```
User: "Pay supplier $50K for PCBs"

Wells AI: "I'll send 45,787 GRAIN ($50K at current price $1.092)"
  ↓
Supplier receives: 45,787 GRAIN
Supplier balance: Now earning 4.5% too
  ↓
✓ Payment complete
✓ Your balance: 49,907 GRAIN ($54,500)
✓ Still earning yield on remaining balance
```

---

## Competitive Advantage

### vs Traditional Credit Lines

**Bank Credit Line ($100K):**
- Costs: 12-18% APR ($12-18K/year)
- You pay interest
- Money locked
- 60-day payment terms

**GRAIN Credit Line ($100K):**
- Earns: 4.5% APY ($4.5K/year)
- You earn yield
- Spend anytime
- Instant settlement

**Net Difference: $16.5K - $22.5K per year in your favor**

### vs Stablecoins (USDC)

**USDC:**
- Stable at $1.00
- No yield to holders
- Circle keeps all 4.5%

**GRAIN:**
- Appreciates with reserves
- Holders get full 4.5% yield
- Circle still earns (from us), but we pass it through

### vs Payment Processors

**Stripe/Airwallex:**
- 2.8% transaction fee
- $1M GMV = $28K in fees
- No yield
- 3-7 day settlement

**GRAIN:**
- 0.33% transaction fee
- $1M GMV = $3.3K in fees
- 4.5% yield on balance
- Instant settlement

---

## Revenue Model (Corrected)

### Wells AI Revenue
```
Transaction fees: 0.33% of GMV
Escrow fees: 0.5% on large deals
Enterprise features: Custom pricing
```

### Example at Scale
```
Year 1:
  GMV: $100M
  Transaction fees (0.33%): $330K
  Escrow fees (0.5% on $50M): $250K
  Total revenue: $580K

Year 2:
  GMV: $1B
  Transaction fees: $3.3M
  Escrow fees: $5M
  Total revenue: $8.3M

Year 5:
  GMV: $10B
  Transaction fees: $33M
  Escrow fees: $50M
  Total revenue: $83M
```

**Note:** We DON'T earn from float yield. That 100% goes to GRAIN holders (appreciation).

---

## Phase 2: Own Treasury (Future)

### Why Build Our Own

**Circle Phase (Now):**
- We deposit to Circle
- Circle earns 4.5% on deposits
- Circle passes 4.5% to us (via balance growth)
- We pass 4.5% to GRAIN holders
- **We earn: $0 from float**

**Own Treasury Phase (Future):**
- We manage treasury ourselves
- We invest in Treasuries/DeFi/etc.
- We earn 6.5%+ on deposits
- We pass 6.5%+ to GRAIN holders
- **We earn: Transaction fees + potential additional leverage**

### The 2:1 Leverage Strategy

```
Scenario: $100M in GRAIN deposits

Without Leverage:
- Invest $100M @ 6.5% = $6.5M/year
- GRAIN appreciates 6.5%

With 2:1 Leverage:
- Borrow $100M @ 3% = $3M cost
- Invest $200M @ 6.5% = $13M earned
- Net: $10M/year ($13M - $3M)
- GRAIN appreciates 10%/year

User wins: Better yield
Wells wins: More AUM, more fees
Risk: Managed with safety rails
```

### Safety Rails (Circuit Breakers)

**Auto-Pause Triggers:**
1. GRAIN price drops >5% in 24h → Freeze
2. NAV drops >10% → Freeze
3. Withdrawals spike >3x average → Review
4. Collateralization <110% → Emergency replenish
5. Data source failure → Use cached values, freeze new trades

**7-Day Audit Process:**
- Day 1-2: Verify all assets
- Day 3-4: Verify liabilities
- Day 5: Recalculate NAV
- Day 6: Governance vote (multi-sig)
- Day 7: Reprice GRAIN, resume

---

## Implementation Roadmap

### Week 1: Circle Integration
- [ ] Create Circle business account
- [ ] Integrate Circle SDK
- [ ] Build deposit/withdraw flows
- [ ] Test with $10K

### Week 2: GRAIN Smart Contracts
- [ ] Deploy Grain.sol to testnet
- [ ] Deploy Vault.sol to testnet
- [ ] Test appreciation mechanism
- [ ] External audit

### Week 3: Backend Integration
- [ ] Build lib/grain-vault/circle.ts
- [ ] Build lib/grain-vault/pricing.ts
- [ ] Add GRAIN balance endpoints
- [ ] Add yield calculation

### Week 4: Frontend Dashboard
- [ ] GRAIN balance display
- [ ] Real-time price ticker
- [ ] Yield earned counter
- [ ] Deposit/withdraw UI

---

## The Virtuous Cycle

```
More deposits → Bigger reserves → Higher liquidity
    ↑                                      ↓
Network effects ← More merchants ← Better yield
```

**Flywheel:**
1. GRAIN appreciates (4.5%+)
2. Businesses prefer to hold GRAIN (earning yield)
3. Businesses prefer to accept GRAIN (customers have it)
4. More volume through GRAIN
5. More deposits to earn yield
6. Bigger reserves = more stability
7. More stability = more trust
8. More trust = more adoption
9. Back to step 1

---

## Key Insight: We're Not Paying Yield

**Critical Distinction:**
- We're NOT distributing 8% to users (negative cash flow)
- We're investing float, GRAIN appreciates naturally (positive cash flow)
- Users benefit from appreciation (not distribution)
- We earn from transaction fees (not float)

**This is how USDC SHOULD work, but doesn't.**

Circle earns 4.5% on $30B in deposits = $1.35B/year
Circle pays holders: $0
**GRAIN fixes this.**

---

## Status: Ready to Build

**Next Steps:**
1. Create Circle business account
2. Deploy GRAIN smart contracts
3. Build price appreciation mechanism
4. Test with $10K → verify 4.5% works
5. Launch to first customers

**This is the model that scales to $1T AUM.** 🚀

---

*Built with precision. Powered by float yield. Designed for automatic appreciation.*

**GRAIN | Value That Grows**
