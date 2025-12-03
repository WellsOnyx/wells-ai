'use client'

import { useState, useEffect, useRef } from 'react'
import { UserJourney, UserProfile, JOURNEY_CONFIG } from '@/lib/onboarding/types'
import { Rocket, ShoppingCart, Store, Briefcase, Check, Sparkles } from 'lucide-react'

interface CompleteStepProps {
  journey: UserJourney
  profile: Partial<UserProfile>
  onComplete: () => void
}

const JOURNEY_ICONS = {
  founder: Rocket,
  buyer: ShoppingCart,
  seller: Store,
  jobs: Briefcase,
}

// Demo actions for each journey
const DEMO_ACTIONS: Record<UserJourney, { action: string; steps: string[]; result: string }> = {
  founder: {
    action: 'Finding CTO candidates...',
    steps: [
      'Searching 10,000+ candidate profiles...',
      'Found 47 matches for CTO role',
      'Scoring candidates by experience...',
      'Top 5 selected',
      'Drafting personalized outreach...',
      'Sending to 5 candidates',
    ],
    result: 'I just reached out to 5 qualified CTO candidates. You should hear back within 48 hours.',
  },
  buyer: {
    action: 'Creating your first RFQ...',
    steps: [
      'Analyzing your requirements...',
      'Writing RFQ document...',
      'Matching against 1,200+ suppliers...',
      'Found 12 verified suppliers',
      'Sending RFQ to top 8...',
      'RFQs delivered',
    ],
    result: '8 suppliers will quote by tomorrow. I\'ll compare prices and terms for you.',
  },
  seller: {
    action: 'Finding active buyers...',
    steps: [
      'Analyzing your catalog...',
      'Processing categories...',
      'Searching active RFQs...',
      'Found 3 matching opportunities',
      'Preparing quote templates...',
      'Ready to quote',
    ],
    result: 'You have 3 opportunities ready to quote. I\'ll help you win them.',
  },
  jobs: {
    action: 'Matching your profile...',
    steps: [
      'Analyzing your skills...',
      'Extracted 12 key skills',
      'Searching 500+ open roles...',
      'Found 8 strong matches',
      'Scoring job fit...',
      'Top 3 selected',
    ],
    result: 'Found 3 roles that match your profile. Ready to start interviewing?',
  },
}

export function CompleteStep({ journey, profile, onComplete }: CompleteStepProps) {
  const [phase, setPhase] = useState<'intro' | 'working' | 'done'>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiRef = useRef<HTMLDivElement>(null)

  const Icon = JOURNEY_ICONS[journey]
  const config = JOURNEY_CONFIG[journey]
  const demo = DEMO_ACTIONS[journey]

  // Auto-advance through demo steps
  useEffect(() => {
    if (phase !== 'working') return

    const steps = demo.steps
    if (currentStepIndex < steps.length) {
      const timer = setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1)
      }, 800)
      return () => clearTimeout(timer)
    } else {
      // Demo complete
      setTimeout(() => {
        setPhase('done')
        setShowConfetti(true)
      }, 500)
    }
  }, [phase, currentStepIndex, demo.steps.length])

  // Hide confetti after animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showConfetti])

  const startDemo = () => {
    setPhase('working')
    setCurrentStepIndex(0)
  }

  // Intro phase
  if (phase === 'intro') {
    return (
      <div className="text-center space-y-8 py-8">
        {/* Success Icon */}
        <div className="relative inline-flex">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center`}>
            <Icon className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center border-4 border-black">
            <Check className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            You're all set, {profile.firstName}!
          </h1>
          <p className="text-xl text-gray-400">
            Let me show you what I can do in 30 seconds.
          </p>
        </div>

        {/* Summary */}
        <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 text-left max-w-md mx-auto">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Your Profile</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Journey</span>
              <span className="text-white font-medium">{config.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span className="text-white font-medium">{profile.email}</span>
            </div>
            {profile.founderProfile?.companyName && (
              <div className="flex justify-between">
                <span className="text-gray-400">Company</span>
                <span className="text-white font-medium">{profile.founderProfile.companyName}</span>
              </div>
            )}
            {profile.buyerProfile?.companyName && (
              <div className="flex justify-between">
                <span className="text-gray-400">Company</span>
                <span className="text-white font-medium">{profile.buyerProfile.companyName}</span>
              </div>
            )}
            {profile.sellerProfile?.companyName && (
              <div className="flex justify-between">
                <span className="text-gray-400">Business</span>
                <span className="text-white font-medium">{profile.sellerProfile.companyName}</span>
              </div>
            )}
            {profile.jobsProfile?.desiredRoles && (
              <div className="flex justify-between">
                <span className="text-gray-400">Looking for</span>
                <span className="text-white font-medium">{profile.jobsProfile.desiredRoles[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={startDemo}
          className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25 flex items-center gap-2 mx-auto"
        >
          <Sparkles className="w-5 h-5" />
          Show Me What Wells Can Do
        </button>
      </div>
    )
  }

  // Working phase
  if (phase === 'working') {
    return (
      <div className="space-y-8 py-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">{demo.action}</h1>
          <p className="text-gray-400">Give me 30 seconds...</p>
        </div>

        {/* Activity Feed */}
        <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800">
          <div className="space-y-3">
            {demo.steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  i < currentStepIndex
                    ? 'opacity-100'
                    : i === currentStepIndex
                      ? 'opacity-100'
                      : 'opacity-0'
                }`}
              >
                {i < currentStepIndex ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                ) : i === currentStepIndex ? (
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-gray-700 flex-shrink-0" />
                )}
                <span className={`text-sm ${i <= currentStepIndex ? 'text-white' : 'text-gray-600'}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wells Avatar */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
            <span className="text-2xl font-bold text-white">W</span>
          </div>
        </div>
      </div>
    )
  }

  // Done phase
  return (
    <div className="space-y-8 py-8 relative">
      {/* Confetti */}
      {showConfetti && (
        <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Success Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Done!</h1>
        <p className="text-xl text-gray-300 max-w-md mx-auto">
          {demo.result}
        </p>
      </div>

      {/* Preview Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Icon className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-white">First Task Complete</h3>
            <p className="text-sm text-gray-400">Wells is working for you 24/7</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {demo.steps.slice(-3).map((step, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm">
              ✓ {step}
            </span>
          ))}
        </div>
      </div>

      {/* Go to Dashboard */}
      <button
        onClick={onComplete}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25"
      >
        Go to Dashboard
      </button>

      {/* Confetti Animation Styles */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
