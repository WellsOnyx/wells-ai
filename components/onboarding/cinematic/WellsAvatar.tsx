'use client'

import { motion } from 'framer-motion'

interface WellsAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
  pulse?: boolean
  className?: string
}

const sizeMap = {
  sm: { container: 'w-10 h-10', text: 'text-lg', glow: 'w-14 h-14' },
  md: { container: 'w-16 h-16', text: 'text-2xl', glow: 'w-24 h-24' },
  lg: { container: 'w-24 h-24', text: 'text-4xl', glow: 'w-36 h-36' },
  xl: { container: 'w-32 h-32', text: 'text-5xl', glow: 'w-48 h-48' },
}

export function WellsAvatar({
  size = 'lg',
  animate = true,
  pulse = true,
  className = ''
}: WellsAvatarProps) {
  const sizes = sizeMap[size]

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer glow rings */}
      {animate && (
        <>
          <motion.div
            className={`absolute ${sizes.glow} rounded-full`}
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className={`absolute ${sizes.glow} rounded-full`}
            style={{
              background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 60%)',
            }}
            animate={{
              scale: [1.1, 1.4, 1.1],
              opacity: [0.3, 0.2, 0.3],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          />
        </>
      )}

      {/* Main avatar container */}
      <motion.div
        className={`relative ${sizes.container} rounded-full flex items-center justify-center`}
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #f97316 100%)',
          boxShadow: pulse
            ? '0 0 30px rgba(245, 158, 11, 0.4), 0 0 60px rgba(245, 158, 11, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.1)'
            : '0 0 20px rgba(245, 158, 11, 0.3)',
        }}
        initial={animate ? { scale: 0, opacity: 0 } : {}}
        animate={
          animate
            ? {
                scale: 1,
                opacity: 1,
              }
            : {}
        }
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
          delay: 0.5,
        }}
      >
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Inner highlight ring */}
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
          }}
        />

        {/* The "W" */}
        <motion.span
          className={`relative ${sizes.text} font-bold text-white z-10`}
          style={{
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
          animate={
            pulse
              ? {
                  textShadow: [
                    '0 2px 10px rgba(0, 0, 0, 0.3)',
                    '0 2px 20px rgba(255, 255, 255, 0.3)',
                    '0 2px 10px rgba(0, 0, 0, 0.3)',
                  ],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          W
        </motion.span>
      </motion.div>

      {/* Pulse ring effect */}
      {pulse && (
        <motion.div
          className={`absolute ${sizes.container} rounded-full border-2 border-amber-500/30`}
          animate={{
            scale: [1, 1.5, 1.8],
            opacity: [0.6, 0.2, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}
    </div>
  )
}

// Thinking/processing state variant
export function WellsAvatarThinking({
  size = 'md',
  className = ''
}: Pick<WellsAvatarProps, 'size' | 'className'>) {
  const sizes = sizeMap[size]

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div
        className={`${sizes.container} rounded-full flex items-center justify-center`}
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #f97316 100%)',
          boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
        }}
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'rgba(255, 255, 255, 0.5)',
            borderRightColor: 'rgba(255, 255, 255, 0.3)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        <span className={`${sizes.text} font-bold text-white`}>W</span>
      </motion.div>
    </div>
  )
}
