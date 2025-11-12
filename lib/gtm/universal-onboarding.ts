/**
 * Universal GTM Onboarding
 * One system that adapts to all use cases: hiring, sales, procurement, partnerships, finance
 *
 * Core Insight: They're all "find people matching criteria and reach out"
 * Only the qualification questions change based on use case
 */

export type GTMUseCase = 'hiring' | 'job_seeking' | 'sales' | 'procurement' | 'partnerships' | 'finance' | 'unknown'

export interface UniversalGTMProfile {
  useCase: GTMUseCase
  target: {
    // Universal fields (all use cases)
    title?: string // "Senior Backend Engineer" | "CTO" | "Procurement Manager" | "Supply Chain Partner"
    company?: string // Target company name or type
    location?: string
    seniority?: string // "Senior" | "Director" | "VP" | "C-level"

    // Use-case specific
    skills?: string[] // Hiring: tech stack | Sales: pain points | Procurement: capabilities
    industries?: string[] // Target industries
    companySize?: string // "Startup" | "Mid-market" | "Enterprise"
    budget?: { min?: number; max?: number } // Hiring: salary | Sales: deal size | Procurement: order value
  }
  message: {
    // The 3-line formula adapts to use case
    hook: string // Line 1: Context about opportunity
    why: string // Line 2: Why this specific person
    softClose: string // Line 3: Assumptive close
  }
  signals: {
    // 80-90% zone signals (adapt per use case)
    positive: string[] // What makes them a good fit
    negative: string[] // What disqualifies them (avoid 100% or 50% zones)
  }
  completeness: number // 0-100%
}

/**
 * Detect use case from conversation
 */
export function detectUseCase(messages: string[]): GTMUseCase {
  const allText = messages.join(' ').toLowerCase()

  // Hiring signals (employer looking for candidate)
  if (/hir(e|ing)|recruit|candidate|looking for.*(engineer|developer|designer)|need.*(engineer|developer|designer)/.test(allText)) {
    return 'hiring'
  }

  // Job seeking signals (candidate looking for job)
  if (/looking for.*(job|role|position|opportunity)|job search|career change|open to.*(opportunities|offers)|seeking.*(role|position)/.test(allText)) {
    return 'job_seeking'
  }

  // Sales signals
  if (/customer|client|lead|prospect|sales|deal|buyer|sell/.test(allText)) {
    return 'sales'
  }

  // Procurement signals
  if (/supplier|vendor|procurement|sourcing|rfq|quote|purchase|buy/.test(allText)) {
    return 'procurement'
  }

  // Partnership signals
  if (/partner|partnership|ecosystem|integration|collaborate|alliance/.test(allText)) {
    return 'partnerships'
  }

  // Finance signals
  if (/investor|lender|funding|capital|raise|loan|credit/.test(allText)) {
    return 'finance'
  }

  return 'unknown'
}

/**
 * Get use-case specific qualification questions
 * These are the Step 0 questions from the sourcing methodology
 */
