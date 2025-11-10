'use client'

type SpinnerVariant = 'dots' | 'ring' | 'pulse'
type SpinnerSize = 'sm' | 'md' | 'lg'

interface LoadingSpinnerProps {
  variant?: SpinnerVariant
  size?: SpinnerSize
  className?: string
}

export default function LoadingSpinner({
  variant = 'dots',
  size = 'md',
  className = ''
}: LoadingSpinnerProps) {

  const sizeClasses = {
    sm: { dot: 'w-1.5 h-1.5', ring: 'w-4 h-4', container: 'gap-1' },
    md: { dot: 'w-2 h-2', ring: 'w-5 h-5', container: 'gap-1.5' },
    lg: { dot: 'w-3 h-3', ring: 'w-6 h-6', container: 'gap-2' },
  }

  if (variant === 'dots') {
    return (
      <div className={`flex items-center ${sizeClasses[size].container} ${className}`}>
        <div
          className={`${sizeClasses[size].dot} bg-wells-blue rounded-full animate-bounce`}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={`${sizeClasses[size].dot} bg-wells-gold rounded-full animate-bounce`}
          style={{ animationDelay: '150ms' }}
        />
        <div
          className={`${sizeClasses[size].dot} bg-wells-blue rounded-full animate-bounce`}
          style={{ animationDelay: '300ms' }}
        />
      </div>
    )
  }

  if (variant === 'ring') {
    return (
      <div
        className={`${sizeClasses[size].ring} border-2 border-wells-blue border-t-transparent rounded-full animate-spin ${className}`}
      />
    )
  }

  // pulse variant
  return (
    <div className={`relative ${sizeClasses[size].ring} mx-auto ${className}`}>
      <div className="absolute inset-0 border-4 border-wells-blue/20 rounded-full" />
      <div className="absolute inset-0 border-4 border-wells-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
