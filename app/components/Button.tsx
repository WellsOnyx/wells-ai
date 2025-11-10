'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantClasses = {
      primary:
        'bg-wells-blue text-white hover:bg-wells-blue/90 focus:ring-wells-blue shadow-sm',
      secondary:
        'bg-wells-gold text-white hover:bg-wells-gold/90 focus:ring-wells-gold shadow-sm',
      outline:
        'border-2 border-wells-blue text-wells-blue hover:bg-wells-blue/5 focus:ring-wells-blue',
      ghost: 'text-wells-blue hover:bg-wells-blue/10 focus:ring-wells-blue',
      danger:
        'bg-wells-error text-white hover:bg-wells-error/90 focus:ring-wells-error shadow-sm',
    }

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded-sm',
      md: 'px-4 py-2.5 text-sm rounded-sm',
      lg: 'px-6 py-3 text-base rounded-md',
    }

    const widthClass = fullWidth ? 'w-full' : ''

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
