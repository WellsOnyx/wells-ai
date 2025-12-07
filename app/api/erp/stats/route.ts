// ERP Stats API - Dashboard statistics
import { NextRequest, NextResponse } from 'next/server';
import { interceptService } from '@/lib/erp/intercept-service';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    const stats = await interceptService.getDashboardStats(connectionId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
