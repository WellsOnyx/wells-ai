/**
 * Wells HR - Employment Models
 * Flexible arrangements for independent professionals
 */

export interface EmploymentArrangement {
  id: string
  name: string
  description: string
  legalStructure: 'W2' | '1099' | 'C2C' | 'EOR'
  benefits: boolean
  taxHandling: 'employer_withholds' | 'contractor_responsible' | 'eor_handles'
  unemploymentEligible: boolean
  workerProtection: 'full_employee' | 'limited' | 'none'
  minimumCommitment?: string
  pricing: {
    platformFee: string
    payrollFee?: string
    benefitsFee?: string
  }
  pros: string[]
  cons: string[]
  bestFor: string[]
  legalRequirements: string[]
}

export const EMPLOYMENT_MODELS: Record<string, EmploymentArrangement> = {

  // Option 1: W2 with Benefits (Most Protection, Highest Cost)
  'w2-benefits': {
    id: 'w2-benefits',
    name: 'W2 Employee with Benefits',
    description: 'Full employment status with health insurance, 401k, paid time off',
    legalStructure: 'W2',
    benefits: true,
    taxHandling: 'employer_withholds',
    unemploymentEligible: true,
    workerProtection: 'full_employee',
    minimumCommitment: '30 hours/week average',
    pricing: {
      platformFee: '5% of gross',
      payrollFee: '$49/month',
      benefitsFee: '$400-800/month (health insurance + 401k match)'
    },
    pros: [
      'Health insurance (employer contributes 50-75%)',
      '401k with 3-4% match',
      'Paid time off (15 days/year)',
      'Workers comp coverage',
      'Tax withholding handled automatically',
      'Most stable arrangement',
      'Easier to get mortgages/loans'
    ],
    cons: [
      'Higher cost to company (30-40% overhead)',
      'Less flexibility (expected consistent hours)',
      'Eligible for unemployment (risk to company)',
      'Harder to terminate quickly',
      'Must follow employment laws strictly'
    ],
    bestFor: [
      'Full-time professionals (30+ hrs/week)',
      'Long-term relationships (1+ year expected)',
      'People who value benefits over flexibility',
      'Those with families needing health insurance'
    ],
    legalRequirements: [
      'Employment agreement with at-will clause',
      'I-9 verification',
      'W-4 tax forms',
      'State new hire reporting',
      'Workers comp insurance',
      'Unemployment insurance contributions'
    ]
  },

  // Option 2: W2 without Benefits (Good Middle Ground)
  'w2-no-benefits': {
    id: 'w2-no-benefits',
    name: 'W2 Contractor (No Benefits)',
    description: 'W2 status for tax convenience, but no traditional employee benefits',
    legalStructure: 'W2',
    benefits: false,
    taxHandling: 'employer_withholds',
    unemploymentEligible: true,
    workerProtection: 'limited',
    minimumCommitment: 'Project-based or 20+ hrs/week',
    pricing: {
      platformFee: '5% of gross',
      payrollFee: '$29/month'
    },
    pros: [
      'Taxes withheld (simpler than 1099)',
      'No quarterly estimated taxes',
      'Workers comp covered',
      'Still W2 for mortgage/loan applications',
      'Lower cost than full benefits'
    ],
    cons: [
      'No health insurance',
      'No 401k match',
      'No PTO',
      'Still eligible for unemployment (company risk)',
      'Less flexibility than pure 1099'
    ],
    bestFor: [
      'Part-time professionals (20-30 hrs/week)',
      'Project-based work with regular income',
      'People who have benefits elsewhere (spouse, VA, etc.)',
      'Those who want tax simplicity without self-employment tax'
    ],
    legalRequirements: [
      'Contractor agreement with no-unemployment waiver clause',
      'I-9 verification',
      'W-4 tax forms',
      'State new hire reporting',
      'Workers comp insurance',
      'Unemployment insurance (though waived in agreement)'
    ]
  },

  // Option 3: 1099 Independent Contractor (Maximum Flexibility)
  '1099': {
    id: '1099',
    name: '1099 Independent Contractor',
    description: 'True independent contractor status - maximum flexibility, you handle all taxes',
    legalStructure: '1099',
    benefits: false,
    taxHandling: 'contractor_responsible',
    unemploymentEligible: false,
    workerProtection: 'none',
    pricing: {
      platformFee: '3.3% of gross (33bps Wells AI fee only)'
    },
    pros: [
      'Maximum flexibility (set own hours)',
      'No minimum commitment',
      'Lowest platform fees',
      'Can work for multiple clients simultaneously',
      'Business expense deductions',
      'No unemployment risk to company',
      'Easy to start/stop relationship'
    ],
    cons: [
      'Must pay quarterly estimated taxes',
      'Self-employment tax (15.3%)',
      'No benefits',
      'No workers comp',
      'Must track own business expenses',
      'Less stable than W2',
      'Harder to get loans/mortgages'
    ],
    bestFor: [
      'Experienced independent contractors',
      'People with LLC/S-Corp already set up',
      'Part-time/freelance work',
      'Multiple income sources',
      'Those who value flexibility over stability'
    ],
    legalRequirements: [
      'Independent contractor agreement',
      'W-9 form',
      '1099-NEC issued annually',
      'Clear IC classification (pass IRS 20-factor test)',
      'No set schedule or supervision',
      'Contractor provides own tools/equipment'
    ]
  },

  // Option 4: Corp-to-Corp (C2C)
  'c2c': {
    id: 'c2c',
    name: 'Corp-to-Corp (C2C)',
    description: 'Your LLC/Corp contracts with Wells Onyx - cleanest separation',
    legalStructure: 'C2C',
    benefits: false,
    taxHandling: 'contractor_responsible',
    unemploymentEligible: false,
    workerProtection: 'none',
    pricing: {
      platformFee: '3.3% of gross (33bps Wells AI fee only)'
    },
    pros: [
      'Cleanest legal separation',
      'No employment relationship at all',
      'Your company handles all HR/taxes',
      'Can hire subcontractors under you',
      'Maximum liability protection',
      'No unemployment risk',
      'Easiest to terminate'
    ],
    cons: [
      'Must have LLC/Corp already formed',
      'More complex invoicing/accounting',
      'Need business insurance',
      'Higher admin overhead for contractor',
      'No benefits from Wells Onyx'
    ],
    bestFor: [
      'Established businesses',
      'Agencies/firms with multiple people',
      'High-earning professionals ($200K+)',
      'Those with existing LLC/S-Corp/C-Corp',
      'Long-term independent consultants'
    ],
    legalRequirements: [
      'Master services agreement (MSA)',
      'Statement of work (SOW) per project',
      'W-9 from contractor entity',
      '1099-NEC to contractor entity',
      'General liability insurance',
      'Professional liability insurance (E&O)',
      'Proof of entity formation'
    ]
  },

  // Option 5: EOR (Employer of Record) - International or Compliance-Heavy
  'eor': {
    id: 'eor',
    name: 'EOR (Employer of Record)',
    description: 'Third-party company employs you, contracts with Wells Onyx',
    legalStructure: 'EOR',
    benefits: true,
    taxHandling: 'eor_handles',
    unemploymentEligible: true,
    workerProtection: 'full_employee',
    pricing: {
      platformFee: '3.3% of gross (to Wells AI)',
      payrollFee: '$599/month (EOR fee)',
      benefitsFee: '$200-600/month (benefits from EOR)'
    },
    pros: [
      'Benefits without Wells Onyx being employer',
      'International workers (any country)',
      'Compliance handled by EOR',
      'Unemployment risk transferred to EOR',
      'Great for distributed teams',
      'Quick to set up (1-2 days)'
    ],
    cons: [
      'Highest monthly cost ($599+ EOR fee)',
      'Still eligible for unemployment (but not Wells Onyx\'s problem)',
      'Less direct relationship',
      'EOR terms may be rigid',
      'May need minimum contract length'
    ],
    bestFor: [
      'International contractors',
      'When Wells Onyx doesn\'t want employment risk',
      'Compliance-heavy industries (finance, healthcare)',
      'Temporary workers (3-12 months)',
      'Workers in states with strict employment laws (CA, NY)'
    ],
    legalRequirements: [
      'EOR agreement (Deel, Remote, Oyster)',
      'Wells Onyx contracts with EOR',
      'EOR employs worker',
      'Worker signs EOR employment agreement',
      'All compliance handled by EOR'
    ]
  }
}

