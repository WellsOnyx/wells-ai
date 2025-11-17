/**
 * Contact Intent Detection
 *
 * Detects when users want to manage contacts through natural language.
 * Uses AI to parse queries and extract structured parameters.
 */

export interface ContactIntent {
  detected: boolean
  confidence: number
  action: ContactAction | null
  parameters: ContactParameters
  originalQuery: string
}

export type ContactAction =
  | 'search'
  | 'add'
  | 'update'
  | 'delete'
  | 'create_campaign'
  | 'upload'
  | 'enrich'
  | 'view_stats'

export interface ContactParameters {
  // Search filters
  titles?: string[]
  companies?: string[]
  locations?: string[]
  industries?: string[]
  seniorityLevels?: string[]
  companySizes?: string[]
  keywords?: string[]

  // Targeting
  targetingZone?: '80-90' | '50-below' | '100-avoid'
  minScore?: number
  maxScore?: number

  // Single contact info
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  title?: string

  // Pagination
  limit?: number
  offset?: number

  // Campaign parameters
  campaignName?: string
  useCase?: string
}

/**
 * Detect if the user wants to manage contacts
 */
export function detectContactIntent(
  message: string,
  conversationHistory?: string[]
): ContactIntent {
  const lower = message.toLowerCase()

  // Contact-related keywords
  const contactKeywords = [
    'contact', 'contacts',
    'lead', 'leads',
    'prospect', 'prospects',
    'people', 'person',
    'database', 'crm',
    'vp', 'cto', 'cfo', 'director', 'manager',
    'title', 'company', 'companies',
    'upload', 'import', 'csv'
  ]

  const hasContactKeyword = contactKeywords.some(keyword => lower.includes(keyword))

  if (!hasContactKeyword) {
    return {
      detected: false,
      confidence: 0,
      action: null,
      parameters: {},
      originalQuery: message
    }
  }

  // Detect specific actions
  const action = detectAction(lower)
  const parameters = extractParameters(message, action)

  // Calculate confidence based on clarity
  let confidence = 0.5

  if (action) {
    confidence += 0.3
  }

  if (Object.keys(parameters).length > 0) {
    confidence += 0.2
  }

  return {
    detected: true,
    confidence: Math.min(confidence, 1.0),
    action,
    parameters,
    originalQuery: message
  }
}

/**
 * Detect the contact action from the message
 */
function detectAction(message: string): ContactAction | null {
  // Search actions
  if (
    message.includes('show me') ||
    message.includes('find') ||
    message.includes('search') ||
    message.includes('list') ||
    message.includes('get') ||
    message.includes('who are')
  ) {
    return 'search'
  }

  // Add actions
  if (
    message.includes('add a contact') ||
    message.includes('add contact') ||
    message.includes('create contact') ||
    message.includes('new contact')
  ) {
    return 'add'
  }

  // Upload actions
  if (
    message.includes('upload') ||
    message.includes('import') ||
    message.includes('load contacts') ||
    message.includes('csv') ||
    message.includes('bulk upload')
  ) {
    return 'upload'
  }

  // Campaign actions
  if (
    message.includes('campaign') ||
    message.includes('outreach') ||
    message.includes('start reaching out') ||
    message.includes('send to')
  ) {
    return 'create_campaign'
  }

  // Stats actions
  if (
    message.includes('how many contacts') ||
    message.includes('contact stats') ||
    message.includes('my database') ||
    message.includes('contact count')
  ) {
    return 'view_stats'
  }

  // Enrich actions
  if (
    message.includes('enrich') ||
    message.includes('update data') ||
    message.includes('refresh contacts')
  ) {
    return 'enrich'
  }

  // Update actions
  if (
    message.includes('update contact') ||
    message.includes('edit contact') ||
    message.includes('change contact')
  ) {
    return 'update'
  }

  // Delete actions
  if (
    message.includes('delete contact') ||
    message.includes('remove contact') ||
    message.includes('delete all')
  ) {
    return 'delete'
  }

  // Default to search if we detected contact keywords but no specific action
  return 'search'
}

/**
 * Extract parameters from the message using pattern matching
 */
