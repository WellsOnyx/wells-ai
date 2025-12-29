/**
 * WellsAI Conversational ERP - Claude Tool Definitions
 *
 * These tools enable Claude to manage ERP operations through natural conversation.
 * Users never see forms or dashboards - they just talk to Wells.
 *
 * Example conversations:
 * - "Create an invoice for $5,000 to Acme Corp for the bearing order"
 * - "What's my cash flow this month?"
 * - "Send a payment reminder to Acme"
 * - "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"
 */

import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// CLAUDE TOOL DEFINITIONS FOR CONVERSATIONAL ERP
// ============================================================================

export const WELLS_ERP_TOOLS: Anthropic.Tool[] = [
  // ========================================================================
  // INVOICE TOOLS
  // ========================================================================
  {
    name: 'create_invoice',
    description: `Create a new invoice for a customer. Use this when the user wants to bill someone.

Examples that trigger this:
- "Create an invoice for $5,000 to Acme Corp"
- "Bill Precision Bearings $2,500 for consulting"
- "Invoice XYZ Company for the motor order - $10,000"
- "Send an invoice to our customer for 1000 units at $5 each"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        customerName: {
          type: 'string',
          description: 'Name of the customer to invoice',
        },
        amount: {
          type: 'number',
          description: 'Total amount for the invoice (if not providing line items)',
        },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
          description: 'Individual line items (optional if amount is provided)',
        },
        description: {
          type: 'string',
          description: 'Description of what the invoice is for',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (ISO format). Defaults to NET30 if not specified.',
        },
        customerEmail: {
          type: 'string',
          description: 'Customer email for sending the invoice',
        },
      },
      required: ['customerName'],
    },
  },
  {
    name: 'list_invoices',
    description: `List invoices with optional filters. Use this when the user asks about their invoices.

Examples that trigger this:
- "Show me my invoices"
- "What invoices are overdue?"
- "List unpaid invoices"
- "What bills are outstanding?"
- "Show invoices from Acme Corp"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'],
          description: 'Filter by invoice status',
        },
        overdue: {
          type: 'boolean',
          description: 'Only show overdue invoices',
        },
        unpaid: {
          type: 'boolean',
          description: 'Only show unpaid invoices (not paid or cancelled)',
        },
        customerName: {
          type: 'string',
          description: 'Filter by customer name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of invoices to return (default 20)',
        },
      },
    },
  },
  {
    name: 'send_invoice',
    description: `Send an invoice to the customer. Use when user wants to send/email an invoice.

Examples that trigger this:
- "Send invoice #123 to the customer"
- "Email the invoice to Acme"
- "Send the bearing order invoice"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceIdentifier: {
          type: 'string',
          description: 'Invoice number (e.g., WELLS-2024-000001) or customer name to find the invoice',
        },
      },
      required: ['invoiceIdentifier'],
    },
  },
  {
    name: 'record_payment',
    description: `Record a payment received for an invoice. Use when user says they got paid.

Examples that trigger this:
- "Mark invoice #123 as paid"
- "Acme paid their invoice"
- "Record $5,000 payment from Precision Bearings"
- "We received payment for the motor order"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceIdentifier: {
          type: 'string',
          description: 'Invoice number or customer name',
        },
        amount: {
          type: 'number',
          description: 'Payment amount (defaults to full invoice amount)',
        },
        paymentDate: {
          type: 'string',
          description: 'Date of payment (ISO format). Defaults to today.',
        },
      },
      required: ['invoiceIdentifier'],
    },
  },
  {
    name: 'send_payment_reminder',
    description: `Send a payment reminder for an overdue or upcoming invoice.

Examples that trigger this:
- "Send a reminder to Acme about their invoice"
- "Follow up on the overdue payment from XYZ"
- "Remind Precision Bearings their payment is due"
- "Send payment reminders for overdue invoices"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceIdentifier: {
          type: 'string',
          description: 'Invoice number or customer name',
        },
      },
      required: ['invoiceIdentifier'],
    },
  },
  {
    name: 'get_invoice_summary',
    description: `Get invoice analytics and summary statistics.

Examples that trigger this:
- "What's my invoicing status?"
- "How much have I billed this month?"
- "Invoice summary"
- "How much is outstanding?"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Time period for the summary',
        },
      },
    },
  },

  // ========================================================================
  // PURCHASE ORDER TOOLS
  // ========================================================================
  {
    name: 'create_po',
    description: `Create a purchase order to buy from a supplier. Use when the user wants to order something.

Examples that trigger this:
- "Create a PO for 1000 bearings from Precision Bearings at $4.50 each"
- "Order 500 motors from Industrial Supply"
- "Buy raw materials from Acme - 200 units at $25"
- "Place an order for office supplies"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierName: {
          type: 'string',
          description: 'Name of the supplier to order from',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              sku: { type: 'string' },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
          description: 'Items to order',
        },
        expectedDeliveryDate: {
          type: 'string',
          description: 'Expected delivery date (ISO format). Defaults to 2 weeks.',
        },
        shippingAddress: {
          type: 'string',
          description: 'Delivery address',
        },
        notes: {
          type: 'string',
          description: 'Special instructions or notes',
        },
      },
      required: ['supplierName', 'items'],
    },
  },
  {
    name: 'list_pos',
    description: `List purchase orders with optional filters.

Examples that trigger this:
- "What POs are pending?"
- "Show me purchase orders"
- "What orders are waiting for delivery?"
- "List open POs"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'acknowledged', 'shipped', 'received', 'completed', 'cancelled'],
          description: 'Filter by PO status',
        },
        pendingDelivery: {
          type: 'boolean',
          description: 'Only show POs awaiting delivery',
        },
        supplierName: {
          type: 'string',
          description: 'Filter by supplier name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of POs to return',
        },
      },
    },
  },
  {
    name: 'send_po',
    description: `Send a purchase order to the supplier.

Examples that trigger this:
- "Send PO #456 to the supplier"
- "Email the purchase order to Precision Bearings"
- "Send the order"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        poIdentifier: {
          type: 'string',
          description: 'PO number or supplier name',
        },
      },
      required: ['poIdentifier'],
    },
  },
  {
    name: 'receive_goods',
    description: `Mark goods as received for a purchase order.

Examples that trigger this:
- "Mark PO #456 as received"
- "The motors arrived from Precision Bearings"
- "We received the order"
- "Delivery completed for the bearing order"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        poIdentifier: {
          type: 'string',
          description: 'PO number or supplier name',
        },
        receivedItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lineItemId: { type: 'string' },
              quantity: { type: 'number' },
            },
            required: ['lineItemId', 'quantity'],
          },
          description: 'Partial receipt details (if not receiving all items)',
        },
      },
      required: ['poIdentifier'],
    },
  },
  {
    name: 'cancel_po',
    description: `Cancel a purchase order.

Examples that trigger this:
- "Cancel the order from Precision Bearings"
- "Cancel PO #456"
- "Don't need that order anymore"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        poIdentifier: {
          type: 'string',
          description: 'PO number or supplier name',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation',
        },
      },
      required: ['poIdentifier'],
    },
  },
  {
    name: 'get_po_summary',
    description: `Get purchase order analytics and summary.

Examples that trigger this:
- "What's my purchasing status?"
- "PO summary"
- "How much have we ordered this month?"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Time period for the summary',
        },
      },
    },
  },

  // ========================================================================
  // VENDOR MANAGEMENT TOOLS
  // ========================================================================
  {
    name: 'add_vendor',
    description: `Add a new vendor (supplier or customer) to the registry.

Examples that trigger this:
- "Add Precision Bearings as a supplier"
- "Register Acme Corp as a customer"
- "Add Industrial Motors to our vendors"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Vendor name',
        },
        vendorType: {
          type: 'string',
          enum: ['supplier', 'customer', 'both'],
          description: 'Type of vendor',
        },
        email: {
          type: 'string',
          description: 'Contact email',
        },
        phone: {
          type: 'string',
          description: 'Contact phone',
        },
        paymentTerms: {
          type: 'string',
          description: 'Payment terms (e.g., NET30, NET60)',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product/service categories',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_vendors',
    description: `Search for vendors by name, category, or other criteria.

Examples that trigger this:
- "Find suppliers for bearings"
- "Search for motor manufacturers"
- "Who supplies us with raw materials?"
- "Show me our vendors"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (name, category, or product)',
        },
        vendorType: {
          type: 'string',
          enum: ['supplier', 'customer', 'both'],
          description: 'Filter by vendor type',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
      },
    },
  },
  {
    name: 'rate_vendor',
    description: `Rate a vendor's performance.

Examples that trigger this:
- "Rate Precision Bearings 5 stars for delivery"
- "Give Acme 3 stars for quality"
- "Precision Bearings has excellent communication - 5 stars"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorName: {
          type: 'string',
          description: 'Name of the vendor to rate',
        },
        rating: {
          type: 'number',
          description: 'Rating from 1 to 5 stars',
        },
        category: {
          type: 'string',
          enum: ['delivery', 'quality', 'pricing', 'communication', 'overall'],
          description: 'What aspect to rate',
        },
        comment: {
          type: 'string',
          description: 'Optional comment',
        },
      },
      required: ['vendorName', 'rating'],
    },
  },
  {
    name: 'get_vendor_performance',
    description: `Get performance metrics and history for a vendor.

Examples that trigger this:
- "How is Precision Bearings performing?"
- "What's my history with Acme?"
- "Vendor performance report"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorName: {
          type: 'string',
          description: 'Vendor name',
        },
      },
      required: ['vendorName'],
    },
  },
  {
    name: 'suggest_alternative_vendors',
    description: `Get suggestions for alternative vendors in a category.

Examples that trigger this:
- "Who else can supply bearings?"
- "Find alternative motor suppliers"
- "Suggest better vendors for raw materials"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Product/service category',
        },
        currentVendorName: {
          type: 'string',
          description: 'Current vendor to find alternatives for',
        },
      },
      required: ['category'],
    },
  },

  // ========================================================================
  // FINANCIAL OVERVIEW TOOLS
  // ========================================================================
  {
    name: 'get_cash_flow',
    description: `Get cash flow analysis and forecast.

Examples that trigger this:
- "What's my cash flow this month?"
- "Cash flow forecast"
- "How much money is coming in vs going out?"
- "Project my cash flow for the next quarter"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter'],
          description: 'Forecast period',
        },
        currentBalance: {
          type: 'number',
          description: 'Current bank balance for projection',
        },
      },
    },
  },
  {
    name: 'get_financial_summary',
    description: `Get a comprehensive financial summary including revenue, expenses, and P&L.

Examples that trigger this:
- "What's my financial situation?"
- "Monthly financial summary"
- "Revenue this month"
- "P&L statement"
- "How's the business doing financially?"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Time period for the summary',
        },
      },
    },
  },
  {
    name: 'get_spend_summary',
    description: `Get spending analysis broken down by category and vendor.

Examples that trigger this:
- "What's my spend this month?"
- "Where is money going?"
- "Spending breakdown"
- "Top expenses"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
          description: 'Time period',
        },
      },
    },
  },
  {
    name: 'get_accounts_payable',
    description: `Get accounts payable summary - what you owe.

Examples that trigger this:
- "What do I owe?"
- "Accounts payable"
- "What bills are due?"
- "How much do we need to pay this month?"`,
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_accounts_receivable',
    description: `Get accounts receivable summary - what's owed to you.

Examples that trigger this:
- "What's owed to me?"
- "Accounts receivable"
- "Who owes us money?"
- "Outstanding payments"`,
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'generate_insights',
    description: `Generate AI-powered financial insights and recommendations.

Examples that trigger this:
- "Give me financial insights"
- "How can I save money?"
- "What should I know about my finances?"
- "Financial recommendations"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        focusArea: {
          type: 'string',
          enum: ['spending', 'cashflow', 'vendors', 'collections'],
          description: 'Area to focus insights on',
        },
      },
    },
  },
]

// ============================================================================
// TOOL RESULT FORMATTER
// ============================================================================

/**
 * Format tool results for conversational AI response
 */
export function formatToolResultForChat(
  toolName: string,
  result: { success: boolean; message: string; data?: unknown }
): string {
  if (!result.success) {
    return `I encountered an issue: ${result.message}`
  }

  return result.message
}

// ============================================================================
// SYSTEM PROMPT FOR ERP CONTEXT
// ============================================================================

export const WELLS_ERP_SYSTEM_PROMPT = `You are Wells, an AI-native ERP system. Users manage their entire business through conversation with you - no forms, no dashboards, just talk.

WHAT YOU CAN DO:

1. INVOICES - Bill customers and track payments
   - Create invoices ("Invoice Acme $5,000 for consulting")
   - Track payments ("Show unpaid invoices")
   - Send reminders ("Remind Acme about their overdue payment")
   - Record payments ("Mark invoice #123 as paid")

2. PURCHASE ORDERS - Buy from suppliers
   - Create POs ("Order 1000 bearings from Precision at $4.50 each")
   - Track deliveries ("What POs are pending?")
   - Receive goods ("The motor order arrived")
   - Cancel orders ("Cancel the Precision order")

3. VENDOR MANAGEMENT - Manage your business relationships
   - Add vendors ("Add Acme Corp as a supplier")
   - Rate performance ("Rate Precision 5 stars for delivery")
   - View history ("Payment history with Acme")
   - Find alternatives ("Who else supplies bearings?")

4. FINANCIALS - Understand your money
   - Cash flow ("What's my cash flow this month?")
   - P&L summaries ("Financial summary")
   - Spending analysis ("Where is money going?")
   - AR/AP tracking ("What do I owe?")

CONVERSATION STYLE:
- Be direct and efficient - business owners are busy
- Use the tools behind the scenes, show results conversationally
- Proactively suggest next steps
- Always show the Wells AI fee (1% on transactions)
- Format numbers clearly ($1,234.56)

EXAMPLE CONVERSATION:

User: "Create an invoice for $5,000 to Acme Corp for the bearing order"

You: I've created Invoice #WELLS-2024-000042 for Acme Corp:

**Amount**: $5,000.00 (plus $50.00 Wells AI fee)
**Total**: $5,050.00
**Due**: January 28, 2025 (NET30)

Would you like me to send it to them now?

---

User: "What's my cash flow this month?"

You: Here's your December financial snapshot:

**Revenue**: $127,500 (+23% vs November)
**Expenses**: $89,200
**Net Cash Flow**: +$38,300

**Pending**:
- 3 invoices awaiting payment: $15,200
- 2 POs to pay: $8,400

**Insights**:
- Biggest expense category: Raw materials (45%)
- Acme Corp is 15 days overdue on Invoice #WELLS-2024-0038
- You could save ~$2,300/month by consolidating suppliers

Want me to send a payment reminder to Acme?

---

IMPORTANT:
- All amounts include Wells AI's 1% transaction fee
- Payment terms default to NET30 unless specified
- Always confirm before taking irreversible actions
- Be proactive about overdue payments and opportunities`
