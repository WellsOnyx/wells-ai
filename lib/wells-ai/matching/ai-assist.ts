/**
 * Wells AI Enhancement Layer
 *
 * Uses AI (OpenAI/Claude) to:
 * - Parse natural language requests
 * - Extract specs from descriptions
 * - Suggest missing requirements
 * - Generate introduction messages
 * - Summarize supplier capabilities
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ParsedRequest,
  ProductSpecification,
  SourcingRequest,
  SupplierProfile,
  SupplierCapabilitySummary,
  GeneratedIntroMessage,
  RequestUrgency,
} from './types';

// ============================================================================
// AI CLIENT SETUP
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-3-5-sonnet-20241022';

// ============================================================================
// NATURAL LANGUAGE REQUEST PARSING
// ============================================================================

/**
 * Parse a natural language sourcing request into structured data
 */
export async function parseNaturalLanguageRequest(
  rawRequest: string,
  buyerContext?: {
    companyName?: string;
    industry?: string;
    location?: string;
    previousOrders?: string[];
  }
): Promise<ParsedRequest> {
  const contextInfo = buyerContext
    ? `
BUYER CONTEXT:
- Company: ${buyerContext.companyName || 'Unknown'}
- Industry: ${buyerContext.industry || 'Unknown'}
- Location: ${buyerContext.location || 'Unknown'}
- Previous Orders: ${buyerContext.previousOrders?.join(', ') || 'None on record'}
`
    : '';

  const prompt = `You are an expert procurement analyst helping parse a sourcing request.

${contextInfo}

USER REQUEST:
"${rawRequest}"

Analyze this request and extract structured information. Be precise about quantities and specifications.

Respond in JSON format:
{
  "title": "Brief title for this request (5-10 words)",
  "description": "Clear, professional description of the need",
  "inferredCategory": "Best matching category (e.g., 'packaging', 'electronics', 'raw_materials', 'office_supplies')",
  "categoryConfidence": 0.0-1.0,
  "alternativeCategories": ["other possible categories"],
  "extractedSpecs": [
    {
      "name": "specification name",
      "value": "value",
      "required": true/false,
      "unit": "optional unit"
    }
  ],
  "quantity": null or number,
  "quantityUnit": "units/boxes/tons/etc",
  "frequency": "one-time" | "monthly" | "quarterly" | "annual",
  "deliveryDeadline": null or "YYYY-MM-DD",
  "urgency": "standard" | "urgent" | "critical",
  "targetPrice": null or number,
  "maxPrice": null or number,
  "currency": "USD",
  "deliveryLocation": "extracted location or null",
  "missingFields": ["list of important missing information"],
  "suggestedQuestions": ["questions to ask buyer to clarify requirements"]
}

Important:
- Be conservative with confidence scores
- Extract all quantifiable specifications
- If urgency is unclear, assume "standard"
- List 2-4 clarifying questions if information is ambiguous
- Currency defaults to USD unless specified`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      title: parsed.title || 'Sourcing Request',
      description: parsed.description || rawRequest,
      inferredCategory: parsed.inferredCategory || 'general',
      categoryConfidence: parsed.categoryConfidence || 0.5,
      alternativeCategories: parsed.alternativeCategories || [],
      extractedSpecs: (parsed.extractedSpecs || []).map(
        (spec: Record<string, unknown>) =>
          ({
            name: spec.name as string,
            value: spec.value as string,
            required: spec.required as boolean,
            unit: spec.unit as string | undefined,
          }) as ProductSpecification
      ),
      quantity: parsed.quantity,
      quantityUnit: parsed.quantityUnit || 'units',
      frequency: parsed.frequency || 'one-time',
      deliveryDeadline: parsed.deliveryDeadline
        ? new Date(parsed.deliveryDeadline)
        : undefined,
      urgency: (parsed.urgency || 'standard') as RequestUrgency,
      targetPrice: parsed.targetPrice,
      maxPrice: parsed.maxPrice,
      currency: parsed.currency || 'USD',
      deliveryLocation: parsed.deliveryLocation,
      missingFields: parsed.missingFields || [],
      suggestedQuestions: parsed.suggestedQuestions || [],
    };
  } catch (error) {
    console.error('AI parsing error:', error);

    // Return a basic parsed result
    return {
      title: 'Sourcing Request',
      description: rawRequest,
      inferredCategory: 'general',
      categoryConfidence: 0.3,
      alternativeCategories: [],
      extractedSpecs: [],
      quantity: undefined,
      quantityUnit: 'units',
      frequency: 'one-time',
      urgency: 'standard',
      currency: 'USD',
      missingFields: [
        'category',
        'quantity',
        'delivery_location',
        'budget',
        'timeline',
      ],
      suggestedQuestions: [
        'What specific product or service are you looking for?',
        'What quantity do you need?',
        'Where should it be delivered?',
        'What is your budget range?',
        'When do you need it by?',
      ],
    };
  }
}

