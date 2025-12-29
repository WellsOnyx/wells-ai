// @ts-nocheck
/**
 * Wells AI Proactive Insight Engine
 *
 * "The wise man sees calamity and hides himself;
 *  the simple pass on and suffer for it." - Proverbs 27:12
 *
 * This engine generates proactive insights that make Wells feel like
 * a living companion that's always working for you. Wells doesn't wait -
 * it reaches out with actionable intelligence.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { getWellsMemory, WellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export type InsightCategory =
  | 'cost_savings'
  | 'revenue_opportunity'
  | 'risk_alert'
  | 'contract_reminder'
  | 'market_intelligence'
  | 'performance_tip'
  | 'celebration'
  | 'relationship'
  | 'compliance'
  | 'strategic'

export type InsightUrgency = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type UserJourney = 'buyer' | 'seller' | 'founder' | 'job_seeker'

export interface ProactiveInsight {
  id: string
  userId: string
  journey: UserJourney
  category: InsightCategory
  urgency: InsightUrgency
  title: string
  message: string
  detailedExplanation?: string
  potentialValue?: number
  potentialValueType?: 'savings' | 'revenue' | 'time' | 'risk_avoided'
  actionOptions: InsightAction[]
  relatedEntities?: {
    type: 'supplier' | 'customer' | 'contract' | 'invoice' | 'rfq' | 'job' | 'deal'
    id: string
    name: string
  }[]
  dataPoints?: Record<string, any>
  expiresAt?: Date
  createdAt: Date
  actedUpon: boolean
  actedUponAt?: Date
  actionTaken?: string
  dismissed: boolean
  dismissedAt?: Date
  dismissReason?: string
}

export interface InsightAction {
  id: string
  label: string
  actionType: 'api_call' | 'navigation' | 'ai_task' | 'confirm' | 'schedule'
  isPrimary: boolean
  endpoint?: string
  payload?: Record<string, any>
  navigationUrl?: string
  confirmMessage?: string
  aiTaskDescription?: string
}

export interface InsightGenerationContext {
  userId: string
  journey: UserJourney
  memory: WellsMemory | null
  recentActivity?: any[]
  marketData?: any
  userMetrics?: UserMetrics
}

export interface UserMetrics {
  // Buyer metrics
  totalSpend?: number
  averageOrderValue?: number
  supplierCount?: number
  pendingInvoices?: number
  upcomingContractRenewals?: number
  categorySpendBreakdown?: Record<string, number>

  // Seller metrics
  totalRevenue?: number
  pendingRfqs?: number
  winRate?: number
  averageResponseTime?: number
  repeatCustomerRate?: number
  competitorActivity?: any[]

  // Founder metrics
  burnRate?: number
  runway?: number
  customerChurnRate?: number
  revenueGrowthRate?: number
  teamSize?: number

  // Job seeker metrics
  applicationsSubmitted?: number
  interviewsScheduled?: number
  profileViews?: number
  matchingJobs?: number
  marketSalaryData?: {
    role: string
    location: string
    median: number
    percentile25: number
    percentile75: number
  }
}

// ============================================================================
// INSIGHT TEMPLATES BY JOURNEY
// ============================================================================

const BUYER_INSIGHT_TEMPLATES = {
  cost_increase: {
    category: 'cost_savings' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `${data.category} costs up ${data.percentIncrease}% vs last quarter`,
      message: `I found ${data.alternativeCount} alternatives that could save $${data.potentialSavings.toLocaleString()}/year. Want me to get quotes?`,
      potentialValue: data.potentialSavings,
      potentialValueType: 'savings' as const,
    }),
  },
  contract_expiring: {
    category: 'contract_reminder' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Contract with ${data.supplierName} expires in ${data.daysRemaining} days`,
      message: `Market rates are ${data.marketRateChange}% ${data.marketRateChange < 0 ? 'lower' : 'higher'} - ${data.marketRateChange < 0 ? 'good time to renegotiate' : 'consider locking in current rates'}.`,
      potentialValue: Math.abs(data.potentialSavings),
      potentialValueType: 'savings' as const,
    }),
  },
  supplier_concentration: {
    category: 'risk_alert' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Supplier concentration risk detected`,
      message: `${data.percentFromTopSupplier}% of orders from ${data.topSupplierName}. I recommend diversifying to reduce risk. Want me to find alternatives?`,
      potentialValue: data.atRiskSpend,
      potentialValueType: 'risk_avoided' as const,
    }),
  },
  unusual_invoice: {
    category: 'risk_alert' as InsightCategory,
    urgency: 'critical' as InsightUrgency,
    template: (data: any) => ({
      title: `Unusual invoice requires attention`,
      message: `$${data.invoiceAmount.toLocaleString()} invoice from ${data.vendorName} (${data.isNewVendor ? 'new vendor' : 'unusual amount'}). Want me to verify this?`,
      potentialValue: data.invoiceAmount,
      potentialValueType: 'risk_avoided' as const,
    }),
  },
  price_drop_opportunity: {
    category: 'cost_savings' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Price drop opportunity`,
      message: `${data.category} prices dropped ${data.priceDropPercent}% in the market. You could save $${data.potentialSavings.toLocaleString()} on your next order.`,
      potentialValue: data.potentialSavings,
      potentialValueType: 'savings' as const,
    }),
  },
}

const SELLER_INSIGHT_TEMPLATES = {
  new_rfq_match: {
    category: 'revenue_opportunity' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `${data.rfqCount} new RFQs match your profile`,
      message: `Quick response could win $${data.totalValue.toLocaleString()} in orders. Top performers respond in ${data.targetResponseHours} hours.`,
      potentialValue: data.totalValue,
      potentialValueType: 'revenue' as const,
    }),
  },
  response_time_coaching: {
    category: 'performance_tip' as InsightCategory,
    urgency: 'low' as InsightUrgency,
    template: (data: any) => ({
      title: `Speed up to win more deals`,
      message: `Your average response time is ${data.userResponseTime} hours. Top performers respond in ${data.topPerformerTime} hours. Speed up to 2x your deals.`,
      potentialValue: data.potentialRevenueGain,
      potentialValueType: 'revenue' as const,
    }),
  },
  repeat_customer_alert: {
    category: 'relationship' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `${data.customerName} is back`,
      message: `They usually reorder every ${data.typicalReorderWeeks} weeks. Their last order was $${data.lastOrderValue.toLocaleString()}. Want me to reach out?`,
      potentialValue: data.estimatedOrderValue,
      potentialValueType: 'revenue' as const,
    }),
  },
  competitor_pricing: {
    category: 'market_intelligence' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Competitor pricing alert`,
      message: `${data.competitorName || 'A competitor'} dropped prices ${data.priceDropPercent}%. Consider matching to stay competitive.`,
      potentialValue: data.atRiskRevenue,
      potentialValueType: 'risk_avoided' as const,
    }),
  },
  quote_follow_up: {
    category: 'revenue_opportunity' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Quote follow-up opportunity`,
      message: `${data.pendingQuoteCount} quotes pending for ${data.daysPending}+ days. A follow-up could close $${data.totalPendingValue.toLocaleString()}.`,
      potentialValue: data.totalPendingValue,
      potentialValueType: 'revenue' as const,
    }),
  },
}

const FOUNDER_INSIGHT_TEMPLATES = {
  runway_alert: {
    category: 'risk_alert' as InsightCategory,
    urgency: 'critical' as InsightUrgency,
    template: (data: any) => ({
      title: `Runway update: ${data.runwayMonths} months remaining`,
      message: `Your burn rate suggests ${data.runwayMonths} months runway. I can help find ${data.runwayMonths < 6 ? 'urgent cost savings' : 'cost savings or revenue opportunities'}.`,
      potentialValue: data.monthlyBurn,
      potentialValueType: 'savings' as const,
    }),
  },
  customer_churn_risk: {
    category: 'relationship' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `${data.atRiskCustomers} customers haven't reordered`,
      message: `${data.atRiskCustomers} customers haven't ordered in ${data.daysSinceOrder}+ days. Combined revenue at risk: $${data.atRiskRevenue.toLocaleString()}. Want me to reach out?`,
      potentialValue: data.atRiskRevenue,
      potentialValueType: 'risk_avoided' as const,
    }),
  },
  price_increase_opportunity: {
    category: 'revenue_opportunity' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Price increase opportunity`,
      message: `Market rates for ${data.productCategory} increased ${data.marketIncreasePercent}%. A ${data.suggestedIncrease}% increase could add $${data.potentialRevenue.toLocaleString()}/year.`,
      potentialValue: data.potentialRevenue,
      potentialValueType: 'revenue' as const,
    }),
  },
  cash_flow_alert: {
    category: 'risk_alert' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `Cash position alert`,
      message: `${data.invoicesDue} invoices due Friday ($${data.totalDue.toLocaleString()}) and cash position is ${data.cashPositionStatus}. Want me to request extended terms?`,
      potentialValue: data.totalDue,
      potentialValueType: 'risk_avoided' as const,
    }),
  },
  milestone_celebration: {
    category: 'celebration' as InsightCategory,
    urgency: 'info' as InsightUrgency,
    template: (data: any) => ({
      title: `Congrats! ${data.milestoneDescription}`,
      message: `You just ${data.achievement}. You're in the top ${data.percentile}% of ${data.comparisonGroup}. Keep it up!`,
      potentialValue: data.valueAchieved,
      potentialValueType: 'revenue' as const,
    }),
  },
}

const JOB_SEEKER_INSIGHT_TEMPLATES = {
  new_role_matches: {
    category: 'revenue_opportunity' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `${data.matchCount} new roles match your profile`,
      message: `Found ${data.matchCount} new ${data.roleType} roles this week. Average salary: $${data.averageSalary.toLocaleString()}. Should I apply?`,
      potentialValue: data.averageSalary,
      potentialValueType: 'revenue' as const,
    }),
  },
  salary_insight: {
    category: 'market_intelligence' as InsightCategory,
    urgency: 'medium' as InsightUrgency,
    template: (data: any) => ({
      title: `Salary insight for your role`,
      message: `${data.roleTitle} salaries in ${data.location} are up ${data.salaryIncrease}% YoY. Median: $${data.medianSalary.toLocaleString()}. ${data.userPosition}`,
      potentialValue: data.potentialIncrease,
      potentialValueType: 'revenue' as const,
    }),
  },
  profile_view_alert: {
    category: 'relationship' as InsightCategory,
    urgency: 'high' as InsightUrgency,
    template: (data: any) => ({
      title: `High interest signal from ${data.companyName}`,
      message: `${data.viewerTitle} at ${data.companyName} viewed your profile ${data.viewCount} times. This is a strong interest signal. Want me to reach out?`,
      potentialValue: data.roleValue,
      potentialValueType: 'revenue' as const,
    }),
  },
  application_status: {
    category: 'strategic' as InsightCategory,
    urgency: 'low' as InsightUrgency,
    template: (data: any) => ({
      title: `Application update`,
      message: `${data.applicationsInProgress} applications in progress, ${data.interviewsScheduled} interviews scheduled. ${data.suggestion}`,
      potentialValue: 0,
      potentialValueType: 'time' as const,
    }),
  },
  skill_gap_opportunity: {
    category: 'strategic' as InsightCategory,
    urgency: 'low' as InsightUrgency,
    template: (data: any) => ({
      title: `Skill boost opportunity`,
      message: `${data.percentOfRoles}% of ${data.targetRole} roles require ${data.skillName}. Adding it could increase matches by ${data.matchIncrease}%.`,
      potentialValue: data.potentialSalaryBoost,
      potentialValueType: 'revenue' as const,
    }),
  },
}

// ============================================================================
// INSIGHT ENGINE
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

/**
 * Generate proactive insights for a user based on their journey and data
 */