export function getQualificationQuestions(useCase: GTMUseCase): {
  category: string
  question: string
  examples?: string[]
}[] {
  const questions: Record<GTMUseCase, any[]> = {
    hiring: [
      {
        category: 'role',
        question: 'What role are you hiring for?',
        examples: ['Senior Backend Engineer', 'VP of Sales', 'Product Designer']
      },
      {
        category: 'skills',
        question: 'What skills or experience are critical?',
        examples: ['Python/Django', 'B2B SaaS sales', 'Figma/design systems']
      },
      {
        category: 'compensation',
        question: 'What\'s the compensation range?',
        examples: ['$150k-$180k base', '$200k OTE', '$120k + equity']
      },
      {
        category: 'location',
        question: 'Where are they based? (Remote OK?)',
        examples: ['San Francisco', 'Remote (US timezone)', 'Hybrid in NYC']
      },
      {
        category: 'companies',
        question: 'What types of companies should I target? Any to avoid?',
        examples: ['Mid-size startups', 'Avoid FAANG', 'B2B SaaS backgrounds']
      },
      {
        category: 'judgment',
        question: 'How will this person be judged in their first 90 days?',
        examples: ['Ship new payment system', 'Close 3 enterprise deals', 'Redesign onboarding flow']
      }
    ],
    job_seeking: [
      {
        category: 'desired_role',
        question: 'What type of role are you looking for?',
        examples: ['Senior Backend Engineer', 'VP of Product', 'Sales Director']
      },
      {
        category: 'skills',
        question: 'What are your key skills and experience?',
        examples: ['10 years Python/Django', 'Led 50-person sales teams', 'Built 0-to-1 products']
      },
      {
        category: 'compensation',
        question: 'What\'s your target compensation?',
        examples: ['$180k+ base', '$250k OTE', '$150k + significant equity']
      },
      {
        category: 'location',
        question: 'Where are you based? Open to relocation/remote?',
        examples: ['San Francisco, open to remote', 'NYC only', 'Anywhere remote']
      },
      {
        category: 'target_companies',
        question: 'What types of companies interest you?',
        examples: ['Growth-stage startups', 'Healthcare tech', 'B2B SaaS Series B+']
      },
      {
        category: 'goals',
        question: 'What do you want to accomplish in your next role?',
        examples: ['Build payment infrastructure', 'Scale revenue 10x', 'Lead product vision']
      }
    ],
    sales: [
      {
        category: 'icp',
        question: 'Who is your ideal customer?',
        examples: ['Heads of Sales at B2B SaaS companies', 'CTOs at healthcare startups']
      },
      {
        category: 'pain',
        question: 'What problem do you solve for them?',
        examples: ['Manual sales processes', 'Compliance overhead', 'Slow payment reconciliation']
      },
      {
        category: 'deal_size',
        question: 'What\'s your typical deal size?',
        examples: ['$50k-$100k ACV', '$10k MRR', '$500k enterprise contracts']
      },
      {
        category: 'industries',
        question: 'What industries do you target?',
        examples: ['Healthcare', 'Fintech', 'E-commerce']
      },
      {
        category: 'company_size',
        question: 'What company size? (employees or revenue)',
        examples: ['50-500 employees', '$10M-$50M ARR', 'Series B+ startups']
      },
      {
        category: 'timing',
        question: 'What triggers buying intent?',
        examples: ['Just raised funding', 'New compliance requirements', 'Launched new product']
      }
    ],
    procurement: [
      {
        category: 'need',
        question: 'What are you looking to procure?',
        examples: ['Steel beams', 'Cloud services', 'Marketing agency services']
      },
      {
        category: 'specs',
        question: 'What are the specifications or requirements?',
        examples: ['Grade A steel, 20ft length', 'AWS-compatible, SOC2', '50k impressions/month']
      },
      {
        category: 'budget',
        question: 'What\'s your budget range?',
        examples: ['$50k-$100k', '$5k/month', 'Under $200k total']
      },
      {
        category: 'timeline',
        question: 'When do you need it delivered?',
        examples: ['Within 30 days', 'Ongoing monthly', 'Q2 2025']
      },
      {
        category: 'suppliers',
        question: 'Any preferred suppliers or ones to avoid?',
        examples: ['Prefer local', 'Must have ISO certification', 'Avoid offshore']
      },
      {
        category: 'evaluation',
        question: 'How will you evaluate suppliers?',
        examples: ['Price and delivery time', 'Quality and support', 'Certifications and references']
      }
    ],
    partnerships: [
      {
        category: 'partner_type',
        question: 'What type of partner are you looking for?',
        examples: ['Technology integration', 'Reseller', 'Co-marketing']
      },
      {
        category: 'value_prop',
        question: 'What value would they bring to your customers?',
        examples: ['Seamless data sync', 'Extended reach', 'Complementary features']
      },
      {
        category: 'target_partners',
        question: 'Who are your ideal partners?',
        examples: ['CRM platforms', 'Payment processors', 'Analytics tools']
      },
      {
        category: 'size',
        question: 'What size partners? (users, revenue, brand)',
        examples: ['10k+ users', 'Established brand', 'Series B+ startups']
      },
      {
        category: 'structure',
        question: 'What partnership structure?',
        examples: ['Revenue share', 'Referral fees', 'Technical integration only']
      },
      {
        category: 'success_metrics',
        question: 'How will you measure partnership success?',
        examples: ['New user signups', 'Integration adoption', 'Co-marketing reach']
      }
    ],
    finance: [
      {
        category: 'funding_type',
        question: 'What type of capital are you raising?',
        examples: ['Equity (Series A)', 'Debt/credit line', 'Revenue-based financing']
      },
      {
        category: 'amount',
        question: 'How much are you raising?',
        examples: ['$5M Series A', '$50k credit line', '$500k bridge']
      },
      {
        category: 'use_of_funds',
        question: 'What will you use the funds for?',
        examples: ['Product development', 'Sales & marketing', 'Working capital']
      },
      {
        category: 'stage',
        question: 'What stage is your company?',
        examples: ['Pre-seed with MVP', '$2M ARR', 'Profitable, scaling']
      },
      {
        category: 'investors',
        question: 'What types of investors/lenders are you targeting?',
        examples: ['B2B SaaS focused VCs', 'Revenue-based lenders', 'Strategic investors in healthcare']
      },
      {
        category: 'timeline',
        question: 'When do you need to close?',
        examples: ['Next 90 days', 'Q2 2025', 'When we find the right fit']
      }
    ],
    unknown: [] // Will prompt user to clarify
  }

  return questions[useCase] || []
}

