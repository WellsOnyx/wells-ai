// @ts-nocheck
/**
 * Jobs Chat Handler
 *
 * Handles all jobs-related conversational intents:
 * - Job search with natural language queries
 * - Job recommendations based on user profile
 * - Application submission through chat
 * - Application status tracking
 * - Offer negotiation assistance
 * - Salary intelligence
 * - Offer acceptance/decline
 *
 * Integrates with WellsOrchestrator patterns and provides
 * natural, encouraging responses with actionable next steps.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ConversationContext, addActiveDeal, updateActiveDeal } from '../conversation-manager'
import { ActionResult, SuggestedAction } from '../action-executor'
import { ExtractedEntities, IntentClassification, JobSeekerIntent } from '../intent-router'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export interface JobSearchCriteria {
  query?: string
  title?: string
  keywords?: string[]
  skills?: string[]
  location?: string
  remote?: boolean
  salaryMin?: number
  salaryMax?: number
  jobType?: 'full-time' | 'part-time' | 'contract' | 'freelance'
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive'
  company?: string
  industry?: string
  postedWithin?: number // days
  limit?: number
}

export interface Job {
  id: string
  title: string
  company: string
  companyLogo?: string
  location: string
  remote: boolean
  salary: { min: number; max: number; currency: string }
  equity?: string
  type: 'full-time' | 'part-time' | 'contract' | 'freelance'
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive'
  description: string
  requirements: string[]
  benefits: string[]
  skills: string[]
  postedAt: Date
  matchScore: number
  matchReasons: string[]
}

export interface Application {
  id: string
  jobId: string
  job: Job
  status: 'draft' | 'submitted' | 'screening' | 'interviewing' | 'offer' | 'accepted' | 'rejected' | 'withdrawn'
  stage?: string
  nextStep?: string
  nextDate?: Date
  appliedAt: Date
  lastUpdated: Date
  notes?: string
}

export interface Offer {
  id: string
  applicationId: string
  company: string
  title: string
  baseSalary: number
  bonus?: number
  equity?: string
  signingBonus?: number
  benefits: string[]
  startDate: Date
  deadline: Date
  status: 'pending' | 'negotiating' | 'accepted' | 'declined' | 'expired'
  counterOffers: CounterOffer[]
  marketComparison: {
    percentile: number
    medianSalary: number
    suggestion: string
  }
}

export interface CounterOffer {
  id: string
  type: 'candidate' | 'employer'
  baseSalary?: number
  bonus?: number
  equity?: string
  startDate?: Date
  otherTerms?: string
  message?: string
  createdAt: Date
  status: 'pending' | 'accepted' | 'rejected'
}

export interface SalaryData {
  role: string
  location: string
  experience?: number
  percentiles: {
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
  }
  totalComp: {
    base: number
    bonus: number
    equity: number
    total: number
  }
  trends: {
    yoyChange: number
    demandLevel: 'low' | 'medium' | 'high' | 'very_high'
    hiringVelocity: string
  }
  topCompanies: Array<{ name: string; avgSalary: number }>
  negotiationTips: string[]
}

export interface UserJobProfile {
  skills: string[]
  experience: number
  desiredRoles: string[]
  desiredSalary: { min: number; max: number }
  preferredLocations: string[]
  openToRemote: boolean
  currentRole?: string
  currentCompany?: string
  resumeId?: string
  bio?: string
}

// ============================================================================
// JOBS HANDLER CLASS
// ============================================================================

export class JobsHandler {
  private userId: string
  private context: ConversationContext

  constructor(userId: string, context: ConversationContext) {
    this.userId = userId
    this.context = context
  }

  /**
   * Main entry point - route jobs intent to appropriate handler
   */
  async handleIntent(
    intent: JobSeekerIntent,
    entities: ExtractedEntities,
    message: string
  ): Promise<ActionResult> {
    const startTime = Date.now()

    try {
      switch (intent) {
        case 'job_search':
          return await this.handleJobSearch(entities, message)

        case 'apply_job':
          return await this.handleApplyToJob(entities)

        case 'view_applications':
          return await this.handleViewApplications(entities)

        case 'track_application':
          return await this.handleTrackApplication(entities)

        case 'negotiate_offer':
          return await this.handleNegotiateOffer(entities, message)

        case 'salary_intel':
          return await this.handleSalaryIntel(entities)

        case 'compare_offers':
          return await this.handleCompareOffers()

        case 'update_profile':
          return await this.handleUpdateProfile(entities, message)

        case 'withdraw_application':
          return await this.handleWithdrawApplication(entities)

        default:
          return await this.handleGeneralJobsQuery(message)
      }
    } catch (error) {
      console.error('[JobsHandler] Error:', error)
      return this.createErrorResult(intent, error, startTime)
    }
  }

  // ============================================================================
  // JOB SEARCH
  // ============================================================================

  /**
   * Handle conversational job search
   * Parses natural language queries into search criteria
   */
  private async handleJobSearch(
    entities: ExtractedEntities,
    message: string
  ): Promise<ActionResult> {
    const startTime = Date.now()

    // Parse search criteria from entities and message
    const criteria = await this.parseSearchCriteria(entities, message)

    // Get user profile for better matching
    const userProfile = await this.getUserJobProfile()

    // Search for jobs
    const jobs = await this.searchJobs(criteria, userProfile)

    if (jobs.length === 0) {
      return {
        success: true,
        data: { jobs: [], criteria },
        displayMessage: this.generateNoResultsMessage(criteria),
        suggestedActions: [
          { label: 'Broaden my search', action: 'jobs.searchBroader', primary: true },
          { label: 'Update my profile', action: 'jobs.updateProfile' },
          { label: 'Get alerts for this search', action: 'jobs.createAlert', params: { criteria } },
        ],
        actionType: 'job_search',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    const displayMessage = this.generateSearchResultsMessage(jobs, criteria)
    const topJob = jobs[0]

    // Add top match to active deals for tracking
    addActiveDeal(this.context, {
      id: `job_search_${Date.now()}`,
      type: 'job',
      status: `${jobs.length} matches found`,
      lastUpdate: new Date(),
      summary: `Job search: ${criteria.query || criteria.title || 'matching your profile'}`,
      requiresAction: true,
      counterparty: topJob.company,
    })

    return {
      success: true,
      data: { jobs, criteria, userProfile },
      displayMessage,
      displayData: {
        totalFound: jobs.length,
        topMatch: {
          id: topJob.id,
          title: topJob.title,
          company: topJob.company,
          salary: `$${(topJob.salary.min/1000).toFixed(0)}K-$${(topJob.salary.max/1000).toFixed(0)}K`,
          matchScore: topJob.matchScore,
          remote: topJob.remote,
        },
        jobs: jobs.slice(0, 5).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          salary: `$${(j.salary.min/1000).toFixed(0)}K-$${(j.salary.max/1000).toFixed(0)}K`,
          matchScore: j.matchScore,
          location: j.remote ? 'Remote' : j.location,
        })),
      },
      suggestedActions: [
        { label: `Apply to ${topJob.company}`, action: 'jobs.apply', params: { jobId: topJob.id }, primary: true },
        { label: 'Tell me more about the top match', action: 'jobs.details', params: { jobId: topJob.id } },
        { label: 'See all matches', action: 'jobs.viewAll' },
        { label: 'Refine search', action: 'jobs.refine' },
      ],
      nextSteps: [
        `Top match: ${topJob.title} at ${topJob.company} (${topJob.matchScore}% match)`,
        jobs.length > 1 ? `${jobs.length - 1} more opportunities waiting` : undefined,
        'Say "apply to [company]" to submit your application',
      ].filter(Boolean) as string[],
      actionType: 'job_search',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Parse natural language into search criteria
   */
  private async parseSearchCriteria(
    entities: ExtractedEntities,
    message: string
  ): Promise<JobSearchCriteria> {
    // Start with extracted entities
    const criteria: JobSearchCriteria = {
      title: entities.role,
      skills: entities.skills,
      location: entities.location,
      remote: entities.remote,
      salaryMin: entities.salary?.min,
      salaryMax: entities.salary?.max,
      company: entities.companyName,
    }

    // Use AI to extract additional criteria from message
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Extract job search criteria from this message. Return JSON only.

Message: "${message}"

Return format:
{
  "title": "job title or null",
  "keywords": ["relevant", "keywords"],
  "remote": true/false/null,
  "salaryMin": number or null,
  "salaryMax": number or null,
  "experienceLevel": "entry/mid/senior/executive" or null,
  "jobType": "full-time/part-time/contract/freelance" or null,
  "company": "specific company or null",
  "industry": "industry or null"
}`
        }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Merge AI-extracted with entity-extracted, preferring entities
        return {
          ...parsed,
          ...criteria,
          query: message,
          keywords: [...(parsed.keywords || []), ...(criteria.skills || [])],
        }
      }
    } catch (error) {
      console.error('[JobsHandler] Parse error:', error)
    }

    return { ...criteria, query: message }
  }

  /**
   * Search for jobs matching criteria
   */
  private async searchJobs(
    criteria: JobSearchCriteria,
    userProfile?: UserJobProfile
  ): Promise<Job[]> {
    // TODO: Replace with actual job marketplace query
    // const jobs = await jobsService.search(criteria)

    // Mock data for demonstration
    const mockJobs: Job[] = [
      {
        id: 'job_' + Math.random().toString(36).slice(2, 9),
        title: criteria.title || 'Senior Software Engineer',
        company: criteria.company || 'TechCorp',
        location: criteria.location || 'San Francisco, CA',
        remote: criteria.remote ?? true,
        salary: {
          min: criteria.salaryMin || 180000,
          max: criteria.salaryMax || 220000,
          currency: 'USD'
        },
        equity: '0.1% - 0.25%',
        type: 'full-time',
        experienceLevel: 'senior',
        description: 'Lead development of core platform features...',
        requirements: ['5+ years experience', 'Strong system design', 'Leadership experience'],
        benefits: ['Unlimited PTO', 'Health/Dental/Vision', '401k match', 'Remote-first'],
        skills: criteria.skills || ['TypeScript', 'React', 'Node.js'],
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        matchScore: 95,
        matchReasons: ['Skills match perfectly', 'Salary in your range', 'Remote-friendly'],
      },
      {
        id: 'job_' + Math.random().toString(36).slice(2, 9),
        title: 'Engineering Manager',
        company: 'StartupXYZ',
        location: 'New York, NY',
        remote: true,
        salary: { min: 200000, max: 260000, currency: 'USD' },
        equity: '0.5% - 1.0%',
        type: 'full-time',
        experienceLevel: 'senior',
        description: 'Build and lead a world-class engineering team...',
        requirements: ['8+ years experience', 'People management', 'Startup experience'],
        benefits: ['Equity package', 'Flexible hours', 'Learning budget'],
        skills: ['Leadership', 'Technical Strategy', 'Hiring'],
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        matchScore: 88,
        matchReasons: ['Strong leadership background', 'Remote OK', 'High growth potential'],
      },
      {
        id: 'job_' + Math.random().toString(36).slice(2, 9),
        title: 'Staff Engineer',
        company: 'BigTech Inc',
        location: 'Seattle, WA',
        remote: false,
        salary: { min: 250000, max: 320000, currency: 'USD' },
        equity: 'RSUs',
        type: 'full-time',
        experienceLevel: 'senior',
        description: 'Drive technical direction for distributed systems...',
        requirements: ['10+ years experience', 'Distributed systems', 'Technical leadership'],
        benefits: ['Top-tier benefits', 'Relocation package', 'Sabbatical program'],
        skills: ['Distributed Systems', 'Architecture', 'Mentorship'],
        postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        matchScore: 82,
        matchReasons: ['Excellent compensation', 'Strong technical challenge', 'Career growth'],
      },
    ]

    // Filter based on criteria
    let filtered = mockJobs

    if (criteria.salaryMin) {
      filtered = filtered.filter(j => j.salary.max >= criteria.salaryMin!)
    }
    if (criteria.remote === true) {
      filtered = filtered.filter(j => j.remote)
    }
    if (criteria.company) {
      filtered = filtered.filter(j =>
        j.company.toLowerCase().includes(criteria.company!.toLowerCase())
      )
    }

    // Sort by match score
    return filtered.sort((a, b) => b.matchScore - a.matchScore)
  }

  /**
   * Generate natural language message for search results
   */
  private generateSearchResultsMessage(jobs: Job[], criteria: JobSearchCriteria): string {
    const searchTerm = criteria.title || criteria.query || 'your criteria'
    const topJob = jobs[0]

    let message = `Great news! I found ${jobs.length} ${jobs.length === 1 ? 'role' : 'roles'} matching "${searchTerm}".`

    message += `\n\nYour top match is **${topJob.title}** at **${topJob.company}**:`
    message += `\n- Salary: $${(topJob.salary.min/1000).toFixed(0)}K-$${(topJob.salary.max/1000).toFixed(0)}K`
    if (topJob.equity) message += ` + ${topJob.equity} equity`
    message += `\n- Location: ${topJob.remote ? 'Remote' : topJob.location}`
    message += `\n- Match: ${topJob.matchScore}% (${topJob.matchReasons[0]})`

    if (jobs.length > 1) {
      message += `\n\nOther strong matches:`
      jobs.slice(1, 4).forEach((job, i) => {
        message += `\n${i + 2}. ${job.title} at ${job.company} - ${job.matchScore}% match`
      })
    }

    return message
  }

  /**
   * Generate message when no results found
   */
  private generateNoResultsMessage(criteria: JobSearchCriteria): string {
    const searchTerm = criteria.title || criteria.query || 'your criteria'

    let message = `I couldn't find any exact matches for "${searchTerm}" right now.`

    if (criteria.salaryMin && criteria.salaryMin > 200000) {
      message += ` The salary requirement of $${(criteria.salaryMin/1000).toFixed(0)}K+ is quite selective.`
    }
    if (criteria.remote) {
      message += ` Remote-only positions can be competitive.`
    }

    message += `\n\nHere's what we can do:`
    message += `\n- I can broaden the search and show similar roles`
    message += `\n- I can set up alerts so you're first to know when matching jobs appear`
    message += `\n- We can update your profile to improve matches`

    return message
  }

  // ============================================================================
  // JOB APPLICATION
  // ============================================================================

  /**
   * Handle applying to a job through chat
   */
  private async handleApplyToJob(entities: ExtractedEntities): Promise<ActionResult> {
    const startTime = Date.now()

    const jobId = entities.jobId
    const company = entities.companyName

    // Find the job
    const job = await this.findJob(jobId, company)
    if (!job) {
      return {
        success: false,
        error: 'Job not found',
        displayMessage: company
          ? `I couldn't find that role at ${company}. Would you like me to search for their open positions?`
          : `Which role would you like to apply to? You can say the company name or "the first one" from the search results.`,
        suggestedActions: company ? [
          { label: `Search ${company} jobs`, action: 'jobs.search', params: { company }, primary: true },
        ] : [
          { label: 'Show my search results', action: 'jobs.viewResults' },
        ],
        actionType: 'apply_job',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Check if already applied
    const existingApp = await this.getExistingApplication(job.id)
    if (existingApp) {
      return {
        success: true,
        data: { application: existingApp },
        displayMessage: `You've already applied to ${job.title} at ${job.company}! Your application is currently in "${existingApp.status}" stage. Would you like an update?`,
        suggestedActions: [
          { label: 'Check status', action: 'jobs.trackApplication', params: { applicationId: existingApp.id }, primary: true },
          { label: 'Find similar roles', action: 'jobs.searchSimilar', params: { jobId: job.id } },
        ],
        actionType: 'apply_job',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Submit application
    const application = await this.submitApplication(job)

    // Track as active deal
    addActiveDeal(this.context, {
      id: application.id,
      type: 'application',
      status: 'submitted',
      lastUpdate: new Date(),
      summary: `Application: ${job.title} at ${job.company}`,
      requiresAction: false,
      counterparty: job.company,
    })

    return {
      success: true,
      data: { application, job },
      displayMessage: `Excellent! Your application for **${job.title}** at **${job.company}** is submitted!

I've tailored your resume and crafted a personalized cover letter highlighting:
- Your relevant experience with ${job.skills.slice(0, 2).join(' and ')}
- Why you're a great fit for their team
- Your interest in their mission

Average response time for ${job.company} is 3-5 business days. I'll notify you immediately when there's any update.`,
      displayData: {
        applicationId: application.id,
        job: {
          title: job.title,
          company: job.company,
          salary: `$${(job.salary.min/1000).toFixed(0)}K-$${(job.salary.max/1000).toFixed(0)}K`,
        },
        status: 'submitted',
        submittedAt: application.appliedAt,
      },
      suggestedActions: [
        { label: 'Prepare for interview', action: 'jobs.interviewPrep', params: { jobId: job.id } },
        { label: 'Find similar roles', action: 'jobs.searchSimilar', params: { jobId: job.id } },
        { label: 'View all applications', action: 'jobs.viewApplications' },
      ],
      nextSteps: [
        `${job.company} will review your application`,
        'I\'ll update you on any status changes',
        'Pro tip: research their recent projects before the interview',
      ],
      createdIds: { applicationId: application.id },
      actionType: 'apply_job',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Find a job by ID or company name
   */
  private async findJob(jobId?: string, company?: string): Promise<Job | null> {
    // Check recent search results in context
    const recentJobs = this.context.recentEntities.jobs as Job[] | undefined

    if (jobId && recentJobs) {
      const found = recentJobs.find(j => j.id === jobId)
      if (found) return found
    }

    if (company && recentJobs) {
      const found = recentJobs.find(j =>
        j.company.toLowerCase().includes(company.toLowerCase())
      )
      if (found) return found
    }

    // TODO: Query actual database
    return null
  }

  /**
   * Check for existing application
   */
  private async getExistingApplication(jobId: string): Promise<Application | null> {
    // TODO: Query actual database
    return null
  }

  /**
   * Submit a job application
   */
  private async submitApplication(job: Job): Promise<Application> {
    // TODO: Call actual application service
    return {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      jobId: job.id,
      job,
      status: 'submitted',
      appliedAt: new Date(),
      lastUpdated: new Date(),
    }
  }

  // ============================================================================
  // APPLICATION TRACKING
  // ============================================================================

  /**
   * Handle viewing all applications
   */
  private async handleViewApplications(entities: ExtractedEntities): Promise<ActionResult> {
    const startTime = Date.now()

    const applications = await this.getApplications(entities.status as Application['status'] | undefined)

    if (applications.length === 0) {
      return {
        success: true,
        data: { applications: [] },
        displayMessage: `You don't have any active applications yet. Ready to find your next opportunity? I can search for roles that match your profile.`,
        suggestedActions: [
          { label: 'Find jobs for me', action: 'jobs.searchRecommended', primary: true },
          { label: 'Update my profile', action: 'jobs.updateProfile' },
        ],
        actionType: 'view_applications',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    const statusCounts = {
      submitted: applications.filter(a => a.status === 'submitted').length,
      screening: applications.filter(a => a.status === 'screening').length,
      interviewing: applications.filter(a => a.status === 'interviewing').length,
      offer: applications.filter(a => a.status === 'offer').length,
    }

    let message = `You have **${applications.length}** active applications:\n`

    if (statusCounts.offer > 0) {
      message += `\n**${statusCounts.offer} Offer${statusCounts.offer > 1 ? 's' : ''} Pending!**`
      applications.filter(a => a.status === 'offer').forEach(a => {
        message += `\n- ${a.job.title} at ${a.job.company}`
      })
    }

    if (statusCounts.interviewing > 0) {
      message += `\n\n**${statusCounts.interviewing} in Interview Stage:**`
      applications.filter(a => a.status === 'interviewing').slice(0, 3).forEach(a => {
        message += `\n- ${a.job.title} at ${a.job.company}`
        if (a.nextStep) message += ` (Next: ${a.nextStep})`
      })
    }

    if (statusCounts.screening + statusCounts.submitted > 0) {
      message += `\n\n**${statusCounts.screening + statusCounts.submitted} Under Review**`
    }

    const suggestedActions: SuggestedAction[] = []
    if (statusCounts.offer > 0) {
      suggestedActions.push({ label: 'View offers', action: 'jobs.viewOffers', primary: true })
    }
    if (statusCounts.interviewing > 0) {
      suggestedActions.push({ label: 'Prepare for interviews', action: 'jobs.interviewPrep' })
    }
    suggestedActions.push({ label: 'Find more jobs', action: 'jobs.search' })

    return {
      success: true,
      data: { applications, statusCounts },
      displayMessage: message,
      displayData: {
        total: applications.length,
        ...statusCounts,
        applications: applications.slice(0, 5).map(a => ({
          id: a.id,
          role: a.job.title,
          company: a.job.company,
          status: a.status,
          lastUpdated: a.lastUpdated,
        })),
      },
      suggestedActions,
      actionType: 'view_applications',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Track specific application status
   */
  private async handleTrackApplication(entities: ExtractedEntities): Promise<ActionResult> {
    const startTime = Date.now()

    const applicationId = entities.applicationId
    const company = entities.companyName

    const application = await this.findApplication(applicationId, company)

    if (!application) {
      return {
        success: false,
        error: 'Application not found',
        displayMessage: company
          ? `I couldn't find an application at ${company}. Would you like to see all your applications?`
          : `Which application would you like to check on?`,
        suggestedActions: [
          { label: 'View all applications', action: 'jobs.viewApplications', primary: true },
        ],
        actionType: 'track_application',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    const statusMessages: Record<Application['status'], string> = {
      draft: 'Your application is saved as a draft.',
      submitted: `Your application is in the queue. ${application.job.company} typically responds within 3-5 business days.`,
      screening: `Great news! ${application.job.company} is actively reviewing your profile. This usually means you passed the initial filter.`,
      interviewing: `You're in the interview process! ${application.nextStep ? `Next up: ${application.nextStep}` : 'Check your email for scheduling details.'}`,
      offer: `Congratulations! You have an offer from ${application.job.company}! Ready to review it?`,
      accepted: `You've accepted the offer at ${application.job.company}. Exciting times ahead!`,
      rejected: `Unfortunately, ${application.job.company} decided to move forward with other candidates. Don't be discouraged - let's find you an even better fit.`,
      withdrawn: 'You withdrew this application.',
    }

    const message = `**${application.job.title}** at **${application.job.company}**\n\nStatus: **${application.status.charAt(0).toUpperCase() + application.status.slice(1)}**\n\n${statusMessages[application.status]}`

    const suggestedActions: SuggestedAction[] = []

    if (application.status === 'offer') {
      suggestedActions.push({ label: 'View offer details', action: 'jobs.viewOffer', params: { applicationId: application.id }, primary: true })
      suggestedActions.push({ label: 'Negotiate', action: 'jobs.negotiate', params: { applicationId: application.id } })
    } else if (application.status === 'interviewing') {
      suggestedActions.push({ label: 'Prepare for interview', action: 'jobs.interviewPrep', params: { jobId: application.jobId }, primary: true })
    } else if (application.status === 'rejected') {
      suggestedActions.push({ label: 'Find similar roles', action: 'jobs.searchSimilar', params: { jobId: application.jobId }, primary: true })
    }
    suggestedActions.push({ label: 'View all applications', action: 'jobs.viewApplications' })

    return {
      success: true,
      data: { application },
      displayMessage: message,
      displayData: {
        applicationId: application.id,
        role: application.job.title,
        company: application.job.company,
        status: application.status,
        appliedAt: application.appliedAt,
        lastUpdated: application.lastUpdated,
        nextStep: application.nextStep,
        nextDate: application.nextDate,
      },
      suggestedActions,
      actionType: 'track_application',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Get applications with optional status filter
   */
  private async getApplications(status?: Application['status']): Promise<Application[]> {
    // TODO: Query actual database
    // Mock data for demonstration
    return [
      {
        id: 'app_001',
        jobId: 'job_001',
        job: {
          id: 'job_001',
          title: 'Senior Engineer',
          company: 'TechCorp',
          location: 'Remote',
          remote: true,
          salary: { min: 180000, max: 220000, currency: 'USD' },
          type: 'full-time',
          experienceLevel: 'senior',
          description: '',
          requirements: [],
          benefits: [],
          skills: [],
          postedAt: new Date(),
          matchScore: 95,
          matchReasons: [],
        },
        status: 'interviewing',
        stage: 'Technical Round',
        nextStep: 'System Design Interview',
        nextDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        appliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'app_002',
        jobId: 'job_002',
        job: {
          id: 'job_002',
          title: 'Staff Engineer',
          company: 'BigTech',
          location: 'Seattle, WA',
          remote: false,
          salary: { min: 250000, max: 320000, currency: 'USD' },
          type: 'full-time',
          experienceLevel: 'senior',
          description: '',
          requirements: [],
          benefits: [],
          skills: [],
          postedAt: new Date(),
          matchScore: 82,
          matchReasons: [],
        },
        status: 'screening',
        appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'app_003',
        jobId: 'job_003',
        job: {
          id: 'job_003',
          title: 'Engineering Manager',
          company: 'StartupABC',
          location: 'Remote',
          remote: true,
          salary: { min: 200000, max: 260000, currency: 'USD' },
          type: 'full-time',
          experienceLevel: 'senior',
          description: '',
          requirements: [],
          benefits: [],
          skills: [],
          postedAt: new Date(),
          matchScore: 88,
          matchReasons: [],
        },
        status: 'offer',
        appliedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ].filter(a => !status || a.status === status)
  }

  /**
   * Find specific application
   */
  private async findApplication(
    applicationId?: string,
    company?: string
  ): Promise<Application | null> {
    const applications = await this.getApplications()

    if (applicationId) {
      return applications.find(a => a.id === applicationId) || null
    }

    if (company) {
      return applications.find(a =>
        a.job.company.toLowerCase().includes(company.toLowerCase())
      ) || null
    }

    return null
  }

  // ============================================================================
  // OFFER NEGOTIATION
  // ============================================================================

  /**
   * Handle offer negotiation through chat
   */
  private async handleNegotiateOffer(
    entities: ExtractedEntities,
    message: string
  ): Promise<ActionResult> {
    const startTime = Date.now()

    // Parse negotiation context from message
    const negotiationContext = await this.parseNegotiationContext(entities, message)

    // Get current offer
    const offer = await this.getCurrentOffer(entities.companyName)

    if (!offer) {
      return {
        success: false,
        error: 'No pending offer found',
        displayMessage: entities.companyName
          ? `I don't see an offer from ${entities.companyName}. Would you like to check your offers?`
          : `Which offer would you like to negotiate? Or if you've received a verbal offer, tell me the details and I'll help you counter.`,
        suggestedActions: [
          { label: 'View my offers', action: 'jobs.viewOffers', primary: true },
          { label: 'Get salary intel', action: 'jobs.salaryIntel' },
        ],
        actionType: 'negotiate_offer',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Generate negotiation strategy
    const strategy = await this.generateNegotiationStrategy(offer, negotiationContext)

    // If user specified counter terms, prepare the counter offer
    if (negotiationContext.counterSalary || negotiationContext.counterEquity) {
      const counterOffer = await this.prepareCounterOffer(offer, negotiationContext)

      return {
        success: true,
        data: { offer, counterOffer, strategy },
        displayMessage: `Here's my recommended approach for negotiating with ${offer.company}:

**Your Counter Offer:**
${counterOffer.baseSalary ? `- Base Salary: $${counterOffer.baseSalary.toLocaleString()}` : ''}
${counterOffer.equity ? `- Equity: ${counterOffer.equity}` : ''}
${counterOffer.bonus ? `- Signing Bonus: $${counterOffer.bonus.toLocaleString()}` : ''}

**Why This Works:**
${strategy.justification}

**Market Context:**
Their offer is at the ${offer.marketComparison.percentile}th percentile. ${offer.marketComparison.suggestion}

Would you like me to send this counter-offer? I'll frame it professionally with supporting market data.`,
        displayData: {
          currentOffer: {
            base: offer.baseSalary,
            bonus: offer.bonus,
            equity: offer.equity,
          },
          counterOffer: {
            base: counterOffer.baseSalary,
            bonus: counterOffer.bonus,
            equity: counterOffer.equity,
          },
          marketPercentile: offer.marketComparison.percentile,
        },
        suggestedActions: [
          { label: 'Send counter-offer', action: 'jobs.sendCounter', params: { offerId: offer.id, counter: counterOffer }, primary: true },
          { label: 'Adjust my counter', action: 'jobs.adjustCounter' },
          { label: 'Accept current offer', action: 'jobs.acceptOffer', params: { offerId: offer.id } },
        ],
        actionType: 'negotiate_offer',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Otherwise, provide negotiation advice
    return {
      success: true,
      data: { offer, strategy },
      displayMessage: `Let me help you negotiate the offer from **${offer.company}**:

**Current Offer:**
- Base: $${offer.baseSalary.toLocaleString()}
${offer.bonus ? `- Bonus: $${offer.bonus.toLocaleString()}` : ''}
${offer.equity ? `- Equity: ${offer.equity}` : ''}

**My Analysis:**
${strategy.analysis}

**Recommendation:**
${strategy.recommendation}

Their offer is at the ${offer.marketComparison.percentile}th percentile for this role. ${offer.marketComparison.suggestion}

What would you like to counter with? You can say something like "counter at $200K" or "ask for more equity".`,
      displayData: {
        offer: {
          company: offer.company,
          base: offer.baseSalary,
          bonus: offer.bonus,
          equity: offer.equity,
          deadline: offer.deadline,
        },
        marketPercentile: offer.marketComparison.percentile,
        recommendedCounter: strategy.recommendedCounter,
      },
      suggestedActions: [
        { label: `Counter at $${strategy.recommendedCounter.toLocaleString()}`, action: 'jobs.negotiate', params: { counterSalary: strategy.recommendedCounter }, primary: true },
        { label: 'Ask for more equity', action: 'jobs.negotiate', params: { counterEquity: true } },
        { label: 'Accept as-is', action: 'jobs.acceptOffer', params: { offerId: offer.id } },
      ],
      actionType: 'negotiate_offer',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Parse negotiation context from user message
   */
  private async parseNegotiationContext(
    entities: ExtractedEntities,
    message: string
  ): Promise<{
    counterSalary?: number
    counterEquity?: string
    counterBonus?: number
    concerns?: string[]
    priorities?: string[]
  }> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Extract negotiation details from this message. Return JSON only.

Message: "${message}"

Return:
{
  "counterSalary": number or null,
  "counterEquity": "equity percentage/value" or null,
  "counterBonus": number or null,
  "concerns": ["list", "of", "concerns"] or null,
  "priorities": ["what", "matters", "most"] or null
}`
        }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('[JobsHandler] Parse negotiation error:', error)
    }

    return {
      counterSalary: entities.salary?.max,
    }
  }

  /**
   * Get current pending offer
   */
  private async getCurrentOffer(company?: string): Promise<Offer | null> {
    // TODO: Query actual database
    // Mock offer for demonstration
    return {
      id: 'offer_001',
      applicationId: 'app_003',
      company: company || 'StartupABC',
      title: 'Engineering Manager',
      baseSalary: 195000,
      bonus: 20000,
      equity: '0.15%',
      benefits: ['Unlimited PTO', 'Health/Dental/Vision', '401k 6% match'],
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      counterOffers: [],
      marketComparison: {
        percentile: 65,
        medianSalary: 210000,
        suggestion: 'There\'s room to negotiate 10-15% higher based on market data.',
      },
    }
  }

  /**
   * Generate negotiation strategy
   */
  private async generateNegotiationStrategy(
    offer: Offer,
    context: {
      counterSalary?: number
      counterEquity?: string
      concerns?: string[]
      priorities?: string[]
    }
  ): Promise<{
    analysis: string
    recommendation: string
    justification: string
    recommendedCounter: number
  }> {
    const targetIncrease = 0.15 // 15% target
    const recommendedCounter = Math.round(offer.baseSalary * (1 + targetIncrease))

    return {
      analysis: `The offer is solid but below market median. ${offer.company} has shown strong interest, which gives you negotiating leverage.`,
      recommendation: `I recommend countering at $${recommendedCounter.toLocaleString()} base. This is aggressive but justified given market rates and your qualifications.`,
      justification: `Based on market data for this role, the median total compensation is $${offer.marketComparison.medianSalary.toLocaleString()}. Your counter represents fair market value for your experience level.`,
      recommendedCounter,
    }
  }

  /**
   * Prepare counter offer
   */
  private async prepareCounterOffer(
    offer: Offer,
    context: {
      counterSalary?: number
      counterEquity?: string
      counterBonus?: number
    }
  ): Promise<CounterOffer> {
    return {
      id: `counter_${Date.now()}`,
      type: 'candidate',
      baseSalary: context.counterSalary,
      equity: context.counterEquity,
      bonus: context.counterBonus,
      createdAt: new Date(),
      status: 'pending',
    }
  }

  // ============================================================================
  // SALARY INTELLIGENCE
  // ============================================================================

  /**
   * Handle salary intelligence requests
   */
  private async handleSalaryIntel(entities: ExtractedEntities): Promise<ActionResult> {
    const startTime = Date.now()

    const role = entities.role || 'Software Engineer'
    const location = entities.location || 'US'

    const salaryData = await this.getSalaryData(role, location)

    const message = `**Salary Data for ${role}** (${location}):

**Base Salary Range:**
- 25th percentile: $${(salaryData.percentiles.p25/1000).toFixed(0)}K
- Median: $${(salaryData.percentiles.p50/1000).toFixed(0)}K
- 75th percentile: $${(salaryData.percentiles.p75/1000).toFixed(0)}K
- Top 10%: $${(salaryData.percentiles.p90/1000).toFixed(0)}K+

**Total Compensation (Median):**
- Base: $${(salaryData.totalComp.base/1000).toFixed(0)}K
- Bonus: $${(salaryData.totalComp.bonus/1000).toFixed(0)}K
- Equity: $${(salaryData.totalComp.equity/1000).toFixed(0)}K/year
- **Total: $${(salaryData.totalComp.total/1000).toFixed(0)}K**

**Market Trends:**
- YoY Change: ${salaryData.trends.yoyChange > 0 ? '+' : ''}${salaryData.trends.yoyChange}%
- Demand: ${salaryData.trends.demandLevel.replace('_', ' ')}
- ${salaryData.trends.hiringVelocity}

**Top Tip:** ${salaryData.negotiationTips[0]}`

    return {
      success: true,
      data: { salaryData },
      displayMessage: message,
      displayData: {
        role,
        location,
        percentiles: salaryData.percentiles,
        totalComp: salaryData.totalComp,
        trends: salaryData.trends,
      },
      suggestedActions: [
        { label: 'Find jobs at this rate', action: 'jobs.search', params: { salaryMin: salaryData.percentiles.p50 }, primary: true },
        { label: 'Compare other roles', action: 'jobs.salaryIntel' },
        { label: 'Negotiation tips', action: 'jobs.negotiationTips' },
      ],
      actionType: 'salary_intel',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Get salary data for role
   */
  private async getSalaryData(role: string, location: string): Promise<SalaryData> {
    // TODO: Query actual salary database
    return {
      role,
      location,
      percentiles: {
        p10: 120000,
        p25: 150000,
        p50: 185000,
        p75: 220000,
        p90: 280000,
      },
      totalComp: {
        base: 185000,
        bonus: 25000,
        equity: 50000,
        total: 260000,
      },
      trends: {
        yoyChange: 8,
        demandLevel: 'high',
        hiringVelocity: 'Companies are actively hiring - leverage this in negotiations',
      },
      topCompanies: [
        { name: 'Google', avgSalary: 280000 },
        { name: 'Meta', avgSalary: 275000 },
        { name: 'Apple', avgSalary: 260000 },
      ],
      negotiationTips: [
        'The market is hot - 85% of companies expect negotiation. Don\'t accept the first offer.',
        'Emphasize your specific experience in high-demand areas',
        'Total compensation matters more than base - negotiate equity and bonus too',
      ],
    }
  }

  // ============================================================================
  // OFFER COMPARISON & DECISION
  // ============================================================================

  /**
   * Handle comparing multiple offers
   */
  private async handleCompareOffers(): Promise<ActionResult> {
    const startTime = Date.now()

    const offers = await this.getPendingOffers()

    if (offers.length === 0) {
      return {
        success: true,
        data: { offers: [] },
        displayMessage: `You don't have any pending offers right now. Keep applying - I'll help you negotiate when offers come in!`,
        suggestedActions: [
          { label: 'Find jobs', action: 'jobs.search', primary: true },
          { label: 'View applications', action: 'jobs.viewApplications' },
        ],
        actionType: 'compare_offers',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    if (offers.length === 1) {
      const offer = offers[0]
      return {
        success: true,
        data: { offers },
        displayMessage: `You have one offer from **${offer.company}**: $${offer.baseSalary.toLocaleString()} base + ${offer.equity} equity.

Deadline: ${Math.ceil((offer.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days

Would you like help negotiating or are you ready to decide?`,
        suggestedActions: [
          { label: 'Negotiate', action: 'jobs.negotiate', params: { offerId: offer.id }, primary: true },
          { label: 'Accept offer', action: 'jobs.acceptOffer', params: { offerId: offer.id } },
          { label: 'Decline offer', action: 'jobs.declineOffer', params: { offerId: offer.id } },
        ],
        actionType: 'compare_offers',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Multiple offers - build comparison
    let message = `**Offer Comparison:**\n`
    offers.forEach((offer, i) => {
      const totalComp = offer.baseSalary + (offer.bonus || 0)
      message += `\n**${i + 1}. ${offer.company}** - ${offer.title}`
      message += `\n   Base: $${offer.baseSalary.toLocaleString()}`
      if (offer.bonus) message += ` | Bonus: $${offer.bonus.toLocaleString()}`
      if (offer.equity) message += ` | Equity: ${offer.equity}`
      message += `\n   Deadline: ${Math.ceil((offer.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days`
      message += `\n`
    })

    const bestOffer = offers.reduce((best, o) =>
      (o.baseSalary + (o.bonus || 0)) > (best.baseSalary + (best.bonus || 0)) ? o : best
    )

    message += `\n**My Recommendation:** ${bestOffer.company} offers the highest total compensation, but consider factors like growth potential, team, and culture.`

    return {
      success: true,
      data: { offers, recommendation: bestOffer },
      displayMessage: message,
      displayData: {
        offers: offers.map(o => ({
          company: o.company,
          title: o.title,
          base: o.baseSalary,
          bonus: o.bonus,
          equity: o.equity,
          deadline: o.deadline,
        })),
        recommendedId: bestOffer.id,
      },
      suggestedActions: [
        { label: `Negotiate with ${bestOffer.company}`, action: 'jobs.negotiate', params: { offerId: bestOffer.id }, primary: true },
        { label: 'Accept best offer', action: 'jobs.acceptOffer', params: { offerId: bestOffer.id } },
        { label: 'Need more time', action: 'jobs.requestExtension' },
      ],
      actionType: 'compare_offers',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Get pending offers
   */
  private async getPendingOffers(): Promise<Offer[]> {
    // TODO: Query actual database
    const offer = await this.getCurrentOffer()
    return offer ? [offer] : []
  }

  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================

  /**
   * Handle profile updates
   */
  private async handleUpdateProfile(
    entities: ExtractedEntities,
    message: string
  ): Promise<ActionResult> {
    const startTime = Date.now()

    // Parse profile updates from message
    const updates = await this.parseProfileUpdates(entities, message)

    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        displayMessage: `What would you like to update? I can help with:
- Skills (e.g., "add Python to my skills")
- Salary expectations (e.g., "looking for $200K+")
- Location preferences (e.g., "I prefer remote work")
- Desired roles (e.g., "interested in management roles")`,
        suggestedActions: [
          { label: 'Update skills', action: 'jobs.updateSkills' },
          { label: 'Set salary range', action: 'jobs.updateSalary' },
          { label: 'View my profile', action: 'jobs.viewProfile' },
        ],
        actionType: 'update_profile',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Apply updates
    await this.applyProfileUpdates(updates)

    const updateSummary = Object.entries(updates)
      .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\n')

    return {
      success: true,
      data: { updates },
      displayMessage: `Profile updated! Here's what changed:\n\n${updateSummary}\n\nThis will improve your job matches. Want me to search for new opportunities?`,
      suggestedActions: [
        { label: 'Find matching jobs', action: 'jobs.search', primary: true },
        { label: 'View my profile', action: 'jobs.viewProfile' },
      ],
      actionType: 'update_profile',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Parse profile updates from message
   */
  private async parseProfileUpdates(
    entities: ExtractedEntities,
    message: string
  ): Promise<Partial<UserJobProfile>> {
    const updates: Partial<UserJobProfile> = {}

    if (entities.skills) updates.skills = entities.skills
    if (entities.salary) {
      updates.desiredSalary = {
        min: entities.salary.min || 0,
        max: entities.salary.max || 0,
      }
    }
    if (entities.location) updates.preferredLocations = [entities.location]
    if (entities.remote !== undefined) updates.openToRemote = entities.remote
    if (entities.role) updates.desiredRoles = [entities.role]

    return updates
  }

  /**
   * Apply profile updates
   */
  private async applyProfileUpdates(updates: Partial<UserJobProfile>): Promise<void> {
    // TODO: Save to database
    console.log('[JobsHandler] Profile updates:', updates)
  }

  /**
   * Get user's job profile
   */
  private async getUserJobProfile(): Promise<UserJobProfile | undefined> {
    // TODO: Query actual database
    return undefined
  }

  // ============================================================================
  // WITHDRAWAL
  // ============================================================================

  /**
   * Handle application withdrawal
   */
  private async handleWithdrawApplication(entities: ExtractedEntities): Promise<ActionResult> {
    const startTime = Date.now()

    const application = await this.findApplication(entities.applicationId, entities.companyName)

    if (!application) {
      return {
        success: false,
        error: 'Application not found',
        displayMessage: `Which application would you like to withdraw?`,
        suggestedActions: [
          { label: 'View applications', action: 'jobs.viewApplications', primary: true },
        ],
        actionType: 'withdraw_application',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }

    // Confirm before withdrawing
    return {
      success: true,
      data: { application, requiresConfirmation: true },
      displayMessage: `Are you sure you want to withdraw from **${application.job.title}** at **${application.job.company}**? This cannot be undone.`,
      suggestedActions: [
        { label: 'Yes, withdraw', action: 'jobs.confirmWithdraw', params: { applicationId: application.id } },
        { label: 'No, keep it', action: 'jobs.viewApplications', primary: true },
      ],
      actionType: 'withdraw_application',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }

  // ============================================================================
  // GENERAL QUERY HANDLER
  // ============================================================================

  /**
   * Handle general jobs-related queries
   */
  private async handleGeneralJobsQuery(message: string): Promise<ActionResult> {
    const startTime = Date.now()

    // Use AI to understand and respond
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are Wells, a career assistant. Help the user with their job-related question. Be encouraging and actionable. Keep responses concise (2-3 sentences).`,
        messages: [{ role: 'user', content: message }],
      })

      const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

      return {
        success: true,
        displayMessage: text,
        suggestedActions: [
          { label: 'Search jobs', action: 'jobs.search', primary: true },
          { label: 'View applications', action: 'jobs.viewApplications' },
          { label: 'Get salary intel', action: 'jobs.salaryIntel' },
        ],
        actionType: 'general_jobs',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: true,
        displayMessage: `I can help you with job search, applications, and offer negotiation. What would you like to do?`,
        suggestedActions: [
          { label: 'Find jobs', action: 'jobs.search', primary: true },
          { label: 'Check applications', action: 'jobs.viewApplications' },
          { label: 'Salary research', action: 'jobs.salaryIntel' },
        ],
        actionType: 'general_jobs',
        executedAt: new Date(),
        durationMs: Date.now() - startTime,
      }
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Create error result
   */
  private createErrorResult(action: string, error: unknown, startTime: number): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return {
      success: false,
      error: errorMessage,
      displayMessage: `I ran into an issue: ${errorMessage}. Would you like to try again?`,
      suggestedActions: [
        { label: 'Try again', action: `jobs.${action}` },
        { label: 'Get help', action: 'universal.help' },
      ],
      actionType: action,
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    }
  }
}

// ============================================================================
// CONTEXT AND RESULT TYPES FOR INDEX EXPORTS
// ============================================================================

export interface JobsIntentContext {
  userId: string
  sessionId?: string
  message: string
  intent?: JobSeekerIntent
  entities?: ExtractedEntities
  conversationContext: ConversationContext
}

export interface JobsHandlerResult {
  success: boolean
  message: string
  data?: unknown
  displayData?: Record<string, unknown>
  suggestedActions?: SuggestedAction[]
  nextSteps?: string[]
  requiresConfirmation?: boolean
  createdIds?: {
    applicationId?: string
    offerId?: string
    searchId?: string
  }
}

// ============================================================================
// SINGLETON HANDLER FOR INDEX EXPORTS
// ============================================================================

class JobsHandlerSingleton {
  private static instance: JobsHandlerSingleton

  static getInstance(): JobsHandlerSingleton {
    if (!JobsHandlerSingleton.instance) {
      JobsHandlerSingleton.instance = new JobsHandlerSingleton()
    }
    return JobsHandlerSingleton.instance
  }

  async handleIntent(context: JobsIntentContext): Promise<JobsHandlerResult> {
    const { userId, message, intent, entities = {}, conversationContext } = context

    // Create a handler instance for this request
    const handler = new JobsHandler(userId, conversationContext)

    // Determine intent if not provided
    const resolvedIntent = intent || await this.classifyIntent(message)

    // Handle the intent
    const result = await handler.handleIntent(resolvedIntent, entities, message)

    // Transform to JobsHandlerResult
    return {
      success: result.success,
      message: result.displayMessage,
      data: result.data,
      displayData: result.displayData,
      suggestedActions: result.suggestedActions,
      nextSteps: result.nextSteps,
      requiresConfirmation: result.data?.requiresConfirmation,
      createdIds: result.createdIds ? {
        applicationId: result.createdIds.applicationId,
      } : undefined,
    }
  }

  private async classifyIntent(message: string): Promise<JobSeekerIntent> {
    const lower = message.toLowerCase()

    // Pattern matching for common intents
    if (lower.includes('find') || lower.includes('search') || lower.includes('looking for') || lower.includes('show me')) {
      return 'job_search'
    }
    if (lower.includes('apply') || lower.includes('submit')) {
      return 'apply_job'
    }
    if (lower.includes('my applications') || lower.includes('all applications')) {
      return 'view_applications'
    }
    if (lower.includes('status') || lower.includes('update') || lower.includes('hear back')) {
      return 'track_application'
    }
    if (lower.includes('negotiate') || lower.includes('counter') || lower.includes('offered')) {
      return 'negotiate_offer'
    }
    if (lower.includes('salary') || lower.includes('market rate') || lower.includes('compensation')) {
      return 'salary_intel'
    }
    if (lower.includes('compare') || lower.includes('offers')) {
      return 'compare_offers'
    }
    if (lower.includes('update') || lower.includes('profile') || lower.includes('skills')) {
      return 'update_profile'
    }
    if (lower.includes('withdraw') || lower.includes('cancel')) {
      return 'withdraw_application'
    }

    return 'job_search' // Default
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

/**
 * Create a new JobsHandler instance
 */
export function createJobsHandler(
  userId: string,
  context: ConversationContext
): JobsHandler {
  return new JobsHandler(userId, context)
}

/**
 * Get the singleton handler for use with the handlers index
 */
export function getJobsHandler(): JobsHandlerSingleton {
  return JobsHandlerSingleton.getInstance()
}

export default JobsHandler
