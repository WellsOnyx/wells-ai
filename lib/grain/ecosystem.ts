/**
 * GRAIN Ecosystem - The Closed-Loop Economy
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GRAIN MODEL - SIMPLE VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1 GRAIN = $1 (always, for cash-out purposes)
 * 1 GRAIN = $1+ purchasing power (within the ecosystem)
 *
 * The "appreciation" is not a balance multiplier. It's PURCHASING POWER
 * that comes from:
 *   - Merchant discounts (sellers price competitively in GRAIN)
 *   - Zero transaction fees (vs 2.9% + $0.30 on cards)
 *   - Exclusive deals for GRAIN holders
 *   - Network effects (more places to spend = more value)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY SELLERS ACCEPT GRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traditional payment:
 *   Customer pays $100 → Stripe takes $3.20 → Seller gets $96.80
 *   Then seller pays vendor: $50 → Another $1.75 in fees → $48.25 received
 *   Then seller pays employee: $30 → Payroll fees, taxes, delays
 *
 *   Seller keeps: ~$15 after all the friction
 *
 * GRAIN payment:
 *   Customer pays 100 GRAIN → Seller gets 100 GRAIN (zero fees)
 *   Seller pays vendor: 50 GRAIN → Vendor gets 50 GRAIN (zero fees)
 *   Seller pays employee: 30 GRAIN → Employee gets 30 GRAIN (instant)
 *
 *   Seller keeps: 20 GRAIN (and saved ~$5 in fees)
 *
 * THE GRAIN NEVER LEAVES THE ECOSYSTEM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CLOSED LOOP - WHY IT'S POWERFUL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When $1 enters GRAIN as a deposit:
 *
 *   $1 USD → 1 GRAIN
 *
 *   That 1 GRAIN might:
 *   1. Buy coffee from a cafe (now cafe has 1 GRAIN)
 *   2. Cafe pays barista (now barista has 1 GRAIN)
 *   3. Barista buys lunch (now restaurant has 1 GRAIN)
 *   4. Restaurant pays supplier (now supplier has 1 GRAIN)
 *   5. Supplier pays driver (now driver has 1 GRAIN)
 *   6. Driver buys coffee... (back to step 1)
 *
 *   That single dollar created 6+ transactions of economic activity.
 *   In traditional finance, fees would have eaten 15-20% at each hop.
 *
 * VELOCITY = VALUE
 * The faster GRAIN moves, the more valuable the ecosystem becomes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT SELLERS/FOUNDERS CAN DO IN GRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. RECEIVE PAYMENTS
 *    - From customers (B2C)
 *    - From other businesses (B2B)
 *    - From invoices
 *    - Zero fees on all incoming payments
 *
 * 2. PAY VENDORS/SUPPLIERS
 *    - Raw materials
 *    - Services
 *    - Software subscriptions
 *    - Office supplies
 *    - Any vendor in the GRAIN network
 *
 * 3. RUN PAYROLL
 *    - Pay employees in GRAIN
 *    - Instant settlement (no waiting for pay day)
 *    - Employees spend GRAIN or cash out principal
 *    - International payroll without FX fees
 *
 * 4. HIRE TALENT
 *    - Post jobs with GRAIN compensation
 *    - Attract talent who want ecosystem benefits
 *    - Pay contractors instantly
 *    - No payroll provider fees
 *
 * 5. MANAGE TREASURY
 *    - Hold operating reserves in GRAIN
 *    - Earn purchasing power as ecosystem grows
 *    - Better than 0% checking account
 *    - Instant access when needed
 *
 * 6. PAY FOR SERVICES
 *    - Legal, accounting, consulting
 *    - Marketing, design, development
 *    - Any service provider in network
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CASH-OUT REALITY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Anyone can cash out at any time: 1 GRAIN = $1 USD
 *
 * But why would you?
 *
 * SCENARIO A: Cash out 1,000 GRAIN → Get $1,000 USD
 *   - Now you pay fees everywhere
 *   - No ecosystem benefits
 *   - Money sits in bank earning 0.5%
 *
 * SCENARIO B: Keep 1,000 GRAIN
 *   - Zero fees on every transaction
 *   - Purchasing power in growing network
 *   - Pay employees, vendors, everything
 *   - Money is WORKING, not sitting
 *
 * The value isn't in the exchange rate.
 * The value is in the UTILITY of staying in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TREASURY MODEL - HOW IT ACTUALLY WORKS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Total GRAIN in circulation: Always equals total USD deposited
 * Treasury reserves: Always equals total USD deposited
 *
 * Treasury invests reserves in:
 *   - Short-term bonds (liquid, low yield)
 *   - Commercial real estate (illiquid, higher yield)
 *   - Other appreciating assets
 *
 * Investment returns fund:
 *   - Operations (keeping fees at zero)
 *   - Merchant incentives (discounts for GRAIN)
 *   - Ecosystem growth (partnerships, integrations)
 *   - Emergency liquidity buffer
 *
 * We DON'T promise users a share of investment returns.
 * We promise: 1 GRAIN = $1 cash out (always)
 * We deliver: 1 GRAIN = $1+ of VALUE (through the ecosystem)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'consumer' | 'seller' | 'founder' | 'employee' | 'vendor'

export interface GrainAccount {
  userId: string
  role: UserRole

  // Balance
  grainBalance: number          // Total GRAIN owned

  // For display purposes
  cashOutValue: number          // Always = grainBalance (1:1)

  // Activity metrics
  totalReceived: number         // Lifetime GRAIN received
  totalSent: number             // Lifetime GRAIN sent
  transactionCount: number      // Total transactions

  // Business features (for sellers/founders)
  payrollEnabled: boolean
  vendorPaymentsEnabled: boolean
  invoicingEnabled: boolean

  // Timestamps
  createdAt: Date
  lastTransactionAt: Date | null
}

export interface GrainTransaction {
  id: string
  type: TransactionType

  // Parties
  senderId: string
  receiverId: string

  // Amount
  amount: number               // GRAIN amount
  fiatEquivalent: number       // Always same as amount (1:1)

  // Context
  category: TransactionCategory
  description: string
  reference?: string           // Invoice #, order #, etc.

  // Escrow
  escrowStatus: EscrowStatus
  escrowReleaseAt: Date | null

  // Timestamps
  createdAt: Date
  completedAt: Date | null
}

export type TransactionType =
  | 'payment'           // Customer → Seller
  | 'vendor_payment'    // Seller → Vendor
  | 'payroll'           // Employer → Employee
  | 'transfer'          // User → User
  | 'deposit'           // USD → GRAIN
  | 'withdrawal'        // GRAIN → USD

export type TransactionCategory =
  | 'goods'             // Physical products
  | 'services'          // Professional services
  | 'salary'            // Regular payroll
  | 'contractor'        // Contractor payment
  | 'supplies'          // Business supplies
  | 'rent'              // Rent/lease
  | 'utilities'         // Utilities
  | 'software'          // SaaS/subscriptions
  | 'other'

export type EscrowStatus =
  | 'none'              // No escrow (withdrawals)
  | 'held'              // In escrow
  | 'released'          // Escrow complete
  | 'disputed'          // Under dispute
  | 'refunded'          // Returned to sender

// ============================================================================
// SELLER/FOUNDER DASHBOARD DATA
// ============================================================================

export interface SellerDashboard {
  // Balance Overview
  grainBalance: number
  cashOutValue: number           // Always = grainBalance
  fiatEquivalent: number         // Always = grainBalance (what it's "worth")

  // Today's Activity
  todayReceived: number
  todaySent: number
  todayNet: number

  // This Month
  monthlyRevenue: number         // GRAIN received from customers
  monthlyExpenses: number        // GRAIN sent (payroll, vendors, etc.)
  monthlyNet: number

  // Expense Breakdown
  expensesByCategory: {
    payroll: number
    vendors: number
    rent: number
    utilities: number
    software: number
    other: number
  }

  // Savings from using GRAIN
  estimatedFeesSaved: number     // vs traditional payment processing

  // Team (if payroll enabled)
  employeeCount: number
  nextPayrollDate: Date | null
  nextPayrollAmount: number

  // Pending
  pendingIncoming: number        // In escrow, coming to you
  pendingOutgoing: number        // In escrow, going out
}

export interface FounderDashboard extends SellerDashboard {
  // Company Treasury
  treasuryBalance: number
  operatingReserve: number       // Recommended 3-6 months expenses

  // Burn Rate
  monthlyBurn: number
  runwayMonths: number           // treasuryBalance / monthlyBurn

  // Fundraising (if applicable)
  investorPayments: {
    investorId: string
    amount: number
    date: Date
    type: 'safe' | 'equity' | 'convertible'
  }[]

  // Cap Table Integration
  totalRaised: number

  // Hiring Pipeline
  openPositions: number
  pendingOffers: number
}

// ============================================================================
// ECOSYSTEM METRICS
// ============================================================================

export interface EcosystemMetrics {
  // Supply
  totalGrainSupply: number       // Total GRAIN in circulation
  totalUsdDeposited: number      // Always = totalGrainSupply

  // Velocity
  dailyTransactionVolume: number
  weeklyTransactionVolume: number
  monthlyTransactionVolume: number
  velocityRate: number           // transactions per GRAIN per month

  // Participants
  totalAccounts: number
  activeAccounts: number         // Transacted in last 30 days

  // By Role
  consumerCount: number
  sellerCount: number
  founderCount: number
  employeeCount: number
  vendorCount: number

  // Retention
  cashOutRate: number            // % of deposits that cash out
  averageHoldTime: number        // Average days GRAIN is held before cashout

  // Health
  circulationRate: number        // % of GRAIN that moved in last 30 days
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Create a new GRAIN account
 */
