/**
 * Wells AI - Notion Database Integration
 * Week 3: Connect dashboard to real Notion data
 */

import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

// Export the notion client instance
export const notionClient = notion

// Export a helper to create Notion client instances (for waitlist, etc.)
export function createNotionClient() {
  return new Client({ auth: process.env.NOTION_API_KEY })
}

// Database IDs from environment
const SUPPLIERS_DB = process.env.NOTION_SUPPLIERS_DB || ''
const REQUESTS_DB = process.env.NOTION_REQUESTS_DB || ''
const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB || ''

// ===== TYPES =====

export interface RFQ {
  id: string
  company: string
  contactName: string
  contactEmail: string
  category: string
  productName: string
  specifications: string
  quantity?: string
  targetPrice?: string
  timeline?: string
  status: 'New' | 'Suppliers Notified' | 'Quotes Received' | 'Negotiating' | 'Deal Closed' | 'Abandoned'
  suppliersNotified: number
  quotesReceived: number
  createdDate: string
  quotes?: Quote[]
}

export interface Quote {
  id: string
  rfqId: string
  supplierName: string
  supplierId: string
  price: number
  quantity: string
  leadTime: string
  terms: string
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Countered'
  createdDate: string
}

export interface Deal {
  id: string
  rfqId: string
  quoteId: string
  buyerCompany: string
  sellerCompany: string
  productName: string
  category: string
  dealValue: number
  wellsAIFee: number // 33bps
  titheAmount: number // 10% of gross
  status: 'Pending Payment' | 'Payment Processing' | 'Completed' | 'Failed'
  closeDate: string
  paymentIntentId?: string
}

export interface Supplier {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  phone: string
  categories: string[]
  status: 'Active' | 'Pending' | 'Inactive'
  totalQuotes: number
  totalDeals: number
  createdDate: string
}

// ===== RFQ FUNCTIONS =====

export async function getRFQs(limit: number = 50, organizationId?: string): Promise<RFQ[]> {
  if (!REQUESTS_DB) return []

  try {
    // Build filter for organization if provided
    const filter: any = organizationId
      ? {
          property: 'Organization ID',
          rich_text: {
            equals: organizationId,
          },
        }
      : undefined

    // TODO: Fix Notion SDK query compatibility
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: REQUESTS_DB,
    //   page_size: limit,
    //   sorts: [{ property: 'Created', direction: 'descending' }],
    //   ...(filter && { filter })
    // })

    return response.results.map((page: any) => ({
      id: page.id,
      company: page.properties.Company?.rich_text?.[0]?.text?.content || 'Unknown',
      contactName: page.properties['Contact Name']?.rich_text?.[0]?.text?.content || '',
      contactEmail: page.properties['Contact Email']?.email || '',
      category: page.properties.Category?.select?.name || 'Uncategorized',
      productName: page.properties['Product Name']?.title?.[0]?.text?.content || 'Unnamed Product',
      specifications: page.properties.Specifications?.rich_text?.[0]?.text?.content || '',
      quantity: page.properties.Quantity?.rich_text?.[0]?.text?.content || '',
      targetPrice: page.properties['Target Price']?.rich_text?.[0]?.text?.content || '',
      timeline: page.properties.Timeline?.rich_text?.[0]?.text?.content || '',
      status: page.properties.Status?.select?.name || 'New',
      suppliersNotified: page.properties['Suppliers Notified']?.number || 0,
      quotesReceived: page.properties['Quotes Received']?.number || 0,
      createdDate: page.properties.Created?.created_time || new Date().toISOString()
    }))
  } catch (error) {
    console.error('Error fetching RFQs from Notion:', error)
    return []
  }
}

export async function getRFQById(rfqId: string): Promise<RFQ | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: rfqId })
    const props = (page as any).properties

    return {
      id: page.id,
      company: props.Company?.rich_text?.[0]?.text?.content || 'Unknown',
      contactName: props['Contact Name']?.rich_text?.[0]?.text?.content || '',
      contactEmail: props['Contact Email']?.email || '',
      category: props.Category?.select?.name || 'Uncategorized',
      productName: props['Product Name']?.title?.[0]?.text?.content || 'Unnamed Product',
      specifications: props.Specifications?.rich_text?.[0]?.text?.content || '',
      quantity: props.Quantity?.rich_text?.[0]?.text?.content || '',
      targetPrice: props['Target Price']?.rich_text?.[0]?.text?.content || '',
      timeline: props.Timeline?.rich_text?.[0]?.text?.content || '',
      status: props.Status?.select?.name || 'New',
      suppliersNotified: props['Suppliers Notified']?.number || 0,
      quotesReceived: props['Quotes Received']?.number || 0,
      createdDate: props.Created?.created_time || new Date().toISOString()
    }
  } catch (error) {
    console.error('Error fetching RFQ by ID:', error)
    return null
  }
}

