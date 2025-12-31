/**
 * Voice Transcription API
 *
 * POST /api/voice/transcribe
 * Accept audio file, return text transcription using OpenAI Whisper
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { transcribeAudio, isValidAudioFormat, SUPPORTED_AUDIO_FORMATS } from '@/lib/voice/speech-to-text'

// Maximum file size: 25MB (Whisper limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024

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
        { error: 'No audio file provided', details: 'Please upload an audio file with the key "audio"' },
        { status: 400 }
      )
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Validate file format
    const fileName = audioFile.name || 'audio.webm'
    if (!isValidAudioFormat(fileName)) {
      return NextResponse.json(
        {
          error: 'Unsupported audio format',
          details: `Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Get optional parameters
    const language = formData.get('language') as string | null
    const prompt = formData.get('prompt') as string | null

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Transcribe audio
    const startTime = Date.now()
    const result = await transcribeAudio(buffer, {
      language: language as any,
      prompt: prompt || undefined,
      responseFormat: 'verbose_json',
    })

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      transcription: {
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
        words: result.words,
      },
      metadata: {
        processingTimeMs: processingTime,
        audioSizeBytes: audioFile.size,
        fileName: fileName,
      },
    })
  } catch (error) {
    console.error('Transcription error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid file format')) {
        return NextResponse.json(
          { error: 'Invalid audio file', details: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limited', details: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Transcription failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
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
