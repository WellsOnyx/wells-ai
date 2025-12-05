import { NextRequest, NextResponse } from 'next/server'
import {
  getConversations,
  getInboxStats,
  findOrCreateConversation,
  addMessage,
  classifyMessage,
  type Channel
} from '@/lib/inbox'

export const dynamic = 'force-dynamic'

// GET /api/inbox - List all conversations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as any
    const channel = searchParams.get('channel') as Channel | null
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeStats = searchParams.get('stats') === 'true'

    const conversations = await getConversations({
      status: status || undefined,
      channel: channel || undefined,
      search,
      limit,
      offset
    })

    const response: any = {
      success: true,
      conversations,
      count: conversations.length
    }

    if (includeStats) {
      response.stats = await getInboxStats()
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/inbox - Create new conversation or add inbound message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contact_id,
      contact_name,
      contact_email,
      contact_phone,
      contact_company,
      channel,
      message,
      classify = true
    } = body

    if (!contact_id || !channel || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: contact_id, channel, message' },
        { status: 400 }
      )
    }

    // Find or create conversation
    const conversation = await findOrCreateConversation({
      id: contact_id,
      name: contact_name,
      email: contact_email,
      phone: contact_phone,
      company: contact_company,
      channel
    })

    // Add the inbound message
    const newMessage = await addMessage({
      conversation_id: conversation.id,
      content: message,
      direction: 'inbound',
      sender_type: 'contact',
      sender_name: contact_name,
      channel
    })

    // Optionally classify the message
    let classification = null
    if (classify) {
      classification = await classifyMessage(message)
    }

    return NextResponse.json({
      success: true,
      conversation,
      message: newMessage,
      classification
    })
  } catch (error: any) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
