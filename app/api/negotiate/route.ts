/**
 * Wells AI-to-AI Negotiation API
 *
 * Triggers and manages AI-to-AI negotiations.
 * Humans just say what they want - the AIs handle the rest.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { runNegotiation, quickMatch, type PartyProfile, type NegotiationRequest } from '@/lib/ai-negotiation'

// ============================================================================
// POST - Start a negotiation
// ============================================================================

interface StartNegotiationBody {
  type: 'procurement' | 'hiring' | 'partnership' | 'investment'
  subject: string
  initiator: Partial<PartyProfile>
  responders?: Partial<PartyProfile>[] // For quick match
  responder?: Partial<PartyProfile> // For direct negotiation
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as StartNegotiationBody

    if (!body.type || !body.subject || !body.initiator) {
      return NextResponse.json(
        { error: 'Missing required fields: type, subject, initiator' },
        { status: 400 }
      )
    }

    // Build initiator profile
    const initiator: PartyProfile = {
      id: userId,
      type: body.initiator.type || 'buyer',
      name: body.initiator.name || 'You',
      preferences: body.initiator.preferences || {},
      context: body.initiator.context || body.subject,
    }

    // Quick match mode - find and rank potential matches
    if (body.responders && body.responders.length > 0) {
      const responderProfiles: PartyProfile[] = body.responders.map((r, i) => ({
        id: r.id || `responder_${i}`,
        type: r.type || 'seller',
        name: r.name || `Supplier ${i + 1}`,
        preferences: r.preferences || {},
        context: r.context || '',
      }))

      const matchResult = await quickMatch(initiator, responderProfiles)

      return NextResponse.json({
        mode: 'quick_match',
        matches: matchResult.matches.map(m => ({
          seller: {
            id: m.seller.id,
            name: m.seller.name,
            type: m.seller.type,
          },
          compatibility: m.compatibility,
          suggestedTerms: m.suggestedTerms,
        })),
        message: matchResult.matches.length > 0
          ? `Found ${matchResult.matches.length} potential matches. Your AI can negotiate with any of them.`
          : 'No strong matches found. Try adjusting your requirements.',
      })
    }

    // Direct negotiation mode
    if (body.responder) {
      const responder: PartyProfile = {
        id: body.responder.id || 'responder',
        type: body.responder.type || 'seller',
        name: body.responder.name || 'Other Party',
        preferences: body.responder.preferences || {},
        context: body.responder.context || '',
      }

      const negotiationRequest: NegotiationRequest = {
        id: `req_${Date.now()}`,
        type: body.type,
        initiator,
        responder,
        subject: body.subject,
      }

      const result = await runNegotiation(negotiationRequest)

      return NextResponse.json({
        mode: 'negotiation',
        negotiationId: result.id,
        status: result.status,
        rounds: result.rounds,
        finalTerms: result.finalTerms,
        summary: result.initiatorSummary,
        conversation: result.conversation.map(m => ({
          round: m.round,
          from: m.from === 'initiator_ai' ? 'Your AI' : `${responder.name}'s AI`,
          message: m.message,
          proposal: m.proposal,
        })),
        nextAction: result.status === 'agreed'
          ? 'Review and approve the terms below'
          : result.status === 'no_deal'
            ? 'No agreement reached. Consider adjusting your requirements.'
            : 'Human input needed to continue negotiation.',
      })
    }

    return NextResponse.json(
      { error: 'Must provide either responders (for quick match) or responder (for direct negotiation)' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Negotiation error:', error)
    return NextResponse.json(
      { error: 'Failed to process negotiation' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Get negotiation status
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const negotiationId = searchParams.get('id')

  if (!negotiationId) {
    return NextResponse.json({
      status: 'ok',
      service: 'Wells AI-to-AI Negotiation',
      description: 'AI negotiates on your behalf. You just approve.',
    })
  }

  // TODO: Retrieve from database
  return NextResponse.json({
    error: 'Negotiation lookup not yet implemented',
    negotiationId,
  })
}
