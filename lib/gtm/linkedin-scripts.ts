/**
 * Grain & Vault - LinkedIn Outreach Scripts
 *
 * For use with LinkedIn Sales Navigator ($100/mo budget)
 * Goal: Build relationships, book demos
 *
 * Philosophy:
 * - Be human, not salesy
 * - Add value before asking
 * - Keep messages SHORT (LinkedIn = mobile)
 * - Use voice notes when possible (5x response rate)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface LinkedInScript {
  id: string
  name: string
  type: 'connection_request' | 'inmail' | 'follow_up' | 'voice_note' | 'engagement_comment'
  persona: 'cfo' | 'procurement' | 'controller' | 'treasury' | 'generic'
  message: string
  characterCount: number  // LinkedIn limits
  voiceNoteScript?: string  // For voice note variant
  tips: string[]
}

export interface LinkedInSequence {
  id: string
  name: string
  persona: string
  steps: LinkedInScript[]
  totalDays: number
}

// =============================================================================
// CONNECTION REQUEST MESSAGES
// =============================================================================

// LinkedIn connection request: 300 character limit
export const CONNECTION_REQUESTS: LinkedInScript[] = [
  {
    id: 'conn-cfo-1',
    name: 'CFO Connection - Industry Angle',
    type: 'connection_request',
    persona: 'cfo',
    message: `Hi {{firstName}} - I work with CFOs in {{industry}} on treasury optimization. Noticed {{company}}'s growth and thought we might have some insights to share. Would love to connect.`,
    characterCount: 195,
    tips: [
      'Keep it under 300 chars',
      'Reference their industry specifically',
      'No pitch in connection request',
    ],
  },
  {
    id: 'conn-cfo-2',
    name: 'CFO Connection - Mutual Interest',
    type: 'connection_request',
    persona: 'cfo',
    message: `{{firstName}} - saw your post on {{topic}}. Really resonated with the point about {{insight}}. Working on something similar in treasury tech. Would love to connect.`,
    characterCount: 182,
    tips: [
      'Reference recent post/activity',
      'Show you actually read it',
      'Builds genuine rapport',
    ],
  },
  {
    id: 'conn-procurement-1',
    name: 'Procurement Connection - Supply Chain',
    type: 'connection_request',
    persona: 'procurement',
    message: `Hi {{firstName}} - I focus on helping procurement leaders streamline supplier payments. {{company}}'s supply chain work caught my eye. Let's connect?`,
    characterCount: 168,
    tips: [
      'Procurement folks are busy - keep it simple',
      'Reference supply chain work',
    ],
  },
  {
    id: 'conn-controller-1',
    name: 'Controller Connection - AP Focus',
    type: 'connection_request',
    persona: 'controller',
    message: `{{firstName}} - connecting with controllers tackling AP automation. We're building something that might interest you. Would love to connect and share ideas.`,
    characterCount: 169,
    tips: [
      'Controllers appreciate directness',
      'AP automation is their world',
    ],
  },
  {
    id: 'conn-treasury-1',
    name: 'Treasury Connection - Yield Focus',
    type: 'connection_request',
    persona: 'treasury',
    message: `Hi {{firstName}} - fellow treasury nerd here. Working on a new approach to corporate yield optimization. Would love to connect and share perspectives.`,
    characterCount: 162,
    tips: [
      'Treasury is niche - they appreciate peers',
      'Yield optimization is their mandate',
    ],
  },
  {
    id: 'conn-mutual-1',
    name: 'Mutual Connection Angle',
    type: 'connection_request',
    persona: 'generic',
    message: `{{firstName}} - saw we both know {{mutualConnection}}. I'm working with finance leaders on treasury optimization. Would love to connect!`,
    characterCount: 142,
    tips: [
      'Mutual connections 2x acceptance rate',
      'Only use if connection is real/relevant',
    ],
  },
]

// =============================================================================
// INMAIL TEMPLATES
// =============================================================================

// InMail: 1900 character body limit, 200 character subject
export const INMAILS: LinkedInScript[] = [
  {
    id: 'inmail-cfo-1',
    name: 'CFO InMail - Value First',
    type: 'inmail',
    persona: 'cfo',
    message: `Subject: Quick thought on {{company}}'s treasury

{{firstName}},

I'll keep this short - I know your inbox is brutal.

We're helping CFOs at {{industry}} companies earn 4.5%+ yield on operating cash while eliminating payment processing fees.

The model in 30 seconds:
- Deposit predictable supplier spend
- Get 1:1 credit line at 0% interest
- Pay vendors instantly at 0% fees
- Your deposit appreciates 4.5%+ annually

Worth 15 minutes to see if it fits {{company}}?

Happy to send a quick Loom instead if that's easier.

Best,
[Your name]`,
    characterCount: 580,
    tips: [
      'Subject should be curiosity-inducing',
      'Acknowledge they are busy',
      'Give them an "easy" option (Loom)',
    ],
  },
  {
    id: 'inmail-procurement-1',
    name: 'Procurement InMail - Supplier Focus',
    type: 'inmail',
    persona: 'procurement',
    message: `Subject: Instant supplier payments at 0% fees

{{firstName}},

Quick question: what does {{company}} pay in payment processing fees? 2-3% on cards? Wire fees on international?

We built Grain & Vault to solve this:
- Pay any supplier instantly (sub-second)
- 0% payment fees (1% sourcing fee - COGS, not overhead)
- Suppliers get USD via ACH - no change on their end

Plus: your operating cash earns 4.5%+ while waiting to be paid out.

We're working with several {{industry}} procurement teams. Worth a quick call?

[Your name]`,
    characterCount: 520,
    tips: [
      'Lead with their pain (fees)',
      'Clarify supplier experience',
      'Social proof (working with similar companies)',
    ],
  },
  {
    id: 'inmail-cold-trigger',
    name: 'Trigger-Based InMail',
    type: 'inmail',
    persona: 'generic',
    message: `Subject: Congrats on {{trigger}}

{{firstName}},

Saw the news about {{trigger}} - congrats! That kind of growth usually means more supplier relationships to manage and more working capital to optimize.

We're Grain & Vault. We help growing companies:
- Turn idle cash into 4.5%+ yield
- Pay suppliers instantly at 0% fees
- Auto-reconcile with their ERP

If treasury efficiency is on your radar post-{{trigger}}, happy to share how similar companies are approaching it.

15 minutes?

[Your name]`,
    characterCount: 490,
    tips: [
      'Use for funding rounds, acquisitions, exec hires',
      'Make the trigger specific',
      'Connect trigger to your value prop',
    ],
  },
]

// =============================================================================
// FOLLOW-UP AFTER CONNECTION
// =============================================================================

export const FOLLOW_UP_SCRIPTS: LinkedInScript[] = [
  {
    id: 'follow-1',
    name: 'Day 1 After Connection - Soft Intro',
    type: 'follow_up',
    persona: 'generic',
    message: `Thanks for connecting, {{firstName}}!

I work with {{persona}} at {{industry}} companies on treasury and payment optimization. Always happy to share what we're seeing in the market.

If you're ever thinking about working capital efficiency, I'd love to chat. No pressure - just here if useful.

What's keeping you busy these days?`,
    characterCount: 340,
    tips: [
      'Don\'t pitch immediately',
      'Ask a genuine question',
      'Offer value, don\'t demand time',
    ],
  },
  {
    id: 'follow-2',
    name: 'Day 3-5 After Connection - Value Add',
    type: 'follow_up',
    persona: 'generic',
    message: `{{firstName}} - came across this article on {{relevant_topic}} and thought of our conversation.

{{article_link}}

TL;DR: {{one_line_summary}}

Curious if you're seeing this at {{company}} too?`,
    characterCount: 220,
    tips: [
      'Share genuinely relevant content',
      'Add your take (don\'t just dump links)',
      'Creates reason to respond',
    ],
  },
  {
    id: 'follow-3',
    name: 'Day 7-10 After Connection - Soft Pitch',
    type: 'follow_up',
    persona: 'generic',
    message: `{{firstName}} - been thinking about our exchange.

Question: what's {{company}}'s current approach to optimizing treasury yield? Sticking with money markets, or exploring alternatives?

We're seeing some {{industry}} companies shift to treasury-backed yield platforms (4.5%+ vs 2-3% money market). Happy to share what they're doing if useful.

No pitch - just curious if it's on your radar.`,
    characterCount: 390,
    tips: [
      'Ask permission to share more',
      'Position as insight, not pitch',
      'Let them opt in',
    ],
  },
  {
    id: 'follow-4',
    name: 'Week 2+ - Direct Ask',
    type: 'follow_up',
    persona: 'generic',
    message: `{{firstName}} - I'll cut to the chase.

We've built something that helps companies like {{company}} earn 4.5%+ on operating cash while paying suppliers at 0% fees.

I think it could be relevant for you. Would you be open to a 15-minute call to see?

If not, no worries - happy to stay connected and share insights when useful.`,
    characterCount: 340,
    tips: [
      'Direct is respectful of their time',
      'Give them an easy out',
      'By now you\'ve earned some attention',
    ],
  },
]

// =============================================================================
// VOICE NOTE SCRIPTS
// =============================================================================

// Voice notes: 60 seconds max, highly personal
export const VOICE_NOTE_SCRIPTS: LinkedInScript[] = [
  {
    id: 'voice-1',
    name: 'Initial Voice Note - Post Connection',
    type: 'voice_note',
    persona: 'generic',
    message: '', // Voice notes don't have text
    characterCount: 0,
    voiceNoteScript: `Hey {{firstName}}, it's [Your name] - just wanted to send a quick note instead of another wall of text.

Thanks for connecting. I work with {{persona}} at companies like {{company}}, helping them optimize treasury yield and streamline supplier payments.

I'm not trying to pitch you anything right now - just wanted to put a voice to the name and say if you ever want to chat about what's working for other {{industry}} finance leaders, I'm always happy to share.

Hope you're having a great week. Talk soon.`,
    tips: [
      'Keep under 45 seconds',
      'Be natural, not scripted (use this as a guide)',
      'Smile when you record - it comes through',
      '5x response rate vs text',
    ],
  },
  {
    id: 'voice-2',
    name: 'Voice Note - Demo Invite',
    type: 'voice_note',
    persona: 'generic',
    message: '',
    characterCount: 0,
    voiceNoteScript: `Hey {{firstName}}, [Your name] here.

I've been thinking about our conversation and I really think you'd find value in seeing what we've built at Grain & Vault.

Quick version: you deposit your predictable spend, earn 4.5% on it, and use it to pay suppliers at zero fees. It's kind of crazy but it works.

Would you be open to a 15-minute demo? I promise to keep it tight. Just reply here or grab a time on my calendar - I'll drop a link.

Hope to chat soon.`,
    tips: [
      'Only use after some rapport',
      'Be enthusiastic but not pushy',
      'Clear CTA at the end',
    ],
  },
  {
    id: 'voice-3',
    name: 'Voice Note - Follow Up After No Response',
    type: 'voice_note',
    persona: 'generic',
    message: '',
    characterCount: 0,
    voiceNoteScript: `Hey {{firstName}}, [Your name] again.

Just wanted to bump my last message. I know you're busy - trust me, I get it.

Quick question: is treasury optimization even on your radar right now? If yes, I'd love to show you what we're doing. If not, totally fine - I'll check back in a few months.

Either way, appreciate you connecting. Let me know what works.`,
    tips: [
      'Keep it light',
      'Give them an easy out',
      'Shows persistence without being annoying',
    ],
  },
]

// =============================================================================
// ENGAGEMENT COMMENTS (Content Strategy)
// =============================================================================

export const ENGAGEMENT_COMMENTS: LinkedInScript[] = [
  {
    id: 'engage-1',
    name: 'Thoughtful Comment on Treasury Post',
    type: 'engagement_comment',
    persona: 'treasury',
    message: `Great point about {{topic}}, {{firstName}}. We're seeing similar patterns at {{industry}} companies - especially around {{specific_insight}}.

One thing I'd add: {{your_perspective}}. Curious what you're seeing on {{related_question}}?`,
    characterCount: 280,
    tips: [
      'Comment on their posts BEFORE connecting',
      'Add genuine insight, not just "Great post!"',
      'Ask a question to start dialogue',
    ],
  },
  {
    id: 'engage-2',
    name: 'Comment on Finance/Treasury Content',
    type: 'engagement_comment',
    persona: 'cfo',
    message: `This resonates, {{firstName}}. The challenge with traditional treasury approaches is {{pain_point}}.

We're seeing some CFOs explore {{alternative_approach}} to solve this. Worth exploring if you haven't looked into it.`,
    characterCount: 240,
    tips: [
      'Position yourself as knowledgeable peer',
      'Introduce your solution obliquely',
      'Don\'t overtly pitch in comments',
    ],
  },
]

// =============================================================================
// LINKEDIN SEQUENCES
// =============================================================================

export const LINKEDIN_SEQUENCES: LinkedInSequence[] = [
  {
    id: 'linkedin-cfo-sequence',
    name: 'CFO LinkedIn Sequence',
    persona: 'cfo',
    steps: [
      CONNECTION_REQUESTS.find(c => c.id === 'conn-cfo-1')!,
      FOLLOW_UP_SCRIPTS.find(f => f.id === 'follow-1')!,
      VOICE_NOTE_SCRIPTS.find(v => v.id === 'voice-1')!,
      FOLLOW_UP_SCRIPTS.find(f => f.id === 'follow-3')!,
      VOICE_NOTE_SCRIPTS.find(v => v.id === 'voice-2')!,
    ],
    totalDays: 14,
  },
  {
    id: 'linkedin-procurement-sequence',
    name: 'Procurement LinkedIn Sequence',
    persona: 'procurement',
    steps: [
      CONNECTION_REQUESTS.find(c => c.id === 'conn-procurement-1')!,
      FOLLOW_UP_SCRIPTS.find(f => f.id === 'follow-1')!,
      FOLLOW_UP_SCRIPTS.find(f => f.id === 'follow-2')!,
      FOLLOW_UP_SCRIPTS.find(f => f.id === 'follow-4')!,
    ],
    totalDays: 10,
  },
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getConnectionRequest(persona: string): LinkedInScript | undefined {
  return CONNECTION_REQUESTS.find(c => c.persona === persona)
}

export function getInMailForPersona(persona: string): LinkedInScript | undefined {
  return INMAILS.find(i => i.persona === persona)
}

export function personalizeLinkedInMessage(
  script: LinkedInScript,
  data: Record<string, string>
): string {
  let message = script.voiceNoteScript || script.message

  for (const [token, value] of Object.entries(data)) {
    const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'g')
    message = message.replace(regex, value)
  }

  return message
}

// =============================================================================
// BEST PRACTICES
// =============================================================================

export const LINKEDIN_BEST_PRACTICES = {
  timing: {
    bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
    bestTimes: ['8-10am', '12-1pm', '5-7pm'],
    worstDays: ['Monday morning', 'Friday afternoon'],
    note: 'Time to THEIR timezone, not yours',
  },
  connectionRequests: {
    dailyLimit: 20,  // LinkedIn's soft limit for new accounts
    acceptanceRateBenchmark: '30-40%',
    tips: [
      'Always personalize (no blank requests)',
      'Keep under 300 characters',
      'No pitch in request',
      'Reference something specific about them',
      'Mutual connections increase acceptance 2x',
    ],
  },
  inMails: {
    monthlyCredits: 50,  // Sales Navigator
    responseRateBenchmark: '10-15%',
    tips: [
      'Use only when connection request not possible',
      'Subject line is crucial',
      'Keep under 500 characters',
      'Save credits for high-value targets',
    ],
  },
  voiceNotes: {
    maxLength: 60,  // seconds
    responseRateBenchmark: '25-30%',  // 5x text
    tips: [
      'Keep under 45 seconds',
      'Be natural, not robotic',
      'Smile when recording',
      'Use their name early',
      'End with clear CTA',
    ],
  },
  engagement: {
    postsPerWeek: 2,
    commentsPerDay: 5,
    tips: [
      'Comment on prospect posts before connecting',
      'Add genuine insight, not just "Great post!"',
      'Share content relevant to your ICP',
      'Engage with prospect comments on others\' posts',
    ],
  },
  profileOptimization: [
    'Headline = Value prop, not title ("I help CFOs earn 4.5%+ on idle cash")',
    'Banner = Clear product visual or CTA',
    'About = Problem you solve, social proof, CTA',
    'Featured = Case study, demo link, testimonial',
    'Activity = Regular posts showing expertise',
  ],
}

// =============================================================================
// PROFILE HEADLINE OPTIONS
// =============================================================================

export const PROFILE_HEADLINE_OPTIONS = [
  'Helping {{industry}} CFOs earn 4.5%+ on idle cash | Grain & Vault',
  '0% payment fees. 4.5% treasury yield. | Building Grain & Vault',
  'Treasury optimization for companies with real suppliers | Grain & Vault',
  'Turning predictable spend into yield | Co-founder @ Grain & Vault',
]

// =============================================================================
// LINKEDIN SALES NAVIGATOR SEARCH FILTERS
// =============================================================================

export const SALES_NAV_SEARCHES = {
  cfo_search: {
    name: 'CFOs at Target Companies',
    filters: {
      keywords: 'CFO OR "Chief Financial Officer" OR "VP Finance" OR "Finance Director"',
      geography: ['United States'],
      industry: ['Manufacturing', 'Wholesale', 'Construction', 'Food & Beverage'],
      companyHeadcount: ['51-200', '201-500', '501-1000', '1001-5000'],
      seniorityLevel: ['CXO', 'VP', 'Director'],
      function: ['Finance'],
      postedContentKeywords: 'treasury OR "working capital" OR "cash flow"',
    },
  },
  procurement_search: {
    name: 'Procurement Leaders',
    filters: {
      keywords: 'CPO OR "Chief Procurement" OR "VP Procurement" OR "VP Supply Chain" OR "Director Sourcing"',
      geography: ['United States'],
      industry: ['Manufacturing', 'Wholesale', 'Distribution', 'Food Production'],
      companyHeadcount: ['51-200', '201-500', '501-1000'],
      seniorityLevel: ['CXO', 'VP', 'Director'],
      function: ['Operations'],
    },
  },
  controller_search: {
    name: 'Controllers & AP Leaders',
    filters: {
      keywords: 'Controller OR "VP Accounting" OR "Director AP" OR "Head of Accounts Payable"',
      geography: ['United States'],
      industry: ['Manufacturing', 'Wholesale', 'Construction'],
      companyHeadcount: ['51-200', '201-500', '501-1000'],
      seniorityLevel: ['Director', 'Manager'],
      function: ['Accounting'],
    },
  },
  treasury_search: {
    name: 'Treasury Professionals',
    filters: {
      keywords: 'Treasury OR "Treasury Manager" OR "Treasury Director" OR "Cash Management"',
      geography: ['United States'],
      companyHeadcount: ['201-500', '501-1000', '1001-5000'],
      seniorityLevel: ['Director', 'Manager'],
      function: ['Finance'],
      postedContentKeywords: 'yield OR "money market" OR liquidity',
    },
  },
}