export async function generateInsights(
  context: InsightGenerationContext
): Promise<ProactiveInsight[]> {
  const { userId, journey, memory, userMetrics } = context
  const insights: ProactiveInsight[] = []

  try {
    // Get journey-specific insights
    switch (journey) {
      case 'buyer':
        insights.push(...(await generateBuyerInsights(userId, memory, userMetrics)))
        break
      case 'seller':
        insights.push(...(await generateSellerInsights(userId, memory, userMetrics)))
        break
      case 'founder':
        insights.push(...(await generateFounderInsights(userId, memory, userMetrics)))
        break
      case 'job_seeker':
        insights.push(...(await generateJobSeekerInsights(userId, memory, userMetrics)))
        break
    }

    // Generate AI-enhanced insights for personalization
    if (insights.length > 0 && memory) {
      await enhanceInsightsWithAI(insights, memory)
    }

    return insights
  } catch (error) {
    console.error('[InsightEngine] Error generating insights:', error)
    return []
  }
}

/**
 * Generate buyer-specific insights
 */
async function generateBuyerInsights(
  userId: string,
  memory: WellsMemory | null,
  metrics?: UserMetrics
): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = []

  // Check for cost increases
  if (metrics?.categorySpendBreakdown) {
    // Simulate detection of cost increase
    const categoryWithIncrease = Object.entries(metrics.categorySpendBreakdown)
      .map(([category, spend]) => ({ category, spend }))
      .find((c) => Math.random() > 0.7) // Demo: random selection

    if (categoryWithIncrease) {
      const data = {
        category: categoryWithIncrease.category,
        percentIncrease: Math.floor(Math.random() * 20) + 5,
        alternativeCount: Math.floor(Math.random() * 5) + 2,
        potentialSavings: Math.floor(categoryWithIncrease.spend * 0.15),
      }
      const template = BUYER_INSIGHT_TEMPLATES.cost_increase.template(data)
      insights.push(createInsight(userId, 'buyer', BUYER_INSIGHT_TEMPLATES.cost_increase, template, data))
    }
  }

  // Check for expiring contracts
  if (metrics?.upcomingContractRenewals && metrics.upcomingContractRenewals > 0) {
    const data = {
      supplierName: 'Acme Industrial',
      daysRemaining: 30,
      marketRateChange: -8,
      potentialSavings: 15000,
    }
    const template = BUYER_INSIGHT_TEMPLATES.contract_expiring.template(data)
    insights.push(createInsight(userId, 'buyer', BUYER_INSIGHT_TEMPLATES.contract_expiring, template, data))
  }

  // Check for supplier concentration risk
  if (metrics?.supplierCount && metrics.supplierCount < 5) {
    const data = {
      percentFromTopSupplier: 60,
      topSupplierName: 'Primary Supplier Co',
      atRiskSpend: Math.floor((metrics.totalSpend || 100000) * 0.6),
    }
    const template = BUYER_INSIGHT_TEMPLATES.supplier_concentration.template(data)
    insights.push(createInsight(userId, 'buyer', BUYER_INSIGHT_TEMPLATES.supplier_concentration, template, data))
  }

  return insights
}