export function createAccount(
  userId: string,
  role: UserRole
): GrainAccount {
  return {
    userId,
    role,
    grainBalance: 0,
    cashOutValue: 0,
    totalReceived: 0,
    totalSent: 0,
    transactionCount: 0,
    payrollEnabled: role === 'seller' || role === 'founder',
    vendorPaymentsEnabled: role === 'seller' || role === 'founder',
    invoicingEnabled: role === 'seller' || role === 'founder',
    createdAt: new Date(),
    lastTransactionAt: null
  }
}

/**
 * Deposit USD and receive GRAIN (1:1)
 */
export function deposit(
  account: GrainAccount,
  amountUsd: number
): { account: GrainAccount; transaction: GrainTransaction } {
  const grainAmount = amountUsd // 1:1

  const updatedAccount: GrainAccount = {
    ...account,
    grainBalance: account.grainBalance + grainAmount,
    cashOutValue: account.grainBalance + grainAmount,
    totalReceived: account.totalReceived + grainAmount,
    transactionCount: account.transactionCount + 1,
    lastTransactionAt: new Date()
  }

  const transaction: GrainTransaction = {
    id: generateId(),
    type: 'deposit',
    senderId: 'TREASURY',
    receiverId: account.userId,
    amount: grainAmount,
    fiatEquivalent: amountUsd,
    category: 'other',
    description: `Deposit ${amountUsd} USD`,
    escrowStatus: 'none',
    escrowReleaseAt: null,
    createdAt: new Date(),
    completedAt: new Date()
  }

  return { account: updatedAccount, transaction }
}

