/**
 * Batch Operations Handler
 * Handles bulk operations on purchase orders, inventory, and suppliers
 */

import { query } from '../db'
import { ExecutionResult } from '../conversational-engine'

// ============================================
// Batch Approve Purchase Orders
// ============================================

export async function batchApprovePOs(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    // Build filter criteria
    const maxAmount = entities.maxAmount || entities.threshold || entities.budget
    const supplier = entities.supplier
    const status = entities.status || 'pending_approval'

    let whereClause = 'WHERE status = $1'
    const params: any[] = [status]
    let paramIndex = 2

    if (maxAmount) {
      whereClause += ` AND total_amount <= $${paramIndex}`
      params.push(maxAmount)
      paramIndex++
    }

    if (supplier) {
      whereClause += ` AND supplier_id IN (SELECT id FROM suppliers WHERE name ILIKE $${paramIndex})`
      params.push(`%${supplier}%`)
      paramIndex++
    }

    // Get matching POs
    const posResult = await query<any>(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       ${whereClause}
       ORDER BY created_at ASC`,
      params
    )

    if (posResult.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          message: 'No purchase orders found matching your criteria',
        },
      }
    }

    const posToApprove = posResult.rows
    const poIds = posToApprove.map(po => po.id)
    const totalAmount = posToApprove.reduce((sum, po) => sum + parseFloat(po.total_amount), 0)

    // Safety check - require confirmation for large batches or amounts
    const requiresConfirmation =
      posToApprove.length > 10 || totalAmount > 50000 || entities.confirm !== true

    if (requiresConfirmation && entities.confirm !== true) {
      return {
        success: false,
        error: 'Confirmation required',
        data: {
          needsConfirmation: true,
          count: posToApprove.length,
          totalAmount,
          pos: posToApprove.map(po => ({
            poNumber: po.po_number,
            supplier: po.supplier_name,
            amount: parseFloat(po.total_amount),
          })),
          confirmationMessage: `You're about to approve ${posToApprove.length} purchase orders totaling $${totalAmount.toLocaleString()}. Reply 'confirm' to proceed.`,
        },
      }
    }

    // Approve all POs
    await query(
      `UPDATE purchase_orders
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = ANY($2)`,
      [userId, poIds]
    )

    // Mark as sent (in production, would trigger supplier notifications)
    await query(
      `UPDATE purchase_orders
       SET status = 'sent'
       WHERE id = ANY($1)`,
      [poIds]
    )

    return {
      success: true,
      data: {
        count: posToApprove.length,
        totalAmount,
        poNumbers: posToApprove.map(po => po.po_number),
        message: `Successfully approved ${posToApprove.length} purchase orders totaling $${totalAmount.toLocaleString()}`,
      },
    }
  } catch (error) {
    console.error('[Batch Operations] Batch approve POs error:', error)
    return {
      success: false,
      error: 'Failed to batch approve purchase orders',
    }
  }
}

// ============================================
// Batch Reject Purchase Orders
// ============================================

export async function batchRejectPOs(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const reason = entities.reason || entities.notes || 'Batch rejection'
    const status = entities.status || 'pending_approval'

    let whereClause = 'WHERE status = $1'
    const params: any[] = [status]
    let paramIndex = 2

    if (entities.maxAmount) {
      whereClause += ` AND total_amount <= $${paramIndex}`
      params.push(entities.maxAmount)
      paramIndex++
    }

    if (entities.minAmount) {
      whereClause += ` AND total_amount >= $${paramIndex}`
      params.push(entities.minAmount)
      paramIndex++
    }

    if (entities.supplier) {
      whereClause += ` AND supplier_id IN (SELECT id FROM suppliers WHERE name ILIKE $${paramIndex})`
      params.push(`%${entities.supplier}%`)
      paramIndex++
    }

    const posResult = await query<any>(
      `SELECT id, po_number, total_amount FROM purchase_orders ${whereClause}`,
      params
    )

    if (posResult.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          message: 'No purchase orders found matching your criteria',
        },
      }
    }

    const poIds = posResult.rows.map(po => po.id)

    // Reject all POs
    await query(
      `UPDATE purchase_orders
       SET status = 'rejected',
           notes = $1,
           updated_at = NOW()
       WHERE id = ANY($2)`,
      [`Rejected: ${reason}`, poIds]
    )

    return {
      success: true,
      data: {
        count: posResult.rows.length,
        poNumbers: posResult.rows.map(po => po.po_number),
        reason,
      },
    }
  } catch (error) {
    console.error('[Batch Operations] Batch reject POs error:', error)
    return {
      success: false,
      error: 'Failed to batch reject purchase orders',
    }
  }
}