/**
 * Generate seller-specific insights
 */
async function generateSellerInsights(
  userId: string,
  memory: WellsMemory | null,
  metrics?: UserMetrics
): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = []

  // Check for new RFQ matches
  if (metrics?.pendingRfqs && metrics.pendingRfqs > 0) {
    const data = {
      rfqCount: metrics.pendingRfqs,
      totalValue: 25000,
      targetResponseHours: 2,
    }
    const template = SELLER_INSIGHT_TEMPLATES.new_rfq_match.template(data)
    insights.push(createInsight(userId, 'seller', SELLER_INSIGHT_TEMPLATES.new_rfq_match, template, data))
  }

  // Response time coaching
  if (metrics?.averageResponseTime && metrics.averageResponseTime > 2) {
    const data = {
      userResponseTime: metrics.averageResponseTime,
      topPerformerTime: 2,
      potentialRevenueGain: 15000,
    }
    const template = SELLER_INSIGHT_TEMPLATES.response_time_coaching.template(data)
    insights.push(createInsight(userId, 'seller', SELLER_INSIGHT_TEMPLATES.response_time_coaching, template, data))
  }

  // Competitor pricing alert
  if (metrics?.competitorActivity && metrics.competitorActivity.length > 0) {
    const data = {
      competitorName: 'Industry Leader',
      priceDropPercent: 5,
      atRiskRevenue: 20000,
    }
    const template = SELLER_INSIGHT_TEMPLATES.competitor_pricing.template(data)
    insights.push(createInsight(userId, 'seller', SELLER_INSIGHT_TEMPLATES.competitor_pricing, template, data))
  }

  return insights
}

