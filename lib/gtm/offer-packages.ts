/**
 * Wells Onyx - All 12 Practice Groups
 * Complete offer packages for GTM automation
 */

export const OFFER_PACKAGES = {
  // 1. ONYX HEALTH (IDRE + Tort + Attorney Placement)
  'idre-agency': {
    name: 'IDRE Agency Services - Onyx Health',
    category: 'Professional Services',
    pricing: {
      model: 'Per-determination + Success fees',
      range: '$400-$600 per determination',
      scale: '$3M-$100M+ annual run-rate'
    },
    packages: [
      {
        name: 'IDRE Determinations',
        description: 'Independent Dispute Resolution Entity services under No Surprises Act',
        pricing: '$400-$600 per determination',
        deliverables: [
          '30 determinations/day per Practice Lead',
          '≥98% quality assurance',
          'Full audit trail and compliance',
          'Scalable to 900+ determinations/day'
        ]
      },
      {
        name: 'Tort Lead Generation',
        description: 'Personal injury case intake and qualification',
        pricing: 'CAC-optimized + success fees',
        deliverables: [
          'Qualified lead generation',
          'Case intake and initial qualification',
          'Attorney matching and placement',
          'Target: $96M EBITDA at scale'
        ]
      },
      {
        name: 'Contract Attorney Placement',
        description: 'On-demand legal talent placement',
        pricing: '$20/hr net margin per attorney',
        deliverables: [
          '10 attorneys per Practice Lead',
          '1,850 billable hours/attorney/year',
          'Flexible staffing for law firms',
          'Target: $24M EBITDA at scale'
        ]
      }
    ],
    icp: {
      targets: ['Hospitals', 'Payers', 'Health Systems', 'Law Firms', 'PI Attorneys'],
      painPoints: [
        'No Surprises Act compliance burden',
        'Need for qualified PI cases',
        'Legal talent shortage',
        'Cost of full-time attorneys'
      ]
    },
    valueProp: 'Turn compliance burden into profit center. Scale legal operations without overhead.'
  },

  // 2. SEARCH & STRATEGY
  'search-strategy': {
    name: 'Search & Strategy',
    category: 'Professional Services',
    pricing: {
      model: 'Pod-based + success fees',
      range: '$450K-$2M per engagement',
      retainer: '$75K-$150K per week'
    },
    packages: [
      {
        name: 'Discovery Sprint',
        description: 'Fast ICP development and market validation',
        timeline: '6 weeks',
        pricing: '$450K-$900K',
        deliverables: [
          'ICP refinement',
          'Procurement map',
          'OS business case',
          'Grain rails plan',
          'AI Ops runbook'
        ]
      },
      {
        name: 'Strategy + Playbook',
        description: 'Comprehensive growth strategy and execution roadmap',
        timeline: '12 weeks',
        pricing: '$1.2M-$2.0M',
        deliverables: [
          'Full market analysis',
          'Competitive positioning',
          'GTM playbook',
          'Revenue model optimization',
          'Implementation roadmap'
        ]
      },
      {
        name: 'PMO-in-a-Box',
        description: 'Ongoing strategic program management',
        timeline: 'Quarterly',
        pricing: '$750K per quarter',
        deliverables: [
          'Executive-level program management',
          'Weekly progress reporting',
          'Risk mitigation',
          'Stakeholder alignment',
          'KPI tracking and optimization'
        ]
      }
    ],
    icp: {
      targets: ['CEOs', 'Ministers', 'Agency Heads', 'C-suite executives'],
      painPoints: [
        'Unclear path to ROI',
        'Low adoption rates',
        'Failed transformation projects',
        'Wasted consulting spend'
      ]
    },
    valueProp: 'Roadmap to ROI. We find demand, build markets, and deliver adoption—not just strategy decks.'
  },

  // 3. EXECUTIVE SEARCH
  'executive-search': {
    name: 'Executive Search',
    category: 'Professional Services',
    pricing: {
      model: 'Success-based',
      range: '$100K-$300K per placement',
      typical: '33% of first-year compensation'
    },
    packages: [
      {
        name: 'C-Suite Search',
        description: 'CEO, CFO, CTO, CRO placements',
        timeline: '8-12 weeks',
        pricing: '33% of first-year comp (typically $100K-$300K)',
        deliverables: [
          'Confidential search process',
          'Executive candidate sourcing',
          'Comprehensive vetting',
          'Interview coordination',
          'Offer negotiation',
          '90-day placement guarantee'
        ]
      },
      {
        name: 'VP-Level Search',
        description: 'VP and Director-level placements',
        timeline: '6-8 weeks',
        pricing: '33% of first-year comp (typically $75K-$150K)',
        deliverables: [
          'Targeted candidate sourcing',
          'Skills and culture fit assessment',
          'Reference checking',
          'Offer support',
          '60-day placement guarantee'
        ]
      }
    ],
    icp: {
      targets: ['CEOs', 'CHROs', 'VPs of Talent', 'Board members'],
      painPoints: [
        'Traditional recruiters take 6+ months',
        'Poor cultural fit hires',
        'High cost of failed placements',
        'Limited candidate pool access'
      ]
    },
    valueProp: 'Close deals over text. AI-powered search delivers qualified candidates in 2 weeks, not 6 months.'
  },

  // 4. WELLS OS
  'wells-os': {
    name: 'Wells OS - AI-Native Operating System',
    category: 'Technology & AI',
    pricing: {
      model: 'Fixed + Value share',
      range: '$2.5M-$25M',
      ongoing: 'Optional outcomes-tied value share'
    },
    packages: [
      {
        name: 'OS Pilot',
        description: '90-day proof of value with one department',
        timeline: '90 days',
        pricing: '$2.5M-$3.5M',
        deliverables: [
          'End-to-end workflow digitization',
          'Procurement on Grain rails',
          'AI Ops NOC coverage',
          'Real-time dashboards',
          '10-20% efficiency gains (measured)'
        ]
      },
      {
        name: 'OS Rollout',
        description: 'Enterprise-wide transformation',
        timeline: '6-12 months',
        pricing: '$8M-$25M',
        deliverables: [
          'Department-by-department deployment',
          'Change management program',
          'Training and enablement',
          'Integration with existing systems',
          'Measurable ROI tracking',
          'Ongoing support and optimization'
        ]
      }
    ],
    icp: {
      targets: ['Government CIOs', 'Corporate COOs', 'CFOs', 'Digital transformation leads'],
      painPoints: [
        'Legacy ERP systems failing',
        'Manual processes eating budget',
        'Failed digital transformation projects',
        'Cannot measure operational ROI'
      ]
    },
    valueProp: 'Turn on the new operating system. Measurable 10-20% efficiency gains in 90 days.'
  },

  // 5. AI OPS
  'ai-ops': {
    name: 'AI Ops - Managed Run-State',
    category: 'Technology & AI',
    pricing: {
      model: 'Per-instance subscription',
      range: '$1.5K-$4K per instance per month',
      tiers: 'Lite, Standard, Plus (regulated)'
    },
    packages: [
      {
        name: 'Run-State Lite',
        description: 'Basic AI operations and monitoring',
        pricing: '$150K/mo per 100 instances',
        deliverables: [
          '99.9% uptime SLA',
          'P1 < 30min response',
          'Basic audit logs',
          'Model drift alerts',
          'Monthly reporting'
        ]
      },
      {
        name: 'Run-State Standard',
        description: 'Full AI ops with proactive optimization',
        pricing: '$250K/mo per 100 instances',
        deliverables: [
          '99.95% uptime SLA',
          'P1 < 15min response',
          'Advanced observability',
          'Proactive optimization',
          'Weekly business reviews',
          'Cost optimization recommendations'
        ]
      },
      {
        name: 'Run-State Plus (Regulated)',
        description: 'Enterprise-grade for regulated industries',
        pricing: '$400K/mo per 100 instances',
        deliverables: [
          '99.99% uptime SLA',
          'P1 < 5min response',
          'Full compliance audit trails',
          'SOC 2 Type II certified operations',
          'Dedicated success manager',
          'Custom SLA terms available'
        ]
      }
    ],
    icp: {
      targets: ['CIOs', 'CTOs', 'VP Engineering', 'COOs'],
      painPoints: [
        'AI systems failing in production',
        'No one to call when AI breaks',
        'Compliance and audit requirements',
        'Model drift causing quality issues'
      ]
    },
    valueProp: 'Keep the lights brilliant. 24/7 AI operations so your systems never fail.'
  },

  // 6. WELLS AI PLATFORM
  'wells-ai-platform': {
    name: 'Wells AI Platform License',
    category: 'Technology & AI',
    pricing: {
      model: 'Custom enterprise licensing',
      range: 'Contact for pricing',
      options: 'White-label, API access, or full platform'
    },
    packages: [
      {
        name: 'API Access',
        description: 'Integrate conversational commerce into your product',
        pricing: 'Custom (volume-based)',
        deliverables: [
          'RESTful API access',
          'Webhook integrations',
          'Documentation and SDKs',
          'Developer support',
          'SLA guarantees'
        ]
      },
      {
        name: 'White-Label Platform',
        description: 'Full Wells AI under your brand',
        pricing: 'Custom (setup + monthly)',
        deliverables: [
          'Branded conversational interface',
          'Your domain and branding',
          'Custom integrations',
          'Dedicated infrastructure',
          'Priority support'
        ]
      }
    ],
    icp: {
      targets: ['Enterprise software companies', 'Platforms', 'Marketplaces', 'Large buyers'],
      painPoints: [
        'Forms killing conversion',
        'High friction in procurement',
        'Support costs too high',
        'Want conversational commerce capability'
      ]
    },
    valueProp: 'Conversational commerce infrastructure. Turn your procurement into conversation.'
  },

  // 7. GRAIN & VAULT
  'grain-vault': {
    name: 'Grain & Vault - Payments + Float + AUM',
    category: 'Financial Infrastructure',
    pricing: {
      model: 'Basis points + yield share',
      fees: '33bps transaction fee',
      float: '5-8% yield on $140B+ float'
    },
    packages: [
      {
        name: 'Payment Rails',
        description: 'Zero-friction B2B payments',
        pricing: '33bps per transaction',
        deliverables: [
          'Real-time settlement',
          'Multi-currency support',
          'Automated reconciliation',
          'Fraud protection (≤5bps)',
          'Chargeback management (≤40bps)',
          'Authorization rate ≥94%'
        ]
      },
      {
        name: 'Float Management',
        description: 'Turn payment float into revenue',
        pricing: 'Yield share model',
        deliverables: [
          'Automated float optimization',
          'Duration ladder management',
          'Liquidity tier structuring',
          'ALCO-compliant operations',
          'Real-time yield reporting'
        ]
      },
      {
        name: 'AUM Platform',
        description: 'Asset under management infrastructure',
        pricing: 'Custom',
        deliverables: [
          'Custody and clearing',
          'Compliance and reporting',
          'Risk management',
          'Treasury operations',
          'Regulatory support'
        ]
      }
    ],
    icp: {
      targets: ['CFOs', 'Treasurers', 'Finance VPs', 'Government finance directors'],
      painPoints: [
        'Payment friction slowing deals',
        'Float sitting idle',
        'Manual reconciliation',
        'High transaction costs'
      ]
    },
    valueProp: 'Zero-friction payments that generate yield. Turn procurement into profit center.'
  },

  // 8. EXO
  'exo': {
    name: 'Exo - Human Augmentation Hardware',
    category: 'Hardware & Manufacturing',
    pricing: {
      model: 'Unit sales + service + licensing',
      range: '$50K-$250K per unit',
      scale: '$1.26B revenue at full deployment'
    },
    packages: [
      {
        name: 'Industrial Exosuits',
        description: 'Warehouse, logistics, construction augmentation',
        pricing: '$75K-$150K per unit',
        deliverables: [
          'Full exosuit with power assist',
          'Training and certification',
          'Maintenance contract (Year 1 included)',
          'Safety monitoring software',
          'ROI tracking dashboard'
        ]
      },
      {
        name: 'Medical Prosthetics',
        description: 'Advanced prosthetic limbs',
        pricing: '$100K-$250K per unit',
        deliverables: [
          'Custom-fitted prosthetic',
          'Neural interface integration',
          'Physical therapy support',
          'Lifetime software updates',
          'Insurance reimbursement support'
        ]
      },
      {
        name: 'Service Contracts',
        description: 'Ongoing maintenance and optimization',
        pricing: '$12K-$25K per unit per year',
        deliverables: [
          'Preventive maintenance',
          'Priority repairs',
          'Software updates',
          'Performance optimization',
          'Usage analytics'
        ]
      }
    ],
    icp: {
      targets: ['Manufacturing VPs', 'Hospital procurement', 'Military/DoD', 'Logistics directors'],
      painPoints: [
        'Worker injury rates',
        'Physical labor limitations',
        'Productivity constraints',
        'Expensive prosthetic solutions'
      ]
    },
    valueProp: 'Human augmentation that pays for itself. 3-5x productivity gains, 80% injury reduction.'
  },

  // 9. FAB
  'fab': {
    name: 'Fab - 7nm Micro-Fabs',
    category: 'Hardware & Manufacturing',
    pricing: {
      model: 'Per-board + production fees',
      redesign: '$100K-$500K per board',
      production: 'Volume-based (48K boards/yr capacity)'
    },
    packages: [
      {
        name: 'Board Redesign',
        description: 'Migrate legacy boards to modern fab process',
        pricing: '$100K-$500K per board (defense: up to $500K pilot)',
        deliverables: [
          'Full board redesign for 7nm process',
          'Testing and validation',
          'DoD/aerospace certification support',
          'Design documentation',
          'First production run included'
        ]
      },
      {
        name: 'Production Manufacturing',
        description: 'High-volume board production',
        pricing: 'Volume-based (contact for quote)',
        deliverables: [
          'Priority fab access',
          'Quality assurance (military-grade)',
          'Supply chain management',
          'Inventory planning',
          'Just-in-time delivery'
        ]
      },
      {
        name: 'Programming Services',
        description: 'FPGA and chip programming',
        pricing: 'Project-based',
        deliverables: [
          'Custom programming',
          'Testing and validation',
          'Documentation',
          'Update support'
        ]
      }
    ],
    icp: {
      targets: ['Defense contractors', 'Aerospace OEMs', 'Industrial equipment manufacturers'],
      painPoints: [
        'Legacy boards failing, no replacement source',
        'China dependency risk',
        'Long lead times (12+ months)',
        'Small-batch production uneconomical'
      ]
    },
    valueProp: 'Bring dead boards back to life. U.S.-based 7nm fab with 48K board/year capacity.'
  },

  // 10. MAINSTREET & MANUFACTURING
  'mainstreet-mfg': {
    name: 'Mainstreet & Manufacturing',
    category: 'Real Assets',
    pricing: {
      model: 'Acquisition + development + operations',
      scale: '$400B deployable capital (muni-leveraged)',
      returns: '~$14B EBITDA at maturity'
    },
    packages: [
      {
        name: 'Town Square Revitalization',
        description: 'Acquire and revive town centers',
        pricing: 'Custom per town',
        deliverables: [
          'Property acquisition',
          'Historic preservation and modernization',
          'Tenant mix optimization (retail, office, storage)',
          'Municipal partnership structuring',
          '3:1 muni bond leverage',
          'NOI cap ≥7%'
        ]
      },
      {
        name: 'Factory Reboot',
        description: 'Reopen closed manufacturing facilities',
        pricing: 'Custom per facility',
        deliverables: [
          'Facility acquisition and environmental remediation',
          'Equipment modernization',
          'Workforce training (Redemption integration)',
          'Operations setup',
          'Anchor customer contracts',
          'Feeds Exo/Fab subassembly needs'
        ]
      }
    ],
    icp: {
      targets: ['Municipal governments', 'Economic development boards', 'State commerce departments'],
      painPoints: [
        'Dying town centers',
        'Closed factories, lost jobs',
        'Tax base erosion',
        'Lack of private capital for revitalization'
      ]
    },
    valueProp: 'Rebuild American industry and Main Streets. Muni-leveraged capital + operational expertise.'
  },

  // 11. REDEMPTION MANUFACTURING
  'redemption-mfg': {
    name: 'Redemption Manufacturing',
    category: 'Social Enterprise',
    pricing: {
      model: 'Break-even target (self-sustaining)',
      investment: '~$9M per site',
      revenue: 'Manufacturing margin + outcome contracts + grants'
    },
    packages: [
      {
        name: 'Redemption Campus',
        description: 'Second-chance workforce facility',
        pricing: 'Grant + impact investment funded',
        deliverables: [
          'Manufacturing jobs for formerly incarcerated',
          'On-site housing',
          'Job training and certification',
          'Case management and support services',
          'Manufacturing capacity (feeds Exo/Fab)',
          'Break-even by Month 18'
        ]
      }
    ],
    icp: {
      targets: ['State DOCs', 'Workforce boards', 'Impact investors', 'Philanthropic foundations'],
      painPoints: [
        'High recidivism rates',
        'Lack of employment for ex-offenders',
        'Manufacturing labor shortage',
        'Social services funding gaps'
      ]
    },
    valueProp: 'Self-sustaining second chances. Manufacturing + housing + support that breaks even.'
  },

  // 12. ADULLAM SCHOOLS
  'adullam': {
    name: 'Adullam - Entrepreneurial Schools Network',
    category: 'Education & Impact',
    pricing: {
      model: 'Tuition + sponsorships + licensing',
      campuses: '200 target',
      sanctuaries: '$6.4B philanthropic (pure giving)'
    },
    packages: [
      {
        name: 'Adullam Campus License',
        description: 'Franchise model for entrepreneurial education',
        pricing: '$200M annual ops revenue at 200 campuses',
        deliverables: [
          '~50 students per campus',
          'Entrepreneurial curriculum',
          'Rentals and licensing revenue',
          'Real estate value ($4M/campus avg)',
          '~40% EBITDA margin',
          'Total real estate portfolio: ~$800M'
        ]
      },
      {
        name: 'Adullam Sanctuaries (20 Global)',
        description: 'Philanthropic boarding academies - PURE GIVING',
        pricing: 'Tithe-funded, no commercial return',
        deliverables: [
          '~$320M capex per sanctuary',
          'Tuition-free boarding academy',
          'Endowment-backed operations',
          'Deeded to perpetual charitable trust',
          'Built over 10-15 years from Wells tithe'
        ]
      }
    ],
    icp: {
      targets: ['Philanthropists', 'Family offices', 'Education reformers', 'Mission-aligned investors'],
      painPoints: [
        'Traditional schools failing entrepreneurs',
        'Lack of character-first education',
        'Need for lasting educational legacy',
        'Want to fund education that endures'
      ]
    },
    valueProp: 'Build tabernacles, not unicorns. Education that lasts generations.'
  },

  // 13. BLACK OPS
  'black-ops': {
    name: 'Black Ops - Strategic Rainmaking',
    category: 'Strategic Services',
    pricing: {
      model: 'Success-based + retainer',
      range: 'Custom per mandate',
      typical: '3-5% of deal value'
    },
    packages: [
      {
        name: 'Nation-Scale Mandate',
        description: 'Government transformation programs',
        pricing: 'Custom (typically 3-5% of program value)',
        deliverables: [
          'Stakeholder coalition building',
          'Regulatory pathway clearing',
          'MoU and enabling agreement negotiation',
          'Sponsor-bank relationships',
          'Political air cover',
          'Program structuring (OS + G&V rails)'
        ]
      },
      {
        name: 'Special Situations',
        description: 'Complex enterprise transformations',
        pricing: 'Retainer + success fee',
        deliverables: [
          'Executive access and influence',
          'Deal structuring',
          'Risk mitigation and de-risking',
          'Multi-party negotiation',
          'Quiet execution',
          'White-glove service'
        ]
      }
    ],
    icp: {
      targets: ['Heads of state', 'Ministers', 'Fortune 50 CEOs', 'Private equity'],
      painPoints: [
        'Cannot access decision-makers',
        'Political/regulatory blockers',
        'Multi-stakeholder complexity',
        'Need quiet, effective execution'
      ]
    },
    valueProp: 'Unlock impossible deals. Nation-scale access + execution capability.'
  }
}

export type OfferPackage = typeof OFFER_PACKAGES[keyof typeof OFFER_PACKAGES]
