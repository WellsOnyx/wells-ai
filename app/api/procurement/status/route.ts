/**
 * Procurement Status Polling API
 * Frontend polls this endpoint to get live updates on supplier responses
 * Returns current status, suppliers contacted, and quotes received
 */

import { NextRequest, NextResponse } from 'next/server'
import { notionClient } from '@/lib/notion'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Missing requestId' },
        { status: 400 }
      )
    }

    console.log(`[PROCUREMENT STATUS] Checking status for ${requestId}`)

    // Get the RFQ from Notion
    const rfq = await getRFQByRequestId(requestId)

    if (!rfq) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      )
    }

    // Get all supplier quotes for this request
    const quotes = await getSupplierQuotes(requestId)

    console.log(`[PROCUREMENT STATUS] Found ${quotes.length} quotes`)

    // Format the response
    return NextResponse.json({
      success: true,
      requestId,
      status: rfq.status,
      category: rfq.category,
      description: rfq.description,
      suppliersContacted: rfq.suppliersContacted,
      responsesReceived: rfq.responsesReceived,
      quotes: quotes.map(q => ({
        supplier: q.supplier,
        price: q.price,
        leadTime: q.leadTime,
        receivedAt: q.receivedAt,
        rawMessage: q.rawMessage
      })),
      // Wells uses this to craft conversational updates
      latestUpdate: rfq.latestResponse || null,
      // Status indicators for frontend
      isActive: rfq.status !== 'Completed' && rfq.status !== 'Cancelled',
      hasNewResponses: quotes.length > (rfq.lastPollResponseCount || 0)
    })

  } catch (error: any) {
    console.error('[PROCUREMENT STATUS] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Get RFQ from Notion by request ID
 */
async function getRFQByRequestId(requestId: string): Promise<any> {
  try {
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
      return null
    }

    const page: any = response.results[0]

    return {
      id: page.id,
      requestId: page.properties['Request ID'].title[0]?.plain_text,
      category: page.properties['Category']?.select?.name,
      description: page.properties['Description']?.rich_text[0]?.plain_text,
      status: page.properties['Status']?.select?.name,
      suppliersContacted: page.properties['Suppliers Contacted']?.number || 0,
      responsesReceived: page.properties['Responses Received']?.number || 0,
      latestResponse: page.properties['Latest Response']?.rich_text[0]?.plain_text,
      lastPollResponseCount: page.properties['Last Poll Response Count']?.number || 0
    }
  } catch (error) {
    console.error('[PROCUREMENT STATUS] Failed to get RFQ:', error)
    return null
  }
}

/**
 * Get all supplier quotes for a request ID
 */
async function getSupplierQuotes(requestId: string): Promise<any[]> {
  try {
    const response = await notionClient.dataSources.query({
      data_source_id: process.env.NOTION_SUPPLIER_QUOTES_DB!,
      filter: {
        property: 'Request ID',
        title: {
          equals: requestId
        }
      },
      sorts: [
        {
          property: 'Received At',
          direction: 'descending'
        }
      ]
    })

    return response.results.map((page: any) => ({
      id: page.id,
      supplier: page.properties['Supplier']?.rich_text[0]?.plain_text,
      price: page.properties['Price']?.number,
      leadTime: page.properties['Lead Time']?.rich_text[0]?.plain_text,
      receivedAt: page.properties['Received At']?.date?.start,
      rawMessage: page.properties['Raw Message']?.rich_text[0]?.plain_text,
      status: page.properties['Status']?.select?.name
    }))
  } catch (error) {
    console.error('[PROCUREMENT STATUS] Failed to get quotes:', error)
    return []
  }
}
