/**
 * RFQ Engine - Request for Quote/Proposal Management
 * Phase 0: Foundation for conversational procurement
 */

export interface RFQ {
  id: string
  type: 'quote' | 'proposal' | 'information'
  title: string
  description: string
  category: string
  requirements: Requirement[]
  budget?: {
    min: number
    max: number
    currency: string
  }
  timeline: {
    responseDeadline: Date
    projectStart?: Date
    projectEnd?: Date
  }
  status: 'draft' | 'sent' | 'responses_received' | 'evaluating' | 'awarded' | 'cancelled'
  creator: {
    userId: string
    name: string
    email: string
    department: string
  }
  approvers: Approver[]
  suppliers: RFQSupplier[]
  createdAt: Date
  updatedAt: Date
  sentAt?: Date
  metadata: {
    policyVersion: string
    source: 'chat' | 'form' | 'api' | 'sdk'
    consentRef?: string
  }
}

export interface Requirement {
  id: string
  type: 'must_have' | 'nice_to_have' | 'optional'
  description: string
  category: string
  weight?: number
}

export interface Approver {
  userId: string
  name: string
  email: string
  role: 'amount_owner' | 'cost_center_owner' | 'legal' | 'security'
  status: 'pending' | 'approved' | 'rejected'
  approvedAt?: Date
  reason?: string
}

export interface RFQSupplier {
  supplierId: string
  name: string
  email: string
  sentAt?: Date
  respondedAt?: Date
  response?: SupplierResponse
}

export interface SupplierResponse {
  id: string
  rfqId: string
  supplierId: string
  pricing: {
    totalAmount: number
    currency: string
    breakdown: LineItem[]
  }
  timeline: {
    deliveryDate: Date
    leadTime: number
  }
  terms: {
    paymentTerms: string
    warranty?: string
    supportIncluded: boolean
  }
  documents: {
    name: string
    url: string
    type: string
  }[]
  score?: number
  metadata: {
    submittedAt: Date
    ipAddress: string
  }
}

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  category: string
}

export class RFQEngine {
  private rfqs: Map<string, RFQ> = new Map()

  /**
   * Create RFQ from conversational input
   */
  async createFromConversation(input: {
    userId: string
    userName: string
    userEmail: string
    department: string
    conversationContext: string
    extractedRequirements: string[]
    budget?: { min: number; max: number }
    timeline?: { responseDeadline: Date }
  }): Promise<RFQ> {
    const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

    const rfq: RFQ = {
      id: rfqId,
      type: 'quote',
      title: `RFQ from ${input.userName}`,
      description: input.conversationContext,
      category: this.inferCategory(input.extractedRequirements),
      requirements: input.extractedRequirements.map((req, idx) => ({
        id: `req_${idx}`,
        type: idx < 3 ? 'must_have' : 'nice_to_have',
        description: req,
        category: this.inferCategory([req]),
        weight: idx < 3 ? 10 : 5,
      })),
      budget: input.budget ? { ...input.budget, currency: 'USD' } : undefined,
      timeline: {
        responseDeadline: input.timeline?.responseDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      status: 'draft',
      creator: {
        userId: input.userId,
        name: input.userName,
        email: input.userEmail,
        department: input.department,
      },
      approvers: this.getRequiredApprovers(input.budget?.max, input.department),
      suppliers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        policyVersion: '1.0.0',
        source: 'chat',
      },
    }

    this.rfqs.set(rfqId, rfq)

    console.log('[RFQ Engine] Created RFQ:', {
      id: rfqId,
      requirements: rfq.requirements.length,
      budget: rfq.budget?.max,
      approvers: rfq.approvers.length,
    })

    return rfq
  }

  /**
   * Send RFQ to suppliers
   */
  async sendToSuppliers(rfqId: string, supplierIds: string[]): Promise<{
    success: boolean
    sent: number
    suppliers: RFQSupplier[]
  }> {
    const rfq = this.rfqs.get(rfqId)
    if (!rfq) {
      throw new Error(`RFQ ${rfqId} not found`)
    }

    // Check approvals if required
    const pendingApprovals = rfq.approvers.filter(a => a.status === 'pending')
    if (pendingApprovals.length > 0) {
      throw new Error(`Cannot send RFQ: ${pendingApprovals.length} approvals pending`)
    }

    const suppliers: RFQSupplier[] = supplierIds.map(supplierId => ({
      supplierId,
      name: `Supplier ${supplierId}`,
      email: `supplier_${supplierId}@example.com`,
      sentAt: new Date(),
    }))

    rfq.suppliers = suppliers
    rfq.status = 'sent'
    rfq.sentAt = new Date()
    rfq.updatedAt = new Date()

    console.log('[RFQ Engine] Sent RFQ to suppliers:', {
      rfqId,
      suppliers: suppliers.length,
      deadline: rfq.timeline.responseDeadline,
    })

    // In production: Send via email/portal/API
    // For Phase 0: Stub suppliers will auto-respond

    return {
      success: true,
      sent: suppliers.length,
      suppliers,
    }
  }

