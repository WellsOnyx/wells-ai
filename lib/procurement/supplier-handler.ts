/**
 * Supplier Handler
 * Handles conversational supplier management, search, and performance tracking
 */

import { query } from '../db'
import { ParsedIntent, ExecutionResult } from '../conversational-engine'

// ============================================
// Find Suppliers
// ============================================

export async function findSuppliers(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const keywords = entities.keywords || entities.product || entities.search
    const industry = entities.industry || entities.category
    const location = entities.location || entities.region
    const certifications = entities.certifications
    const minRating = entities.minRating || entities.rating

    // Build query
    let whereClause = 'WHERE status = $1'
    const params: any[] = ['active']
    let paramIndex = 2

    // Keyword search (name, description, products)
    if (keywords) {
      whereClause += ` AND (
        name ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        products ILIKE $${paramIndex}
      )`
      params.push(`%${keywords}%`)
      paramIndex++
    }

    // Industry filter
    if (industry) {
      whereClause += ` AND industry ILIKE $${paramIndex}`
      params.push(`%${industry}%`)
      paramIndex++
    }

    // Location filter
    if (location) {
      whereClause += ` AND (location ILIKE $${paramIndex} OR country ILIKE $${paramIndex})`
      params.push(`%${location}%`)
      paramIndex++
    }

    // Certification filter
    if (certifications) {
      whereClause += ` AND certifications @> ARRAY[$${paramIndex}]::text[]`
      params.push(certifications)
      paramIndex++
    }

    // Minimum rating filter
    if (minRating) {
      whereClause += ` AND rating >= $${paramIndex}`
      params.push(minRating)
      paramIndex++
    }

    const result = await query<any>(
      `SELECT
        id,
        name,
        email,
        phone,
        industry,
        location,
        country,
        products,
        certifications,
        rating,
        total_orders,
        on_time_delivery_rate,
        quality_score,
        created_at
       FROM suppliers
       ${whereClause}
       ORDER BY rating DESC, total_orders DESC
       LIMIT 25`,
      params
    )

    if (result.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          suppliers: [],
          message: 'No suppliers found matching your criteria. Try broader search terms.',
        },
      }
    }

    return {
      success: true,
      data: {
        count: result.rows.length,
        suppliers: result.rows.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          industry: s.industry,
          location: s.location,
          country: s.country,
          products: s.products,
          certifications: s.certifications || [],
          rating: parseFloat(s.rating || 0),
          totalOrders: s.total_orders || 0,
          onTimeDeliveryRate: parseFloat(s.on_time_delivery_rate || 0),
          qualityScore: parseFloat(s.quality_score || 0),
        })),
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Find suppliers error:', error)
    return {
      success: false,
      error: 'Failed to search suppliers',
    }
  }
}

// ============================================
// Get Supplier Performance
// ============================================

