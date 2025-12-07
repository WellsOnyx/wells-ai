#!/usr/bin/env node
/**
 * Wells Onyx Fee System Test Script
 *
 * Demonstrates fee calculation and capture functionality.
 * Run: node scripts/test-fee-system.js
 */

// Mock the fee calculator (would import from lib/fees in actual app)
const FEE_RATES = {
  'standard': 0.01,      // 1%
  'white-glove': 0.033,  // 3.3%
  'complex': 0.077,      // 7.7%
}

const MINIMUM_FEE = 100

function calculateFee(dealAmount, tier = 'standard') {
  const feePercent = FEE_RATES[tier]
  const calculatedFee = dealAmount * feePercent
  const appliedFee = Math.max(calculatedFee, MINIMUM_FEE)

  return {
    dealAmount,
    tier,
    feePercent: feePercent * 100,
    feeAmount: calculatedFee,
    appliedFee: Math.round(appliedFee * 100) / 100,
    sellerReceives: Math.round((dealAmount - appliedFee) * 100) / 100,
    wellsReceives: Math.round(appliedFee * 100) / 100,
  }
}

console.log('🧮 Wells Onyx Fee System Test\n')
console.log('=' .repeat(70))

// Test Case 1: Standard tier
console.log('\n📊 Test Case 1: Standard Tier (1%)')
console.log('-'.repeat(70))
const test1 = calculateFee(10000, 'standard')
console.log(`Deal Amount:      $${test1.dealAmount.toLocaleString()}`)
console.log(`Fee Rate:         ${test1.feePercent}%`)
console.log(`Calculated Fee:   $${test1.feeAmount.toLocaleString()}`)
console.log(`Applied Fee:      $${test1.appliedFee.toLocaleString()}`)
console.log(`Seller Receives:  $${test1.sellerReceives.toLocaleString()}`)
console.log(`Wells Receives:   $${test1.wellsReceives.toLocaleString()}`)

// Test Case 2: White Glove tier
console.log('\n📊 Test Case 2: White Glove Tier (3.3%)')
console.log('-'.repeat(70))
const test2 = calculateFee(50000, 'white-glove')
console.log(`Deal Amount:      $${test2.dealAmount.toLocaleString()}`)
console.log(`Fee Rate:         ${test2.feePercent}%`)
console.log(`Calculated Fee:   $${test2.feeAmount.toLocaleString()}`)
console.log(`Applied Fee:      $${test2.appliedFee.toLocaleString()}`)
console.log(`Seller Receives:  $${test2.sellerReceives.toLocaleString()}`)
console.log(`Wells Receives:   $${test2.wellsReceives.toLocaleString()}`)

// Test Case 3: Complex tier
console.log('\n📊 Test Case 3: Complex Tier (7.7%)')
console.log('-'.repeat(70))
const test3 = calculateFee(100000, 'complex')
console.log(`Deal Amount:      $${test3.dealAmount.toLocaleString()}`)
console.log(`Fee Rate:         ${test3.feePercent}%`)
console.log(`Calculated Fee:   $${test3.feeAmount.toLocaleString()}`)
console.log(`Applied Fee:      $${test3.appliedFee.toLocaleString()}`)
console.log(`Seller Receives:  $${test3.sellerReceives.toLocaleString()}`)
console.log(`Wells Receives:   $${test3.wellsReceives.toLocaleString()}`)

// Test Case 4: Minimum fee application
console.log('\n📊 Test Case 4: Minimum Fee Application')
console.log('-'.repeat(70))
const test4 = calculateFee(5000, 'standard')
console.log(`Deal Amount:      $${test4.dealAmount.toLocaleString()}`)
console.log(`Fee Rate:         ${test4.feePercent}%`)
console.log(`Calculated Fee:   $${test4.feeAmount.toLocaleString()}`)
console.log(`Applied Fee:      $${test4.appliedFee.toLocaleString()} (minimum applies!)`)
console.log(`Seller Receives:  $${test4.sellerReceives.toLocaleString()}`)
console.log(`Wells Receives:   $${test4.wellsReceives.toLocaleString()}`)

// Test Case 5: Large deal
console.log('\n📊 Test Case 5: Large Deal - $1M')
console.log('-'.repeat(70))
const test5 = calculateFee(1000000, 'white-glove')
console.log(`Deal Amount:      $${test5.dealAmount.toLocaleString()}`)
console.log(`Fee Rate:         ${test5.feePercent}%`)
console.log(`Calculated Fee:   $${test5.feeAmount.toLocaleString()}`)
console.log(`Applied Fee:      $${test5.appliedFee.toLocaleString()}`)
console.log(`Seller Receives:  $${test5.sellerReceives.toLocaleString()}`)
console.log(`Wells Receives:   $${test5.wellsReceives.toLocaleString()}`)

// Summary table
console.log('\n📋 Summary: Fee Comparison')
console.log('='.repeat(70))
console.log('Deal Amount | Tier          | Fee     | Seller Gets | Wells Gets')
console.log('-'.repeat(70))

const deals = [
  { amount: 1000, tier: 'standard' },
  { amount: 5000, tier: 'standard' },
  { amount: 10000, tier: 'standard' },
  { amount: 25000, tier: 'white-glove' },
  { amount: 50000, tier: 'white-glove' },
  { amount: 100000, tier: 'complex' },
  { amount: 500000, tier: 'complex' },
]

deals.forEach(deal => {
  const calc = calculateFee(deal.amount, deal.tier)
  const amount = `$${calc.dealAmount.toLocaleString()}`.padEnd(11)
  const tier = calc.tier.padEnd(13)
  const fee = `$${calc.appliedFee.toLocaleString()}`.padEnd(7)
  const seller = `$${calc.sellerReceives.toLocaleString()}`.padEnd(11)
  const wells = `$${calc.wellsReceives.toLocaleString()}`
  console.log(`${amount} | ${tier} | ${fee} | ${seller} | ${wells}`)
})

// API Examples
console.log('\n🔌 API Usage Examples')
console.log('='.repeat(70))

console.log('\n1. Calculate fee for a deal:')
console.log('   POST /api/fees/calculate')
console.log('   Body: { "dealAmount": 10000, "tier": "standard" }')

console.log('\n2. Release payment (captures fee automatically):')
console.log('   POST /api/deals/release')
console.log('   Body: { "dealId": "deal_123", "tier": "standard" }')

console.log('\n3. Get fee history:')
console.log('   GET /api/fees/history?limit=10')

console.log('\n4. Get fee summary (treasury view):')
console.log('   GET /api/fees/summary?days=30')

console.log('\n5. Generate invoice:')
console.log('   POST /api/fees/invoice')
console.log('   Body: { "feeId": "fee_123" }')

console.log('\n✅ Test complete!\n')

// Export for use in other scripts
module.exports = { calculateFee, FEE_RATES, MINIMUM_FEE }