/**
 * Withdraw GRAIN to USD (1:1, always)
 */
export function withdraw(
  account: GrainAccount,
  grainAmount: number
): { account: GrainAccount; transaction: GrainTransaction; usdAmount: number } {
  if (grainAmount > account.grainBalance) {
    throw new Error('Insufficient GRAIN balance')
  }

  const usdAmount = grainAmount // 1:1, always

  const updatedAccount: GrainAccount = {
    ...account,
    grainBalance: account.grainBalance - grainAmount,
    cashOutValue: account.grainBalance - grainAmount,
    totalSent: account.totalSent + grainAmount,
    transactionCount: account.transactionCount + 1,
    lastTransactionAt: new Date()
  }

  const transaction: GrainTransaction = {
    id: generateId(),
    type: 'withdrawal',
    senderId: account.userId,
    receiverId: 'TREASURY',
    amount: grainAmount,
    fiatEquivalent: usdAmount,
    category: 'other',
    description: `Withdraw ${grainAmount} GRAIN to USD`,
    escrowStatus: 'none',
    escrowReleaseAt: null,
    createdAt: new Date(),
    completedAt: new Date()
  }

  return { account: updatedAccount, transaction, usdAmount }
}

/**
 * Send GRAIN payment (with escrow)
 */
export function sendPayment(
  sender: GrainAccount,
  receiverId: string,
  amount: number,
  category: TransactionCategory,
  description: string,
  options?: {
    reference?: string
    escrowHours?: number
  }
): { sender: GrainAccount; transaction: GrainTransaction } {
  if (amount > sender.grainBalance) {
    throw new Error('Insufficient GRAIN balance')
  }

  // Determine escrow duration
  const escrowHours = options?.escrowHours ?? getEscrowDuration(sender, amount)
  const escrowReleaseAt = new Date(Date.now() + escrowHours * 60 * 60 * 1000)

  // Determine transaction type based on category
  let type: TransactionType = 'payment'
  if (category === 'salary' || category === 'contractor') {
    type = 'payroll'
  } else if (['supplies', 'rent', 'utilities', 'software'].includes(category)) {
    type = 'vendor_payment'
  }

  const updatedSender: GrainAccount = {
    ...sender,
    grainBalance: sender.grainBalance - amount,
    cashOutValue: sender.grainBalance - amount,
    totalSent: sender.totalSent + amount,
    transactionCount: sender.transactionCount + 1,
    lastTransactionAt: new Date()
  }

  const transaction: GrainTransaction = {
    id: generateId(),
    type,
    senderId: sender.userId,
    receiverId,
    amount,
    fiatEquivalent: amount, // 1:1
    category,
    description,
    reference: options?.reference,
    escrowStatus: 'held',
    escrowReleaseAt,
    createdAt: new Date(),
    completedAt: null
  }

  return { sender: updatedSender, transaction }
}

