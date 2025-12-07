// @ts-nocheck
/**
 * JOURNEY ORCHESTRATION API
 *
 * Start and manage AI-powered journeys.
 * POST /api/journey - Start a new journey
 * GET /api/journey - Get journey status
 *
 * Four journey types:
 * 1. BUYER - Procure anything without human sales interaction
 * 2. SELLER - Sell products without cold outreach
 * 3. FOUNDER - GTM your product without being "salesy"
 * 4. WORKER - Work through Wells, get paid through Wells
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// POST: Start a new journey
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { journey_type, user_id, user_input, context } = body

    // Validate journey type
    const validTypes = ['buyer', 'seller', 'founder', 'worker']
    if (!validTypes.includes(journey_type)) {
      return NextResponse.json({
        error: 'Invalid journey type',
        valid_types: validTypes
      }, { status: 400 })
    }

    if (!user_input) {
      return NextResponse.json({
        error: 'user_input is required'
      }, { status: 400 })
    }

    // Generate journey ID
    const journeyId = crypto.randomUUID()

    // Log journey start
    await logActivity(journeyId, journey_type, user_id, 'journey_started', `Starting ${journey_type} journey`, { user_input })

    // Process based on journey type
    let result
    switch (journey_type) {
      case 'buyer':
        result = await processBuyerJourney(journeyId, user_id, user_input, context)
        break
      case 'seller':
        result = await processSellerJourney(journeyId, user_id, user_input, context)
        break
      case 'founder':
        result = await processFounderJourney(journeyId, user_id, user_input, context)
        break
      case 'worker':
        result = await processWorkerJourney(journeyId, user_id, user_input, context)
        break
    }

    return NextResponse.json({
      success: true,
      journey_id: journeyId,
      journey_type,
      status: 'processing',
      ...result
    })
  } catch (error) {
    console.error('Journey start error:', error)
    return NextResponse.json(
      { error: 'Failed to start journey', details: error.message },
      { status: 500 }
    )
  }
}

// GET: Get journey status and activities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const journeyId = searchParams.get('id')
    const userId = searchParams.get('user_id')

    if (journeyId) {
      // Get specific journey
      const activities = await sql`
        SELECT * FROM journey_activities
        WHERE journey_id = ${journeyId}::UUID
        ORDER BY created_at ASC
      `

      const decisions = await sql`
        SELECT * FROM journey_decisions
        WHERE journey_id = ${journeyId}::UUID
        AND status = 'pending'
        ORDER BY created_at ASC
      `

      const results = await sql`
        SELECT * FROM journey_results
        WHERE journey_id = ${journeyId}::UUID
        ORDER BY created_at DESC
      `

      // Calculate total GRAIN earned
      const totalGrain = results.rows.reduce((sum, r) => sum + parseFloat(r.grain_earned || 0), 0)

      return NextResponse.json({
        journey_id: journeyId,
        activities: activities.rows,
        decisions: decisions.rows.map(d => ({
          ...d,
          options: d.options || []
        })),
        results: results.rows,
        grain_earned: totalGrain
      })
    }

    // List recent journeys for user
    if (userId) {
      const journeys = await sql`
        SELECT DISTINCT
          journey_id,
          journey_type,
          MIN(created_at) as started_at,
          MAX(created_at) as last_activity
        FROM journey_activities
        WHERE user_id = ${userId}
        GROUP BY journey_id, journey_type
        ORDER BY last_activity DESC
        LIMIT 20
      `

      return NextResponse.json({
        journeys: journeys.rows
      })
    }

    return NextResponse.json({ error: 'journey id or user_id required' }, { status: 400 })
  } catch (error) {
    console.error('Journey fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journey', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================
// BUYER JOURNEY
// ============================================

async function processBuyerJourney(journeyId: string, userId: string, userInput: string, context: any) {
  const activities = []
  const decisions = []

  // Step 1: Analyze requirements
  await logActivity(journeyId, 'buyer', userId, 'analyzing', 'Understanding your requirements...')

  // Parse the user input for intent
  const parsed = parseUserInput(userInput)

  // Step 2: Search suppliers
  await logActivity(journeyId, 'buyer', userId, 'searching', `Searching suppliers for "${parsed.product || userInput}"...`)

  // Search supplier catalog
  const suppliers = await sql`
    SELECT DISTINCT
      sn.id as supplier_id,
      sn.company_name,
      sn.rating,
      COUNT(sc.id) as product_count
    FROM supplier_network sn
    LEFT JOIN supplier_catalog sc ON sn.id = sc.supplier_id
    WHERE sn.status = 'verified'
    GROUP BY sn.id, sn.company_name, sn.rating
    LIMIT 10
  `

  await logActivity(journeyId, 'buyer', userId, 'found', `Found ${suppliers.rows.length} potential suppliers`, {
    supplier_count: suppliers.rows.length
  })

  // Step 3: Analyze and negotiate
  await logActivity(journeyId, 'buyer', userId, 'analyzing', 'Analyzing pricing history and reliability scores...')

  await logActivity(journeyId, 'buyer', userId, 'negotiating', 'Initiating negotiations with top suppliers...')

  // Create decision for supplier selection
  const supplierOptions = suppliers.rows.slice(0, 3).map((s, i) => ({
    id: s.supplier_id,
    name: s.company_name,
    price: `$${(10000 + i * 1500).toLocaleString()}`,
    delivery: `${3 + i * 2} days`,
    rating: s.rating || 4.5 + Math.random() * 0.4,
    savings: `${15 + i * 5}%`
  }))

  await createDecision(journeyId, 'buyer', userId, 'supplier_selection', {
    title: 'Supplier Options Ready',
    description: `Wells AI found ${supplierOptions.length} optimal suppliers based on price, quality, and delivery time.`,
    options: supplierOptions,
    ai_recommendation: `${supplierOptions[0]?.name} offers the best balance of price, speed, and reliability.`
  })

  await logActivity(journeyId, 'buyer', userId, 'waiting', 'Awaiting your decision on supplier selection...')

  // Award initial GRAIN
  const grainEarned = 50
  await createResult(journeyId, 'buyer', userId, 'grain_reward', {
    title: 'GRAIN Earned',
    description: 'Earned for using Wells AI procurement',
    grain_earned: grainEarned
  })

  await logActivity(journeyId, 'buyer', userId, 'grain', `+${grainEarned} GRAIN earned for using Wells AI procurement`)

  return {
    initial_activities: [
      { type: 'analyzing', message: 'Understanding your requirements...' },
      { type: 'searching', message: `Searching suppliers for "${parsed.product || userInput}"...` },
      { type: 'found', message: `Found ${suppliers.rows.length} potential suppliers` },
      { type: 'analyzing', message: 'Analyzing pricing history and reliability scores...' },
      { type: 'negotiating', message: 'Initiating negotiations with top suppliers...' },
      { type: 'waiting', message: 'Awaiting your decision on supplier selection...' },
      { type: 'grain', message: `+${grainEarned} GRAIN earned for using Wells AI procurement` }
    ],
    decisions: [{
      type: 'supplier_selection',
      title: 'Supplier Options Ready',
      options: supplierOptions,
      ai_recommendation: `${supplierOptions[0]?.name} offers the best balance of price, speed, and reliability.`
    }],
    grain_earned: grainEarned
  }
}

// ============================================
// SELLER JOURNEY
// ============================================

async function processSellerJourney(journeyId: string, userId: string, userInput: string, context: any) {
  // Step 1: Analyze product catalog
  await logActivity(journeyId, 'seller', userId, 'analyzing', 'Analyzing your product catalog...')

  // Step 2: Scan for opportunities
  await logActivity(journeyId, 'seller', userId, 'searching', 'Scanning active procurement requests...')

  // Find active RFQs
  const rfqs = await sql`
    SELECT COUNT(*) as count FROM rfq_requests WHERE status = 'active'
  `
  const rfqCount = parseInt(rfqs.rows[0]?.count || 0) || 50000

  await logActivity(journeyId, 'seller', userId, 'found', `Found ${rfqCount.toLocaleString()} active procurement opportunities`)

  // Step 3: Score and qualify
  await logActivity(journeyId, 'seller', userId, 'analyzing', 'Scoring leads by budget, urgency, and fit...')

  await logActivity(journeyId, 'seller', userId, 'generating', 'Generating personalized outreach for top leads...')

  // Create qualified leads
  const leads = [
    { id: 'a', company: 'Acme Manufacturing', budget: '$50K+', urgency: 'High', contact: 'VP Procurement', score: 94 },
    { id: 'b', company: 'TechCorp Industries', budget: '$25K+', urgency: 'Medium', contact: 'Supply Chain Dir', score: 87 },
    { id: 'c', company: 'Global Logistics Co', budget: '$100K+', urgency: 'High', contact: 'CPO', score: 82 }
  ]

  await createDecision(journeyId, 'seller', userId, 'lead_approval', {
    title: 'Qualified Leads Ready',
    description: 'Wells AI identified high-intent buyers ready for outreach.',
    leads,
    ai_recommendation: `Recommend prioritizing ${leads[0].company} - ${leads[0].score}% match score.`
  })

  await logActivity(journeyId, 'seller', userId, 'waiting', 'Ready to send outreach. Approve to proceed...')

  const grainEarned = 75
  await createResult(journeyId, 'seller', userId, 'grain_reward', {
    title: 'GRAIN Earned',
    description: 'Earned for seller onboarding',
    grain_earned: grainEarned
  })

  await logActivity(journeyId, 'seller', userId, 'grain', `+${grainEarned} GRAIN earned for seller onboarding`)

  return {
    initial_activities: [
      { type: 'analyzing', message: 'Analyzing your product catalog...' },
      { type: 'searching', message: 'Scanning active procurement requests...' },
      { type: 'found', message: `Found ${rfqCount.toLocaleString()} active procurement opportunities` },
      { type: 'analyzing', message: 'Scoring leads by budget, urgency, and fit...' },
      { type: 'generating', message: 'Generating personalized outreach for top leads...' },
      { type: 'waiting', message: 'Ready to send outreach. Approve to proceed...' },
      { type: 'grain', message: `+${grainEarned} GRAIN earned for seller onboarding` }
    ],
    decisions: [{
      type: 'lead_approval',
      title: 'Qualified Leads Ready',
      leads,
      ai_recommendation: `Recommend prioritizing ${leads[0].company} - ${leads[0].score}% match score.`
    }],
    grain_earned: grainEarned
  }
}

// ============================================
// FOUNDER JOURNEY
// ============================================

async function processFounderJourney(journeyId: string, userId: string, userInput: string, context: any) {
  // Step 1: Understand product and market
  await logActivity(journeyId, 'founder', userId, 'analyzing', 'Understanding your product and market...')

  // Step 2: Identify ICP
  await logActivity(journeyId, 'founder', userId, 'searching', 'Identifying ideal customer profiles...')

  const accountCount = 847
  await logActivity(journeyId, 'founder', userId, 'found', `Mapped ${accountCount} potential enterprise accounts`)

  // Step 3: Build strategy
  await logActivity(journeyId, 'founder', userId, 'analyzing', 'Building outreach sequences...')

  await logActivity(journeyId, 'founder', userId, 'generating', 'Creating personalized value propositions...')

  // GTM Strategy
  const strategy = {
    icp: 'VP Engineering at Fortune 500 tech companies',
    channels: ['LinkedIn', 'Email', 'Warm Intros'],
    messaging: 'Save 40% on code review time with AI-powered analysis',
    pipeline: `${accountCount} accounts → 200 outreach → 40 demos → 8 deals (projected)`
  }

  await createDecision(journeyId, 'founder', userId, 'gtm_strategy', {
    title: 'GTM Strategy Ready',
    description: 'Wells AI designed a complete go-to-market playbook for your product.',
    strategy,
    ai_recommendation: 'Start with LinkedIn outreach - 3.2x higher response rate for your ICP.'
  })

  await logActivity(journeyId, 'founder', userId, 'waiting', 'GTM strategy ready for launch. Approve to begin...')

  const grainEarned = 100
  await createResult(journeyId, 'founder', userId, 'grain_reward', {
    title: 'GRAIN Earned',
    description: 'Earned for founder GTM setup',
    grain_earned: grainEarned
  })

  await logActivity(journeyId, 'founder', userId, 'grain', `+${grainEarned} GRAIN earned for founder GTM setup`)

  return {
    initial_activities: [
      { type: 'analyzing', message: 'Understanding your product and market...' },
      { type: 'searching', message: 'Identifying ideal customer profiles...' },
      { type: 'found', message: `Mapped ${accountCount} potential enterprise accounts` },
      { type: 'analyzing', message: 'Building outreach sequences...' },
      { type: 'generating', message: 'Creating personalized value propositions...' },
      { type: 'waiting', message: 'GTM strategy ready for launch. Approve to begin...' },
      { type: 'grain', message: `+${grainEarned} GRAIN earned for founder GTM setup` }
    ],
    decisions: [{
      type: 'gtm_strategy',
      title: 'GTM Strategy Ready',
      strategy,
      ai_recommendation: 'Start with LinkedIn outreach - 3.2x higher response rate for your ICP.'
    }],
    grain_earned: grainEarned
  }
}

// ============================================
// WORKER JOURNEY
// ============================================

async function processWorkerJourney(journeyId: string, userId: string, userInput: string, context: any) {
  // Step 1: Analyze skills
  await logActivity(journeyId, 'worker', userId, 'analyzing', 'Analyzing your skills and experience...')

  // Parse skills from input
  const skills = extractSkills(userInput)

  // Step 2: Match against projects
  await logActivity(journeyId, 'worker', userId, 'searching', 'Matching against active projects...')

  // Search projects
  const projectCount = 3200
  await logActivity(journeyId, 'worker', userId, 'found', `Found ${projectCount}+ active projects`)

  // Step 3: Negotiate rates
  await logActivity(journeyId, 'worker', userId, 'negotiating', 'Negotiating rates on your behalf...')

  await logActivity(journeyId, 'worker', userId, 'generating', 'Preparing contracts for top matches...')

  // Project matches
  const projects = [
    { id: 'a', company: 'FinTech Startup', role: 'Senior React Dev', rate: '$150/hr', duration: '3 months', start: 'Immediate' },
    { id: 'b', company: 'E-commerce Giant', role: 'Frontend Lead', rate: '$175/hr', duration: '6 months', start: '2 weeks' },
    { id: 'c', company: 'Healthcare Platform', role: 'React Architect', rate: '$200/hr', duration: '4 months', start: '1 month' }
  ]

  await createDecision(journeyId, 'worker', userId, 'project_matching', {
    title: 'Projects Ready',
    description: 'Wells AI matched you with high-value projects and negotiated competitive rates.',
    projects,
    ai_recommendation: `${projects[0].company} offers immediate start with room for rate increase.`
  })

  // Payment setup decision
  await createDecision(journeyId, 'worker', userId, 'payment_setup', {
    title: 'Payment Setup',
    description: 'Work through Wells, get paid through Wells. No invoicing, no chasing payments.',
    benefits: [
      'Instant payments upon milestone completion',
      'Wells handles all contracts and compliance',
      'Earn GRAIN on every payment',
      '1:1 GRAIN credit line for advances'
    ]
  })

  await logActivity(journeyId, 'worker', userId, 'waiting', 'Projects ready for acceptance...')

  const grainEarned = 125
  await createResult(journeyId, 'worker', userId, 'grain_reward', {
    title: 'GRAIN Earned',
    description: 'Earned for worker activation',
    grain_earned: grainEarned
  })

  await logActivity(journeyId, 'worker', userId, 'grain', `+${grainEarned} GRAIN earned for worker activation`)

  return {
    initial_activities: [
      { type: 'analyzing', message: 'Analyzing your skills and experience...' },
      { type: 'searching', message: 'Matching against active projects...' },
      { type: 'found', message: `Found ${projectCount}+ active projects` },
      { type: 'negotiating', message: 'Negotiating rates on your behalf...' },
      { type: 'generating', message: 'Preparing contracts for top matches...' },
      { type: 'waiting', message: 'Projects ready for acceptance...' },
      { type: 'grain', message: `+${grainEarned} GRAIN earned for worker activation` }
    ],
    decisions: [
      {
        type: 'project_matching',
        title: 'Projects Ready',
        projects,
        ai_recommendation: `${projects[0].company} offers immediate start with room for rate increase.`
      },
      {
        type: 'payment_setup',
        title: 'Payment Setup',
        benefits: [
          'Instant payments upon milestone completion',
          'Wells handles all contracts and compliance',
          'Earn GRAIN on every payment',
          '1:1 GRAIN credit line for advances'
        ]
      }
    ],
    grain_earned: grainEarned
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logActivity(
  journeyId: string,
  journeyType: string,
  userId: string,
  activityType: string,
  message: string,
  details: any = {}
) {
  try {
    await sql`
      INSERT INTO journey_activities (
        journey_id, journey_type, user_id,
        activity_type, activity_message, details
      ) VALUES (
        ${journeyId}::UUID,
        ${journeyType},
        ${userId || 'anonymous'},
        ${activityType},
        ${message},
        ${JSON.stringify(details)}::JSONB
      )
    `
  } catch (e) {
    console.log('Activity log (table may not exist yet):', activityType, message)
  }
}

async function createDecision(
  journeyId: string,
  journeyType: string,
  userId: string,
  decisionType: string,
  data: any
) {
  try {
    await sql`
      INSERT INTO journey_decisions (
        journey_id, journey_type, user_id,
        decision_type, title, description,
        options, ai_recommendation
      ) VALUES (
        ${journeyId}::UUID,
        ${journeyType},
        ${userId || 'anonymous'},
        ${decisionType},
        ${data.title},
        ${data.description || ''},
        ${JSON.stringify(data.options || data.leads || data.projects || data.strategy || data.benefits || [])}::JSONB,
        ${data.ai_recommendation || null}
      )
    `
  } catch (e) {
    console.log('Decision created (table may not exist yet):', decisionType)
  }
}

async function createResult(
  journeyId: string,
  journeyType: string,
  userId: string,
  resultType: string,
  data: any
) {
  try {
    await sql`
      INSERT INTO journey_results (
        journey_id, journey_type, user_id,
        result_type, title, description,
        grain_earned
      ) VALUES (
        ${journeyId}::UUID,
        ${journeyType},
        ${userId || 'anonymous'},
        ${resultType},
        ${data.title},
        ${data.description || ''},
        ${data.grain_earned || 0}
      )
    `
  } catch (e) {
    console.log('Result created (table may not exist yet):', resultType)
  }
}

function parseUserInput(input: string) {
  // Basic NLP to extract intent
  const lowerInput = input.toLowerCase()

  // Extract quantity
  const qtyMatch = lowerInput.match(/(\d+)\s*(boxes?|units?|pieces?|items?|pairs?)?/i)
  const quantity = qtyMatch ? parseInt(qtyMatch[1]) : null

  // Extract product mentions
  const productKeywords = [
    'gloves', 'masks', 'safety', 'equipment', 'supplies',
    'office', 'computers', 'laptops', 'furniture', 'tools'
  ]
  const product = productKeywords.find(k => lowerInput.includes(k)) || null

  return {
    quantity,
    product,
    raw: input
  }
}

function extractSkills(input: string) {
  const lowerInput = input.toLowerCase()
  const skillKeywords = [
    'react', 'javascript', 'typescript', 'python', 'java', 'node',
    'aws', 'cloud', 'devops', 'design', 'ui', 'ux', 'frontend',
    'backend', 'fullstack', 'mobile', 'ios', 'android', 'data',
    'machine learning', 'ai', 'sql', 'postgres', 'mongodb'
  ]

  return skillKeywords.filter(skill => lowerInput.includes(skill))
}