export async function updateRFQStatus(rfqId: string, status: RFQ['status'], quotesReceived?: number) {
  if (!REQUESTS_DB) return

  try {
    await notion.pages.update({
      page_id: rfqId,
      properties: {
        'Status': { select: { name: status } },
        ...(quotesReceived !== undefined && {
          'Quotes Received': { number: quotesReceived }
        })
      }
    })
  } catch (error) {
    console.error('Error updating RFQ status:', error)
  }
}

// ===== DEAL FUNCTIONS =====

export async function getDeals(limit: number = 50, organizationId?: string): Promise<Deal[]> {
  if (!TRANSACTIONS_DB) {
    console.warn('NOTION_TRANSACTIONS_DB not configured, returning mock data')
    return []
  }

  try {
    // Build filter for organization if provided
    const filter: any = organizationId
      ? {
          property: 'Organization ID',
          rich_text: {
            equals: organizationId,
          },
        }
      : undefined

    // TODO: Fix Notion SDK query compatibility
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: TRANSACTIONS_DB,
    //   page_size: limit,
    //   sorts: [{ property: 'Close Date', direction: 'descending' }],
    //   ...(filter && { filter })
    // })

    return response.results.map((page: any) => {
      const dealValue = page.properties['Deal Value']?.number || 0
      const wellsAIFee = dealValue * 0.0033 // 33bps
      const titheAmount = dealValue * 0.10 // 10%

      return {
        id: page.id,
        rfqId: page.properties['RFQ ID']?.rich_text?.[0]?.text?.content || '',
        quoteId: page.properties['Quote ID']?.rich_text?.[0]?.text?.content || '',
        buyerCompany: page.properties['Buyer Company']?.title?.[0]?.text?.content || 'Unknown',
        sellerCompany: page.properties['Seller Company']?.rich_text?.[0]?.text?.content || 'Unknown',
        productName: page.properties['Product Name']?.rich_text?.[0]?.text?.content || 'Unnamed',
        category: page.properties.Category?.select?.name || 'Uncategorized',
        dealValue,
        wellsAIFee,
        titheAmount,
        status: page.properties.Status?.select?.name || 'Pending Payment',
        closeDate: page.properties['Close Date']?.date?.start || new Date().toISOString(),
        paymentIntentId: page.properties['Payment Intent ID']?.rich_text?.[0]?.text?.content || undefined
      }
    })
  } catch (error) {
    console.error('Error fetching deals from Notion:', error)
    return []
  }
}

export async function createDeal(
  deal: Omit<Deal, 'id' | 'wellsAIFee' | 'titheAmount'>,
  organizationId?: string
): Promise<Deal | null> {
  if (!TRANSACTIONS_DB) {
    console.warn('NOTION_TRANSACTIONS_DB not configured')
    return null
  }

  const wellsAIFee = deal.dealValue * 0.0033 // 33bps
  const titheAmount = deal.dealValue * 0.10 // 10%

  try {
    const response = await notion.pages.create({
      parent: { database_id: TRANSACTIONS_DB },
      properties: {
        'Buyer Company': {
          title: [{ text: { content: deal.buyerCompany } }]
        },
        'Seller Company': {
          rich_text: [{ text: { content: deal.sellerCompany } }]
        },
        'Product Name': {
          rich_text: [{ text: { content: deal.productName } }]
        },
        'Category': {
          select: { name: deal.category }
        },
        'Deal Value': {
          number: deal.dealValue
        },
        'Wells AI Fee': {
          number: wellsAIFee
        },
        'Tithe Amount': {
          number: titheAmount
        },
        'Status': {
          select: { name: deal.status }
        },
        'Close Date': {
          date: { start: deal.closeDate }
        },
        'RFQ ID': {
          rich_text: [{ text: { content: deal.rfqId } }]
        },
        'Quote ID': {
          rich_text: [{ text: { content: deal.quoteId } }]
        },
        ...(deal.paymentIntentId && {
          'Payment Intent ID': {
            rich_text: [{ text: { content: deal.paymentIntentId } }]
          }
        }),
        ...(organizationId && {
          'Organization ID': {
            rich_text: [{ text: { content: organizationId } }]
          }
        })
      }
    })

    return {
      id: response.id,
      ...deal,
      wellsAIFee,
      titheAmount
    }
  } catch (error) {
    console.error('Error creating deal in Notion:', error)
    return null
  }
}

