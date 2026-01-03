import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Test DB] Starting...');
    const start = Date.now();

    const result = await query('SELECT NOW() as now', []);

    const elapsed = Date.now() - start;
    console.log('[Test DB] Query took:', elapsed, 'ms');

    return NextResponse.json({
      success: true,
      now: result.rows[0]?.now,
      elapsedMs: elapsed,
    });
  } catch (error: any) {
    console.error('[Test DB] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
