import { NextResponse } from 'next/server'

/**
 * Quick ICP suggestions endpoint
 * Returns pre-filled campaign data for rapid GTM setup
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const service = searchParams.get('service')

  if (!service) {
    return NextResponse.json({
      success: false,
      error: 'Service offering parameter required'
    }, { status: 400 })
  }

  const suggestions = getICPSuggestion(service)

  return NextResponse.json({
    success: true,
    suggestion: suggestions
  })
}

function getICPSuggestion(serviceOffering: string) {
  const icpTemplates: Record<string, any> = {
    'executive-search': {
      targetRevenue: '$50M-$200M',
      targetIndustry: 'SaaS, Fintech, Healthcare Tech',
      targetRole: 'CEO, Board Member, CHRO',
      targetCompanySize: 'series-b',
      painPoint: 'Struggling to find qualified C-suite candidates who fit your culture and can scale with the business. Traditional recruiters take 6+ months and deliver resumes, not vetted leaders.',
      value_prop: 'Close executive searches over text. AI-powered candidate sourcing delivers 5-10 deeply vetted candidates in 2 weeks. We guarantee cultural fit or we keep searching for free.',
      hook: 'Plus you get access to Wells AI platform—run all your procurement through conversation. No more vendor portals, just text what you need.'
    },
    'search-strategy': {
      targetRevenue: '$200M-$1B',
      targetIndustry: 'Enterprise SaaS, Healthcare, Manufacturing',
      targetRole: 'CEO, Chief Strategy Officer, VP Corporate Development',
      targetCompanySize: 'growth',
      painPoint: 'Growth has stalled at $200M. You have hired McKinsey 3 times and have beautiful slide decks but no pipeline. Board is asking hard questions about the next $500M.',
      value_prop: 'Roadmap to repeatable revenue in 6 weeks, not 6 months of consulting theater. We find real buyer demand, build new markets, and deliver actual adoption—not PowerPoints.',
      hook: 'And we build it all on Wells AI conversational commerce rails. Your entire GTM motion becomes chat-native from day one.'
    },
    'wells-os': {
      targetRevenue: '$1B+',
      targetIndustry: 'Government, Healthcare Systems, Fortune 500',
      targetRole: 'CIO, COO, CFO, Digital Transformation Lead',
      targetCompanySize: 'enterprise',
      painPoint: 'Your $50M SAP implementation failed. Manual processes still eat 30% of operational budget. The "digital transformation roadmap" from 2019 is collecting dust. Board wants measurable ROI yesterday.',
      value_prop: 'Turn on the new operating system. Measurable 10-20% efficiency gains in the first 90 days. We digitize workflows, connect procurement to Grain payment rails, and put AI Ops monitoring on everything from day one.',
      hook: 'Plus conversational ERP—your teams just text what they need. No training, no change management theater. It just works.'
    },
    'ai-ops': {
      targetRevenue: '$200M-$1B',
      targetIndustry: 'Enterprise Software, Financial Services, Healthcare',
      targetRole: 'CTO, VP Engineering, Chief AI Officer',
      targetCompanySize: 'growth',
      painPoint: 'Your AI is breaking in production and there is no one to call at 2am. Compliance audit is coming and you cannot prove model governance. Model drift is causing customer complaints. Your ML team is firefighting instead of building.',
      value_prop: 'Sleep at night. 24/7 AI operations with 99.9% uptime SLA, P1 response in under 30 minutes. Full audit trails for compliance. Model drift detection before it impacts customers. We keep the lights brilliant.',
      hook: 'Includes Wells AI platform—conversational operations monitoring. Just text "what is wrong with the model?" and get real answers, not dashboards.'
    },
    'idre-agency': {
      targetRevenue: '$50M-$200M',
      targetIndustry: 'Healthcare, Hospitals, Payers',
      targetRole: 'CFO, VP Revenue Cycle, Chief Compliance Officer',
      targetCompanySize: 'growth',
      painPoint: 'No Surprises Act compliance is costing you $5M+ annually in overhead. You need 30 FTEs just to process determinations. Every determination takes 3-5 days. The backlog is growing.',
      value_prop: 'Turn compliance burden into profit center. Our IDRE engine scales to 900+ determinations per day at 98% quality. You go from cost center to revenue generator. Full audit trail included.',
      hook: 'All accessible through Wells AI chat. Your team just texts case details—we handle the entire IDRE workflow conversationally.'
    },
    'exo': {
      targetRevenue: '$200M-$1B',
      targetIndustry: 'Manufacturing, Logistics, Construction, Healthcare',
      targetRole: 'VP Operations, VP Safety, Plant Manager, Hospital COO',
      targetCompanySize: 'growth',
      painPoint: 'Workplace injuries cost you $15M last year. Physical labor is your #1 bottleneck—you cannot hire fast enough and productivity has plateaued. Automation is too expensive and too inflexible for your operations.',
      value_prop: 'Human augmentation that pays for itself in 18 months. 3-5x productivity gains per worker. 80% reduction in workplace injuries. Workers love it because it makes their job easier, not obsolete.',
      hook: 'Order more units, schedule maintenance, track ROI—all through Wells AI conversational commerce. Text "I need 5 more Exo units for Building 3" and we handle the rest.'
    },
    'fab': {
      targetRevenue: '$200M-$1B',
      targetIndustry: 'Defense, Aerospace, Industrial Equipment',
      targetRole: 'VP Engineering, VP Supply Chain, CTO',
      targetCompanySize: 'growth',
      painPoint: 'Your legacy control boards are failing and there is no replacement source—the original manufacturer is in China and lead times are 12+ months. Production is at risk. Your China dependency is a strategic vulnerability the board keeps asking about.',
      value_prop: 'Bring dead boards back to life. U.S.-based 7nm fab with 48,000 board/year capacity. We redesign your legacy boards for modern process ($100K-$500K), then manufacture at volume. From failing board to domestic supply in 6 months.',
      hook: 'Manage the entire pipeline through Wells AI. Text "Status on board redesign for Part #47291" and get real-time updates. No vendor portals, no email chains.'
    },
    'mainstreet-mfg': {
      targetRevenue: 'N/A (Municipal)',
      targetIndustry: 'Municipal Government, Economic Development',
      targetRole: 'Mayor, City Manager, Economic Development Director',
      targetCompanySize: 'N/A',
      painPoint: 'Your downtown is dying. Three closed storefronts this year. The old factory that employed 500 people has been shuttered for 5 years. Tax base is eroding. No private capital is willing to take the risk on revitalization.',
      value_prop: 'Rebuild Main Street and bring manufacturing home. We deploy muni-leveraged capital (3:1 ratio) to acquire and revitalize town squares and reopen factories. Target NOI cap rate ≥7%. We handle everything: acquisition, renovation, tenant mix, job creation.',
      hook: 'Track every project milestone through Wells AI. Text "What is the status on the Main Street renovation?" and get real-time updates from acquisition to ribbon cutting.'
    },
    'grain-vault': {
      targetRevenue: '$1B+',
      targetIndustry: 'Enterprise, Government, Financial Services',
      targetRole: 'CFO, Treasurer, VP Finance',
      targetCompanySize: 'enterprise',
      painPoint: 'Payment friction is killing deal velocity. Your $500M in float is earning 0.5% in a money market when it could earn 5-8%. Finance team wastes 40 hours/week on manual reconciliation. Fraud losses are 15bps and climbing.',
      value_prop: 'Zero-friction payments that generate yield. Real-time settlement while your float earns 5-8% in automated treasury operations. Fraud ≤5bps. Chargebacks ≤40bps. Authorization rate ≥94%. Plus automated reconciliation—your finance team gets their lives back.',
      hook: 'All controlled conversationally through Wells AI. Text "Pay Supplier #4729 $2.5M" and we handle settlement, FX, compliance, and reconciliation automatically.'
    },
    'black-ops': {
      targetRevenue: '$1B+',
      targetIndustry: 'Government, Fortune 50, Private Equity',
      targetRole: 'Head of State, Minister, CEO, Managing Partner',
      targetCompanySize: 'enterprise',
      painPoint: 'You need access to decision-makers three levels above where your team can reach. Political and regulatory blockers everywhere. The deal requires orchestrating 8 different stakeholders who all hate each other. No one else will touch it.',
      value_prop: 'We unlock the impossible. Nation-scale access and coalition-building capability. We clear regulatory pathways, negotiate MOUs, secure sponsor-bank relationships, and structure deals that require political air cover. Quiet execution, high-trust, results-focused.',
      hook: 'Managed through private Wells AI channels. Encrypted, auditable, conversational deal orchestration that keeps sensitive negotiations off email.'
    },
    'wells-ai-platform': {
      targetRevenue: '$200M-$1B',
      targetIndustry: 'Enterprise Software, Platforms, Marketplaces',
      targetRole: 'CEO, CTO, Chief Product Officer',
      targetCompanySize: 'growth',
      painPoint: 'Forms are killing your conversion rates. Your procurement portal has 47% abandonment. Support costs are $12M/year answering "how do I..." questions. Users want to just text what they need—your UX team keeps saying it is impossible.',
      value_prop: 'Conversational commerce infrastructure that plugs into your platform in 2 weeks. Turn every procurement flow into conversation. 10x conversion improvement. 60% reduction in support costs. White-label or API access—your choice.',
      hook: 'Built on the same Wells AI that powers all Wells Onyx businesses. Proven at $45.6B scale. We eat our own cooking.'
    },
    'redemption-mfg': {
      targetRevenue: 'N/A (Social Enterprise)',
      targetIndustry: 'State DOC, Workforce Development, Impact Investment',
      targetRole: 'DOC Commissioner, Workforce Board Director, Impact Investor',
      targetCompanySize: 'N/A',
      painPoint: 'Recidivism is 68% within 3 years because there are no jobs waiting when people leave prison. Employers will not hire ex-offenders. Your state spends $45K/year to re-incarcerate people who just needed a paycheck and a place to live.',
      value_prop: 'Self-sustaining second chances. Manufacturing jobs + on-site housing + support services that break even by Month 18. We create real jobs making Exo and Fab components. Participants earn $45K+ annually, learn a trade, and build a future. No ongoing subsidy required.',
      hook: 'Participant progress tracked through Wells AI. Case managers text status updates. Employers text job opportunities. The entire ecosystem runs conversationally.'
    },
    'adullam': {
      targetRevenue: 'N/A (Philanthropic)',
      targetIndustry: 'Education, Philanthropy, Family Offices',
      targetRole: 'Philanthropist, Family Office Principal, Education Reformer',
      targetCompanySize: 'N/A',
      painPoint: 'Traditional schools are failing to prepare entrepreneurial minds. You want to fund education that lasts generations, not just buildings with your name on them. You want character-first formation, not credential factories.',
      value_prop: 'Build tabernacles, not unicorns. 200-campus Adullam network teaching entrepreneurship + character formation. Plus 20 global Sanctuaries—fully endowed, tuition-free boarding academies that will outlast us all. Every campus deeded to perpetual charitable trust.',
      hook: 'Impact visibility through Wells AI dashboard. Text "How is the Houston campus doing?" and get real-time enrollment, outcomes, and stories. Transparency you can trust.'
    }
  }

  return icpTemplates[serviceOffering] || icpTemplates['executive-search']
}
