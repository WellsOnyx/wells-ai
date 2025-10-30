/**
 * Inventory Handler
 * Handles conversational inventory management, stock checks, and reordering
 */

import { query } from '../db'
import { ParsedIntent, ExecutionResult } from '../conversational-engine'

// ============================================
// Check Inventory Levels
// ============================================

export async function checkInventory(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const productName = entities.product || entities.productName || entities.item
    const location = entities.location || entities.warehouse
    const showLowStock = entities.lowStock || entities.reorderNeeded

    // Build query
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    // Filter by product name (fuzzy match)
    if (productName) {
      whereClause += ` AND product_name ILIKE $${paramIndex}`
      params.push(`%${productName}%`)
      paramIndex++
    }

    // Filter by location
    if (location) {
      whereClause += ` AND location ILIKE $${paramIndex}`
      params.push(`%${location}%`)
      paramIndex++
    }

    // Filter for low stock items
    if (showLowStock) {
      whereClause += ` AND quantity <= reorder_point`
    }

    const result = await query<any>(
      `SELECT
        id,
        product_name,
        sku,
        quantity,
        unit,
        reorder_point,
        reorder_quantity,
        location,
        unit_cost,
        last_restock_date,
        (quantity <= reorder_point) as needs_reorder
       FROM inventory_items
       ${whereClause}
       ORDER BY needs_reorder DESC, product_name ASC
       LIMIT 50`,
      params
    )

    if (result.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          items: [],
          message: productName
            ? `No inventory found matching "${productName}"`
            : 'No inventory items found',
        },
      }
    }

    // Calculate totals
    const totalValue = result.rows.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.unit_cost || 0),
      0
    )
    const needsReorderCount = result.rows.filter(item => item.needs_reorder).length

    return {
      success: true,
      data: {
        count: result.rows.length,
        totalValue,
        needsReorderCount,
        items: result.rows.map(item => ({
          id: item.id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit,
          reorderPoint: item.reorder_point,
          location: item.location,
          unitCost: parseFloat(item.unit_cost || 0),
          needsReorder: item.needs_reorder,
          value: item.quantity * parseFloat(item.unit_cost || 0),
        })),
      },
    }
  } catch (error) {
    console.error('[Inventory Handler] Check inventory error:', error)
    return {
      success: false,
      error: 'Failed to retrieve inventory information',
    }
  }
}

// ============================================
// Reorder Item
// ============================================

