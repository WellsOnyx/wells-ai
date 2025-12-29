/**
 * Seller AI Agent Configuration
 *
 * Defines the seller's AI agent behavior, pricing rules, and negotiation strategies.
 * All configuration is done conversationally through Wells chat.
 *
 * Conversational setup flow:
 * - Wells: "Let's set up your seller AI. What do you sell?"
 * - Seller: "Industrial bearings and motor parts"
 * - Wells: "Got it. What's your typical margin target?"
 * - Seller: "I aim for 25% but can go down to 15% for big orders"
 * - Wells: "Makes sense. Should I auto-respond to RFQs or check with you first?"
 * - Seller: "Auto-respond for orders under $5000, check with me for bigger ones"
 * - Wells: "Perfect! I'll start working."
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface VolumeDiscountTier {
  minQuantity: number;
  discountPercent: number;
  description?: string;
}

export interface PricingStrategy {
  // Margin controls
  minMargin: number;          // Never go below this margin (e.g., 15%)
  targetMargin: number;       // Try to achieve this margin (e.g., 30%)
  walkAwayMargin: number;     // Absolute floor - will refuse deals below this

  // Volume discounts
  volumeDiscountTiers: VolumeDiscountTier[];

  // Urgency pricing
  urgencyPremium: number;     // Premium for rush orders (e.g., 20%)
  standardLeadTimeDays: number;
  rushLeadTimeDays: number;

  // Special pricing rules
  repeatCustomerDiscount: number;  // Discount for repeat customers
  firstOrderDiscount: number;      // Discount to win first order
}

export type NegotiationAggressionLevel = 'conservative' | 'balanced' | 'aggressive';

export interface NegotiationStyle {
  aggression: NegotiationAggressionLevel;
  maxConcessions: number;       // How many times willing to lower price
  concessionSize: number;       // Typical concession size (% of gap)
  walkAwayThreshold: number;    // Never go below this margin
  requireJustification: boolean; // Ask buyer to justify counter-offers
  bundleUpsell: boolean;        // Suggest bundles/add-ons during negotiation
}

export interface AutoResponseSettings {
  enabled: boolean;
  quoteResponseHours: number;      // Target response time
  autoApproveUnder: number;        // Auto-approve deals under this amount
  requireApprovalOver: number;     // Always require approval over this amount
  autoApproveMarginOver: number;   // Auto-approve if margin exceeds this %
  workingHoursOnly: boolean;       // Only auto-respond during business hours
  workingHoursStart: number;       // e.g., 9 (9 AM)
  workingHoursEnd: number;         // e.g., 17 (5 PM)
  workingDays: number[];           // [1,2,3,4,5] = Mon-Fri
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  slack: boolean;
  notifyOnNewRfq: boolean;
  notifyOnQuoteSent: boolean;
  notifyOnNegotiationStart: boolean;
  notifyOnDealClosed: boolean;
  notifyOnApprovalNeeded: boolean;
  dailySummary: boolean;
  dailySummaryTime: number; // Hour in 24h format
}

export interface SellerAIConfig {
  id: string;
  sellerId: string;
  companyName: string;

  // What they sell
  businessDescription: string;
  productCategories: string[];
  specializations: string[];

  // Pricing and negotiation
  pricingStrategy: PricingStrategy;
  negotiationStyle: NegotiationStyle;
  autoResponse: AutoResponseSettings;

  // Communication
  notifications: NotificationPreferences;
  preferredContactMethod: 'email' | 'sms' | 'slack';
  contactEmail: string;
  contactPhone?: string;
  slackWebhook?: string;

  // AI Personality
  agentTone: 'professional' | 'friendly' | 'direct';
  companyTagline?: string;
  valuePropositions: string[];

  // Status
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

export interface ConversationalSetupContext {
  sellerId: string;
  currentStep: SetupStep;
  collectedData: Partial<SellerAIConfig>;
  conversationHistory: ConversationMessage[];
}

export type SetupStep =
  | 'business_description'
  | 'product_categories'
  | 'pricing_strategy'
  | 'negotiation_style'
  | 'auto_response'
  | 'notifications'
  | 'review'
  | 'complete';

export interface ConversationMessage {
  role: 'wells' | 'seller';
  content: string;
  timestamp: Date;
  extractedData?: Record<string, unknown>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export function getDefaultConfig(sellerId: string): Partial<SellerAIConfig> {
  return {
    sellerId,
    pricingStrategy: {
      minMargin: 15,
      targetMargin: 30,
      walkAwayMargin: 5,
      volumeDiscountTiers: [
        { minQuantity: 100, discountPercent: 5, description: 'Small volume' },
        { minQuantity: 500, discountPercent: 10, description: 'Medium volume' },
        { minQuantity: 1000, discountPercent: 15, description: 'Large volume' },
      ],
      urgencyPremium: 20,
      standardLeadTimeDays: 7,
      rushLeadTimeDays: 3,
      repeatCustomerDiscount: 5,
      firstOrderDiscount: 10,
    },
    negotiationStyle: {
      aggression: 'balanced',
      maxConcessions: 3,
      concessionSize: 25,
      walkAwayThreshold: 10,
      requireJustification: false,
      bundleUpsell: true,
    },
    autoResponse: {
      enabled: true,
      quoteResponseHours: 2,
      autoApproveUnder: 5000,
      requireApprovalOver: 25000,
      autoApproveMarginOver: 25,
      workingHoursOnly: false,
      workingHoursStart: 9,
      workingHoursEnd: 17,
      workingDays: [1, 2, 3, 4, 5],
    },
    notifications: {
      email: true,
      sms: true,
      slack: false,
      notifyOnNewRfq: true,
      notifyOnQuoteSent: true,
      notifyOnNegotiationStart: true,
      notifyOnDealClosed: true,
      notifyOnApprovalNeeded: true,
      dailySummary: true,
      dailySummaryTime: 18,
    },
    agentTone: 'professional',
    valuePropositions: [],
    isActive: true,
  };
}

// ============================================================================
// CONVERSATIONAL SETUP
// ============================================================================

/**
 * Process seller message and extract configuration data
 */
