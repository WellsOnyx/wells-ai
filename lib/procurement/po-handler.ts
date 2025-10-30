/**
 * Purchase Order Handler
 * Handles conversational PO creation, queries, updates, and approvals
 */

import { query } from '../db'
import { ParsedIntent, ExecutionResult } from '../conversational-engine'

// ============================================
// Create Purchase Order
// ============================================

export async function createPO(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    // Extract entities
    const supplier = entities.supplier
    const product = entities.product || entities.description
    const quantity = entities.quantity || 1
    const budget = entities.budget || entities.amount
    const dueDate = entities.date || entities.dueDate || entities.deadline
    const notes = entities.notes

    // Validate required fields
    if (!supplier) {
      return {
        success: false,
        error: 'Supplier name is required. Please specify which supplier to order from.',
      }
    }

    if (!product) {
      return {
        success: false,
        error: 'Product description is required. What would you like to order?',
      }
    }

    // Find supplier (fuzzy match)
    const supplierResult = await query<any>(
      `SELECT id, name, email FROM suppliers
       WHERE name ILIKE $1 OR name ILIKE $2
       LIMIT 1`,
      [`%${supplier}%`, `${supplier}%`]
    )

    if (supplierResult.rows.length === 0) {
      return {
        success: false,
        error: `Supplier "${supplier}" not found in our system. Would you like to add them as a new supplier, or search with a different name?`,
        metadata: { suggestedSupplier: supplier },
      }
    }

    const supplierData = supplierResult.rows[0]

    // Generate PO number
    const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Calculate amounts
    const unitPrice = budget ? budget / quantity : 0
    const totalAmount = budget || 0

    if (totalAmount === 0) {
      return {
        success: false,
        error: 'Budget amount is required. How much should this PO be for?',
      }
    }

    // Determine if approval is needed (>$5000 requires approval)
    const needsApproval = totalAmount > 5000
    const status = needsApproval ? 'pending_approval' : 'approved'

    // Create PO
    const poResult = await query<any>(
      `INSERT INTO purchase_orders (
        po_number, supplier_id, buyer_id, status, total_amount, due_date, requested_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [poNumber, supplierData.id, userId, status, totalAmount, dueDate, userId, notes]
    )

    const poId = poResult.rows[0].id

    // Add line item
    await query(
      `INSERT INTO po_line_items (po_id, product_name, description, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [poId, product, product, quantity, unitPrice, totalAmount]
    )

    // Get approver if needed
    let approverInfo = null
    if (needsApproval) {
      const approverResult = await query<any>(
        `SELECT user_id, name FROM approval_workflows
         WHERE entity_type = 'purchase_order' AND status = 'pending'
         LIMIT 1`
      )
      if (approverResult.rows.length > 0) {
        approverInfo = approverResult.rows[0]
      }
    }

    return {
      success: true,
      data: {
        poNumber,
        poId,
        supplier: supplierData.name,
        product,
        quantity,
        unitPrice,
        totalAmount,
        dueDate,
        status,
        needsApproval,
        approver: approverInfo?.name || 'CFO',
      },
    }
  } catch (error) {
    console.error('[PO Handler] Create PO error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create purchase order',
    }
  }
}

// ============================================
// Query Purchase Orders
// ============================================

