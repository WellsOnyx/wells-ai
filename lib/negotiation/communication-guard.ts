/**
 * Communication Guard - AI-to-AI Communication Enforcement
 *
 * Ensures all inter-party communication goes through AI agents.
 * Humans NEVER talk directly to each other.
 *
 * FLOW (ENFORCED):
 * Buyer Human -> Buyer AI -> Seller AI -> Seller Human
 * Seller Human -> Seller AI -> Buyer AI -> Buyer Human
 *
 * BLOCKED:
 * Buyer Human -> Seller Human (BLOCKED)
 * Any direct party-to-party communication (BLOCKED)
 *
 * This module provides:
 * - Message interception and validation
 * - AI translation layer for human messages
 * - Audit logging for bypass attempts
 * - Guardrail enforcement at every communication point
 *
 * @module lib/negotiation/communication-guard
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';
import { NegotiationProtocolMessage, AgentType, NegotiationTerms } from './protocol';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message origin - where the message came from
 */
export type MessageOrigin = 'buyer_human' | 'buyer_ai' | 'seller_human' | 'seller_ai' | 'system';

/**
 * Message destination - where the message is intended to go
 */
export type MessageDestination = 'buyer_human' | 'buyer_ai' | 'seller_human' | 'seller_ai';

/**
 * Communication channel validation result
 */
export interface CommunicationValidation {
  /** Whether the communication is allowed */
  allowed: boolean;

  /** Reason for blocking if not allowed */
  blockReason?: string;

  /** The properly routed message if transformation needed */
  routedMessage?: TranslatedMessage;

  /** Original message preserved for audit */
  originalMessage?: string;

  /** Audit log ID for this validation */
  auditLogId?: string;
}

/**
 * A message that has been translated by AI for inter-party communication
 */
export interface TranslatedMessage {
  /** Original human input */
  humanInput: string;

  /** AI-translated professional version */
  aiTranslation: string;

  /** Key points extracted */
  keyPoints: string[];

  /** Emotional content detected and filtered */
  emotionalContentFiltered: boolean;

  /** Position extracted (e.g., max price, requirements) */
  extractedPosition?: NegotiationPosition;

  /** Confidence in translation (0-100) */
  confidence: number;
}

/**
 * Extracted negotiation position from human message
 */
export interface NegotiationPosition {
  /** Max/min price mentioned */
  priceLimit?: number;

  /** Firm stance or flexible */
  firmness: 'firm' | 'flexible' | 'neutral';

  /** Key demands */
  demands: string[];

  /** Acceptable compromises mentioned */
  acceptableCompromises: string[];

  /** Walk-away conditions */
  walkAwayConditions?: string[];
}

/**
 * Human instruction to their AI
 */
export interface HumanInstruction {
  /** Original instruction text */
  instruction: string;

  /** Parsed intent */
  intent: HumanInstructionIntent;

  /** Specific targets or values mentioned */
  targets: InstructionTarget[];

  /** Tone/approach preference */
  preferredApproach?: 'aggressive' | 'balanced' | 'conservative';

  /** Urgency level */
  urgency?: 'low' | 'medium' | 'high';
}

export type HumanInstructionIntent =
  | 'push_back_price'
  | 'push_back_terms'
  | 'accept_offer'
  | 'reject_offer'
  | 'request_info'
  | 'modify_constraints'
  | 'set_limit'
  | 'escalate'
  | 'pause'
  | 'proceed'
  | 'unknown';

export interface InstructionTarget {
  type: 'price' | 'lead_time' | 'quantity' | 'payment_terms' | 'warranty' | 'general';
  value?: number | string;
  direction?: 'increase' | 'decrease' | 'maintain';
}

/**
 * Communication bypass attempt for audit logging
 */
export interface BypassAttempt {
  id: string;
  sessionId: string;
  timestamp: string;
  origin: MessageOrigin;
  intendedDestination: MessageDestination;
  messageContent: string;
  blockReason: string;
  userId?: string;
  ipAddress?: string;
}

/**
 * AI Agent state for a party in negotiation
 */
export interface AIAgentState {
  /** Party type */
  partyType: 'buyer' | 'seller';

  /** Agent ID */
  agentId: string;

  /** Human's current understanding (what AI told them) */
  humanView: {
    lastUpdate: string;
    currentOfferFromOtherParty?: NegotiationTerms;
    aiInterpretation: string;
    suggestedResponses: string[];
  };

  /** Actual negotiation state (AI-to-AI) */
  actualState: {
    lastMessage: NegotiationProtocolMessage | null;
    currentTermsUnderDiscussion?: NegotiationTerms;
    roundNumber: number;
  };

