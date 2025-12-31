/**
 * Grain & Vault - Cold Start GTM Playbook
 *
 * Budget: $200-500/mo
 * Goal: 10 demos in first month
 * Target: Enterprise Treasury/Procurement buyers
 *
 * This playbook is designed for manual execution by 1-2 people
 * with minimal tooling. Focus on quality over quantity.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DailyActivity {
  activity: string
  quantity: number
  timeEstimate: string
  tools: string[]
  priority: 'high' | 'medium' | 'low'
  notes: string
}

export interface WeeklyMilestone {
  week: number
  theme: string
  goals: string[]
  activities: DailyActivity[]
  metrics: Metric[]
  retrospective: string[]
}

export interface Metric {
  name: string
  target: number
  unit: string
  formula?: string
}

export interface Tool {
  name: string
  cost: string
  purpose: string
  tier: 'essential' | 'recommended' | 'nice-to-have'
  alternatives: string[]
  setupTime: string
}

export interface EscalationTrigger {
  condition: string
  action: string
  owner: string
}

// =============================================================================
// TOOL STACK ($200-500/mo Budget)
// =============================================================================

export const TOOL_STACK: Tool[] = [
  {
    name: 'LinkedIn Sales Navigator',
    cost: '$99/mo',
    purpose: 'Find and research prospects, InMail credits, saved searches',
    tier: 'essential',
    alternatives: ['LinkedIn Basic + manual research'],
    setupTime: '30 minutes',
  },
  {
    name: 'Apollo.io',
    cost: '$49-99/mo',
    purpose: 'Email finding, verification, basic sequences',
    tier: 'essential',
    alternatives: ['Hunter.io ($49/mo)', 'Snov.io ($39/mo)', 'Clearbit (free tier)'],
    setupTime: '1 hour',
  },
  {
    name: 'Calendly or Cal.com',
    cost: 'Free',
    purpose: 'Demo scheduling, calendar integration',
    tier: 'essential',
    alternatives: ['Cal.com (free)', 'HubSpot meetings (free)'],
    setupTime: '15 minutes',
  },
  {
    name: 'Loom',
    cost: 'Free (25 videos/mo)',
    purpose: 'Personalized video messages, no-show follow-ups',
    tier: 'essential',
    alternatives: ['Vidyard (free tier)', 'Screen recording on Mac/PC'],
    setupTime: '10 minutes',
  },
  {
    name: 'Google Workspace',
    cost: '$6/mo',
    purpose: 'Professional email domain, Google Sheets for CRM',
    tier: 'essential',
    alternatives: ['Free Gmail (less professional)'],
    setupTime: '30 minutes',
  },
  {
    name: 'Notion or Google Sheets',
    cost: 'Free',
    purpose: 'Simple CRM, pipeline tracking, activity log',
    tier: 'essential',
    alternatives: ['Airtable (free tier)', 'HubSpot free CRM'],
    setupTime: '1 hour',
  },
  {
    name: 'Superhuman',
    cost: '$30/mo',
    purpose: 'Email productivity, open/click tracking',
    tier: 'recommended',
    alternatives: ['Mailtrack (free)', 'Mixmax ($24/mo)'],
    setupTime: '15 minutes',
  },
  {
    name: 'Otter.ai',
    cost: 'Free',
    purpose: 'Call transcription, meeting notes',
    tier: 'nice-to-have',
    alternatives: ['Fathom (free)', 'Manual notes'],
    setupTime: '5 minutes',
  },
]

export function calculateToolCosts(tier: 'minimal' | 'recommended' | 'full'): number {
  const tiers = {
    minimal: ['essential'],
    recommended: ['essential', 'recommended'],
    full: ['essential', 'recommended', 'nice-to-have'],
  }

  return TOOL_STACK
    .filter(t => tiers[tier].includes(t.tier))
    .reduce((sum, tool) => {
      const cost = parseInt(tool.cost.replace(/[^0-9]/g, '')) || 0
      return sum + cost
    }, 0)
}

// =============================================================================
// WEEKLY PLAYBOOK
// =============================================================================

export const WEEK_1: WeeklyMilestone = {
  week: 1,
  theme: 'Foundation & First Outreach',
  goals: [
    'Set up all tools and tracking',
    'Build initial prospect list (50 contacts)',
    'Send first 20 cold emails',
    'Make 10 LinkedIn connection requests',
    'Book 2 demos (stretch: 3)',
  ],
  activities: [
    {
      activity: 'Tool Setup',
      quantity: 1,
      timeEstimate: '4 hours',
      tools: ['All tools in stack'],
      priority: 'high',
      notes: 'Day 1 priority. Block 4 hours to set up everything.',
    },
    {
      activity: 'Build Prospect List',
      quantity: 50,
      timeEstimate: '3 hours',
      tools: ['LinkedIn Sales Navigator', 'Apollo.io'],
      priority: 'high',
      notes: 'Focus on CFOs and Procurement VPs in Manufacturing/Wholesale',
    },
    {
      activity: 'Cold Email (first touch)',
      quantity: 20,
      timeEstimate: '2 hours',
      tools: ['Apollo.io', 'Gmail'],
      priority: 'high',
      notes: 'Personalize first line. Use CFO/Procurement templates.',
    },
    {
      activity: 'LinkedIn Connection Requests',
      quantity: 10,
      timeEstimate: '1 hour',
      tools: ['LinkedIn Sales Navigator'],
      priority: 'medium',
      notes: 'Personalize each request. No pitch in request.',
    },
    {
      activity: 'Profile Optimization',
      quantity: 1,
      timeEstimate: '1 hour',
      tools: ['LinkedIn'],
      priority: 'high',
      notes: 'Update headline, banner, about section with value prop.',
    },
  ],
  metrics: [
    { name: 'Emails Sent', target: 20, unit: 'emails' },
    { name: 'Connection Requests', target: 10, unit: 'requests' },
    { name: 'Demos Booked', target: 2, unit: 'demos' },
    { name: 'Response Rate', target: 10, unit: '%', formula: 'replies / emails_sent * 100' },
  ],
  retrospective: [
    'Which subject lines got opens?',
    'Any replies - positive or negative?',
    'What industries showed most interest?',
    'What objections came up?',
  ],
}

export const WEEK_2: WeeklyMilestone = {
  week: 2,
  theme: 'Scale Outreach & First Demos',
  goals: [
    'Send 40 more cold emails (total 60)',
    'Follow up on Week 1 emails (touch 2)',
    'Make 20 LinkedIn connections',
    'Conduct first 2-3 demos',
    'Book 3 more demos',
    'Identify 2-3 warm referrals',
  ],
  activities: [
    {
      activity: 'Cold Email (new prospects)',
      quantity: 40,
      timeEstimate: '4 hours',
      tools: ['Apollo.io', 'Gmail'],
      priority: 'high',
      notes: 'Batch in morning. Personalize industry/company specifics.',
    },
    {
      activity: 'Follow-up Email (touch 2)',
      quantity: 20,
      timeEstimate: '1 hour',
      tools: ['Apollo.io', 'Gmail'],
      priority: 'high',
      notes: 'Send to Week 1 non-responders. Add value - case study or insight.',
    },
    {
      activity: 'LinkedIn Connection Requests',
      quantity: 20,
      timeEstimate: '2 hours',
      tools: ['LinkedIn Sales Navigator'],
      priority: 'medium',
      notes: 'Continue building network. Start sending voice notes to connections.',
    },
    {
      activity: 'LinkedIn Voice Notes',
      quantity: 5,
      timeEstimate: '30 min',
      tools: ['LinkedIn Mobile'],
      priority: 'medium',
      notes: 'Send to new connections. Keep under 45 seconds.',
    },
    {
      activity: 'Demo Calls',
      quantity: 3,
      timeEstimate: '3 hours',
      tools: ['Zoom', 'Demo environment'],
      priority: 'high',
      notes: 'Run demo script. Record for improvement. Send same-day recap.',
    },
    {
      activity: 'Loom Videos (personalized)',
      quantity: 5,
      timeEstimate: '1 hour',
      tools: ['Loom'],
      priority: 'medium',
      notes: 'For high-value prospects who haven\'t responded.',
    },
  ],
  metrics: [
    { name: 'Total Emails Sent', target: 60, unit: 'emails' },
    { name: 'Response Rate', target: 12, unit: '%' },
    { name: 'Demos Completed', target: 3, unit: 'demos' },
    { name: 'Demos Booked', target: 5, unit: 'demos (cumulative)' },
    { name: 'LinkedIn Connections', target: 25, unit: 'connections' },
  ],
  retrospective: [
    'What objections came up in demos?',
    'Did prospects need legal/security review?',
    'Which persona converted best?',
    'What was the average deal size discussed?',
  ],
}

export const WEEK_3: WeeklyMilestone = {
  week: 3,
  theme: 'Optimize & Double Down',
  goals: [
    'Send 50 more cold emails (total 110)',
    'Complete follow-up sequences',
    'Conduct 4-5 demos',
    'Book 3 more demos',
    'Start pipeline progression (proposal/next steps)',
    'A/B test subject lines and messaging',
  ],
  activities: [
    {
      activity: 'Cold Email (new prospects)',
      quantity: 50,
      timeEstimate: '5 hours',
      tools: ['Apollo.io', 'Gmail'],
      priority: 'high',
      notes: 'Double down on best-performing persona and industry.',
    },
    {
      activity: 'Follow-up Sequence (touch 2 & 3)',
      quantity: 40,
      timeEstimate: '2 hours',
      tools: ['Apollo.io'],
      priority: 'high',
      notes: 'Send breakup email to non-responders. Test new angles.',
    },
    {
      activity: 'LinkedIn Follow-ups',
      quantity: 20,
      timeEstimate: '2 hours',
      tools: ['LinkedIn'],
      priority: 'medium',
      notes: 'Message connections who haven\'t replied. Send content.',
    },
    {
      activity: 'Demo Calls',
      quantity: 5,
      timeEstimate: '5 hours',
      tools: ['Zoom'],
      priority: 'high',
      notes: 'Refine demo based on Week 2 learnings.',
    },
    {
      activity: 'Proposal/ROI Decks',
      quantity: 2,
      timeEstimate: '2 hours',
      tools: ['Google Slides', 'Calculator'],
      priority: 'high',
      notes: 'For prospects advancing to next stage.',
    },
    {
      activity: 'Community Engagement',
      quantity: 5,
      timeEstimate: '1 hour',
      tools: ['Slack/Discord', 'LinkedIn'],
      priority: 'low',
      notes: 'Comment on relevant posts. Share insights.',
    },
  ],
  metrics: [
    { name: 'Total Emails Sent', target: 110, unit: 'emails' },
    { name: 'Response Rate', target: 15, unit: '%' },
    { name: 'Demos Completed', target: 8, unit: 'demos (cumulative)' },
    { name: 'Demos Booked', target: 8, unit: 'demos (cumulative)' },
    { name: 'Pipeline Created', target: 2, unit: 'proposals sent' },
  ],
  retrospective: [
    'Which messaging variations performed best?',
    'What\'s the common objection pattern?',
    'Are we talking to the right persona?',
    'What\'s the typical sales cycle length emerging?',
  ],
}

export const WEEK_4: WeeklyMilestone = {
  week: 4,
  theme: 'Close & Learn',
  goals: [
    'Hit 10 demo target',
    'Complete all follow-up sequences',
    'Progress 2-3 deals to next stage',
    'Document learnings for Month 2',
    'Identify referral opportunities',
    'Plan Month 2 scaling',
  ],
  activities: [
    {
      activity: 'Cold Email (new prospects)',
      quantity: 40,
      timeEstimate: '4 hours',
      tools: ['Apollo.io', 'Gmail'],
      priority: 'medium',
      notes: 'Maintain volume while focusing on pipeline.',
    },
    {
      activity: 'Follow-up Sequence',
      quantity: 50,
      timeEstimate: '2 hours',
      tools: ['Apollo.io'],
      priority: 'high',
      notes: 'Close out all sequences. Archive or nurture.',
    },
    {
      activity: 'Demo Calls',
      quantity: 4,
      timeEstimate: '4 hours',
      tools: ['Zoom'],
      priority: 'high',
      notes: 'Focus on high-quality demos.',
    },
    {
      activity: 'Pipeline Management',
      quantity: 5,
      timeEstimate: '3 hours',
      tools: ['Notion/Sheets', 'Email'],
      priority: 'high',
      notes: 'Follow up with all demo attendees. Push for next steps.',
    },
    {
      activity: 'Ask for Referrals',
      quantity: 5,
      timeEstimate: '1 hour',
      tools: ['Email', 'LinkedIn'],
      priority: 'medium',
      notes: 'Ask positive conversations for warm intros.',
    },
    {
      activity: 'Month 1 Retrospective',
      quantity: 1,
      timeEstimate: '2 hours',
      tools: ['Notion'],
      priority: 'high',
      notes: 'Document what worked, what didn\'t, plan Month 2.',
    },
  ],
  metrics: [
    { name: 'Total Emails Sent', target: 150, unit: 'emails' },
    { name: 'Response Rate', target: 15, unit: '%' },
    { name: 'Demos Completed', target: 10, unit: 'demos' },
    { name: 'Pipeline Value', target: 100000, unit: 'USD' },
    { name: 'Deals in Proposal Stage', target: 2, unit: 'deals' },
  ],
  retrospective: [
    'Did we hit 10 demos? Why/why not?',
    'What persona/industry should we double down on?',
    'What messaging resonated most?',
    'What tools should we add/remove?',
    'What\'s the realistic sales cycle?',
  ],
}

// =============================================================================
// DAILY SCHEDULE
// =============================================================================

export interface DailySchedule {
  timeBlock: string
  activity: string
  duration: string
  tools: string[]
  priority: 'high' | 'medium' | 'low'
}

export const IDEAL_DAILY_SCHEDULE: DailySchedule[] = [
  {
    timeBlock: '8:00 - 8:30 AM',
    activity: 'Review pipeline, plan day, check overnight responses',
    duration: '30 min',
    tools: ['Notion/Sheets', 'Gmail'],
    priority: 'high',
  },
  {
    timeBlock: '8:30 - 10:00 AM',
    activity: 'Cold email batch (highest priority - fresh minds)',
    duration: '90 min',
    tools: ['Apollo.io', 'Gmail', 'LinkedIn'],
    priority: 'high',
  },
  {
    timeBlock: '10:00 - 10:30 AM',
    activity: 'LinkedIn engagement (comments, connection requests)',
    duration: '30 min',
    tools: ['LinkedIn'],
    priority: 'medium',
  },
  {
    timeBlock: '10:30 - 12:00 PM',
    activity: 'Demo calls (prime demo time)',
    duration: '90 min',
    tools: ['Zoom', 'Demo environment'],
    priority: 'high',
  },
  {
    timeBlock: '12:00 - 1:00 PM',
    activity: 'Lunch + LinkedIn mobile (voice notes, DMs)',
    duration: '60 min',
    tools: ['LinkedIn Mobile'],
    priority: 'low',
  },
  {
    timeBlock: '1:00 - 2:30 PM',
    activity: 'Follow-up emails, proposal work, admin',
    duration: '90 min',
    tools: ['Gmail', 'Google Slides', 'Notion'],
    priority: 'medium',
  },
  {
    timeBlock: '2:30 - 4:00 PM',
    activity: 'Demo calls (secondary demo time)',
    duration: '90 min',
    tools: ['Zoom'],
    priority: 'high',
  },
  {
    timeBlock: '4:00 - 5:00 PM',
    activity: 'Prospect research, list building, Loom videos',
    duration: '60 min',
    tools: ['LinkedIn Sales Nav', 'Apollo', 'Loom'],
    priority: 'medium',
  },
  {
    timeBlock: '5:00 - 5:30 PM',
    activity: 'End of day: update CRM, plan tomorrow',
    duration: '30 min',
    tools: ['Notion/Sheets'],
    priority: 'high',
  },
]

// =============================================================================
// ESCALATION TRIGGERS
// =============================================================================

export const ESCALATION_TRIGGERS: EscalationTrigger[] = [
  {
    condition: 'Response rate < 5% after 50 emails',
    action: 'Review messaging, test new subject lines, check email deliverability',
    owner: 'Founder',
  },
  {
    condition: 'Demo no-show rate > 40%',
    action: 'Add SMS reminders, improve confirmation email, consider shorter demo slots',
    owner: 'Founder',
  },
  {
    condition: '0 demos booked after Week 1',
    action: 'Pivot to LinkedIn-first approach, add Loom videos, consider different persona',
    owner: 'Founder',
  },
  {
    condition: 'Consistent "not the right time" responses',
    action: 'Add to nurture sequence, try different trigger events, expand to new industries',
    owner: 'Founder',
  },
  {
    condition: 'Legal/compliance blocker on 3+ deals',
    action: 'Create pre-packaged legal/security docs, consider compliance-first messaging',
    owner: 'Founder',
  },
  {
    condition: 'No positive responses from CFO persona',
    action: 'Shift focus to Procurement or Controller, test different value prop angle',
    owner: 'Founder',
  },
  {
    condition: 'Demos not converting to pipeline',
    action: 'Review demo recording, add discovery questions, improve qualification criteria',
    owner: 'Founder',
  },
]

// =============================================================================
// SUCCESS METRICS
// =============================================================================

export interface SuccessMetric {
  name: string
  month1Target: number
  month3Target: number
  month6Target: number
  unit: string
  benchmark: string
}

export const SUCCESS_METRICS: SuccessMetric[] = [
  {
    name: 'Emails Sent',
    month1Target: 150,
    month3Target: 500,
    month6Target: 1000,
    unit: 'emails',
    benchmark: 'Manual sending = 10-15/day',
  },
  {
    name: 'Email Response Rate',
    month1Target: 10,
    month3Target: 15,
    month6Target: 20,
    unit: '%',
    benchmark: 'Cold email average = 5-10%',
  },
  {
    name: 'Demos Booked',
    month1Target: 10,
    month3Target: 30,
    month6Target: 60,
    unit: 'demos',
    benchmark: '~7% of emails sent',
  },
  {
    name: 'Demo Show Rate',
    month1Target: 70,
    month3Target: 80,
    month6Target: 85,
    unit: '%',
    benchmark: 'Average = 60-70%',
  },
  {
    name: 'Demo to Opportunity Rate',
    month1Target: 40,
    month3Target: 50,
    month6Target: 60,
    unit: '%',
    benchmark: 'Average = 30-40%',
  },
  {
    name: 'Pipeline Created',
    month1Target: 100000,
    month3Target: 400000,
    month6Target: 1000000,
    unit: 'USD',
    benchmark: 'Avg deal size x opportunities',
  },
  {
    name: 'Customer Acquisition Cost (CAC)',
    month1Target: 2000,
    month3Target: 1500,
    month6Target: 1000,
    unit: 'USD',
    benchmark: 'Tools + time / closed deals',
  },
]

// =============================================================================
// CRM TEMPLATE (Google Sheets/Notion)
// =============================================================================

export const CRM_COLUMNS = [
  'Company',
  'Contact Name',
  'Title',
  'Email',
  'LinkedIn URL',
  'Industry',
  'Company Size',
  'Source',
  'Status', // Cold, Contacted, Replied, Demo Scheduled, Demo Complete, Proposal, Won, Lost
  'Last Contact Date',
  'Next Action',
  'Next Action Date',
  'Notes',
  'Email 1 Sent',
  'Email 1 Date',
  'Email 2 Sent',
  'Email 2 Date',
  'Email 3 Sent',
  'Email 3 Date',
  'LinkedIn Connected',
  'LinkedIn Message Sent',
  'Demo Date',
  'Demo Notes',
  'Objections',
  'Estimated Deal Size',
  'Probability',
  'Expected Close Date',
]

export const PIPELINE_STAGES = [
  { stage: 'Cold', probability: 0, color: '#gray' },
  { stage: 'Contacted', probability: 5, color: '#blue' },
  { stage: 'Replied', probability: 15, color: '#cyan' },
  { stage: 'Demo Scheduled', probability: 25, color: '#yellow' },
  { stage: 'Demo Complete', probability: 40, color: '#orange' },
  { stage: 'Proposal Sent', probability: 60, color: '#purple' },
  { stage: 'Negotiation', probability: 80, color: '#pink' },
  { stage: 'Won', probability: 100, color: '#green' },
  { stage: 'Lost', probability: 0, color: '#red' },
]

// =============================================================================
// MONTH 2+ SCALING PLAN
// =============================================================================

export const SCALING_TRIGGERS = {
  addSequencingTool: {
    condition: 'Sending > 20 emails/day consistently',
    action: 'Add Apollo Pro ($99/mo) or Reply.io ($70/mo) for automation',
    expectedROI: '2x email volume with same time',
  },
  addSDR: {
    condition: 'Founder time maxed at 10+ demos/week',
    action: 'Hire part-time SDR or use SDR agency',
    expectedROI: '3x pipeline with founder on demos only',
  },
  addABM: {
    condition: '10+ target accounts identified',
    action: 'Add account-based marketing with multi-threading',
    expectedROI: 'Higher win rate on strategic accounts',
  },
  addContentMarketing: {
    condition: 'Seeing repeat questions/objections',
    action: 'Create blog posts, LinkedIn content, case studies',
    expectedROI: 'Inbound leads + shorter sales cycle',
  },
  addPaidAds: {
    condition: 'Clear ICP and messaging validated',
    action: 'LinkedIn Ads targeting same persona',
    expectedROI: 'Scale beyond manual outreach',
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getWeeklyPlaybook(week: number): WeeklyMilestone | undefined {
  const weeks = [WEEK_1, WEEK_2, WEEK_3, WEEK_4]
  return weeks.find(w => w.week === week)
}

export function calculatePipelineValue(
  demos: number,
  avgDealSize: number = 50000,
  demoToOppRate: number = 0.4,
  oppToWinRate: number = 0.25
): number {
  return demos * avgDealSize * demoToOppRate * oppToWinRate
}

export function calculateCAC(
  toolCosts: number,
  hoursSpent: number,
  hourlyRate: number = 100,
  dealsWon: number = 1
): number {
  const totalCost = toolCosts + (hoursSpent * hourlyRate)
  return Math.round(totalCost / dealsWon)
}

export function isOnTrack(
  week: number,
  demosBooked: number,
  emailsSent: number,
  responseRate: number
): { onTrack: boolean; issues: string[] } {
  const issues: string[] = []
  const weekPlan = getWeeklyPlaybook(week)

  if (!weekPlan) return { onTrack: true, issues: [] }

  const demoTarget = weekPlan.metrics.find(m => m.name.includes('Demos Booked'))?.target || 0
  const emailTarget = weekPlan.metrics.find(m => m.name.includes('Emails Sent'))?.target || 0
  const rateTarget = weekPlan.metrics.find(m => m.name.includes('Response Rate'))?.target || 0

  if (demosBooked < demoTarget * 0.7) {
    issues.push(`Demos booked (${demosBooked}) below 70% of target (${demoTarget})`)
  }
  if (emailsSent < emailTarget * 0.7) {
    issues.push(`Emails sent (${emailsSent}) below 70% of target (${emailTarget})`)
  }
  if (responseRate < rateTarget * 0.7) {
    issues.push(`Response rate (${responseRate}%) below 70% of target (${rateTarget}%)`)
  }

  return {
    onTrack: issues.length === 0,
    issues,
  }
}
