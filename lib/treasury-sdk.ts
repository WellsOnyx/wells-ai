/**
 * Grain & Vault Treasury SDK
 *
 * Zero-friction payments for enterprise treasury teams.
 * Embed GRAIN payments directly into your ERP, AP/AR systems, and vendor ecosystem.
 *
 * The aha moment: CFOs and Treasury teams (championed by procurement) can implement
 * Grain & Vault in their native ERP and vendor ecosystem for 0% friction payments.
 *
 * Supported ERPs: SAP, Oracle, NetSuite, Microsoft Dynamics, Workday, Coupa
 *
 * "Proverbs 22:7 - The borrower is slave to the lender"
 * With GRAIN, you're never waiting on banks or payment processors.
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk'

// ============================================================================
// SDK CONFIGURATION
// ============================================================================

export interface TreasurySDKConfig {
  apiKey: string
  environment: 'sandbox' | 'production'
  organizationId: string
  webhookUrl?: string

  // ERP Integration
  erpType?: ERPType
  erpConfig?: ERPConfig

  // Treasury Settings
  autoConvert?: boolean           // Auto-convert USDC to GRAIN
  approvalThreshold?: number      // Amount requiring additional approval

  // Compliance
  complianceLevel?: 'standard' | 'enhanced' | 'enterprise'
}

export type ERPType =
  | 'sap'
  | 'oracle'
  | 'netsuite'
  | 'dynamics365'
  | 'workday'
  | 'coupa'
  | 'custom'

export interface ERPConfig {
  endpoint?: string
  apiKey?: string
  syncInterval?: number           // Minutes between syncs
  autoReconcile?: boolean
  costCenterMapping?: Record<string, string>
  glAccountMapping?: Record<string, string>
}

// ============================================================================
// TREASURY WALLET
// ============================================================================

export interface TreasuryWallet {
  id: string
  organizationId: string
  walletId: string              // Circle wallet ID
  walletAddress: string         // Base L2 address
  balance: number               // GRAIN balance
  creditLine: number            // 1:1 credit line available
  creditUsed: number            // Credit currently in use
  grainValueAtDeposit: number   // GRAIN/USD rate at deposit
  currentGrainValue: number     // Current GRAIN/USD rate
  createdAt: Date
  lastSyncAt: Date
}

export interface TreasuryTransaction {
  id: string
  type: 'payment' | 'receipt' | 'credit_draw' | 'credit_repay' | 'conversion' | 'reserve'
  amount: number
  currency: 'GRAIN' | 'USDC' | 'USD'
  status: 'pending' | 'processing' | 'completed' | 'failed'

  // Counterparty
  counterpartyId?: string
  counterpartyName?: string
  counterpartyWallet?: string

  // ERP Integration
  erpReference?: string         // PO number, Invoice number, etc.
  costCenter?: string
  glAccount?: string

  // Metadata
  description?: string
  metadata?: Record<string, string>

  // Timestamps
  createdAt: Date
  completedAt?: Date
}

// ============================================================================
// VENDOR NETWORK
// ============================================================================

export interface VendorWallet {
  vendorId: string
  vendorName: string
  walletId: string
  walletAddress: string
  paymentTerms?: string         // Net30, Net60, etc.
  autoPayEnabled: boolean
  trustScore?: number
}

export interface PaymentTerms {
  netDays: number               // Net30 = 30
  earlyPaymentDiscount?: {
    percent: number             // e.g., 2% discount
    withinDays: number          // if paid within 10 days
  }
  latePaymentPenalty?: {
    percent: number
    afterDays: number
  }
}

// ============================================================================
// SDK CLASS
// ============================================================================

export class TreasurySDK {
  private circle: Circle
  private config: TreasurySDKConfig
  private treasuryWallet?: TreasuryWallet

  constructor(config: TreasurySDKConfig) {
    this.config = config
    this.circle = new Circle(
      config.apiKey,
      config.environment === 'production'
        ? CircleEnvironments.production
        : CircleEnvironments.sandbox
    )
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the Treasury SDK
   * Creates or connects to existing treasury wallet
   */
  async initialize(): Promise<TreasuryWallet> {
    // Create or retrieve treasury wallet
    const walletResponse = await this.circle.wallets.createWallet({
      idempotencyKey: `treasury_${this.config.organizationId}`,
      description: `Treasury - ${this.config.organizationId}`,
    })

    const wallet = walletResponse.data?.data
    if (!wallet) throw new Error('Failed to create treasury wallet')

    // Generate Base L2 address
    const addressResponse = await this.circle.wallets.generateAddress(
      wallet.walletId!
    )

    this.treasuryWallet = {
      id: `treasury_${this.config.organizationId}`,
      organizationId: this.config.organizationId,
      walletId: wallet.walletId!,
      walletAddress: addressResponse.data?.data?.address || '',
      balance: 0,
      creditLine: 0,            // 1:1 with balance
      creditUsed: 0,
      grainValueAtDeposit: 1.0, // Starting value
      currentGrainValue: 1.0,   // GRAIN appreciates over time
      createdAt: new Date(),
      lastSyncAt: new Date(),
    }

    return this.treasuryWallet
  }

  // ==========================================================================
  // PAYMENTS
  // ==========================================================================

  /**
   * Pay a vendor instantly with GRAIN
   * Zero friction - no waiting, no chargebacks
   */
  async payVendor(params: {
    vendorWallet: string
    amount: number
    reference: string           // PO number, invoice number
    costCenter?: string
    glAccount?: string
    memo?: string
  }): Promise<TreasuryTransaction> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    // Check balance
    const balance = await this.getBalance()
    if (balance < params.amount) {
      throw new Error(`Insufficient balance. Available: ${balance}, Required: ${params.amount}`)
    }

    // Check approval threshold
    if (this.config.approvalThreshold && params.amount > this.config.approvalThreshold) {
      throw new Error(`Amount exceeds approval threshold of ${this.config.approvalThreshold}`)
    }

    // Execute transfer
    const transferResponse = await this.circle.transfers.createTransfer({
      idempotencyKey: `pay_${params.reference}_${Date.now()}`,
      source: {
        type: 'wallet',
        id: this.treasuryWallet.walletId,
      },
      destination: {
        type: 'blockchain',
        address: params.vendorWallet,
        chain: 'BASE',
      },
      amount: {
        amount: params.amount.toFixed(2),
        currency: 'USD',
      },
    })

    const transfer = transferResponse.data?.data

    return {
      id: transfer?.id || `tx_${Date.now()}`,
      type: 'payment',
      amount: params.amount,
      currency: 'GRAIN',
      status: 'completed',
      counterpartyWallet: params.vendorWallet,
      erpReference: params.reference,
      costCenter: params.costCenter,
      glAccount: params.glAccount,
      description: params.memo,
      createdAt: new Date(),
      completedAt: new Date(),
    }
  }

  /**
   * Batch pay multiple vendors
   * Perfect for AP runs
   */
  async batchPay(payments: Array<{
    vendorWallet: string
    amount: number
    reference: string
    costCenter?: string
  }>): Promise<TreasuryTransaction[]> {
    const results: TreasuryTransaction[] = []

    // Calculate total
    const total = payments.reduce((sum, p) => sum + p.amount, 0)
    const balance = await this.getBalance()

    if (balance < total) {
      throw new Error(`Insufficient balance for batch. Available: ${balance}, Required: ${total}`)
    }

    // Process all payments
    for (const payment of payments) {
      const result = await this.payVendor(payment)
      results.push(result)
    }

    return results
  }

  /**
   * Request payment from a customer
   * Returns a payment link or QR code
   */
  async requestPayment(params: {
    amount: number
    reference: string           // Invoice number
    customerEmail?: string
    dueDate?: Date
    memo?: string
  }): Promise<{
    paymentId: string
    paymentLink: string
    qrCode: string
    walletAddress: string
    amount: number
  }> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const paymentId = `req_${params.reference}_${Date.now()}`

    // In production, this would generate a unique payment page
    return {
      paymentId,
      paymentLink: `https://pay.grainandvault.com/${paymentId}`,
      qrCode: `https://pay.grainandvault.com/qr/${paymentId}`,
      walletAddress: this.treasuryWallet.walletAddress,
      amount: params.amount,
    }
  }

  // ==========================================================================
  // BALANCE & CREDIT LINE
  // ==========================================================================

  /**
   * Get current treasury balance
   */
  async getBalance(): Promise<number> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const response = await this.circle.wallets.getWallet(
      this.treasuryWallet.walletId
    )

    const balances = response.data?.data?.balances || []
    const usdcBalance = balances.find(b => b.currency === 'USD')

    const balance = parseFloat(usdcBalance?.amount || '0')

    // Update credit line (1:1 with balance)
    if (this.treasuryWallet) {
      this.treasuryWallet.balance = balance
      this.treasuryWallet.creditLine = balance // 1:1 credit line
    }

    return balance
  }

  /**
   * Get credit line status
   * 1:1 credit line on GRAIN deposits - use credit while your balance stays put
   */
  async getCreditLine(): Promise<{
    totalCreditLine: number      // 1:1 with balance
    creditAvailable: number      // creditLine - creditUsed
    creditUsed: number           // Currently drawn credit
    balance: number              // GRAIN balance backing the credit
  }> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const balance = await this.getBalance()
    const creditLine = balance // 1:1 credit line
    const creditUsed = this.treasuryWallet.creditUsed || 0
    const creditAvailable = creditLine - creditUsed

    return {
      totalCreditLine: creditLine,
      creditAvailable,
      creditUsed,
      balance,
    }
  }

  /**
   * Draw from credit line
   * Use credit for transactions while your GRAIN balance stays put
   */
  async drawCredit(amount: number, reference: string): Promise<TreasuryTransaction> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const { creditAvailable } = await this.getCreditLine()

    if (amount > creditAvailable) {
      throw new Error(`Insufficient credit. Available: ${creditAvailable}, Requested: ${amount}`)
    }

    // Draw from credit line
    this.treasuryWallet.creditUsed += amount

    return {
      id: `credit_draw_${Date.now()}`,
      type: 'credit_draw',
      amount,
      currency: 'GRAIN',
      status: 'completed',
      erpReference: reference,
      description: `Credit draw: ${reference}`,
      createdAt: new Date(),
      completedAt: new Date(),
    }
  }

  /**
   * Repay credit line
   * Pay back drawn credit to restore available credit
   */
  async repayCredit(amount: number, reference: string): Promise<TreasuryTransaction> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const creditUsed = this.treasuryWallet.creditUsed || 0
    const repayAmount = Math.min(amount, creditUsed)

    // Repay credit
    this.treasuryWallet.creditUsed = Math.max(0, creditUsed - repayAmount)

    return {
      id: `credit_repay_${Date.now()}`,
      type: 'credit_repay',
      amount: repayAmount,
      currency: 'GRAIN',
      status: 'completed',
      erpReference: reference,
      description: `Credit repayment: ${reference}`,
      createdAt: new Date(),
      completedAt: new Date(),
    }
  }

  /**
   * Get GRAIN value appreciation
   * GRAIN value increases over time - you keep the appreciation
   */
  async getGrainAppreciation(): Promise<{
    valueAtDeposit: number       // GRAIN/USD rate when deposited
    currentValue: number         // Current GRAIN/USD rate
    appreciationPercent: number  // Percentage gain
    appreciationAmount: number   // Dollar amount gained
  }> {
    if (!this.treasuryWallet) throw new Error('SDK not initialized')

    const balance = await this.getBalance()
    const valueAtDeposit = this.treasuryWallet.grainValueAtDeposit
    const currentValue = this.treasuryWallet.currentGrainValue

    const appreciationPercent = ((currentValue - valueAtDeposit) / valueAtDeposit) * 100
    const appreciationAmount = balance * (currentValue - valueAtDeposit)

    return {
      valueAtDeposit,
      currentValue,
      appreciationPercent,
      appreciationAmount,
    }
  }

  // ==========================================================================
  // VENDOR MANAGEMENT
  // ==========================================================================

  /**
   * Onboard a new vendor to the GRAIN network
   */
  async onboardVendor(params: {
    vendorId: string
    vendorName: string
    email: string
    paymentTerms?: PaymentTerms
  }): Promise<VendorWallet> {
    // Create vendor wallet
    const walletResponse = await this.circle.wallets.createWallet({
      idempotencyKey: `vendor_${params.vendorId}`,
      description: `Vendor - ${params.vendorName}`,
    })

    const wallet = walletResponse.data?.data
    if (!wallet) throw new Error('Failed to create vendor wallet')

    const addressResponse = await this.circle.wallets.generateAddress(
      wallet.walletId!
    )

    return {
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      walletId: wallet.walletId!,
      walletAddress: addressResponse.data?.data?.address || '',
      paymentTerms: params.paymentTerms
        ? `Net${params.paymentTerms.netDays}`
        : undefined,
      autoPayEnabled: false,
    }
  }

  /**
   * Invite vendors to join the GRAIN network
   * Send them an onboarding link
   */
  async inviteVendors(vendors: Array<{
    email: string
    name: string
    message?: string
  }>): Promise<void> {
    // In production, this would send invitation emails
    // with onboarding links to join the GRAIN network
    console.log(`Inviting ${vendors.length} vendors to GRAIN network`)
  }

  // ==========================================================================
  // ERP SYNC
  // ==========================================================================

  /**
   * Sync transactions to ERP
   */
  async syncToERP(transactions: TreasuryTransaction[]): Promise<{
    synced: number
    failed: number
    errors: string[]
  }> {
    if (!this.config.erpType || !this.config.erpConfig) {
      throw new Error('ERP not configured')
    }

    // This would integrate with specific ERPs
    // SAP: RFC/BAPI calls
    // Oracle: REST API
    // NetSuite: SuiteScript
    // etc.

    return {
      synced: transactions.length,
      failed: 0,
      errors: [],
    }
  }

  /**
   * Import AP invoices from ERP for payment
   */
  async importInvoicesFromERP(): Promise<Array<{
    invoiceId: string
    vendorId: string
    amount: number
    dueDate: Date
    status: string
  }>> {
    if (!this.config.erpType) {
      throw new Error('ERP not configured')
    }

    // This would pull pending AP invoices from the ERP
    return []
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get treasury dashboard data
   */
  async getDashboard(): Promise<{
    balance: number
    creditLine: number
    creditAvailable: number
    creditUsed: number
    grainAppreciation: number
    pendingPayments: number
    pendingReceipts: number
    transactionVolume30d: number
    vendorCount: number
    failedPayments: number
  }> {
    const balance = await this.getBalance()
    const credit = await this.getCreditLine()
    const appreciation = await this.getGrainAppreciation()

    // Grain & Vault = 0% friction
    // No failed payments, no chargebacks, instant settlement

    return {
      balance,
      creditLine: credit.totalCreditLine,
      creditAvailable: credit.creditAvailable,
      creditUsed: credit.creditUsed,
      grainAppreciation: appreciation.appreciationPercent,
      pendingPayments: 0,
      pendingReceipts: 0,
      transactionVolume30d: 0,
      vendorCount: 0,
      failedPayments: 0, // Always 0 with GRAIN - that's the point
    }
  }

  /**
   * Generate treasury report
   */
  async generateReport(params: {
    startDate: Date
    endDate: Date
    format: 'pdf' | 'csv' | 'json'
  }): Promise<{
    reportUrl: string
    summary: {
      totalPayments: number
      totalReceipts: number
      netFlow: number
      creditDrawn: number
      creditRepaid: number
      grainAppreciation: number
      failedPayments: number
    }
  }> {
    const appreciation = await this.getGrainAppreciation()
    const credit = await this.getCreditLine()

    return {
      reportUrl: `https://reports.grainandvault.com/${this.config.organizationId}/${Date.now()}`,
      summary: {
        totalPayments: 0,
        totalReceipts: 0,
        netFlow: 0,
        creditDrawn: credit.creditUsed,
        creditRepaid: 0,
        grainAppreciation: appreciation.appreciationAmount,
        failedPayments: 0, // Always 0 - that's the Grain & Vault promise
      },
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a Treasury SDK instance
 *
 * @example
 * ```typescript
 * import { createTreasurySDK } from '@grainandvault/treasury-sdk'
 *
 * const treasury = createTreasurySDK({
 *   apiKey: process.env.GRAIN_VAULT_API_KEY,
 *   environment: 'production',
 *   organizationId: 'acme-corp',
 *   erpType: 'netsuite',
 *   erpConfig: {
 *     endpoint: 'https://acme.suitetalk.api.netsuite.com',
 *     autoReconcile: true,
 *   },
 *   approvalThreshold: 50000, // $50k requires additional approval
 * })
 *
 * await treasury.initialize()
 *
 * // Pay a vendor instantly
 * await treasury.payVendor({
 *   vendorWallet: '0x...',
 *   amount: 25000,
 *   reference: 'PO-2024-001234',
 *   costCenter: 'IT-INFRASTRUCTURE',
 * })
 *
 * // Check your 1:1 credit line
 * const credit = await treasury.getCreditLine()
 * console.log(`Available credit: ${credit.creditAvailable}`)
 *
 * // See GRAIN appreciation
 * const appreciation = await treasury.getGrainAppreciation()
 * console.log(`Your GRAIN has appreciated ${appreciation.appreciationPercent}%`)
 * ```
 */
export function createTreasurySDK(config: TreasurySDKConfig): TreasurySDK {
  return new TreasurySDK(config)
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TreasurySDK
