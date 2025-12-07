/**
 * Gmail Message Actions
 * POST /api/inbox/gmail/actions
 *
 * Perform actions on Gmail messages:
 * - markAsRead/markAsUnread
 * - archive/unarchive
 * - trash/untrash
 * - star/unstar
 * - addLabel/removeLabel
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  markAsRead,
  markAsUnread,
  archive,
  trash,
  moveToInbox,
  modifyLabels,
} from '@/lib/inbox/providers/gmail'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, messageId, action, labelIds } = body

    // Validate required parameters
    if (!accountId || !messageId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: accountId, messageId, action' },
        { status: 400 }
      )
    }

    // Perform the requested action
    switch (action) {
      case 'markAsRead':
        await markAsRead(accountId, messageId)
        break

      case 'markAsUnread':
        await markAsUnread(accountId, messageId)
        break

      case 'archive':
        await archive(accountId, messageId)
        break

      case 'unarchive':
      case 'moveToInbox':
        await moveToInbox(accountId, messageId)
        break

      case 'trash':
        await trash(accountId, messageId)
        break

      case 'star':
        await modifyLabels(accountId, messageId, ['STARRED'])
        break

      case 'unstar':
        await modifyLabels(accountId, messageId, undefined, ['STARRED'])
        break

      case 'markImportant':
        await modifyLabels(accountId, messageId, ['IMPORTANT'])
        break

      case 'markNotImportant':
        await modifyLabels(accountId, messageId, undefined, ['IMPORTANT'])
        break

      case 'addLabel':
        if (!labelIds || labelIds.length === 0) {
          return NextResponse.json(
            { success: false, error: 'labelIds required for addLabel action' },
            { status: 400 }
          )
        }
        await modifyLabels(accountId, messageId, labelIds)
        break

      case 'removeLabel':
        if (!labelIds || labelIds.length === 0) {
          return NextResponse.json(
            { success: false, error: 'labelIds required for removeLabel action' },
            { status: 400 }
          )
        }
        await modifyLabels(accountId, messageId, undefined, labelIds)
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' completed`,
    })
  } catch (error: any) {
    console.error('[Gmail Actions] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to list available actions
export async function GET() {
  return NextResponse.json({
    success: true,
    actions: [
      'markAsRead',
      'markAsUnread',
      'archive',
      'unarchive',
      'moveToInbox',
      'trash',
      'star',
      'unstar',
      'markImportant',
      'markNotImportant',
      'addLabel',
      'removeLabel',
    ],
    usage: {
      endpoint: '/api/inbox/gmail/actions',
      method: 'POST',
      body: {
        accountId: 'UUID of Gmail account',
        messageId: 'Gmail message ID',
        action: 'One of the available actions',
        labelIds: 'Array of label IDs (required for addLabel/removeLabel)',
      },
    },
  })
}
