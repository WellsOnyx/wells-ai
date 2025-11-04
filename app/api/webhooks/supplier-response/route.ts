/**
 * Supplier Response Webhook
 * Receives incoming SMS from suppliers responding to procurement requests
 * Parses quotes and updates buyer's Wells in real-time
 */

import { NextRequest, NextResponse } from 'next/server'
import { notionClient } from '@/lib/notion'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string

    console.log('[SUPPLIER RESPONSE] Received SMS from:', from)
    console.log('[SUPPLIER RESPONSE] Message:', body)

    // Parse the response to extract request ID and quote details
    const parsed = parseSupplierResponse(body)

    if (!parsed.requestId) {
      console.log('[SUPPLIER RESPONSE] No request ID found, ignoring')
      return new NextResponse('OK', { status: 200 })
    }

    // Find the supplier by phone number
    const supplier = await findSupplierByPhone(from)

    if (!supplier) {
      console.log('[SUPPLIER RESPONSE] Unknown supplier:', from)
      return new NextResponse('OK', { status: 200 })
    }

    console.log(`[SUPPLIER RESPONSE] Response from ${supplier.name}`)

    // Store the supplier quote
    await storeSupplierQuote({
      requestId: parsed.requestId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      price: parsed.price,
      leadTime: parsed.leadTime,
      rawMessage: body,
      receivedAt: new Date().toISOString()
    })

    // Update the RFQ status in Notion
    await updateRFQStatus(parsed.requestId, {
      supplierName: supplier.name,
      price: parsed.price,
      leadTime: parsed.leadTime
    })

    // Trigger notification to buyer's Wells (via webhook or polling)
    await notifyBuyer({
      requestId: parsed.requestId,
      supplierName: supplier.name,
      price: parsed.price,
      leadTime: parsed.leadTime
    })

    return new NextResponse('OK', { status: 200 })

  } catch (error: any) {
    console.error('[SUPPLIER RESPONSE] Error:', error)
    return new NextResponse('Error', { status: 500 })
  }
}

/**
 * Parse supplier response to extract quote details
 * Expected formats:
 * - "$50/unit, 2 weeks"
 * - "Can do $12 each, ship in 10 days. ID: req_12345"
 * - "Quote: $100/unit. Lead time 3 weeks. req_12345"
 */
function parseSupplierResponse(message: string): {
  requestId: string | null
  price: number | null
  leadTime: string | null
} {
  // Extract request ID
  const requestIdMatch = message.match(/req_\d+/)
  const requestId = requestIdMatch ? requestIdMatch[0] : null

  // Extract price (look for $XX or $X.XX patterns)
  const priceMatch = message.match(/\$(\d+(?:\.\d{2})?)/i)
  const price = priceMatch ? parseFloat(priceMatch[1]) : null

  // Extract lead time (look for "X days" or "X weeks" patterns)
  const leadTimeMatch = message.match(/(\d+)\s*(day|week|month)s?/i)
  const leadTime = leadTimeMatch ? `${leadTimeMatch[1]} ${leadTimeMatch[2]}s` : null

  return { requestId, price, leadTime }
}

/**
 * Find supplier in Notion by phone number
 */
async function findSupplierByPhone(phone: string): Promise<any> {
  try {
    // Normalize phone number (remove +1, spaces, dashes)
    const normalizedPhone = phone.replace(/[\s\-\+]/g, '')

    const response = await notionClient.dataSources.query({
      data_source_id: process.env.NOTION_SUPPLIERS_DB!,
      filter: {
        property: 'Phone',
        phone_number: {
          contains: normalizedPhone.slice(-10) // Last 10 digits
        }
      }
    })

    if (response.results.length === 0) {
      return null
    }

    const page: any = response.results[0]
    return {
      id: page.id,
      name: page.properties.Name.title[0]?.plain_text,
      phone: page.properties.Phone.phone_number
    }
  } catch (error) {
    console.error('[SUPPLIER RESPONSE] Failed to find supplier:', error)
    return null
  }
}

/**
 * Store supplier quote in Notion
 * Creates a new entry in the Supplier Quotes database
 */
async function storeSupplierQuote(quote: any) {
  try {
    await notionClient.pages.create({
      parent: { data_source_id: process.env.NOTION_SUPPLIER_QUOTES_DB! },
      properties: {
        'Request ID': {
          title: [{ text: { content: quote.requestId } }]
        },
        'Supplier': {
          rich_text: [{ text: { content: quote.supplierName } }]
        },
        'Price': {
          number: quote.price
        },
        'Lead Time': {
          rich_text: [{ text: { content: quote.leadTime || 'Not specified' } }]
        },
        'Raw Message': {
          rich_text: [{ text: { content: quote.rawMessage } }]
        },
        'Received At': {
          date: { start: quote.receivedAt }
        },
        'Status': {
          select: { name: 'Pending Review' }
        }
      }
    })

    console.log(`[SUPPLIER RESPONSE] Stored quote from ${quote.supplierName}`)
  } catch (error) {
    console.error('[SUPPLIER RESPONSE] Failed to store quote:', error)
  }
}

/**
 * Update RFQ status in Notion with new supplier response
 */
async function updateRFQStatus(requestId: string, supplierInfo: any) {
  try {
    // Find the RFQ by request ID
    const response = await notionClient.dataSources.query({
      data_source_id: process.env.NOTION_RFQS_DB!,
      filter: {
        property: 'Request ID',
        title: {
          equals: requestId
        }
      }
    })

    if (response.results.length === 0) {
      console.log(`[SUPPLIER RESPONSE] RFQ not found: ${requestId}`)
      return
    }

    const rfqPage: any = response.results[0]

    // Get current response count
    const currentResponses = rfqPage.properties['Responses Received']?.number || 0

    // Update the RFQ
    await notionClient.pages.update({
      page_id: rfqPage.id,
      properties: {
        'Status': {
          select: { name: 'Receiving Responses' }
        },
        'Responses Received': {
          number: currentResponses + 1
        },
        'Latest Response': {
          rich_text: [{
            text: {
              content: `${supplierInfo.supplierName}: $${supplierInfo.price}/unit, ${supplierInfo.leadTime}`
            }
          }]
        }
      }
    })

    console.log(`[SUPPLIER RESPONSE] Updated RFQ ${requestId}`)
  } catch (error) {
    console.error('[SUPPLIER RESPONSE] Failed to update RFQ:', error)
  }
}

/**
 * Notify buyer's Wells that a new supplier response came in
 * This triggers the conversational update: "Just heard from Intel..."
 */
async function notifyBuyer(notification: any) {
  try {
    // TODO: Implement real-time notification mechanism
    // Options:
    // 1. WebSocket push to frontend
    // 2. Server-sent events
    // 3. Polling endpoint that frontend checks
    // 4. Email notification

    console.log('[SUPPLIER RESPONSE] Buyer notification:', {
      requestId: notification.requestId,
      message: `Just heard from ${notification.supplierName} - they can do $${notification.price}/unit, ${notification.leadTime} lead time`
    })

    // For now, just log it - frontend will poll for updates
  } catch (error) {
    console.error('[SUPPLIER RESPONSE] Failed to notify buyer:', error)
  }
}
