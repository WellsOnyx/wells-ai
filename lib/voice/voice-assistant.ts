/**
 * Voice Assistant Logic
 *
 * Orchestrates the full voice conversation flow:
 * 1. Transcribe user audio input
 * 2. Process with AI to get response
 * 3. Convert response to speech
 */

import { transcribeAudio, TranscriptionResult, TranscriptionOptions } from './speech-to-text'
import { generateSpeech, streamSpeech, SpeechResult, SpeechOptions, Voice, VOICES } from './text-to-speech'

// Re-export for convenience
export { Voice, VOICES }

export interface VoiceConversationOptions {
  /** Voice for AI responses */
  voice?: Voice
  /** Speech speed */
  speed?: number
  /** Language hint for transcription */
  language?: string
  /** Journey context for AI */
  journey?: 'treasury' | 'sourcing' | 'sales' | 'hiring'
  /** User ID for personalization */
  userId?: string
}

export interface VoiceInput {
  /** Audio data as Buffer or Blob */
  audio: Buffer | Blob
  /** Optional transcription options */
  transcriptionOptions?: TranscriptionOptions
}

export interface VoiceResponse {
  /** Transcribed user input */
  transcription: TranscriptionResult
  /** AI text response */
  textResponse: string
  /** Audio response */
  audioResponse: SpeechResult
}

export interface ProcessedVoiceInput {
  /** Transcription of user speech */
  transcription: TranscriptionResult
  /** Timestamp */
  timestamp: Date
  /** Processing duration in ms */
  processingTime: number
}

/**
 * Process voice input: transcribe audio to text
 *
 * @param input - Voice input with audio data
 * @returns Transcription result
 */
export async function processVoiceInput(input: VoiceInput): Promise<ProcessedVoiceInput> {
  const startTime = Date.now()

  const transcription = await transcribeAudio(input.audio, input.transcriptionOptions)

  return {
    transcription,
    timestamp: new Date(),
    processingTime: Date.now() - startTime,
  }
}

/**
 * Convert text response to speech
 *
 * @param text - Text to speak
 * @param options - Speech options
 * @returns Speech result with audio buffer
 */
export async function speakResponse(
  text: string,
  options: SpeechOptions = {}
): Promise<SpeechResult> {
  return generateSpeech(text, {
    voice: options.voice || 'nova',
    speed: options.speed || 1.0,
    format: options.format || 'mp3',
    model: options.model || 'tts-1',
  })
}

/**
 * Stream text response as speech
 *
 * @param text - Text to speak
 * @param options - Speech options
 * @returns ReadableStream of audio data
 */
export async function streamResponse(
  text: string,
  options: SpeechOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  return streamSpeech(text, options)
}

/**
 * Full voice conversation flow
 * Handles transcription, AI processing, and speech synthesis
 *
 * @param audio - User's audio input
 * @param getAIResponse - Function to get AI response from text
 * @param options - Conversation options
 * @returns Complete voice response
 */
export async function handleVoiceConversation(
  audio: Buffer | Blob,
  getAIResponse: (text: string, context?: { journey?: string; userId?: string }) => Promise<string>,
  options: VoiceConversationOptions = {}
): Promise<VoiceResponse> {
  // 1. Transcribe audio
  const transcription = await transcribeAudio(audio, {
    language: options.language as any,
  })

  // 2. Get AI response
  const textResponse = await getAIResponse(transcription.text, {
    journey: options.journey,
    userId: options.userId,
  })

  // 3. Generate speech
  const audioResponse = await generateSpeech(textResponse, {
    voice: options.voice || 'nova',
    speed: options.speed || 1.0,
  })

  return {
    transcription,
    textResponse,
    audioResponse,
  }
}

/**
 * Create a voice assistant session
 * Manages state for ongoing voice conversations
 */
export class VoiceAssistantSession {
  private conversationHistory: Array<{
    role: 'user' | 'assistant'
    text: string
    timestamp: Date
  }> = []

