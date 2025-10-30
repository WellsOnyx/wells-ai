/**
 * Wells AI - Category Management
 * Known categories vs. open partnership opportunities
 */

export const KNOWN_CATEGORIES = [
  'semiconductors',
  'executive-search',
  'search-strategy',
  'idre-agency',
  'wells-os',
  'ai-ops',
  'wells-ai-platform',
  'grain-vault',
  'exo',
  'fab',
  'mainstreet-mfg',
  'redemption-mfg',
  'adullam',
  'black-ops',
  'cloud-infrastructure',
  'software-development',
  'marketing-services',
  'legal-services',
  'accounting-services',
  'consulting',
  'construction',
  'manufacturing',
  'logistics',
  'real-estate'
]

export interface CategoryPioneerOpportunity {
  slug: string
  name: string
  emoji: string
  description: string
  marketSize: string // e.g., "$45B"
  potentialYearTwoRevenue: number // in thousands
  tier1Revenue: number // 20% share
  tier2Revenue: number // 35% share
  tier3Revenue: number // 50% share
  isPioneered: boolean
  pioneerCompany?: string
  status: 'open' | 'in-negotiation' | 'live'
}

// Open partnership opportunities
export const OPEN_CATEGORIES: CategoryPioneerOpportunity[] = [
  {
    slug: 'injection-molding',
    name: 'Injection Molding',
    emoji: '🏭',
    description: 'Custom injection molded plastic parts and tooling',
    marketSize: '$320B',
    potentialYearTwoRevenue: 125,
    tier1Revenue: 25,
    tier2Revenue: 44,
    tier3Revenue: 63,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'freight-logistics',
    name: 'Freight & Logistics',
    emoji: '🚚',
    description: 'Full truckload, LTL, and last-mile delivery',
    marketSize: '$1.1T',
    potentialYearTwoRevenue: 340,
    tier1Revenue: 68,
    tier2Revenue: 119,
    tier3Revenue: 170,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'power-electronics',
    name: 'Power Electronics',
    emoji: '🔌',
    description: 'Industrial power supplies and conversion systems',
    marketSize: '$42B',
    potentialYearTwoRevenue: 89,
    tier1Revenue: 18,
    tier2Revenue: 31,
    tier3Revenue: 45,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'hospital-equipment',
    name: 'Hospital Equipment',
    emoji: '🏥',
    description: 'Medical devices, imaging, and diagnostic equipment',
    marketSize: '$450B',
    potentialYearTwoRevenue: 215,
    tier1Revenue: 43,
    tier2Revenue: 75,
    tier3Revenue: 108,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'mobile-app-development',
    name: 'Mobile App Development',
    emoji: '📱',
    description: 'iOS and Android custom application development',
    marketSize: '$407B',
    potentialYearTwoRevenue: 156,
    tier1Revenue: 31,
    tier2Revenue: 55,
    tier3Revenue: 78,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'creative-services',
    name: 'Creative & Design Services',
    emoji: '🎨',
    description: 'Brand design, video production, content creation',
    marketSize: '$260B',
    potentialYearTwoRevenue: 98,
    tier1Revenue: 20,
    tier2Revenue: 34,
    tier3Revenue: 49,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: '3d-printing',
    name: '3D Printing Services',
    emoji: '🖨️',
    description: 'Additive manufacturing and rapid prototyping',
    marketSize: '$18B',
    potentialYearTwoRevenue: 67,
    tier1Revenue: 13,
    tier2Revenue: 23,
    tier3Revenue: 34,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'industrial-automation',
    name: 'Industrial Automation',
    emoji: '🤖',
    description: 'Robotics, PLCs, and factory automation systems',
    marketSize: '$205B',
    potentialYearTwoRevenue: 178,
    tier1Revenue: 36,
    tier2Revenue: 62,
    tier3Revenue: 89,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'cybersecurity-services',
    name: 'Cybersecurity Services',
    emoji: '🔒',
    description: 'Penetration testing, SOC services, compliance',
    marketSize: '$173B',
    potentialYearTwoRevenue: 145,
    tier1Revenue: 29,
    tier2Revenue: 51,
    tier3Revenue: 73,
    isPioneered: false,
    status: 'open'
  },
  {
    slug: 'commercial-insurance',
    name: 'Commercial Insurance',
    emoji: '🛡️',
    description: 'Business insurance brokerage and risk management',
    marketSize: '$725B',
    potentialYearTwoRevenue: 234,
    tier1Revenue: 47,
    tier2Revenue: 82,
    tier3Revenue: 117,
    isPioneered: false,
    status: 'open'
  }
]

// Active partnerships (example data)
export const ACTIVE_PARTNERSHIPS: CategoryPioneerOpportunity[] = [
  {
    slug: 'industrial-robotics',
    name: 'Industrial Robotics',
    emoji: '🏗️',
    description: 'Industrial robots and automation solutions',
    marketSize: '$71B',
    potentialYearTwoRevenue: 250,
    tier1Revenue: 50,
    tier2Revenue: 88,
    tier3Revenue: 125,
    isPioneered: true,
    pioneerCompany: 'ABB',
    status: 'live'
  },
  {
    slug: 'medical-device-manufacturing',
    name: 'Medical Device Manufacturing',
    emoji: '💊',
    description: 'Contract manufacturing for medical devices',
    marketSize: '$450B',
    potentialYearTwoRevenue: 198,
    tier1Revenue: 40,
    tier2Revenue: 69,
    tier3Revenue: 99,
    isPioneered: true,
    pioneerCompany: 'Medtronic',
    status: 'live'
  }
]

export function detectCategory(userMessage: string): string | null {
  const message = userMessage.toLowerCase()

  // Check against known categories
  for (const category of KNOWN_CATEGORIES) {
    if (message.includes(category.replace(/-/g, ' '))) {
      return category
    }
  }

  // Check against open partnership categories
  for (const category of OPEN_CATEGORIES) {
    const categoryTerms = category.name.toLowerCase().split(' ')
    if (categoryTerms.every(term => message.includes(term))) {
      return `new:${category.slug}`
    }
  }

  // Check for generic procurement terms that might be new category
  const procurementTerms = [
    'need', 'looking for', 'source', 'buy', 'purchase',
    'supplier', 'vendor', 'procurement', 'quote'
  ]

  if (procurementTerms.some(term => message.includes(term))) {
    // This is likely a new category opportunity
    return 'new:unknown'
  }

  return null
}

export function isNewCategory(category: string): boolean {
  return category.startsWith('new:')
}

export function getCategoryOpportunity(slug: string): CategoryPioneerOpportunity | null {
  return OPEN_CATEGORIES.find(c => c.slug === slug) || null
}
