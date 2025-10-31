/**
 * Test Global Input Validation
 *
 * Verifies that API routes properly validate inputs and return correct error codes
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  response?: any
}

const results: TestResult[] = []

async function testEndpoint(
  name: string,
  endpoint: string,
  payload: any,
  expectedStatus: number,
  expectedErrorCode?: string
) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    // Check status code
    if (response.status !== expectedStatus) {
      results.push({
        name,
        passed: false,
        error: `Expected status ${expectedStatus}, got ${response.status}`,
        response: data
      })
      return
    }

    // Check error code if expected
    if (expectedErrorCode && data.errorCode !== expectedErrorCode) {
      results.push({
        name,
        passed: false,
        error: `Expected errorCode ${expectedErrorCode}, got ${data.errorCode}`,
        response: data
      })
      return
    }

    results.push({
      name,
      passed: true,
      response: data
    })

  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message
    })
  }
}

async function main() {
  console.log('🧪 Testing Global Input Validation\n')
  console.log(`Base URL: ${BASE_URL}\n`)

  // ==========================================================================
  // CHAT API TESTS
  // ==========================================================================

  console.log('📱 Testing /api/chat...')

  // Valid request
  await testEndpoint(
    'Chat: Valid request',
    '/api/chat',
    {
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      userData: { userType: 'buyer' }
    },
    200
  )

  // Missing messages
  await testEndpoint(
    'Chat: Missing messages',
    '/api/chat',
    { userData: { userType: 'buyer' } },
    400,
    'VALIDATION_FAILED'
  )

  // Empty messages array
  await testEndpoint(
    'Chat: Empty messages array',
    '/api/chat',
    { messages: [] },
    400,
    'VALIDATION_FAILED'
  )

  // Invalid message role
  await testEndpoint(
    'Chat: Invalid message role',
    '/api/chat',
    {
      messages: [
        { role: 'invalid_role', content: 'Test' }
      ]
    },
    400,
    'VALIDATION_FAILED'
  )

  // Message content too long (> 10000 chars)
  await testEndpoint(
    'Chat: Message content too long',
    '/api/chat',
    {
      messages: [
        { role: 'user', content: 'x'.repeat(10001) }
      ]
    },
    400,
    'VALIDATION_FAILED'
  )

  // ==========================================================================
  // SUPPLIER MATCH TESTS
  // ==========================================================================

  console.log('\n🔍 Testing /api/suppliers/match...')

  // Valid request
  await testEndpoint(
    'Supplier Match: Valid request',
    '/api/suppliers/match',
    {
      category: 'Executive Talent',
      requirements: 'Looking for a Chief of Staff'
    },
    200
  )

  // Missing category
  await testEndpoint(
    'Supplier Match: Missing category',
    '/api/suppliers/match',
    { requirements: 'Test' },
    400,
    'VALIDATION_FAILED'
  )

  // Empty requirements
  await testEndpoint(
    'Supplier Match: Empty requirements',
    '/api/suppliers/match',
    { category: 'Test', requirements: '' },
    400,
    'VALIDATION_FAILED'
  )

  // ==========================================================================
  // SUPPLIER NOTIFY TESTS
  // ==========================================================================

  console.log('\n📧 Testing /api/suppliers/notify...')

  // Invalid supplierIds (not an array)
  await testEndpoint(
    'Supplier Notify: Invalid supplierIds type',
    '/api/suppliers/notify',
    {
      supplierIds: 'not-an-array',
      buyerName: 'Test Buyer',
      requirements: 'Test',
      category: 'Test'
    },
    400,
    'VALIDATION_FAILED'
  )

  // Empty supplierIds array
  await testEndpoint(
    'Supplier Notify: Empty supplierIds array',
    '/api/suppliers/notify',
    {
      supplierIds: [],
      buyerName: 'Test Buyer',
      requirements: 'Test',
      category: 'Test'
    },
    400,
    'VALIDATION_FAILED'
  )

  // Too many suppliers (> 10)
  await testEndpoint(
    'Supplier Notify: Too many suppliers',
    '/api/suppliers/notify',
    {
      supplierIds: Array(11).fill('supplier-id'),
      buyerName: 'Test Buyer',
      requirements: 'Test',
      category: 'Test'
    },
    400,
    'VALIDATION_FAILED'
  )

  // ==========================================================================
  // CONSENT DECIDE TESTS
  // ==========================================================================

  console.log('\n✅ Testing /api/consent/decide...')

  // Invalid actionId (not a UUID)
  await testEndpoint(
    'Consent Decide: Invalid UUID',
    '/api/consent/decide',
    {
      actionId: 'not-a-uuid',
      decision: 'approve'
    },
    400,
    'VALIDATION_FAILED'
  )

  // Invalid decision enum
  await testEndpoint(
    'Consent Decide: Invalid decision',
    '/api/consent/decide',
    {
      actionId: '123e4567-e89b-12d3-a456-426614174000',
      decision: 'maybe'
    },
    400,
    'VALIDATION_FAILED'
  )

  // ==========================================================================
  // INVALID JSON TEST
  // ==========================================================================

  console.log('\n🔧 Testing invalid JSON...')

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json'
    })

    const data = await response.json()

    if (response.status === 400 && data.errorCode === 'VALIDATION_FAILED') {
      results.push({
        name: 'Invalid JSON request',
        passed: true,
        response: data
      })
    } else {
      results.push({
        name: 'Invalid JSON request',
        passed: false,
        error: `Expected 400 VALIDATION_FAILED, got ${response.status} ${data.errorCode}`
      })
    }
  } catch (error: any) {
    results.push({
      name: 'Invalid JSON request',
      passed: false,
      error: error.message
    })
  }

  // ==========================================================================
  // PRINT RESULTS
  // ==========================================================================

  console.log('\n\n' + '='.repeat(60))
  console.log('📊 TEST RESULTS')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  passed.forEach(r => {
    console.log(`✅ ${r.name}`)
  })

  if (failed.length > 0) {
    console.log('')
    failed.forEach(r => {
      console.log(`❌ ${r.name}`)
      console.log(`   Error: ${r.error}`)
      if (r.response) {
        console.log(`   Response: ${JSON.stringify(r.response, null, 2).substring(0, 200)}`)
      }
      console.log('')
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`)
  console.log('='.repeat(60) + '\n')

  if (failed.length === 0) {
    console.log('🎉 All validation tests passed!')
  } else {
    console.log('❌ Some validation tests failed')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})
