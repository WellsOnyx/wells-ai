/**
 * Gmail Send Route
 * POST /api/inbox/gmail/send
 *
 * Send email or reply to a thread
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, replyToMessage, createDraft } from '@/lib/inbox/providers/gmail'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      accountId,
      action = 'send', // 'send', 'reply', 'draft'
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      threadId,
      attachments,
    } = body

    // Validate required parameters
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Missing accountId parameter' },
        { status: 400 }
      )
    }

    if (action === 'reply') {
      // Reply to thread
      if (!threadId || !bodyText) {
        return NextResponse.json(
          { success: false, error: 'Missing threadId or bodyText for reply' },
          { status: 400 }
        )
      }

      const message = await replyToMessage(accountId, threadId, bodyText, bodyHtml)

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          threadId: message.threadId,
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
        },
      })
    } else if (action === 'draft') {
      // Create draft
      if (!to || !subject || !bodyText) {
        return NextResponse.json(
          { success: false, error: 'Missing to, subject, or bodyText for draft' },
          { status: 400 }
        )
      }

      const draft = await createDraft(accountId, {
        to,
        cc,
        bcc,
        subject,
        body: bodyText,
        bodyHtml,
        attachments,
        threadId,
      })

      return NextResponse.json({
        success: true,
        draft: {
          id: draft.id,
          messageId: draft.message?.id,
          threadId: draft.message?.threadId,
        },
      })
    } else {
      // Send new email
      if (!to || !subject || !bodyText) {
        return NextResponse.json(
          { success: false, error: 'Missing to, subject, or bodyText' },
          { status: 400 }
        )
      }

      const message = await sendMessage(accountId, {
        to,
        cc,
        bcc,
        subject,
        body: bodyText,
        bodyHtml,
        attachments,
        threadId,
      })

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          threadId: message.threadId,
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
        },
      })
    }
  } catch (error: any) {
    console.error('[Gmail Send] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch a specific message
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const messageId = searchParams.get('messageId')

    if (!accountId || !messageId) {
      return NextResponse.json(
        { success: false, error: 'Missing accountId or messageId parameter' },
        { status: 400 }
      )
    }

    const { getMessage } = await import('@/lib/inbox/providers/gmail')
    const message = await getMessage(accountId, messageId)

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error: any) {
    console.error('[Gmail Get Message] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