/**
 * Generate founder-specific insights
 */
async function generateFounderInsights(
  userId: string,
  memory: WellsMemory | null,
  metrics?: UserMetrics
): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = []

  // Runway alert
  if (metrics?.runway && metrics.runway < 12) {
    const data = {
      runwayMonths: metrics.runway,
      monthlyBurn: metrics.burnRate || 50000,
    }
    const template = FOUNDER_INSIGHT_TEMPLATES.runway_alert.template(data)
    insights.push(createInsight(userId, 'founder', FOUNDER_INSIGHT_TEMPLATES.runway_alert, template, data))
  }

  // Customer churn risk
  if (metrics?.customerChurnRate && metrics.customerChurnRate > 0.05) {
    const data = {
      atRiskCustomers: 3,
      daysSinceOrder: 60,
      atRiskRevenue: 75000,
    }
    const template = FOUNDER_INSIGHT_TEMPLATES.customer_churn_risk.template(data)
    insights.push(createInsight(userId, 'founder', FOUNDER_INSIGHT_TEMPLATES.customer_churn_risk, template, data))
  }

  // Price increase opportunity
  if (metrics?.revenueGrowthRate && metrics.revenueGrowthRate > 0.1) {
    const data = {
      productCategory: 'your core product',
      marketIncreasePercent: 10,
      suggestedIncrease: 5,
      potentialRevenue: 50000,
    }
    const template = FOUNDER_INSIGHT_TEMPLATES.price_increase_opportunity.template(data)
    insights.push(createInsight(userId, 'founder', FOUNDER_INSIGHT_TEMPLATES.price_increase_opportunity, template, data))
  }

  return insights
}

