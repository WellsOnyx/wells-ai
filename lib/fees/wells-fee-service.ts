/**
 * Wells AI Fee Service
 *
 * Automatic 1% fee collection on all Wells-sourced transactions.
 * Integrates with SAP, NetSuite, and other ERPs via Merge.dev
 *
 * Fee is injected as a non-removable line item on invoices.
 * Payment routes to Wells Onyx Airwallex/Meow account.
 */

// Wells Onyx Payment Details (Airwallex/Meow via FirstBank)
export const WELLS_ONYX_PAYMENT_INFO = {
  domestic: {
    beneficiaryName: 'Wells Onyx LLC',
    accountNumber: '430117123586',
    accountType: 'Checking',
    routingNumber: '084307033',
    bankName: 'FirstBank',
    bankAddress: '1221 Broadway Ste 1300, Nashville, TN, 37203',
    beneficiaryAddress: '8325 Northeast 2nd Avenue, 315, Miami, FL, US, 33138',
  },
  international: {
    beneficiaryName: 'Wells Onyx LLC',
    accountNumber: '430117123586',
    accountType: 'Checking',
    swiftBic: 'FBNVUS42',
    bankName: 'FirstBank',
    bankAddress: '1221 Broadway Ste 1300, Nashville, TN, 37203',
    beneficiaryAddress: '8325 Northeast 2nd Avenue, 315, Miami, FL, US, 33138',
  },
} as const

// Fee configuration
export const WELLS_FEE_CONFIG = {
  ratePercent: 1.0, // 1% flat rate
  rateBps: 100, // 100 basis points
  minFeeUsd: 1.00, // Minimum fee $1
  maxFeeUsd: null, // No maximum
  description: 'Wells AI Sourcing Fee',
  glCode: 'WELLS-FEE-001',
  taxable: false,
  locked: true, // Cannot be removed or modified
} as const

export interface WellsSourcedTransaction {
  id: string
  erpSystem: 'sap' | 'netsuite' | 'oracle' | 'dynamics' | 'quickbooks' | 'xero' | 'other'
  invoiceId: string
  invoiceNumber: string
  vendorId: string
  vendorName: string
  grossAmount: number
  currency: string
  wellsDealId: string
  wellsRfqId?: string
  createdAt: Date
}

export interface WellsFeeLineItem {
  description: string
  amount: number
  currency: string
  glCode: string
  taxable: boolean
  locked: boolean
  wellsTransactionId: string
  wellsDealId: string
  paymentInstructions: typeof WELLS_ONYX_PAYMENT_INFO.domestic
}

export interface FeeCalculationResult {
  grossAmount: number
  feePercent: number
  feeAmount: number
  currency: string
  lineItem: WellsFeeLineItem
  paymentDetails: {
    domestic: typeof WELLS_ONYX_PAYMENT_INFO.domestic
    international: typeof WELLS_ONYX_PAYMENT_INFO.international
  }
}

/**
 * Calculate the Wells fee for a transaction
 */
