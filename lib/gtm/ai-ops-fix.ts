/**
 * AI Ops GTM - The Real Strategy That Works
 *
 * Problem: Been striking out on AI Ops
 * Why: Selling ops BEFORE they feel the pain
 * Fix: Change timing, positioning, and entry point
 */

/**
 * WHY AI OPS HAS BEEN HARD TO SELL
 */

export const AI_OPS_CHALLENGES = {
  challenge1: {
    issue: 'Selling to companies PLANNING to launch AI',
    why: 'They don\'t feel ops pain yet',
    fix: 'Only target companies with AI ALREADY in production'
  },

  challenge2: {
    issue: 'Positioning as "outsourced operations"',
    why: 'Ops is mission-critical, scary to outsource',
    fix: 'Position as "AI Incident Response Team" first'
  },

  challenge3: {
    issue: 'No awareness that "AI ops as a service" exists',
    why: 'CTOs don\'t know to look for this',
    fix: 'Strike right after they have an AI incident (timing)'
  },

  challenge4: {
    issue: 'Selling $150K-$400K/mo MRR cold',
    why: 'Too expensive for first touch',
    fix: 'Start with one-time incident response → Upsell to 24/7'
  }
}

/**
 * THE NEW AI OPS GTM STRATEGY
 */

export const AI_OPS_REIMAGINED = {
  // STEP 1: Change the target
  target: {
    old: 'Companies planning to launch AI',
    new: 'Companies with AI in production (30-90 days post-launch)',

    signals: [
      'Recently launched AI features (check Product Hunt, press releases)',
      'Hiring ML engineers (scaling AI team)',
      'Posted about AI incidents on Twitter/LinkedIn',
      'Using AWS SageMaker/Azure OpenAI/GCP Vertex in production',
      'Job postings for "ML Ops" or "AI Infrastructure"'
    ],

    whyThisWorks: 'They\'re feeling the pain NOW. Not hypothetically.'
  },

  // STEP 2: Change the entry point
  entryPoint: {
    old: '$150K-$400K/mo 24/7 ops contract',
    new: 'Free AI Health Check → $25K incident response → $150K/mo ops',

    ladder: [
      {
        offer: 'Free AI Health Check',
        price: '$0',
        duration: '1 hour',
        deliverable: 'Report: Your AI uptime, error rate, model drift',
        conversion: '30% → Paid incident response'
      },
      {
        offer: 'AI Incident Response (One-time)',
        price: '$15K-$25K',
        duration: '2 weeks',
        deliverable: 'Fix current incident, prevent recurrence',
        conversion: '60% → 24/7 ops contract'
      },
      {
        offer: '24/7 AI Operations',
        price: '$150K-$400K/mo',
        duration: 'Annual contract',
        deliverable: 'Full NOC, 99.9% uptime SLA',
        conversion: 'Long-term customer'
      }
    ],

    whyThisWorks: 'Foot in the door. Prove value. Upsell.'
  },

  // STEP 3: Change the timing
  timing: {
    old: 'Random cold outreach',
    new: 'Strike RIGHT AFTER they have an AI incident',

    triggers: [
      {
        signal: 'Company tweets about AI outage',
        timing: 'Within 24 hours',
        message: 'Saw the {{Feature}} issue. We handle 24/7 AI ops if you need backup.',
        why: 'Pain is fresh. They\'re open to help.'
      },
      {
        signal: 'AI feature launched 30 days ago',
        timing: '30-45 days post-launch',
        message: 'Congrats on {{Feature}} launch. 30 days in, ops pain usually hits. How\'s it going?',
        why: 'Ops issues emerge 30-60 days after launch'
      },
      {
        signal: 'Hiring for "ML Ops" or "AI Infrastructure"',
        timing: 'Immediately',
        message: 'Saw you\'re hiring for ML Ops. We can be your ops team while you build internal.',
        why: 'Hiring = they know they have an ops problem'
      },
      {
        signal: 'Using AWS/Azure/GCP AI services',
        timing: 'Partner introduction',
        message: 'AWS team suggested I reach out. We run ops for SageMaker customers.',
        why: 'Partner endorsement = instant credibility'
      }
    ]
  },

  // STEP 4: Change the positioning
  positioning: {
    old: '"Outsourced AI operations"',
    new: '"AI Incident Response Team" + "AWS/Azure AI Ops Partner"',

    framings: [
      {
        frame: 'PagerDuty for AI',
        pitch: 'Like PagerDuty, but specifically for AI/ML systems',
        benefit: 'People understand PagerDuty'
      },
      {
        frame: 'AWS Advanced Partner for AI Ops',
        pitch: 'We run 24/7 ops for AWS SageMaker/Bedrock customers',
        benefit: 'Partner endorsement = trust'
      },
      {
        frame: 'Free your eng team to build, we\'ll run ops',
        pitch: 'Your engineers build features. We handle 3am alerts.',
        benefit: 'Clear value prop (time savings)'
      }
    ]
  }
}

/**
 * SHIPPING-READY AI OPS PLAYBOOK (TODAY)
 */

