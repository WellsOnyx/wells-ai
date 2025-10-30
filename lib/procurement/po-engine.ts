/**
 * PO Engine - Purchase Order Management with Dual-Approval
 * Phase 0: Draft-only writes with human approval gates
 */

import { RFQ, SupplierResponse } from './rfq-engine'

export interface PurchaseOrder {
  id: string
  poNumber: string
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'received' | 'closed'
  rfqId?: string

  vendor: {
    id: string
    name: string
    address: string
    email: string
    taxId?: string
  }

  buyer: {
    companyName: string
    department: string
    requesterId: string
    requesterName: string
    requesterEmail: string
  }

  lineItems: POLineItem[]

  financials: {
    subtotal: number
    tax: number
    shipping: number
    total: number
    currency: string
  }

  terms: {
    paymentTerms: string
    deliveryDate: Date
    shippingAddress: string
    billingAddress: string
    notes?: string
  }

  approvals: POApproval[]

  erpSync: {
    synced: boolean
    erpSystem?: 'sap' | 'netsuite' | 'workday' | 'oracle'
    erpPoId?: string
    syncedAt?: Date
    error?: string
  }

  audit: {
    createdBy: string
    createdAt: Date
    updatedAt: Date
    approvedAt?: Date
    sentAt?: Date
    policyVersion: string
    reason: string
  }
}

export interface POLineItem {
  id: string
  lineNumber: number
  description: string
  category: string
  quantity: number
  unitPrice: number
  totalPrice: number
  glAccount?: string
  costCenter?: string
  projectCode?: string
}

export interface POApproval {
  id: string
  approverId: string
  approverName: string
  approverEmail: string
  role: 'amount_owner' | 'cost_center_owner' | 'legal' | 'security' | 'finance'
  status: 'pending' | 'approved' | 'rejected'
  required: boolean
  approvedAt?: Date
  reason?: string
  notifiedAt?: Date
}

export class POEngine {
  private pos: Map<string, PurchaseOrder> = new Map()
  private poCounter = 1000

