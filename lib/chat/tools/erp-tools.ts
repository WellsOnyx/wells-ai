// @ts-nocheck
/**
 * ERP Chat Tools
 *
 * Tools for invoice management, purchase orders, and vendor management via conversation.
 */

import { ConversationContext } from '../conversation-manager'

// ============================================================================
// TYPES
// ============================================================================

export interface ERPToolResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
  suggestedFollowUps?: string[]
}

export interface InvoiceParams {
  invoiceId?: string
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  customerId?: string
  dateRange?: { start: Date; end: Date }
  limit?: number
}

export interface CreateInvoiceParams {
  customerId: string
  items: Array<{ description: string; quantity: number; unitPrice: number }>
  dueDate?: Date
  notes?: string
  autoSend?: boolean
}

export interface POParams {
  poId?: string
  status?: 'draft' | 'sent' | 'acknowledged' | 'shipped' | 'delivered' | 'cancelled'
  vendorId?: string
  limit?: number
}

export interface VendorParams {
  vendorId?: string
  category?: string
  status?: 'active' | 'pending' | 'inactive'
}

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

export async function getInvoices(
  params: InvoiceParams,
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { invoiceId, status, customerId, dateRange, limit = 10 } = params

    // TODO: Fetch from ERP/database
    // const invoices = await erpService.getInvoices({ userId: context.userId, ...params })

    // Mock data
    const invoices = [
      { id: 'INV-001', customer: 'Acme Corp', amount: 15000, status: 'sent', dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      { id: 'INV-002', customer: 'TechStart Inc', amount: 8500, status: 'paid', paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { id: 'INV-003', customer: 'Global Mfg', amount: 22000, status: 'overdue', dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    ]

    if (invoiceId) {
      const invoice = invoices.find(i => i.id === invoiceId)
      if (!invoice) {
        return {
          success: true,
          data: { invoices: [] },
          message: `Couldn't find invoice ${invoiceId}. Want to see your recent invoices?`,
          suggestedFollowUps: ['Show recent invoices', 'Create invoice'],
        }
      }
      return {
        success: true,
        data: { invoice },
        message: `Invoice ${invoice.id} to ${invoice.customer}: $${invoice.amount.toLocaleString()} - ${invoice.status.toUpperCase()}`,
        suggestedFollowUps: ['Send reminder', 'Mark as paid', 'View details'],
      }
    }

    const total = invoices.reduce((sum, i) => sum + i.amount, 0)
    const overdue = invoices.filter(i => i.status === 'overdue')
    const pending = invoices.filter(i => i.status === 'sent')

    let summary = `You have ${invoices.length} invoices totaling $${total.toLocaleString()}.`
    if (overdue.length > 0) {
      const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0)
      summary += ` ${overdue.length} overdue ($${overdueTotal.toLocaleString()}).`
    }
    if (pending.length > 0) {
      const pendingTotal = pending.reduce((sum, i) => sum + i.amount, 0)
      summary += ` ${pending.length} awaiting payment ($${pendingTotal.toLocaleString()}).`
    }

    return {
      success: true,
      data: { invoices, summary: { total, overdueCount: overdue.length, pendingCount: pending.length } },
      message: summary,
      suggestedFollowUps: ['View overdue', 'Send reminders', 'Create invoice'],
    }
  } catch (error) {
    console.error('[ERP Tools] Get invoices error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get invoices',
      message: 'I had trouble fetching your invoices. Let me try again.',
    }
  }
}

export async function createInvoice(
  params: CreateInvoiceParams,
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { customerId, items, dueDate, notes, autoSend = false } = params

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const invoiceId = `INV-${Date.now().toString().slice(-6)}`

    // TODO: Create in ERP
    // const invoice = await erpService.createInvoice({ ...params, userId: context.userId })

    let message = `Created invoice ${invoiceId} for $${total.toLocaleString()}.`
    if (autoSend) {
      message += ' Sent to customer.'
    }

    return {
      success: true,
      data: {
        invoiceId,
        customerId,
        total,
        itemCount: items.length,
        status: autoSend ? 'sent' : 'draft',
      },
      message,
      suggestedFollowUps: autoSend ? ['Track payment', 'View invoice'] : ['Send invoice', 'Edit invoice', 'Add items'],
    }
  } catch (error) {
    console.error('[ERP Tools] Create invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
      message: 'I had trouble creating that invoice. Want to try again?',
    }
  }
}

