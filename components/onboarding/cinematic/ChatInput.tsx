'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatInputProps {
  onSubmit: (message: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export function ChatInput({
  onSubmit,
  placeholder = "Type your message...",
  disabled = false,
  autoFocus = false,
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSubmit(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`
    }
  }, [message])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`relative ${className}`}
    >
      <div
        className={`
          relative flex items-end gap-3 p-3 rounded-2xl
          bg-white/5 backdrop-blur-xl
          border transition-all duration-300
          ${isFocused
            ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
            : 'border-white/10 hover:border-white/20'
          }
        `}
        style={{
          boxShadow: isFocused
            ? '0 0 30px rgba(245, 158, 11, 0.1), inset 0 0 20px rgba(255, 255, 255, 0.02)'
            : '0 4px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Input field */}
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={`
            flex-1 bg-transparent text-white placeholder-gray-500
            text-base md:text-lg leading-relaxed resize-none
            focus:outline-none
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ minHeight: '28px', maxHeight: '150px' }}
        />

        {/* Send button */}
        <AnimatePresence>
          {message.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSubmit}
              disabled={disabled}
              className={`
                flex-shrink-0 p-2.5 rounded-xl
                bg-gradient-to-r from-amber-500 to-orange-600
                text-white transition-all duration-200
                hover:from-amber-400 hover:to-orange-500
                hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              `}
            >
              <SendIcon className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Microphone button (placeholder for voice) */}
        {!message.trim() && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className="flex-shrink-0 p-2.5 text-gray-500 hover:text-gray-300 transition-colors cursor-not-allowed"
            title="Voice input coming soon"
            disabled
          >
            <MicrophoneIcon className="w-5 h-5" />
          </motion.button>
        )}
      </div>

      {/* Ambient glow effect */}
      <div
        className={`
          absolute -inset-2 rounded-3xl opacity-0 -z-10 transition-opacity duration-500
          ${isFocused ? 'opacity-100' : ''}
        `}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Keyboard hint */}
      <AnimatePresence>
        {isFocused && message.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute -bottom-6 right-0 text-xs text-gray-500"
          >
            Press Enter to send
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Send Icon
function SendIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  )
}

// Microphone Icon
function MicrophoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  )
}

// Floating input variant for minimal UI
export function FloatingChatInput({
  onSubmit,
  placeholder = "Just tell me what you need...",
  disabled = false,
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSubmit(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${className}`}
    >
      <div
        className={`
          relative flex items-center gap-4 px-6 py-4 rounded-full
          bg-black/40 backdrop-blur-2xl
          border-2 transition-all duration-500
          ${isFocused
            ? 'border-amber-500/60 shadow-2xl shadow-amber-500/20'
            : 'border-white/10 hover:border-white/20'
          }
        `}
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            flex-1 bg-transparent text-white placeholder-gray-400
            text-lg focus:outline-none
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />

        <AnimatePresence>
          {message.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
              onClick={handleSubmit}
              disabled={disabled}
              className={`
                flex-shrink-0 p-3 rounded-full
                bg-gradient-to-r from-amber-500 to-orange-600
                text-white transition-all duration-200
                hover:from-amber-400 hover:to-orange-500
                hover:scale-110 hover:shadow-lg hover:shadow-amber-500/30
              `}
            >
              <ArrowRightIcon className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Dramatic glow effect */}
      <motion.div
        className="absolute -inset-4 rounded-full -z-10"
        animate={{
          opacity: isFocused ? 1 : 0.3,
        }}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.15) 0%, transparent 60%)',
        }}
      />
    </motion.div>
  )
}

// Arrow Right Icon
function ArrowRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  )
}
