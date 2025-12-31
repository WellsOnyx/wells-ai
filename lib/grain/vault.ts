/**
 * VAULT - The Treasury Accounting Expert
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VAULT TRACKS EVERYTHING. PERFECTLY. ALWAYS.
 * ═══════════════════════════════════════════════════════════════════════════
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
 */
export interface VaultTreasury {
  // Asset Side (What we OWN)
  assets: {
    // Liquid
    cashUsd: number              // Cash and USDC
    shortTermBonds: number       // T-bills, money market

    // Semi-Liquid (30-90 days to liquidate)
    reits: number                // Real estate investment trusts
    preciousMetalsEtf: number    // Gold/Silver ETFs

    // Illiquid (Strategic holdings)
    realEstateDirect: number     // Direct property ownership
    preciousMetalsDirect: number // Physical gold/silver
    otherInvestments: number     // Other revenue-generating assets

    // Ecosystem Revenue
    accumulatedFees: number      // 33bps from WellsAI transactions
  }

  // Liability Side (What we OWE)
  liabilities: {
    totalPrincipal: number       // Sum of all user principals (Vault floor)
  }

  // Equity Side (What BELONGS to GRAIN holders collectively)
  equity: {
    totalEquityBuyIn: number     // Premium paid by users above $1 base
    retainedEarnings: number     // Accumulated investment returns + fees
    unrealizedGains: number      // Asset appreciation not yet realized
  }

  // GRAIN Supply
  grainSupply: number            // Total GRAIN in circulation

  // Calculated
  totalAssetValue: number        // Sum of all assets
  grainPrice: number             // totalAssetValue / grainSupply
  vaultCoverage: number          // totalAssetValue / totalPrincipal (should be > 1)

  // Timestamps
  lastUpdated: Date
  lastAudit: Date
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

