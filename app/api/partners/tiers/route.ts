/**
 * Partner Tiers API
 *
 * GET - Get all available partner tiers (public)
 */

import { NextResponse } from 'next/server'
import { getAllTiers } from '@/lib/partners/service'

export async function GET() {
  try {
    const tiers = await getAllTiers()
    return NextResponse.json({ tiers })
  } catch (error) {
    console.error('Tiers GET error:', error)
    return NextResponse.json({ error: 'Failed to get tiers' }, { status: 500 })
  }
}
