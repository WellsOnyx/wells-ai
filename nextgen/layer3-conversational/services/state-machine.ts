/**
 * Layer 3: Conversation State Machine
 *
 * Manages the state of conversational ERP interactions.
 * Handles transitions between states based on user input and system events.
 */

import type {
  ConversationState,
  ConversationContext,
  ConversationTurn,
  ErpIntent,
  ExtractedEntities,
  PendingAction,
  StateTransition,
  STATE_TRANSITIONS,
  FIELD_PROMPTS,
  INTENT_DEFINITIONS,
} from '../types'
import { classifyIntent, getMissingFields } from './intent-classifier'

// ============================================================================
// SESSION STORAGE
// ============================================================================

const sessionsStore: Map<string, ConversationContext> = new Map()

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const MAX_HISTORY_LENGTH = 20

// ============================================================================
// STATE MACHINE
// ============================================================================

export class ConversationStateMachine {
  private context: ConversationContext

  constructor(sessionId: string, accountId: string, userId?: string) {
    // Try to resume existing session
    const existing = sessionsStore.get(sessionId)

    if (existing && !this.isSessionExpired(existing)) {
      this.context = existing
      this.context.lastActivityAt = new Date().toISOString()
    } else {
      // Create new session
      this.context = {
        sessionId,
        accountId,
        userId,
        state: 'idle',
        entities: {},
        missingFields: [],
        history: [],
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      }
    }
  }

  private isSessionExpired(context: ConversationContext): boolean {
    const lastActivity = new Date(context.lastActivityAt).getTime()
    return Date.now() - lastActivity > SESSION_TIMEOUT_MS
  }

  getContext(): ConversationContext {
    return { ...this.context }
  }

  getState(): ConversationState {
    return this.context.state
  }

  /**
   * Process user input and transition state accordingly
   */
  processInput(message: string): {
    newState: ConversationState
    response: string
    missingFields: string[]
    pendingAction?: PendingAction
    quickReplies?: string[]
  } {
    // Add user turn to history
    this.addToHistory('user', message)

    // Handle special commands
    if (this.isSpecialCommand(message)) {
      return this.handleSpecialCommand(message)
    }

    // Process based on current state
    switch (this.context.state) {
      case 'idle':
        return this.handleIdleState(message)

      case 'gathering_info':
        return this.handleGatheringInfoState(message)

      case 'confirming':
        return this.handleConfirmingState(message)

      case 'awaiting_authorization':
        return this.handleAuthorizationState(message)

      case 'completed':
      case 'error':
        // Reset and process as new
        this.reset()
        return this.handleIdleState(message)

      default:
        return this.handleIdleState(message)
    }
  }

  private handleIdleState(message: string): ReturnType<ConversationStateMachine['processInput']> {
    const { intent, confidence, entities } = classifyIntent(message)

    if (intent === 'unknown' || confidence === 'low') {
      return {
        newState: 'idle',
        response: "I'm not sure what you'd like to do. I can help you with:\n" +
          "• Create or search vendors\n" +
          "• Create or approve purchase orders\n" +
          "• View or approve invoices\n" +
          "• Make payments via GRAIN, ACH, or wire\n" +
          "• Check balances and ledgers\n\n" +
          "What would you like to do?",
        missingFields: [],
        quickReplies: [
          'Check my balance',
          'Show overdue invoices',
          'Create a PO',
          'Make a payment',
        ],
      }
    }

    // Set current intent and entities
    this.context.currentIntent = intent
    this.context.intentConfidence = confidence
    this.context.entities = { ...this.context.entities, ...entities }

    // Check if this is a query intent (no creation/modification)
    if (this.isQueryIntent(intent)) {
      return this.executeQuery(intent, this.context.entities)
    }

    // Check for missing required fields
    const missingFields = getMissingFields(intent, this.context.entities, INTENT_DEFINITIONS as any)
    this.context.missingFields = missingFields

    if (missingFields.length > 0) {
      this.transition('gathering_info')
      return {
        newState: 'gathering_info',
        response: this.buildMissingFieldsPrompt(missingFields),
        missingFields,
        quickReplies: this.getSuggestedValues(missingFields[0]),
      }
    }

    // All required fields present - move to confirmation
    this.transition('confirming')
    return {
      newState: 'confirming',
      response: this.buildConfirmationMessage(intent, this.context.entities),
      missingFields: [],
      quickReplies: ['Yes, proceed', 'No, cancel', 'Make changes'],
    }
  }

