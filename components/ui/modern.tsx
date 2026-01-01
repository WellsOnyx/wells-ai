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
  glow?: 'amber' | 'blue' | 'purple' | 'green' | 'cyan' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'elevated' | 'subtle'
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  padding = 'md',
  variant = 'default'
}: GlassCardProps) {
  const glowColors = {
    amber: 'hover:shadow-amber-500/20 hover:border-amber-500/30',
    blue: 'hover:shadow-blue-500/20 hover:border-blue-500/30',
    purple: 'hover:shadow-purple-500/20 hover:border-purple-500/30',
    green: 'hover:shadow-green-500/20 hover:border-green-500/30',
    cyan: 'hover:shadow-cyan-500/20 hover:border-cyan-500/30',
    none: ''
  }

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  }

  const variants = {
    default: 'bg-white/[0.03] border-white/[0.08]',
    elevated: 'bg-white/[0.05] border-white/[0.12] shadow-xl',
    subtle: 'bg-white/[0.02] border-white/[0.05]'
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        ${variants[variant]} backdrop-blur-xl border
        ${hover ? `transition-all duration-500 hover:bg-white/[0.06] hover:border-white/[0.15] hover:-translate-y-0.5 ${glowColors[glow]}` : ''}
        ${paddings[padding]}
        ${className}
      `}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
      {/* Inner glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

export function ShimmerButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false
}: ShimmerButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40',
    secondary: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20',
    ghost: 'bg-transparent text-white hover:bg-white/5',
    outline: 'bg-transparent border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500'
  }

  const sizes = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden rounded-xl font-semibold
        transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className={`relative z-10 flex items-center justify-center gap-2 ${loading ? 'opacity-0' : ''}`}>
        {children}
      </span>
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
// STAT CARD - Enhanced metric display
// ============================================
interface StatCardProps {
  value: string
  label: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: ReactNode
  gradient?: string
}

export function StatCard({
  value,
  label,
  change,
  changeType = 'neutral',
  icon,
  gradient = 'from-amber-500 to-amber-600'
}: StatCardProps) {
  const changeColors = {
    positive: 'text-green-400 bg-green-500/10',
    negative: 'text-red-400 bg-red-500/10',
    neutral: 'text-gray-400 bg-gray-500/10'
  }

  return (
    <GlassCard hover glow="amber" className="group">
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
        )}
        {change && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold mb-1 text-gradient-silver">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </GlassCard>
  )
}

// ============================================
// NAVIGATION ITEM - Sidebar/nav link
// ============================================
interface NavItemProps {
  icon: ReactNode
  label: string
  href: string
  active?: boolean
  badge?: string | number
}

export function NavItem({ icon, label, href, active = false, badge }: NavItemProps) {
  return (
    <a
      href={href}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
        ${active
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'text-gray-400 hover:text-white hover:bg-white/5'}
      `}
    >
      <span className={active ? 'text-amber-400' : ''}>{icon}</span>
      <span className="font-medium">{label}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-black">
          {badge}
        </span>
      )}
    </a>
  )
}

// ============================================
// AVATAR GROUP - Overlapping avatars
// ============================================
interface AvatarGroupProps {
  avatars: { src?: string; name: string }[]
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

export function AvatarGroup({ avatars, max = 4, size = 'md' }: AvatarGroupProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }

  const displayed = avatars.slice(0, max)
  const remaining = avatars.length - max

  return (
    <div className="flex -space-x-2">
      {displayed.map((avatar, i) => (
        <div
          key={i}
          className={`${sizes[size]} rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-semibold border-2 border-black ring-2 ring-black`}
          title={avatar.name}
        >
          {avatar.src ? (
            <img src={avatar.src} alt={avatar.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            avatar.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${sizes[size]} rounded-full bg-white/10 flex items-center justify-center text-white font-semibold border-2 border-black`}>
          +{remaining}
        </div>
      )}
    </div>
  )
}

// ============================================
// PROGRESS BAR - Animated progress
// ============================================
interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  color?: 'amber' | 'green' | 'blue' | 'purple'
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = 'amber',
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const colors = {
    amber: 'from-amber-400 to-amber-600',
    green: 'from-green-400 to-green-600',
    blue: 'from-blue-400 to-blue-600',
    purple: 'from-purple-400 to-purple-600'
  }

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  }

  return (
    <div>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2 text-sm">
          {label && <span className="text-gray-400">{label}</span>}
          {showValue && <span className="text-white font-medium">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full ${sizes[size]} bg-white/10 rounded-full overflow-hidden`}>
        <div
          className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// ============================================
// DIVIDER - Stylish separator
// ============================================
interface DividerProps {
  label?: string
  className?: string
}

export function Divider({ label, className = '' }: DividerProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {label && <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

// ============================================
// EMPTY STATE - No data placeholder
// ============================================
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-gray-500">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
}

// ============================================
// SKELETON - Loading placeholder
// ============================================
interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  className?: string
  count?: number
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-white/10'

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl'
  }

  const style: CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : variant === 'circular' ? width : undefined
  }

  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  )
}

// ============================================
// SKELETON CARD - Loading card placeholder
// ============================================
interface SkeletonCardProps {
  hasIcon?: boolean
  hasTitle?: boolean
  hasDescription?: boolean
  lines?: number
  className?: string
}

export function SkeletonCard({
  hasIcon = true,
  hasTitle = true,
  hasDescription = true,
  lines = 2,
  className = ''
}: SkeletonCardProps) {
  return (
    <GlassCard hover={false} className={className}>
      <div className="flex items-start gap-4">
        {hasIcon && <Skeleton variant="rounded" width={48} height={48} />}
        <div className="flex-1">
          {hasTitle && <Skeleton width="60%" height={20} className="mb-2" />}
          {hasDescription && <Skeleton count={lines} width="100%" className="mb-1" />}
        </div>
      </div>
    </GlassCard>
  )
}

// ============================================
// TOAST - Notification component
// ============================================
interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  onClose?: () => void
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const colors = {
    success: 'bg-green-500/20 border-green-500/30 text-green-400',
    error: 'bg-red-500/20 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/20 border-blue-500/30 text-blue-400'
  }

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl ${colors[type]} animate-in slide-in-from-right-5 duration-300`}>
      {icons[type]}
      <span className="font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ============================================
// CONFIRMATION MODAL - Action confirmation
// ============================================
interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6">{description}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
