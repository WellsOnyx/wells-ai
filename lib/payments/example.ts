/**
 * PAYMENT RAILS EXAMPLES
 *
 * Complete examples of how to use the Wells AI payment system.
 * Copy and adapt these for your use case.
 */

import PaymentService from './service';
import * as Circle from './circle';
import * as Stripe from './stripe';

// ============================================================================
// EXAMPLE 1: USER DEPOSITS $500 VIA CARD
// ============================================================================

export async function example_CardDeposit(userId: string) {
  console.log('=== CARD DEPOSIT EXAMPLE ===\n');

  // 1. Create payment intent
  console.log('Creating $500 deposit intent...');
  const intent = await PaymentService.deposit({
    userId,
    amount: 50000, // $500 in cents
    method: 'card',
  });

  console.log('Payment intent created:', {
    paymentIntentId: intent.paymentIntentId,
    amount: `$${intent.amount / 100}`,
    method: intent.method,
  });

  // 2. Frontend uses clientSecret with Stripe Elements
  console.log('\nFrontend: User completes payment with Stripe Elements');
  console.log('Client Secret:', intent.clientSecret);

  // 3. Webhook confirms payment
  console.log('\nWebhook: Payment confirmed');

  // 4. Check new balance
  const balance = await PaymentService.getBalance(userId);
  console.log('\nNew balance:', {
    available: `$${balance.usdc.available}`,
    pending: `$${balance.usdc.pending}`,
  });

  console.log('\n✓ User now has 500 USDC and can make payments\n');
}

// ============================================================================
// EXAMPLE 2: USER SENDS $200 USDC PAYMENT
// ============================================================================

export async function example_SendPayment(userId: string) {
  console.log('=== SEND PAYMENT EXAMPLE ===\n');

  // 1. Check balance
  const balance = await PaymentService.getBalance(userId);
  console.log('Current balance:', `$${balance.usdc.available} USDC`);

  if (balance.usdc.available < 200) {
    console.log('\n✗ Insufficient balance for $200 payment');
    return;
  }

  // 2. Send payment
  console.log('\nSending $200 USDC payment...');
  const payment = await PaymentService.createPayment({
    fromUserId: userId,
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Recipient's Circle address
    amount: 200,
    method: 'usdc',
    metadata: {
      paymentType: 'viral_payment',
      sourceId: 'invoice-123',
      description: 'Invoice payment for services',
    },
  });

  console.log('Payment sent:', {
    paymentId: payment.paymentId,
    status: payment.status,
    transactionHash: payment.transactionHash,
    floatPositionId: payment.floatPositionId,
  });

  // 3. Track float
  console.log('\n✓ Payment creating float for 3-day settlement window');
  console.log('Float will be deployed to vault for yield generation');
  console.log('User will earn ~20% of yield from this payment\n');
}

// ============================================================================
// EXAMPLE 3: CHECK FLOAT EARNINGS
// ============================================================================

export async function example_CheckFloatEarnings(userId: string) {
  console.log('=== FLOAT EARNINGS EXAMPLE ===\n');

  const metrics = await PaymentService.getUserFloatMetrics(userId);

  console.log('Float Metrics:');
  console.log('─────────────────────────────────────');
  console.log(`Active Float Positions: ${metrics.activeFloatPositions}`);
  console.log(`Total Float Amount:     $${metrics.totalFloatAmount.toFixed(2)}`);
  console.log(`Total Yield Earned:     $${metrics.totalYieldEarned.toFixed(2)}`);
  console.log(`Pending Yield:          $${metrics.pendingYield.toFixed(2)}`);
  console.log(`Current APY:            ${(metrics.currentAPY * 100).toFixed(1)}%`);
  console.log(`Est. Monthly Yield:     $${metrics.estimatedMonthlyYield.toFixed(2)}`);
  console.log('─────────────────────────────────────\n');

  console.log('💡 Earnings Breakdown:');
  console.log('- 50% goes to Wells (platform revenue)');
  console.log('- 30% goes to GRAIN token appreciation');
  console.log('- 20% goes to you (passive income)');
  console.log('\n');
}

// ============================================================================
// EXAMPLE 4: WITHDRAW TO BANK
// ============================================================================

export async function example_WithdrawToBank(userId: string) {
  console.log('=== WITHDRAW TO BANK EXAMPLE ===\n');

  // 1. Check if bank account is set up
  console.log('Checking bank account setup...');

  // If not set up, create connected account
  // const { onboardingUrl } = await PaymentService.setupBankAccount(
  //   userId,
  //   'user@example.com'
  // );
  // console.log('Complete onboarding at:', onboardingUrl);

  // 2. Check balance
  const balance = await PaymentService.getBalance(userId);
  console.log('Current balance:', `$${balance.usdc.available} USDC`);

  // 3. Create withdrawal
  console.log('\nWithdrawing $300 to bank account...');
  const payout = await PaymentService.withdraw({
    userId,
    amount: 300,
    destination: 'bank',
  });

  console.log('Withdrawal created:', {
    payoutId: payout.payoutId,
    amount: `$${payout.amount / 100}`,
    arrivalDate: payout.arrivalDate,
    status: payout.status,
  });

  console.log('\n✓ Funds will arrive in bank account in 1-2 business days\n');
}