  private handleGatheringInfoState(message: string): ReturnType<ConversationStateMachine['processInput']> {
    // Extract entities from the new message
    const { entities: newEntities } = classifyIntent(message)

    // Merge with existing entities
    this.context.entities = { ...this.context.entities, ...newEntities }

    // Handle direct value inputs for missing fields
    if (this.context.missingFields.length > 0) {
      const currentField = this.context.missingFields[0]
      this.setEntityFromDirectInput(currentField, message)
    }

    // Recheck missing fields
    const missingFields = getMissingFields(
      this.context.currentIntent!,
      this.context.entities,
      INTENT_DEFINITIONS as any
    )
    this.context.missingFields = missingFields

    if (missingFields.length > 0) {
      return {
        newState: 'gathering_info',
        response: this.buildMissingFieldsPrompt(missingFields),
        missingFields,
        quickReplies: this.getSuggestedValues(missingFields[0]),
      }
    }

    // All fields gathered - move to confirmation
    this.transition('confirming')
    return {
      newState: 'confirming',
      response: this.buildConfirmationMessage(this.context.currentIntent!, this.context.entities),
      missingFields: [],
      quickReplies: ['Yes, proceed', 'No, cancel', 'Make changes'],
    }
  }

  private handleConfirmingState(message: string): ReturnType<ConversationStateMachine['processInput']> {
    const normalized = message.toLowerCase().trim()

    // Check for confirmation
    if (normalized.includes('yes') || normalized.includes('proceed') || normalized.includes('confirm')) {
      const definition = (INTENT_DEFINITIONS as any[]).find(d => d.intent === this.context.currentIntent)

      if (definition?.authorizationRequired) {
        this.transition('awaiting_authorization')
        this.context.pendingAction = {
          type: this.getActionType(this.context.currentIntent!),
          resource: this.getResourceType(this.context.currentIntent!),
          data: { ...this.context.entities },
          requiresAuthorization: true,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        }

        return {
          newState: 'awaiting_authorization',
          response: '⚠️ This action requires authorization.\n\n' +
            'Please confirm you want to:\n' +
            this.buildActionSummary(this.context.currentIntent!, this.context.entities) +
            '\n\nType "authorize" to proceed.',
          missingFields: [],
          pendingAction: this.context.pendingAction,
          quickReplies: ['Authorize', 'Cancel'],
        }
      }

      // Execute action directly
      return this.executeAction()
    }

    // Check for cancellation
    if (normalized.includes('no') || normalized.includes('cancel')) {
      this.reset()
      return {
        newState: 'idle',
        response: 'Action cancelled. What else can I help you with?',
        missingFields: [],
        quickReplies: ['Check my balance', 'Show overdue invoices'],
      }
    }

    // Check for modification request
    if (normalized.includes('change') || normalized.includes('modify') || normalized.includes('edit')) {
      this.transition('gathering_info')
      return {
        newState: 'gathering_info',
        response: 'What would you like to change?',
        missingFields: Object.keys(this.context.entities),
      }
    }

    // Unclear response
    return {
      newState: 'confirming',
      response: 'Please confirm:\n' +
        this.buildConfirmationMessage(this.context.currentIntent!, this.context.entities) +
        '\n\nWould you like to proceed? (Yes/No)',
      missingFields: [],
      quickReplies: ['Yes, proceed', 'No, cancel'],
    }
  }

  private handleAuthorizationState(message: string): ReturnType<ConversationStateMachine['processInput']> {
    const normalized = message.toLowerCase().trim()

    if (normalized.includes('authorize') || normalized.includes('approved') || normalized.includes('yes')) {
      return this.executeAction()
    }

    if (normalized.includes('cancel') || normalized.includes('deny') || normalized.includes('no')) {
      this.reset()
      return {
        newState: 'idle',
        response: 'Authorization denied. Action cancelled.',
        missingFields: [],
      }
    }

    return {
      newState: 'awaiting_authorization',
      response: 'Please type "authorize" to confirm or "cancel" to abort.',
      missingFields: [],
      pendingAction: this.context.pendingAction,
      quickReplies: ['Authorize', 'Cancel'],
    }
  }

