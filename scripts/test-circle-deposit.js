#!/usr/bin/env node
/**
 * Circle Deposit Flow Test Script (JavaScript Version)
 * =====================================================
 *
 * Simple manual test for the Grain & Vault Circle deposit flow.
 *
 * Usage:
 *   node scripts/test-circle-deposit.js [options]
 *
 * Options:
 *   --cleanup       Clean up test data after running
 *   --verbose       Enable verbose logging
 *   --endpoint URL  Override the webhook endpoint (default: http://localhost:3000)
 *   --help          Show this help message
 *
 * Environment Variables:
 *   POSTGRES_URL              - Database connection string (required)
 *   CIRCLE_ENTITY_SECRET      - Circle webhook secret for HMAC signing
 *   TEST_WEBHOOK_ENDPOINT     - Webhook endpoint URL (optional)
 *
 * Example:
 *   POSTGRES_URL="postgres://..." node scripts/test-circle-deposit.js
 *   POSTGRES_URL="postgres://..." node scripts/test-circle-deposit.js --cleanup --verbose
 */

const crypto = require('crypto');
const { Pool } = require('pg');

// ============================================================================
// CONFIGURATION
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Circle Deposit Flow Test Script
================================

Usage:
  node scripts/test-circle-deposit.js [options]

Options:
  --cleanup       Clean up test data after running
  --verbose       Enable verbose logging
  --endpoint URL  Override the webhook endpoint (default: http://localhost:3000)
  --quick         Run only essential tests
  --help          Show this help message

Environment Variables:
  POSTGRES_URL              - Database connection string (required)
  CIRCLE_ENTITY_SECRET      - Circle webhook secret for HMAC signing
  TEST_WEBHOOK_ENDPOINT     - Webhook endpoint URL (optional)

Examples:
  POSTGRES_URL="postgres://..." node scripts/test-circle-deposit.js
  POSTGRES_URL="postgres://..." node scripts/test-circle-deposit.js --cleanup
  node scripts/test-circle-deposit.js --endpoint http://localhost:3000 --verbose
`);
    process.exit(0);
  }

  const endpointArg = args.find(a => a.startsWith('--endpoint='));

  return {
    cleanup: args.includes('--cleanup'),
    verbose: args.includes('--verbose'),
    quick: args.includes('--quick'),
    endpoint: endpointArg
      ? endpointArg.split('=')[1]
      : process.env.TEST_WEBHOOK_ENDPOINT || 'http://localhost:3000',
    dbUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
    circleSecret:
      process.env.CIRCLE_ENTITY_SECRET ||
      process.env.CIRCLE_WEBHOOK_SECRET ||
      'test-secret-for-local-development',
  };
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log();
  log('='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`  [PASS] ${message}`, 'green');
}

function logError(message) {
  log(`  [FAIL] ${message}`, 'red');
}

function logInfo(message) {
  log(`  [INFO] ${message}`, 'blue');
}

function logWarning(message) {
  log(`  [WARN] ${message}`, 'yellow');
}

// ============================================================================
// CIRCLE WEBHOOK UTILITIES
// ============================================================================

function generateNotificationId() {
  return `notif_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
}

function generatePaymentId() {
  return `pi_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
}

function generateWebhookPayload(options) {
  const notificationId = options.notificationId || generateNotificationId();
  const paymentId = options.paymentId || generatePaymentId();
  const eventType = options.eventType || 'payments.payment_intent.completed';

  return {
    notificationId,
    notificationType: eventType,
    notification: {
      Type: eventType,
      Id: paymentId,
      Timestamp: new Date().toISOString(),
      Data: {
        id: paymentId,
        status: options.status || 'complete',
        amount: {
          amount: options.amount.toFixed(2),
          currency: 'USD',
        },
        settlementAmount: {
          amount: options.amount.toFixed(2),
          currency: 'USD',
        },
        metadata: {
          userId: options.userId,
          accountId: options.userId,
          source: 'test-script',
        },
        source: {
          id: 'card_test_123',
          type: 'card',
        },
        destination: {
          id: 'wallet_master_001',
          type: 'wallet',
        },
        ...(options.errorCode && { errorCode: options.errorCode }),
        ...(options.errorMessage && { errorMessage: options.errorMessage }),
      },
    },
  };
}

function generateHmacSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

async function sendWebhook(endpoint, payload, secret) {
  const payloadString = JSON.stringify(payload);
  const signature = generateHmacSignature(payloadString, secret);

  const response = await fetch(`${endpoint}/api/webhooks/circle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-circle-signature': signature,
    },
    body: payloadString,
  });

  let body = {};
  try {
    body = await response.json();
  } catch (e) {
    // Ignore JSON parse errors
  }

  return {
    status: response.status,
    body,
  };
}

