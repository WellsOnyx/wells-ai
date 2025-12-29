// @ts-nocheck
/**
 * ERP Intent Handler
 *
 * Handles all ERP-related intents from the unified chat router.
 * Provides conversational access to accounting data from QuickBooks, Xero, and other systems.
 *
 * Capabilities:
 * - Connect ERP systems ("Connect my QuickBooks")
 * - Get financial data conversationally ("What's my AP balance?")
 * - Create invoices via chat ("Invoice Acme for $5000")
 * - View and pay bills ("Show me outstanding bills")
 * - Get spending analysis ("What am I spending on shipping?")
 * - Sync transactions ("Sync my latest transactions")
 * - Get P&L insights ("What's my gross margin this quarter?")
 * - Manage vendors/customers ("Add Acme as a vendor")
 * - Reconcile accounts conversationally
 */

import { ConversationalERP, type ERPChatContext, type ERPOperationResult } from '@/lib/erp/conversational-erp';
import type { ConversationContext } from '../conversation-manager';
import type { IntentClassification, ExtractedEntities } from '../intent-router';

// ============================================================================
// TYPES
// ============================================================================

export type ERPIntentType =
  // Connection & Setup
  | 'connect_erp'
  | 'disconnect_erp'
  | 'check_erp_status'
  | 'sync_transactions'
  // Financial Queries
  | 'get_ap_balance'
  | 'get_ar_balance'
  | 'get_cash_balance'
  | 'get_pnl'
  | 'get_gross_margin'
  | 'get_spending_analysis'
  | 'get_revenue_breakdown'
  // Invoice Operations
  | 'create_invoice'
  | 'list_invoices'
  | 'send_invoice'
  | 'void_invoice'
  | 'record_payment'
  // Bill Operations
  | 'list_bills'
  | 'pay_bill'
  | 'schedule_payment'
  | 'approve_bill'
  // Vendor/Customer Management
  | 'add_vendor'
  | 'add_customer'
  | 'list_vendors'
  | 'list_customers'
  | 'get_vendor_details'
  // Reconciliation
  | 'reconcile_account'
  | 'get_reconciliation_status'
  | 'match_transactions'
  // Reports
  | 'generate_report'
  | 'get_financial_summary'
  | 'compare_periods';

export interface ERPIntent {
  type: ERPIntentType;
  confidence: number;
  entities: ERPEntities;
  originalMessage: string;
  suggestedResponse?: string;
}

export interface ERPEntities extends ExtractedEntities {
  provider?: 'quickbooks' | 'xero' | 'sage' | 'netsuite' | 'freshbooks';
  amount?: number;
  currency?: string;
  vendorName?: string;
  customerName?: string;
  invoiceNumber?: string;
  billNumber?: string;
  dueDate?: string;
  description?: string;
  category?: string;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'ytd' | 'last_month' | 'last_quarter' | 'last_year';
  accountName?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount?: number;
  }>;
  paymentMethod?: 'ach' | 'wire' | 'check' | 'card' | 'grain';
  paymentTerms?: string;
}

