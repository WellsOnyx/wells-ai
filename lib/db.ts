// @ts-nocheck
/**
 * Database Connection - Vercel Postgres with proper pooling
 * Use getDb() for all database queries to ensure proper connection handling
 */

import { createClient, sql as vercelSql, VercelPool, VercelClient } from '@vercel/postgres'

// Type for SQL query result
type QueryResult<T = any> = {
  rows: T[]
  rowCount: number
  fields: Array<{ name: string; dataTypeID: number }>
}

// Create a pooled client for use in serverless functions
let clientPool: VercelPool | null = null

/**
 * Get a database client with proper pooling
 * Uses the environment's POSTGRES_URL with pooling support
 */
export async function getDb(): Promise<VercelClient> {
  // Try to use the createClient approach which handles pooling automatically
  const client = createClient()
  await client.connect()
  return client
}

/**
 * Execute a SQL query using proper pooling
 * This is the recommended way to run queries in serverless environments
 */
export async function query<T = any>(
  queryText: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = createClient()

  try {
    await client.connect()
    const result = await client.query(queryText, params)
    return result as QueryResult<T>
  } finally {
    // Always end the client connection
    await client.end().catch(() => {})
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
  getSafeClient
}