  private options: VoiceConversationOptions

  constructor(options: VoiceConversationOptions = {}) {
    this.options = {
      voice: options.voice || 'nova',
      speed: options.speed || 1.0,
      language: options.language || 'en',
      journey: options.journey,
      userId: options.userId,
    }
  }

  /**
   * Add a message to conversation history
   */
  addMessage(role: 'user' | 'assistant', text: string) {
    this.conversationHistory.push({
      role,
      text,
      timestamp: new Date(),
    })
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.conversationHistory]
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = []
  }

  /**
   * Get formatted context for AI
   */
  getContext(): string {
    return this.conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n')
  }

  /**
   * Update session options
   */
  updateOptions(options: Partial<VoiceConversationOptions>) {
    this.options = { ...this.options, ...options }
  }

  /**
   * Get current voice setting
   */
  getVoice(): Voice {
    return this.options.voice || 'nova'
  }

  /**
   * Get session options
   */
  getOptions(): VoiceConversationOptions {
    return { ...this.options }
  }
}

/**
 * Detect wake word in transcription
 * Useful for voice-activated assistants
 *
 * @param text - Transcribed text
 * @param wakeWords - Array of wake words to detect
 * @returns Whether wake word was detected and the command after it
 */
export function detectWakeWord(
  text: string,
  wakeWords: string[] = ['hey wells', 'ok wells', 'wells']
): { detected: boolean; command: string } {
  const lowerText = text.toLowerCase().trim()

  for (const wakeWord of wakeWords) {
    const wakeWordLower = wakeWord.toLowerCase()
    if (lowerText.startsWith(wakeWordLower)) {
      const command = text.slice(wakeWord.length).trim()
      return { detected: true, command: command || text }
    }
  }

  return { detected: false, command: text }
}

/**
 * Parse voice commands for common actions
 */
export function parseVoiceCommand(text: string): {
  intent: 'send' | 'check' | 'find' | 'show' | 'help' | 'unknown'
  entities: Record<string, string>
} {
  const lowerText = text.toLowerCase()

  // Send/transfer patterns
  if (/\b(send|transfer|pay)\b/.test(lowerText)) {
    const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|usd|\$|grain)?/)
    const toMatch = lowerText.match(/to\s+(\w+(?:\s+\w+)?)/i)
    return {
      intent: 'send',
      entities: {
        amount: amountMatch?.[1] || '',
        recipient: toMatch?.[1] || '',
      },
    }
  }

  // Check/balance patterns
  if (/\b(check|what'?s?|balance|how much)\b/.test(lowerText)) {
    return {
      intent: 'check',
      entities: {},
    }
  }

  // Find/search patterns
  if (/\b(find|search|look for|locate)\b/.test(lowerText)) {
    const targetMatch = lowerText.match(/(?:find|search|look for|locate)\s+(.+)/i)
    return {
      intent: 'find',
      entities: {
        target: targetMatch?.[1] || '',
      },
    }
  }

  // Show/display patterns
  if (/\b(show|display|view|see)\b/.test(lowerText)) {
    const targetMatch = lowerText.match(/(?:show|display|view|see)\s+(?:me\s+)?(.+)/i)
    return {
      intent: 'show',
      entities: {
        target: targetMatch?.[1] || '',
      },
    }
  }

  // Help patterns
  if (/\b(help|assist|what can you do)\b/.test(lowerText)) {
    return {
      intent: 'help',
      entities: {},
    }
  }

  return {
    intent: 'unknown',
    entities: {},
  }
}

/**
 * Generate help response for voice commands
 */
export function getVoiceHelpText(): string {
  return `I can help you with several things. You can say:
    - "Check my balance" to see your GRAIN balance
    - "Send 100 dollars to John" to transfer money
    - "Find suppliers for motors" to search for suppliers
    - "Show my transactions" to view recent activity
    - "Help" to hear these options again
    Just speak naturally and I'll understand!`
}
