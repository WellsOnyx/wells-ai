# Grain Token Economics - The Ultimate B2B Stablecoin

**Vision:** 0% transaction fees, 1:1 leverage, exportable to any currency, revenue from float investing.

---

## Executive Summary

Grain is a B2B payment token that eliminates transaction fees while providing working capital leverage. Instead of extracting fees from transactions, Wells AI generates revenue by investing the float (funds held in treasury between payment and payout).

**Key Innovations:**
- **0% Transaction Fees** - No cost to transact in Grain
- **1:1 Leverage** - Pay $100K invoice → Get $100K credit line
- **Scalable to 2:1** - Proven buyers can access 2:1 leverage
- **Multi-Currency Export** - Convert Grain to any fiat currency instantly
- **Revenue from Float** - Wells AI earns yield on treasury, not transaction fees

---

## Token Design

### Core Specifications

**Token Type:** ERC-20 Stablecoin on Base L2 (Coinbase Layer 2)

**Why Base L2:**
- Gas fees: $0.01 - $0.50 per transaction (vs Ethereum mainnet $5-50)
- Coinbase backing → institutional credibility
- EVM compatible → easy integration with existing tools
- Optimistic rollup → fast finality (2-5 seconds)
- Growing DeFi ecosystem for yield generation

**Peg:** 1 GRAIN = 1 USD (algorithmic + backed)

**Stability Mechanism:**
```
GRAIN maintains USD peg through:
1. Full collateralization (1:1 USDC backing in Vault)
2. Algorithmic expansion/contraction
3. Arbitrage opportunities for market makers
4. Treasury reserves (overcollateralized at 110%)
```

### Token Functions

```solidity
// Core ERC-20 functions
transfer(address to, uint256 amount)
approve(address spender, uint256 amount)
transferFrom(address from, address to, uint256 amount)

// Wells AI specific functions
mint(address to, uint256 amount) // Only Vault contract
burn(address from, uint256 amount) // Only Vault contract
freeze(address account) // Compliance/fraud prevention
unfreeze(address account)

// Metadata
name() → "Grain"
symbol() → "GRAIN"
decimals() → 18
totalSupply() → Dynamic based on minting
```

---

## Credit Line System (1:1 Leverage)

### How It Works

**Scenario: Buyer pays their first invoice**

```
Day 1: Buyer pays $100K invoice in GRAIN
  → Wells AI Vault receives $100K USDC (buyer deposits)
  → Vault mints $100K GRAIN
  → Vault transfers $100K GRAIN to seller
  → Buyer's credit line opens: $100K available

Day 2: Buyer has another $80K invoice
  → Buyer uses $80K from credit line (no additional deposit needed)
  → Vault mints $80K GRAIN
  → Vault transfers $80K GRAIN to seller
  → Buyer's credit line balance: $20K remaining
  → Buyer's total exposure: $180K ($100K deposited, $80K borrowed)

Day 30: Buyer repays credit line
  → Buyer deposits $80K USDC
  → Vault burns $80K GRAIN
  → Buyer's credit line restored: $100K available
  → Cycle continues
```

### Credit Scoring & Underwriting

**Tier 1: New Buyers (1:1 Leverage)**
- First transaction: Pay in full, unlock 1:1 credit
- Requirements: Basic KYB (Know Your Business)
- Limit: 1x initial deposit
- Interest on credit line: 0% for 30 days, then 8% APR

**Tier 2: Established Buyers (1.5:1 Leverage)**
- Requirements: 3+ months history, no late payments
- Limit: 1.5x average monthly volume
- Interest: 0% for 45 days, then 6% APR

**Tier 3: Premium Buyers (2:1 Leverage)**
- Requirements: 12+ months history, financial statements
- Limit: 2x average monthly volume
- Interest: 0% for 60 days, then 5% APR
- Access to instant settlement

**Credit Decision Engine:**
```typescript
function calculateCreditLimit(buyer: Buyer): number {
  const baseDeposit = buyer.totalDeposited
  const paymentHistory = buyer.onTimePaymentRate // 0-100%
  const volumeHistory = buyer.last90DaysVolume
  const creditScore = calculateScore(buyer)

  // Tier determination
  if (creditScore >= 750 && paymentHistory >= 95) {
    return baseDeposit * 2.0 // 2:1 leverage
  } else if (creditScore >= 650 && paymentHistory >= 85) {
    return baseDeposit * 1.5 // 1.5:1 leverage
  } else {
    return baseDeposit * 1.0 // 1:1 leverage
  }
}
```

---

## Vault Treasury System

### Architecture