/**
 * Modified W2 Agreement with Unemployment Waiver
 * (NOTE: Consult employment lawyer - this may not be enforceable in all states)
 */
export const W2_NO_UNEMPLOYMENT_CLAUSES = {
  classification: `
    INDEPENDENT CONTRACTOR CLASSIFICATION
    Although Contractor will be issued a W-2 for tax reporting purposes,
    Contractor acknowledges and agrees that this arrangement is solely for
    the convenience of tax withholding and does not create an employer-employee
    relationship as defined by state unemployment insurance laws.
  `,

  acknowledgment: `
    CONTRACTOR ACKNOWLEDGMENTS
    Contractor hereby acknowledges and agrees that:

    a) This is a contract for services, not employment
    b) Contractor has no expectation of continued work beyond current project
    c) Contractor is free to work for other clients simultaneously
    d) Contractor sets own schedule and methods of work
    e) Company exercises no direct supervision over Contractor's work
    f) Contractor provides own tools and equipment where practical
    g) Contractor is engaged for specific deliverables, not time-based employment
  `,

  unemploymentWaiver: `
    UNEMPLOYMENT COMPENSATION WAIVER
    Contractor expressly waives any right to claim unemployment compensation
    benefits from Company upon termination of this Agreement. Contractor
    acknowledges that this engagement is project-based and temporary in nature,
    and that Contractor has been advised to maintain other sources of income
    and/or unemployment insurance through alternative means.

    WARNING: This waiver may not be enforceable in all jurisdictions. Some
    states (CA, NY, MA) do not allow unemployment waivers. Consult local
    employment counsel before relying on this provision.
  `,

  atWill: `
    AT-WILL RELATIONSHIP
    This Agreement may be terminated by either party at any time, with or
    without cause, with or without notice. Nothing in this Agreement creates
    an expectation of continued work, regular hours, or long-term engagement.
  `,

  noRights: `
    NO EMPLOYMENT RIGHTS OR BENEFITS
    Contractor acknowledges that they are not entitled to:
    - Health insurance
    - Retirement benefits
    - Paid time off
    - Sick leave
    - Holiday pay
    - Severance pay
    - Unemployment compensation
    - Workers' compensation (except as required by law)

    Contractor is responsible for their own insurance and benefits.
  `
}

