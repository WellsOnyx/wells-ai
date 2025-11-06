/**
 * Wells Fee Structure - Tiered Based on Value Added
 *
 * The more value Wells provides, the higher the fee.
 * This creates strong incentives for sellers to use Wells GTM engine.
 */

export enum DealOriginationType {
  SELLER_SOURCED = 'seller_sourced', // Seller brings their own buyer
  WELLS_GTM = 'wells_gtm',           // Seller uses Wells GTM engine to find buyers
  WELLS_ORIGINATED = 'wells_originated' // Wells finds buyer and matches with seller
}

export interface FeeStructure {
  originationType: DealOriginationType
  feePercentage: number // Decimal (e.g., 0.0033 for 33 bps, 0.025 for 2.5%)
  description: string
  includes: string[]
}

/**
 * Get fee structure for a deal based on origination type
 */
export function getFeeStructure(originationType: DealOriginationType): FeeStructure {
  switch (originationType) {
    case DealOriginationType.SELLER_SOURCED:
      return {
        originationType,
        feePercentage: 0.0033, // 33 bps (0.33%)
        description: 'Transaction facilitation only',
        includes: [
          'Grain Vault escrow (1-2 day payout)',
          'Contract generation',
          'Dispute resolution',
          'Payment processing',
          'Transaction history'
        ]
      }

    case DealOriginationType.WELLS_GTM:
      return {
        originationType,
        feePercentage: 0.033, // 3.3%
        description: 'GTM engine + facilitation',
        includes: [
          'AI-powered lead generation',
          'Email/SMS outreach campaigns',
          'LinkedIn automation',
          'CRM integration',
          'Lead scoring & qualification',
          'Meeting scheduling',
          'Everything in Basic tier'
        ]
      }

    case DealOriginationType.WELLS_ORIGINATED:
      return {
        originationType,
        feePercentage: 0.07, // 7%
        description: 'Full origination + facilitation',
        includes: [
          'Wells finds & qualifies buyer',
          'Introduction & relationship building',
          'Needs assessment',
          'Proposal creation',
          'Negotiation support',
          'Everything in GTM tier'
        ]
      }
  }
}

/**
 * Calculate fee for a transaction
 */
export function calculateFee(
  dealAmount: number, // in cents
  originationType: DealOriginationType
): {
  feeAmount: number // in cents
  feePercentage: number
  originationType: DealOriginationType
  displayText: string
} {
  const structure = getFeeStructure(originationType)
  const feeAmount = Math.round(dealAmount * structure.feePercentage)

  let displayText = ''
  if (structure.feePercentage < 0.01) {
    // Display in basis points for < 1%
    const bps = Math.round(structure.feePercentage * 10000)
    displayText = `${bps} bps (${structure.description})`
  } else {
    // Display as percentage for >= 1%
    const percent = (structure.feePercentage * 100).toFixed(1)
    displayText = `${percent}% (${structure.description})`
  }

  return {
    feeAmount,
    feePercentage: structure.feePercentage,
    originationType,
    displayText
  }
}

/**
 * Get marketing copy for fee structure
 * This is what we show to sellers during onboarding
 */
export function getFeeStructureMarketingCopy(): string {
  return `**Wells Fee Structure**

We charge based on the value we provide:

**🔹 Bring Your Own Buyer** (0.33%)
You source the deal, we handle payment & contracts.
• Grain Vault escrow (1-2 day payout)
• Automated contracts
• Dispute resolution

**🚀 Use Wells GTM Engine** (3.3%)
Access our AI-powered sales automation.
• AI lead generation & qualification
• Multi-channel outreach (email, SMS, LinkedIn)
• CRM integration & analytics
• Everything in Basic tier

**⭐ Wells Originates Deal** (7%)
We find the buyer, make the intro, close the deal.
• Wells finds & qualifies perfect buyer
• Warm introduction with context
• Negotiation support
• Everything in GTM tier

**Bottom line:** Start at 0.33%, only pay more when we help you make more.`
}

/**
 * Determine origination type from deal context
 * This helps auto-classify deals
 */
export function determineOriginationType(context: {
  rfqId?: string // If RFQ exists, Wells likely matched
  sellerInitiated?: boolean // Seller reached out first
  gtmCampaignId?: string // Came from GTM campaign
  referralSource?: string
}): DealOriginationType {
  // If seller initiated contact with specific buyer, they sourced it
  if (context.sellerInitiated) {
    return DealOriginationType.SELLER_SOURCED
  }

  // If from GTM campaign, seller used our engine
  if (context.gtmCampaignId) {
    return DealOriginationType.WELLS_GTM
  }

  // If RFQ exists and seller didn't initiate, Wells originated
  if (context.rfqId && !context.sellerInitiated) {
    return DealOriginationType.WELLS_ORIGINATED
  }

  // Default to Wells originated (safest assumption)
  return DealOriginationType.WELLS_ORIGINATED
}

/**
 * Get incentive messaging for sellers
 */
export function getSellerIncentiveMessage(currentTier: DealOriginationType): string {
  if (currentTier === DealOriginationType.SELLER_SOURCED) {
    return `💡 **Want more deals?** Use Wells GTM to automate outreach and find new buyers. When you close deals through our GTM engine, we only charge 2.5% vs. the 6% for Wells-originated deals.`
  }

  if (currentTier === DealOriginationType.WELLS_GTM) {
    return `🎯 **Great choice!** You're using Wells GTM to source deals at 2.5%. Want even cheaper? Bring your own buyers at just 33 bps for facilitation.`
  }

  return `✨ **Maximize your margins:** Use Wells GTM engine (2.5% fee) or bring your own buyers (33 bps fee) to keep more of each deal.`
}
