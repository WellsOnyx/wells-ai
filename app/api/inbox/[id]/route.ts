import { NextRequest, NextResponse } from 'next/server'
import {
  getConversation,
  addMessage,
  generateAIResponse,
  approveAndSendMessage,
  updateConversationStatus,
  type ConversationStatus
} from '@/lib/inbox'

export const dynamic = 'force-dynamic'

// GET /api/inbox/[id] - Get conversation with all messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await getConversation(id)

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ...data
    })
  } catch (error: any) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/inbox/[id] - Add message or perform action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'message': {
        // Add a new outbound message (manual reply)
        const { content, sender_id, sender_name } = body

        if (!content) {
          return NextResponse.json(
            { success: false, error: 'Message content required' },
            { status: 400 }
          )
        }

        // Get conversation to know the channel
        const convData = await getConversation(id)
        if (!convData) {
          return NextResponse.json(
            { success: false, error: 'Conversation not found' },
            { status: 404 }
          )
        }

        const message = await addMessage({
          conversation_id: id,
          content,
          direction: 'outbound',
          sender_type: 'user',
          sender_id,
          sender_name,
          channel: convData.conversation.channel
        })

        return NextResponse.json({ success: true, message })
      }

      case 'ai-response': {
        // Generate AI response
        const { customPrompt } = body
        const result = await generateAIResponse(id, customPrompt)

        return NextResponse.json({
          success: true,
          ...result,
          status: 'pending_approval'
        })
      }

      case 'approve': {
        // Approve and send AI-generated message
        const { messageId, userId, editedContent } = body

        if (!messageId || !userId) {
          return NextResponse.json(
            { success: false, error: 'messageId and userId required' },
            { status: 400 }
          )
        }

        const message = await approveAndSendMessage(messageId, userId, editedContent)

        return NextResponse.json({ success: true, message })
      }

      case 'status': {
        // Update conversation status
        const { status } = body as { status: ConversationStatus }

        if (!status) {
          return NextResponse.json(
            { success: false, error: 'Status required' },
            { status: 400 }
          )
        }

        const conversation = await updateConversationStatus(id, status)

        return NextResponse.json({ success: true, conversation })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error processing inbox action:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/inbox/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (status) {
      const conversation = await updateConversationStatus(id, status)
      return NextResponse.json({ success: true, conversation })
    }

    return NextResponse.json(
      { success: false, error: 'No updates provided' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