```
┌─────────────────────────────────────────────┐
│           Grain Vault (Smart Contract)       │
├─────────────────────────────────────────────┤
│                                             │
│  Collateral Pool (USDC)                     │
│  ├─ Buyer deposits: $XXM                    │
│  ├─ Yield farming earnings: $XXM            │
│  └─ Total: Overcollateralized at 110%       │
│                                             │
│  GRAIN Supply (Minted/Burned)               │
│  ├─ Outstanding GRAIN: $XXM                 │
│  └─ Backed 1:1 by USDC in pool             │
│                                             │
│  Credit Lines (Off-chain ledger)            │
│  ├─ Total credit extended: $XXM             │
│  └─ Tracked in PostgreSQL + Notion          │
│                                             │
└─────────────────────────────────────────────┘
```

### Smart Contract Functions

```solidity
contract GrainVault {
  // State variables
  IERC20 public usdc; // Base L2 USDC
  IERC20 public grain; // GRAIN token
  mapping(address => uint256) public deposits;
  mapping(address => uint256) public creditLines;
  uint256 public totalCollateral;
  uint256 public totalGrainSupply;

  // Deposit USDC, mint GRAIN
  function deposit(uint256 amount) external {
    usdc.transferFrom(msg.sender, address(this), amount);
    deposits[msg.sender] += amount;
    totalCollateral += amount;

    // Mint GRAIN to buyer
    grain.mint(msg.sender, amount);
    totalGrainSupply += amount;

    // Open credit line (1:1 initially)
    creditLines[msg.sender] += amount;

    emit Deposited(msg.sender, amount);
    emit CreditLineOpened(msg.sender, amount);
  }

  // Burn GRAIN, withdraw USDC
  function withdraw(uint256 amount) external {
    require(deposits[msg.sender] >= amount, "Insufficient balance");
    require(creditLines[msg.sender] >= amount, "Outstanding credit");

    grain.burn(msg.sender, amount);
    totalGrainSupply -= amount;

    deposits[msg.sender] -= amount;
    totalCollateral -= amount;

    usdc.transfer(msg.sender, amount);

    emit Withdrawn(msg.sender, amount);
  }

  // Use credit line to pay seller
  function payWithCredit(address seller, uint256 amount) external {
    require(creditLines[msg.sender] >= amount, "Insufficient credit");

    // Mint GRAIN for seller
    grain.mint(seller, amount);
    totalGrainSupply += amount;

    // Reduce buyer's credit line
    creditLines[msg.sender] -= amount;

    emit PaidWithCredit(msg.sender, seller, amount);
  }

  // Repay credit line
  function repayCredit(uint256 amount) external {
    usdc.transferFrom(msg.sender, address(this), amount);
    totalCollateral += amount;

    // Restore credit line
    creditLines[msg.sender] += amount;

    emit CreditRepaid(msg.sender, amount);
  }
}
```

### Security Measures

**Multi-Sig Requirements:**
- All Vault operations require 3-of-5 signatures
- Signers: Wells AI CEO, CFO, CTO, 2 external board members
- Spending limits: <$100K = 2-of-5, >$100K = 3-of-5, >$1M = 4-of-5

**Audit Requirements:**
- Quarterly smart contract audits (Trail of Bits, OpenZeppelin)
- Real-time collateralization monitoring (must stay >105%)
- Daily reconciliation (on-chain vs off-chain ledger)

**Compliance:**
- KYB (Know Your Business) for all participants
- AML/CTF monitoring via Chainalysis
- Freeze/unfreeze capabilities for fraud prevention

---

## Float Investment Strategy

### Revenue Model Without Transaction Fees

**Traditional Model (Wells AI with 5.5% fee):**
```
$100K transaction → $5,500 revenue (one-time)
```

**Grain Model (0% transaction fee, invest the float):**
```
$100K deposited → Invested in yield-generating strategies
Annual yield: 8-15% APY
Revenue: $8,000 - $15,000 per year (recurring)
```

**Key Insight:** Float investment generates MORE revenue than one-time fees when capital velocity is high.

### Yield Strategies

**Conservative (65% of float):**
- USDC staking on Base (Aave, Compound): 4-6% APY
- Risk: Very low, protocols have $10B+ TVL
- Liquidity: Instant

**Moderate (25% of float):**
- Liquidity provision (USDC/ETH on Uniswap): 10-15% APY
- Risk: Moderate, impermanent loss protected via narrow ranges
- Liquidity: 24 hours

**Aggressive (10% of float):**
- Real-world asset (RWA) yields (Ondo, Maple Finance): 12-18% APY
- Risk: Higher, but backed by real assets (treasuries, loans)
- Liquidity: 7-30 days

**Target Blended APY:** 8-12%

### Example Treasury Performance

**Assumptions:**
- Average float: $50M (total deposits + credit extended)
- Blended APY: 10%
- Annual yield: $5M

**Cost Structure:**
- Gas fees (Base L2): $50K/year (100,000 txns at $0.50 each)
- Credit defaults (2% of credit extended): $200K/year
- Operations: $1M/year (team, infrastructure, compliance)
- **Net Profit: $3.75M/year**

