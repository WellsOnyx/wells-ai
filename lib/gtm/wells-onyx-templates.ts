/**
 * Wells Onyx Practice Group GTM Templates
 *
 * Pre-configured ICPs and messaging for selling Wells Onyx executive search services.
 * This allows you to use Wells AI to sell your own services - the ultimate dog food moment!
 */

export interface PracticeGroup {
  id: string
  name: string
  description: string
  icp: {
    titles: string[]
    industries: string[]
    companySize: string[]
    commonPainPoints: string[]
    avgDealSize: number
  }
  valueProposition: string
  emailTemplate: {
    subject: string
    body: string
  }
  linkedInTemplate: string
}

/**
 * Wells Onyx Practice Groups - Ready to Launch
 */
export const WELLS_ONYX_PRACTICE_GROUPS: Record<string, PracticeGroup> = {
  cybersecurity: {
    id: 'cybersecurity',
    name: 'Cybersecurity & Data Privacy Leadership',
    description: 'Executive search for CISOs, VPs of Security, and cybersecurity leaders',
    icp: {
      titles: [
        'CEO',
        'Chief Operating Officer',
        'VP of Human Resources',
        'Head of Talent Acquisition',
        'CHRO'
      ],
      industries: [
        'Financial Services',
        'Healthcare',
        'Technology',
        'Government Contractors',
        'SaaS'
      ],
      companySize: ['51-200', '201-500', '501-1000', '1001-5000'],
      commonPainPoints: [
        'Struggling to find qualified CISOs',
        'Need cybersecurity leadership fast (board pressure)',
        'Compliance deadlines approaching',
        'Recent security incident exposed leadership gap',
        'Tired of using generalist recruiters who don't understand InfoSec'
      ],
      avgDealSize: 35000 // $35K placement fee
    },
    valueProposition: `Wells Onyx specializes in placing cybersecurity executives who actually understand zero-trust architecture, SOC 2 Type II, and NIST frameworks. We've placed 50+ CISOs in the last 18 months across fintech, healthcare, and defense contractors.`,
    emailTemplate: {
      subject: 'Re: CISO search for {{company}}',
      body: `{{firstName}},

I noticed {{company}} recently {{trigger}}. This typically signals a need for cybersecurity leadership.

Wells Onyx specializes in placing CISOs and VPs of Security for regulated industries. We've placed 50+ cybersecurity executives in the last 18 months.

Our process:
• Week 1: Shortlist 5 qualified candidates (all with CISSP, most with CISO experience)
• Week 2-3: Client interviews
• Week 4: Offer negotiation + close
• Fee: 25% of first-year comp (contingent - only pay when you hire)

Recent placements:
- CISO at Series C fintech ($180K + equity)
- VP Security at healthcare SaaS (HIPAA compliance focus)
- Head of InfoSec at defense contractor (Top Secret clearance)

Worth a 15-min exploratory call?

Best,
Jonah Manning
Founder, Wells Onyx`
    },
    linkedInTemplate: `{{firstName}} - saw {{company}}'s recent {{trigger}}. This usually means cybersecurity leadership is top of mind.

We've placed 50+ CISOs in the last 18 months (fintech, healthcare, defense). Average time to hire: 28 days.

Worth a quick call to see if we can help?`
  },

  fintech: {
    id: 'fintech',
    name: 'Fintech & Payments Leadership',
    description: 'Executive search for Chief Risk Officers, Heads of Compliance, and fintech executives',
    icp: {
      titles: [
        'CEO',
        'COO',
        'CFO',
        'Chief Compliance Officer',
        'VP of People'
      ],
      industries: [
        'Financial Technology',
        'Payments',
        'Banking',
        'Digital Assets',
        'Lending'
      ],
      companySize: ['11-50', '51-200', '201-500'],
      commonPainPoints: [
        'Need regulatory-savvy executives (SEC, OCC, state licensing)',
        'Can't find candidates with payments experience',
        'Recent exam findings require senior leadership',
        'Scaling compliance team for growth',
        'Board demanding stronger risk management'
      ],
      avgDealSize: 40000
    },
    valueProposition: `Wells Onyx places fintech executives who understand the regulatory maze: Money Transmitter Licenses, Reg E, BSA/AML, state-by-state licensing. We've placed Chief Risk Officers at 3 unicorn fintechs in the last year.`,
    emailTemplate: {
      subject: '{{company}} - Chief Risk Officer search',
      body: `{{firstName}},

{{company}}'s growth trajectory is impressive (congrats on {{recent_milestone}}). That kind of scale typically means it's time for a Chief Risk Officer.

Wells Onyx specializes in placing risk + compliance executives for fast-growing fintechs.

What we do differently:
• We only recruit candidates who've scaled fintech compliance teams (10+ to 50+)
• Deep network of ex-regulators (OCC, SEC, CFPB)
• Expertise in state-by-state MTL licensing
• Average time to hire: 21 days

Recent placements:
- Chief Risk Officer at payments unicorn ($220K + equity)
- Head of Compliance at lending platform (consumer + commercial)
- VP Regulatory Affairs at crypto exchange (50-state expansion)

Fee: 25% first-year comp (contingent)

15-min call to discuss {{company}}'s needs?

Jonah Manning
Wells Onyx`
    },
    linkedInTemplate: `{{firstName}} - {{company}}'s growth is incredible. Usually at this stage, companies need a Chief Risk Officer who understands fintech compliance inside-out.

We've placed CROs at 3 unicorn fintechs this year. Happy to share insights. Worth a call?`
  },

  aerospace: {
    id: 'aerospace',
    name: 'Aerospace & Defense Leadership',
    description: 'Executive search for CTOs, VPs of Engineering, and aerospace executives',
    icp: {
      titles: [
        'CEO',
        'Chief Technology Officer',
        'VP of Engineering',
        'Head of Talent',
        'COO'
      ],
      industries: [
        'Aerospace',
        'Defense',
        'Aviation',
        'Space Technology',
        'Drones & Robotics'
      ],
      companySize: ['11-50', '51-200', '201-500', '501-1000'],
      commonPainPoints: [
        'Need executives with security clearances',
        'Candidates must understand ITAR/EAR',
        'Scaling engineering team for government contracts',
        'Competition from Lockheed/Northrop for talent',
        'Board pushing for commercial aerospace pivot'
      ],
      avgDealSize: 45000
    },
    valueProposition: `Wells Onyx recruits aerospace executives who've built hardware + software teams in regulated environments. Half our placements have active TS/SCI clearances. We understand ITAR, FedRAMP, and CMMC 2.0.`,
    emailTemplate: {
      subject: 'Aerospace CTO search - {{company}}',
      body: `{{firstName}},

I've been following {{company}}'s work on {{product/mission}}. Impressive.

As you scale {{engineering_team}}, you'll likely need a CTO who understands both hardware and software - and can navigate DoD acquisition + ITAR.

Wells Onyx specializes in aerospace + defense executive search.

Our edge:
• 60% of our placements have active security clearances (Secret to TS/SCI)
• Deep relationships with SpaceX, Anduril, and prime contractor alumni
• We understand the unique challenges of dual-use technology companies

Recent placements:
- CTO at defense tech startup ($250K + equity, TS/SCI clearance)
- VP Engineering at commercial space company (reusable launch vehicles)
- Head of Systems Engineering at drone manufacturer (Group 5 UAS)

Fee: 25% first-year comp (contingent)

Worth exploring?

Jonah Manning
Founder, Wells Onyx`
    },
    linkedInTemplate: `{{firstName}} - {{company}}'s mission is inspiring. I specialize in placing aerospace CTOs who have both the technical chops AND security clearances.

Recent placement: CTO at defense tech unicorn (TS/SCI). Happy to share insights if you're building out leadership.`
  },

  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & MedTech Leadership',
    description: 'Executive search for Chief Medical Officers, VPs of Clinical Affairs, and healthcare executives',
    icp: {
      titles: [
        'CEO',
        'COO',
        'Chief Medical Officer',
        'VP of Product',
        'Head of People'
      ],
      industries: [
        'Healthcare Technology',
        'Medical Devices',
        'Digital Health',
        'Biotechnology',
        'Pharmaceuticals'
      ],
      companySize: ['11-50', '51-200', '201-500'],
      commonPainPoints: [
        'Need MDs who can actually lead product teams',
        'FDA submission requires clinical leadership',
        'Investors demanding Chief Medical Officer hire',
        'Physician adoption depends on clinical credibility',
        'Tired of recruiters who don't understand HIPAA/HL7/FHIR'
      ],
      avgDealSize: 38000
    },
    valueProposition: `Wells Onyx places healthcare executives who live at the intersection of clinical medicine and technology. Every CMO we've placed is a practicing physician who's also shipped healthcare software.`,
    emailTemplate: {
      subject: 'Chief Medical Officer search - {{company}}',
      body: `{{firstName}},

{{company}}'s approach to {{clinical_area}} is exactly what healthcare needs.

As you scale toward {{milestone}} (FDA clearance / Series B / hospital pilots), you'll likely need a Chief Medical Officer who can:
- Bridge clinical medicine + product development
- Build trust with physician users
- Navigate regulatory requirements

Wells Onyx specializes in placing CMOs and VPs of Clinical Affairs for digital health + medical device companies.

Our differentiator:
• Every candidate is a practicing MD (not retired physicians who haven't seen patients in 10 years)
• Deep expertise in FDA submissions (510(k), De Novo, PMA)
• Strong relationships with academic medicine (UCSF, Stanford, Mayo, Johns Hopkins)

Recent placements:
- Chief Medical Officer at AI diagnostics startup ($280K + equity, radiologist)
- VP Clinical Affairs at surgical robotics company (510(k) submission)
- Head of Clinical Operations at RPM platform (cardiologist, 500K patient network)

Fee: 25% first-year comp (contingent)

15-min exploratory call?

Jonah Manning
Wells Onyx`
    },
    linkedInTemplate: `{{firstName}} - {{company}}'s clinical outcomes data is impressive. Most digital health companies at your stage need a CMO who can bridge medicine + technology.

We've placed CMOs at 5 FDA-regulated healthtech companies. Happy to share insights.`
  },

  saas: {
    id: 'saas',
    name: 'SaaS & Enterprise Software Leadership',
    description: 'Executive search for CROs, VPs of Sales, and SaaS GTM leaders',
    icp: {
      titles: [
        'CEO',
        'Chief Revenue Officer',
        'VP of Sales',
        'Head of GTM',
        'VP of People'
      ],
      industries: [
        'Software',
        'SaaS',
        'Enterprise Software',
        'Developer Tools',
        'B2B Technology'
      ],
      companySize: ['11-50', '51-200', '201-500'],
      commonPainPoints: [
        'Plateaued at $5M ARR, need enterprise sales leader',
        'Founder-led sales isn't scalable anymore',
        'Board demanding predictable pipeline',
        'Need someone who's built 0→$50M ARR before',
        'Lost last 3 enterprise deals in final stages'
      ],
      avgDealSize: 42000
    },
    valueProposition: `Wells Onyx places SaaS revenue leaders who've scaled ARR from $5M to $50M+. We don't place "VP of Sales" - we place operators who've built repeatable enterprise sales motions.`,
    emailTemplate: {
      subject: 'CRO search for {{company}}',
      body: `{{firstName}},

Congrats on {{company}} hitting {{ARR_milestone}}. That's the inflection point where founder-led sales usually breaks.

You need a Chief Revenue Officer who's scaled a SaaS company from $5M → $50M ARR.

Wells Onyx specializes in placing revenue leaders for B2B SaaS companies.

What we look for:
• Candidates who've built enterprise sales teams (5 → 50+ AEs)
• Experience with $100K+ ACV deals (6-12 month sales cycles)
• Strong relationships with VCs (for pattern-matching + intro effects)
• Track record of hitting 120%+ of quota (not just coasting)

Recent placements:
- CRO at vertical SaaS company ($8M → $35M ARR in 24 months)
- VP Enterprise Sales at developer tools startup (first 10 enterprise customers)
- Head of Revenue at fintech SaaS ($15M ARR, pivot from SMB to enterprise)

Fee: 25% first-year comp (contingent)

Worth a call?

Jonah Manning
Founder, Wells Onyx`
    },
    linkedInTemplate: `{{firstName}} - {{company}} at {{ARR}} is the classic inflection point. You need a CRO who's built $50M+ ARR businesses before.

We've placed 8 SaaS CROs this year (avg ARR growth: 3.2x in 18 months post-hire). Worth a conversation?`
  }
}

