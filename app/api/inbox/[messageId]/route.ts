/**
 * Individual Message API
 * GET /api/inbox/[messageId] - Get specific message with full context
 */

import { NextRequest, NextResponse } from 'next/server'
import { InboundMessages, MessageThreads, Contacts } from '@/lib/inbox/db'
import { monitorAPI } from '@/lib/monitoring'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const monitor = monitorAPI('/api/inbox/[messageId]', 'GET')

  try {
    const { messageId } = await params

    // Get message
    const message = await InboundMessages.findById(messageId)

    if (!message) {
      monitor.end(false)
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Get thread context if available
    let thread = null
    let threadMessages = []

    if (message.internalThreadId) {
      thread = await MessageThreads.findById(message.internalThreadId)
      threadMessages = await InboundMessages.findByThread(message.internalThreadId)
    }

    // Get sender contact info
    let contact = null
    if (message.senderEmail || message.senderPhone) {
      const contacts = await Contacts.findByUser(message.userId, 1000)
      contact = contacts.find(
        (c) =>
          c.email === message.senderEmail || c.phone === message.senderPhone
      )
    }

    monitor.end(true)
    return NextResponse.json({
      success: true,
      message,
      thread,
      threadMessages,
      contact,
    })
  } catch (error) {
    monitor.end(false)
    console.error('[MESSAGE API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