export interface ERPHandlerResult {
  success: boolean;
  message: string;
  data?: any;
  suggestedActions?: string[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

// ============================================================================
// INTENT PATTERNS
// ============================================================================

const INTENT_PATTERNS: Record<ERPIntentType, RegExp[]> = {
  // Connection
  connect_erp: [
    /connect\s+(?:my\s+)?(?:quickbooks|qbo|xero|sage|netsuite|freshbooks|erp|accounting)/i,
    /link\s+(?:my\s+)?(?:quickbooks|xero|accounting)/i,
    /integrate\s+(?:with\s+)?(?:quickbooks|xero)/i,
    /set\s*up\s+(?:quickbooks|xero|erp)/i,
  ],
  disconnect_erp: [
    /disconnect\s+(?:my\s+)?(?:quickbooks|xero|erp)/i,
    /unlink\s+(?:my\s+)?(?:quickbooks|xero)/i,
    /remove\s+(?:quickbooks|xero)\s+(?:connection|integration)/i,
  ],
  check_erp_status: [
    /(?:is\s+)?(?:my\s+)?(?:quickbooks|xero|erp)\s+(?:connected|linked|synced)/i,
    /erp\s+(?:connection\s+)?status/i,
    /what\s+(?:accounting\s+)?systems?\s+(?:am\s+i|are)\s+connected/i,
  ],
  sync_transactions: [
    /sync\s+(?:my\s+)?(?:latest\s+)?transactions?/i,
    /update\s+(?:from\s+)?(?:quickbooks|xero)/i,
    /refresh\s+(?:my\s+)?(?:financial\s+)?data/i,
    /pull\s+(?:latest\s+)?(?:transactions?|data)/i,
  ],

  // Financial Queries
  get_ap_balance: [
    /(?:what(?:'s|\s+is)\s+)?(?:my\s+)?(?:ap|accounts?\s+payable)\s*(?:balance)?/i,
    /how\s+much\s+(?:do\s+)?(?:i|we)\s+owe/i,
    /what\s+(?:bills?|invoices?)\s+(?:do\s+)?(?:i|we)\s+(?:need\s+to\s+)?pay/i,
    /outstanding\s+(?:payables?|bills?)/i,
  ],
  get_ar_balance: [
    /(?:what(?:'s|\s+is)\s+)?(?:my\s+)?(?:ar|accounts?\s+receivable)\s*(?:balance)?/i,
    /how\s+much\s+(?:is\s+)?(?:owed?\s+to\s+(?:me|us)|(?:am\s+i|are\s+we)\s+owed)/i,
    /outstanding\s+(?:receivables?|invoices?)/i,
    /what\s+(?:invoices?|payments?)\s+are\s+(?:due|pending|outstanding)/i,
  ],
  get_cash_balance: [
    /(?:what(?:'s|\s+is)\s+)?(?:my\s+)?(?:cash|bank)\s*(?:balance|position)/i,
    /how\s+much\s+(?:cash|money)\s+(?:do\s+)?(?:i|we)\s+have/i,
    /current\s+(?:cash|bank)\s+(?:balance|position)/i,
  ],
  get_pnl: [
    /(?:what(?:'s|\s+is)\s+)?(?:my\s+)?(?:p&?l|profit\s*(?:and|&)?\s*loss)/i,
    /(?:show|get)\s+(?:me\s+)?(?:the\s+)?(?:p&?l|income\s+statement)/i,
    /how\s+(?:much\s+)?(?:profit|revenue|income)/i,
    /(?:am\s+i|are\s+we)\s+(?:profitable|making\s+money)/i,
  ],
  get_gross_margin: [
    /(?:what(?:'s|\s+is)\s+)?(?:my\s+)?(?:gross\s+)?margin/i,
    /(?:gross\s+)?margin\s+(?:this\s+)?(?:month|quarter|year)/i,
    /(?:what|how\s+much)\s+(?:is\s+)?(?:my\s+)?(?:profit\s+)?margin/i,
  ],
  get_spending_analysis: [
    /what\s+(?:am\s+i|are\s+we)\s+spending\s+on/i,
    /spending\s+(?:analysis|breakdown|by\s+category)/i,
    /(?:where|what)\s+is\s+(?:my|our)\s+money\s+going/i,
    /(?:top|biggest|largest)\s+(?:expenses?|spending|costs?)/i,
    /(?:expense|spending|cost)\s+(?:breakdown|analysis|categories)/i,
  ],
  get_revenue_breakdown: [
    /revenue\s+(?:breakdown|by\s+(?:customer|category|product))/i,
    /(?:where|what)\s+is\s+(?:my|our)\s+revenue\s+coming\s+from/i,
    /(?:top|biggest)\s+(?:revenue\s+)?(?:sources?|customers?)/i,
  ],

  // Invoice Operations
  create_invoice: [
    /(?:create|make|send|generate)\s+(?:an?\s+)?invoice/i,
    /invoice\s+(?:[\w\s]+)\s+(?:for\s+)?\$?\d+/i,
    /bill\s+(?:[\w\s]+)\s+(?:for\s+)?\$?\d+/i,
    /(?:send|create)\s+(?:a\s+)?bill\s+to/i,
  ],
  list_invoices: [
    /(?:show|list|get)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?invoices?/i,
    /(?:outstanding|unpaid|overdue|pending)\s+invoices?/i,
    /what\s+invoices?\s+(?:are|do\s+(?:i|we)\s+have)/i,
  ],
  send_invoice: [
    /send\s+(?:the\s+)?invoice\s+(?:#?\w+\s+)?(?:to\s+)?/i,
    /email\s+(?:the\s+)?invoice/i,
    /(?:re)?send\s+invoice\s+(?:#?\w+|to\s+\w+)/i,
  ],
  void_invoice: [
    /(?:void|cancel|delete)\s+(?:the\s+)?invoice/i,
    /cancel\s+invoice\s+#?\w+/i,
  ],
  record_payment: [
    /(?:record|log|mark)\s+(?:a\s+)?payment/i,
    /(?:mark|set)\s+(?:invoice\s+)?(?:#?\w+\s+)?(?:as\s+)?paid/i,
    /(?:we\s+)?(?:received|got)\s+(?:a\s+)?payment/i,
    /apply\s+payment\s+to/i,
  ],

  // Bill Operations
  list_bills: [
    /(?:show|list|get)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?(?:outstanding\s+)?bills?/i,
    /(?:what|which)\s+bills?\s+(?:are\s+)?(?:due|outstanding|need\s+to\s+be\s+paid)/i,
    /pending\s+(?:bills?|payments?)/i,
  ],
  pay_bill: [
    /pay\s+(?:the\s+)?(?:bill|invoice)\s+(?:for\s+|from\s+|to\s+)?/i,
    /(?:make\s+)?(?:a\s+)?payment\s+(?:to|for)\s+/i,
    /settle\s+(?:the\s+)?(?:bill|invoice|balance)/i,
  ],
  schedule_payment: [
    /schedule\s+(?:a\s+)?payment/i,
    /pay\s+(?:this|the\s+bill)\s+(?:on|next)\s+/i,
    /set\s+up\s+(?:a\s+)?(?:scheduled\s+)?payment/i,
  ],
  approve_bill: [
    /approve\s+(?:the\s+)?(?:bill|invoice|payment)/i,
    /authorize\s+(?:the\s+)?payment/i,
  ],

  // Vendor/Customer Management
  add_vendor: [
    /add\s+(?:a\s+)?(?:new\s+)?(?:vendor|supplier)/i,
    /(?:create|register)\s+(?:a\s+)?(?:new\s+)?(?:vendor|supplier)/i,
    /(?:set\s+up|onboard)\s+(?:a\s+)?(?:new\s+)?(?:vendor|supplier)/i,
  ],
  add_customer: [
    /add\s+(?:a\s+)?(?:new\s+)?customer/i,
    /(?:create|register)\s+(?:a\s+)?(?:new\s+)?customer/i,
    /(?:set\s+up|onboard)\s+(?:a\s+)?(?:new\s+)?customer/i,
  ],
  list_vendors: [
    /(?:show|list|get)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?(?:vendors?|suppliers?)/i,
    /(?:who|what)\s+(?:are\s+)?(?:my\s+)?(?:vendors?|suppliers?)/i,
  ],
  list_customers: [
    /(?:show|list|get)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?customers?/i,
    /(?:who|what)\s+(?:are\s+)?(?:my\s+)?customers?/i,
  ],
  get_vendor_details: [
    /(?:show|get)\s+(?:me\s+)?(?:info|details?|information)\s+(?:about|for|on)\s+(?:vendor|supplier)\s+/i,
    /(?:what|how\s+much)\s+(?:do\s+)?(?:i|we)\s+(?:owe|spend\s+with)\s+/i,
  ],

  // Reconciliation
  reconcile_account: [
    /reconcile\s+(?:my\s+)?(?:[\w\s]+\s+)?account/i,
    /(?:start|begin)\s+(?:bank\s+)?reconciliation/i,
    /bank\s+rec(?:onciliation)?/i,
  ],
  get_reconciliation_status: [
    /reconciliation\s+status/i,
    /(?:is\s+)?(?:my\s+)?(?:account\s+)?reconciled/i,
  ],
  match_transactions: [
    /match\s+(?:the\s+)?transactions?/i,
    /(?:find|identify)\s+(?:unmatched|missing)\s+transactions?/i,
  ],

  // Reports
  generate_report: [
    /(?:generate|create|run)\s+(?:a\s+)?(?:[\w\s]+\s+)?report/i,
    /(?:give|show)\s+(?:me\s+)?(?:a\s+)?(?:[\w\s]+\s+)?report/i,
  ],
  get_financial_summary: [
    /(?:financial|money|finance)\s+(?:summary|overview|snapshot)/i,
    /(?:how(?:'s|\s+is)\s+)?(?:my|the)\s+(?:business|company|finances?)\s+doing/i,
    /(?:give\s+me\s+)?(?:a\s+)?(?:quick\s+)?(?:financial\s+)?summary/i,
  ],
  compare_periods: [
    /compare\s+(?:[\w\s]+)\s+(?:to|vs?\.?|with|against)/i,
    /(?:this|last)\s+(?:month|quarter|year)\s+(?:vs?\.?|compared\s+to)/i,
    /(?:how\s+does|how's)\s+(?:this\s+)?(?:month|quarter|year)\s+compare/i,
  ],
};

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

function extractEntities(message: string): ERPEntities {
  const entities: ERPEntities = {};

  // Extract provider
  const providerMatch = message.match(/\b(quickbooks?|qbo|xero|sage|netsuite|freshbooks)\b/i);
  if (providerMatch) {
    const provider = providerMatch[1].toLowerCase();
    if (provider === 'quickbooks' || provider === 'qbo') {
      entities.provider = 'quickbooks';
    } else if (['xero', 'sage', 'netsuite', 'freshbooks'].includes(provider)) {
      entities.provider = provider as ERPEntities['provider'];
    }
  }

  // Extract amount
  const amountMatch = message.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract vendor/customer name
  const vendorMatch = message.match(/(?:to|from|for|vendor|supplier|customer)\s+([A-Z][A-Za-z\s&]+?)(?:\s+for|\s+\$|\s*$|,)/i);
  if (vendorMatch) {
    const name = vendorMatch[1].trim();
    if (message.toLowerCase().includes('vendor') || message.toLowerCase().includes('supplier')) {
      entities.vendorName = name;
    } else if (message.toLowerCase().includes('customer')) {
      entities.customerName = name;
    } else {
      entities.vendorName = name;
      entities.customerName = name;
    }
  }

  // Extract period
  const periodPatterns: [RegExp, ERPEntities['period']][] = [
    [/\btoday\b/i, 'today'],
    [/\bthis\s+week\b/i, 'week'],
    [/\bthis\s+month\b/i, 'month'],
    [/\bthis\s+quarter\b/i, 'quarter'],
    [/\bthis\s+year\b/i, 'year'],
    [/\bytd|year\s*to\s*date\b/i, 'ytd'],
    [/\blast\s+month\b/i, 'last_month'],
    [/\blast\s+quarter\b/i, 'last_quarter'],
    [/\blast\s+year\b/i, 'last_year'],
  ];

  for (const [pattern, period] of periodPatterns) {
    if (pattern.test(message)) {
      entities.period = period;
      break;
    }
  }

  // Extract category
  const categoryMatch = message.match(/(?:on|for|category)\s+([\w\s]+?)(?:\s+(?:this|last|in|during)|$)/i);
  if (categoryMatch) {
    entities.category = categoryMatch[1].trim();
  }

  // Extract invoice/bill number
  const invoiceMatch = message.match(/(?:invoice|bill)\s*#?\s*([A-Z0-9-]+)/i);
  if (invoiceMatch) {
    if (message.toLowerCase().includes('bill')) {
      entities.billNumber = invoiceMatch[1];
    } else {
      entities.invoiceNumber = invoiceMatch[1];
    }
  }

  // Extract description
  const descMatch = message.match(/for\s+(.+?)(?:\s+(?:to|from|at|\$)|$)/i);
  if (descMatch && !entities.vendorName) {
    entities.description = descMatch[1].trim();
  }

  // Extract payment method
  const paymentMethodMatch = message.match(/\b(ach|wire|check|card|grain)\b/i);
  if (paymentMethodMatch) {
    entities.paymentMethod = paymentMethodMatch[1].toLowerCase() as ERPEntities['paymentMethod'];
  }

  return entities;
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

export function classifyERPIntent(message: string): ERPIntent {
  const lowerMessage = message.toLowerCase();
  let bestMatch: { type: ERPIntentType; confidence: number } | null = null;

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        const confidence = calculateConfidence(message, pattern);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { type: intentType as ERPIntentType, confidence };
        }
      }
    }
  }

  const entities = extractEntities(message);

  return {
    type: bestMatch?.type || 'get_financial_summary',
    confidence: bestMatch?.confidence || 0.3,
    entities,
    originalMessage: message,
  };
}

function calculateConfidence(message: string, pattern: RegExp): number {
  const match = message.match(pattern);
  if (!match) return 0;

  const matchLength = match[0].length;
  const messageLength = message.length;
  const baseConfidence = Math.min(matchLength / messageLength, 1);

  // Boost confidence for exact matches
  return Math.min(baseConfidence + 0.5, 1);
}

// ============================================================================
// INTENT HANDLER
// ============================================================================

export class ERPIntentHandler {
  private erpService: ConversationalERP;

  constructor(userId: string, companyId?: string) {
    this.erpService = new ConversationalERP(userId, companyId);
  }

  /**
   * Handle an ERP intent from user message
   */
  async handleIntent(
    intent: ERPIntent,
    context: ConversationContext
  ): Promise<ERPHandlerResult> {
    const chatContext: ERPChatContext = {
      userId: context.userId || '',
      sessionId: context.sessionId,
      previousMessages: context.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content,
      })),
      userPreferences: context.preferences || {},
    };

    try {
      switch (intent.type) {
        // Connection & Setup
        case 'connect_erp':
          return this.handleConnectERP(intent.entities, chatContext);
        case 'disconnect_erp':
          return this.handleDisconnectERP(intent.entities, chatContext);
        case 'check_erp_status':
          return this.handleCheckERPStatus(chatContext);
        case 'sync_transactions':
          return this.handleSyncTransactions(intent.entities, chatContext);

        // Financial Queries
        case 'get_ap_balance':
          return this.handleGetAPBalance(intent.entities, chatContext);
        case 'get_ar_balance':
          return this.handleGetARBalance(intent.entities, chatContext);
        case 'get_cash_balance':
          return this.handleGetCashBalance(chatContext);
        case 'get_pnl':
          return this.handleGetPnL(intent.entities, chatContext);
        case 'get_gross_margin':
          return this.handleGetGrossMargin(intent.entities, chatContext);
        case 'get_spending_analysis':
          return this.handleGetSpendingAnalysis(intent.entities, chatContext);
        case 'get_revenue_breakdown':
          return this.handleGetRevenueBreakdown(intent.entities, chatContext);

        // Invoice Operations
        case 'create_invoice':
          return this.handleCreateInvoice(intent.entities, chatContext);
        case 'list_invoices':
          return this.handleListInvoices(intent.entities, chatContext);
        case 'send_invoice':
          return this.handleSendInvoice(intent.entities, chatContext);
        case 'void_invoice':
          return this.handleVoidInvoice(intent.entities, chatContext);
        case 'record_payment':
          return this.handleRecordPayment(intent.entities, chatContext);

        // Bill Operations
        case 'list_bills':
          return this.handleListBills(intent.entities, chatContext);
        case 'pay_bill':
          return this.handlePayBill(intent.entities, chatContext);
        case 'schedule_payment':
          return this.handleSchedulePayment(intent.entities, chatContext);
        case 'approve_bill':
          return this.handleApproveBill(intent.entities, chatContext);

        // Vendor/Customer Management
        case 'add_vendor':
          return this.handleAddVendor(intent.entities, chatContext);
        case 'add_customer':
          return this.handleAddCustomer(intent.entities, chatContext);
        case 'list_vendors':
          return this.handleListVendors(intent.entities, chatContext);
        case 'list_customers':
          return this.handleListCustomers(intent.entities, chatContext);
        case 'get_vendor_details':
          return this.handleGetVendorDetails(intent.entities, chatContext);

        // Reconciliation
        case 'reconcile_account':
          return this.handleReconcileAccount(intent.entities, chatContext);
        case 'get_reconciliation_status':
          return this.handleGetReconciliationStatus(chatContext);
        case 'match_transactions':
          return this.handleMatchTransactions(chatContext);

        // Reports
        case 'generate_report':
          return this.handleGenerateReport(intent.entities, chatContext);
        case 'get_financial_summary':
          return this.handleGetFinancialSummary(intent.entities, chatContext);
        case 'compare_periods':
          return this.handleComparePeriods(intent.entities, chatContext);

        default:
          return {
            success: false,
            message: "I'm not sure what you'd like to do with your accounting data. Could you tell me more specifically? For example, you can ask me about your AP/AR balance, create invoices, or get spending analysis.",
            suggestedActions: [
              "What's my AP balance?",
              "Show me outstanding invoices",
              "What am I spending on this month?",
            ],
          };
      }
    } catch (error) {
      console.error('ERP Handler error:', error);
      return {
        success: false,
        message: `I encountered an issue while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Would you like to try again?`,
      };
    }
  }

  // =========================================================================
  // CONNECTION HANDLERS
  // =========================================================================

  private async handleConnectERP(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const provider = entities.provider || 'quickbooks';
    const result = await this.erpService.connectERP(provider, context);

    if (result.success && result.data?.authUrl) {
      return {
        success: true,
        message: `I'll help you connect your ${this.formatProviderName(provider)} account. Click the link below to authorize access:\n\n[Connect ${this.formatProviderName(provider)}](${result.data.authUrl})\n\nOnce connected, I'll be able to help you with invoices, bills, spending analysis, and more.`,
        data: result.data,
        suggestedActions: [
          "I've connected my account",
          "What can you do once connected?",
          "Connect a different system",
        ],
      };
    }

    return {
      success: result.success,
      message: result.message,
      data: result.data,
    };
  }

  private async handleDisconnectERP(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const provider = entities.provider;
    const result = await this.erpService.disconnectERP(provider, context);

    return {
      success: result.success,
      message: result.message,
      requiresConfirmation: true,
      confirmationPrompt: `Are you sure you want to disconnect your ${provider ? this.formatProviderName(provider) : 'accounting'} integration? This will remove access to your financial data.`,
    };
  }

  private async handleCheckERPStatus(context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.getConnectionStatus(context);

    if (result.success && result.data?.connections?.length > 0) {
      const connections = result.data.connections;
      const connectionList = connections.map((c: any) =>
        `- **${this.formatProviderName(c.provider)}**: ${c.status === 'active' ? 'Connected' : c.status} (last synced: ${c.lastSync || 'never'})`
      ).join('\n');

      return {
        success: true,
        message: `Here are your connected accounting systems:\n\n${connectionList}`,
        data: result.data,
        suggestedActions: [
          "Sync my transactions",
          "Connect another system",
          "Show my financial summary",
        ],
      };
    }

    return {
      success: true,
      message: "You don't have any accounting systems connected yet. Would you like to connect QuickBooks, Xero, or another system?",
      suggestedActions: [
        "Connect my QuickBooks",
        "Connect my Xero",
        "What systems do you support?",
      ],
    };
  }

  private async handleSyncTransactions(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.syncTransactions(entities.provider, context);

    if (result.success) {
      const data = result.data || {};
      return {
        success: true,
        message: `Sync complete! Here's what I found:\n\n` +
          `- **${data.invoicesAdded || 0}** new invoices\n` +
          `- **${data.billsAdded || 0}** new bills\n` +
          `- **${data.paymentsRecorded || 0}** payments recorded\n` +
          `- **${data.vendorsUpdated || 0}** vendors updated\n\n` +
          `Last sync: just now`,
        data: result.data,
        suggestedActions: [
          "What's my AR balance now?",
          "Show me outstanding bills",
          "Any overdue invoices?",
        ],
      };
    }

    return {
      success: false,
      message: result.message,
    };
  }

  // =========================================================================
  // FINANCIAL QUERY HANDLERS
  // =========================================================================

  private async handleGetAPBalance(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.getAccountsPayable(entities.period, context);

    if (result.success && result.data) {
      const ap = result.data;
      return {
        success: true,
        message: `Here's your Accounts Payable summary:\n\n` +
          `**Total Outstanding**: $${this.formatAmount(ap.totalDue)}\n` +
          `**Due This Week**: $${this.formatAmount(ap.dueThisWeek)}\n` +
          `**Overdue**: $${this.formatAmount(ap.overdue)} (${ap.overdueCount} bills)\n\n` +
          (ap.topVendors?.length > 0
            ? `**Largest Payables**:\n${ap.topVendors.slice(0, 3).map((v: any) => `- ${v.name}: $${this.formatAmount(v.amount)}`).join('\n')}`
            : ''),
        data: ap,
        suggestedActions: [
          "Show me outstanding bills",
          "Pay the oldest bill",
          "What's due this week?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't retrieve your AP balance. Please make sure your accounting system is connected.",
    };
  }

  private async handleGetARBalance(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.getAccountsReceivable(entities.period, context);

    if (result.success && result.data) {
      const ar = result.data;
      return {
        success: true,
        message: `Here's your Accounts Receivable summary:\n\n` +
          `**Total Outstanding**: $${this.formatAmount(ar.totalDue)}\n` +
          `**Due This Week**: $${this.formatAmount(ar.dueThisWeek)}\n` +
          `**Overdue**: $${this.formatAmount(ar.overdue)} (${ar.overdueCount} invoices)\n\n` +
          (ar.topCustomers?.length > 0
            ? `**Largest Receivables**:\n${ar.topCustomers.slice(0, 3).map((c: any) => `- ${c.name}: $${this.formatAmount(c.amount)}`).join('\n')}`
            : ''),
        data: ar,
        suggestedActions: [
          "Show me overdue invoices",
          "Send payment reminders",
          "Who owes the most?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't retrieve your AR balance. Please make sure your accounting system is connected.",
    };
  }

  private async handleGetCashBalance(context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.getCashPosition(context);

    if (result.success && result.data) {
      const cash = result.data;
      return {
        success: true,
        message: `Here's your cash position:\n\n` +
          `**Total Cash**: $${this.formatAmount(cash.totalCash)}\n\n` +
          (cash.accounts?.length > 0
            ? `**By Account**:\n${cash.accounts.map((a: any) => `- ${a.name}: $${this.formatAmount(a.balance)}`).join('\n')}`
            : '') +
          `\n\n**Projected (30 days)**:\n` +
          `- Inflows: +$${this.formatAmount(cash.projectedInflows)}\n` +
          `- Outflows: -$${this.formatAmount(cash.projectedOutflows)}\n` +
          `- Net: $${this.formatAmount(cash.projectedNet)}`,
        data: cash,
        suggestedActions: [
          "Show me cash flow forecast",
          "What bills are due soon?",
          "What payments are coming in?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't retrieve your cash position.",
    };
  }

  private async handleGetPnL(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const period = entities.period || 'month';
    const result = await this.erpService.getProfitAndLoss(period, context);

    if (result.success && result.data) {
      const pnl = result.data;
      const periodLabel = this.formatPeriod(period);

      return {
        success: true,
        message: `Here's your P&L for ${periodLabel}:\n\n` +
          `**Revenue**: $${this.formatAmount(pnl.revenue)}\n` +
          `**Cost of Goods**: $${this.formatAmount(pnl.cogs)}\n` +
          `**Gross Profit**: $${this.formatAmount(pnl.grossProfit)} (${pnl.grossMargin}%)\n` +
          `**Operating Expenses**: $${this.formatAmount(pnl.operatingExpenses)}\n` +
          `**Net Income**: $${this.formatAmount(pnl.netIncome)} (${pnl.netMargin}%)\n\n` +
          (pnl.comparedToLastPeriod
            ? `**vs Last Period**: ${pnl.comparedToLastPeriod > 0 ? '+' : ''}${pnl.comparedToLastPeriod}%`
            : ''),
        data: pnl,
        suggestedActions: [
          "What's driving expenses?",
          "Compare to last month",
          "Revenue breakdown by customer",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't generate your P&L.",
    };
  }

  private async handleGetGrossMargin(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const period = entities.period || 'quarter';
    const result = await this.erpService.getGrossMargin(period, context);

    if (result.success && result.data) {
      const margin = result.data;
      const periodLabel = this.formatPeriod(period);

      return {
        success: true,
        message: `Your gross margin ${periodLabel}:\n\n` +
          `**Gross Margin**: ${margin.grossMargin}%\n` +
          `**Revenue**: $${this.formatAmount(margin.revenue)}\n` +
          `**Cost of Goods**: $${this.formatAmount(margin.cogs)}\n` +
          `**Gross Profit**: $${this.formatAmount(margin.grossProfit)}\n\n` +
          (margin.trend
            ? `**Trend**: ${margin.trend > 0 ? 'Up' : 'Down'} ${Math.abs(margin.trend)}% from last period`
            : ''),
        data: margin,
        suggestedActions: [
          "How can I improve margin?",
          "What's my biggest cost?",
          "Compare to industry average",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't calculate your gross margin.",
    };
  }

  private async handleGetSpendingAnalysis(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const period = entities.period || 'month';
    const category = entities.category;
    const result = await this.erpService.getSpendingAnalysis(period, category, context);

    if (result.success && result.data) {
      const spend = result.data;
      const periodLabel = this.formatPeriod(period);

      let message = category
        ? `Here's your spending on **${category}** ${periodLabel}:\n\n` +
          `**Total**: $${this.formatAmount(spend.categoryTotal)}\n` +
          `**% of Total Spend**: ${spend.percentOfTotal}%\n\n` +
          (spend.categoryVendors?.length > 0
            ? `**Top Vendors**:\n${spend.categoryVendors.map((v: any) => `- ${v.name}: $${this.formatAmount(v.amount)}`).join('\n')}`
            : '')
        : `Here's your spending breakdown ${periodLabel}:\n\n` +
          `**Total Spend**: $${this.formatAmount(spend.totalSpend)}\n\n` +
          `**By Category**:\n${spend.categories?.map((c: any) =>
            `- **${c.name}**: $${this.formatAmount(c.amount)} (${c.percent}%)`
          ).join('\n') || 'No category data available'}\n\n` +
          (spend.topVendors?.length > 0
            ? `**Top Vendors**:\n${spend.topVendors.slice(0, 5).map((v: any) => `- ${v.name}: $${this.formatAmount(v.amount)}`).join('\n')}`
            : '');

      return {
        success: true,
        message,
        data: spend,
        suggestedActions: [
          "What am I spending on shipping?",
          "Compare to last month",
          "How can I reduce costs?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't analyze your spending.",
    };
  }

  private async handleGetRevenueBreakdown(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const period = entities.period || 'month';
    const result = await this.erpService.getRevenueBreakdown(period, context);

    if (result.success && result.data) {
      const revenue = result.data;
      const periodLabel = this.formatPeriod(period);

      return {
        success: true,
        message: `Here's your revenue breakdown ${periodLabel}:\n\n` +
          `**Total Revenue**: $${this.formatAmount(revenue.totalRevenue)}\n\n` +
          `**By Customer**:\n${revenue.byCustomer?.slice(0, 5).map((c: any) =>
            `- ${c.name}: $${this.formatAmount(c.amount)} (${c.percent}%)`
          ).join('\n') || 'No customer data available'}\n\n` +
          (revenue.byCategory?.length > 0
            ? `**By Category**:\n${revenue.byCategory.map((c: any) => `- ${c.name}: $${this.formatAmount(c.amount)} (${c.percent}%)`).join('\n')}`
            : ''),
        data: revenue,
        suggestedActions: [
          "Who are my top customers?",
          "Revenue trend over time",
          "Compare to last quarter",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't analyze your revenue.",
    };
  }

  // =========================================================================
  // INVOICE HANDLERS
  // =========================================================================

  private async handleCreateInvoice(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.customerName && !entities.vendorName) {
      return {
        success: false,
        message: "Who would you like to invoice? Please provide a customer name.",
        suggestedActions: [
          "Invoice Acme Corp for $5000",
          "Bill John Smith $500 for consulting",
        ],
      };
    }

    const customerName = entities.customerName || entities.vendorName || '';
    const amount = entities.amount;
    const description = entities.description;

    if (!amount) {
      return {
        success: false,
        message: `I'll create an invoice for **${customerName}**. What's the amount?`,
      };
    }

    const result = await this.erpService.createInvoice({
      customerName,
      amount,
      description: description || 'Services rendered',
      lineItems: entities.lineItems,
      dueDate: entities.dueDate,
    }, context);

    if (result.success && result.data) {
      const invoice = result.data;
      const wellsFee = amount * 0.01;

      return {
        success: true,
        message: `I've created Invoice **#${invoice.invoiceNumber}** for ${customerName}:\n\n` +
          `**Amount**: $${this.formatAmount(amount)}\n` +
          `**Wells AI Fee (1%)**: $${this.formatAmount(wellsFee)}\n` +
          `**Total**: $${this.formatAmount(amount + wellsFee)}\n` +
          `**Due Date**: ${invoice.dueDate}\n\n` +
          `Would you like me to send this to the customer?`,
        data: invoice,
        suggestedActions: [
          "Send this invoice",
          "Create another invoice",
          "Show my invoices",
        ],
        requiresConfirmation: true,
        confirmationPrompt: "Send this invoice to the customer?",
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't create the invoice. Please try again.",
    };
  }

  private async handleListInvoices(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.listInvoices({
      status: entities.category as any,
      customerName: entities.customerName,
    }, context);

    if (result.success && result.data?.invoices?.length > 0) {
      const invoices = result.data.invoices;
      const totalOutstanding = invoices.reduce((sum: number, inv: any) => sum + inv.amountDue, 0);

      return {
        success: true,
        message: `Here are your invoices:\n\n` +
          invoices.slice(0, 10).map((inv: any) =>
            `- **#${inv.invoiceNumber}** - ${inv.customerName}: $${this.formatAmount(inv.total)} (${inv.status})`
          ).join('\n') +
          `\n\n**Total Outstanding**: $${this.formatAmount(totalOutstanding)}` +
          (invoices.length > 10 ? `\n\n_Showing 10 of ${invoices.length} invoices_` : ''),
        data: result.data,
        suggestedActions: [
          "Show overdue invoices",
          "Send payment reminders",
          "Create new invoice",
        ],
      };
    }

    return {
      success: true,
      message: "You don't have any invoices matching that criteria.",
      suggestedActions: [
        "Create an invoice",
        "Show all invoices",
      ],
    };
  }

  private async handleSendInvoice(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.invoiceNumber && !entities.customerName) {
      return {
        success: false,
        message: "Which invoice would you like to send? Please provide an invoice number or customer name.",
      };
    }

    const result = await this.erpService.sendInvoice(
      entities.invoiceNumber || entities.customerName || '',
      context
    );

    if (result.success) {
      return {
        success: true,
        message: `Invoice sent! The customer will receive it at their email address.`,
        data: result.data,
        suggestedActions: [
          "Show my invoices",
          "Create another invoice",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't send the invoice.",
    };
  }

  private async handleVoidInvoice(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.invoiceNumber) {
      return {
        success: false,
        message: "Which invoice would you like to void? Please provide an invoice number.",
      };
    }

    return {
      success: true,
      message: `Are you sure you want to void invoice **#${entities.invoiceNumber}**? This cannot be undone.`,
      requiresConfirmation: true,
      confirmationPrompt: "Void this invoice?",
    };
  }

  private async handleRecordPayment(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.invoiceNumber && !entities.customerName) {
      return {
        success: false,
        message: "Which invoice received a payment? Please provide an invoice number or customer name.",
      };
    }

    const result = await this.erpService.recordPayment({
      invoiceIdentifier: entities.invoiceNumber || entities.customerName || '',
      amount: entities.amount,
      paymentDate: entities.dueDate,
      paymentMethod: entities.paymentMethod,
    }, context);

    if (result.success) {
      return {
        success: true,
        message: `Payment recorded! Invoice has been marked as ${result.data?.status || 'paid'}.`,
        data: result.data,
        suggestedActions: [
          "Show my invoices",
          "What's my AR balance?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't record the payment.",
    };
  }

  // =========================================================================
  // BILL HANDLERS
  // =========================================================================

  private async handleListBills(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.listBills({
      status: entities.category as any,
      vendorName: entities.vendorName,
    }, context);

    if (result.success && result.data?.bills?.length > 0) {
      const bills = result.data.bills;
      const totalDue = bills.reduce((sum: number, bill: any) => sum + bill.amountDue, 0);

      return {
        success: true,
        message: `Here are your outstanding bills:\n\n` +
          bills.slice(0, 10).map((bill: any) =>
            `- **${bill.vendorName}**: $${this.formatAmount(bill.amountDue)} (due ${bill.dueDate})`
          ).join('\n') +
          `\n\n**Total Due**: $${this.formatAmount(totalDue)}` +
          (bills.length > 10 ? `\n\n_Showing 10 of ${bills.length} bills_` : ''),
        data: result.data,
        suggestedActions: [
          "Pay the oldest bill",
          "What's overdue?",
          "Schedule payments",
        ],
      };
    }

    return {
      success: true,
      message: "You don't have any outstanding bills.",
      suggestedActions: [
        "What's my AP balance?",
        "Show my vendors",
      ],
    };
  }

  private async handlePayBill(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.billNumber && !entities.vendorName) {
      return {
        success: false,
        message: "Which bill would you like to pay? Please provide a bill number or vendor name.",
      };
    }

    const result = await this.erpService.payBill({
      billIdentifier: entities.billNumber || entities.vendorName || '',
      amount: entities.amount,
      paymentMethod: entities.paymentMethod || 'grain',
    }, context);

    if (result.success) {
      const payment = result.data;
      return {
        success: true,
        message: `Payment of **$${this.formatAmount(payment?.amount || entities.amount)}** to **${entities.vendorName || 'vendor'}** has been initiated.\n\n` +
          `**Payment Method**: ${entities.paymentMethod || 'GRAIN'}\n` +
          `**Wells AI Fee (1%)**: $${this.formatAmount((payment?.amount || entities.amount || 0) * 0.01)}\n\n` +
          `The payment will be processed shortly.`,
        data: result.data,
        suggestedActions: [
          "Show my remaining bills",
          "What's my AP balance now?",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't process the payment.",
      requiresConfirmation: true,
      confirmationPrompt: `Pay $${this.formatAmount(entities.amount || 0)} to ${entities.vendorName}?`,
    };
  }

  private async handleSchedulePayment(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.billNumber && !entities.vendorName) {
      return {
        success: false,
        message: "Which bill would you like to schedule payment for?",
      };
    }

    const result = await this.erpService.schedulePayment({
      billIdentifier: entities.billNumber || entities.vendorName || '',
      paymentDate: entities.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      paymentMethod: entities.paymentMethod || 'grain',
    }, context);

    if (result.success) {
      return {
        success: true,
        message: `Payment scheduled for **${result.data?.scheduledDate || 'next week'}**.`,
        data: result.data,
        suggestedActions: [
          "Show scheduled payments",
          "Cancel this payment",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't schedule the payment.",
    };
  }

  private async handleApproveBill(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.billNumber && !entities.vendorName) {
      return {
        success: false,
        message: "Which bill would you like to approve?",
      };
    }

    const result = await this.erpService.approveBill(
      entities.billNumber || entities.vendorName || '',
      context
    );

    if (result.success) {
      return {
        success: true,
        message: `Bill approved! It's now ready for payment.`,
        data: result.data,
        suggestedActions: [
          "Pay this bill",
          "Show bills pending approval",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't approve the bill.",
    };
  }

  // =========================================================================
  // VENDOR/CUSTOMER HANDLERS
  // =========================================================================

  private async handleAddVendor(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.vendorName) {
      return {
        success: false,
        message: "What's the vendor's name?",
      };
    }

    const result = await this.erpService.addVendor({
      name: entities.vendorName,
      email: entities.email as string,
      paymentTerms: entities.paymentTerms,
      category: entities.category,
    }, context);

    if (result.success) {
      return {
        success: true,
        message: `Vendor **${entities.vendorName}** has been added to your system.`,
        data: result.data,
        suggestedActions: [
          "Create a PO for this vendor",
          "Add another vendor",
          "Show my vendors",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't add the vendor.",
    };
  }

  private async handleAddCustomer(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.customerName) {
      return {
        success: false,
        message: "What's the customer's name?",
      };
    }

    const result = await this.erpService.addCustomer({
      name: entities.customerName,
      email: entities.email as string,
      paymentTerms: entities.paymentTerms,
    }, context);

    if (result.success) {
      return {
        success: true,
        message: `Customer **${entities.customerName}** has been added to your system.`,
        data: result.data,
        suggestedActions: [
          "Create an invoice for this customer",
          "Add another customer",
          "Show my customers",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't add the customer.",
    };
  }

  private async handleListVendors(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.listVendors({
      category: entities.category,
      query: entities.vendorName,
    }, context);

    if (result.success && result.data?.vendors?.length > 0) {
      const vendors = result.data.vendors;

      return {
        success: true,
        message: `Here are your vendors:\n\n` +
          vendors.slice(0, 15).map((v: any) =>
            `- **${v.name}**${v.totalSpend ? ` - $${this.formatAmount(v.totalSpend)} total spend` : ''}`
          ).join('\n') +
          (vendors.length > 15 ? `\n\n_Showing 15 of ${vendors.length} vendors_` : ''),
        data: result.data,
        suggestedActions: [
          "Add a new vendor",
          "What do I owe vendors?",
        ],
      };
    }

    return {
      success: true,
      message: "You don't have any vendors yet.",
      suggestedActions: [
        "Add a vendor",
        "Connect QuickBooks to import vendors",
      ],
    };
  }

  private async handleListCustomers(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.listCustomers({
      query: entities.customerName,
    }, context);

    if (result.success && result.data?.customers?.length > 0) {
      const customers = result.data.customers;

      return {
        success: true,
        message: `Here are your customers:\n\n` +
          customers.slice(0, 15).map((c: any) =>
            `- **${c.name}**${c.totalRevenue ? ` - $${this.formatAmount(c.totalRevenue)} total revenue` : ''}`
          ).join('\n') +
          (customers.length > 15 ? `\n\n_Showing 15 of ${customers.length} customers_` : ''),
        data: result.data,
        suggestedActions: [
          "Add a new customer",
          "Create an invoice",
        ],
      };
    }

    return {
      success: true,
      message: "You don't have any customers yet.",
      suggestedActions: [
        "Add a customer",
        "Connect QuickBooks to import customers",
      ],
    };
  }

  private async handleGetVendorDetails(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    if (!entities.vendorName) {
      return {
        success: false,
        message: "Which vendor would you like details for?",
      };
    }

    const result = await this.erpService.getVendorDetails(entities.vendorName, context);

    if (result.success && result.data) {
      const vendor = result.data;

      return {
        success: true,
        message: `Here's the details for **${vendor.name}**:\n\n` +
          `**Total Spend**: $${this.formatAmount(vendor.totalSpend)}\n` +
          `**Open Bills**: $${this.formatAmount(vendor.openBills)}\n` +
          `**Last Payment**: ${vendor.lastPaymentDate || 'Never'}\n` +
          `**Payment Terms**: ${vendor.paymentTerms || 'Not set'}\n` +
          (vendor.averageOrderValue ? `**Average Order**: $${this.formatAmount(vendor.averageOrderValue)}\n` : '') +
          (vendor.categories?.length ? `**Categories**: ${vendor.categories.join(', ')}` : ''),
        data: vendor,
        suggestedActions: [
          "Pay their outstanding bills",
          "Create a PO",
          "View payment history",
        ],
      };
    }

    return {
      success: false,
      message: result.message || `I couldn't find details for "${entities.vendorName}".`,
    };
  }

  // =========================================================================
  // RECONCILIATION HANDLERS
  // =========================================================================

  private async handleReconcileAccount(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.startReconciliation(entities.accountName, context);

    if (result.success && result.data) {
      const recon = result.data;

      return {
        success: true,
        message: `Starting reconciliation for **${recon.accountName}**:\n\n` +
          `**Book Balance**: $${this.formatAmount(recon.bookBalance)}\n` +
          `**Uncleared Items**: ${recon.unclearedCount} transactions\n` +
          `**Uncleared Amount**: $${this.formatAmount(recon.unclearedAmount)}\n\n` +
          `Would you like me to help match transactions?`,
        data: recon,
        suggestedActions: [
          "Match transactions",
          "Show uncleared items",
          "Cancel reconciliation",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't start the reconciliation.",
    };
  }

  private async handleGetReconciliationStatus(context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.getReconciliationStatus(context);

    if (result.success && result.data) {
      const status = result.data;

      return {
        success: true,
        message: `Reconciliation status:\n\n` +
          status.accounts?.map((a: any) =>
            `- **${a.name}**: ${a.isReconciled ? 'Reconciled' : 'Needs reconciliation'} (last: ${a.lastReconciled || 'never'})`
          ).join('\n'),
        data: status,
        suggestedActions: [
          "Reconcile checking account",
          "Show unmatched transactions",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't get the reconciliation status.",
    };
  }

  private async handleMatchTransactions(context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.matchTransactions(context);

    if (result.success && result.data) {
      const matches = result.data;

      return {
        success: true,
        message: `I found **${matches.matchedCount}** potential matches:\n\n` +
          matches.suggestions?.slice(0, 5).map((s: any) =>
            `- $${this.formatAmount(s.amount)} from ${s.date}: "${s.description}" -> ${s.matchedWith || 'No match found'}`
          ).join('\n') +
          (matches.suggestions?.length > 5 ? `\n\n_${matches.suggestions.length - 5} more matches available_` : ''),
        data: matches,
        suggestedActions: [
          "Approve all matches",
          "Show unmatched only",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't find transaction matches.",
    };
  }

  // =========================================================================
  // REPORT HANDLERS
  // =========================================================================

  private async handleGenerateReport(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const reportType = entities.category || 'financial_summary';
    const period = entities.period || 'month';

    const result = await this.erpService.generateReport(reportType, period, context);

    if (result.success && result.data) {
      return {
        success: true,
        message: result.data.summary || `Your ${reportType} report is ready.`,
        data: result.data,
        suggestedActions: [
          "Generate another report",
          "Compare to last period",
          "Download as PDF",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't generate the report.",
    };
  }

  private async handleGetFinancialSummary(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const period = entities.period || 'month';
    const result = await this.erpService.getFinancialSummary(period, context);

    if (result.success && result.data) {
      const summary = result.data;
      const periodLabel = this.formatPeriod(period);

      return {
        success: true,
        message: `Here's your financial summary ${periodLabel}:\n\n` +
          `**Revenue**: $${this.formatAmount(summary.revenue)}\n` +
          `**Expenses**: $${this.formatAmount(summary.expenses)}\n` +
          `**Net Income**: $${this.formatAmount(summary.netIncome)}\n` +
          `**Profit Margin**: ${summary.profitMargin}%\n\n` +
          `**Cash Position**: $${this.formatAmount(summary.cashBalance)}\n` +
          `**AR Outstanding**: $${this.formatAmount(summary.arBalance)}\n` +
          `**AP Outstanding**: $${this.formatAmount(summary.apBalance)}\n\n` +
          (summary.insights?.length > 0
            ? `**Insights**:\n${summary.insights.map((i: string) => `- ${i}`).join('\n')}`
            : ''),
        data: summary,
        suggestedActions: [
          "Show me P&L details",
          "What can I improve?",
          "Compare to last month",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't get your financial summary.",
    };
  }

  private async handleComparePeriods(entities: ERPEntities, context: ERPChatContext): Promise<ERPHandlerResult> {
    const result = await this.erpService.comparePeriods(
      entities.period || 'month',
      'last_' + (entities.period || 'month'),
      context
    );

    if (result.success && result.data) {
      const comparison = result.data;

      return {
        success: true,
        message: `Here's how this period compares:\n\n` +
          `**Revenue**: $${this.formatAmount(comparison.currentRevenue)} vs $${this.formatAmount(comparison.previousRevenue)} (${comparison.revenueChange > 0 ? '+' : ''}${comparison.revenueChange}%)\n` +
          `**Expenses**: $${this.formatAmount(comparison.currentExpenses)} vs $${this.formatAmount(comparison.previousExpenses)} (${comparison.expensesChange > 0 ? '+' : ''}${comparison.expensesChange}%)\n` +
          `**Net Income**: $${this.formatAmount(comparison.currentNetIncome)} vs $${this.formatAmount(comparison.previousNetIncome)} (${comparison.netIncomeChange > 0 ? '+' : ''}${comparison.netIncomeChange}%)\n\n` +
          (comparison.highlights?.length > 0
            ? `**Key Changes**:\n${comparison.highlights.map((h: string) => `- ${h}`).join('\n')}`
            : ''),
        data: comparison,
        suggestedActions: [
          "What drove the change?",
          "Show detailed breakdown",
        ],
      };
    }

    return {
      success: false,
      message: result.message || "I couldn't compare the periods.",
    };
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  private formatAmount(amount: number | undefined): string {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatProviderName(provider: string): string {
    const names: Record<string, string> = {
      quickbooks: 'QuickBooks',
      xero: 'Xero',
      sage: 'Sage',
      netsuite: 'NetSuite',
      freshbooks: 'FreshBooks',
    };
    return names[provider] || provider;
  }

  private formatPeriod(period: string): string {
    const labels: Record<string, string> = {
      today: 'today',
      week: 'this week',
      month: 'this month',
      quarter: 'this quarter',
      year: 'this year',
      ytd: 'year to date',
      last_month: 'last month',
      last_quarter: 'last quarter',
      last_year: 'last year',
    };
    return labels[period] || period;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createERPHandler(userId: string, companyId?: string): ERPIntentHandler {
  return new ERPIntentHandler(userId, companyId);
}

export {
  classifyERPIntent,
  extractEntities,
  INTENT_PATTERNS,
};
