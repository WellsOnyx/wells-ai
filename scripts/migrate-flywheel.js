/**
 * Flywheel Schema Migration
 *
 * Wells AI Float → Grain & Vault Treasury
 * Creates the tables that power the yield flywheel
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  await client.connect();
  console.log('Connected to database');

  const tables = [
    // FLOAT POSITIONS
    `CREATE TABLE IF NOT EXISTS float_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      amount DECIMAL(20,2) NOT NULL,
      currency TEXT DEFAULT 'USDC',
      sender_account_id UUID,
      recipient_account_id UUID,
      partner_id UUID,
      status TEXT DEFAULT 'pending',
      settlement_due TIMESTAMP NOT NULL,
      deployed_at TIMESTAMP,
      settled_at TIMESTAMP,
      vault_deposit_id UUID,
      yield_earned DECIMAL(20,6) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(source_type, source_id)
    )`,

    // VAULT DEPOSITS
    `CREATE TABLE IF NOT EXISTS vault_deposits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      float_position_id UUID,
      amount DECIMAL(20,2) NOT NULL,
      strategy TEXT DEFAULT 'treasury_bills',
      apy_at_deposit DECIMAL(8,6) NOT NULL,
      current_value DECIMAL(20,6) NOT NULL,
      yield_accrued DECIMAL(20,6) DEFAULT 0,
      status TEXT DEFAULT 'active',
      deposited_at TIMESTAMP NOT NULL DEFAULT NOW(),
      withdrawn_at TIMESTAMP,
      grain_pool_id UUID
    )`,

    // GRAIN POOLS
    `CREATE TABLE IF NOT EXISTS grain_pools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pool_name TEXT NOT NULL UNIQUE,
      total_backing_value DECIMAL(24,2) DEFAULT 0,
      total_grain_allocated DECIMAL(24,6) DEFAULT 0,
      current_apy DECIMAL(8,6) NOT NULL,
      yield_to_date DECIMAL(24,6) DEFAULT 0,
      wells_share_earned DECIMAL(24,6) DEFAULT 0,
      grain_appreciation_fund DECIMAL(24,6) DEFAULT 0,
      participant_rewards_fund DECIMAL(24,6) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // GRAIN PRICE HISTORY
    `CREATE TABLE IF NOT EXISTS grain_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      price_usd DECIMAL(20,10) NOT NULL,
      total_backing DECIMAL(24,2) NOT NULL,
      circulating_supply DECIMAL(24,6) NOT NULL,
      market_cap DECIMAL(24,2) NOT NULL,
      daily_volume DECIMAL(24,2) DEFAULT 0,
      recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // YIELD DISTRIBUTIONS
    `CREATE TABLE IF NOT EXISTS yield_distributions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type TEXT NOT NULL,
      source_id UUID NOT NULL,
      total_yield DECIMAL(20,6) NOT NULL,
      wells_share DECIMAL(20,6) NOT NULL,
      grain_appreciation DECIMAL(20,6) NOT NULL,
      participant_rewards DECIMAL(20,6) NOT NULL,
      grain_price_at_distribution DECIMAL(20,10),
      distributed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // ACCOUNT REWARDS
    `CREATE TABLE IF NOT EXISTS account_rewards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      reward_type TEXT NOT NULL,
      amount DECIMAL(20,6) NOT NULL,
      currency TEXT DEFAULT 'USDC',
      grain_equivalent DECIMAL(20,6),
      source_transaction_id TEXT,
      source_float_id UUID,
      status TEXT DEFAULT 'pending',
      credited_at TIMESTAMP,
      claimed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // DAILY FLOAT METRICS
    `CREATE TABLE IF NOT EXISTS daily_float_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      metric_date DATE NOT NULL UNIQUE,
      total_float_outstanding DECIMAL(24,2) DEFAULT 0,
      total_deployed_to_vault DECIMAL(24,2) DEFAULT 0,
      daily_new_float DECIMAL(24,2) DEFAULT 0,
      daily_settled_float DECIMAL(24,2) DEFAULT 0,
      daily_yield_generated DECIMAL(20,6) DEFAULT 0,
      daily_wells_revenue DECIMAL(20,6) DEFAULT 0,
      daily_grain_appreciation DECIMAL(20,6) DEFAULT 0,
      daily_participant_rewards DECIMAL(20,6) DEFAULT 0,
      avg_settlement_days DECIMAL(5,2) DEFAULT 3,
      grain_price_open DECIMAL(20,10),
      grain_price_close DECIMAL(20,10),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // FLYWHEEL SNAPSHOTS
    `CREATE TABLE IF NOT EXISTS flywheel_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),
      total_float_all_time DECIMAL(24,2) DEFAULT 0,
      current_float_outstanding DECIMAL(24,2) DEFAULT 0,
      avg_float_duration_days DECIMAL(5,2) DEFAULT 3,
      total_deployed_to_vault DECIMAL(24,2) DEFAULT 0,
      current_vault_balance DECIMAL(24,2) DEFAULT 0,
      total_yield_generated DECIMAL(24,6) DEFAULT 0,
      current_blended_apy DECIMAL(8,6) DEFAULT 0,
      total_wells_revenue DECIMAL(24,6) DEFAULT 0,
      daily_wells_revenue DECIMAL(20,6) DEFAULT 0,
      grain_total_supply DECIMAL(24,6) DEFAULT 1000000000,
      grain_circulating_supply DECIMAL(24,6) DEFAULT 0,
      grain_price_usd DECIMAL(20,10) DEFAULT 1.0,
      grain_market_cap DECIMAL(24,2) DEFAULT 0,
      grain_backing_value DECIMAL(24,2) DEFAULT 0,
      total_participant_rewards DECIMAL(24,6) DEFAULT 0,
      unique_reward_recipients INTEGER DEFAULT 0,
      float_growth_rate_7d DECIMAL(8,4) DEFAULT 0,
      yield_growth_rate_7d DECIMAL(8,4) DEFAULT 0,
      UNIQUE(snapshot_time)
    )`
  ];

  let success = 0;
  let skipped = 0;

  for (const sql of tables) {
    try {
      await client.query(sql);
      success++;
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`✓ Created: ${tableName}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        skipped++;
        console.log(`⊘ Already exists: ${e.message.match(/relation "(\w+)"/)?.[1]}`);
      } else {
        console.error(`✗ Error:`, e.message);
      }
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_float_positions_source ON float_positions(source_type, source_id)',
    'CREATE INDEX IF NOT EXISTS idx_float_positions_status ON float_positions(status)',
    'CREATE INDEX IF NOT EXISTS idx_float_positions_settlement ON float_positions(settlement_due)',
    'CREATE INDEX IF NOT EXISTS idx_vault_deposits_status ON vault_deposits(status)',
    'CREATE INDEX IF NOT EXISTS idx_vault_deposits_pool ON vault_deposits(grain_pool_id)',
    'CREATE INDEX IF NOT EXISTS idx_yield_distributions_source ON yield_distributions(source_type, source_id)',
    'CREATE INDEX IF NOT EXISTS idx_account_rewards_account ON account_rewards(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_account_rewards_status ON account_rewards(status)',
    'CREATE INDEX IF NOT EXISTS idx_daily_float_metrics_date ON daily_float_metrics(metric_date)',
    'CREATE INDEX IF NOT EXISTS idx_grain_price_recorded ON grain_price_history(recorded_at)'
  ];

  console.log('\nCreating indexes...');
  for (const idx of indexes) {
    try {
      await client.query(idx);
    } catch (e) {
      // Ignore index errors
    }
  }
  console.log('✓ Indexes created');

  // Initialize primary grain pool
  console.log('\nInitializing grain pool...');
  try {
    await client.query(`
      INSERT INTO grain_pools (pool_name, total_backing_value, current_apy)
      VALUES ('primary_treasury', 0, 0.045)
      ON CONFLICT (pool_name) DO NOTHING
    `);
    console.log('✓ Primary grain pool initialized');
  } catch (e) {
    console.log('⊘ Grain pool already exists');
  }

  // Verify
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'float_positions', 'vault_deposits', 'grain_pools', 'grain_price_history',
      'yield_distributions', 'account_rewards', 'daily_float_metrics', 'flywheel_snapshots'
    )
    ORDER BY table_name
  `);

  console.log('\n=== Flywheel Tables ===');
  result.rows.forEach(row => console.log(`  - ${row.table_name}`));
  console.log(`\nTotal: ${result.rows.length} tables`);

  await client.end();
}

migrate().catch(console.error);
