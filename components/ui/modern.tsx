'use client'

/**
 * MODERN UI COMPONENTS - 2025 Design System
 *
 * Glassmorphism, Bento Grids, Animated Gradients
 * The future of Wells AI interfaces
 */

import { ReactNode, CSSProperties } from 'react'
import { motion } from 'framer-motion'

// ============================================
// GLASS CARD - Frosted glass effect
// ============================================
interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: 'amber' | 'blue' | 'purple' | 'green' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  padding = 'md'
}: GlassCardProps) {
  const glowColors = {
    amber: 'hover:shadow-amber-500/20 hover:border-amber-500/30',
    blue: 'hover:shadow-blue-500/20 hover:border-blue-500/30',
    purple: 'hover:shadow-purple-500/20 hover:border-purple-500/30',
    green: 'hover:shadow-green-500/20 hover:border-green-500/30',
    none: ''
  }

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/[0.03] backdrop-blur-xl
        border border-white/[0.08]
        ${hover ? `transition-all duration-500 hover:bg-white/[0.06] hover:border-white/[0.15] ${glowColors[glow]}` : ''}
        ${paddings[padding]}
        ${className}
      `}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ============================================
// BENTO GRID - Asymmetric modern layout
// ============================================
interface BentoGridProps {
  children: ReactNode
  className?: string
  cols?: 2 | 3 | 4
}

export function BentoGrid({ children, className = '', cols = 3 }: BentoGridProps) {
  const colClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={`grid ${colClasses[cols]} gap-4 auto-rows-fr ${className}`}>
      {children}
    </div>
  )
}

interface BentoItemProps {
  children: ReactNode
  className?: string
  span?: 1 | 2
  rowSpan?: 1 | 2
}

export function BentoItem({ children, className = '', span = 1, rowSpan = 1 }: BentoItemProps) {
  const spanClass = span === 2 ? 'md:col-span-2' : ''
  const rowSpanClass = rowSpan === 2 ? 'md:row-span-2' : ''

  return (
    <div className={`${spanClass} ${rowSpanClass} ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// ANIMATED GRADIENT - Shifting background
// ============================================
interface AnimatedGradientProps {
  children: ReactNode
  className?: string
  colors?: string[]
}

export function AnimatedGradient({
  children,
  className = '',
  colors = ['from-amber-500', 'via-orange-500', 'to-red-500']
}: AnimatedGradientProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r ${colors.join(' ')} animate-gradient-shift`}
        style={{
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 8s ease infinite'
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ============================================
// GLOW ORB - Ambient lighting effect
// ============================================
interface GlowOrbProps {
  color?: 'amber' | 'blue' | 'purple' | 'green'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  position?: { top?: string; left?: string; right?: string; bottom?: string }
  animate?: boolean
}

export function GlowOrb({
  color = 'amber',
  size = 'md',
  position = { top: '0', left: '0' },
  animate = true
}: GlowOrbProps) {
  const colors = {
    amber: 'bg-amber-500/20',
    blue: 'bg-blue-500/20',
    purple: 'bg-purple-500/20',
    green: 'bg-green-500/20'
  }

  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-64 h-64',
    lg: 'w-96 h-96',
    xl: 'w-[500px] h-[500px]'
  }

  return (
    <div
      className={`
        absolute ${colors[color]} ${sizes[size]} rounded-full blur-3xl
        ${animate ? 'animate-pulse' : ''}
        pointer-events-none
      `}
      style={{
        ...position,
        animationDuration: '4s'
      }}
    />
  )
}

// ============================================
// SHIMMER BUTTON - Premium CTA
// ============================================
interface ShimmerButtonProps {
  children: ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function ShimmerButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  onClick
}: ShimmerButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500',
    secondary: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20',
    ghost: 'bg-transparent text-white hover:bg-white/5'
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  return (
    <button
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl font-semibold
        transition-all duration-300 hover:scale-105 active:scale-95
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}

// ============================================
// FLOATING BADGE - Animated status indicator
// ============================================
interface FloatingBadgeProps {
  children: ReactNode
  color?: 'amber' | 'green' | 'blue' | 'purple'
  pulse?: boolean
}

export function FloatingBadge({ children, color = 'amber', pulse = true }: FloatingBadgeProps) {
  const colors = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400'
  }

  const dotColors = {
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500'
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-full
        ${colors[color]} border backdrop-blur-sm
        text-sm font-semibold
      `}
    >
      {pulse && (
        <div className={`w-2 h-2 rounded-full ${dotColors[color]} animate-pulse`} />
      )}
      {children}
    </div>
  )
}

// ============================================
// METRIC CARD - Big number display
// ============================================
interface MetricCardProps {
  value: string
  label: string
  sublabel?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export function MetricCard({ value, label, sublabel, icon, trend }: MetricCardProps) {
  return (
    <GlassCard hover glow="amber" padding="lg" className="text-center group">
      {icon && (
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
      )}
      <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-sm md:text-base font-semibold text-white mb-1">{label}</div>
      {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
    </GlassCard>
  )
}

// ============================================
// JOURNEY CARD - Premium action card
// ============================================
interface JourneyCardProps {
  icon: ReactNode
  title: string
  tagline: string
  description: string
  gradient: string
  href: string
  featured?: boolean
}

export function JourneyCard({
  icon,
  title,
  tagline,
  description,
  gradient,
  href,
  featured = false
}: JourneyCardProps) {
  return (
    <a href={href} className="block group">
      <GlassCard
        hover
        padding="none"
        className={`relative ${featured ? 'ring-2 ring-amber-500/50' : ''}`}
      >
        {/* Top gradient bar */}
        <div className={`h-1 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

        {/* Ambient glow on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none`} />

        <div className="p-8">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
            {icon}
          </div>

          {/* Content */}
          <h3 className="text-2xl font-bold mb-2 group-hover:text-amber-400 transition-colors">
            {title}
          </h3>
          <p className="text-amber-400 text-sm font-semibold mb-4">{tagline}</p>
          <p className="text-gray-400 leading-relaxed">{description}</p>

          {/* Arrow */}
          <div className="mt-6 flex items-center text-amber-400 font-semibold group-hover:text-amber-300 transition-colors">
            <span>Get Started</span>
            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </GlassCard>
    </a>
  )
}

// ============================================
// ANIMATED TEXT - Typewriter or gradient
// ============================================
interface AnimatedTextProps {
  text: string
  className?: string
  gradient?: boolean
  gradientColors?: string
}

export function AnimatedText({
  text,
  className = '',
  gradient = false,
  gradientColors = 'from-amber-400 via-amber-500 to-orange-500'
}: AnimatedTextProps) {
  if (gradient) {
    return (
      <span className={`bg-gradient-to-r ${gradientColors} bg-clip-text text-transparent ${className}`}>
        {text}
      </span>
    )
  }

  return <span className={className}>{text}</span>
}

// ============================================
// NOISE OVERLAY - Subtle texture
// ============================================
export function NoiseOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 opacity-[0.015]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat'
      }}
    />
  )
}

// ============================================
// CSS KEYFRAMES (add to globals.css)
// ============================================
export const modernCSS = `
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.animate-gradient-shift {
  animation: gradient-shift 8s ease infinite;
  background-size: 200% 200%;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-glow-pulse {
  animation: glow-pulse 3s ease-in-out infinite;
}
`
