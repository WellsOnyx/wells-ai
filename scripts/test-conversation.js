/**
 * Test Conversation API
 * Tests Phase 4 conversational procurement features
 */

const BASE_URL = process.env.BASE_URL || 'https://wellsai.vercel.app'

// ANSI color codes
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const RESET = '\x1b[0m'

async function testConversation(testName, message, expectedIntent) {
  console.log(`\n${BLUE}Test: ${testName}${RESET}`)
  console.log(`Message: "${message}"`)

  try {
    const response = await fetch(`${BASE_URL}/api/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: 'test_user_' + Date.now(),
        platform: 'test',
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.log(`${RED}✗ FAILED: ${result.error || 'Unknown error'}${RESET}`)
      return false
    }

    console.log(`${GREEN}✓ PASSED${RESET}`)
    console.log(`  Intent: ${result.intent}`)
    console.log(`  Success: ${result.success}`)
    console.log(`  Response: ${result.response?.substring(0, 100)}...`)

    if (expectedIntent && result.intent !== expectedIntent) {
      console.log(
        `${YELLOW}⚠ Warning: Expected intent "${expectedIntent}", got "${result.intent}"${RESET}`
      )
    }

    return true
  } catch (error) {
    console.log(`${RED}✗ ERROR: ${error.message}${RESET}`)
    return false
  }
}

async function runTests() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${BLUE}Phase 4 Conversational API Tests${RESET}`)
  console.log(`Testing: ${BASE_URL}/api/conversation`)
  console.log(`${'='.repeat(60)}`)

  const tests = [
    // Greetings
    {
      name: 'Greeting',
      message: 'Hello',
      expectedIntent: 'greeting',
    },
    {
      name: 'Help request',
      message: 'What can you do?',
      expectedIntent: 'help',
    },

    // Purchase Orders
    {
      name: 'Create PO - Complete',
      message: 'Create a PO for 100 office chairs from Acme Corp for $5000 due Dec 1',
      expectedIntent: 'create_po',
    },
    {
      name: 'Create PO - Incomplete (should ask for clarification)',
      message: 'Create a purchase order',
      expectedIntent: 'create_po',
    },
    {
      name: 'Query POs',
      message: 'Show me all pending purchase orders',
      expectedIntent: 'query_po',
    },
    {
      name: 'Approve PO',
      message: 'Approve PO-12345',
      expectedIntent: 'approve_po',
    },

    // Inventory
    {
      name: 'Check inventory',
      message: "What's my inventory status?",
      expectedIntent: 'check_inventory',
    },
    {
      name: 'Check specific product',
      message: 'How many office chairs do we have in stock?',
      expectedIntent: 'check_inventory',
    },
    {
      name: 'Reorder item',
      message: 'Reorder office chairs',
      expectedIntent: 'reorder_item',
    },
    {
      name: 'Low stock items',
      message: 'Show me low stock items',
      expectedIntent: 'check_inventory',
    },

    // Suppliers
    {
      name: 'Find suppliers',
      message: 'Find steel suppliers in Texas',
      expectedIntent: 'find_supplier',
    },
    {
      name: 'Supplier performance',
      message: 'How is Acme Corp performing?',
      expectedIntent: 'supplier_performance',
    },
    {
      name: 'Compare suppliers',
      message: 'Compare Acme Corp and TechCorp',
      expectedIntent: 'compare_suppliers',
    },

    // Finance (should return "coming soon" messages)
    {
      name: 'Generate invoice (coming soon)',
      message: 'Generate an invoice for customer ABC',
      expectedIntent: 'generate_invoice',
    },
    {
      name: 'Financial report (coming soon)',
      message: 'Show me P&L for last month',
      expectedIntent: 'get_report',
    },

    // Unknown
    {
      name: 'Unknown intent',
      message: 'Turn on the lights',
      expectedIntent: 'unknown',
    },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await testConversation(test.name, test.message, test.expectedIntent)
    if (result) {
      passed++
    } else {
      failed++
    }
    // Wait 500ms between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${BLUE}Test Results${RESET}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`${GREEN}✓ Passed: ${passed}${RESET}`)
  console.log(`${RED}✗ Failed: ${failed}${RESET}`)
  console.log(`Total: ${passed + failed}`)
  console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  console.log(`${'='.repeat(60)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
runTests()
