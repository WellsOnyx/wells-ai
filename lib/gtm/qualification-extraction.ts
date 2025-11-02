/**
 * GTM Qualification Extraction - Use Claude to extract qualification data from conversation
 *
 * Analyzes conversation to extract:
 * - Role type (engineering, sales, executive)
 * - Technical specs / requirements
 * - Compensation
 * - Targeting (companies, industries)
 * - Location
 * - Judgment criteria (the 3 things)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { RoleQualification } from './sourcing-qualification'
import { calculateCompleteness } from './sourcing-qualification'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Extract qualification data from conversation history
 */
export async function extractQualificationFromConversation(
  conversationHistory: Array<{ role: string; content: string }>,
  currentQualification?: Partial<RoleQualification>
): Promise<Partial<RoleQualification>> {
  const conversationText = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Wells'}: ${msg.content}`)
    .join('\n\n')

  const prompt = `You are analyzing a conversation to extract qualification data for a GTM (go-to-market) sourcing journey.

The user is working with Wells AI to find customers for their business. Extract the following information from the conversation:

**Current Qualification State:**
${currentQualification ? JSON.stringify(currentQualification, null, 2) : 'None yet'}

**Conversation:**
${conversationText}

**Extract the following (if mentioned):**

1. **What they sell** (product/service description)
2. **Who they target** (industry, company size, job titles)
3. **Target companies** (specific companies to reach out to)
4. **Companies to avoid** (competitors, non-targets)
5. **Location** (remote, hybrid, on-site, city)
6. **Pricing/Budget** (what they charge, target customer budget)
7. **Success criteria** (How will success be measured? What 3 things matter most?)

**Respond in this exact JSON format:**
{
  "roleType": "other",
  "roleTitle": "GTM Lead Generation" or similar,
  "whatTheySell": "description of product/service",
  "whoTheyTarget": "description of target customers",
  "targeting": {
    "targetCompanies": ["Company A", "Company B"] or null,
    "avoidCompanies": ["Competitor X"] or null,
    "targetIndustries": ["Industry 1", "Industry 2"] or null
  },
  "location": {
    "type": "remote" | "hybrid" | "on-site",
    "city": "City Name" or null,
    "remoteScope": "us-only" | "global" | null
  },
  "compensation": {
    "productPricing": "description of pricing" or null,
    "targetCustomerBudget": "budget range" or null
  },
  "judgmentCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"] or [],
  "completeness": {
    "hasRoleSpecs": true/false,
    "hasCompensation": true/false,
    "hasTargeting": true/false,
    "hasLocation": true/false,
    "hasJudgmentCriteria": true/false,
    "percentComplete": 0-100
  }
}

**Important:**
- Only include information explicitly mentioned in the conversation
- Use null for fields not mentioned
- Be specific and accurate
- For "judgment criteria", extract the 3 most important success factors mentioned`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format')
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[QUALIFICATION] Could not extract JSON from response:', content.text)
    return currentQualification || {}
  }

  const extracted = JSON.parse(jsonMatch[0])

  // Calculate completeness
  const completeness = calculateQualificationCompleteness(extracted)

  return {
    ...extracted,
    completeness,
  }
}

/**
 * Calculate qualification completeness
 */
function calculateQualificationCompleteness(qualification: any): RoleQualification['completeness'] {
  let completed = 0
  const total = 5

  const hasRoleSpecs = !!(qualification.whatTheySell || qualification.whoTheyTarget)
  const hasCompensation = !!(qualification.compensation?.productPricing || qualification.compensation?.targetCustomerBudget)
  const hasTargeting = !!(qualification.targeting?.targetCompanies?.length || qualification.targeting?.targetIndustries?.length)
  const hasLocation = !!qualification.location?.type
  const hasJudgmentCriteria = !!(qualification.judgmentCriteria?.length >= 2)

  if (hasRoleSpecs) completed++
  if (hasCompensation) completed++
  if (hasTargeting) completed++
  if (hasLocation) completed++
  if (hasJudgmentCriteria) completed++

  const percentComplete = Math.round((completed / total) * 100)

  return {
    hasRoleSpecs,
    hasCompensation,
    hasTargeting,
    hasLocation,
    hasJudgmentCriteria,
    percentComplete,
  }
}

/**
 * Get the next question Wells should ask
 */
export function getNextQualificationQuestion(qualification: Partial<RoleQualification>): string | null {
  const completeness = qualification.completeness

  if (!completeness) {
    return "Great! To help you find the right customers, I need to understand your business better. What do you sell?"
  }

  // Check what's missing
  if (!completeness.hasRoleSpecs) {
    if (!qualification.whatTheySell) {
      return "What product or service do you sell?"
    }
    if (!qualification.whoTheyTarget) {
      return "Who are your ideal customers? (Industry, company size, job titles)"
    }
  }

  if (!completeness.hasTargeting) {
    return "Are there specific companies or industries you want me to target?"
  }

  if (!completeness.hasLocation) {
    return "Where are your target customers located? (US-only, global, specific regions)"
  }

  if (!completeness.hasCompensation) {
    return "What's your pricing? This helps me find customers with the right budget."
  }

  if (!completeness.hasJudgmentCriteria) {
    return "This is critical: What 3 things will determine if a customer is a good fit? (This helps me find the *right* prospects, not just any prospects)"
  }

  // Qualification complete!
  return null
}

/**
 * Generate qualification summary for review
 */
export function generateQualificationSummary(qualification: Partial<RoleQualification>): string {
  const parts: string[] = []

  if (qualification.whatTheySell) {
    parts.push(`**What you sell**: ${qualification.whatTheySell}`)
  }

  if (qualification.whoTheyTarget) {
    parts.push(`**Target customers**: ${qualification.whoTheyTarget}`)
  }

  if (qualification.targeting?.targetCompanies?.length) {
    parts.push(`**Target companies**: ${qualification.targeting.targetCompanies.join(', ')}`)
  }

  if (qualification.targeting?.targetIndustries?.length) {
    parts.push(`**Target industries**: ${qualification.targeting.targetIndustries.join(', ')}`)
  }

  if (qualification.location) {
    const loc = qualification.location
    let locStr = loc.type || 'Not specified'
    if (loc.city) locStr += ` in ${loc.city}`
    if (loc.remoteScope) locStr += ` (${loc.remoteScope})`
    parts.push(`**Location**: ${locStr}`)
  }

  if (qualification.compensation?.productPricing) {
    parts.push(`**Pricing**: ${qualification.compensation.productPricing}`)
  }

  if (qualification.judgmentCriteria?.length) {
    parts.push(`**Success criteria**: ${qualification.judgmentCriteria.join(', ')}`)
  }

  if (qualification.completeness) {
    parts.push(`\n**Completeness**: ${qualification.completeness.percentComplete}%`)
  }

  return parts.join('\n')
}

export default {
  extractQualificationFromConversation,
  getNextQualificationQuestion,
  generateQualificationSummary,
}
