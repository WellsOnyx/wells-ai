/**
 * Treasury Database Test Script
 *
 * Tests the Treasury SDK database connection and operations
 *
 * Usage:
 *   npx tsx scripts/test-treasury-db.ts
 */

import { sql } from '@vercel/postgres'
import {
  createAccount,
  getAccount,
  getAccountByClerkId,
  createWallet,
  getWallets,
  createTransaction,
  getTransactions,
  updateTransactionStatus,
  createVendor,
  getVendors,
  createCreditLine,
  getCreditLine,
} from '../lib/treasury-db'

async function testDatabaseConnection() {
  console.log('🔗 Testing database connection...\n')

  try {
    const result = await sql`SELECT NOW() as current_time, version() as postgres_version`
    const row = result.rows[0]

    console.log('✅ Database connected successfully!')
    console.log('   Current time:', row.current_time)
    console.log('   PostgreSQL:', row.postgres_version.split(' ')[0], row.postgres_version.split(' ')[1])
    console.log()

    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

async function testTables() {
  console.log('📊 Checking treasury tables...\n')

  try {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'treasury_%'
      ORDER BY table_name
    `

    const tables = result.rows.map(r => r.table_name)

    if (tables.length === 0) {
      console.log('❌ No treasury tables found!')
      console.log('   Run: node scripts/migrate-treasury.js')
      return false
    }

    console.log(`✅ Found ${tables.length} treasury tables:`)
    tables.forEach(table => {
      console.log(`   - ${table}`)
    })
    console.log()

    return true
  } catch (error) {
    console.error('❌ Error checking tables:', error)
    return false
  }
}

async function testCRUDOperations() {
  console.log('🧪 Testing CRUD operations...\n')

  try {
    // 1. Create Account
    console.log('1️⃣  Creating test account...')
    const testUserId = `test_user_${Date.now()}`
    const account = await createAccount({
      clerkUserId: testUserId,
      companyName: 'Test Company Inc',
      companySize: 'startup',
      industry: 'Technology',
      country: 'US',
      erpSystem: 'netsuite',
    })

    console.log(`   ✅ Account created: ${account.id}`)
    console.log(`   🔑 API Key: ${account.apiKey.substring(0, 20)}...`)
    console.log(`   💰 Credit Line: $${account.creditLine}`)
    console.log()

    // 2. Retrieve Account
    console.log('2️⃣  Retrieving account...')
    const retrievedAccount = await getAccountByClerkId(testUserId)
    if (!retrievedAccount) throw new Error('Account not found')
    console.log(`   ✅ Account retrieved: ${retrievedAccount.companyName}`)
    console.log()

    // 3. Create Wallet
    console.log('3️⃣  Creating wallet...')
    const wallet = await createWallet({
      accountId: account.id,
      walletId: `circle_wallet_${Date.now()}`,
      address: `0x${Math.random().toString(16).substring(2, 42)}`,
      blockchain: 'BASE',
      currency: 'GRAIN',
    })
    console.log(`   ✅ Wallet created: ${wallet.address}`)
    console.log()

    // 4. Get Wallets
    console.log('4️⃣  Getting wallets...')
    const wallets = await getWallets(account.id)
    console.log(`   ✅ Found ${wallets.length} wallet(s)`)
    console.log()

    // 5. Create Transaction
    console.log('5️⃣  Creating transaction...')
    const transaction = await createTransaction({
      accountId: account.id,
      type: 'payment',
      amount: 1000,
      currency: 'GRAIN',
      toWallet: '0xvendorwallet123',
      counterpartyName: 'Test Vendor',
      erpReference: 'PO-2024-001',
      costCenter: 'IT',
      description: 'Test payment',
    })
    console.log(`   ✅ Transaction created: ${transaction.id}`)
    console.log(`   💸 Amount: $${transaction.amount} ${transaction.currency}`)
    console.log()

    // 6. Update Transaction Status
    console.log('6️⃣  Updating transaction status...')
    await updateTransactionStatus(transaction.id, 'completed')
    console.log('   ✅ Transaction marked as completed')
    console.log()

    // 7. Get Transactions
    console.log('7️⃣  Getting transactions...')
    const { transactions, total } = await getTransactions(account.id, { limit: 10 })
    console.log(`   ✅ Found ${total} transaction(s)`)
    console.log()

    // 8. Create Vendor
    console.log('8️⃣  Creating vendor...')
    const vendor = await createVendor({
      accountId: account.id,
      vendorId: 'VEND-001',
      vendorName: 'Acme Vendor Inc',
      email: 'payments@acmevendor.com',
      walletAddress: '0xvendorwallet456',
      paymentTerms: 'Net30',
    })
    console.log(`   ✅ Vendor created: ${vendor.vendorName}`)
    console.log()

    // 9. Get Vendors
    console.log('9️⃣  Getting vendors...')
    const vendors = await getVendors(account.id)
    console.log(`   ✅ Found ${vendors.length} vendor(s)`)
    console.log()

    // 10. Get Credit Line
    console.log('🔟 Getting credit line...')
    const creditLine = await getCreditLine(account.id)
    if (creditLine) {
      console.log(`   ✅ Credit Line: $${creditLine.limitAmount}`)
      console.log(`   💳 Available: $${creditLine.availableAmount}`)
    }
    console.log()

    console.log('✅ All CRUD operations completed successfully!\n')
    return { account, wallet, transaction, vendor }
  } catch (error) {
    console.error('❌ CRUD operations failed:', error)
    return null
  }
}

async function testDashboardView() {
  console.log('📈 Testing dashboard view...\n')

  try {
    const result = await sql`
      SELECT
        account_id,
        company_name,
        tier,
        grain_balance,
        credit_line,
        available_credit,
        transactions_30d,
        volume_30d,
        vendor_count
      FROM treasury_dashboard
      LIMIT 5
    `

    console.log(`✅ Dashboard view working! Found ${result.rows.length} account(s)`)

    result.rows.forEach((row, index) => {
      console.log(`\n   Account ${index + 1}:`)
      console.log(`   - Company: ${row.company_name}`)
      console.log(`   - Tier: ${row.tier}`)
      console.log(`   - Balance: $${row.grain_balance}`)
      console.log(`   - Credit: $${row.credit_line} ($${row.available_credit} available)`)
      console.log(`   - Transactions (30d): ${row.transactions_30d}`)
      console.log(`   - Volume (30d): $${row.volume_30d}`)
      console.log(`   - Vendors: ${row.vendor_count}`)
    })

    console.log()
    return true
  } catch (error) {
    console.error('❌ Dashboard view failed:', error)
    return false
  }
}

async function cleanupTestData(testData?: { account: any }) {
  if (!testData?.account) return

  console.log('🧹 Cleaning up test data...\n')

  try {
    // Delete test account (cascades to all related records)
    await sql`DELETE FROM treasury_accounts WHERE id = ${testData.account.id}`
    console.log('✅ Test data cleaned up')
    console.log()
  } catch (error) {
    console.error('⚠️  Failed to clean up test data:', error)
  }
}

async function printSummary() {
  console.log('=' .repeat(60))
  console.log('📊 TREASURY DATABASE SUMMARY')
  console.log('=' .repeat(60))

  try {
    // Count accounts
    const accountsResult = await sql`SELECT COUNT(*) as count FROM treasury_accounts`
    const accountsCount = parseInt(accountsResult.rows[0].count)

    // Count transactions
    const transactionsResult = await sql`SELECT COUNT(*) as count FROM treasury_transactions`
    const transactionsCount = parseInt(transactionsResult.rows[0].count)

    // Count vendors
    const vendorsResult = await sql`SELECT COUNT(*) as count FROM treasury_vendors`
    const vendorsCount = parseInt(vendorsResult.rows[0].count)

    // Count wallets
    const walletsResult = await sql`SELECT COUNT(*) as count FROM treasury_wallets`
    const walletsCount = parseInt(walletsResult.rows[0].count)

    console.log(`\n📦 Total Accounts:     ${accountsCount}`)
    console.log(`💳 Total Wallets:      ${walletsCount}`)
    console.log(`💸 Total Transactions: ${transactionsCount}`)
    console.log(`🤝 Total Vendors:      ${vendorsCount}`)

    console.log('\n' + '=' .repeat(60))
  } catch (error) {
    console.error('❌ Failed to generate summary:', error)
  }
}

// Main test runner
async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 GRAIN & VAULT TREASURY SDK - DATABASE TEST')
  console.log('='.repeat(60))
  console.log()

  // Test connection
  const connectionOk = await testDatabaseConnection()
  if (!connectionOk) {
    console.log('❌ Cannot proceed without database connection')
    process.exit(1)
  }

  // Test tables
  const tablesOk = await testTables()
  if (!tablesOk) {
    console.log('❌ Cannot proceed without treasury tables')
    console.log('   Run: node scripts/migrate-treasury.js')
    process.exit(1)
  }

  // Test CRUD operations
  const testData = await testCRUDOperations()

  // Test dashboard view
  await testDashboardView()

  // Print summary
  await printSummary()

  // Cleanup
  if (testData) {
    const cleanup = process.argv.includes('--cleanup')
    if (cleanup) {
      await cleanupTestData(testData)
    } else {
      console.log('\n💡 Tip: Run with --cleanup to remove test data')
      console.log('   Example: npx tsx scripts/test-treasury-db.ts --cleanup')
    }
  }

  console.log('\n✅ All tests completed!\n')
}

// Run tests
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
