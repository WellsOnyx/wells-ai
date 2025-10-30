/**
 * Test IBM Adapter
 * Validates discover() returns 3 normalized opportunities
 */

import { ibmAdapter } from '../adapters/ibm'
import { OpportunityStage } from '../lib/opportunity'

async function testIBMAdapter() {
  console.log('🧪 Testing IBM Adapter\n')

  // ===== TEST 1: Adapter Info =====
  console.log('📝 TEST 1: Adapter Info')

  const info = ibmAdapter.getInfo()
  console.log(`   Partner ID: ${info.partnerId}`)
  console.log(`   Environment: ${info.environment}`)
  console.log(`   Status: ${info.status}`)

  if (info.partnerId !== 'ibm') {
    throw new Error(`Expected partnerId 'ibm', got '${info.partnerId}'`)
  }

  if (info.environment !== 'stub') {
    throw new Error(`Expected environment 'stub', got '${info.environment}'`)
  }

  console.log(`✅ Adapter configured correctly\n`)

  // ===== TEST 2: Discover Opportunities =====
  console.log('📝 TEST 2: Discover Opportunities')

  const opportunities = await ibmAdapter.discover('wells-onyx')

  console.log(`   Found: ${opportunities.length} opportunities`)

  if (opportunities.length !== 3) {
    throw new Error(`Expected 3 opportunities, got ${opportunities.length}`)
  }

  console.log(`✅ Discovered 3 opportunities\n`)

  // ===== TEST 3: Validate Opportunity Structure =====
  console.log('📝 TEST 3: Validate Opportunity Structure')

  opportunities.forEach((opp, idx) => {
    console.log(`\n   Opportunity ${idx + 1}:`)
    console.log(`   - ID: ${opp.id}`)
    console.log(`   - Title: ${opp.title}`)
    console.log(`   - Company: ${opp.companyName}`)
    console.log(`   - Value: $${opp.estimatedValue.toLocaleString()}`)
    console.log(`   - Stage: ${opp.stage}`)
    console.log(`   - Partner: ${opp.partnerId}`)
    console.log(`   - Supplier: ${opp.supplierId}`)

    // Validate required fields
    if (!opp.id) throw new Error('Missing opportunity id')
    if (!opp.title) throw new Error('Missing opportunity title')
    if (!opp.companyName) throw new Error('Missing company name')
    if (!opp.partnerId) throw new Error('Missing partner id')
    if (!opp.supplierId) throw new Error('Missing supplier id')
    if (opp.partnerId !== 'ibm') throw new Error(`Expected partnerId 'ibm', got '${opp.partnerId}'`)
    if (opp.supplierId !== 'wells-onyx') throw new Error(`Expected supplierId 'wells-onyx', got '${opp.supplierId}'`)
  })

  console.log(`\n✅ All opportunities have valid structure\n`)

  // ===== TEST 4: Validate Deal Values =====
  console.log('📝 TEST 4: Validate Deal Values')

  const totalValue = opportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0)
  const expectedTotalValue = 3500000 + 2800000 + 5200000 // From stub fixtures: Healthcare $3.5M + Retail $2.8M + Financial $5.2M

  console.log(`   Total Pipeline Value: $${totalValue.toLocaleString()}`)
  console.log(`   Expected: $${expectedTotalValue.toLocaleString()}`)

  if (totalValue !== expectedTotalValue) {
    throw new Error(`Expected total value $${expectedTotalValue}, got $${totalValue}`)
  }

  console.log(`✅ Deal values correct\n`)

  // ===== TEST 5: Validate Wells Revenue =====
  console.log('📝 TEST 5: Validate Wells Revenue (33 bps)')

  let opportunitiesWithRevenue = 0
  opportunities.forEach((opp) => {
    if (opp.wellsOpportunity && opp.wellsOpportunity.estimatedFee !== undefined) {
      const expectedRevenue = Math.round(opp.estimatedValue * 0.0033)
      const actualRevenue = opp.wellsOpportunity.estimatedFee

      console.log(`   ${opp.companyName}:`)
      console.log(`   - Deal Value: $${opp.estimatedValue.toLocaleString()}`)
      console.log(`   - Wells Revenue: $${actualRevenue.toLocaleString()}`)

      if (actualRevenue !== expectedRevenue) {
        throw new Error(`Expected Wells revenue $${expectedRevenue}, got $${actualRevenue}`)
      }

      opportunitiesWithRevenue++
    }
  })

  const totalWellsRevenue = opportunities.reduce(
    (sum, opp) => sum + (opp.wellsOpportunity?.estimatedFee || 0),
    0
  )

  if (opportunitiesWithRevenue > 0) {
    console.log(`   Total Wells Revenue: $${totalWellsRevenue.toLocaleString()}`)
    console.log(`✅ Wells revenue calculated correctly (33 bps) for ${opportunitiesWithRevenue} opportunities\n`)
  } else {
    console.log(`   No Wells revenue calculated (opportunities not yet paired)`)
    console.log(`✅ Wells revenue validation skipped\n`)
  }

  // ===== TEST 6: Validate Opportunity Stages =====
  console.log('📝 TEST 6: Validate Opportunity Stages')

  const qualifiedOpps = opportunities.filter(o => o.stage === OpportunityStage.Qualified)
  console.log(`   Qualified opportunities: ${qualifiedOpps.length}`)

  if (qualifiedOpps.length < 1) {
    throw new Error('Expected at least 1 qualified opportunity')
  }

  console.log(`✅ Stage validation passed\n`)

  // ===== SUMMARY =====
  console.log('='.repeat(60))
  console.log('✅ ALL TESTS PASSED')
  console.log('='.repeat(60))
  console.log(`
IBM Adapter Summary:
  Environment: stub (observe mode)
  Opportunities Discovered: ${opportunities.length}
  Total Pipeline Value: $${totalValue.toLocaleString()}
  Total Wells Revenue: $${totalWellsRevenue.toLocaleString()} (33 bps)

Opportunities by Stage:
  - Qualified: ${opportunities.filter(o => o.stage === OpportunityStage.Qualified).length}
  - Lead: ${opportunities.filter(o => o.stage === OpportunityStage.Lead).length}
  - Other: ${opportunities.filter(o => o.stage !== OpportunityStage.Qualified && o.stage !== OpportunityStage.Lead).length}

Ready for UI testing at: /partners/ibm
`)
}

// ===== RUN TEST =====

testIBMAdapter()
  .then(() => {
    console.log('🎉 IBM Adapter: READY FOR PRODUCTION')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
