/**
 * Seller Agent Chat API
 *
 * Main conversational interface for sellers.
 * Everything is accessible via natural language.
 *
 * POST /api/seller/chat - Send a message and get a response
 *
 * @example
 * ```bash
 * curl -X POST /api/seller/chat \
 *   -H "Content-Type: application/json" \
 *   -d '{"message": "I sell industrial bearings, min order $500"}'
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSellerAgent, ChatResponse } from '@/lib/seller/seller-agent';

// Store agent instances for session continuity
const agentCache = new Map<string, ReturnType<typeof createSellerAgent>>();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, context } = body as {
      message: string;
      context?: {
        quoteId?: string;
        negotiationId?: string;
        productId?: string;
      };
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create agent instance
    let agentPromise = agentCache.get(userId);
    if (!agentPromise) {
      agentPromise = createSellerAgent(userId);
      agentCache.set(userId, agentPromise);
    }

    const agent = await agentPromise;

    // Process the message
    const response = await agent.chat(message);

    return NextResponse.json({
      success: true,
      response: {
        message: response.message,
        intent: response.intent,
        action: response.action,
        suggestions: response.suggestions,
        quickActions: response.quickActions,
        data: response.data,
      },
    });
  } catch (error) {
    console.error('Seller chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat processing failed' },
      { status: 500 }
    );
  }
}

// GET - Get agent status
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create agent instance
    let agentPromise = agentCache.get(userId);
    if (!agentPromise) {
      agentPromise = createSellerAgent(userId);
      agentCache.set(userId, agentPromise);
    }

    const agent = await agentPromise;
    const status = await agent.getStatus();

    return NextResponse.json({
      success: true,
      status,
      welcomeMessage: !status.configured
        ? "Welcome! I'm Wells, your AI sales assistant. Tell me about your business and what you sell - I'll help you set up automated quoting and negotiations."
        : status.pendingQuotes > 0
        ? `You have ${status.pendingQuotes} quotes pending approval. Say "show pending quotes" to review them.`
        : status.activeNegotiations > 0
        ? `You have ${status.activeNegotiations} active negotiations. Say "show negotiations" to see them.`
        : "I'm ready to help! Ask me about your performance, update your catalog, or configure your agent settings.",
    });
  } catch (error) {
    console.error('Seller status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
