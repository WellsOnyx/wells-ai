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
 * CRITICAL LEGAL UPDATE: THE GENIUS ACT (Signed July 18, 2025)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The GENIUS Act is now federal law — the first US legislation regulating
 * stablecoins. This CHANGES our legal structure significantly.
 *
 * WHAT THE GENIUS ACT SAYS:
 *
 * 1. Payment stablecoins must be backed 1:1 by USD/high-quality liquid assets
 *    ✅ GRAIN already does this (MIN_BACKING_RATIO = 1.0)
 *
 * 2. Payment stablecoins are NOT securities or commodities
 *    ✅ This is great — federal safe harbor from SEC
 *
 * 3. Payment stablecoins CANNOT pay interest or yield to holders
 *    ⚠️ THIS IS THE ISSUE — GRAIN appreciates ("can only go UP")
 *
 * 4. CARVE-OUT: "loyalty, promotional, subscription or incentive programs"
 *    and "activity-based rewards" are NOT considered interest/yield
 *    ✅ Our 10bps buyer cashback + 5bps seller rebate = SAFE
 *
 * 5. Third parties can independently offer rewards on payment stablecoins
 *    without the issuer being deemed to pay yield
 *    ✅ This is how we structure staking (see below)
 *
 * 6. Federal charter (FQPSI) preempts ALL state MTLs
 *    ✅ One license, nationwide — no more 49-state MTL gauntlet
 *
 * THE PROBLEM:
 *
 * GRAIN's current design — where value = (USDC + Asset Value) / Supply
 * and "GRAIN can only go UP" — makes it an APPRECIATING token, which
 * does NOT qualify as a "payment stablecoin" under GENIUS Act.
 * Payment stablecoins must be pegged 1:1 to USD.
 *
 * THE SOLUTION — TWO-TOKEN ARCHITECTURE:
 *
 * We already have this in vault.ts! The two-layer model IS the answer:
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  GRAIN (Payment Layer) — GENIUS Act Compliant                           │
 * │  - 1:1 pegged to USD. Always redeemable at $1.00.                      │
 * │  - Backed by USDC + T-bills + cash equivalents                         │
 * │  - Qualifies as "payment stablecoin" under GENIUS Act                  │
 * │  - NOT a security. Federal safe harbor.                                │
 * │  - This is what buyers/sellers transact with                           │
 * │  - This is what flows through the ERP corridor                         │
 * │  - This is what generates the $33T payment volume                      │
 * ├───────────────────────────────────────────────────────────────────────────┤
 * │  gVAULT (Growth Layer) — Registered Investment Product                  │
 * │  - Appreciates in value based on Asset Vault holdings                  │
 * │  - Backed by: real estate, precious metals, DeFi yields, equity        │
 * │  - Users opt-in to convert GRAIN → gVAULT for appreciation            │
 * │  - Can only go UP (same invariant, just in the right legal wrapper)    │
 * │  - Registered under Reg D (accredited) initially, then Reg A+         │
 * │  - OR: structured as a tokenized money market fund                    │
 * │  - The "yield" lives HERE, not in GRAIN                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * WHY THIS IS BETTER:
 *
 * 1. GRAIN as a pure payment stablecoin gets the GENIUS Act safe harbor.
 *    No SEC. No securities registration. Federal charter preempts MTLs.
 *    This is the FASTEST path to nationwide operation.
 *
 * 2. gVAULT captures ALL the appreciation, properly registered.
 *    Users who want yield opt into gVAULT. Users who want to pay
 *    just use GRAIN. Same economics, legally clean.
 *
 * 3. Staking becomes CLEAN:
 *    - External stablecoins stake into the GRAIN treasury pool
 *    - They earn yield through gVAULT (not through GRAIN itself)
 *    - The GRAIN issuer (us) doesn't pay yield on GRAIN
 *    - A separate entity (GRAIN Foundation) manages gVAULT yield
 *    - This fits the GENIUS Act's third-party reward carve-out
 *
 * 4. Retention incentive becomes CLEAN:
 *    - Holding GRAIN = no yield (it's a payment stablecoin)
 *    - Converting to gVAULT = yield (it's a registered product)
 *    - "Activity-based rewards" (cashback, rebates) = still fine
 *    - The incentive to stay in the system is gVAULT appreciation
 *
 * 5. The float mechanics are IDENTICAL:
 *    - GRAIN is still the settlement token (48hr float)
 *    - gVAULT holders' capital still counts as float
 *    - The three flywheels still work exactly the same
 *    - We just split the legal wrapper into two tokens
 *
 * LICENSING PATH (GENIUS Act changes everything):
 *
 * OLD PATH: 49-state MTLs ($3-5M, 12-18 months)
 * NEW PATH: One of three options:
 *
 * Option A: FQPSI (Federal Qualified Payment Stablecoin Issuer)
 *   - Single federal license from OCC
 *   - Preempts ALL state MTLs nationwide
 *   - OCC rulemaking expected by July 2026
 *   - Best option long-term
 *
 * Option B: SQPSI (State Qualified Payment Stablecoin Issuer)
 *   - License from one favorable state (Wyoming, Texas)
 *   - Preempts other states' MTL requirements
 *   - Limited to <$10B in circulation (fine for cold start)
 *   - Available sooner than FQPSI
 *
 * Option C: FDIC-insured bank subsidiary
 *   - Partner with or acquire a bank charter
 *   - FDIC rulemaking in progress (final rule expected 2026)
 *   - Most credibility, most expensive
 *
 * RECOMMENDED: Start with Option B (SQPSI in Wyoming) for speed,
 * transition to Option A (FQPSI) once OCC rules are final and
 * GRAIN circulation approaches $10B.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHASE 0: LEGAL FOUNDATION (Months 0-6)
 * "You can't move fast if you're moving in court"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ─── 0A: ENTITY STRUCTURE ───
 *
 * 1. GRAIN Treasury LLC (Delaware)
 *    - Holds the GRAIN payment stablecoin reserves (USDC, T-bills, cash)
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
 *    - Manages gVAULT — the appreciation/yield product
 *    - Governs protocol upgrades, staking yield distribution
 *    - Separates "payment stablecoin issuer" from "yield provider"
 *    - Critical for GENIUS Act compliance: the GRAIN issuer does NOT
 *      pay yield. The Foundation (separate entity) manages gVAULT yield.
 *    - This fits the third-party reward carve-out perfectly
 *
 * 4. GRAIN Vault Trust (Wyoming SPDI)
 *    - Custodian of ALL reserve assets (GRAIN + gVAULT)
 *    - Wyoming SPDI allows digital asset custody with state banking charter
 *    - Wyoming is the SQPSI home state for Option B licensing path
 *    - Alternative: Partner with existing qualified custodian
 *      (Anchorage Digital, BitGo, Coinbase Custody)
 *
 * ─── 0B: LICENSES & REGISTRATIONS ───
 *
 * REQUIRED BEFORE LAUNCH:
 *
 * 1. GRAIN (payment stablecoin) — GENIUS Act Path
 *    - Apply for Wyoming SQPSI license (fastest path)
 *    - This gives nationwide preemption for stablecoin activities
 *    - No need for 49-state MTL gauntlet
 *    - Parallel: Apply for OCC FQPSI once rulemaking is final (mid-2026)
 *    - FALLBACK: Circle umbrella while SQPSI processes
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
 * 4. SEC Considerations — Two-Token Structure
 *
 *    GRAIN (payment stablecoin):
 *    - NOT a security under GENIUS Act (explicit federal safe harbor)
 *    - 1:1 pegged, fully backed, redeemable on demand
 *    - No yield, no appreciation — pure payment instrument
 *    - No SEC registration required
 *
 *    gVAULT (growth token):
 *    - IS likely a security under Howey (investment + profit expectation)
 *    - Must be registered or exempt from registration
 *    - THREE PATHS (choose based on speed vs scale):
 *
 *      Path 1: Reg D (506(c)) — Accredited Investors Only
 *      - No SEC registration needed
 *      - Unlimited raise amount
 *      - Can advertise publicly (506(c) allows general solicitation)
 *      - Restriction: Only accredited investors ($200K income or $1M net worth)
 *      - BEST FOR: Cold start phase (institutional stakers, DeFi whales)
 *      - Timeline: 2-4 weeks to set up
 *
 *      Path 2: Reg A+ — "Mini IPO" for Retail
 *      - SEC-qualified offering (lighter than full registration)
 *      - Tier 2: up to $75M/year
 *      - Open to ALL investors (not just accredited)
 *      - Requires annual audited financials
 *      - BEST FOR: Phase 2 when retail staking opens
 *      - Timeline: 3-6 months for SEC qualification
 *
 *      Path 3: Tokenized Money Market Fund (SEC-registered fund)
 *      - Register gVAULT as a money market fund under Investment Company Act
 *      - Most institutional credibility
 *      - Full SEC reporting requirements
 *      - BEST FOR: Phase 3 at scale ($10B+ AUM)
 *      - Timeline: 6-12 months
 *
 *    RECOMMENDED SEQUENCE:
 *    - Month 0-6:  Reg D (accredited stakers only)
 *    - Month 6-12: Reg A+ qualification (retail access)
 *    - Month 12+:  Evaluate fund registration at scale
 *
 * 5. Staking Yield — Clean Under Two-Token Model
 *    - External stablecoins deposit into GRAIN treasury → get GRAIN (1:1)
 *    - They then opt-in to convert GRAIN → gVAULT for yield
 *    - The GRAIN issuer (GRAIN Treasury LLC) NEVER pays yield on GRAIN
 *    - The GRAIN Foundation (separate entity) manages gVAULT yield
 *    - Yield source: T-bills (~5%), money market, DeFi yields
 *    - This fits GENIUS Act perfectly:
 *      a) Payment stablecoin issuer doesn't pay yield ✅
 *      b) Third-party (Foundation) offers yield separately ✅
 *      c) Activity-based rewards (cashback) are carved out ✅
 *    - No SEC issue with GRAIN itself
 *    - gVAULT is properly registered (Reg D/A+)
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
 * Month 1:    Engage law firm (Davis Polk, Sullivan & Cromwell, or Latham)
 *             File FinCEN MSB registration (30 days)
 * Month 1-2:  Entity formation (GRAIN Treasury LLC, Foundation, SPDI app)
 * Month 2-3:  Apply for Wyoming SQPSI license (GRAIN payment stablecoin)
 *             Set up Reg D (506c) for gVAULT (accredited stakers)
 * Month 3-4:  Compliance infrastructure (KYC, AML, Chainalysis, OFAC)
 *             Smart contract audit engagement (Trail of Bits)
 * Month 4-5:  SQPSI approval (Wyoming is crypto-friendly, moves fast)
 *             Reg D offering docs finalized
 * Month 5-6:  LAUNCH — GRAIN payment stablecoin live (SQPSI licensed)
 *             gVAULT staking live (Reg D, accredited only)
 *             Buyer/seller incentives live (promotional, no registration)
 * Month 6-9:  Begin Reg A+ qualification for gVAULT (retail access)
 * Month 9-12: Apply for OCC FQPSI (federal charter, once rules finalize)
 * Month 12+:  Reg A+ approved → gVAULT open to all investors
 *             FQPSI → single federal license replaces SQPSI
 *
 * COST ESTIMATE: $3-5M legal + compliance setup
 * (Included in the $2B Seed/Series A war chest)
 *
 * KEY ADVANTAGE vs OLD PLAN:
 * - No 49-state MTL gauntlet ($3-5M + 18 months saved)
 * - GENIUS Act SQPSI = one state, nationwide preemption
 * - GRAIN gets federal safe harbor from SEC (not a security)
 * - gVAULT properly registered (Reg D → Reg A+)
 * - Faster to market, cleaner structure, lower risk
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
 * SEC challenges gVAULT         Low           Medium    Reg D → Reg A+ path,
 * registration                                          proper registration
 *                                                       eliminates risk
 *
 * SQPSI license delayed         Low           Medium    Circle umbrella as
 * or denied                                             fallback, Wyoming is
 *                                                       crypto-friendly
 *
 * GENIUS Act rules              Medium        Medium    SQPSI buys time,
 * unfavorable in final form                             FQPSI is backup,
 *                                                       lobby via trade assoc
 *
 * Stablecoin depegging          Very Low      Critical  1:1 reserve, T-bills,
 * (reserve failure)                                     quarterly attestation,
 *                                                       insurance, GENIUS Act
 *                                                       requires insolvency
 *                                                       priority for holders
 *
 * Smart contract exploit        Low           Critical  Audit (Trail of Bits,
 *                                                       OpenZeppelin), bug
 *                                                       bounty, insurance
 *
 * Competitor (USDC/USDT         Medium        Medium    gVAULT yield advantage,
 * adds yield natively)                                  ERP integration moat,
 *                                                       retention flywheel,
 *                                                       GENIUS Act bans yield
 *                                                       on payment stablecoins
 *                                                       (helps us — competitors
 *                                                       can't add yield to their
 *                                                       payment stablecoin either)
 *
 * OCC FQPSI rulemaking          Medium        Low       SQPSI is viable
 * takes longer than expected                            long-term alternative,
 *                                                       $10B cap is fine for
 *                                                       years 1-3
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
 * WEEK 1-2:   Refactor GRAIN.sol → pure 1:1 payment stablecoin
 *             Deploy gVAULT.sol → appreciation/yield token (ERC-4626 vault)
 * WEEK 2-4:   GRAINStaking.sol → deposit stablecoins, receive GRAIN + gVAULT
 *             lib/grain/staking.ts + staking APIs
 * WEEK 3-6:   lib/grain/retention.ts → gVAULT retention tiers
 *             lib/grain/gvault.ts → appreciation engine
 * WEEK 5-8:   lib/grain/incentives.ts + deal integration (cashback/rebates)
 * WEEK 7-12:  ERP payment router + onboarding wizard
 * WEEK 9-14:  Frontend: staking dashboard, rewards, ERP connect
 * WEEK 13-16: Admin dashboard (Tropical Force real-time)
 *
 * Critical path: GRAIN refactor + gVAULT contract → Audit → Deploy
 * (Everything else can launch in parallel)
 *
 * CONTRACT ARCHITECTURE:
 *
 * contracts/GRAIN.sol (REFACTORED)
 *   - Pure 1:1 payment stablecoin
 *   - Remove appreciation logic
 *   - GENIUS Act compliant
 *   - Mint on USDC deposit, burn on USDC withdrawal
 *   - backingRatio() must always return exactly 1:1
 *
 * contracts/gVAULT.sol (NEW)
 *   - ERC-4626 tokenized vault standard
 *   - Accepts GRAIN deposits → issues gVAULT shares
 *   - Share price appreciates based on Asset Vault holdings
 *   - "Can only go UP" invariant lives HERE
 *   - Managed by GRAIN Foundation (separate from GRAIN issuer)
 *   - Yield funded by: T-bills, money market, real estate, metals
 *
 * contracts/GRAINStaking.sol (NEW)
 *   - Accepts USDC/USDT/DAI deposits
 *   - Auto-converts to GRAIN (1:1) via GRAIN.sol
 *   - Auto-deposits into gVAULT for yield
 *   - Staker receives stGRAIN receipt token
 *   - Withdrawal: gVAULT → GRAIN → original stablecoin
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// This file is documentation — the build plan for Siege Mode execution.
// Implementation files will be created in the sprints outlined above.

