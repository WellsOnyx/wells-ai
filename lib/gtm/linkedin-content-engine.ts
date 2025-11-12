/**
 * LinkedIn Content Engine - Inbound GTM
 * Founder Mode: Create content that drives inbound leads
 *
 * Complements outbound outreach with thought leadership and engagement
 */

import { GTMUseCase } from './universal-onboarding'

export interface LinkedInPost {
  content: string
  hook: string // First line that grabs attention
  body: string[] // Main paragraphs
  cta: string // Call to action
  hashtags: string[]
  postType: 'insight' | 'story' | 'advice' | 'milestone' | 'question' | 'controversial'
  estimatedEngagement: 'low' | 'medium' | 'high'
}

export interface ContentStrategy {
  useCase: GTMUseCase
  topics: string[] // What to post about
  voice: string // How to sound (authoritative, humble, provocative, etc.)
  frequency: string // How often to post
  goals: string[] // What success looks like
}

/**
 * Get content strategy for each use case
 */
export function getContentStrategy(useCase: GTMUseCase): ContentStrategy {
  const strategies: Record<GTMUseCase, ContentStrategy> = {
    hiring: {
      useCase: 'hiring',
      topics: [
        'Company culture and values',
        'Day in the life at your company',
        'Why people join and stay',
        'Growth opportunities',
        'Team wins and milestones',
        'Technical challenges you\'re solving',
        'Behind-the-scenes of building'
      ],
      voice: 'Authentic, transparent, mission-driven',
      frequency: '3-5x per week',
      goals: [
        'Build employer brand',
        'Attract passive candidates',
        'Showcase culture',
        'Establish thought leadership'
      ]
    },
    job_seeking: {
      useCase: 'job_seeking',
      topics: [
        'Your expertise and projects',
        'Industry insights and trends',
        'Lessons learned',
        'Technical deep dives',
        'Career journey and growth',
        'Value you bring to teams',
        'Problems you solve'
      ],
      voice: 'Confident, helpful, value-driven',
      frequency: '4-6x per week (active job search)',
      goals: [
        'Build personal brand',
        'Demonstrate expertise',
        'Attract recruiters',
        'Get inbound opportunities'
      ]
    },
    sales: {
      useCase: 'sales',
      topics: [
        'Industry pain points you solve',
        'Customer success stories',
        'Product insights and use cases',
        'Market trends and analysis',
        'Thought leadership in your space',
        'Behind-the-scenes of building',
        'Free value (tips, frameworks, tools)'
      ],
      voice: 'Helpful, authoritative, non-salesy',
      frequency: 'Daily (founder mode)',
      goals: [
        'Build category authority',
        'Generate inbound leads',
        'Educate market',
        'Build trust before selling'
      ]
    },
    procurement: {
      useCase: 'procurement',
      topics: [
        'Supply chain insights',
        'Industry trends',
        'Best practices',
        'Case studies',
        'Innovation in your category',
        'Quality and standards',
        'Partnership stories'
      ],
      voice: 'Professional, trustworthy, expert',
      frequency: '2-3x per week',
      goals: [
        'Build supplier brand',
        'Attract buyers',
        'Demonstrate expertise',
        'Generate RFQ inquiries'
      ]
    },
    partnerships: {
      useCase: 'partnerships',
      topics: [
        'Ecosystem thinking',
        'Integration stories',
        'Partner success',
        'Market education',
        'Platform vision',
        'Win-win examples',
        'Industry collaboration'
      ],
      voice: 'Collaborative, visionary, inclusive',
      frequency: '2-4x per week',
      goals: [
        'Attract partners',
        'Build ecosystem brand',
        'Show partner value',
        'Generate partnership inquiries'
      ]
    },
    finance: {
      useCase: 'finance',
      topics: [
        'Company milestones and traction',
        'Market insights',
        'Vision and mission',
        'Team and execution',
        'Customer validation',
        'Product innovation',
        'Fundraising journey (post-close)'
      ],
      voice: 'Bold, data-driven, visionary',
      frequency: '3-5x per week (fundraising mode)',
      goals: [
        'Attract investors',
        'Build founder brand',
        'Show traction',
        'Generate inbound interest'
      ]
    },
    unknown: {
      useCase: 'unknown',
      topics: [],
      voice: '',
      frequency: '',
      goals: []
    }
  }

  return strategies[useCase]
}