// ============================================
// Batch Reorder Low Stock Items
// ============================================

export async function batchReorderLowStock(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const category = entities.category
    const location = entities.location || entities.warehouse

    let whereClause = 'WHERE quantity <= reorder_point AND status = $1'
    const params: any[] = ['active']
    let paramIndex = 2

    if (category) {
      whereClause += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (location) {
      whereClause += ` AND location ILIKE $${paramIndex}`
      params.push(`%${location}%`)
      paramIndex++
    }

    const itemsResult = await query<any>(
      `SELECT * FROM inventory_items ${whereClause}`,
      params
    )

    if (itemsResult.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          message: 'No low-stock items found',
        },
      }
    }

    const items = itemsResult.rows
    const alertsCreated = []

    // Create reorder alerts for all low-stock items
    for (const item of items) {
      const alertResult = await query<any>(
        `INSERT INTO reorder_alerts (
          inventory_item_id,
          product_name,
          current_quantity,
          reorder_quantity,
          supplier_id,
          status,
          triggered_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          item.id,
          item.product_name,
          item.quantity,
          item.reorder_quantity,
          item.preferred_supplier_id,
          'pending',
          userId,
        ]
      )

      alertsCreated.push({
        productName: item.product_name,
        currentQuantity: item.quantity,
        reorderQuantity: item.reorder_quantity,
        alertId: alertResult.rows[0].id,
      })
    }

    const totalReorderValue = items.reduce(
      (sum, item) => sum + item.reorder_quantity * parseFloat(item.unit_cost || 0),
      0
    )

    return {
      success: true,
      data: {
        count: alertsCreated.length,
        totalValue: totalReorderValue,
        alerts: alertsCreated,
        message: `Created ${alertsCreated.length} reorder alerts for low-stock items`,
      },
    }
  } catch (error) {
    console.error('[Batch Operations] Batch reorder low stock error:', error)
    return {
      success: false,
      error: 'Failed to create batch reorder alerts',
    }
  }
}

// ============================================
// Batch Update Inventory
// ============================================

export async function batchUpdateInventory(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const adjustment = entities.adjustment || entities.quantity
    const category = entities.category
    const location = entities.location

    if (!adjustment) {
      return {
        success: false,
        error: 'Adjustment amount is required',
      }
    }

    let whereClause = 'WHERE status = $1'
    const params: any[] = ['active']
    let paramIndex = 2

    if (category) {
      whereClause += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (location) {
      whereClause += ` AND location ILIKE $${paramIndex}`
      params.push(`%${location}%`)
      paramIndex++
    }

    const itemsResult = await query<any>(
      `SELECT * FROM inventory_items ${whereClause}`,
      params
    )

    if (itemsResult.rows.length === 0) {
      return {
        success: false,
        error: 'No inventory items found matching criteria',
      }
    }

    const items = itemsResult.rows
    const updates = []

    // Update each item
    for (const item of items) {
      const newQuantity = item.quantity + adjustment

      if (newQuantity < 0) {
        continue // Skip items that would go negative
      }

      await query(
        `UPDATE inventory_items SET quantity = $1, updated_at = NOW() WHERE id = $2`,
        [newQuantity, item.id]
      )

      // Log transaction
      await query(
        `INSERT INTO inventory_transactions (
          inventory_item_id,
          transaction_type,
          quantity_change,
          quantity_before,
          quantity_after,
          performed_by,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.id,
          'batch_adjustment',
          adjustment,
          item.quantity,
          newQuantity,
          userId,
          `Batch update: ${category || location || 'all items'}`,
        ]
      )

      updates.push({
        productName: item.product_name,
        oldQuantity: item.quantity,
        newQuantity,
      })
    }

    return {
      success: true,
      data: {
        count: updates.length,
        adjustment,
        updates,
      },
    }
  } catch (error) {
    console.error('[Batch Operations] Batch update inventory error:', error)
    return {
      success: false,
      error: 'Failed to batch update inventory',
    }
  }
}