/**
 * Get 80-90% zone signals for use case
 * These define who to target vs avoid
 */
export function getTargetingSignals(useCase: GTMUseCase): {
  zone80_90: string[] // Sweet spot
  zone100_avoid: string[] // Too competitive/established
  zone50_avoid: string[] // Underqualified
} {
  const signals: Record<GTMUseCase, any> = {
    hiring: {
      zone80_90: [
        'Mid-tier company (not FAANG)',
        '18-36 months tenure',
        'Ready for next level',
        'Compensation bump opportunity',
        'Relevant skills but not exact match'
      ],
      zone100_avoid: [
        'Recently promoted',
        'At FAANG/top-tier',
        'Crushing performance metrics',
        'Just got raise/equity refresh',
        'Perfect role already'
      ],
      zone50_avoid: [
        'Wrong tech stack',
        'Junior when need senior',
        'Job hopper (< 12 months)',
        'Employment gaps',
        'Doesn\'t meet core requirements'
      ]
    },
    job_seeking: {
      zone80_90: [
        'Hiring for similar roles',
        'Growth-stage (need talent)',
        'In target industry/stage',
        'Competitive comp package',
        'Not recently hired for role'
      ],
      zone100_avoid: [
        'Just filled the role',
        'Hiring freeze',
        'Perfect candidate pipeline',
        'Only promote internally',
        'Can\'t meet comp expectations'
      ],
      zone50_avoid: [
        'Wrong stage (too early/late)',
        'Different industry focus',
        'Not hiring for this role',
        'Geographic mismatch',
        'Can\'t offer target comp'
      ]
    },
    sales: {
      zone80_90: [
        'Has pain you solve',
        'Right company size/industry',
        'Budget authority',
        'Timing trigger present',
        'Using competitor or manual process'
      ],
      zone100_avoid: [
        'Just bought competitor',
        'Long-term contract locked in',
        'Built in-house solution',
        'No budget allocated',
        'Wrong buying cycle timing'
      ],
      zone50_avoid: [
        'Too small (can\'t afford)',
        'Wrong industry',
        'No pain/urgency',
        'No decision authority',
        'Not target ICP'
      ]
    },
    procurement: {
      zone80_90: [
        'Meets specifications',
        'In budget range',
        'Can meet timeline',
        'Good reviews/references',
        'Appropriate capacity'
      ],
      zone100_avoid: [
        'Overqualified (too expensive)',
        'Too big (won\'t prioritize)',
        'Booked solid',
        'Geographic mismatch',
        'Minimum order too high'
      ],
      zone50_avoid: [
        'Missing certifications',
        'No capacity',
        'Outside budget',
        'Can\'t meet timeline',
        'Poor quality reputation'
      ]
    },
    partnerships: {
      zone80_90: [
        'Complementary (not competitive)',
        'Similar customer base',
        'Growth stage aligned',
        'Tech integration feasible',
        'Win-win value prop'
      ],
      zone100_avoid: [
        'Direct competitor',
        'Too big (won\'t prioritize)',
        'Incompatible tech',
        'Conflicting business model',
        'Already have similar partners'
      ],
      zone50_avoid: [
        'Too small',
        'Different customer segment',
        'No technical capability',
        'Poor reputation',
        'Not aligned on values'
      ]
    },
    finance: {
      zone80_90: [
        'Invests in your stage',
        'Your industry/sector',
        'Check size matches',
        'Portfolio fit',
        'Active and investing'
      ],
      zone100_avoid: [
        'Only does mega-rounds',
        'Wrong sector focus',
        'Not currently investing',
        'Portfolio company conflict',
        'Recently closed fund'
      ],
      zone50_avoid: [
        'Too early/late stage',
        'Check size mismatch',
        'Geographic restrictions',
        'No track record',
        'Predatory terms reputation'
      ]
    },
    unknown: {
      zone80_90: [],
      zone100_avoid: [],
      zone50_avoid: []
    }
  }

  return signals[useCase] || signals.unknown
}

