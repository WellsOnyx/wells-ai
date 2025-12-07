// @ts-nocheck
/**
 * EDI Document Interchange API
 *
 * Handles X12 EDI documents:
 * - 850: Purchase Order (inbound from customer)
 * - 855: PO Acknowledgment (outbound to customer)
 * - 856: Ship Notice/ASN (outbound to customer)
 * - 810: Invoice (outbound to customer)
 * - 997: Functional Acknowledgment
 *
 * CROSS-SELL: Large PO volumes trigger Grain & Vault treasury pitch
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// POST: Receive EDI document
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let rawEdi: string
    let tradingPartnerId: string | null = null

    // Handle different delivery methods
    if (contentType.includes('json')) {
      const body = await req.json()
      rawEdi = body.edi || body.content || body.document
      tradingPartnerId = body.tradingPartnerId
    } else {
      rawEdi = await req.text()
    }

    if (!rawEdi) {
      return NextResponse.json({ error: 'No EDI content provided' }, { status: 400 })
    }

    // Parse EDI envelope
    const parsed = parseEDI(rawEdi)

    // Identify trading partner
    const partnerResult = await sql`
      SELECT etp.*, ec.id as customer_id, ec.company_name, ec.margin_share_pct
      FROM edi_trading_partners etp
      JOIN erp_customers ec ON etp.customer_id = ec.id
      WHERE etp.isa_id = ${parsed.isaId}
      AND etp.is_active = TRUE
    `

    if (partnerResult.rows.length === 0) {
      console.log(`EDI: Unknown trading partner ISA ${parsed.isaId}`)
      // Store for manual review
      await sql`
        INSERT INTO edi_documents (
          customer_id, document_type, direction, isa_control_number,
          raw_edi, status, error_message
        ) VALUES (
          NULL, ${parsed.documentType}, 'inbound', ${parsed.isaControlNumber},
          ${rawEdi}, 'error', 'Unknown trading partner'
        )
      `
      return NextResponse.json({
        error: 'Unknown trading partner',
        isaId: parsed.isaId
      }, { status: 400 })
    }

    const partner = partnerResult.rows[0]

    // Store the document
    const docResult = await sql`
      INSERT INTO edi_documents (
        customer_id, trading_partner_id, document_type, direction,
        isa_control_number, gs_control_number, st_control_number,
        po_number, raw_edi, parsed_content, status
      ) VALUES (
        ${partner.customer_id}, ${partner.id}, ${parsed.documentType}, 'inbound',
        ${parsed.isaControlNumber}, ${parsed.gsControlNumber}, ${parsed.stControlNumber},
        ${parsed.poNumber}, ${rawEdi}, ${JSON.stringify(parsed)}, 'received'
      )
      RETURNING id
    `

    const docId = docResult.rows[0].id

    // Process based on document type
    let result
    switch (parsed.documentType) {
      case '850':
        result = await process850(docId, partner, parsed)
        // Cross-sell check for large orders
        await checkGrainVaultCrossSell(partner.customer_id, parsed)
        break
      case '997':
        result = await process997(docId, partner, parsed)
        break
      default:
        await sql`
          UPDATE edi_documents SET status = 'error', error_message = 'Unsupported document type'
          WHERE id = ${docId}
        `
        return NextResponse.json({
          error: `Document type ${parsed.documentType} not supported for inbound`
        }, { status: 400 })
    }

    // Send 997 acknowledgment
    if (parsed.documentType === '850' && partner.supports_997) {
      await send997Acknowledgment(partner, parsed)
    }

    return NextResponse.json({
      success: true,
      documentId: docId,
      documentType: parsed.documentType,
      poNumber: parsed.poNumber,
      ...result
    })
  } catch (error) {
    console.error('EDI processing error:', error)
    return NextResponse.json({ error: 'Failed to process EDI document' }, { status: 500 })
  }
}

// Parse EDI document
function parseEDI(raw: string): any {
  const segments = raw.split('~').map(s => s.trim()).filter(s => s)
  const result: any = {
    segments: [],
    lineItems: []
  }

  for (const segment of segments) {
    const elements = segment.split('*')
    const segmentId = elements[0]

    switch (segmentId) {
      case 'ISA':
        result.isaId = elements[6]?.trim()
        result.isaControlNumber = elements[13]
        break
      case 'GS':
        result.gsControlNumber = elements[6]
        result.documentType = elements[1] === 'PO' ? '850' :
                              elements[1] === 'FA' ? '997' : elements[1]
        break
      case 'ST':
        result.documentType = elements[1]
        result.stControlNumber = elements[2]
        break
      case 'BEG':
        result.poNumber = elements[3]
        result.poDate = elements[5]
        result.purchaseOrderType = elements[1]
        break
      case 'N1':
        if (elements[1] === 'ST') {
          result.shipTo = {
            name: elements[2],
            code: elements[4]
          }
        } else if (elements[1] === 'BT') {
          result.billTo = {
            name: elements[2],
            code: elements[4]
          }
        }
        break
      case 'N3':
        if (result.shipTo && !result.shipTo.address) {
          result.shipTo.address = elements[1]
        }
        break
      case 'N4':
        if (result.shipTo && !result.shipTo.city) {
          result.shipTo.city = elements[1]
          result.shipTo.state = elements[2]
          result.shipTo.zip = elements[3]
        }
        break
      case 'PO1':
        result.lineItems.push({
          lineNumber: elements[1],
          quantity: parseFloat(elements[2]),
          uom: elements[3],
          unitPrice: parseFloat(elements[4]),
          sku: elements[7],
          description: ''
        })
        break
      case 'PID':
        if (result.lineItems.length > 0) {
          const lastItem = result.lineItems[result.lineItems.length - 1]
          if (elements[5]) {
            lastItem.description = elements[5]
          }
        }
        break
      case 'CTT':
        result.lineCount = parseInt(elements[1])
        break
    }

    result.segments.push({ id: segmentId, elements })
  }

  return result
}

// Process 850 Purchase Order
async function process850(docId: string, partner: any, parsed: any) {
  // Calculate totals
  let customerTotal = 0
  const lines = parsed.lineItems.map((item: any) => {
    const lineTotal = item.quantity * item.unitPrice
    customerTotal += lineTotal
    return {
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      uom: item.uom,
      line_total: lineTotal
    }
  })

  // Create order
  const orderResult = await sql`
    SELECT process_incoming_order(
      ${partner.customer_id},
      'edi_850',
      ${parsed.poNumber},
      ${JSON.stringify(lines)},
      ${JSON.stringify(parsed.shipTo || {})}
    ) as order_id
  `

  const orderId = orderResult.rows[0].order_id

  // Link EDI doc to order
  await sql`
    UPDATE edi_documents SET
      internal_order_id = ${orderId},
      status = 'processed',
      processed_at = NOW()
    WHERE id = ${docId}
  `

  // Route order lines to suppliers
  const routingResult = await sql`
    SELECT * FROM route_order_lines(${orderId})
  `

  // Update customer spend metrics
  await sql`
    UPDATE erp_customers SET
      total_spend_captured = total_spend_captured + ${customerTotal},
      updated_at = NOW()
    WHERE id = ${partner.customer_id}
  `

  return {
    orderId,
    lineCount: lines.length,
    customerTotal,
    routing: routingResult.rows
  }
}

// Process 997 Functional Acknowledgment
async function process997(docId: string, partner: any, parsed: any) {
  // 997 is acknowledgment - just mark received
  await sql`
    UPDATE edi_documents SET status = 'processed', processed_at = NOW()
    WHERE id = ${docId}
  `

  return { acknowledged: true }
}

// Send 997 acknowledgment
async function send997Acknowledgment(partner: any, originalDoc: any) {
  const edi997 = build997(partner, originalDoc)

  // Store outbound document
  await sql`
    INSERT INTO edi_documents (
      customer_id, trading_partner_id, document_type, direction,
      raw_edi, status
    ) VALUES (
      ${partner.customer_id}, ${partner.id}, '997', 'outbound',
      ${edi997}, 'processed'
    )
  `

  // In production: Send via AS2/SFTP/VAN
  console.log(`EDI: 997 acknowledgment ready for ${partner.company_name}`)
}

// Build 997 acknowledgment
function build997(partner: any, originalDoc: any): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const controlNum = Math.floor(Math.random() * 999999999).toString().padStart(9, '0')

  return [
    `ISA*00*          *00*          *ZZ*WELLSONYX      *ZZ*${partner.isa_id.padEnd(15)}*${date.slice(2)}*${time}*U*00401*${controlNum}*0*P*>`,
    `GS*FA*WELLSONYX*${partner.gs_id}*${date}*${time}*${controlNum}*X*004010`,
    `ST*997*0001`,
    `AK1*PO*${originalDoc.gsControlNumber}`,
    `AK9*A*1*1*1`,
    `SE*4*0001`,
    `GE*1*${controlNum}`,
    `IEA*1*${controlNum}~`
  ].join('~')
}

// Check if customer qualifies for Grain & Vault cross-sell
async function checkGrainVaultCrossSell(customerId: string, parsed: any) {
  const orderTotal = parsed.lineItems.reduce((sum: number, item: any) =>
    sum + (item.quantity * item.unitPrice), 0)

  // Check customer's total spend
  const spendResult = await sql`
    SELECT total_spend_captured, company_name, primary_contact_email
    FROM erp_customers
    WHERE id = ${customerId}
  `

  if (spendResult.rows.length === 0) return

  const customer = spendResult.rows[0]
  const totalSpend = parseFloat(customer.total_spend_captured || 0) + orderTotal

  // Cross-sell triggers:
  // 1. Single order > $50,000
  // 2. Total spend > $250,000
  // 3. Monthly volume warrants treasury optimization

  if (orderTotal > 50000 || totalSpend > 250000) {
    console.log(`🎯 CROSS-SELL: ${customer.company_name} qualifies for Grain & Vault`)
    console.log(`   Order: $${orderTotal.toLocaleString()}, Total Spend: $${totalSpend.toLocaleString()}`)

    // In production: Trigger cross-sell workflow
    // - Send email about treasury optimization
    // - Offer GRAIN rewards for payment acceleration
    // - Suggest FX services for international suppliers
  }
}

// GET: Document history or status
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const customerId = searchParams.get('customer')
  const documentType = searchParams.get('type')
  const poNumber = searchParams.get('po')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = sql`
    SELECT
      ed.id, ed.document_type, ed.direction, ed.po_number,
      ed.status, ed.created_at, ed.processed_at,
      ec.company_name as customer_name
    FROM edi_documents ed
    JOIN erp_customers ec ON ed.customer_id = ec.id
    WHERE 1=1
  `

  // Build filtered query
  const conditions: string[] = []
  const params: any[] = []

  if (customerId) {
    conditions.push(`ed.customer_id = $${params.length + 1}`)
    params.push(customerId)
  }
  if (documentType) {
    conditions.push(`ed.document_type = $${params.length + 1}`)
    params.push(documentType)
  }
  if (poNumber) {
    conditions.push(`ed.po_number = $${params.length + 1}`)
    params.push(poNumber)
  }

  // For now, just get recent documents
  const result = await sql`
    SELECT
      ed.id, ed.document_type, ed.direction, ed.po_number,
      ed.invoice_number, ed.status, ed.created_at, ed.processed_at,
      ed.internal_order_id,
      ec.company_name as customer_name
    FROM edi_documents ed
    LEFT JOIN erp_customers ec ON ed.customer_id = ec.id
    ORDER BY ed.created_at DESC
    LIMIT ${limit}
  `

  return NextResponse.json({
    documents: result.rows,
    count: result.rows.length
  })
}
