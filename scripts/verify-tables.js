const { Client } = require('pg');

const DATABASE_URL = process.env.wellsmemory_DATABASE_URL ||
  'postgres://b288371bbbbb29cd267aa0ade8770d4ac1243b8a7cb697ffc39601fe023830ef:sk_Jd7l0MLiqHCr2Lu3Q9psH@db.prisma.io:5432/postgres?sslmode=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all tables
    const result = await client.query(`
      SELECT
        table_name,
        (SELECT COUNT(*)
         FROM information_schema.columns
         WHERE table_schema = 'public'
         AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📊 Database Tables Summary\n');
    console.log('='.repeat(60));
    console.log(`Total Tables: ${result.rows.length}\n`);

    // Group tables by module
    const modules = {
      core: [],
      gtm: [],
      slack: [],
      erp: [],
      negotiation: [],
      widget: [],
      inbox: [],
      calendar: [],
      procurement: [],
      inventory: [],
      finance: [],
      other: []
    };

    result.rows.forEach(row => {
      const name = row.table_name;
      if (name.startsWith('gtm_')) modules.gtm.push(row);
      else if (name.startsWith('slack_')) modules.slack.push(row);
      else if (name.startsWith('erp_') || name.startsWith('merge_') || name.includes('_erp_')) modules.erp.push(row);
      else if (name.startsWith('negotiation_') || name.startsWith('room_') || name.startsWith('counter_') || name.startsWith('ai_suggestions') || name.startsWith('deal_history')) modules.negotiation.push(row);
      else if (name.startsWith('widget_')) modules.widget.push(row);
      else if (name.startsWith('inbound_') || name.startsWith('outbound_') || name.startsWith('message_') || name.startsWith('webhook_') || name === 'contacts' || name === 'auto_response_rules') modules.inbox.push(row);
      else if (name.startsWith('calendar_') || name.startsWith('user_calendar_')) modules.calendar.push(row);
      else if (name.startsWith('purchase_') || name.startsWith('po_')) modules.procurement.push(row);
      else if (name.startsWith('inventory_') || name.startsWith('reorder_')) modules.inventory.push(row);
      else if (name.startsWith('invoice') || name.startsWith('payment') || name.startsWith('financial_') || name === 'saved_reports' || name === 'analytics_cache') modules.finance.push(row);
      else if (['suppliers', 'rfqs', 'quotes', 'deals', 'conversations', 'analytics_events', 'performance_metrics', 'daily_metrics'].includes(name)) modules.core.push(row);
      else modules.other.push(row);
    });

    // Print modules
    const printModule = (name, tables) => {
      if (tables.length === 0) return;
      console.log(`\n${name.toUpperCase()} (${tables.length} tables)`);
      console.log('-'.repeat(60));
      tables.forEach(t => {
        console.log(`  • ${t.table_name.padEnd(40)} (${t.column_count} columns)`);
      });
    };

    printModule('Core System', modules.core);
    printModule('Go-To-Market (GTM)', modules.gtm);
    printModule('Slack Integration', modules.slack);
    printModule('ERP Integration', modules.erp);
    printModule('Negotiation Rooms', modules.negotiation);
    printModule('Widget System', modules.widget);
    printModule('Inbox System', modules.inbox);
    printModule('Calendar Integration', modules.calendar);
    printModule('Procurement', modules.procurement);
    printModule('Inventory Management', modules.inventory);
    printModule('Finance & Accounting', modules.finance);
    printModule('Other', modules.other);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
