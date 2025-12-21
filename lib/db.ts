// @ts-nocheck
/**
 * Database Connection - Vercel Postgres with proper pooling
 * Use getDb() for all database queries to ensure proper connection handling
 *
 * IMPORTANT: This module now uses proper connection pooling via sql tagged template
 * For transactions, use withTransaction() to ensure proper isolation
 */

import { createClient, sql as vercelSql, createPool, VercelPool, VercelClient } from '@vercel/postgres'

// Type for SQL query result
type QueryResult<T = any> = {
  rows: T[]
  rowCount: number
  fields: Array<{ name: string; dataTypeID: number }>
}

// Singleton pool instance for reuse across requests
let pool: VercelPool | null = null

/**
 * Get the shared connection pool
 * Creates pool lazily on first use
 */
function getPool(): VercelPool {
  if (!pool) {
    pool = createPool({
      connectionString: process.env.POSTGRES_URL,
      max: 10, // Maximum connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring connection
    })
  }
  return pool
}

/**
 * Get a database client with proper pooling
 * Uses the environment's POSTGRES_URL with pooling support
 *
 * WARNING: If you use this directly, you MUST call client.release() when done
 * Prefer using query() or sqlQuery() for automatic connection management
 */
export async function getDb(): Promise<VercelClient> {
  const pool = getPool()
  const client = await pool.connect()
  return client as unknown as VercelClient
}

/**
 * Execute a SQL query using proper pooling
 * This is the recommended way to run queries in serverless environments
 * Connection is automatically returned to pool after query
 */
export async function query<T = any>(
  queryText: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  const result = await pool.query(queryText, params)
  return result as QueryResult<T>
}

/**
 * Execute multiple queries within a transaction
 * Ensures ACID properties for financial operations
 *
 * @param callback - Function that receives a client and executes queries
 * @returns The result of the callback function
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId])
 *   await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId])
 *   return { success: true }
 * })
 */
export async function withTransaction<T>(
  callback: (client: VercelClient) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client as unknown as VercelClient)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Execute a SQL query using the sql template tag
 * Wrapper that handles connection issues gracefully
 */
export async function sqlQuery<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<QueryResult<T>> {
  try {
    // First try the built-in sql tag
    return await vercelSql(strings, ...values) as QueryResult<T>
  } catch (error: any) {
    // If connection string error, fallback to createClient
    if (error?.code === 'invalid_connection_string') {
      const queryText = strings.reduce((acc, str, i) => {
        return acc + str + (values[i] !== undefined ? `$${i + 1}` : '')
      }, '')
      return await query<T>(queryText, values)
    }
    throw error
  }
}

// Re-export for convenience (but prefer sqlQuery for reliability)
export { vercelSql as sql }

/**
 * Get a safe SQL client that works in both development and production
 */
export function getSafeClient() {
  return {
    query: async <T = any>(queryText: string, params?: any[]): Promise<QueryResult<T>> => {
      return query<T>(queryText, params)
    }
  }
}

export default {
  query,
  sqlQuery,
  getDb,
  getSafeClient,
  withTransaction
}
