/**
 * Industry Detector - NLP-based pricing tier classification
 *
 * Analyzes user's product/service description to automatically
 * determine which pricing tier to apply.
 *
 * Default: 10% (gtm-service)
 * Auto-adjust based on detected industry/product type
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export type IndustryTier = 'commodities' | 'standard' | 'high-value' | 'gtm-service'

export interface IndustryDetectionResult {
  tier: IndustryTier
  confidence: number // 0-1
  reasoning: string
  keywords: string[]
  suggestedMargin: number
}

// Commodity indicators (0.5% margin)
const COMMODITY_KEYWORDS = [
  // Agriculture
  'vegetables', 'grain', 'wheat', 'corn', 'soybeans', 'rice', 'livestock',
  'cattle', 'pigs', 'chickens', 'eggs', 'milk', 'dairy', 'produce',
  // Raw materials
  'lumber', 'wood', 'steel', 'aluminum', 'copper', 'iron', 'coal',
  'oil', 'gas', 'petroleum', 'natural gas', 'crude',
  // Wholesale food
  'wholesale food', 'food distributor', 'bulk food', 'food supply',
  // Other commodities
  'commodity', 'commodities', 'bulk', 'raw materials', 'raw goods',
]

// Standard B2B indicators (2% margin)
const STANDARD_KEYWORDS = [
  // Manufacturing
  'manufacturing', 'factory', 'production', 'assembly', 'fabrication',
  // Distribution
  'distribution', 'wholesale', 'distributor', 'supply chain', 'logistics',
  // Components
  'components', 'parts', 'supplies', 'materials', 'equipment',
  // Electronics (non-semiconductor)
  'electronics', 'computers', 'hardware', 'machinery', 'tools',
  // Construction
  'construction', 'building materials', 'concrete', 'plumbing', 'electrical',
]

// High-value indicators (3% margin)
const HIGH_VALUE_KEYWORDS = [
  // Semiconductors
  'semiconductor', 'chips', 'wafers', 'silicon', 'fab', 'foundry',
  'microprocessor', 'integrated circuit', 'IC', 'ASIC', 'FPGA',
  // Professional services
  'executive search', 'recruiting', 'headhunter', 'placement',
  'consulting', 'consultant', 'advisory', 'professional services',
  // Software
  'software', 'SaaS', 'platform', 'technology', 'IT services',
  'development', 'engineering services', 'design services',
  // Specialized
  'medical devices', 'pharmaceuticals', 'biotech', 'aerospace',
  'defense', 'security', 'enterprise', 'custom solutions',
]

// GTM service indicators (10% margin) - default
const GTM_SERVICE_KEYWORDS = [
  'find customers', 'get clients', 'generate leads', 'sales automation',
  'close deals', 'business development', 'GTM', 'go to market',
  'demand generation', 'lead generation', 'sales pipeline',
]

/**
 * Detect industry tier from user's description using Claude
 */
