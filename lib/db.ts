import { sql } from '@vercel/postgres'
import { monitorDB } from './monitoring'

/**
 * Postgres database client for Wells AI
 * Migrating from Notion to Postgres for better performance and scalability
 */

/**
 * Execute a database query with monitoring
 */
export async function query<T = any>(
  queryString: string,
  params: any[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const monitor = monitorDB(queryString, 'postgres')

  try {
    const result = await sql.query(queryString, params)
    monitor.end(true, { rowCount: result.rowCount })

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    }
  } catch (error) {
    monitor.end(false, { error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}

/**
 * Database models and types
 */

export interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  categories: string[]
  capabilities: string[]
  certifications: string[]
  rating: number
  completedDeals: number
  createdAt: Date
  updatedAt: Date
  notionId?: string // For sync tracking
}

export interface RFQ {
  id: string
  buyerEmail: string
  productName: string
  description: string
  quantity?: number
  budget?: number
  deadline?: string
  status: 'pending' | 'quoted' | 'negotiating' | 'closed' | 'cancelled'
  source?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Quote {
  id: string
  supplierId: string
  rfqId: string
  price: number
  deliveryTime: string
  terms: string
  notes?: string
  status: 'pending' | 'accepted' | 'rejected' | 'countered'
  submittedAt: Date
  respondedAt?: Date
  notionId?: string
}

export interface Deal {
  id: string
  supplierId: string
  buyerId: string
  quoteId: string
  amount: number
  wellsFee: number
  status: 'pending' | 'paid' | 'completed' | 'failed'
  paymentIntentId?: string
  createdAt: Date
  completedAt?: Date
  notionId?: string
}

export interface Conversation {
  id: string
  userId?: string
  sessionId: string
  messages: {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }[]
  metadata: {
    userAgent?: string
    ipAddress?: string
    referrer?: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface AnalyticsEvent {
  id: string
  eventType: string
  eventData: Record<string, any>
  userId?: string
  sessionId: string
  timestamp: Date
}

/**
 * Supplier queries
 */
export const Suppliers = {
  async findById(id: string): Promise<Supplier | null> {
    const result = await query<Supplier>(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findByCategories(categories: string[]): Promise<Supplier[]> {
    const result = await query<Supplier>(
      'SELECT * FROM suppliers WHERE categories && $1 ORDER BY rating DESC LIMIT 50',
      [categories]
    )
    return result.rows
  },

  async create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const result = await query<Supplier>(
      `INSERT INTO suppliers (name, email, phone, categories, capabilities, certifications, rating, completed_deals, notion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        supplier.name,
        supplier.email,
        supplier.phone,
        supplier.categories,
        supplier.capabilities,
        supplier.certifications,
        supplier.rating,
        supplier.completedDeals,
        supplier.notionId,
      ]
    )
    return result.rows[0]
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
    const fields = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ')

    const result = await query<Supplier>(
      `UPDATE suppliers SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    )
    return result.rows[0] || null
  },
}

/**
 * RFQ queries
 */
export const RFQs = {
  async findById(id: string): Promise<RFQ | null> {
    const result = await query<RFQ>(
      'SELECT * FROM rfqs WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async create(rfq: Omit<RFQ, 'id' | 'createdAt' | 'updatedAt'>): Promise<RFQ> {
    const result = await query<RFQ>(
      `INSERT INTO rfqs (buyer_email, product_name, description, quantity, budget, deadline, status, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        rfq.buyerEmail,
        rfq.productName,
        rfq.description,
        rfq.quantity,
        rfq.budget,
        rfq.deadline,
        rfq.status,
        rfq.source,
        JSON.stringify(rfq.metadata || {}),
      ]
    )
    return result.rows[0]
  },

  async updateStatus(id: string, status: RFQ['status']): Promise<RFQ | null> {
    const result = await query<RFQ>(
      'UPDATE rfqs SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status]
    )
    return result.rows[0] || null
  },
}

/**
 * Quote queries
 */
export const Quotes = {
  async findById(id: string): Promise<Quote | null> {
    const result = await query<Quote>(
      'SELECT * FROM quotes WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findByRfqId(rfqId: string): Promise<Quote[]> {
    const result = await query<Quote>(
      'SELECT * FROM quotes WHERE rfq_id = $1 ORDER BY price ASC',
      [rfqId]
    )
    return result.rows
  },

  async create(quote: Omit<Quote, 'id' | 'submittedAt'>): Promise<Quote> {
    const result = await query<Quote>(
      `INSERT INTO quotes (supplier_id, rfq_id, price, delivery_time, terms, notes, status, notion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        quote.supplierId,
        quote.rfqId,
        quote.price,
        quote.deliveryTime,
        quote.terms,
        quote.notes,
        quote.status,
        quote.notionId,
      ]
    )
    return result.rows[0]
  },

  async updateStatus(id: string, status: Quote['status']): Promise<Quote | null> {
    const result = await query<Quote>(
      'UPDATE quotes SET status = $2, responded_at = NOW() WHERE id = $1 RETURNING *',
      [id, status]
    )
    return result.rows[0] || null
  },
}

/**
 * Deal queries
 */
export const Deals = {
  async findById(id: string): Promise<Deal | null> {
    const result = await query<Deal>(
      'SELECT * FROM deals WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async create(deal: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> {
    const result = await query<Deal>(
      `INSERT INTO deals (supplier_id, buyer_id, quote_id, amount, wells_fee, status, payment_intent_id, notion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        deal.supplierId,
        deal.buyerId,
        deal.quoteId,
        deal.amount,
        deal.wellsFee,
        deal.status,
        deal.paymentIntentId,
        deal.notionId,
      ]
    )
    return result.rows[0]
  },

  async updateStatus(id: string, status: Deal['status']): Promise<Deal | null> {
    const result = await query<Deal>(
      'UPDATE deals SET status = $2, completed_at = NOW() WHERE id = $1 RETURNING *',
      [id, status]
    )
    return result.rows[0] || null
  },

  async getRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await query<{ total: number }>(
      'SELECT SUM(wells_fee) as total FROM deals WHERE status = $1 AND created_at BETWEEN $2 AND $3',
      ['completed', startDate, endDate]
    )
    return result.rows[0]?.total || 0
  },
}

/**
 * Conversation queries
 */
export const Conversations = {
  async findById(id: string): Promise<Conversation | null> {
    const result = await query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  async findBySessionId(sessionId: string): Promise<Conversation | null> {
    const result = await query<Conversation>(
      'SELECT * FROM conversations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    return result.rows[0] || null
  },

  async create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation> {
    const result = await query<Conversation>(
      `INSERT INTO conversations (user_id, session_id, messages, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        conversation.userId,
        conversation.sessionId,
        JSON.stringify(conversation.messages),
        JSON.stringify(conversation.metadata),
      ]
    )
    return result.rows[0]
  },

  async addMessage(
    sessionId: string,
    message: { role: 'user' | 'assistant'; content: string }
  ): Promise<Conversation | null> {
    const result = await query<Conversation>(
      `UPDATE conversations
       SET messages = messages || $2::jsonb, updated_at = NOW()
       WHERE session_id = $1
       RETURNING *`,
      [sessionId, JSON.stringify({ ...message, timestamp: new Date() })]
    )
    return result.rows[0] || null
  },

  async getStats(startDate: Date, endDate: Date): Promise<{
    totalConversations: number
    totalMessages: number
    avgMessagesPerConversation: number
  }> {
    const result = await query<any>(
      `SELECT
        COUNT(*) as total_conversations,
        SUM(jsonb_array_length(messages)) as total_messages,
        AVG(jsonb_array_length(messages)) as avg_messages
       FROM conversations
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    )

    return {
      totalConversations: parseInt(result.rows[0]?.total_conversations || '0'),
      totalMessages: parseInt(result.rows[0]?.total_messages || '0'),
      avgMessagesPerConversation: parseFloat(result.rows[0]?.avg_messages || '0'),
    }
  },
}

/**
 * Analytics queries
 */
export const Analytics = {
  async trackEvent(event: Omit<AnalyticsEvent, 'id'>): Promise<void> {
    await query(
      `INSERT INTO analytics_events (event_type, event_data, user_id, session_id, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.eventType,
        JSON.stringify(event.eventData),
        event.userId,
        event.sessionId,
        event.timestamp,
      ]
    )
  },

  async getEventCounts(
    eventType: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; count: number }[]> {
    const result = await query<{ date: string; count: string }>(
      `SELECT
        DATE(timestamp) as date,
        COUNT(*) as count
       FROM analytics_events
       WHERE event_type = $1 AND timestamp BETWEEN $2 AND $3
       GROUP BY DATE(timestamp)
       ORDER BY date ASC`,
      [eventType, startDate, endDate]
    )

    return result.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count),
    }))
  },
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch (error) {
    console.error('[DB] Health check failed:', error)
    return false
  }
}
