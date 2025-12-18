// ERP Intercepts API - Manage payment intercepts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { interceptService } from '@/lib/erp/intercept-service';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// Get all intercepts for a connection
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status'); // proposed, accepted, rejected, executed

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    let query = sql`
      SELECT
        i.*,
        b.vendor_name,
        b.bill_number,
        b.due_date,
        b.total_amount
      FROM erp_intercepts i
      JOIN erp_bills b ON i.erp_bill_id = b.id
      WHERE i.erp_connection_id = ${connectionId}
    `;

    if (status) {
      query = sql`
        SELECT
          i.*,
          b.vendor_name,
          b.bill_number,
          b.due_date,
          b.total_amount
        FROM erp_intercepts i
        JOIN erp_bills b ON i.erp_bill_id = b.id
        WHERE i.erp_connection_id = ${connectionId}
        AND i.status = ${status}
      `;
    }

    const intercepts = await query;

    return NextResponse.json({ intercepts });
  } catch (error) {
    console.error('Get intercepts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get intercepts' },
      { status: 500 }
    );
  }
}

// Approve intercept
export async function POST(req: NextRequest) {
  try {
    const { interceptId, action } = await req.json();

    if (!interceptId || !action) {
      return NextResponse.json(
        { error: 'interceptId and action required' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      await interceptService.approveIntercept(interceptId);
      return NextResponse.json({ success: true, message: 'Intercept approved' });
    } else if (action === 'reject') {
      await interceptService.rejectIntercept(interceptId);
      return NextResponse.json({ success: true, message: 'Intercept rejected' });
    } else if (action === 'execute') {
      await interceptService.executeIntercept(interceptId);
      return NextResponse.json({ success: true, message: 'Payment executed' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Intercept action error:', error);
    return NextResponse.json(
      { error: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
