// @ts-nocheck
/**
 * Conversational Jobs Service
 *
 * Business logic layer for handling job-related operations through conversation.
 * Provides natural language interfaces for:
 *
 * 1. Job Search & Discovery
 *    - Parse natural language queries into structured searches
 *    - Match jobs to user profiles with AI-powered ranking
 *    - Generate personalized recommendations
 *
 * 2. Application Management
 *    - Submit applications with AI-generated cover letters
 *    - Track application status and timeline
 *    - Prepare for interviews with AI coaching
 *
 * 3. Offer Negotiation
 *    - Analyze offers against market data
 *    - Generate negotiation strategies
 *    - Craft professional counter-offers
 *    - Track negotiation history
 *
 * 4. Salary Intelligence
 *    - Provide market rate data
 *    - Compare compensation packages
 *    - Generate negotiation talking points
 *
 * 5. Career Coaching
 *    - Resume optimization suggestions
 *    - Skill gap analysis
 *    - Career path recommendations
 */

import Anthropic from '@anthropic-ai/sdk'
import { sqlQuery as sql } from '@/lib/db'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationalJobsConfig {
  userId: string
  sessionId?: string
  enableAIAssist?: boolean
  autoApply?: boolean
  salaryFloor?: number
}

export interface JobSearchRequest {
  query: string
  filters?: {
    title?: string
    company?: string
    location?: string
    remote?: boolean
    salaryMin?: number
    salaryMax?: number
    jobType?: 'full-time' | 'part-time' | 'contract' | 'freelance'
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive'
    industry?: string
    postedWithin?: number
  }
  limit?: number
  offset?: number
}

export interface JobSearchResult {
  jobs: JobListing[]
  totalCount: number
  searchId: string
  matchedFilters: string[]
  suggestedRefinements: string[]
}

export interface JobListing {
  id: string
  title: string
  company: string
  companyInfo?: {
    size: string
    industry: string
    founded: number
    description: string
    rating: number
    reviewCount: number
  }
  location: string
  isRemote: boolean
  salary: {
    min: number
    max: number
    currency: string
    period: 'yearly' | 'monthly' | 'hourly'
  }
  equity?: {
    min: string
    max: string
  }
  bonus?: {
    target: number
    type: 'annual' | 'signing' | 'performance'
  }
  type: 'full-time' | 'part-time' | 'contract' | 'freelance'
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive'
  description: string
  responsibilities: string[]
  requirements: string[]
  preferredQualifications: string[]
  benefits: string[]
  skills: string[]
  postedAt: Date
  expiresAt?: Date
  applicationCount?: number
  viewCount?: number
  match: {
    score: number
    reasons: string[]
    gaps: string[]
    highlights: string[]
  }
}

export interface ApplicationRequest {
  jobId: string
  userId: string
  resumeId?: string
  customCoverLetter?: string
  useAICoverLetter?: boolean
  customAnswers?: Record<string, string>
  referralCode?: string
}