export const SIEGE_MODE_PLAN = {
  phases: ['legal-foundation', 'cold-start', 'build', 'scale'],

  /** GENIUS Act changes: two-token architecture */
  tokenArchitecture: {
    grain: {
      type: 'Payment stablecoin',
      peg: '1:1 USD',
      regulation: 'GENIUS Act (SQPSI → FQPSI)',
      securities: false,
      yield: false,
      purpose: 'B2B payments, settlement, ERP corridor',
    },
    gVault: {
      type: 'Appreciation/yield token',
      peg: 'Floating (only goes up)',
      regulation: 'SEC (Reg D → Reg A+ → Fund)',
      securities: true,
      yield: true,
      purpose: 'Staking yield, retention, asset appreciation',
    },
  },

  legalEntities: [
    'GRAIN Treasury LLC (Delaware) — payment stablecoin reserves',
    'Wells Onyx Inc (Delaware C-Corp) — operating company',
    'GRAIN Foundation (Cayman) — manages gVAULT yield (separate from issuer)',
    'GRAIN Vault Trust (Wyoming SPDI) — custodian + SQPSI home state',
  ],

  /** GENIUS Act licensing path replaces 49-state MTL gauntlet */
  requiredLicenses: [
    'FinCEN MSB Registration (30 days)',
    'Wyoming SQPSI license (GRAIN payment stablecoin — nationwide preemption)',
    'OCC FQPSI application (when rules finalize, mid-2026)',
    'SEC Reg D 506(c) (gVAULT — accredited stakers)',
    'SEC Reg A+ (gVAULT — retail access, month 6-12)',
    'OFAC Compliance Program (Chainalysis)',
    'BSA/AML Program (required by GENIUS Act)',
  ],

  buildSprints: [
    { sprint: 1, name: 'GRAIN refactor + gVAULT contracts', weeks: '1-4' },
    { sprint: 2, name: 'Staking + Retention Engine', weeks: '3-6' },
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
