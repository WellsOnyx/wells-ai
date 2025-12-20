// @ts-nocheck
'use client'

/**
 * Grain & Vault Onboarding with KYC Verification
 *
 * REQUIRES Clerk authentication - redirects to sign-in if not authenticated.
 * Supports: US, CA, MX, AR, GB, AE, JP, SG
 * Blocks: All US-sanctioned countries
 *
 * Verification Levels:
 * - Basic ($1,000/day) - Email verification only
 * - Standard ($10,000/day) - ID verification via Veriff
 * - Premium ($100,000/day) - ID + address verification
 * - Unlimited - Full KYC + enhanced due diligence
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  Wallet,
  DollarSign,
  Loader2,
  LogIn,
  Globe,
  AlertTriangle,
  User,
  Phone,
  BadgeCheck,
  ExternalLink,
  RefreshCw,
  Lock,
  Zap,
  Crown,
  Star
} from 'lucide-react'
import {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  getStatesForCountry,
  getEnabledCountries,
  isCountrySanctioned,
  CountryConfig
} from '@/lib/grain-vault/countries'

type OnboardingStep = 'basics' | 'details' | 'kyc' | 'wallet'

interface OnboardingData {
  // Step 1: Basics (from Clerk)
  full_name: string
  email: string

  // Step 2: Details
  phone: string
  country_of_residence: string
  nationality: string
  date_of_birth: string

  // Address
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string

  // Financial Profile
  employment_status: string
  source_of_funds: string

  // Step 3: KYC
  desired_tier: 'basic' | 'standard' | 'premium' | 'unlimited'
  kyc_session_id: string | null
  kyc_status: 'pending' | 'in_progress' | 'approved' | 'rejected' | null

  // Step 4: Terms
  terms_accepted: boolean
}

interface VerificationTier {
  id: 'basic' | 'standard' | 'premium' | 'unlimited'
  name: string
  dailyLimit: string
  monthlyLimit: string
  icon: any
  color: string
  bgColor: string
  borderColor: string
  requirements: string[]
  description: string
  recommended?: boolean
}

const VERIFICATION_TIERS: VerificationTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    dailyLimit: '$1,000',
    monthlyLimit: '$10,000',
    icon: User,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    requirements: ['Email verification'],
    description: 'Perfect for getting started. No additional verification required.'
  },
  {
    id: 'standard',
    name: 'Standard',
    dailyLimit: '$10,000',
    monthlyLimit: '$100,000',
    icon: BadgeCheck,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    requirements: ['Email verification', 'Government ID verification'],
    description: 'Verify your identity with a government-issued photo ID.',
    recommended: true
  },
  {
    id: 'premium',
    name: 'Premium',
    dailyLimit: '$100,000',
    monthlyLimit: '$1,000,000',
    icon: Crown,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    requirements: ['Email verification', 'Government ID verification', 'Address verification'],
    description: 'Full identity and address verification for higher limits.'
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    dailyLimit: 'Unlimited',
    monthlyLimit: 'Unlimited',
    icon: Star,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    requirements: ['Full KYC verification', 'Enhanced due diligence', 'Source of funds verification', 'Manual compliance review'],
    description: 'For high-volume users. Includes enhanced due diligence.'
  }
]

const STEPS: { id: OnboardingStep; title: string; description: string; icon: any }[] = [
  {
    id: 'basics',
    title: 'Your Information',
    description: 'Confirm your basic details',
    icon: User
  },
  {
    id: 'details',
    title: 'Additional Details',
    description: 'Contact and address information',
    icon: Phone
  },
  {
    id: 'kyc',
    title: 'Verification Level',
    description: 'Choose your account tier',
    icon: Shield
  },
  {
    id: 'wallet',
    title: 'Create Wallet',
    description: 'Review and confirm',
    icon: Wallet
  }
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basics')
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingWallet, setCheckingWallet] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kycLoading, setKycLoading] = useState(false)
  const [kycUrl, setKycUrl] = useState<string | null>(null)
  const [pollingKyc, setPollingKyc] = useState(false)

  const [data, setData] = useState<OnboardingData>({
    full_name: '',
    email: '',
    phone: '',
    country_of_residence: 'US',
    nationality: '',
    date_of_birth: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    employment_status: '',
    source_of_funds: '',
    desired_tier: 'standard',
    kyc_session_id: null,
    kyc_status: null,
    terms_accepted: false
  })

  // Get country config based on selection
  const countryConfig = useMemo(() => {
    return getCountryConfig(data.country_of_residence)
  }, [data.country_of_residence])

  // Get states/provinces for selected country
  const statesForCountry = useMemo(() => {
    return getStatesForCountry(data.country_of_residence)
  }, [data.country_of_residence])

  // Get enabled countries for dropdown
  const enabledCountries = useMemo(() => getEnabledCountries(), [])

  // Pre-fill user data from Clerk
  useEffect(() => {
    if (user) {
      setData(prev => ({
        ...prev,
        full_name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.primaryEmailAddress?.emailAddress || '',
        phone: user.primaryPhoneNumber?.phoneNumber || ''
      }))
    }
  }, [user])

  // Check if user already has a wallet - redirect to dashboard if so
  useEffect(() => {
    async function checkExistingWallet() {
      if (!isSignedIn) {
        setCheckingWallet(false)
        return
      }

      try {
        const res = await fetch('/api/grain-vault/deposit')
        const data = await res.json()

        if (data.has_wallet) {
          router.push('/grain-vault/dashboard')
          return
        }
      } catch (e) {
        // No wallet found, continue with onboarding
      }
      setCheckingWallet(false)
    }

    if (isLoaded) {
      checkExistingWallet()
    }
  }, [isLoaded, isSignedIn, router])

  // Poll KYC status when in progress
  const checkKycStatus = useCallback(async () => {
    if (!data.kyc_session_id) return

    try {
      const res = await fetch(`/api/grain-vault/kyc?sessionId=${data.kyc_session_id}`)
      const result = await res.json()

      if (result.status === 'approved') {
        setData(prev => ({ ...prev, kyc_status: 'approved' }))
        setPollingKyc(false)
      } else if (result.status === 'rejected' || result.status === 'expired') {
        setData(prev => ({ ...prev, kyc_status: 'rejected' }))
        setPollingKyc(false)
        setError('Verification was not successful. Please try again or choose a different tier.')
      }
    } catch (e) {
      console.error('Error checking KYC status:', e)
    }
  }, [data.kyc_session_id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (pollingKyc && data.kyc_session_id) {
      interval = setInterval(checkKycStatus, 5000) // Poll every 5 seconds
    }
    return () => clearInterval(interval)
  }, [pollingKyc, data.kyc_session_id, checkKycStatus])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const progress = ((completedSteps.length) / STEPS.length) * 100

  const updateData = (field: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
    setError(null)

    // Reset country-specific fields when country changes
    if (field === 'country_of_residence') {
      setData(prev => ({
        ...prev,
        [field]: value,
        state: '',
        zip_code: ''
      }))
    }
  }

  const validateStep = (): boolean => {
    setError(null)

    switch (currentStep) {
      case 'basics':
        if (!data.full_name) {
          setError('Please enter your full name')
          return false
        }
        if (!data.email) {
          setError('Email is required')
          return false
        }
        break

      case 'details':
        if (!data.date_of_birth) {
          setError('Please enter your date of birth')
          return false
        }
        // Age check
        const minAge = countryConfig?.kyc.minAge || 18
        const dob = new Date(data.date_of_birth)
        const today = new Date()
        const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (age < minAge) {
          setError(`You must be at least ${minAge} years old to use this service in ${countryConfig?.name}`)
          return false
        }
        if (!data.country_of_residence) {
          setError('Please select your country of residence')
          return false
        }
        if (isCountrySanctioned(data.country_of_residence)) {
          setError('Service is not available in your country due to regulatory requirements')
          return false
        }
        break

      case 'kyc':
        // For tiers requiring verification, check if verified
        if (data.desired_tier !== 'basic') {
          if (data.kyc_status !== 'approved' && !data.kyc_session_id) {
            // User hasn't started verification - that's okay, they can proceed to start it
          }
        }
        break

      case 'wallet':
        if (!data.terms_accepted) {
          setError('You must accept the terms of service to continue')
          return false
        }
        // Final validation for KYC if needed
        if (data.desired_tier !== 'basic' && data.kyc_status !== 'approved') {
          setError('Please complete identity verification or choose the Basic tier')
          return false
        }
        break
    }

    return true
  }

  const startKycVerification = async () => {
    setKycLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/grain-vault/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: data.desired_tier,
          userData: {
            firstName: data.full_name.split(' ')[0],
            lastName: data.full_name.split(' ').slice(1).join(' ') || data.full_name.split(' ')[0],
            email: data.email,
            dateOfBirth: data.date_of_birth,
            phone: data.phone,
            address: data.address_line1 ? {
              line1: data.address_line1,
              line2: data.address_line2,
              city: data.city,
              state: data.state,
              postalCode: data.zip_code,
              country: data.country_of_residence
            } : undefined
          }
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to start verification')
      }

      setData(prev => ({
        ...prev,
        kyc_session_id: result.sessionId,
        kyc_status: 'in_progress'
      }))
      setKycUrl(result.verificationUrl)
      setPollingKyc(true)

      // Open Veriff in new tab
      window.open(result.verificationUrl, '_blank')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setKycLoading(false)
    }
  }

  const nextStep = () => {
    if (!validateStep()) return

    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep])
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const completeOnboarding = async () => {
    if (!validateStep()) return

    setLoading(true)
    setError(null)

    try {
      // Calculate verification level based on tier and KYC status
      let verification_level = 1
      if (data.desired_tier === 'standard' && data.kyc_status === 'approved') {
        verification_level = 2
      } else if (data.desired_tier === 'premium' && data.kyc_status === 'approved') {
        verification_level = 3
      } else if (data.desired_tier === 'unlimited' && data.kyc_status === 'approved') {
        verification_level = 4
      }

      const onboardRes = await fetch('/api/grain-vault/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          date_of_birth: data.date_of_birth,
          country_of_residence: data.country_of_residence,
          nationality: data.nationality || data.country_of_residence,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          employment_status: data.employment_status,
          source_of_funds: data.source_of_funds,
          terms_accepted: data.terms_accepted,
          verification_level,
          kyc_session_id: data.kyc_session_id,
          desired_tier: data.desired_tier
        })
      })

      const onboardResult = await onboardRes.json()

      if (!onboardRes.ok) {
        throw new Error(onboardResult.message || onboardResult.error || 'Failed to save profile')
      }

      router.push('/grain-vault/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth and wallet
  if (!isLoaded || checkingWallet) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not signed in - show sign-in prompt
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-3 h-3 bg-black rounded-sm" />
              </div>
              <span className="text-lg font-semibold">Grain & Vault</span>
            </Link>
          </div>
        </header>

        <main className="max-w-md mx-auto px-6 py-24">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-green-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              Sign In to Continue
            </h1>
            <p className="text-gray-400 mb-8">
              Create an account or sign in to set up your GRAIN wallet.
            </p>

            <SignInButton mode="modal" fallbackRedirectUrl="/grain-vault/onboard">
              <button className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5" />
                Sign In or Create Account
              </button>
            </SignInButton>

            <p className="mt-6 text-xs text-gray-500">
              We use secure authentication to protect your account
            </p>
          </div>
        </main>
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'basics':
        return (
          <div className="space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-1">
                    Account Verified
                  </h4>
                  <p className="text-sm text-gray-400">
                    Your email has been verified through your sign-in provider.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Legal Name *
              </label>
              <input
                type="text"
                value={data.full_name}
                onChange={(e) => updateData('full_name', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                placeholder="Enter your full legal name"
              />
              <p className="mt-1 text-xs text-gray-500">
                This must match your government-issued ID
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={data.email}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Verified through your account
              </p>
            </div>
          </div>
        )

      case 'details':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Country of Residence *
                </label>
                <select
                  value={data.country_of_residence}
                  onChange={(e) => updateData('country_of_residence', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                >
                  {enabledCountries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={data.date_of_birth}
                  onChange={(e) => updateData('date_of_birth', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number ({countryConfig?.phone.prefix || '+1'})
              </label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => updateData('phone', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                placeholder={countryConfig?.phone.example || '(555) 123-4567'}
              />
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Address (Optional)</h3>
              <p className="text-sm text-gray-400 mb-4">
                Providing your address enables higher transaction limits.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={data.address_line1}
                    onChange={(e) => updateData('address_line1', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={data.address_line2}
                    onChange={(e) => updateData('address_line2', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                    placeholder="Apt, suite, etc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={data.city}
                      onChange={(e) => updateData('city', e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                      placeholder="City"
                    />
                  </div>

                  {countryConfig?.address.hasState && statesForCountry.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {countryConfig.address.stateLabel}
                      </label>
                      <select
                        value={data.state}
                        onChange={(e) => updateData('state', e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                      >
                        <option value="">Select...</option>
                        {statesForCountry.map(s => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : countryConfig?.address.hasState ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {countryConfig.address.stateLabel}
                      </label>
                      <input
                        type="text"
                        value={data.state}
                        onChange={(e) => updateData('state', e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                        placeholder={countryConfig.address.stateLabel}
                      />
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {countryConfig?.address.postalCodeLabel || 'Postal Code'}
                  </label>
                  <input
                    type="text"
                    value={data.zip_code}
                    onChange={(e) => updateData('zip_code', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                    placeholder={data.country_of_residence === 'US' ? '12345' : 'Enter postal code'}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'kyc':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h3 className="text-lg font-semibold text-white mb-2">
                Choose Your Verification Level
              </h3>
              <p className="text-gray-400">
                Higher verification levels unlock larger transaction limits
              </p>
            </div>

            <div className="space-y-4">
              {VERIFICATION_TIERS.map((tier) => {
                const Icon = tier.icon
                const isSelected = data.desired_tier === tier.id
                const canSelect = tier.id === 'basic' ||
                  (tier.id !== 'unlimited') ||
                  (tier.id === 'unlimited' && data.address_line1) // Unlimited requires address

                return (
                  <button
                    key={tier.id}
                    onClick={() => canSelect && updateData('desired_tier', tier.id)}
                    disabled={!canSelect}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? `${tier.bgColor} ${tier.borderColor.replace('/20', '/50')}`
                        : `bg-white/5 border-white/10 hover:border-white/20 ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}`
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${tier.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-6 h-6 ${tier.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{tier.name}</h4>
                          {tier.recommended && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{tier.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm">
                            <span className="text-gray-500">Daily:</span>{' '}
                            <span className={tier.color}>{tier.dailyLimit}</span>
                          </span>
                          <span className="text-sm">
                            <span className="text-gray-500">Monthly:</span>{' '}
                            <span className={tier.color}>{tier.monthlyLimit}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {tier.requirements.map((req, i) => (
                            <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? `${tier.borderColor.replace('/20', '')} bg-white/10` : 'border-white/20'
                      }`}>
                        {isSelected && <div className={`w-3 h-3 rounded-full ${tier.color.replace('text-', 'bg-')}`} />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* KYC Verification Section */}
            {data.desired_tier !== 'basic' && (
              <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-blue-400" />
                  <h4 className="font-semibold text-white">Identity Verification Required</h4>
                </div>

                {data.kyc_status === 'approved' ? (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="font-medium text-green-400">Verification Complete</p>
                      <p className="text-sm text-gray-400">Your identity has been verified</p>
                    </div>
                  </div>
                ) : data.kyc_status === 'in_progress' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                      <div>
                        <p className="font-medium text-yellow-400">Verification in Progress</p>
                        <p className="text-sm text-gray-400">Complete verification in the new tab</p>
                      </div>
                    </div>

                    {kycUrl && (
                      <a
                        href={kycUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Open Verification
                      </a>
                    )}

                    <button
                      onClick={checkKycStatus}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Check Status
                    </button>
                  </div>
                ) : data.kyc_status === 'rejected' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                      <div>
                        <p className="font-medium text-red-400">Verification Failed</p>
                        <p className="text-sm text-gray-400">Please try again or choose a different tier</p>
                      </div>
                    </div>
                    <button
                      onClick={startKycVerification}
                      disabled={kycLoading}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      {kycLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      To unlock {VERIFICATION_TIERS.find(t => t.id === data.desired_tier)?.dailyLimit}/day limits,
                      verify your identity with a government-issued photo ID.
                    </p>

                    <div className="p-4 bg-white/5 rounded-lg">
                      <h5 className="font-medium text-white mb-2">What you'll need:</h5>
                      <ul className="space-y-2 text-sm text-gray-400">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          A government-issued photo ID (passport, driver's license)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          A device with a camera
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          Good lighting for a selfie
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={startKycVerification}
                      disabled={kycLoading}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50"
                    >
                      {kycLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Starting Verification...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Start Identity Verification
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-gray-500">
                      Powered by Veriff - Bank-grade identity verification
                    </p>
                  </div>
                )}
              </div>
            )}

            {data.desired_tier === 'unlimited' && !data.address_line1 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-gray-400">
                    Unlimited tier requires address verification. Please go back and add your address.
                  </p>
                </div>
              </div>
            )}
          </div>
        )

      case 'wallet':
        const selectedTier = VERIFICATION_TIERS.find(t => t.id === data.desired_tier)
        const TierIcon = selectedTier?.icon || Wallet

        return (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className={`p-6 rounded-xl ${selectedTier?.bgColor} border ${selectedTier?.borderColor}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center`}>
                  <TierIcon className={`w-7 h-7 ${selectedTier?.color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedTier?.name} Account</h3>
                  <p className="text-gray-400">
                    {data.kyc_status === 'approved' || data.desired_tier === 'basic'
                      ? 'Ready to create'
                      : 'Verification pending'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-sm text-gray-500">Daily Limit</p>
                  <p className={`text-lg font-semibold ${selectedTier?.color}`}>{selectedTier?.dailyLimit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monthly Limit</p>
                  <p className={`text-lg font-semibold ${selectedTier?.color}`}>{selectedTier?.monthlyLimit}</p>
                </div>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Your GRAIN Wallet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Your secure wallet for holding GRAIN tokens will be created after you accept the terms.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      100% backed by real assets
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Appreciates as treasury grows
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Instant transfers, zero fees
                    </li>
                    <li className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-green-400" />
                      Secured by bank-grade encryption
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Terms of Service</h3>

              <div className="space-y-4 text-sm text-gray-400 max-h-48 overflow-y-auto mb-6 pr-4">
                <p>
                  By creating a Grain & Vault account, you agree to the following terms:
                </p>
                <p>
                  <strong className="text-white">1. Account Eligibility:</strong> You must be at least {countryConfig?.kyc.minAge || 18} years old and a legal resident of {countryConfig?.name || 'a supported country'}.
                </p>
                <p>
                  <strong className="text-white">2. GRAIN Token:</strong> GRAIN is backed 1:1 by US dollars and dollar-equivalent assets held in segregated accounts.
                </p>
                <p>
                  <strong className="text-white">3. Transaction Limits:</strong> Your account is subject to the limits of your verification level ({selectedTier?.dailyLimit}/day).
                </p>
                <p>
                  <strong className="text-white">4. AML/KYC Compliance:</strong> We reserve the right to request additional identity verification at any time.
                </p>
                <p>
                  <strong className="text-white">5. Risk Disclosure:</strong> While GRAIN is backed by real assets, all investments carry risk.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={data.terms_accepted}
                  onChange={(e) => updateData('terms_accepted', e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-green-500 focus:ring-green-500"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  I have read and agree to the Terms of Service and Privacy Policy. I confirm that I am a legal resident of {countryConfig?.name || 'my selected country'} and meet all eligibility requirements.
                </span>
              </label>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm" />
            </div>
            <span className="text-lg font-semibold">Grain & Vault</span>
          </Link>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
          style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-12">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = currentStep === step.id

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500/20 border-green-500'
                        : isCurrent
                        ? 'bg-white/5 border-green-500'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <Icon
                        className={`w-6 h-6 ${
                          isCurrent ? 'text-green-400' : 'text-gray-500'
                        }`}
                      />
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${isCurrent ? 'text-green-400' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                </div>

                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 mb-6 ${
                      isCompleted ? 'bg-green-500' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {STEPS[currentStepIndex].title}
            </h2>
            <p className="text-gray-400">{STEPS[currentStepIndex].description}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {renderStep()}

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-8 pt-8 border-t border-white/10">
            {currentStepIndex > 0 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-medium hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}

            <button
              onClick={currentStep === 'wallet' ? completeOnboarding : nextStep}
              disabled={loading || (currentStep === 'kyc' && data.desired_tier !== 'basic' && data.kyc_status !== 'approved')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Wallet...
                </>
              ) : currentStep === 'wallet' ? (
                <>
                  Create Wallet
                  <Zap className="w-5 h-5" />
                </>
              ) : currentStep === 'kyc' && data.desired_tier !== 'basic' && data.kyc_status !== 'approved' ? (
                <>
                  Complete Verification First
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
