/**
 * WellsAI Conversational ERP - Vendor Registry Service
 *
 * AI-managed supplier/vendor management - no forms, no dashboards.
 * Users just talk to Wells:
 *
 * - "Add Precision Bearings as a supplier" -> Wells onboards
 * - "What's my payment history with Acme?" -> Wells shows
 * - "Rate Precision Bearings 5 stars for delivery" -> Wells records
 * - "Update Acme's contact email to new@acme.com" -> Wells updates
 * - "Who are my top suppliers?" -> Wells analyzes
 *
 * Tracks: vendor profiles, payment terms, performance scores
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export type VendorType = 'supplier' | 'customer' | 'both' | 'prospect'
export type VendorStatus = 'prospect' | 'pending' | 'active' | 'preferred' | 'suspended' | 'blacklisted' | 'inactive'

export interface VendorContact {
  name?: string
  email?: string
  phone?: string
  role?: string
  isPrimary: boolean
}

export interface VendorAddress {
  type: 'billing' | 'shipping' | 'headquarters'
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface PaymentTerms {
  terms: string // NET30, NET60, etc.
  earlyPaymentDiscount?: number // e.g., 2% if paid within 10 days
  earlyPaymentDays?: number
  creditLimit?: number
  currency: string
}

export interface PerformanceScore {
  overall: number // 0-100
  delivery: number // On-time delivery rate
  quality: number // Quality/defect rate
  pricing: number // Competitive pricing
  communication: number // Responsiveness
  lastUpdated: Date
}

export interface VendorRating {
  id: string
  category: 'delivery' | 'quality' | 'pricing' | 'communication' | 'overall'
  rating: number // 1-5 stars
  comment?: string
  relatedPoId?: string
  relatedInvoiceId?: string
  ratedAt: Date
  ratedBy: string
}

export interface PaymentHistoryItem {
  id: string
  type: 'invoice' | 'po' | 'payment'
  referenceNumber: string
  amount: number
  date: Date
  status: string
}

export interface WellsVendor {
  id: string
  userId: string
  name: string
  displayName?: string
  vendorType: VendorType
  status: VendorStatus

  // Contact info
  contacts: VendorContact[]
  primaryEmail?: string
  primaryPhone?: string
  website?: string

  // Addresses
  addresses: VendorAddress[]

  // Financial
  paymentTerms?: PaymentTerms
  bankAccount?: {
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    swift?: string
  }
  taxId?: string

  // Categories
  categories: string[]
  products?: string[]
  certifications?: string[]

  // Performance
  performanceScore: PerformanceScore
  ratings: VendorRating[]

  // Metrics
  totalOrders: number
  totalSpend: number
  averageOrderValue: number
  lastOrderDate?: Date

  // Notes
  notes?: string
  internalNotes?: string
  tags: string[]

  // AI tracking
  createdByAi: boolean
  aiConversationId?: string

  // Wells integration
  wellsSupplierId?: string

  createdAt: Date
  updatedAt: Date
}

export interface CreateVendorRequest {
  name: string
  vendorType?: VendorType
  email?: string
  phone?: string
  website?: string
  categories?: string[]
  paymentTerms?: string
  notes?: string
  aiConversationId?: string
  aiCommand?: string
}

export interface VendorSearchCriteria {
  query?: string
  vendorType?: VendorType
  status?: VendorStatus | VendorStatus[]
  category?: string
  minSpend?: number
  minRating?: number
  limit?: number
  offset?: number
}

// ============================================================================
// VENDOR REGISTRY SERVICE
// ============================================================================

export class WellsVendorRegistry {
  /**
   * Add a vendor conversationally
   * "Add Precision Bearings as a supplier"
   */
  static async addVendor(
    userId: string,
    request: CreateVendorRequest
  ): Promise<{ vendor: WellsVendor; message: string }> {
    const vendorId = `wells-vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Check if vendor already exists
    const existing = await sql`
      SELECT id, name FROM wells_vendors
      WHERE user_id = ${userId} AND LOWER(name) = LOWER(${request.name})
      LIMIT 1
    `

    if (existing.rows.length > 0) {
      throw new Error(`Vendor "${request.name}" already exists`)
    }

    const vendorType = request.vendorType || 'supplier'
    const status: VendorStatus = 'active'

    const contacts: VendorContact[] = []
    if (request.email || request.phone) {
      contacts.push({
        email: request.email,
        phone: request.phone,
        isPrimary: true,
      })
    }

    const defaultPerformanceScore: PerformanceScore = {
      overall: 50, // Start at neutral
      delivery: 50,
      quality: 50,
      pricing: 50,
      communication: 50,
      lastUpdated: new Date(),
    }

    await sql`
      INSERT INTO wells_vendors (
        id, user_id, name, vendor_type, status,
        email, phone, website, contacts, addresses,
        payment_terms, categories, performance_score, ratings,
        total_orders, total_spend, average_order_value, notes, tags,
        created_by_ai, ai_conversation_id, created_at, updated_at
      ) VALUES (
        ${vendorId}, ${userId}, ${request.name}, ${vendorType}, ${status},
        ${request.email || null}, ${request.phone || null}, ${request.website || null},
        ${JSON.stringify(contacts)}, ${JSON.stringify([])},
        ${JSON.stringify({ terms: request.paymentTerms || 'NET30', currency: 'USD' })},
        ${JSON.stringify(request.categories || [])},
        ${JSON.stringify(defaultPerformanceScore)}, ${JSON.stringify([])},
        0, 0, 0, ${request.notes || null}, ${JSON.stringify([])},
        true, ${request.aiConversationId || null}, NOW(), NOW()
      )
    `

    const vendor: WellsVendor = {
      id: vendorId,
      userId,
      name: request.name,
      vendorType,
      status,
      contacts,
      primaryEmail: request.email,
      primaryPhone: request.phone,
      website: request.website,
      addresses: [],
      paymentTerms: { terms: request.paymentTerms || 'NET30', currency: 'USD' },
      categories: request.categories || [],
      performanceScore: defaultPerformanceScore,
      ratings: [],
      totalOrders: 0,
      totalSpend: 0,
      averageOrderValue: 0,
      notes: request.notes,
      tags: [],
      createdByAi: true,
      aiConversationId: request.aiConversationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return {
      vendor,
      message: `${request.name} added as a ${vendorType}${request.email ? ` (${request.email})` : ''}.${request.paymentTerms ? ` Payment terms: ${request.paymentTerms}.` : ''}`,
    }
  }

  /**
   * Get payment history with a vendor
   * "What's my payment history with Acme?"
   */
  static async getPaymentHistory(
    userId: string,
    vendorIdentifier: string
  ): Promise<{ vendor: WellsVendor; history: PaymentHistoryItem[]; summary: string }> {
    // Find vendor
    const vendorResult = await sql`
      SELECT * FROM wells_vendors
      WHERE user_id = ${userId}
        AND (id = ${vendorIdentifier} OR LOWER(name) LIKE LOWER(${`%${vendorIdentifier}%`}))
      LIMIT 1
    `

    if (vendorResult.rows.length === 0) {
      throw new Error(`Vendor "${vendorIdentifier}" not found`)
    }

    const vendor = this.mapRowToVendor(vendorResult.rows[0])

    // Get invoices
    const invoices = await sql`
      SELECT id, invoice_number, total_amount, status, invoice_date
      FROM wells_invoices
      WHERE user_id = ${userId} AND vendor_id = ${vendor.id}
      ORDER BY invoice_date DESC
      LIMIT 20
    `

    // Get POs
    const pos = await sql`
      SELECT id, po_number, total_amount, status, order_date
      FROM wells_purchase_orders
      WHERE user_id = ${userId} AND supplier_id = ${vendor.id}
      ORDER BY order_date DESC
      LIMIT 20
    `

    const history: PaymentHistoryItem[] = []

    for (const inv of invoices.rows) {
      history.push({
        id: inv.id,
        type: 'invoice',
        referenceNumber: inv.invoice_number,
        amount: parseFloat(inv.total_amount),
        date: new Date(inv.invoice_date),
        status: inv.status,
      })
    }

    for (const po of pos.rows) {
      history.push({
        id: po.id,
        type: 'po',
        referenceNumber: po.po_number,
        amount: parseFloat(po.total_amount),
        date: new Date(po.order_date),
        status: po.status,
      })
    }

    // Sort by date descending
    history.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Generate summary
    const totalInvoices = invoices.rows.length
    const totalPOs = pos.rows.length
    const totalAmount = history.reduce((sum, h) => sum + h.amount, 0)

    let summary = `Payment history with ${vendor.name}:\n`
    summary += `- ${totalInvoices} invoice${totalInvoices !== 1 ? 's' : ''}\n`
    summary += `- ${totalPOs} purchase order${totalPOs !== 1 ? 's' : ''}\n`
    summary += `- Total volume: $${totalAmount.toLocaleString()}\n`

    if (history.length > 0) {
      const recent = history.slice(0, 5)
      summary += `\nRecent transactions:\n`
      for (const item of recent) {
        summary += `  - ${item.referenceNumber}: $${item.amount.toLocaleString()} (${item.status}) - ${item.date.toLocaleDateString()}\n`
      }
    }

    return { vendor, history, summary }
  }

  /**
   * Rate a vendor
   * "Rate Precision Bearings 5 stars for delivery"
   */
  static async rateVendor(
    userId: string,
    vendorIdentifier: string,
    rating: number,
    category: VendorRating['category'],
    comment?: string,
    relatedPoId?: string
  ): Promise<{ vendor: WellsVendor; message: string }> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars')
    }

    // Find vendor
    const vendorResult = await sql`
      SELECT * FROM wells_vendors
      WHERE user_id = ${userId}
        AND (id = ${vendorIdentifier} OR LOWER(name) LIKE LOWER(${`%${vendorIdentifier}%`}))
      LIMIT 1
    `

    if (vendorResult.rows.length === 0) {
      throw new Error(`Vendor "${vendorIdentifier}" not found`)
    }

    const vendor = this.mapRowToVendor(vendorResult.rows[0])

    // Create rating
    const ratingId = `rating-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const newRating: VendorRating = {
      id: ratingId,
      category,
      rating,
      comment,
      relatedPoId,
      ratedAt: new Date(),
      ratedBy: userId,
    }

    // Update ratings array
    const updatedRatings = [...vendor.ratings, newRating]

    // Recalculate performance score
    const updatedScore = this.calculatePerformanceScore(updatedRatings)

    await sql`
      UPDATE wells_vendors
      SET
        ratings = ${JSON.stringify(updatedRatings)},
        performance_score = ${JSON.stringify(updatedScore)},
        updated_at = NOW()
      WHERE id = ${vendor.id}
    `

    const updatedVendor: WellsVendor = {
      ...vendor,
      ratings: updatedRatings,
      performanceScore: updatedScore,
      updatedAt: new Date(),
    }

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
    return {
      vendor: updatedVendor,
      message: `Rated ${vendor.name} ${stars} (${rating}/5) for ${category}.${comment ? ` Comment: "${comment}"` : ''} Overall score now ${Math.round(updatedScore.overall)}%.`,
    }
  }

  /**
   * Update vendor information
   * "Update Acme's contact email to new@acme.com"
   */
  static async updateVendor(
    userId: string,
    vendorIdentifier: string,
    updates: Partial<{
      name: string
      email: string
      phone: string
      website: string
      paymentTerms: string
      status: VendorStatus
      notes: string
      categories: string[]
    }>
  ): Promise<{ vendor: WellsVendor; message: string }> {
    const vendorResult = await sql`
      SELECT * FROM wells_vendors
      WHERE user_id = ${userId}
        AND (id = ${vendorIdentifier} OR LOWER(name) LIKE LOWER(${`%${vendorIdentifier}%`}))
      LIMIT 1
    `

    if (vendorResult.rows.length === 0) {
      throw new Error(`Vendor "${vendorIdentifier}" not found`)
    }

    const vendor = this.mapRowToVendor(vendorResult.rows[0])

    // Build update query dynamically
    const updateFields: string[] = []
    const changes: string[] = []

    if (updates.name) {
      updateFields.push('name')
      changes.push(`name to "${updates.name}"`)
    }
    if (updates.email) {
      updateFields.push('email')
      changes.push(`email to ${updates.email}`)
    }
    if (updates.phone) {
      updateFields.push('phone')
      changes.push(`phone to ${updates.phone}`)
    }
    if (updates.website) {
      updateFields.push('website')
      changes.push(`website to ${updates.website}`)
    }
    if (updates.status) {
      updateFields.push('status')
      changes.push(`status to ${updates.status}`)
    }
    if (updates.notes) {
      updateFields.push('notes')
      changes.push('notes')
    }

    // Execute update
    await sql`
      UPDATE wells_vendors
      SET
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email),
        phone = COALESCE(${updates.phone || null}, phone),
        website = COALESCE(${updates.website || null}, website),
        status = COALESCE(${updates.status || null}, status),
        notes = COALESCE(${updates.notes || null}, notes),
        payment_terms = CASE
          WHEN ${updates.paymentTerms || null} IS NOT NULL
          THEN jsonb_set(COALESCE(payment_terms, '{}')::jsonb, '{terms}', to_jsonb(${updates.paymentTerms || 'NET30'}::text))
          ELSE payment_terms
        END,
        categories = COALESCE(${updates.categories ? JSON.stringify(updates.categories) : null}, categories),
        updated_at = NOW()
      WHERE id = ${vendor.id}
    `

    const updatedVendor: WellsVendor = {
      ...vendor,
      name: updates.name || vendor.name,
      primaryEmail: updates.email || vendor.primaryEmail,
      primaryPhone: updates.phone || vendor.primaryPhone,
      website: updates.website || vendor.website,
      status: updates.status || vendor.status,
      notes: updates.notes || vendor.notes,
      categories: updates.categories || vendor.categories,
      paymentTerms: updates.paymentTerms
        ? { ...vendor.paymentTerms!, terms: updates.paymentTerms }
        : vendor.paymentTerms,
      updatedAt: new Date(),
    }

    return {
      vendor: updatedVendor,
      message: `Updated ${vendor.name}: ${changes.join(', ')}.`,
    }
  }

  /**
   * Get top suppliers by volume
   * "Who are my top suppliers?"
   */
  static async getTopSuppliers(
    userId: string,
    limit: number = 10,
    criteria?: { timeframe?: 'month' | 'quarter' | 'year' | 'all' }
  ): Promise<{ vendors: WellsVendor[]; summary: string }> {
    let startDate: Date | null = null

    if (criteria?.timeframe && criteria.timeframe !== 'all') {
      const now = new Date()
      switch (criteria.timeframe) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }
    }

    // Get vendors sorted by total spend
    const result = startDate
      ? await sql`
          SELECT v.*, COALESCE(SUM(p.total_amount), 0) as period_spend
          FROM wells_vendors v
          LEFT JOIN wells_purchase_orders p ON p.supplier_id = v.id AND p.order_date >= ${startDate.toISOString()}
          WHERE v.user_id = ${userId} AND v.vendor_type IN ('supplier', 'both')
          GROUP BY v.id
          ORDER BY period_spend DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM wells_vendors
          WHERE user_id = ${userId} AND vendor_type IN ('supplier', 'both')
          ORDER BY total_spend DESC
          LIMIT ${limit}
        `

    const vendors: WellsVendor[] = result.rows.map(this.mapRowToVendor)

    // Generate summary
    const totalSpend = vendors.reduce((sum, v) => sum + v.totalSpend, 0)
    const timeframeLabel = criteria?.timeframe || 'all time'

    let summary = `Top ${vendors.length} suppliers (${timeframeLabel}):\n`
    vendors.forEach((v, i) => {
      const stars = '★'.repeat(Math.round(v.performanceScore.overall / 20)) + '☆'.repeat(5 - Math.round(v.performanceScore.overall / 20))
      summary += `${i + 1}. ${v.name} - $${v.totalSpend.toLocaleString()} (${v.totalOrders} orders) ${stars}\n`
    })
    summary += `\nTotal spend: $${totalSpend.toLocaleString()}`

    return { vendors, summary }
  }

  /**
   * Search vendors
   * "Find suppliers for bearings"
   */
  static async searchVendors(
    userId: string,
    criteria: VendorSearchCriteria
  ): Promise<{ vendors: WellsVendor[]; summary: string }> {
    let result

    if (criteria.query) {
      result = await sql`
        SELECT * FROM wells_vendors
        WHERE user_id = ${userId}
          AND (
            LOWER(name) LIKE LOWER(${`%${criteria.query}%`})
            OR ${criteria.query} = ANY(categories)
            OR LOWER(notes) LIKE LOWER(${`%${criteria.query}%`})
          )
        ORDER BY total_spend DESC
        LIMIT ${criteria.limit || 20}
        OFFSET ${criteria.offset || 0}
      `
    } else if (criteria.category) {
      result = await sql`
        SELECT * FROM wells_vendors
        WHERE user_id = ${userId}
          AND ${criteria.category} = ANY(categories)
        ORDER BY performance_score->>'overall' DESC
        LIMIT ${criteria.limit || 20}
        OFFSET ${criteria.offset || 0}
      `
    } else {
      result = await sql`
        SELECT * FROM wells_vendors
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT ${criteria.limit || 20}
        OFFSET ${criteria.offset || 0}
      `
    }

    const vendors: WellsVendor[] = result.rows.map(this.mapRowToVendor)

    const summary =
      vendors.length > 0
        ? `Found ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}${criteria.query ? ` matching "${criteria.query}"` : ''}.`
        : `No vendors found${criteria.query ? ` matching "${criteria.query}"` : ''}.`

    return { vendors, summary }
  }

  /**
   * Get vendor summary/analytics
   * "Give me a vendor overview"
   */
  static async getVendorSummary(userId: string): Promise<{
    totalVendors: number
    activeVendors: number
    totalSpend: number
    avgRating: number
    topCategories: { category: string; count: number }[]
    message: string
  }> {
    const countResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COALESCE(SUM(total_spend), 0) as total_spend,
        COALESCE(AVG((performance_score->>'overall')::numeric), 50) as avg_rating
      FROM wells_vendors
      WHERE user_id = ${userId}
    `

    const categoryResult = await sql`
      SELECT unnest(categories) as category, COUNT(*) as count
      FROM wells_vendors
      WHERE user_id = ${userId}
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `

    const row = countResult.rows[0]
    const topCategories = categoryResult.rows.map((r) => ({
      category: r.category as string,
      count: parseInt(r.count),
    }))

    const totalVendors = parseInt(row.total)
    const activeVendors = parseInt(row.active)
    const totalSpend = parseFloat(row.total_spend)
    const avgRating = parseFloat(row.avg_rating)

    const message = `Vendor Overview:
- Total vendors: ${totalVendors} (${activeVendors} active)
- Total spend: $${totalSpend.toLocaleString()}
- Average vendor rating: ${avgRating.toFixed(0)}%
${topCategories.length > 0 ? `- Top categories: ${topCategories.map((c) => c.category).join(', ')}` : ''}`

    return {
      totalVendors,
      activeVendors,
      totalSpend,
      avgRating,
      topCategories,
      message,
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static calculatePerformanceScore(ratings: VendorRating[]): PerformanceScore {
    const categoryScores: Record<string, number[]> = {
      delivery: [],
      quality: [],
      pricing: [],
      communication: [],
      overall: [],
    }

    for (const rating of ratings) {
      if (categoryScores[rating.category]) {
        categoryScores[rating.category].push(rating.rating)
      }
    }

    const average = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 2.5)
    const toPercent = (stars: number) => (stars / 5) * 100

    return {
      delivery: toPercent(average(categoryScores.delivery)),
      quality: toPercent(average(categoryScores.quality)),
      pricing: toPercent(average(categoryScores.pricing)),
      communication: toPercent(average(categoryScores.communication)),
      overall: toPercent(
        average([
          ...categoryScores.delivery,
          ...categoryScores.quality,
          ...categoryScores.pricing,
          ...categoryScores.communication,
          ...categoryScores.overall,
        ])
      ),
      lastUpdated: new Date(),
    }
  }

  private static mapRowToVendor(row: Record<string, unknown>): WellsVendor {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      displayName: row.display_name as string | undefined,
      vendorType: row.vendor_type as VendorType,
      status: row.status as VendorStatus,
      contacts: (row.contacts as VendorContact[]) || [],
      primaryEmail: row.email as string | undefined,
      primaryPhone: row.phone as string | undefined,
      website: row.website as string | undefined,
      addresses: (row.addresses as VendorAddress[]) || [],
      paymentTerms: row.payment_terms as PaymentTerms | undefined,
      taxId: row.tax_id as string | undefined,
      categories: (row.categories as string[]) || [],
      products: row.products as string[] | undefined,
      certifications: row.certifications as string[] | undefined,
      performanceScore: (row.performance_score as PerformanceScore) || {
        overall: 50,
        delivery: 50,
        quality: 50,
        pricing: 50,
        communication: 50,
        lastUpdated: new Date(),
      },
      ratings: (row.ratings as VendorRating[]) || [],
      totalOrders: parseInt(row.total_orders as string) || 0,
      totalSpend: parseFloat(row.total_spend as string) || 0,
      averageOrderValue: parseFloat(row.average_order_value as string) || 0,
      lastOrderDate: row.last_order_date ? new Date(row.last_order_date as string) : undefined,
      notes: row.notes as string | undefined,
      internalNotes: row.internal_notes as string | undefined,
      tags: (row.tags as string[]) || [],
      createdByAi: row.created_by_ai as boolean,
      aiConversationId: row.ai_conversation_id as string | undefined,
      wellsSupplierId: row.wells_supplier_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }
}

// ============================================================================
// CONVERSATIONAL PARSER
// ============================================================================

/**
 * Parse natural language vendor commands
 */
export function parseVendorCommand(message: string): {
  action: 'add' | 'update' | 'rate' | 'history' | 'search' | 'top' | 'summary' | 'unknown'
  params: Record<string, unknown>
} {
  const lower = message.toLowerCase()

  // Add vendor
  if (lower.includes('add') && (lower.includes('vendor') || lower.includes('supplier') || lower.includes('customer'))) {
    const nameMatch = message.match(/add\s+([A-Z][A-Za-z\s&.]+?)(?:\s+as\s+a?\s*|\s*$)/i)
    const typeMatch = lower.includes('supplier') ? 'supplier' : lower.includes('customer') ? 'customer' : undefined
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)

    return {
      action: 'add',
      params: {
        name: nameMatch ? nameMatch[1].trim() : undefined,
        vendorType: typeMatch,
        email: emailMatch ? emailMatch[1] : undefined,
      },
    }
  }

  // Rate vendor
  if (lower.includes('rate') || (lower.includes('stars') && (lower.includes('give') || lower.includes('5') || lower.includes('4') || lower.includes('3')))) {
    const ratingMatch = message.match(/(\d)\s*star/i)
    const vendorMatch = message.match(/(?:rate|give)\s+([A-Z][A-Za-z\s]+?)(?:\s+\d|\s+star)/i)
    const categoryMatch = lower.includes('delivery')
      ? 'delivery'
      : lower.includes('quality')
        ? 'quality'
        : lower.includes('pricing') || lower.includes('price')
          ? 'pricing'
          : lower.includes('communication')
            ? 'communication'
            : 'overall'

    return {
      action: 'rate',
      params: {
        vendorName: vendorMatch ? vendorMatch[1].trim() : undefined,
        rating: ratingMatch ? parseInt(ratingMatch[1]) : undefined,
        category: categoryMatch,
      },
    }
  }

  // Payment history
  if (lower.includes('history') || lower.includes('transactions') || (lower.includes('payment') && lower.includes('with'))) {
    const vendorMatch = message.match(/(?:with|for|from)\s+([A-Z][A-Za-z\s]+?)(?:\?|\s*$)/i)
    return {
      action: 'history',
      params: {
        vendorName: vendorMatch ? vendorMatch[1].trim() : undefined,
      },
    }
  }

  // Update vendor
  if (lower.includes('update') || lower.includes('change') || lower.includes("'s")) {
    const vendorMatch = message.match(/(?:update|change)\s+([A-Z][A-Za-z\s]+?)(?:'s|\s+)/i)
    const emailMatch = message.match(/(?:email|contact)\s+(?:to\s+)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const phoneMatch = message.match(/(?:phone|number)\s+(?:to\s+)?([+\d\s()-]+)/i)

    return {
      action: 'update',
      params: {
        vendorName: vendorMatch ? vendorMatch[1].trim() : undefined,
        email: emailMatch ? emailMatch[1] : undefined,
        phone: phoneMatch ? phoneMatch[1].trim() : undefined,
      },
    }
  }

  // Top suppliers
  if (lower.includes('top') && (lower.includes('supplier') || lower.includes('vendor'))) {
    const limitMatch = message.match(/top\s+(\d+)/i)
    return {
      action: 'top',
      params: {
        limit: limitMatch ? parseInt(limitMatch[1]) : 10,
      },
    }
  }

  // Search
  if (lower.includes('find') || lower.includes('search') || lower.includes('look for')) {
    const queryMatch = message.match(/(?:find|search|look for)\s+(?:suppliers?\s+(?:for|of)\s+)?(.+?)(?:\?|\s*$)/i)
    return {
      action: 'search',
      params: {
        query: queryMatch ? queryMatch[1].trim() : undefined,
      },
    }
  }

  // Summary
  if (lower.includes('overview') || lower.includes('summary') || lower.includes('how many vendor')) {
    return {
      action: 'summary',
      params: {},
    }
  }

  return { action: 'unknown', params: {} }
}
