// @ts-nocheck
/**
 * Order Management API
 *
 * Central hub for all intercepted orders:
 * - View order queue
 * - Route orders to suppliers
 * - Track margin capture
 * - Generate virtual cards for payment
 *
 * CROSS-SELL: High-value orders trigger Grain & Vault treasury pitch
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// GET: List orders with filters
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status')
    const customerId = searchParams.get('customer')
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeLines = searchParams.get('lines') === 'true'

    let query
    if (status) {
      query = sql`
        SELECT
          io.*, ec.company_name as customer_name, ec.erp_type,
          (SELECT COUNT(*) FROM intercept_order_lines WHERE order_id = io.id) as line_count,
          (SELECT COUNT(*) FROM intercept_order_lines WHERE order_id = io.id AND supplier_id IS NULL) as unrouted_lines
        FROM intercept_orders io
        JOIN erp_customers ec ON io.customer_id = ec.id
        WHERE io.status = ${status}
        ORDER BY io.received_at DESC
        LIMIT ${limit}
      `
    } else {
      query = sql`
        SELECT
          io.*, ec.company_name as customer_name, ec.erp_type,
          (SELECT COUNT(*) FROM intercept_order_lines WHERE order_id = io.id) as line_count,
          (SELECT COUNT(*) FROM intercept_order_lines WHERE order_id = io.id AND supplier_id IS NULL) as unrouted_lines
        FROM intercept_orders io
        JOIN erp_customers ec ON io.customer_id = ec.id
        ORDER BY io.received_at DESC
        LIMIT ${limit}
      `
    }

    const ordersResult = await query

    // Get summary stats
    const statsResult = await sql`
      SELECT
        COUNT(*) as total_orders,
        SUM(customer_total) as total_spend,
        SUM(gross_margin) as total_margin,
        AVG(margin_pct) as avg_margin_pct,
        SUM(CASE WHEN status = 'routing' THEN 1 ELSE 0 END) as pending_routing,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped
      FROM intercept_orders
      WHERE status NOT IN ('cancelled')
    `

    return NextResponse.json({
      orders: ordersResult.rows,
      stats: statsResult.rows[0],
      count: ordersResult.rows.length
    })
  } catch (error) {
    console.error('Orders list error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// POST: Create order manually or route existing order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'create':
        return await createOrder(body)
      case 'route':
        return await routeOrder(body.orderId)
      case 'confirm':
        return await confirmOrder(body.orderId)
      case 'ship':
        return await shipOrder(body)
      case 'invoice':
        return await invoiceOrder(body)
      case 'create_vcard':
        return await createVirtualCard(body)
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Order action error:', error)
    return NextResponse.json({ error: 'Order action failed' }, { status: 500 })
  }
}

// Create new order manually
async function createOrder(body: any) {
  const { customerCode, poNumber, lines, shipTo } = body

  // Get customer
  const customerResult = await sql`
    SELECT id FROM erp_customers WHERE customer_code = ${customerCode}
  `

  if (customerResult.rows.length === 0) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const orderResult = await sql`
    SELECT process_incoming_order(
      ${customerResult.rows[0].id},
      'manual',
      ${poNumber},
      ${JSON.stringify(lines)},
      ${JSON.stringify(shipTo || {})}
    ) as order_id
  `

  const orderId = orderResult.rows[0].order_id

  // Auto-route
  await sql`SELECT * FROM route_order_lines(${orderId})`

  // Check cross-sell
  await checkCrossSellOpportunity(customerResult.rows[0].id, lines)

  return NextResponse.json({
    success: true,
    orderId,
    message: 'Order created and routed'
  })
}

// Route order to suppliers
async function routeOrder(orderId: string) {
  const result = await sql`SELECT * FROM route_order_lines(${orderId})`

  // Get updated order
  const orderResult = await sql`
    SELECT * FROM intercept_orders WHERE id = ${orderId}
  `

  return NextResponse.json({
    success: true,
    routing: result.rows,
    order: orderResult.rows[0]
  })
}

// Confirm order with supplier
async function confirmOrder(orderId: string) {
  await sql`
    UPDATE intercept_orders SET
      status = 'supplier_confirmed',
      confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${orderId}
  `

  return NextResponse.json({ success: true, message: 'Order confirmed' })
}

// Mark order as shipped
async function shipOrder(body: any) {
  const { orderId, trackingNumbers, carrier } = body

  await sql`
    UPDATE intercept_orders SET
      status = 'shipped',
      shipped_at = NOW(),
      updated_at = NOW()
    WHERE id = ${orderId}
  `

  // Update lines as shipped
  await sql`
    UPDATE intercept_order_lines SET
      quantity_shipped = quantity,
      status = 'shipped'
    WHERE order_id = ${orderId}
  `

  return NextResponse.json({
    success: true,
    message: 'Order marked as shipped',
    trackingNumbers
  })
}

// Generate invoice
async function invoiceOrder(body: any) {
  const { orderId } = body
  const invoiceNumber = `INV-${Date.now()}`

  await sql`
    UPDATE intercept_orders SET
      status = 'invoiced',
      invoiced_at = NOW(),
      updated_at = NOW()
    WHERE id = ${orderId}
  `

  // Calculate margin earned and update customer
  const orderResult = await sql`
    SELECT io.*, ec.margin_share_pct
    FROM intercept_orders io
    JOIN erp_customers ec ON io.customer_id = ec.id
    WHERE io.id = ${orderId}
  `

  const order = orderResult.rows[0]
  const grossMargin = parseFloat(order.gross_margin || 0)
  const customerShare = grossMargin * (parseFloat(order.margin_share_pct || 50) / 100)
  const wellsShare = grossMargin - customerShare

  // Update customer metrics
  await sql`
    UPDATE erp_customers SET
      total_margin_earned = total_margin_earned + ${wellsShare},
      updated_at = NOW()
    WHERE id = ${order.customer_id}
  `

  return NextResponse.json({
    success: true,
    invoiceNumber,
    grossMargin,
    customerRebate: customerShare,
    wellsRevenue: wellsShare
  })
}

// Create virtual card for supplier payment
async function createVirtualCard(body: any) {
  const { orderId, supplierId } = body

  // Get order and supplier info
  const orderResult = await sql`
    SELECT io.*, SUM(iol.supplier_line_total) as supplier_total
    FROM intercept_orders io
    JOIN intercept_order_lines iol ON io.id = iol.order_id
    WHERE io.id = ${orderId}
    AND iol.supplier_id = ${supplierId}
    GROUP BY io.id
  `

  if (orderResult.rows.length === 0) {
    return NextResponse.json({ error: 'Order/supplier combination not found' }, { status: 404 })
  }

  const supplierTotal = parseFloat(orderResult.rows[0].supplier_total)

  // Create virtual card (mock - in production use Airwallex/Stripe)
  const cardResult = await sql`
    INSERT INTO payment_virtual_cards (
      order_id, supplier_id, provider, external_card_id,
      card_number_last4, expiry_month, expiry_year,
      authorized_amount, remaining_amount, status
    ) VALUES (
      ${orderId}, ${supplierId}, 'airwallex',
      ${'VC-' + Date.now()},
      ${Math.floor(1000 + Math.random() * 9000).toString()},
      ${new Date().getMonth() + 2},
      ${new Date().getFullYear() + 1},
      ${supplierTotal}, ${supplierTotal}, 'active'
    )
    RETURNING *
  `

  return NextResponse.json({
    success: true,
    virtualCard: {
      id: cardResult.rows[0].id,
      last4: cardResult.rows[0].card_number_last4,
      authorizedAmount: supplierTotal,
      provider: 'airwallex',
      expiresAt: `${cardResult.rows[0].expiry_month}/${cardResult.rows[0].expiry_year}`
    },
    message: `Virtual card created for $${supplierTotal.toFixed(2)}`
  })
}

// Check for cross-sell opportunities
async function checkCrossSellOpportunity(customerId: string, lines: any[]) {
  const orderTotal = lines.reduce((sum, line) =>
    sum + (parseFloat(line.quantity) * parseFloat(line.unit_price)), 0)

  // Get customer info
  const customerResult = await sql`
    SELECT total_spend_captured, company_name FROM erp_customers WHERE id = ${customerId}
  `

  if (customerResult.rows.length === 0) return

  const customer = customerResult.rows[0]
  const totalSpend = parseFloat(customer.total_spend_captured || 0)

  // Cross-sell triggers
  const triggers = []

  // Large order - treasury optimization
  if (orderTotal > 25000) {
    triggers.push({
      type: 'grain_vault_treasury',
      reason: 'Large order volume',
      pitch: 'Optimize payment timing with Grain & Vault Treasury - earn GRAIN rewards on early payments'
    })
  }

  // High total spend - supplier financing
  if (totalSpend > 100000) {
    triggers.push({
      type: 'grain_vault_credit',
      reason: 'High spend volume',
      pitch: 'Access 1:1 credit lines backed by GRAIN - extend payment terms without impacting suppliers'
    })
  }

  // International suppliers likely - FX
  if (orderTotal > 10000) {
    triggers.push({
      type: 'grain_vault_fx',
      reason: 'Potential international suppliers',
      pitch: 'Save on supplier payments with competitive FX rates - 50bp better than banks'
    })
  }

  if (triggers.length > 0) {
    console.log(`🎯 CROSS-SELL for ${customer.company_name}:`)
    triggers.forEach(t => console.log(`   - ${t.type}: ${t.pitch}`))
  }

  return triggers
}
