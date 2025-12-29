// @ts-nocheck
/**
 * Wells AI Insight Engine Service
 *
 * "The heart of the discerning acquires knowledge,
 *  for the ears of the wise seek it out." - Proverbs 18:15
 *
 * This class provides the structured InsightEngine API for generating
 * proactive insights that make Wells feel alive and working for users.
 */

import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { getWellsMemory, WellsMemory } from '@/lib/wells-memory'

// ============================================================================
// TYPES
// ============================================================================

export interface Insight {
  id: string
  userId: string
  type: 'savings' | 'anomaly' | 'vendor' | 'market' | 'risk' | 'opportunity' | 'job_match'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  summary: string
  details: string
  actionable: boolean
  suggestedAction?: string
  potentialValue?: number // estimated $ impact
  expiresAt?: string
  createdAt: string
  readAt?: string
  actedOn?: boolean
}

export interface SavingsInsight extends Insight {
  type: 'savings'
  savingsAmount: number
  savingsPercent: number
  category: string
  alternativeVendors?: string[]
}

export interface AnomalyInsight extends Insight {
  type: 'anomaly'
  anomalyType: 'price_spike' | 'volume_change' | 'new_vendor' | 'unusual_timing' | 'duplicate'
  expectedValue?: number
  actualValue: number
  deviationPercent: number
}

export interface VendorInsight extends Insight {
  type: 'vendor'
  currentVendor: string
  alternativeVendors: {
    name: string
    estimatedSavings: number
    leadTime?: number
    rating?: number
  }[]
}

export interface MarketInsight extends Insight {
  type: 'market'
  commodity: string
  priceChange: number
  changePercent: number
  trend: 'rising' | 'falling' | 'stable'
  recommendation: string
}

export interface RiskInsight extends Insight {
  type: 'risk'
  riskType: 'concentration' | 'price' | 'supply' | 'compliance' | 'payment' | 'contract'
  severity: 'low' | 'medium' | 'high' | 'critical'
  mitigationSteps: string[]
}

export interface JobMatch {
  id: string
  workerId: string
  jobId: string
  jobTitle: string
  company: string
  matchScore: number
  matchReasons: string[]
  salaryRange?: {
    min: number
    max: number
  }
  location: string
  remote: boolean
  postedAt: string
  expiresAt?: string
}

export interface ApplicationUpdate {
  id: string
  applicationId: string
  workerId: string
  jobTitle: string
  company: string
  previousStatus: string
  newStatus: string
  statusChangedAt: string
  nextSteps?: string
  interviewDate?: string
}