export async function getSupplierPerformance(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const supplierName = entities.supplier || entities.supplierName
    const supplierId = entities.supplierId
    const timeframe = entities.timeframe || '90 days' // '30 days', '90 days', '1 year'

    if (!supplierName && !supplierId) {
      return {
        success: false,
        error: 'Supplier name or ID is required. Which supplier would you like to review?',
      }
    }

    // Find supplier
    let supplier = null
    if (supplierId) {
      const result = await query<any>(`SELECT * FROM suppliers WHERE id = $1`, [supplierId])
      if (result.rows.length > 0) supplier = result.rows[0]
    } else {
      const result = await query<any>(`SELECT * FROM suppliers WHERE name ILIKE $1 LIMIT 1`, [
        `%${supplierName}%`,
      ])
      if (result.rows.length > 0) supplier = result.rows[0]
    }

    if (!supplier) {
      return {
        success: false,
        error: `Supplier "${supplierName || supplierId}" not found.`,
      }
    }

    // Get performance metrics for timeframe
    const metricsResult = await query<any>(
      `SELECT
        COUNT(*) as total_pos,
        SUM(total_amount) as total_value,
        AVG(CASE WHEN delivered_on_time THEN 100 ELSE 0 END) as on_time_rate,
        AVG(quality_rating) as avg_quality,
        AVG(response_time_hours) as avg_response_time,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
       FROM supplier_metrics
       WHERE supplier_id = $1 AND created_at >= NOW() - INTERVAL $2`,
      [supplier.id, timeframe]
    )

    const metrics = metricsResult.rows[0] || {}

    // Get recent issues
    const issuesResult = await query<any>(
      `SELECT issue_type, description, severity, created_at
       FROM supplier_issues
       WHERE supplier_id = $1 AND created_at >= NOW() - INTERVAL $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [supplier.id, timeframe]
    )

    // Calculate performance score
    const onTimeRate = parseFloat(metrics.on_time_rate || 0)
    const qualityScore = parseFloat(metrics.avg_quality || 0) * 20 // Convert 1-5 to 0-100
    const cancellationRate =
      parseInt(metrics.total_pos) > 0
        ? (parseInt(metrics.cancelled_count) / parseInt(metrics.total_pos)) * 100
        : 0

    const performanceScore = Math.round(
      onTimeRate * 0.5 + qualityScore * 0.4 - cancellationRate * 0.1
    )

    return {
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          rating: parseFloat(supplier.rating || 0),
        },
        timeframe,
        metrics: {
          totalPOs: parseInt(metrics.total_pos) || 0,
          totalValue: parseFloat(metrics.total_value) || 0,
          onTimeDeliveryRate: onTimeRate,
          averageQuality: parseFloat(metrics.avg_quality || 0),
          averageResponseTime: parseFloat(metrics.avg_response_time || 0),
          completedCount: parseInt(metrics.completed_count) || 0,
          cancelledCount: parseInt(metrics.cancelled_count) || 0,
          performanceScore,
        },
        recentIssues: issuesResult.rows.map(issue => ({
          type: issue.issue_type,
          description: issue.description,
          severity: issue.severity,
          date: issue.created_at,
        })),
        recommendation:
          performanceScore >= 80
            ? 'Excellent supplier - highly recommended'
            : performanceScore >= 60
              ? 'Good supplier - reliable choice'
              : performanceScore >= 40
                ? 'Average supplier - monitor closely'
                : 'Below average - consider alternatives',
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Get supplier performance error:', error)
    return {
      success: false,
      error: 'Failed to retrieve supplier performance data',
    }
  }
}

// ============================================
// Compare Suppliers
// ============================================

export async function compareSuppliers(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const suppliers = entities.suppliers || [] // Array of supplier names or IDs
    const criteria = entities.criteria || ['price', 'quality', 'delivery'] // What to compare

    if (!suppliers || suppliers.length < 2) {
      return {
        success: false,
        error: 'Please specify at least 2 suppliers to compare.',
      }
    }

    if (suppliers.length > 5) {
      return {
        success: false,
        error: 'Maximum 5 suppliers can be compared at once.',
      }
    }

    // Find all suppliers
    const supplierData = []
    for (const supplierIdentifier of suppliers) {
      const result = await query<any>(
        `SELECT * FROM suppliers WHERE name ILIKE $1 OR id = $2 LIMIT 1`,
        [`%${supplierIdentifier}%`, supplierIdentifier]
      )
      if (result.rows.length > 0) {
        supplierData.push(result.rows[0])
      }
    }

    if (supplierData.length < 2) {
      return {
        success: false,
        error: `Found only ${supplierData.length} supplier(s). Need at least 2 for comparison.`,
      }
    }

    // Get metrics for each supplier
    const comparison = []
    for (const supplier of supplierData) {
      const metricsResult = await query<any>(
        `SELECT
          AVG(total_amount) as avg_order_value,
          AVG(CASE WHEN delivered_on_time THEN 100 ELSE 0 END) as on_time_rate,
          AVG(quality_rating) as avg_quality,
          AVG(response_time_hours) as avg_response_time,
          COUNT(*) as total_orders
         FROM supplier_metrics
         WHERE supplier_id = $1 AND created_at >= NOW() - INTERVAL '90 days'`,
        [supplier.id]
      )

      const metrics = metricsResult.rows[0] || {}

      comparison.push({
        supplier: {
          id: supplier.id,
          name: supplier.name,
          rating: parseFloat(supplier.rating || 0),
        },
        metrics: {
          avgOrderValue: parseFloat(metrics.avg_order_value || 0),
          onTimeRate: parseFloat(metrics.on_time_rate || 0),
          qualityScore: parseFloat(metrics.avg_quality || 0),
          responseTime: parseFloat(metrics.avg_response_time || 0),
          totalOrders: parseInt(metrics.total_orders) || 0,
        },
      })
    }

    // Rank by criteria
    const rankings: any = {}
    for (const criterion of criteria) {
      let sorted: any[] = []
      if (criterion === 'price') {
        sorted = [...comparison].sort((a, b) => a.metrics.avgOrderValue - b.metrics.avgOrderValue)
      } else if (criterion === 'quality') {
        sorted = [...comparison].sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore)
      } else if (criterion === 'delivery') {
        sorted = [...comparison].sort((a, b) => b.metrics.onTimeRate - a.metrics.onTimeRate)
      } else if (criterion === 'responsiveness') {
        sorted = [...comparison].sort((a, b) => a.metrics.responseTime - b.metrics.responseTime)
      }
      rankings[criterion] = sorted.map(s => s.supplier.name)
    }

    return {
      success: true,
      data: {
        suppliers: comparison,
        rankings,
        winner: comparison.reduce((best, current) => {
          const currentScore =
            current.metrics.onTimeRate * 0.3 +
            current.metrics.qualityScore * 20 * 0.4 +
            (100 - current.metrics.responseTime) * 0.3
          const bestScore =
            (best?.metrics.onTimeRate || 0) * 0.3 +
            (best?.metrics.qualityScore || 0) * 20 * 0.4 +
            (100 - (best?.metrics.responseTime || 0)) * 0.3
          return currentScore > bestScore ? current : best
        }).supplier.name,
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Compare suppliers error:', error)
    return {
      success: false,
      error: 'Failed to compare suppliers',
    }
  }
}

// ============================================
// Add New Supplier
// ============================================

export async function addSupplier(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const name = entities.name || entities.supplierName
    const email = entities.email
    const phone = entities.phone
    const industry = entities.industry
    const location = entities.location
    const country = entities.country
    const products = entities.products || entities.description
    const website = entities.website

    if (!name) {
      return {
        success: false,
        error: 'Supplier name is required. What is the supplier name?',
      }
    }

    if (!email && !phone) {
      return {
        success: false,
        error: 'Email or phone number is required for the supplier.',
      }
    }

    // Check if supplier already exists
    const existingResult = await query<any>(
      `SELECT id, name FROM suppliers WHERE name ILIKE $1 OR email = $2 LIMIT 1`,
      [name, email]
    )

    if (existingResult.rows.length > 0) {
      return {
        success: false,
        error: `Supplier "${existingResult.rows[0].name}" already exists in the system.`,
        metadata: { existingSupplierId: existingResult.rows[0].id },
      }
    }

    // Add supplier
    const result = await query<any>(
      `INSERT INTO suppliers (
        name, email, phone, industry, location, country, products, website, status, added_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [name, email, phone, industry, location, country, products, website, 'active', userId]
    )

    const supplier = result.rows[0]

    return {
      success: true,
      data: {
        supplierId: supplier.id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        industry: supplier.industry,
        location: supplier.location,
        message: `Supplier "${name}" added successfully`,
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Add supplier error:', error)
    return {
      success: false,
      error: 'Failed to add supplier',
    }
  }
}

// ============================================
// Update Supplier Information
// ============================================

export async function updateSupplier(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const supplierName = entities.supplier || entities.supplierName
    const supplierId = entities.supplierId

    if (!supplierName && !supplierId) {
      return {
        success: false,
        error: 'Supplier name or ID is required. Which supplier would you like to update?',
      }
    }

    // Find supplier
    let supplier = null
    if (supplierId) {
      const result = await query<any>(`SELECT * FROM suppliers WHERE id = $1`, [supplierId])
      if (result.rows.length > 0) supplier = result.rows[0]
    } else {
      const result = await query<any>(`SELECT * FROM suppliers WHERE name ILIKE $1 LIMIT 1`, [
        `%${supplierName}%`,
      ])
      if (result.rows.length > 0) supplier = result.rows[0]
    }

    if (!supplier) {
      return {
        success: false,
        error: `Supplier "${supplierName || supplierId}" not found.`,
      }
    }

    // Build update fields
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    const updateFields = [
      'email',
      'phone',
      'industry',
      'location',
      'country',
      'products',
      'website',
      'status',
    ]
    for (const field of updateFields) {
      if (entities[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`)
        params.push(entities[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return {
        success: false,
        error: 'No updates specified. What would you like to change?',
      }
    }

    updates.push(`updated_at = NOW()`)
    params.push(supplier.id)

    // Update supplier
    await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

    return {
      success: true,
      data: {
        supplierId: supplier.id,
        name: supplier.name,
        updatedFields: updates.filter(u => !u.includes('updated_at')),
        message: `Supplier "${supplier.name}" updated successfully`,
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Update supplier error:', error)
    return {
      success: false,
      error: 'Failed to update supplier',
    }
  }
}

// ============================================
// Get Supplier Summary
// ============================================

export async function getSupplierSummary(userId: string): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        COUNT(*) as total_suppliers,
        COUNT(*) FILTER (WHERE status = 'active') as active_suppliers,
        AVG(rating) as avg_rating,
        AVG(on_time_delivery_rate) as avg_on_time_rate,
        COUNT(*) FILTER (WHERE rating >= 4.0) as high_rated_count
       FROM suppliers`
    )

    const summary = result.rows[0]

    // Get top suppliers
    const topSuppliersResult = await query<any>(
      `SELECT name, rating, total_orders, on_time_delivery_rate
       FROM suppliers
       WHERE status = 'active'
       ORDER BY rating DESC, total_orders DESC
       LIMIT 5`
    )

    return {
      success: true,
      data: {
        totalSuppliers: parseInt(summary.total_suppliers) || 0,
        activeSuppliers: parseInt(summary.active_suppliers) || 0,
        averageRating: parseFloat(summary.avg_rating) || 0,
        averageOnTimeRate: parseFloat(summary.avg_on_time_rate) || 0,
        highRatedCount: parseInt(summary.high_rated_count) || 0,
        topSuppliers: topSuppliersResult.rows.map(s => ({
          name: s.name,
          rating: parseFloat(s.rating),
          totalOrders: s.total_orders,
          onTimeRate: parseFloat(s.on_time_delivery_rate),
        })),
      },
    }
  } catch (error) {
    console.error('[Supplier Handler] Get supplier summary error:', error)
    return {
      success: false,
      error: 'Failed to retrieve supplier summary',
    }
  }
}
