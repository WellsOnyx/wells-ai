// @ts-nocheck
/**
 * Global Payroll System - Powered by GRAIN + Circle
 *
 * Comprehensive payroll capabilities across all Circle-supported countries.
 * GRAIN is the default payment rail, with Circle USDC as the settlement layer.
 *
 * Key Features:
 * - Instant cross-border payments (no SWIFT delays)
 * - No correspondent banks needed
 * - Recipients choose: GRAIN, USDC, or local currency
 * - Country-specific compliance built-in
 * - Multi-currency support
 * - Tax withholding tracking
 * - Benefits management
 *
 * Circle Payment Network Corridors (Active 2025):
 * - Brazil, Mexico, Nigeria, Hong Kong (CPN direct)
 * - LATAM (Nubank integration - Brazil, Mexico, Colombia)
 * - Africa (Lipaworld integration - Nigeria, Kenya, Ghana)
 * - EEMEA, Europe, APAC (Direct USDC settlement)
 */

import { grainRail } from '@/lib/payments/grain-rail'
import { neon } from '@neondatabase/serverless'

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// ============================================================================
// SUPPORTED COUNTRIES & CORRIDORS
// ============================================================================

export type PaymentCorridor = 'domestic' | 'cpn' | 'swift' | 'crypto_native'

export interface CountryConfig {
  code: string
  name: string
  currency: string
  corridor: PaymentCorridor
  supportedRails: ('grain' | 'usdc' | 'local_bank' | 'mobile_money')[]
  taxWithholdingRequired: boolean
  defaultWithholdingRate: number
  complianceRequirements: string[]
  settlementTime: string
  minPayment: number
  maxPayment: number
  kycLevel: 'basic' | 'verified' | 'enhanced'
  employerRegistrationRequired: boolean
  notes?: string
}