  private executeQuery(intent: ErpIntent, entities: ExtractedEntities): ReturnType<ConversationStateMachine['processInput']> {
    // Execute query and return results
    const result = this.simulateQueryExecution(intent, entities)

    this.transition('completed')
    this.addToHistory('assistant', result.response)

    return {
      newState: 'completed',
      response: result.response,
      missingFields: [],
      quickReplies: result.quickReplies,
    }
  }

  private executeAction(): ReturnType<ConversationStateMachine['processInput']> {
    this.transition('processing')

    // Simulate action execution
    const result = this.simulateActionExecution(this.context.currentIntent!, this.context.entities)

    if (result.success) {
      this.transition('completed')
      this.addToHistory('assistant', result.response)

      // Clear pending action
      this.context.pendingAction = undefined

      return {
        newState: 'completed',
        response: result.response,
        missingFields: [],
        quickReplies: result.quickReplies,
      }
    } else {
      this.transition('error')
      return {
        newState: 'error',
        response: `❌ ${result.response}`,
        missingFields: [],
        quickReplies: ['Try again', 'Cancel'],
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private transition(newState: ConversationState): void {
    this.context.state = newState
    this.context.lastActivityAt = new Date().toISOString()
    this.saveSession()
  }

  private reset(): void {
    this.context.state = 'idle'
    this.context.currentIntent = undefined
    this.context.intentConfidence = undefined
    this.context.entities = {}
    this.context.missingFields = []
    this.context.pendingAction = undefined
    this.saveSession()
  }

  private saveSession(): void {
    sessionsStore.set(this.context.sessionId, this.context)
  }

  private addToHistory(role: 'user' | 'assistant', content: string): void {
    this.context.history.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      intent: this.context.currentIntent,
      entities: role === 'user' ? this.context.entities : undefined,
    })

    // Trim history if too long
    if (this.context.history.length > MAX_HISTORY_LENGTH) {
      this.context.history = this.context.history.slice(-MAX_HISTORY_LENGTH)
    }
  }

  private isSpecialCommand(message: string): boolean {
    const commands = ['cancel', 'reset', 'help', 'start over', 'nevermind']
    return commands.some(cmd => message.toLowerCase().trim() === cmd)
  }

  private handleSpecialCommand(message: string): ReturnType<ConversationStateMachine['processInput']> {
    const cmd = message.toLowerCase().trim()

    if (cmd === 'help') {
      return {
        newState: this.context.state,
        response: '**Available Commands:**\n\n' +
          '• **Vendors:** create vendor, search vendors, vendor details\n' +
          '• **Purchase Orders:** create PO, approve PO, PO status\n' +
          '• **Invoices:** overdue invoices, approve invoice, invoice status\n' +
          '• **Payments:** pay [amount] to [vendor], authorize payment\n' +
          '• **Ledger:** balance, float balance, yield summary, trial balance\n\n' +
          'You can also type "cancel" to abort current action.',
        missingFields: [],
      }
    }

    // Cancel/reset commands
    this.reset()
    return {
      newState: 'idle',
      response: 'Okay, starting fresh. What would you like to do?',
      missingFields: [],
      quickReplies: ['Check my balance', 'Show overdue invoices', 'Create a PO'],
    }
  }

  private isQueryIntent(intent: ErpIntent): boolean {
    const queryIntents: ErpIntent[] = [
      'search_vendor', 'get_vendor_details',
      'search_po', 'get_po_status',
      'search_invoices', 'get_invoice_status', 'get_overdue_invoices',
      'get_payment_status',
      'get_balance', 'get_ledger_summary', 'get_trial_balance',
      'get_float_balance', 'get_yield_summary',
      'get_escrow_status',
      'get_summary',
    ]
    return queryIntents.includes(intent)
  }

  private buildMissingFieldsPrompt(missingFields: string[]): string {
    const prompts = missingFields.map(field => FIELD_PROMPTS[field] || `What is the ${field}?`)
    return prompts[0] // Ask for one field at a time
  }

  private getSuggestedValues(field: string): string[] {
    switch (field) {
      case 'paymentMethod':
        return ['GRAIN (instant)', 'ACH', 'Wire', 'Check']
      case 'paymentTerms':
        return ['Net 30', 'Net 60', '2/10 Net 30']
      default:
        return []
    }
  }

  private setEntityFromDirectInput(field: string, value: string): void {
    const trimmed = value.trim()

    switch (field) {
      case 'vendorName':
        this.context.entities.vendorName = trimmed
        break
      case 'amount':
        const amount = parseFloat(trimmed.replace(/[$,]/g, ''))
        if (!isNaN(amount)) this.context.entities.amount = amount
        break
      case 'quantity':
        const qty = parseInt(trimmed)
        if (!isNaN(qty)) this.context.entities.quantity = qty
        break
      case 'paymentMethod':
        const method = trimmed.toLowerCase()
        if (['grain', 'ach', 'wire', 'check'].includes(method)) {
          this.context.entities.paymentMethod = method as any
        }
        break
      default:
        (this.context.entities as any)[field] = trimmed
    }
  }

  private buildConfirmationMessage(intent: ErpIntent, entities: ExtractedEntities): string {
    let message = '**Please confirm:**\n\n'

    switch (intent) {
      case 'create_vendor':
        message += `Create new vendor:\n` +
          `• Name: ${entities.vendorName}\n` +
          (entities.contactEmail ? `• Email: ${entities.contactEmail}\n` : '') +
          (entities.paymentMethod ? `• Payment: ${entities.paymentMethod}\n` : '')
        break

      case 'create_po':
        message += `Create Purchase Order:\n` +
          `• Vendor: ${entities.vendorName || entities.vendorId}\n` +
          (entities.lineItems ? `• Items: ${entities.lineItems.length} line(s)\n` : '') +
          (entities.amount ? `• Total: $${entities.amount.toLocaleString()}\n` : '')
        break

      case 'create_payment':
        message += `Create Payment:\n` +
          `• To: ${entities.vendorName || entities.vendorId}\n` +
          `• Amount: $${(entities.amount || 0).toLocaleString()}\n` +
          `• Method: ${entities.paymentMethod || 'Not specified'}\n`
        break

      case 'approve_po':
        message += `Approve PO: ${entities.poNumber}`
        break

      case 'approve_invoice':
        message += `Approve Invoice: ${entities.invoiceNumber}`
        break

      default:
        message += JSON.stringify(entities, null, 2)
    }

    return message
  }

  private buildActionSummary(intent: ErpIntent, entities: ExtractedEntities): string {
    switch (intent) {
      case 'create_payment':
        return `• Send $${(entities.amount || 0).toLocaleString()} to ${entities.vendorName || entities.vendorId} via ${entities.paymentMethod || 'default method'}`
      case 'approve_po':
        return `• Approve purchase order ${entities.poNumber}`
      case 'approve_invoice':
        return `• Approve invoice ${entities.invoiceNumber} for payment`
      default:
        return `• Execute ${intent}`
    }
  }

  private getActionType(intent: ErpIntent): PendingAction['type'] {
    if (intent.startsWith('create_')) return 'create'
    if (intent.startsWith('update_')) return 'update'
    if (intent.startsWith('approve_') || intent.startsWith('authorize_')) return 'approve'
    return 'create'
  }

  private getResourceType(intent: ErpIntent): PendingAction['resource'] {
    if (intent.includes('vendor')) return 'vendor'
    if (intent.includes('po') || intent.includes('purchase')) return 'purchase_order'
    if (intent.includes('invoice')) return 'invoice'
    if (intent.includes('payment')) return 'payment'
    if (intent.includes('escrow')) return 'escrow'
    return 'vendor'
  }

  // Simulated execution methods (would call actual APIs in production)
  private simulateQueryExecution(intent: ErpIntent, entities: ExtractedEntities): { response: string; quickReplies?: string[] } {
    switch (intent) {
      case 'get_balance':
        return {
          response: '**Account Balance:**\n\n' +
            '• GRAIN Balance: **85,000.00 GRAIN** (~$85,000 USD)\n' +
            '• Credit Line Available: $100,000\n' +
            '• Pending Payments: $15,750\n\n' +
            'Your GRAIN is earning 5% APY in the float pool.',
          quickReplies: ['Make a payment', 'View transactions', 'Yield summary'],
        }

      case 'get_overdue_invoices':
        return {
          response: '**Overdue Invoices:**\n\n' +
            '1. **INV-2024-05002** - TechSolutions Inc\n' +
            '   Amount: $7,500.00 | Due: Jan 14, 2024\n' +
            '   Days overdue: 21\n\n' +
            'Total overdue: **$7,500.00**',
          quickReplies: ['Pay this invoice', 'View details', 'Dispute invoice'],
        }

      case 'get_float_balance':
        return {
          response: '**Float Pool Balance:**\n\n' +
            '• Current Balance: **$84,250.00**\n' +
            '• Payments in Flight: $15,750.00\n' +
            '• APY: 5.0%\n' +
            '• This Month\'s Yield: $350.68',
          quickReplies: ['Add funds', 'View transactions'],
        }

      case 'get_yield_summary':
        return {
          response: '**Yield Summary:**\n\n' +
            '• Total Yield Earned: **$410.96**\n' +
            '• Current APY: 5.0%\n' +
            '• Principal Amount: $100,000\n\n' +
            'Period: January 2024',
          quickReplies: ['Withdraw yield', 'View history'],
        }

      case 'get_summary':
        return {
          response: '**Financial Summary:**\n\n' +
            '📊 **Balances**\n' +
            '• GRAIN: $85,000.00\n' +
            '• Float Pool: $84,250.00\n\n' +
            '📋 **Open Items**\n' +
            '• Open POs: 3 ($60,250)\n' +
            '• Unpaid Invoices: 2 ($23,250)\n' +
            '• Overdue: 1 ($7,500)\n\n' +
            '💰 **This Month**\n' +
            '• Payments Made: $12,340\n' +
            '• Yield Earned: $410.96',
          quickReplies: ['Pay overdue invoice', 'View open POs', 'Make a payment'],
        }

      default:
        return {
          response: `Query "${intent}" executed. Results would be displayed here.`,
          quickReplies: [],
        }
    }
  }

  private simulateActionExecution(intent: ErpIntent, entities: ExtractedEntities): { success: boolean; response: string; quickReplies?: string[] } {
    switch (intent) {
      case 'create_vendor':
        return {
          success: true,
          response: `✅ **Vendor Created**\n\n` +
            `• Vendor Code: V-${entities.vendorName?.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}\n` +
            `• Name: ${entities.vendorName}\n` +
            `• Status: Pending Verification\n\n` +
            'The vendor is ready for use once verified.',
          quickReplies: ['Create a PO', 'Add another vendor'],
        }

      case 'create_po':
        const poNumber = `PO-2024-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`
        return {
          success: true,
          response: `✅ **Purchase Order Created**\n\n` +
            `• PO Number: ${poNumber}\n` +
            `• Vendor: ${entities.vendorName || entities.vendorId}\n` +
            `• Total: $${(entities.amount || 0).toLocaleString()}\n` +
            `• Status: Draft\n\n` +
            'Would you like to submit this PO for approval?',
          quickReplies: ['Submit for approval', 'Edit PO', 'Create another'],
        }

      case 'create_payment':
        const paymentNumber = `PAY-2024-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`
        return {
          success: true,
          response: `✅ **Payment Completed**\n\n` +
            `• Payment #: ${paymentNumber}\n` +
            `• Amount: $${(entities.amount || 0).toLocaleString()}\n` +
            `• Method: ${entities.paymentMethod?.toUpperCase() || 'GRAIN'}\n` +
            `• Status: ${entities.paymentMethod === 'grain' ? 'Settled' : 'Processing'}\n\n` +
            (entities.paymentMethod === 'grain'
              ? '⚡ Instant settlement via GRAIN!'
              : 'Expected settlement: 1-3 business days'),
          quickReplies: ['Make another payment', 'View balance'],
        }

      case 'approve_po':
        return {
          success: true,
          response: `✅ **PO Approved**\n\n` +
            `• PO Number: ${entities.poNumber}\n` +
            `• Status: Approved\n` +
            `• Next: Send to vendor`,
          quickReplies: ['Send to vendor', 'View PO'],
        }

      case 'approve_invoice':
        return {
          success: true,
          response: `✅ **Invoice Approved**\n\n` +
            `• Invoice: ${entities.invoiceNumber}\n` +
            `• Status: Approved for Payment\n\n` +
            'Ready to schedule payment.',
          quickReplies: ['Pay now', 'Schedule payment'],
        }

      default:
        return {
          success: true,
          response: `✅ Action "${intent}" completed successfully.`,
          quickReplies: [],
        }
    }
  }
}

// Factory function
export function createConversation(sessionId: string, accountId: string, userId?: string): ConversationStateMachine {
  return new ConversationStateMachine(sessionId, accountId, userId)
}