function extractParameters(message: string, action: ContactAction | null): ContactParameters {
  const params: ContactParameters = {}

  // Extract titles
  const titlePatterns = [
    /\b(ceo|cto|cfo|coo|cmo|vp|vice president|director|manager|head of)\b/gi,
    /\b(chief \w+ officer)\b/gi
  ]

  const titles: string[] = []
  titlePatterns.forEach(pattern => {
    const matches = message.match(pattern)
    if (matches) {
      titles.push(...matches.map(t => t.trim()))
    }
  })

  if (titles.length > 0) {
    params.titles = [...new Set(titles)] // Remove duplicates
  }

  // Extract locations
  const locationPatterns = [
    /\bin ([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g, // "in San Francisco", "in New York"
    /\b([A-Z][A-Z])\b/g, // State codes "CA", "NY"
  ]

  const locations: string[] = []
  locationPatterns.forEach(pattern => {
    const matches = message.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const location = match.replace(/^in\s+/, '').trim()
        if (location.length > 1) {
          locations.push(location)
        }
      })
    }
  })

  if (locations.length > 0) {
    params.locations = [...new Set(locations)]
  }

  // Extract company types
  const companyTypePatterns = [
    /\b(startup|startups)\b/i,
    /\b(enterprise|enterprises)\b/i,
    /\b(series [A-F])\b/i,
    /\b(public company|public companies)\b/i,
    /\b(private company|private companies)\b/i
  ]

  companyTypePatterns.forEach(pattern => {
    const match = message.match(pattern)
    if (match) {
      if (!params.keywords) params.keywords = []
      params.keywords.push(match[0])
    }
  })

  // Extract industries
  const industryPatterns = [
    /\b(tech|technology|saas|fintech|healthcare|finance|ai|ml|biotech)\b/gi,
  ]

  const industries: string[] = []
  industryPatterns.forEach(pattern => {
    const matches = message.match(pattern)
    if (matches) {
      industries.push(...matches.map(i => i.trim()))
    }
  })

  if (industries.length > 0) {
    params.industries = [...new Set(industries)]
  }

  // Extract targeting zone
  if (message.includes('80-90') || message.includes('80 to 90') || message.includes('best match')) {
    params.targetingZone = '80-90'
  }

  // Extract email (for single contact operations)
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  const emailMatch = message.match(emailPattern)
  if (emailMatch) {
    params.email = emailMatch[0]
  }

  // Extract phone (for single contact operations)
  const phonePattern = /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/
  const phoneMatch = message.match(phonePattern)
  if (phoneMatch) {
    params.phone = phoneMatch[0]
  }

  // Extract limit for search results
  const limitPatterns = [
    /\b(top|first) (\d+)\b/i,
    /\b(\d+) (contacts|people|leads)\b/i
  ]

  for (const pattern of limitPatterns) {
    const match = message.match(pattern)
    if (match) {
      const num = parseInt(match[2] || match[1])
      if (!isNaN(num) && num > 0 && num <= 1000) {
        params.limit = num
      }
      break
    }
  }

  return params
}

/**
 * Use Claude AI to extract more complex parameters
 */
export async function extractParametersWithAI(
  message: string,
  conversationHistory: string[]
): Promise<ContactParameters> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[CONTACT_INTENT] No Anthropic API key - falling back to rule-based extraction')
    return extractParameters(message, null)
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Extract contact search parameters from this query. Return ONLY valid JSON, no other text.

Query: "${message}"

Extract these fields if present:
- titles: Array of job titles (e.g., ["VP Sales", "CTO"])
- companies: Array of company names
- locations: Array of locations (city, state, or country)
- industries: Array of industries (e.g., ["SaaS", "FinTech"])
- seniorityLevels: Array of seniority levels (e.g., ["C-Level", "VP", "Director"])
- companySizes: Array of company sizes (e.g., ["51-200", "201-500"])
- keywords: Array of targeting keywords
- targetingZone: One of "80-90", "50-below", or "100-avoid"
- limit: Number of results (max 1000)

Example response:
{"titles": ["VP Sales", "Director Sales"], "locations": ["San Francisco", "CA"], "limit": 50}`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error('AI extraction failed')
    }

    const data = await response.json()
    const content = data.content?.[0]?.text

    if (!content) {
      throw new Error('No content in AI response')
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const extracted = JSON.parse(jsonMatch[0])

    // Validate and clean the extracted parameters
    const cleaned: ContactParameters = {}

    if (Array.isArray(extracted.titles) && extracted.titles.length > 0) {
      cleaned.titles = extracted.titles.filter((t: any) => typeof t === 'string')
    }

    if (Array.isArray(extracted.companies) && extracted.companies.length > 0) {
      cleaned.companies = extracted.companies.filter((c: any) => typeof c === 'string')
    }

    if (Array.isArray(extracted.locations) && extracted.locations.length > 0) {
      cleaned.locations = extracted.locations.filter((l: any) => typeof l === 'string')
    }

    if (Array.isArray(extracted.industries) && extracted.industries.length > 0) {
      cleaned.industries = extracted.industries.filter((i: any) => typeof i === 'string')
    }

    if (Array.isArray(extracted.seniorityLevels) && extracted.seniorityLevels.length > 0) {
      cleaned.seniorityLevels = extracted.seniorityLevels.filter((s: any) => typeof s === 'string')
    }

    if (Array.isArray(extracted.companySizes) && extracted.companySizes.length > 0) {
      cleaned.companySizes = extracted.companySizes.filter((s: any) => typeof s === 'string')
    }

    if (Array.isArray(extracted.keywords) && extracted.keywords.length > 0) {
      cleaned.keywords = extracted.keywords.filter((k: any) => typeof k === 'string')
    }

    if (extracted.targetingZone && ['80-90', '50-below', '100-avoid'].includes(extracted.targetingZone)) {
      cleaned.targetingZone = extracted.targetingZone
    }

    if (typeof extracted.limit === 'number' && extracted.limit > 0 && extracted.limit <= 1000) {
      cleaned.limit = extracted.limit
    }

    return cleaned
  } catch (error) {
    console.error('[CONTACT_INTENT] AI extraction error:', error)
    // Fall back to rule-based extraction
    return extractParameters(message, null)
  }
}
