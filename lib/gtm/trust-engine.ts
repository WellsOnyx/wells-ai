/**
 * The Trust Engine
 * Breaking through noise and establishing credibility at scale
 *
 * Philosophy: Don't pitch. Provide value. Be everywhere. Become inevitable.
 */

/**
 * TIER 1: OMNIPRESENCE (They see you everywhere)
 * Before you ever reach out directly
 */

export const OMNIPRESENCE_TACTICS = {
  linkedin: {
    // Your LinkedIn becomes a media company
    contentCadence: {
      postsPerWeek: 3,
      topics: [
        'Exec placement case studies (without names)',
        'AI ops war stories (production failures)',
        'Healthcare compliance insights',
        'Hiring market insights',
        'Salary benchmarking data',
        'Interview red flags',
        'Executive transition dos/donts'
      ]
    },

    // Engage with THEIR content before reaching out
    engagementStrategy: {
      dailyTargets: 20, // Comment on 20 prospect posts/day
      commentQuality: 'Thoughtful, add value, not salesy',
      likes: 50, // Like 50 prospect posts/day
      shares: 5 // Reshare best prospect content
    },

    // They see you in their network
    connectionStrategy: {
      connectToTheirConnections: true, // Build mutual connections
      connectToTheirColleagues: true, // Be in their company's network
      appearInSuggestedPeople: true // LinkedIn algo pushes you to them
    }
  },

  twitter: {
    // For AI Ops prospects (CTOs live here)
    contentCadence: {
      tweetsPerDay: 5,
      topics: [
        'AI production failures (lessons)',
        'Model ops best practices',
        'LLM cost optimization',
        'AI compliance updates',
        'Technical hiring insights'
      ]
    },

    // Engage before you DM
    engagementStrategy: {
      repliesPerDay: 20, // Reply to CTO tweets
      quality: 'Technical, helpful, not pitchy',
      timing: 'Reply within 1 hour of their tweet (high visibility)'
    }
  },

  // Content that establishes authority
  contentAssets: {
    leadMagnets: [
      {
        title: 'The 48-Hour Executive Search Framework',
        format: 'PDF guide',
        gate: 'Email only',
        value: 'How we place C-suite in 2 weeks (full playbook)'
      },
      {
        title: 'AI Operations Incident Response Checklist',
        format: 'Notion template',
        gate: 'LinkedIn connection',
        value: 'What to do when your AI fails at 3am'
      },
      {
        title: 'No Surprises Act Compliance Calculator',
        format: 'Interactive tool',
        gate: 'Email',
        value: 'Calculate your potential IDR revenue/savings'
      }
    ],

    socialProof: [
      'Placed 100+ executives across Series B-D companies',
      'Managing $500M+ in AI operations',
      'Processing 50,000+ IDR determinations annually',
      'Avg exec search: 14 days (industry avg: 120 days)',
      '99.9% AI uptime SLA across 200+ production systems'
    ],

    caseStudies: [
      {
        title: 'How we placed a CTO in 11 days (Series B SaaS)',
        hook: 'Traditional recruiters quoted 6 months',
        result: 'Candidate started in 11 days, raised Series C 6 months later'
      },
      {
        title: 'Saved $2M/year in AI failures (Fintech)',
        hook: 'Model drift went undetected for 3 weeks',
        result: '24/7 ops, caught drift in 4 hours, saved customer churn'
      },
      {
        title: '$750 → $450 per IDR determination (Regional health system)',
        hook: 'Compliance cost center → profit center',
        result: '$2.4M annual savings, scaled to 450 determinations/day'
      }
    ]
  }
}

/**
 * TIER 2: WARM INTRO PATH (Before cold outreach)
 * Establish connection through mutual relationships
 */

export const WARM_INTRO_ENGINE = {
  // Find mutual connections
  mutualConnectionDiscovery: {
    linkedInScrape: true, // See who you both know
    askForIntros: 'Automated message to mutual: "Know {{Name}}? Thinking of reaching out about {{Topic}}"',
    warmIntroRate: '5-10x better than cold'
  },

  // Create mutual connections
  strategicNetworking: {
    connectToTheirInvestors: true, // VCs, PE firms
    connectToTheirBoardMembers: true,
    connectToTheirAdvisors: true,
    connectToIndustryInfluencers: true,
    // When you reach out, you have 5-10 mutual connections = credibility
  },

  // Leverage existing relationships
  referralProgram: {
    incentivize: 'Pay $10K-50K referral fee for executive placements',
    clientReferrals: 'Ask every happy client: "Who else should we help?"',
    candidateReferrals: 'Placed executives refer hiring companies'
  }
}

/**
 * TIER 3: VALUE-FIRST OUTREACH (When you do reach out)
 * Don't ask for the search. Give them something first.
 */

