/**
 * POST /api/negotiate/[sessionId]/decide
 *
 * Submit a human decision for an escalated negotiation.
 * Also handles final approval to proceed with purchase order.
 *
 * @module app/api/negotiate/[sessionId]/decide/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSession, routeMessage } from '@/lib/negotiation/ai-router';
import {
  getEscalationBySession,
  resolveEscalation,
  EscalationDecision,
} from '@/lib/negotiation/escalation-service';
import {
  createProtocolMessage,
  NegotiationTerms,
} from '@/lib/negotiation/protocol';
import { sql } from '@vercel/postgres';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Handle different decision types
    const decisionType = body.decision || body.action;

    if (!decisionType) {
      return NextResponse.json(
        { error: 'Missing decision. Use: approve, reject, modify, or accept_offer' },
        { status: 400 }
      );
    }

    switch (decisionType) {
      case 'approve':
      case 'accept_offer':
        return handleApproval(session, body, userId);

      case 'reject':
        return handleRejection(session, body, userId);

      case 'modify':
        return handleModification(session, body, userId);

      case 'select_supplier':
        return handleSupplierSelection(session, body, userId);

      default:
        return NextResponse.json(
          { error: `Unknown decision type: ${decisionType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] decide error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process decision' },
      { status: 500 }
    );
  }
}

/**
 * Handle approval of negotiated terms
 * This creates a PO and initiates escrow
 */
async function handleApproval(
  session: Awaited<ReturnType<typeof getSession>>,
  body: { reason?: string; createPO?: boolean; initiateEscrow?: boolean },
  userId: string
) {
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const finalTerms = session.finalTerms || session.currentTerms || session.initialTerms;

  // Resolve any pending escalation
  const escalation = await getEscalationBySession(session.id);
  if (escalation) {
    await resolveEscalation(escalation.id, {
      decision: 'approve',
      reason: body.reason || 'Terms approved',
      decidedBy: userId,
    });
  }

  // Update session to agreed status
  await sql`
    UPDATE negotiation_sessions
    SET
      status = 'agreed',
      final_terms = ${JSON.stringify(finalTerms)},
      completed_at = NOW(),
      last_activity_at = NOW()
    WHERE id = ${session.id}
  `;

  // Create award record
  const awardResult = await sql`
    INSERT INTO rfq_awards (
      rfq_id,
      quote_id,
      supplier_id,
      award_amount,
      award_quantity,
      award_unit_price,
      award_terms,
      status,
      awarded_at
    ) VALUES (
      ${session.rfqId},
      ${session.quoteId},
      ${session.sellerAgent.organizationId},
      ${finalTerms.totalPrice},
      ${finalTerms.quantity},
      ${finalTerms.unitPrice},
      ${JSON.stringify(finalTerms)},
      'pending',
      NOW()
    )
    RETURNING id
  `;

  const awardId = awardResult.rows[0]?.id;

  // TODO: Create PO in ERP system if createPO is true
  // TODO: Create escrow if initiateEscrow is true

  let nextSteps = [
    'Award created successfully',
    `Supplier: ${session.sellerAgent.organizationName}`,
    `Total: $${finalTerms.totalPrice.toFixed(2)}`,
  ];

  if (body.createPO) {
    nextSteps.push('Purchase order will be created');
  }

  if (body.initiateEscrow) {
    nextSteps.push('Escrow will be initiated');
  }

  return NextResponse.json({
    success: true,
    decision: 'approved',
    message: 'Terms approved successfully',
    session: {
      id: session.id,
      status: 'agreed',
      supplierName: session.sellerAgent.organizationName,
    },
    award: {
      id: awardId,
      amount: finalTerms.totalPrice,
      quantity: finalTerms.quantity,
      unitPrice: finalTerms.unitPrice,
      leadTimeDays: finalTerms.leadTimeDays,
      paymentTerms: finalTerms.paymentTerms,
    },
    nextSteps,
  });
}

/**
 * Handle rejection of terms
 */
async function handleRejection(
  session: Awaited<ReturnType<typeof getSession>>,
  body: { reason?: string },
  userId: string
) {
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Resolve any pending escalation
  const escalation = await getEscalationBySession(session.id);
  if (escalation) {
    await resolveEscalation(escalation.id, {
      decision: 'reject',
      reason: body.reason || 'Terms rejected',
      decidedBy: userId,
    });
  }

  // Create rejection message
  const rejectMessage = createProtocolMessage({
    sessionId: session.id,
    round: session.currentRound,
    sender: session.buyerAgent,
    type: 'reject',
    terms: null,
    constraints: {
      unitPriceBound: 0,
      isHardLimit: true,
      nonNegotiable: [],
      flexible: [],
    },
    message: body.reason || 'The terms are not acceptable. We must decline.',
    confidence: 100,
  });

  // Route the rejection
  await routeMessage(session, rejectMessage);

  return NextResponse.json({
    success: true,
    decision: 'rejected',
    message: 'Negotiation rejected',
    session: {
      id: session.id,
      status: 'rejected',
    },
    reason: body.reason || 'Terms not acceptable',
  });
}