export interface ApplicationResult {
  applicationId: string
  status: ApplicationStatus
  submittedAt: Date
  coverLetter?: string
  estimatedResponseTime?: string
  nextSteps: string[]
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'screening'
  | 'phone_screen'
  | 'technical_interview'
  | 'onsite_interview'
  | 'final_round'
  | 'reference_check'
  | 'offer_pending'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'rejected'
  | 'withdrawn'

export interface ApplicationTracker {
  id: string
  jobId: string
  job: JobListing
  status: ApplicationStatus
  statusHistory: StatusChange[]
  appliedAt: Date
  lastUpdated: Date
  nextAction?: {
    type: string
    description: string
    dueDate?: Date
  }
  interviews: Interview[]
  notes: string[]
  contacts: Contact[]
}

export interface StatusChange {
  status: ApplicationStatus
  changedAt: Date
  notes?: string
}

export interface Interview {
  id: string
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'behavioral' | 'final'
  scheduledAt?: Date
  duration?: number
  interviewers?: string[]
  topics?: string[]
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  feedback?: string
  rating?: number
}

export interface Contact {
  name: string
  role: string
  email?: string
  linkedIn?: string
  notes?: string
}

export interface OfferDetails {
  id: string
  applicationId: string
  company: string
  title: string
  compensation: {
    baseSalary: number
    signingBonus?: number
    annualBonus?: {
      target: number
      type: 'percentage' | 'fixed'
    }
    equity?: {
      type: 'options' | 'rsus' | 'phantom'
      amount: string
      vestingSchedule: string
      cliffMonths: number
      vestingMonths: number
      strikePrice?: number
    }
    relocation?: number
    otherBenefits?: string[]
  }
  benefits: {
    health: string
    dental: string
    vision: string
    retirement: {
      type: string
      match: string
    }
    pto: string
    parental: string
    other: string[]
  }
  startDate: Date
  deadline: Date
  status: 'pending' | 'negotiating' | 'accepted' | 'declined' | 'expired' | 'withdrawn'
  negotiationHistory: NegotiationRound[]
  marketComparison: MarketComparison
}

export interface NegotiationRound {
  id: string
  round: number
  type: 'initial_offer' | 'counter_offer' | 'final_offer'
  initiatedBy: 'candidate' | 'employer'
  terms: {
    baseSalary?: number
    signingBonus?: number
    equity?: string
    startDate?: Date
    otherTerms?: string
  }
  message?: string
  createdAt: Date
  respondedAt?: Date
  status: 'pending' | 'accepted' | 'countered' | 'rejected'
}

export interface MarketComparison {
  role: string
  location: string
  percentile: number
  medianSalary: number
  salaryRange: { min: number; max: number }
  equityRange?: { min: string; max: string }
  sampleSize: number
  dataFreshness: Date
  competitiveness: 'below_market' | 'at_market' | 'above_market' | 'highly_competitive'
  recommendation: string
}

export interface NegotiationStrategy {
  targetCompensation: {
    baseSalary: number
    signingBonus?: number
    equity?: string
  }
  justification: string[]
  talkingPoints: string[]
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  }
  alternativeScenarios: {
    scenario: string
    counterStrategy: string
  }[]
  suggestedMessage: string
}

export interface SalaryIntelligence {
  role: string
  normalizedTitle: string
  location: string
  experience?: number
  skills?: string[]
  dataPoints: number
  lastUpdated: Date
  baseSalary: {
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
    mean: number
  }
  totalCompensation: {
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
    mean: number
  }
  byCompanySize: {
    startup: { median: number; range: { min: number; max: number } }
    midsize: { median: number; range: { min: number; max: number } }
    enterprise: { median: number; range: { min: number; max: number } }
  }
  byIndustry: {
    [industry: string]: { median: number; sampleSize: number }
  }
  trends: {
    yoyChange: number
    qoqChange: number
    fiveYearTrend: number
    demandIndex: number
    supplyIndex: number
    marketOutlook: 'growing' | 'stable' | 'declining'
  }
  topPayingCompanies: {
    name: string
    avgTotal: number
    openRoles: number
  }[]
  negotiationInsights: string[]
}

export interface UserJobProfile {
  id: string
  userId: string
  headline?: string
  summary?: string
  skills: Skill[]
  experience: Experience[]
  education: Education[]
  preferences: JobPreferences
  resume?: Resume
  availability: Availability
  createdAt: Date
  updatedAt: Date
}

export interface Skill {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  yearsOfExperience?: number
  endorsed?: boolean
}

export interface Experience {
  title: string
  company: string
  location?: string
  startDate: Date
  endDate?: Date
  current: boolean
  description?: string
  skills?: string[]
  achievements?: string[]
}

export interface Education {
  degree: string
  field: string
  institution: string
  graduationDate?: Date
  gpa?: number
  honors?: string[]
}

export interface JobPreferences {
  desiredRoles: string[]
  desiredSalary: { min: number; max: number; currency: string }
  preferredLocations: string[]
  openToRemote: boolean
  openToRelocation: boolean
  preferredCompanySize?: string[]
  preferredIndustries?: string[]
  mustHaves?: string[]
  dealBreakers?: string[]
  noticePeriod?: number
}

export interface Resume {
  id: string
  fileName: string
  content?: string
  parsedData?: Record<string, unknown>
  uploadedAt: Date
}

export interface Availability {
  status: 'actively_looking' | 'open' | 'not_looking'
  startDate?: Date
  noticePeriod?: number
}

// ============================================================================
// CONVERSATIONAL JOBS SERVICE
// ============================================================================

export class ConversationalJobsService {
  private config: ConversationalJobsConfig

  constructor(config: ConversationalJobsConfig) {
    this.config = {
      enableAIAssist: true,
      autoApply: false,
      ...config,
    }
  }

  // ==========================================================================
  // JOB SEARCH
  // ==========================================================================

