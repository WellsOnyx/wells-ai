'use client'

import { HTMLAttributes, forwardRef } from 'react'

type CardVariant = 'default' | 'feature' | 'pricing' | 'blog'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  hover?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-gray-200 rounded-2xl',
  feature: 'bg-white border border-gray-200 rounded-2xl p-7',
  pricing: 'bg-white border border-gray-200 rounded-3xl p-8 text-center',
  blog: 'bg-white border border-gray-200 rounded-2xl overflow-hidden'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  hover = true,
  className = '',
  children,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={`
        ${variantStyles[variant]}
        ${hover ? 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 hover:border-gray-300 transition-all duration-300' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({
  className = '',
  children,
  ...props
}, ref) => (
  <div ref={ref} className={`p-6 border-b border-gray-200 ${className}`} {...props}>
    {children}
  </div>
))

CardHeader.displayName = 'CardHeader'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({
  className = '',
  children,
  ...props
}, ref) => (
  <div ref={ref} className={`p-6 ${className}`} {...props}>
    {children}
  </div>
))

CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({
  className = '',
  children,
  ...props
}, ref) => (
  <div ref={ref} className={`p-6 border-t border-gray-200 ${className}`} {...props}>
    {children}
  </div>
))

CardFooter.displayName = 'CardFooter'

export default Card
