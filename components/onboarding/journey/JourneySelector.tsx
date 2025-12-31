'use client'

/**
 * JourneySelector - Beautiful journey selection cards
 *
 * Lets users choose their journey path with cinematic cards
 * that preview what each experience offers.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Store,
  Rocket,
  Briefcase,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { UserJourney } from '@/lib/onboarding/types'

// ============================================================================
// TYPES
// ============================================================================

interface JourneyOption {
  id: UserJourney
  title: string
  tagline: string
  description: string
  icon: React.ElementType
  accentColor: string
  glowColor: string
  features: string[]
}

// ============================================================================
// JOURNEY CONFIGURATIONS
// ============================================================================

const JOURNEYS: JourneyOption[] = [
  {
    id: 'buyer',
    title: 'Buyer',
    tagline: 'Source products & services',
    description: 'Find suppliers, get quotes, and negotiate deals. All automated.',
    icon: ShoppingCart,
    accentColor: 'from-blue-500 to-cyan-500',
    glowColor: 'rgba(6, 182, 212, 0.2)',
    features: [
      'AI-powered supplier matching',
      'Instant quote comparison',
      'Automated negotiation',
    ],
  },
  {
    id: 'seller',
    title: 'Seller',
    tagline: 'Find qualified buyers',
    description: 'Connect with buyers actively looking for what you sell.',
    icon: Store,
    accentColor: 'from-emerald-500 to-green-500',
    glowColor: 'rgba(16, 185, 129, 0.2)',
    features: [
      'Buyer matching & intros',
      'RFQ notifications',
      'Deal facilitation',
    ],
  },
  {
    id: 'founder',
    title: 'Founder',
    tagline: 'Build & scale your company',
    description: 'Hire talent, source suppliers, find customers, raise capital.',
    icon: Rocket,
    accentColor: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.2)',
    features: [
      'Talent sourcing & screening',
      'Supplier network access',
      'Customer acquisition',
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs',
    tagline: 'Find your next role',
    description: 'Direct intros to hiring managers. No more job boards.',
    icon: Briefcase,
    accentColor: 'from-purple-500 to-pink-500',
    glowColor: 'rgba(168, 85, 247, 0.2)',
    features: [
      'Direct hiring manager access',
      'Personalized introductions',
      'Interview preparation',
    ],
  },
]

// ============================================================================
// JOURNEY CARD COMPONENT
// ============================================================================

function JourneyCard({
  journey,
  isHovered,
  onHover,
  onSelect,
}: {
  journey: JourneyOption
  isHovered: boolean
  onHover: () => void
  onSelect: () => void
}) {
  const Icon = journey.icon

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`
        relative group
        w-full p-6 rounded-2xl
        bg-white/[0.02] border backdrop-blur-sm
        text-left transition-all duration-500
        ${isHovered
          ? 'border-white/20 bg-white/[0.05] scale-[1.02]'
          : 'border-white/[0.06] hover:border-white/10'
        }
      `}
      style={{
        boxShadow: isHovered ? `0 0 60px ${journey.glowColor}` : 'none',
      }}
    >
      {/* Gradient overlay on hover */}
      <div className={`
        absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500
        bg-gradient-to-br ${journey.accentColor}
        ${isHovered ? 'opacity-[0.03]' : 'group-hover:opacity-[0.02]'}
      `} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`
            w-12 h-12 rounded-xl
            bg-gradient-to-br ${journey.accentColor}
            flex items-center justify-center
            shadow-lg
            transition-transform duration-300
            ${isHovered ? 'scale-110' : 'group-hover:scale-105'}
          `}>
            <Icon className="w-6 h-6 text-white" />
          </div>

          <ArrowRight className={`
            w-5 h-5 text-white/30
            transition-all duration-300
            ${isHovered ? 'text-white/60 translate-x-1' : 'group-hover:text-white/40'}
          `} />
        </div>

        {/* Title & Tagline */}
        <h3 className="text-xl font-semibold text-white mb-1">
          {journey.title}
        </h3>
        <p className={`
          text-sm font-medium mb-3
          bg-gradient-to-r ${journey.accentColor} bg-clip-text text-transparent
        `}>
          {journey.tagline}
        </p>

        {/* Description */}
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          {journey.description}
        </p>

        {/* Features */}
        <ul className="space-y-2">
          {journey.features.map((feature, i) => (
            <li
              key={i}
              className={`
                flex items-center gap-2 text-xs
                transition-all duration-300 delay-${i * 50}
                ${isHovered ? 'text-white/70' : 'text-white/40'}
              `}
            >
              <Sparkles className="w-3 h-3" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </button>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JourneySelector() {
  const router = useRouter()
  const [hoveredJourney, setHoveredJourney] = useState<UserJourney | null>(null)

  const handleSelect = (journeyId: UserJourney) => {
    router.push(`/onboarding/${journeyId}`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`
      }} />

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Wells AI</h1>
          </div>

          <h2 className="text-xl text-white/80 mb-2">
            What brings you here today?
          </h2>
          <p className="text-sm text-white/40">
            Choose your path. Each journey is tailored to your needs.
          </p>
        </div>

        {/* Journey Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {JOURNEYS.map((journey) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              isHovered={hoveredJourney === journey.id}
              onHover={() => setHoveredJourney(journey.id)}
              onSelect={() => handleSelect(journey.id)}
            />
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-white/30 mt-8">
          Not sure? You can always change your focus later.
        </p>
      </div>
    </div>
  )
}