/**
 * Get practice group by ID
 */
export function getPracticeGroup(id: string): PracticeGroup | undefined {
  return WELLS_ONYX_PRACTICE_GROUPS[id]
}

/**
 * List all practice groups
 */
export function listPracticeGroups(): PracticeGroup[] {
  return Object.values(WELLS_ONYX_PRACTICE_GROUPS)
}

/**
 * Generate personalized email for a prospect
 */
export function generatePersonalizedEmail(params: {
  practiceGroupId: string
  prospect: {
    firstName: string
    company: string
    trigger?: string // Recent news/event
    recentMilestone?: string
  }
}): { subject: string; body: string } {
  const practiceGroup = getPracticeGroup(params.practiceGroupId)
  if (!practiceGroup) {
    throw new Error(`Practice group not found: ${params.practiceGroupId}`)
  }

  const { subject, body } = practiceGroup.emailTemplate

  // Replace placeholders
  const personalizedSubject = subject
    .replace(/\{\{company\}\}/g, params.prospect.company)
    .replace(/\{\{firstName\}\}/g, params.prospect.firstName)

  const personalizedBody = body
    .replace(/\{\{firstName\}\}/g, params.prospect.firstName)
    .replace(/\{\{company\}\}/g, params.prospect.company)
    .replace(/\{\{trigger\}\}/g, params.prospect.trigger || 'announced funding')
    .replace(/\{\{recent_milestone\}\}/g, params.prospect.recentMilestone || 'recent growth')

  return {
    subject: personalizedSubject,
    body: personalizedBody
  }
}

