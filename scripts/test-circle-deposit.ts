#!/usr/bin/env npx tsx
/**
 * Circle Deposit Flow Test Script
 * ================================
 *
 * Comprehensive end-to-end test for the Grain & Vault Circle deposit flow:
 *
 * 1. User initiates deposit via /api/grain-vault/deposit (POST)
 * 2. User completes payment through Circle checkout
 * 3. Circle sends webhook to /api/webhooks/circle
 * 4. Webhook updates user's GRAIN balance in user_wallets table
 * 5. Transaction is recorded in grain_transactions table
 *
 * Usage:
 *   npx tsx scripts/test-circle-deposit.ts [options]
 *
 * Options:
 *   --cleanup       Clean up test data after running
 *   --verbose       Enable verbose logging
 *   --endpoint URL  Override the webhook endpoint (default: http://localhost:3000)
 *
 * Environment Variables:
 *   POSTGRES_URL              - Database connection string (required)
 *   CIRCLE_ENTITY_SECRET      - Circle webhook secret for HMAC signing (required)
 *   TEST_WEBHOOK_ENDPOINT     - Webhook endpoint URL (optional)
 */

import * as crypto from 'crypto'
import { Pool } from 'pg'

// ============================================================================
// CONFIGURATION
// ============================================================================

interface TestConfig {
  cleanup: boolean
  verbose: boolean
  endpoint: string
  dbUrl: string
  circleSecret: string
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2)

  return {
    cleanup: args.includes('--cleanup'),
    verbose: args.includes('--verbose'),
    endpoint:
      args.find((a) => a.startsWith('--endpoint='))?.split('=')[1] ||
      process.env.TEST_WEBHOOK_ENDPOINT ||
      'http://localhost:3000',
    dbUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
    circleSecret:
      process.env.CIRCLE_ENTITY_SECRET ||
      process.env.CIRCLE_WEBHOOK_SECRET ||
      'test-secret-for-local-development',
  }
}

// ============================================================================
// TEST UTILITIES
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
}

function log(message: string, color: keyof typeof COLORS = 'reset'): void {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function logSection(title: string): void {
  console.log()
  log('='.repeat(60), 'cyan')
  log(`  ${title}`, 'bright')
  log('='.repeat(60), 'cyan')
}

function logSuccess(message: string): void {
  log(`  [PASS] ${message}`, 'green')
}

function logError(message: string): void {
  log(`  [FAIL] ${message}`, 'red')
}

function logInfo(message: string): void {
  log(`  [INFO] ${message}`, 'blue')
}

function logWarning(message: string): void {
  log(`  [WARN] ${message}`, 'yellow')
}

// ============================================================================
// CIRCLE WEBHOOK PAYLOAD GENERATOR
// ============================================================================

interface CircleWebhookPayload {
  notificationId: string
  notificationType: string
  notification: {
    Type: string
    Id: string
    Timestamp: string
    Data: {
      id: string
      status: string
      amount?: { amount: string; currency: string }
      settlementAmount?: { amount: string; currency: string }
      metadata?: Record<string, string>
      source?: { id: string; type: string }
      destination?: { id: string; type: string }
      errorCode?: string
      errorMessage?: string
    }
  }
}

function generateNotificationId(): string {
  return `notif_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`
}

function generatePaymentId(): string {
  return `pi_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`
}

function generateWebhookPayload(options: {
  userId: string
  amount: number
  eventType?: string
  status?: string
  notificationId?: string
  paymentId?: string
}): CircleWebhookPayload {
  const notificationId = options.notificationId || generateNotificationId()
  const paymentId = options.paymentId || generatePaymentId()
  const eventType = options.eventType || 'payments.payment_intent.completed'

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
      },
    },
  }
}

function generateHmacSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

