/**
 * WellsAI Conversational ERP - Purchase Order Service
 *
 * AI-native PO management - no forms, no dashboards.
 * Users just talk to Wells:
 *
 * - "Create a PO for 1000 bearings from Precision Bearings at $4.50 each" -> Wells creates
 * - "What POs are pending delivery?" -> Wells lists
 * - "Mark PO #456 as received" -> Wells updates, triggers payment release
 * - "Cancel the order from Acme" -> Wells cancels with notification
 *
 * Integrated with Wells fee system - 1% on all transactions.
 */

import { sql } from '@vercel/postgres'
import { calculateWellsFee, WELLS_FEE_CONFIG } from '@/lib/fees/wells-fee-service'

// ============================================================================
// TYPES
// ============================================================================

export interface POLineItem {
  id: string
  sku?: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  deliveredQuantity: number
  category?: string
}

export type POStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'acknowledged'
  | 'in_production'
  | 'shipped'
  | 'partial_received'
  | 'received'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export interface WellsPurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplierName: string
  supplierEmail?: string
  supplierPhone?: string

  // Amounts
  subtotal: number
  taxAmount: number
  shippingAmount: number
  wellsFee: number
  totalAmount: number
  currency: string

  // Dates
  orderDate: Date
  expectedDeliveryDate?: Date
  actualDeliveryDate?: Date
  paymentDueDate?: Date

  // Status
  status: POStatus

  // Items
  items: POLineItem[]

  // Shipping
  shippingAddress?: string
  shippingMethod?: string
  trackingNumber?: string

  // Payment
  paymentTerms?: string
  paymentStatus: 'pending' | 'partial' | 'paid'
  amountPaid: number

  // Notes
  notes?: string
  internalNotes?: string

  // AI tracking
  createdByAi: boolean
  aiConversationId?: string
  aiCommand?: string

  // Wells integration
  wellsDealId?: string
  wellsRfqId?: string
  linkedInvoiceId?: string

  createdAt: Date
  updatedAt: Date
}

export interface CreatePORequest {
  supplierId?: string
  supplierName: string
  supplierEmail?: string
  items: Omit<POLineItem, 'id' | 'deliveredQuantity'>[]
  expectedDeliveryDate?: Date
  shippingAddress?: string
  shippingMethod?: string
  paymentTerms?: string
  notes?: string
  aiConversationId?: string
  aiCommand?: string
}

export interface POSearchCriteria {
  supplierId?: string
  supplierName?: string
  status?: POStatus | POStatus[]
  pendingDelivery?: boolean
  minAmount?: number
  maxAmount?: number
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface POSummary {
  totalOrders: number
  totalValue: number
  pendingDelivery: number
  pendingDeliveryValue: number
  receivedThisMonth: number
  awaitingPayment: number
  byStatus: Record<POStatus, { count: number; value: number }>
}

// ============================================================================
// PURCHASE ORDER SERVICE
// ============================================================================

export class WellsPOService {
  /**
   * Create a purchase order conversationally
   * "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"
   */
  static async createPO(
    userId: string,
    request: CreatePORequest
  ): Promise<{ po: WellsPurchaseOrder; message: string }> {
    const poId = `wells-po-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const poNumber = await this.generatePONumber()

    // Determine supplier ID - use existing or create new
    let supplierId = request.supplierId
    if (!supplierId) {
      // Check if supplier exists by name
      const existingSupplier = await sql`
        SELECT id FROM wells_vendors
        WHERE user_id = ${userId} AND LOWER(name) = LOWER(${request.supplierName})
        LIMIT 1
      `
      if (existingSupplier.rows.length > 0) {
        supplierId = existingSupplier.rows[0].id
      } else {
        // Create supplier on the fly
        supplierId = `wells-vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await sql`
          INSERT INTO wells_vendors (id, user_id, name, email, status, vendor_type, created_by_ai, created_at, updated_at)
          VALUES (${supplierId}, ${userId}, ${request.supplierName}, ${request.supplierEmail || null}, 'active', 'supplier', true, NOW(), NOW())
        `
      }
    }

    // Calculate line items and totals
    const items: POLineItem[] = []
    let subtotal = 0