  private initializeTreasury(initial?: Partial<VaultTreasury>): VaultTreasury {
    const now = new Date()
    return {
      assets: {
        cashUsd: initial?.assets?.cashUsd ?? 0,
        shortTermBonds: initial?.assets?.shortTermBonds ?? 0,
        reits: initial?.assets?.reits ?? 0,
        preciousMetalsEtf: initial?.assets?.preciousMetalsEtf ?? 0,
        realEstateDirect: initial?.assets?.realEstateDirect ?? 0,
        preciousMetalsDirect: initial?.assets?.preciousMetalsDirect ?? 0,
        otherInvestments: initial?.assets?.otherInvestments ?? 0,
        accumulatedFees: initial?.assets?.accumulatedFees ?? 0,
      },
      liabilities: {
        totalPrincipal: initial?.liabilities?.totalPrincipal ?? 0,
      },
      equity: {
        totalEquityBuyIn: initial?.equity?.totalEquityBuyIn ?? 0,
        retainedEarnings: initial?.equity?.retainedEarnings ?? 0,
        unrealizedGains: initial?.equity?.unrealizedGains ?? 0,
      },
      grainSupply: initial?.grainSupply ?? 0,
      totalAssetValue: 0,
      grainPrice: 1.0, // Starts at $1
      vaultCoverage: 1.0,
      lastUpdated: now,
      lastAudit: now,
    }
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * DEPOSIT - User deposits USD, receives GRAIN at current price
   *
   * ACCOUNTING:
   * - User receives GRAIN at current price
   * - Principal (floor protection) = deposit amount
   * - If GRAIN > $1, they're paying equity premium
   * - Treasury receives cash, allocates to assets
   */
  deposit(
    userId: string,
    usdAmount: number,
    options?: { allocationStrategy?: 'conservative' | 'balanced' | 'growth' }
  ): {
    grainReceived: number
    principalRecorded: number
    equityPaid: number
    newGrainPrice: number
    transaction: VaultTransaction
  } {
    const currentPrice = this.getGrainPrice()

    // Calculate GRAIN to issue
    const grainToIssue = usdAmount / currentPrice

    // Calculate principal vs equity portions
    // Principal = $1 per GRAIN (the protected floor)
    // Equity = premium above $1 (the buy-in cost)
    const principalPortion = grainToIssue * 1.0  // $1 per GRAIN base
    const equityPortion = usdAmount - principalPortion  // Premium paid

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
      equityPortion,
      totalCost: usdAmount,
      timestamp: new Date(),
    }

    // Update user position
    position.grainBalance += grainToIssue
    position.grainAcquisitions.push(acquisition)
    position.totalPrincipal += principalPortion
    position.totalEquityPaid += equityPortion
    position.updatedAt = new Date()

    // Update treasury - ASSETS
    const allocation = this.allocateDeposit(usdAmount, options?.allocationStrategy)
    this.treasury.assets.cashUsd += allocation.cash
    this.treasury.assets.shortTermBonds += allocation.shortTermBonds
    this.treasury.assets.reits += allocation.reits
    this.treasury.assets.realEstateDirect += allocation.realEstate
    this.treasury.assets.preciousMetalsEtf += allocation.preciousMetals

    // Update treasury - LIABILITIES
    this.treasury.liabilities.totalPrincipal += principalPortion

    // Update treasury - EQUITY
    this.treasury.equity.totalEquityBuyIn += equityPortion

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
      usdAmount,
      grainAmount: grainToIssue,
      grainPrice: currentPrice,
      principalPortion,
      equityPortion,
      assetAllocation: {
        cash: allocation.cash,
        investments: usdAmount - allocation.cash,
      },
      notes: `Deposit $${usdAmount} at $${currentPrice}/GRAIN = ${grainToIssue.toFixed(4)} GRAIN`,
    })

    return {
      grainReceived: grainToIssue,
      principalRecorded: principalPortion,
      equityPaid: equityPortion,
      newGrainPrice: this.getGrainPrice(),
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

    // Update treasury - ASSETS (use liquid assets first)
    this.withdrawFromAssets(actualWithdraw)

    // Update treasury - LIABILITIES
    this.treasury.liabilities.totalPrincipal -= actualWithdraw

    // Update treasury - EQUITY (remove their equity buy-in)
    this.treasury.equity.totalEquityBuyIn -= equityToRemove

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

    // Update treasury - ASSETS
    this.withdrawFromAssets(usdValue)

    // Update treasury - LIABILITIES
    this.treasury.liabilities.totalPrincipal -= principalToRemove

    // Update treasury - EQUITY
    // The difference between USD withdrawn and (principal + equity paid) is realized gain
    const realizedGain = usdValue - principalToRemove - equityToRemove
    this.treasury.equity.totalEquityBuyIn -= equityToRemove
    this.treasury.equity.retainedEarnings -= realizedGain

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
   * This is how the ecosystem grows value.
   * Fees go into retained earnings = GRAIN appreciates.
   */
  collectFee(
    transactionVolume: number,
    feeRate: number = 0.0033  // 33bps
  ): {
    feeCollected: number
    newGrainPrice: number
  } {
    const fee = transactionVolume * feeRate

    // Add to accumulated fees (asset)
    this.treasury.assets.accumulatedFees += fee

    // Add to retained earnings (equity)
    this.treasury.equity.retainedEarnings += fee

    this.recalculateTreasury()

    return {
      feeCollected: fee,
      newGrainPrice: this.getGrainPrice(),
    }
  }

  /**
   * RECORD INVESTMENT RETURN
   *
   * When our assets generate returns (rent, dividends, appreciation)
   */
  recordInvestmentReturn(
    returnAmount: number,
    source: 'real_estate' | 'precious_metals' | 'bonds' | 'other'
  ): {
    returnRecorded: number
    newGrainPrice: number
  } {
    // Add to appropriate asset category
    switch (source) {
      case 'real_estate':
        this.treasury.assets.realEstateDirect += returnAmount
        break
      case 'precious_metals':
        this.treasury.assets.preciousMetalsDirect += returnAmount
        break
      case 'bonds':
        this.treasury.assets.shortTermBonds += returnAmount
        break
      case 'other':
        this.treasury.assets.otherInvestments += returnAmount
        break
    }

    // Add to retained earnings
    this.treasury.equity.retainedEarnings += returnAmount

    this.recalculateTreasury()

    return {
      returnRecorded: returnAmount,
      newGrainPrice: this.getGrainPrice(),
    }
  }

  /**
   * REVALUE ASSETS - Mark-to-market
   *
   * When asset values change (real estate appraisal, metal prices, etc.)
   */
  revalueAssets(
    assetType: keyof VaultTreasury['assets'],
    newValue: number
  ): {
    previousValue: number
    newValue: number
    change: number
    newGrainPrice: number
  } {
    const previousValue = this.treasury.assets[assetType]
    const change = newValue - previousValue

    // Update asset value
    this.treasury.assets[assetType] = newValue

    // Update unrealized gains
    this.treasury.equity.unrealizedGains += change

    this.recalculateTreasury()

    return {
      previousValue,
      newValue,
      change,
      newGrainPrice: this.getGrainPrice(),
    }
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Get current GRAIN price based on total asset value
   */
  getGrainPrice(): number {
    if (this.treasury.grainSupply === 0) {
      return 1.0  // Initial price
    }
    return this.treasury.totalAssetValue / this.treasury.grainSupply
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
   * Get liquid assets available for withdrawals
   */
  getLiquidAssets(): number {
    return this.treasury.assets.cashUsd + this.treasury.assets.shortTermBonds
  }

  /**
   * Get vault coverage ratio (should be >= 1)
   */
  getVaultCoverage(): number {
    if (this.treasury.liabilities.totalPrincipal === 0) return Infinity
    return this.treasury.totalAssetValue / this.treasury.liabilities.totalPrincipal
  }

  /**
   * Check if we can handle a bank run (everyone withdraws principal)
   */
  canSurviveBankRun(): {
    canSurvive: boolean
    totalPrincipal: number
    totalAssets: number
    surplus: number
  } {
    const totalPrincipal = this.treasury.liabilities.totalPrincipal
    const totalAssets = this.treasury.totalAssetValue

    return {
      canSurvive: totalAssets >= totalPrincipal,
      totalPrincipal,
      totalAssets,
      surplus: totalAssets - totalPrincipal,
    }
  }

  /**
   * Get full audit report
   */
  getAuditReport(): {
    treasury: VaultTreasury
    accounting: {
      assetsEqualLiabilitiesPlusEquity: boolean
      totalAssets: number
      totalLiabilities: number
      totalEquity: number
      difference: number
    }
    health: {
      grainPrice: number
      vaultCoverage: number
      liquidityRatio: number
      canSurviveBankRun: boolean
    }
    positions: {
      count: number
      totalGrain: number
      totalPrincipal: number
    }
  } {
    this.recalculateTreasury()

    const totalAssets = this.treasury.totalAssetValue
    const totalLiabilities = this.treasury.liabilities.totalPrincipal
    const totalEquity =
      this.treasury.equity.totalEquityBuyIn +
      this.treasury.equity.retainedEarnings +
      this.treasury.equity.unrealizedGains

    // Assets should equal Liabilities + Equity (basic accounting equation)
    const difference = totalAssets - (totalLiabilities + totalEquity)

    let totalGrain = 0
    let totalPrincipal = 0
    for (const position of this.positions.values()) {
      totalGrain += position.grainBalance
      totalPrincipal += position.totalPrincipal
    }

    return {
      treasury: { ...this.treasury },
      accounting: {
        assetsEqualLiabilitiesPlusEquity: Math.abs(difference) < 0.01,
        totalAssets,
        totalLiabilities,
        totalEquity,
        difference,
      },
      health: {
        grainPrice: this.getGrainPrice(),
        vaultCoverage: this.getVaultCoverage(),
        liquidityRatio: this.getLiquidAssets() / totalAssets,
        canSurviveBankRun: this.canSurviveBankRun().canSurvive,
      },
      positions: {
        count: this.positions.size,
        totalGrain,
        totalPrincipal,
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
    // Sum all assets
    this.treasury.totalAssetValue =
      this.treasury.assets.cashUsd +
      this.treasury.assets.shortTermBonds +
      this.treasury.assets.reits +
      this.treasury.assets.preciousMetalsEtf +
      this.treasury.assets.realEstateDirect +
      this.treasury.assets.preciousMetalsDirect +
      this.treasury.assets.otherInvestments +
      this.treasury.assets.accumulatedFees

    // Calculate GRAIN price
    this.treasury.grainPrice = this.getGrainPrice()

    // Calculate vault coverage
    this.treasury.vaultCoverage = this.getVaultCoverage()

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

  private withdrawFromAssets(amount: number): void {
    let remaining = amount

    // Use liquid assets first
    if (this.treasury.assets.cashUsd >= remaining) {
      this.treasury.assets.cashUsd -= remaining
      return
    } else {
      remaining -= this.treasury.assets.cashUsd
      this.treasury.assets.cashUsd = 0
    }

    if (this.treasury.assets.shortTermBonds >= remaining) {
      this.treasury.assets.shortTermBonds -= remaining
      return
    } else {
      remaining -= this.treasury.assets.shortTermBonds
      this.treasury.assets.shortTermBonds = 0
    }

    // Then semi-liquid
    if (this.treasury.assets.reits >= remaining) {
      this.treasury.assets.reits -= remaining
      return
    } else {
      remaining -= this.treasury.assets.reits
      this.treasury.assets.reits = 0
    }

    if (this.treasury.assets.preciousMetalsEtf >= remaining) {
      this.treasury.assets.preciousMetalsEtf -= remaining
      return
    } else {
      remaining -= this.treasury.assets.preciousMetalsEtf
      this.treasury.assets.preciousMetalsEtf = 0
    }

    // Finally illiquid (shouldn't normally happen)
    if (remaining > 0) {
      // Pro-rata from illiquid assets
      const illiquidTotal =
        this.treasury.assets.realEstateDirect +
        this.treasury.assets.preciousMetalsDirect +
        this.treasury.assets.otherInvestments

      if (illiquidTotal > 0) {
        const ratio = remaining / illiquidTotal
        this.treasury.assets.realEstateDirect -= this.treasury.assets.realEstateDirect * ratio
        this.treasury.assets.preciousMetalsDirect -= this.treasury.assets.preciousMetalsDirect * ratio
        this.treasury.assets.otherInvestments -= this.treasury.assets.otherInvestments * ratio
      }
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
      treasuryAssets: this.treasury.totalAssetValue,
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
 */
export function demonstrateVault(): void {
  console.log('=== VAULT DEMONSTRATION ===\n')

  // Initialize Vault
  const vault = new Vault()

  // COLD START: First user deposits at $1/GRAIN
  console.log('--- COLD START ---')
  const alice = vault.deposit('alice', 10000)
  console.log(`Alice deposits $10,000 at $${alice.newGrainPrice}/GRAIN`)
  console.log(`Alice receives: ${alice.grainReceived} GRAIN`)
  console.log(`Principal recorded: $${alice.principalRecorded}`)
  console.log(`Equity paid: $${alice.equityPaid}`)

  // Simulate investment returns (treasury grows)
  console.log('\n--- INVESTMENT RETURNS ---')
  vault.recordInvestmentReturn(500, 'real_estate')  // 5% on real estate portion
  vault.recordInvestmentReturn(200, 'precious_metals')
  vault.collectFee(100000)  // $100k in WellsAI transactions

  const newPrice = vault.getGrainPrice()
  console.log(`New GRAIN price: $${newPrice.toFixed(4)}`)

  // New user joins at higher price
  console.log('\n--- NEW USER AT HIGHER PRICE ---')
  const bob = vault.deposit('bob', 5000)
  console.log(`Bob deposits $5,000 at $${vault.getGrainPrice().toFixed(4)}/GRAIN`)
  console.log(`Bob receives: ${bob.grainReceived.toFixed(4)} GRAIN`)
  console.log(`Principal recorded: $${bob.principalRecorded.toFixed(2)}`)
  console.log(`Equity paid: $${bob.equityPaid.toFixed(2)}`)

  // Check positions
  console.log('\n--- POSITIONS ---')
  const alicePosition = vault.getPosition('alice')!
  const bobPosition = vault.getPosition('bob')!
  console.log(`Alice: ${alicePosition.grainBalance.toFixed(4)} GRAIN, worth $${alicePosition.currentGrainValue.toFixed(2)}, floor $${alicePosition.protectedFloor.toFixed(2)}`)
  console.log(`Bob: ${bobPosition.grainBalance.toFixed(4)} GRAIN, worth $${bobPosition.currentGrainValue.toFixed(2)}, floor $${bobPosition.protectedFloor.toFixed(2)}`)

  // Audit
  console.log('\n--- AUDIT ---')
  const audit = vault.getAuditReport()
  console.log(`Total Assets: $${audit.accounting.totalAssets.toFixed(2)}`)
  console.log(`Total Liabilities (Principal): $${audit.accounting.totalLiabilities.toFixed(2)}`)
  console.log(`Total Equity: $${audit.accounting.totalEquity.toFixed(2)}`)
  console.log(`Assets = Liabilities + Equity: ${audit.accounting.assetsEqualLiabilitiesPlusEquity}`)
  console.log(`GRAIN Price: $${audit.health.grainPrice.toFixed(4)}`)
  console.log(`Vault Coverage: ${(audit.health.vaultCoverage * 100).toFixed(1)}%`)
  console.log(`Can Survive Bank Run: ${audit.health.canSurviveBankRun}`)
}