export async function updateDealStatus(dealId: string, status: Deal['status'], paymentIntentId?: string) {
  if (!TRANSACTIONS_DB) return

  try {
    await notion.pages.update({
      page_id: dealId,
      properties: {
        'Status': { select: { name: status } },
        ...(paymentIntentId && {
          'Payment Intent ID': {
            rich_text: [{ text: { content: paymentIntentId } }]
          }
        })
      }
    })
  } catch (error) {
    console.error('Error updating deal status:', error)
  }
}

// ===== SUPPLIER FUNCTIONS =====

export async function getSuppliers(limit: number = 100, organizationId?: string): Promise<Supplier[]> {
  if (!SUPPLIERS_DB) return []

  try {
    // Build filter for organization if provided
    const filter: any = organizationId
      ? {
          property: 'Organization ID',
          rich_text: {
            equals: organizationId,
          },
        }
      : undefined

    // TODO: Fix Notion SDK query compatibility
    const response = { results: [] as any[] }
    // const response = await notion.databases.query({
    //   database_id: SUPPLIERS_DB,
    //   page_size: limit,
    //   sorts: [{ property: 'Created', direction: 'descending' }],
    //   ...(filter && { filter })
    // })

    return response.results.map((page: any) => ({
      id: page.id,
      companyName: page.properties['Company Name']?.title?.[0]?.text?.content || 'Unknown',
      contactName: page.properties['Contact Name']?.rich_text?.[0]?.text?.content || '',
      contactEmail: page.properties['Contact Email']?.email || '',
      phone: page.properties.Phone?.phone_number || '',
      categories: page.properties.Categories?.multi_select?.map((cat: any) => cat.name) || [],
      status: page.properties.Status?.select?.name || 'Pending',
      totalQuotes: page.properties['Total Quotes']?.number || 0,
      totalDeals: page.properties['Total Deals']?.number || 0,
      createdDate: page.properties.Created?.created_time || new Date().toISOString()
    }))
  } catch (error) {
    console.error('Error fetching suppliers from Notion:', error)
    return []
  }
}

// ===== ANALYTICS =====

export interface DashboardStats {
  totalRFQs: number
  activeRFQs: number
  totalDeals: number
  totalTransactionValue: number
  totalWellsAIRevenue: number
  totalTitheContributed: number
  averageDealSize: number
  conversionRate: number
}

export async function getDashboardStats(organizationId?: string): Promise<DashboardStats> {
  const [rfqs, deals] = await Promise.all([
    getRFQs(50, organizationId),
    getDeals(50, organizationId)
  ])

  const activeStatuses = ['New', 'Suppliers Notified', 'Quotes Received', 'Negotiating']
  const activeRFQs = rfqs.filter(rfq => activeStatuses.includes(rfq.status))
  const closedDeals = deals.filter(d => d.status === 'Completed')

  const totalTransactionValue = closedDeals.reduce((sum, d) => sum + d.dealValue, 0)
  const totalWellsAIRevenue = closedDeals.reduce((sum, d) => sum + d.wellsAIFee, 0)
  const totalTitheContributed = closedDeals.reduce((sum, d) => sum + d.titheAmount, 0)

  return {
    totalRFQs: rfqs.length,
    activeRFQs: activeRFQs.length,
    totalDeals: closedDeals.length,
    totalTransactionValue,
    totalWellsAIRevenue,
    totalTitheContributed,
    averageDealSize: closedDeals.length > 0 ? totalTransactionValue / closedDeals.length : 0,
    conversionRate: rfqs.length > 0 ? (closedDeals.length / rfqs.length) * 100 : 0
  }
}