class DatabaseClient {
  private pool: Pool

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params)
    return result.rows
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  // User wallet operations
  async getUserWallet(userId: string): Promise<any | null> {
    const rows = await this.query(
      'SELECT * FROM user_wallets WHERE user_id = $1',
      [userId]
    )
    return rows[0] || null
  }

  async createUserWallet(
    userId: string,
    initialBalance: number = 0
  ): Promise<any> {
    const walletId = `test-wallet-${userId.substring(0, 8)}-${Date.now()
      .toString(36)}`
    const rows = await this.query(
      `INSERT INTO user_wallets (user_id, wallet_id, wallet_address, balance, created_at, updated_at)
       VALUES ($1, $2, 'custodial', $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET balance = user_wallets.balance
       RETURNING *`,
      [userId, walletId, initialBalance]
    )
    return rows[0]
  }

  async deleteUserWallet(userId: string): Promise<void> {
    await this.query('DELETE FROM user_wallets WHERE user_id = $1', [userId])
  }

  // Webhook event operations
  async getWebhookEvent(notificationId: string): Promise<any | null> {
    const rows = await this.query(
      'SELECT * FROM circle_webhook_events WHERE notification_id = $1',
      [notificationId]
    )
    return rows[0] || null
  }

  async deleteWebhookEvent(notificationId: string): Promise<void> {
    await this.query(
      'DELETE FROM circle_webhook_events WHERE notification_id = $1',
      [notificationId]
    )
  }

  // Transaction operations
  async getTransaction(circleTransferId: string): Promise<any | null> {
    const rows = await this.query(
      'SELECT * FROM grain_transactions WHERE circle_transfer_id = $1',
      [circleTransferId]
    )
    return rows[0] || null
  }

  async getTransactionsByUser(userId: string): Promise<any[]> {
    return this.query(
      'SELECT * FROM grain_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
  }

  async deleteTransaction(circleTransferId: string): Promise<void> {
    await this.query(
      'DELETE FROM grain_transactions WHERE circle_transfer_id = $1',
      [circleTransferId]
    )
  }

  // Treasury backing operations
  async getTreasuryBacking(circleReferenceId: string): Promise<any | null> {
    const rows = await this.query(
      'SELECT * FROM treasury_backing WHERE circle_reference_id = $1',
      [circleReferenceId]
    )
    return rows[0] || null
  }

  async deleteTreasuryBacking(circleReferenceId: string): Promise<void> {
    await this.query(
      'DELETE FROM treasury_backing WHERE circle_reference_id = $1',
      [circleReferenceId]
    )
  }

  // GRAIN price operations
  async getCurrentGrainPrice(): Promise<number> {
    const rows = await this.query(
      'SELECT price_usd FROM grain_price_history ORDER BY recorded_at DESC LIMIT 1'
    )
    return rows.length > 0 ? parseFloat(rows[0].price_usd) : 1.0
  }

  // Cleanup all test data
  async cleanupTestData(userId: string, notificationIds: string[]): Promise<void> {
    // Delete webhook events
    for (const notifId of notificationIds) {
      await this.deleteWebhookEvent(notifId)
    }

    // Delete transactions for test user
    await this.query('DELETE FROM grain_transactions WHERE user_id = $1', [
      userId,
    ])

    // Delete treasury backing for test entries
    await this.query(
      "DELETE FROM treasury_backing WHERE source LIKE 'circle_%' AND circle_reference_id LIKE 'pi_test%'"
    )

    // Delete user wallet
    await this.deleteUserWallet(userId)
  }
}

// ============================================================================
// WEBHOOK SENDER
// ============================================================================