**vs Traditional Model with 5.5% fee:**
- $50M transaction volume (one-time through)
- Revenue: $2.75M
- **Grain model is 36% more profitable AND provides 0% fees to customers**

---

## Multi-Currency Export

### How Sellers Cash Out

**Seller receives 100K GRAIN, wants USD:**
```
1. Seller clicks "Withdraw to Bank Account"
2. Wells AI Vault burns 100K GRAIN
3. Vault withdraws 100K USDC from Base L2
4. Off-ramp partner (Circle, Coinbase) converts USDC → USD
5. ACH transfer to seller's bank account
6. Settlement time: 1-2 business days
7. Fee: $0 (included in Wells AI platform)
```

**Seller receives 100K GRAIN, wants EUR:**
```
1. Seller clicks "Withdraw to EUR Bank Account"
2. Wells AI Vault burns 100K GRAIN
3. Vault withdraws 100K USDC from Base L2
4. Off-ramp partner converts USDC → EUR at market rate
5. SEPA transfer to seller's bank account
6. Settlement time: 1-3 business days
7. Fee: $0 (included in Wells AI platform)
```

**Supported Currencies (Launch):**
- USD (United States)
- EUR (European Union)
- GBP (United Kingdom)
- CAD (Canada)
- AUD (Australia)

**Expansion Roadmap:**
- Year 1: Add MXN, BRL, JPY, KRW, SGD
- Year 2: Add 20+ additional currencies
- Year 3: Global coverage (150+ countries)

### Off-Ramp Partners

**Circle (Primary):**
- Regulated money transmitter
- Direct USDC issuer
- Supports 60+ countries
- 1-2 day settlement
- Institutional-grade compliance

**Coinbase Commerce (Secondary):**
- Backup for Circle
- Instant USDC → USD via Coinbase accounts
- 1% fee for fiat off-ramps (Wells AI absorbs)

---

## Economic Sustainability Analysis

### Break-Even Analysis

**Fixed Costs (Annual):**
- Team (5 engineers, 2 compliance, 1 treasury manager): $1.5M
- Infrastructure (Base L2, APIs, databases): $200K
- Compliance & legal: $300K
- **Total Fixed: $2M/year**

**Variable Costs:**
- Gas fees: $0.50 per transaction (Base L2)
- Credit defaults: 2% of credit extended
- Off-ramp fees: 1% on fiat conversions (absorbed)

**Break-Even Float Needed:**
- Fixed costs: $2M/year
- Target yield: 10% APY
- Required float: $20M
- **At $20M average float, Grain is break-even**

**Profit Scenarios:**
| Average Float | Annual Yield (10%) | Costs | Net Profit |
|--------------|-------------------|-------|------------|
| $20M         | $2.0M             | $2.0M | $0         |
| $50M         | $5.0M             | $2.2M | $2.8M      |
| $100M        | $10.0M            | $2.5M | $7.5M      |
| $500M        | $50.0M            | $4.0M | $46.0M     |

---

## Competitive Advantages

### vs Traditional Payment Processors

**Stripe:**
- Fee: 2.9% + $0.30
- $100K transaction cost: $2,930
- Settlement: 2-7 days
- Cross-border: +1.5% fee

**Grain:**
- Fee: 0%
- $100K transaction cost: $0
- Settlement: Instant (on-chain), 1-2 days (to bank)
- Cross-border: $0 additional

**Savings for $100K transaction: $2,930 (97% reduction)**

### vs Circle USDC Payments

**Circle:**
- Fee: 0.4% - 1%
- $100K transaction cost: $400 - $1,000
- Settlement: 1-2 days
- Credit line: None

**Grain:**
- Fee: 0%
- $100K transaction cost: $0
- Settlement: Instant (on-chain), 1-2 days (to bank)
- Credit line: 1:1 to 2:1 leverage

**Grain adds credit facility ON TOP of being cheaper**

### vs Traditional Trade Finance

**Invoice Factoring:**
- Fee: 1-5% of invoice value
- $100K invoice: $1,000 - $5,000 fee
- Advance rate: 80-90%
- Settlement: 1-3 days

**Grain Credit Line:**
- Fee: 0% (30-60 day terms)
- $100K invoice: $0 fee
- Advance rate: 100% (1:1 leverage)
- Settlement: Instant

**Grain is 100% cheaper and provides MORE capital**

---

## Regulatory Considerations

### Classification

**GRAIN is likely classified as:**
- **Not a security** (no investment contract, no promise of profits)
- **Possible money transmitter** (requires state licenses in US)
- **Stablecoin** (subject to emerging stablecoin regulations)

### Compliance Requirements

