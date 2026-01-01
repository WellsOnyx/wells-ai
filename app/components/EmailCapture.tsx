'use client'

/**
 * Email Capture / Waitlist Component
 *
 * Premium glassmorphic waitlist signup with:
 * - Email validation
 * - Optional company name and role
 * - Loading states
 * - Success animation with confetti
 * - Social proof ("Join 500+ companies")
 *
 * Designed to feel exclusive - like joining something special.
 */

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Loader2, Sparkles, ArrowRight, Building2, User } from 'lucide-react'

interface EmailCaptureProps {
  title?: string
  subtitle?: string
  showOptionalFields?: boolean
  waitlistCount?: number
  onSuccess?: (data: { email: string; company?: string; role?: string }) => void
}

// Confetti particle component
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-confetti"
      style={{
        backgroundColor: color,
        left: `${Math.random() * 100}%`,
        animationDelay: `${delay}ms`,
        animationDuration: `${1000 + Math.random() * 500}ms`,
      }}
    />
  )
}

export default function EmailCapture({
  title = "Get Early Access",
  subtitle = "Be the first to experience the future of AI-powered deal making.",
  showOptionalFields = true,
  waitlistCount = 500,
  onSuccess,
}: EmailCaptureProps) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [position, setPosition] = useState<number | null>(null)

  // Email validation
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          company: company.trim() || undefined,
          role: role.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist')
      }

      // Success!
      setIsSuccess(true)
      setShowConfetti(true)
      setPosition(data.position || waitlistCount + 1)

      // Callback
      onSuccess?.({ email, company: company || undefined, role: role || undefined })

      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Confetti colors
  const confettiColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4']

  if (isSuccess) {
    return (
      <div className="relative">
        {/* Confetti overlay */}
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 50 }).map((_, i) => (
              <ConfettiParticle
                key={i}
                delay={i * 30}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </div>
        )}

        {/* Success state */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center animate-scale-in overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-amber-500/10 pointer-events-none" />

          {/* Checkmark animation */}
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center animate-bounce-once">
              <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-emerald-500/30 animate-ping-slow" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">
            You&apos;re In!
          </h3>
          <p className="text-gray-400 mb-4">
            You&apos;re #{position?.toLocaleString()} on the waitlist
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm">
            <Sparkles className="w-4 h-4" />
            Early access coming soon
          </div>

          <p className="text-gray-500 text-sm mt-6">
            Check your inbox for a confirmation email
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Main card - Glassmorphic design */}
      <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 overflow-hidden">
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {/* Subtle animated glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl animate-glow-pulse pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-glow-pulse pointer-events-none" style={{ animationDelay: '1.5s' }} />

        {/* Content */}
        <div className="relative">
          {/* Social proof badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 border-2 border-black/50 flex items-center justify-center"
                    style={{ zIndex: 5 - i }}
                  >
                    <span className="text-[8px] font-bold text-black">{String.fromCharCode(64 + i)}</span>
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-400">
                Join <span className="text-white font-semibold">{waitlistCount.toLocaleString()}+</span> companies on the waitlist
              </span>
            </div>
          </div>

          {/* Title & subtitle */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
              {title}
            </h2>
            <p className="text-gray-400 max-w-sm mx-auto">
              {subtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email input */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Enter your work email"
                disabled={isLoading}
                className={`w-full px-4 py-4 bg-white/5 border rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${
                  error ? 'border-red-500/50 focus:border-red-500/50' : 'border-white/10 focus:border-amber-500/50'
                }`}
                autoComplete="email"
              />
              {error && (
                <p className="absolute -bottom-6 left-0 text-red-400 text-sm animate-slide-up">
                  {error}
                </p>
              )}
            </div>

            {/* Optional fields */}
            {showOptionalFields && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company (optional)"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 text-sm"
                    autoComplete="organization"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Role (optional)"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 text-sm"
                    autoComplete="organization-title"
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none group active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Get Early Access
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>

          {/* Trust indicators */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                No spam
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Unsubscribe anytime
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Priority access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 1.5s ease-out forwards;
        }
        @keyframes bounce-once {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 1.5s ease-out infinite;
        }
      `}</style>
    </div>
  )
}