    for (const item of request.items) {
      const lineItemId = `po-li-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      const amount = item.quantity * item.unitPrice
      subtotal += amount
      items.push({
        id: lineItemId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount,
        deliveredQuantity: 0,
        category: item.category,
      })
    }

    // Calculate Wells fee (1%)
    const feeResult = calculateWellsFee(subtotal, 'USD', `po-${poId}`)
    const wellsFee = feeResult.feeAmount

    // Shipping and tax (simplified)
    const shippingAmount = 0
    const taxAmount = 0

    const totalAmount = subtotal + taxAmount + shippingAmount + wellsFee

    // Dates
    const orderDate = new Date()
    const expectedDeliveryDate = request.expectedDeliveryDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Default 2 weeks
    const paymentDueDate = new Date(expectedDeliveryDate.getTime() + 30 * 24 * 60 * 60 * 1000) // NET30 from delivery

    // Insert PO
    await sql`
      INSERT INTO wells_purchase_orders (
        id, po_number, user_id, supplier_id, supplier_name, supplier_email,
        subtotal, tax_amount, shipping_amount, wells_fee, total_amount, currency,
        order_date, expected_delivery_date, payment_due_date, status, items,
        shipping_address, shipping_method, payment_terms, payment_status, amount_paid,
        notes, created_by_ai, ai_conversation_id, ai_command, created_at, updated_at
      ) VALUES (
        ${poId}, ${poNumber}, ${userId}, ${supplierId}, ${request.supplierName}, ${request.supplierEmail || null},
        ${subtotal}, ${taxAmount}, ${shippingAmount}, ${wellsFee}, ${totalAmount}, 'USD',
        ${orderDate.toISOString()}, ${expectedDeliveryDate.toISOString()}, ${paymentDueDate.toISOString()},
        'draft', ${JSON.stringify(items)},
        ${request.shippingAddress || null}, ${request.shippingMethod || null},
        ${request.paymentTerms || 'NET30'}, 'pending', 0,
        ${request.notes || null}, true, ${request.aiConversationId || null}, ${request.aiCommand || null},
        NOW(), NOW()
      )
    `

    // Record transaction
    await this.recordTransaction(userId, poId, 'po_created', totalAmount, {
      poNumber,
      supplierName: request.supplierName,
      itemCount: items.length,
      wellsFee,
    })

    const po: WellsPurchaseOrder = {
      id: poId,
      poNumber,
      supplierId: supplierId!,
      supplierName: request.supplierName,
      supplierEmail: request.supplierEmail,
      subtotal,
      taxAmount,
      shippingAmount,
      wellsFee,
      totalAmount,
      currency: 'USD',
      orderDate,
      expectedDeliveryDate,
      paymentDueDate,
      status: 'draft',
      items,
      shippingAddress: request.shippingAddress,
      shippingMethod: request.shippingMethod,
      paymentTerms: request.paymentTerms || 'NET30',
      paymentStatus: 'pending',
      amountPaid: 0,
      notes: request.notes,
      createdByAi: true,
      aiConversationId: request.aiConversationId,
      aiCommand: request.aiCommand,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Format item summary
    const itemSummary =
      items.length === 1
        ? `${items[0].quantity.toLocaleString()} x ${items[0].description} at $${items[0].unitPrice.toFixed(2)}`
        : `${items.length} items`

    return {
      po,
      message: `PO ${poNumber} created for ${request.supplierName}. ${itemSummary}. Total: $${totalAmount.toLocaleString()} (includes $${wellsFee.toFixed(2)} Wells AI fee). Expected delivery: ${expectedDeliveryDate.toLocaleDateString()}.`,
    }
  }

  /**
   * List purchase orders with natural language filters
   * "What POs are pending delivery?"
   */
  static async listPOs(
    userId: string,
    criteria: POSearchCriteria = {}
  ): Promise<{ orders: WellsPurchaseOrder[]; summary: string }> {
    let result

    if (criteria.pendingDelivery) {
      result = await sql`
        SELECT * FROM wells_purchase_orders
        WHERE user_id = ${userId}
          AND status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'partial_received')
        ORDER BY expected_delivery_date ASC
        LIMIT ${criteria.limit || 50}
        OFFSET ${criteria.offset || 0}
      `
    } else if (criteria.status) {
      const statusArray = Array.isArray(criteria.status) ? criteria.status : [criteria.status]
      result = await sql`
        SELECT * FROM wells_purchase_orders
        WHERE user_id = ${userId}
          AND status = ANY(${statusArray})
        ORDER BY created_at DESC
        LIMIT ${criteria.limit || 50}
        OFFSET ${criteria.offset || 0}
      `
    } else if (criteria.supplierName) {
      result = await sql`
        SELECT * FROM wells_purchase_orders
        WHERE user_id = ${userId}
          AND LOWER(supplier_name) LIKE LOWER(${`%${criteria.supplierName}%`})
        ORDER BY created_at DESC
        LIMIT ${criteria.limit || 50}
        OFFSET ${criteria.offset || 0}
      `
    } else {
      result = await sql`
        SELECT * FROM wells_purchase_orders
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${criteria.limit || 50}
        OFFSET ${criteria.offset || 0}
      `
    }

    const orders: WellsPurchaseOrder[] = result.rows.map(this.mapRowToPO)

    // Generate natural language summary
    const totalValue = orders.reduce((sum, po) => sum + po.totalAmount, 0)
    const pendingCount = orders.filter((po) => !['received', 'completed', 'cancelled'].includes(po.status)).length

    let summary = `Found ${orders.length} purchase order${orders.length !== 1 ? 's' : ''}`
    if (orders.length > 0) {
      summary += ` totaling $${totalValue.toLocaleString()}.`
      if (pendingCount > 0) {
        summary += ` ${pendingCount} ${pendingCount === 1 ? 'is' : 'are'} pending delivery.`
      }
    } else {
      summary += '.'
    }

    return { orders, summary }
  }

  /**
   * Get pending delivery POs
   * "What POs are pending delivery?"
   */
  static async getPendingDeliveryPOs(userId: string): Promise<{ orders: WellsPurchaseOrder[]; summary: string }> {
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'partial_received')
      ORDER BY expected_delivery_date ASC
    `

