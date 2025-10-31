/**
 * Vendor Registration - Low-Hanging Fruit Attribution
 *
 * The idea:
 * 1. AI analyzes prospect's company: "Tesla manufactures electric vehicles"
 * 2. AI detects what they buy: "semiconductors, batteries, software, manufacturing equipment"
 * 3. Check if user sells any of these products
 * 4. If match: Auto-register user as approved vendor in their procurement portal
 * 5. User shows up in Tesla's vendor database
 * 6. Next time Tesla needs that product → User is already in the system
 * 7. Instant credibility + attribution for Wells AI
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface CompanyProcurement {
  companyName: string
  companyDomain: string
  industry: string
  whatTheyBuy: string[] // e.g., ["semiconductors", "batteries", "software"]
  vendorPortalUrl?: string
  registrationProcess: string // Human-readable description
  estimatedAnnualProcurement?: number // If we can estimate
  confidence: number // 0-1
}

export interface VendorMatch {
  userProducts: string[]
  companyNeeds: string[]
  matches: string[] // Products that overlap
  matchScore: number // 0-1
  worthRegistering: boolean
  reason: string
}

export interface VendorRegistrationResult {
  registered: boolean
  portalUrl?: string
  confirmationNumber?: string
  nextSteps: string[]
  error?: string
}

/**
 * Analyze what a company buys (procurement analysis)
 */
