'use client'

/**
 * VoiceAssistant Component
 *
 * Full voice assistant combining input and output.
 * Supports push-to-talk or voice activation.
 * Provides visual feedback during processing.
 * Integrates with existing chat functionality.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Loader2,
  Settings,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import VoiceInput from './VoiceInput'
import VoiceOutput from './VoiceOutput'

export interface VoiceAssistantProps {
  /** Journey context for AI responses */
  journey?: 'treasury' | 'sourcing' | 'sales' | 'hiring'
  /** Called when text transcription is complete (for chat integration) */
  onTranscription?: (text: string) => void
  /** Called when AI responds (text) */
  onResponse?: (text: string) => void
  /** Theme variant */
  variant?: 'light' | 'dark'
  /** Position of the assistant */
  position?: 'inline' | 'floating'
  /** Initial voice setting */
  defaultVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  /** Auto-play AI responses */
  autoPlayResponses?: boolean
  /** Show settings panel */
  showSettings?: boolean
  /** Custom className */
  className?: string
  /** Initial expanded state (for floating) */
  defaultExpanded?: boolean
}

type AssistantState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'speaking'
  | 'error'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  audioBase64?: string
  timestamp: Date
}

const VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', description: 'Warm and engaging' },
  { id: 'fable', name: 'Fable', description: 'Expressive' },
  { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
  { id: 'shimmer', name: 'Shimmer', description: 'Clear and pleasant' },
] as const

