'use client'

/**
 * VoiceInput Component
 *
 * Microphone button with recording indicator.
 * Uses MediaRecorder API for audio capture.
 * Supports real-time transcription display.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Loader2, Square, AlertCircle } from 'lucide-react'

export interface VoiceInputProps {
  /** Called when transcription is complete */
  onTranscription: (text: string, metadata?: TranscriptionMetadata) => void
  /** Called when recording starts */
  onRecordingStart?: () => void
  /** Called when recording stops */
  onRecordingStop?: () => void
  /** Called on error */
  onError?: (error: string) => void
  /** Optional language hint */
  language?: string
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Theme variant */
  variant?: 'light' | 'dark'
  /** Whether the component is disabled */
  disabled?: boolean
  /** Show real-time transcription (uses Web Speech API) */
  showLiveTranscript?: boolean
  /** Custom className */
  className?: string
  /** Maximum recording duration in seconds */
  maxDuration?: number
}

export interface TranscriptionMetadata {
  duration?: number
  language?: string
  processingTimeMs?: number
}

type RecordingState = 'idle' | 'recording' | 'processing'

export default function VoiceInput({
  onTranscription,
  onRecordingStart,
  onRecordingStop,
  onError,
  language = 'en',
  size = 'md',
  variant = 'light',
  disabled = false,
  showLiveTranscript = false,
  className = '',
  maxDuration = 60,
}: VoiceInputProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const speechRecognitionRef = useRef<any>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      audioChunksRef.current = []

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream

      // Setup audio analysis for visualization
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Animate audio level
      const updateAudioLevel = () => {
        if (!analyserRef.current) return
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      updateAudioLevel()

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        await processRecording()
      }

      mediaRecorder.start(100) // Collect data every 100ms

      // Start duration timer
      setRecordingDuration(0)
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)

      setRecordingState('recording')
      onRecordingStart?.()

      // Setup Web Speech API for live transcription
      if (showLiveTranscript && 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = language

        recognition.onresult = (event: any) => {
          let transcript = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          setLiveTranscript(transcript)
        }

        recognition.onerror = () => {
          // Silently fail - live transcript is optional
        }

        recognition.start()
        speechRecognitionRef.current = recognition
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone'
      setError(errorMessage)
      onError?.(errorMessage)
      setRecordingState('idle')
    }
  }, [language, maxDuration, onError, onRecordingStart, showLiveTranscript])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop()
      speechRecognitionRef.current = null
    }

    setAudioLevel(0)
    onRecordingStop?.()
  }, [recordingState, onRecordingStop])

  // Process recorded audio
  const processRecording = async () => {
    setRecordingState('processing')

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioChunksRef.current[0]?.type || 'audio/webm',
      })

      // Create form data for API
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      if (language) {
        formData.append('language', language)
      }

      // Send to transcription API
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Transcription failed')
      }

      const data = await response.json()

      onTranscription(data.transcription.text, {
        duration: data.transcription.duration,
        language: data.transcription.language,
        processingTimeMs: data.metadata.processingTimeMs,
      })

      setLiveTranscript('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setRecordingState('idle')
      audioChunksRef.current = []
    }
  }

  // Toggle recording
  const toggleRecording = () => {
    if (disabled) return

    if (recordingState === 'idle') {
      startRecording()
    } else if (recordingState === 'recording') {
      stopRecording()
    }
  }

  // Size configurations
  const sizeConfig = {
    sm: { button: 'w-10 h-10', icon: 'w-4 h-4', ring: 'w-12 h-12' },
    md: { button: 'w-14 h-14', icon: 'w-6 h-6', ring: 'w-16 h-16' },
    lg: { button: 'w-20 h-20', icon: 'w-8 h-8', ring: 'w-24 h-24' },
  }

  const config = sizeConfig[size]
  const isDark = variant === 'dark'

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Recording indicator ring */}
      <div className="relative">
        {recordingState === 'recording' && (
          <div
            className={`absolute inset-0 ${config.ring} -m-1 rounded-full transition-all duration-100`}
            style={{
              transform: `scale(${1 + audioLevel * 0.3})`,
              backgroundColor: isDark
                ? `rgba(239, 68, 68, ${0.2 + audioLevel * 0.3})`
                : `rgba(239, 68, 68, ${0.15 + audioLevel * 0.25})`,
            }}
          />
        )}

        {/* Main button */}
        <button
          onClick={toggleRecording}
          disabled={disabled || recordingState === 'processing'}
          className={`
            ${config.button}
            rounded-full flex items-center justify-center
            transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${
              recordingState === 'recording'
                ? isDark
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
                : recordingState === 'processing'
                  ? isDark
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-200 text-gray-500'
                  : isDark
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
            }
          `}
          aria-label={
            recordingState === 'recording'
              ? 'Stop recording'
              : recordingState === 'processing'
                ? 'Processing...'
                : 'Start recording'
          }
        >
          {recordingState === 'processing' ? (
            <Loader2 className={`${config.icon} animate-spin`} />
          ) : recordingState === 'recording' ? (
            <Square className={config.icon} />
          ) : (
            <Mic className={config.icon} />
          )}
        </button>
      </div>

      {/* Duration indicator */}
      {recordingState === 'recording' && (
        <div className={`text-sm font-mono ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          {formatDuration(recordingDuration)}
        </div>
      )}

      {/* Processing indicator */}
      {recordingState === 'processing' && (
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Transcribing...
        </div>
      )}

      {/* Live transcript */}
      {showLiveTranscript && liveTranscript && recordingState === 'recording' && (
        <div
          className={`
            max-w-xs text-center text-sm px-3 py-2 rounded-lg
            ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}
          `}
        >
          {liveTranscript}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  )
}
