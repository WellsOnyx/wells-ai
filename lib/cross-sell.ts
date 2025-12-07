// @ts-nocheck
/**
 * CROSS-SELL ENGINE
 *
 * Bidirectional promotion between Wells AI and Grain & Vault:
 *
 * WELLS AI → GRAIN & VAULT:
 * - Large PO volumes → Treasury optimization
 * - International suppliers → FX services
 * - Payment delays → Credit line offers
 * - High spend → GRAIN rewards
 *
 * GRAIN & VAULT → WELLS AI:
 * - High FX volume → Supplier network
 * - Multiple suppliers → Procurement consolidation
 * - Manual payments → ERP integration
 * - B2B transactions → Spend capture
 */

import { sql } from '@vercel/postgres'

export interface CrossSellOpportunity {
  type: 'wells_to_grain' | 'grain_to_wells'
  trigger: string
  segment: string
  score: number // 0-100 priority score
  pitch: {
    headline: string
    body: string
    cta: string
    ctaUrl: string
  }
  context: Record<string, any>
}

// ============================================================================
// WELLS AI → GRAIN & VAULT TRIGGERS
// ============================================================================

export async function checkWellsToGrainOpportunities(
  customerId: string,
  event: 'order' | 'invoice' | 'spend_threshold'
): Promise<CrossSellOpportunity[]> {
  const opportunities: CrossSellOpportunity[] = []

  // Get customer data
  const customerResult = await sql`
    SELECT
      ec.*,
      COUNT(DISTINCT io.id) as total_orders,
      SUM(io.customer_total) as total_spend,
      SUM(io.gross_margin) as total_margin,
      AVG(io.margin_pct) as avg_margin,
      COUNT(DISTINCT sn.id) as supplier_count
    FROM erp_customers ec
    LEFT JOIN intercept_orders io ON ec.id = io.customer_id
    LEFT JOIN intercept_order_lines iol ON io.id = iol.order_id
    LEFT JOIN supplier_network sn ON iol.supplier_id = sn.id
    WHERE ec.id = ${customerId}
    GROUP BY ec.id
  `

  if (customerResult.rows.length === 0) return opportunities

  const customer = customerResult.rows[0]
  const totalSpend = parseFloat(customer.total_spend || 0)
  const totalOrders = parseInt(customer.total_orders || 0)
  const supplierCount = parseInt(customer.supplier_count || 0)

  // TRIGGER: Treasury Optimization
  // High spend = opportunity for early payment discounts via GRAIN
  if (totalSpend > 100000) {
    opportunities.push({
      type: 'wells_to_grain',
      trigger: 'high_spend_volume',
      segment: 'treasury',
      score: Math.min(90, 50 + (totalSpend / 10000)),
      pitch: {
        headline: 'Optimize Your Treasury with GRAIN',
        body: `You're spending $${(totalSpend / 1000).toFixed(0)}K+ through Wells AI. ` +
              `With Grain & Vault, you can earn GRAIN rewards on early payments to suppliers - ` +
              `effectively paying yourself to pay faster. Your GRAIN appreciates as our hard asset portfolio grows.`,
        cta: 'Explore Treasury Optimization',
        ctaUrl: 'https://grainandvault.com/treasury?ref=wellsai'
      },
      context: { totalSpend, totalOrders }
    })
  }

  // TRIGGER: Credit Line
  // Multiple orders = opportunity for 1:1 credit line backed by GRAIN
  if (totalOrders > 10) {
    opportunities.push({
      type: 'wells_to_grain',
      trigger: 'order_frequency',
      segment: 'credit',
      score: Math.min(85, 40 + (totalOrders * 2)),
      pitch: {
        headline: 'Unlock 1:1 Credit Lines',
        body: `With ${totalOrders} orders through Wells AI, you qualify for our exclusive credit program. ` +
              `Deposit USD, receive matching credit lines, and keep your GRAIN earning appreciation. ` +
              `Extend payment terms without impacting suppliers.`,
        cta: 'Get Your Credit Line',
        ctaUrl: 'https://grainandvault.com/credit?ref=wellsai'
      },
      context: { totalOrders }
    })
  }

  // TRIGGER: International Suppliers (if we detect international)
  if (supplierCount > 3) {
    opportunities.push({
      type: 'wells_to_grain',
      trigger: 'supplier_diversity',
      segment: 'fx',
      score: 60 + (supplierCount * 3),
      pitch: {
        headline: 'Better FX for International Suppliers',
        body: `Managing ${supplierCount} suppliers? International payments through Grain & Vault ` +
              `save you 50bp+ vs traditional banks. Plus, earn GRAIN on every conversion.`,
        cta: 'See FX Rates',
        ctaUrl: 'https://grainandvault.com/fx?ref=wellsai'
      },
      context: { supplierCount }
    })
  }

  // TRIGGER: GRAIN Rewards
  // Everyone gets pitched on GRAIN rewards
  opportunities.push({
    type: 'wells_to_grain',
    trigger: 'rewards_program',
    segment: 'grain_rewards',
    score: 50,
    pitch: {
      headline: 'Earn GRAIN on Every Transaction',
      body: `Turn your procurement spend into appreciating rewards. GRAIN is backed by ` +
            `real hard assets (manufacturing, real estate) and grows exponentially. ` +
            `Your ${totalOrders} orders would have earned ${Math.floor(totalSpend / 100)} GRAIN.`,
      cta: 'Start Earning GRAIN',
      ctaUrl: 'https://grainandvault.com/rewards?ref=wellsai'
    },
    context: { potentialGrain: Math.floor(totalSpend / 100) }
  })

  return opportunities.sort((a, b) => b.score - a.score)
}

