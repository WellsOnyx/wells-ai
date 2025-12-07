// ERP Sync Cron Job
// Run this on a schedule (e.g., every hour via Vercel Cron or similar)
// This automatically syncs all active ERP connections

import { neon } from '@neondatabase/serverless';
import { interceptService } from '../lib/erp/intercept-service';

const sql = neon(process.env.DATABASE_URL!);

async function syncAllConnections() {
  console.log('Starting scheduled ERP sync...');

  try {
    // Get all active connections that are due for sync
    const connections = await sql`
      SELECT id, provider, company_name, last_sync_at
      FROM erp_connections
      WHERE connection_status = 'active'
      AND auto_intercept_enabled = true
      AND (next_sync_at IS NULL OR next_sync_at <= NOW())
      ORDER BY last_sync_at ASC NULLS FIRST
      LIMIT 50
    `;

    console.log(`Found ${connections.length} connections to sync`);

    let totalBills = 0;
    let totalIntercepts = 0;
    let totalRevenue = 0;
    let successCount = 0;
    let failCount = 0;

    // Sync each connection
    for (const connection of connections) {
      try {
        console.log(`Syncing ${connection.provider} connection: ${connection.company_name || connection.id}`);

        const result = await interceptService.scanForPayables(connection.id);

        totalBills += result.billsFound;
        totalIntercepts += result.interceptsCreated;
        totalRevenue += result.potentialRevenue;
        successCount++;

        console.log(`  ✓ Found ${result.billsFound} bills, created ${result.interceptsCreated} intercepts`);
      } catch (error) {
        failCount++;
        console.error(`  ✗ Failed to sync ${connection.id}:`, error.message);

        // Log error to database
        await sql`
          INSERT INTO erp_sync_logs (
            erp_connection_id,
            sync_type,
            status,
            error_message,
            started_at,
            completed_at
          ) VALUES (
            ${connection.id},
            'scheduled',
            'failed',
            ${error.message},
            NOW(),
            NOW()
          )
        `;
      }
    }

    console.log('\n--- Sync Summary ---');
    console.log(`Connections processed: ${successCount + failCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total bills found: ${totalBills}`);
    console.log(`Total intercepts created: ${totalIntercepts}`);
    console.log(`Potential revenue: $${totalRevenue.toFixed(2)}`);

    // Log summary
    await sql`
      INSERT INTO erp_sync_logs (
        erp_connection_id,
        sync_type,
        status,
        records_fetched,
        intercepts_created,
        started_at,
        completed_at
      ) VALUES (
        NULL,
        'scheduled_batch',
        'completed',
        ${totalBills},
        ${totalIntercepts},
        NOW(),
        NOW()
      )
    `;

    return {
      success: true,
      connectionsProcessed: successCount + failCount,
      billsFound: totalBills,
      interceptsCreated: totalIntercepts,
      potentialRevenue: totalRevenue,
    };
  } catch (error) {
    console.error('Cron job failed:', error);
    throw error;
  }
}

// Auto-execute intercepts that have been accepted
async function executeAcceptedIntercepts() {
  console.log('\nExecuting accepted intercepts...');

  try {
    // Get intercepts that are accepted but not executed
    // and payment date is today or earlier
    const intercepts = await sql`
      SELECT i.id, i.bill_amount, b.vendor_name, b.due_date
      FROM erp_intercepts i
      JOIN erp_bills b ON i.erp_bill_id = b.id
      WHERE i.status = 'accepted'
      AND b.due_date <= CURRENT_DATE + INTERVAL '1 day'
      ORDER BY b.due_date ASC
      LIMIT 100
    `;

    console.log(`Found ${intercepts.length} intercepts ready for execution`);

    let successCount = 0;
    let failCount = 0;
    let totalAmount = 0;

    for (const intercept of intercepts) {
      try {
        console.log(`Executing payment to ${intercept.vendor_name} for $${intercept.bill_amount}`);

        await interceptService.executeIntercept(intercept.id);

        totalAmount += intercept.bill_amount;
        successCount++;

        console.log(`  ✓ Payment executed`);
      } catch (error) {
        failCount++;
        console.error(`  ✗ Failed to execute ${intercept.id}:`, error.message);
      }
    }

    console.log('\n--- Execution Summary ---');
    console.log(`Payments processed: ${successCount + failCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total amount: $${totalAmount.toFixed(2)}`);

    return {
      success: true,
      paymentsProcessed: successCount + failCount,
      totalAmount,
    };
  } catch (error) {
    console.error('Intercept execution failed:', error);
    throw error;
  }
}

// Expire old proposals
async function expireOldProposals() {
  console.log('\nExpiring old proposals...');

  try {
    const result = await sql`
      UPDATE erp_intercepts
      SET status = 'expired'
      WHERE status = 'proposed'
      AND proposal_expires_at <= NOW()
      RETURNING id
    `;

    console.log(`Expired ${result.length} old proposals`);

    return {
      success: true,
      expired: result.length,
    };
  } catch (error) {
    console.error('Failed to expire proposals:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('=== ERP Sync Cron Job Started ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // 1. Sync all connections
    const syncResult = await syncAllConnections();

    // 2. Execute accepted intercepts
    const executeResult = await executeAcceptedIntercepts();

    // 3. Expire old proposals
    const expireResult = await expireOldProposals();

    console.log('\n=== Cron Job Completed Successfully ===');

    return {
      success: true,
      sync: syncResult,
      execute: executeResult,
      expire: expireResult,
    };
  } catch (error) {
    console.error('\n=== Cron Job Failed ===');
    console.error(error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { main as erpSyncCron };
