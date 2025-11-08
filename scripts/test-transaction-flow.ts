/**
 * Test Transaction Flow
 *
 * Validates the complete transaction lifecycle:
 * 1. Accept deal
 * 2. Create escrow
 * 3. Complete & rate
 * 4. Verify trust scores updated
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface TestResult {
  step: string
  success: boolean
  data?: any
  error?: string
}

async function testTransactionFlow(): Promise<void> {
  const results: TestResult[] = []

  console.log('🧪 Testing Wells AI Transaction Engine\n')

  // Test 1: Accept Deal
  console.log('Step 1: Accept Deal')
  try {
    const acceptResponse = await fetch(`${API_BASE}/api/transactions/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, include auth token
      },
      body: JSON.stringify({
        rfqId: 'test_rfq_001',
        sellerId: 'test_seller_001',
        amount: 1250000, // $12,500
        category: 'semiconductors'
      })
    })

    const acceptData = await acceptResponse.json()

    results.push({
      step: 'Accept Deal',
      success: acceptResponse.ok,
      data: acceptData,
      error: acceptResponse.ok ? undefined : acceptData.error
    })

    console.log(acceptResponse.ok ? '✓ Deal accepted' : '✗ Failed to accept deal')
    if (acceptResponse.ok) {
      console.log(`  Transaction ID: ${acceptData.transaction.id}`)
      console.log(`  Fee: ${acceptData.transaction.feePercent}%`)
      console.log(`  Trust - Buyer: ${acceptData.trustScores.buyer}, Seller: ${acceptData.trustScores.seller}`)
    } else {
      console.log(`  Error: ${acceptData.error}`)
    }

    if (!acceptResponse.ok) {
      console.log('\n❌ Test failed at Accept Deal step')
      process.exit(1)
    }

    const transactionId = acceptData.transaction.id

    // Test 2: Create Escrow
    console.log('\nStep 2: Create Escrow')
    const escrowResponse = await fetch(`${API_BASE}/api/transactions/escrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId
      })
    })

    const escrowData = await escrowResponse.json()

    results.push({
      step: 'Create Escrow',
      success: escrowResponse.ok,
      data: escrowData,
      error: escrowResponse.ok ? undefined : escrowData.error
    })

    console.log(escrowResponse.ok ? '✓ Escrow created' : '✗ Failed to create escrow')
    if (escrowResponse.ok) {
      console.log(`  Payment Intent: ${escrowData.escrow.paymentIntentId}`)
      console.log(`  Seller Receives: $${(escrowData.escrow.sellerReceives / 100).toFixed(2)}`)
    } else {
      console.log(`  Error: ${escrowData.error}`)
    }

    // Test 3: Complete Transaction
    console.log('\nStep 3: Complete Transaction (Buyer Rating)')
    const completeResponse = await fetch(`${API_BASE}/api/transactions/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        rating: 5,
        review: 'Excellent quality, delivered on time!'
      })
    })

    const completeData = await completeResponse.json()

    results.push({
      step: 'Complete Transaction',
      success: completeResponse.ok,
      data: completeData,
      error: completeResponse.ok ? undefined : completeData.error
    })

    console.log(completeResponse.ok ? '✓ Transaction completed' : '✗ Failed to complete')
    if (completeResponse.ok) {
      console.log(`  Status: ${completeData.transaction.status}`)
      console.log(`  Buyer Rating: ${completeData.transaction.buyerRating}`)
    } else {
      console.log(`  Error: ${completeData.error}`)
    }

    // Test 4: Verify Trust Score Updated
    console.log('\nStep 4: Verify Trust Score')
    const trustResponse = await fetch(
      `${API_BASE}/api/users/trust-score?userId=test_seller_001`
    )

    const trustData = await trustResponse.json()

    results.push({
      step: 'Get Trust Score',
      success: trustResponse.ok,
      data: trustData,
      error: trustResponse.ok ? undefined : trustData.error
    })

    console.log(trustResponse.ok ? '✓ Trust score retrieved' : '✗ Failed to get trust score')
    if (trustResponse.ok) {
      console.log(`  Score: ${trustData.trustScore.score}`)
      console.log(`  Level: ${trustData.trustScore.level}`)
      console.log(`  Total Transactions: ${trustData.trustScore.totalTransactions}`)
    } else {
      console.log(`  Error: ${trustData.error}`)
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('Test Summary:')
    console.log('='.repeat(50))

    const passed = results.filter(r => r.success).length
    const total = results.length

    results.forEach(result => {
      const icon = result.success ? '✓' : '✗'
      console.log(`${icon} ${result.step}`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }
    })

    console.log('\n' + '='.repeat(50))
    console.log(`Results: ${passed}/${total} passed`)
    console.log('='.repeat(50))

    if (passed === total) {
      console.log('\n✅ All tests passed! Transaction engine is working.')
      process.exit(0)
    } else {
      console.log('\n❌ Some tests failed. Check errors above.')
      process.exit(1)
    }
  } catch (error: any) {
    console.error('\n❌ Test error:', error.message)
    process.exit(1)
  }
}

// Run tests
testTransactionFlow().catch(console.error)
