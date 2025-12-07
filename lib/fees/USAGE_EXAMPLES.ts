/**
 * Wells Onyx Fee System - Usage Examples
 *
 * This file demonstrates how to use the fee calculation and capture system.
 */

import { FeeCalculator, FeeService } from '@/lib/fees'

// ============================================================================
// EXAMPLE 1: Calculate Fee for a Deal
// ============================================================================

async function exampleCalculateFee() {
  // Standard tier (1%)
  const standardCalc = FeeCalculator.calculateFee(10000, 'standard')
  console.log('Standard Tier (1%):')
  console.log(`  Deal Amount: $${standardCalc.dealAmount}`)
  console.log(`  Fee: $${standardCalc.appliedFee}`)
  console.log(`  Seller Receives: $${standardCalc.sellerReceives}`)
  // Output:
  // Deal Amount: $10000
  // Fee: $100 (minimum fee applies even though 1% would be $100)
  // Seller Receives: $9900

  // White Glove tier (3.3%)
  const whiteGloveCalc = FeeCalculator.calculateFee(50000, 'white-glove')
  console.log('\nWhite Glove Tier (3.3%):')
  console.log(`  Deal Amount: $${whiteGloveCalc.dealAmount}`)
  console.log(`  Fee: $${whiteGloveCalc.appliedFee}`)
  console.log(`  Seller Receives: $${whiteGloveCalc.sellerReceives}`)
  // Output:
  // Deal Amount: $50000
  // Fee: $1650
  // Seller Receives: $48350

  // Complex tier (7.7%)
  const complexCalc = FeeCalculator.calculateFee(100000, 'complex')
  console.log('\nComplex Tier (7.7%):')
  console.log(`  Deal Amount: $${complexCalc.dealAmount}`)
  console.log(`  Fee: $${complexCalc.appliedFee}`)
  console.log(`  Seller Receives: $${complexCalc.sellerReceives}`)
  // Output:
  // Deal Amount: $100000
  // Fee: $7700
  // Seller Receives: $92300

  // Small deal (minimum fee applies)
  const smallDeal = FeeCalculator.calculateFee(5000, 'standard')
  console.log('\nSmall Deal (minimum fee):')
  console.log(`  Deal Amount: $${smallDeal.dealAmount}`)
  console.log(`  Calculated Fee (1%): $${smallDeal.feeAmount}`)
  console.log(`  Applied Fee (minimum): $${smallDeal.appliedFee}`)
  console.log(`  Seller Receives: $${smallDeal.sellerReceives}`)
  // Output:
  // Deal Amount: $5000
  // Calculated Fee (1%): $50
  // Applied Fee (minimum): $100
  // Seller Receives: $4900
}

// ============================================================================
// EXAMPLE 2: Recommend Fee Tier Based on Complexity
// ============================================================================

async function exampleRecommendTier() {
  // Simple deal
  const simpleTier = FeeCalculator.recommendFeeTier(5000, {
    hasCustomTerms: false,
    requiresNegotiation: false,
  })
  console.log(`Simple $5k deal: ${simpleTier}`) // "standard"

  // Complex negotiation
  const negotiationTier = FeeCalculator.recommendFeeTier(150000, {
    requiresNegotiation: true,
    hasMilestones: true,
  })
  console.log(`$150k with milestones: ${negotiationTier}`) // "white-glove"

  // Multi-party complex deal
  const complexTier = FeeCalculator.recommendFeeTier(1000000, {
    multiParty: true,
    hasCustomTerms: true,
  })
  console.log(`$1M multi-party: ${complexTier}`) // "complex"
}

// ============================================================================
// EXAMPLE 3: Calculate Escrow Split
// ============================================================================

async function exampleEscrowSplit() {
  const split = FeeCalculator.calculateEscrowSplit(10000, 'standard')

  console.log('Escrow Release Split:')
  console.log(`  Total in Escrow: $${split.totalAmount}`)
  console.log(`  Fee to Wells: $${split.feeAmount}`)
  console.log(`  Amount to Seller: $${split.sellerAmount}`)
  console.log(`  Wells Treasury Wallet: ${split.wellsTreasuryWallet}`)
  // Output:
  // Total in Escrow: $10000
  // Fee to Wells: $100
  // Amount to Seller: $9900
  // Wells Treasury Wallet: 0x...
}

// ============================================================================
// EXAMPLE 4: Capture Fee During Escrow Release
// ============================================================================

async function exampleCaptureFee() {
  const dealId = 'deal_12345'
  const amount = 10000
  const escrowWalletId = 'wallet_escrow_12345'
  const sellerWalletAddress = '0xSELLER_ADDRESS'

  // This is called automatically during escrow release
  const result = await FeeService.captureFee(
    dealId,
    amount,
    escrowWalletId,
    sellerWalletAddress,
    'standard'
  )

  if (result.success) {
    console.log('Fee captured successfully!')
    console.log(`  Fee ID: ${result.feeId}`)
    console.log(`  Fee Amount: $${result.feeAmount}`)
    console.log(`  Seller Amount: $${result.sellerAmount}`)
    console.log(`  Fee Transfer ID: ${result.feeTransferId}`)
    console.log(`  Seller Transfer ID: ${result.sellerTransferId}`)
  } else {
    console.error(`Fee capture failed: ${result.error}`)
  }
}