/**
 * Risk Assessment by Model
 */
export const RISK_PROFILES = {
  'w2-benefits': {
    unemploymentRisk: 'HIGH',
    misclassificationRisk: 'NONE',
    terminationRisk: 'MEDIUM',
    recommendedFor: 'Full-time core team members'
  },
  'w2-no-benefits': {
    unemploymentRisk: 'HIGH (despite waiver)',
    misclassificationRisk: 'LOW',
    terminationRisk: 'MEDIUM',
    recommendedFor: 'Part-time regular contributors'
  },
  '1099': {
    unemploymentRisk: 'NONE',
    misclassificationRisk: 'MEDIUM (must pass IRS 20-factor test)',
    terminationRisk: 'NONE',
    recommendedFor: 'Project-based or hourly consultants'
  },
  'c2c': {
    unemploymentRisk: 'NONE',
    misclassificationRisk: 'NONE',
    terminationRisk: 'NONE',
    recommendedFor: 'Agencies, established businesses'
  },
  'eor': {
    unemploymentRisk: 'NONE (transferred to EOR)',
    misclassificationRisk: 'NONE',
    terminationRisk: 'LOW',
    recommendedFor: 'International workers, compliance-heavy situations'
  }
}

/**
 * Recommended EOR Providers
 */
export const EOR_PROVIDERS = {
  deel: {
    name: 'Deel',
    url: 'https://www.deel.com',
    pricing: '$599/month per contractor',
    countries: 150,
    benefits: true,
    bestFor: 'International contractors, fast setup'
  },
  remote: {
    name: 'Remote.com',
    url: 'https://remote.com',
    pricing: '$599/month per contractor',
    countries: 70,
    benefits: true,
    bestFor: 'Global employment, great support'
  },
  oyster: {
    name: 'Oyster HR',
    url: 'https://www.oysterhr.com',
    pricing: '$599/month per contractor',
    countries: 180,
    benefits: true,
    bestFor: 'Distributed teams, equity grants'
  },
  justworks: {
    name: 'Justworks',
    url: 'https://justworks.com',
    pricing: '$59-99/month per person',
    countries: 'US only',
    benefits: true,
    bestFor: 'US-based teams, PEO model'
  },
  rippling: {
    name: 'Rippling',
    url: 'https://www.rippling.com',
    pricing: '$35/month per person + $8/month per system',
    countries: 'US + select international',
    benefits: true,
    bestFor: 'US-focused, great integrations'
  }
}

/**
 * State-Specific Unemployment Waiver Enforceability
 */
export const UNEMPLOYMENT_WAIVER_BY_STATE = {
  enforceable: [
    'TX', 'FL', 'GA', 'TN', 'AZ', 'NC', 'SC', 'IN', 'OH', 'MO',
    'AL', 'MS', 'LA', 'AR', 'OK', 'KS', 'NE', 'SD', 'ND', 'WY',
    'ID', 'UT', 'NV', 'AK'
  ],

  limited: [
    'PA', 'MI', 'WI', 'MN', 'IA', 'KY', 'WV', 'VA', 'NH', 'ME',
    'VT', 'DE', 'MD', 'CO', 'NM', 'OR', 'WA'
  ],

  notEnforceable: [
    'CA', 'NY', 'NJ', 'MA', 'CT', 'RI', 'IL', 'HI'
  ],

  notes: {
    CA: 'California does not allow unemployment waivers. Must use true IC or EOR.',
    NY: 'New York heavily scrutinizes IC classification. EOR recommended.',
    NJ: 'New Jersey presumes employment unless proven otherwise.',
    MA: 'Massachusetts ABC test makes IC classification difficult.',
    IL: 'Illinois has strict IC rules. Waiver likely unenforceable.'
  }
}