export function calculateWellsFee(
  grossAmount: number,
  currency: string = 'USD',
  wellsDealId: string
): FeeCalculationResult {
  // Calculate 1% fee
  let feeAmount = grossAmount * (WELLS_FEE_CONFIG.ratePercent / 100)

  // Apply minimum fee
  if (WELLS_FEE_CONFIG.minFeeUsd && feeAmount < WELLS_FEE_CONFIG.minFeeUsd) {
    feeAmount = WELLS_FEE_CONFIG.minFeeUsd
  }

  // Apply maximum fee if configured
  if (WELLS_FEE_CONFIG.maxFeeUsd && feeAmount > WELLS_FEE_CONFIG.maxFeeUsd) {
    feeAmount = WELLS_FEE_CONFIG.maxFeeUsd
  }

  // Round to 2 decimal places
  feeAmount = Math.round(feeAmount * 100) / 100

  const transactionId = `WELLS-FEE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const lineItem: WellsFeeLineItem = {
    description: WELLS_FEE_CONFIG.description,
    amount: feeAmount,
    currency,
    glCode: WELLS_FEE_CONFIG.glCode,
    taxable: WELLS_FEE_CONFIG.taxable,
    locked: WELLS_FEE_CONFIG.locked,
    wellsTransactionId: transactionId,
    wellsDealId,
    paymentInstructions: WELLS_ONYX_PAYMENT_INFO.domestic,
  }

  return {
    grossAmount,
    feePercent: WELLS_FEE_CONFIG.ratePercent,
    feeAmount,
    currency,
    lineItem,
    paymentDetails: WELLS_ONYX_PAYMENT_INFO,
  }
}

/**
 * Generate ERP-specific line item payload
 */
export function generateErpLineItem(
  erpSystem: WellsSourcedTransaction['erpSystem'],
  feeResult: FeeCalculationResult
): Record<string, unknown> {
  const base = {
    wells_transaction_id: feeResult.lineItem.wellsTransactionId,
    wells_deal_id: feeResult.lineItem.wellsDealId,
    locked: true,
    do_not_modify: true,
  }

  switch (erpSystem) {
    case 'sap':
      return {
        ...base,
        MATNR: 'WELLS-SVC-FEE',
        MAKTX: WELLS_FEE_CONFIG.description,
        NETWR: feeResult.feeAmount,
        WAERS: feeResult.currency,
        MWSKZ: feeResult.lineItem.taxable ? 'V0' : 'V1', // Tax code
        SAKTO: WELLS_FEE_CONFIG.glCode,
        ZLOCK: 'X', // Custom field for locking
      }

    case 'netsuite':
      return {
        ...base,
        item: {
          internalId: 'WELLS-SVC-FEE',
          name: WELLS_FEE_CONFIG.description,
        },
        amount: feeResult.feeAmount,
        rate: feeResult.feeAmount,
        quantity: 1,
        taxCode: feeResult.lineItem.taxable ? 'UNDEF-US' : 'UNDEF-NOTAX',
        department: 'Wells AI',
        class: 'Platform Fees',
        custcol_wells_locked: true,
        custcol_wells_transaction_id: feeResult.lineItem.wellsTransactionId,
      }

    case 'oracle':
      return {
        ...base,
        ItemNumber: 'WELLS-SVC-FEE',
        Description: WELLS_FEE_CONFIG.description,
        UnitPrice: feeResult.feeAmount,
        Quantity: 1,
        Amount: feeResult.feeAmount,
        TaxClassificationCode: feeResult.lineItem.taxable ? 'STANDARD' : 'EXEMPT',
        AccountingFlexfield: WELLS_FEE_CONFIG.glCode,
        AttributeCategory: 'WELLS_LOCKED',
      }

    case 'dynamics':
      return {
        ...base,
        itemId: 'WELLS-SVC-FEE',
        description: WELLS_FEE_CONFIG.description,
        unitPrice: feeResult.feeAmount,
        quantity: 1,
        lineAmount: feeResult.feeAmount,
        taxGroupId: feeResult.lineItem.taxable ? 'STANDARD' : 'EXEMPT',
        accountId: WELLS_FEE_CONFIG.glCode,
        isLocked: true,
      }

    case 'quickbooks':
      return {
        ...base,
        DetailType: 'SalesItemLineDetail',
        Amount: feeResult.feeAmount,
        Description: WELLS_FEE_CONFIG.description,
        SalesItemLineDetail: {
          ItemRef: {
            value: 'WELLS-SVC-FEE',
            name: WELLS_FEE_CONFIG.description,
          },
          UnitPrice: feeResult.feeAmount,
          Qty: 1,
          TaxCodeRef: {
            value: feeResult.lineItem.taxable ? 'TAX' : 'NON',
          },
        },
      }

    case 'xero':
      return {
        ...base,
        Description: WELLS_FEE_CONFIG.description,
        Quantity: 1,
        UnitAmount: feeResult.feeAmount,
        AccountCode: WELLS_FEE_CONFIG.glCode,
        TaxType: feeResult.lineItem.taxable ? 'OUTPUT' : 'NONE',
        LineAmount: feeResult.feeAmount,
        Tracking: [
          {
            Name: 'WellsAI',
            Option: 'Platform Fee',
          },
        ],
      }

    default:
      return {
        ...base,
        description: WELLS_FEE_CONFIG.description,
        amount: feeResult.feeAmount,
        quantity: 1,
        unitPrice: feeResult.feeAmount,
        glCode: WELLS_FEE_CONFIG.glCode,
        taxable: feeResult.lineItem.taxable,
      }
  }
}

/**
 * Generate payment instructions for the ERP
 */
export function generatePaymentInstructions(
  currency: string = 'USD',
  isInternational: boolean = false
): string {
  const info = isInternational
    ? WELLS_ONYX_PAYMENT_INFO.international
    : WELLS_ONYX_PAYMENT_INFO.domestic

  if (isInternational) {
    return `
WELLS AI SOURCING FEE PAYMENT INSTRUCTIONS
-------------------------------------------
Beneficiary: ${info.beneficiaryName}
Account: ${info.accountNumber}
SWIFT/BIC: ${(info as typeof WELLS_ONYX_PAYMENT_INFO.international).swiftBic}
Bank: ${info.bankName}
Bank Address: ${info.bankAddress}
Beneficiary Address: ${info.beneficiaryAddress}

Reference: Include Wells Transaction ID
`.trim()
  }

  return `
WELLS AI SOURCING FEE PAYMENT INSTRUCTIONS
-------------------------------------------
Beneficiary: ${info.beneficiaryName}
Account: ${info.accountNumber}
Routing (ABA): ${(info as typeof WELLS_ONYX_PAYMENT_INFO.domestic).routingNumber}
Bank: ${info.bankName}
Bank Address: ${info.bankAddress}

Reference: Include Wells Transaction ID
`.trim()
}

/**
 * Validate that a fee line item hasn't been tampered with
 */
export function validateFeeIntegrity(
  originalFee: WellsFeeLineItem,
  currentAmount: number,
  currentDescription: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (Math.abs(currentAmount - originalFee.amount) > 0.01) {
    errors.push(`Fee amount modified: expected ${originalFee.amount}, found ${currentAmount}`)
  }

  if (currentDescription !== originalFee.description) {
    errors.push(`Fee description modified: expected "${originalFee.description}", found "${currentDescription}"`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