export async function detectIndustryTier(
  productDescription: string,
  conversationHistory?: string[]
): Promise<IndustryDetectionResult> {
  // Build context from conversation history
  const context = conversationHistory
    ? `Previous conversation:\n${conversationHistory.join('\n')}\n\nCurrent request: ${productDescription}`
    : productDescription

  const prompt = `You are analyzing a B2B transaction to determine the appropriate pricing tier.

The user described their product/service as: "${productDescription}"

Classify into ONE of these tiers:

1. COMMODITIES (0.5% margin) - Low-margin bulk goods
   Examples: vegetables, grain, livestock, raw materials, bulk food, lumber, basic metals
   Characteristics: <2% profit margin, high volume, price-sensitive

2. STANDARD (2% margin) - Standard B2B products/services
   Examples: manufacturing, distribution, components, electronics, construction materials
   Characteristics: 5-15% profit margin, moderate volume

3. HIGH-VALUE (3% margin) - Specialized/premium products/services
   Examples: semiconductors, executive search, consulting, software, medical devices
   Characteristics: 20%+ profit margin, specialized expertise

4. GTM-SERVICE (10% margin) - Full sales automation service
   Examples: "Find me customers", "Close deals for me", "Generate leads"
   Characteristics: We're providing the entire sales function, not just a product

DEFAULT TO: GTM-SERVICE (10%) unless clear evidence of another tier.

Respond in JSON format:
{
  "tier": "commodities" | "standard" | "high-value" | "gtm-service",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this tier was chosen",
  "keywords": ["key", "words", "that", "indicated", "this", "tier"],
  "suggestedMargin": 0.005 | 0.02 | 0.03 | 0.10
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response')
    }

    const result = JSON.parse(jsonMatch[0]) as IndustryDetectionResult

    console.log('Industry detection result:', result)
    return result
  } catch (error) {
    console.error('Error detecting industry tier:', error)

    // Fallback: use keyword matching
    return detectIndustryTierFallback(productDescription)
  }
}

/**
 * Fallback: Simple keyword-based detection if Claude fails
 */
export function detectIndustryTierFallback(
  productDescription: string
): IndustryDetectionResult {
  const lowerDesc = productDescription.toLowerCase()

  // Check for commodity keywords
  const commodityMatches = COMMODITY_KEYWORDS.filter((kw) => lowerDesc.includes(kw))
  if (commodityMatches.length > 0) {
    return {
      tier: 'commodities',
      confidence: 0.8,
      reasoning: `Detected commodity-related keywords: ${commodityMatches.join(', ')}`,
      keywords: commodityMatches,
      suggestedMargin: 0.005,
    }
  }

  // Check for standard B2B keywords
  const standardMatches = STANDARD_KEYWORDS.filter((kw) => lowerDesc.includes(kw))
  if (standardMatches.length > 0) {
    return {
      tier: 'standard',
      confidence: 0.7,
      reasoning: `Detected standard B2B keywords: ${standardMatches.join(', ')}`,
      keywords: standardMatches,
      suggestedMargin: 0.02,
    }
  }

  // Check for high-value keywords
  const highValueMatches = HIGH_VALUE_KEYWORDS.filter((kw) => lowerDesc.includes(kw))
  if (highValueMatches.length > 0) {
    return {
      tier: 'high-value',
      confidence: 0.8,
      reasoning: `Detected high-value keywords: ${highValueMatches.join(', ')}`,
      keywords: highValueMatches,
      suggestedMargin: 0.03,
    }
  }

  // Check for GTM service keywords
  const gtmMatches = GTM_SERVICE_KEYWORDS.filter((kw) => lowerDesc.includes(kw))
  if (gtmMatches.length > 0) {
    return {
      tier: 'gtm-service',
      confidence: 0.9,
      reasoning: `User requesting full sales automation: ${gtmMatches.join(', ')}`,
      keywords: gtmMatches,
      suggestedMargin: 0.10,
    }
  }

  // Default: GTM service (10%)
  return {
    tier: 'gtm-service',
    confidence: 0.5,
    reasoning: 'No specific tier indicators found, defaulting to GTM service pricing',
    keywords: [],
    suggestedMargin: 0.10,
  }
}

/**
 * Get human-readable tier description
 */
export function getTierDescription(tier: IndustryTier): string {
  const descriptions = {
    commodities:
      'Commodities/Agriculture (0.5% margin) - Low-margin bulk goods like vegetables, grain, raw materials',
    standard:
      'Standard B2B (2% margin) - Manufacturing, distribution, components, standard products/services',
    'high-value':
      'High-Value Services (3% margin) - Semiconductors, executive search, consulting, specialized services',
    'gtm-service':
      'Full GTM Service (10% margin) - Complete sales automation from demand generation to close',
  }
  return descriptions[tier]
}

/**
 * Example: Detect tier from user input
 */
export async function exampleDetection() {
  const examples = [
    'I need to sell 50 tons of organic vegetables to restaurants',
    'Looking for semiconductor wafers from TSMC',
    'Help me find an executive for our VP of Engineering role',
    'I want Wells AI to find customers and close deals for me',
  ]

  console.log('Industry Tier Detection Examples:\n')

  for (const example of examples) {
    const result = await detectIndustryTier(example)
    console.log(`Input: "${example}"`)
    console.log(`Tier: ${result.tier} (${(result.confidence * 100).toFixed(0)}% confident)`)
    console.log(`Margin: ${(result.suggestedMargin * 100).toFixed(1)}%`)
    console.log(`Reasoning: ${result.reasoning}`)
    console.log()
  }
}

export default {
  detectIndustryTier,
  detectIndustryTierFallback,
  getTierDescription,
}