// ============================================================================
// INSIGHT ENGINE CLASS
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export class InsightEngineService {
  private userId: string
  private memory: WellsMemory | null = null

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Initialize the engine with user context
   */
  async initialize(): Promise<void> {
    this.memory = await getWellsMemory(this.userId)
  }

  /**
   * Generate all proactive insights for the user
   */
  async generateInsights(): Promise<Insight[]> {
    await this.initialize()

    const insights: Insight[] = []
    const journey = this.memory?.wellsaiProfile?.primaryJourney || 'buyer'

    try {
      // Generate insights based on journey
      if (journey === 'buyer' || journey === 'founder') {
        const savingsInsights = await this.findSavingsOpportunities()
        const anomalyInsights = await this.detectAnomalies()
        const vendorInsights = await this.suggestVendorAlternatives()
        const marketInsights = await this.trackMarketPrices()
        const riskInsights = await this.identifyRisks()

        insights.push(...savingsInsights, ...anomalyInsights, ...vendorInsights, ...marketInsights, ...riskInsights)
      }

      if (journey === 'job_seeker') {
        const jobMatches = await this.matchJobOpportunities()
        const applicationUpdates = await this.trackApplicationStatus()

        // Convert job matches to insights
        for (const match of jobMatches) {
          insights.push({
            id: `ins_job_${match.id}`,
            userId: this.userId,
            type: 'job_match',
            priority: match.matchScore >= 90 ? 'high' : match.matchScore >= 70 ? 'medium' : 'low',
            title: `New job match: ${match.jobTitle} at ${match.company}`,
            summary: `${match.matchScore}% match - ${match.matchReasons.slice(0, 2).join(', ')}`,
            details: `This role matches your profile because: ${match.matchReasons.join('. ')}. ${match.salaryRange ? `Salary range: $${match.salaryRange.min.toLocaleString()} - $${match.salaryRange.max.toLocaleString()}.` : ''} Location: ${match.location}${match.remote ? ' (Remote)' : ''}.`,
            actionable: true,
            suggestedAction: 'Apply now - this role is a strong match for your skills',
            potentialValue: match.salaryRange?.max,
            createdAt: new Date().toISOString(),
          })
        }

        // Convert application updates to insights
        for (const update of applicationUpdates) {
          insights.push({
            id: `ins_app_${update.id}`,
            userId: this.userId,
            type: 'opportunity',
            priority: update.newStatus === 'interview_scheduled' ? 'urgent' : 'medium',
            title: `Application update: ${update.jobTitle}`,
            summary: `Status changed to: ${update.newStatus.replace(/_/g, ' ')}`,
            details: `Your application for ${update.jobTitle} at ${update.company} has moved from "${update.previousStatus.replace(/_/g, ' ')}" to "${update.newStatus.replace(/_/g, ' ')}".${update.nextSteps ? ` Next steps: ${update.nextSteps}` : ''}${update.interviewDate ? ` Interview scheduled: ${update.interviewDate}` : ''}`,
            actionable: !!update.nextSteps,
            suggestedAction: update.nextSteps,
            createdAt: update.statusChangedAt,
          })
        }
      }

      // Deduplicate and sort by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
      const uniqueInsights = this.deduplicateInsights(insights)
      uniqueInsights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      return uniqueInsights.slice(0, 15) // Return top 15 insights

    } catch (error) {
      console.error('[InsightEngine] Error generating insights:', error)
      return []
    }
  }

  /**
   * Find savings opportunities - price drops, volume discounts, contract renewals
   */
  async findSavingsOpportunities(): Promise<SavingsInsight[]> {
    const insights: SavingsInsight[] = []

    try {
      // Find categories where spending increased significantly
      const spendingResult = await query(
        `WITH current_period AS (
          SELECT category, SUM(amount) as total, AVG(unit_price) as avg_price
          FROM orders
          WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY category
        ),
        previous_period AS (
          SELECT category, SUM(amount) as total, AVG(unit_price) as avg_price
          FROM orders
          WHERE buyer_id = $1 AND created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
          GROUP BY category
        )
        SELECT
          c.category,
          c.total as current_total,
          p.total as previous_total,
          c.avg_price as current_price,
          p.avg_price as previous_price,
          ROUND(((c.total - p.total) / NULLIF(p.total, 0) * 100)::numeric, 1) as spend_change_pct,
          ROUND(((c.avg_price - p.avg_price) / NULLIF(p.avg_price, 0) * 100)::numeric, 1) as price_change_pct
        FROM current_period c
        JOIN previous_period p ON c.category = p.category
        WHERE c.avg_price > p.avg_price * 1.05
        ORDER BY (c.total - p.total) DESC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of spendingResult.rows) {
        const potentialSavings = Math.floor(parseFloat(row.current_total) * 0.12) // Estimate 12% potential savings
        const insightId = this.generateId('sav')

        // Find alternative vendors
        const alternativesResult = await query(
          `SELECT company_name FROM suppliers
           WHERE $1 = ANY(categories) AND verified = true
           ORDER BY rating DESC
           LIMIT 3`,
          [row.category]
        )

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'savings',
          priority: parseFloat(row.price_change_pct) > 15 ? 'high' : 'medium',
          title: `${row.category} prices up ${row.price_change_pct}%`,
          summary: `Found potential savings of $${potentialSavings.toLocaleString()} by exploring alternatives`,
          details: `Your ${row.category} spending increased from $${parseFloat(row.previous_total).toLocaleString()} to $${parseFloat(row.current_total).toLocaleString()} (${row.spend_change_pct}% increase). Average unit price rose from $${parseFloat(row.previous_price).toFixed(2)} to $${parseFloat(row.current_price).toFixed(2)}. I found ${alternativesResult.rows.length} alternative vendors that could offer better pricing.`,
          actionable: true,
          suggestedAction: 'Get quotes from alternative vendors',
          potentialValue: potentialSavings,
          createdAt: new Date().toISOString(),
          savingsAmount: potentialSavings,
          savingsPercent: 12,
          category: row.category,
          alternativeVendors: alternativesResult.rows.map((r: any) => r.company_name),
        })
      }

      // Find volume discount opportunities
      const volumeResult = await query(
        `SELECT
          category,
          supplier_id,
          s.company_name as supplier_name,
          SUM(quantity) as total_quantity,
          AVG(unit_price) as avg_unit_price
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '90 days'
        GROUP BY category, supplier_id, s.company_name
        HAVING SUM(quantity) > 100
        ORDER BY SUM(quantity) DESC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of volumeResult.rows) {
        const volumeDiscount = Math.floor(parseFloat(row.avg_unit_price) * parseInt(row.total_quantity) * 0.08)
        const insightId = this.generateId('vol')

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'savings',
          priority: 'medium',
          title: `Volume discount opportunity with ${row.supplier_name || 'supplier'}`,
          summary: `Negotiate bulk pricing for ${row.category} - potential $${volumeDiscount.toLocaleString()} savings`,
          details: `You ordered ${parseInt(row.total_quantity).toLocaleString()} units of ${row.category} over the past 90 days at $${parseFloat(row.avg_unit_price).toFixed(2)}/unit. Based on your volume, you may qualify for a volume discount of 5-10%.`,
          actionable: true,
          suggestedAction: `Contact ${row.supplier_name || 'supplier'} about volume pricing`,
          potentialValue: volumeDiscount,
          createdAt: new Date().toISOString(),
          savingsAmount: volumeDiscount,
          savingsPercent: 8,
          category: row.category,
        })
      }

    } catch (error) {
      console.error('[InsightEngine] Error finding savings opportunities:', error)
    }

    return insights
  }

  /**
   * Detect anomalies - unusual invoices, price spikes, duplicate orders
   */
  async detectAnomalies(): Promise<AnomalyInsight[]> {
    const insights: AnomalyInsight[] = []

    try {
      // Detect unusually high invoices
      const invoiceResult = await query(
        `WITH user_stats AS (
          SELECT AVG(amount) as avg_amount, STDDEV(amount) as stddev_amount
          FROM invoices
          WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '180 days'
        )
        SELECT i.*, s.company_name as vendor_name, u.avg_amount, u.stddev_amount,
               ROUND(((i.amount - u.avg_amount) / NULLIF(u.stddev_amount, 0))::numeric, 2) as z_score
        FROM invoices i
        CROSS JOIN user_stats u
        LEFT JOIN suppliers s ON i.vendor_id = s.id
        WHERE i.buyer_id = $1
          AND i.status = 'pending'
          AND i.amount > u.avg_amount + (2 * COALESCE(u.stddev_amount, u.avg_amount * 0.5))
        ORDER BY i.amount DESC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of invoiceResult.rows) {
        const insightId = this.generateId('ano')
        const deviation = Math.round((parseFloat(row.amount) - parseFloat(row.avg_amount)) / parseFloat(row.avg_amount) * 100)

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'anomaly',
          priority: parseFloat(row.z_score) > 3 ? 'urgent' : 'high',
          title: `Unusual invoice: $${parseFloat(row.amount).toLocaleString()}`,
          summary: `${deviation}% higher than your average - review recommended`,
          details: `Invoice from ${row.vendor_name || 'unknown vendor'} for $${parseFloat(row.amount).toLocaleString()} is significantly above your average invoice of $${parseFloat(row.avg_amount).toLocaleString()}. This represents a ${deviation}% deviation. Consider verifying the details before approval.`,
          actionable: true,
          suggestedAction: 'Review and verify this invoice',
          potentialValue: parseFloat(row.amount),
          createdAt: new Date().toISOString(),
          anomalyType: 'price_spike',
          expectedValue: parseFloat(row.avg_amount),
          actualValue: parseFloat(row.amount),
          deviationPercent: deviation,
        })
      }

      // Detect potential duplicate orders
      const duplicateResult = await query(
        `SELECT
          category,
          supplier_id,
          s.company_name as supplier_name,
          quantity,
          unit_price,
          COUNT(*) as order_count,
          ARRAY_AGG(id) as order_ids
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        WHERE o.buyer_id = $1
          AND o.created_at > NOW() - INTERVAL '7 days'
        GROUP BY category, supplier_id, s.company_name, quantity, unit_price
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of duplicateResult.rows) {
        const insightId = this.generateId('dup')
        const totalAmount = parseFloat(row.unit_price) * parseInt(row.quantity) * parseInt(row.order_count)

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'anomaly',
          priority: 'medium',
          title: `Potential duplicate orders detected`,
          summary: `${row.order_count} identical orders for ${row.category} in the past 7 days`,
          details: `Found ${row.order_count} orders with identical specifications: ${parseInt(row.quantity).toLocaleString()} units of ${row.category} at $${parseFloat(row.unit_price).toFixed(2)}/unit from ${row.supplier_name || 'same supplier'}. Total value: $${totalAmount.toLocaleString()}. This may indicate duplicate orders.`,
          actionable: true,
          suggestedAction: 'Review and cancel any duplicates',
          potentialValue: totalAmount / parseInt(row.order_count), // Value of one duplicate
          createdAt: new Date().toISOString(),
          anomalyType: 'duplicate',
          actualValue: parseInt(row.order_count),
          deviationPercent: (parseInt(row.order_count) - 1) * 100,
        })
      }

    } catch (error) {
      console.error('[InsightEngine] Error detecting anomalies:', error)
    }

    return insights
  }

  /**
   * Suggest vendor alternatives - better pricing, ratings, lead times
   */
  async suggestVendorAlternatives(): Promise<VendorInsight[]> {
    const insights: VendorInsight[] = []

    try {
      // Find categories where current vendors may not be optimal
      const vendorResult = await query(
        `WITH current_vendors AS (
          SELECT
            o.category,
            o.supplier_id,
            s.company_name as supplier_name,
            AVG(o.unit_price) as avg_price,
            SUM(o.amount) as total_spend
          FROM orders o
          LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.buyer_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
          GROUP BY o.category, o.supplier_id, s.company_name
        ),
        market_prices AS (
          SELECT
            category,
            AVG(base_unit_price) as market_avg_price,
            MIN(base_unit_price) as market_min_price
          FROM supplier_catalog
          WHERE active = true
          GROUP BY category
        )
        SELECT
          cv.*,
          mp.market_avg_price,
          mp.market_min_price,
          ROUND(((cv.avg_price - mp.market_avg_price) / NULLIF(mp.market_avg_price, 0) * 100)::numeric, 1) as premium_pct
        FROM current_vendors cv
        JOIN market_prices mp ON cv.category = mp.category
        WHERE cv.avg_price > mp.market_avg_price * 1.1
        ORDER BY (cv.avg_price - mp.market_avg_price) * cv.total_spend DESC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of vendorResult.rows) {
        const insightId = this.generateId('ven')
        const potentialSavings = Math.floor((parseFloat(row.avg_price) - parseFloat(row.market_avg_price)) / parseFloat(row.avg_price) * parseFloat(row.total_spend))

        // Find alternative vendors
        const alternativesResult = await query(
          `SELECT
            s.company_name,
            sc.base_unit_price,
            sc.standard_lead_time_days,
            s.rating
          FROM supplier_catalog sc
          JOIN suppliers s ON sc.supplier_id = s.id
          WHERE sc.product_category = $1
            AND sc.active = true
            AND sc.base_unit_price < $2
          ORDER BY sc.base_unit_price ASC
          LIMIT 3`,
          [row.category, row.avg_price]
        )

        if (alternativesResult.rows.length > 0) {
          insights.push({
            id: insightId,
            userId: this.userId,
            type: 'vendor',
            priority: parseFloat(row.premium_pct) > 20 ? 'high' : 'medium',
            title: `Better pricing available for ${row.category}`,
            summary: `Paying ${row.premium_pct}% above market - found ${alternativesResult.rows.length} alternatives`,
            details: `You're currently paying $${parseFloat(row.avg_price).toFixed(2)}/unit with ${row.supplier_name || 'your current supplier'}, while the market average is $${parseFloat(row.market_avg_price).toFixed(2)}/unit. I found ${alternativesResult.rows.length} verified suppliers that could reduce your costs.`,
            actionable: true,
            suggestedAction: 'Request quotes from alternative vendors',
            potentialValue: potentialSavings,
            createdAt: new Date().toISOString(),
            currentVendor: row.supplier_name || 'Current Supplier',
            alternativeVendors: alternativesResult.rows.map((r: any) => ({
              name: r.company_name,
              estimatedSavings: Math.floor((parseFloat(row.avg_price) - parseFloat(r.base_unit_price)) / parseFloat(row.avg_price) * parseFloat(row.total_spend)),
              leadTime: parseInt(r.standard_lead_time_days),
              rating: parseFloat(r.rating),
            })),
          })
        }
      }

    } catch (error) {
      console.error('[InsightEngine] Error suggesting vendor alternatives:', error)
    }

    return insights
  }

  /**
   * Track market prices - commodity changes, seasonal patterns, trends
   */
  async trackMarketPrices(): Promise<MarketInsight[]> {
    const insights: MarketInsight[] = []

    try {
      // Get categories the user buys regularly
      const categoriesResult = await query(
        `SELECT DISTINCT category
         FROM orders
         WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
        [this.userId]
      )

      for (const catRow of categoriesResult.rows) {
        const category = catRow.category

        // Track price changes over time
        const priceResult = await query(
          `WITH current_prices AS (
            SELECT AVG(base_unit_price) as avg_price
            FROM supplier_catalog
            WHERE product_category = $1 AND active = true
          ),
          historical_prices AS (
            SELECT AVG(unit_price) as avg_price
            FROM orders
            WHERE category = $1 AND created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
          )
          SELECT
            c.avg_price as current_price,
            h.avg_price as historical_price,
            ROUND(((c.avg_price - h.avg_price) / NULLIF(h.avg_price, 0) * 100)::numeric, 1) as change_pct
          FROM current_prices c
          CROSS JOIN historical_prices h
          WHERE c.avg_price IS NOT NULL AND h.avg_price IS NOT NULL`,
          [category]
        )

        if (priceResult.rows.length > 0 && priceResult.rows[0].change_pct) {
          const row = priceResult.rows[0]
          const changePct = parseFloat(row.change_pct)

          if (Math.abs(changePct) >= 5) {
            const insightId = this.generateId('mkt')
            const trend = changePct > 0 ? 'rising' : changePct < 0 ? 'falling' : 'stable'
            const recommendation = trend === 'falling'
              ? 'Consider placing orders now to lock in lower prices'
              : trend === 'rising'
              ? 'Consider negotiating fixed-price contracts or exploring alternatives'
              : 'Prices stable - normal ordering'

            insights.push({
              id: insightId,
              userId: this.userId,
              type: 'market',
              priority: Math.abs(changePct) >= 15 ? 'high' : 'medium',
              title: `${category} prices ${trend}`,
              summary: `Market prices ${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct)}% this month`,
              details: `${category} prices have moved from $${parseFloat(row.historical_price).toFixed(2)} to $${parseFloat(row.current_price).toFixed(2)} per unit (${changePct > 0 ? '+' : ''}${changePct}% change). ${recommendation}`,
              actionable: true,
              suggestedAction: recommendation,
              createdAt: new Date().toISOString(),
              commodity: category,
              priceChange: parseFloat(row.current_price) - parseFloat(row.historical_price),
              changePercent: changePct,
              trend,
              recommendation,
            })
          }
        }
      }

    } catch (error) {
      console.error('[InsightEngine] Error tracking market prices:', error)
    }

    return insights
  }

  /**
   * Identify risks - supplier concentration, payment issues, contract expirations
   */
  async identifyRisks(): Promise<RiskInsight[]> {
    const insights: RiskInsight[] = []

    try {
      // Supplier concentration risk
      const concentrationResult = await query(
        `WITH supplier_totals AS (
          SELECT
            supplier_id,
            s.company_name,
            SUM(amount) as total_amount,
            SUM(SUM(amount)) OVER () as grand_total
          FROM orders o
          LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.buyer_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
          GROUP BY supplier_id, s.company_name
        )
        SELECT *,
               ROUND((total_amount / NULLIF(grand_total, 0) * 100)::numeric, 1) as concentration_pct
        FROM supplier_totals
        WHERE (total_amount / NULLIF(grand_total, 0)) > 0.4
        ORDER BY total_amount DESC
        LIMIT 3`,
        [this.userId]
      )

      for (const row of concentrationResult.rows) {
        const insightId = this.generateId('rsk')
        const concentrationPct = parseFloat(row.concentration_pct)

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'risk',
          priority: concentrationPct >= 60 ? 'high' : 'medium',
          title: `High supplier concentration risk`,
          summary: `${concentrationPct}% of spending with ${row.company_name || 'one supplier'}`,
          details: `${row.company_name || 'Your primary supplier'} accounts for ${concentrationPct}% of your spending ($${parseFloat(row.total_amount).toLocaleString()} of $${parseFloat(row.grand_total).toLocaleString()}). If they experience supply issues, your operations could be significantly impacted.`,
          actionable: true,
          suggestedAction: 'Diversify your supplier base to reduce risk',
          potentialValue: parseFloat(row.total_amount),
          createdAt: new Date().toISOString(),
          riskType: 'concentration',
          severity: concentrationPct >= 60 ? 'high' : 'medium',
          mitigationSteps: [
            'Qualify 2-3 alternative suppliers',
            'Split orders across multiple vendors',
            'Negotiate backup supply agreements',
          ],
        })
      }

      // Overdue payments risk
      const overdueResult = await query(
        `SELECT
          COUNT(*) as overdue_count,
          SUM(amount) as total_overdue,
          MIN(due_date) as oldest_due
        FROM invoices
        WHERE buyer_id = $1
          AND status = 'pending'
          AND due_date < NOW()`,
        [this.userId]
      )

      if (overdueResult.rows.length > 0 && parseInt(overdueResult.rows[0].overdue_count) > 0) {
        const row = overdueResult.rows[0]
        const insightId = this.generateId('rsk')
        const daysOverdue = Math.ceil((Date.now() - new Date(row.oldest_due).getTime()) / (1000 * 60 * 60 * 24))

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'risk',
          priority: daysOverdue > 30 ? 'urgent' : daysOverdue > 14 ? 'high' : 'medium',
          title: `${row.overdue_count} overdue payment${parseInt(row.overdue_count) > 1 ? 's' : ''}`,
          summary: `$${parseFloat(row.total_overdue).toLocaleString()} past due - oldest is ${daysOverdue} days`,
          details: `You have ${row.overdue_count} invoice${parseInt(row.overdue_count) > 1 ? 's' : ''} totaling $${parseFloat(row.total_overdue).toLocaleString()} that are past due. The oldest is ${daysOverdue} days overdue. This may affect supplier relationships and credit terms.`,
          actionable: true,
          suggestedAction: 'Pay overdue invoices or request payment extensions',
          potentialValue: parseFloat(row.total_overdue),
          createdAt: new Date().toISOString(),
          riskType: 'payment',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'medium',
          mitigationSteps: [
            'Review and pay critical invoices immediately',
            'Contact vendors to request payment extensions',
            'Set up automated payment reminders',
          ],
        })
      }

      // Contract expiration risk
      const contractResult = await query(
        `SELECT
          c.*,
          s.company_name as supplier_name,
          EXTRACT(DAY FROM c.end_date - NOW()) as days_remaining
        FROM contracts c
        LEFT JOIN suppliers s ON c.supplier_id = s.id
        WHERE c.buyer_id = $1
          AND c.status = 'active'
          AND c.end_date BETWEEN NOW() AND NOW() + INTERVAL '60 days'
        ORDER BY c.end_date ASC
        LIMIT 5`,
        [this.userId]
      )

      for (const row of contractResult.rows) {
        const insightId = this.generateId('rsk')
        const daysRemaining = Math.round(parseFloat(row.days_remaining))

        insights.push({
          id: insightId,
          userId: this.userId,
          type: 'risk',
          priority: daysRemaining <= 14 ? 'urgent' : daysRemaining <= 30 ? 'high' : 'medium',
          title: `Contract expiring in ${daysRemaining} days`,
          summary: `${row.supplier_name || 'Supplier'} contract expires ${new Date(row.end_date).toLocaleDateString()}`,
          details: `Your contract with ${row.supplier_name || 'this supplier'} (annual value: $${parseFloat(row.annual_value || '0').toLocaleString()}) expires in ${daysRemaining} days. Consider renegotiating or finding alternatives before expiration.`,
          actionable: true,
          suggestedAction: 'Start renegotiation or find alternatives',
          potentialValue: parseFloat(row.annual_value || '0'),
          createdAt: new Date().toISOString(),
          riskType: 'contract',
          severity: daysRemaining <= 14 ? 'critical' : daysRemaining <= 30 ? 'high' : 'medium',
          mitigationSteps: [
            'Review current contract terms',
            'Research market rates for comparison',
            'Start renegotiation discussions',
            'Qualify backup suppliers',
          ],
        })
      }

    } catch (error) {
      console.error('[InsightEngine] Error identifying risks:', error)
    }

    return insights
  }

  /**
   * Match job opportunities for job seekers
   */
  async matchJobOpportunities(): Promise<JobMatch[]> {
    const matches: JobMatch[] = []

    try {
      // Get worker profile
      const workerResult = await query(
        `SELECT * FROM marketplace_workers WHERE user_id = $1`,
        [this.userId]
      )

      if (workerResult.rows.length === 0) {
        return matches
      }

      const worker = workerResult.rows[0]

      // Get worker skills
      const skillsResult = await query(
        `SELECT st.name, st.id
         FROM marketplace_worker_skills ws
         JOIN marketplace_skill_tags st ON ws.skill_id = st.id
         WHERE ws.worker_id = $1`,
        [worker.id]
      )

      const workerSkillIds = skillsResult.rows.map((r: any) => r.id)
      const workerSkillNames = skillsResult.rows.map((r: any) => r.name)

      // Find matching tasks
      const tasksResult = await query(
        `SELECT
          t.*,
          (SELECT array_agg(st.name)
           FROM marketplace_skill_tags st
           WHERE st.id = ANY(t.skills_required)) as required_skill_names
        FROM marketplace_tasks t
        WHERE t.status IN ('posted', 'matched')
          AND t.visibility IN ('public', 'matched_only')
          AND (
            t.skills_required && $1::uuid[]
            OR t.budget_min <= $2
          )
          AND NOT EXISTS (
            SELECT 1 FROM marketplace_applications a
            WHERE a.task_id = t.id AND a.worker_id = $3
          )
        ORDER BY t.created_at DESC
        LIMIT 10`,
        [workerSkillIds, worker.hourly_rate_max, worker.id]
      )

      for (const task of tasksResult.rows) {
        // Calculate match score
        const requiredSkills = task.skills_required || []
        const matchingSkills = requiredSkills.filter((s: string) => workerSkillIds.includes(s))
        const skillMatchPercent = requiredSkills.length > 0
          ? Math.round((matchingSkills.length / requiredSkills.length) * 100)
          : 50

        // Calculate rate match
        const budgetMid = (parseFloat(task.budget_min || 0) + parseFloat(task.budget_max || 0)) / 2
        const workerRateMid = (parseFloat(worker.hourly_rate_min || 0) + parseFloat(worker.hourly_rate_max || 0)) / 2
        const rateMatch = budgetMid >= workerRateMid ? 100 : Math.round((budgetMid / workerRateMid) * 100)

        // Calculate availability match
        const availMatch = worker.availability_status === 'available' ? 100 : worker.availability_status === 'limited' ? 70 : 40

        // Overall match score
        const matchScore = Math.round(skillMatchPercent * 0.5 + rateMatch * 0.3 + availMatch * 0.2)

        // Generate match reasons
        const matchReasons: string[] = []
        if (matchingSkills.length > 0) {
          matchReasons.push(`Skills match: ${task.required_skill_names?.slice(0, 3).join(', ') || 'relevant skills'}`)
        }
        if (rateMatch >= 80) {
          matchReasons.push(`Budget fits your rate range`)
        }
        if (worker.availability_status === 'available') {
          matchReasons.push(`You're currently available`)
        }
        if (task.urgency === 'urgent' || task.urgency === 'critical') {
          matchReasons.push(`Urgent role - quick hiring process`)
        }

        if (matchScore >= 50) {
          matches.push({
            id: task.id,
            workerId: worker.id,
            jobId: task.id,
            jobTitle: task.title,
            company: task.poster_company || 'Company',
            matchScore,
            matchReasons,
            salaryRange: task.budget_min && task.budget_max ? {
              min: parseFloat(task.budget_min),
              max: parseFloat(task.budget_max),
            } : undefined,
            location: task.allowed_countries?.length > 0 ? task.allowed_countries.join(', ') : 'Remote',
            remote: task.visibility === 'public',
            postedAt: task.posted_at || task.created_at,
            expiresAt: task.deadline_at,
          })
        }
      }

      // Sort by match score
      matches.sort((a, b) => b.matchScore - a.matchScore)

    } catch (error) {
      console.error('[InsightEngine] Error matching job opportunities:', error)
    }

    return matches.slice(0, 10)
  }

  /**
   * Track application status updates
   */
  async trackApplicationStatus(): Promise<ApplicationUpdate[]> {
    const updates: ApplicationUpdate[] = []

    try {
      // Get worker profile
      const workerResult = await query(
        `SELECT id FROM marketplace_workers WHERE user_id = $1`,
        [this.userId]
      )

      if (workerResult.rows.length === 0) {
        return updates
      }

      const workerId = workerResult.rows[0].id

      // Get recent application status changes
      const applicationsResult = await query(
        `SELECT
          a.*,
          t.title as job_title,
          t.poster_company as company
        FROM marketplace_applications a
        JOIN marketplace_tasks t ON a.task_id = t.id
        WHERE a.worker_id = $1
          AND a.updated_at > NOW() - INTERVAL '7 days'
          AND a.status != 'pending'
        ORDER BY a.updated_at DESC
        LIMIT 10`,
        [workerId]
      )

      for (const app of applicationsResult.rows) {
        // Determine next steps based on status
        let nextSteps: string | undefined
        let interviewDate: string | undefined

        switch (app.status) {
          case 'shortlisted':
            nextSteps = 'Prepare for potential interview - review your portfolio and the job requirements'
            break
          case 'interviewing':
            nextSteps = 'Check your email for interview details and prepare talking points'
            break
          case 'accepted':
            nextSteps = 'Congratulations! Review the offer and respond promptly'
            break
          case 'rejected':
            nextSteps = 'Keep applying - consider updating your profile based on feedback'
            break
        }

        updates.push({
          id: `upd_${app.id}`,
          applicationId: app.id,
          workerId,
          jobTitle: app.job_title,
          company: app.company || 'Company',
          previousStatus: 'pending', // Simplified - could track actual previous status
          newStatus: app.status,
          statusChangedAt: app.updated_at,
          nextSteps,
          interviewDate: app.status === 'interviewing' ? app.last_message_at : undefined,
        })
      }

    } catch (error) {
      console.error('[InsightEngine] Error tracking application status:', error)
    }

    return updates
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Generate unique insight ID
   */
  private generateId(prefix: string): string {
    return `ins_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Deduplicate insights based on similar content
   */
  private deduplicateInsights(insights: Insight[]): Insight[] {
    const seen = new Set<string>()
    return insights.filter((insight) => {
      const key = `${insight.type}_${insight.title.slice(0, 30)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default InsightEngineService