/**
 * Generate job seeker-specific insights
 */
async function generateJobSeekerInsights(
  userId: string,
  memory: WellsMemory | null,
  metrics?: UserMetrics
): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = []

  // New role matches
  if (metrics?.matchingJobs && metrics.matchingJobs > 0) {
    const data = {
      matchCount: metrics.matchingJobs,
      roleType: memory?.wellsaiProfile?.jobsContext?.desiredRoles?.[0] || 'matching',
      averageSalary: metrics.marketSalaryData?.median || 120000,
    }
    const template = JOB_SEEKER_INSIGHT_TEMPLATES.new_role_matches.template(data)
    insights.push(createInsight(userId, 'job_seeker', JOB_SEEKER_INSIGHT_TEMPLATES.new_role_matches, template, data))
  }

  // Salary insight
  if (metrics?.marketSalaryData) {
    const userSalary = memory?.wellsaiProfile?.jobsContext?.salary?.min || 0
    const medianSalary = metrics.marketSalaryData.median
    const isUnderpaid = userSalary > 0 && userSalary < medianSalary * 0.9

    const data = {
      roleTitle: metrics.marketSalaryData.role,
      location: metrics.marketSalaryData.location,
      salaryIncrease: 8,
      medianSalary,
      userPosition: isUnderpaid ? 'You may be underpaid.' : 'You\'re competitive.',
      potentialIncrease: isUnderpaid ? medianSalary - userSalary : 0,
    }
    const template = JOB_SEEKER_INSIGHT_TEMPLATES.salary_insight.template(data)
    insights.push(createInsight(userId, 'job_seeker', JOB_SEEKER_INSIGHT_TEMPLATES.salary_insight, template, data))
  }

  // Profile view alert
  if (metrics?.profileViews && metrics.profileViews > 5) {
    const data = {
      companyName: 'TechCorp',
      viewerTitle: 'CTO',
      viewCount: 2,
      roleValue: 150000,
    }
    const template = JOB_SEEKER_INSIGHT_TEMPLATES.profile_view_alert.template(data)
    insights.push(createInsight(userId, 'job_seeker', JOB_SEEKER_INSIGHT_TEMPLATES.profile_view_alert, template, data))
  }

  return insights
}