// ============================================================================
// SPECIFICATION EXTRACTION
// ============================================================================

/**
 * Extract detailed specifications from a product description
 */
export async function extractSpecsFromDescription(
  description: string,
  category: string
): Promise<ProductSpecification[]> {
  const prompt = `You are a technical procurement specialist. Extract all product specifications from this description.

CATEGORY: ${category}
DESCRIPTION: "${description}"

Extract specifications like:
- Dimensions (length, width, height)
- Weight
- Material
- Color
- Capacity
- Power requirements
- Certifications needed
- Quality standards
- Any other technical specifications

Respond in JSON format:
{
  "specifications": [
    {
      "name": "specification name",
      "value": "value",
      "required": true/false,
      "unit": "optional unit"
    }
  ]
}

Only include specifications that are explicitly or strongly implied in the description.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.specifications || []).map(
      (spec: Record<string, unknown>) =>
        ({
          name: spec.name as string,
          value: spec.value as string,
          required: spec.required as boolean,
          unit: spec.unit as string | undefined,
        }) as ProductSpecification
    );
  } catch (error) {
    console.error('Spec extraction error:', error);
    return [];
  }
}

// ============================================================================
// REQUIREMENT SUGGESTIONS
// ============================================================================

/**
 * Suggest missing requirements based on category and existing specs
 */
export async function suggestMissingRequirements(
  request: Partial<SourcingRequest>
): Promise<{
  suggestions: ProductSpecification[];
  questions: string[];
  recommendations: string[];
}> {
  const prompt = `You are an experienced procurement advisor. Review this sourcing request and suggest what's missing.

REQUEST:
- Category: ${request.category || 'Unknown'}
- Description: ${request.description || 'Not provided'}
- Quantity: ${request.quantity || 'Not specified'}
- Current Specs: ${JSON.stringify(request.specifications || [])}
- Certifications Required: ${request.requiredCertifications?.join(', ') || 'None'}
- Delivery Location: ${request.deliveryLocation || 'Not specified'}
- Budget: ${request.targetPrice ? `$${request.targetPrice}` : 'Not specified'}

What important specifications or requirements are typically needed for this type of request?

Respond in JSON format:
{
  "suggestions": [
    {
      "name": "specification name",
      "value": "suggested default or 'TBD'",
      "required": true/false,
      "unit": "optional unit"
    }
  ],
  "questions": ["Questions to ask the buyer"],
  "recommendations": ["Best practice recommendations for this type of purchase"]
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { suggestions: [], questions: [], recommendations: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      suggestions: (parsed.suggestions || []).map(
        (spec: Record<string, unknown>) =>
          ({
            name: spec.name as string,
            value: spec.value as string,
            required: spec.required as boolean,
            unit: spec.unit as string | undefined,
          }) as ProductSpecification
      ),
      questions: parsed.questions || [],
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return { suggestions: [], questions: [], recommendations: [] };
  }
}

// ============================================================================
// INTRODUCTION MESSAGE GENERATION
// ============================================================================

/**
 * Generate personalized introduction messages for buyer and supplier
 */
export async function generateIntroMessages(
  request: SourcingRequest,
  supplier: SupplierProfile,
  matchScore: number,
  matchReasons: string[]
): Promise<GeneratedIntroMessage> {
  const prompt = `You are a professional business matchmaker at Wells AI. Generate introduction messages to connect a buyer with a potential supplier.

BUYER REQUEST:
- Company: ${request.buyerName || 'A company'}
- Need: ${request.title}
- Description: ${request.description}
- Quantity: ${request.quantity} ${request.quantityUnit}
- Location: ${request.deliveryLocation}
- Budget: ${request.targetPrice ? `$${request.targetPrice}` : 'Not specified'}
- Urgency: ${request.urgency}

SUPPLIER:
- Company: ${supplier.companyName}
- Products: ${supplier.products.join(', ')}
- Certifications: ${supplier.certifications.join(', ')}
- Lead Time: ${supplier.capacity.leadTimeStandard} days
- Trust Level: ${supplier.trustTier}
${supplier.grainEnabled ? '- GRAIN-enabled for secure payments' : ''}

MATCH SCORE: ${matchScore}/100
MATCH REASONS: ${matchReasons.join(', ')}

Generate professional, concise introduction messages.

Respond in JSON format:
{
  "forBuyer": {
    "subject": "Email subject line",
    "body": "Professional introduction of the supplier (2-3 paragraphs, highlight key strengths)"
  },
  "forSupplier": {
    "subject": "Email subject line",
    "body": "Professional introduction of the opportunity (2-3 paragraphs, highlight key requirements)"
  }
}

Keep messages professional, specific, and action-oriented. Mention GRAIN if applicable.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]) as GeneratedIntroMessage;
  } catch (error) {
    console.error('Intro message generation error:', error);

    // Return default messages
    return {
      forBuyer: {
        subject: `Supplier Match: ${supplier.companyName} for your ${request.title}`,
        body: `We've identified ${supplier.companyName} as a potential supplier for your request.\n\nThey specialize in ${supplier.products.slice(0, 3).join(', ')} and have a ${supplier.trustTier} trust rating on our platform.\n\nWould you like us to facilitate an introduction?`,
      },
      forSupplier: {
        subject: `New Opportunity: ${request.title} (${request.quantity} ${request.quantityUnit})`,
        body: `We have a buyer looking for ${request.title}.\n\nQuantity: ${request.quantity} ${request.quantityUnit}\nLocation: ${request.deliveryLocation}\nUrgency: ${request.urgency}\n\nBased on your capabilities, we believe this could be a good match. Would you like to learn more?`,
      },
    };
  }
}