export async function sendInvoiceReminder(
  params: { invoiceId: string; message?: string },
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { invoiceId, message: customMessage } = params

    // TODO: Send reminder via ERP
    // await erpService.sendReminder({ invoiceId, message: customMessage })

    return {
      success: true,
      data: { invoiceId, reminderSent: true },
      message: `Sent payment reminder for invoice ${invoiceId}.`,
      suggestedFollowUps: ['Schedule follow-up', 'View invoice', 'Call customer'],
    }
  } catch (error) {
    console.error('[ERP Tools] Send reminder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder',
      message: 'I had trouble sending the reminder. Should I try again?',
    }
  }
}

// ============================================================================
// PURCHASE ORDER MANAGEMENT
// ============================================================================

export async function getPurchaseOrders(
  params: POParams,
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { poId, status, vendorId, limit = 10 } = params

    // Mock data
    const purchaseOrders = [
      { id: 'PO-001', vendor: 'Precision Parts Co.', amount: 2450, status: 'shipped', eta: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      { id: 'PO-002', vendor: 'Allied Industrial', amount: 8900, status: 'acknowledged', eta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { id: 'PO-003', vendor: 'FastTrack Supply', amount: 1200, status: 'delivered', deliveredDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ]

    if (poId) {
      const po = purchaseOrders.find(p => p.id === poId)
      if (!po) {
        return {
          success: true,
          data: { purchaseOrders: [] },
          message: `Couldn't find PO ${poId}. Want to see your recent orders?`,
          suggestedFollowUps: ['Show recent POs', 'Create PO'],
        }
      }

      let statusMessage = `PO ${po.id} from ${po.vendor}: $${po.amount.toLocaleString()} - ${po.status.toUpperCase()}`
      if (po.eta) {
        statusMessage += `. ETA: ${po.eta.toLocaleDateString()}`
      }

      return {
        success: true,
        data: { purchaseOrder: po },
        message: statusMessage,
        suggestedFollowUps: ['Track shipment', 'Contact vendor', 'View items'],
      }
    }

    const inTransit = purchaseOrders.filter(p => p.status === 'shipped')
    const pending = purchaseOrders.filter(p => ['sent', 'acknowledged'].includes(p.status))

    let summary = `You have ${purchaseOrders.length} purchase orders.`
    if (inTransit.length > 0) {
      summary += ` ${inTransit.length} in transit.`
    }
    if (pending.length > 0) {
      summary += ` ${pending.length} pending.`
    }

    return {
      success: true,
      data: { purchaseOrders },
      message: summary,
      suggestedFollowUps: ['View in transit', 'Track deliveries', 'Create PO'],
    }
  } catch (error) {
    console.error('[ERP Tools] Get POs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get purchase orders',
      message: 'I had trouble fetching your POs. Let me try again.',
    }
  }
}

export async function createPurchaseOrder(
  params: {
    vendorId: string
    items: Array<{ productId: string; quantity: number; unitPrice: number }>
    deliveryDate?: Date
    notes?: string
  },
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { vendorId, items, deliveryDate, notes } = params

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const poId = `PO-${Date.now().toString().slice(-6)}`

    return {
      success: true,
      data: {
        poId,
        vendorId,
        total,
        itemCount: items.length,
        status: 'sent',
      },
      message: `Created PO ${poId} for $${total.toLocaleString()} and sent to vendor.`,
      suggestedFollowUps: ['Track status', 'View PO', 'Add to order'],
    }
  } catch (error) {
    console.error('[ERP Tools] Create PO error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create PO',
      message: 'I had trouble creating that purchase order. Want to try again?',
    }
  }
}

// ============================================================================
// VENDOR MANAGEMENT
// ============================================================================

export async function getVendors(
  params: VendorParams,
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { vendorId, category, status = 'active' } = params

    // Mock data
    const vendors = [
      { id: 'v1', name: 'Precision Parts Co.', category: 'Industrial', rating: 4.8, totalSpend: 45000, orderCount: 12 },
      { id: 'v2', name: 'Allied Industrial', category: 'Industrial', rating: 4.6, totalSpend: 32000, orderCount: 8 },
      { id: 'v3', name: 'Office Plus', category: 'Office Supplies', rating: 4.5, totalSpend: 8500, orderCount: 24 },
    ]

    if (vendorId) {
      const vendor = vendors.find(v => v.id === vendorId)
      if (!vendor) {
        return {
          success: true,
          data: { vendors: [] },
          message: `Couldn't find that vendor. Want to see your vendor list?`,
          suggestedFollowUps: ['Show vendors', 'Add vendor'],
        }
      }
      return {
        success: true,
        data: { vendor },
        message: `${vendor.name}: ${vendor.rating}★, ${vendor.orderCount} orders, $${vendor.totalSpend.toLocaleString()} total spend.`,
        suggestedFollowUps: ['View orders', 'Contact vendor', 'Create RFQ'],
      }
    }

    const totalSpend = vendors.reduce((sum, v) => sum + v.totalSpend, 0)

    return {
      success: true,
      data: { vendors },
      message: `You have ${vendors.length} active vendors with $${totalSpend.toLocaleString()} total spend.`,
      suggestedFollowUps: ['View top vendors', 'Add vendor', 'Vendor performance'],
    }
  } catch (error) {
    console.error('[ERP Tools] Get vendors error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vendors',
      message: 'I had trouble fetching your vendors. Let me try again.',
    }
  }
}

