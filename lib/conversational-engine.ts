/**
 * Conversational ERP Engine
 * Core engine for natural language ERP interactions
 *
 * Supports:
 * - Intent classification
 * - Entity extraction
 * - Context management
 * - Multi-turn conversations
 * - Response generation
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from './db'
import { generateResponseSystemPrompt } from './system-prompt'
import * as POHandler from './procurement/po-handler'
import * as InventoryHandler from './procurement/inventory-handler'
import * as SupplierHandler from './procurement/supplier-handler'
import * as BatchOps from './procurement/batch-operations'
import * as InvoiceHandler from './finance/invoice-handler'
import * as PaymentHandler from './finance/payment-handler'
import * as ReportHandler from './finance/report-handler'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ============================================
// Types
// ============================================

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

export interface ConversationContext {
  conversationId: string
  userId: string
  platform: string // 'web', 'slack', 'teams', 'discord', 'gchat', 'widget'
  currentIntent?: string
  entities?: Record<string, any>
  history: ConversationMessage[]
  metadata?: Record<string, any>
  createdAt?: Date
  lastActivityAt?: Date
}

export interface ParsedIntent {
  intent: string // 'create_po', 'query_po', 'check_inventory', 'generate_invoice', etc.
  entities: Record<string, any>
  confidence: number // 0-1
  needsClarification: boolean
  clarificationQuestion?: string
  suggestedActions?: string[]
}

export interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  metadata?: Record<string, any>
}

// ============================================
// Supported Intents
// ============================================

export const INTENTS = {
  // Procurement - Basic
  CREATE_PO: 'create_po',
  QUERY_PO: 'query_po',
  UPDATE_PO: 'update_po',
  APPROVE_PO: 'approve_po',
  REJECT_PO: 'reject_po',
  CHECK_INVENTORY: 'check_inventory',
  REORDER_ITEM: 'reorder_item',
  UPDATE_INVENTORY: 'update_inventory',
  FIND_SUPPLIER: 'find_supplier',
  SUPPLIER_PERFORMANCE: 'supplier_performance',
  COMPARE_SUPPLIERS: 'compare_suppliers',
  ADD_SUPPLIER: 'add_supplier',

  // Procurement - Advanced (Week 15-16)
  BATCH_APPROVE_POS: 'batch_approve_pos',
  BATCH_REJECT_POS: 'batch_reject_pos',
  BATCH_REORDER: 'batch_reorder',
  BATCH_UPDATE_INVENTORY: 'batch_update_inventory',
  RECOMMEND_SUPPLIER: 'recommend_supplier',

  // Finance (Weeks 17-20)
  GENERATE_INVOICE: 'generate_invoice',
  QUERY_INVOICE: 'query_invoice',
  RECORD_PAYMENT: 'record_payment',
  QUERY_PAYMENT: 'query_payment',
  GET_REPORT: 'get_report',
  CHECK_BUDGET: 'check_budget',
  ANALYZE_SPEND: 'analyze_spend',
  FORECAST: 'forecast',

  // General
  HELP: 'help',
  STATUS: 'status',
  GREETING: 'greeting',
  UNKNOWN: 'unknown',
} as const

// ============================================
// Context Management
// ============================================

export async function getConversationContext(
  conversationId: string,
  userId: string,
  platform: string
): Promise<ConversationContext> {
  // Try to load existing context from database
  const result = await query<any>(
    `SELECT * FROM conversation_contexts WHERE conversation_id = $1`,
    [conversationId]
  )

  if (result.rows.length > 0) {
    const row = result.rows[0]
    return {
      conversationId: row.conversation_id,
      userId: row.user_id,
      platform: row.platform,
      currentIntent: row.current_intent,
      entities: row.context_data?.entities || {},
      history: row.context_data?.history || [],
      metadata: row.context_data?.metadata || {},
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
    }
  }

  // Create new context
  const newContext: ConversationContext = {
    conversationId,
    userId,
    platform,
    history: [],
    entities: {},
    metadata: {},
  }

  // Save to database
  await query(
    `INSERT INTO conversation_contexts (conversation_id, user_id, platform, context_data)
     VALUES ($1, $2, $3, $4)`,
    [conversationId, userId, platform, { history: [], entities: {}, metadata: {} }]
  )

  return newContext
}

export async function updateConversationContext(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  intent: ParsedIntent
): Promise<void> {
  // Load current context
  const result = await query<any>(
    `SELECT context_data FROM conversation_contexts WHERE conversation_id = $1`,
    [conversationId]
  )

  if (result.rows.length === 0) return

  const contextData = result.rows[0].context_data || {}

  // Update history (keep last 20 messages)
  const history: ConversationMessage[] = contextData.history || []
  history.push(
    { role: 'user', content: userMessage, timestamp: new Date() },
    { role: 'assistant', content: assistantResponse, timestamp: new Date() }
  )

  // Keep only last 20 messages to avoid context overflow
  if (history.length > 20) {
    history.splice(0, history.length - 20)
  }

  // Update entities
  const entities = { ...contextData.entities, ...intent.entities }

  // Save updated context
  await query(
    `UPDATE conversation_contexts
     SET current_intent = $1,
         context_data = $2,
         last_message = $3,
         last_response = $4,
         last_activity_at = NOW()
     WHERE conversation_id = $5`,
    [
      intent.intent,
      { history, entities, metadata: contextData.metadata },
      userMessage,
      assistantResponse,
      conversationId,
    ]
  )
}

export async function resetConversationContext(conversationId: string): Promise<void> {
  await query(
    `UPDATE conversation_contexts
     SET current_intent = NULL,
         context_data = $1,
         last_activity_at = NOW()
     WHERE conversation_id = $2`,
    [{ history: [], entities: {}, metadata: {} }, conversationId]
  )
}

// ============================================
// Intent Classification
// ============================================

export async function parseIntent(
  message: string,
  context: ConversationContext
): Promise<ParsedIntent> {
  const systemPrompt = `You are Wells AI, a conversational ERP assistant specialized in procurement and finance.

Your capabilities:
**Procurement**:
- Create/query/update purchase orders (POs)
- Check inventory levels and reorder items
- Find and evaluate suppliers
- Track supplier performance

**Finance**:
- Generate and query invoices
- Record and track payments
- Create financial reports (P&L, balance sheet, cash flow)
- Analyze spending and forecast budgets

**Your task**: Parse user messages and extract:
1. **Intent**: What the user wants to do (see intent list below)
2. **Entities**: Specific data mentioned (PO numbers, amounts, dates, names, products, etc.)
3. **Clarification**: Whether you need more info

**Intent Categories**:

Procurement (Basic):
- create_po: User wants to create a purchase order
- query_po: User wants to see/find POs
- update_po: User wants to modify a PO
- approve_po: User wants to approve a single PO
- reject_po: User wants to reject a single PO
- check_inventory: User wants to see inventory levels
- reorder_item: User wants to reorder a specific item
- update_inventory: User wants to adjust inventory quantities
- find_supplier: User wants to find suppliers
- supplier_performance: User wants supplier metrics
- compare_suppliers: User wants to compare multiple suppliers
- add_supplier: User wants to add a new supplier

Procurement (Advanced - Batch Operations):
- batch_approve_pos: User wants to approve MULTIPLE POs at once (e.g., "approve all POs under $5000")
- batch_reject_pos: User wants to reject MULTIPLE POs at once
- batch_reorder: User wants to reorder ALL low-stock items (e.g., "reorder all low stock items")
- batch_update_inventory: User wants to adjust inventory for MULTIPLE items
- recommend_supplier: User wants AI to recommend the best supplier (e.g., "which supplier should I use?")

Finance:
- generate_invoice: User wants to create an invoice
- query_invoice: User wants to see/find invoices
- record_payment: User wants to log a payment
- query_payment: User wants to see payment info
- get_report: User wants a financial report
- check_budget: User wants budget status
- analyze_spend: User wants spending analysis
- forecast: User wants financial forecasting

General:
- help: User needs help/guidance
- status: User wants a summary/dashboard
- greeting: User is greeting you

**Entity Extraction Examples**:
- "Create a PO for 100 chairs from Acme Corp, budget $5000, need by Dec 15"
  → entities: {supplier: "Acme Corp", product: "chairs", quantity: 100, budget: 5000, date: "2025-12-15"}

- "Show me all POs over $10k pending approval"
  → entities: {status: "pending_approval", minAmount: 10000}

- "What's in stock for printer paper?"
  → entities: {product: "printer paper"}

**Respond ONLY with valid JSON** (no markdown, no explanation):
{
  "intent": "create_po",
  "entities": {
    "supplier": "Acme Corp",
    "product": "office chairs",
    "quantity": 100,
    "budget": 5000,
    "date": "2025-12-15"
  },
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": null,
  "suggestedActions": ["approve", "modify_quantity", "change_supplier"]
}

**Clarification Rules**:
- If intent is unclear, set needsClarification: true
- Ask ONE specific question to clarify
- Be conversational but concise

**Context Awareness**:
${context.currentIntent ? `Previous intent: ${context.currentIntent}` : ''}
${Object.keys(context.entities || {}).length > 0 ? `Known entities: ${JSON.stringify(context.entities)}` : ''}
${context.history.length > 0 ? `Recent history: ${context.history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\\n')}` : ''}`

  try {
    const response = await (anthropic as any).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...context.history.map(m => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      // Extract JSON from response (in case Claude wraps it in markdown)
      let jsonText = content.text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '')
      }

      const parsed = JSON.parse(jsonText)
      return {
        intent: parsed.intent || INTENTS.UNKNOWN,
        entities: parsed.entities || {},
        confidence: parsed.confidence || 0.5,
        needsClarification: parsed.needsClarification || false,
        clarificationQuestion: parsed.clarificationQuestion,
        suggestedActions: parsed.suggestedActions || [],
      }
    }

    throw new Error('Invalid response format from AI')
  } catch (error) {
    console.error('[Conversational Engine] Intent parsing error:', error)

    // Fallback: return unknown intent
    return {
      intent: INTENTS.UNKNOWN,
      entities: {},
      confidence: 0,
      needsClarification: true,
      clarificationQuestion: "I'm not sure I understood that. Could you rephrase? For example: 'Create a PO for 100 chairs from Acme Corp' or 'Show pending invoices'",
      suggestedActions: [],
    }
  }
}

// ============================================
// Response Generation
// ============================================

export async function generateResponse(
  intent: ParsedIntent,
  executionResult: ExecutionResult,
  context: ConversationContext
): Promise<string> {
  // Use centralized system prompt with Wells Onyx Voice
  const systemPrompt = generateResponseSystemPrompt(context.platform)

  try {
    const response = await (anthropic as any).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Intent: ${intent.intent}
Entities: ${JSON.stringify(intent.entities)}
Success: ${executionResult.success}
${executionResult.success ? `Result: ${JSON.stringify(executionResult.data)}` : `Error: ${executionResult.error}`}

Generate a friendly, helpful response to the user.`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }

    return 'Action completed.'
  } catch (error) {
    console.error('[Conversational Engine] Response generation error:', error)

    // Fallback response
    if (executionResult.success) {
      return `✅ Done! ${JSON.stringify(executionResult.data)}`
    } else {
      return `❌ Something went wrong: ${executionResult.error}`
    }
  }
}

// ============================================
// Intent Execution
// ============================================

export async function executeIntent(
  intent: ParsedIntent,
  userId: string
): Promise<ExecutionResult> {
  try {
    console.log('[Conversational Engine] Executing intent:', intent.intent)

    // Route to appropriate handler based on intent
    switch (intent.intent) {
      // ===== Purchase Orders =====
      case INTENTS.CREATE_PO:
        return await POHandler.createPO(intent.entities, userId)

      case INTENTS.QUERY_PO:
        return await POHandler.queryPOs(intent.entities, userId)

      case INTENTS.UPDATE_PO:
        return await POHandler.updatePO(intent.entities, userId)

      case INTENTS.APPROVE_PO:
        return await POHandler.approvePO(intent.entities, userId)

      case INTENTS.REJECT_PO:
        return await POHandler.rejectPO(intent.entities, userId)

      // ===== Inventory =====
      case INTENTS.CHECK_INVENTORY:
        return await InventoryHandler.checkInventory(intent.entities, userId)

      case INTENTS.REORDER_ITEM:
        return await InventoryHandler.reorderItem(intent.entities, userId)

      case INTENTS.UPDATE_INVENTORY:
        return await InventoryHandler.updateInventory(intent.entities, userId)

      // ===== Suppliers =====
      case INTENTS.FIND_SUPPLIER:
        return await SupplierHandler.findSuppliers(intent.entities, userId)

      case INTENTS.SUPPLIER_PERFORMANCE:
        return await SupplierHandler.getSupplierPerformance(intent.entities, userId)

      case INTENTS.COMPARE_SUPPLIERS:
        return await SupplierHandler.compareSuppliers(intent.entities, userId)

      case INTENTS.ADD_SUPPLIER:
        return await SupplierHandler.addSupplier(intent.entities, userId)

      // ===== Batch Operations (Week 15-16 Advanced Features) =====
      case INTENTS.BATCH_APPROVE_POS:
        return await BatchOps.batchApprovePOs(intent.entities, userId)

      case INTENTS.BATCH_REJECT_POS:
        return await BatchOps.batchRejectPOs(intent.entities, userId)

      case INTENTS.BATCH_REORDER:
        return await BatchOps.batchReorderLowStock(intent.entities, userId)

      case INTENTS.BATCH_UPDATE_INVENTORY:
        return await BatchOps.batchUpdateInventory(intent.entities, userId)

      case INTENTS.RECOMMEND_SUPPLIER:
        return await BatchOps.recommendSupplier(intent.entities, userId)

      // ===== Finance (Week 17-20) =====
      case INTENTS.GENERATE_INVOICE:
        return await InvoiceHandler.generateInvoice(intent.entities, userId)

      case INTENTS.QUERY_INVOICE:
        return await InvoiceHandler.queryInvoices(intent.entities, userId)

      case INTENTS.RECORD_PAYMENT:
        return await PaymentHandler.recordPayment(intent.entities, userId)

      case INTENTS.QUERY_PAYMENT:
        return await PaymentHandler.queryPayments(intent.entities, userId)

      case INTENTS.GET_REPORT:
        // Determine which report to generate based on entities
        const reportType = intent.entities.reportType || intent.entities.type || 'p_and_l'

        if (reportType === 'p_and_l' || reportType === 'profit_and_loss' || reportType === 'pl') {
          return await ReportHandler.generateProfitAndLoss(intent.entities, userId)
        } else if (reportType === 'cash_flow') {
          return await ReportHandler.generateCashFlow(intent.entities, userId)
        } else if (reportType === 'ar_aging') {
          return await ReportHandler.getARAge(intent.entities, userId)
        } else {
          return await ReportHandler.generateProfitAndLoss(intent.entities, userId)
        }

      case INTENTS.CHECK_BUDGET:
        return await ReportHandler.analyzeBudgetVsActual(intent.entities, userId)

      case INTENTS.ANALYZE_SPEND:
        return await ReportHandler.analyzeSpending(intent.entities, userId)

      case INTENTS.FORECAST:
        return await ReportHandler.forecastCashFlow(intent.entities, userId)

      // ===== General =====
      case INTENTS.HELP:
        return {
          success: true,
          data: {
            message: `I can help you with:

**Procurement**:
• Create, query, update, approve purchase orders
• Batch approve/reject multiple POs
• Check inventory levels and reorder items
• Find suppliers and check their performance
• Get AI-powered supplier recommendations
• Compare suppliers side-by-side

**Finance** ✨ NEW:
• Generate and query invoices
• Record and track payments
• Create financial reports (P&L, cash flow, AR aging)
• Analyze spending patterns
• Budget vs actual analysis
• Forecast cash flow

**Examples**:
• "Create a PO for 100 chairs from Acme Corp for $5000"
• "Approve all POs under $5000"
• "Generate invoice for customer ABC"
• "Show me P&L for last month"
• "Forecast cash flow for next 3 months"

What would you like to do?`,
          },
        }

      case INTENTS.STATUS:
        // Get comprehensive status (procurement + finance)
        const [poSummary, inventorySummary, supplierSummary, invoiceSummary, paymentSummary] =
          await Promise.all([
            POHandler.getPOSummary(userId),
            InventoryHandler.getInventorySummary(userId),
            SupplierHandler.getSupplierSummary(userId),
            InvoiceHandler.getInvoiceSummary(userId),
            PaymentHandler.getPaymentSummary(userId),
          ])

        return {
          success: true,
          data: {
            procurement: {
              po: poSummary.data,
              inventory: inventorySummary.data,
              suppliers: supplierSummary.data,
            },
            finance: {
              invoices: invoiceSummary.data,
              payments: paymentSummary.data,
            },
          },
        }

      case INTENTS.GREETING:
        return {
          success: true,
          data: {
            message: `Hi! I'm Wells AI, your conversational ERP assistant.

I can help you manage procurement and finance through simple conversations.

Try saying things like:
• "Create a PO for 100 chairs from Acme Corp for $5000"
• "What's my inventory status?"
• "Show me suppliers in Texas"
• "Approve PO-12345"

What can I help you with today?`,
          },
        }

      case INTENTS.UNKNOWN:
      default:
        return {
          success: false,
          error: `I'm not sure how to handle that request. Try:
• Creating a purchase order
• Checking inventory
• Finding suppliers
• Or ask for help`,
        }
    }
  } catch (error) {
    console.error('[Conversational Engine] Intent execution error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute request',
    }
  }
}

// ============================================
// Conversation Utilities
// ============================================

export function generateConversationId(userId: string, platform: string): string {
  return `conv_${platform}_${userId}_${Date.now()}`
}

export async function summarizeConversation(context: ConversationContext): Promise<string> {
  if (context.history.length === 0) {
    return 'No conversation history yet.'
  }

  const systemPrompt = `Summarize this conversation in 2-3 sentences. Focus on:
1. What the user was trying to do
2. What was accomplished
3. What might be needed next`

  try {
    const response = await (anthropic as any).messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: systemPrompt,
      messages: context.history.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }

    return 'Conversation summary unavailable.'
  } catch (error) {
    console.error('[Conversational Engine] Summarization error:', error)
    return 'Conversation summary unavailable.'
  }
}

export async function suggestFollowUpActions(
  intent: string,
  result: any
): Promise<string[]> {
  const suggestions: Record<string, string[]> = {
    [INTENTS.CREATE_PO]: [
      'Check PO status',
      'View all pending POs',
      'Check inventory for other items',
    ],
    [INTENTS.QUERY_PO]: [
      'Review specific PO',
      'Approve pending POs',
      'Export PO list',
    ],
    [INTENTS.CHECK_INVENTORY]: [
      'Reorder low stock items',
      'View reorder history',
      'Set reorder alerts',
    ],
    [INTENTS.GENERATE_INVOICE]: [
      'Send invoice to customer',
      'Check payment status',
      'View all invoices',
    ],
    [INTENTS.GET_REPORT]: [
      'Export report',
      'Schedule recurring report',
      'Compare to previous period',
    ],
  }

  return suggestions[intent] || ['Ask me anything else!']
}

// ============================================
// Validation
// ============================================

export function validateEntities(intent: string, entities: Record<string, any>): {
  valid: boolean
  missing: string[]
  errors: string[]
} {
  const requiredFields: Record<string, string[]> = {
    [INTENTS.CREATE_PO]: ['supplier', 'product'],
    [INTENTS.UPDATE_PO]: ['poId'],
    [INTENTS.APPROVE_PO]: ['poId'],
    [INTENTS.CHECK_INVENTORY]: ['product'],
    [INTENTS.GENERATE_INVOICE]: ['customerId', 'amount'],
    [INTENTS.RECORD_PAYMENT]: ['amount'],
  }

  const required = requiredFields[intent] || []
  const missing: string[] = []
  const errors: string[] = []

  for (const field of required) {
    if (!entities[field]) {
      missing.push(field)
    }
  }

  // Validate data types
  if (entities.amount && typeof entities.amount !== 'number') {
    errors.push('Amount must be a number')
  }

  if (entities.quantity && typeof entities.quantity !== 'number') {
    errors.push('Quantity must be a number')
  }

  if (entities.date) {
    const date = new Date(entities.date)
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format')
    }
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  }
}

// ============================================
// Exports
// ============================================

export default {
  INTENTS,
  parseIntent,
  executeIntent,
  generateResponse,
  getConversationContext,
  updateConversationContext,
  resetConversationContext,
  generateConversationId,
  summarizeConversation,
  suggestFollowUpActions,
  validateEntities,
}
