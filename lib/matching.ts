import { query } from './db'

/**
 * Simple supplier matching
 * TODO: Replace with actual AI-powered matching from Week 4
 */

export interface SupplierMatch {
  supplier: any
  score: number
  reasons: string[]
}

export async function matchSuppliers(params: {
  productName?: string
  description?: string
  industry?: string
  location?: string
}): Promise<SupplierMatch[]> {
  try {
    // Simple SQL-based matching
    const result = await query<any>(
      `SELECT *
       FROM suppliers
       WHERE
         (industry ILIKE $1 OR $1 IS NULL)
         AND (location ILIKE $2 OR $2 IS NULL)
       LIMIT 10`,
      [params.industry ? `%${params.industry}%` : null, params.location ? `%${params.location}%` : null]
    )

    // Convert to matches with scores
    return result.rows.map((supplier) => ({
      supplier,
      score: Math.floor(Math.random() * 40 + 60), // Random score 60-100
      reasons: ['Industry match', 'Location match', 'High rating'],
    }))
  } catch (error) {
    console.error('[MATCHING] Error:', error)
    return []
  }
}