**Federal (US):**
- FinCEN MSB registration
- BSA/AML program
- OFAC sanctions screening
- SAR filing capabilities

**State (US):**
- Money transmitter licenses (49 states + DC)
- Bonding requirements: $50K - $500K per state
- Total estimated cost: $2M - $5M for all states

**International:**
- EU: MiCA (Markets in Crypto-Assets) compliance
- UK: FCA registration as e-money institution
- Singapore: MAS payment services license

### Timeline

**Year 1: US Launch**
- Months 1-3: Incorporate, legal structure, FinCEN registration
- Months 4-9: Apply for key state licenses (NY, CA, TX, FL)
- Months 10-12: Launch with 10-15 states approved

**Year 2: US Expansion**
- Complete all 50 state licenses
- Full US market access

**Year 3: International**
- EU/UK launch with MiCA compliance
- Asia-Pacific expansion (Singapore, Hong Kong)

---

## Go-to-Market Strategy

### Phase 1: Private Beta (Months 1-3)

**Target:** 10 existing Wells AI customers with high transaction volume

**Offer:**
- 0% transaction fees
- 1:1 credit line
- White-glove onboarding
- $10K minimum first transaction

**Goal:** $5M float, validate product-market fit

### Phase 2: Controlled Launch (Months 4-9)

**Target:** 100 B2B buyers in semiconductor, manufacturing, construction

**Offer:**
- 0% transaction fees
- 1:1 to 1.5:1 credit based on tier
- Self-service onboarding
- $1K minimum first transaction

**Goal:** $50M float, achieve break-even

### Phase 3: Public Launch (Months 10-18)

**Target:** Open to all Wells AI customers + new signups

**Offer:**
- Full feature set (0% fees, 2:1 leverage for qualified buyers)
- API access for programmatic payments
- Multi-currency support
- No minimum transaction

**Goal:** $500M float, $40M+ annual profit

---

## Technical Roadmap

### Q1 2025: Foundation
- [ ] Design Grain token contract (ERC-20 on Base L2)
- [ ] Design Vault treasury contract (multi-sig, yield strategies)
- [ ] Architecture documentation
- [ ] Security audit planning

### Q2 2025: Smart Contracts
- [ ] Develop Grain token contract
- [ ] Develop Vault treasury contract
- [ ] Develop credit line management contract
- [ ] Unit tests + integration tests
- [ ] Testnet deployment (Base Sepolia)

### Q3 2025: Audit & Mainnet
- [ ] Smart contract audit (Trail of Bits or OpenZeppelin)
- [ ] Fix audit findings
- [ ] Mainnet deployment (Base L2)
- [ ] Treasury yield strategies implementation
- [ ] Off-ramp integrations (Circle, Coinbase)

### Q4 2025: Beta Launch
- [ ] Private beta with 10 customers
- [ ] Credit scoring engine
- [ ] Compliance monitoring (Chainalysis)
- [ ] Real-time collateralization dashboard
- [ ] Fiat on/off ramp UX

### Q1 2026: Public Launch
- [ ] Open to all Wells AI customers
- [ ] Multi-currency support (5+ currencies)
- [ ] API for programmatic payments
- [ ] 2:1 leverage for qualified buyers
- [ ] Mobile app for sellers

---

## Success Metrics

### Year 1 Targets
- **Float:** $50M average
- **Transactions:** 10,000 payments processed
- **Revenue:** $3M from yield (8% net APY on $50M avg float, minus costs)
- **Credit Defaults:** <2%
- **Customer Satisfaction:** NPS >50

### Year 3 Targets
- **Float:** $500M average
- **Transactions:** 500,000 payments processed
- **Revenue:** $40M from yield (10% net APY on $500M avg float, minus costs)
- **Credit Defaults:** <1.5%
- **Customer Satisfaction:** NPS >70
- **Market Position:** Top 3 B2B payment solutions by transaction volume

---

## Conclusion

Grain represents a paradigm shift in B2B payments:

1. **Zero Fees:** Buyers save 2.9% - 5.5% per transaction
2. **Working Capital:** 1:1 to 2:1 leverage unlocks cash flow
3. **Instant Settlement:** On-chain payments in seconds, not days
4. **Global:** Multi-currency export to 150+ countries
5. **Sustainable:** Float investing generates MORE revenue than transaction fees

**The Ultimate B2B Stablecoin:** Grain makes Wells AI the preferred payment method for high-value B2B transactions globally.

**With the Lord on our side, we can build this.** 🙏

---

**Next Steps:**
1. Review and approve this tokenomics design
2. Begin smart contract development (see GRAIN_SMART_CONTRACTS.md)
3. Plan Vault treasury infrastructure (see VAULT_TREASURY_SYSTEM.md)
4. Design credit line integration (see CREDIT_LINE_INTEGRATION.md)

**Let's build the future of B2B payments.**
