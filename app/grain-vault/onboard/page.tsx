// @ts-nocheck
'use client'

/**
 * Grain & Vault Onboarding - International KYC
 *
 * REQUIRES Clerk authentication - redirects to sign-in if not authenticated.
 * Supports: US, CA, MX, AR, GB, AE, JP, SG
 * Blocks: All US-sanctioned countries
 */

import { useState, useEffect, useMemo } from 'react'
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
  AlertTriangle
} from 'lucide-react'
import {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  getStatesForCountry,
  getEnabledCountries,
  isCountrySanctioned,
  CountryConfig
} from '@/lib/grain-vault/countries'

type OnboardingStep = 'country' | 'identity' | 'financial' | 'wallet'

interface OnboardingData {
  // Country Selection
  country_of_residence: string
  nationality: string

  // Identity
  full_name: string
  date_of_birth: string
  phone: string

  // Tax ID (country-specific)
  tax_id_type: string
  tax_id_last_four: string

  // Government ID
  government_id_type: string
  government_id_expiry: string

  // Address
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string

  // Financial Profile
  employment_status: string
  annual_income_range: string
  net_worth_range: string
  investment_experience: string
  source_of_funds: string

  // Terms
  terms_accepted: boolean
}

const STEPS: { id: OnboardingStep; title: string; description: string; icon: any }[] = [
  {
    id: 'country',
    title: 'Country',
    description: 'Select your country of residence',
    icon: Globe
  },
  {
    id: 'identity',
    title: 'Identity',
    description: 'Verify your identity',
    icon: Shield
  },
  {
    id: 'financial',
    title: 'Financial Profile',
    description: 'Help us understand your needs',
    icon: DollarSign
  },
  {
    id: 'wallet',
    title: 'Wallet Setup',
    description: 'Create your GRAIN wallet',
    icon: Wallet
  }
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('country')
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingWallet, setCheckingWallet] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<OnboardingData>({
    country_of_residence: 'US',
    nationality: '',
    full_name: '',
    date_of_birth: '',
    phone: '',
    tax_id_type: '',
    tax_id_last_four: '',
    government_id_type: '',
    government_id_expiry: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    employment_status: '',
    annual_income_range: '',
    net_worth_range: '',
    investment_experience: '',
    source_of_funds: '',
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
        full_name: user.fullName || '',
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
        tax_id_type: '',
        tax_id_last_four: '',
        government_id_type: '',
        state: '',
        zip_code: ''
      }))
    }
  }

  const validateStep = (): boolean => {
    setError(null)

    switch (currentStep) {
      case 'country':
        if (!data.country_of_residence) {
          setError('Please select your country of residence')
          return false
        }
        if (isCountrySanctioned(data.country_of_residence)) {
          setError('Service is not available in your country due to regulatory requirements')
          return false
        }
        if (data.nationality && isCountrySanctioned(data.nationality)) {
          setError('Service is not available for nationals of certain countries due to regulatory requirements')
          return false
        }
        break

      case 'identity':
        if (!data.full_name || !data.date_of_birth) {
          setError('Please fill in your name and date of birth')
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
        // Address validation
        if (!data.address_line1 || !data.city || !data.zip_code) {
          setError('Please fill in all required address fields')
          return false
        }
        if (countryConfig?.address.hasState && !data.state) {
          setError(`Please select your ${countryConfig.address.stateLabel}`)
          return false
        }
        break

      case 'financial':
        if (!data.employment_status || !data.source_of_funds) {
          setError('Please fill in all required fields')
          return false
        }
        break

      case 'wallet':
        if (!data.terms_accepted) {
          setError('You must accept the terms of service to continue')
          return false
        }
        break
    }

    return true
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
      const onboardRes = await fetch('/api/grain-vault/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email: user?.primaryEmailAddress?.emailAddress
        })
      })

      const onboardResult = await onboardRes.json()

      if (!onboardRes.ok) {
        throw new Error(onboardResult.message || onboardResult.error || 'Failed to save profile')
      }

      // Wallet is created by the onboard API, no need to call deposit API
      // Just redirect to dashboard
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
      case 'country':
        return (
          <div className="space-y-6">
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
                Nationality (Optional)
              </label>
              <select
                value={data.nationality}
                onChange={(e) => updateData('nationality', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select (same as residence)</option>
                {enabledCountries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>

            {countryConfig && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">
                  {countryConfig.flag} {countryConfig.name} - Requirements
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>Minimum age: {countryConfig.kyc.minAge} years</li>
                  <li>ID types: {countryConfig.acceptedIdTypes.length} accepted</li>
                  {countryConfig.taxId && (
                    <li>Tax ID: {countryConfig.taxId.name} {countryConfig.taxId.required ? '(required)' : '(optional)'}</li>
                  )}
                  <li>Daily limits: ${countryConfig.limits.level1Daily.toLocaleString()} - ${countryConfig.limits.level3Daily.toLocaleString()}</li>
                </ul>
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-400 mb-1">
                    Important Notice
                  </h4>
                  <p className="text-sm text-gray-400">
                    You must be a legal resident of your selected country.
                    Providing false information may result in account suspension and legal action.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'identity':
        return (
          <div className="space-y-6">
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
              <p className="mt-1 text-xs text-gray-500">
                Minimum age: {countryConfig?.kyc.minAge || 18} years in {countryConfig?.name || 'your country'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address Line 1 *
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
                  City *
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
                    {countryConfig.address.stateLabel} *
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
                    {countryConfig.address.stateLabel} *
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
                {countryConfig?.address.postalCodeLabel || 'Postal Code'} *
              </label>
              <input
                type="text"
                value={data.zip_code}
                onChange={(e) => updateData('zip_code', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                placeholder={data.country_of_residence === 'US' ? '12345' : 'Enter postal code'}
              />
            </div>

            {countryConfig?.taxId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {countryConfig.taxId.name} (Last 4 digits) {countryConfig.taxId.required ? '*' : '- Optional, increases limits'}
                </label>
                <input
                  type="text"
                  value={data.tax_id_last_four}
                  onChange={(e) => updateData('tax_id_last_four', e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
                  placeholder={countryConfig.taxId.example}
                  maxLength={4}
                />
                <p className="mt-2 text-xs text-gray-400">
                  Providing {countryConfig.taxId.name} increases daily limits to ${countryConfig.limits.level3Daily.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )

      case 'financial':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Employment Status *
              </label>
              <select
                value={data.employment_status}
                onChange={(e) => updateData('employment_status', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select...</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="retired">Retired</option>
                <option value="student">Student</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Annual Income Range
              </label>
              <select
                value={data.annual_income_range}
                onChange={(e) => updateData('annual_income_range', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select...</option>
                <option value="under_25k">Under $25,000</option>
                <option value="25k_50k">$25,000 - $50,000</option>
                <option value="50k_100k">$50,000 - $100,000</option>
                <option value="100k_250k">$100,000 - $250,000</option>
                <option value="250k_500k">$250,000 - $500,000</option>
                <option value="500k_1m">$500,000 - $1,000,000</option>
                <option value="1m_plus">$1,000,000+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Net Worth Range
              </label>
              <select
                value={data.net_worth_range}
                onChange={(e) => updateData('net_worth_range', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select...</option>
                <option value="under_50k">Under $50,000</option>
                <option value="50k_100k">$50,000 - $100,000</option>
                <option value="100k_500k">$100,000 - $500,000</option>
                <option value="500k_1m">$500,000 - $1,000,000</option>
                <option value="1m_5m">$1,000,000 - $5,000,000</option>
                <option value="5m_plus">$5,000,000+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Investment Experience
              </label>
              <select
                value={data.investment_experience}
                onChange={(e) => updateData('investment_experience', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select...</option>
                <option value="none">None</option>
                <option value="beginner">Beginner (1-2 years)</option>
                <option value="intermediate">Intermediate (3-5 years)</option>
                <option value="experienced">Experienced (5+ years)</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Primary Source of Funds *
              </label>
              <select
                value={data.source_of_funds}
                onChange={(e) => updateData('source_of_funds', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-white"
              >
                <option value="">Select...</option>
                <option value="salary">Salary/Wages</option>
                <option value="business">Business Income</option>
                <option value="investments">Investment Returns</option>
                <option value="inheritance">Inheritance</option>
                <option value="gift">Gift</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )

      case 'wallet':
        return (
          <div className="space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Your GRAIN Wallet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    We'll create a secure wallet for you to hold GRAIN tokens. Your wallet address will be generated after you complete onboarding.
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
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Available in {countryConfig?.name || 'your country'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Terms of Service</h3>

              <div className="space-y-4 text-sm text-gray-400 max-h-64 overflow-y-auto mb-6 pr-4">
                <p>
                  By creating a Grain & Vault account, you agree to the following terms:
                </p>
                <p>
                  <strong className="text-white">1. Account Eligibility:</strong> You must be at least {countryConfig?.kyc.minAge || 18} years old and a legal resident of {countryConfig?.name || 'a supported country'}.
                </p>
                <p>
                  <strong className="text-white">2. GRAIN Token:</strong> GRAIN is backed 1:1 by US dollars and dollar-equivalent assets held in segregated accounts. The value of GRAIN may appreciate as the treasury grows through fees and yield.
                </p>
                <p>
                  <strong className="text-white">3. No Interest Payments:</strong> GRAIN does not pay interest or yield to holders. Value appreciation occurs through the backing ratio mechanism.
                </p>
                <p>
                  <strong className="text-white">4. Transaction Limits:</strong> Your account is subject to daily and lifetime transaction limits based on your verification level and country of residence.
                </p>
                <p>
                  <strong className="text-white">5. AML/KYC Compliance:</strong> We reserve the right to request additional identity verification at any time. We comply with all applicable anti-money laundering regulations.
                </p>
                <p>
                  <strong className="text-white">6. Risk Disclosure:</strong> While GRAIN is backed by real assets, all investments carry risk. Past appreciation is not indicative of future results.
                </p>
                <p>
                  <strong className="text-white">7. Jurisdiction:</strong> These terms are governed by the laws of the United States. Users in other jurisdictions are responsible for compliance with local laws.
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

          <div className="flex items-center gap-4">
            {countryConfig && (
              <span className="text-sm text-gray-400">{countryConfig.flag} {countryConfig.name}</span>
            )}
            <span className="text-sm text-gray-500">|</span>
            <span className="text-sm text-gray-400">{user?.primaryEmailAddress?.emailAddress}</span>
            <span className="text-sm text-gray-500">|</span>
            <span className="text-sm text-gray-400">Step {currentStepIndex + 1} of {STEPS.length}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
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

                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
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
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
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
              disabled={loading}
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
                  <ArrowRight className="w-5 h-5" />
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
