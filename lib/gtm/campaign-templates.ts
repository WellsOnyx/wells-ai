/**
 * Pre-built GTM Campaign Templates for Wells Onyx Practice Groups
 * Ready-to-launch campaigns for Executive Search, AI Ops, and IDRE
 */

export const CAMPAIGN_TEMPLATES = {
  'executive-search': {
    name: 'Executive Search - C-Suite Placements',
    serviceOffering: 'Search & Strategy',
    icp: {
      titles: [
        'CEO', 'Chief Executive Officer',
        'CHRO', 'Chief Human Resources Officer',
        'VP of Talent', 'VP Talent Acquisition',
        'Head of People', 'Head of HR',
        'Board Member', 'Board Director'
      ],
      industries: [
        'Technology',
        'Healthcare',
        'Financial Services',
        'Manufacturing',
        'Professional Services',
        'SaaS',
        'Fintech',
        'Biotech'
      ],
      companySizes: ['Series B (50-200)', 'Growth (200-1000)', 'Enterprise (1000+)'],
      painPoints: [
        'Traditional recruiters take 6+ months to fill C-suite roles',
        'Poor cultural fit hires costing $500K+ in failed placements',
        'Limited access to passive candidates who aren\'t actively job searching',
        'Board pressure to fill critical leadership gaps quickly',
        'Previous search firms delivered unqualified candidates',
        'Need confidential search process (replacing underperformer)',
        'Can\'t afford to miss on this hire - company growth depends on it'
      ],
      valueProps: [
        'Close deals over text - AI-powered search delivers qualified candidates in 2 weeks, not 6 months',
        '33% of first-year comp - success-based, no upfront retainer',
        '90-day placement guarantee - if they leave, we replace for free',
        'Access to passive candidates through our proprietary network',
        'Full vetting process: skills, culture fit, references, background',
        'Average time to fill: 8-12 weeks for C-suite, 6-8 weeks for VP-level',
        'We\'ve placed 100+ executives across tech, healthcare, and finance'
      ],
      hook: 'Your next CFO is waiting. We find them in 2 weeks, not 6 months.',
      notes: 'Target companies with recent funding rounds (Series B+) or rapid growth signals (hiring surge, new office, product launch). Focus on companies that just lost an executive (check LinkedIn, press releases).'
    },
    targetCount: 100,
    messagesPerDay: 15,
    channels: ['Email'],
    autoApprove: false
  },

  'ai-ops': {
    name: 'AI Ops - 24/7 AI Operations',
    serviceOffering: 'AI Ops',
    icp: {
      titles: [
        'CTO', 'Chief Technology Officer',
        'CIO', 'Chief Information Officer',
        'VP Engineering', 'VP of Engineering',
        'COO', 'Chief Operating Officer',
        'Head of AI', 'Head of Machine Learning',
        'Director of Engineering',
        'VP Product'
      ],
      industries: [
        'Technology',
        'SaaS',
        'Fintech',
        'Healthcare Tech',
        'E-commerce',
        'Martech',
        'AI/ML',
        'Enterprise Software'
      ],
      companySizes: ['Series A (10-50)', 'Series B (50-200)', 'Growth (200-1000)', 'Enterprise (1000+)'],
      painPoints: [
        'AI systems failing in production with no one to call',
        'Model drift causing quality degradation - losing customers',
        'Compliance and audit requirements for AI (SOC 2, ISO, HIPAA)',
        'Spending $500K+ on AI but can\'t measure uptime or performance',
        'Engineering team firefighting AI issues instead of building features',
        'Board asking "How do we know our AI is working?" - no good answer',
        'Competitors have better AI reliability and we\'re losing deals',
        'Can\'t scale AI usage because operations is too fragile'
      ],
      valueProps: [
        'Keep the lights brilliant - 99.9% uptime SLA with <30min P1 response',
        '$150K-$400K/month for 100 instances - fraction of hiring ops team',
        '24/7 NOC monitoring - we catch issues before your customers do',
        'Full audit trails for compliance - SOC 2, HIPAA, ISO ready',
        'Proactive optimization - we tune your models for cost and performance',
        'Weekly business reviews - translate ops data to business impact',
        'Free your engineering team - they build features, we keep AI running'
      ],
      hook: 'Your AI is running. Are you sure? 24/7 ops so your AI never fails.',
      notes: 'Target companies with AI/ML in production (not just experimenting). Look for: recent AI product launches, AI in job descriptions, AI mentioned in funding announcements. Best timing: right after they launch AI features (ops pain hits within 90 days).'
    },
    targetCount: 100,
    messagesPerDay: 15,
    channels: ['Email'],
    autoApprove: false
  },

  'idre-agency': {
    name: 'IDRE Agency - No Surprises Act Compliance',
    serviceOffering: 'IDRE Agency',
    icp: {
      titles: [
        'CFO', 'Chief Financial Officer',
        'COO', 'Chief Operating Officer',
        'VP Revenue Cycle',
        'Director of Revenue Cycle',
        'Revenue Cycle Manager',
        'VP Finance',
        'Payer Relations Director',
        'Compliance Officer'
      ],
      industries: [
        'Healthcare',
        'Hospitals & Health Systems',
        'Health Insurance',
        'Payers',
        'Medical Groups',
        'Ambulatory Surgery Centers'
      ],
      companySizes: ['Growth (200-1000)', 'Enterprise (1000+)'],
      painPoints: [
        'No Surprises Act IDR determinations backing up - federal penalties incoming',
        'Current IDRE charging $600-800 per determination - burning cash',
        'Internal team can\'t scale to 900+ determinations/day',
        'Quality issues causing determination reversals - losing money twice',
        'Can\'t track compliance across multiple entities and states',
        'CFO demanding profitability on dispute resolution - currently a cost center',
        'Payer relationships strained by slow, error-prone IDR process'
      ],
      valueProps: [
        'Turn compliance burden into profit center - $400-600 per determination',
        '30 determinations/day per Practice Lead - scale to 900+/day',
        '≥98% quality assurance - virtually zero reversals',
        'Full audit trail and compliance documentation built-in',
        '$3M-$100M+ annual run-rate potential depending on volume',
        'Fast deployment - live in 30 days, not 6 months',
        'Proven with major health systems - processing $50M+ disputes annually'
      ],
      hook: 'No Surprises Act compliance at $400-600 per determination. Scale to $100M run-rate.',
      notes: 'Target health systems and payers with high out-of-network volume. Best prospects: acquired hospitals (integration pain), growing ambulatory networks (scaling pain), payers with complaint backlogs (regulatory risk). Timing: Q4 is budget season - strike now.'
    },
    targetCount: 100,
    messagesPerDay: 10, // Healthcare = smaller market, lower volume
    channels: ['Email'],
    autoApprove: false
  }
}

/**
 * Helper function to get campaign template by practice group
 */
export function getCampaignTemplate(practiceGroup: 'executive-search' | 'ai-ops' | 'idre-agency') {
  return CAMPAIGN_TEMPLATES[practiceGroup]
}

/**
 * Quick-launch function for autonomous campaigns
 */
export async function launchAutonomousCampaign(
  practiceGroup: 'executive-search' | 'ai-ops' | 'idre-agency',
  customizations?: Partial<typeof CAMPAIGN_TEMPLATES[typeof practiceGroup]>
) {
  const template = getCampaignTemplate(practiceGroup)

  return {
    ...template,
    ...customizations,
    // Merge ICPs if customizations provided
    icp: {
      ...template.icp,
      ...(customizations?.icp || {})
    }
  }
}
