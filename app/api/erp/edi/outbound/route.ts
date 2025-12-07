// @ts-nocheck
/**
 * Outbound EDI Generator
 *
 * Generates and sends:
 * - 855: Purchase Order Acknowledgment
 * - 856: Advance Ship Notice (ASN)
 * - 810: Invoice
 *
 * These go BACK to the customer's ERP to complete the transaction loop.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// POST: Generate outbound EDI document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, documentType } = body

    if (!orderId || !documentType) {
      return NextResponse.json({
        error: 'Missing orderId or documentType'
      }, { status: 400 })
    }

    // Get order with customer info
    const orderResult = await sql`
      SELECT
        io.*,
        ec.customer_code, ec.company_name, ec.vendor_number,
        etp.isa_id, etp.isa_qualifier, etp.gs_id,
        etp.supports_855, etp.supports_856, etp.supports_810
      FROM intercept_orders io
      JOIN erp_customers ec ON io.customer_id = ec.id
      LEFT JOIN edi_trading_partners etp ON etp.customer_id = ec.id AND etp.is_active = TRUE
      WHERE io.id = ${orderId}
    `

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get order lines
    const linesResult = await sql`
      SELECT * FROM intercept_order_lines
      WHERE order_id = ${orderId}
      ORDER BY line_number
    `

    // Generate EDI based on type
    let edi: string
    let updateQuery: any

    switch (documentType) {
      case '855':
        if (!order.supports_855) {
          return NextResponse.json({ error: 'Customer does not support 855' }, { status: 400 })
        }
        edi = generate855(order, linesResult.rows)
        updateQuery = sql`UPDATE intercept_orders SET confirmed_at = NOW() WHERE id = ${orderId}`
        break

      case '856':
        if (!order.supports_856) {
          return NextResponse.json({ error: 'Customer does not support 856' }, { status: 400 })
        }
        const { trackingNumbers, shipDate } = body
        edi = generate856(order, linesResult.rows, trackingNumbers, shipDate)
        updateQuery = sql`UPDATE intercept_orders SET shipped_at = NOW(), status = 'shipped' WHERE id = ${orderId}`
        break

      case '810':
        if (!order.supports_810) {
          return NextResponse.json({ error: 'Customer does not support 810' }, { status: 400 })
        }
        const { invoiceNumber } = body
        edi = generate810(order, linesResult.rows, invoiceNumber)
        updateQuery = sql`UPDATE intercept_orders SET invoiced_at = NOW(), status = 'invoiced' WHERE id = ${orderId}`
        break

      default:
        return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    // Store outbound document
    const docResult = await sql`
      INSERT INTO edi_documents (
        customer_id, trading_partner_id, document_type, direction,
        po_number, internal_order_id, raw_edi, status
      ) VALUES (
        ${order.customer_id}, ${order.trading_partner_id || null},
        ${documentType}, 'outbound',
        ${order.customer_po_number}, ${orderId}, ${edi}, 'generated'
      )
      RETURNING id
    `

    // Update order status
    await updateQuery

    // In production: Send via AS2/SFTP/VAN
    // For now, return the EDI for review

    return NextResponse.json({
      success: true,
      documentId: docResult.rows[0].id,
      documentType,
      orderId,
      edi,
      message: `${documentType} generated for PO ${order.customer_po_number}`
    })
  } catch (error) {
    console.error('Outbound EDI error:', error)
    return NextResponse.json({ error: 'Failed to generate EDI' }, { status: 500 })
  }
}

// Generate 855 PO Acknowledgment
function generate855(order: any, lines: any[]): string {
  const now = new Date()
  const date = formatDate(now)
  const time = formatTime(now)
  const controlNum = generateControlNumber()

  const segments = [
    buildISA(order, date, time, controlNum),
    buildGS('PR', order, date, time, controlNum),
    `ST*855*0001`,
    `BAK*00*AC*${order.customer_po_number}*${formatDate(new Date(order.customer_po_date))}`,
    `N1*SE*Wells Onyx*92*WELLSONYX`,
    `N1*BY*${order.company_name}*92*${order.customer_code}`,
  ]

  // Line item acknowledgments
  lines.forEach((line, idx) => {
    segments.push(
      `PO1*${line.line_number}*${line.quantity}*${line.uom || 'EA'}*${line.customer_unit_price}*PE*VP*${line.customer_sku}`,
      `ACK*IA*${line.quantity}*${line.uom || 'EA'}*${formatDate(addDays(now, 5))}` // Promise date
    )
  })

  segments.push(
    `CTT*${lines.length}`,
    `SE*${segments.length - 2 + 2}*0001`,
    `GE*1*${controlNum}`,
    `IEA*1*${controlNum}`
  )

  return segments.join('~') + '~'
}

// Generate 856 Ship Notice / ASN
function generate856(order: any, lines: any[], trackingNumbers: string[] = [], shipDate: string = null): string {
  const now = new Date()
  const date = formatDate(now)
  const time = formatTime(now)
  const controlNum = generateControlNumber()
  const shipmentId = `SHP-${Date.now()}`

  const segments = [
    buildISA(order, date, time, controlNum),
    buildGS('SH', order, date, time, controlNum),
    `ST*856*0001`,
    `BSN*00*${shipmentId}*${date}*${time}*0001`,

    // Shipment level
    `HL*1**S`,
    `TD1*CTN*${lines.length}****G*${lines.reduce((sum, l) => sum + l.quantity, 0)}*LB`,
    `TD5*B*2*UPSN*M*UPS Ground`,
    trackingNumbers.length > 0 ? `REF*CN*${trackingNumbers[0]}` : null,
    `DTM*011*${shipDate || date}`,

    // Ship from
    `N1*SF*Wells Onyx*92*WELLSONYX`,
    `N3*100 Procurement Way`,
    `N4*Miami*FL*33131*US`,

    // Ship to
    `HL*2*1*O`,
    `N1*ST*${order.ship_to_name || order.company_name}*92*${order.customer_code}`,
    order.ship_to_address ? `N3*${order.ship_to_address}` : null,
    `N4*${order.ship_to_city || 'Unknown'}*${order.ship_to_state || 'FL'}*${order.ship_to_zip || '00000'}*US`,
    `PRF*${order.customer_po_number}`,
  ].filter(Boolean)

  // Item level
  lines.forEach((line, idx) => {
    segments.push(
      `HL*${idx + 3}*2*I`,
      `LIN*${line.line_number}*VP*${line.customer_sku}`,
      `SN1*${line.line_number}*${line.quantity}*EA`
    )
  })

  segments.push(
    `CTT*${lines.length}`,
    `SE*${segments.length - 2 + 2}*0001`,
    `GE*1*${controlNum}`,
    `IEA*1*${controlNum}`
  )

  return segments.join('~') + '~'
}

// Generate 810 Invoice
function generate810(order: any, lines: any[], invoiceNumber: string = null): string {
  const now = new Date()
  const date = formatDate(now)
  const time = formatTime(now)
  const controlNum = generateControlNumber()
  const invNum = invoiceNumber || `INV-${Date.now()}`

  const subtotal = parseFloat(order.customer_subtotal || order.customer_total)
  const tax = parseFloat(order.customer_tax || 0)
  const shipping = parseFloat(order.customer_shipping || 0)
  const total = subtotal + tax + shipping

  const segments = [
    buildISA(order, date, time, controlNum),
    buildGS('IN', order, date, time, controlNum),
    `ST*810*0001`,
    `BIG*${date}*${invNum}*${formatDate(new Date(order.customer_po_date))}*${order.customer_po_number}`,

    // Terms (Net 30)
    `ITD*01*3*****30*****Net 30 Days`,

    // Bill to
    `N1*BT*${order.bill_to_name || order.company_name}*92*${order.customer_code}`,
    order.bill_to_address ? `N3*${order.bill_to_address}` : null,

    // Remit to
    `N1*RE*Wells Onyx LLC*92*WELLSONYX`,
    `N3*100 Procurement Way`,
    `N4*Miami*FL*33131*US`,
  ].filter(Boolean)

  // Line items
  lines.forEach((line, idx) => {
    segments.push(
      `IT1*${line.line_number}*${line.quantity}*${line.uom || 'EA'}*${line.customer_unit_price}*PE*VP*${line.customer_sku}`,
      `PID*F****${line.customer_description?.substring(0, 80) || 'Item'}`
    )
  })

  // Summary
  segments.push(
    `TDS*${Math.round(total * 100)}`, // Total in cents
    `CAD*M*****PREPAID`,
    `CTT*${lines.length}`,
    `SE*${segments.length - 2 + 2}*0001`,
    `GE*1*${controlNum}`,
    `IEA*1*${controlNum}`
  )

  return segments.join('~') + '~'
}

// Helper functions
function buildISA(order: any, date: string, time: string, controlNum: string): string {
  return `ISA*00*          *00*          *ZZ*WELLSONYX      *${order.isa_qualifier || 'ZZ'}*${(order.isa_id || 'CUSTOMER').padEnd(15)}*${date.slice(2)}*${time.slice(0,4)}*U*00401*${controlNum}*0*P*>`
}

function buildGS(funcId: string, order: any, date: string, time: string, controlNum: string): string {
  return `GS*${funcId}*WELLSONYX*${order.gs_id || order.customer_code}*${date}*${time}*${controlNum}*X*004010`
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function formatTime(date: Date): string {
  return date.toISOString().slice(11, 16).replace(/:/g, '')
}

function generateControlNumber(): string {
  return Math.floor(Math.random() * 999999999).toString().padStart(9, '0')
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
