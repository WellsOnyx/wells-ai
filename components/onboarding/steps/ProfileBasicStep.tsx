'use client'

import { useState, useRef, useEffect } from 'react'
import { UserProfile } from '@/lib/onboarding/types'

interface ProfileBasicStepProps {
  profile: Partial<UserProfile>
  onUpdate: (updates: Partial<UserProfile>) => void
  onContinue: () => void
}

export function ProfileBasicStep({ profile, onUpdate, onContinue }: ProfileBasicStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const firstInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 100)
  }, [])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!profile.firstName?.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!profile.lastName?.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!profile.email?.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onContinue()
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Let's get to know you
        </h1>
        <p className="text-xl text-gray-400">
          Just the basics to get started
        </p>
      </div>

      {/* Avatar Preview */}
      {profile.avatarUrl && (
        <div className="flex justify-center">
          <div className="relative">
            <img
              src={profile.avatarUrl}
              alt="Profile"
              className="w-24 h-24 rounded-full border-4 border-amber-500/20"
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-2 border-black">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              First Name
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={profile.firstName || ''}
              onChange={(e) => onUpdate({ firstName: e.target.value })}
              onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
              className={`
                w-full px-4 py-3 rounded-xl bg-gray-900 border text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all
                ${errors.firstName && touched.firstName ? 'border-red-500' : 'border-gray-700 focus:border-amber-500'}
              `}
              placeholder="John"
              autoComplete="given-name"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={profile.lastName || ''}
              onChange={(e) => onUpdate({ lastName: e.target.value })}
              onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
              className={`
                w-full px-4 py-3 rounded-xl bg-gray-900 border text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all
                ${errors.lastName && touched.lastName ? 'border-red-500' : 'border-gray-700 focus:border-amber-500'}
              `}
              placeholder="Smith"
              autoComplete="family-name"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={profile.email || ''}
            onChange={(e) => onUpdate({ email: e.target.value })}
            onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
            className={`
              w-full px-4 py-3 rounded-xl bg-gray-900 border text-white placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all
              ${errors.email && touched.email ? 'border-red-500' : 'border-gray-700 focus:border-amber-500'}
            `}
            placeholder="john@company.com"
            autoComplete="email"
          />
          {errors.email && touched.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Phone (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Phone <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="tel"
            value={profile.phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            placeholder="+1 (555) 123-4567"
            autoComplete="tel"
          />
          <p className="mt-1 text-xs text-gray-500">
            Get instant notifications when Wells finds matches
          </p>
        </div>

        {/* Continue Button */}
        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Continue
        </button>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-gray-500 mt-3">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono text-[10px]">Enter</kbd> to continue
        </p>
      </form>
    </div>
  )
}