export const VALUE_FIRST_MESSAGES = {
  'executive-search': {
    approach: 'give-before-ask',
    messages: [
      {
        type: 'free-candidate-profiles',
        subject: '3 CFO candidates for {{CompanyName}} (no strings)',
        body: `{{FirstName}},

Saw {{CompanyName}} raised $50M (congrats!). You're probably thinking about finance leadership.

I work in executive search. Here are 3 CFO profiles that match your stage:

1. **{{Candidate1}}** - Ex-VP Finance at {{Company}}, took them $10M → $100M ARR
2. **{{Candidate2}}** - Ex-CFO at {{Company}}, raised Series B & C
3. **{{Candidate3}}** - Current SVP Finance at {{Company}}, ready to step up to CFO

No strings. If you're hiring and want intros, I'm happy to facilitate.

If not, consider this market intelligence.

Best,
Jonah`
      },
      {
        type: 'hiring-market-intel',
        subject: 'CTO salary data for {{Industry}} (since you asked no one)',
        body: `{{FirstName}},

Most CEOs wonder "What should I pay a CTO?" and never get straight answers from recruiters.

Here's real data from our 50+ CTO placements this year:

**Series B SaaS CTOs ({{Industry}}):**
- Base: $250K-350K
- Equity: 1-3%
- Sign-on: $50K-100K
- Total: $400K-600K year 1

**What drives the range:**
- Remote vs SF/NYC: +$50K
- Prior exits: +20-30% equity
- Revenue scale: +$100K if $50M+ ARR

Hope this helps when you're ready to hire.

Best,
Jonah`
      }
    ]
  },

  'ai-ops': {
    approach: 'free-audit',
    messages: [
      {
        type: 'free-ai-health-check',
        subject: 'Your AI uptime (I checked, it\'s interesting)',
        body: `{{FirstName}},

I run AI operations for 50+ companies. Checked {{CompanyName}}'s AI endpoints out of curiosity.

Quick findings:
- Response time: {{ResponseTime}}ms (industry avg: {{IndustryAvg}}ms)
- Error rate: {{ErrorRate}}% (healthy is <1%)
- Model version: {{ModelVersion}} ({{DaysOld}} days old)

**Heads up:** Your {{Endpoint}} endpoint had {{ErrorCount}} errors in last 24h. Might want to check that.

Not trying to sell you. Just thought you'd want to know.

Happy to share full analysis if useful.

Best,
Jonah`
      },
      {
        type: 'incident-post-mortem',
        subject: 'OpenAI outage yesterday - here\'s what we saw',
        body: `{{FirstName}},

Saw OpenAI went down for 2 hours yesterday. We manage AI ops for 50+ companies, so we caught it across all our clients.

**What we did:**
- Auto-failed over to Anthropic (zero customer impact)
- Logged all failures for billing disputes
- Notified all affected customers in <15min

**Total impact across our clients:**
- 200K requests failed
- $0 revenue lost (failover worked)
- 2 hours of my team's time

If you're running AI in production, happy to share our failover playbook (free, no pitch).

Figured you might find it useful.

Best,
Jonah`
      }
    ]
  },

  'idre-agency': {
    approach: 'roi-calculator',
    messages: [
      {
        type: 'cost-savings-analysis',
        subject: '{{CompanyName}} could save $2.4M on IDR (ran the numbers)',
        body: `{{FirstName}},

I specialize in No Surprises Act compliance. Ran some numbers on {{CompanyName}} (publicly available data):

**Your current state (estimated):**
- ~600 IDR determinations/month
- Cost per determination: ~$750 (industry avg)
- Annual cost: ~$5.4M

**What's possible:**
- Cost per determination: $450 (our rate)
- Annual cost: ~$3.0M
- **Annual savings: $2.4M**

Plus: Scale capacity from 600/month to 2,000/month (same team).

Not pitching. Just thought CFOs like savings.

If you want to see the full breakdown, happy to share the model.

Best,
Jonah`
      },
      {
        type: 'compliance-update',
        subject: 'CMS update on IDR batching (affects you)',
        body: `{{FirstName}},

CMS just updated IDR batching rules (Federal Register {{Date}}).

**What changed:**
- Can now batch similar claims within 30-day window
- Reduces per-determination admin by ~40%
- Effective {{EffectiveDate}}

**Impact for {{CompanyName}}:**
- Process ~600 determinations/month
- New rules = save ~$180K/year in admin costs
- Need to update your batching logic by {{Deadline}}

Figured your revenue cycle team should know.

Not trying to sell anything. Just seemed important.

Best,
Jonah`
      }
    ]
  }
}

/**
 * TIER 4: TIMING-BASED TRIGGERS (Strike when iron is hot)
 * Don't reach out randomly. Reach out when they NEED you.
 */