// ============================================================================
// DATABASE CLIENT
// ============================================================================

class DatabaseClient {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async query(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async close() {
    await this.pool.end();
  }

  async getUserWallet(userId) {
    const rows = await this.query(
      'SELECT * FROM user_wallets WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  }

  async createUserWallet(userId, initialBalance = 0) {
    const walletId = `test-wallet-${userId.substring(0, 8)}-${Date.now().toString(36)}`;
    const rows = await this.query(
      `INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
       VALUES ($1, $2, 'custodial', $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET balance = user_wallets.balance
       RETURNING *`,
      [userId, walletId, initialBalance]
    );
    return rows[0];
  }

  async getWebhookEvent(notificationId) {
    const rows = await this.query(
      'SELECT * FROM circle_webhook_events WHERE notification_id = $1',
      [notificationId]
    );
    return rows[0] || null;
  }

  async getTransaction(circleTransferId) {
    const rows = await this.query(
      'SELECT * FROM grain_transactions WHERE circle_transfer_id = $1',
      [circleTransferId]
    );
    return rows[0] || null;
  }

  async getTreasuryBacking(circleReferenceId) {
    const rows = await this.query(
      'SELECT * FROM treasury_backing WHERE circle_reference_id = $1',
      [circleReferenceId]
    );
    return rows[0] || null;
  }

  async getCurrentGrainPrice() {
    const rows = await this.query(
      'SELECT price_usd FROM grain_price_history ORDER BY recorded_at DESC LIMIT 1'
    );
    return rows.length > 0 ? parseFloat(rows[0].price_usd) : 1.0;
  }

  async cleanupTestData(userId, notificationIds) {
    // Delete webhook events
    for (const notifId of notificationIds) {
      await this.query('DELETE FROM circle_webhook_events WHERE notification_id = $1', [notifId]);
    }

    // Delete transactions for test user
    await this.query('DELETE FROM grain_transactions WHERE user_id = $1', [userId]);

    // Delete treasury backing for test entries
    await this.query(
      "DELETE FROM treasury_backing WHERE source LIKE 'circle_%' AND circle_reference_id LIKE 'pi_test%'"
    );

    // Delete user wallet
    await this.query('DELETE FROM user_wallets WHERE user_id = $1', [userId]);
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

class CircleDepositTests {
  constructor(config) {
    this.config = config;
    this.db = new DatabaseClient(config.dbUrl);
    this.testUserId = `test_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.createdNotificationIds = [];
    this.results = [];
  }

  addResult(result) {
    this.results.push(result);
    if (result.passed) {
      logSuccess(result.name);
    } else {
      logError(`${result.name}: ${result.error}`);
    }
    if (this.config.verbose && result.details) {
      logInfo(`Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  // Test 1: Create test user wallet
  async testCreateUserWallet() {
    logSection('Test 1: Create Test User Wallet');

    try {
      const wallet = await this.db.createUserWallet(this.testUserId, 0);

      if (wallet && wallet.user_id === this.testUserId) {
        this.addResult({
          name: 'Create user wallet',
          passed: true,
          details: { userId: this.testUserId, walletId: wallet.wallet_id },
        });
      } else {
        this.addResult({
          name: 'Create user wallet',
          passed: false,
          error: 'Failed to create wallet',
        });
      }
    } catch (error) {
      this.addResult({
        name: 'Create user wallet',
        passed: false,
        error: error.message,
      });
    }
  }

  // Test 2: Simulate successful deposit webhook
  async testSuccessfulDeposit() {
    logSection('Test 2: Simulate Successful $100 Deposit');

    const depositAmount = 100;
    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: depositAmount,
    });
    this.createdNotificationIds.push(payload.notificationId);

    try {
      // Get initial balance
      const initialWallet = await this.db.getUserWallet(this.testUserId);
      const initialBalance = initialWallet ? parseFloat(initialWallet.balance) : 0;

      // Get current GRAIN price
      const grainPrice = await this.db.getCurrentGrainPrice();
      const expectedGrainAmount = depositAmount / grainPrice;

      logInfo(`Initial balance: ${initialBalance} GRAIN`);
      logInfo(`Current GRAIN price: $${grainPrice}`);
      logInfo(`Expected GRAIN for $${depositAmount}: ${expectedGrainAmount.toFixed(6)}`);

      // Send webhook
      const response = await sendWebhook(this.config.endpoint, payload, this.config.circleSecret);

      // Check response status
      if (response.status === 200) {
        this.addResult({
          name: 'Webhook returns 200 OK',
          passed: true,
          details: response.body,
        });
      } else {
        this.addResult({
          name: 'Webhook returns 200 OK',
          passed: false,
          error: `Got status ${response.status}: ${JSON.stringify(response.body)}`,
        });
        return;
      }

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify webhook event was recorded
      const webhookEvent = await this.db.getWebhookEvent(payload.notificationId);
      this.addResult({
        name: 'Webhook event recorded in circle_webhook_events',
        passed: !!(webhookEvent && webhookEvent.processed),
        error: webhookEvent ? undefined : 'Event not found',
        details: webhookEvent ? { processed: webhookEvent.processed } : undefined,
      });

      // Verify transaction was recorded
      const paymentId = payload.notification.Id;
      const transaction = await this.db.getTransaction(paymentId);
      this.addResult({
        name: 'Transaction recorded in grain_transactions',
        passed: !!(transaction && transaction.status === 'completed'),
        error: transaction ? undefined : 'Transaction not found',
        details: transaction ? { status: transaction.status, type: transaction.type } : undefined,
      });

      // Verify user wallet balance was updated
      const updatedWallet = await this.db.getUserWallet(this.testUserId);
      if (updatedWallet) {
        const newBalance = parseFloat(updatedWallet.balance);
        const balanceDiff = Math.abs(newBalance - initialBalance - expectedGrainAmount);

        this.addResult({
          name: 'User wallet balance updated correctly',
          passed: balanceDiff < 0.01,
          error: balanceDiff >= 0.01 ? `Expected ~${expectedGrainAmount.toFixed(6)} increase, got ${(newBalance - initialBalance).toFixed(6)}` : undefined,
          details: { previousBalance: initialBalance, newBalance, expectedIncrease: expectedGrainAmount },
        });
      } else {
        this.addResult({
          name: 'User wallet balance updated correctly',
          passed: false,
          error: 'User wallet not found',
        });
      }

      // Verify treasury backing
      const treasuryBacking = await this.db.getTreasuryBacking(paymentId);
      this.addResult({
        name: 'Treasury backing recorded',
        passed: !!treasuryBacking,
        error: treasuryBacking ? undefined : 'Treasury backing not found',
        details: treasuryBacking ? { amount: treasuryBacking.amount, assetType: treasuryBacking.asset_type } : undefined,
      });

    } catch (error) {
      this.addResult({
        name: 'Successful deposit test',
        passed: false,
        error: error.message,
      });
    }
  }

  // Test 3: Idempotency test
  async testIdempotency() {
    logSection('Test 3: Idempotency - Duplicate Webhook');

    const notificationId = `idempotency_test_${Date.now()}`;
    this.createdNotificationIds.push(notificationId);

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 50,
      notificationId,
    });

    try {
      // Get balance before
      const walletBefore = await this.db.getUserWallet(this.testUserId);
      const balanceBefore = walletBefore ? parseFloat(walletBefore.balance) : 0;

      // Send first webhook
      const response1 = await sendWebhook(this.config.endpoint, payload, this.config.circleSecret);
      this.addResult({ name: 'First webhook succeeds', passed: response1.status === 200 });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get balance after first webhook
      const walletAfter1 = await this.db.getUserWallet(this.testUserId);
      const balanceAfter1 = walletAfter1 ? parseFloat(walletAfter1.balance) : 0;

      // Send same webhook again
      const response2 = await sendWebhook(this.config.endpoint, payload, this.config.circleSecret);

      this.addResult({
        name: 'Duplicate webhook returns already_processed',
        passed: response2.status === 200 && response2.body.status === 'already_processed',
        error: response2.body.status !== 'already_processed' ? `Got status: ${response2.body.status}` : undefined,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify balance unchanged
      const walletAfter2 = await this.db.getUserWallet(this.testUserId);
      const balanceAfter2 = walletAfter2 ? parseFloat(walletAfter2.balance) : 0;

      this.addResult({
        name: 'Balance unchanged after duplicate',
        passed: Math.abs(balanceAfter2 - balanceAfter1) < 0.001,
        error: Math.abs(balanceAfter2 - balanceAfter1) >= 0.001 ? `Balance changed from ${balanceAfter1} to ${balanceAfter2}` : undefined,
      });

    } catch (error) {
      this.addResult({
        name: 'Idempotency test',
        passed: false,
        error: error.message,
      });
    }
  }

  // Test 4: Invalid signature
  async testInvalidSignature() {
    logSection('Test 4: Invalid Signature Handling');

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 25,
    });

    try {
      const response = await fetch(`${this.config.endpoint}/api/webhooks/circle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-circle-signature': 'invalid_signature_12345',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      this.addResult({
        name: 'Invalid signature returns 400',
        passed: response.status === 400,
        error: response.status !== 400 ? `Got status ${response.status}` : undefined,
      });

    } catch (error) {
      this.addResult({
        name: 'Invalid signature test',
        passed: false,
        error: error.message,
      });
    }
  }

  // Test 5: Health check
  async testHealthCheck() {
    logSection('Test 5: Webhook Health Check');

    try {
      const response = await fetch(`${this.config.endpoint}/api/webhooks/circle`, {
        method: 'GET',
      });

      const body = await response.json().catch(() => ({}));

      this.addResult({
        name: 'Health check returns active status',
        passed: response.status === 200 && body.status === 'active',
        error: body.status !== 'active' ? `Got status: ${body.status}` : undefined,
        details: body,
      });

    } catch (error) {
      this.addResult({
        name: 'Health check test',
        passed: false,
        error: error.message,
      });
    }
  }

  // Cleanup test data
  async cleanup() {
    logSection('Cleanup');

    try {
      await this.db.cleanupTestData(this.testUserId, this.createdNotificationIds);
      logSuccess('Test data cleaned up successfully');
    } catch (error) {
      logWarning(`Cleanup failed: ${error.message}`);
    }
  }

  // Print summary
  printSummary() {
    logSection('TEST SUMMARY');

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;

    console.log();
    log(`  Total Tests: ${total}`, 'bright');
    log(`  Passed:      ${passed}`, 'green');
    log(`  Failed:      ${failed}`, failed > 0 ? 'red' : 'green');
    console.log();

    if (failed > 0) {
      log('  Failed Tests:', 'red');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          log(`    - ${r.name}: ${r.error}`, 'red');
        });
      console.log();
    }

    const successRate = ((passed / total) * 100).toFixed(1);
    if (failed === 0) {
      log(`  ALL TESTS PASSED (${successRate}% success rate)`, 'green');
    } else {
      log(`  ${successRate}% success rate`, 'yellow');
    }

    console.log();
    log('='.repeat(60), 'cyan');
    console.log();

    return failed === 0;
  }

  // Run all tests
  async runAll() {
    console.log();
    log('=========================================================', 'cyan');
    log('  CIRCLE DEPOSIT FLOW - END-TO-END TEST SUITE', 'bright');
    log('=========================================================', 'cyan');
    console.log();
    logInfo(`Test User ID: ${this.testUserId}`);
    logInfo(`Webhook Endpoint: ${this.config.endpoint}`);
    logInfo(`Cleanup Mode: ${this.config.cleanup ? 'Yes' : 'No'}`);

    try {
      await this.testCreateUserWallet();
      await this.testSuccessfulDeposit();
      await this.testIdempotency();
      await this.testInvalidSignature();
      await this.testHealthCheck();

      if (this.config.cleanup) {
        await this.cleanup();
      }
    } finally {
      await this.db.close();
    }

    const success = this.printSummary();
    process.exit(success ? 0 : 1);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const config = parseArgs();

  // Validate config
  if (!config.dbUrl) {
    log('', 'reset');
    log('ERROR: POSTGRES_URL or DATABASE_URL environment variable is required', 'red');
    log('', 'reset');
    log('Usage:', 'yellow');
    log('  POSTGRES_URL="postgres://..." node scripts/test-circle-deposit.js', 'dim');
    log('', 'reset');
    log('Run with --help for more information', 'dim');
    process.exit(1);
  }

  if (!config.circleSecret || config.circleSecret === 'test-secret-for-local-development') {
    logWarning('CIRCLE_ENTITY_SECRET not set, using default test secret');
  }

  const tests = new CircleDepositTests(config);
  await tests.runAll();
}

main().catch((error) => {
  log(`FATAL ERROR: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