    const orders: WellsPurchaseOrder[] = result.rows.map(this.mapRowToPO)
    const totalValue = orders.reduce((sum, po) => sum + po.totalAmount, 0)

    // Find overdue orders
    const now = new Date()
    const overdueOrders = orders.filter((po) => po.expectedDeliveryDate && new Date(po.expectedDeliveryDate) < now)

    let summary = `You have ${orders.length} purchase order${orders.length !== 1 ? 's' : ''} pending delivery`
    if (orders.length > 0) {
      summary += ` ($${totalValue.toLocaleString()} total).`
      if (overdueOrders.length > 0) {
        summary += ` ${overdueOrders.length} ${overdueOrders.length === 1 ? 'is' : 'are'} past expected delivery date.`
      }
    } else {
      summary += '.'
    }

    return { orders, summary }
  }

  /**
   * Mark PO as received
   * "Mark PO #456 as received"
   */
  static async markAsReceived(
    userId: string,
    poIdentifier: string,
    receivedItems?: { lineItemId: string; quantity: number }[],
    receivedDate?: Date
  ): Promise<{ po: WellsPurchaseOrder; message: string; triggerPayment: boolean }> {
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND (po_number = ${poIdentifier} OR id = ${poIdentifier})
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`PO ${poIdentifier} not found`)
    }

    const po = this.mapRowToPO(result.rows[0])
    const actualDeliveryDate = receivedDate || new Date()

    // Update item quantities if partial receipt
    let items = po.items
    let status: POStatus = 'received'

    if (receivedItems && receivedItems.length > 0) {
      items = po.items.map((item) => {
        const received = receivedItems.find((ri) => ri.lineItemId === item.id)
        if (received) {
          return {
            ...item,
            deliveredQuantity: item.deliveredQuantity + received.quantity,
          }
        }
        return item
      })

      // Check if all items fully received
      const allFullyReceived = items.every((item) => item.deliveredQuantity >= item.quantity)
      status = allFullyReceived ? 'received' : 'partial_received'
    } else {
      // Mark all items as fully received
      items = po.items.map((item) => ({
        ...item,
        deliveredQuantity: item.quantity,
      }))
    }

    await sql`
      UPDATE wells_purchase_orders
      SET
        status = ${status},
        actual_delivery_date = ${actualDeliveryDate.toISOString()},
        items = ${JSON.stringify(items)},
        updated_at = NOW()
      WHERE id = ${po.id}
    `

    // Record transaction
    await this.recordTransaction(userId, po.id, 'po_received', po.totalAmount, {
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      status,
    })

    // Trigger payment if fully received
    const triggerPayment = status === 'received' && po.paymentStatus === 'pending'

    const updatedPO: WellsPurchaseOrder = {
      ...po,
      status,
      actualDeliveryDate,
      items,
      updatedAt: new Date(),
    }

    const message =
      status === 'received'
        ? `PO ${po.poNumber} marked as received. All ${items.length} item${items.length !== 1 ? 's' : ''} delivered.${triggerPayment ? ' Payment can now be released.' : ''}`
        : `PO ${po.poNumber} partially received. ${items.filter((i) => i.deliveredQuantity >= i.quantity).length} of ${items.length} items fully delivered.`

    return { po: updatedPO, message, triggerPayment }
  }

  /**
   * Send PO to supplier
   * "Send PO #456 to supplier"
   */
  static async sendToSupplier(
    userId: string,
    poIdentifier: string
  ): Promise<{ po: WellsPurchaseOrder; message: string; emailSent: boolean }> {
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND (po_number = ${poIdentifier} OR id = ${poIdentifier})
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`PO ${poIdentifier} not found`)
    }

    const po = this.mapRowToPO(result.rows[0])

    if (!['draft', 'pending_approval', 'approved'].includes(po.status)) {
      throw new Error(`PO ${po.poNumber} has already been sent (status: ${po.status})`)
    }

    await sql`
      UPDATE wells_purchase_orders
      SET
        status = 'sent',
        updated_at = NOW()
      WHERE id = ${po.id}
    `

    // TODO: Integrate with email service to actually send the PO
    const emailSent = false

    const updatedPO: WellsPurchaseOrder = {
      ...po,
      status: 'sent',
      updatedAt: new Date(),
    }

    const message = `PO ${po.poNumber} sent to ${po.supplierName}${po.supplierEmail ? ` (${po.supplierEmail})` : ''}. Total: $${po.totalAmount.toLocaleString()}.`

    return { po: updatedPO, message, emailSent }
  }

  /**
   * Cancel a PO
   * "Cancel the order from Acme"
   */
  static async cancelPO(
    userId: string,
    poIdentifier: string,
    reason?: string
  ): Promise<{ po: WellsPurchaseOrder; message: string }> {
    // Try to find by PO number, ID, or supplier name
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND (
          po_number = ${poIdentifier}
          OR id = ${poIdentifier}
          OR LOWER(supplier_name) LIKE LOWER(${`%${poIdentifier}%`})
        )
        AND status NOT IN ('received', 'completed', 'cancelled')
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`Active PO for "${poIdentifier}" not found`)
    }

    const po = this.mapRowToPO(result.rows[0])

    if (['received', 'completed'].includes(po.status)) {
      throw new Error(`Cannot cancel ${po.status} PO ${po.poNumber}`)
    }

    await sql`
      UPDATE wells_purchase_orders
      SET
        status = 'cancelled',
        notes = COALESCE(notes, '') || ${reason ? `\nCancellation reason: ${reason}` : ''},
        updated_at = NOW()
      WHERE id = ${po.id}
    `

    // Record transaction
    await this.recordTransaction(userId, po.id, 'po_cancelled', po.totalAmount, {
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      reason,
    })

    return {
      po: { ...po, status: 'cancelled', updatedAt: new Date() },
      message: `PO ${po.poNumber} for ${po.supplierName} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    }
  }

  /**
   * Update tracking information
   * "PO #456 shipped, tracking number XYZ123"
   */
  static async updateTracking(
    userId: string,
    poIdentifier: string,
    trackingNumber: string,
    shippingMethod?: string
  ): Promise<{ po: WellsPurchaseOrder; message: string }> {
    const result = await sql`
      SELECT * FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND (po_number = ${poIdentifier} OR id = ${poIdentifier})
      LIMIT 1
    `

    if (result.rows.length === 0) {
      throw new Error(`PO ${poIdentifier} not found`)
    }

    const po = this.mapRowToPO(result.rows[0])

    await sql`
      UPDATE wells_purchase_orders
      SET
        status = 'shipped',
        tracking_number = ${trackingNumber},
        shipping_method = COALESCE(${shippingMethod}, shipping_method),
        updated_at = NOW()
      WHERE id = ${po.id}
    `

    const updatedPO: WellsPurchaseOrder = {
      ...po,
      status: 'shipped',
      trackingNumber,
      shippingMethod: shippingMethod || po.shippingMethod,
      updatedAt: new Date(),
    }

    return {
      po: updatedPO,
      message: `PO ${po.poNumber} marked as shipped. Tracking: ${trackingNumber}${shippingMethod ? ` via ${shippingMethod}` : ''}.`,
    }
  }

  /**
   * Get PO summary/analytics
   * "What's my purchasing status this month?"
   */
  static async getPOSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ summary: POSummary; message: string }> {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endDate || new Date()

    const result = await sql`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(total_amount), 0) as total_value,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'partial_received') THEN 1 ELSE 0 END), 0) as pending_delivery_count,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'acknowledged', 'in_production', 'shipped', 'partial_received') THEN total_amount ELSE 0 END), 0) as pending_delivery_value,
        COALESCE(SUM(CASE WHEN status IN ('received', 'completed') AND actual_delivery_date >= ${start.toISOString()} THEN 1 ELSE 0 END), 0) as received_this_month,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' AND status IN ('received', 'completed') THEN 1 ELSE 0 END), 0) as awaiting_payment
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
    `

    const statusResult = await sql`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as value
      FROM wells_purchase_orders
      WHERE user_id = ${userId}
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
      GROUP BY status
    `

    const row = result.rows[0]

    // Initialize all statuses
    const byStatus: Record<POStatus, { count: number; value: number }> = {
      draft: { count: 0, value: 0 },
      pending_approval: { count: 0, value: 0 },
      approved: { count: 0, value: 0 },
      sent: { count: 0, value: 0 },
      acknowledged: { count: 0, value: 0 },
      in_production: { count: 0, value: 0 },
      shipped: { count: 0, value: 0 },
      partial_received: { count: 0, value: 0 },
      received: { count: 0, value: 0 },
      completed: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
      disputed: { count: 0, value: 0 },
    }

    for (const statusRow of statusResult.rows) {
      byStatus[statusRow.status as POStatus] = {
        count: parseInt(statusRow.count),
        value: parseFloat(statusRow.value),
      }
    }

    const summary: POSummary = {
      totalOrders: parseInt(row.total_count),
      totalValue: parseFloat(row.total_value),
      pendingDelivery: parseInt(row.pending_delivery_count),
      pendingDeliveryValue: parseFloat(row.pending_delivery_value),
      receivedThisMonth: parseInt(row.received_this_month),
      awaitingPayment: parseInt(row.awaiting_payment),
      byStatus,
    }

    const message = `Purchase Order Summary:
- Total: ${summary.totalOrders} POs worth $${summary.totalValue.toLocaleString()}
- Pending Delivery: ${summary.pendingDelivery} ($${summary.pendingDeliveryValue.toLocaleString()})
- Received This Month: ${summary.receivedThisMonth}
- Awaiting Payment: ${summary.awaitingPayment}`

    return { summary, message }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear()
    const result = await sql`
      SELECT COUNT(*) as count FROM wells_purchase_orders
      WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `
    const sequence = parseInt(result.rows[0].count) + 1
    return `WELLS-PO-${year}-${sequence.toString().padStart(6, '0')}`
  }

  private static mapRowToPO(row: Record<string, unknown>): WellsPurchaseOrder {
    return {
      id: row.id as string,
      poNumber: row.po_number as string,
      supplierId: row.supplier_id as string,
      supplierName: row.supplier_name as string,
      supplierEmail: row.supplier_email as string | undefined,
      supplierPhone: row.supplier_phone as string | undefined,
      subtotal: parseFloat(row.subtotal as string),
      taxAmount: parseFloat(row.tax_amount as string),
      shippingAmount: parseFloat(row.shipping_amount as string),
      wellsFee: parseFloat(row.wells_fee as string),
      totalAmount: parseFloat(row.total_amount as string),
      currency: row.currency as string,
      orderDate: new Date(row.order_date as string),
      expectedDeliveryDate: row.expected_delivery_date ? new Date(row.expected_delivery_date as string) : undefined,
      actualDeliveryDate: row.actual_delivery_date ? new Date(row.actual_delivery_date as string) : undefined,
      paymentDueDate: row.payment_due_date ? new Date(row.payment_due_date as string) : undefined,
      status: row.status as POStatus,
      items: (row.items as POLineItem[]) || [],
      shippingAddress: row.shipping_address as string | undefined,
      shippingMethod: row.shipping_method as string | undefined,
      trackingNumber: row.tracking_number as string | undefined,
      paymentTerms: row.payment_terms as string | undefined,
      paymentStatus: row.payment_status as 'pending' | 'partial' | 'paid',
      amountPaid: parseFloat(row.amount_paid as string) || 0,
      notes: row.notes as string | undefined,
      internalNotes: row.internal_notes as string | undefined,
      createdByAi: row.created_by_ai as boolean,
      aiConversationId: row.ai_conversation_id as string | undefined,
      aiCommand: row.ai_command as string | undefined,
      wellsDealId: row.wells_deal_id as string | undefined,
      wellsRfqId: row.wells_rfq_id as string | undefined,
      linkedInvoiceId: row.linked_invoice_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }

  private static async recordTransaction(
    userId: string,
    referenceId: string,
    type: string,
    amount: number,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    await sql`
      INSERT INTO wells_transactions (
        id, user_id, reference_id, type, amount, currency, metadata, created_at
      ) VALUES (
        ${transactionId}, ${userId}, ${referenceId}, ${type}, ${amount}, 'USD', ${JSON.stringify(metadata)}, NOW()
      )
    `
  }
}

// ============================================================================
// CONVERSATIONAL PARSER
// ============================================================================

/**
 * Parse natural language PO commands
 */
export function parsePOCommand(message: string): {
  action: 'create' | 'list' | 'receive' | 'send' | 'cancel' | 'track' | 'summary' | 'unknown'
  params: Record<string, unknown>
} {
  const lower = message.toLowerCase()

  // Create PO
  if ((lower.includes('create') || lower.includes('order') || lower.includes('buy')) && (lower.includes('po') || lower.includes('purchase') || lower.includes('order'))) {
    // Parse: "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"
    const quantityMatch = message.match(/(\d+(?:,\d{3})*)\s+(?:x\s+)?([a-zA-Z][a-zA-Z\s]+?)(?:\s+from|\s+at|\s*$)/i)
    const priceMatch = message.match(/\$?([\d,.]+)\s*(?:each|per|\/)/i)
    const supplierMatch = message.match(/(?:from|supplier:?)\s+([A-Z][A-Za-z\s]+?)(?:\s+at|\s+for|\s*$)/i)

    return {
      action: 'create',
      params: {
        quantity: quantityMatch ? parseInt(quantityMatch[1].replace(/,/g, '')) : undefined,
        description: quantityMatch ? quantityMatch[2].trim() : undefined,
        unitPrice: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined,
        supplierName: supplierMatch ? supplierMatch[1].trim() : undefined,
      },
    }
  }

  // Mark as received
  if (lower.includes('received') || lower.includes('arrived') || lower.includes('delivered')) {
    const poMatch = message.match(/#?(?:PO[- ]?)?(\d+|WELLS-PO-\d{4}-\d+)/i)
    return {
      action: 'receive',
      params: {
        poIdentifier: poMatch ? poMatch[1] : undefined,
      },
    }
  }

  // Send to supplier
  if (lower.includes('send') && (lower.includes('po') || lower.includes('order') || lower.includes('supplier'))) {
    const poMatch = message.match(/#?(?:PO[- ]?)?(\d+|WELLS-PO-\d{4}-\d+)/i)
    return {
      action: 'send',
      params: {
        poIdentifier: poMatch ? poMatch[1] : undefined,
      },
    }
  }

  // Tracking update
  if (lower.includes('track') || lower.includes('shipped') || lower.includes('shipping')) {
    const poMatch = message.match(/#?(?:PO[- ]?)?(\d+|WELLS-PO-\d{4}-\d+)/i)
    const trackingMatch = message.match(/(?:tracking|number)[:\s]+([A-Z0-9]+)/i)
    return {
      action: 'track',
      params: {
        poIdentifier: poMatch ? poMatch[1] : undefined,
        trackingNumber: trackingMatch ? trackingMatch[1] : undefined,
      },
    }
  }

  // Cancel
  if (lower.includes('cancel')) {
    const poMatch = message.match(/#?(?:PO[- ]?)?(\d+|WELLS-PO-\d{4}-\d+)/i)
    const supplierMatch = message.match(/(?:from|with)\s+([A-Z][A-Za-z\s]+)/i)
    return {
      action: 'cancel',
      params: {
        poIdentifier: poMatch ? poMatch[1] : supplierMatch ? supplierMatch[1].trim() : undefined,
      },
    }
  }

  // List/show POs
  if (lower.includes('show') || lower.includes('list') || lower.includes('what')) {
    const isPending = lower.includes('pending') || lower.includes('awaiting') || lower.includes('outstanding')
    return {
      action: 'list',
      params: {
        pendingDelivery: isPending,
      },
    }
  }

  // Summary
  if (lower.includes('summary') || lower.includes('status') || lower.includes('analytics')) {
    return {
      action: 'summary',
      params: {},
    }
  }

  return { action: 'unknown', params: {} }
}
