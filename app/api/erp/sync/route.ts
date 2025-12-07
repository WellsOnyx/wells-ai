// ERP Sync API - Trigger manual sync or get sync status
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { interceptService } from '@/lib/erp/intercept-service';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  try {
    const { connectionId } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Trigger sync
    const result = await interceptService.scanForPayables(connectionId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Get sync status
    const [connection] = await sql`
      SELECT
        last_sync_at,
        last_sync_status,
        last_sync_error,
        next_sync_at
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Get recent sync logs
    const logs = await sql`
      SELECT *
      FROM erp_sync_logs
      WHERE erp_connection_id = ${connectionId}
      ORDER BY started_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      connection,
      logs,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
