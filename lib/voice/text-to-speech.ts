/**
 * Text-to-Speech Module
 *
 * Converts text to natural speech using OpenAI TTS API.
 * Supports multiple voices and speech speeds.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Available voices
export const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
export type Voice = typeof VOICES[number]

// Voice characteristics for UI display
export const VOICE_DESCRIPTIONS: Record<Voice, { name: string; description: string; gender: string }> = {
  alloy: { name: 'Alloy', description: 'Neutral and balanced', gender: 'neutral' },
  echo: { name: 'Echo', description: 'Warm and engaging', gender: 'male' },
  fable: { name: 'Fable', description: 'Expressive and British', gender: 'male' },
  onyx: { name: 'Onyx', description: 'Deep and authoritative', gender: 'male' },
  nova: { name: 'Nova', description: 'Friendly and upbeat', gender: 'female' },
  shimmer: { name: 'Shimmer', description: 'Clear and pleasant', gender: 'female' },
}

// Audio output formats
export const OUTPUT_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

// TTS Models
export const TTS_MODELS = ['tts-1', 'tts-1-hd'] as const
export type TTSModel = typeof TTS_MODELS[number]

export interface SpeechOptions {
  /** Voice to use */
  voice?: Voice
  /** Speech speed (0.25 to 4.0, default 1.0) */
  speed?: number
  /** Output format */
  format?: OutputFormat
  /** Model to use (tts-1 for speed, tts-1-hd for quality) */
  model?: TTSModel
}

export interface SpeechResult {
  /** Audio data as Buffer */
  audioBuffer: Buffer
  /** Audio format */
  format: OutputFormat
  /** Content type for HTTP response */
  contentType: string
  /** Approximate duration in seconds */
  estimatedDuration: number
}

/**
 * Generate speech audio from text
 *
 * @param text - Text to convert to speech
 * @param options - Speech generation options
 * @returns Speech result with audio buffer and metadata
 */
export async function generateSpeech(
  text: string,
  options: SpeechOptions = {}
): Promise<SpeechResult> {
  const {
    voice = 'nova',
    speed = 1.0,
    format = 'mp3',
    model = 'tts-1',
  } = options

  // Validate speed range
  const clampedSpeed = Math.max(0.25, Math.min(4.0, speed))

  // Validate text length (OpenAI limit is 4096 characters)
  if (text.length > 4096) {
    throw new Error('Text exceeds maximum length of 4096 characters')
  }

  try {
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed: clampedSpeed,
      response_format: format,
    })

    // Convert response to buffer
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    return {
      audioBuffer,
      format,
      contentType: getContentType(format),
      estimatedDuration: estimateSpeechDuration(text, clampedSpeed),
    }
  } catch (error) {
    console.error('TTS generation error:', error)
    throw new Error(`Speech generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Stream speech audio from text (for longer content)
 *
 * @param text - Text to convert to speech
 * @param options - Speech generation options
 * @returns ReadableStream of audio data
 */
export async function streamSpeech(
  text: string,
  options: SpeechOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    voice = 'nova',
    speed = 1.0,
    format = 'mp3',
    model = 'tts-1',
  } = options

  const clampedSpeed = Math.max(0.25, Math.min(4.0, speed))

  try {
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed: clampedSpeed,
      response_format: format,
    })

    // Return the response body as a stream
    return response.body as unknown as ReadableStream<Uint8Array>
  } catch (error) {
    console.error('TTS streaming error:', error)
    throw new Error(`Speech streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate speech URL for direct playback
 * Creates a data URL from the audio buffer
 *
 * @param text - Text to convert to speech
 * @param options - Speech generation options
 * @returns Data URL for audio playback
 */
export async function generateSpeechURL(
  text: string,
  options: SpeechOptions = {}
): Promise<string> {
  const result = await generateSpeech(text, options)
  const base64 = result.audioBuffer.toString('base64')
  return `data:${result.contentType};base64,${base64}`
}

/**
 * Split long text into chunks for processing
 * Respects sentence boundaries for natural speech
 *
 * @param text - Text to split
 * @param maxLength - Maximum chunk length (default 4000)
 * @returns Array of text chunks
 */
export function splitTextForTTS(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  let currentChunk = ''

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Generate speech for long text (handles chunking automatically)
 *
 * @param text - Long text to convert
 * @param options - Speech generation options
 * @returns Array of audio buffers
 */
export async function generateLongSpeech(
  text: string,
  options: SpeechOptions = {}
): Promise<SpeechResult[]> {
  const chunks = splitTextForTTS(text)
  const results: SpeechResult[] = []

  for (const chunk of chunks) {
    const result = await generateSpeech(chunk, options)
    results.push(result)
  }

  return results
}

/**
 * Get content type for audio format
 */
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

/**
 * Estimate speech duration based on text and speed
 *
 * @param text - Input text
 * @param speed - Speech speed
 * @returns Estimated duration in seconds
 */
function estimateSpeechDuration(text: string, speed: number = 1.0): number {
  // Average speaking rate: ~150 words per minute
  const words = text.split(/\s+/).length
  const baseMinutes = words / 150
  const adjustedMinutes = baseMinutes / speed
  return adjustedMinutes * 60
}

/**
 * Get the best voice for a given context
 * Helper function for automatic voice selection
 */
export function suggestVoice(context: {
  formality?: 'casual' | 'formal' | 'professional'
  gender?: 'male' | 'female' | 'neutral'
  energy?: 'calm' | 'energetic' | 'neutral'
}): Voice {
  const { formality = 'professional', gender = 'neutral', energy = 'neutral' } = context

  if (formality === 'professional' || formality === 'formal') {
    if (gender === 'male') return 'onyx'
    if (gender === 'female') return 'shimmer'
    return 'alloy'
  }

  if (energy === 'energetic') {
    return 'nova'
  }

  if (gender === 'male') {
    return formality === 'casual' ? 'echo' : 'fable'
  }

  return 'nova'
}
