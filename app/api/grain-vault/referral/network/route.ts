// @ts-nocheck
/**
 * Network Dashboard API - MLM Referral Network
 * GET: Get user's network stats and earnings
 * POST: Get network tree details
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sql } from '@vercel/postgres'

// Commission structure (% of 4.5% platform fee)
const COMMISSION_STRUCTURE = {
  1: { pct: 20, effective: 0.009, label: 'Direct Referrals' },     // 20% of 4.5% = 0.9%
  2: { pct: 10, effective: 0.0045, label: 'Level 2 Network' },    // 10% of 4.5% = 0.45%
  3: { pct: 5, effective: 0.00225, label: 'Level 3 Network' }     // 5% of 4.5% = 0.225%
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get network dashboard data
    const dashboard = await sql`
      SELECT * FROM network_dashboard
      WHERE user_id = ${userId}
    `

    if (dashboard.rows.length === 0) {
      // No network data yet - return empty state with commission info
      return NextResponse.json({
        hasNetwork: false,
        commissionStructure: COMMISSION_STRUCTURE,
        message: 'Start referring to build your network!'
      })
    }

    const data = dashboard.rows[0]

    // Get recent commissions
    const recentCommissions = await sql`
      SELECT
        nc.id,
        nc.level,
        nc.transaction_amount,
        nc.commission_amount,
        nc.grain_amount,
        nc.status,
        nc.created_at
      FROM network_commissions nc
      WHERE nc.recipient_id = ${userId}
      ORDER BY nc.created_at DESC
      LIMIT 20
    `

    // Get referral chain (who referred you)
    const chain = await sql`
      SELECT referrer_id, referrer_l2_id, referrer_l3_id, depth
      FROM referral_chains
      WHERE user_id = ${userId}
    `

    // Get direct referrals list
    const directReferrals = await sql`
      SELECT
        rc.user_id,
        rc.created_at,
        ns.total_network_size,
        ns.total_earned
      FROM referral_chains rc
      LEFT JOIN network_stats ns ON rc.user_id = ns.user_id
      WHERE rc.referrer_id = ${userId}
      ORDER BY rc.created_at DESC
      LIMIT 50
    `

    return NextResponse.json({
      hasNetwork: true,

      // Network size
      network: {
        directReferrals: data.direct_referrals || 0,
        l2NetworkSize: data.l2_network_size || 0,
        l3NetworkSize: data.l3_network_size || 0,
        totalNetworkSize: data.total_network_size || 0
      },

      // Earnings by level (in USD)
      earnings: {
        l1Total: parseFloat(data.l1_total_earned || 0),
        l2Total: parseFloat(data.l2_total_earned || 0),
        l3Total: parseFloat(data.l3_total_earned || 0),
        total: parseFloat(data.total_earned || 0),
        monthly: parseFloat(data.monthly_earned || 0)
      },

      // GRAIN earnings
      grain: {
        l1Earned: data.l1_grain_earned || 0,
        l2Earned: data.l2_grain_earned || 0,
        l3Earned: data.l3_grain_earned || 0,
        totalEarned: data.total_grain_earned || 0,
        monthlyEarned: data.monthly_grain_earned || 0
      },

      // Commission rates
      commissionRates: {
        l1: data.l1_commission_pct || 20,
        l2: data.l2_commission_pct || 10,
        l3: data.l3_commission_pct || 5
      },

      // Referral code
      referralCode: data.referral_code,
      customCode: data.custom_code,
      tier: data.tier,

      // Chain info
      myReferrer: chain.rows[0]?.referrer_id || null,
      chainDepth: chain.rows[0]?.depth || 0,

      // Recent activity
      recentCommissions: recentCommissions.rows.map(c => ({
        id: c.id,
        level: c.level,
        levelLabel: COMMISSION_STRUCTURE[c.level]?.label,
        transactionAmount: parseFloat(c.transaction_amount),
        commissionAmount: parseFloat(c.commission_amount),
        grainAmount: c.grain_amount,
        status: c.status,
        createdAt: c.created_at
      })),

      // Direct referrals
      directReferralsList: directReferrals.rows.map(r => ({
        userId: r.user_id.substring(0, 8) + '...', // Anonymize
        joinedAt: r.created_at,
        networkSize: r.total_network_size || 0,
        earnings: parseFloat(r.total_earned || 0)
      })),

      // Commission structure for display
      commissionStructure: COMMISSION_STRUCTURE,

      lastCommissionAt: data.last_commission_at,
      updatedAt: data.updated_at
    })
  } catch (error) {
    console.error('Error getting network dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to get network dashboard' },
      { status: 500 }
    )
  }
}

// Get network tree visualization data
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'get_tree') {
      // Get hierarchical tree data for visualization
      const tree = await sql`
        WITH RECURSIVE network_tree AS (
          -- Start with direct referrals
          SELECT
            user_id,
            referrer_id,
            1 as level,
            ARRAY[user_id] as path
          FROM referral_chains
          WHERE referrer_id = ${userId}

          UNION ALL

          -- Recursively get downstream
          SELECT
            rc.user_id,
            rc.referrer_id,
            nt.level + 1,
            nt.path || rc.user_id
          FROM referral_chains rc
          JOIN network_tree nt ON rc.referrer_id = nt.user_id
          WHERE nt.level < 3
          AND NOT rc.user_id = ANY(nt.path) -- Prevent cycles
        )
        SELECT
          nt.user_id,
          nt.referrer_id,
          nt.level,
          ns.total_network_size,
          ns.total_earned
        FROM network_tree nt
        LEFT JOIN network_stats ns ON nt.user_id = ns.user_id
        ORDER BY nt.level, nt.user_id
        LIMIT 100
      `

      return NextResponse.json({
        tree: tree.rows.map(n => ({
          id: n.user_id.substring(0, 8),
          parentId: n.referrer_id?.substring(0, 8),
          level: n.level,
          networkSize: n.total_network_size || 0,
          earnings: parseFloat(n.total_earned || 0)
        }))
      })
    }

    if (action === 'get_leaderboard') {
      const leaderboard = await sql`
        SELECT * FROM network_leaderboard LIMIT 25
      `

      return NextResponse.json({
        leaderboard: leaderboard.rows.map((row, idx) => ({
          rank: row.all_time_rank || idx + 1,
          userId: row.user_id.substring(0, 8) + '...',
          tier: row.tier,
          networkSize: row.total_network_size,
          totalEarned: parseFloat(row.total_earned),
          totalGrain: row.total_grain_earned,
          monthlyEarned: parseFloat(row.monthly_earned)
        }))
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in network POST:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
