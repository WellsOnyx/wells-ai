// ERP Bills API
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status'); // pending, intercepted, paid_external

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    let query;
    if (status) {
      query = sql`
        SELECT * FROM erp_bills
        WHERE erp_connection_id = ${connectionId}
        AND status = ${status}
        ORDER BY due_date ASC
      `;
    } else {
      query = sql`
        SELECT * FROM erp_bills
        WHERE erp_connection_id = ${connectionId}
        AND status = 'pending'
        ORDER BY due_date ASC
      `;
    }

    const bills = await query;

    return NextResponse.json({ bills });
  } catch (error) {
    console.error('Get bills error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get bills' },
      { status: 500 }
    );
  }
}
