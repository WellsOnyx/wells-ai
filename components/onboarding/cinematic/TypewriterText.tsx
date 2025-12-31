'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  speed?: number
  delay?: number
  onComplete?: () => void
  className?: string
  cursor?: boolean
  cursorColor?: string
}

export function TypewriterText({
  text,
  speed = 40,
  delay = 0,
  onComplete,
  className = '',
  cursor = true,
  cursorColor = 'bg-amber-500'
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (delay > 0 && !hasStarted) {
      const delayTimer = setTimeout(() => {
        setHasStarted(true)
      }, delay)
      return () => clearTimeout(delayTimer)
    } else {
      setHasStarted(true)
    }
  }, [delay, hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1))
      }, speed)
      return () => clearTimeout(timer)
    } else if (!isComplete) {
      setIsComplete(true)
      onComplete?.()
    }
  }, [displayedText, text, speed, onComplete, isComplete, hasStarted])

  return (
    <span className={className}>
      {displayedText}
      {cursor && !isComplete && (
        <motion.span
          className={`inline-block w-0.5 h-[1em] ${cursorColor} ml-0.5 align-middle`}
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        />
      )}
    </span>
  )
}

// Sequence of texts that appear one after another
interface TypewriterSequenceProps {
  texts: Array<{
    text: string
    className?: string
    delay?: number
    speed?: number
  }>
  onSequenceComplete?: () => void
  className?: string
}

export function TypewriterSequence({
  texts,
  onSequenceComplete,
  className = ''
}: TypewriterSequenceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedTexts, setCompletedTexts] = useState<string[]>([])

  const handleTextComplete = useCallback(() => {
    if (currentIndex < texts.length - 1) {
      setCompletedTexts((prev) => [...prev, texts[currentIndex].text])
      setCurrentIndex((prev) => prev + 1)
    } else {
      onSequenceComplete?.()
    }
  }, [currentIndex, texts, onSequenceComplete])

  return (
    <div className={className}>
      {completedTexts.map((text, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.7 }}
          className={texts[idx]?.className}
        >
          {text}
        </motion.div>
      ))}
      {currentIndex < texts.length && (
        <TypewriterText
          text={texts[currentIndex].text}
          speed={texts[currentIndex].speed}
          delay={texts[currentIndex].delay}
          onComplete={handleTextComplete}
          className={texts[currentIndex].className}
          cursor={true}
        />
      )}
    </div>
  )
}

// Cinematic text reveal with fade-in line by line
interface CinematicTextProps {
  lines: string[]
  lineDelay?: number
  onComplete?: () => void
  className?: string
  lineClassName?: string
}

export function CinematicText({
  lines,
  lineDelay = 800,
  onComplete,
  className = '',
  lineClassName = ''
}: CinematicTextProps) {
  const [visibleLines, setVisibleLines] = useState<number[]>([])

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    lines.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, index])
        if (index === lines.length - 1) {
          setTimeout(() => onComplete?.(), 500)
        }
      }, index * lineDelay)
      timers.push(timer)
    })

    return () => timers.forEach(clearTimeout)
  }, [lines, lineDelay, onComplete])

  return (
    <div className={className}>
      <AnimatePresence>
        {lines.map((line, index) =>
          visibleLines.includes(index) ? (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={lineClassName}
            >
              {line}
            </motion.div>
          ) : null
        )}
      </AnimatePresence>
    </div>
  )
}

// Wells-style message that types out with a subtle glow
interface WellsMessageProps {
  message: string
  delay?: number
  speed?: number
  onComplete?: () => void
}

export function WellsMessage({
  message,
  delay = 0,
  speed = 30,
  onComplete
}: WellsMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay / 1000 }}
      className="relative"
    >
      <div
        className="px-5 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-white/90"
        style={{
          boxShadow: '0 0 20px rgba(245, 158, 11, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.02)',
        }}
      >
        <TypewriterText
          text={message}
          delay={delay + 200}
          speed={speed}
          onComplete={onComplete}
          className="text-base md:text-lg leading-relaxed"
        />
      </div>
    </motion.div>
  )
}
