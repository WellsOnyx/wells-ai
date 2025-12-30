'use client'

/**
 * Unified Join/Signup Page - WellsAI
 *
 * Single entry point for all users with:
 * - Email + company collection
 * - Role selection (CFO/Controller/Procurement/Other)
 * - Need selection (Treasury, Payments, Sourcing, Hiring, All)
 * - Optional ERP connection during signup
 * - Smart routing to appropriate journey after signup
 *
 * Design: Premium light aesthetic matching WellsAI brand
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSignUp, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Sparkles,
  Building2,
  Briefcase,
  Wallet,
  ShoppingCart,
  Users,
  Rocket,
  Zap,
  Shield,
  TrendingUp,
  Database,
  Link2,
  ChevronDown,
  Mail,
  Lock,
  User,
  AlertCircle,
} from 'lucide-react'
import {
  JourneyRouter,
  SignupData,
  UserRole,
  UserNeed,
  saveUserContext,
  getRoleDisplayName,
  getNeedDisplayName,
} from '@/lib/routing/journey-router'

// ============================================================================
// TYPES
// ============================================================================

type Step = 'welcome' | 'info' | 'role' | 'needs' | 'erp' | 'account' | 'complete'

interface FormData {
  email: string
  password: string
  companyName: string
  role: UserRole | null
  needs: UserNeed[]
  erpSystem: string
  connectErp: boolean
}

// ============================================================================
// ERP OPTIONS
// ============================================================================

const ERP_SYSTEMS = [
  { id: 'wells_native', name: 'WellsAI (Recommended)', description: 'Use WellsAI as your ERP', icon: Sparkles, recommended: true },
  { id: 'netsuite', name: 'Oracle NetSuite', description: 'Connect your NetSuite instance', icon: Database },
  { id: 'sap', name: 'SAP', description: 'Connect SAP S/4HANA or Business One', icon: Database },
  { id: 'dynamics365', name: 'Microsoft Dynamics 365', description: 'Connect D365 Finance', icon: Database },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Connect QuickBooks Online', icon: Database },
  { id: 'xero', name: 'Xero', description: 'Connect Xero accounting', icon: Database },
  { id: 'none', name: 'No ERP / Other', description: 'Skip for now', icon: Database },
]

// ============================================================================
// ROLE OPTIONS
// ============================================================================

const ROLE_OPTIONS: { id: UserRole; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'cfo', name: 'CFO', description: 'Chief Financial Officer', icon: Wallet },
  { id: 'controller', name: 'Controller', description: 'Finance & Accounting', icon: Briefcase },
  { id: 'procurement', name: 'Procurement', description: 'Purchasing & Sourcing', icon: ShoppingCart },
  { id: 'founder', name: 'Founder / CEO', description: 'Building a company', icon: Rocket },
  { id: 'hr', name: 'HR / People', description: 'Human Resources', icon: Users },
  { id: 'sales', name: 'Sales', description: 'Revenue & Growth', icon: TrendingUp },
  { id: 'other', name: 'Other', description: 'Something else', icon: Building2 },
]

// ============================================================================
// NEED OPTIONS
// ============================================================================

const NEED_OPTIONS: { id: UserNeed; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'treasury', name: 'Treasury', description: 'Cash management & GRAIN', icon: Wallet },
  { id: 'payments', name: 'Payments', description: 'AP/AR & invoicing', icon: Zap },
  { id: 'sourcing', name: 'Sourcing', description: 'Find suppliers & RFQs', icon: ShoppingCart },
  { id: 'hiring', name: 'Hiring', description: 'Recruit talent', icon: Users },
  { id: 'selling', name: 'Selling', description: 'Find customers', icon: TrendingUp },
  { id: 'all', name: 'All of the Above', description: 'I need everything', icon: Sparkles },
]

// ============================================================================
// STEP PROGRESS
// ============================================================================

const STEPS: Step[] = ['welcome', 'info', 'role', 'needs', 'erp', 'account', 'complete']

function getStepIndex(step: Step): number {
  return STEPS.indexOf(step)
}

function getProgress(step: Step): number {
  const index = getStepIndex(step)
  return Math.round((index / (STEPS.length - 1)) * 100)
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp()
  const { user, isLoaded: userLoaded } = useUser()

  const [step, setStep] = useState<Step>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    companyName: '',
    role: null,
    needs: [],
    erpSystem: '',
    connectErp: false,
  })

  // Check for referral code
  const referralCode = searchParams.get('ref') || searchParams.get('invite')

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (userLoaded && user) {
      // Check if onboarding is complete
      const meta = user.publicMetadata as Record<string, unknown>
      if (meta.onboardingCompleted) {
        router.push('/dashboard')
      } else if (meta.onboardingStarted) {
        router.push('/onboarding')
      }
    }
  }, [userLoaded, user, router])

  // Navigation
  const goToNextStep = () => {
    const currentIndex = getStepIndex(step)
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1])
      setError(null)
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = getStepIndex(step)
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1])
      setError(null)
    }
  }

  // Handle role selection
  const handleRoleSelect = (role: UserRole) => {
    setFormData({ ...formData, role })
    goToNextStep()
  }

  // Handle need toggle
  const handleNeedToggle = (need: UserNeed) => {
    if (need === 'all') {
      // If selecting "all", clear others and just use all
      setFormData({ ...formData, needs: ['all'] })
    } else {
      // Remove 'all' if selecting specific needs
      const filtered = formData.needs.filter(n => n !== 'all')
      if (filtered.includes(need)) {
        setFormData({ ...formData, needs: filtered.filter(n => n !== need) })
      } else {
        setFormData({ ...formData, needs: [...filtered, need] })
      }
    }
  }

  // Handle ERP selection
  const handleErpSelect = (erpId: string) => {
    setFormData({ ...formData, erpSystem: erpId, connectErp: erpId !== 'none' && erpId !== 'wells_native' })
  }

  // Create account with Clerk
  const handleCreateAccount = async () => {
    if (!signUpLoaded || !signUp) return

    setIsLoading(true)
    setError(null)

    try {
      // Create the signup
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
      })

      // Prepare email verification
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      // For now, skip verification in development and complete signup
      // In production, you'd redirect to email verification
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })

        // Save user context
        const signupData: SignupData = {
          email: formData.email,
          companyName: formData.companyName,
          role: formData.role!,
          needs: formData.needs,
          erpSystem: formData.erpSystem,
          referralCode: referralCode || undefined,
        }

        const context = JourneyRouter.createUserContext(result.createdUserId || '', signupData)
        saveUserContext(context)

        // Save to API for server-side persistence
        await fetch('/api/join/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...signupData,
            primaryJourney: context.primaryJourney,
            activeJourneys: context.activeJourneys,
          }),
        })

        goToNextStep()
      } else {
        // Need email verification
        goToNextStep()
      }
    } catch (err: unknown) {
      console.error('Signup error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Go to dashboard
  const handleGoToDashboard = () => {
    if (!formData.role) {
      router.push('/dashboard')
      return
    }

    const signupData: SignupData = {
      email: formData.email,
      companyName: formData.companyName,
      role: formData.role,
      needs: formData.needs,
      erpSystem: formData.erpSystem,
    }

    const context = JourneyRouter.createUserContext('', signupData)
    const route = JourneyRouter.getPostSignupRoute(context)
    router.push(route)
  }

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep onContinue={goToNextStep} />

      case 'info':
        return (
          <InfoStep
            formData={formData}
            onChange={(updates) => setFormData({ ...formData, ...updates })}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
          />
        )

      case 'role':
        return (
          <RoleStep
            selectedRole={formData.role}
            onSelect={handleRoleSelect}
            onBack={goToPreviousStep}
          />
        )

      case 'needs':
        return (
          <NeedsStep
            selectedNeeds={formData.needs}
            onToggle={handleNeedToggle}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
          />
        )

      case 'erp':
        return (
          <ErpStep
            selectedErp={formData.erpSystem}
            onSelect={handleErpSelect}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
          />
        )

      case 'account':
        return (
          <AccountStep
            formData={formData}
            onChange={(updates) => setFormData({ ...formData, ...updates })}
            onSubmit={handleCreateAccount}
            onBack={goToPreviousStep}
            isLoading={isLoading}
            error={error}
          />
        )

      case 'complete':
        return (
          <CompleteStep
            formData={formData}
            onGoToDashboard={handleGoToDashboard}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="p-6">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 font-semibold text-lg hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            WellsAI
          </Link>
        </header>

        {/* Progress Bar */}
        {step !== 'welcome' && step !== 'complete' && (
          <div className="px-6">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${getProgress(step)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-500">{getProgress(step)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg animate-slide-up">
            {renderStep()}
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </footer>
      </div>

      {/* Right Panel - Branding (Desktop Only) */}
      <div className="hidden lg:flex w-[480px] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 items-center justify-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-semibold text-white mb-4">
            AI That Actually Does Things
          </h2>

          <p className="text-white/80 text-lg mb-10 leading-relaxed">
            Tell Wells what you need. Get it done.
            <br />
            AI-to-AI negotiation with human approval.
          </p>

          <div className="space-y-4">
            <Feature icon={Zap} text="Get quotes in 48 hours, not weeks" />
            <Feature icon={Shield} text="500+ vetted suppliers ready to bid" />
            <Feature icon={TrendingUp} text="1% success fee - only pay when deals close" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function Feature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-white text-left">{text}</span>
    </div>
  )
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
        <Sparkles className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        Welcome to WellsAI
      </h1>

      <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
        Your AI-powered business operations platform. Let's get you set up in under 2 minutes.
      </p>

      <button
        onClick={onContinue}
        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        Get Started
        <ArrowRight className="w-5 h-5" />
      </button>

      <p className="mt-6 text-sm text-gray-500">
        No credit card required
      </p>
    </div>
  )
}