// ============================================================================
// EXAMPLE 5: COMPLETE PAYMENT FLOW
// ============================================================================

export async function example_CompleteFlow(userId: string) {
  console.log('=== COMPLETE PAYMENT FLOW ===\n');

  // Step 1: Deposit
  console.log('Step 1: User deposits $1,000 via card');
  await example_CardDeposit(userId);
  await sleep(1000);

  // Step 2: Check balance
  console.log('Step 2: Check balance');
  let balance = await PaymentService.getBalance(userId);
  console.log(`Balance: $${balance.usdc.available} USDC\n`);
  await sleep(1000);

  // Step 3: Make payment
  console.log('Step 3: Send $400 payment');
  await example_SendPayment(userId);
  await sleep(1000);

  // Step 4: Check balance again
  console.log('Step 4: Check balance after payment');
  balance = await PaymentService.getBalance(userId);
  console.log(`Balance: $${balance.usdc.available} USDC\n`);
  await sleep(1000);

  // Step 5: Check float earnings
  console.log('Step 5: Check float earnings');
  await example_CheckFloatEarnings(userId);
  await sleep(1000);

  // Step 6: Withdraw
  console.log('Step 6: Withdraw remaining balance');
  await example_WithdrawToBank(userId);

  console.log('\n✓ Complete flow finished!\n');
}

// ============================================================================
// EXAMPLE 6: PAYMENT HISTORY
// ============================================================================

export async function example_PaymentHistory(userId: string) {
  console.log('=== PAYMENT HISTORY EXAMPLE ===\n');

  const history = await PaymentService.getPaymentHistory(userId, 20);

  console.log(`Found ${history.length} transactions:\n`);

  history.forEach((tx, i) => {
    const typeEmoji = {
      deposit: '💳',
      payment: '→',
      withdrawal: '🏦',
      reward: '🎁',
    }[tx.type] || '•';

    console.log(
      `${typeEmoji} ${tx.type.toUpperCase()}: $${tx.amount.toFixed(2)} ${tx.currency} - ${tx.status}`
    );
    if (tx.description) {
      console.log(`  ${tx.description}`);
    }
    console.log(`  ${new Date(tx.createdAt).toLocaleString()}\n`);
  });
}

// ============================================================================
// EXAMPLE 7: REAL-TIME BALANCE UPDATES
// ============================================================================

export async function example_BalanceUpdates(userId: string) {
  console.log('=== REAL-TIME BALANCE UPDATES ===\n');

  // Get initial balance
  let balance = await PaymentService.getBalance(userId);
  console.log('Initial Balance:', {
    usdc: `$${balance.usdc.available}`,
    pendingDeposits: `$${balance.usdc.pending}`,
    totalEarned: `$${balance.yield.earned}`,
  });

  // Simulate balance changes
  console.log('\n📊 Watching for balance changes...\n');

  // In production, you'd use webhooks or polling
  setInterval(async () => {
    const newBalance = await PaymentService.getBalance(userId);

    if (newBalance.usdc.available !== balance.usdc.available) {
      console.log('💰 Balance changed!', {
        previous: `$${balance.usdc.available}`,
        current: `$${newBalance.usdc.available}`,
        change: `$${(newBalance.usdc.available - balance.usdc.available).toFixed(2)}`,
      });
      balance = newBalance;
    }

    if (newBalance.yield.earned !== balance.yield.earned) {
      console.log('🎁 Yield earned!', {
        amount: `$${(newBalance.yield.earned - balance.yield.earned).toFixed(2)}`,
        total: `$${newBalance.yield.earned}`,
      });
      balance = newBalance;
    }
  }, 5000); // Check every 5 seconds
}

// ============================================================================
// EXAMPLE 8: ACH DEPOSIT (LARGER AMOUNTS)
// ============================================================================

export async function example_ACHDeposit(userId: string) {
  console.log('=== ACH DEPOSIT EXAMPLE ===\n');

  console.log('Creating $10,000 ACH deposit...');
  const intent = await PaymentService.deposit({
    userId,
    amount: 1000000, // $10,000 in cents
    method: 'ach',
  });

  console.log('ACH deposit created:', {
    paymentIntentId: intent.paymentIntentId,
    amount: `$${intent.amount / 100}`,
    method: intent.method,
  });

  console.log('\n📝 ACH Details:');
  console.log('- Settlement time: 1-3 business days');
  console.log('- Lower fees than card (0.8% vs 2.9%)');
  console.log('- Recommended for deposits > $1,000');
  console.log('\n✓ Funds will be available after settlement\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RUN EXAMPLES
// ============================================================================

/**
 * Run all examples (for testing)
 */
export async function runAllExamples() {
  const testUserId = 'test-user-123';

  try {
    await example_CompleteFlow(testUserId);
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Uncomment to run examples:
// runAllExamples();

export default {
  example_CardDeposit,
  example_SendPayment,
  example_CheckFloatEarnings,
  example_WithdrawToBank,
  example_CompleteFlow,
  example_PaymentHistory,
  example_BalanceUpdates,
  example_ACHDeposit,
};
