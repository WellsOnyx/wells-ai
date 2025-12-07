/**
 * Trillion Dollar Scale Schema Migration
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  await client.connect();
  console.log('Connected to database');

  const tables = [
    // SILENT ACCOUNTS
    `CREATE TABLE IF NOT EXISTS silent_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      phone TEXT,
      company_name TEXT,
      ein TEXT,
      inferred_industry TEXT,
      inferred_revenue_range TEXT,
      inferred_employee_count TEXT,
      enrichment_data JSONB DEFAULT '{}',
      wallet_address TEXT UNIQUE NOT NULL,
      wallet_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      first_touch TEXT NOT NULL,
      touch_count INTEGER DEFAULT 1,
      total_volume_received DECIMAL(20,2) DEFAULT 0,
      total_volume_sent DECIMAL(20,2) DEFAULT 0,
      activation_level TEXT DEFAULT 'ghost',
      parent_account_id UUID,
      network_depth INTEGER DEFAULT 0,
      children_count INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // VIRAL PAYMENTS
    `CREATE TABLE IF NOT EXISTS viral_payments (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_wallet TEXT NOT NULL,
      recipient_email TEXT,
      recipient_phone TEXT,
      recipient_company TEXT,
      recipient_wallet TEXT,
      recipient_account_id UUID,
      amount_usdc DECIMAL(20,2) NOT NULL,
      memo TEXT,
      invoice_id TEXT,
      referral_code TEXT NOT NULL,
      claim_url TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      wells_fee DECIMAL(20,2) DEFAULT 0,
      referrer_bonus DECIMAL(20,2) DEFAULT 0
    )`,

    // VIRAL EVENTS
    `CREATE TABLE IF NOT EXISTS viral_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event TEXT NOT NULL,
      data JSONB NOT NULL,
      account_id UUID,
      referral_code TEXT,
      partner_id UUID,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // NETWORK NODES
    `CREATE TABLE IF NOT EXISTS network_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      depth INTEGER NOT NULL DEFAULT 0,
      parent_id UUID,
      children_count INTEGER DEFAULT 0,
      direct_volume DECIMAL(20,2) DEFAULT 0,
      network_volume DECIMAL(20,2) DEFAULT 0,
      referrals_sent INTEGER DEFAULT 0,
      referrals_converted INTEGER DEFAULT 0,
      conversion_rate DECIMAL(5,4) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // CREDIT LINES
    `CREATE TABLE IF NOT EXISTS credit_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      credit_limit DECIMAL(20,2) NOT NULL,
      available DECIMAL(20,2) NOT NULL,
      used DECIMAL(20,2) DEFAULT 0,
      apr DECIMAL(5,4) NOT NULL,
      funding_cost DECIMAL(5,4) NOT NULL,
      spread DECIMAL(5,4) NOT NULL,
      approval_source TEXT NOT NULL,
      approval_data JSONB DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // CREDIT TRANSACTIONS
    `CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credit_line_id UUID NOT NULL,
      account_id UUID NOT NULL,
      amount DECIMAL(20,2) NOT NULL,
      type TEXT NOT NULL,
      payment_id TEXT,
      invoice_id TEXT,
      due_date TIMESTAMP,
      paid_date TIMESTAMP,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // WHITE LABEL PARTNERS
    `CREATE TABLE IF NOT EXISTS white_label_partners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      contact_email TEXT,
      api_key TEXT UNIQUE NOT NULL,
      api_key_hash TEXT NOT NULL,
      webhook_url TEXT,
      webhook_secret TEXT,
      revenue_share_percent DECIMAL(5,2) NOT NULL,
      total_volume DECIMAL(24,2) DEFAULT 0,
      monthly_volume DECIMAL(24,2) DEFAULT 0,
      transaction_count BIGINT DEFAULT 0,
      total_fees_collected DECIMAL(20,2) DEFAULT 0,
      total_partner_share DECIMAL(20,2) DEFAULT 0,
      total_wells_share DECIMAL(20,2) DEFAULT 0,
      rate_limit_per_minute INTEGER DEFAULT 1000,
      rate_limit_per_day INTEGER DEFAULT 100000,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // WHITE LABEL TRANSACTIONS
    `CREATE TABLE IF NOT EXISTS white_label_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID NOT NULL,
      external_id TEXT,
      sender_external_id TEXT NOT NULL,
      recipient_external_id TEXT NOT NULL,
      amount DECIMAL(20,2) NOT NULL,
      currency TEXT DEFAULT 'USDC',
      sender_account_id UUID,
      recipient_account_id UUID,
      wells_fee DECIMAL(20,2) NOT NULL,
      partner_share DECIMAL(20,2) NOT NULL,
      wells_net DECIMAL(20,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // ERP INTERCEPTS
    `CREATE TABLE IF NOT EXISTS erp_intercepts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      erp_type TEXT NOT NULL,
      erp_connection_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      vendor_name TEXT,
      vendor_email TEXT,
      vendor_account_id UUID,
      amount DECIMAL(20,2) NOT NULL,
      currency TEXT DEFAULT 'USD',
      due_date TIMESTAMP,
      intercept_status TEXT DEFAULT 'detected',
      wells_payment_id TEXT,
      paid_at TIMESTAMP,
      raw_data JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // SCALE METRICS SNAPSHOT
    `CREATE TABLE IF NOT EXISTS scale_metrics_snapshot (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),
      total_accounts BIGINT DEFAULT 0,
      ghost_accounts BIGINT DEFAULT 0,
      aware_accounts BIGINT DEFAULT 0,
      active_accounts BIGINT DEFAULT 0,
      power_accounts BIGINT DEFAULT 0,
      total_volume DECIMAL(24,2) DEFAULT 0,
      daily_volume DECIMAL(24,2) DEFAULT 0,
      weekly_volume DECIMAL(24,2) DEFAULT 0,
      monthly_volume DECIMAL(24,2) DEFAULT 0,
      viral_coefficient DECIMAL(8,6) DEFAULT 0,
      avg_network_depth DECIMAL(8,4) DEFAULT 0,
      total_fees DECIMAL(20,2) DEFAULT 0,
      daily_fees DECIMAL(20,2) DEFAULT 0,
      total_credit_extended DECIMAL(24,2) DEFAULT 0,
      total_credit_outstanding DECIMAL(24,2) DEFAULT 0,
      total_partner_volume DECIMAL(24,2) DEFAULT 0,
      active_partners INTEGER DEFAULT 0,
      projected_30_day_volume DECIMAL(24,2) DEFAULT 0,
      projected_30_day_accounts BIGINT DEFAULT 0,
      UNIQUE(snapshot_time)
    )`,

    // TRILLION TRACKER
    `CREATE TABLE IF NOT EXISTS trillion_tracker (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tracking_date DATE NOT NULL UNIQUE,
      daily_volume DECIMAL(24,2) DEFAULT 0,
      cumulative_volume DECIMAL(24,2) DEFAULT 0,
      target_volume DECIMAL(24,2) NOT NULL,
      variance DECIMAL(24,2) DEFAULT 0,
      on_track BOOLEAN DEFAULT FALSE,
      new_accounts INTEGER DEFAULT 0,
      viral_payments_created INTEGER DEFAULT 0,
      viral_payments_claimed INTEGER DEFAULT 0,
      erp_intercepts_processed INTEGER DEFAULT 0,
      white_label_volume DECIMAL(24,2) DEFAULT 0,
      daily_run_rate DECIMAL(24,2) DEFAULT 0,
      required_run_rate DECIMAL(24,2) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
    'CREATE INDEX IF NOT EXISTS idx_silent_accounts_email ON silent_accounts(email)',
    'CREATE INDEX IF NOT EXISTS idx_silent_accounts_wallet ON silent_accounts(wallet_address)',
    'CREATE INDEX IF NOT EXISTS idx_silent_accounts_activation ON silent_accounts(activation_level)',
    'CREATE INDEX IF NOT EXISTS idx_viral_payments_sender ON viral_payments(sender_id)',
    'CREATE INDEX IF NOT EXISTS idx_viral_payments_status ON viral_payments(status)',
    'CREATE INDEX IF NOT EXISTS idx_viral_payments_referral ON viral_payments(referral_code)',
    'CREATE INDEX IF NOT EXISTS idx_viral_events_event ON viral_events(event)',
    'CREATE INDEX IF NOT EXISTS idx_white_label_api_key ON white_label_partners(api_key)',
    'CREATE INDEX IF NOT EXISTS idx_white_label_domain ON white_label_partners(domain)',
    'CREATE INDEX IF NOT EXISTS idx_wl_tx_partner ON white_label_transactions(partner_id)',
    'CREATE INDEX IF NOT EXISTS idx_credit_lines_account ON credit_lines(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_erp_intercepts_account ON erp_intercepts(account_id)'
  ];

  console.log('\nCreating indexes...');
  for (const idx of indexes) {
    try {
      await client.query(idx);
    } catch (e) {
      // Ignore
    }
  }
  console.log('✓ Indexes created');

  // Verify
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'silent_accounts', 'viral_payments', 'viral_events', 'network_nodes',
      'credit_lines', 'credit_transactions', 'white_label_partners',
      'white_label_transactions', 'erp_intercepts', 'scale_metrics_snapshot',
      'trillion_tracker'
    )
    ORDER BY table_name
  `);

  console.log('\n=== Trillion Scale Tables ===');
  result.rows.forEach(row => console.log(`  - ${row.table_name}`));
  console.log(`\nTotal: ${result.rows.length} tables`);

  await client.end();
}

migrate().catch(console.error);
