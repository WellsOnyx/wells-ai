/**
 * Text-to-Speech API
 *
 * POST /api/voice/speak
 * Accept text, return audio file using OpenAI TTS
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  generateSpeech,
  streamSpeech,
  VOICES,
  Voice,
  OUTPUT_FORMATS,
  OutputFormat,
} from '@/lib/voice/text-to-speech'

// Maximum text length: 4096 characters (OpenAI limit)
const MAX_TEXT_LENGTH = 4096

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

    // Parse request body
    const body = await req.json()
    const { text, voice, speed, format, stream } = body

    // Validate text
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing text', details: 'Please provide text to convert to speech' },
        { status: 400 }
      )
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: 'Text too long', details: `Maximum text length is ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Validate voice
    const selectedVoice: Voice = VOICES.includes(voice) ? voice : 'nova'

    // Validate format
    const selectedFormat: OutputFormat = OUTPUT_FORMATS.includes(format) ? format : 'mp3'

    // Validate speed
    const selectedSpeed = typeof speed === 'number'
      ? Math.max(0.25, Math.min(4.0, speed))
      : 1.0

    // Handle streaming response
    if (stream) {
      const audioStream = await streamSpeech(text, {
        voice: selectedVoice,
        speed: selectedSpeed,
        format: selectedFormat,
      })

      return new NextResponse(audioStream, {
        headers: {
          'Content-Type': getContentType(selectedFormat),
          'Transfer-Encoding': 'chunked',
          'X-Voice': selectedVoice,
          'X-Speed': selectedSpeed.toString(),
        },
      })
    }

    // Generate speech
    const startTime = Date.now()
    const result = await generateSpeech(text, {
      voice: selectedVoice,
      speed: selectedSpeed,
      format: selectedFormat,
    })

    const processingTime = Date.now() - startTime

    // Return audio as binary response
    return new NextResponse(result.audioBuffer, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length.toString(),
        'X-Processing-Time-Ms': processingTime.toString(),
        'X-Estimated-Duration': result.estimatedDuration.toString(),
        'X-Voice': selectedVoice,
        'X-Speed': selectedSpeed.toString(),
      },
    })
  } catch (error) {
    console.error('TTS error:', error)

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limited', details: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Speech generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint for simple text-to-speech with query params
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const text = searchParams.get('text')
    const voice = searchParams.get('voice') as Voice | null
    const speed = searchParams.get('speed')
    const format = searchParams.get('format') as OutputFormat | null

    if (!text) {
      return NextResponse.json(
        { error: 'Missing text parameter' },
        { status: 400 }
      )
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: 'Text too long', details: `Maximum length is ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      )
    }

    const selectedVoice: Voice = voice && VOICES.includes(voice) ? voice : 'nova'
    const selectedFormat: OutputFormat = format && OUTPUT_FORMATS.includes(format) ? format : 'mp3'
    const selectedSpeed = speed ? Math.max(0.25, Math.min(4.0, parseFloat(speed))) : 1.0

    const result = await generateSpeech(text, {
      voice: selectedVoice,
      speed: selectedSpeed,
      format: selectedFormat,
    })

    return new NextResponse(result.audioBuffer, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length.toString(),
        'Content-Disposition': `inline; filename="speech.${selectedFormat}"`,
      },
    })
  } catch (error) {
    console.error('TTS GET error:', error)
    return NextResponse.json(
      { error: 'Speech generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function getContentType(format: OutputFormat): string {
  const contentTypes: Record<OutputFormat, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/pcm',
  }
  return contentTypes[format]
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