function InfoStep({
  formData,
  onChange,
  onContinue,
  onBack,
}: {
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
  onContinue: () => void
  onBack: () => void
}) {
  const isValid = formData.email.includes('@') && formData.companyName.length > 0

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Tell us about you
      </h1>
      <p className="text-gray-600 mb-8">
        We'll use this to personalize your experience
      </p>

      <div className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Work Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@company.com"
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1.5">
            Company Name
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="company"
              type="text"
              value={formData.companyName}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="Acme Inc"
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!isValid}
        className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function RoleStep({
  selectedRole,
  onSelect,
  onBack,
}: {
  selectedRole: UserRole | null
  onSelect: (role: UserRole) => void
  onBack: () => void
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        What's your role?
      </h1>
      <p className="text-gray-600 mb-6">
        We'll customize Wells for how you work
      </p>

      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map((role) => {
          const Icon = role.icon
          const isSelected = selectedRole === role.id
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                isSelected ? 'bg-blue-500' : 'bg-gray-100'
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
              </div>
              <h3 className="font-semibold text-gray-900">{role.name}</h3>
              <p className="text-sm text-gray-500">{role.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NeedsStep({
  selectedNeeds,
  onToggle,
  onContinue,
  onBack,
}: {
  selectedNeeds: UserNeed[]
  onToggle: (need: UserNeed) => void
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        What do you need?
      </h1>
      <p className="text-gray-600 mb-6">
        Select all that apply - you can always add more later
      </p>

      <div className="space-y-3">
        {NEED_OPTIONS.map((need) => {
          const Icon = need.icon
          const isSelected = selectedNeeds.includes(need.id)
          return (
            <button
              key={need.id}
              onClick={() => onToggle(need.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-blue-500' : 'bg-gray-100'
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{need.name}</h3>
                <p className="text-sm text-gray-500">{need.description}</p>
              </div>
              {isSelected && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={onContinue}
        disabled={selectedNeeds.length === 0}
        className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function ErpStep({
  selectedErp,
  onSelect,
  onContinue,
  onBack,
}: {
  selectedErp: string
  onSelect: (erpId: string) => void
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Connect your ERP
      </h1>
      <p className="text-gray-600 mb-6">
        Wells works best when connected to your systems - or use WellsAI as your ERP
      </p>

      <div className="space-y-3">
        {ERP_SYSTEMS.map((erp) => {
          const Icon = erp.icon
          const isSelected = selectedErp === erp.id
          return (
            <button
              key={erp.id}
              onClick={() => onSelect(erp.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : erp.recommended
                    ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected
                  ? 'bg-blue-500'
                  : erp.recommended
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
              }`}>
                <Icon className={`w-5 h-5 ${
                  isSelected
                    ? 'text-white'
                    : erp.recommended
                      ? 'text-blue-600'
                      : 'text-gray-600'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{erp.name}</h3>
                  {erp.recommended && !isSelected && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{erp.description}</p>
              </div>
              {isSelected && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={onContinue}
        disabled={!selectedErp}
        className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>

      <button
        onClick={() => { onSelect('none'); onContinue() }}
        className="w-full mt-3 px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
      >
        Skip for now
      </button>
    </div>
  )
}

function AccountStep({
  formData,
  onChange,
  onSubmit,
  onBack,
  isLoading,
  error,
}: {
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
  onSubmit: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  const isValid = formData.email.includes('@') && formData.password.length >= 8

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit()
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Create your account
      </h1>
      <p className="text-gray-600 mb-6">
        One last step - secure your account
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="account-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="account-email"
              type="email"
              value={formData.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@company.com"
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder="Minimum 8 characters"
              minLength={8}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            required
            id="terms"
            className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="terms" className="text-sm text-gray-600">
            I agree to the{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      {/* OAuth options */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gradient-to-b from-white to-gray-50 text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>
      </div>
    </div>
  )
}

function CompleteStep({
  formData,
  onGoToDashboard,
}: {
  formData: FormData
  onGoToDashboard: () => void
}) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/20">
        <Check className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        You're all set!
      </h1>

      <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
        Welcome to WellsAI, {formData.companyName || 'there'}. Your AI assistant is ready to help you get things done.
      </p>

      {/* Summary */}
      <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left">
        <h3 className="font-semibold text-gray-900 mb-4">Your setup:</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Company</p>
              <p className="font-medium text-gray-900">{formData.companyName || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium text-gray-900">{formData.role ? getRoleDisplayName(formData.role) : 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Focus Areas</p>
              <p className="font-medium text-gray-900">
                {formData.needs.length > 0
                  ? formData.needs.map(n => getNeedDisplayName(n)).join(', ')
                  : 'Not set'}
              </p>
            </div>
          </div>
          {formData.erpSystem && formData.erpSystem !== 'none' && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Database className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ERP</p>
                <p className="font-medium text-gray-900">
                  {ERP_SYSTEMS.find(e => e.id === formData.erpSystem)?.name || formData.erpSystem}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onGoToDashboard}
        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}