/**
 * Generate LinkedIn post based on use case and topic
 */
export function generateLinkedInPost(
  useCase: GTMUseCase,
  topic: string,
  context?: {
    companyName?: string
    role?: string
    achievement?: string
    insight?: string
    problem?: string
    solution?: string
  }
): LinkedInPost {
  const strategy = getContentStrategy(useCase)

  // Hook formulas (first line) - these drive engagement
  const hookFormulas = {
    controversial: "Most people get this wrong:",
    insight: "Here's what I learned:",
    story: "3 years ago, I made a mistake:",
    advice: "If you're struggling with [X], try this:",
    milestone: "We just hit [milestone] and here's how:",
    question: "Quick question for [audience]:"
  }

  // Post structure templates by use case
  const templates: Record<GTMUseCase, any> = {
    hiring: {
      hook: `We just hired ${context?.role || 'an incredible engineer'} and the interview process taught me something.`,
      body: [
        `Most companies test for skills.`,
        `We test for ${context?.insight || 'how someone thinks about problems'}.`,
        `Here's what we learned: [2-3 bullet points]`,
        `• Point 1\n• Point 2\n• Point 3`
      ],
      cta: `If this resonates, we're hiring. DM me.`,
      hashtags: ['#hiring', '#startuplife', '#engineeringculture'],
      postType: 'insight' as const
    },
    job_seeking: {
      hook: `I spent 10 years solving [problem] and here's what nobody tells you:`,
      body: [
        `The conventional approach is [wrong thing].`,
        `What actually works: [your approach]`,
        `Here's the framework I use: [3 steps]`,
        `1. Step 1\n2. Step 2\n3. Step 3`
      ],
      cta: `If your team is tackling ${topic}, let's talk.`,
      hashtags: ['#engineering', '#carrergrowth', '#leadership'],
      postType: 'advice' as const
    },
    sales: {
      hook: `${context?.companyName || 'A customer'} saved $${context?.achievement || '2M'} by doing this one thing:`,
      body: [
        `They were struggling with ${context?.problem || 'manual processes'}.`,
        `The hidden cost: [time, errors, opportunity cost]`,
        `What changed: ${context?.solution || 'automating the workflow'}`,
        `Results in 90 days: [specific metrics]`
      ],
      cta: `Dealing with this? Comment "interested" and I'll share the framework.`,
      hashtags: ['#b2bsaas', '#productivity', '#automation'],
      postType: 'story' as const
    },
    procurement: {
      hook: `Procurement leaders: Stop optimizing for lowest price.`,
      body: [
        `Price is easy to measure.`,
        `But hidden costs kill you: [delivery delays, quality issues, support gaps]`,
        `What to optimize for instead: [total cost of ownership]`,
        `How we think about it: [framework]`
      ],
      cta: `Thoughts? How do you evaluate suppliers?`,
      hashtags: ['#procurement', '#supplychain', '#sourcing'],
      postType: 'controversial' as const
    },
    partnerships: {
      hook: `Just closed a partnership with ${context?.companyName || 'an amazing company'}.`,
      body: [
        `What made it work: aligned incentives.`,
        `Too many "partnerships" are one-sided.`,
        `Our framework: [win-win criteria]`,
        `Result: ${context?.achievement || 'both customer bases win'}`
      ],
      cta: `Building integrations? Let's explore how we can work together.`,
      hashtags: ['#partnerships', '#ecosystems', '#collaboration'],
      postType: 'milestone' as const
    },
    finance: {
      hook: `We're at $${context?.achievement || '2M'} ARR and here's what investors don't tell you:`,
      body: [
        `Raising capital is the easy part.`,
        `What's hard: [executing, building culture, staying focused]`,
        `Our approach: [your differentiation]`,
        `Traction so far: [metrics]`
      ],
      cta: `If you're building in [space], I'd love to connect.`,
      hashtags: ['#startups', '#fundraising', '#founders'],
      postType: 'insight' as const
    },
    unknown: {
      hook: '',
      body: [],
      cta: '',
      hashtags: [],
      postType: 'insight' as const
    }
  }

  const template = templates[useCase] || templates.unknown

  // Combine into full post
  const fullContent = [
    template.hook,
    '',
    ...template.body,
    '',
    template.cta,
    '',
    template.hashtags.join(' ')
  ].join('\n')

  return {
    content: fullContent,
    hook: template.hook,
    body: template.body,
    cta: template.cta,
    hashtags: template.hashtags,
    postType: template.postType,
    estimatedEngagement: estimateEngagement(template.postType, template.hook)
  }
}

