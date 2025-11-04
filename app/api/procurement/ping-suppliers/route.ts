/**
 * Procurement Supplier Ping API
 * Immediately pings suppliers when buyer expresses procurement intent
 * Returns immediately, suppliers respond async via SMS/webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { notionClient } from '@/lib/notion'
import twilio from 'twilio'

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export async function POST(request: NextRequest) {
  try {
    const { requestId, category, description, buyerContext } = await request.json()

    console.log(`[PROCUREMENT PING] Starting outreach for ${requestId}`)
    console.log(`[PROCUREMENT PING] Category: ${category}`)
    console.log(`[PROCUREMENT PING] Description: ${description}`)

    // Find suppliers in Notion that match the category
    const suppliers = await findSuppliers(category)

    console.log(`[PROCUREMENT PING] Found ${suppliers.length} suppliers`)

    // Ping each supplier via SMS (fire and forget - they respond async)
    const pingPromises = suppliers.map((supplier: any) =>
      pingSupplier(supplier, {
        requestId,
        category,
        description,
        buyerContext
      })
    )

    // Don't wait for responses - let them come back async
    Promise.all(pingPromises).catch(err =>
      console.error('[PROCUREMENT PING] Some supplier pings failed:', err)
    )

    // Store procurement request in database for tracking responses
    await storeRequest({
      requestId,
      category,
      description,
      suppliersContacted: suppliers.length,
      status: 'awaiting_responses',
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      requestId,
      suppliersContacted: suppliers.length,
      message: `Reached out to ${suppliers.length} suppliers`
    })

  } catch (error: any) {
    console.error('[PROCUREMENT PING] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Find suppliers in Notion that match the category
 */
async function findSuppliers(category: string) {
  try {
    const response = await notionClient.databases.query({
      database_id: process.env.NOTION_SUPPLIERS_DB!,
      filter: {
        and: [
          {
            property: 'Status',
            select: { equals: 'Active' }
          },
          {
            property: 'Capabilities',
            multi_select: { contains: category }
          }
        ]
      },
      page_size: 10
    })

    return response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name.title[0]?.plain_text,
      phone: page.properties.Phone.phone_number,
      email: page.properties.Email.email
    }))
  } catch (error) {
    console.error('[PROCUREMENT PING] Failed to find suppliers:', error)
    return []
  }
}

/**
 * Ping a supplier via SMS
 * Format: "Wells AI: New procurement request - 500 circuit boards for IoT sensors. Reply Y to quote. ID: req_12345"
 */
async function pingSupplier(supplier: any, request: any) {
  try {
    if (!supplier.phone) {
      console.log(`[PROCUREMENT PING] No phone for ${supplier.name}, skipping`)
      return
    }

    const message = `Wells AI: New procurement request - ${request.description}. Reply with your quote to participate. ID: ${request.requestId}`

    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: supplier.phone
    })

    console.log(`[PROCUREMENT PING] Sent SMS to ${supplier.name} at ${supplier.phone}`)
  } catch (error) {
    console.error(`[PROCUREMENT PING] Failed to ping ${supplier.name}:`, error)
  }
}

/**
 * Store procurement request for tracking responses
 * For now, store in Notion RFQs database
 */
async function storeRequest(request: any) {
  try {
    await notionClient.pages.create({
      parent: { database_id: process.env.NOTION_RFQS_DB! },
      properties: {
        'Request ID': {
          title: [{ text: { content: request.requestId } }]
        },
        'Category': {
          select: { name: request.category }
        },
        'Description': {
          rich_text: [{ text: { content: request.description } }]
        },
        'Status': {
          select: { name: 'Awaiting Responses' }
        },
        'Suppliers Contacted': {
          number: request.suppliersContacted
        }
      }
    })

    console.log(`[PROCUREMENT PING] Stored request ${request.requestId}`)
  } catch (error) {
    console.error('[PROCUREMENT PING] Failed to store request:', error)
  }
}