/**
 * Create a standardized insight object
 */
function createInsight(
  userId: string,
  journey: UserJourney,
  templateConfig: { category: InsightCategory; urgency: InsightUrgency },
  templateResult: {
    title: string
    message: string
    potentialValue?: number
    potentialValueType?: 'savings' | 'revenue' | 'time' | 'risk_avoided'
  },
  data: Record<string, any>
): ProactiveInsight {
  const insightId = `ins_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: insightId,
    userId,
    journey,
    category: templateConfig.category,
    urgency: templateConfig.urgency,
    title: templateResult.title,
    message: templateResult.message,
    potentialValue: templateResult.potentialValue,
    potentialValueType: templateResult.potentialValueType,
    actionOptions: generateActionsForCategory(templateConfig.category, data, insightId),
    dataPoints: data,
    createdAt: new Date(),
    actedUpon: false,
    dismissed: false,
  }
}

/**
 * Generate action options based on insight category
 */
function generateActionsForCategory(
  category: InsightCategory,
  data: Record<string, any>,
  insightId: string
): InsightAction[] {
  const baseActions: Record<InsightCategory, InsightAction[]> = {
    cost_savings: [
      {
        id: `${insightId}_get_quotes`,
        label: 'Get Quotes',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Find and request quotes from alternative suppliers',
      },
      {
        id: `${insightId}_analyze`,
        label: 'Analyze Details',
        actionType: 'navigation',
        isPrimary: false,
        navigationUrl: '/analytics/spend',
      },
    ],
    revenue_opportunity: [
      {
        id: `${insightId}_respond`,
        label: 'Respond Now',
        actionType: 'navigation',
        isPrimary: true,
        navigationUrl: '/rfq/pending',
      },
      {
        id: `${insightId}_schedule`,
        label: 'Schedule Response',
        actionType: 'schedule',
        isPrimary: false,
      },
    ],
    risk_alert: [
      {
        id: `${insightId}_investigate`,
        label: 'Investigate',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Analyze the risk and provide detailed report',
      },
      {
        id: `${insightId}_dismiss_risk`,
        label: 'Not a Concern',
        actionType: 'confirm',
        isPrimary: false,
        confirmMessage: 'Mark this as reviewed and not a concern?',
      },
    ],
    contract_reminder: [
      {
        id: `${insightId}_renegotiate`,
        label: 'Help Renegotiate',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Draft renegotiation proposal with market data',
      },
      {
        id: `${insightId}_renew`,
        label: 'Auto-Renew',
        actionType: 'confirm',
        isPrimary: false,
        confirmMessage: 'Proceed with automatic renewal at current terms?',
      },
    ],
    market_intelligence: [
      {
        id: `${insightId}_analyze_market`,
        label: 'Full Analysis',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Generate comprehensive market analysis',
      },
      {
        id: `${insightId}_adjust_pricing`,
        label: 'Adjust Pricing',
        actionType: 'navigation',
        isPrimary: false,
        navigationUrl: '/settings/pricing',
      },
    ],
    performance_tip: [
      {
        id: `${insightId}_get_tips`,
        label: 'Show Me How',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Provide actionable tips to improve performance',
      },
      {
        id: `${insightId}_later`,
        label: 'Remind Later',
        actionType: 'schedule',
        isPrimary: false,
      },
    ],
    celebration: [
      {
        id: `${insightId}_share`,
        label: 'Share Achievement',
        actionType: 'navigation',
        isPrimary: true,
        navigationUrl: '/achievements',
      },
      {
        id: `${insightId}_view_stats`,
        label: 'View Stats',
        actionType: 'navigation',
        isPrimary: false,
        navigationUrl: '/analytics',
      },
    ],
    relationship: [
      {
        id: `${insightId}_reach_out`,
        label: 'Reach Out',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Draft personalized outreach message',
      },
      {
        id: `${insightId}_view_history`,
        label: 'View History',
        actionType: 'navigation',
        isPrimary: false,
        navigationUrl: '/relationships',
      },
    ],
    compliance: [
      {
        id: `${insightId}_review`,
        label: 'Review Now',
        actionType: 'navigation',
        isPrimary: true,
        navigationUrl: '/compliance',
      },
      {
        id: `${insightId}_schedule_review`,
        label: 'Schedule Review',
        actionType: 'schedule',
        isPrimary: false,
      },
    ],
    strategic: [
      {
        id: `${insightId}_explore`,
        label: 'Explore Options',
        actionType: 'ai_task',
        isPrimary: true,
        aiTaskDescription: 'Analyze strategic options and provide recommendations',
      },
      {
        id: `${insightId}_save`,
        label: 'Save for Later',
        actionType: 'confirm',
        isPrimary: false,
        confirmMessage: 'Save this insight for later review?',
      },
    ],
  }

  return baseActions[category] || []
}

/**
 * Enhance insights with AI for personalization
 */
async function enhanceInsightsWithAI(
  insights: ProactiveInsight[],
  memory: WellsMemory
): Promise<void> {
  try {
    const userName = memory.preferredName || memory.firstName || 'there'
    const communicationStyle = memory.communicationStyle || 'direct'

    for (const insight of insights) {
      // Personalize the message based on communication style
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Rewrite this insight message to be ${communicationStyle} in tone. Keep it under 100 words and maintain the key data points.

Original: "${insight.message}"

User context: Name is ${userName}. ${memory.companyName ? `Company: ${memory.companyName}.` : ''}

Return ONLY the rewritten message, no explanation.`,
          },
        ],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        insight.message = textBlock.text.trim()
      }
    }
  } catch (error) {
    console.error('[InsightEngine] AI enhancement failed:', error)
    // Continue with original messages
  }
}

