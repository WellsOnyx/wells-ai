/**
 * Full Voice Conversation API
 *
 * POST /api/voice/conversation
 * Accept audio, return AI response as audio with text transcription
 *
 * This endpoint handles the complete voice conversation flow:
 * 1. Transcribe user audio
 * 2. Get AI response
 * 3. Convert response to speech
 * 4. Return both audio and text
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { transcribeAudio, isValidAudioFormat } from '@/lib/voice/speech-to-text'
import { generateSpeech, VOICES, Voice } from '@/lib/voice/text-to-speech'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Maximum file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024

// System prompt for voice conversations
const VOICE_SYSTEM_PROMPT = `You are Wells, an AI assistant for business operations.
You're responding to voice input, so keep your responses conversational, concise, and easy to understand when spoken aloud.

Guidelines for voice responses:
- Be brief but helpful (aim for 1-3 sentences when possible)
- Avoid technical jargon unless necessary
- Don't use markdown formatting, bullet points, or special characters
- Numbers should be spoken naturally (e.g., "one thousand dollars" not "$1,000")
- Confirm actions before taking them
- Ask clarifying questions if the request is ambiguous

You help with:
- Treasury and payments (GRAIN balance, transfers, deposits)
- Sourcing and procurement (finding suppliers, getting quotes)
- Sales (finding leads, managing pipeline)
- Hiring (posting jobs, finding candidates)
`

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', details: `Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Validate file format
    const fileName = audioFile.name || 'audio.webm'
    if (!isValidAudioFormat(fileName)) {
      return NextResponse.json(
        { error: 'Unsupported audio format' },
        { status: 400 }
      )
    }

    // Get optional parameters
    const voice = (formData.get('voice') as Voice) || 'nova'
    const speed = parseFloat(formData.get('speed') as string) || 1.0
    const journey = formData.get('journey') as string || 'treasury'
    const context = formData.get('context') as string || ''
    const returnAudio = formData.get('returnAudio') !== 'false'

    // Validate voice
    const selectedVoice: Voice = VOICES.includes(voice) ? voice : 'nova'

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const timings: Record<string, number> = {}
    const startTime = Date.now()

    // 1. Transcribe audio
    const transcribeStart = Date.now()
    const transcription = await transcribeAudio(buffer, {
      responseFormat: 'verbose_json',
    })
    timings.transcription = Date.now() - transcribeStart

    if (!transcription.text.trim()) {
      return NextResponse.json({
        success: true,
        userTranscription: '',
        aiResponse: "I didn't catch that. Could you please repeat?",
        audioUrl: null,
        timings,
      })
    }

    // 2. Get AI response
    const aiStart = Date.now()
    const aiResponse = await getAIResponse(transcription.text, {
      journey,
      context,
      userId,
    })
    timings.aiGeneration = Date.now() - aiStart

    // 3. Generate speech (optional)
    let audioBuffer: Buffer | null = null
    if (returnAudio) {
      const ttsStart = Date.now()
      const speechResult = await generateSpeech(aiResponse, {
        voice: selectedVoice,
        speed: Math.max(0.25, Math.min(4.0, speed)),
        format: 'mp3',
      })
      audioBuffer = speechResult.audioBuffer
      timings.speechGeneration = Date.now() - ttsStart
    }

    timings.total = Date.now() - startTime

    // Return response with or without audio
    if (audioBuffer) {
      // Return multipart response with both text and audio
      const boundary = '----VoiceResponseBoundary'
      const jsonPart = JSON.stringify({
        success: true,
        userTranscription: transcription.text,
        userLanguage: transcription.language,
        aiResponse,
        timings,
      })

      // For simplicity, return JSON with base64 audio
      const audioBase64 = audioBuffer.toString('base64')

      return NextResponse.json({
        success: true,
        userTranscription: transcription.text,
        userLanguage: transcription.language,
        aiResponse,
        audio: {
          data: audioBase64,
          format: 'mp3',
          contentType: 'audio/mpeg',
        },
        timings,
      })
    }

    // Return text-only response
    return NextResponse.json({
      success: true,
      userTranscription: transcription.text,
      userLanguage: transcription.language,
      aiResponse,
      audio: null,
      timings,
    })
  } catch (error) {
    console.error('Voice conversation error:', error)
    return NextResponse.json(
      {
        error: 'Voice conversation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get AI response using Anthropic Claude
 */
async function getAIResponse(
  userInput: string,
  context: { journey?: string; context?: string; userId?: string }
): Promise<string> {
  const journeyContext = getJourneyContext(context.journey || 'treasury')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: VOICE_SYSTEM_PROMPT + '\n\n' + journeyContext,
      messages: [
        {
          role: 'user',
          content: context.context
            ? `Previous context:\n${context.context}\n\nUser says: ${userInput}`
            : userInput,
        },
      ],
    })

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text')
    return textContent?.type === 'text' ? textContent.text : "I'm sorry, I couldn't process that request."
  } catch (error) {
    console.error('AI response error:', error)
    return "I'm having trouble processing your request right now. Please try again."
  }
}

/**
 * Get journey-specific context for the AI
 */
function getJourneyContext(journey: string): string {
  const contexts: Record<string, string> = {
    treasury: `Current focus: Treasury and payments.
You can help with GRAIN balance, transfers, deposits, and payment status.
When discussing money, use natural language like "five hundred dollars" instead of "$500".`,

    sourcing: `Current focus: Sourcing and procurement.
You can help find suppliers, get quotes, compare options, and track orders.
Be helpful in understanding what the user needs to source.`,

    sales: `Current focus: Sales and leads.
You can help find qualified leads, manage pipeline, and track opportunities.
Be proactive in offering sales assistance.`,

    hiring: `Current focus: Hiring and recruitment.
You can help post jobs, find candidates, and manage the hiring process.
Be helpful in understanding role requirements.`,
  }

  return contexts[journey] || contexts.treasury
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