export async function analyzeCompanyProcurement(params: {
  companyName: string
  companyDomain: string
  industry?: string
}): Promise<CompanyProcurement> {
  const prompt = `Analyze what this company BUYS (procurement analysis):

Company: ${params.companyName}
Domain: ${params.companyDomain}
Industry: ${params.industry || 'Unknown'}

Your task:
1. What industry are they in?
2. What products/services do they BUY to operate their business?
3. Do they have a vendor portal? (common domains: /vendors, /suppliers, /procurement)
4. What's the typical registration process?

Examples:
- Tesla → Buys: semiconductors, batteries, manufacturing equipment, software, logistics services
- Walmart → Buys: consumer goods, packaging, logistics, IT services, marketing
- Boeing → Buys: aerospace components, software, engineering services, raw materials

Respond in JSON:
{
  "industry": "Industry name",
  "whatTheyBuy": ["product/service 1", "product/service 2", ...],
  "vendorPortalUrl": "https://example.com/vendors or null",
  "registrationProcess": "Brief description of how vendors typically register",
  "estimatedAnnualProcurement": 1000000000,
  "confidence": 0.85
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const analysis = JSON.parse(jsonMatch[0])

  return {
    companyName: params.companyName,
    companyDomain: params.companyDomain,
    industry: analysis.industry,
    whatTheyBuy: analysis.whatTheyBuy || [],
    vendorPortalUrl: analysis.vendorPortalUrl || undefined,
    registrationProcess: analysis.registrationProcess,
    estimatedAnnualProcurement: analysis.estimatedAnnualProcurement,
    confidence: analysis.confidence || 0.5,
  }
}

/**
 * Check if user's products match company's procurement needs
 */
export async function checkVendorMatch(params: {
  userCompany: string
  userProducts: string[] // What user sells
  targetCompany: CompanyProcurement
}): Promise<VendorMatch> {
  const prompt = `Check if there's a product match for vendor registration:

SELLER (User):
Company: ${params.userCompany}
Products/Services: ${params.userProducts.join(', ')}

BUYER (Target):
Company: ${params.targetCompany.companyName}
What they buy: ${params.targetCompany.whatTheyBuy.join(', ')}

Your task:
1. Identify ANY overlaps between what user sells and what target buys
2. Calculate match score (0-1)
3. Determine if it's worth registering as a vendor
4. Provide reasoning

Respond in JSON:
{
  "matches": ["overlapping product/service 1", ...],
  "matchScore": 0.75,
  "worthRegistering": true,
  "reason": "Brief explanation of why this is/isn't a good match"
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const analysis = JSON.parse(jsonMatch[0])

  return {
    userProducts: params.userProducts,
    companyNeeds: params.targetCompany.whatTheyBuy,
    matches: analysis.matches || [],
    matchScore: analysis.matchScore || 0,
    worthRegistering: analysis.worthRegistering || false,
    reason: analysis.reason,
  }
}

/**
 * Generate vendor registration application
 */
export async function generateVendorApplication(params: {
  userCompany: {
    name: string
    domain: string
    products: string[]
    description: string
    annualRevenue?: number
    yearsInBusiness?: number
    certifications?: string[]
  }
  targetCompany: CompanyProcurement
  match: VendorMatch
}): Promise<{
  formData: Record<string, string>
  coverLetter: string
  nextSteps: string[]
}> {
  const prompt = `Generate a vendor registration application:

APPLICANT (User):
Company: ${params.userCompany.name}
Website: ${params.userCompany.domain}
Products: ${params.userCompany.products.join(', ')}
Description: ${params.userCompany.description}
Revenue: ${params.userCompany.annualRevenue ? '$' + params.userCompany.annualRevenue.toLocaleString() : 'N/A'}
Years in Business: ${params.userCompany.yearsInBusiness || 'N/A'}
Certifications: ${params.userCompany.certifications?.join(', ') || 'None'}

TARGET:
Company: ${params.targetCompany.companyName}
What they buy: ${params.targetCompany.whatTheyBuy.join(', ')}
Match reason: ${params.match.reason}

Generate:
1. Common vendor form fields (company info, tax ID, banking, etc.)
2. Professional cover letter explaining why we're a good vendor
3. Next steps for submission

Respond in JSON:
{
  "formData": {
    "companyName": "...",
    "website": "...",
    "productsServices": "...",
    "yearsInBusiness": "...",
    "annualRevenue": "...",
    "taxId": "[USER TO PROVIDE]",
    "dunsNumber": "[USER TO PROVIDE]",
    "bankingInfo": "[USER TO PROVIDE]",
    "certifications": "...",
    "references": "[USER TO PROVIDE]"
  },
  "coverLetter": "Professional cover letter text...",
  "nextSteps": [
    "Step 1",
    "Step 2",
    ...
  ]
}`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  return JSON.parse(jsonMatch[0])
}

/**
 * End-to-end vendor registration flow
 */
export async function analyzeAndRegisterVendor(params: {
  userCompany: {
    name: string
    domain: string
    products: string[]
    description: string
    annualRevenue?: number
    yearsInBusiness?: number
    certifications?: string[]
  }
  prospects: Array<{
    name: string
    company: string
    companyDomain: string
    industry?: string
  }>
}): Promise<
  Array<{
    prospect: string
    company: string
    procurement: CompanyProcurement
    match: VendorMatch
    application?: {
      formData: Record<string, string>
      coverLetter: string
      nextSteps: string[]
    }
    recommendation: 'register' | 'skip' | 'manual_review'
    reason: string
  }>
> {
  const results = []

  for (const prospect of params.prospects) {
    console.log(`\nAnalyzing ${prospect.company}...`)

    // Step 1: Analyze what they buy
    const procurement = await analyzeCompanyProcurement({
      companyName: prospect.company,
      companyDomain: prospect.companyDomain,
      industry: prospect.industry,
    })

    console.log(`  Industry: ${procurement.industry}`)
    console.log(`  They buy: ${procurement.whatTheyBuy.join(', ')}`)

    // Step 2: Check if there's a match
    const match = await checkVendorMatch({
      userCompany: params.userCompany.name,
      userProducts: params.userCompany.products,
      targetCompany: procurement,
    })

    console.log(`  Match score: ${(match.matchScore * 100).toFixed(0)}%`)
    console.log(`  Matches: ${match.matches.join(', ') || 'None'}`)

    // Step 3: Determine recommendation
    let recommendation: 'register' | 'skip' | 'manual_review' = 'skip'
    let reason = match.reason

    if (match.matchScore >= 0.7 && match.worthRegistering) {
      recommendation = 'register'
      reason = `Strong match (${(match.matchScore * 100).toFixed(0)}%). Recommend vendor registration.`
    } else if (match.matchScore >= 0.4 && match.matchScore < 0.7) {
      recommendation = 'manual_review'
      reason = `Moderate match (${(match.matchScore * 100).toFixed(0)}%). Review manually before registering.`
    } else {
      recommendation = 'skip'
      reason = `Low match (${(match.matchScore * 100).toFixed(0)}%). Not worth registering.`
    }

    // Step 4: Generate application if recommended
    let application
    if (recommendation === 'register') {
      console.log(`  ✅ Generating vendor application...`)
      application = await generateVendorApplication({
        userCompany: params.userCompany,
        targetCompany: procurement,
        match,
      })
    }

    results.push({
      prospect: prospect.name,
      company: prospect.company,
      procurement,
      match,
      application,
      recommendation,
      reason,
    })
  }

  return results
}

/**
 * Track vendor registration status in Notion
 */
export async function trackVendorRegistration(params: {
  notionApiKey: string
  vendorDbId: string
  registration: {
    userCompany: string
    targetCompany: string
    status: 'pending' | 'submitted' | 'approved' | 'rejected'
    submittedDate?: Date
    approvedDate?: Date
    confirmationNumber?: string
    portalUrl?: string
    contacts?: string[]
    notes?: string
  }
}): Promise<{ id: string }> {
  const { Client } = require('@notionhq/client')
  const notion = new Client({ auth: params.notionApiKey })

  const page = await notion.pages.create({
    parent: { database_id: params.vendorDbId },
    properties: {
      'User Company': {
        title: [{ text: { content: params.registration.userCompany } }],
      },
      'Target Company': {
        rich_text: [{ text: { content: params.registration.targetCompany } }],
      },
      Status: {
        select: { name: params.registration.status },
      },
      'Submitted Date': params.registration.submittedDate
        ? {
            date: { start: params.registration.submittedDate.toISOString() },
          }
        : undefined,
      'Confirmation Number': params.registration.confirmationNumber
        ? {
            rich_text: [
              { text: { content: params.registration.confirmationNumber } },
            ],
          }
        : undefined,
      'Portal URL': params.registration.portalUrl
        ? {
            url: params.registration.portalUrl,
          }
        : undefined,
      Notes: params.registration.notes
        ? {
            rich_text: [{ text: { content: params.registration.notes } }],
          }
        : undefined,
    },
  })

  return { id: page.id }
}

export default {
  analyzeCompanyProcurement,
  checkVendorMatch,
  generateVendorApplication,
  analyzeAndRegisterVendor,
  trackVendorRegistration,
}