export default function VoiceAssistant({
  journey = 'treasury',
  onTranscription,
  onResponse,
  variant = 'light',
  position = 'inline',
  defaultVoice = 'nova',
  autoPlayResponses = true,
  showSettings = true,
  className = '',
  defaultExpanded = false,
}: VoiceAssistantProps) {
  const [state, setState] = useState<AssistantState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentAudio, setCurrentAudio] = useState<{
    text: string
    base64: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isMuted, setIsMuted] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice)
  const [showVoiceMenu, setShowVoiceMenu] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle voice input transcription
  const handleTranscription = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      setError(null)

      // Add user message
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        text: text.trim(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Notify parent
      onTranscription?.(text.trim())

      // Get AI response
      setState('processing')

      try {
        const formData = new FormData()
        // Create a blob from text for the API (it expects audio but we'll use text)
        // Actually, we need to send a new voice request
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            journey,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const data = await response.json()
        const aiText = data.message || data.response || "I'm on it."

        setState('responding')
        onResponse?.(aiText)

        // Generate speech for the response
        if (!isMuted) {
          setState('speaking')

          const ttsResponse = await fetch('/api/voice/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: aiText,
              voice: selectedVoice,
              speed: 1.0,
            }),
          })

          if (ttsResponse.ok) {
            const audioBlob = await ttsResponse.blob()
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1]

              const aiMessage: Message = {
                id: `msg_${Date.now()}_ai`,
                role: 'assistant',
                text: aiText,
                audioBase64: base64,
                timestamp: new Date(),
              }
              setMessages((prev) => [...prev, aiMessage])

              if (autoPlayResponses) {
                setCurrentAudio({ text: aiText, base64 })
              }

              setState('idle')
            }
            reader.readAsDataURL(audioBlob)
          } else {
            // Add message without audio
            const aiMessage: Message = {
              id: `msg_${Date.now()}_ai`,
              role: 'assistant',
              text: aiText,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, aiMessage])
            setState('idle')
          }
        } else {
          // Muted - just add text message
          const aiMessage: Message = {
            id: `msg_${Date.now()}_ai`,
            role: 'assistant',
            text: aiText,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiMessage])
          setState('idle')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setState('error')
        setTimeout(() => setState('idle'), 3000)
      }
    },
    [journey, selectedVoice, isMuted, autoPlayResponses, onTranscription, onResponse]
  )

  // Handle recording state changes
  const handleRecordingStart = useCallback(() => {
    setState('listening')
    setError(null)
  }, [])

  const handleRecordingStop = useCallback(() => {
    // State will be updated by handleTranscription
  }, [])

  const handleError = useCallback((error: string) => {
    setError(error)
    setState('error')
    setTimeout(() => setState('idle'), 3000)
  }, [])

  const isDark = variant === 'dark'

  // Floating position render
  if (position === 'floating') {
    return (
      <div
        className={`
          fixed bottom-6 right-6 z-50
          ${className}
        `}
      >
        {/* Expanded panel */}
        {isExpanded && (
          <div
            className={`
              absolute bottom-16 right-0 w-80 max-h-96 rounded-2xl shadow-xl overflow-hidden
              ${isDark ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-200'}
              border
            `}
          >
            {/* Header */}
            <div
              className={`
                flex items-center justify-between px-4 py-3 border-b
                ${isDark ? 'border-white/10' : 'border-gray-100'}
              `}
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}
                />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Voice Assistant
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  {isMuted ? (
                    <VolumeX className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  )}
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-48 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <div
                  className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tap the mic to start talking</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] px-3 py-2 rounded-2xl text-sm
                        ${
                          msg.role === 'user'
                            ? isDark
                              ? 'bg-emerald-600 text-white rounded-br-sm'
                              : 'bg-gray-900 text-white rounded-br-sm'
                            : isDark
                              ? 'bg-white/10 text-gray-200 rounded-bl-sm'
                              : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                        }
                      `}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Voice input */}
            <div
              className={`
                p-3 border-t flex items-center justify-center
                ${isDark ? 'border-white/10' : 'border-gray-100'}
              `}
            >
              <VoiceInput
                onTranscription={handleTranscription}
                onRecordingStart={handleRecordingStart}
                onRecordingStop={handleRecordingStop}
                onError={handleError}
                variant={variant}
                size="md"
                showLiveTranscript
                disabled={state === 'processing' || state === 'speaking'}
              />
            </div>

            {/* Status */}
            {state !== 'idle' && state !== 'listening' && (
              <div
                className={`
                  px-3 py-2 text-center text-xs
                  ${isDark ? 'text-gray-400 bg-white/5' : 'text-gray-500 bg-gray-50'}
                `}
              >
                {state === 'processing' && 'Thinking...'}
                {state === 'responding' && 'Generating response...'}
                {state === 'speaking' && 'Speaking...'}
                {state === 'error' && error}
              </div>
            )}
          </div>
        )}

        {/* Floating button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center
            transition-all duration-200
            ${
              state === 'listening'
                ? 'bg-red-500 hover:bg-red-600'
                : isDark
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-gray-900 hover:bg-gray-800'
            }
            text-white
          `}
        >
          {state === 'listening' ? (
            <div className="relative">
              <Mic className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          ) : state === 'processing' || state === 'speaking' ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>
    )
  }

  // Inline render
  return (
    <div
      className={`
        rounded-2xl overflow-hidden
        ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}
        border ${className}
      `}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-b
          ${isDark ? 'border-white/10' : 'border-gray-100'}
        `}
      >
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Voice Assistant
          </span>
          {state !== 'idle' && (
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full
                ${
                  state === 'listening'
                    ? 'bg-red-100 text-red-600'
                    : state === 'error'
                      ? 'bg-red-100 text-red-600'
                      : isDark
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-emerald-100 text-emerald-600'
                }
              `}
            >
              {state === 'listening' && 'Listening...'}
              {state === 'processing' && 'Processing...'}
              {state === 'responding' && 'Responding...'}
              {state === 'speaking' && 'Speaking...'}
              {state === 'error' && 'Error'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Voice selector */}
          {showSettings && (
            <div className="relative">
              <button
                onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-lg text-xs
                  ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}
                `}
              >
                <Settings className="w-3 h-3" />
                {VOICES.find((v) => v.id === selectedVoice)?.name}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showVoiceMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowVoiceMenu(false)}
                  />
                  <div
                    className={`
                      absolute top-full right-0 mt-1 w-48 rounded-lg shadow-lg z-20 py-1
                      ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'}
                      border
                    `}
                  >
                    {VOICES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoice(voice.id)
                          setShowVoiceMenu(false)
                        }}
                        className={`
                          w-full px-3 py-2 text-left text-sm
                          ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
                          ${selectedVoice === voice.id ? (isDark ? 'bg-white/5' : 'bg-gray-50') : ''}
                        `}
                      >
                        <div className={isDark ? 'text-white' : 'text-gray-900'}>{voice.name}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {voice.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1.5 rounded-lg transition-all ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
            }`}
          >
            {isMuted ? (
              <VolumeX className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            ) : (
              <Volume2 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-[200px] max-h-[300px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Tap the microphone to start talking</p>
            <p className="text-xs mt-1 opacity-75">I can help with {journey}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] px-4 py-2.5 rounded-2xl
                  ${
                    msg.role === 'user'
                      ? isDark
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-gray-900 text-white rounded-br-sm'
                      : isDark
                        ? 'bg-white/10 text-gray-200 rounded-bl-sm'
                        : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                  }
                `}
              >
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Current audio playback */}
      {currentAudio && !isMuted && (
        <div className={`px-4 pb-2 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
          <VoiceOutput
            audioBase64={currentAudio.base64}
            autoPlay
            variant={variant}
            compact
            onPlayEnd={() => setCurrentAudio(null)}
          />
        </div>
      )}

      {/* Voice input */}
      <div
        className={`
          p-4 border-t flex items-center justify-center
          ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}
        `}
      >
        <VoiceInput
          onTranscription={handleTranscription}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onError={handleError}
          variant={variant}
          size="lg"
          showLiveTranscript
          disabled={state === 'processing' || state === 'speaking'}
        />
      </div>

      {/* Error display */}
      {error && (
        <div
          className={`
            px-4 py-2 text-center text-sm
            ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}
          `}
        >
          {error}
        </div>
      )}
    </div>
  )
}