export const AI_OPS_LAUNCH_TODAY = {
  // CAMPAIGN 1: Incident Response Offers (Quick wins)
  campaign1: {
    name: 'AI Incident Response - Free Health Checks',
    target: 'Companies that launched AI 30-90 days ago',
    volume: 100,
    channels: ['Email', 'LinkedIn', 'Twitter'],

    message: `{{FirstName}},

Saw {{Company}} launched {{AIFeature}} {{DaysAgo}} days ago (congrats!).

Quick question: How's AI ops going?

Most companies hit ops pain 30-60 days post-launch (model drift, errors, downtime).

I run AI operations for 50+ companies. Happy to do a free health check:
• Your AI uptime (vs industry avg)
• Error rate analysis
• Model drift detection
• Cost optimization opportunities

Takes 1 hour. No strings attached.

Worth it?

Best,
Jonah
Wells Onyx (AWS Advanced Partner)`,

    expectedResults: {
      sent: 100,
      responses: 30, // 30% (high because it's free + timely)
      healthChecks: 20,
      incidentResponseDeals: 6, // 30% conversion
      opsContracts: 3, // 50% conversion from incident response
      revenue: '$450K+ MRR' // 3 contracts × $150K/mo
    }
  },

  // CAMPAIGN 2: Partner Ecosystem (AWS/Azure/GCP)
  campaign2: {
    name: 'AWS/Azure/GCP AI Ops Co-Sell',
    target: 'AWS SageMaker / Azure OpenAI / GCP Vertex customers',
    volume: 'Unlimited (partner referrals)',
    channels: ['Partner introduction'],

    message: `{{FirstName}},

{{PartnerAccountManager}} on the {{Partner}} team suggested I reach out.

We're an {{Partner}} Advanced Partner specializing in AI operations. We run 24/7 ops for companies using {{PartnerAIProduct}}.

Just helped {{ReferenceCustomer}} (another {{Partner}} customer) reduce AI downtime from 5% to 0.01%.

Worth a quick call to see if we can help {{Company}} too?

Best,
Jonah
Wells Onyx ({{Partner}} Advanced Partner)`,

    expectedResults: {
      partnerIntros: 20, // Per month across 3 partners
      discoveryCall: 15, // 75% show rate
      pilotsLaunched: 8, // 50% pilot rate
      opsContracts: 4, // 50% conversion
      revenue: '$600K+ MRR' // 4 contracts × $150K/mo
    }
  },

  // CAMPAIGN 3: Incident-Based Outreach (Twitter monitoring)
  campaign3: {
    name: 'Real-Time Incident Response Offers',
    target: 'Companies tweeting about AI issues',
    volume: '5-10/week',
    channels: ['Twitter reply → DM'],

    trigger: 'Company tweets about AI outage/issue',

    message: `{{FirstName}},

Saw the {{Issue}} today. We run 24/7 AI ops for 50+ companies.

Happy to help debug if useful (no charge).

We caught a similar issue for {{ReferenceCustomer}} last month - turned out to be {{TechnicalInsight}}.

DM me if you want a second pair of eyes.

Best,
Jonah`,

    expectedResults: {
      incidentsMonitored: 40, // Per month
      responses: 10, // 25% response rate
      incidentResponseDeals: 5, // 50% conversion
      opsContracts: 2, // 40% conversion
      revenue: '$300K+ MRR'
    }
  }
}

/**
 * AI OPS ACTION PLAN (Ship TODAY)
 */

export const AI_OPS_TODAY_PLAN = {
  // THIS WEEK
  week1: {
    monday: [
      'Use Clay to find 100 companies that launched AI 30-90 days ago',
      'Match them to AWS/Azure/GCP ecosystems',
      'Reach out to 5 partner account managers with co-sell opportunities'
    ],

    tuesday: [
      'Send 50 "Free AI Health Check" offers (Campaign 1)',
      'Set up Twitter monitoring for AI incidents (Campaign 3)',
      'Create AI Ops landing page on Wells AI site'
    ],

    wednesday: [
      'Follow up on health check responses',
      'Book 10 health check calls',
      'Respond to any Twitter incident mentions'
    ],

    thursday: [
      'Deliver 10 free health checks',
      'Identify 3-5 with real issues',
      'Pitch incident response service ($15K-$25K)'
    ],

    friday: [
      'Close 2-3 incident response deals',
      'Partner calls (present co-sell opportunities)',
      'Plan next week\'s campaigns'
    ]
  },

  // EXPECTED WEEK 1 RESULTS
  expectedResults: {
    healthChecks: 10,
    incidentResponseDeals: '2-3',
    revenue: '$30K-$75K (one-time)',
    pipeline: '2-3 companies for 24/7 ops conversion (3-6 months)',
    partnerIntros: '3-5 warm intros from AWS/Azure'
  }
}

/**
 * WHY THIS WILL WORK (vs previous attempts)
 */

export const AI_OPS_SUCCESS_FACTORS = {
  factor1: {
    old: 'Selling ops to companies planning AI',
    new: 'Selling ops to companies with AI breaking',
    impact: '10x higher urgency'
  },

  factor2: {
    old: 'Cold outreach with $150K/mo ask',
    new: 'Free health check → $15K fix → $150K ops',
    impact: 'Lower barrier to entry'
  },

  factor3: {
    old: 'Random timing',
    new: 'Right after incident OR 30-60 days post-launch',
    impact: 'Perfect timing = 5x higher conversion'
  },

  factor4: {
    old: '"Outsourced ops" (scary)',
    new: '"AWS Partner for AI Ops" (trusted)',
    impact: 'Partner endorsement = instant credibility'
  },

  factor5: {
    old: 'Selling to unknown prospects',
    new: 'Partner intros from AWS/Azure/GCP',
    impact: 'Warm intros = 30% response rate'
  }
}

/**
 * MONTHLY TARGETS (After System is Running)
 */

export const AI_OPS_MONTHLY_TARGETS = {
  month1: {
    healthChecks: 20,
    incidentResponseDeals: 6,
    opsContracts: 2,
    revenue: '$300K MRR + $90K one-time'
  },

  month2: {
    healthChecks: 40,
    incidentResponseDeals: 12,
    opsContracts: 5,
    revenue: '$750K MRR + $180K one-time'
  },

  month3: {
    healthChecks: 80,
    incidentResponseDeals: 24,
    opsContracts: 10,
    revenue: '$1.5M MRR + $360K one-time'
  }
}
