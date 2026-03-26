// @ts-nocheck
/**
 * ERP Chat API Route
 *
 * Provides a conversational interface for ERP operations.
 * Users can interact with their accounting data through natural language.
 *
 * Supported operations:
 * - Connect ERP systems (QuickBooks, Xero, etc.)
 * - Get financial data (AP/AR balance, P&L, cash flow)
 * - Create and manage invoices
 * - View and pay bills
 * - Get spending analysis
 * - Sync transactions
 * - Manage vendors/customers
 * - Reconcile accounts
 *
 * @example
 * POST /api/chat/erp
 * {
 *   "message": "What's my AP balance?",
 *   "sessionId": "session_123",
 *   "context": { "previousMessages": [...] }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  ERPIntentHandler,
  classifyERPIntent,
  type ERPIntent,
  type ERPHandlerResult,
} from '@/lib/chat/handlers/erp-handler';
import { ConversationalERP } from '@/lib/erp/conversational-erp';

// ============================================================================
// TYPES
// ============================================================================

interface ERPChatRequest {
  message: string;
  sessionId?: string;
  conversationId?: string;
  context?: {
    previousMessages?: Array<{ role: string; content: string }>;
    companyId?: string;
    provider?: 'quickbooks' | 'xero' | 'sage' | 'netsuite';
  };
}

interface ERPChatResponse {
  message: string;
  intent?: ERPIntent;
  data?: any;
  suggestedActions?: string[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  sessionId: string;
  conversationId?: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// ERP CHAT TOOLS
// ============================================================================

const ERP_CHAT_TOOLS: Anthropic.Tool[] = [
  // Connection
  {
    name: 'connect_erp',
    description: 'Connect to an accounting system like QuickBooks or Xero',
    input_schema: {
      type: 'object' as const,
      properties: {
        provider: {
          type: 'string',
          enum: ['quickbooks', 'xero', 'sage', 'netsuite', 'freshbooks'],
          description: 'The accounting system to connect',
        },
      },
      required: ['provider'],
    },
  },
  {
    name: 'check_erp_status',
    description: 'Check which accounting systems are connected',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'sync_transactions',
    description: 'Sync latest transactions from connected accounting system',
    input_schema: {
      type: 'object' as const,
      properties: {
        provider: {
          type: 'string',
          description: 'Specific provider to sync (optional)',
        },
      },
    },
  },

  // Financial Queries
  {
    name: 'get_ap_balance',
    description: 'Get accounts payable balance - what you owe',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter', 'year'],
        },
      },
    },
  },
  {
    name: 'get_ar_balance',
    description: 'Get accounts receivable balance - what is owed to you',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter', 'year'],
        },
      },
    },
  },
  {
    name: 'get_cash_position',
    description: 'Get current cash balance and forecast',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_pnl',
    description: 'Get profit and loss statement',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year', 'ytd'],
        },
      },
    },
  },
  {
    name: 'get_spending_analysis',
    description: 'Analyze spending by category or vendor',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
        },
        category: {
          type: 'string',
          description: 'Specific category to analyze (e.g., shipping, payroll)',
        },
      },
    },
  },
  {
    name: 'get_gross_margin',
    description: 'Get gross margin percentage',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['month', 'quarter', 'year'],
        },
      },
    },
  },

  // Invoice Operations
  {
    name: 'create_invoice',
    description: 'Create a new invoice for a customer',
    input_schema: {
      type: 'object' as const,
      properties: {
        customerName: {
          type: 'string',
          description: 'Name of the customer',
        },
        amount: {
          type: 'number',
          description: 'Invoice amount',
        },
        description: {
          type: 'string',
          description: 'Description of goods/services',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (ISO format)',
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
          },
        },
      },
      required: ['customerName'],
    },
  },
  {
    name: 'list_invoices',
    description: 'List invoices with optional filters',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue'],
        },
        customerName: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'send_invoice',
    description: 'Send an invoice to the customer',
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
    name: 'record_payment',
    description: 'Record a payment received for an invoice',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceIdentifier: {
          type: 'string',
          description: 'Invoice number or customer name',
        },
        amount: {
          type: 'number',
          description: 'Payment amount (defaults to full amount)',
        },
        paymentMethod: {
          type: 'string',
          enum: ['ach', 'wire', 'check', 'card', 'grain'],
        },
      },
      required: ['invoiceIdentifier'],
    },
  },

  // Bill Operations
  {
    name: 'list_bills',
    description: 'List outstanding bills to pay',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'overdue', 'approved'],
        },
        vendorName: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'pay_bill',
    description: 'Pay a bill to a vendor',
    input_schema: {
      type: 'object' as const,
      properties: {
        billIdentifier: {
          type: 'string',
          description: 'Bill number or vendor name',
        },
        amount: {
          type: 'number',
          description: 'Payment amount (defaults to full amount)',
        },
        paymentMethod: {
          type: 'string',
          enum: ['ach', 'wire', 'check', 'card', 'grain'],
        },
      },
      required: ['billIdentifier'],
    },
  },
  {
    name: 'schedule_payment',
    description: 'Schedule a future payment for a bill',
    input_schema: {
      type: 'object' as const,
      properties: {
        billIdentifier: {
          type: 'string',
        },
        paymentDate: {
          type: 'string',
          description: 'Date to make payment (ISO format)',
        },
        paymentMethod: {
          type: 'string',
          enum: ['ach', 'wire', 'check', 'card', 'grain'],
        },
      },
      required: ['billIdentifier', 'paymentDate'],
    },
  },

  // Vendor/Customer Management
  {
    name: 'add_vendor',
    description: 'Add a new vendor/supplier',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        paymentTerms: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_customer',
    description: 'Add a new customer',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        paymentTerms: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_vendors',
    description: 'List vendors/suppliers',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string' },
        query: { type: 'string' },
      },
    },
  },
  {
    name: 'list_customers',
    description: 'List customers',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
      },
    },
  },
  {
    name: 'get_vendor_details',
    description: 'Get detailed information about a vendor',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendorName: { type: 'string' },
      },
      required: ['vendorName'],
    },
  },

  // Reports
  {
    name: 'get_financial_summary',
    description: 'Get a comprehensive financial summary',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'quarter', 'year'],
        },
      },
    },
  },
  {
    name: 'compare_periods',
    description: 'Compare financial metrics between periods',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentPeriod: {
          type: 'string',
          enum: ['month', 'quarter', 'year'],
        },
        previousPeriod: {
          type: 'string',
          enum: ['last_month', 'last_quarter', 'last_year'],
        },
      },
    },
  },
];

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const ERP_SYSTEM_PROMPT = `You are Wells, an AI-powered financial assistant that helps users manage their accounting and ERP data through natural conversation.

WHAT YOU CAN DO:

1. CONNECT ACCOUNTING SYSTEMS
   - Link QuickBooks, Xero, Sage, NetSuite, or FreshBooks
   - Sync transactions automatically
   - Check connection status

2. FINANCIAL QUERIES
   - AP balance ("What do I owe?")
   - AR balance ("What's owed to me?")
   - Cash position ("What's my cash balance?")
   - P&L statements ("What's my profit this quarter?")
   - Gross margin ("What's my margin?")
   - Spending analysis ("What am I spending on shipping?")

3. INVOICE MANAGEMENT
   - Create invoices ("Invoice Acme for $5000")
   - List invoices ("Show me unpaid invoices")
   - Send invoices ("Send invoice to Acme")
   - Record payments ("Mark invoice #123 as paid")

4. BILL PAYMENT
   - List bills ("What bills are due?")
   - Pay bills ("Pay Precision Bearings")
   - Schedule payments ("Schedule payment for next week")

5. VENDOR/CUSTOMER MANAGEMENT
   - Add vendors ("Add TechSupply as a vendor")
   - Add customers ("Add Acme as a customer")
   - View details ("What do I owe TechSupply?")

6. REPORTS & INSIGHTS
   - Financial summaries ("How's my business doing?")
   - Period comparisons ("Compare this month to last month")

CONVERSATION STYLE:
- Be direct and professional - business owners are busy
- Use the tools behind the scenes, present results conversationally
- Always mention the 1% Wells AI fee on transactions
- Format numbers clearly ($1,234.56)
- Proactively suggest next actions
- If something is unclear, ask a clarifying question

EXAMPLE RESPONSES:

User: "What's my AP balance?"
You: Here's your Accounts Payable summary:

**Total Outstanding**: $45,320
**Due This Week**: $12,500
**Overdue**: $3,200 (2 bills)

**Largest Payables**:
- Precision Bearings: $15,000
- Industrial Supply: $8,500
- Office Depot: $2,100

Would you like me to show the overdue bills or schedule payments?

---

User: "Invoice Acme for $5000"
You: I've created Invoice #WELLS-2024-000042 for Acme:

**Amount**: $5,000.00
**Wells AI Fee (1%)**: $50.00
**Total**: $5,050.00
**Due**: February 15, 2025 (NET30)

Would you like me to send this to Acme now?

---

IMPORTANT:
- All transactions include a 1% Wells AI fee
- Default payment terms are NET30
- Always confirm before executing payments
- If no accounting system is connected, suggest connecting one`;

// ============================================================================
// TOOL EXECUTION
// ============================================================================

async function executeTool(
  toolName: string,
  input: Record<string, any>,
  userId: string,
  companyId?: string
): Promise<ERPHandlerResult> {
  const erpService = new ConversationalERP(userId, companyId);
  const context = { userId, sessionId: '', companyId };

  switch (toolName) {
    // Connection
    case 'connect_erp':
      return await erpService.connectERP(input.provider, context);
    case 'check_erp_status':
      return await erpService.getConnectionStatus(context);
    case 'sync_transactions':
      return await erpService.syncTransactions(input.provider, context);

    // Financial Queries
    case 'get_ap_balance':
      return await erpService.getAccountsPayable(input.period, context);
    case 'get_ar_balance':
      return await erpService.getAccountsReceivable(input.period, context);
    case 'get_cash_position':
      return await erpService.getCashPosition(context);
    case 'get_pnl':
      return await erpService.getProfitAndLoss(input.period || 'month', context);
    case 'get_spending_analysis':
      return await erpService.getSpendingAnalysis(input.period || 'month', input.category, context);
    case 'get_gross_margin':
      return await erpService.getGrossMargin(input.period || 'quarter', context);

    // Invoices
    case 'create_invoice':
      return await erpService.createInvoice({
        customerName: input.customerName,
        amount: input.amount,
        description: input.description,
        dueDate: input.dueDate,
        lineItems: input.lineItems,
      }, context);
    case 'list_invoices':
      return await erpService.listInvoices({
        status: input.status,
        customerName: input.customerName,
      }, context);
    case 'send_invoice':
      return await erpService.sendInvoice(input.invoiceIdentifier, context);
    case 'record_payment':
      return await erpService.recordPayment({
        invoiceIdentifier: input.invoiceIdentifier,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      }, context);

    // Bills
    case 'list_bills':
      return await erpService.listBills({
        status: input.status,
        vendorName: input.vendorName,
      }, context);
    case 'pay_bill':
      return await erpService.payBill({
        billIdentifier: input.billIdentifier,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      }, context);
    case 'schedule_payment':
      return await erpService.schedulePayment({
        billIdentifier: input.billIdentifier,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
      }, context);

    // Vendors/Customers
    case 'add_vendor':
      return await erpService.addVendor({
        name: input.name,
        email: input.email,
        phone: input.phone,
        paymentTerms: input.paymentTerms,
        category: input.category,
      }, context);
    case 'add_customer':
      return await erpService.addCustomer({
        name: input.name,
        email: input.email,
        phone: input.phone,
        paymentTerms: input.paymentTerms,
      }, context);
    case 'list_vendors':
      return await erpService.listVendors({
        category: input.category,
        query: input.query,
      }, context);
    case 'list_customers':
      return await erpService.listCustomers({
        query: input.query,
      }, context);
    case 'get_vendor_details':
      return await erpService.getVendorDetails(input.vendorName, context);

    // Reports
    case 'get_financial_summary':
      return await erpService.getFinancialSummary(input.period || 'month', context);
    case 'compare_periods':
      return await erpService.comparePeriods(
        input.currentPeriod || 'month',
        input.previousPeriod || 'last_month',
        context
      );

    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
  }
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth().catch(() => ({ userId: null }));

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json() as ERPChatRequest;
    const { message, sessionId, conversationId, context } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const currentSessionId = sessionId || `erp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build conversation history for Claude
    const previousMessages = context?.previousMessages || [];
    const messages: Anthropic.MessageParam[] = [
      ...previousMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      system: ERP_SYSTEM_PROMPT,
      tools: ERP_CHAT_TOOLS,
      messages,
    });

    // Process response
    let finalMessage = '';
    let toolResults: any[] = [];
    let suggestedActions: string[] = [];
    let resultData: any = undefined;
    let requiresConfirmation = false;
    let confirmationPrompt: string | undefined;

    // Handle tool calls
    for (const block of response.content) {
      if (block.type === 'text') {
        finalMessage = block.text;
      } else if (block.type === 'tool_use') {
        const toolResult = await executeTool(
          block.name,
          block.input as Record<string, any>,
          userId,
          context?.companyId
        );

        toolResults.push({
          tool: block.name,
          result: toolResult,
        });

        if (toolResult.suggestedActions) {
          suggestedActions.push(...toolResult.suggestedActions);
        }

        if (toolResult.data) {
          resultData = toolResult.data;
        }

        if (toolResult.requiresConfirmation) {
          requiresConfirmation = true;
          confirmationPrompt = toolResult.confirmationPrompt;
        }
      }
    }

    // If there were tool calls, continue conversation to get natural response
    if (toolResults.length > 0 && response.stop_reason === 'tool_use') {
      const toolResultMessages = toolResults.map((tr, idx) => ({
        type: 'tool_result' as const,
        tool_use_id: (response.content.find((c, i) =>
          c.type === 'tool_use' && i === response.content.findIndex(x => x.type === 'tool_use') + idx
        ) as any)?.id || `tool-${idx}`,
        content: JSON.stringify(tr.result),
      }));

      const continuation = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        system: ERP_SYSTEM_PROMPT,
        tools: ERP_CHAT_TOOLS,
        messages: [
          ...messages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResultMessages },
        ],
      });

      // Extract final text response
      for (const block of continuation.content) {
        if (block.type === 'text') {
          finalMessage = block.text;
        }
      }
    }

    // Classify intent for analytics
    const intent = classifyERPIntent(message);

    // Build response
    const chatResponse: ERPChatResponse = {
      message: finalMessage,
      intent,
      data: resultData,
      suggestedActions: [...new Set(suggestedActions)].slice(0, 5),
      requiresConfirmation,
      confirmationPrompt,
      sessionId: currentSessionId,
      conversationId,
    };

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error('ERP Chat API error:', error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service not configured' },
          { status: 503 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER - Get session/conversation status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const erpService = new ConversationalERP(userId);
    const context = { userId, sessionId: '' };

    switch (action) {
      case 'status':
        // Get connection status
        const status = await erpService.getConnectionStatus(context);
        return NextResponse.json(status);

      case 'summary':
        // Get quick financial summary
        const summary = await erpService.getFinancialSummary('month', context);
        return NextResponse.json(summary);

      case 'capabilities':
        // Return available capabilities
        return NextResponse.json({
          success: true,
          capabilities: [
            'Connect QuickBooks, Xero, and other accounting systems',
            'Get AP/AR balances',
            'Create and manage invoices',
            'View and pay bills',
            'Analyze spending by category',
            'Get P&L and gross margin insights',
            'Manage vendors and customers',
            'Sync transactions',
            'Compare financial periods',
          ],
          examples: [
            "What's my AP balance?",
            "Invoice Acme Corp for $5000",
            "Show me outstanding bills",
            "What am I spending on shipping?",
            "Connect my QuickBooks",
            "What's my gross margin this quarter?",
            "Add TechSupply as a vendor",
            "Compare this month to last month",
          ],
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'ERP Chat API is ready',
          endpoints: {
            POST: 'Send a message to the ERP assistant',
            GET: 'Get status, summary, or capabilities',
          },
        });
    }
  } catch (error) {
    console.error('ERP Chat GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get information' },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
