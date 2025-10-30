/**
 * Test Opportunity Parsers
 * Verify that all partner formats normalize correctly
 */

import * as fs from 'fs'
import * as path from 'path'
import { parseOpportunity } from '../lib/opportunity-parsers'
import { Opportunity, calculateWellsRevenue, isHotOpportunity } from '../lib/opportunity'

// Load fixtures
const ibmFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'opps', 'ibm-cloud-migration.json'), 'utf-8')
)

const ciscoFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'opps', 'cisco-umbrella-security.json'), 'utf-8')
)

const plaidFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'opps', 'plaid-payment-infrastructure.json'), 'utf-8')
)

// Test functions
function testParser(partnerId: string, fixture: any, expectedCompany: string) {
  console.log(`\n=== Testing ${partnerId.toUpperCase()} Parser ===`)

  try {
    const opportunity = parseOpportunity(partnerId, fixture)

    console.log(`✅ Parsed successfully`)
    console.log(`   ID: ${opportunity.id}`)
    console.log(`   Title: ${opportunity.title}`)
    console.log(`   Company: ${opportunity.companyName}`)
    console.log(`   Industry: ${opportunity.industry || 'N/A'}`)
    console.log(`   Value: $${opportunity.estimatedValue.toLocaleString()}`)
    console.log(`   Stage: ${opportunity.stage}`)
    console.log(`   Status: ${opportunity.status}`)
    console.log(`   Products: ${opportunity.products.join(', ')}`)
    console.log(`   Region: ${opportunity.region || 'N/A'}`)
    console.log(`   Contact: ${opportunity.primaryContact?.name} (${opportunity.primaryContact?.email})`)

    // Test Wells opportunity suggestion
    if (opportunity.wellsOpportunity) {
      console.log(`\n   Wells Opportunity Suggested:`)
      console.log(`   - Type: ${opportunity.wellsOpportunity.searchType}`)
      console.log(`   - Title: ${opportunity.wellsOpportunity.title}`)
      console.log(`   - Estimated Fee: $${opportunity.wellsOpportunity.estimatedFee.toLocaleString()}`)
    }

    // Test revenue calculation
    const revenue = calculateWellsRevenue(opportunity)
    console.log(`\n   Wells Revenue: $${revenue.toLocaleString()}`)

    // Test hot opportunity check
    const isHot = isHotOpportunity(opportunity)
    console.log(`   Hot Opportunity: ${isHot ? '🔥 YES' : 'No'}`)

    // Verify company name matches
    if (opportunity.companyName === expectedCompany) {
      console.log(`\n✅ Test PASSED: Company name matches expected`)
    } else {
      console.log(`\n❌ Test FAILED: Expected company '${expectedCompany}', got '${opportunity.companyName}'`)
      return false
    }

    return true
  } catch (error) {
    console.log(`❌ Parser failed:`, error)
    return false
  }
}

// Run all tests
console.log('========================================')
console.log('Wells AI Opportunity Parser Tests')
console.log('========================================')

const results = [
  testParser('ibm', ibmFixture, 'HealthTech Solutions Inc.'),
  testParser('cisco', ciscoFixture, 'Precision Manufacturing Group'),
  testParser('plaid', plaidFixture, 'NextGen Lending Co.')
]

console.log('\n========================================')
console.log('Test Summary')
console.log('========================================')

const passed = results.filter(r => r).length
const total = results.length

console.log(`${passed}/${total} tests passed`)

if (passed === total) {
  console.log(`\n✅ ALL TESTS PASSED! Parser accepts all 3 fixtures.`)
  process.exit(0)
} else {
  console.log(`\n❌ SOME TESTS FAILED`)
  process.exit(1)
}