/**
 * Receive GRAIN payment (after escrow release)
 */
export function receivePayment(
  receiver: GrainAccount,
  transaction: GrainTransaction
): GrainAccount {
  if (transaction.escrowStatus !== 'released') {
    throw new Error('Payment not yet released from escrow')
  }

  return {
    ...receiver,
    grainBalance: receiver.grainBalance + transaction.amount,
    cashOutValue: receiver.grainBalance + transaction.amount,
    totalReceived: receiver.totalReceived + transaction.amount,
    transactionCount: receiver.transactionCount + 1,
    lastTransactionAt: new Date()
  }
}

/**
 * Run payroll for multiple employees
 */
export function runPayroll(
  employer: GrainAccount,
  payments: Array<{
    employeeId: string
    amount: number
    description?: string
  }>
): { employer: GrainAccount; transactions: GrainTransaction[] } {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  if (totalAmount > employer.grainBalance) {
    throw new Error(`Insufficient balance for payroll. Need ${totalAmount} GRAIN, have ${employer.grainBalance}`)
  }

  let updatedEmployer = { ...employer }
  const transactions: GrainTransaction[] = []

  for (const payment of payments) {
    const result = sendPayment(
      updatedEmployer,
      payment.employeeId,
      payment.amount,
      'salary',
      payment.description || 'Salary payment',
      { escrowHours: 24 } // Standard 24hr for payroll
    )
    updatedEmployer = result.sender
    transactions.push(result.transaction)
  }

  return { employer: updatedEmployer, transactions }
}

/**
 * Calculate fees saved by using GRAIN vs traditional payments
 */
