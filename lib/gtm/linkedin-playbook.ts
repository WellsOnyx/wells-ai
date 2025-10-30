/**
 * LinkedIn-First GTM Playbook
 * Personal use - leverages your LinkedIn profile and permissions
 *
 * Flow:
 * 1. Find prospects (Sales Navigator or Boolean search)
 * 2. Send personalized connection request
 * 3. Once connected: 3-touch message sequence
 * 4. Book meeting
 */

export const LINKEDIN_CAMPAIGNS = {
  'executive-search': {
    name: 'Executive Search - LinkedIn Outbound',

    // Sales Navigator Search Filters
    searchCriteria: {
      titles: [
        'Chief Executive Officer',
        'CEO',
        'Chief Human Resources Officer',
        'CHRO',
        'VP Talent',
        'VP of Talent Acquisition',
        'Chief People Officer'
      ],
      industries: ['Technology', 'Software Development', 'Financial Services', 'Healthcare'],
      companySize: ['51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'],
      geography: ['United States'],
      keywords: ['hiring', 'growth', 'funding', 'Series B', 'scaling']
    },

    // Connection Request (max 300 characters)
    connectionNote: {
      template: `Hi {{firstName}}, saw {{companyName}}'s growth. We place C-suite executives in 2 weeks vs 6 months. Worth connecting?`,
      variations: [
        `{{firstName}} - noticed {{companyName}} is scaling. Our exec search closes in 2 weeks, not 6 months. Let's connect?`,
        `Hi {{firstName}}, helping companies like {{companyName}} fill C-suite roles fast. Would value the connection.`,
        `{{firstName}} - your {{role}} at {{companyName}} caught my eye. We specialize in rapid exec placement. Connect?`
      ]
    },

    // Message Sequence (sent after connection accepted)
    messageSequence: [
      {
        day: 1, // Send immediately after connection
        subject: null, // LinkedIn doesn't use subject lines
        message: `Thanks for connecting, {{firstName}}!

Quick context: We're Wells Onyx - we place C-suite executives in 2-3 weeks instead of 6 months through AI-powered search.

I noticed {{companyName}} {{signal}} - curious if you're hiring for any leadership roles right now?

If so, I'd love to share how we work (33% success fee, 90-day guarantee).

Either way, great to be connected.

Best,
Jonah`
      },
      {
        day: 4, // Follow-up if no response
        message: `{{firstName}} - following up on my note about executive search.

We just placed a {{relevantRole}} for a {{relevantCompany}} in 11 days. They were struggling with traditional recruiters taking 6+ months.

Our process:
→ AI-powered candidate sourcing
→ Full vetting (skills, culture, references)
→ 2-week average time to qualified candidates
→ 90-day placement guarantee

Worth a 15-min call this week?

Calendly: [LINK]`
      },
      {
        day: 7, // Final touch
        message: `{{firstName}} - last note!

I know you're busy. If {{companyName}} isn't hiring execs right now, totally understand.

But if you ever need to fill a C-suite role fast (CEO, CFO, CTO, etc.), we're here:
• 2-3 week timeline
• 33% of first-year comp (only paid on success)
• 100+ successful placements

Feel free to reach out anytime.

Best,
Jonah`
      }
    ],

    // Signals to personalize with (add to {{signal}})
    signals: [
      'recently raised Series B',
      'is expanding to new markets',
      'just launched a new product',
      'is hiring aggressively',
      'has open leadership roles on your careers page',
      'was featured in [publication] recently'
    ]
  },

  'ai-ops': {
    name: 'AI Ops - LinkedIn Outbound',

    searchCriteria: {
      titles: [
        'Chief Technology Officer',
        'CTO',
        'VP Engineering',
        'VP of Engineering',
        'Chief Information Officer',
        'CIO',
        'Head of AI',
        'Head of Machine Learning'
      ],
      industries: ['Software Development', 'Technology', 'Artificial Intelligence', 'SaaS', 'Fintech'],
      companySize: ['51-200', '201-500', '501-1000', '1001-5000'],
      geography: ['United States'],
      keywords: ['AI', 'ML', 'machine learning', 'artificial intelligence', 'LLM', 'production AI']
    },

    connectionNote: {
      template: `Hi {{firstName}}, saw {{companyName}}'s AI work. We do 24/7 AI ops so systems never fail. Worth connecting?`,
      variations: [
        `{{firstName}} - noticed {{companyName}} is shipping AI. We provide 24/7 ops for AI in production. Let's connect?`,
        `Hi {{firstName}}, specializing in AI operations for companies like {{companyName}}. Would value the connection.`
      ]
    },

    messageSequence: [
      {
        day: 1,
        message: `Thanks for connecting, {{firstName}}!

I'm reaching out because {{companyName}} {{signal}} and AI operations is our specialty.

Quick Q: How are you currently monitoring your AI systems in production?

Most CTOs we work with struggle with:
❌ Model drift causing quality issues
❌ No one to call when AI fails at 3am
❌ Compliance/audit requirements (SOC 2, ISO)
❌ Ops eating engineering time

We run 24/7 AI operations (99.9% uptime SLA) so your eng team can build features instead of firefighting.

Worth a quick call?

Best,
Jonah`
      },
      {
        day: 4,
        message: `{{firstName}} - following up on AI ops.

We just saved a fintech company $2M/year in AI failures. Their model was drifting and they didn't catch it for 3 weeks (customers were churning).

Now we monitor 24/7:
→ 99.9% uptime SLA (<30min P1 response)
→ Proactive model optimization
→ Full compliance audit trails
→ $150K-$400K/mo for 100 instances

We handle ops, your team builds product.

15-min call? [CALENDLY]`
      },
      {
        day: 7,
        message: `{{firstName}} - last note!

If {{companyName}}'s AI is running smoothly, that's awesome.

But if you ever hit scaling issues, model drift, or compliance needs, we're here:

• 24/7 NOC for AI systems
• SOC 2 / HIPAA / ISO certified ops
• Free your eng team from ops firefighting

Reach out anytime.

Best,
Jonah`
      }
    ],

    signals: [
      'recently launched AI features',
      'is hiring ML engineers',
      'mentioned AI/ML in recent funding announcement',
      'posted about AI on LinkedIn',
      'has AI/ML in the product description'
    ]
  },

  'idre-agency': {
    name: 'IDRE Agency - LinkedIn Outbound',

    searchCriteria: {
      titles: [
        'Chief Financial Officer',
        'CFO',
        'Chief Operating Officer',
        'COO',
        'VP Revenue Cycle',
        'Director Revenue Cycle',
        'VP Finance'
      ],
      industries: ['Hospital & Health Care', 'Health, Wellness and Fitness', 'Medical Practice'],
      companySize: ['201-500', '501-1000', '1001-5000', '5001-10000', '10000+'],
      geography: ['United States'],
      keywords: ['IDR', 'No Surprises Act', 'revenue cycle', 'payer relations', 'dispute resolution']
    },

    connectionNote: {
      template: `Hi {{firstName}}, helping health systems with No Surprises Act compliance. Worth connecting?`,
      variations: [
        `{{firstName}} - specializing in IDR determinations at scale for health systems. Let's connect?`,
        `Hi {{firstName}}, saw {{companyName}}'s work. We turn No Surprises Act compliance into profit center. Connect?`
      ]
    },

    messageSequence: [
      {
        day: 1,
        message: `Thanks for connecting, {{firstName}}!

Quick question: How is {{companyName}} handling IDR determinations under the No Surprises Act?

Most health system CFOs we work with are:
❌ Paying $600-800 per determination (bleeding cash)
❌ Backlogged on disputes (federal penalties risk)
❌ Internal teams can't scale past 50-100/day

We process IDR determinations at $400-600 each:
→ 30 determinations/day per Practice Lead
→ Scale to 900+/day
→ ≥98% quality (virtually zero reversals)
→ Turn compliance burden into $3M-$100M+ run-rate

Worth a quick call to explore?

Best,
Jonah`
      },
      {
        day: 4,
        message: `{{firstName}} - following up on IDRE services.

We just helped a regional health system reduce their per-determination cost from $750 to $450 (saving $2.4M annually).

They're now processing 450 determinations/day with our team vs 80/day with their internal staff.

The math:
• $400-600 per determination (vs $600-800 industry avg)
• 900+ determinations/day capacity
• $3M-$100M+ annual run-rate potential

15-min call? [CALENDLY]`
      },
      {
        day: 7,
        message: `{{firstName}} - last note on IDRE!

If {{companyName}}'s IDR process is working well, that's great.

But if you're dealing with:
• High cost per determination
• Backlogs and federal penalties risk
• Quality issues causing reversals

We're here to help turn compliance into profit.

Reach out anytime.

Best,
Jonah`
      }
    ],

    signals: [
      'recently acquired hospitals',
      'mentioned No Surprises Act compliance',
      'posted about revenue cycle challenges',
      'is a large health system with high out-of-network volume',
      'hiring for revenue cycle positions'
    ]
  }
}