export async function reorderItem(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const productName = entities.product || entities.productName || entities.item
    const quantity = entities.quantity
    const supplier = entities.supplier

    if (!productName) {
      return {
        success: false,
        error: 'Product name is required. What would you like to reorder?',
      }
    }

    // Find inventory item
    const itemResult = await query<any>(
      `SELECT * FROM inventory_items WHERE product_name ILIKE $1 LIMIT 1`,
      [`%${productName}%`]
    )

    if (itemResult.rows.length === 0) {
      return {
        success: false,
        error: `Product "${productName}" not found in inventory. Would you like to add it?`,
      }
    }

    const item = itemResult.rows[0]

    // Use reorder quantity if not specified
    const reorderQty = quantity || item.reorder_quantity

    if (!reorderQty || reorderQty <= 0) {
      return {
        success: false,
        error: 'Reorder quantity must be greater than 0. How many would you like to order?',
      }
    }

    // Get preferred supplier if not specified
    let supplierData = null
    if (supplier) {
      const supplierResult = await query<any>(
        `SELECT id, name FROM suppliers WHERE name ILIKE $1 LIMIT 1`,
        [`%${supplier}%`]
      )
      if (supplierResult.rows.length > 0) {
        supplierData = supplierResult.rows[0]
      }
    } else if (item.preferred_supplier_id) {
      const supplierResult = await query<any>(
        `SELECT id, name FROM suppliers WHERE id = $1`,
        [item.preferred_supplier_id]
      )
      if (supplierResult.rows.length > 0) {
        supplierData = supplierResult.rows[0]
      }
    }

    if (!supplierData) {
      return {
        success: false,
        error: `No supplier found for "${productName}". Please specify a supplier name.`,
      }
    }

    // Create reorder alert
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
      RETURNING *`,
      [item.id, item.product_name, item.quantity, reorderQty, supplierData.id, 'pending', userId]
    )

    // Optionally auto-create PO (if configured)
    const estimatedCost = reorderQty * parseFloat(item.unit_cost || 0)

    return {
      success: true,
      data: {
        alertId: alertResult.rows[0].id,
        productName: item.product_name,
        currentQuantity: item.quantity,
        reorderQuantity: reorderQty,
        supplier: supplierData.name,
        estimatedCost,
        message: `Reorder alert created for ${reorderQty} ${item.unit} of ${item.product_name}`,
      },
    }
  } catch (error) {
    console.error('[Inventory Handler] Reorder item error:', error)
    return {
      success: false,
      error: 'Failed to create reorder alert',
    }
  }
}

// ============================================
// Update Inventory (Adjust Stock)
// ============================================

export async function updateInventory(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const productName = entities.product || entities.productName || entities.item
    const adjustment = entities.adjustment || entities.quantity
    const adjustmentType = entities.type || 'manual' // 'manual', 'receipt', 'issue', 'count'
    const reason = entities.reason || entities.notes || 'Manual adjustment'

    if (!productName) {
      return {
        success: false,
        error: 'Product name is required. Which item do you want to adjust?',
      }
    }

    if (adjustment === undefined || adjustment === 0) {
      return {
        success: false,
        error: 'Adjustment quantity is required. How much should I add or remove?',
      }
    }

    // Find inventory item
    const itemResult = await query<any>(
      `SELECT * FROM inventory_items WHERE product_name ILIKE $1 LIMIT 1`,
      [`%${productName}%`]
    )

    if (itemResult.rows.length === 0) {
      return {
        success: false,
        error: `Product "${productName}" not found in inventory.`,
      }
    }

    const item = itemResult.rows[0]
    const oldQuantity = item.quantity
    const newQuantity = oldQuantity + adjustment

    if (newQuantity < 0) {
      return {
        success: false,
        error: `Cannot adjust inventory below zero. Current quantity: ${oldQuantity}, Adjustment: ${adjustment}`,
      }
    }

    // Update inventory quantity
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
      [item.id, adjustmentType, adjustment, oldQuantity, newQuantity, userId, reason]
    )

    // Check if reorder needed
    const needsReorder = newQuantity <= item.reorder_point

    return {
      success: true,
      data: {
        productName: item.product_name,
        oldQuantity,
        newQuantity,
        adjustment,
        needsReorder,
        reorderPoint: item.reorder_point,
      },
    }
  } catch (error) {
    console.error('[Inventory Handler] Update inventory error:', error)
    return {
      success: false,
      error: 'Failed to update inventory',
    }
  }
}

// ============================================
// Get Inventory Summary
// ============================================

export async function getInventorySummary(userId: string): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        COUNT(*) as total_items,
        SUM(quantity * unit_cost) as total_value,
        COUNT(*) FILTER (WHERE quantity <= reorder_point) as low_stock_count,
        COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock_count,
        SUM(quantity * unit_cost) FILTER (WHERE quantity <= reorder_point) as low_stock_value
       FROM inventory_items`
    )

    const summary = result.rows[0]

    // Get top low stock items
    const lowStockResult = await query<any>(
      `SELECT product_name, quantity, reorder_point, unit
       FROM inventory_items
       WHERE quantity <= reorder_point
       ORDER BY (reorder_point - quantity) DESC
       LIMIT 5`
    )

    return {
      success: true,
      data: {
        totalItems: parseInt(summary.total_items) || 0,
        totalValue: parseFloat(summary.total_value) || 0,
        lowStockCount: parseInt(summary.low_stock_count) || 0,
        outOfStockCount: parseInt(summary.out_of_stock_count) || 0,
        lowStockValue: parseFloat(summary.low_stock_value) || 0,
        lowStockItems: lowStockResult.rows,
      },
    }
  } catch (error) {
    console.error('[Inventory Handler] Get inventory summary error:', error)
    return {
      success: false,
      error: 'Failed to retrieve inventory summary',
    }
  }
}

// ============================================
// Get Inventory Transactions (History)
// ============================================

export async function getInventoryHistory(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const productName = entities.product || entities.productName || entities.item
    const limit = entities.limit || 20

    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (productName) {
      whereClause += ` AND ii.product_name ILIKE $${paramIndex}`
      params.push(`%${productName}%`)
      paramIndex++
    }

    params.push(limit)

    const result = await query<any>(
      `SELECT
        it.*,
        ii.product_name,
        ii.sku
       FROM inventory_transactions it
       JOIN inventory_items ii ON it.inventory_item_id = ii.id
       ${whereClause}
       ORDER BY it.created_at DESC
       LIMIT $${paramIndex}`,
      params
    )

    return {
      success: true,
      data: {
        count: result.rows.length,
        transactions: result.rows.map(tx => ({
          productName: tx.product_name,
          sku: tx.sku,
          type: tx.transaction_type,
          quantityChange: tx.quantity_change,
          quantityBefore: tx.quantity_before,
          quantityAfter: tx.quantity_after,
          performedBy: tx.performed_by,
          notes: tx.notes,
          timestamp: tx.created_at,
        })),
      },
    }
  } catch (error) {
    console.error('[Inventory Handler] Get inventory history error:', error)
    return {
      success: false,
      error: 'Failed to retrieve inventory history',
    }
  }
}