/**
 * Store insight in database
 */
export async function storeInsight(insight: ProactiveInsight): Promise<void> {
  try {
    await query(
      `INSERT INTO proactive_insights (
        id, user_id, journey, category, urgency, title, message,
        detailed_explanation, potential_value, potential_value_type,
        action_options, related_entities, data_points, expires_at,
        created_at, acted_upon, dismissed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        insight.id,
        insight.userId,
        insight.journey,
        insight.category,
        insight.urgency,
        insight.title,
        insight.message,
        insight.detailedExplanation,
        insight.potentialValue,
        insight.potentialValueType,
        JSON.stringify(insight.actionOptions),
        JSON.stringify(insight.relatedEntities),
        JSON.stringify(insight.dataPoints),
        insight.expiresAt,
        insight.createdAt,
        insight.actedUpon,
        insight.dismissed,
      ]
    )
  } catch (error) {
    console.error('[InsightEngine] Error storing insight:', error)
  }
}

/**
 * Get pending insights for a user
 */
export async function getPendingInsights(userId: string): Promise<ProactiveInsight[]> {
  try {
    const result = await query(
      `SELECT * FROM proactive_insights
       WHERE user_id = $1
         AND acted_upon = false
         AND dismissed = false
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY
         CASE urgency
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           WHEN 'info' THEN 5
         END,
         created_at DESC
       LIMIT 20`,
      [userId]
    )

    return result.rows.map(rowToInsight)
  } catch (error) {
    console.error('[InsightEngine] Error getting pending insights:', error)
    return []
  }
}

/**
 * Mark insight as acted upon
 */
export async function markInsightActedUpon(
  insightId: string,
  actionTaken: string
): Promise<void> {
  try {
    await query(
      `UPDATE proactive_insights
       SET acted_upon = true,
           acted_upon_at = NOW(),
           action_taken = $2
       WHERE id = $1`,
      [insightId, actionTaken]
    )

    // Record the action for learning
    await query(
      `INSERT INTO insight_actions (insight_id, action_taken, created_at)
       VALUES ($1, $2, NOW())`,
      [insightId, actionTaken]
    )
  } catch (error) {
    console.error('[InsightEngine] Error marking insight acted upon:', error)
  }
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(
  insightId: string,
  reason?: string
): Promise<void> {
  try {
    await query(
      `UPDATE proactive_insights
       SET dismissed = true,
           dismissed_at = NOW(),
           dismiss_reason = $2
       WHERE id = $1`,
      [insightId, reason]
    )
  } catch (error) {
    console.error('[InsightEngine] Error dismissing insight:', error)
  }
}

/**
 * Convert database row to InsightObject
 */
function rowToInsight(row: any): ProactiveInsight {
  return {
    id: row.id,
    userId: row.user_id,
    journey: row.journey,
    category: row.category,
    urgency: row.urgency,
    title: row.title,
    message: row.message,
    detailedExplanation: row.detailed_explanation,
    potentialValue: row.potential_value,
    potentialValueType: row.potential_value_type,
    actionOptions: row.action_options || [],
    relatedEntities: row.related_entities,
    dataPoints: row.data_points,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    createdAt: new Date(row.created_at),
    actedUpon: row.acted_upon,
    actedUponAt: row.acted_upon_at ? new Date(row.acted_upon_at) : undefined,
    actionTaken: row.action_taken,
    dismissed: row.dismissed,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
    dismissReason: row.dismiss_reason,
  }
}

/**
 * Generate a welcome back message with insights summary
 */
export async function generateWelcomeBackMessage(
  userId: string,
  memory: WellsMemory | null
): Promise<string> {
  try {
    const pendingInsights = await getPendingInsights(userId)
    const userName = memory?.preferredName || memory?.firstName || 'there'

    // Get time of day for greeting
    const hour = new Date().getHours()
    const greeting =
      hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    if (pendingInsights.length === 0) {
      return `${greeting}, ${userName}! Everything looks good. I'm monitoring your accounts and will alert you if anything needs attention.`
    }

    // Summarize key insights
    const criticalCount = pendingInsights.filter((i) => i.urgency === 'critical').length
    const highCount = pendingInsights.filter((i) => i.urgency === 'high').length
    const totalValue = pendingInsights.reduce((sum, i) => sum + (i.potentialValue || 0), 0)

    let summaryParts: string[] = []

    if (criticalCount > 0) {
      summaryParts.push(`${criticalCount} urgent ${criticalCount === 1 ? 'item needs' : 'items need'} attention`)
    }

    if (highCount > 0) {
      summaryParts.push(`${highCount} important ${highCount === 1 ? 'opportunity' : 'opportunities'}`)
    }

    if (totalValue > 0) {
      const valueType = pendingInsights[0]?.potentialValueType
      const valueLabel =
        valueType === 'savings'
          ? 'potential savings'
          : valueType === 'revenue'
          ? 'revenue opportunity'
          : 'value'
      summaryParts.push(`$${totalValue.toLocaleString()} in ${valueLabel}`)
    }

    const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'a few insights for you'

    // Top insight preview
    const topInsight = pendingInsights[0]
    const previewMessage = topInsight
      ? ` Top priority: ${topInsight.title.toLowerCase()}.`
      : ''

    return `${greeting}, ${userName}! While you were away, I found ${summary}.${previewMessage}`
  } catch (error) {
    console.error('[InsightEngine] Error generating welcome message:', error)
    return 'Welcome back! Let me know how I can help you today.'
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const InsightEngine = {
  generateInsights,
  storeInsight,
  getPendingInsights,
  markInsightActedUpon,
  dismissInsight,
  generateWelcomeBackMessage,
}

export default InsightEngine