// ============================================
// Smart Supplier Recommendation
// ============================================

export async function recommendSupplier(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const product = entities.product || entities.productName
    const category = entities.category || entities.industry
    const maxBudget = entities.budget || entities.maxAmount

    if (!product && !category) {
      return {
        success: false,
        error: 'Product name or category is required for supplier recommendation',
      }
    }

    // Find suppliers matching product/category
    let whereClause = 'WHERE status = $1'
    const params: any[] = ['active']
    let paramIndex = 2

    if (product) {
      whereClause += ` AND products ILIKE $${paramIndex}`
      params.push(`%${product}%`)
      paramIndex++
    }

    if (category) {
      whereClause += ` AND industry ILIKE $${paramIndex}`
      params.push(`%${category}%`)
      paramIndex++
    }

    const suppliersResult = await query<any>(
      `SELECT s.*,
        COALESCE(AVG(sm.quality_rating), 0) as avg_quality,
        COALESCE(AVG(CASE WHEN sm.delivered_on_time THEN 100 ELSE 0 END), 0) as on_time_rate,
        COALESCE(AVG(sm.response_time_hours), 999) as avg_response_time,
        COALESCE(COUNT(sm.id), 0) as order_count
       FROM suppliers s
       LEFT JOIN supplier_metrics sm ON s.id = sm.supplier_id
       ${whereClause}
       GROUP BY s.id
       HAVING COUNT(sm.id) > 0
       ORDER BY
         (COALESCE(AVG(CASE WHEN sm.delivered_on_time THEN 100 ELSE 0 END), 0) * 0.4 +
          COALESCE(AVG(sm.quality_rating), 0) * 20 * 0.4 +
          (100 - LEAST(COALESCE(AVG(sm.response_time_hours), 999), 100)) * 0.2) DESC
       LIMIT 5`,
      params
    )

    if (suppliersResult.rows.length === 0) {
      return {
        success: false,
        error: 'No suppliers found with performance history for this product/category',
      }
    }

    const recommendations = suppliersResult.rows.map((s, index) => {
      const score = Math.round(
        parseFloat(s.on_time_rate) * 0.4 +
          parseFloat(s.avg_quality) * 20 * 0.4 +
          (100 - Math.min(parseFloat(s.avg_response_time), 100)) * 0.2
      )

      return {
        rank: index + 1,
        supplier: {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          location: s.location,
        },
        performance: {
          score,
          onTimeRate: parseFloat(s.on_time_rate),
          qualityRating: parseFloat(s.avg_quality),
          avgResponseTime: parseFloat(s.avg_response_time),
          orderCount: parseInt(s.order_count),
        },
        recommendation:
          index === 0
            ? 'Best choice - Highest performance score'
            : index === 1
              ? 'Second choice - Strong performance'
              : 'Alternative option',
      }
    })

    return {
      success: true,
      data: {
        query: product || category,
        count: recommendations.length,
        recommendations,
        topChoice: recommendations[0],
      },
    }
  } catch (error) {
    console.error('[Batch Operations] Recommend supplier error:', error)
    return {
      success: false,
      error: 'Failed to generate supplier recommendations',
    }
  }
}