export async function queryPOs(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    let whereClause = 'WHERE buyer_id = $1'
    const params: any[] = [userId]

    // Filter by status
    if (entities.status) {
      whereClause += ` AND status = $${params.length + 1}`
      params.push(entities.status)
    }

    // Filter by minimum amount
    if (entities.minAmount || entities.minBudget) {
      whereClause += ` AND total_amount >= $${params.length + 1}`
      params.push(entities.minAmount || entities.minBudget)
    }

    // Filter by maximum amount
    if (entities.maxAmount || entities.maxBudget) {
      whereClause += ` AND total_amount <= $${params.length + 1}`
      params.push(entities.maxAmount || entities.maxBudget)
    }

    // Filter by supplier
    if (entities.supplier) {
      whereClause += ` AND supplier_id IN (SELECT id FROM suppliers WHERE name ILIKE $${params.length + 1})`
      params.push(`%${entities.supplier}%`)
    }

    // Filter by date range
    if (entities.startDate) {
      whereClause += ` AND created_at >= $${params.length + 1}`
      params.push(entities.startDate)
    }

    if (entities.endDate) {
      whereClause += ` AND created_at <= $${params.length + 1}`
      params.push(entities.endDate)
    }

    // Filter by PO number
    if (entities.poNumber || entities.poId) {
      whereClause += ` AND po_number = $${params.length + 1}`
      params.push(entities.poNumber || entities.poId)
    }

    const result = await query<any>(
      `SELECT po.*, s.name as supplier_name, s.email as supplier_email
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 50`,
      params
    )

    if (result.rows.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          pos: [],
          message: 'No purchase orders found matching your criteria.',
        },
      }
    }

    // Calculate totals
    const totalAmount = result.rows.reduce((sum, po) => sum + parseFloat(po.total_amount), 0)

    return {
      success: true,
      data: {
        count: result.rows.length,
        totalAmount,
        pos: result.rows.map(po => ({
          poNumber: po.po_number,
          supplier: po.supplier_name,
          totalAmount: parseFloat(po.total_amount),
          status: po.status,
          dueDate: po.due_date,
          createdAt: po.created_at,
        })),
      },
    }
  } catch (error) {
    console.error('[PO Handler] Query POs error:', error)
    return {
      success: false,
      error: 'Failed to retrieve purchase orders',
    }
  }
}

// ============================================
// Update Purchase Order
// ============================================