  /**
   * Record supplier response
   */
  async recordResponse(rfqId: string, response: SupplierResponse): Promise<void> {
    const rfq = this.rfqs.get(rfqId)
    if (!rfq) {
      throw new Error(`RFQ ${rfqId} not found`)
    }

    const supplier = rfq.suppliers.find(s => s.supplierId === response.supplierId)
    if (!supplier) {
      throw new Error(`Supplier ${response.supplierId} not invited to RFQ ${rfqId}`)
    }

    supplier.respondedAt = new Date()
    supplier.response = response

    // Update RFQ status
    if (rfq.suppliers.every(s => s.response)) {
      rfq.status = 'responses_received'
    }

    rfq.updatedAt = new Date()

    console.log('[RFQ Engine] Recorded response:', {
      rfqId,
      supplierId: response.supplierId,
      amount: response.pricing.totalAmount,
      allResponded: rfq.status === 'responses_received',
    })
  }

  /**
   * Compare supplier responses
   */
  async compareResponses(rfqId: string): Promise<{
    rfq: RFQ
    comparison: {
      supplier: RFQSupplier
      score: number
      strengths: string[]
      weaknesses: string[]
    }[]
    recommendation: string
  }> {
    const rfq = this.rfqs.get(rfqId)
    if (!rfq) {
      throw new Error(`RFQ ${rfqId} not found`)
    }

    const comparison = rfq.suppliers
      .filter(s => s.response)
      .map(supplier => {
        const response = supplier.response!

        // Simple scoring algorithm
        let score = 0
        const strengths: string[] = []
        const weaknesses: string[] = []

        // Price scoring (40 points)
        const prices = rfq.suppliers
          .filter(s => s.response)
          .map(s => s.response!.pricing.totalAmount)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const priceScore = maxPrice > minPrice
          ? (1 - (response.pricing.totalAmount - minPrice) / (maxPrice - minPrice)) * 40
          : 40

        score += priceScore
        if (response.pricing.totalAmount === minPrice) {
          strengths.push('Lowest price')
        } else if (response.pricing.totalAmount === maxPrice) {
          weaknesses.push('Highest price')
        }

        // Timeline scoring (30 points)
        const deliveryDays = Math.ceil((response.timeline.deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        const timelineScore = Math.max(0, 30 - deliveryDays / 2)
        score += timelineScore

        if (deliveryDays <= 7) {
          strengths.push('Fast delivery')
        } else if (deliveryDays > 30) {
          weaknesses.push('Slow delivery')
        }

        // Terms scoring (30 points)
        let termsScore = 0
        if (response.terms.supportIncluded) {
          termsScore += 15
          strengths.push('Support included')
        }
        if (response.terms.warranty) {
          termsScore += 15
          strengths.push('Warranty offered')
        }
        score += termsScore

        return {
          supplier,
          score: Math.round(score),
          strengths,
          weaknesses,
        }
      })
      .sort((a, b) => b.score - a.score)

    const winner = comparison[0]
    const recommendation = `${winner.supplier.name} (Score: ${winner.score}/100) - ${winner.strengths.join(', ')}`

    console.log('[RFQ Engine] Compared responses:', {
      rfqId,
      responses: comparison.length,
      winner: winner.supplier.name,
      score: winner.score,
    })

    return {
      rfq,
      comparison,
      recommendation,
    }
  }

  /**
   * Award RFQ to supplier
   */
  async awardToSupplier(rfqId: string, supplierId: string): Promise<{
    success: boolean
    rfq: RFQ
    supplier: RFQSupplier
    nextStep: 'po_draft'
  }> {
    const rfq = this.rfqs.get(rfqId)
    if (!rfq) {
      throw new Error(`RFQ ${rfqId} not found`)
    }

    const supplier = rfq.suppliers.find(s => s.supplierId === supplierId)
    if (!supplier || !supplier.response) {
      throw new Error(`Supplier ${supplierId} has not responded to RFQ ${rfqId}`)
    }

    rfq.status = 'awarded'
    rfq.updatedAt = new Date()

    console.log('[RFQ Engine] Awarded RFQ:', {
      rfqId,
      supplier: supplier.name,
      amount: supplier.response.pricing.totalAmount,
      nextStep: 'po_draft',
    })

    return {
      success: true,
      rfq,
      supplier,
      nextStep: 'po_draft',
    }
  }

  /**
   * Get RFQ by ID
   */
  getRFQ(rfqId: string): RFQ | undefined {
    return this.rfqs.get(rfqId)
  }

  /**
   * List RFQs
   */
  listRFQs(filters?: {
    status?: RFQ['status']
    creatorId?: string
    department?: string
  }): RFQ[] {
    let rfqs = Array.from(this.rfqs.values())

    if (filters?.status) {
      rfqs = rfqs.filter(rfq => rfq.status === filters.status)
    }

    if (filters?.creatorId) {
      rfqs = rfqs.filter(rfq => rfq.creator.userId === filters.creatorId)
    }

    if (filters?.department) {
      rfqs = rfqs.filter(rfq => rfq.creator.department === filters.department)
    }

    return rfqs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Helper methods

  private inferCategory(requirements: string[]): string {
    const text = requirements.join(' ').toLowerCase()

    if (text.includes('software') || text.includes('saas') || text.includes('app')) {
      return 'Software & IT'
    }
    if (text.includes('hardware') || text.includes('equipment') || text.includes('device')) {
      return 'Hardware & Equipment'
    }
    if (text.includes('service') || text.includes('consulting') || text.includes('support')) {
      return 'Professional Services'
    }
    if (text.includes('office') || text.includes('supply') || text.includes('furniture')) {
      return 'Office Supplies'
    }
    if (text.includes('marketing') || text.includes('advertising') || text.includes('design')) {
      return 'Marketing & Creative'
    }

    return 'General'
  }

  private getRequiredApprovers(budgetMax?: number, department?: string): Approver[] {
    const approvers: Approver[] = []

    // Amount owner required for all RFQs
    approvers.push({
      userId: 'approver_amount',
      name: 'Budget Owner',
      email: 'budget@company.com',
      role: 'amount_owner',
      status: 'pending',
    })

    // Cost center owner required for dept purchases
    if (department) {
      approvers.push({
        userId: 'approver_cost_center',
        name: 'Department Head',
        email: `${department.toLowerCase()}@company.com`,
        role: 'cost_center_owner',
        status: 'pending',
      })
    }

    // Legal required for >$50k
    if (budgetMax && budgetMax > 50000) {
      approvers.push({
        userId: 'approver_legal',
        name: 'Legal Team',
        email: 'legal@company.com',
        role: 'legal',
        status: 'pending',
      })
    }

    // Security required for IT/Software
    if (department?.toLowerCase().includes('it') || department?.toLowerCase().includes('eng')) {
      approvers.push({
        userId: 'approver_security',
        name: 'Security Team',
        email: 'security@company.com',
        role: 'security',
        status: 'pending',
      })
    }

    return approvers
  }
}

/**
 * Generate stub supplier responses for Phase 0 testing
 */
export async function generateStubResponses(rfq: RFQ): Promise<SupplierResponse[]> {
  const baseAmount = rfq.budget?.max || 10000
  const suppliers = rfq.suppliers

  return suppliers.map((supplier, idx) => {
    const variation = 0.85 + (idx * 0.15) // 85%, 100%, 115% of budget
    const totalAmount = Math.round(baseAmount * variation)

    return {
      id: `response_${Date.now()}_${idx}`,
      rfqId: rfq.id,
      supplierId: supplier.supplierId,
      pricing: {
        totalAmount,
        currency: 'USD',
        breakdown: [
          {
            id: `line_${idx}_1`,
            description: 'Base service',
            quantity: 1,
            unitPrice: totalAmount * 0.7,
            totalPrice: totalAmount * 0.7,
            category: rfq.category,
          },
          {
            id: `line_${idx}_2`,
            description: 'Implementation & setup',
            quantity: 1,
            unitPrice: totalAmount * 0.2,
            totalPrice: totalAmount * 0.2,
            category: 'Services',
          },
          {
            id: `line_${idx}_3`,
            description: 'Support (first year)',
            quantity: 1,
            unitPrice: totalAmount * 0.1,
            totalPrice: totalAmount * 0.1,
            category: 'Support',
          },
        ],
      },
      timeline: {
        deliveryDate: new Date(Date.now() + (7 + idx * 7) * 24 * 60 * 60 * 1000),
        leadTime: 7 + idx * 7,
      },
      terms: {
        paymentTerms: idx === 0 ? 'Net 30' : idx === 1 ? 'Net 45' : 'Net 60',
        warranty: idx < 2 ? '1 year warranty' : undefined,
        supportIncluded: idx === 0,
      },
      documents: [
        {
          name: 'Quote.pdf',
          url: `https://example.com/quotes/${supplier.supplierId}.pdf`,
          type: 'application/pdf',
        },
      ],
      metadata: {
        submittedAt: new Date(),
        ipAddress: '192.168.1.1',
      },
    }
  })
}
