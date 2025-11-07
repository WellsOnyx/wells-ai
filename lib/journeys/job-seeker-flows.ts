/**
 * Job Seeker Journey Flows
 *
 * Enables executive candidates to find opportunities through Wells Onyx.
 * Matches candidates with executive roles based on their profile and preferences.
 */

export interface JobSeekerProfile {
  userId: string
  name: string
  email: string
  currentRole: string
  yearsExperience: number
  seniority: 'ic' | 'manager' | 'director' | 'vp' | 'c-level'
  targetRoles: Array<'CTO' | 'CFO' | 'CISO' | 'COO' | 'VP_Engineering' | 'VP_Sales' | 'VP_Product' | 'Director'>
  industries: string[] // e.g., ['fintech', 'saas', 'healthcare']
  companyStagePreference: Array<'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c-plus' | 'public'>
  compensation: {
    minBase: number
    targetBase: number
    equityImportant: boolean
  }
  location: {
    current: string
    willingToRelocate: boolean
    preferredLocations: string[]
    remoteOk: boolean
  }
  availability: {
    status: 'actively-looking' | 'passively-looking' | 'not-looking'
    canStartIn: string // '2 weeks', '1 month', '3 months'
    reasonForLooking?: string
  }
  strengths: string[] // e.g., ['scaling engineering teams', 'cloud infrastructure', 'hiring']
  resume?: string // URL or text content
  linkedInUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface JobOpportunity {
  id: string
  companyName: string
  companyStage: string
  role: string
  description: string
  compensation: {
    baseMin: number
    baseMax: number
    equityRange: string
  }
  location: string
  remote: boolean
  requirements: string[]
  matchScore: number // 0-100
  matchReasons: string[]
  wellsOnyxContactId?: string // If sourced through Wells Onyx
  status: 'new' | 'reviewed' | 'applied' | 'interviewing' | 'offered' | 'rejected'
  createdAt: Date
}

/**
 * Detect if user is a job seeker based on conversation
 */
export function detectJobSeekerIntent(message: string): {
  isJobSeeker: boolean
  confidence: number
  signals: string[]
} {
  const lowerMessage = message.toLowerCase()
  const signals: string[] = []
  let score = 0

  // Direct signals (high confidence)
  const directKeywords = [
    'looking for a job',
    'find me a job',
    'help me find',
    'i\'m looking for',
    'want to work',
    'career change',
    'new opportunity',
    'open to roles'
  ]

  for (const keyword of directKeywords) {
    if (lowerMessage.includes(keyword)) {
      signals.push(`Direct signal: "${keyword}"`)
      score += 30
    }
  }

  // Role-specific signals
  const roleKeywords = ['cto', 'cfo', 'ciso', 'vp of', 'director of', 'head of', 'chief']
  for (const role of roleKeywords) {
    if (lowerMessage.includes(role)) {
      signals.push(`Role mentioned: ${role}`)
      score += 15
    }
  }

  // Context signals
  if (lowerMessage.includes('resume') || lowerMessage.includes('cv')) {
    signals.push('Resume/CV mentioned')
    score += 20
  }

  if (lowerMessage.includes('interview')) {
    signals.push('Interview mentioned')
    score += 15
  }

  if (lowerMessage.includes('compensation') || lowerMessage.includes('salary')) {
    signals.push('Compensation discussed')
    score += 10
  }

  const confidence = Math.min(score / 100, 1.0)

  return {
    isJobSeeker: confidence > 0.5,
    confidence,
    signals
  }
}

/**
 * Get recommended actions for job seekers
 */
export function getJobSeekerActions(profile: JobSeekerProfile): Array<{
  id: string
  title: string
  description: string
  urgency: 'low' | 'medium' | 'high'
  estimatedTime: string
  nextSteps: string[]
}> {
  const actions = []

  // Build/optimize profile
  if (!profile.resume) {
    actions.push({
      id: 'upload_resume',
      title: 'Upload your resume',
      description: 'I\'ll analyze your background and find matching executive opportunities.',
      urgency: 'high' as const,
      estimatedTime: '5 minutes',
      nextSteps: [
        'Share your resume (PDF or LinkedIn)',
        'I extract your experience and skills',
        'I suggest target roles based on your background',
        'Start matching you with opportunities'
      ]
    })
  }

  // Find opportunities
  if (profile.availability.status === 'actively-looking') {
    actions.push({
      id: 'find_opportunities',
      title: 'Find executive opportunities',
      description: `I'll search Wells Onyx's network for ${profile.targetRoles.join(', ')} roles at companies you'd love.`,
      urgency: 'high' as const,
      estimatedTime: '1 day',
      nextSteps: [
        'I search 1000+ companies in Wells Onyx network',
        'Filter for your target roles and company stage',
        'Score matches based on fit (experience, location, comp)',
        'Present top 5-10 opportunities with intros'
      ]
    })
  }

  // Interview prep
  if (profile.availability.status !== 'not-looking') {
    actions.push({
      id: 'interview_prep',
      title: 'Prepare for executive interviews',
      description: 'I\'ll help you nail interviews with exec-level prep and practice.',
      urgency: 'medium' as const,
      estimatedTime: '2 hours',
      nextSteps: [
        'Review common exec interview questions',
        'Practice behavioral + technical scenarios',
        'I give feedback on your answers',
        'Prep company-specific talking points'
      ]
    })
  }

  // Compensation negotiation
  actions.push({
    id: 'comp_negotiation',
    title: 'Negotiate your offer',
    description: 'When you get offers, I\'ll help you negotiate base, equity, and benefits.',
    urgency: 'low' as const,
    estimatedTime: '1 hour',
    nextSteps: [
      'Share your offer details',
      'I research market comp for the role',
      'Identify leverage points (competing offers, unique skills)',
      'Draft negotiation emails and practice calls'
    ]
  })

  return actions
}

/**
 * Match job seeker with opportunities
 */
export async function matchOpportunities(profile: JobSeekerProfile): Promise<{
  opportunities: JobOpportunity[]
  totalMatches: number
  topMatchReason: string
}> {
  // In production, this would:
  // 1. Query Wells Onyx database for open searches
  // 2. Score each opportunity based on profile fit
  // 3. Return top matches

  // Mock opportunities for now
  const mockOpportunities: JobOpportunity[] = [
    {
      id: 'opp_1',
      companyName: 'FastGrowth SaaS Inc',
      companyStage: 'Series B',
      role: 'CTO',
      description: 'Lead engineering team of 25, scale to 100+ over next 18 months. Product-market fit achieved, now scaling GTM.',
      compensation: {
        baseMin: 220000,
        baseMax: 280000,
        equityRange: '0.5-1.5%'
      },
      location: 'San Francisco, CA',
      remote: true,
      requirements: [
        '10+ years engineering experience',
        'Scaled team from 10 → 50+',
        'Cloud infrastructure expertise',
        'SaaS/B2B experience'
      ],
      matchScore: 92,
      matchReasons: [
        'Your 12 years experience matches 10+ requirement',
        'You\'ve scaled teams before (15 → 60 at previous company)',
        'Target role: CTO matches your preference',
        'Company stage (Series B) matches your preference'
      ],
      status: 'new',
      createdAt: new Date()
    },
    {
      id: 'opp_2',
      companyName: 'HealthTech Innovations',
      companyStage: 'Series A',
      role: 'VP of Engineering',
      description: 'Build and scale engineering team for FDA-regulated healthtech platform. HIPAA compliance critical.',
      compensation: {
        baseMin: 180000,
        baseMax: 220000,
        equityRange: '0.8-2.0%'
      },
      location: 'Remote',
      remote: true,
      requirements: [
        '8+ years engineering experience',
        'Healthcare/regulated industry experience preferred',
        'Team building and hiring expertise',
        'Security-first mindset (HIPAA, SOC 2)'
      ],
      matchScore: 85,
      matchReasons: [
        'Healthcare in your target industries',
        'Remote matches your location preference',
        'VP role matches seniority level',
        'Strong equity component (you marked equity as important)'
      ],
      status: 'new',
      createdAt: new Date()
    }
  ]

  return {
    opportunities: mockOpportunities,
    totalMatches: mockOpportunities.length,
    topMatchReason: mockOpportunities[0]?.matchReasons[0] || 'Great fit for your background'
  }
}

/**
 * Start job application process
 */
export async function applyToOpportunity(params: {
  userId: string
  opportunityId: string
  coverLetter?: string
  customMessage?: string
}): Promise<{
  success: boolean
  message: string
  nextSteps: string[]
}> {
  try {
    // In production:
    // 1. Submit application to Wells Onyx
    // 2. Notify hiring company
    // 3. Track application status

    return {
      success: true,
      message: 'Application submitted! The Wells Onyx team will review and intro you to the hiring manager within 48 hours.',
      nextSteps: [
        'Wells Onyx reviews your application (automated, instant)',
        'If good fit, intro email sent to hiring company',
        'Company schedules initial call (usually within 1 week)',
        'I\'ll prep you for the interview and track progress'
      ]
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to submit application: ${error.message}`,
      nextSteps: ['Try again or contact Wells support']
    }
  }
}

/**
 * Build job seeker profile from resume/LinkedIn
 */
export async function buildProfileFromResume(params: {
  userId: string
  resumeText?: string
  linkedInUrl?: string
}): Promise<{
  success: boolean
  profile?: Partial<JobSeekerProfile>
  suggestions: string[]
}> {
  // In production, use Claude to parse resume and extract:
  // - Current role and company
  // - Years of experience
  // - Skills and strengths
  // - Suggested target roles
  // - Compensation expectations

  return {
    success: true,
    profile: {
      currentRole: 'VP of Engineering',
      yearsExperience: 12,
      seniority: 'vp',
      targetRoles: ['CTO', 'VP_Engineering'],
      industries: ['saas', 'fintech'],
      strengths: ['scaling engineering teams', 'cloud infrastructure', 'hiring']
    },
    suggestions: [
      'Based on your background, CTO roles at Series B/C companies would be a great fit',
      'Your experience at AWS and Stripe is highly valuable - emphasize this',
      'Consider adding "Product-minded engineer" to your profile',
      'Target compensation range: $220K-$300K base + 0.5-2% equity'
    ]
  }
}

/**
 * Interview preparation for specific opportunity
 */
export async function prepareForInterview(params: {
  userId: string
  opportunityId: string
  interviewType: 'phone-screen' | 'technical' | 'behavioral' | 'exec-panel' | 'ceo'
}): Promise<{
  tips: string[]
  commonQuestions: string[]
  companyResearch: string[]
  mockAnswers?: string[]
}> {
  // In production: Use Claude to generate personalized prep based on:
  // - Job description
  // - Company stage and industry
  // - User's background
  // - Interview type

  return {
    tips: [
      'For exec roles, focus on impact (team size, revenue, scale)',
      'Use STAR method (Situation, Task, Action, Result)',
      'Ask about company trajectory and your role in it',
      'Be ready to discuss failures and what you learned'
    ],
    commonQuestions: [
      'Tell me about a time you scaled a team rapidly',
      'How do you balance technical debt vs feature velocity?',
      'Describe your hiring philosophy for senior engineers',
      'What\'s your approach to eng culture and retention?'
    ],
    companyResearch: [
      'Research their tech stack (visible on job posts or eng blog)',
      'Understand their product and target customer',
      'Know their funding stage and investors',
      'Review Glassdoor for interview insights'
    ]
  }
}

/**
 * Negotiate job offer
 */
export async function negotiateOffer(params: {
  userId: string
  opportunityId: string
  offer: {
    base: number
    equity: number
    bonus?: number
    benefits?: string[]
  }
  userExpectations: {
    targetBase: number
    targetEquity: number
  }
}): Promise<{
  recommendations: string[]
  emailTemplate: string
  marketData: {
    p50Base: number
    p75Base: number
    p90Base: number
  }
}> {
  // In production: Use market data + Claude to generate negotiation strategy

  const gap = params.userExpectations.targetBase - params.offer.base
  const gapPercent = (gap / params.offer.base) * 100

  return {
    recommendations: [
      gap > 0 ? `Ask for $${params.userExpectations.targetBase.toLocaleString()} base (${gapPercent.toFixed(0)}% increase)` : 'Base comp is at/above expectations',
      'Request signing bonus if they can\'t move on base',
      'Negotiate equity grant size and vesting schedule',
      'Ask about refresher grants (often more valuable than initial)',
      'Clarify remote work policy and equipment budget'
    ],
    emailTemplate: `Thank you for the offer! I'm excited about the opportunity.

After reviewing, I'd like to discuss the compensation package:

1. **Base Salary**: Given my ${params.userId} years of experience scaling teams and my market research, I was hoping for $${params.userExpectations.targetBase.toLocaleString()}. Is there flexibility here?

2. **Equity**: The ${params.offer.equity}% is appreciated. Can we discuss:
   - Grant size in absolute shares (vs percentage)
   - Vesting schedule and cliff
   - Refresher grant policy

3. **Benefits**: Could you share more about [remote work policy / health benefits / 401k match]?

I'm committed to making this work and excited to join the team. Looking forward to finding a package that works for both sides.`,
    marketData: {
      p50Base: 240000,
      p75Base: 280000,
      p90Base: 320000
    }
  }
}

/**
 * Get conversation starters for job seekers
 */
export function getJobSeekerConversationStarters(profile?: Partial<JobSeekerProfile>): string[] {
  if (!profile) {
    return [
      'Help me find executive opportunities',
      'Review my resume and suggest roles',
      'What should I look for in my next job?',
      'How do I negotiate a job offer?'
    ]
  }

  const starters: string[] = []

  if (profile.availability?.status === 'actively-looking') {
    starters.push('Find me CTO roles at Series B companies')
    starters.push('What companies are hiring right now?')
  }

  if (profile.targetRoles?.length) {
    starters.push(`Match me with ${profile.targetRoles[0]} opportunities`)
  }

  starters.push('Prepare me for my upcoming interview')
  starters.push('Help me negotiate this offer')

  return starters.slice(0, 4)
}