// ============================================================================
// EXAMPLE 5: Get User Fee History
// ============================================================================

async function exampleGetFeeHistory() {
  const userId = 'user_12345'

  const history = await FeeService.getFeeHistory(userId, 10)

  console.log('Fee History:')
  history.forEach((fee, index) => {
    console.log(`\n${index + 1}. ${fee.dealDescription}`)
    console.log(`   Deal Amount: $${fee.dealAmount}`)
    console.log(`   Fee Paid: $${fee.feeAmount}`)
    console.log(`   Tier: ${fee.tier}`)
    console.log(`   Status: ${fee.status}`)
    console.log(`   Date: ${fee.capturedAt.toLocaleDateString()}`)
  })
}

// ============================================================================
// EXAMPLE 6: Generate Invoice for Fee
// ============================================================================

async function exampleGenerateInvoice() {
  const feeId = 'fee_12345'

  const result = await FeeService.generateInvoice(feeId)

  if (result.success) {
    console.log('Invoice generated!')
    console.log(`  Invoice ID: ${result.invoiceId}`)
    console.log(`  Invoice URL: ${result.invoiceUrl}`)
  } else {
    console.error(`Invoice generation failed: ${result.error}`)
  }
}

// ============================================================================
// EXAMPLE 7: Get Fee Summary (Treasury View)
// ============================================================================

async function exampleGetFeeSummary() {
  const summary = await FeeService.getFeeSummary(30) // Last 30 days

  console.log('Fee Summary (Last 30 Days):')
  console.log(`  Total Fees Collected: $${summary.totalFees}`)
  console.log(`  Number of Fees: ${summary.feeCount}`)
  console.log(`  Average Fee: $${summary.averageFee}`)

  console.log('\n  By Tier:')
  console.log(`    Standard (1%): ${summary.byTier.standard.count} fees, $${summary.byTier.standard.total}`)
  console.log(`    White Glove (3.3%): ${summary.byTier['white-glove'].count} fees, $${summary.byTier['white-glove'].total}`)
  console.log(`    Complex (7.7%): ${summary.byTier.complex.count} fees, $${summary.byTier.complex.total}`)
}

// ============================================================================
// EXAMPLE 8: Complete Escrow Release Flow (As It Happens)
// ============================================================================

async function exampleCompleteFlow() {
  // Buyer confirms delivery and releases payment
  // This is what happens in /api/deals/release

  const dealId = 'deal_12345'
  const dealAmount = 25000
  const escrowWalletId = 'wallet_escrow_12345'
  const sellerWalletAddress = '0xSELLER'
  const tier = 'white-glove'

  // Step 1: Calculate what seller will receive
  const calc = FeeCalculator.calculateFee(dealAmount, tier)
  console.log('Escrow Release Preview:')
  console.log(`  Total in Escrow: $${calc.dealAmount}`)
  console.log(`  Wells Fee (${calc.feePercent}%): $${calc.appliedFee}`)
  console.log(`  Seller Receives: $${calc.sellerReceives}`)

  // Step 2: Capture fee (happens automatically in release endpoint)
  const feeResult = await FeeService.captureFee(
    dealId,
    dealAmount,
    escrowWalletId,
    sellerWalletAddress,
    tier
  )

  if (feeResult.success) {
    console.log('\n✓ Fee captured and payment released!')
    console.log(`  Fee to Wells: $${feeResult.feeAmount} (Transfer: ${feeResult.feeTransferId})`)
    console.log(`  Payment to Seller: $${feeResult.sellerAmount} (Transfer: ${feeResult.sellerTransferId})`)

    // Step 3: Generate invoice
    const invoiceResult = await FeeService.generateInvoice(feeResult.feeId)
    if (invoiceResult.success) {
      console.log(`  Invoice: ${invoiceResult.invoiceUrl}`)
    }
  }
}

// ============================================================================
// EXAMPLE 9: API Usage
// ============================================================================

async function exampleAPIUsage() {
  // Calculate fee via API
  const calcResponse = await fetch('/api/fees/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealAmount: 10000,
      tier: 'standard',
    }),
  })
  const calcData = await calcResponse.json()
  console.log('Fee Calculation:', calcData.calculation)

  // Get fee history via API
  const historyResponse = await fetch('/api/fees/history?limit=10')
  const historyData = await historyResponse.json()
  console.log('Fee History:', historyData.history)

  // Get fee summary via API
  const summaryResponse = await fetch('/api/fees/summary?days=30')
  const summaryData = await summaryResponse.json()
  console.log('Fee Summary:', summaryData.summary)

  // Release payment (triggers fee capture)
  const releaseResponse = await fetch('/api/deals/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealId: 'deal_12345',
      tier: 'standard', // Optional, defaults to 'standard'
    }),
  })
  const releaseData = await releaseResponse.json()
  console.log('Release Result:', {
    seller: releaseData.seller,
    wells: releaseData.wells,
    breakdown: releaseData.breakdown,
  })
}

// ============================================================================
// Export examples
// ============================================================================

export const FeeSystemExamples = {
  exampleCalculateFee,
  exampleRecommendTier,
  exampleEscrowSplit,
  exampleCaptureFee,
  exampleGetFeeHistory,
  exampleGenerateInvoice,
  exampleGetFeeSummary,
  exampleCompleteFlow,
  exampleAPIUsage,
}
