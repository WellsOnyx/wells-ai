'use client'

/**
 * VoiceOutput Component
 *
 * Audio playback component for AI responses.
 * Supports auto-play and playback controls.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw, Loader2 } from 'lucide-react'

export interface VoiceOutputProps {
  /** Text to convert to speech */
  text?: string
  /** Pre-generated audio URL or base64 data */
  audioSrc?: string
  /** Audio data as base64 string */
  audioBase64?: string
  /** Voice to use for TTS */
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  /** Speech speed (0.25-4.0) */
  speed?: number
  /** Auto-play audio when loaded */
  autoPlay?: boolean
  /** Show playback controls */
  showControls?: boolean
  /** Called when playback starts */
  onPlayStart?: () => void
  /** Called when playback ends */
  onPlayEnd?: () => void
  /** Called on error */
  onError?: (error: string) => void
  /** Theme variant */
  variant?: 'light' | 'dark'
  /** Compact mode (smaller controls) */
  compact?: boolean
  /** Custom className */
  className?: string
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended'

export default function VoiceOutput({
  text,
  audioSrc,
  audioBase64,
  voice = 'nova',
  speed = 1.0,
  autoPlay = false,
  showControls = true,
  onPlayStart,
  onPlayEnd,
  onError,
  variant = 'light',
  compact = false,
  className = '',
}: VoiceOutputProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Generate audio from text
  const generateAudio = useCallback(async () => {
    if (!text) return null

    setPlaybackState('loading')

    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate speech')
      }

      const audioBlob = await response.blob()
      return URL.createObjectURL(audioBlob)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate audio'
      onError?.(errorMessage)
      setPlaybackState('idle')
      return null
    }
  }, [text, voice, speed, onError])

  // Initialize audio source
  useEffect(() => {
    let mounted = true

    const initAudio = async () => {
      // Priority: audioBase64 > audioSrc > generate from text
      if (audioBase64) {
        const url = `data:audio/mpeg;base64,${audioBase64}`
        if (mounted) setAudioUrl(url)
      } else if (audioSrc) {
        if (mounted) setAudioUrl(audioSrc)
      } else if (text) {
        const url = await generateAudio()
        if (mounted && url) setAudioUrl(url)
      }
    }

    initAudio()

    return () => {
      mounted = false
      if (audioUrl && !audioSrc && !audioBase64) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [text, audioSrc, audioBase64, generateAudio])

  // Auto-play when audio is ready
  useEffect(() => {
    if (autoPlay && audioUrl && playbackState === 'idle') {
      play()
    }
  }, [autoPlay, audioUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Play audio
  const play = useCallback(async () => {
    if (!audioUrl) {
      if (text) {
        const url = await generateAudio()
        if (url) {
          setAudioUrl(url)
          // Will auto-play due to effect
        }
      }
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.volume = isMuted ? 0 : volume

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration)
        }
      }

      audioRef.current.onended = () => {
        setPlaybackState('ended')
        setCurrentTime(0)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
        onPlayEnd?.()
      }

      audioRef.current.onerror = () => {
        onError?.('Failed to play audio')
        setPlaybackState('idle')
      }
    } else {
      audioRef.current.src = audioUrl
    }

    try {
      await audioRef.current.play()
      setPlaybackState('playing')
      onPlayStart?.()

      // Update progress
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      }, 100)
    } catch (err) {
      onError?.('Playback failed')
      setPlaybackState('idle')
    }
  }, [audioUrl, text, isMuted, volume, generateAudio, onPlayStart, onPlayEnd, onError])

  // Pause audio
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setPlaybackState('paused')
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (playbackState === 'playing') {
      pause()
    } else {
      play()
    }
  }, [playbackState, play, pause])

  // Restart playback
  const restart = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      play()
    }
  }, [play])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume
    }
  }, [isMuted, volume])

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }, [])

  // Handle seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }, [])

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isDark = variant === 'dark'
  const buttonSize = compact ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5'

  if (!showControls) {
    // Hidden audio player for auto-play only
    return null
  }

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl
        ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}
        border ${className}
      `}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlayback}
        disabled={playbackState === 'loading'}
        className={`
          ${buttonSize} rounded-full flex items-center justify-center
          transition-all duration-200
          ${
            playbackState === 'loading'
              ? isDark
                ? 'bg-gray-700 text-gray-500'
                : 'bg-gray-200 text-gray-400'
              : isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
          }
        `}
        aria-label={playbackState === 'playing' ? 'Pause' : 'Play'}
      >
        {playbackState === 'loading' ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : playbackState === 'playing' ? (
          <Pause className={iconSize} />
        ) : (
          <Play className={iconSize} />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={`
            flex-1 h-1 rounded-full appearance-none cursor-pointer
            ${isDark ? 'bg-white/10' : 'bg-gray-200'}
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:${isDark ? 'bg-white' : 'bg-gray-700'}
          `}
          style={{
            background: `linear-gradient(to right, ${
              isDark ? '#fff' : '#374151'
            } ${(currentTime / (duration || 1)) * 100}%, ${
              isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'
            } ${(currentTime / (duration || 1)) * 100}%)`,
          }}
        />
        <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Restart button */}
      {playbackState === 'ended' && (
        <button
          onClick={restart}
          className={`
            p-2 rounded-lg transition-all
            ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}
          `}
          aria-label="Restart"
        >
          <RotateCcw className={iconSize} />
        </button>
      )}

      {/* Volume control */}
      {!compact && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`
              p-2 rounded-lg transition-all
              ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}
            `}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className={iconSize} />
            ) : (
              <Volume2 className={iconSize} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className={`
              w-16 h-1 rounded-full appearance-none cursor-pointer
              ${isDark ? 'bg-white/10' : 'bg-gray-200'}
            `}
          />
        </div>
      )}
    </div>
  )
}