export function calculateFeesSaved(
  transactions: GrainTransaction[]
): number {
  let saved = 0

  for (const tx of transactions) {
    if (tx.type === 'payment') {
      // Card processing: 2.9% + $0.30
      saved += tx.amount * 0.029 + 0.30
    } else if (tx.type === 'payroll') {
      // Payroll provider: ~$5-10 per payment
      saved += 7.50
    } else if (tx.type === 'vendor_payment') {
      // Wire/ACH: $5-25 per transfer
      saved += 15
    }
  }

  return saved
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `grain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getEscrowDuration(sender: GrainAccount, amount: number): number {
  // Standard: 24 hours
  let hours = 24

  // High value (>$10k): 48 hours
  if (amount > 10000) {
    hours = 48
  }

  // New user (<30 days): 72 hours
  const accountAge = Date.now() - sender.createdAt.getTime()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  if (accountAge < thirtyDays) {
    hours = 72
  }

  return hours
}

// ============================================================================
// SELLER DASHBOARD CALCULATOR
// ============================================================================

export function calculateSellerDashboard(
  account: GrainAccount,
  transactions: GrainTransaction[],
  employees: Array<{ id: string; monthlySalary: number }> = []
): SellerDashboard {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Filter transactions
  const todayTx = transactions.filter(tx => tx.createdAt >= startOfDay)
  const monthTx = transactions.filter(tx => tx.createdAt >= startOfMonth)

  // Calculate incoming/outgoing
  const incoming = (txs: GrainTransaction[]) =>
    txs.filter(tx => tx.receiverId === account.userId).reduce((sum, tx) => sum + tx.amount, 0)
  const outgoing = (txs: GrainTransaction[]) =>
    txs.filter(tx => tx.senderId === account.userId).reduce((sum, tx) => sum + tx.amount, 0)

  // Expense breakdown
  const monthExpenses = monthTx.filter(tx => tx.senderId === account.userId)
  const byCategory = (cat: TransactionCategory) =>
    monthExpenses.filter(tx => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0)

  // Pending escrow
  const pendingIn = transactions
    .filter(tx => tx.receiverId === account.userId && tx.escrowStatus === 'held')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const pendingOut = transactions
    .filter(tx => tx.senderId === account.userId && tx.escrowStatus === 'held')
    .reduce((sum, tx) => sum + tx.amount, 0)

  // Next payroll
  const nextPayrollAmount = employees.reduce((sum, e) => sum + e.monthlySalary, 0)

  return {
    grainBalance: account.grainBalance,
    cashOutValue: account.grainBalance, // Always 1:1
    fiatEquivalent: account.grainBalance, // Always 1:1

    todayReceived: incoming(todayTx),
    todaySent: outgoing(todayTx),
    todayNet: incoming(todayTx) - outgoing(todayTx),

    monthlyRevenue: incoming(monthTx),
    monthlyExpenses: outgoing(monthTx),
    monthlyNet: incoming(monthTx) - outgoing(monthTx),

    expensesByCategory: {
      payroll: byCategory('salary') + byCategory('contractor'),
      vendors: byCategory('supplies'),
      rent: byCategory('rent'),
      utilities: byCategory('utilities'),
      software: byCategory('software'),
      other: byCategory('other') + byCategory('goods') + byCategory('services')
    },

    estimatedFeesSaved: calculateFeesSaved(monthTx),

    employeeCount: employees.length,
    nextPayrollDate: employees.length > 0 ? getNextPayrollDate() : null,
    nextPayrollAmount,

    pendingIncoming: pendingIn,
    pendingOutgoing: pendingOut
  }
}

function getNextPayrollDate(): Date {
  const now = new Date()
  // Assume bi-monthly payroll (15th and last day)
  const day = now.getDate()
  if (day < 15) {
    return new Date(now.getFullYear(), now.getMonth(), 15)
  } else {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0) // Last day of month
  }
}

// ============================================================================
// FOUNDER DASHBOARD CALCULATOR
// ============================================================================

export function calculateFounderDashboard(
  account: GrainAccount,
  transactions: GrainTransaction[],
  employees: Array<{ id: string; monthlySalary: number }> = [],
  companyData?: {
    operatingReserveTarget: number
    investorPayments?: FounderDashboard['investorPayments']
    openPositions?: number
    pendingOffers?: number
  }
): FounderDashboard {
  const sellerDash = calculateSellerDashboard(account, transactions, employees)

  const monthlyBurn = sellerDash.monthlyExpenses
  const runwayMonths = monthlyBurn > 0 ? account.grainBalance / monthlyBurn : Infinity

  const totalRaised = companyData?.investorPayments?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  return {
    ...sellerDash,

    treasuryBalance: account.grainBalance,
    operatingReserve: companyData?.operatingReserveTarget ?? monthlyBurn * 6,

    monthlyBurn,
    runwayMonths,

    investorPayments: companyData?.investorPayments ?? [],
    totalRaised,

    openPositions: companyData?.openPositions ?? 0,
    pendingOffers: companyData?.pendingOffers ?? 0
  }
}