/**
 * Handle modification of terms with new constraints
 */
async function handleModification(
  session: Awaited<ReturnType<typeof getSession>>,
  body: {
    reason?: string;
    newTerms?: Partial<NegotiationTerms>;
    newConstraints?: {
      maxUnitPrice?: number;
      maxTotalBudget?: number;
      maxLeadTimeDays?: number;
    };
  },
  userId: string
) {
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Resolve escalation with modification
  const escalation = await getEscalationBySession(session.id);
  if (escalation) {
    await resolveEscalation(escalation.id, {
      decision: 'modify',
      modifiedTerms: body.newTerms as NegotiationTerms,
      reason: body.reason || 'Terms modified',
      decidedBy: userId,
    });
  }

  // Update session with new constraints if provided
  if (body.newConstraints) {
    const newLimits = {
      ...session.buyerAgent.limits,
      priceBoundary: body.newConstraints.maxTotalBudget ||
        body.newConstraints.maxUnitPrice ?
        (body.newConstraints.maxUnitPrice || 0) * session.initialTerms.quantity :
        session.buyerAgent.limits.priceBoundary,
      leadTimeBoundary: body.newConstraints.maxLeadTimeDays ||
        session.buyerAgent.limits.leadTimeBoundary,
    };

    await sql`
      UPDATE negotiation_sessions
      SET
        buyer_agent = jsonb_set(
          buyer_agent::jsonb,
          '{limits}',
          ${JSON.stringify(newLimits)}::jsonb
        ),
        status = 'active',
        last_activity_at = NOW()
      WHERE id = ${session.id}
    `;
  }

  // If new terms provided, create a counter-offer
  if (body.newTerms) {
    const currentTerms = session.currentTerms || session.initialTerms;
    const modifiedTerms: NegotiationTerms = {
      ...currentTerms,
      ...body.newTerms,
      totalPrice: body.newTerms.totalPrice ||
        (body.newTerms.unitPrice || currentTerms.unitPrice) *
        (body.newTerms.quantity || currentTerms.quantity) +
        (body.newTerms.shippingCost || currentTerms.shippingCost),
    };

    const counterMessage = createProtocolMessage({
      sessionId: session.id,
      round: session.currentRound,
      sender: session.buyerAgent,
      type: 'counter',
      terms: modifiedTerms,
      constraints: {
        unitPriceBound: modifiedTerms.unitPrice,
        isHardLimit: false,
        nonNegotiable: [],
        flexible: ['leadTimeDays', 'paymentTerms'],
      },
      message: body.reason || 'We can work with these modified terms.',
      confidence: 90,
    });

    // Route the counter-offer
    const result = await routeMessage(session, counterMessage);

    return NextResponse.json({
      success: true,
      decision: 'modified',
      message: 'Terms modified and counter-offer sent',
      session: {
        id: session.id,
        status: result.session.status,
        currentRound: result.session.currentRound,
      },
      newTerms: modifiedTerms,
      response: result.response ? {
        type: result.response.type,
        message: result.response.message,
        terms: result.response.terms,
      } : null,
    });
  }

  // Just update constraints and resume
  await sql`
    UPDATE negotiation_sessions
    SET
      status = 'active',
      last_activity_at = NOW()
    WHERE id = ${session.id}
  `;

  return NextResponse.json({
    success: true,
    decision: 'modified',
    message: 'Constraints updated. Negotiation will resume.',
    session: {
      id: session.id,
      status: 'active',
    },
  });
}

/**
 * Handle supplier selection from chat command like "go with Precision Bearings"
 */
async function handleSupplierSelection(
  session: Awaited<ReturnType<typeof getSession>>,
  body: { supplierName?: string; sessionId?: string },
  userId: string
) {
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Verify this is the right supplier
  const supplierName = body.supplierName?.toLowerCase();
  const sessionSupplier = session.sellerAgent.organizationName.toLowerCase();

  if (supplierName && !sessionSupplier.includes(supplierName)) {
    return NextResponse.json(
      { error: `Supplier "${body.supplierName}" does not match session supplier "${session.sellerAgent.organizationName}"` },
      { status: 400 }
    );
  }

  // Proceed with approval
  return handleApproval(session, { reason: 'Selected via chat command', createPO: true }, userId);
}
