/**
 * Test Deal Registration Form Mapper
 * Validates mapping from Opportunity to partner-specific form fields
 */

import { mapDealReg, getSupportedPartners, hasMapper } from '../lib/deal-reg-mapper'
import { ibmAdapter } from '../adapters/ibm'
import { Opportunity } from '../lib/opportunity'

async function testDealRegMapper() {
  console.log('🧪 Testing Deal Registration Form Mapper\n')

  // ===== TEST 1: Check Supported Partners =====
  console.log('📝 TEST 1: Check Supported Partners')

  const supportedPartners = getSupportedPartners()
  console.log(`   Supported partners: ${supportedPartners.join(', ')}`)

  if (!supportedPartners.includes('ibm')) {
    throw new Error('IBM mapper not found')
  }

  if (!hasMapper('ibm')) {
    throw new Error('hasMapper() check failed for IBM')
  }

  console.log(`✅ Found ${supportedPartners.length} partner mappers\n`)

  // ===== TEST 2: Discover IBM Opportunities =====
  console.log('📝 TEST 2: Discover IBM Opportunities')

  const opportunities = await ibmAdapter.discover('wells-onyx')
  console.log(`   Discovered ${opportunities.length} opportunities`)

  if (opportunities.length === 0) {
    throw new Error('No opportunities found')
  }

  console.log(`✅ Discovered opportunities successfully\n`)

  // ===== TEST 3: Map IBM Opportunity =====
  console.log('📝 TEST 3: Map IBM Opportunity to Deal Registration Form')

  const opportunity = opportunities[0]
  console.log(`   Mapping: ${opportunity.title}`)
  console.log(`   Company: ${opportunity.companyName}`)
  console.log(`   Value: $${opportunity.estimatedValue.toLocaleString()}`)

  const fields = mapDealReg('ibm', opportunity)

  console.log(`\n   Mapped Fields:`)
  console.log(`   - opportunity_name: ${fields.opportunity_name}`)
  console.log(`   - customer_name: ${fields.customer_name}`)
  console.log(`   - estimated_value: ${fields.estimated_value}`)
  console.log(`   - opportunity_stage: ${fields.opportunity_stage}`)
  console.log(`   - products: ${fields.products}`)
  console.log(`   - primary_contact_name: ${fields.primary_contact_name}`)
  console.log(`   - region: ${fields.region}`)

  // Validate required fields
  if (!fields.opportunity_name) {
    throw new Error('Missing opportunity_name')
  }

  if (!fields.customer_name) {
    throw new Error('Missing customer_name')
  }

  if (!fields.estimated_value) {
    throw new Error('Missing estimated_value')
  }

  console.log(`\n✅ IBM mapping successful (${Object.keys(fields).length} fields)\n`)

  // ===== TEST 4: Validate Field Types =====
  console.log('📝 TEST 4: Validate Field Types')

  const typeChecks = [
    { field: 'opportunity_name', type: 'string', value: fields.opportunity_name },
    { field: 'customer_name', type: 'string', value: fields.customer_name },
    { field: 'estimated_value', type: 'number', value: fields.estimated_value },
    { field: 'products', type: 'string', value: fields.products },
    { field: 'created_at', type: 'string', value: fields.created_at }
  ]

  typeChecks.forEach((check) => {
    const actualType = typeof check.value
    if (actualType !== check.type) {
      throw new Error(`Field ${check.field} has wrong type: expected ${check.type}, got ${actualType}`)
    }
    console.log(`   ✓ ${check.field}: ${check.type}`)
  })

  console.log(`✅ All field types valid\n`)

  // ===== TEST 5: Map All Opportunities =====
  console.log('📝 TEST 5: Map All Opportunities')

  const allMappedFields = opportunities.map((opp, idx) => {
    const mapped = mapDealReg('ibm', opp)
    console.log(`   ${idx + 1}. ${mapped.opportunity_name} - $${(mapped.estimated_value as number).toLocaleString()}`)
    return mapped
  })

  console.log(`✅ Mapped all ${allMappedFields.length} opportunities\n`)

  // ===== TEST 6: Test Cisco Mapper =====
  console.log('📝 TEST 6: Test Cisco Mapper')

  if (hasMapper('cisco')) {
    const ciscoFields = mapDealReg('cisco', opportunity)
    console.log(`   Cisco deal_name: ${ciscoFields.deal_name}`)
    console.log(`   Cisco account_name: ${ciscoFields.account_name}`)
    console.log(`   Cisco deal_size: ${ciscoFields.deal_size}`)

    if (!ciscoFields.deal_name || !ciscoFields.account_name) {
      throw new Error('Cisco mapping missing required fields')
    }

    console.log(`✅ Cisco mapping successful (${Object.keys(ciscoFields).length} fields)\n`)
  }

  // ===== TEST 7: Test AWS Mapper =====
  console.log('📝 TEST 7: Test AWS Mapper')

  if (hasMapper('aws')) {
    const awsFields = mapDealReg('aws', opportunity)
    console.log(`   AWS opportunity_title: ${awsFields.opportunity_title}`)
    console.log(`   AWS customer_company_name: ${awsFields.customer_company_name}`)
    console.log(`   AWS total_contract_value: ${awsFields.total_contract_value}`)

    if (!awsFields.opportunity_title || !awsFields.customer_company_name) {
      throw new Error('AWS mapping missing required fields')
    }

    console.log(`✅ AWS mapping successful (${Object.keys(awsFields).length} fields)\n`)
  }

  // ===== TEST 8: Error Handling =====
  console.log('📝 TEST 8: Error Handling')

  try {
    mapDealReg('invalid-partner', opportunity)
    throw new Error('Should have thrown error for invalid partner')
  } catch (error) {
    if (error instanceof Error && error.message.includes('No deal registration mapper')) {
      console.log(`   ✓ Correctly rejects invalid partner`)
    } else {
      throw error
    }
  }

  console.log(`✅ Error handling works correctly\n`)

  // ===== TEST 9: Field Coverage =====
  console.log('📝 TEST 9: Field Coverage Analysis')

  const requiredFields = [
    'opportunity_name',
    'customer_name',
    'estimated_value',
    'opportunity_stage',
    'products'
  ]

  const missingFields = requiredFields.filter(field => !fields[field])

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
  }

  console.log(`   ✓ All ${requiredFields.length} required fields present`)
  console.log(`   ✓ Total fields mapped: ${Object.keys(fields).length}`)

  const optionalFieldsPresent = Object.keys(fields).length - requiredFields.length
  console.log(`   ✓ Optional fields present: ${optionalFieldsPresent}`)

  console.log(`✅ Field coverage validated\n`)

  // ===== SUMMARY =====
  console.log('='.repeat(60))
  console.log('✅ ALL TESTS PASSED')
  console.log('='.repeat(60))
  console.log(`
Deal Registration Mapper Summary:
  Partners Supported: ${supportedPartners.length} (${supportedPartners.join(', ')})
  Opportunities Tested: ${opportunities.length}
  Fields Mapped (IBM): ${Object.keys(fields).length}
  Required Fields: ${requiredFields.length}
  Optional Fields: ${optionalFieldsPresent}

Sample IBM Form Fields:
  ${JSON.stringify(fields, null, 2).split('\n').slice(0, 20).join('\n  ')}
  ...

Ready for integration with partner portals!
`)
}

// ===== RUN TEST =====

testDealRegMapper()
  .then(() => {
    console.log('🎉 Deal Registration Mapper: READY FOR PRODUCTION')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