export const TIMING_TRIGGERS = {
  'executive-search': [
    {
      trigger: 'funding-announcement',
      signal: 'Company raised Series B/C/D',
      timing: '7-14 days after announcement',
      message: 'Congrats on the raise. Probably thinking about leadership team now...',
      why: 'Companies hire execs 30-90 days after raising money'
    },
    {
      trigger: 'executive-departure',
      signal: 'LinkedIn shows "{{Executive}} is no longer at {{Company}}"',
      timing: 'Within 48 hours',
      message: 'Saw {{Executive}} left. If you\'re looking for a {{Role}}, we placed 20 this year...',
      why: 'Urgent need = less price sensitivity = fast decision'
    },
    {
      trigger: 'hiring-surge',
      signal: '10+ new job postings in 7 days',
      timing: 'Immediately',
      message: 'Noticed {{Company}} is scaling fast. Need leadership to manage the growth?',
      why: 'Rapid growth = need for senior leadership'
    }
  ],

  'ai-ops': [
    {
      trigger: 'ai-product-launch',
      signal: 'Company announces new AI feature',
      timing: '30 days after launch',
      message: 'Congrats on launching {{Feature}}. 30 days in, ops pain usually hits now...',
      why: 'Production issues emerge 30-60 days post-launch'
    },
    {
      trigger: 'ai-incident',
      signal: 'Company tweets about AI outage/issue',
      timing: 'Within 24 hours',
      message: 'Saw the {{Feature}} issue. We handle 24/7 ops for 50+ AI companies if you need backup...',
      why: 'Pain is fresh = high urgency'
    },
    {
      trigger: 'hiring-ml-engineers',
      signal: '5+ ML engineer job postings',
      timing: 'Immediately',
      message: 'Hiring ML team = launching AI product soon. Who\'s running ops?',
      why: 'Hiring surge = new AI initiative = need for ops'
    }
  ],

  'idre-agency': [
    {
      trigger: 'hospital-acquisition',
      signal: 'Company acquires new hospital/facility',
      timing: '60 days after close',
      message: 'Congrats on acquiring {{Hospital}}. Integration means 3x the IDR volume...',
      why: 'Acquisitions = immediate scale need'
    },
    {
      trigger: 'cms-audit',
      signal: 'Company mentioned in CMS audit report',
      timing: 'Within 7 days',
      message: 'Saw CMS audit findings. We can help with compliance remediation...',
      why: 'Audit = urgent compliance need'
    },
    {
      trigger: 'hiring-revenue-cycle',
      signal: 'Job posting for VP Revenue Cycle / Director IDR',
      timing: 'Immediately',
      message: 'Hiring for IDR leadership = scaling pain. We can be your outsourced IDR team...',
      why: 'Hiring = they know they have a problem'
    }
  ]
}

/**
 * THE TRUST EQUATION
 *
 * Trust = (Credibility + Reliability + Intimacy) / Self-Orientation
 *
 * Credibility: Social proof, case studies, thought leadership
 * Reliability: Consistent presence, follow-through, responsiveness
 * Intimacy: Personal connection, understanding their pain, mutual connections
 * Self-Orientation: How much you're trying to sell vs help
 *
 * MAXIMIZE: Credibility, Reliability, Intimacy
 * MINIMIZE: Self-Orientation (don't pitch, provide value)
 */

export function calculateTrustScore(contact: any): number {
  let credibility = 0
  let reliability = 0
  let intimacy = 0
  let selfOrientation = 100 // Start high, reduce with value-first touches

  // Credibility (do they know who you are?)
  if (contact.sawYourLinkedInPost) credibility += 20
  if (contact.readYourContent) credibility += 20
  if (contact.sawClientTestimonials) credibility += 20
  if (contact.mutualConnections > 0) credibility += 20
  if (contact.industryRecognition) credibility += 20

  // Reliability (have you been consistent?)
  if (contact.engagedWithTheirContent) reliability += 30
  if (contact.providedValueFirst) reliability += 40
  if (contact.followedUpConsistently) reliability += 30

  // Intimacy (do you understand them?)
  if (contact.referencedTheirWork) intimacy += 25
  if (contact.addressedSpecificPain) intimacy += 25
  if (contact.timingWasRelevant) intimacy += 25
  if (contact.offeredCustomSolution) intimacy += 25

  // Self-Orientation (are you helping or selling?)
  if (contact.pitchedImmediately) selfOrientation += 50
  if (contact.providedFreeValue) selfOrientation -= 30
  if (contact.askedQuestionsFirst) selfOrientation -= 20
  if (contact.madeItAboutThem) selfOrientation -= 30

  // Trust = (C + R + I) / S
  const trust = (credibility + reliability + intimacy) / Math.max(selfOrientation, 1)

  return Math.min(trust * 100, 100)
}
