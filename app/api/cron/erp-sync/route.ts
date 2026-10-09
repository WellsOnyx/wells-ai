// Vercel Cron endpoint for ERP sync
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/erp-sync",
//     "schedule": "0 * * * *"
//   }]
// }

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { interceptService } from '@/lib/erp/intercept-service';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting ERP sync cron job...');

    // Get all active connections due for sync
    const connections = await sql`
      SELECT id, provider, company_name
      FROM erp_connections
      WHERE connection_status = 'active'
      AND auto_intercept_enabled = true
      AND (next_sync_at IS NULL OR next_sync_at <= NOW())
      ORDER BY last_sync_at ASC NULLS FIRST
      LIMIT 50
    `;

    let totalBills = 0;
    let totalIntercepts = 0;
    let totalRevenue = 0;

    // Sync each connection
    for (const connection of connections) {
      try {
        const result = await interceptService.scanForPayables(connection.id);
        totalBills += result.billsFound;
        totalIntercepts += result.interceptsCreated;
        totalRevenue += result.potentialRevenue;
      } catch (error) {
        console.error(`Failed to sync ${connection.id}:`, error);
      }
    }

    // Execute accepted intercepts
    const intercepts = await sql`
      SELECT i.id
      FROM erp_intercepts i
      JOIN erp_bills b ON i.erp_bill_id = b.id
      WHERE i.status = 'accepted'
      AND b.due_date <= CURRENT_DATE + INTERVAL '1 day'
      LIMIT 50
    `;

    let executed = 0;
    for (const intercept of intercepts) {
      try {
        await interceptService.executeIntercept(intercept.id);
        executed++;
      } catch (error) {
        console.error(`Failed to execute ${intercept.id}:`, error);
      }
    }

    // Expire old proposals
    const expired = await sql`
      UPDATE erp_intercepts
      SET status = 'expired'
      WHERE status = 'proposed'
      AND proposal_expires_at <= NOW()
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      connections: connections.length,
      billsFound: totalBills,
      interceptsCreated: totalIntercepts,
      potentialRevenue: totalRevenue,
      interceptsExecuted: executed,
      proposalsExpired: expired.length,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}
