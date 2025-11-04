# Grain & Vault: The Mic Drop

## Vision
Replace traditional payment rails (Stripe, ACH, Airwallex) with stablecoin settlement layer. Turn 33bps from "margin after costs" into "pure profit."

## Two-Path Strategy

### Path 1: BYO Pipes (Bring Your Own)
**Target**: Companies already on SAP/Coupa/Oracle
**Approach**: Invisible middleware integration
**Pricing**: 33bps flat on every transaction
**Value Prop**: Zero switching costs, instant setup

### Path 2: All-in-Wells
**Target**: Companies without existing ERP
**Approach**: Full-stack procurement platform
**Pricing**: Match SAP Ariba (15.5bps standard, 35bps services)
**Value Prop**: Better UX, AI-native, instant settlement (via Grain)

## The Endgame: Grain Vault

**What It Is:**
- Stablecoin treasury system (USDC-backed)
- Instant settlement rails (no 3-day ACH wait)
- Near-zero transaction costs (~$0.00001 per tx)
- 33bps becomes PURE PROFIT

**Why It Wins:**
- Ariba: 15.5bps + 3-day settlement
- Wells with Grain: 33bps + instant settlement
- **Higher fee, but instant money** = better deal

## Build Priority

### Phase 1: Grain Prototype (Weeks 1-2)
- [ ] Set up USDC treasury wallet
- [ ] Build deposit/withdrawal flow
- [ ] Create settlement API
- [ ] Test with $100K volume

### Phase 2: SAP/Ariba Connector (Weeks 3-4)
- [ ] Read-only API integration
- [ ] Monitor transaction flow
- [ ] Build 33bps deduction layer
- [ ] Test with pilot customer

### Phase 3: All-in-Wells ERP (Weeks 5-8)
- [ ] Full procurement workflow
- [ ] Payment processing integration
- [ ] Match Ariba feature parity
- [ ] Launch with 5 beta customers

### Phase 4: Grain Migration (Weeks 9-12)
- [ ] Migrate BYO customers to Grain settlement
- [ ] Migrate All-in-Wells to Grain
- [ ] Sunset Stripe/Airwallex for new transactions
- [ ] **Pure 33bps profit model achieved**

## Revenue Projection

**Year 1 (Traditional Rails):**
- $10M transaction volume
- 33bps gross = $33,000
- Rail costs (1.5%) = $150,000 loss
- **Net: -$117,000** (funding Grain development)

**Year 1 (Post-Grain Launch @ Month 6):**
- $10M transaction volume
- 33bps gross = $33,000
- Rail costs = $100 (near-zero)
- **Net: $32,900 profit per $10M**

**Year 2 (Full Grain):**
- $1B transaction volume
- 33bps gross = $3.3M
- Rail costs = $10K
- **Net: $3.29M profit**

**Year 3 (Scale):**
- $100B transaction volume
- 33bps gross = $330M
- Rail costs = $1M
- **Net: $329M profit**

## Technical Architecture

### Grain Token
```typescript
interface GrainToken {
  type: 'USDC-backed stablecoin'
  peg: '1 GRAIN = $1 USD'
  backing: 'Overcollateralized 110%'
  chain: 'Ethereum L2 (Arbitrum or Base)'
  settlement: 'Instant (< 1 second)'
}
```

### Vault System
```typescript
interface Vault {
  treasuryWallet: string      // Multi-sig USDC wallet
  minimumBalance: number       // $10M reserve
  autoRebalance: boolean       // Auto top-up from revenue
  titheAllocation: number      // 10% to Adullam Fund
}
```

### Settlement Flow
```
1. Buyer approves payment in Wells
2. Wells mints Grain tokens (1:1 USDC)
3. Grain transferred to Seller vault
4. Wells deducts 33bps in Grain
5. Seller can:
   - Keep in Grain (instant liquidity)
   - Convert to USDC (instant)
   - Convert to fiat ($25 fee, 1-day ACH)
```

## Competitive Moat

**Why Ariba Can't Copy This:**
1. Legacy rails (Stripe, ACH) baked into contracts
2. SAP's corporate structure prevents stablecoin adoption
3. Regulatory fear of crypto
4. Too slow to pivot

**Why Wells Wins:**
1. Born crypto-native
2. No legacy rails to sunset
3. Instant settlement = killer feature
4. 33bps pure profit (no rail costs)

## Regulatory Strategy

**Key Compliance Requirements:**
- [ ] Money Transmitter License (per state)
- [ ] FinCEN registration (MSB)
- [ ] USDC reserve audit (monthly)
- [ ] AML/KYC for all users
- [ ] Transaction monitoring (>$10K reporting)

**Risk Mitigation:**
- Overcollateralized USDC reserves (110%)
- No fractional reserve banking
- Instant proof of reserves via smart contract
- Clear separation: Wells (platform) vs. Grain (currency)

## Launch Plan

**Month 1-3: Silent Build**
- Develop Grain smart contracts
- Set up treasury infrastructure
- Get first 10 beta users on testnet

**Month 4-6: Private Beta**
- Invite 100 companies to Grain beta
- Process $10M volume
- Prove instant settlement works

**Month 7-9: Public Launch**
- Announce Grain publicly
- Marketing: "Say goodbye to 3-day ACH"
- Migrate all Wells users to Grain settlement

**Month 10-12: Scale**
- $1B transaction volume
- 10,000 companies using Grain
- Pitch Series A: "We're the payment rail"

## Success Metrics

**Phase 1 (Prototype):**
- [ ] $100K volume settled via Grain
- [ ] <1 second settlement time
- [ ] Zero failed transactions

**Phase 2 (Beta):**
- [ ] 100 companies using Grain
- [ ] $10M volume processed
- [ ] 99.99% uptime

**Phase 3 (Production):**
- [ ] 10,000 companies using Grain
- [ ] $1B volume processed
- [ ] 33bps pure profit margin

**Phase 4 (Dominance):**
- [ ] $100B volume processed
- [ ] Wells becomes default B2B payment rail
- [ ] Ariba forced to match or die

---

**The Mic Drop Moment:**
When Grain launches, every CFO will ask their procurement team: "Why are we waiting 3 days for ACH when Wells settles instantly?"

That's game over for Ariba.
