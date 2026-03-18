/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GRAIN SIEGE MODE — FULL EXECUTION PLAN
 * Legal Framework + Cold Start + Build Roadmap
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Target: 100% of $33T global payment volume in <3 years
 * Strategy: Three compounding flywheels (revenue + staking + retention)
 * Starting: 3.3-7% market share via ERP corridor
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHASE 0: LEGAL FOUNDATION (Months 0-6)
 * "You can't move fast if you're moving in court"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ─── 0A: ENTITY STRUCTURE ───
 *
 * 1. GRAIN Treasury LLC (Delaware)
 *    - Holds the reserve assets (USDC, T-bills, precious metals)
 *    - Segregated from operating company (bankruptcy-remote)
 *    - Purpose: If Wells Onyx goes bankrupt, GRAIN holders are protected
 *    - Legal precedent: PayPal's PYUSD structure via Paxos Trust
 *
 * 2. Wells Onyx Inc (Delaware C-Corp)
 *    - Operating company — builds the platform, runs the marketplace
 *    - Issues equity to investors (Series A-D / IPO)
 *    - Receives 30% operating allocation from revenue
 *
 * 3. GRAIN Foundation (Cayman / BVI)
 *    - Governs protocol upgrades, staking parameters
 *    - Not required Day 1, but critical before staking goes live
 *    - Separates "protocol governance" from "company operations"
 *    - Why: If GRAIN staking is governed by a foundation, it's less
 *      likely to be classified as a security (no "efforts of others")
 *
 * 4. GRAIN Vault Trust (Wyoming SPDI or NY Trust Company)
 *    - Custodian of reserve assets
 *    - Wyoming SPDI (Special Purpose Depository Institution) allows
 *      digital asset custody with state banking charter
 *    - Alternative: Partner with existing qualified custodian
 *      (Anchorage Digital, BitGo, Coinbase Custody)
 *
 * ─── 0B: LICENSES & REGISTRATIONS ───
 *
 * REQUIRED BEFORE LAUNCH:
 *
 * 1. Money Transmitter Licenses (MTLs)
 *    - Required in 49 states + DC + PR + USVI (all except Montana)
 *    - Timeline: 12-18 months for full coverage
 *    - Cost: $2-5M total (bonds, application fees, legal)
 *    - SHORTCUT: Partner with licensed entity Day 1
 *      → Circle (already licensed, GRAIN is built on Circle SDK)
 *      → Circle handles USDC in/out, we handle GRAIN internally
 *      → This means GRAIN ↔ USDC conversions happen through Circle's
 *        licensed infrastructure, not ours
 *    - PARALLEL: Apply for own MTLs in key states (NY BitLicense,
 *      CA, TX, FL, IL) while operating under Circle umbrella
 *
 * 2. FinCEN MSB Registration
 *    - Register as Money Services Business with FinCEN
 *    - Timeline: 30 days (straightforward filing)
 *    - Requires BSA/AML compliance program
 *    - Already partially satisfied via Clerk KYC integration
 *
 * 3. OFAC Compliance
 *    - Sanctions screening on all transactions
 *    - Use Chainalysis or Elliptic for on-chain monitoring
 *    - Block transactions to/from sanctioned addresses
 *    - Already standard via Circle SDK (Circle does OFAC screening)
 *
 * 4. SEC Considerations — GRAIN Token Classification
 *    - GRAIN is NOT a security because:
 *      a) It's a payment stablecoin (medium of exchange, not investment)
 *      b) Value is backed 1:1 by reserves, not by "efforts of others"
 *      c) No expectation of profit from the token itself
 *         (appreciation comes from reserve management, not promoter efforts)
 *      d) Fits the "Reves" test for notes: resembles a currency, not an investment
 *    - KEY LEGAL OPINION NEEDED: Engage Sullivan & Cromwell, Davis Polk,
 *      or Debevoise to issue formal legal opinion that GRAIN is not a security
 *    - REFERENCE: GENIUS Act (2025) — federal stablecoin framework
 *      explicitly excludes payment stablecoins from securities classification
 *      if they maintain 1:1 reserves and are redeemable
 *
 * 5. SEC Considerations — Staking Yield
 *    - THIS IS THE CRITICAL LEGAL QUESTION
 *    - Staking yield (4.5-6.0%) COULD be classified as a security under
 *      the Howey test if structured as "invest money + expect profits
 *      from efforts of others"
 *    - SAFE STRUCTURE:
 *      a) Frame as "lending" not "staking" — user lends stablecoins
 *         to the treasury, receives interest (like a bank CD)
 *      b) Use the GRAIN Foundation (not Wells Onyx) as the counterparty
 *      c) Yield comes from reserve management (T-bills, money market),
 *         not from "efforts of the promoter"
 *      d) All reserves are transparently audited and publicly visible
 *    - ALTERNATIVE: Operate under Reg D (accredited investors only)
 *      initially, then pursue Reg A+ for retail ($75M/yr cap)
 *    - REFERENCE: SEC v. Coinbase (staking) — the SEC's case was about
 *      proof-of-stake validation rewards, not lending yield. GRAIN's
 *      model is closer to a money market fund than PoS staking.
 *    - SAFEST PATH: Get SEC no-action letter or work with SEC's
 *      FinHub for guidance before launching staking yield
 *
 * 6. Cashback / Incentive Programs
 *    - Buyer cashback (10bps) and seller rebates (5bps) are
 *      PROMOTIONAL INCENTIVES, not securities
 *    - Legal precedent: Credit card cashback programs (Chase, Amex)
 *      are promotional and not regulated as securities
 *    - Requirements:
 *      a) Clear terms and conditions
 *      b) Report as income to recipients (1099-MISC if >$600/yr)
 *      c) State-level promotional regulations (minor, well-established)
 *    - This is the EASIEST legal element — well-trodden ground
 *
 * 7. Cross-Border Payments
 *    - FinCEN "Travel Rule" compliance for transfers >$3,000
 *    - FATF guidelines for virtual asset service providers (VASPs)
 *    - Need: Correspondent banking relationship or SWIFT/SEPA access
 *    - SHORTCUT: Circle's infrastructure handles cross-border USDC
 *    - For non-US: Register with relevant regulators per jurisdiction
 *      (FCA in UK, MAS in Singapore, VARA in Dubai)
 *
 * ─── 0C: COMPLIANCE INFRASTRUCTURE ───
 *
 * Build / Buy:
 * - KYC/AML: Clerk (already integrated) + Jumio or Onfido for enhanced
 * - Transaction monitoring: Chainalysis KYT (Know Your Transaction)
 * - Sanctions screening: Chainalysis Sanctions Oracle (on-chain)
 * - Reporting: Automated SARs (Suspicious Activity Reports) to FinCEN
 * - Audit: Quarterly reserve attestation by Big 4 (Deloitte, PwC)
 * - Insurance: Digital asset insurance (Aon, Marsh) for reserve custody
 *
 * ─── 0D: LEGAL TIMELINE ───
 *
 * Month 1-2:  Engage law firm, file FinCEN MSB registration
 * Month 2-3:  Entity formation (LLC, Trust, Foundation)
 * Month 3-4:  SEC legal opinion on GRAIN token classification
 * Month 3-6:  MTL applications in top 10 states
 * Month 4-5:  SEC FinHub consultation on staking yield structure
 * Month 5-6:  Compliance infrastructure deployed (KYC, AML, monitoring)
 * Month 6:    LAUNCH (under Circle umbrella for MTL coverage)
 * Month 6-18: Complete remaining state MTL applications
 *
 * COST ESTIMATE: $3-5M legal + compliance setup
 * (Included in the $2B Seed/Series A war chest)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHASE 1: COLD START (Months 0-6)
 * "You need flow before you have flow"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The cold start problem: you need transaction volume to generate float,
 * but you need float to offer competitive yield, but you need yield to
 * attract volume. Three simultaneous attacks:
 *
 * ─── 1A: ERP CORRIDOR (B2B Volume — the $2.31T play) ───
 *
 * The single biggest cold start hack: plug into existing B2B payment
 * flows through ERP systems. Companies already have the volume — we
 * just need to route it through GRAIN.
 *
 * Target: SAP, Oracle, NetSuite users doing cross-border B2B payments
 *
 * Why they switch:
 * - Current: SWIFT wire (3-5 days, $25-50 per wire, 1-3% FX markup)
 * - GRAIN: 48hr settlement, 33bps flat, no FX markup (USDC-native)
 * - Savings: ~$15-40 per transaction + 1-3% FX savings
 * - Plus: 10bps cashback on every payment (incentive program)
 *
 * Execution:
 * 1. Deploy ERP adapters (SAP, Oracle, NetSuite — already built)
 * 2. Target: 50 mid-market companies ($50M-$500M revenue each)
 * 3. Average B2B payment volume: $10-50M/company/year
 * 4. 50 companies × $30M avg = $1.5B/year through GRAIN Day 1
 * 5. Scale to 500 companies by Month 12 = $15B/year
 *
 * Go-to-market:
 * - Direct sales to CFOs/Controllers (show the savings math)
 * - Partner with SAP/Oracle consulting firms (Accenture, Deloitte)
 * - Content: "Cut your B2B payment costs by 80%" case studies
 * - Free pilot: first $1M in payments fee-free
 *
 * ─── 1B: ANCHOR TENANTS (Marketplace Volume) ───
 *
 * Sign 5-10 large marketplace operators who bring their existing
 * buyer-seller volume. They get lower fees than Stripe/PayPal.
 *
 * Target segments:
 * - B2B marketplaces (Faire, Alibaba sellers, ThomasNet)
 * - Commodity trading platforms (metals, agriculture, energy)
 * - Cross-border wholesale (textiles, electronics, raw materials)
 *
 * Value proposition:
 * - Current: 2.9% + $0.30 (Stripe) or 3.49% (PayPal)
 * - GRAIN: 1% flat fee (of which 33bps is processing)
 * - Savings: 60-75% lower fees
 * - Plus: Funds available in 48hrs vs 3-5 days
 * - Plus: Buyer gets 10bps cashback, seller gets 5bps rebate
 *
 * Target: 5 anchor tenants × $200M/year each = $1B/year Day 1
 *
 * ─── 1C: STABLECOIN STAKING (Float Injection) ───
 *
 * Even before transaction volume ramps, external staking injects
 * capital directly into the float.
 *
 * Cold start staking strategy:
 * 1. Launch with 4.5% APY on USDC/USDT/DAI deposits
 *    (funded from Day 1 by investing reserves in T-bills at ~5%)
 * 2. No lockup required (liquid staking — withdraw anytime)
 * 3. Target DeFi yield farmers currently earning 2-4% on Aave/Compound
 * 4. GRAIN's edge: GRAIN only goes up + 4.5% yield > DeFi rates
 *
 * Staking launch sequence:
 * Month 1: Whitelist launch (500 early stakers, $100K max each = $50M)
 * Month 2: Open to accredited investors (Reg D if needed)
 * Month 3: General availability (if SEC structure is cleared)
 *
 * Marketing:
 * - "Earn 4.5% on your stablecoins. GRAIN only goes up."
 * - Crypto Twitter / DeFi influencer partnerships
 * - Integration with DeFi aggregators (Yearn, Beefy)
 * - List on DeFi Llama, DeBank for TVL visibility
 *
 * Day 1 target: $50M staked
 * Month 6 target: $500M staked
 * Year 1 target: $3B staked (2% of stablecoin market)
 *
 * ─── 1D: COLD START FLOAT BOOTSTRAPPING ───
 *
 * While volume ramps, the $2B Seed/Series A capital provides the
 * initial float. The math:
 *
 * Day 1 float composition:
 *   $5.5B  Starting float (from $1T annualized volume target)
 *   $2.0B  Seed/Series A capital injection
 *   $0.05B Early staking deposits
 *   ──────
 *   $7.5B  Total float
 *
 * This float earns 7% = $525M/year = $1.44M/day from Day 1
 * Even before a single transaction flows through the system.
 *
 * The capital raise IS the cold start solution. It buys time for
 * the organic flywheels to kick in.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHASE 2: BUILD ROADMAP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ─── SPRINT 1: STAKING CONTRACTS (Weeks 1-4) ───
 *
 * Smart Contracts (Solidity / Base L2):
 *
 *   contracts/GRAINStaking.sol
 *   - Multi-token staking vault (accepts USDC, USDT, DAI on Base)
 *   - Deposit: lock stablecoins → mint stGRAIN receipt token
 *   - Withdraw: burn stGRAIN → return stablecoins + accrued yield
 *   - Yield accrual: daily, calculated pro-rata by share of pool
 *   - Emergency withdrawal (forfeit pending yield, 0.5% exit fee)
 *   - Access control: TREASURY_ROLE for yield funding
 *   - Events: Staked, Unstaked, YieldDistributed, YieldRateUpdated
 *   - View functions: getStakerPosition, getCurrentAPY, getTotalStaked
 *
 *   contracts/stGRAIN.sol
 *   - ERC-20 receipt token for staked position
 *   - Non-transferable initially (prevents secondary market issues)
 *   - Tracks pro-rata share of staking pool
 *   - Burns on withdrawal
 *
 *   Key design decisions:
 *   - Staked capital goes to GRAIN Treasury LLC (segregated)
 *   - Treasury invests in reserves (T-bills, money market)
 *   - Yield funded from reserve returns, NOT from GRAIN supply
 *   - Staked capital counts as float but does NOT increase GRAIN supply
 *   - This preserves the 1:1 backing ratio invariant
 *
 * Backend (TypeScript):
 *
 *   lib/grain/staking.ts
 *   - StakingEngine class
 *   - calculateDailyYield(stakerAddress, pool)
 *   - distributeYield() — daily cron job
 *   - getStakerPosition(userId)
 *   - getDynamicAPY() — from tropical-force.ts yield curve
 *   - processDeposit(userId, amount, token)
 *   - processWithdrawal(userId, amount)
 *
 *   app/api/staking/deposit/route.ts
 *   app/api/staking/withdraw/route.ts
 *   app/api/staking/positions/route.ts
 *   app/api/staking/rewards/route.ts
 *   app/api/staking/apy/route.ts
 *
 * Database:
 *
 *   staking_positions:
 *   - id, user_id, token (USDC|USDT|DAI), amount, st_grain_amount,
 *     entry_apy, current_apy, deposited_at, last_yield_at
 *
 *   staking_yield_distributions:
 *   - id, position_id, amount, apy_at_distribution, distributed_at
 *
 *   staking_pool_snapshots:
 *   - id, date, total_staked, total_yield_paid, current_apy,
 *     usdc_staked, usdt_staked, dai_staked
 *
 * ─── SPRINT 2: RETENTION ENGINE (Weeks 3-6) ───
 *
 *   lib/grain/retention.ts
 *   - RetentionEngine class
 *   - calculateRetentionRate(userId) — based on hold duration + balance
 *   - calculateRetentionYield(userId) — dynamic yield from tropical-force
 *   - processRetentionReward(userId) — daily accrual
 *   - getRetentionTier(userId) — Bronze/Silver/Gold/Platinum
 *
 *   Retention tiers (based on hold duration):
 *   - Bronze:   0-30 days   → base rate (4.5%)
 *   - Silver:   30-90 days  → base + 0.25%
 *   - Gold:     90-180 days → base + 0.50%
 *   - Platinum: 180+ days   → base + 0.75%
 *
 *   These are NOT locked — users can withdraw anytime.
 *   The tiers are purely additive yield incentives for loyalty.
 *
 *   Integration with treasury.ts:
 *   - Retention yield funded from the same 7% ROI pool
 *   - Retained capital treated as float (increases total float)
 *   - Daily snapshot: how much GRAIN is being held vs transacted
 *
 * ─── SPRINT 3: INCENTIVE SYSTEM (Weeks 5-8) ───
 *
 *   lib/grain/incentives.ts
 *   - IncentiveEngine class
 *   - processBuyerCashback(dealId, amount) → 10bps credit
 *   - processSellerRebate(dealId, amount) → 5bps credit
 *   - getIncentiveBalance(userId)
 *   - claimIncentives(userId) → pay out to GRAIN balance
 *   - calculateIncentiveCost(volume) — for P&L tracking
 *
 *   app/api/incentives/balance/route.ts
 *   app/api/incentives/claim/route.ts
 *   app/api/incentives/history/route.ts
 *
 *   Integration with deals flow:
 *   - On deal completion (POST /api/deals/release):
 *     1. Process payment (existing)
 *     2. Calculate buyer cashback (10bps of deal amount)
 *     3. Calculate seller rebate (5bps of deal amount)
 *     4. Credit to respective incentive balances
 *     5. Auto-compound into GRAIN balance (or let them claim)
 *
 *   ERP integration:
 *   - Incentive accruals → journal entries in connected ERP
 *   - Map to GL accounts (promotional expense / cost of revenue)
 *   - Reconciliation reports for finance teams
 *
 * ─── SPRINT 4: ERP PAYMENT ROUTING (Weeks 7-12) ───
 *
 *   Activate the ERP adapters for live payment routing:
 *
 *   lib/treasury-sdk/adapters/ — already built:
 *   - SAP (S/4HANA + Business One)
 *   - Oracle (Fusion Cloud + E-Business Suite)
 *   - NetSuite (OAuth 1.0 + SuiteQL)
 *   - Dynamics 365, Workday, Coupa, Sage, Acumatica
 *
 *   New additions:
 *   lib/treasury-sdk/payment-router.ts
 *   - PaymentRouter class
 *   - routePayment(erpSource, invoice, paymentMethod)
 *   - reconcilePayment(erpSource, paymentId)
 *   - getRoutingAnalytics(period) — volume, fees, savings
 *
 *   lib/treasury-sdk/onboarding.ts
 *   - ERPOnboarding class
 *   - connectERP(companyId, erpType, credentials)
 *   - importVendors(companyId) — pull vendor list from ERP
 *   - importPayables(companyId) — pull open invoices
 *   - suggestGrainPayments(companyId) — AI-powered: which invoices
 *     should route through GRAIN for maximum savings
 *
 *   app/api/erp/connect/route.ts
 *   app/api/erp/import/route.ts
 *   app/api/erp/route-payment/route.ts
 *
 * ─── SPRINT 5: FRONTEND (Weeks 9-14) ───
 *
 *   Grain & Vault Dashboard additions:
 *
 *   app/grain-vault/staking/page.tsx
 *   - Staking dashboard: deposit, withdraw, view positions
 *   - Current APY display (dynamic, updates with retention)
 *   - Yield history chart
 *   - Pool stats: total staked, TVL, yield distributed
 *
 *   app/grain-vault/rewards/page.tsx
 *   - Incentive balance (cashback + rebates earned)
 *   - Claim button (or auto-compound toggle)
 *   - Retention tier display (Bronze → Platinum)
 *   - "Your GRAIN is earning X%" personalized yield display
 *
 *   app/grain-vault/erp/page.tsx
 *   - ERP connection wizard (connect SAP/Oracle/NetSuite)
 *   - Import payables view
 *   - Payment routing dashboard
 *   - Savings calculator: "You saved $X by routing through GRAIN"
 *
 * ─── SPRINT 6: TROPICAL FORCE DASHBOARD (Weeks 13-16) ───
 *
 *   Internal admin dashboard showing real-time Siege Mode metrics:
 *
 *   app/admin/tropical-force/page.tsx
 *   - Live float composition (own + staked + retained)
 *   - Market share tracker (current vs milestones)
 *   - Flywheel health: revenue rate, staking inflows, retention rate
 *   - Dynamic yield display (current APY, projected APY)
 *   - Capital raise tracker
 *   - Comparison: projected vs actual (Siege Mode simulation overlay)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHASE 3: SCALE (Months 6-36)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ─── MONTH 6-12: TRACTION ───
 *
 * Targets:
 * - 50+ ERP-connected companies routing payments through GRAIN
 * - $3B+ external staking deposits
 * - 5% market share ($1.65T annualized volume)
 * - Series B: $5B raise → inject into float
 *
 * Flywheel status at Month 12:
 * - Float: ~$18-22B
 * - Daily revenue: ~$2.5M
 * - Staker yield: 4.5-5.0% (dynamic, rising with retention)
 * - Retention rate: ~20% (Year 1 trust building)
 *
 * ─── MONTH 12-24: GROWTH ───
 *
 * Targets:
 * - 500+ ERP-connected companies
 * - $15B+ staking deposits
 * - 10-25% market share
 * - Series C: $10B raise → inject into float
 *
 * Key unlocks:
 * - Own MTLs in top 10 states (no longer dependent on Circle umbrella)
 * - GRAIN accepted as payment at anchor tenant marketplaces
 * - Cross-border settlement live in 20+ countries
 * - Retention flywheel kicking in (35% retention, yield rising to 5.5%)
 *
 * ─── MONTH 24-36: DOMINANCE ───
 *
 * Targets:
 * - 50%+ market share
 * - $30B+ staking
 * - $90B+ user-retained capital
 * - Series D / IPO: $20B raise → inject into float
 * - Yield at 5.5-6.0% (category-leading)
 *
 * Endgame:
 * - GRAIN is the default B2B payment rail
 * - Retention at 50-60% (users keep money in GRAIN by default)
 * - $181B total float = 100% of global payment volume
 * - Three flywheels self-sustaining
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * RISK MATRIX
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * RISK                          PROBABILITY   IMPACT    MITIGATION
 * ────                          ───────────   ──────    ──────────
 * SEC classifies staking        Medium        High      Foundation structure,
 * yield as security                                     Reg D initially,
 *                                                       legal opinion
 *
 * State MTL denial              Low           Medium    Circle umbrella,
 *                                                       multi-state strategy
 *
 * Stablecoin depegging          Very Low      Critical  1:1 reserve, T-bills,
 * (reserve failure)                                     quarterly attestation,
 *                                                       insurance
 *
 * Smart contract exploit        Low           Critical  Audit (Trail of Bits,
 *                                                       OpenZeppelin), bug
 *                                                       bounty, insurance
 *
 * Competitor (USDC/USDT         Medium        Medium    Yield advantage,
 * adds yield natively)                                  ERP integration moat,
 *                                                       retention flywheel
 *
 * Regulatory environment        Medium        High      Federal charter if
 * shifts (new legislation)                              GENIUS Act passes,
 *                                                       lobby via trade assoc
 *
 * Cold start failure            Low           High      $2B capital provides
 * (can't get volume)                                    3+ years runway,
 *                                                       ERP corridor = captive
 *                                                       volume
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * COST SUMMARY (Year 1)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Legal & Compliance:           $3-5M
 * Smart contract audit:         $500K-1M (Trail of Bits + OpenZeppelin)
 * Engineering (15 people):      $6M
 * Operations:                   $2M
 * Compliance staff:             $2.5M
 * Executive:                    $2M
 * Infrastructure:               $1.5M
 * Marketing / BD:               $5-10M (ERP channel, staking launch)
 * Insurance:                    $2-5M
 *                               ─────────
 * TOTAL:                        $25-35M
 *
 * Funded from: $2B Seed/Series A (this is <2% of the raise)
 * The other 98% goes directly into the float.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * BUILD ORDER (What to code first)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * WEEK 1-2:   GRAINStaking.sol + stGRAIN.sol contracts
 * WEEK 2-4:   lib/grain/staking.ts + staking APIs
 * WEEK 3-6:   lib/grain/retention.ts + retention tiers
 * WEEK 5-8:   lib/grain/incentives.ts + deal integration
 * WEEK 7-12:  ERP payment router + onboarding wizard
 * WEEK 9-14:  Frontend: staking dashboard, rewards, ERP connect
 * WEEK 13-16: Admin dashboard (Tropical Force real-time)
 *
 * Critical path: Staking contracts → Audit → Deploy
 * (Everything else can launch in parallel)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// This file is documentation — the build plan for Siege Mode execution.
// Implementation files will be created in the sprints outlined above.

export const SIEGE_MODE_PLAN = {
  phases: ['legal-foundation', 'cold-start', 'build', 'scale'],
  legalEntities: [
    'GRAIN Treasury LLC (Delaware)',
    'Wells Onyx Inc (Delaware C-Corp)',
    'GRAIN Foundation (Cayman)',
    'GRAIN Vault Trust (Wyoming SPDI)',
  ],
  requiredLicenses: [
    'FinCEN MSB Registration',
    'State MTLs (49 states + DC)',
    'OFAC Compliance Program',
    'SEC Legal Opinion (token + yield)',
  ],
  buildSprints: [
    { sprint: 1, name: 'Staking Contracts', weeks: '1-4' },
    { sprint: 2, name: 'Retention Engine', weeks: '3-6' },
    { sprint: 3, name: 'Incentive System', weeks: '5-8' },
    { sprint: 4, name: 'ERP Payment Routing', weeks: '7-12' },
    { sprint: 5, name: 'Frontend', weeks: '9-14' },
    { sprint: 6, name: 'Admin Dashboard', weeks: '13-16' },
  ],
  coldStartTargets: {
    erpCompanies: 50,
    stakingDepositsMonth1: 50_000_000,
    stakingDepositsMonth6: 500_000_000,
    stakingDepositsYear1: 3_000_000_000,
    anchorTenants: 5,
    anchorTenantVolumeEach: 200_000_000,
  },
  yearOneCost: {
    legalCompliance: 5_000_000,
    smartContractAudit: 1_000_000,
    engineering: 6_000_000,
    operations: 2_000_000,
    compliance: 2_500_000,
    executive: 2_000_000,
    infrastructure: 1_500_000,
    marketing: 10_000_000,
    insurance: 5_000_000,
    total: 35_000_000,
  },
} as const