// ============================================================================
// FINANCIAL OVERVIEW
// ============================================================================

export async function getFinancialOverview(
  params: { period?: 'week' | 'month' | 'quarter' | 'year' },
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { period = 'month' } = params

    // Mock financial data
    const overview = {
      period,
      revenue: 125000,
      expenses: 78000,
      profit: 47000,
      pendingReceivables: 35000,
      pendingPayables: 12000,
      topCategories: [
        { name: 'Product Sales', amount: 95000 },
        { name: 'Services', amount: 30000 },
      ],
      topExpenses: [
        { name: 'Raw Materials', amount: 42000 },
        { name: 'Labor', amount: 25000 },
        { name: 'Overhead', amount: 11000 },
      ],
    }

    const periodLabel = period === 'week' ? 'This week' :
                        period === 'month' ? 'This month' :
                        period === 'quarter' ? 'This quarter' : 'This year'

    return {
      success: true,
      data: overview,
      message: `${periodLabel}: $${overview.revenue.toLocaleString()} revenue, $${overview.expenses.toLocaleString()} expenses, $${overview.profit.toLocaleString()} profit. $${overview.pendingReceivables.toLocaleString()} in receivables, $${overview.pendingPayables.toLocaleString()} in payables.`,
      suggestedFollowUps: ['Drill into expenses', 'Revenue breakdown', 'Cash flow'],
    }
  } catch (error) {
    console.error('[ERP Tools] Financial overview error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get financial overview',
      message: 'I had trouble getting your financial overview. Let me try again.',
    }
  }
}

export async function getSpendAnalysis(
  params: { period?: 'week' | 'month' | 'quarter' | 'year'; category?: string },
  context: ConversationContext
): Promise<ERPToolResult> {
  try {
    const { period = 'month', category } = params

    // Mock spend data
    const spendData = {
      total: 78000,
      categories: [
        { name: 'Raw Materials', amount: 42000, change: -5 },
        { name: 'Office Supplies', amount: 4200, change: 12 },
        { name: 'Software', amount: 8500, change: 0 },
        { name: 'Services', amount: 15000, change: 8 },
        { name: 'Utilities', amount: 3200, change: 3 },
        { name: 'Other', amount: 5100, change: -2 },
      ],
    }

    if (category) {
      const cat = spendData.categories.find(c => c.name.toLowerCase().includes(category.toLowerCase()))
      if (cat) {
        const changeText = cat.change > 0 ? `up ${cat.change}%` : cat.change < 0 ? `down ${Math.abs(cat.change)}%` : 'flat'
        return {
          success: true,
          data: { category: cat },
          message: `${cat.name} spend: $${cat.amount.toLocaleString()} this ${period}, ${changeText} from last ${period}.`,
          suggestedFollowUps: ['View transactions', 'Compare periods', 'Set budget'],
        }
      }
    }

    const topCategory = spendData.categories[0]

    return {
      success: true,
      data: spendData,
      message: `Total spend: $${spendData.total.toLocaleString()} this ${period}. Top category: ${topCategory.name} at $${topCategory.amount.toLocaleString()}.`,
      suggestedFollowUps: ['Category breakdown', 'Reduce spend', 'Set alerts'],
    }
  } catch (error) {
    console.error('[ERP Tools] Spend analysis error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze spend',
      message: 'I had trouble analyzing your spend. Let me try again.',
    }
  }
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const erpTools = {
  getInvoices,
  createInvoice,
  sendInvoiceReminder,
  getPurchaseOrders,
  createPurchaseOrder,
  getVendors,
  getFinancialOverview,
  getSpendAnalysis,
}

export default erpTools
