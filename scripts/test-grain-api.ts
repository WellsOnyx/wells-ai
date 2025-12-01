/**
 * Grain & Vault API Test Script
 *
 * Tests all API endpoints to verify functionality
 * Run with: npx tsx scripts/test-grain-api.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key'

interface TestResult {
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  statusCode?: number
  error?: string
  duration?: number
}

const results: TestResult[] = []

/**
 * Test helper function
 */
async function testEndpoint(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const duration = Date.now() - startTime
    const data = await response.json()

    if (response.ok) {
      console.log(`✅ ${method} ${endpoint} - ${duration}ms`)
      return {
        endpoint,
        method,
        status: 'PASS',
        statusCode: response.status,
        duration,
      }
    } else {
      console.log(`❌ ${method} ${endpoint} - ${response.status}: ${data.error || data.message}`)
      return {
        endpoint,
        method,
        status: 'FAIL',
        statusCode: response.status,
        error: data.error || data.message,
        duration,
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`❌ ${method} ${endpoint} - Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    return {
      endpoint,
      method,
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Grain & Vault API Tests...\n')

  // ============================================================================
  // PRICE API
  // ============================================================================
  console.log('📊 Testing Price API...')
  results.push(await testEndpoint('/api/grain/price', 'GET'))

  // ============================================================================
  // VAULT API
  // ============================================================================
  console.log('\n🏦 Testing Vault API...')
  results.push(await testEndpoint('/api/vault/assets', 'GET'))

  // Test deposit (will fail without USDC approval, but should validate)
  results.push(
    await testEndpoint('/api/vault/deposit', 'POST', {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
      usdcAmount: 100,
    })
  )

  // ============================================================================
  // INVESTOR API
  // ============================================================================
  console.log('\n💰 Testing Investor API...')

  // Test status check (should 404 if no investment)
  results.push(
    await testEndpoint(
      '/api/grain/invest/status/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
      'GET'
    )
  )

  // ============================================================================
  // TRANSACTION API
  // ============================================================================
  console.log('\n📈 Testing Transaction API...')
  results.push(
    await testEndpoint(
      '/api/transactions/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
      'GET'
    )
  )

  // ============================================================================
  // ANALYTICS API
  // ============================================================================
  console.log('\n📊 Testing Analytics API...')
  results.push(await testEndpoint('/api/analytics/grain', 'GET'))

  // ============================================================================
  // ADMIN API
  // ============================================================================
  console.log('\n🔧 Testing Admin API...')

  // Health check (requires auth)
  results.push(
    await testEndpoint('/api/admin/grain/health', 'GET', undefined, {
      Authorization: `Bearer ${ADMIN_API_KEY}`,
    })
  )

  // Test unauthorized access
  results.push(await testEndpoint('/api/admin/grain/health', 'GET'))

  // ============================================================================
  // ESCROW API
  // ============================================================================
  console.log('\n🤝 Testing Escrow API...')

  // Get escrow (should 404 if doesn't exist)
  results.push(await testEndpoint('/api/escrow/12345', 'GET'))

  // ============================================================================
  // RESULTS SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const skipped = results.filter((r) => r.status === 'SKIP').length
  const total = results.length

  console.log(`Total Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`)

  // Average response time
  const avgDuration =
    results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length
  console.log(`Average Response Time: ${avgDuration.toFixed(0)}ms`)

  // Failed tests details
  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  - ${r.method} ${r.endpoint}`)
        console.log(`    Error: ${r.error || 'Unknown'}`)
        console.log(`    Status: ${r.statusCode || 'N/A'}`)
      })
  }

  console.log('\n' + '='.repeat(60))

  // Exit with error if any tests failed (for CI/CD)
  if (failed > 0) {
    process.exit(1)
  }
}

/**
 * Main execution
 */
;(async () => {
  console.log(`Testing API at: ${BASE_URL}\n`)

  try {
    await runTests()
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  }
})()
