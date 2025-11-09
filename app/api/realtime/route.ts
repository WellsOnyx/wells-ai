/**
 * Real-time API Route
 * Provides Server-Sent Events (SSE) endpoint for real-time updates
 * GET: Subscribe to SSE stream
 * POST: Emit event to connected clients
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  realtimeService,
  RealtimeEvent,
  MockEventGenerator,
} from '@/lib/realtime';

// Store active connections
const activeConnections = new Map<string, ReadableStreamDefaultController>();

// Mock event generator (singleton)
let mockGenerator: MockEventGenerator | null = null;

/**
 * GET: Server-Sent Events Stream
 * Client subscribes to receive real-time updates
 */
export async function GET(request: NextRequest) {
  // Get agent ID from query params
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId') || 'agent_default';
  const enableMock = searchParams.get('mock') === 'true';

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Store connection
      activeConnections.set(agentId, controller);

      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({
        type: 'connected',
        agentId,
        timestamp: new Date().toISOString(),
        message: 'Real-time connection established',
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMessage));

      // Subscribe to realtime service
      const unsubscribe = realtimeService.subscribe(agentId, (event: RealtimeEvent) => {
        try {
          const message = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
          console.error('Error encoding event:', error);
        }
      });

      // Send event history
      const history = realtimeService.getHistory(agentId, 10);
      if (history.length > 0) {
        const historyMessage = `data: ${JSON.stringify({
          type: 'history',
          events: history,
          timestamp: new Date().toISOString(),
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(historyMessage));
      }

      // Start mock event generator if enabled and not already running
      if (enableMock && !mockGenerator) {
        mockGenerator = new MockEventGenerator([
          agentId,
          'agent_1',
          'agent_2',
          'agent_3',
        ]);
        mockGenerator.start(10000, 30000); // Events every 10-30 seconds
      }

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          const ping = `: keepalive ${Date.now()}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch (error) {
          clearInterval(keepAliveInterval);
          console.error('Keep-alive failed:', error);
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        unsubscribe();
        activeConnections.delete(agentId);

        try {
          controller.close();
        } catch (error) {
          // Already closed
        }

        console.log(`Client disconnected: ${agentId}`);

        // Stop mock generator if no more connections
        if (activeConnections.size === 0 && mockGenerator) {
          mockGenerator.stop();
          mockGenerator = null;
        }
      });
    },

    cancel() {
      // Cleanup on stream cancellation
      activeConnections.delete(agentId);
      console.log(`Stream cancelled: ${agentId}`);
    },
  });

  // Return SSE response
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * POST: Emit Event
 * Send event to connected clients
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate event structure
    if (!body.type || !body.agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, agentId' },
        { status: 400 }
      );
    }

    // Create event
    const event: RealtimeEvent = {
      id: body.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: body.type,
      data: body.data || {},
      timestamp: body.timestamp || new Date().toISOString(),
      agentId: body.agentId,
      read: false,
      priority: body.priority || 'medium',
    };

    // Emit event
    realtimeService.emit(event);

    return NextResponse.json({
      success: true,
      event,
      activeConnections: activeConnections.size,
      message: 'Event emitted successfully',
    });
  } catch (error: any) {
    console.error('Error emitting event:', error);
    return NextResponse.json(
      { error: 'Failed to emit event', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Mark Events as Read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, agentId, markAll } = body;

    if (markAll && agentId) {
      realtimeService.markAllAsRead(agentId);
      return NextResponse.json({
        success: true,
        message: 'All events marked as read',
      });
    }

    if (eventId) {
      realtimeService.markAsRead(eventId);
      return NextResponse.json({
        success: true,
        message: 'Event marked as read',
      });
    }

    return NextResponse.json(
      { error: 'Missing eventId or agentId with markAll flag' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error marking events as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark events as read', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Clear Event History
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    realtimeService.clearHistory(agentId);

    return NextResponse.json({
      success: true,
      message: 'Event history cleared',
    });
  } catch (error: any) {
    console.error('Error clearing history:', error);
    return NextResponse.json(
      { error: 'Failed to clear history', details: error.message },
      { status: 500 }
    );
  }
}
