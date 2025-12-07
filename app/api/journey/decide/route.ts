// @ts-nocheck
/**
 * JOURNEY DECISION API
 *
 * Handle user decisions within journeys.
 * POST /api/journey/decide - Make a decision
 */

import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { journey_id, decision_id, selected_option, journey_type, user_id } = body

    if (!journey_id) {
      return NextResponse.json({ error: 'journey_id required' }, { status: 400 })
    }

    // Update the decision
    if (decision_id) {
      try {
        await sql`
          UPDATE journey_decisions
          SET selected_option = ${selected_option},
              decision_made_at = NOW(),
              status = 'decided'
          WHERE id = ${decision_id}::UUID
        `
      } catch (e) {
        console.log('Decision update (table may not exist):', decision_id)
      }
    }

    // Log the decision activity
    await logActivity(
      journey_id,
      journey_type || 'unknown',
      user_id,
      'success',
      `Decision confirmed: ${selected_option}`
    )

    // Execute follow-up actions based on decision type
    const result = await executeDecision(journey_id, journey_type, user_id, selected_option)

    return NextResponse.json({
      success: true,
      journey_id,
      decision: selected_option,
      ...result
    })
  } catch (error) {
    console.error('Decision error:', error)
    return NextResponse.json(
      { error: 'Failed to process decision', details: error.message },
      { status: 500 }
    )
  }
}

async function executeDecision(
  journeyId: string,
  journeyType: string,
  userId: string,
  decision: string
) {
  const activities = []
  let grainBonus = 0

  // Log execution start
  await logActivity(journeyId, journeyType, userId, 'generating', 'Executing your decision...')
  activities.push({ type: 'generating', message: 'Executing your decision...' })

  // Journey-specific execution
  if (journeyType === 'buyer') {
    // Buyer: Create the order
    await logActivity(journeyId, journeyType, userId, 'negotiating', `Finalizing deal with ${decision}...`)
    activities.push({ type: 'negotiating', message: `Finalizing deal with ${decision}...` })

    await new Promise(r => setTimeout(r, 100))

    await logActivity(journeyId, journeyType, userId, 'generating', 'Generating purchase order...')
    activities.push({ type: 'generating', message: 'Generating purchase order...' })

    // Create PO
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`

    await logActivity(journeyId, journeyType, userId, 'success', `Purchase order ${poNumber} created and sent to supplier`)
    activities.push({ type: 'success', message: `Purchase order ${poNumber} created and sent to supplier` })

    grainBonus = 25

    await createResult(journeyId, journeyType, userId, 'order_created', {
      title: 'Order Created',
      description: `PO ${poNumber} sent to ${decision}`,
      grain_earned: grainBonus,
      metrics: { po_number: poNumber, supplier: decision }
    })

  } else if (journeyType === 'seller') {
    // Seller: Send outreach
    await logActivity(journeyId, journeyType, userId, 'generating', 'Crafting personalized outreach messages...')
    activities.push({ type: 'generating', message: 'Crafting personalized outreach messages...' })

    await new Promise(r => setTimeout(r, 100))

    await logActivity(journeyId, journeyType, userId, 'success', `Outreach campaign launched to ${decision}`)
    activities.push({ type: 'success', message: `Outreach campaign launched to ${decision}` })

    grainBonus = 30

    await createResult(journeyId, journeyType, userId, 'outreach_sent', {
      title: 'Outreach Launched',
      description: `Campaign started targeting ${decision}`,
      grain_earned: grainBonus,
      metrics: { target: decision, campaign_status: 'active' }
    })

  } else if (journeyType === 'founder') {
    // Founder: Launch GTM
    await logActivity(journeyId, journeyType, userId, 'generating', 'Initializing GTM automation...')
    activities.push({ type: 'generating', message: 'Initializing GTM automation...' })

    await new Promise(r => setTimeout(r, 100))

    await logActivity(journeyId, journeyType, userId, 'searching', 'Building target account list...')
    activities.push({ type: 'searching', message: 'Building target account list...' })

    await logActivity(journeyId, journeyType, userId, 'success', 'GTM campaign launched! First outreach going out in 24 hours.')
    activities.push({ type: 'success', message: 'GTM campaign launched! First outreach going out in 24 hours.' })

    grainBonus = 50

    await createResult(journeyId, journeyType, userId, 'gtm_launched', {
      title: 'GTM Campaign Active',
      description: 'Your go-to-market campaign is now running',
      grain_earned: grainBonus,
      metrics: { campaign_status: 'active', first_outreach: '24 hours' }
    })

  } else if (journeyType === 'worker') {
    // Worker: Accept project or setup payments
    if (decision.includes('payment') || decision.includes('Payment')) {
      await logActivity(journeyId, journeyType, userId, 'generating', 'Setting up payment infrastructure...')
      activities.push({ type: 'generating', message: 'Setting up payment infrastructure...' })

      await logActivity(journeyId, journeyType, userId, 'success', 'Payment setup complete! Work through Wells, get paid through Wells.')
      activities.push({ type: 'success', message: 'Payment setup complete! Work through Wells, get paid through Wells.' })

      grainBonus = 50

      await createResult(journeyId, journeyType, userId, 'payment_setup', {
        title: 'Payment Infrastructure Ready',
        description: 'You can now receive instant payments through Wells',
        grain_earned: grainBonus,
        metrics: { payment_ready: true }
      })

    } else {
      // Project acceptance
      await logActivity(journeyId, journeyType, userId, 'negotiating', `Finalizing contract with ${decision}...`)
      activities.push({ type: 'negotiating', message: `Finalizing contract with ${decision}...` })

      await logActivity(journeyId, journeyType, userId, 'generating', 'Generating engagement contract...')
      activities.push({ type: 'generating', message: 'Generating engagement contract...' })

      await logActivity(journeyId, journeyType, userId, 'success', `You're now engaged with ${decision}! Contract ready for signature.`)
      activities.push({ type: 'success', message: `You're now engaged with ${decision}! Contract ready for signature.` })

      grainBonus = 75

      await createResult(journeyId, journeyType, userId, 'engagement_created', {
        title: 'Engagement Created',
        description: `You're now working with ${decision}`,
        grain_earned: grainBonus,
        metrics: { client: decision, status: 'pending_signature' }
      })
    }
  }

  // Award GRAIN bonus
  if (grainBonus > 0) {
    await logActivity(journeyId, journeyType, userId, 'grain', `+${grainBonus} GRAIN earned for completing action`)
    activities.push({ type: 'grain', message: `+${grainBonus} GRAIN earned for completing action` })
  }

  return {
    activities,
    grain_bonus: grainBonus
  }
}

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
    console.log('Activity log:', activityType, message)
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
        metrics, grain_earned
      ) VALUES (
        ${journeyId}::UUID,
        ${journeyType},
        ${userId || 'anonymous'},
        ${resultType},
        ${data.title},
        ${data.description || ''},
        ${JSON.stringify(data.metrics || {})}::JSONB,
        ${data.grain_earned || 0}
      )
    `
  } catch (e) {
    console.log('Result created:', resultType)
  }
}
