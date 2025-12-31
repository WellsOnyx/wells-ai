'use client'

/**
 * Verification Badges Component
 *
 * Displays verification status for email, phone, identity, business, bank
 */

interface VerificationStatus {
  email: boolean
  phone: boolean
  identity: boolean
  business: boolean
  bank: boolean
}

interface VerificationBadgesProps {
  status: VerificationStatus
  showLabels?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const VERIFICATIONS = [
  { key: 'email', icon: '✉️', label: 'Email', color: '#3B82F6' },
  { key: 'phone', icon: '📱', label: 'Phone', color: '#10B981' },
  { key: 'identity', icon: '🪪', label: 'ID', color: '#8B5CF6' },
  { key: 'business', icon: '🏢', label: 'Business', color: '#F59E0B' },
  { key: 'bank', icon: '🏦', label: 'Bank', color: '#EC4899' },
] as const

const SIZE_CLASSES = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-base',
}

export function VerificationBadges({
  status,
  showLabels = false,
  size = 'md',
  className = '',
}: VerificationBadgesProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {VERIFICATIONS.map((v) => {
        const isVerified = status[v.key as keyof VerificationStatus]

        return (
          <div
            key={v.key}
            className="flex items-center gap-1.5"
            title={`${v.label}: ${isVerified ? 'Verified' : 'Not verified'}`}
          >
            <div
              className={`
                ${SIZE_CLASSES[size]} rounded-full flex items-center justify-center
                transition-all
                ${isVerified
                  ? 'bg-white/10 ring-2'
                  : 'bg-white/5 opacity-40'
                }
              `}
              style={{
                ringColor: isVerified ? v.color : 'transparent',
              }}
            >
              <span className={isVerified ? '' : 'grayscale'}>
                {v.icon}
              </span>
            </div>
            {showLabels && (
              <span className={`text-xs ${isVerified ? 'text-white/80' : 'text-white/40'}`}>
                {v.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function VerificationProgress({
  status,
  className = '',
}: {
  status: VerificationStatus
  className?: string
}) {
  const verified = Object.values(status).filter(Boolean).length
  const total = Object.keys(status).length
  const percentage = (verified / total) * 100

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">Verification Progress</span>
        <span className="text-sm font-medium text-white">
          {verified}/{total}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default VerificationBadges