// ============================================================================
// GRAIN & VAULT → WELLS AI TRIGGERS
// ============================================================================

export async function checkGrainToWellsOpportunities(
  userId: string
): Promise<CrossSellOpportunity[]> {
  const opportunities: CrossSellOpportunity[] = []

  // Get user's Grain & Vault activity
  const userResult = await sql`
    SELECT
      ub.user_id,
      ub.usd_total,
      ub.grain_quantity,
      (SELECT COUNT(*) FROM gv_transactions WHERE user_id = ${userId} AND type = 'payment') as payment_count,
      (SELECT SUM(from_amount) FROM gv_fx_conversions WHERE user_id = ${userId}) as fx_volume,
      (SELECT COUNT(DISTINCT counterparty_name) FROM gv_transactions WHERE user_id = ${userId}) as counterparty_count
    FROM gv_user_balances ub
    WHERE ub.user_id = ${userId}
  `

  if (userResult.rows.length === 0) return opportunities

  const user = userResult.rows[0]
  const paymentCount = parseInt(user.payment_count || 0)
  const fxVolume = parseFloat(user.fx_volume || 0)
  const counterpartyCount = parseInt(user.counterparty_count || 0)
  const usdBalance = parseFloat(user.usd_total || 0)

  // TRIGGER: Procurement Consolidation
  // Multiple counterparties = fragmented supplier relationships
  if (counterpartyCount > 5) {
    opportunities.push({
      type: 'grain_to_wells',
      trigger: 'fragmented_suppliers',
      segment: 'procurement',
      score: 75 + (counterpartyCount * 2),
      pitch: {
        headline: 'Consolidate Your Supplier Spend',
        body: `You're paying ${counterpartyCount} different suppliers. Wells AI can consolidate ` +
              `your procurement, capture margin on every purchase, and give you 50% of the savings. ` +
              `One vendor in your ERP. 15-minute setup.`,
        cta: 'See How It Works',
        ctaUrl: 'https://wellsonyx.io/procurement?ref=grainvault'
      },
      context: { counterpartyCount }
    })
  }

  // TRIGGER: High Payment Volume
  // Lots of B2B payments = opportunity for ERP integration
  if (paymentCount > 20) {
    opportunities.push({
      type: 'grain_to_wells',
      trigger: 'high_payment_volume',
      segment: 'erp_integration',
      score: 70 + Math.min(20, paymentCount / 2),
      pitch: {
        headline: 'Automate Your Supplier Payments',
        body: `${paymentCount} payments processed manually? Wells AI integrates directly with your ` +
              `SAP, Oracle, or Coupa - POs flow automatically, we capture margin, you share the savings.`,
        cta: 'Connect Your ERP',
        ctaUrl: 'https://wellsonyx.io/erp?ref=grainvault'
      },
      context: { paymentCount }
    })
  }

  // TRIGGER: FX Volume
  // High FX = international suppliers = procurement opportunity
  if (fxVolume > 50000) {
    opportunities.push({
      type: 'grain_to_wells',
      trigger: 'international_spend',
      segment: 'global_procurement',
      score: 80,
      pitch: {
        headline: 'Optimize International Procurement',
        body: `$${(fxVolume / 1000).toFixed(0)}K in international payments? Wells AI can source from ` +
              `our global supplier network at better prices, then you save again on FX through Grain & Vault. ` +
              `Double the savings.`,
        cta: 'Explore Global Sourcing',
        ctaUrl: 'https://wellsonyx.io/global?ref=grainvault'
      },
      context: { fxVolume }
    })
  }

  // TRIGGER: Large Balance
  // Big treasury = opportunity for procurement optimization
  if (usdBalance > 100000) {
    opportunities.push({
      type: 'grain_to_wells',
      trigger: 'treasury_optimization',
      segment: 'strategic_procurement',
      score: 65,
      pitch: {
        headline: 'Put Your Treasury to Work',
        body: `With $${(usdBalance / 1000).toFixed(0)}K in your Grain & Vault treasury, you have ` +
              `buying power. Wells AI can leverage this for better supplier terms, early payment ` +
              `discounts, and strategic procurement.`,
        cta: 'Strategic Procurement',
        ctaUrl: 'https://wellsonyx.io/strategic?ref=grainvault'
      },
      context: { usdBalance }
    })
  }

  return opportunities.sort((a, b) => b.score - a.score)
}

