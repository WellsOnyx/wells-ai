// Attribution Network Service
// Manages network tree visualization and stats

import { sqlQuery as sql } from '@/lib/db'
import {
  NetworkTreeNode,
  NetworkTreeResponse,
  NetworkStatsResponse,
  AttrNetworkStats,
  MAX_CONNECTIONS,
} from './types'
import { getConnectionCount } from './connection-service'

// ============================================================================
// QUERIES
// ============================================================================

export async function getNetworkStats(userId: string): Promise<AttrNetworkStats | null> {
  const result = await sql`
    SELECT * FROM attr_network_stats WHERE user_id = ${userId}
  `
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    userId: row.user_id,
    directConnections: parseInt(row.direct_connections || '0', 10),
    l1NetworkSize: parseInt(row.l1_network_size || '0', 10),
    l2NetworkSize: parseInt(row.l2_network_size || '0', 10),
    l3NetworkSize: parseInt(row.l3_network_size || '0', 10),
    l4NetworkSize: parseInt(row.l4_network_size || '0', 10),
    totalNetworkSize: parseInt(row.total_network_size || '0', 10),
    totalOffersCreated: parseInt(row.total_offers_created || '0', 10),
    totalOffersClosed: parseInt(row.total_offers_closed || '0', 10),
    totalIntroductionsMade: parseInt(row.total_introductions_made || '0', 10),
    totalIntroductionsReceived: parseInt(row.total_introductions_received || '0', 10),
    l1TotalEarned: parseFloat(row.l1_total_earned || '0'),
    l2TotalEarned: parseFloat(row.l2_total_earned || '0'),
    l3TotalEarned: parseFloat(row.l3_total_earned || '0'),
    l4TotalEarned: parseFloat(row.l4_total_earned || '0'),
    totalEarned: parseFloat(row.total_earned || '0'),
    totalGrainEarned: parseInt(row.total_grain_earned || '0', 10),
    monthlyEarned: parseFloat(row.monthly_earned || '0'),
    monthlyGrainEarned: parseInt(row.monthly_grain_earned || '0', 10),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export async function getNetworkStatsResponse(userId: string): Promise<NetworkStatsResponse> {
  // Get direct connection count
  const directConnections = await getConnectionCount(userId)

  // Get offer counts
  const offerResult = await sql`
    SELECT
      COUNT(*) as created,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active
    FROM attr_offers
    WHERE owner_id = ${userId}
  `
  const offerRow = offerResult.rows[0] || {}

  // Get introduction counts
  const introResult = await sql`
    SELECT
      (SELECT COUNT(*) FROM attr_introductions WHERE introducer_id = ${userId}) as made,
      (SELECT COUNT(*) FROM attr_introductions WHERE recipient_id = ${userId}) as received,
      (SELECT COUNT(*) FROM attr_introductions WHERE recipient_id = ${userId} AND status = 'converted') as converted
  `
  const introRow = introResult.rows[0] || {}

  // Get earnings
  const earningsResult = await sql`
    SELECT
      COALESCE(SUM(commission_usd), 0) as total,
      COALESCE(SUM(grain_amount), 0) as total_grain,
      COALESCE(SUM(CASE WHEN level = 1 THEN commission_usd ELSE 0 END), 0) as l1,
      COALESCE(SUM(CASE WHEN level = 2 THEN commission_usd ELSE 0 END), 0) as l2,
      COALESCE(SUM(CASE WHEN level = 3 THEN commission_usd ELSE 0 END), 0) as l3,
      COALESCE(SUM(CASE WHEN level = 4 THEN commission_usd ELSE 0 END), 0) as l4,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN commission_usd ELSE 0 END), 0) as monthly,
      COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN grain_amount ELSE 0 END), 0) as monthly_grain
    FROM attr_commissions
    WHERE recipient_id = ${userId} AND status = 'credited'
  `
  const earningsRow = earningsResult.rows[0] || {}

  // Get network sizes (L2, L3, L4 through connections of connections)
  const networkResult = await sql`
    WITH RECURSIVE network AS (
      -- L1: Direct connections
      SELECT
        CASE WHEN requester_id = ${userId} THEN accepter_id ELSE requester_id END as user_id,
        1 as level
      FROM attr_connections
      WHERE (requester_id = ${userId} OR accepter_id = ${userId}) AND status = 'active'

      UNION ALL

      -- L2, L3, L4: Connections of connections
      SELECT
        CASE WHEN c.requester_id = n.user_id THEN c.accepter_id ELSE c.requester_id END as user_id,
        n.level + 1 as level
      FROM attr_connections c
      JOIN network n ON (c.requester_id = n.user_id OR c.accepter_id = n.user_id)
      WHERE c.status = 'active'
        AND n.level < 4
        AND CASE WHEN c.requester_id = n.user_id THEN c.accepter_id ELSE c.requester_id END != ${userId}
    )
    SELECT
      level,
      COUNT(DISTINCT user_id) as count
    FROM network
    GROUP BY level
    ORDER BY level
  `

  const networkSizes = { l1: 0, l2: 0, l3: 0, l4: 0 }
  for (const row of networkResult.rows) {
    const level = parseInt(row.level, 10)
    const count = parseInt(row.count, 10)
    if (level === 1) networkSizes.l1 = count
    else if (level === 2) networkSizes.l2 = count
    else if (level === 3) networkSizes.l3 = count
    else if (level === 4) networkSizes.l4 = count
  }

  const totalNetwork = networkSizes.l1 + networkSizes.l2 + networkSizes.l3 + networkSizes.l4

  return {
    connections: {
      direct: directConnections,
      l2: networkSizes.l2,
      l3: networkSizes.l3,
      l4: networkSizes.l4,
      total: totalNetwork,
      remaining: MAX_CONNECTIONS - directConnections,
    },
    earnings: {
      byLevel: {
        l1: parseFloat(earningsRow.l1 || '0'),
        l2: parseFloat(earningsRow.l2 || '0'),
        l3: parseFloat(earningsRow.l3 || '0'),
        l4: parseFloat(earningsRow.l4 || '0'),
      },
      total: parseFloat(earningsRow.total || '0'),
      monthly: parseFloat(earningsRow.monthly || '0'),
    },
    grain: {
      total: parseInt(earningsRow.total_grain || '0', 10),
      monthly: parseInt(earningsRow.monthly_grain || '0', 10),
    },
    offers: {
      created: parseInt(offerRow.created || '0', 10),
      closed: parseInt(offerRow.closed || '0', 10),
      active: parseInt(offerRow.active || '0', 10),
    },
    introductions: {
      made: parseInt(introRow.made || '0', 10),
      received: parseInt(introRow.received || '0', 10),
      converted: parseInt(introRow.converted || '0', 10),
    },
  }
}

export async function getNetworkTree(userId: string): Promise<NetworkTreeResponse> {
  // Get L1 connections (direct)
  const l1Result = await sql`
    SELECT
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_id ELSE c.requester_id END as user_id,
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_name ELSE c.requester_name END as display_name,
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_email ELSE c.requester_email END as email
    FROM attr_connections c
    WHERE (c.requester_id = ${userId} OR c.accepter_id = ${userId})
      AND c.status = 'active'
  `

  const level1Nodes: NetworkTreeNode[] = []

  for (const l1Row of l1Result.rows) {
    const l1UserId = l1Row.user_id

    // Get L2 connections for this L1 user
    const l2Result = await sql`
      SELECT
        CASE WHEN c.requester_id = ${l1UserId} THEN c.accepter_id ELSE c.requester_id END as user_id,
        CASE WHEN c.requester_id = ${l1UserId} THEN c.accepter_name ELSE c.requester_name END as display_name
      FROM attr_connections c
      WHERE (c.requester_id = ${l1UserId} OR c.accepter_id = ${l1UserId})
        AND c.status = 'active'
        AND CASE WHEN c.requester_id = ${l1UserId} THEN c.accepter_id ELSE c.requester_id END != ${userId}
      LIMIT 10
    `

    const level2Nodes: NetworkTreeNode[] = []

    for (const l2Row of l2Result.rows) {
      const l2UserId = l2Row.user_id

      // Get L3 connections for this L2 user
      const l3Result = await sql`
        SELECT
          CASE WHEN c.requester_id = ${l2UserId} THEN c.accepter_id ELSE c.requester_id END as user_id,
          CASE WHEN c.requester_id = ${l2UserId} THEN c.accepter_name ELSE c.requester_name END as display_name
        FROM attr_connections c
        WHERE (c.requester_id = ${l2UserId} OR c.accepter_id = ${l2UserId})
          AND c.status = 'active'
          AND CASE WHEN c.requester_id = ${l2UserId} THEN c.accepter_id ELSE c.requester_id END != ${l1UserId}
          AND CASE WHEN c.requester_id = ${l2UserId} THEN c.accepter_id ELSE c.requester_id END != ${userId}
        LIMIT 5
      `

      const level3Nodes: NetworkTreeNode[] = l3Result.rows.map(l3Row => ({
        userId: l3Row.user_id,
        displayName: l3Row.display_name,
        networkSize: 0,
        earnings: 0,
        children: [], // L4 would go here, but keeping it simple
      }))

      level2Nodes.push({
        userId: l2Row.user_id,
        displayName: l2Row.display_name,
        networkSize: level3Nodes.length,
        earnings: 0,
        children: level3Nodes,
      })
    }

    // Get earnings for this L1 connection
    const earningsResult = await sql`
      SELECT COALESCE(SUM(commission_usd), 0) as earnings
      FROM attr_commissions
      WHERE recipient_id = ${l1UserId} AND status = 'credited'
    `

    level1Nodes.push({
      userId: l1Row.user_id,
      displayName: l1Row.display_name,
      email: l1Row.email,
      networkSize: level2Nodes.reduce((sum, n) => sum + 1 + n.networkSize, 0),
      earnings: parseFloat(earningsResult.rows[0]?.earnings || '0'),
      children: level2Nodes,
    })
  }

  // Calculate totals
  const totalL1 = level1Nodes.length
  const totalL2 = level1Nodes.reduce((sum, n) => sum + (n.children?.length || 0), 0)
  const totalL3 = level1Nodes.reduce((sum, n) =>
    sum + (n.children?.reduce((s2, n2) => s2 + (n2.children?.length || 0), 0) || 0), 0)

  return {
    tree: {
      self: {
        userId,
        displayName: undefined, // Would need to fetch user info
      },
      level1: level1Nodes,
    },
    stats: {
      totalReach: totalL1 + totalL2 + totalL3,
      byLevel: {
        l1: totalL1,
        l2: totalL2,
        l3: totalL3,
        l4: 0, // Simplified - not going that deep
      },
    },
  }
}

export async function getLeaderboard(limit: number = 10): Promise<Array<{
  userId: string
  displayName?: string
  totalEarned: number
  totalGrain: number
  networkSize: number
}>> {
  const result = await sql`
    SELECT
      s.user_id,
      s.total_earned,
      s.total_grain_earned,
      s.direct_connections as network_size,
      (
        SELECT c.requester_name
        FROM attr_connections c
        WHERE c.requester_id = s.user_id
        LIMIT 1
      ) as display_name
    FROM attr_network_stats s
    ORDER BY s.total_earned DESC
    LIMIT ${limit}
  `

  return result.rows.map(row => ({
    userId: row.user_id,
    displayName: row.display_name,
    totalEarned: parseFloat(row.total_earned || '0'),
    totalGrain: parseInt(row.total_grain_earned || '0', 10),
    networkSize: parseInt(row.network_size || '0', 10),
  }))
}