  /** Human's constraints and preferences */
  humanConstraints: {
    maxPrice?: number;
    minPrice?: number;
    maxLeadTime?: number;
    nonNegotiables: string[];
    priorities: string[];
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PREFIX = '[Communication Guard]';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Allowed communication paths (from -> to)
 * Only AI-to-AI and Human-to-their-own-AI are allowed
 */
const ALLOWED_PATHS: Array<[MessageOrigin, MessageDestination]> = [
  // Humans can only talk to their own AI
  ['buyer_human', 'buyer_ai'],
  ['seller_human', 'seller_ai'],

  // AIs can talk to each other
  ['buyer_ai', 'seller_ai'],
  ['seller_ai', 'buyer_ai'],

  // AIs report back to their humans
  ['buyer_ai', 'buyer_human'],
  ['seller_ai', 'seller_human'],

  // System messages can go anywhere
  ['system', 'buyer_human'],
  ['system', 'seller_human'],
  ['system', 'buyer_ai'],
  ['system', 'seller_ai'],
];

/**
 * Blocked paths - explicit denials
 */
const BLOCKED_PATHS: Array<[MessageOrigin, MessageDestination]> = [
  // CRITICAL: Humans cannot talk to each other's humans or AIs
  ['buyer_human', 'seller_human'],
  ['buyer_human', 'seller_ai'],
  ['seller_human', 'buyer_human'],
  ['seller_human', 'buyer_ai'],
];

// ============================================================================
// CORE COMMUNICATION GUARD CLASS
// ============================================================================

/**
 * CommunicationGuard - Enforces AI-mediated communication
 *
 * This class ensures that all negotiation communication follows the pattern:
 * Human -> Their AI -> Other AI -> Other Human
 *
 * Direct human-to-human communication is always blocked.
 */
export class CommunicationGuard {
  private sessionId: string;
  private buyerAgentState: AIAgentState | null = null;
  private sellerAgentState: AIAgentState | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate if a communication path is allowed
   */
  validateCommunication(
    origin: MessageOrigin,
    destination: MessageDestination,
    message: string
  ): CommunicationValidation {
    // Check if path is explicitly blocked
    const isBlocked = BLOCKED_PATHS.some(
      ([from, to]) => from === origin && to === destination
    );

    if (isBlocked) {
      this.log('warn', 'BLOCKED: Direct party-to-party communication attempt', {
        origin,
        destination,
        messagePreview: message.substring(0, 100),
      });

      // Log bypass attempt
      this.logBypassAttempt({
        origin,
        intendedDestination: destination,
        messageContent: message,
        blockReason: 'Direct party-to-party communication is not allowed. All communication must go through AI agents.',
      });

      return {
        allowed: false,
        blockReason: 'Direct communication between parties is not allowed. Your message will be processed by your AI agent who will negotiate on your behalf.',
        originalMessage: message,
      };
    }

    // Check if path is allowed
    const isAllowed = ALLOWED_PATHS.some(
      ([from, to]) => from === origin && to === destination
    );

    if (!isAllowed) {
      this.log('warn', 'BLOCKED: Unauthorized communication path', {
        origin,
        destination,
      });

      return {
        allowed: false,
        blockReason: `Communication from ${origin} to ${destination} is not permitted.`,
        originalMessage: message,
      };
    }

    return { allowed: true };
  }

  /**
   * Process a human message and route it through their AI
   */
  async processHumanMessage(
    partyType: 'buyer' | 'seller',
    humanMessage: string,
    context?: {
      currentOffer?: NegotiationTerms;
      constraints?: Partial<AIAgentState['humanConstraints']>;
    }
  ): Promise<{
    intercepted: true;
    aiInterpretation: string;
    translatedForNegotiation: TranslatedMessage;
    humanFacingResponse: string;
    extractedInstruction: HumanInstruction;
  }> {
    this.log('info', 'Processing human message through AI guard', {
      partyType,
      messageLength: humanMessage.length,
    });

    // 1. Parse the human's instruction
    const instruction = await this.parseHumanInstruction(humanMessage);

    // 2. Translate for negotiation (removes emotional content, keeps substance)
    const translated = await this.translateForNegotiation(humanMessage, partyType, context);

    // 3. Generate human-facing acknowledgment
    const humanResponse = this.generateHumanAcknowledgment(instruction, partyType);

    return {
      intercepted: true,
      aiInterpretation: translated.aiTranslation,
      translatedForNegotiation: translated,
      humanFacingResponse: humanResponse,
      extractedInstruction: instruction,
    };
  }

  /**
   * Parse human instruction into structured format
   */
  async parseHumanInstruction(message: string): Promise<HumanInstruction> {
    const prompt = `Parse this user instruction for an AI negotiation agent.

User said: "${message}"

Identify:
1. The intent (what they want the AI to do)
2. Specific targets (price limits, timeline requirements, etc.)
3. Their preferred approach (aggressive/balanced/conservative)
4. Urgency level

Return JSON:
{
  "intent": "push_back_price" | "push_back_terms" | "accept_offer" | "reject_offer" | "request_info" | "modify_constraints" | "set_limit" | "escalate" | "pause" | "proceed" | "unknown",
  "targets": [{"type": "price|lead_time|quantity|payment_terms|warranty|general", "value": number or string, "direction": "increase|decrease|maintain"}],
  "preferredApproach": "aggressive" | "balanced" | "conservative" | null,
  "urgency": "low" | "medium" | "high" | null
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        instruction: message,
        intent: parsed.intent || 'unknown',
        targets: parsed.targets || [],
        preferredApproach: parsed.preferredApproach || undefined,
        urgency: parsed.urgency || undefined,
      };
    } catch (error) {
      this.log('error', 'Failed to parse human instruction', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        instruction: message,
        intent: 'unknown',
        targets: [],
      };
    }
  }

  /**
   * Translate human message to professional negotiation language
   */
  async translateForNegotiation(
    humanMessage: string,
    partyType: 'buyer' | 'seller',
    context?: {
      currentOffer?: NegotiationTerms;
      constraints?: Partial<AIAgentState['humanConstraints']>;
    }
  ): Promise<TranslatedMessage> {
    const prompt = `You are translating a ${partyType}'s message for professional B2B negotiation.

HUMAN'S RAW MESSAGE:
"${humanMessage}"

CONTEXT:
${context?.currentOffer ? `Current offer under discussion: $${context.currentOffer.totalPrice}` : 'No offer yet'}
${context?.constraints ? `Known constraints: ${JSON.stringify(context.constraints)}` : ''}

RULES:
1. Remove emotional language (frustration, anger, impatience)
2. Keep the SUBSTANCE (price limits, requirements, dealbreakers)
3. Make it professional and direct
4. Preserve their negotiating position
5. Don't soften their actual limits or requirements

EXAMPLES:
- "Tell them $50k is too damn high" -> "Our analysis indicates $50,000 exceeds our budget allocation for this requirement."
- "I won't go above $50k, period" -> "Our maximum budget for this project is $50,000. This is a firm constraint."
- "They're taking forever!" -> "We require confirmation on lead time to proceed with planning."

Return JSON:
{
  "aiTranslation": "Professional version of their message",
  "keyPoints": ["Key point 1", "Key point 2"],
  "emotionalContentFiltered": true/false,
  "extractedPosition": {
    "priceLimit": number or null,
    "firmness": "firm" | "flexible" | "neutral",
    "demands": ["demand 1"],
    "acceptableCompromises": ["compromise 1"],
    "walkAwayConditions": ["condition 1"]
  },
  "confidence": 0-100
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        humanInput: humanMessage,
        aiTranslation: parsed.aiTranslation || humanMessage,
        keyPoints: parsed.keyPoints || [],
        emotionalContentFiltered: parsed.emotionalContentFiltered || false,
        extractedPosition: parsed.extractedPosition,
        confidence: parsed.confidence || 70,
      };
    } catch (error) {
      this.log('error', 'Failed to translate message', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Fallback: return a generic professional version
      return {
        humanInput: humanMessage,
        aiTranslation: `Regarding the current negotiation: ${humanMessage}`,
        keyPoints: [humanMessage],
        emotionalContentFiltered: false,
        confidence: 50,
      };
    }
  }

  /**
   * Generate acknowledgment to show human their AI understood them
   */
  private generateHumanAcknowledgment(
    instruction: HumanInstruction,
    partyType: 'buyer' | 'seller'
  ): string {
    const intentMessages: Record<HumanInstructionIntent, string> = {
      push_back_price: "I'll push back on the price. I understand your position and will negotiate for better terms.",
      push_back_terms: "I'll negotiate on those terms. Let me work on getting you better conditions.",
      accept_offer: "I'll communicate your acceptance to the other party's representative.",
      reject_offer: "I understand you want to decline. I'll communicate this professionally.",
      request_info: "I'll request that information from the other party.",
      modify_constraints: "I've updated your negotiation parameters.",
      set_limit: "I've noted your limit. I won't agree to anything beyond this.",
      escalate: "I'll escalate this for your review before proceeding.",
      pause: "I'll pause the negotiation. Nothing will proceed until you say otherwise.",
      proceed: "Resuming negotiation with your confirmed parameters.",
      unknown: "I understand. Let me process your request and negotiate accordingly.",
    };

    let response = intentMessages[instruction.intent];

    // Add specific target acknowledgments
    if (instruction.targets.length > 0) {
      const targetSummary = instruction.targets
        .map(t => {
          if (t.type === 'price' && t.value) {
            return `price ${t.direction === 'decrease' ? 'no higher than' : ''} ${typeof t.value === 'number' ? '$' + t.value.toLocaleString() : t.value}`;
          }
          if (t.type === 'lead_time' && t.value) {
            return `delivery within ${t.value} days`;
          }
          return `${t.type}: ${t.value || t.direction}`;
        })
        .join(', ');

      response += ` Key targets: ${targetSummary}.`;
    }

    // Add approach note
    if (instruction.preferredApproach) {
      const approachNotes = {
        aggressive: " I'll take a firm stance.",
        balanced: " I'll aim for a fair middle ground.",
        conservative: " I'll prioritize reaching an agreement.",
      };
      response += approachNotes[instruction.preferredApproach];
    }

    response += "\n\nYou'll only see my interpretation of what the other party's AI communicates. I protect you from any unprofessional exchanges.";

    return response;
  }

  // ==========================================================================
  // AI-TO-HUMAN COMMUNICATION
  // ==========================================================================

  /**
   * Translate AI-to-AI message for human consumption
   * This is what the human sees - a summary from their AI, not raw counterparty messages
   */
  async translateForHuman(
    message: NegotiationProtocolMessage,
    targetParty: 'buyer' | 'seller'
  ): Promise<{
    summary: string;
    keyPoints: string[];
    suggestedResponses: string[];
    requiresDecision: boolean;
    decisionOptions?: string[];
  }> {
    const isFromOtherParty = message.sender.agentType !== targetParty;

    const prompt = `You are the ${targetParty}'s AI agent. Summarize this negotiation update for your human.

${isFromOtherParty ? "The other party's AI sent this message:" : "You sent this message:"}
"${message.message}"

Terms proposed: ${message.terms ? JSON.stringify(message.terms) : 'None'}
Message type: ${message.type}
Round: ${message.round}

Create a human-friendly summary that:
1. Explains what happened in plain language
2. Highlights key points they need to know
3. Suggests 2-3 possible responses they could give you
4. Indicates if they need to make a decision

Return JSON:
{
  "summary": "Plain language summary",
  "keyPoints": ["Point 1", "Point 2"],
  "suggestedResponses": ["Possible response 1", "Possible response 2"],
  "requiresDecision": true/false,
  "decisionOptions": ["Option 1", "Option 2"] // if requires decision
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || '{}');

      return {
        summary: parsed.summary || message.message,
        keyPoints: parsed.keyPoints || [],
        suggestedResponses: parsed.suggestedResponses || [],
        requiresDecision: parsed.requiresDecision || false,
        decisionOptions: parsed.decisionOptions,
      };
    } catch (error) {
      this.log('error', 'Failed to translate for human', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return {
        summary: message.message,
        keyPoints: [],
        suggestedResponses: [],
        requiresDecision: false,
      };
    }
  }

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  /**
   * Log a bypass attempt for security audit
   */
  private async logBypassAttempt(attempt: Omit<BypassAttempt, 'id' | 'sessionId' | 'timestamp'>): Promise<string> {
    const id = `bypass_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date().toISOString();

    const fullAttempt: BypassAttempt = {
      id,
      sessionId: this.sessionId,
      timestamp,
      ...attempt,
    };

    try {
      await sql`
        INSERT INTO communication_bypass_attempts (
          id, session_id, timestamp, origin, intended_destination,
          message_content, block_reason, user_id, ip_address
        ) VALUES (
          ${fullAttempt.id},
          ${fullAttempt.sessionId},
          ${fullAttempt.timestamp},
          ${fullAttempt.origin},
          ${fullAttempt.intendedDestination},
          ${fullAttempt.messageContent.substring(0, 1000)},
          ${fullAttempt.blockReason},
          ${fullAttempt.userId || null},
          ${fullAttempt.ipAddress || null}
        )
      `;
    } catch (error) {
      // Log to console if DB insert fails
      console.error(`${LOG_PREFIX} Failed to log bypass attempt:`, error);
      console.error(`${LOG_PREFIX} Bypass attempt:`, fullAttempt);
    }

    this.log('warn', 'Bypass attempt logged', { attemptId: id });

    return id;
  }

  /**
   * Get all bypass attempts for a session
   */
  async getBypassAttempts(): Promise<BypassAttempt[]> {
    try {
      const result = await sql`
        SELECT * FROM communication_bypass_attempts
        WHERE session_id = ${this.sessionId}
        ORDER BY timestamp DESC
      `;

      return result.rows as BypassAttempt[];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Initialize agent state for a party
   */
  initializeAgentState(partyType: 'buyer' | 'seller', agentId: string): void {
    const state: AIAgentState = {
      partyType,
      agentId,
      humanView: {
        lastUpdate: new Date().toISOString(),
        aiInterpretation: 'Negotiation initialized. I will negotiate on your behalf.',
        suggestedResponses: [],
      },
      actualState: {
        lastMessage: null,
        roundNumber: 0,
      },
      humanConstraints: {
        nonNegotiables: [],
        priorities: [],
      },
    };

    if (partyType === 'buyer') {
      this.buyerAgentState = state;
    } else {
      this.sellerAgentState = state;
    }
  }

  /**
   * Update agent state after message processing
   */
  updateAgentState(
    partyType: 'buyer' | 'seller',
    update: Partial<AIAgentState>
  ): void {
    const currentState = partyType === 'buyer' ? this.buyerAgentState : this.sellerAgentState;
    if (!currentState) return;

    const newState = {
      ...currentState,
      ...update,
      humanView: {
        ...currentState.humanView,
        ...update.humanView,
        lastUpdate: new Date().toISOString(),
      },
      actualState: {
        ...currentState.actualState,
        ...update.actualState,
      },
      humanConstraints: {
        ...currentState.humanConstraints,
        ...update.humanConstraints,
      },
    };

    if (partyType === 'buyer') {
      this.buyerAgentState = newState;
    } else {
      this.sellerAgentState = newState;
    }
  }

  /**
   * Get the human-facing view for a party
   * This is what they should see - filtered through their AI
   */
  getHumanView(partyType: 'buyer' | 'seller'): AIAgentState['humanView'] | null {
    const state = partyType === 'buyer' ? this.buyerAgentState : this.sellerAgentState;
    return state?.humanView || null;
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();

    if (level === 'error') {
      console.error(`${LOG_PREFIX} ERROR: ${message}`, meta || '');
    } else if (level === 'warn') {
      console.warn(`${LOG_PREFIX} WARN: ${message}`, meta || '');
    } else {
      console.log(`${LOG_PREFIX} ${message}`, meta || '');
    }
  }
}

// ============================================================================
// FACTORY AND SINGLETON
// ============================================================================

const guards = new Map<string, CommunicationGuard>();

/**
 * Get or create a communication guard for a session
 */
export function getCommunicationGuard(sessionId: string): CommunicationGuard {
  let guard = guards.get(sessionId);
  if (!guard) {
    guard = new CommunicationGuard(sessionId);
    guards.set(sessionId, guard);
  }
  return guard;
}

/**
 * Clean up a guard when session ends
 */
export function cleanupGuard(sessionId: string): void {
  guards.delete(sessionId);
}

// ============================================================================
// QUICK VALIDATION FUNCTIONS
// ============================================================================

/**
 * Quick check if a communication path is allowed
 */
export function isPathAllowed(origin: MessageOrigin, destination: MessageDestination): boolean {
  // Check blocked paths first
  const isBlocked = BLOCKED_PATHS.some(
    ([from, to]) => from === origin && to === destination
  );
  if (isBlocked) return false;

  // Check allowed paths
  return ALLOWED_PATHS.some(
    ([from, to]) => from === origin && to === destination
  );
}

/**
 * Check if origin is a human
 */
export function isHuman(origin: MessageOrigin): boolean {
  return origin === 'buyer_human' || origin === 'seller_human';
}

/**
 * Check if destination is a human
 */
export function isHumanDestination(destination: MessageDestination): boolean {
  return destination === 'buyer_human' || destination === 'seller_human';
}

/**
 * Check if this is a direct human-to-human path (always blocked)
 */
export function isDirectHumanToHuman(origin: MessageOrigin, destination: MessageDestination): boolean {
  return isHuman(origin) && isHumanDestination(destination) &&
    !((origin === 'buyer_human' && destination === 'buyer_ai') ||
      (origin === 'seller_human' && destination === 'seller_ai'));
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default CommunicationGuard;
