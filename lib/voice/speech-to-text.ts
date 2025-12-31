/**
 * Speech-to-Text Module
 *
 * Provides audio transcription using OpenAI Whisper API
 * with Web Speech API fallback for real-time streaming.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac'] as const
export type AudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number]

// Supported languages (subset of Whisper's capabilities)
export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh',
  'ar', 'tr', 'vi', 'th', 'id', 'hi', 'he', 'uk', 'cs', 'ro', 'da', 'fi',
  'no', 'sv', 'hu', 'el', 'sk', 'bg', 'lt', 'lv', 'sl', 'et', 'hr', 'sr',
] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export interface TranscriptionOptions {
  /** Language hint for transcription (ISO 639-1 code) */
  language?: SupportedLanguage
  /** Prompt to guide transcription style */
  prompt?: string
  /** Response format */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
  /** Temperature for transcription (0-1) */
  temperature?: number
}

export interface TranscriptionResult {
  /** Transcribed text */
  text: string
  /** Detected or specified language */
  language?: string
  /** Transcription duration in seconds */
  duration?: number
  /** Word-level timestamps (if verbose_json) */
  words?: Array<{
    word: string
    start: number
    end: number
  }>
  /** Segment-level data (if verbose_json) */
  segments?: Array<{
    id: number
    text: string
    start: number
    end: number
    confidence?: number
  }>
}

/**
 * Transcribe audio buffer using OpenAI Whisper API
 *
 * @param audioBuffer - Audio file as Buffer or Blob
 * @param options - Transcription options
 * @returns Transcription result with text and metadata
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Blob,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const {
    language,
    prompt,
    responseFormat = 'verbose_json',
    temperature = 0,
  } = options

  // Convert Buffer to File for OpenAI API
  let file: File
  if (audioBuffer instanceof Buffer) {
    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    file = new File([blob], 'audio.webm', { type: 'audio/webm' })
  } else {
    file = new File([audioBuffer], 'audio.webm', { type: audioBuffer.type })
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: language,
      prompt: prompt,
      response_format: responseFormat,
      temperature: temperature,
    })

    // Handle different response formats
    if (responseFormat === 'text' || typeof transcription === 'string') {
      return {
        text: transcription as string,
        language: language,
      }
    }

    // For verbose_json format
    const verboseResult = transcription as OpenAI.Audio.Transcription & {
      duration?: number
      language?: string
      words?: Array<{ word: string; start: number; end: number }>
      segments?: Array<{
        id: number
        text: string
        start: number
        end: number
        avg_logprob?: number
      }>
    }

    return {
      text: verboseResult.text,
      language: verboseResult.language || language,
      duration: verboseResult.duration,
      words: verboseResult.words,
      segments: verboseResult.segments?.map(seg => ({
        id: seg.id,
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
      })),
    }
  } catch (error) {
    console.error('Whisper transcription error:', error)
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Detect language from audio sample
 * Uses Whisper to transcribe and detect language
 *
 * @param audioBuffer - Audio file as Buffer or Blob
 * @returns Detected language code
 */
export async function detectLanguage(audioBuffer: Buffer | Blob): Promise<string> {
  const result = await transcribeAudio(audioBuffer, {
    responseFormat: 'verbose_json',
  })
  return result.language || 'en'
}

/**
 * Create a Web Speech API recognition instance for browser-based real-time transcription
 * This is a factory function that returns configuration for client-side use
 */
export function createWebSpeechConfig() {
  return {
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
    lang: 'en-US',
  }
}

/**
 * Validate audio file format
 *
 * @param filename - Name of the audio file
 * @returns Whether the format is supported
 */
export function isValidAudioFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() as AudioFormat
  return SUPPORTED_AUDIO_FORMATS.includes(ext)
}

/**
 * Get audio duration from buffer (approximate based on file size)
 * For accurate duration, use verbose_json response from transcription
 *
 * @param buffer - Audio buffer
 * @param format - Audio format
 * @returns Approximate duration in seconds
 */
export function estimateAudioDuration(buffer: Buffer, format: AudioFormat = 'webm'): number {
  // Rough estimation based on common bitrates
  const bitrates: Record<AudioFormat, number> = {
    wav: 1411000,  // 1411 kbps (CD quality)
    mp3: 128000,   // 128 kbps
    m4a: 128000,   // 128 kbps
    webm: 64000,   // 64 kbps
    ogg: 128000,   // 128 kbps
    flac: 1000000, // ~1000 kbps
  }

  const bytesPerSecond = bitrates[format] / 8
  return buffer.length / bytesPerSecond
}

/**
 * Convert audio format to MIME type
 */
export function getAudioMimeType(format: AudioFormat): string {
  const mimeTypes: Record<AudioFormat, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  }
  return mimeTypes[format] || 'audio/octet-stream'
}