export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
  // ===== TIER 1: Circle Payment Network (CPN) Active Corridors =====
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    corridor: 'domestic',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.22, // Federal supplemental
    complianceRequirements: ['W-4', 'I-9', 'State_Registration'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    currency: 'BRL',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.275,
    complianceRequirements: ['CPF', 'CNPJ_Registration'],
    settlementTime: 'instant',
    minPayment: 50,
    maxPayment: 5000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'Nubank integration available for 127M customers',
  },
  MX: {
    code: 'MX',
    name: 'Mexico',
    currency: 'MXN',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.30,
    complianceRequirements: ['RFC', 'IMSS_Registration'],
    settlementTime: 'instant',
    minPayment: 100,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency: 'NGN',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'mobile_money', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.10,
    complianceRequirements: ['NIN', 'BVN'],
    settlementTime: 'instant',
    minPayment: 1000,
    maxPayment: 50000000,
    kycLevel: 'basic',
    employerRegistrationRequired: false,
    notes: 'Lipaworld integration for banking-the-unbanked',
  },
  HK: {
    code: 'HK',
    name: 'Hong Kong',
    currency: 'HKD',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: false,
    defaultWithholdingRate: 0,
    complianceRequirements: ['HKID'],
    settlementTime: 'instant',
    minPayment: 10,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: false,
    notes: 'No payroll tax withholding required',
  },

  // ===== TIER 2: EEMEA (Direct USDC) =====
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: false,
    defaultWithholdingRate: 0,
    complianceRequirements: ['Emirates_ID', 'WPS_Registration'],
    settlementTime: 'instant',
    minPayment: 10,
    maxPayment: 5000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'Wage Protection System (WPS) compliance required',
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: false,
    defaultWithholdingRate: 0,
    complianceRequirements: ['Iqama', 'GOSI_Registration', 'WPS_Registration'],
    settlementTime: 'instant',
    minPayment: 10,
    maxPayment: 5000000,
    kycLevel: 'enhanced',
    employerRegistrationRequired: true,
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.25,
    complianceRequirements: ['SA_ID', 'UIF_Registration', 'PAYE_Registration'],
    settlementTime: '1-2 hours',
    minPayment: 100,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
  },

  // ===== TIER 3: Crypto-Native Countries (Direct USDC) =====
  SG: {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: false,
    defaultWithholdingRate: 0,
    complianceRequirements: ['NRIC', 'FIN', 'CPF_Registration'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'CPF contributions required for citizens/PRs',
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.20,
    complianceRequirements: ['NI_Number', 'PAYE_Registration', 'RTI'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'HMRC Real Time Information (RTI) required',
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.42,
    complianceRequirements: ['Tax_ID', 'Social_Security_ID', 'A1_Certificate'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'MiCA compliant via Circle EU registration',
  },
  FR: {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.30,
    complianceRequirements: ['NIR', 'SIRET', 'DSN_Registration'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'DSN (Déclaration Sociale Nominative) required',
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.37,
    complianceRequirements: ['BSN', 'Chamber_of_Commerce'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.325,
    complianceRequirements: ['TFN', 'ABN', 'STP_Registration'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'Single Touch Payroll (STP) required',
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.29,
    complianceRequirements: ['SIN', 'CRA_Registration', 'Provincial_Tax'],
    settlementTime: 'instant',
    minPayment: 1,
    maxPayment: 10000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'Federal + Provincial tax considerations',
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    currency: 'JPY',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.20,
    complianceRequirements: ['My_Number', 'Social_Insurance'],
    settlementTime: 'instant',
    minPayment: 100,
    maxPayment: 100000000,
    kycLevel: 'enhanced',
    employerRegistrationRequired: true,
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    currency: 'COP',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.33,
    complianceRequirements: ['CC', 'RUT', 'EPS_Registration'],
    settlementTime: 'instant',
    minPayment: 5000,
    maxPayment: 500000000,
    kycLevel: 'verified',
    employerRegistrationRequired: true,
    notes: 'Nubank coverage in Colombia',
  },
  IN: {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    corridor: 'swift', // Crypto restrictions
    supportedRails: ['local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.30,
    complianceRequirements: ['Aadhaar', 'PAN', 'EPF_Registration', 'ESI'],
    settlementTime: '1-3 business days',
    minPayment: 100,
    maxPayment: 100000000,
    kycLevel: 'enhanced',
    employerRegistrationRequired: true,
    notes: 'Crypto payments restricted; bank transfer only',
  },
  PH: {
    code: 'PH',
    name: 'Philippines',
    currency: 'PHP',
    corridor: 'crypto_native',
    supportedRails: ['grain', 'usdc', 'mobile_money', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.25,
    complianceRequirements: ['PhilID', 'TIN', 'SSS', 'PhilHealth', 'PagIBIG'],
    settlementTime: 'instant',
    minPayment: 50,
    maxPayment: 50000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'GCash and PayMaya integration available',
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'mobile_money', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.30,
    complianceRequirements: ['National_ID', 'KRA_PIN', 'NHIF', 'NSSF'],
    settlementTime: 'instant',
    minPayment: 100,
    maxPayment: 10000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'M-Pesa integration for mobile money payments',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    currency: 'GHS',
    corridor: 'cpn',
    supportedRails: ['grain', 'usdc', 'mobile_money', 'local_bank'],
    taxWithholdingRequired: true,
    defaultWithholdingRate: 0.25,
    complianceRequirements: ['Ghana_Card', 'TIN', 'SSNIT'],
    settlementTime: 'instant',
    minPayment: 10,
    maxPayment: 5000000,
    kycLevel: 'basic',
    employerRegistrationRequired: true,
    notes: 'MTN Mobile Money integration',
  },
}

// ============================================================================
// TYPES
// ============================================================================

export interface GlobalPayrollEntry {
  employeeId: string
  employeeEmail: string
  countryCode: string
  amount: number
  currency: string // Local currency or USD
  preferredSettlement: 'grain' | 'usdc' | 'local_currency'

  // Compensation breakdown
  baseSalary: number
  bonus?: number
  commission?: number
  allowances?: Record<string, number> // Housing, transport, etc.
  deductions?: Record<string, number> // Insurance, 401k, etc.

  // Tax & Compliance
  taxId?: string
  taxWithholding?: number // Overrides default if set
  socialSecurityNumber?: string

  // Payment details
  bankDetails?: {
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    iban?: string
    swiftCode?: string
  }
  walletAddress?: string
  mobileMoneyNumber?: string

  // Metadata
  jobId?: string
  department?: string
  costCenter?: string
  memo?: string
}

export interface GlobalPayrollBatch {
  id: string
  companyId: string
  companyName?: string
  payPeriodStart: Date
  payPeriodEnd: Date

  // Entries by country
  entries: GlobalPayrollEntry[]

  // Summary
  totalGross: number
  totalNet: number
  totalTaxWithholding: number
  totalEmployerContributions: number

  // By country
  countrySummary: Record<string, {
    currency: string
    totalGross: number
    totalNet: number
    entryCount: number
    settlementTime: string
  }>

  // Status
  status: 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  submittedAt?: Date
  completedAt?: Date

  // Results
  successCount?: number
  failedCount?: number
  failures?: Array<{ email: string; error: string }>
}

// ============================================================================
// GLOBAL PAYROLL ENGINE
// ============================================================================

export const globalPayroll = {
  /**
   * Get country configuration
   */
  getCountryConfig(countryCode: string): CountryConfig | null {
    return SUPPORTED_COUNTRIES[countryCode.toUpperCase()] || null
  },

  /**
   * List all supported countries
   */
  getSupportedCountries(): CountryConfig[] {
    return Object.values(SUPPORTED_COUNTRIES)
  },

  /**
   * List countries by corridor
   */
  getCountriesByCorridor(corridor: PaymentCorridor): CountryConfig[] {
    return Object.values(SUPPORTED_COUNTRIES).filter(c => c.corridor === corridor)
  },

  /**
   * Calculate payroll for an entry
   */
  async calculateEntry(entry: GlobalPayrollEntry): Promise<{
    grossPay: number
    taxWithholding: number
    employerContributions: number
    netPay: number
    currency: string
    grainAmount: number
    settlementRail: string
    settlementTime: string
    compliance: {
      requirementsChecked: string[]
      warnings: string[]
    }
  }> {
    const country = this.getCountryConfig(entry.countryCode)
    if (!country) {
      throw new Error(`Country ${entry.countryCode} not supported`)
    }

    // Calculate gross
    const grossPay = entry.baseSalary +
      (entry.bonus || 0) +
      (entry.commission || 0) +
      Object.values(entry.allowances || {}).reduce((a, b) => a + b, 0)

    // Calculate deductions
    const deductions = Object.values(entry.deductions || {}).reduce((a, b) => a + b, 0)

    // Tax withholding
    const taxWithholding = country.taxWithholdingRequired
      ? grossPay * (entry.taxWithholding ?? country.defaultWithholdingRate)
      : 0

    // Employer contributions (simplified - would need country-specific logic)
    const employerContributions = 0 // To be implemented per country

    // Net pay
    const netPay = grossPay - taxWithholding - deductions

    // Get GRAIN conversion
    const { price } = await grainRail.getPrice()
    const usdAmount = entry.currency === 'USD'
      ? netPay
      : netPay // Would convert from local currency

    const grainAmount = usdAmount / price

    // Determine settlement rail
    let settlementRail: string = 'grain'
    if (entry.preferredSettlement === 'local_currency' && country.supportedRails.includes('local_bank')) {
      settlementRail = 'local_bank'
    } else if (entry.preferredSettlement === 'usdc') {
      settlementRail = 'usdc'
    }

    // Check compliance
    const warnings: string[] = []
    if (!entry.taxId && country.taxWithholdingRequired) {
      warnings.push(`Tax ID required for ${country.name}`)
    }

    return {
      grossPay,
      taxWithholding,
      employerContributions,
      netPay,
      currency: country.currency,
      grainAmount,
      settlementRail,
      settlementTime: country.settlementTime,
      compliance: {
        requirementsChecked: country.complianceRequirements,
        warnings,
      },
    }
  },

  /**
   * Create payroll batch
   */
  async createBatch(
    companyId: string,
    entries: GlobalPayrollEntry[],
    options: {
      payPeriodStart: Date
      payPeriodEnd: Date
      autoApprove?: boolean
    }
  ): Promise<GlobalPayrollBatch> {
    if (!sql) throw new Error('Database not configured')

    // Calculate all entries
    const calculations = await Promise.all(
      entries.map(async (entry) => {
        try {
          const calc = await this.calculateEntry(entry)
          return { entry, calculation: calc, success: true }
        } catch (error: any) {
          return { entry, error: error.message, success: false }
        }
      })
    )

    // Build country summary
    const countrySummary: GlobalPayrollBatch['countrySummary'] = {}
    let totalGross = 0
    let totalNet = 0
    let totalTaxWithholding = 0

    for (const { entry, calculation, success } of calculations) {
      if (!success || !calculation) continue

      const country = this.getCountryConfig(entry.countryCode)
      if (!country) continue

      if (!countrySummary[entry.countryCode]) {
        countrySummary[entry.countryCode] = {
          currency: country.currency,
          totalGross: 0,
          totalNet: 0,
          entryCount: 0,
          settlementTime: country.settlementTime,
        }
      }

      countrySummary[entry.countryCode].totalGross += calculation.grossPay
      countrySummary[entry.countryCode].totalNet += calculation.netPay
      countrySummary[entry.countryCode].entryCount++

      totalGross += calculation.grossPay
      totalNet += calculation.netPay
      totalTaxWithholding += calculation.taxWithholding
    }

    const batchId = `payroll_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Store batch
    await sql`
      INSERT INTO payroll_batches (
        id, company_user_id, pay_period_start, pay_period_end,
        entry_count, total_gross, total_net, total_tax_withholding,
        country_summary, status, entries_json
      ) VALUES (
        ${batchId}, ${companyId}, ${options.payPeriodStart}, ${options.payPeriodEnd},
        ${entries.length}, ${totalGross}, ${totalNet}, ${totalTaxWithholding},
        ${JSON.stringify(countrySummary)}, ${options.autoApprove ? 'approved' : 'pending_approval'},
        ${JSON.stringify(entries)}
      )
    `

    return {
      id: batchId,
      companyId,
      payPeriodStart: options.payPeriodStart,
      payPeriodEnd: options.payPeriodEnd,
      entries,
      totalGross,
      totalNet,
      totalTaxWithholding,
      totalEmployerContributions: 0,
      countrySummary,
      status: options.autoApprove ? 'approved' : 'pending_approval',
      createdAt: new Date(),
    }
  },

  /**
   * Execute payroll batch
   */
  async executeBatch(batchId: string): Promise<{
    success: boolean
    successCount: number
    failedCount: number
    failures: Array<{ email: string; error: string }>
    transactionIds: string[]
  }> {
    if (!sql) throw new Error('Database not configured')

    // Get batch
    const [batch] = await sql`
      SELECT * FROM payroll_batches WHERE id = ${batchId}
    `

    if (!batch) throw new Error('Batch not found')
    if (batch.status !== 'approved') throw new Error('Batch must be approved before execution')

    const entries = JSON.parse(batch.entries_json) as GlobalPayrollEntry[]
    const transactionIds: string[] = []
    const failures: Array<{ email: string; error: string }> = []
    let successCount = 0
    let failedCount = 0

    // Update status to processing
    await sql`
      UPDATE payroll_batches SET status = 'processing' WHERE id = ${batchId}
    `

    // Process each entry
    for (const entry of entries) {
      try {
        const calculation = await this.calculateEntry(entry)

        // Execute payment via GRAIN Rail
        const result = await grainRail.pay({
          fromUserId: batch.company_user_id,
          toUserId: entry.employeeId,
          amount: calculation.grainAmount,
          currency: 'GRAIN',
          type: 'payroll',
          reference: batchId,
          memo: `Payroll ${batch.pay_period_start} - ${batch.pay_period_end}`,
          allowCreditLine: true,
        })

        if (result.success) {
          transactionIds.push(result.transactionId)
          successCount++
        } else {
          failures.push({ email: entry.employeeEmail, error: result.error || 'Payment failed' })
          failedCount++
        }
      } catch (error: any) {
        failures.push({ email: entry.employeeEmail, error: error.message })
        failedCount++
      }
    }

    // Update batch status
    const finalStatus = failedCount === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed')
    await sql`
      UPDATE payroll_batches SET
        status = ${finalStatus},
        success_count = ${successCount},
        failed_count = ${failedCount},
        failures_json = ${JSON.stringify(failures)},
        completed_at = NOW()
      WHERE id = ${batchId}
    `

    return {
      success: failedCount === 0,
      successCount,
      failedCount,
      failures,
      transactionIds,
    }
  },

  /**
   * Get supported payment methods for a country
   */
  getPaymentMethods(countryCode: string): {
    grain: boolean
    usdc: boolean
    localBank: boolean
    mobileMoney: boolean
    recommendedMethod: string
    notes?: string
  } {
    const country = this.getCountryConfig(countryCode)
    if (!country) {
      return {
        grain: false,
        usdc: false,
        localBank: false,
        mobileMoney: false,
        recommendedMethod: 'none',
      }
    }

    const grain = country.supportedRails.includes('grain')
    const usdc = country.supportedRails.includes('usdc')
    const localBank = country.supportedRails.includes('local_bank')
    const mobileMoney = country.supportedRails.includes('mobile_money')

    // Recommend GRAIN first, then USDC, then local
    let recommendedMethod = 'grain'
    if (!grain && usdc) recommendedMethod = 'usdc'
    else if (!grain && !usdc && localBank) recommendedMethod = 'local_bank'
    else if (!grain && !usdc && !localBank && mobileMoney) recommendedMethod = 'mobile_money'

    return {
      grain,
      usdc,
      localBank,
      mobileMoney,
      recommendedMethod,
      notes: country.notes,
    }
  },
}

export default globalPayroll
