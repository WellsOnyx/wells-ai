'use client'

import { useState } from 'react'
import { UserJourney, JOURNEY_CONFIG } from '@/lib/onboarding/types'
import { Rocket, ShoppingCart, Store, Briefcase } from 'lucide-react'

interface JourneyStepProps {
  onSelect: (journey: UserJourney) => void
}

const JOURNEY_ICONS = {
  founder: Rocket,
  buyer: ShoppingCart,
  seller: Store,
  jobs: Briefcase,
}

const EMPATHY_TEXT: Record<UserJourney, { pain: string[]; solution: string }> = {
  founder: {
    pain: [
      'Finding the right CTO? Months.',
      'Getting investor intros? Who you know.',
      'Sourcing 10,000 units? Spreadsheet hell.'
    ],
    solution: 'I can do all of that in 48 hours.'
  },
  buyer: {
    pain: [
      'RFQs take days to write.',
      'Supplier vetting? Trust issues.',
      'Negotiation back-and-forth? Exhausting.'
    ],
    solution: 'I handle all of that automatically.'
  },
  seller: {
    pain: [
      'Cold outreach? Crickets.',
      'Marketplace fees? Highway robbery.',
      'Qualified buyers? Rare.'
    ],
    solution: 'I bring buyers to you.'
  },
  jobs: {
    pain: [
      'Apply → Silence.',
      '"We\'ll be in touch" → Never are.',
      '5 interviews for one role? Seriously?'
    ],
    solution: 'I get you direct intros to hiring managers.'
  }
}

export function JourneyStep({ onSelect }: JourneyStepProps) {
  const [hoveredJourney, setHoveredJourney] = useState<UserJourney | null>(null)
  const [selectedJourney, setSelectedJourney] = useState<UserJourney | null>(null)

  const handleSelect = (journey: UserJourney) => {
    setSelectedJourney(journey)
    // Small delay for visual feedback
    setTimeout(() => onSelect(journey), 300)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          What brings you here today?
        </h1>
        <p className="text-xl text-gray-400">
          Choose your journey to get personalized onboarding
        </p>
      </div>

      {/* Journey Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {(Object.keys(JOURNEY_CONFIG) as UserJourney[]).map((journey) => {
          const config = JOURNEY_CONFIG[journey]
          const Icon = JOURNEY_ICONS[journey]
          const isSelected = selectedJourney === journey
          const isHovered = hoveredJourney === journey

          return (
            <button
              key={journey}
              onClick={() => handleSelect(journey)}
              onMouseEnter={() => setHoveredJourney(journey)}
              onMouseLeave={() => setHoveredJourney(null)}
              className={`
                relative p-8 rounded-2xl border-2 transition-all duration-300 text-left
                ${isSelected
                  ? 'border-amber-500 bg-amber-500/10 scale-[1.02]'
                  : isHovered
                    ? 'border-gray-600 bg-gray-900'
                    : 'border-gray-800 bg-gray-900/50'
                }
              `}
            >
              {/* Icon */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-4 transition-transform ${isHovered ? 'scale-110' : ''}`}>
                <Icon className="w-8 h-8 text-white" />
              </div>

              {/* Title & Tagline */}
              <h3 className="text-2xl font-bold text-white mb-2">{config.title}</h3>
              <p className="text-gray-400">{config.tagline}</p>

              {/* Empathy text on hover */}
              {isHovered && (
                <div className="mt-4 pt-4 border-t border-gray-800 animate-fadeIn">
                  <div className="space-y-1 text-sm text-gray-500">
                    {EMPATHY_TEXT[journey].pain.map((pain, i) => (
                      <p key={i}>{pain}</p>
                    ))}
                  </div>
                  <p className="mt-3 text-amber-500 font-medium">
                    {EMPATHY_TEXT[journey].solution}
                  </p>
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Multiple journeys hint */}
      <p className="text-center text-sm text-gray-500">
        You can always add more journeys later from your dashboard
      </p>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