// ============================================================================
// SUPPLIER CAPABILITY SUMMARY
// ============================================================================

/**
 * Generate a human-readable summary of supplier capabilities for buyers
 */
export async function summarizeSupplierForBuyer(
  supplier: SupplierProfile,
  requestContext?: Partial<SourcingRequest>
): Promise<SupplierCapabilitySummary> {
  const contextInfo = requestContext
    ? `
BUYER'S NEED:
- Category: ${requestContext.category || 'General'}
- Quantity: ${requestContext.quantity || 'TBD'} ${requestContext.quantityUnit || 'units'}
- Location: ${requestContext.deliveryLocation || 'TBD'}
`
    : '';

  const prompt = `Summarize this supplier's capabilities for a potential buyer.

SUPPLIER: ${supplier.companyName}
${contextInfo}
SUPPLIER DETAILS:
- Products: ${supplier.products.join(', ')}
- Categories: ${supplier.categories.join(', ')}
- Certifications: ${supplier.certifications.join(', ')}
- Monthly Capacity: ${supplier.capacity.monthlyVolume} ${supplier.capacity.monthlyVolumeUnit}
- Standard Lead Time: ${supplier.capacity.leadTimeStandard} days
- Rush Lead Time: ${supplier.capacity.leadTimeRush} days
- Ships To: ${supplier.shippingLocations.join(', ')}
- Minimum Order: $${supplier.pricing.minimumOrder}
- Payment Terms: ${supplier.pricing.paymentTerms}
- Trust Tier: ${supplier.trustTier}
- Trust Score: ${supplier.trustScore}/100
- On-Time Delivery: ${supplier.performance.onTimeDeliveryRate}%
- Quality Rating: ${supplier.performance.qualityRating}/5
- Drop Ship: ${supplier.capabilities.dropShipCapable ? 'Yes' : 'No'}
- White Label: ${supplier.capabilities.whiteLabelCapable ? 'Yes' : 'No'}
${supplier.grainEnabled ? '- GRAIN-enabled for instant, secure payments' : ''}

Generate a concise summary.

Respond in JSON format:
{
  "headline": "One sentence pitch (max 15 words)",
  "keyStrengths": ["3-4 key strengths"],
  "specializations": ["2-3 areas of expertise"],
  "capacityHighlight": "Brief capacity statement",
  "certificationHighlight": "Brief certification statement",
  "trustHighlight": "Brief trust/reliability statement"
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]) as SupplierCapabilitySummary;
  } catch (error) {
    console.error('Summary generation error:', error);

    // Return basic summary
    return {
      headline: `${supplier.companyName} - ${supplier.trustTier} supplier`,
      keyStrengths: [
        `${supplier.performance.onTimeDeliveryRate}% on-time delivery`,
        `${supplier.capacity.leadTimeStandard} day lead time`,
        supplier.grainEnabled ? 'GRAIN-enabled' : 'Established supplier',
      ],
      specializations: supplier.categories.slice(0, 3),
      capacityHighlight: `${supplier.capacity.monthlyVolume} ${supplier.capacity.monthlyVolumeUnit} monthly capacity`,
      certificationHighlight:
        supplier.certifications.length > 0
          ? `Certified: ${supplier.certifications.slice(0, 3).join(', ')}`
          : 'Standard compliance',
      trustHighlight: `${supplier.trustTier} tier with ${supplier.trustScore}/100 trust score`,
    };
  }
}

// ============================================================================
// MATCH EXPLANATION
// ============================================================================

/**
 * Generate a detailed explanation of why a supplier matches a request
 */
export async function explainMatch(
  request: SourcingRequest,
  supplier: SupplierProfile,
  scoreBreakdown: Record<string, unknown>
): Promise<{
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
}> {
  const prompt = `Explain why this supplier is a match for this buyer's request.

BUYER REQUEST:
- Need: ${request.title}
- Category: ${request.category}
- Quantity: ${request.quantity} ${request.quantityUnit}
- Location: ${request.deliveryLocation}
- Urgency: ${request.urgency}
- Required Certs: ${request.requiredCertifications?.join(', ') || 'None'}

SUPPLIER:
- Name: ${supplier.companyName}
- Categories: ${supplier.categories.join(', ')}
- Certifications: ${supplier.certifications.join(', ')}
- Trust: ${supplier.trustTier} (${supplier.trustScore}/100)
- GRAIN: ${supplier.grainEnabled ? 'Yes' : 'No'}

SCORE BREAKDOWN:
${JSON.stringify(scoreBreakdown, null, 2)}

Provide an honest, balanced assessment.

Respond in JSON format:
{
  "summary": "2-3 sentence overall assessment",
  "strengths": ["3-5 specific strengths"],
  "concerns": ["1-3 potential concerns or areas to verify"],
  "recommendation": "Clear recommendation (proceed/proceed with caution/consider alternatives)"
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Match explanation error:', error);

    return {
      summary: `${supplier.companyName} appears to be a viable supplier for this request.`,
      strengths: [
        `Operates in the ${supplier.categories[0]} category`,
        `${supplier.trustTier} trust tier`,
        supplier.grainEnabled
          ? 'GRAIN-enabled for secure transactions'
          : 'Established supplier',
      ],
      concerns: ['Recommend verifying specific requirements before proceeding'],
      recommendation: 'proceed with caution',
    };
  }
}

// ============================================================================
// CATEGORY INFERENCE
// ============================================================================

/**
 * Infer the best category for a product description
 */
export async function inferCategory(
  description: string,
  availableCategories: string[]
): Promise<{
  category: string;
  confidence: number;
  alternatives: string[];
}> {
  const prompt = `Determine the best category for this product/service.

DESCRIPTION: "${description}"

AVAILABLE CATEGORIES:
${availableCategories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond in JSON format:
{
  "category": "best matching category from the list",
  "confidence": 0.0-1.0,
  "alternatives": ["2-3 alternative categories that might also fit"]
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Category inference error:', error);

    return {
      category: availableCategories[0] || 'general',
      confidence: 0.3,
      alternatives: [],
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const AIAssist = {
  parseNaturalLanguageRequest,
  extractSpecsFromDescription,
  suggestMissingRequirements,
  generateIntroMessages,
  summarizeSupplierForBuyer,
  explainMatch,
  inferCategory,
};

export default AIAssist;
