// Attribution Connection Service
// Manages peer-to-peer connections (30 max per user)

import { sqlQuery as sql } from '@/lib/db'
import {
  AttrConnection,
  ConnectionWithUser,
  ConnectionsResponse,
  ConnectionStatus,
  MAX_CONNECTIONS,
} from './types'

// ============================================================================
// QUERIES
// ============================================================================

export async function getConnectionCount(userId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM attr_connections
    WHERE (requester_id = ${userId} OR accepter_id = ${userId})
      AND status = 'active'
  `
  return parseInt(result.rows[0]?.count || '0', 10)
}

export async function getUserConnections(userId: string): Promise<ConnectionWithUser[]> {
  const result = await sql`
    SELECT
      c.id as connection_id,
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_id ELSE c.requester_id END as user_id,
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_name ELSE c.requester_name END as display_name,
      CASE WHEN c.requester_id = ${userId} THEN c.accepter_email ELSE c.requester_email END as email,
      CASE WHEN c.requester_id = ${userId} THEN 'sent' ELSE 'received' END as direction,
      c.status,
      c.accepted_at as connected_at
    FROM attr_connections c
    WHERE (c.requester_id = ${userId} OR c.accepter_id = ${userId})
      AND c.status = 'active'
    ORDER BY c.accepted_at DESC
  `

  return result.rows.map(row => ({
    connectionId: row.connection_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    direction: row.direction as 'sent' | 'received',
    status: row.status as ConnectionStatus,
    connectedAt: row.connected_at ? new Date(row.connected_at) : undefined,
  }))
}

export async function getPendingRequests(userId: string): Promise<{
  sent: ConnectionWithUser[]
  received: ConnectionWithUser[]
}> {
  const result = await sql`
    SELECT
      c.id as connection_id,
      c.requester_id,
      c.accepter_id,
      c.requester_name,
      c.accepter_name,
      c.requester_email,
      c.accepter_email,
      c.status,
      c.created_at
    FROM attr_connections c
    WHERE (c.requester_id = ${userId} OR c.accepter_id = ${userId})
      AND c.status = 'pending'
    ORDER BY c.created_at DESC
  `

  const sent: ConnectionWithUser[] = []
  const received: ConnectionWithUser[] = []

  for (const row of result.rows) {
    if (row.requester_id === userId) {
      sent.push({
        connectionId: row.connection_id,
        userId: row.accepter_id,
        displayName: row.accepter_name,
        email: row.accepter_email,
        direction: 'sent',
        status: 'pending',
        connectedAt: new Date(row.created_at),
      })
    } else {
      received.push({
        connectionId: row.connection_id,
        userId: row.requester_id,
        displayName: row.requester_name,
        email: row.requester_email,
        direction: 'received',
        status: 'pending',
        connectedAt: new Date(row.created_at),
      })
    }
  }

  return { sent, received }
}

export async function getConnectionsResponse(userId: string): Promise<ConnectionsResponse> {
  const [connections, pendingRequests, count] = await Promise.all([
    getUserConnections(userId),
    getPendingRequests(userId),
    getConnectionCount(userId),
  ])

  return {
    connections,
    count,
    maxConnections: MAX_CONNECTIONS,
    remaining: MAX_CONNECTIONS - count,
    pendingRequests,
  }
}

export async function getConnectionById(connectionId: string): Promise<AttrConnection | null> {
  const result = await sql`
    SELECT * FROM attr_connections WHERE id = ${connectionId}
  `
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}

export async function checkExistingConnection(
  userId1: string,
  userId2: string
): Promise<AttrConnection | null> {
  const result = await sql`
    SELECT * FROM attr_connections
    WHERE (requester_id = ${userId1} AND accepter_id = ${userId2})
       OR (requester_id = ${userId2} AND accepter_id = ${userId1})
  `
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}

export async function areUsersConnected(userId1: string, userId2: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM attr_connections
    WHERE ((requester_id = ${userId1} AND accepter_id = ${userId2})
       OR (requester_id = ${userId2} AND accepter_id = ${userId1}))
      AND status = 'active'
    LIMIT 1
  `
  return result.rows.length > 0
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function createConnectionRequest(
  requesterId: string,
  accepterId: string,
  requesterName?: string,
  requesterEmail?: string,
  accepterName?: string,
  accepterEmail?: string
): Promise<AttrConnection> {
  // Check limit
  const count = await getConnectionCount(requesterId)
  if (count >= MAX_CONNECTIONS) {
    throw new Error(`Connection limit reached (${MAX_CONNECTIONS} max)`)
  }

  // Check if already exists
  const existing = await checkExistingConnection(requesterId, accepterId)
  if (existing) {
    if (existing.status === 'active') {
      throw new Error('Already connected')
    }
    if (existing.status === 'pending') {
      throw new Error('Connection request already pending')
    }
    // If declined/removed, allow new request
  }

  // Can't connect to self
  if (requesterId === accepterId) {
    throw new Error('Cannot connect to yourself')
  }

  const result = await sql`
    INSERT INTO attr_connections (
      requester_id, accepter_id,
      requester_name, requester_email,
      accepter_name, accepter_email,
      status
    )
    VALUES (
      ${requesterId}, ${accepterId},
      ${requesterName || null}, ${requesterEmail || null},
      ${accepterName || null}, ${accepterEmail || null},
      'pending'
    )
    ON CONFLICT (requester_id, accepter_id)
    DO UPDATE SET
      status = 'pending',
      updated_at = NOW()
    RETURNING *
  `

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}

export async function acceptConnection(
  connectionId: string,
  userId: string
): Promise<AttrConnection> {
  // Verify user is the accepter
  const connection = await getConnectionById(connectionId)
  if (!connection) {
    throw new Error('Connection not found')
  }
  if (connection.accepterId !== userId) {
    throw new Error('Not authorized to accept this connection')
  }
  if (connection.status !== 'pending') {
    throw new Error('Connection is not pending')
  }

  // Check accepter's limit
  const count = await getConnectionCount(userId)
  if (count >= MAX_CONNECTIONS) {
    throw new Error(`Connection limit reached (${MAX_CONNECTIONS} max)`)
  }

  const result = await sql`
    UPDATE attr_connections
    SET status = 'active',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = ${connectionId}
    RETURNING *
  `

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}

export async function declineConnection(
  connectionId: string,
  userId: string
): Promise<AttrConnection> {
  const connection = await getConnectionById(connectionId)
  if (!connection) {
    throw new Error('Connection not found')
  }
  if (connection.accepterId !== userId) {
    throw new Error('Not authorized to decline this connection')
  }
  if (connection.status !== 'pending') {
    throw new Error('Connection is not pending')
  }

  const result = await sql`
    UPDATE attr_connections
    SET status = 'declined',
        updated_at = NOW()
    WHERE id = ${connectionId}
    RETURNING *
  `

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}

export async function removeConnection(
  connectionId: string,
  userId: string
): Promise<AttrConnection> {
  const connection = await getConnectionById(connectionId)
  if (!connection) {
    throw new Error('Connection not found')
  }
  if (connection.requesterId !== userId && connection.accepterId !== userId) {
    throw new Error('Not authorized to remove this connection')
  }
  if (connection.status !== 'active') {
    throw new Error('Connection is not active')
  }

  const result = await sql`
    UPDATE attr_connections
    SET status = 'removed',
        updated_at = NOW()
    WHERE id = ${connectionId}
    RETURNING *
  `

  const row = result.rows[0]
  return {
    id: row.id,
    requesterId: row.requester_id,
    accepterId: row.accepter_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    accepterName: row.accepter_name,
    accepterEmail: row.accepter_email,
    status: row.status as ConnectionStatus,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    updatedAt: new Date(row.updated_at),
  }
}
