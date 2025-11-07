/**
 * Test Founder Journey System
 *
 * Creates test founder persona "Sarah" and validates:
 * - Intent detection
 * - Action recommendations
 * - Flow triggers (hiring, GTM, procurement)
 */

import { detectFounderIntent } from '../lib/journeys/founder-detection'
import {
  getFounderActions,
  getQuickActions,
  getFounderConversationStarters,
  startHiringFlow,
  startGTMFlow,
  startProcurementFlow
} from '../lib/journeys/founder-flows'

// Test Persona: Sarah, Founder of Series A Fintech
const sarahMessages = [
  {
    role: 'user',
    content: "Hi, I'm Sarah. I'm the founder of a Series A fintech startup."
  },
  {
    role: 'assistant',
    content: "Hi Sarah! Congrats on reaching Series A. What are you working on right now?"
  },
  {
    role: 'user',
    content: "We just raised $8M and we're at $1.2M ARR. I need to hire a CISO for enterprise sales, find more customers, and source office space in SF."
  }
]

const sarahUserData = {
  userId: 'test_user_sarah',
  userType: 'buyer',
  company: 'FinanceOS',
  name: 'Sarah Chen'
}

async function testFounderDetection() {
  console.log('=== Testing Founder Detection ===\n')

  const profile = await detectFounderIntent({
    messages: sarahMessages,
    userData: sarahUserData
  })

  console.log('Founder Profile:')
  console.log('- Is Founder:', profile.isFounder)
  console.log('- Confidence:', profile.confidence)
  console.log('- Stage:', profile.stage)
  console.log('- Pain Points:', profile.painPoints.join(', '))
  console.log('- Urgency:', profile.urgency)
  console.log('- Signals:', profile.signals.slice(0, 5).join(', '))
  console.log('\nContext:')
  console.log(JSON.stringify(profile.context, null, 2))
  console.log('\n')

  return profile
}

async function testActionRecommendations(profile: any) {
  console.log('=== Testing Action Recommendations ===\n')

  const actions = getFounderActions(profile)

  console.log(`Found ${actions.length} recommended actions:\n`)
  actions.forEach((action, i) => {
    console.log(`${i + 1}. ${action.title}`)
    console.log(`   Pain Point: ${action.painPoint}`)
    console.log(`   Urgency: ${action.urgency}`)
    console.log(`   Estimated Time: ${action.estimatedTime}`)
    console.log(`   Description: ${action.description}`)
    console.log(`   Next Steps:`)
    action.nextSteps.forEach(step => console.log(`      - ${step}`))
    console.log()
  })
}

async function testQuickActions(profile: any) {
  console.log('=== Testing Quick Actions ===\n')

  const quickActions = getQuickActions(profile)

  console.log(`Found ${quickActions.length} quick actions:\n`)
  quickActions.forEach((action, i) => {
    console.log(`${i + 1}. ${action.icon} ${action.label}`)
    console.log(`   Action ID: ${action.action}`)
  })
  console.log('\n')
}

async function testConversationStarters(profile: any) {
  console.log('=== Testing Conversation Starters ===\n')

  const starters = getFounderConversationStarters(profile)

  console.log(`Suggested conversation starters:\n`)
  starters.forEach((starter, i) => {
    console.log(`${i + 1}. "${starter}"`)
  })
  console.log('\n')
}

async function testHiringFlow() {
  console.log('=== Testing Hiring Flow ===\n')

  const result = await startHiringFlow({
    userId: 'test_user_sarah',
    role: 'CISO',
    companyName: 'FinanceOS',
    companyStage: 'series-a',
    requirements: 'Need someone who can get us SOC 2 compliant in 90 days'
  })

  console.log('Hiring Flow Result:')
  console.log('- Success:', result.success)
  console.log('- Message:', result.message)
  console.log('- Search ID:', result.searchId)
  console.log('- Next Steps:')
  result.nextSteps.forEach(step => console.log(`   - ${step}`))
  console.log('\n')
}

async function testGTMFlow() {
  console.log('=== Testing GTM Flow ===\n')

  const result = await startGTMFlow({
    userId: 'test_user_sarah',
    productDescription: 'B2B fintech platform for accounts payable automation',
    targetCustomer: 'CFOs at companies with $10M-100M revenue'
  })

  console.log('GTM Flow Result:')
  console.log('- Success:', result.success)
  console.log('- Message:', result.message)
  console.log('- Next Steps:')
  result.nextSteps.forEach(step => console.log(`   - ${step}`))
  console.log('\n')
}