/**
 * Generate outreach message adapted to use case
 * Uses the 3-line formula from PROPRIETARY_METHOD.md
 */
export function generateMessage(useCase: GTMUseCase, profile: Partial<UniversalGTMProfile>): {
  subject: string
  body: string
} {
  const templates: Record<GTMUseCase, any> = {
    hiring: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I am working with ${p.companyName} looking for a ${p.target.title} to join the team${p.target.location ? ` in ${p.target.location}` : ''}.

I found your profile both as someone knowledgeable in ${p.target.skills?.[0] || 'this domain'} but also whom could potentially contribute to ${p.impactGoal || 'meaningful work'}.

I assume you are happy where you are but if you are keeping your eyes and ears open to an opportunity, please circle back.`
    },
    job_seeking: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I saw ${p.companyName} is ${p.hiring_signal || 'growing'} and I wanted to reach out about ${p.desired_role} opportunities.

I bring ${p.experience} in ${p.skills?.[0] || 'this domain'} and am specifically looking to ${p.goals || 'contribute to meaningful work'} - ${p.unique_value}.

I assume you're not urgently hiring but if ${p.desired_role} needs are on your roadmap, please circle back.`
    },
    sales: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I noticed ${p.companyName} is ${p.trigger || 'growing'} and thought ${p.productName} might be relevant.

We help ${p.target.title}s solve ${p.pain} - ${p.customers} are seeing ${p.outcome}.

I assume this isn't top of mind but if ${p.trigger || 'solving this'} is on your roadmap, please circle back.`
    },
    procurement: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I understand ${p.companyName} may be looking for ${p.target.need} and wanted to reach out.

We specialize in ${p.capability} with ${p.differentiation} - ${p.customers} value ${p.keyBenefit}.

I assume you have existing suppliers but if you're evaluating options for ${p.timeline}, please circle back.`
    },
    partnerships: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I'm reaching out about a potential partnership between ${p.companyName} and ${p.yourCompany}.

I believe ${p.target.value_prop} would benefit both our customer bases - ${p.synergy}.

I assume partnerships aren't urgent but if this type of collaboration interests you, please circle back.`
    },
    finance: {
      subject: (firstName: string) => firstName,
      body: (p: any) => `I noticed ${p.firmName} invests in ${p.target.stage} ${p.target.industries?.[0]} companies and wanted to share ${p.companyName}.

We're ${p.traction} and raising ${p.amount} to ${p.useOfFunds} - ${p.uniqueAngle}.

I assume your pipeline is full but if this fits your thesis, please circle back.`
    },
    unknown: {
      subject: (firstName: string) => firstName,
      body: () => 'Generic template - need to detect use case first'
    }
  }

  const template = templates[useCase] || templates.unknown

  return {
    subject: template.subject('[FirstName]'),
    body: template.body(profile)
  }
}

/**
 * This is the universal onboarding engine that powers:
 * - Wells Onyx recruiting (hiring use case)
 * - Job seekers (job_seeking use case - reverse hiring)
 * - Sales outreach (sales use case)
 * - Supplier sourcing (procurement use case)
 * - Partner discovery (partnerships use case)
 * - Investor outreach (finance use case)
 *
 * They're ALL the same thing: find people matching criteria and reach out
 * Same core methodology (80-90% zone + 3-line formula), different qualification questions
 */