/**
 * LinkedIn Workflow Helper
 */
export interface LinkedInWorkflow {
  prospect: {
    firstName: string
    lastName: string
    title: string
    companyName: string
    linkedInUrl: string
    signal?: string
  }
  campaign: keyof typeof LINKEDIN_CAMPAIGNS
}

export function generateConnectionRequest(workflow: LinkedInWorkflow): string {
  const campaign = LINKEDIN_CAMPAIGNS[workflow.campaign]
  const template = campaign.connectionNote.template

  return template
    .replace('{{firstName}}', workflow.prospect.firstName)
    .replace('{{companyName}}', workflow.prospect.companyName)
    .replace('{{role}}', workflow.prospect.title)
}

export function generateMessageSequence(workflow: LinkedInWorkflow): Array<{day: number, message: string}> {
  const campaign = LINKEDIN_CAMPAIGNS[workflow.campaign]

  return campaign.messageSequence.map(msg => ({
    day: msg.day,
    message: msg.message
      .replace(/{{firstName}}/g, workflow.prospect.firstName)
      .replace(/{{companyName}}/g, workflow.prospect.companyName)
      .replace(/{{signal}}/g, workflow.prospect.signal || 'is doing interesting work')
      .replace(/{{relevantRole}}/g, 'relevant role placeholder')
      .replace(/{{relevantCompany}}/g, 'similar company')
  }))
}

/**
 * Daily LinkedIn Routine
 *
 * Morning (15 min):
 * - Review 10-20 prospect profiles
 * - Send 10-15 personalized connection requests
 * - Engage with 5-10 posts from prospects (like/comment)
 *
 * Midday (10 min):
 * - Check for new connection acceptances
 * - Send Day 1 message to new connections
 * - Respond to any replies
 *
 * Evening (5 min):
 * - Review profile views (warm leads)
 * - Schedule follow-ups for next day
 */

export const DAILY_LINKEDIN_TARGETS = {
  connectionRequests: 15, // LinkedIn limit: ~100/week = ~15/day
  messagesToNewConnections: 10,
  followUpMessages: 5,
  postEngagements: 10 // Like/comment on prospect posts
}
