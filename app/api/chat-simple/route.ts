/**
 * Simple Chat API - Lightweight version for reliability
 *
 * This is a streamlined chat endpoint that doesn't load
 * the heavy tool definitions and memory systems.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const SYSTEM_PROMPT = `You are Wells, an AI assistant for Grain & Vault - a modern treasury and payments platform.

Grain & Vault helps businesses:
- Manage treasury with USD-backed GRAIN tokens
- Send instant cross-border payments
- Earn yield on idle cash
- Bridge between traditional finance and digital assets

You're helpful, direct, and professional. Keep responses concise.

If users ask about:
- Deposits: Explain they can deposit USD to receive GRAIN 1:1
- Transfers: GRAIN can be sent instantly to any email or wallet
- Yield: Treasury deposits earn competitive APY
- Fees: 1% fee on transactions, shared with the network

Be conversational and helpful. Don't overwhelm with information - answer what's asked.`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: Message[]
}

export async function POST(request: NextRequest) {
  try {
    // Auth is optional
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as ChatRequest
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Call Anthropic
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text')
    const message = textContent ? textContent.text : 'I apologize, I could not generate a response.'

    return NextResponse.json({
      message,
      userId: userId || 'anonymous'
    })
  } catch (error: any) {
    console.error('[chat-simple] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat', details: error.message },
      { status: 500 }
    )
  }
}