export async function processSetupMessage(
  context: ConversationalSetupContext,
  sellerMessage: string
): Promise<{
  response: string;
  nextStep: SetupStep;
  extractedData: Record<string, unknown>;
  isComplete: boolean;
}> {
  const stepPrompts: Record<SetupStep, string> = {
    business_description: `The seller is describing their business. Extract:
- Company/business description
- Main product categories
- Any specializations mentioned

Seller said: "${sellerMessage}"`,

    product_categories: `The seller is describing their products. Extract:
- List of product categories
- Any specific product types
- Price ranges mentioned

Seller said: "${sellerMessage}"`,

    pricing_strategy: `The seller is describing their pricing approach. Extract:
- Target margin percentage (look for phrases like "aim for X%", "target X%")
- Minimum margin (look for "won't go below X%", "minimum X%")
- Volume discount information
- Rush order premiums

Seller said: "${sellerMessage}"`,

    negotiation_style: `The seller is describing how they negotiate. Extract:
- Aggression level (conservative/balanced/aggressive)
- How flexible they are on price
- Walk-away points

Seller said: "${sellerMessage}"`,

    auto_response: `The seller is configuring auto-response. Extract:
- Whether to auto-respond (yes/no)
- Dollar thresholds for auto-approval
- Response time targets

Seller said: "${sellerMessage}"`,

    notifications: `The seller is setting notification preferences. Extract:
- Preferred contact method (email/sms/slack)
- When they want to be notified
- Daily summary preference

Seller said: "${sellerMessage}"`,

    review: `The seller is reviewing their configuration. Determine:
- Are they confirming (yes, looks good, proceed)?
- Do they want to change something?
- Any final adjustments?

Seller said: "${sellerMessage}"`,

    complete: '',
  };

  // Extract data from seller message using AI
  const extractionPrompt = `You are helping configure a seller's AI agent for Wells AI.
${stepPrompts[context.currentStep]}

Respond in JSON format:
{
  "extractedData": { ... extracted key-value pairs ... },
  "needsClarification": boolean,
  "clarificationQuestion": "question if needed",
  "readyForNextStep": boolean,
  "suggestedResponse": "what Wells should say next"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: extractionPrompt }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';

    // Parse the extraction result
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch?.[0] || '{}');

    // Determine next step
    let nextStep = context.currentStep;
    if (result.readyForNextStep) {
      nextStep = getNextStep(context.currentStep);
    }

    // Merge extracted data with context
    const mergedData = {
      ...context.collectedData,
      ...mapExtractedData(context.currentStep, result.extractedData || {}),
    };

    return {
      response: result.suggestedResponse || getDefaultStepResponse(nextStep),
      nextStep,
      extractedData: mergedData as Record<string, unknown>,
      isComplete: nextStep === 'complete',
    };
  } catch (error) {
    console.error('Error processing setup message:', error);
    return {
      response: "I didn't quite catch that. Could you rephrase?",
      nextStep: context.currentStep,
      extractedData: context.collectedData as Record<string, unknown>,
      isComplete: false,
    };
  }
}

function getNextStep(currentStep: SetupStep): SetupStep {
  const stepOrder: SetupStep[] = [
    'business_description',
    'product_categories',
    'pricing_strategy',
    'negotiation_style',
    'auto_response',
    'notifications',
    'review',
    'complete',
  ];

  const currentIndex = stepOrder.indexOf(currentStep);
  return stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)];
}

function getDefaultStepResponse(step: SetupStep): string {
  const responses: Record<SetupStep, string> = {
    business_description: "Let's set up your seller AI. What does your company sell?",
    product_categories: "Great! What specific product categories do you offer?",
    pricing_strategy: "Now let's talk pricing. What's your typical margin target, and what's the lowest you'll go?",
    negotiation_style: "How aggressive should I be in negotiations? Conservative (protect margins), balanced, or aggressive (win deals)?",
    auto_response: "Should I auto-respond to RFQs, or check with you first? You can set a threshold - like 'auto-respond under $5K'",
    notifications: "How do you want to be notified? Email, SMS, or Slack? And when?",
    review: "Here's your configuration. Does everything look good, or would you like to adjust anything?",
    complete: "You're all set! I'll start working on your behalf. You'll get notifications when I need your input.",
  };
  return responses[step];
}

function mapExtractedData(step: SetupStep, data: Record<string, unknown>): Partial<SellerAIConfig> {
  switch (step) {
    case 'business_description':
      return {
        businessDescription: data.description as string || data.businessDescription as string,
        companyName: data.companyName as string,
        productCategories: data.categories as string[] || data.productCategories as string[],
      };

    case 'pricing_strategy':
      return {
        pricingStrategy: {
          ...(getDefaultConfig('').pricingStrategy as PricingStrategy),
          targetMargin: data.targetMargin as number || 30,
          minMargin: data.minMargin as number || 15,
          walkAwayMargin: data.walkAwayMargin as number || 5,
          urgencyPremium: data.rushPremium as number || 20,
        },
      };

    case 'negotiation_style':
      return {
        negotiationStyle: {
          ...(getDefaultConfig('').negotiationStyle as NegotiationStyle),
          aggression: (data.aggression as NegotiationAggressionLevel) || 'balanced',
          maxConcessions: data.maxConcessions as number || 3,
        },
      };

    case 'auto_response':
      return {
        autoResponse: {
          ...(getDefaultConfig('').autoResponse as AutoResponseSettings),
          enabled: data.enabled !== false,
          autoApproveUnder: data.autoApproveUnder as number || 5000,
          quoteResponseHours: data.responseHours as number || 2,
        },
      };

    default:
      return data as Partial<SellerAIConfig>;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save seller AI configuration to database
 */
export async function saveSellerConfig(config: SellerAIConfig): Promise<SellerAIConfig> {
  const result = await sql`
    INSERT INTO seller_ai_configs (
      id,
      seller_id,
      company_name,
      business_description,
      product_categories,
      specializations,
      pricing_strategy,
      negotiation_style,
      auto_response,
      notifications,
      preferred_contact_method,
      contact_email,
      contact_phone,
      slack_webhook,
      agent_tone,
      company_tagline,
      value_propositions,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      ${config.id},
      ${config.sellerId},
      ${config.companyName},
      ${config.businessDescription},
      ${JSON.stringify(config.productCategories)},
      ${JSON.stringify(config.specializations)},
      ${JSON.stringify(config.pricingStrategy)},
      ${JSON.stringify(config.negotiationStyle)},
      ${JSON.stringify(config.autoResponse)},
      ${JSON.stringify(config.notifications)},
      ${config.preferredContactMethod},
      ${config.contactEmail},
      ${config.contactPhone || null},
      ${config.slackWebhook || null},
      ${config.agentTone},
      ${config.companyTagline || null},
      ${JSON.stringify(config.valuePropositions)},
      ${config.isActive},
      NOW(),
      NOW()
    )
    ON CONFLICT (seller_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      business_description = EXCLUDED.business_description,
      product_categories = EXCLUDED.product_categories,
      specializations = EXCLUDED.specializations,
      pricing_strategy = EXCLUDED.pricing_strategy,
      negotiation_style = EXCLUDED.negotiation_style,
      auto_response = EXCLUDED.auto_response,
      notifications = EXCLUDED.notifications,
      preferred_contact_method = EXCLUDED.preferred_contact_method,
      contact_email = EXCLUDED.contact_email,
      contact_phone = EXCLUDED.contact_phone,
      slack_webhook = EXCLUDED.slack_webhook,
      agent_tone = EXCLUDED.agent_tone,
      company_tagline = EXCLUDED.company_tagline,
      value_propositions = EXCLUDED.value_propositions,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *
  `;

  return rowToConfig(result.rows[0]);
}

/**
 * Get seller configuration by seller ID
 */
export async function getSellerConfig(sellerId: string): Promise<SellerAIConfig | null> {
  const result = await sql`
    SELECT * FROM seller_ai_configs WHERE seller_id = ${sellerId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return rowToConfig(result.rows[0]);
}

/**
 * Update specific fields of seller configuration
 */
export async function updateSellerConfig(
  sellerId: string,
  updates: Partial<SellerAIConfig>
): Promise<SellerAIConfig | null> {
  const existing = await getSellerConfig(sellerId);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  return saveSellerConfig(merged);
}

/**
 * Deactivate seller AI agent
 */
export async function deactivateAgent(sellerId: string): Promise<void> {
  await sql`
    UPDATE seller_ai_configs
    SET is_active = false, updated_at = NOW()
    WHERE seller_id = ${sellerId}
  `;
}

/**
 * Activate seller AI agent
 */
export async function activateAgent(sellerId: string): Promise<void> {
  await sql`
    UPDATE seller_ai_configs
    SET is_active = true, updated_at = NOW(), last_active_at = NOW()
    WHERE seller_id = ${sellerId}
  `;
}

/**
 * Get all active seller agents
 */
export async function getActiveAgents(): Promise<SellerAIConfig[]> {
  const result = await sql`
    SELECT * FROM seller_ai_configs
    WHERE is_active = true
    ORDER BY last_active_at DESC NULLS LAST
  `;

  return result.rows.map(rowToConfig);
}

/**
 * Convert database row to SellerAIConfig
 */
function rowToConfig(row: Record<string, unknown>): SellerAIConfig {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    companyName: row.company_name as string,
    businessDescription: row.business_description as string,
    productCategories: parseJson(row.product_categories) || [],
    specializations: parseJson(row.specializations) || [],
    pricingStrategy: parseJson(row.pricing_strategy),
    negotiationStyle: parseJson(row.negotiation_style),
    autoResponse: parseJson(row.auto_response),
    notifications: parseJson(row.notifications),
    preferredContactMethod: row.preferred_contact_method as 'email' | 'sms' | 'slack',
    contactEmail: row.contact_email as string,
    contactPhone: row.contact_phone as string | undefined,
    slackWebhook: row.slack_webhook as string | undefined,
    agentTone: row.agent_tone as 'professional' | 'friendly' | 'direct',
    companyTagline: row.company_tagline as string | undefined,
    valuePropositions: parseJson(row.value_propositions) || [],
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at as string) : undefined,
  };
}

function parseJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SellerAgentConfig = {
  getDefaultConfig,
  processSetupMessage,
  saveSellerConfig,
  getSellerConfig,
  updateSellerConfig,
  deactivateAgent,
  activateAgent,
  getActiveAgents,
};

export default SellerAgentConfig;