/**
 * Estimate engagement based on post type and hook
 */
function estimateEngagement(postType: LinkedInPost['postType'], hook: string): 'low' | 'medium' | 'high' {
  // Controversial and story posts perform best
  if (postType === 'controversial' || postType === 'story') {
    return 'high'
  }

  // Questions and milestones do well
  if (postType === 'question' || postType === 'milestone') {
    return 'medium'
  }

  // Insights and advice depend on hook quality
  if (hook.includes('wrong') || hook.includes('nobody tells you')) {
    return 'high'
  }

  return 'medium'
}

/**
 * Generate content calendar (7 days)
 */
export function generateContentCalendar(useCase: GTMUseCase): {
  day: number
  postType: LinkedInPost['postType']
  topic: string
  priority: 'high' | 'medium' | 'low'
}[] {
  const strategy = getContentStrategy(useCase)

  // Optimal posting schedule
  const calendar = [
    { day: 1, postType: 'insight' as const, priority: 'high' as const },
    { day: 2, postType: 'story' as const, priority: 'high' as const },
    { day: 3, postType: 'advice' as const, priority: 'medium' as const },
    { day: 4, postType: 'controversial' as const, priority: 'high' as const },
    { day: 5, postType: 'milestone' as const, priority: 'medium' as const },
    { day: 6, postType: 'question' as const, priority: 'low' as const },
    { day: 7, postType: 'story' as const, priority: 'high' as const }
  ]

  return calendar.map((item, idx) => ({
    ...item,
    topic: strategy.topics[idx % strategy.topics.length]
  }))
}

/**
 * LinkedIn best practices
 */
export const linkedInBestPractices = {
  postLength: {
    optimal: '1300 characters',
    why: 'LinkedIn truncates at ~1300, forces "see more" click = engagement'
  },
  timing: {
    best: ['Tuesday-Thursday 7-9am', 'Tuesday-Thursday 5-6pm'],
    avoid: 'Weekends, early mornings, late nights'
  },
  hooks: {
    highPerforming: [
      'Start with a bold claim',
      'Lead with a mistake/lesson',
      'Ask a polarizing question',
      'Share a specific number/result',
      'Challenge conventional wisdom'
    ],
    avoid: [
      'Generic statements',
      'Humble brags',
      'Pure promotion',
      'Too many hashtags'
    ]
  },
  engagement: {
    tactic: 'Comment on your own post 5 min after publishing',
    why: 'Signals to algorithm that discussion is happening, boosts reach',
    what: 'Add context, ask follow-up question, share additional insight'
  },
  hashtags: {
    count: '3-5 max',
    mix: '1-2 broad (10M+ followers), 2-3 niche (100k-1M followers)',
    placement: 'End of post, not scattered throughout'
  }
}

/**
 * Example usage:
 *
 * User: "Help me build my LinkedIn presence to get inbound sales leads"
 * Wells detects: sales use case
 * Wells generates: 7-day content calendar with posts
 * Wells posts: Via LinkedIn API or Phantombuster automation
 * Wells tracks: Engagement, comments, DMs → qualified inbound leads
 *
 * This is the INBOUND complement to OUTBOUND outreach
 * Both use the same qualification, different channels
 */