/**
 * Generate personalized LinkedIn message for a prospect
 */
export function generatePersonalizedLinkedIn(params: {
  practiceGroupId: string
  prospect: {
    firstName: string
    company: string
    trigger?: string
  }
}): string {
  const practiceGroup = getPracticeGroup(params.practiceGroupId)
  if (!practiceGroup) {
    throw new Error(`Practice group not found: ${params.practiceGroupId}`)
  }

  const message = practiceGroup.linkedInTemplate
    .replace(/\{\{firstName\}\}/g, params.prospect.firstName)
    .replace(/\{\{company\}\}/g, params.prospect.company)
    .replace(/\{\{trigger\}\}/g, params.prospect.trigger || 'raised Series B')

  return message
}

/**
 * Detect which practice group to recommend based on conversation
 */
export async function detectPracticeGroup(params: {
  conversation: string
  companyIndustry?: string
}): Promise<string | null> {
  const { conversation, companyIndustry } = params

  // Simple keyword matching (can be replaced with AI later)
  const keywords: Record<string, string[]> = {
    cybersecurity: ['security', 'CISO', 'infosec', 'compliance', 'data breach', 'SOC 2', 'cybersecurity'],
    fintech: ['fintech', 'payments', 'banking', 'regulatory', 'compliance', 'risk', 'CFO', 'financial'],
    aerospace: ['aerospace', 'defense', 'aviation', 'space', 'ITAR', 'clearance', 'drones'],
    healthcare: ['healthcare', 'medical', 'clinical', 'FDA', 'HIPAA', 'physician', 'hospital'],
    saas: ['SaaS', 'software', 'ARR', 'revenue', 'sales', 'enterprise', 'CRO']
  }

  const lowerConv = conversation.toLowerCase()
  const lowerIndustry = companyIndustry?.toLowerCase() || ''

  for (const [practiceGroupId, practiceKeywords] of Object.entries(keywords)) {
    for (const keyword of practiceKeywords) {
      if (lowerConv.includes(keyword.toLowerCase()) || lowerIndustry.includes(keyword.toLowerCase())) {
        return practiceGroupId
      }
    }
  }

  return null
}