async function sendWebhook(
  endpoint: string,
  payload: CircleWebhookPayload,
  secret: string
): Promise<{ status: number; body: any }> {
  const payloadString = JSON.stringify(payload)
  const signature = generateHmacSignature(payloadString, secret)

  const response = await fetch(`${endpoint}/api/webhooks/circle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-circle-signature': signature,
    },
    body: payloadString,
  })

  const body = await response.json().catch(() => ({}))

  return {
    status: response.status,
    body,
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

class CircleDepositTests {
  private config: TestConfig
  private db: DatabaseClient
  private testUserId: string
  private createdNotificationIds: string[] = []
  private results: TestResult[] = []

  constructor(config: TestConfig) {
    this.config = config
    this.db = new DatabaseClient(config.dbUrl)
    this.testUserId = `test_user_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`
  }

  private addResult(result: TestResult): void {
    this.results.push(result)
    if (result.passed) {
      logSuccess(result.name)
    } else {
      logError(`${result.name}: ${result.error}`)
    }
    if (this.config.verbose && result.details) {
      logInfo(`Details: ${JSON.stringify(result.details, null, 2)}`)
    }
  }

  // Test 1: Create test user wallet
  async testCreateUserWallet(): Promise<void> {
    logSection('Test 1: Create Test User Wallet')

    try {
      const wallet = await this.db.createUserWallet(this.testUserId, 0)

      if (wallet && wallet.user_id === this.testUserId) {
        this.addResult({
          name: 'Create user wallet',
          passed: true,
          details: { userId: this.testUserId, walletId: wallet.wallet_id },
        })
      } else {
        this.addResult({
          name: 'Create user wallet',
          passed: false,
          error: 'Failed to create wallet',
        })
      }
    } catch (error: any) {
      this.addResult({
        name: 'Create user wallet',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 2: Simulate successful deposit webhook
  async testSuccessfulDeposit(): Promise<void> {
    logSection('Test 2: Simulate Successful $100 Deposit')

    const depositAmount = 100
    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: depositAmount,
    })
    this.createdNotificationIds.push(payload.notificationId)

    try {
      // Get initial balance
      const initialWallet = await this.db.getUserWallet(this.testUserId)
      const initialBalance = initialWallet
        ? parseFloat(initialWallet.balance)
        : 0

      // Get current GRAIN price
      const grainPrice = await this.db.getCurrentGrainPrice()
      const expectedGrainAmount = depositAmount / grainPrice

      logInfo(`Initial balance: ${initialBalance} GRAIN`)
      logInfo(`Current GRAIN price: $${grainPrice}`)
      logInfo(`Expected GRAIN for $${depositAmount}: ${expectedGrainAmount}`)

      // Send webhook
      const response = await sendWebhook(
        this.config.endpoint,
        payload,
        this.config.circleSecret
      )

      // Check response status
      if (response.status === 200) {
        this.addResult({
          name: 'Webhook returns 200 OK',
          passed: true,
          details: response.body,
        })
      } else {
        this.addResult({
          name: 'Webhook returns 200 OK',
          passed: false,
          error: `Got status ${response.status}: ${JSON.stringify(
            response.body
          )}`,
        })
      }

      // Verify database updates
      await this.verifyDatabaseUpdates(
        payload,
        depositAmount,
        expectedGrainAmount,
        initialBalance
      )
    } catch (error: any) {
      this.addResult({
        name: 'Successful deposit test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Verify all database updates after webhook
  private async verifyDatabaseUpdates(
    payload: CircleWebhookPayload,
    depositAmount: number,
    expectedGrainAmount: number,
    initialBalance: number
  ): Promise<void> {
    // Wait a moment for async processing
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check webhook event was recorded
    const webhookEvent = await this.db.getWebhookEvent(payload.notificationId)
    if (webhookEvent && webhookEvent.processed) {
      this.addResult({
        name: 'Webhook event recorded in circle_webhook_events',
        passed: true,
        details: {
          notificationId: webhookEvent.notification_id,
          processed: webhookEvent.processed,
          action: webhookEvent.action_taken,
        },
      })
    } else {
      this.addResult({
        name: 'Webhook event recorded in circle_webhook_events',
        passed: false,
        error: webhookEvent
          ? 'Event not marked as processed'
          : 'Event not found',
      })
    }

    // Check transaction was recorded
    const paymentId = payload.notification.Id
    const transaction = await this.db.getTransaction(paymentId)
    if (transaction && transaction.status === 'completed') {
      const recordedAmount = parseFloat(transaction.amount || transaction.grain_amount || 0)
      const amountMatch = Math.abs(recordedAmount - expectedGrainAmount) < 0.01

      this.addResult({
        name: 'Transaction recorded in grain_transactions',
        passed: amountMatch,
        error: amountMatch
          ? undefined
          : `Amount mismatch: expected ${expectedGrainAmount}, got ${recordedAmount}`,
        details: {
          type: transaction.type,
          usdAmount: transaction.usd_amount,
          grainAmount: recordedAmount,
          status: transaction.status,
        },
      })
    } else {
      this.addResult({
        name: 'Transaction recorded in grain_transactions',
        passed: false,
        error: transaction
          ? `Status is ${transaction.status}`
          : 'Transaction not found',
      })
    }

    // Check user wallet balance was updated
    const updatedWallet = await this.db.getUserWallet(this.testUserId)
    if (updatedWallet) {
      const newBalance = parseFloat(updatedWallet.balance)
      const expectedBalance = initialBalance + expectedGrainAmount
      const balanceMatch = Math.abs(newBalance - expectedBalance) < 0.01

      this.addResult({
        name: 'User wallet balance updated in user_wallets',
        passed: balanceMatch,
        error: balanceMatch
          ? undefined
          : `Balance mismatch: expected ${expectedBalance}, got ${newBalance}`,
        details: {
          previousBalance: initialBalance,
          newBalance,
          expectedBalance,
          difference: newBalance - initialBalance,
        },
      })
    } else {
      this.addResult({
        name: 'User wallet balance updated in user_wallets',
        passed: false,
        error: 'User wallet not found',
      })
    }

    // Check treasury backing was updated
    const treasuryBacking = await this.db.getTreasuryBacking(paymentId)
    if (treasuryBacking) {
      const backingAmount = parseFloat(treasuryBacking.amount)
      const amountMatch = Math.abs(backingAmount - depositAmount) < 0.01

      this.addResult({
        name: 'Treasury backing recorded in treasury_backing',
        passed: amountMatch,
        error: amountMatch
          ? undefined
          : `Amount mismatch: expected ${depositAmount}, got ${backingAmount}`,
        details: {
          assetType: treasuryBacking.asset_type,
          amount: backingAmount,
          source: treasuryBacking.source,
        },
      })
    } else {
      this.addResult({
        name: 'Treasury backing recorded in treasury_backing',
        passed: false,
        error: 'Treasury backing not found',
      })
    }
  }

  // Test 3: Idempotency - send same webhook twice
  async testIdempotency(): Promise<void> {
    logSection('Test 3: Idempotency - Duplicate Webhook Handling')

    // Use the same notification ID as before to test duplicate
    const notificationId = `idempotency_test_${Date.now()}`
    this.createdNotificationIds.push(notificationId)

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 50,
      notificationId,
    })

    try {
      // Get balance before
      const walletBefore = await this.db.getUserWallet(this.testUserId)
      const balanceBefore = walletBefore
        ? parseFloat(walletBefore.balance)
        : 0

      // Send first webhook
      const response1 = await sendWebhook(
        this.config.endpoint,
        payload,
        this.config.circleSecret
      )

      if (response1.status !== 200) {
        this.addResult({
          name: 'First webhook succeeds',
          passed: false,
          error: `Status ${response1.status}`,
        })
        return
      }
      this.addResult({ name: 'First webhook succeeds', passed: true })

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Get balance after first webhook
      const walletAfter1 = await this.db.getUserWallet(this.testUserId)
      const balanceAfter1 = walletAfter1
        ? parseFloat(walletAfter1.balance)
        : 0

      // Send same webhook again
      const response2 = await sendWebhook(
        this.config.endpoint,
        payload,
        this.config.circleSecret
      )

      // Should still return 200 but indicate already processed
      if (
        response2.status === 200 &&
        response2.body.status === 'already_processed'
      ) {
        this.addResult({
          name: 'Duplicate webhook returns already_processed',
          passed: true,
          details: response2.body,
        })
      } else {
        this.addResult({
          name: 'Duplicate webhook returns already_processed',
          passed: false,
          error: `Got status ${response2.status}, body: ${JSON.stringify(
            response2.body
          )}`,
        })
      }

      // Wait for any processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify balance didn't change after duplicate
      const walletAfter2 = await this.db.getUserWallet(this.testUserId)
      const balanceAfter2 = walletAfter2
        ? parseFloat(walletAfter2.balance)
        : 0

      const balanceUnchanged =
        Math.abs(balanceAfter2 - balanceAfter1) < 0.001

      this.addResult({
        name: 'Balance unchanged after duplicate webhook',
        passed: balanceUnchanged,
        error: balanceUnchanged
          ? undefined
          : `Balance changed from ${balanceAfter1} to ${balanceAfter2}`,
        details: {
          balanceBefore,
          balanceAfter1,
          balanceAfter2,
        },
      })
    } catch (error: any) {
      this.addResult({
        name: 'Idempotency test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 4: Invalid signature
  async testInvalidSignature(): Promise<void> {
    logSection('Test 4: Invalid Signature Handling')

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 25,
    })

    try {
      // Send with invalid signature
      const payloadString = JSON.stringify(payload)
      const invalidSignature = 'invalid_signature_12345'

      const response = await fetch(
        `${this.config.endpoint}/api/webhooks/circle`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-circle-signature': invalidSignature,
          },
          body: payloadString,
        }
      )

      const body = await response.json().catch(() => ({}))

      if (response.status === 400 && body.error === 'Invalid signature') {
        this.addResult({
          name: 'Invalid signature returns 400',
          passed: true,
          details: body,
        })
      } else {
        this.addResult({
          name: 'Invalid signature returns 400',
          passed: false,
          error: `Got status ${response.status}: ${JSON.stringify(body)}`,
        })
      }
    } catch (error: any) {
      this.addResult({
        name: 'Invalid signature test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 5: Missing signature header
  async testMissingSignature(): Promise<void> {
    logSection('Test 5: Missing Signature Header')

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 25,
    })

    try {
      const response = await fetch(
        `${this.config.endpoint}/api/webhooks/circle`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No x-circle-signature header
          },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json().catch(() => ({}))

      if (response.status === 400) {
        this.addResult({
          name: 'Missing signature returns 400',
          passed: true,
          details: body,
        })
      } else {
        this.addResult({
          name: 'Missing signature returns 400',
          passed: false,
          error: `Got status ${response.status}: ${JSON.stringify(body)}`,
        })
      }
    } catch (error: any) {
      this.addResult({
        name: 'Missing signature test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 6: Failed payment webhook
  async testFailedPayment(): Promise<void> {
    logSection('Test 6: Failed Payment Webhook')

    const notificationId = `failed_payment_${Date.now()}`
    this.createdNotificationIds.push(notificationId)

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: 100,
      eventType: 'payments.payment_intent.failed',
      status: 'failed',
      notificationId,
    })

    // Add error info
    payload.notification.Data.errorCode = 'payment_declined'
    payload.notification.Data.errorMessage = 'Card was declined'

    try {
      // Get balance before
      const walletBefore = await this.db.getUserWallet(this.testUserId)
      const balanceBefore = walletBefore
        ? parseFloat(walletBefore.balance)
        : 0

      const response = await sendWebhook(
        this.config.endpoint,
        payload,
        this.config.circleSecret
      )

      if (response.status === 200) {
        this.addResult({
          name: 'Failed payment webhook accepted',
          passed: true,
          details: response.body,
        })
      } else {
        this.addResult({
          name: 'Failed payment webhook accepted',
          passed: false,
          error: `Status ${response.status}`,
        })
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify balance unchanged (failed payment shouldn't credit)
      const walletAfter = await this.db.getUserWallet(this.testUserId)
      const balanceAfter = walletAfter
        ? parseFloat(walletAfter.balance)
        : 0

      const balanceUnchanged =
        Math.abs(balanceAfter - balanceBefore) < 0.001

      this.addResult({
        name: 'Balance unchanged after failed payment',
        passed: balanceUnchanged,
        error: balanceUnchanged
          ? undefined
          : `Balance changed from ${balanceBefore} to ${balanceAfter}`,
      })
    } catch (error: any) {
      this.addResult({
        name: 'Failed payment test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 7: GRAIN calculation verification
  async testGrainCalculation(): Promise<void> {
    logSection('Test 7: GRAIN Calculation Verification')

    const depositAmount = 250
    const notificationId = `grain_calc_${Date.now()}`
    this.createdNotificationIds.push(notificationId)

    const payload = generateWebhookPayload({
      userId: this.testUserId,
      amount: depositAmount,
      notificationId,
    })

    try {
      // Get current GRAIN price
      const grainPrice = await this.db.getCurrentGrainPrice()
      const expectedGrain = depositAmount / grainPrice

      logInfo(`Deposit amount: $${depositAmount}`)
      logInfo(`Current GRAIN price: $${grainPrice}`)
      logInfo(`Expected GRAIN amount: ${expectedGrain}`)

      // Get balance before
      const walletBefore = await this.db.getUserWallet(this.testUserId)
      const balanceBefore = walletBefore
        ? parseFloat(walletBefore.balance)
        : 0

      const response = await sendWebhook(
        this.config.endpoint,
        payload,
        this.config.circleSecret
      )

      if (response.status !== 200) {
        this.addResult({
          name: 'GRAIN calculation test webhook',
          passed: false,
          error: `Status ${response.status}`,
        })
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify GRAIN amount
      const walletAfter = await this.db.getUserWallet(this.testUserId)
      const balanceAfter = walletAfter
        ? parseFloat(walletAfter.balance)
        : 0
      const actualGrainAdded = balanceAfter - balanceBefore

      const isCorrect = Math.abs(actualGrainAdded - expectedGrain) < 0.01

      this.addResult({
        name: 'GRAIN amount correctly calculated',
        passed: isCorrect,
        error: isCorrect
          ? undefined
          : `Expected ${expectedGrain} GRAIN, got ${actualGrainAdded}`,
        details: {
          depositUsd: depositAmount,
          grainPrice,
          expectedGrain,
          actualGrainAdded,
          formula: `${depositAmount} / ${grainPrice} = ${expectedGrain}`,
        },
      })
    } catch (error: any) {
      this.addResult({
        name: 'GRAIN calculation test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Test 8: Health check endpoint
  async testHealthCheck(): Promise<void> {
    logSection('Test 8: Webhook Health Check Endpoint')

    try {
      const response = await fetch(
        `${this.config.endpoint}/api/webhooks/circle`,
        {
          method: 'GET',
        }
      )

      const body = await response.json().catch(() => ({}))

      if (response.status === 200 && body.status === 'active') {
        this.addResult({
          name: 'Health check returns active status',
          passed: true,
          details: body,
        })
      } else {
        this.addResult({
          name: 'Health check returns active status',
          passed: false,
          error: `Status ${response.status}: ${JSON.stringify(body)}`,
        })
      }
    } catch (error: any) {
      this.addResult({
        name: 'Health check test',
        passed: false,
        error: error.message,
      })
    }
  }

  // Cleanup test data
  async cleanup(): Promise<void> {
    logSection('Cleanup')

    try {
      await this.db.cleanupTestData(
        this.testUserId,
        this.createdNotificationIds
      )
      logSuccess('Test data cleaned up')
    } catch (error: any) {
      logWarning(`Cleanup failed: ${error.message}`)
    }
  }

  // Run all tests
  async runAll(): Promise<void> {
    console.log()
    log(
      '=========================================================',
      'cyan'
    )
    log('  CIRCLE DEPOSIT FLOW - END-TO-END TEST SUITE', 'bright')
    log(
      '=========================================================',
      'cyan'
    )
    console.log()
    logInfo(`Test User ID: ${this.testUserId}`)
    logInfo(`Webhook Endpoint: ${this.config.endpoint}`)
    logInfo(`Cleanup Mode: ${this.config.cleanup ? 'Yes' : 'No'}`)

    try {
      // Run tests in order
      await this.testCreateUserWallet()
      await this.testSuccessfulDeposit()
      await this.testIdempotency()
      await this.testInvalidSignature()
      await this.testMissingSignature()
      await this.testFailedPayment()
      await this.testGrainCalculation()
      await this.testHealthCheck()

      // Cleanup if requested
      if (this.config.cleanup) {
        await this.cleanup()
      }
    } finally {
      await this.db.close()
    }

    // Print summary
    this.printSummary()
  }

  private printSummary(): void {
    logSection('TEST SUMMARY')

    const passed = this.results.filter((r) => r.passed).length
    const failed = this.results.filter((r) => !r.passed).length
    const total = this.results.length

    console.log()
    log(`  Total Tests: ${total}`, 'bright')
    log(`  Passed:      ${passed}`, 'green')
    log(`  Failed:      ${failed}`, failed > 0 ? 'red' : 'green')
    console.log()

    if (failed > 0) {
      log('  Failed Tests:', 'red')
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          log(`    - ${r.name}: ${r.error}`, 'red')
        })
      console.log()
    }

    const successRate = ((passed / total) * 100).toFixed(1)
    if (failed === 0) {
      log(
        `  ALL TESTS PASSED (${successRate}% success rate)`,
        'green'
      )
    } else {
      log(`  ${successRate}% success rate`, 'yellow')
    }

    console.log()
    log('='.repeat(60), 'cyan')
    console.log()

    // Exit with error code if tests failed
    if (failed > 0) {
      process.exit(1)
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs()

  // Validate config
  if (!config.dbUrl) {
    log('ERROR: POSTGRES_URL or DATABASE_URL environment variable is required', 'red')
    log('Usage: POSTGRES_URL="..." npx tsx scripts/test-circle-deposit.ts', 'yellow')
    process.exit(1)
  }

  if (!config.circleSecret) {
    logWarning(
      'CIRCLE_ENTITY_SECRET not set, using default test secret'
    )
  }

  const tests = new CircleDepositTests(config)
  await tests.runAll()
}

main().catch((error) => {
  log(`FATAL ERROR: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
