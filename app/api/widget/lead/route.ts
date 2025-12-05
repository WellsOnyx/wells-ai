/**
 * Widget Lead Capture API
 *
 * Public endpoint for the embeddable WellsAI widget.
 * Captures leads and routes through Cold Start Protocol notifications.
 *
 * No auth required - used by external websites.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLead, type CreateLeadInput } from '@/lib/leads-db'
import { notifyNewLead } from '@/lib/notifications'

// CORS headers for widget
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      name,
      email,
      phone,
      journey = 'founder',
      requirements,
      conversationHistory = [],
      source,
      referrer,
    } = body

    // Validate required fields
    if (!email || !requirements) {
      return NextResponse.json(
        { error: 'Email and requirements are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Determine priority based on conversation depth
    const messageCount = conversationHistory.length
    const priority = messageCount > 5 ? 'high' : messageCount > 2 ? 'medium' : 'low'

    // Create lead input
    const leadInput: CreateLeadInput = {
      userId: `widget_${Date.now()}`,
      userEmail: email,
      userName: name || 'Widget Visitor',
      userPhone: phone,
      journey: journey as 'founder' | 'buyer' | 'seller' | 'jobs',
      requirements,
      conversationHistory,
      priority,
      source: `widget:${source || 'unknown'}`,
      intent: detectIntent(requirements),
    }

    // Create the lead
    const lead = await createLead(leadInput)

    // Send notifications (async, don't wait)
    // Extra context is already captured in the lead source field
    notifyNewLead(lead).catch((error) => {
      console.error('Widget notification error:', error)
    })

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: 'Lead captured successfully',
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Widget lead capture error:', error)
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Simple intent detection from requirements text
function detectIntent(requirements: string): string {
  const text = requirements.toLowerCase()

  if (text.includes('hire') || text.includes('recruit') || text.includes('cto') || text.includes('engineer')) {
    return 'hire'
  }
  if (text.includes('buy') || text.includes('purchase') || text.includes('source') || text.includes('supplier')) {
    return 'source'
  }
  if (text.includes('sell') || text.includes('customer') || text.includes('client')) {
    return 'sell'
  }
  if (text.includes('job') || text.includes('role') || text.includes('position') || text.includes('opportunity')) {
    return 'find_job'
  }
  if (text.includes('raise') || text.includes('fund') || text.includes('invest')) {
    return 'raise'
  }

  return 'general'
}
