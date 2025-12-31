'use client'

import { motion } from 'framer-motion'
import { WellsAvatar, WellsAvatarThinking } from './WellsAvatar'
import { TypewriterText } from './TypewriterText'

interface ChatBubbleProps {
  message: string
  isWells?: boolean
  isTyping?: boolean
  typewriterSpeed?: number
  typewriterDelay?: number
  onTypingComplete?: () => void
  className?: string
  showAvatar?: boolean
}

export function ChatBubble({
  message,
  isWells = true,
  isTyping = false,
  typewriterSpeed = 25,
  typewriterDelay = 0,
  onTypingComplete,
  className = '',
  showAvatar = true
}: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        delay: typewriterDelay / 1000
      }}
      className={`flex gap-3 ${isWells ? 'flex-row' : 'flex-row-reverse'} ${className}`}
    >
      {/* Avatar */}
      {showAvatar && isWells && (
        <div className="flex-shrink-0 pt-1">
          {isTyping ? (
            <WellsAvatarThinking size="sm" />
          ) : (
            <WellsAvatar size="sm" animate={false} pulse={false} />
          )}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`relative max-w-[80%] md:max-w-[70%] ${
          isWells ? '' : 'ml-auto'
        }`}
      >
        <div
          className={`
            px-5 py-4 rounded-2xl backdrop-blur-md
            ${isWells
              ? 'bg-white/5 border border-white/10 text-white/90'
              : 'bg-amber-500/20 border border-amber-500/30 text-white'
            }
          `}
          style={{
            boxShadow: isWells
              ? '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.02)'
              : '0 4px 30px rgba(245, 158, 11, 0.15), inset 0 0 20px rgba(245, 158, 11, 0.05)',
          }}
        >
          {isTyping ? (
            <TypewriterText
              text={message}
              speed={typewriterSpeed}
              delay={typewriterDelay}
              onComplete={onTypingComplete}
              className="text-base md:text-lg leading-relaxed"
            />
          ) : (
            <p className="text-base md:text-lg leading-relaxed">{message}</p>
          )}
        </div>

        {/* Subtle glow effect for Wells messages */}
        {isWells && (
          <div
            className="absolute -inset-1 rounded-2xl opacity-30 -z-10"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.1) 0%, transparent 70%)',
            }}
          />
        )}
      </div>
    </motion.div>
  )
}

// Thinking indicator bubble
export function ThinkingBubble({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex gap-3 ${className}`}
    >
      <div className="flex-shrink-0 pt-1">
        <WellsAvatarThinking size="sm" />
      </div>
      <div
        className="px-5 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10"
        style={{
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-500/60"
              animate={{
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// Quick action buttons that appear below messages
interface QuickAction {
  label: string
  value: string
  primary?: boolean
}

interface QuickActionsProps {
  actions: QuickAction[]
  onSelect: (value: string) => void
  className?: string
}

export function QuickActions({ actions, onSelect, className = '' }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className={`flex flex-wrap gap-2 pl-13 ${className}`}
    >
      {actions.map((action, index) => (
        <motion.button
          key={action.value}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + index * 0.1 }}
          onClick={() => onSelect(action.value)}
          className={`
            px-4 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200 ease-out
            ${action.primary
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-400 hover:to-orange-500 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25'
              : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white'
            }
          `}
        >
          {action.label}
        </motion.button>
      ))}
    </motion.div>
  )
}
