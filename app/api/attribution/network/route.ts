// Attribution Network Tree API
// GET: Get full 4-level network tree visualization

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getNetworkTree } from '@/lib/attribution/network-service'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tree = await getNetworkTree(userId)
    return NextResponse.json(tree)
  } catch (error) {
    console.error('Error getting network tree:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get network tree' },
      { status: 500 }
    )
  }
}
