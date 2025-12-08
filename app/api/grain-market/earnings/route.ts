// @ts-nocheck
import { NextResponse } from 'next/server';
import { getLenderPerformance, getLendingPoolStats } from '@/lib/lending/grain-market';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/grain-market/earnings
 * Get lender earnings and performance
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lender_id = searchParams.get('lender_id');
    const action = searchParams.get('action') || 'performance';

    if (action === 'stats') {
      // Get global pool stats
      const result = await getLendingPoolStats();

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        stats: result.stats,
      });
    } else if (action === 'performance') {
      // Get lender-specific performance
      if (!lender_id) {
        return NextResponse.json(
          { success: false, error: 'Lender ID is required' },
          { status: 400 }
        );
      }

      const result = await getLenderPerformance(lender_id);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        ...result,
      });
    } else if (action === 'history') {
      // Get detailed earnings history
      if (!lender_id) {
        return NextResponse.json(
          { success: false, error: 'Lender ID is required' },
          { status: 400 }
        );
      }

      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      const { data: earnings, error } = await supabase
        .from('grain_lender_earnings')
        .select(`
          *,
          grain_lending_matches (
            loan_id,
            borrower_id,
            grain_backed
          )
        `)
        .eq('lender_id', lender_id)
        .order('payment_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get total count
      const { count, error: countError } = await supabase
        .from('grain_lender_earnings')
        .select('*', { count: 'exact', head: true })
        .eq('lender_id', lender_id);

      if (countError) throw countError;

      return NextResponse.json({
        success: true,
        earnings: earnings || [],
        total: count || 0,
        limit,
        offset,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
