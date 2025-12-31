/**
 * VAULT - The Treasury Accounting Expert
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VAULT TRACKS EVERYTHING. PERFECTLY. ALWAYS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE VALUE EQUATION:
 *
 *   GRAIN PRICE = Total Ecosystem Value / GRAIN Supply
 *
 *   Total Ecosystem Value = USDC Liquidity + Equity Value
 *
 *   Where:
 *   - USDC Liquidity = Cash + liquid assets (what users deposited)
 *   - Equity Value = Platform value + investments + accumulated fees
 *
 * COLD START:
 *   WellsAI + GRAIN platform has real value from day one.
 *   Conservative valuation: $5M (seed stage platform value)
 *   This is the INITIAL EQUITY that backs early GRAIN.
 *
 *   First user deposits $1,000:
 *   - USDC Liquidity: $1,000
 *   - Equity Value: $5,000,000 (platform) + $0 (investments)
 *   - Total Value: $5,001,000
 *   - GRAIN Supply: Determined by initial price setting
 *
 * THE TWO-LAYER MODEL:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GRAIN (Equity Layer)                                                   │
 * │  - Total ecosystem asset value / GRAIN supply = GRAIN price            │
 * │  - Grows with real assets (real estate, metals, investments)           │
 * │  - Grows with WellsAI revenue (33bps on transactions)                  │
 * │  - This is UPSIDE - can go up forever                                  │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  VAULT (Principal Layer)                                                │
 * │  - Sum of all original deposits                                        │
 * │  - Protected 1:1 always                                                │
 * │  - This is the FLOOR - can never lose                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * CRITICAL ACCOUNTING RULES:
 *
 * 1. NEW DEPOSIT at current GRAIN price:
 *    - User deposits $1,000 when GRAIN = $10
 *    - Vault records: $1,000 principal (protected)
 *    - User receives: 100 GRAIN
 *    - Treasury receives: $1,000 cash
 *    - Treasury ALSO books $1,000 asset (offsets liability)
 *
 * 2. EQUITY PREMIUM on new deposits:
 *    - When GRAIN > $1, new users pay premium to buy in
 *    - Premium goes to EQUITY layer (not principal)
 *    - This is how early holders get rewarded
 *
 *    Example at $10/GRAIN:
 *    - User deposits $1,000
 *    - $100 is "base principal" (100 GRAIN × $1 base)
 *    - $900 is "equity buy-in" (100 GRAIN × $9 premium)
 *    - Both tracked separately
 *
 * 3. WITHDRAWAL at Vault (floor):
 *    - User can always get original deposit back
 *    - If GRAIN price dropped, they still get deposit
 *    - If GRAIN price rose, they get MIN(deposit, GRAIN value)
 *      OR they can partial withdraw and keep GRAIN
 *
 * 4. BANK RUN SCENARIO:
 *    - Total Vault (principals) is always payable
 *    - Equity layer stays with ecosystem
 *    - We liquidate assets to cover principals only
 *    - Remaining assets = ecosystem equity
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A user's position in the GRAIN ecosystem
 */
export interface VaultPosition {
  userId: string

  // GRAIN Holdings
  grainBalance: number           // Total GRAIN owned
  grainAcquisitions: GrainAcquisition[]  // History of how they got each GRAIN

  // Vault (Principal Protection)
  totalPrincipal: number         // Sum of all deposits (always withdrawable)
  totalEquityPaid: number        // Premium paid above $1 base (their buy-in cost)

