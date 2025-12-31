/**
 * Voice Module Index
 *
 * Export all voice-related functionality for easy importing
 */

// Speech-to-Text
export {
  transcribeAudio,
  detectLanguage,
  createWebSpeechConfig,
  isValidAudioFormat,
  estimateAudioDuration,
  getAudioMimeType,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_LANGUAGES,
} from './speech-to-text'

export type {
  AudioFormat,
  SupportedLanguage,
  TranscriptionOptions,
  TranscriptionResult,
} from './speech-to-text'

// Text-to-Speech
export {
  generateSpeech,
  streamSpeech,
  generateSpeechURL,
  splitTextForTTS,
  generateLongSpeech,
  suggestVoice,
  VOICES,
  VOICE_DESCRIPTIONS,
  OUTPUT_FORMATS,
  TTS_MODELS,
} from './text-to-speech'

export type {
  Voice,
  OutputFormat,
  TTSModel,
  SpeechOptions,
  SpeechResult,
} from './text-to-speech'

// Voice Assistant
export {
  processVoiceInput,
  speakResponse,
  streamResponse,
  handleVoiceConversation,
  VoiceAssistantSession,
  detectWakeWord,
  parseVoiceCommand,
  getVoiceHelpText,
} from './voice-assistant'

export type {
  VoiceConversationOptions,
  VoiceInput,
  VoiceResponse,
  ProcessedVoiceInput,
} from './voice-assistant'