// ============================================================================
// UNIFIED CROSS-SELL API
// ============================================================================

export async function getCrossSellOpportunities(
  sourceProduct: 'wells_ai' | 'grain_vault',
  identifier: string // customerId for Wells AI, userId for Grain & Vault
): Promise<{
  opportunities: CrossSellOpportunity[]
  topPitch: CrossSellOpportunity | null
  summary: {
    totalOpportunities: number
    highPriority: number
    segments: string[]
  }
}> {
  let opportunities: CrossSellOpportunity[]

  if (sourceProduct === 'wells_ai') {
    opportunities = await checkWellsToGrainOpportunities(identifier, 'spend_threshold')
  } else {
    opportunities = await checkGrainToWellsOpportunities(identifier)
  }

  return {
    opportunities,
    topPitch: opportunities[0] || null,
    summary: {
      totalOpportunities: opportunities.length,
      highPriority: opportunities.filter(o => o.score >= 70).length,
      segments: [...new Set(opportunities.map(o => o.segment))]
    }
  }
}

// ============================================================================
// CROSS-SELL EVENT TRACKING
// ============================================================================

export async function trackCrossSellEvent(
  opportunity: CrossSellOpportunity,
  action: 'shown' | 'clicked' | 'converted',
  userId?: string
) {
  // In production: Track to analytics
  console.log(`📊 CROSS-SELL ${action.toUpperCase()}:`, {
    type: opportunity.type,
    segment: opportunity.segment,
    score: opportunity.score,
    userId
  })

  // Could insert into a cross_sell_events table for analysis
}

// ============================================================================
// THE FLYWHEEL
// ============================================================================
/*
  THE ECOSYSTEM FLYWHEEL:

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   WELLS AI                           GRAIN & VAULT          │
  │   ─────────                          ─────────────          │
  │                                                             │
  │   • Procurement spend    ──────►     • Treasury deposits    │
  │   • Supplier payments    ──────►     • GRAIN rewards        │
  │   • Margin capture       ──────►     • Credit lines         │
  │                                                             │
  │   ◄──────    Platform fees    ──────►                       │
  │                    │                                        │
  │                    ▼                                        │
  │            ┌───────────────┐                                │
  │            │ HARD ASSETS   │                                │
  │            │ Manufacturing │                                │
  │            │ Real Estate   │                                │
  │            └───────────────┘                                │
  │                    │                                        │
  │                    ▼                                        │
  │            GRAIN APPRECIATION                               │
  │                    │                                        │
  │                    ▼                                        │
  │            MORE USERS ────► MORE VOLUME ────► MORE MARGIN   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  Every Wells AI customer is a Grain & Vault treasury prospect.
  Every Grain & Vault user is a Wells AI procurement prospect.

  The flywheel spins. Value compounds. GRAIN appreciates.
*/