export async function updatePO(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const poNumber = entities.poNumber || entities.poId
    if (!poNumber) {
      return {
        success: false,
        error: 'PO number is required. Which PO would you like to update?',
      }
    }

    // Get current PO
    const poResult = await query<any>(
      `SELECT * FROM purchase_orders WHERE po_number = $1 AND buyer_id = $2`,
      [poNumber, userId]
    )

    if (poResult.rows.length === 0) {
      return {
        success: false,
        error: `Purchase order ${poNumber} not found or you don't have permission to modify it.`,
      }
    }

    const currentPO = poResult.rows[0]

    // Check if PO can be updated (not already approved/sent)
    if (currentPO.status === 'sent' || currentPO.status === 'received') {
      return {
        success: false,
        error: `Cannot update PO ${poNumber} - it has already been sent to the supplier.`,
      }
    }

    // Build update fields
    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (entities.quantity !== undefined) {
      // Update line items quantity
      await query(
        `UPDATE po_line_items
         SET quantity = $1, total_price = unit_price * $1
         WHERE po_id = $2`,
        [entities.quantity, currentPO.id]
      )
      updates.push('quantity updated')
    }

    if (entities.budget || entities.amount) {
      const newAmount = entities.budget || entities.amount
      updates.push(`total_amount = $${paramIndex}`)
      params.push(newAmount)
      paramIndex++
    }

    if (entities.date || entities.dueDate) {
      updates.push(`due_date = $${paramIndex}`)
      params.push(entities.date || entities.dueDate)
      paramIndex++
    }

    if (entities.notes) {
      updates.push(`notes = $${paramIndex}`)
      params.push(entities.notes)
      paramIndex++
    }

    if (updates.length === 0) {
      return {
        success: false,
        error: 'No updates specified. What would you like to change?',
      }
    }

    updates.push(`updated_at = NOW()`)
    params.push(currentPO.id)

    // Update PO
    await query(
      `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    )

    return {
      success: true,
      data: {
        poNumber,
        updates: updates.filter(u => !u.includes('updated_at')),
        message: `Purchase order ${poNumber} updated successfully`,
      },
    }
  } catch (error) {
    console.error('[PO Handler] Update PO error:', error)
    return {
      success: false,
      error: 'Failed to update purchase order',
    }
  }
}

// ============================================
// Approve Purchase Order
// ============================================

export async function approvePO(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const poNumber = entities.poNumber || entities.poId
    if (!poNumber) {
      return {
        success: false,
        error: 'PO number is required. Which PO would you like to approve?',
      }
    }

    // Get PO
    const poResult = await query<any>(
      `SELECT * FROM purchase_orders WHERE po_number = $1`,
      [poNumber]
    )

    if (poResult.rows.length === 0) {
      return {
        success: false,
        error: `Purchase order ${poNumber} not found.`,
      }
    }

    const po = poResult.rows[0]

    if (po.status !== 'pending_approval') {
      return {
        success: false,
        error: `PO ${poNumber} is not pending approval (current status: ${po.status})`,
      }
    }

    // Approve PO
    await query(
      `UPDATE purchase_orders
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2`,
      [userId, po.id]
    )

    // Send to supplier (in real app, would send email/notification)
    await query(
      `UPDATE purchase_orders SET status = 'sent' WHERE id = $1`,
      [po.id]
    )

    return {
      success: true,
      data: {
        poNumber,
        supplier: po.supplier_name,
        amount: parseFloat(po.total_amount),
        status: 'sent',
        message: `PO ${poNumber} approved and sent to supplier`,
      },
    }
  } catch (error) {
    console.error('[PO Handler] Approve PO error:', error)
    return {
      success: false,
      error: 'Failed to approve purchase order',
    }
  }
}

// ============================================
// Reject Purchase Order
// ============================================

export async function rejectPO(
  entities: Record<string, any>,
  userId: string
): Promise<ExecutionResult> {
  try {
    const poNumber = entities.poNumber || entities.poId
    const reason = entities.reason || entities.notes || 'No reason provided'

    if (!poNumber) {
      return {
        success: false,
        error: 'PO number is required. Which PO would you like to reject?',
      }
    }

    // Get PO
    const poResult = await query<any>(
      `SELECT * FROM purchase_orders WHERE po_number = $1`,
      [poNumber]
    )

    if (poResult.rows.length === 0) {
      return {
        success: false,
        error: `Purchase order ${poNumber} not found.`,
      }
    }

    const po = poResult.rows[0]

    // Reject PO
    await query(
      `UPDATE purchase_orders
       SET status = 'rejected', notes = $1
       WHERE id = $2`,
      [`Rejected: ${reason}`, po.id]
    )

    return {
      success: true,
      data: {
        poNumber,
        reason,
        message: `PO ${poNumber} rejected`,
      },
    }
  } catch (error) {
    console.error('[PO Handler] Reject PO error:', error)
    return {
      success: false,
      error: 'Failed to reject purchase order',
    }
  }
}

// ============================================
// Get PO Summary (for status/dashboard)
// ============================================

export async function getPOSummary(userId: string): Promise<ExecutionResult> {
  try {
    const result = await query<any>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        SUM(total_amount) FILTER (WHERE status = 'pending_approval') as pending_approval_amount,
        SUM(total_amount) FILTER (WHERE status != 'rejected' AND status != 'cancelled') as total_active_amount
       FROM purchase_orders
       WHERE buyer_id = $1`,
      [userId]
    )

    const summary = result.rows[0]

    return {
      success: true,
      data: {
        pendingApproval: {
          count: parseInt(summary.pending_approval_count) || 0,
          amount: parseFloat(summary.pending_approval_amount) || 0,
        },
        approved: {
          count: parseInt(summary.approved_count) || 0,
        },
        sent: {
          count: parseInt(summary.sent_count) || 0,
        },
        totalActiveAmount: parseFloat(summary.total_active_amount) || 0,
      },
    }
  } catch (error) {
    console.error('[PO Handler] Get PO summary error:', error)
    return {
      success: false,
      error: 'Failed to retrieve PO summary',
    }
  }
}