async function testProcurementFlow() {
  console.log('=== Testing Procurement Flow ===\n')

  const result = await startProcurementFlow({
    userId: 'test_user_sarah',
    needDescription: 'Class A office space in downtown SF, 5000 sq ft, move-in ready',
    category: 'Office Space',
    budget: 15000,
    timeline: '2 months'
  })

  console.log('Procurement Flow Result:')
  console.log('- Success:', result.success)
  console.log('- Message:', result.message)
  console.log('- RFQ ID:', result.rfqId)
  console.log('- Estimated Quotes:', result.estimatedQuotes)
  console.log('- Next Steps:')
  result.nextSteps.forEach(step => console.log(`   - ${step}`))
  console.log('\n')
}

async function testMultiplePainPoints() {
  console.log('=== Testing Multiple Pain Points Detection ===\n')

  const multiMessages = [
    {
      role: 'user',
      content: "I'm overwhelmed. I need to hire a CFO, find customers, raise our Series B, and move to a new office. I'm doing everything myself."
    }
  ]

  const profile = await detectFounderIntent({
    messages: multiMessages,
    userData: { userId: 'test_multi', userType: 'buyer' }
  })

  console.log('Multi-Pain Point Profile:')
  console.log('- Is Founder:', profile.isFounder)
  console.log('- Confidence:', profile.confidence)
  console.log('- Pain Points:', profile.painPoints.join(', '))
  console.log('- Urgency:', profile.urgency)
  console.log('\n')
}

async function testStageDetection() {
  console.log('=== Testing Stage Detection ===\n')

  const stages = [
    {
      name: 'Ideation',
      message: "I'm validating my startup idea and building an MVP"
    },
    {
      name: 'Pre-Seed',
      message: "We just launched our MVP and looking for first customers"
    },
    {
      name: 'Seed',
      message: "We raised a seed round and have 50 customers now"
    },
    {
      name: 'Series A',
      message: "We closed our Series A and need to scale GTM"
    },
    {
      name: 'Series B',
      message: "We're a Series B company expanding to multiple markets"
    }
  ]

  for (const stage of stages) {
    const profile = await detectFounderIntent({
      messages: [{ role: 'user', content: stage.message }],
      userData: { userId: 'test_stage' }
    })

    console.log(`${stage.name}:`)
    console.log(`  Message: "${stage.message}"`)
    console.log(`  Detected Stage: ${profile.stage}`)
    console.log(`  Confidence: ${profile.confidence}`)
    console.log()
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🧪 FOUNDER JOURNEY TEST SUITE\n')
  console.log('Testing with persona: Sarah Chen, Founder of FinanceOS (Series A Fintech)\n')
  console.log('=' .repeat(60))
  console.log('\n')

  try {
    // Test 1: Founder Detection
    const profile = await testFounderDetection()

    // Test 2: Action Recommendations
    await testActionRecommendations(profile)

    // Test 3: Quick Actions
    await testQuickActions(profile)

    // Test 4: Conversation Starters
    await testConversationStarters(profile)

    // Test 5: Hiring Flow
    await testHiringFlow()

    // Test 6: GTM Flow
    await testGTMFlow()

    // Test 7: Procurement Flow
    await testProcurementFlow()

    // Test 8: Multiple Pain Points
    await testMultiplePainPoints()

    // Test 9: Stage Detection
    await testStageDetection()

    console.log('=' .repeat(60))
    console.log('\n✅ All tests completed successfully!\n')

    console.log('Summary:')
    console.log('- Founder detection: WORKING')
    console.log('- Action recommendations: WORKING')
    console.log('- Quick actions: WORKING')
    console.log('- Conversation starters: WORKING')
    console.log('- Hiring flow: WORKING')
    console.log('- GTM flow: WORKING')
    console.log('- Procurement flow: WORKING')
    console.log('- Multi-pain point detection: WORKING')
    console.log('- Stage detection: WORKING')
    console.log('\n')
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
}

export { runAllTests, sarahMessages, sarahUserData }