  /**
   * Search for jobs using natural language
   */
  async searchJobs(request: JobSearchRequest): Promise<JobSearchResult> {
    const { query, filters = {}, limit = 20, offset = 0 } = request

    // Parse natural language query into structured filters
    const parsedFilters = await this.parseSearchQuery(query)
    const mergedFilters = { ...parsedFilters, ...filters }

    // Get user profile for matching
    const profile = await this.getUserProfile()

    // Execute search
    const jobs = await this.executeJobSearch(mergedFilters, profile, limit, offset)

    // Calculate matches
    const matchedJobs = await this.calculateJobMatches(jobs, profile)

    // Sort by match score
    matchedJobs.sort((a, b) => b.match.score - a.match.score)

    // Generate refinement suggestions
    const refinements = this.generateSearchRefinements(matchedJobs, mergedFilters)

    return {
      jobs: matchedJobs,
      totalCount: matchedJobs.length,
      searchId: `search_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      matchedFilters: Object.entries(mergedFilters)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`),
      suggestedRefinements: refinements,
    }
  }

  /**
   * Get personalized job recommendations
   */
  async getRecommendations(): Promise<JobSearchResult> {
    const profile = await this.getUserProfile()

    if (!profile) {
      return {
        jobs: [],
        totalCount: 0,
        searchId: '',
        matchedFilters: [],
        suggestedRefinements: ['Complete your profile to get personalized recommendations'],
      }
    }

    // Build recommendation query from profile
    const query = this.buildRecommendationQuery(profile)

    return this.searchJobs({ query })
  }

  /**
   * Parse natural language into search filters
   */
  private async parseSearchQuery(query: string): Promise<JobSearchRequest['filters']> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Parse this job search query into structured filters. Return JSON only.

Query: "${query}"