  /**
   * Create PO draft from RFQ award
   * CRITICAL: This only creates a DRAFT. Cannot write to ERP without approvals.
   */
  async createDraftFromRFQ(params: {
    rfq: RFQ
    awardedSupplier: {
      supplierId: string
      name: string
      response: SupplierResponse
    }
    createdBy: string
    reason: string
  }): Promise<PurchaseOrder> {
    const { rfq, awardedSupplier, createdBy, reason } = params

    const poId = `po_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const poNumber = `PO-${String(this.poCounter++).padStart(6, '0')}`

    const response = awardedSupplier.response

    const po: PurchaseOrder = {
      id: poId,
      poNumber,
      status: 'draft',
      rfqId: rfq.id,

      vendor: {
        id: awardedSupplier.supplierId,
        name: awardedSupplier.name,
        address: '123 Supplier St, City, State 12345',
        email: `contact@${awardedSupplier.name.toLowerCase().replace(/\s/g, '')}.com`,
      },

      buyer: {
        companyName: 'Wells Onyx',
        department: rfq.creator.department,
        requesterId: rfq.creator.userId,
        requesterName: rfq.creator.name,
        requesterEmail: rfq.creator.email,
      },

      lineItems: response.pricing.breakdown.map((item, idx) => ({
        id: `line_${poId}_${idx}`,
        lineNumber: idx + 1,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        glAccount: this.inferGLAccount(item.category),
        costCenter: rfq.creator.department,
      })),

      financials: {
        subtotal: response.pricing.totalAmount,
        tax: response.pricing.totalAmount * 0.08, // 8% sales tax
        shipping: 0,
        total: response.pricing.totalAmount * 1.08,
        currency: response.pricing.currency,
      },

      terms: {
        paymentTerms: response.terms.paymentTerms,
        deliveryDate: response.timeline.deliveryDate,
        shippingAddress: '456 Wells Plaza, Miami, FL 33131',
        billingAddress: '456 Wells Plaza, Miami, FL 33131',
        notes: `Created from RFQ ${rfq.id}. ${response.terms.warranty || ''}`,
      },

      approvals: this.getRequiredPOApprovals(response.pricing.totalAmount * 1.08, rfq.creator.department),

      erpSync: {
        synced: false,
      },

      audit: {
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        policyVersion: '1.0.0',
        reason,
      },
    }

    this.pos.set(poId, po)

    console.log('[PO Engine] Created PO draft:', {
      poNumber,
      vendor: po.vendor.name,
      total: `$${po.financials.total.toLocaleString()}`,
      approvalsRequired: po.approvals.filter(a => a.required).length,
      status: 'DRAFT - Cannot sync to ERP without approvals',
    })

    return po
  }

  /**
   * Request approval from specific approver
   */
  async requestApproval(poId: string, approverId: string): Promise<{
    success: boolean
    po: PurchaseOrder
    approval: POApproval
  }> {
    const po = this.pos.get(poId)
    if (!po) {
      throw new Error(`PO ${poId} not found`)
    }

    const approval = po.approvals.find(a => a.approverId === approverId)
    if (!approval) {
      throw new Error(`Approver ${approverId} not found for PO ${poId}`)
    }

    approval.notifiedAt = new Date()
    po.status = 'pending_approval'
    po.audit.updatedAt = new Date()

    console.log('[PO Engine] Requested approval:', {
      poNumber: po.poNumber,
      approver: approval.approverName,
      role: approval.role,
      amount: po.financials.total,
    })

    // In production: Send email/notification to approver

    return {
      success: true,
      po,
      approval,
    }
  }

  /**
   * Record approval decision
   */
  async recordApproval(poId: string, approverId: string, decision: {
    approved: boolean
    reason?: string
  }): Promise<{
    success: boolean
    po: PurchaseOrder
    allApproved: boolean
  }> {
    const po = this.pos.get(poId)
    if (!po) {
      throw new Error(`PO ${poId} not found`)
    }

    const approval = po.approvals.find(a => a.approverId === approverId)
    if (!approval) {
      throw new Error(`Approver ${approverId} not found for PO ${poId}`)
    }

    approval.status = decision.approved ? 'approved' : 'rejected'
    approval.approvedAt = new Date()
    approval.reason = decision.reason

    // Check if all required approvals are complete
    const requiredApprovals = po.approvals.filter(a => a.required)
    const allApproved = requiredApprovals.every(a => a.status === 'approved')
    const anyRejected = requiredApprovals.some(a => a.status === 'rejected')

    if (anyRejected) {
      po.status = 'rejected'
    } else if (allApproved) {
      po.status = 'approved'
      po.audit.approvedAt = new Date()
    }

    po.audit.updatedAt = new Date()

    console.log('[PO Engine] Recorded approval:', {
      poNumber: po.poNumber,
      approver: approval.approverName,
      decision: approval.status,
      allApproved,
      status: po.status,
    })

    return {
      success: true,
      po,
      allApproved,
    }
  }

  /**
   * Sync approved PO to ERP
   * CRITICAL: This is the ONLY point where we write to ERP
   * MUST have all required approvals first
   */
  async syncToERP(poId: string, erpSystem: 'sap' | 'netsuite' | 'workday' | 'oracle'): Promise<{
    success: boolean
    erpPoId?: string
    error?: string
  }> {
    const po = this.pos.get(poId)
    if (!po) {
      throw new Error(`PO ${poId} not found`)
    }

    // GATE: Check approval status
    if (po.status !== 'approved') {
      return {
        success: false,
        error: `Cannot sync PO in status '${po.status}'. Must be 'approved'.`,
      }
    }

    // GATE: Verify all required approvals
    const requiredApprovals = po.approvals.filter(a => a.required)
    const allApproved = requiredApprovals.every(a => a.status === 'approved')

    if (!allApproved) {
      return {
        success: false,
        error: 'Cannot sync PO: Not all required approvals obtained.',
      }
    }

    try {
      // In production: Call ERP API via Merge.dev
      // For Phase 0: Simulate successful sync
      const erpPoId = `${erpSystem.toUpperCase()}_${po.poNumber}`

      po.erpSync = {
        synced: true,
        erpSystem,
        erpPoId,
        syncedAt: new Date(),
      }

      po.status = 'sent'
      po.audit.sentAt = new Date()
      po.audit.updatedAt = new Date()

      console.log('[PO Engine] Synced to ERP:', {
        poNumber: po.poNumber,
        erpSystem,
        erpPoId,
        total: po.financials.total,
        status: 'LIVE IN ERP',
      })

      return {
        success: true,
        erpPoId,
      }
    } catch (error: any) {
      po.erpSync.error = error.message

      console.error('[PO Engine] ERP sync failed:', {
        poNumber: po.poNumber,
        erpSystem,
        error: error.message,
      })

      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get PO by ID
   */
  getPO(poId: string): PurchaseOrder | undefined {
    return this.pos.get(poId)
  }

  /**
   * Get PO by number
   */
  getPOByNumber(poNumber: string): PurchaseOrder | undefined {
    return Array.from(this.pos.values()).find(po => po.poNumber === poNumber)
  }

  /**
   * List POs
   */
  listPOs(filters?: {
    status?: PurchaseOrder['status']
    department?: string
    vendorId?: string
  }): PurchaseOrder[] {
    let pos = Array.from(this.pos.values())

    if (filters?.status) {
      pos = pos.filter(po => po.status === filters.status)
    }

    if (filters?.department) {
      pos = pos.filter(po => po.buyer.department === filters.department)
    }

    if (filters?.vendorId) {
      pos = pos.filter(po => po.vendor.id === filters.vendorId)
    }

    return pos.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime())
  }

  // Helper methods

  private getRequiredPOApprovals(totalAmount: number, department: string): POApproval[] {
    const approvals: POApproval[] = []

    // Amount owner ALWAYS required
    approvals.push({
      id: `approval_amount_${Date.now()}`,
      approverId: 'approver_amount',
      approverName: 'Budget Owner',
      approverEmail: 'budget@company.com',
      role: 'amount_owner',
      status: 'pending',
      required: true,
    })

    // Cost center owner ALWAYS required
    approvals.push({
      id: `approval_cost_center_${Date.now()}`,
      approverId: 'approver_cost_center',
      approverName: 'Department Head',
      approverEmail: `${department.toLowerCase()}@company.com`,
      role: 'cost_center_owner',
      status: 'pending',
      required: true,
    })

    // Finance required for >$25k
    if (totalAmount > 25000) {
      approvals.push({
        id: `approval_finance_${Date.now()}`,
        approverId: 'approver_finance',
        approverName: 'Finance Team',
        approverEmail: 'finance@company.com',
        role: 'finance',
        status: 'pending',
        required: true,
      })
    }

    // Legal required for >$100k
    if (totalAmount > 100000) {
      approvals.push({
        id: `approval_legal_${Date.now()}`,
        approverId: 'approver_legal',
        approverName: 'Legal Team',
        approverEmail: 'legal@company.com',
        role: 'legal',
        status: 'pending',
        required: true,
      })
    }

    return approvals
  }

  private inferGLAccount(category: string): string {
    const glMap: Record<string, string> = {
      'Software & IT': '6200',
      'Hardware & Equipment': '6300',
      'Professional Services': '6400',
      'Office Supplies': '6100',
      'Marketing & Creative': '6500',
      'Services': '6400',
      'Support': '6450',
    }

    return glMap[category] || '6000'
  }
}
