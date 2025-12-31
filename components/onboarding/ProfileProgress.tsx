'use client'

/**
 * ProfileProgress Component
 *
 * Subtle, non-intrusive display showing what Wells has learned.
 * Animated as new info is extracted. Glassmorphic card design.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================================
// TYPES
// ============================================================================

interface ProgressiveProfileData {
  journey: 'buyer' | 'seller' | 'founder' | 'jobs' | null
  name?: string
  completeness: number
  buyer?: {
    company?: string
    industry?: string
    typicalNeeds?: string[]
    budgetRange?: { min?: number; max?: number; currency: string }
    locations?: string[]
  }
  seller?: {
    company?: string
    products?: string[]
    certifications?: string[]
    serviceRegions?: string[]
  }
  founder?: {
    company?: string
    stage?: string
    teamSize?: number
    priorities?: string[]
  }
  jobs?: {
    currentTitle?: string
    experience?: number
    skills?: string[]
    preferences?: {
      remote?: boolean
      salaryRange?: { min?: number; max?: number }
    }
  }
}

interface ProfileProgressProps {
  profile: ProgressiveProfileData
  showDetails?: boolean
  minimal?: boolean
  onExpand?: () => void
}

// ============================================================================
// JOURNEY ICONS
// ============================================================================

const JourneyIcon = ({ journey }: { journey: string | null }) => {
  const iconClass = "w-5 h-5"

  switch (journey) {
    case 'buyer':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    case 'seller':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    case 'founder':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    case 'jobs':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
  }
}

// ============================================================================
// PROFILE FIELD ITEM
// ============================================================================

const ProfileFieldItem = ({
  label,
  value,
  isNew,
}: {
  label: string
  value: string | number | string[] | undefined
  isNew?: boolean
}) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null

  const displayValue = Array.isArray(value) ? value.join(', ') : String(value)

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -10 } : false}
      animate={{ opacity: 1, x: 0 }}
      className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0"
    >
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-xs font-medium ${isNew ? 'text-emerald-400' : 'text-white/70'}`}>
        {displayValue.length > 30 ? displayValue.slice(0, 30) + '...' : displayValue}
      </span>
    </motion.div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProfileProgress({
  profile,
  showDetails = false,
  minimal = false,
  onExpand,
}: ProfileProgressProps) {
  const [expanded, setExpanded] = useState(showDetails)
  const [previousCompleteness, setPreviousCompleteness] = useState(profile.completeness)
  const [justUpdated, setJustUpdated] = useState(false)

  // Animate when completeness changes
  useEffect(() => {
    if (profile.completeness !== previousCompleteness) {
      setJustUpdated(true)
      setPreviousCompleteness(profile.completeness)
      setTimeout(() => setJustUpdated(false), 2000)
    }
  }, [profile.completeness, previousCompleteness])

  // Get journey-specific fields
  const getJourneyFields = () => {
    switch (profile.journey) {
      case 'buyer':
        return profile.buyer ? [
          { label: 'Company', value: profile.buyer.company },
          { label: 'Industry', value: profile.buyer.industry },
          { label: 'Looking for', value: profile.buyer.typicalNeeds },
          { label: 'Location', value: profile.buyer.locations },
        ] : []
      case 'seller':
        return profile.seller ? [
          { label: 'Company', value: profile.seller.company },
          { label: 'Products', value: profile.seller.products },
          { label: 'Certifications', value: profile.seller.certifications },
          { label: 'Regions', value: profile.seller.serviceRegions },
        ] : []
      case 'founder':
        return profile.founder ? [
          { label: 'Company', value: profile.founder.company },
          { label: 'Stage', value: profile.founder.stage },
          { label: 'Team size', value: profile.founder.teamSize },
          { label: 'Priorities', value: profile.founder.priorities },
        ] : []
      case 'jobs':
        return profile.jobs ? [
          { label: 'Current role', value: profile.jobs.currentTitle },
          { label: 'Experience', value: profile.jobs.experience ? `${profile.jobs.experience} years` : undefined },
          { label: 'Skills', value: profile.jobs.skills },
          { label: 'Remote', value: profile.jobs.preferences?.remote ? 'Yes' : profile.jobs.preferences?.remote === false ? 'No' : undefined },
        ] : []
      default:
        return []
    }
  }

  const journeyFields = getJourneyFields()
  const filledFields = journeyFields.filter(f => f.value).length
  const totalFields = journeyFields.length

  // Minimal version - just the progress ring
  if (minimal) {
    return (
      <motion.button
        onClick={() => onExpand?.()}
        className="relative group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-10 h-10 transform -rotate-90">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          <motion.circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ strokeDasharray: "0 100" }}
            animate={{
              strokeDasharray: `${profile.completeness} ${100 - profile.completeness}`,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-white/70">
            {profile.completeness}%
          </span>
        </div>
      </motion.button>
    )
  }

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/5 border border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Glassmorphic background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            profile.journey
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/10 text-white/50'
          }`}>
            <JourneyIcon journey={profile.journey} />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              {profile.name || 'Your Profile'}
            </div>
            <div className="text-xs text-white/50">
              {profile.journey
                ? `${profile.journey.charAt(0).toUpperCase() + profile.journey.slice(1)} Journey`
                : 'Journey not selected'}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3">
          <motion.div
            animate={justUpdated ? { scale: [1, 1.2, 1] } : {}}
            className="text-right"
          >
            <div className={`text-lg font-semibold ${
              justUpdated ? 'text-emerald-400' : 'text-white'
            }`}>
              {profile.completeness}%
            </div>
            <div className="text-xs text-white/40">complete</div>
          </motion.div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${profile.completeness}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Journey fields */}
              {journeyFields.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white/30 uppercase tracking-wider mb-2">
                    What Wells knows
                  </div>
                  {journeyFields.map((field, i) => (
                    <ProfileFieldItem
                      key={field.label}
                      label={field.label}
                      value={field.value}
                    />
                  ))}
                </div>
              )}

              {/* Missing fields hint */}
              {profile.completeness < 80 && (
                <div className="text-xs text-white/40 text-center pt-2 border-t border-white/5">
                  Keep chatting to help Wells understand you better
                </div>
              )}

              {/* Complete message */}
              {profile.completeness >= 80 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-2 px-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20"
                >
                  <div className="text-emerald-400 text-sm font-medium">
                    Profile Complete
                  </div>
                  <div className="text-emerald-400/60 text-xs">
                    Wells has enough to really help you now
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// INLINE PROGRESS INDICATOR
// ============================================================================

export function InlineProfileProgress({
  completeness,
  journey,
}: {
  completeness: number
  journey?: string | null
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${completeness}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-white/50">
        {completeness}% learned
      </span>
    </div>
  )
}

// ============================================================================
// FLOATING INDICATOR
// ============================================================================

export function FloatingProfileIndicator({
  profile,
  onClick,
}: {
  profile: ProgressiveProfileData
  onClick?: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-50 p-3 rounded-full backdrop-blur-xl bg-black/40 border border-white/10 shadow-xl"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="relative">
        <svg className="w-8 h-8 transform -rotate-90">
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <motion.circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="url(#floatingProgressGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ strokeDasharray: "0 88" }}
            animate={{
              strokeDasharray: `${(profile.completeness / 100) * 88} ${88 - (profile.completeness / 100) * 88}`,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="floatingProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <JourneyIcon journey={profile.journey} />
        </div>
      </div>
    </motion.button>
  )
}

export default ProfileProgress