Return format:
{
  "title": "extracted job title or null",
  "company": "specific company or null",
  "location": "location or null",
  "remote": true if remote mentioned, false if on-site required, null otherwise,
  "salaryMin": minimum salary number or null,
  "salaryMax": maximum salary number or null,
  "jobType": "full-time/part-time/contract/freelance" or null,
  "experienceLevel": "entry/mid/senior/executive" or null,
  "industry": "industry or null",
  "skills": ["extracted", "skills"] or null
}`
        }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('[ConversationalJobs] Parse error:', error)
    }

    return {}
  }

  /**
   * Execute the actual job search
   */
  private async executeJobSearch(
    filters: JobSearchRequest['filters'],
    profile: UserJobProfile | null,
    limit: number,
    offset: number
  ): Promise<JobListing[]> {
    // TODO: Replace with actual database query
    // This would query your jobs table with the filters

    // Mock implementation for demonstration
    const mockJobs = this.generateMockJobs(filters, 10)
    return mockJobs
  }

  /**
   * Calculate match scores for jobs
   */
  private async calculateJobMatches(
    jobs: JobListing[],
    profile: UserJobProfile | null
  ): Promise<JobListing[]> {
    if (!profile) {
      return jobs.map(job => ({
        ...job,
        match: {
          score: 70 + Math.random() * 30,
          reasons: ['Matches your search criteria'],
          gaps: [],
          highlights: [],
        },
      }))
    }

    return jobs.map(job => {
      const { score, reasons, gaps, highlights } = this.calculateMatchDetails(job, profile)
      return {
        ...job,
        match: { score, reasons, gaps, highlights },
      }
    })
  }

  /**
   * Calculate detailed match between job and profile
   */
  private calculateMatchDetails(
    job: JobListing,
    profile: UserJobProfile
  ): { score: number; reasons: string[]; gaps: string[]; highlights: string[] } {
    let score = 50
    const reasons: string[] = []
    const gaps: string[] = []
    const highlights: string[] = []

    // Skills match
    const profileSkills = profile.skills.map(s => s.name.toLowerCase())
    const jobSkills = job.skills.map(s => s.toLowerCase())
    const matchedSkills = jobSkills.filter(s => profileSkills.includes(s))
    const skillMatchRate = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0

    if (skillMatchRate > 0.8) {
      score += 25
      reasons.push(`Strong skill match (${matchedSkills.length}/${jobSkills.length} skills)`)
      highlights.push('Your skills align well with requirements')
    } else if (skillMatchRate > 0.5) {
      score += 15
      reasons.push(`Good skill match (${matchedSkills.length}/${jobSkills.length} skills)`)
    } else {
      const missingSkills = jobSkills.filter(s => !profileSkills.includes(s))
      gaps.push(`Missing skills: ${missingSkills.slice(0, 3).join(', ')}`)
    }

    // Salary alignment
    const prefs = profile.preferences
    if (prefs.desiredSalary) {
      if (job.salary.max >= prefs.desiredSalary.min) {
        score += 15
        reasons.push('Salary within your range')
      } else {
        gaps.push('Salary below your minimum')
        score -= 10
      }
    }

    // Location/remote match
    if (job.isRemote && prefs.openToRemote) {
      score += 10
      highlights.push('Remote-friendly')
    } else if (prefs.preferredLocations?.some(loc =>
      job.location.toLowerCase().includes(loc.toLowerCase())
    )) {
      score += 10
      reasons.push('Location match')
    }

    // Experience level match
    const expYears = profile.experience.reduce((total, exp) => {
      const end = exp.endDate || new Date()
      const start = exp.startDate
      return total + (end.getFullYear() - start.getFullYear())
    }, 0)

    const levelMap: Record<string, [number, number]> = {
      'entry': [0, 2],
      'mid': [2, 5],
      'senior': [5, 10],
      'executive': [10, 100],
    }

    const [minExp, maxExp] = levelMap[job.experienceLevel] || [0, 100]
    if (expYears >= minExp && expYears <= maxExp + 2) {
      score += 10
    } else if (expYears > maxExp) {
      highlights.push('You exceed experience requirements')
    } else {
      gaps.push(`Requires ${minExp}-${maxExp} years experience`)
    }

    return {
      score: Math.min(100, Math.max(0, Math.round(score))),
      reasons,
      gaps,
      highlights,
    }
  }

  /**
   * Generate search refinement suggestions
   */
  private generateSearchRefinements(
    jobs: JobListing[],
    filters: JobSearchRequest['filters']
  ): string[] {
    const refinements: string[] = []

    if (!filters?.remote) {
      const remoteCount = jobs.filter(j => j.isRemote).length
      if (remoteCount > 0) {
        refinements.push(`Show only remote (${remoteCount} available)`)
      }
    }

    if (!filters?.salaryMin) {
      refinements.push('Set minimum salary filter')
    }

    if (!filters?.experienceLevel) {
      refinements.push('Filter by experience level')
    }

    return refinements
  }

  /**
   * Build recommendation query from profile
   */
  private buildRecommendationQuery(profile: UserJobProfile): string {
    const parts: string[] = []

    if (profile.preferences.desiredRoles?.length) {
      parts.push(profile.preferences.desiredRoles[0])
    }

    if (profile.skills?.length) {
      parts.push(`with ${profile.skills.slice(0, 3).map(s => s.name).join(', ')} skills`)
    }

    if (profile.preferences.openToRemote) {
      parts.push('remote')
    } else if (profile.preferences.preferredLocations?.length) {
      parts.push(`in ${profile.preferences.preferredLocations[0]}`)
    }

    if (profile.preferences.desiredSalary?.min) {
      parts.push(`$${profile.preferences.desiredSalary.min / 1000}K+`)
    }

    return parts.join(' ')
  }

  // ==========================================================================
  // APPLICATION MANAGEMENT
  // ==========================================================================

  /**
   * Apply to a job with AI-assisted cover letter
   */
  async applyToJob(request: ApplicationRequest): Promise<ApplicationResult> {
    const { jobId, userId, useAICoverLetter = true, customCoverLetter } = request

    // Get job details
    const job = await this.getJobById(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Check for existing application
    const existing = await this.checkExistingApplication(userId, jobId)
    if (existing) {
      throw new Error(`You've already applied to this position`)
    }

    // Get user profile
    const profile = await this.getUserProfile()

    // Generate or use cover letter
    let coverLetter = customCoverLetter
    if (useAICoverLetter && !coverLetter) {
      coverLetter = await this.generateCoverLetter(job, profile)
    }

    // Submit application
    const applicationId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Save to database
    await this.saveApplication({
      id: applicationId,
      jobId,
      userId,
      status: 'submitted',
      coverLetter,
      submittedAt: new Date(),
    })

    // Estimate response time based on company data
    const estimatedResponse = this.estimateResponseTime(job)

    return {
      applicationId,
      status: 'submitted',
      submittedAt: new Date(),
      coverLetter,
      estimatedResponseTime: estimatedResponse,
      nextSteps: [
        `${job.company} will review your application`,
        'Expected response time: ' + estimatedResponse,
        'Prepare for potential phone screen',
        'Research recent company news and projects',
      ],
    }
  }

  /**
   * Generate AI-powered cover letter
   */
  async generateCoverLetter(job: JobListing, profile: UserJobProfile | null): Promise<string> {
    const prompt = `Write a compelling, personalized cover letter for this job application.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description}
- Key Requirements: ${job.requirements.slice(0, 5).join(', ')}

CANDIDATE:
${profile ? `
- Current Role: ${profile.experience[0]?.title || 'Professional'}
- Years of Experience: ${profile.experience.length} positions
- Key Skills: ${profile.skills.slice(0, 5).map(s => s.name).join(', ')}
- Background: ${profile.summary || 'Experienced professional'}
` : '- Professional candidate'}

Write a cover letter that:
1. Opens with a compelling hook specific to the company/role
2. Highlights 2-3 most relevant experiences
3. Shows enthusiasm for the company's mission
4. Ends with a clear call to action
5. Is concise (250-350 words)
6. Uses a professional but personable tone

DO NOT use generic phrases like "I am writing to express my interest" or "I believe I would be a great fit".`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      return response.content[0]?.type === 'text' ? response.content[0].text : ''
    } catch (error) {
      console.error('[ConversationalJobs] Cover letter error:', error)
      return ''
    }
  }

  /**
   * Get application status and details
   */
  async getApplicationStatus(applicationId: string): Promise<ApplicationTracker | null> {
    // TODO: Query database
    return null
  }

  /**
   * Get all applications for user
   */
  async getUserApplications(status?: ApplicationStatus): Promise<ApplicationTracker[]> {
    // TODO: Query database
    return []
  }

  /**
   * Withdraw an application
   */
  async withdrawApplication(applicationId: string): Promise<boolean> {
    // TODO: Update database
    return true
  }

  // ==========================================================================
  // OFFER NEGOTIATION
  // ==========================================================================

  /**
   * Get current pending offers
   */
  async getPendingOffers(): Promise<OfferDetails[]> {
    // TODO: Query database
    return []
  }

  /**
   * Analyze an offer and provide market comparison
   */
  async analyzeOffer(offerId: string): Promise<{
    offer: OfferDetails
    analysis: MarketComparison
    strategy: NegotiationStrategy
  }> {
    const offer = await this.getOfferById(offerId)
    if (!offer) {
      throw new Error(`Offer ${offerId} not found`)
    }

    const analysis = await this.getMarketComparison(offer)
    const strategy = await this.generateNegotiationStrategy(offer, analysis)

    return { offer, analysis, strategy }
  }

  /**
   * Generate negotiation strategy
   */
  async generateNegotiationStrategy(
    offer: OfferDetails,
    market: MarketComparison
  ): Promise<NegotiationStrategy> {
    const targetIncrease = market.competitiveness === 'below_market' ? 0.15 :
                          market.competitiveness === 'at_market' ? 0.10 : 0.05

    const targetBase = Math.round(offer.compensation.baseSalary * (1 + targetIncrease))

    // Use AI to generate strategy
    try {
      const prompt = `Generate a negotiation strategy for this job offer:

CURRENT OFFER:
- Base Salary: $${offer.compensation.baseSalary.toLocaleString()}
- Signing Bonus: $${offer.compensation.signingBonus?.toLocaleString() || 0}
- Equity: ${offer.compensation.equity?.amount || 'None'}
- Company: ${offer.company}
- Role: ${offer.title}

MARKET DATA:
- Market Median: $${market.medianSalary.toLocaleString()}
- Your Percentile: ${market.percentile}th
- Market Assessment: ${market.competitiveness}

TARGET:
- Target Base: $${targetBase.toLocaleString()}

Provide:
1. 3-4 key justification points
2. 4-5 talking points for negotiation
3. Risk assessment
4. 2-3 alternative scenarios with counter-strategies
5. A professional message to send

Format as JSON.`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          targetCompensation: { baseSalary: targetBase },
          justification: parsed.justification || [],
          talkingPoints: parsed.talkingPoints || [],
          riskAssessment: parsed.riskAssessment || { level: 'medium', factors: [] },
          alternativeScenarios: parsed.alternativeScenarios || [],
          suggestedMessage: parsed.suggestedMessage || '',
        }
      }
    } catch (error) {
      console.error('[ConversationalJobs] Strategy error:', error)
    }

    // Fallback strategy
    return {
      targetCompensation: { baseSalary: targetBase },
      justification: [
        `Market data shows median of $${market.medianSalary.toLocaleString()}`,
        'Your experience justifies higher compensation',
        'The role responsibilities warrant this level',
      ],
      talkingPoints: [
        'Express enthusiasm for the opportunity',
        'Reference market data professionally',
        'Highlight unique value you bring',
        'Be collaborative, not adversarial',
      ],
      riskAssessment: {
        level: 'medium',
        factors: ['Standard negotiation risk', 'Reasonable ask based on market'],
      },
      alternativeScenarios: [],
      suggestedMessage: `Thank you for the offer. I'm very excited about joining ${offer.company}. Based on my research and experience, I was hoping we could discuss the base salary. Would $${targetBase.toLocaleString()} be possible?`,
    }
  }

  /**
   * Submit a counter-offer
   */
  async submitCounterOffer(
    offerId: string,
    counter: Partial<NegotiationRound['terms']>,
    message?: string
  ): Promise<NegotiationRound> {
    const offer = await this.getOfferById(offerId)
    if (!offer) {
      throw new Error(`Offer ${offerId} not found`)
    }

    const round: NegotiationRound = {
      id: `counter_${Date.now()}`,
      round: offer.negotiationHistory.length + 1,
      type: 'counter_offer',
      initiatedBy: 'candidate',
      terms: counter,
      message,
      createdAt: new Date(),
      status: 'pending',
    }

    // Save to database
    await this.saveNegotiationRound(offerId, round)

    return round
  }

  /**
   * Accept an offer
   */
  async acceptOffer(offerId: string, startDate?: Date): Promise<{ success: boolean; message: string }> {
    const offer = await this.getOfferById(offerId)
    if (!offer) {
      throw new Error(`Offer ${offerId} not found`)
    }

    // Update offer status
    await this.updateOfferStatus(offerId, 'accepted')

    // Update related application
    await this.updateApplicationStatus(offer.applicationId, 'offer_accepted')

    return {
      success: true,
      message: `Congratulations! You've accepted the ${offer.title} position at ${offer.company}. Your start date is ${(startDate || offer.startDate).toLocaleDateString()}.`,
    }
  }

  /**
   * Decline an offer
   */
  async declineOffer(offerId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const offer = await this.getOfferById(offerId)
    if (!offer) {
      throw new Error(`Offer ${offerId} not found`)
    }

    // Update offer status
    await this.updateOfferStatus(offerId, 'declined')

    // Update related application
    await this.updateApplicationStatus(offer.applicationId, 'offer_declined')

    return {
      success: true,
      message: `You've declined the offer from ${offer.company}. ${reason ? 'Reason recorded.' : ''}`,
    }
  }

  // ==========================================================================
  // SALARY INTELLIGENCE
  // ==========================================================================

  /**
   * Get salary intelligence for a role
   */
  async getSalaryIntelligence(
    role: string,
    location?: string,
    experience?: number
  ): Promise<SalaryIntelligence> {
    // TODO: Query actual salary database (Levels.fyi, Glassdoor, etc.)

    // Mock implementation
    const baseSalaryMedian = 185000
    const variance = 0.3

    return {
      role,
      normalizedTitle: this.normalizeJobTitle(role),
      location: location || 'United States',
      experience,
      dataPoints: 1250,
      lastUpdated: new Date(),
      baseSalary: {
        p10: Math.round(baseSalaryMedian * 0.7),
        p25: Math.round(baseSalaryMedian * 0.85),
        p50: baseSalaryMedian,
        p75: Math.round(baseSalaryMedian * 1.15),
        p90: Math.round(baseSalaryMedian * 1.35),
        mean: Math.round(baseSalaryMedian * 1.02),
      },
      totalCompensation: {
        p10: Math.round(baseSalaryMedian * 0.9),
        p25: Math.round(baseSalaryMedian * 1.1),
        p50: Math.round(baseSalaryMedian * 1.3),
        p75: Math.round(baseSalaryMedian * 1.6),
        p90: Math.round(baseSalaryMedian * 2.0),
        mean: Math.round(baseSalaryMedian * 1.4),
      },
      byCompanySize: {
        startup: { median: Math.round(baseSalaryMedian * 0.9), range: { min: Math.round(baseSalaryMedian * 0.7), max: Math.round(baseSalaryMedian * 1.4) } },
        midsize: { median: baseSalaryMedian, range: { min: Math.round(baseSalaryMedian * 0.8), max: Math.round(baseSalaryMedian * 1.2) } },
        enterprise: { median: Math.round(baseSalaryMedian * 1.1), range: { min: Math.round(baseSalaryMedian * 0.9), max: Math.round(baseSalaryMedian * 1.5) } },
      },
      byIndustry: {
        'Technology': { median: Math.round(baseSalaryMedian * 1.1), sampleSize: 450 },
        'Finance': { median: Math.round(baseSalaryMedian * 1.15), sampleSize: 280 },
        'Healthcare': { median: Math.round(baseSalaryMedian * 0.95), sampleSize: 200 },
        'Retail': { median: Math.round(baseSalaryMedian * 0.85), sampleSize: 150 },
      },
      trends: {
        yoyChange: 8.5,
        qoqChange: 2.1,
        fiveYearTrend: 45,
        demandIndex: 85,
        supplyIndex: 60,
        marketOutlook: 'growing',
      },
      topPayingCompanies: [
        { name: 'Google', avgTotal: 350000, openRoles: 120 },
        { name: 'Meta', avgTotal: 340000, openRoles: 85 },
        { name: 'Apple', avgTotal: 320000, openRoles: 95 },
        { name: 'Netflix', avgTotal: 400000, openRoles: 25 },
        { name: 'Microsoft', avgTotal: 300000, openRoles: 200 },
      ],
      negotiationInsights: [
        'Market demand is high - use this as leverage',
        '85% of companies expect negotiation on initial offers',
        'Focus on total compensation, not just base salary',
        'Remote work has leveled geographic pay differences by 15%',
        'Equity compensation has increased 20% YoY',
      ],
    }
  }

  /**
   * Compare compensation packages
   */
  async compareCompensation(offers: OfferDetails[]): Promise<{
    ranking: Array<{ offerId: string; score: number; analysis: string }>
    recommendation: string
    tradeoffs: string[]
  }> {
    const calculateTotalComp = (offer: OfferDetails): number => {
      let total = offer.compensation.baseSalary
      if (offer.compensation.signingBonus) {
        total += offer.compensation.signingBonus / 4 // Amortize over 4 years
      }
      if (offer.compensation.annualBonus) {
        total += offer.compensation.annualBonus.target
      }
      // Equity is harder to value - simplified
      return total
    }

    const ranked = offers
      .map(offer => ({
        offerId: offer.id,
        totalComp: calculateTotalComp(offer),
        offer,
      }))
      .sort((a, b) => b.totalComp - a.totalComp)
      .map((item, index) => ({
        offerId: item.offerId,
        score: 100 - index * 15,
        analysis: `${item.offer.company}: $${item.totalComp.toLocaleString()} total comp`,
      }))

    const topOffer = offers.find(o => o.id === ranked[0].offerId)!

    return {
      ranking: ranked,
      recommendation: `Based on total compensation, ${topOffer.company} offers the best package at $${calculateTotalComp(topOffer).toLocaleString()}.`,
      tradeoffs: [
        'Consider growth potential and equity upside',
        'Factor in work-life balance and culture',
        'Evaluate long-term career trajectory',
        'Consider location and lifestyle impact',
      ],
    }
  }

  // ==========================================================================
  // PROFILE MANAGEMENT
  // ==========================================================================

  /**
   * Get user's job profile
   */
  async getUserProfile(): Promise<UserJobProfile | null> {
    // TODO: Query database
    return null
  }

  /**
   * Update user profile from conversation
   */
  async updateProfile(updates: Partial<UserJobProfile>): Promise<UserJobProfile> {
    const current = await this.getUserProfile()

    const updated: UserJobProfile = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    } as UserJobProfile

    // Save to database
    await this.saveProfile(updated)

    return updated
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getJobById(jobId: string): Promise<JobListing | null> {
    // TODO: Query database
    return null
  }

  private async getOfferById(offerId: string): Promise<OfferDetails | null> {
    // TODO: Query database
    return null
  }

  private async getMarketComparison(offer: OfferDetails): Promise<MarketComparison> {
    const intel = await this.getSalaryIntelligence(offer.title)
    const percentile = this.calculatePercentile(offer.compensation.baseSalary, intel.baseSalary)

    return {
      role: offer.title,
      location: 'United States',
      percentile,
      medianSalary: intel.baseSalary.p50,
      salaryRange: { min: intel.baseSalary.p25, max: intel.baseSalary.p75 },
      sampleSize: intel.dataPoints,
      dataFreshness: intel.lastUpdated,
      competitiveness: percentile < 40 ? 'below_market' :
                       percentile < 60 ? 'at_market' :
                       percentile < 80 ? 'above_market' : 'highly_competitive',
      recommendation: percentile < 50
        ? `This offer is below market median. Consider negotiating for ${Math.round((intel.baseSalary.p50 - offer.compensation.baseSalary) / 1000)}K more.`
        : `This is a competitive offer at the ${percentile}th percentile.`,
    }
  }

  private calculatePercentile(value: number, distribution: { p10: number; p25: number; p50: number; p75: number; p90: number }): number {
    if (value <= distribution.p10) return 10
    if (value <= distribution.p25) return 25 + (value - distribution.p10) / (distribution.p25 - distribution.p10) * 15
    if (value <= distribution.p50) return 50 + (value - distribution.p25) / (distribution.p50 - distribution.p25) * 25
    if (value <= distribution.p75) return 75 + (value - distribution.p50) / (distribution.p75 - distribution.p50) * 25
    if (value <= distribution.p90) return 90 + (value - distribution.p75) / (distribution.p90 - distribution.p75) * 10
    return 95
  }

  private normalizeJobTitle(title: string): string {
    const normalizations: Record<string, string> = {
      'swe': 'Software Engineer',
      'dev': 'Developer',
      'sde': 'Software Development Engineer',
      'pm': 'Product Manager',
      'em': 'Engineering Manager',
    }

    const lower = title.toLowerCase()
    for (const [abbr, full] of Object.entries(normalizations)) {
      if (lower === abbr) return full
    }
    return title
  }

  private estimateResponseTime(job: JobListing): string {
    // Based on company size and application volume
    const baseDays = 5
    const variance = Math.floor(Math.random() * 5)
    return `${baseDays + variance}-${baseDays + variance + 5} business days`
  }

  private async checkExistingApplication(userId: string, jobId: string): Promise<boolean> {
    // TODO: Query database
    return false
  }

  private async saveApplication(data: Record<string, unknown>): Promise<void> {
    // TODO: Save to database
    console.log('[ConversationalJobs] Saving application:', data)
  }

  private async saveNegotiationRound(offerId: string, round: NegotiationRound): Promise<void> {
    // TODO: Save to database
    console.log('[ConversationalJobs] Saving negotiation round:', { offerId, round })
  }

  private async updateOfferStatus(offerId: string, status: OfferDetails['status']): Promise<void> {
    // TODO: Update database
    console.log('[ConversationalJobs] Updating offer status:', { offerId, status })
  }

  private async updateApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
    // TODO: Update database
    console.log('[ConversationalJobs] Updating application status:', { applicationId, status })
  }

  private async saveProfile(profile: UserJobProfile): Promise<void> {
    // TODO: Save to database
    console.log('[ConversationalJobs] Saving profile:', profile)
  }

  private generateMockJobs(filters: JobSearchRequest['filters'], count: number): JobListing[] {
    const companies = ['TechCorp', 'StartupXYZ', 'BigTech Inc', 'InnovateCo', 'FutureLabs']
    const titles = filters?.title ? [filters.title] : ['Senior Software Engineer', 'Engineering Manager', 'Staff Engineer', 'Principal Engineer', 'Tech Lead']
    const locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Remote']

    return Array.from({ length: count }, (_, i) => ({
      id: `job_${Date.now()}_${i}`,
      title: titles[i % titles.length],
      company: filters?.company || companies[i % companies.length],
      location: filters?.location || locations[i % locations.length],
      isRemote: filters?.remote ?? i % 3 === 0,
      salary: {
        min: filters?.salaryMin || 150000 + i * 10000,
        max: filters?.salaryMax || 200000 + i * 15000,
        currency: 'USD',
        period: 'yearly' as const,
      },
      equity: i % 2 === 0 ? '0.1% - 0.25%' : undefined,
      type: 'full-time' as const,
      experienceLevel: filters?.experienceLevel || 'senior' as const,
      description: `Join our team as a ${titles[i % titles.length]}...`,
      responsibilities: ['Lead technical projects', 'Mentor team members', 'Drive architecture decisions'],
      requirements: ['5+ years experience', 'Strong problem-solving skills', 'Team leadership'],
      preferredQualifications: ['Startup experience', 'Distributed systems'],
      benefits: ['Health insurance', '401k match', 'Unlimited PTO'],
      skills: ['TypeScript', 'React', 'Node.js', 'AWS'],
      postedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      match: {
        score: 95 - i * 5,
        reasons: ['Strong skill match', 'Salary in range'],
        gaps: [],
        highlights: ['Remote OK'],
      },
    }))
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

export function createConversationalJobsService(
  config: ConversationalJobsConfig
): ConversationalJobsService {
  return new ConversationalJobsService(config)
}

export default ConversationalJobsService