  // Calculated Values
  currentGrainValue: number      // grainBalance × current GRAIN price
  protectedFloor: number         // = totalPrincipal (what they can always get)
  unrealizedGain: number         // currentGrainValue - totalPrincipal - totalEquityPaid

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

/**
 * Record of each GRAIN acquisition (for cost basis tracking)
 */
export interface GrainAcquisition {
  id: string
  type: 'deposit' | 'transfer_in' | 'reward' | 'dividend'
  grainAmount: number
  pricePerGrain: number          // Price at time of acquisition
  principalPortion: number       // The $1 base per GRAIN
  equityPortion: number          // Premium above $1 base
  totalCost: number              // principalPortion + equityPortion
  timestamp: Date
}

/**
 * The master treasury ledger
 *
 * GRAIN PRICE = (USDC Liquidity + Equity Value) / GRAIN Supply
 */
export interface VaultTreasury {
  // ═══════════════════════════════════════════════════════════════════════════
  // USDC LIQUIDITY (Cash - what users can withdraw)
  // ═══════════════════════════════════════════════════════════════════════════
  liquidity: {
    usdcCash: number              // USDC in Circle/custody (instant)
    usdcReserve: number           // USDC in money market (same-day)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EQUITY VALUE (Platform + Investments + Revenue)
  // ═══════════════════════════════════════════════════════════════════════════
  equity: {
    // Platform Valuation (WellsAI + GRAIN as a company)
    platformValuation: number     // Conservative startup valuation
    platformValuationDate: Date   // When last valued

    // Investment Portfolio
    realEstate: number            // Commercial real estate holdings
    preciousMetals: number        // Gold, silver, physical metals
    bonds: number                 // Government/corporate bonds
    otherInvestments: number      // Other income-generating assets

    // Accumulated Revenue
    wellsaiFees: number           // 33bps from AI transactions
    investmentIncome: number      // Dividends, rent, interest earned
    unrealizedGains: number       // Paper gains on investments
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIABILITIES (The VAULT floor - always owed to users)
  // ═══════════════════════════════════════════════════════════════════════════
  liabilities: {
    totalPrincipal: number        // Sum of all user deposits (1:1 owed)
    totalEquityBuyIn: number      // Premium paid by users above base
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAIN SUPPLY
  // ═══════════════════════════════════════════════════════════════════════════
  grainSupply: number             // Total GRAIN in circulation
  grainFounderPool: number        // Allocated to founders (vesting)
  grainTreasuryReserve: number    // Held by treasury for operations

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULATED VALUES (The key metrics)
  // ═══════════════════════════════════════════════════════════════════════════
  calculated: {
    usdcLiquidity: number         // Total cash available
    equityValue: number           // Total equity value
    totalEcosystemValue: number   // usdcLiquidity + equityValue
    grainPrice: number            // totalEcosystemValue / grainSupply
    vaultCoverage: number         // totalEcosystemValue / totalPrincipal
    liquidityCoverage: number     // usdcLiquidity / totalPrincipal (cash coverage)
  }

  // Timestamps
  lastUpdated: Date
  lastAudit: Date
}

/**
 * Display-ready treasury summary for dashboards
 */
export interface TreasurySummary {
  // ═══════════════════════════════════════════════════════════════════════════
  // THE TWO NUMBERS EVERYONE SEES
  // ═══════════════════════════════════════════════════════════════════════════
  usdcLiquidity: number           // "Cash"
  equityValue: number             // "Equity"
  totalValue: number              // Cash + Equity

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAIN METRICS
  // ═══════════════════════════════════════════════════════════════════════════
  grainPrice: number
  grainPriceFormatted: string     // "$12.47"
  grainSupply: number
  grainMarketCap: number

  // ═══════════════════════════════════════════════════════════════════════════
  // COVERAGE RATIOS
  // ═══════════════════════════════════════════════════════════════════════════
  vaultCoverage: number           // e.g., 1.42 (142%)
  vaultCoverageFormatted: string  // "142%"
  liquidityCoverage: number       // e.g., 0.98 (98%)
  liquidityCoverageFormatted: string

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAILED BREAKDOWNS
  // ═══════════════════════════════════════════════════════════════════════════
  liquidityBreakdown: {
    usdcCash: number
    usdcReserve: number
  }
  equityBreakdown: {
    platformValue: number
    investments: number
    accumulatedRevenue: number
  }
}

/**
 * Transaction record for audit trail
 */
export interface VaultTransaction {
  id: string
  timestamp: Date
  type: VaultTransactionType

  // User info
  userId: string

  // Amounts
  usdAmount: number
  grainAmount: number
  grainPrice: number

  // Breakdown (for deposits)
  principalPortion?: number
  equityPortion?: number

  // Asset allocation (for deposits)
  assetAllocation?: {
    cash: number
    investments: number
  }

  // Balances after transaction
  userGrainBalance: number
  userPrincipal: number
  treasuryAssets: number
  treasuryPrincipal: number

  // Notes
  notes: string
}

export type VaultTransactionType =
  | 'deposit'
  | 'withdrawal_principal'      // Withdraw up to principal
  | 'withdrawal_full'           // Withdraw at GRAIN price (if liquid)
  | 'transfer_in'
  | 'transfer_out'
  | 'fee_collection'            // 33bps from WellsAI
  | 'investment_return'         // Returns from assets
  | 'asset_revaluation'         // Mark-to-market on assets

// ============================================================================
// VAULT ENGINE
// ============================================================================

/**
 * The Vault - Expert Treasury Accounting System
 */
export class Vault {
  private treasury: VaultTreasury
  private positions: Map<string, VaultPosition>
  private transactions: VaultTransaction[]

  constructor(initialState?: Partial<VaultTreasury>) {
    this.treasury = this.initializeTreasury(initialState)
    this.positions = new Map()
    this.transactions = []
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLD START CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Conservative seed stage platform valuation
  // This is REAL VALUE - the platform itself has worth
  private static readonly INITIAL_PLATFORM_VALUATION = 5_000_000 // $5M

  // Initial GRAIN supply for founders/treasury
  // These GRAIN are allocated at $1 base but represent platform equity
  private static readonly INITIAL_GRAIN_SUPPLY = 5_000_000 // 5M GRAIN at $1 = $5M
  private static readonly FOUNDER_POOL_ALLOCATION = 0.15 // 15% to founders
  private static readonly TREASURY_RESERVE_ALLOCATION = 0.05 // 5% treasury reserve

  private initializeTreasury(initial?: Partial<VaultTreasury>): VaultTreasury {
    const now = new Date()

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZE WITH PLATFORM VALUE
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // The WellsAI + GRAIN platform has REAL VALUE from day one.
    // This is not a gimmick - it's the technology, the network, the brand.
    // Initial conservative valuation: $5M (seed stage)
    //
    // This creates initial equity that backs early GRAIN.
    // As the platform grows, this value will be updated (Series A, B, etc.)
    // ═══════════════════════════════════════════════════════════════════════════

    const platformValuation = initial?.equity?.platformValuation ?? Vault.INITIAL_PLATFORM_VALUATION

    // Initial GRAIN allocation
    const totalInitialGrain = Vault.INITIAL_GRAIN_SUPPLY
    const founderPool = totalInitialGrain * Vault.FOUNDER_POOL_ALLOCATION
    const treasuryReserve = totalInitialGrain * Vault.TREASURY_RESERVE_ALLOCATION
    const circulatingSupply = totalInitialGrain - founderPool - treasuryReserve

    return {
      // USDC LIQUIDITY (starts at 0 until first deposit)
      liquidity: {
        usdcCash: initial?.liquidity?.usdcCash ?? 0,
        usdcReserve: initial?.liquidity?.usdcReserve ?? 0,
      },

      // EQUITY (starts with platform valuation!)
      equity: {
        platformValuation: platformValuation,
        platformValuationDate: now,
        realEstate: initial?.equity?.realEstate ?? 0,
        preciousMetals: initial?.equity?.preciousMetals ?? 0,
        bonds: initial?.equity?.bonds ?? 0,
        otherInvestments: initial?.equity?.otherInvestments ?? 0,
        wellsaiFees: initial?.equity?.wellsaiFees ?? 0,
        investmentIncome: initial?.equity?.investmentIncome ?? 0,
        unrealizedGains: initial?.equity?.unrealizedGains ?? 0,
      },

      // LIABILITIES (The VAULT floor - what we owe users)
      liabilities: {
        totalPrincipal: initial?.liabilities?.totalPrincipal ?? 0,
        totalEquityBuyIn: initial?.liabilities?.totalEquityBuyIn ?? 0,
      },

      // GRAIN SUPPLY
      grainSupply: initial?.grainSupply ?? circulatingSupply,
      grainFounderPool: founderPool,
      grainTreasuryReserve: treasuryReserve,

      // CALCULATED VALUES (computed on every change)
      calculated: {
        usdcLiquidity: 0,
        equityValue: platformValuation, // Starts with platform value!
        totalEcosystemValue: platformValuation,
        grainPrice: platformValuation / circulatingSupply, // ~$1.25 at cold start
        vaultCoverage: Infinity, // No liabilities yet
        liquidityCoverage: 0, // No liquidity yet
      },

      lastUpdated: now,
      lastAudit: now,
    }
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * DEPOSIT - User deposits USDC, receives GRAIN at current price
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * ACCOUNTING:
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * 1. User receives GRAIN at current price
   * 2. Principal (floor protection) = deposit amount (ALWAYS withdrawable 1:1)
   * 3. If GRAIN > $1, they're paying equity premium for appreciation potential
   * 4. Treasury receives USDC as liquidity
   *
   * EXAMPLE at $2/GRAIN:
   *   - User deposits $1,000 USDC
   *   - Receives 500 GRAIN ($1,000 / $2)
   *   - Principal recorded: $1,000 (always withdrawable)
   *   - No equity premium concept - they bought at market price
   *
   * NEW MODEL SIMPLIFICATION:
   *   - Principal = full deposit amount (what they can always withdraw)
   *   - Equity buy-in = premium above $1 base (tracks appreciation cost)
   *   - USDC goes straight to liquidity (not allocated to investments)
   *   - Equity grows from platform value + fees, not from deposits
   */
  deposit(
    userId: string,
    usdcAmount: number,
    options?: { investmentAllocation?: number } // Optional % to allocate to yield-bearing
  ): {
    grainReceived: number
    principalRecorded: number
    equityBuyIn: number
    newGrainPrice: number
    usdcLiquidity: number
    equityValue: number
    transaction: VaultTransaction
  } {
    const currentPrice = this.getGrainPrice()

    // Calculate GRAIN to issue
    const grainToIssue = usdcAmount / currentPrice

    // Calculate principal vs equity buy-in
    // Principal = full deposit (what they can withdraw 1:1)
    // Equity buy-in = premium above $1 base (tracks appreciation cost basis)
    const principalPortion = usdcAmount  // FULL deposit is protected!
    const baseCost = grainToIssue * 1.0  // $1 per GRAIN base
    const equityBuyIn = usdcAmount - baseCost  // Premium paid for appreciation

    // Get or create user position
    let position = this.positions.get(userId)
    if (!position) {
      position = this.createPosition(userId)
    }

    // Record the acquisition
    const acquisition: GrainAcquisition = {
      id: this.generateId(),
      type: 'deposit',
      grainAmount: grainToIssue,
      pricePerGrain: currentPrice,
      principalPortion,
      equityPortion: equityBuyIn,
      totalCost: usdcAmount,
      timestamp: new Date(),
    }

    // Update user position
    position.grainBalance += grainToIssue
    position.grainAcquisitions.push(acquisition)
    position.totalPrincipal += principalPortion
    position.totalEquityPaid += equityBuyIn
    position.updatedAt = new Date()

    // ═══════════════════════════════════════════════════════════════════════════
    // UPDATE TREASURY - New USDC goes to LIQUIDITY
    // ═══════════════════════════════════════════════════════════════════════════
    const investmentPct = options?.investmentAllocation ?? 0.0 // Default: all to cash
    const cashPortion = usdcAmount * (1 - investmentPct)
    const reservePortion = usdcAmount * investmentPct

    this.treasury.liquidity.usdcCash += cashPortion
    this.treasury.liquidity.usdcReserve += reservePortion

    // Update treasury - LIABILITIES (what we owe users)
    this.treasury.liabilities.totalPrincipal += principalPortion
    this.treasury.liabilities.totalEquityBuyIn += equityBuyIn

    // Update GRAIN supply
    this.treasury.grainSupply += grainToIssue

    // Recalculate treasury values
    this.recalculateTreasury()

    // Update user calculated values
    this.updatePositionCalculations(position)

    // Record transaction
    const transaction = this.recordTransaction({
      type: 'deposit',
      userId,
      usdAmount: usdcAmount,
      grainAmount: grainToIssue,
      grainPrice: currentPrice,
      principalPortion,
      equityPortion: equityBuyIn,
      assetAllocation: {
        cash: cashPortion,
        investments: reservePortion,
      },
      notes: `Deposit $${usdcAmount.toLocaleString()} USDC at $${currentPrice.toFixed(4)}/GRAIN = ${grainToIssue.toFixed(4)} GRAIN`,
    })

    return {
      grainReceived: grainToIssue,
      principalRecorded: principalPortion,
      equityBuyIn,
      newGrainPrice: this.getGrainPrice(),
      usdcLiquidity: this.treasury.calculated.usdcLiquidity,
      equityValue: this.treasury.calculated.equityValue,
      transaction,
    }
  }

  /**
   * WITHDRAW AT VAULT (Principal) - Get your protected floor
   *
   * User can always withdraw up to their principal.
   * This is the VAULT protection.
   */
  withdrawPrincipal(
    userId: string,
    usdAmount: number
  ): {
    usdWithdrawn: number
    grainBurned: number
    remainingPrincipal: number
    remainingGrain: number
    transaction: VaultTransaction
  } {
    const position = this.positions.get(userId)
    if (!position) {
      throw new Error('User has no position')
    }

    // Can only withdraw up to principal
    const maxWithdraw = position.totalPrincipal
    const actualWithdraw = Math.min(usdAmount, maxWithdraw)

    if (actualWithdraw <= 0) {
      throw new Error('No principal available to withdraw')
    }

    // Calculate GRAIN to burn (proportional to principal withdrawn)
    const principalRatio = actualWithdraw / position.totalPrincipal
    const grainToBurn = position.grainBalance * principalRatio
    const equityToRemove = position.totalEquityPaid * principalRatio

    // Update user position
    position.grainBalance -= grainToBurn
    position.totalPrincipal -= actualWithdraw
    position.totalEquityPaid -= equityToRemove
    position.updatedAt = new Date()

    // Update treasury - LIQUIDITY (withdraw from USDC)
    this.withdrawFromLiquidity(actualWithdraw)

    // Update treasury - LIABILITIES
    this.treasury.liabilities.totalPrincipal -= actualWithdraw

    // Update treasury - LIABILITIES (remove their equity buy-in)
    this.treasury.liabilities.totalEquityBuyIn -= equityToRemove

    // Update GRAIN supply (burn)
    this.treasury.grainSupply -= grainToBurn

    // Recalculate
    this.recalculateTreasury()
    this.updatePositionCalculations(position)

    const transaction = this.recordTransaction({
      type: 'withdrawal_principal',
      userId,
      usdAmount: actualWithdraw,
      grainAmount: grainToBurn,
      grainPrice: this.getGrainPrice(),
      notes: `Withdraw principal $${actualWithdraw}, burned ${grainToBurn.toFixed(4)} GRAIN`,
    })

    return {
      usdWithdrawn: actualWithdraw,
      grainBurned: grainToBurn,
      remainingPrincipal: position.totalPrincipal,
      remainingGrain: position.grainBalance,
      transaction,
    }
  }

  /**
   * WITHDRAW AT GRAIN PRICE - Get current market value (if liquid)
   *
   * Only available if treasury has sufficient liquidity.
   * This lets users capture appreciation.
   */
  withdrawAtGrainPrice(
    userId: string,
    grainAmount: number
  ): {
    success: boolean
    usdWithdrawn: number
    grainBurned: number
    transaction?: VaultTransaction
    reason?: string
  } {
    const position = this.positions.get(userId)
    if (!position) {
      throw new Error('User has no position')
    }

    if (grainAmount > position.grainBalance) {
      throw new Error('Insufficient GRAIN balance')
    }

    const currentPrice = this.getGrainPrice()
    const usdValue = grainAmount * currentPrice

    // Check liquidity
    const liquidAssets = this.getLiquidAssets()
    if (usdValue > liquidAssets * 0.9) {  // Keep 10% buffer
      return {
        success: false,
        usdWithdrawn: 0,
        grainBurned: 0,
        reason: `Insufficient liquidity. Max available: $${(liquidAssets * 0.9).toFixed(2)}. Consider withdrawing at principal floor.`,
      }
    }

    // Calculate proportional principal and equity to remove
    const ratio = grainAmount / position.grainBalance
    const principalToRemove = position.totalPrincipal * ratio
    const equityToRemove = position.totalEquityPaid * ratio

    // Update user position
    position.grainBalance -= grainAmount
    position.totalPrincipal -= principalToRemove
    position.totalEquityPaid -= equityToRemove
    position.updatedAt = new Date()

    // Update treasury - LIQUIDITY (withdraw USDC)
    this.withdrawFromLiquidity(usdValue)

    // Update treasury - LIABILITIES
    this.treasury.liabilities.totalPrincipal -= principalToRemove
    this.treasury.liabilities.totalEquityBuyIn -= equityToRemove

    // The difference between USD withdrawn and (principal + equity paid) is realized gain
    // This comes from the appreciation - reduces equity value
    const realizedGain = usdValue - principalToRemove - equityToRemove
    if (realizedGain > 0) {
      // User is withdrawing more than they paid - this reduces equity
      this.treasury.equity.unrealizedGains -= realizedGain
    }

    // Update GRAIN supply
    this.treasury.grainSupply -= grainAmount

    // Recalculate
    this.recalculateTreasury()
    this.updatePositionCalculations(position)

    const transaction = this.recordTransaction({
      type: 'withdrawal_full',
      userId,
      usdAmount: usdValue,
      grainAmount,
      grainPrice: currentPrice,
      notes: `Full withdrawal ${grainAmount.toFixed(4)} GRAIN at $${currentPrice}/GRAIN = $${usdValue.toFixed(2)}`,
    })

    return {
      success: true,
      usdWithdrawn: usdValue,
      grainBurned: grainAmount,
      transaction,
    }
  }

  /**
   * COLLECT FEE - 33bps from WellsAI transaction
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * This is how the ecosystem grows value!
   * Fees go to EQUITY → GRAIN appreciates
   * ═══════════════════════════════════════════════════════════════════════════
   */
  collectFee(
    transactionVolume: number,
    feeRate: number = 0.0033  // 33bps
  ): {
    feeCollected: number
    newGrainPrice: number
    usdcLiquidity: number
    equityValue: number
  } {
    const fee = transactionVolume * feeRate

    // Add fee to equity (WellsAI revenue)
    this.treasury.equity.wellsaiFees += fee

    // Fee is collected as USDC, goes to liquidity
    this.treasury.liquidity.usdcCash += fee

    this.recalculateTreasury()

    return {
      feeCollected: fee,
      newGrainPrice: this.getGrainPrice(),
      usdcLiquidity: this.treasury.calculated.usdcLiquidity,
      equityValue: this.treasury.calculated.equityValue,
    }
  }

  /**
   * RECORD INVESTMENT RETURN
   *
   * When our equity investments generate returns (rent, dividends, appreciation)
   * This grows EQUITY VALUE → GRAIN appreciates
   */
  recordInvestmentReturn(
    returnAmount: number,
    source: 'real_estate' | 'precious_metals' | 'bonds' | 'other',
    options?: { isCash?: boolean } // If true, return is cash; otherwise, it's asset appreciation
  ): {
    returnRecorded: number
    newGrainPrice: number
    usdcLiquidity: number
    equityValue: number
  } {
    const isCash = options?.isCash ?? false

    // Add to appropriate equity category
    switch (source) {
      case 'real_estate':
        this.treasury.equity.realEstate += returnAmount
        break
      case 'precious_metals':
        this.treasury.equity.preciousMetals += returnAmount
        break
      case 'bonds':
        this.treasury.equity.bonds += returnAmount
        break
      case 'other':
        this.treasury.equity.otherInvestments += returnAmount
        break
    }

    // Track as investment income in equity
    this.treasury.equity.investmentIncome += returnAmount

    // If it's a cash return (dividend, rent, etc.), add to liquidity too
    if (isCash) {
      this.treasury.liquidity.usdcCash += returnAmount
    }

    this.recalculateTreasury()

    return {
      returnRecorded: returnAmount,
      newGrainPrice: this.getGrainPrice(),
      usdcLiquidity: this.treasury.calculated.usdcLiquidity,
      equityValue: this.treasury.calculated.equityValue,
    }
  }

  /**
   * REVALUE EQUITY ASSET - Mark-to-market
   *
   * When equity investment values change (real estate appraisal, metal prices, etc.)
   */
  revalueEquityAsset(
    assetType: 'platformValuation' | 'realEstate' | 'preciousMetals' | 'bonds' | 'otherInvestments',
    newValue: number
  ): {
    previousValue: number
    newValue: number
    change: number
    newGrainPrice: number
    usdcLiquidity: number
    equityValue: number
  } {
    const previousValue = this.treasury.equity[assetType] as number
    const change = newValue - previousValue

    // Update asset value
    ;(this.treasury.equity as any)[assetType] = newValue

    // Track the change as unrealized gain/loss
    this.treasury.equity.unrealizedGains += change

    // If it's platform valuation, update the date
    if (assetType === 'platformValuation') {
      this.treasury.equity.platformValuationDate = new Date()
    }

    this.recalculateTreasury()

    return {
      previousValue,
      newValue,
      change,
      newGrainPrice: this.getGrainPrice(),
      usdcLiquidity: this.treasury.calculated.usdcLiquidity,
      equityValue: this.treasury.calculated.equityValue,
    }
  }

  /**
   * UPDATE PLATFORM VALUATION
   *
   * Call this when the platform raises funding or has a new valuation event
   */
  updatePlatformValuation(
    newValuation: number,
    reason: 'seed' | 'series_a' | 'series_b' | 'appraisal' | 'market'
  ): {
    previousValuation: number
    newValuation: number
    change: number
    newGrainPrice: number
  } {
    const result = this.revalueEquityAsset('platformValuation', newValuation)

    console.log(`[VAULT] Platform valuation updated (${reason}): $${result.previousValue.toLocaleString()} → $${result.newValue.toLocaleString()} (+$${result.change.toLocaleString()})`)

    return {
      previousValuation: result.previousValue,
      newValuation: result.newValue,
      change: result.change,
      newGrainPrice: result.newGrainPrice,
    }
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get current GRAIN price
   *
   * GRAIN PRICE = Total Ecosystem Value / Total GRAIN Supply
   *
   * Where:
   *   Total Ecosystem Value = USDC Liquidity + Equity Value
   *   Total GRAIN Supply = circulating + founder pool + treasury reserve
   */
  getGrainPrice(): number {
    const totalGrainSupply =
      this.treasury.grainSupply +
      this.treasury.grainFounderPool +
      this.treasury.grainTreasuryReserve

    if (totalGrainSupply === 0) {
      return 1.0  // Initial price
    }

    const usdcLiquidity =
      this.treasury.liquidity.usdcCash +
      this.treasury.liquidity.usdcReserve

    const equityValue =
      this.treasury.equity.platformValuation +
      this.treasury.equity.realEstate +
      this.treasury.equity.preciousMetals +
      this.treasury.equity.bonds +
      this.treasury.equity.otherInvestments +
      this.treasury.equity.wellsaiFees +
      this.treasury.equity.investmentIncome +
      this.treasury.equity.unrealizedGains

    return (usdcLiquidity + equityValue) / totalGrainSupply
  }

  /**
   * Get user's position with current calculations
   */
  getPosition(userId: string): VaultPosition | null {
    const position = this.positions.get(userId)
    if (!position) return null

    this.updatePositionCalculations(position)
    return { ...position }
  }

  /**
   * Get treasury snapshot
   */
  getTreasurySnapshot(): VaultTreasury {
    this.recalculateTreasury()
    return { ...this.treasury }
  }

  /**
   * Get liquid assets available for withdrawals (USDC only)
   */
  getLiquidAssets(): number {
    return this.treasury.liquidity.usdcCash + this.treasury.liquidity.usdcReserve
  }

  /**
   * Get USDC liquidity (cash available now)
   */
  getUsdcLiquidity(): number {
    return this.treasury.calculated.usdcLiquidity
  }

  /**
   * Get total equity value (platform + investments + fees)
   */
  getEquityValue(): number {
    return this.treasury.calculated.equityValue
  }

  /**
   * Get vault coverage ratio (should be >= 1)
   * Total ecosystem value / total principal owed
   */
  getVaultCoverage(): number {
    if (this.treasury.liabilities.totalPrincipal === 0) return Infinity
    return this.treasury.calculated.totalEcosystemValue / this.treasury.liabilities.totalPrincipal
  }

  /**
   * Get liquidity coverage ratio
   * USDC liquidity / total principal owed
   */
  getLiquidityCoverage(): number {
    if (this.treasury.liabilities.totalPrincipal === 0) {
      return this.treasury.calculated.usdcLiquidity > 0 ? Infinity : 0
    }
    return this.treasury.calculated.usdcLiquidity / this.treasury.liabilities.totalPrincipal
  }

  /**
   * Check if we can handle a bank run (everyone withdraws principal)
   *
   * BANK RUN PROTECTION:
   * - USDC Liquidity covers immediate withdrawals
   * - Equity stays with the ecosystem
   * - Even in worst case, principals are paid, equity remains
   */
  canSurviveBankRun(): {
    canSurvive: boolean
    totalPrincipal: number
    usdcLiquidity: number
    equityValue: number
    totalEcosystemValue: number
    surplusOverPrincipal: number
    liquidityGap: number // Negative if we need to liquidate equity
  } {
    const totalPrincipal = this.treasury.liabilities.totalPrincipal
    const usdcLiquidity = this.treasury.calculated.usdcLiquidity
    const equityValue = this.treasury.calculated.equityValue
    const totalEcosystemValue = this.treasury.calculated.totalEcosystemValue

    return {
      canSurvive: totalEcosystemValue >= totalPrincipal,
      totalPrincipal,
      usdcLiquidity,
      equityValue,
      totalEcosystemValue,
      surplusOverPrincipal: totalEcosystemValue - totalPrincipal,
      liquidityGap: usdcLiquidity - totalPrincipal, // Positive = fully liquid
    }
  }

  /**
   * Get full audit report
   */
  getAuditReport(): {
    treasury: VaultTreasury
    summary: TreasurySummary
    accounting: {
      // The key equation: USDC Liquidity + Equity = What backs GRAIN
      usdcLiquidity: number
      equityValue: number
      totalEcosystemValue: number
      // Liabilities: what we owe users
      totalPrincipal: number
      totalEquityBuyIn: number
      // Surplus: ecosystem value - liabilities
      surplus: number
    }
    health: {
      grainPrice: number
      vaultCoverage: number       // Total value / principal (should be > 1)
      liquidityCoverage: number   // USDC / principal (cash coverage)
      canSurviveBankRun: boolean
      liquidityGap: number        // USDC - principal (positive = fully liquid)
    }
    grainSupply: {
      circulating: number
      founderPool: number
      treasuryReserve: number
      total: number
    }
    positions: {
      count: number
      totalGrain: number
      totalPrincipal: number
    }
  } {
    this.recalculateTreasury()

    const usdcLiquidity = this.treasury.calculated.usdcLiquidity
    const equityValue = this.treasury.calculated.equityValue
    const totalEcosystemValue = this.treasury.calculated.totalEcosystemValue
    const totalPrincipal = this.treasury.liabilities.totalPrincipal
    const totalEquityBuyIn = this.treasury.liabilities.totalEquityBuyIn

    let totalGrain = 0
    let totalUserPrincipal = 0
    this.positions.forEach((position) => {
      totalGrain += position.grainBalance
      totalUserPrincipal += position.totalPrincipal
    })

    const bankRunCheck = this.canSurviveBankRun()

    // Build treasury summary for dashboard
    const summary: TreasurySummary = this.getTreasurySummary()

    return {
      treasury: { ...this.treasury },
      summary,
      accounting: {
        usdcLiquidity,
        equityValue,
        totalEcosystemValue,
        totalPrincipal,
        totalEquityBuyIn,
        surplus: totalEcosystemValue - totalPrincipal,
      },
      health: {
        grainPrice: this.getGrainPrice(),
        vaultCoverage: this.getVaultCoverage(),
        liquidityCoverage: this.getLiquidityCoverage(),
        canSurviveBankRun: bankRunCheck.canSurvive,
        liquidityGap: bankRunCheck.liquidityGap,
      },
      grainSupply: {
        circulating: this.treasury.grainSupply,
        founderPool: this.treasury.grainFounderPool,
        treasuryReserve: this.treasury.grainTreasuryReserve,
        total: this.treasury.grainSupply +
          this.treasury.grainFounderPool +
          this.treasury.grainTreasuryReserve,
      },
      positions: {
        count: this.positions.size,
        totalGrain,
        totalPrincipal: totalUserPrincipal,
      },
    }
  }

  /**
   * Get treasury summary for dashboard display
   * THE TWO NUMBERS EVERYONE SEES: USDC Liquidity + Equity Value
   */
  getTreasurySummary(): TreasurySummary {
    this.recalculateTreasury()

    const usdcLiquidity = this.treasury.calculated.usdcLiquidity
    const equityValue = this.treasury.calculated.equityValue
    const totalValue = this.treasury.calculated.totalEcosystemValue
    const grainPrice = this.treasury.calculated.grainPrice
    const totalGrainSupply =
      this.treasury.grainSupply +
      this.treasury.grainFounderPool +
      this.treasury.grainTreasuryReserve

    return {
      // THE TWO NUMBERS
      usdcLiquidity,
      equityValue,
      totalValue,

      // GRAIN METRICS
      grainPrice,
      grainPriceFormatted: `$${grainPrice.toFixed(4)}`,
      grainSupply: totalGrainSupply,
      grainMarketCap: totalValue,

      // COVERAGE RATIOS
      vaultCoverage: this.treasury.calculated.vaultCoverage,
      vaultCoverageFormatted: this.treasury.calculated.vaultCoverage === Infinity
        ? '∞'
        : `${(this.treasury.calculated.vaultCoverage * 100).toFixed(1)}%`,
      liquidityCoverage: this.treasury.calculated.liquidityCoverage,
      liquidityCoverageFormatted: this.treasury.calculated.liquidityCoverage === Infinity
        ? '∞'
        : `${(this.treasury.calculated.liquidityCoverage * 100).toFixed(1)}%`,

      // DETAILED BREAKDOWNS
      liquidityBreakdown: {
        usdcCash: this.treasury.liquidity.usdcCash,
        usdcReserve: this.treasury.liquidity.usdcReserve,
      },
      equityBreakdown: {
        platformValue: this.treasury.equity.platformValuation,
        investments:
          this.treasury.equity.realEstate +
          this.treasury.equity.preciousMetals +
          this.treasury.equity.bonds +
          this.treasury.equity.otherInvestments,
        accumulatedRevenue:
          this.treasury.equity.wellsaiFees +
          this.treasury.equity.investmentIncome +
          this.treasury.equity.unrealizedGains,
      },
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private createPosition(userId: string): VaultPosition {
    const position: VaultPosition = {
      userId,
      grainBalance: 0,
      grainAcquisitions: [],
      totalPrincipal: 0,
      totalEquityPaid: 0,
      currentGrainValue: 0,
      protectedFloor: 0,
      unrealizedGain: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.positions.set(userId, position)
    return position
  }

  private updatePositionCalculations(position: VaultPosition): void {
    const currentPrice = this.getGrainPrice()
    position.currentGrainValue = position.grainBalance * currentPrice
    position.protectedFloor = position.totalPrincipal
    position.unrealizedGain =
      position.currentGrainValue - position.totalPrincipal - position.totalEquityPaid
  }

  private recalculateTreasury(): void {
    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULATE USDC LIQUIDITY
    // This is what users can withdraw (cash available)
    // ═══════════════════════════════════════════════════════════════════════════
    const usdcLiquidity =
      this.treasury.liquidity.usdcCash +
      this.treasury.liquidity.usdcReserve

    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULATE EQUITY VALUE
    // Platform value + investments + accumulated revenue
    // ═══════════════════════════════════════════════════════════════════════════
    const equityValue =
      this.treasury.equity.platformValuation +
      this.treasury.equity.realEstate +
      this.treasury.equity.preciousMetals +
      this.treasury.equity.bonds +
      this.treasury.equity.otherInvestments +
      this.treasury.equity.wellsaiFees +
      this.treasury.equity.investmentIncome +
      this.treasury.equity.unrealizedGains

    // ═══════════════════════════════════════════════════════════════════════════
    // TOTAL ECOSYSTEM VALUE = USDC Liquidity + Equity Value
    // This is THE number that determines GRAIN price
    // ═══════════════════════════════════════════════════════════════════════════
    const totalEcosystemValue = usdcLiquidity + equityValue

    // ═══════════════════════════════════════════════════════════════════════════
    // GRAIN PRICE = Total Ecosystem Value / GRAIN Supply
    // ═══════════════════════════════════════════════════════════════════════════
    const totalGrainSupply =
      this.treasury.grainSupply +
      this.treasury.grainFounderPool +
      this.treasury.grainTreasuryReserve

    const grainPrice = totalGrainSupply > 0
      ? totalEcosystemValue / totalGrainSupply
      : 1.0

    // ═══════════════════════════════════════════════════════════════════════════
    // COVERAGE RATIOS
    // ═══════════════════════════════════════════════════════════════════════════
    const totalPrincipal = this.treasury.liabilities.totalPrincipal

    // Vault coverage: total value / total principal owed
    const vaultCoverage = totalPrincipal > 0
      ? totalEcosystemValue / totalPrincipal
      : Infinity

    // Liquidity coverage: cash / total principal owed
    const liquidityCoverage = totalPrincipal > 0
      ? usdcLiquidity / totalPrincipal
      : usdcLiquidity > 0 ? Infinity : 0

    // ═══════════════════════════════════════════════════════════════════════════
    // UPDATE CALCULATED VALUES
    // ═══════════════════════════════════════════════════════════════════════════
    this.treasury.calculated = {
      usdcLiquidity,
      equityValue,
      totalEcosystemValue,
      grainPrice,
      vaultCoverage,
      liquidityCoverage,
    }

    this.treasury.lastUpdated = new Date()
  }

  private allocateDeposit(
    amount: number,
    strategy: 'conservative' | 'balanced' | 'growth' = 'balanced'
  ): {
    cash: number
    shortTermBonds: number
    reits: number
    realEstate: number
    preciousMetals: number
  } {
    // Allocation strategies
    const allocations = {
      conservative: { cash: 0.40, bonds: 0.30, reits: 0.15, realEstate: 0.10, metals: 0.05 },
      balanced: { cash: 0.20, bonds: 0.20, reits: 0.20, realEstate: 0.25, metals: 0.15 },
      growth: { cash: 0.10, bonds: 0.10, reits: 0.20, realEstate: 0.40, metals: 0.20 },
    }

    const alloc = allocations[strategy]

    return {
      cash: amount * alloc.cash,
      shortTermBonds: amount * alloc.bonds,
      reits: amount * alloc.reits,
      realEstate: amount * alloc.realEstate,
      preciousMetals: amount * alloc.metals,
    }
  }

  /**
   * Withdraw from liquidity (USDC)
   * Uses cash first, then reserve
   */
  private withdrawFromLiquidity(amount: number): void {
    let remaining = amount

    // Use USDC cash first (instant access)
    if (this.treasury.liquidity.usdcCash >= remaining) {
      this.treasury.liquidity.usdcCash -= remaining
      return
    } else {
      remaining -= this.treasury.liquidity.usdcCash
      this.treasury.liquidity.usdcCash = 0
    }

    // Then USDC reserve (same-day access)
    if (this.treasury.liquidity.usdcReserve >= remaining) {
      this.treasury.liquidity.usdcReserve -= remaining
      return
    } else {
      remaining -= this.treasury.liquidity.usdcReserve
      this.treasury.liquidity.usdcReserve = 0
    }

    // If we get here, we've exhausted USDC liquidity
    // This shouldn't happen if liquidity checks are done first
    if (remaining > 0) {
      console.warn(`[VAULT] Insufficient liquidity: $${remaining.toFixed(2)} shortfall`)
    }
  }

  private recordTransaction(
    params: Omit<VaultTransaction, 'id' | 'timestamp' | 'userGrainBalance' | 'userPrincipal' | 'treasuryAssets' | 'treasuryPrincipal'>
  ): VaultTransaction {
    const position = this.positions.get(params.userId)

    const transaction: VaultTransaction = {
      id: this.generateId(),
      timestamp: new Date(),
      ...params,
      userGrainBalance: position?.grainBalance ?? 0,
      userPrincipal: position?.totalPrincipal ?? 0,
      treasuryAssets: this.treasury.calculated.totalEcosystemValue,
      treasuryPrincipal: this.treasury.liabilities.totalPrincipal,
    }

    this.transactions.push(transaction)
    return transaction
  }

  private generateId(): string {
    return `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  /**
   * Export state for persistence
   */
  exportState(): {
    treasury: VaultTreasury
    positions: Array<[string, VaultPosition]>
    transactions: VaultTransaction[]
  } {
    return {
      treasury: this.treasury,
      positions: Array.from(this.positions.entries()),
      transactions: this.transactions,
    }
  }

  /**
   * Import state from persistence
   */
  static fromState(state: {
    treasury: VaultTreasury
    positions: Array<[string, VaultPosition]>
    transactions: VaultTransaction[]
  }): Vault {
    const vault = new Vault(state.treasury)
    vault.positions = new Map(state.positions)
    vault.transactions = state.transactions
    return vault
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Full lifecycle demonstration
 *
 * DEMONSTRATES THE KEY CONCEPTS:
 * 1. COLD START: Platform starts with $5M equity valuation
 * 2. DEPOSITS: Users deposit USDC, receive GRAIN at current price
 * 3. FEE COLLECTION: 33bps fees grow equity → GRAIN appreciates
 * 4. NEW USERS: Buy GRAIN at higher price → liquidity always covers
 * 5. BANK RUN: Principals always paid, equity stays with ecosystem
 */
export function demonstrateVault(): void {
  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('  VAULT DEMONSTRATION - USDC Liquidity + Equity Value Model')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')

  // Initialize Vault - starts with $5M platform valuation
  const vault = new Vault()

  // Cold start state
  console.log('--- COLD START (Platform has $5M valuation) ---')
  const coldStartSummary = vault.getTreasurySummary()
  console.log(`  USDC Liquidity: $${coldStartSummary.usdcLiquidity.toLocaleString()}`)
  console.log(`  Equity Value:   $${coldStartSummary.equityValue.toLocaleString()}`)
  console.log(`  GRAIN Price:    ${coldStartSummary.grainPriceFormatted}`)
  console.log(`  GRAIN Supply:   ${coldStartSummary.grainSupply.toLocaleString()}`)

  // First user deposits
  console.log('\n--- FIRST USER DEPOSIT ---')
  const alice = vault.deposit('alice', 10000)
  console.log(`  Alice deposits $10,000 USDC`)
  console.log(`  GRAIN received: ${alice.grainReceived.toFixed(4)} GRAIN`)
  console.log(`  GRAIN price:    $${alice.newGrainPrice.toFixed(4)}`)
  console.log(`  Principal:      $${alice.principalRecorded.toLocaleString()} (always withdrawable)`)
  console.log(`  USDC Liquidity: $${alice.usdcLiquidity.toLocaleString()}`)
  console.log(`  Equity Value:   $${alice.equityValue.toLocaleString()}`)

  // Simulate WellsAI fee collection (33bps on $1M in transactions)
  console.log('\n--- WELLSAI FEE COLLECTION (33bps on $1M) ---')
  const feeResult = vault.collectFee(1000000) // $1M in transactions
  console.log(`  Fee collected:  $${feeResult.feeCollected.toLocaleString()}`)
  console.log(`  New GRAIN price: $${feeResult.newGrainPrice.toFixed(4)}`)
  console.log(`  Equity Value:   $${feeResult.equityValue.toLocaleString()}`)

  // Investment returns
  console.log('\n--- INVESTMENT RETURNS ---')
  const realEstateReturn = vault.recordInvestmentReturn(50000, 'real_estate', { isCash: true })
  console.log(`  Real estate dividend: $${realEstateReturn.returnRecorded.toLocaleString()}`)
  console.log(`  New GRAIN price: $${realEstateReturn.newGrainPrice.toFixed(4)}`)
  console.log(`  USDC Liquidity: $${realEstateReturn.usdcLiquidity.toLocaleString()}`)
  console.log(`  Equity Value:   $${realEstateReturn.equityValue.toLocaleString()}`)

  // New user joins at higher price
  console.log('\n--- NEW USER AT HIGHER PRICE ---')
  const bob = vault.deposit('bob', 50000)
  console.log(`  Bob deposits $50,000 USDC at $${vault.getGrainPrice().toFixed(4)}/GRAIN`)
  console.log(`  GRAIN received: ${bob.grainReceived.toFixed(4)} GRAIN`)
  console.log(`  Principal:      $${bob.principalRecorded.toLocaleString()} (always withdrawable)`)
  console.log(`  USDC Liquidity: $${bob.usdcLiquidity.toLocaleString()}`)
  console.log(`  Equity Value:   $${bob.equityValue.toLocaleString()}`)

  // Check positions
  console.log('\n--- USER POSITIONS ---')
  const alicePosition = vault.getPosition('alice')!
  const bobPosition = vault.getPosition('bob')!
  console.log(`  Alice: ${alicePosition.grainBalance.toFixed(4)} GRAIN, worth $${alicePosition.currentGrainValue.toFixed(2)}, floor $${alicePosition.protectedFloor.toFixed(2)}`)
  console.log(`  Bob:   ${bobPosition.grainBalance.toFixed(4)} GRAIN, worth $${bobPosition.currentGrainValue.toFixed(2)}, floor $${bobPosition.protectedFloor.toFixed(2)}`)

  // Treasury summary
  console.log('\n--- TREASURY SUMMARY ---')
  const summary = vault.getTreasurySummary()
  console.log(`  ┌────────────────────────────────────────────┐`)
  console.log(`  │  USDC LIQUIDITY:  $${summary.usdcLiquidity.toLocaleString().padStart(15)}  │`)
  console.log(`  │  EQUITY VALUE:    $${summary.equityValue.toLocaleString().padStart(15)}  │`)
  console.log(`  ├────────────────────────────────────────────┤`)
  console.log(`  │  TOTAL VALUE:     $${summary.totalValue.toLocaleString().padStart(15)}  │`)
  console.log(`  └────────────────────────────────────────────┘`)
  console.log(`  GRAIN Price: ${summary.grainPriceFormatted}`)
  console.log(`  Vault Coverage: ${summary.vaultCoverageFormatted}`)
  console.log(`  Liquidity Coverage: ${summary.liquidityCoverageFormatted}`)

  // Bank run check
  console.log('\n--- BANK RUN PROTECTION ---')
  const bankRun = vault.canSurviveBankRun()
  console.log(`  Can survive: ${bankRun.canSurvive ? '✓ YES' : '✗ NO'}`)
  console.log(`  Total Principal: $${bankRun.totalPrincipal.toLocaleString()}`)
  console.log(`  USDC Liquidity: $${bankRun.usdcLiquidity.toLocaleString()}`)
  console.log(`  Liquidity Gap: $${bankRun.liquidityGap.toLocaleString()} ${bankRun.liquidityGap >= 0 ? '(fully liquid)' : '(need to liquidate equity)'}`)
  console.log(`  Equity Remaining: $${bankRun.equityValue.toLocaleString()}`)

  console.log('\n═══════════════════════════════════════════════════════════════════════════')
  console.log('  KEY INSIGHT: Equity stays with ecosystem even in worst case!')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')
}
