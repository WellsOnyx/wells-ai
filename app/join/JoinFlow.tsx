'use client'

/**
 * Unified Join/Signup Page - Grain & Vault Branding
 *
 * THE SINGLE ENTRY POINT for both wellsonyx.io and grainandvault.com
 *
 * Always uses Grain & Vault branding (emerald/green theme)
 * Journey determines dashboard routing:
 * - treasury: CFO, Finance, Procurement roles
 * - sourcing: Buyer, Procurement roles
 * - sales: Seller roles
 * - hiring: HR/Recruiter roles
 *
 * Powered by WellsAI attribution included
 */

import { useState, useEffect, useCallback } from 'react'
import '@/app/grain-calm.css'
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
  TrendingDown,
  Database,
  Mail,
  Lock,
  AlertCircle,
  Play,
  DollarSign,
  Globe,
  Clock,
  Activity,
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
type JourneyType = 'treasury' | 'sourcing' | 'sales' | 'hiring' | null

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
// UNIFIED BRAND THEME - Grain & Vault
// ============================================================================

const CALM_THEME = {
  name: 'calm',
  logo: 'grain-vault',
  bgGradient: 'from-[#07080b] via-[#07080b] to-[#07080b]',
  panelBg: 'from-[#07080b] via-[#14110c] to-[#07080b]',
  accent: 'amber',
  accentGradient: 'from-[#ffd08f] to-[#f2b45a]',
  buttonGradient: 'from-[#ffd08f] to-[#f2b45a]',
  buttonShadow: 'shadow-[0_10px_40px_rgba(242,180,90,0.3)]',
  textPrimary: 'text-[#f4efe6]',
  textSecondary: 'text-[rgba(244,239,230,0.56)]',
  inputBg: 'bg-white/[0.04]',
  inputBorder: 'border-[rgba(244,239,230,0.09)]',
  inputFocus: 'focus:border-[#f2b45a] focus:ring-[#f2b45a]/20',
  cardBg: 'bg-white/[0.04] border-[rgba(244,239,230,0.09)]',
  selectedBorder: 'border-[#f2b45a] bg-[rgba(242,180,90,0.12)]',
  selectedBg: 'bg-[#f2b45a]',
  progressBar: 'from-[#ffd08f] to-[#f2b45a]',
  buttonText: 'text-[#1c1204]',
  href: '/',
}

const UNIFIED_THEME = {
  name: 'Grain & Vault',
  logo: 'grain-vault',
  bgGradient: 'from-black via-gray-900 to-black',
  panelBg: 'from-emerald-900 via-green-900 to-black',
  accent: 'emerald',
  accentGradient: 'from-emerald-500 to-green-600',
  buttonGradient: 'from-emerald-500 to-teal-600',
  buttonShadow: 'shadow-emerald-500/25 hover:shadow-emerald-500/40',
  textPrimary: 'text-white',
  textSecondary: 'text-gray-400',
  inputBg: 'bg-white/5',
  inputBorder: 'border-white/10',
  inputFocus: 'focus:border-emerald-500 focus:ring-emerald-500/20',
  cardBg: 'bg-white/5 border-white/10',
  selectedBorder: 'border-emerald-500 bg-emerald-500/10',
  selectedBg: 'bg-emerald-500',
  progressBar: 'from-emerald-500 to-teal-600',
  buttonText: 'text-white',
  href: '/',
}

// Keep for backward compatibility but use unified theme
const TREASURY_THEME = UNIFIED_THEME
const WELLS_THEME = UNIFIED_THEME

// ============================================================================
// ERP OPTIONS
// ============================================================================

const ERP_SYSTEMS = [
  { id: 'grain_native', name: 'Grain & Vault Native', description: 'Full treasury SDK access', icon: Wallet, recommended: true, treasuryOnly: true },
  { id: 'wells_native', name: 'WellsAI Native', description: 'Use WellsAI as your ERP', icon: Sparkles, recommended: true, treasuryOnly: false },
  { id: 'netsuite', name: 'Oracle NetSuite', description: 'Connect your NetSuite instance', icon: Database },
  { id: 'sap', name: 'SAP', description: 'Connect SAP S/4HANA or Business One', icon: Database },
  { id: 'dynamics365', name: 'Microsoft Dynamics 365', description: 'Connect D365 Finance', icon: Database },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Connect QuickBooks Online', icon: Database },
  { id: 'xero', name: 'Xero', description: 'Connect Xero accounting', icon: Database },
  { id: 'none', name: 'No ERP / Other', description: 'Skip for now', icon: Database },
]

// ============================================================================
// ROLE OPTIONS - Unified for all journeys
// ============================================================================

const ROLE_OPTIONS: { id: UserRole; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'cfo', name: 'CFO / Finance Leader', description: 'Treasury, AP/AR, financial strategy', icon: Wallet },
  { id: 'controller', name: 'Controller / Treasurer', description: 'Accounting, cash management', icon: Briefcase },
  { id: 'procurement', name: 'Procurement Leader', description: 'Sourcing, vendor management', icon: ShoppingCart },
  { id: 'founder', name: 'Founder / CEO', description: 'Building or running a company', icon: Rocket },
  { id: 'hr', name: 'HR / People Leader', description: 'Recruiting, talent, culture', icon: Users },
  { id: 'sales', name: 'Sales / Revenue Leader', description: 'Growth, partnerships, deals', icon: TrendingUp },
  { id: 'other', name: 'Other', description: 'Something else', icon: Building2 },
]

// Treasury-focused roles (CFO, Finance, Procurement first)
const TREASURY_ROLE_OPTIONS: { id: UserRole; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'cfo', name: 'CFO / Finance Leader', description: 'Treasury, AP/AR, financial strategy', icon: Wallet },
  { id: 'controller', name: 'Controller / Treasurer', description: 'Cash management, accounting', icon: Briefcase },
  { id: 'procurement', name: 'Procurement Leader', description: 'Sourcing, vendor payments', icon: ShoppingCart },
  { id: 'founder', name: 'Founder / CEO', description: 'Building or running a company', icon: Rocket },
  { id: 'other', name: 'Other', description: 'Something else', icon: Building2 },
]

// ============================================================================
// NEED OPTIONS - Unified across all journeys
// ============================================================================

const NEED_OPTIONS: { id: UserNeed; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'treasury', name: 'Treasury & Reserves', description: 'Protected deposits, 0% credit line', icon: Wallet },
  { id: 'payments', name: 'Payments & Settlement', description: 'Instant settlement, zero fees', icon: Zap },
  { id: 'sourcing', name: 'Sourcing & Procurement', description: 'Find suppliers, send RFQs', icon: ShoppingCart },
  { id: 'hiring', name: 'Hiring & Recruiting', description: 'Find and hire talent', icon: Users },
  { id: 'selling', name: 'Sales & Growth', description: 'Find customers, close deals', icon: TrendingUp },
  { id: 'all', name: 'Full Platform', description: 'I need everything', icon: Sparkles },
]

// Treasury-focused needs (shown for treasury journey)
const TREASURY_NEED_OPTIONS: { id: UserNeed; name: string; description: string; icon: React.ElementType }[] = [
  { id: 'treasury', name: 'Protected Treasury', description: '100% collateralized deposits + 0% credit line', icon: Wallet },
  { id: 'payments', name: 'Zero-Friction Payments', description: 'Instant settlement, no transaction fees', icon: Zap },
  { id: 'sourcing', name: 'Vendor Management', description: 'Pay suppliers in GRAIN, track payables', icon: Globe },
  { id: 'all', name: 'Full Treasury Suite', description: 'All treasury features', icon: Sparkles },
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

type ClerkAuth = {
  signUp: ReturnType<typeof useSignUp>['signUp']
  signUpLoaded: boolean
  setActive: ReturnType<typeof useSignUp>['setActive']
  user: ReturnType<typeof useUser>['user']
  userLoaded: boolean
}

function JoinFlowWithClerk({ calm = false }: { calm?: boolean }) {
  const { signUp, isLoaded: signUpLoaded, setActive } = useSignUp()
  const { user, isLoaded: userLoaded } = useUser()
  return (
    <JoinFlowBody
      calm={calm}
      auth={{ signUp, signUpLoaded, setActive, user, userLoaded }}
    />
  )
}

export default function JoinFlow({ calm = false }: { calm?: boolean }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <JoinFlowBody calm={calm} auth={null} />
  }
  return <JoinFlowWithClerk calm={calm} />
}

function JoinFlowBody({ calm = false, auth }: { calm?: boolean; auth: ClerkAuth | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const signUp = auth?.signUp
  const signUpLoaded = auth?.signUpLoaded ?? false
  const setActive = auth?.setActive
  const user = auth?.user
  const userLoaded = auth?.userLoaded ?? false

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

  // Check for referral code and journey context
  const referralCode = searchParams.get('ref') || searchParams.get('invite')
  const journeyFromUrl = searchParams.get('journey') as JourneyType

  // Detect domain for auto-theming
  const [detectedDomain, setDetectedDomain] = useState<'grain' | 'wells' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host.includes('grainandvault') || host.includes('grain')) {
        setDetectedDomain('grain')
      } else {
        setDetectedDomain('wells')
      }
    }
  }, [])

  // UNIFIED BRANDING: Always use Grain & Vault theme
  // Journey just determines role ordering and default needs
  const isTreasury = journeyFromUrl === 'treasury' || detectedDomain === 'grain' || !journeyFromUrl
  const theme = calm ? CALM_THEME : UNIFIED_THEME

  // Pre-select treasury need if coming from Grain & Vault
  useEffect(() => {
    if (journeyFromUrl === 'treasury' && !formData.needs.includes('treasury')) {
      setFormData(prev => ({
        ...prev,
        needs: [...prev.needs, 'treasury']
      }))
    }
  }, [journeyFromUrl])

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (userLoaded && user) {
      const meta = user.publicMetadata as Record<string, unknown>
      if (meta.onboardingCompleted) {
        router.push(isTreasury ? '/dashboard?journey=treasury' : '/dashboard')
      } else if (meta.onboardingStarted) {
        router.push('/onboarding')
      }
    }
  }, [userLoaded, user, router, isTreasury])

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
      setFormData({ ...formData, needs: ['all'] })
    } else {
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
    setFormData({ ...formData, erpSystem: erpId, connectErp: erpId !== 'none' && !erpId.includes('native') })
  }

  // Create account with Clerk
  const handleCreateAccount = async () => {
    if (!signUpLoaded || !signUp || !setActive) {
      setError('Account creation is unavailable until sign-in is connected.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })

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

        await fetch('/api/join/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...signupData,
            primaryJourney: isTreasury ? 'treasury' : context.primaryJourney,
            activeJourneys: context.activeJourneys,
          }),
        })

        goToNextStep()
      } else {
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
    if (isTreasury) {
      router.push('/dashboard?journey=treasury')
      return
    }

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
        return <WelcomeStep onContinue={goToNextStep} theme={theme} isTreasury={isTreasury} />

      case 'info':
        return (
          <InfoStep
            formData={formData}
            onChange={(updates) => setFormData({ ...formData, ...updates })}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
            theme={theme}
            isTreasury={isTreasury}
          />
        )

      case 'role':
        return (
          <RoleStep
            selectedRole={formData.role}
            onSelect={handleRoleSelect}
            onBack={goToPreviousStep}
            theme={theme}
            isTreasury={isTreasury}
          />
        )

      case 'needs':
        return (
          <NeedsStep
            selectedNeeds={formData.needs}
            onToggle={handleNeedToggle}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
            theme={theme}
            isTreasury={isTreasury}
          />
        )

      case 'erp':
        return (
          <ErpStep
            selectedErp={formData.erpSystem}
            onSelect={handleErpSelect}
            onContinue={goToNextStep}
            onBack={goToPreviousStep}
            theme={theme}
            isTreasury={isTreasury}
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
            theme={theme}
            isTreasury={isTreasury}
          />
        )

      case 'complete':
        return (
          <CompleteStep
            formData={formData}
            onGoToDashboard={handleGoToDashboard}
            theme={theme}
            isTreasury={isTreasury}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={calm ? 'gc gc-join min-h-screen flex' : `min-h-screen bg-gradient-to-b ${theme.bgGradient} flex`}>
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col relative z-[1]">
        {/* Header - Always Grain & Vault branding */}
        <header className="p-6">
          <Link href="/" className={`inline-flex items-center gap-2.5 font-semibold text-lg hover:opacity-80 transition-opacity ${calm ? 'gc-brand' : 'text-white'}`}>
            {calm ? (
              <b>Grain & Vault</b>
            ) : (
              <>
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-black" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-sm" />
                </div>
                <span>Grain & Vault</span>
              </>
            )}
          </Link>
        </header>

        {/* Progress Bar */}
        {step !== 'welcome' && step !== 'complete' && (
          <div className="px-6">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex-1 h-1.5 ${isTreasury ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div
                    className={`h-full bg-gradient-to-r ${theme.progressBar} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${getProgress(step)}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${theme.textSecondary}`}>{getProgress(step)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {renderStep()}
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className={`text-sm ${theme.textSecondary}`}>
            Already have an account?{' '}
            <Link href="/sign-in" className={`${calm ? 'text-[#ffcf8a] hover:text-[#f2b45a]' : isTreasury ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:text-blue-500'} font-medium`}>
              Sign in
            </Link>
          </p>
        </footer>
      </div>

      {/* Right Panel */}
      {calm ? (
        <div className="hidden lg:flex w-[520px] items-center justify-center relative z-[1] px-12">
          <div className="text-center">
            <div className="gc-orb-wrap" aria-hidden="true">
              <div className="gc-orb" />
            </div>
            <p className="gc-sub" style={{ margin: '0 auto' }}>Your deposit stays protected.</p>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex w-[520px] bg-gradient-to-br from-emerald-900 via-green-900 to-black p-12 items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 text-center">
            <TreasuryPanel />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// RIGHT PANEL COMPONENTS
// ============================================================================

function TreasuryPanel() {
  const [grainPrice, setGrainPrice] = useState(1.00)
  const [depositAmount, setDepositAmount] = useState(1000)
  const [grainReceived, setGrainReceived] = useState(1000)

  // Animate GRAIN appreciation
  useEffect(() => {
    const interval = setInterval(() => {
      setGrainPrice(prev => {
        const newPrice = prev + 0.001
        return newPrice > 1.05 ? 1.00 : newPrice
      })
    }, 100)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setGrainReceived(Math.floor(depositAmount / grainPrice))
  }, [depositAmount, grainPrice])

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <div className="relative">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-black" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-md flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-black" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white mb-3">
          Treasury that <span className="text-emerald-400">works</span>
        </h2>
        <p className="text-white/70 text-lg">
          Protected deposits. 0% interest credit line.
          <br />
          Zero transaction fees.
        </p>
      </div>

      {/* Interactive Demo */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-emerald-400 font-medium">Live Demo</span>
          <span className="text-xs text-white/50">Price updates in real-time</span>
        </div>

        {/* Current Price */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div>
            <p className="text-sm text-white/50 mb-1">GRAIN Price</p>
            <p className="text-3xl font-bold text-white">${grainPrice.toFixed(4)}</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 rounded-full">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              +{((grainPrice - 1) * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Deposit Simulator */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/50 mb-2 block">If you deposit</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">$</span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                className="bg-transparent border-none text-2xl font-bold text-white w-24 focus:outline-none"
              />
              <span className="text-white/50">USD</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/30">
            <ArrowRight className="w-5 h-5" />
          </div>

          <div>
            <label className="text-sm text-white/50 mb-2 block">You receive</label>
            <p className="text-2xl font-bold text-emerald-400">
              {grainReceived.toLocaleString()} <span className="text-lg font-normal text-white/50">GRAIN</span>
            </p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-white/50 mb-1">Future value (if price hits $1.10)</p>
            <p className="text-xl font-bold text-white">
              ${(grainReceived * 1.10).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-emerald-400 text-sm ml-2">+${((grainReceived * 1.10) - depositAmount).toFixed(2)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <TreasuryFeature icon={Shield} text="100% collateralized - always protected" />
        <TreasuryFeature icon={Zap} text="Instant settlement, under 1 second" />
        <TreasuryFeature icon={DollarSign} text="0% interest, 0% transaction fees" />
        <TreasuryFeature icon={Globe} text="Available globally" />
      </div>

      {/* Powered by */}
      <div className="flex items-center justify-center gap-2 text-white/40 text-sm pt-4 border-t border-white/10">
        <Sparkles className="w-4 h-4" />
        <span>Powered by WellsAI</span>
      </div>
    </div>
  )
}

function TreasuryFeature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
      <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-emerald-400" />
      </div>
      <span className="text-white/90 text-sm">{text}</span>
    </div>
  )
}

function WellsPanel() {
  return (
    <>
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
    </>
  )
}

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

interface StepProps {
  theme: typeof CALM_THEME | typeof UNIFIED_THEME
  isTreasury: boolean
}

function WelcomeStep({ onContinue, theme, isTreasury }: { onContinue: () => void } & StepProps) {
  const calm = theme.name === 'calm'
  return (
    <div className="text-center">
      {calm ? (
        <div className="gc-orb-wrap" aria-hidden="true">
          <div className="gc-orb" />
        </div>
      ) : (
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <Wallet className="w-10 h-10 text-black" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-black" />
          </div>
        </div>
      )}

      <h1 className={`${calm ? 'gc-title mx-auto' : 'text-3xl font-bold text-white'} mb-3`}>
        {calm ? 'Open your vault.' : 'Welcome to Grain & Vault'}
      </h1>

      <p className={`${calm ? 'gc-sub mx-auto' : 'text-lg text-gray-400'} mb-8 max-w-md`}>
        Protected treasury. Zero-friction payments.
        Set up your account in under 2 minutes.
      </p>

      <button
        onClick={onContinue}
        className={calm
          ? 'gc-chip'
          : 'inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all'}
      >
        {calm ? <i>✦</i> : null}
        {calm ? 'Continue' : 'Get Started'}
        {calm ? null : <ArrowRight className="w-5 h-5" />}
      </button>

      <p className="mt-6 text-sm text-gray-500">
        No credit card required • Powered by WellsAI
      </p>
    </div>
  )
}

function InfoStep({
  formData,
  onChange,
  onContinue,
  onBack,
  theme,
  isTreasury,
}: {
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
  onContinue: () => void
  onBack: () => void
} & StepProps) {
  const isValid = formData.email.includes('@') && formData.companyName.length > 0

  return (
    <div>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary} mb-6 transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
        Tell us about you
      </h1>
      <p className={`${theme.textSecondary} mb-8`}>
        We'll use this to personalize your {isTreasury ? 'treasury' : ''} experience
      </p>

      <div className="space-y-5">
        <div>
          <label htmlFor="email" className={`block text-sm font-medium ${isTreasury ? 'text-gray-300' : 'text-gray-700'} mb-1.5`}>
            Work Email
          </label>
          <div className="relative">
            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isTreasury ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@company.com"
              className={`w-full pl-12 pr-4 py-3.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl ${theme.textPrimary} placeholder-gray-500 focus:outline-none ${theme.inputFocus} transition-all`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="company" className={`block text-sm font-medium ${isTreasury ? 'text-gray-300' : 'text-gray-700'} mb-1.5`}>
            Company Name
          </label>
          <div className="relative">
            <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isTreasury ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              id="company"
              type="text"
              value={formData.companyName}
              onChange={(e) => onChange({ companyName: e.target.value })}
              placeholder="Acme Inc"
              className={`w-full pl-12 pr-4 py-3.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl ${theme.textPrimary} placeholder-gray-500 focus:outline-none ${theme.inputFocus} transition-all`}
            />
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!isValid}
        className={`w-full mt-8 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r ${theme.buttonGradient} ${theme.buttonText} font-semibold rounded-xl shadow-lg ${theme.buttonShadow} transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
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
  theme,
  isTreasury,
}: {
  selectedRole: UserRole | null
  onSelect: (role: UserRole) => void
  onBack: () => void
} & StepProps) {
  const roles = isTreasury ? TREASURY_ROLE_OPTIONS : ROLE_OPTIONS

  return (
    <div>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary} mb-6 transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
        What's your role?
      </h1>
      <p className={`${theme.textSecondary} mb-6`}>
        We'll customize {isTreasury ? 'your treasury' : 'Wells'} for how you work
      </p>

      <div className="grid grid-cols-2 gap-3">
        {roles.map((role) => {
          const Icon = role.icon
          const isSelected = selectedRole === role.id
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                isSelected
                  ? theme.selectedBorder
                  : `${theme.cardBg} ${isTreasury ? 'hover:border-white/20' : 'hover:border-gray-300'}`
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                isSelected ? theme.selectedBg : (isTreasury ? 'bg-white/10' : 'bg-gray-100')
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : (isTreasury ? 'text-gray-400' : 'text-gray-600')}`} />
              </div>
              <h3 className={`font-semibold ${theme.textPrimary}`}>{role.name}</h3>
              <p className={`text-sm ${theme.textSecondary}`}>{role.description}</p>
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
  theme,
  isTreasury,
}: {
  selectedNeeds: UserNeed[]
  onToggle: (need: UserNeed) => void
  onContinue: () => void
  onBack: () => void
} & StepProps) {
  const needs = isTreasury ? TREASURY_NEED_OPTIONS : NEED_OPTIONS

  return (
    <div>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary} mb-6 transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
        {isTreasury ? 'What treasury features do you need?' : 'What do you need?'}
      </h1>
      <p className={`${theme.textSecondary} mb-6`}>
        Select all that apply - you can always add more later
      </p>

      <div className="space-y-3">
        {needs.map((need) => {
          const Icon = need.icon
          const isSelected = selectedNeeds.includes(need.id)
          return (
            <button
              key={need.id}
              onClick={() => onToggle(need.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                isSelected
                  ? theme.selectedBorder
                  : `${theme.cardBg} ${isTreasury ? 'hover:border-white/20' : 'hover:border-gray-300'}`
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? theme.selectedBg : (isTreasury ? 'bg-white/10' : 'bg-gray-100')
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : (isTreasury ? 'text-gray-400' : 'text-gray-600')}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${theme.textPrimary}`}>{need.name}</h3>
                <p className={`text-sm ${theme.textSecondary}`}>{need.description}</p>
              </div>
              {isSelected && (
                <div className={`w-6 h-6 ${theme.selectedBg} rounded-full flex items-center justify-center flex-shrink-0`}>
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
        className={`w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r ${theme.buttonGradient} ${theme.buttonText} font-semibold rounded-xl shadow-lg ${theme.buttonShadow} transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
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
  theme,
  isTreasury,
}: {
  selectedErp: string
  onSelect: (erpId: string) => void
  onContinue: () => void
  onBack: () => void
} & StepProps) {
  const erps = ERP_SYSTEMS.filter(erp => {
    if (isTreasury && erp.id === 'wells_native') return false
    if (!isTreasury && erp.treasuryOnly) return false
    return true
  })

  return (
    <div>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary} mb-6 transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
        {isTreasury ? 'Connect your treasury' : 'Connect your ERP'}
      </h1>
      <p className={`${theme.textSecondary} mb-6`}>
        {isTreasury
          ? 'Native SDK or connect your existing ERP for seamless integration'
          : 'Wells works best when connected to your systems'
        }
      </p>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {erps.map((erp) => {
          const Icon = erp.icon
          const isSelected = selectedErp === erp.id
          const isRecommended = erp.recommended
          return (
            <button
              key={erp.id}
              onClick={() => onSelect(erp.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                isSelected
                  ? theme.selectedBorder
                  : isRecommended
                    ? (isTreasury ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-200 bg-blue-50/50')
                    : `${theme.cardBg} ${isTreasury ? 'hover:border-white/20' : 'hover:border-gray-300'}`
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected
                  ? theme.selectedBg
                  : isRecommended
                    ? (isTreasury ? 'bg-emerald-500/20' : 'bg-blue-100')
                    : (isTreasury ? 'bg-white/10' : 'bg-gray-100')
              }`}>
                <Icon className={`w-5 h-5 ${
                  isSelected
                    ? 'text-white'
                    : isRecommended
                      ? (isTreasury ? 'text-emerald-400' : 'text-blue-600')
                      : (isTreasury ? 'text-gray-400' : 'text-gray-600')
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${theme.textPrimary}`}>{erp.name}</h3>
                  {isRecommended && !isSelected && (
                    <span className={`px-2 py-0.5 ${isTreasury ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-100 text-blue-700'} text-xs font-medium rounded-full`}>
                      Recommended
                    </span>
                  )}
                </div>
                <p className={`text-sm ${theme.textSecondary}`}>{erp.description}</p>
              </div>
              {isSelected && (
                <div className={`w-6 h-6 ${theme.selectedBg} rounded-full flex items-center justify-center flex-shrink-0`}>
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
        className={`w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r ${theme.buttonGradient} ${theme.buttonText} font-semibold rounded-xl shadow-lg ${theme.buttonShadow} transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>

      <button
        onClick={() => { onSelect('none'); onContinue() }}
        className={`w-full mt-3 px-6 py-3 ${theme.textSecondary} hover:${theme.textPrimary} font-medium transition-colors`}
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
  theme,
  isTreasury,
}: {
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
  onSubmit: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
} & StepProps) {
  const isValid = formData.email.includes('@') && formData.password.length >= 8

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit()
  }

  return (
    <div>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1 ${theme.textSecondary} hover:${theme.textPrimary} mb-6 transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
        Create your account
      </h1>
      <p className={`${theme.textSecondary} mb-6`}>
        One last step - secure your {isTreasury ? 'treasury' : ''} account
      </p>

      {error && (
        <div className={`mb-6 p-4 ${isTreasury ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'} border rounded-xl flex items-start gap-3`}>
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className={`text-sm ${isTreasury ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="account-email" className={`block text-sm font-medium ${isTreasury ? 'text-gray-300' : 'text-gray-700'} mb-1.5`}>
            Email
          </label>
          <div className="relative">
            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isTreasury ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              id="account-email"
              type="email"
              value={formData.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@company.com"
              className={`w-full pl-12 pr-4 py-3.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl ${theme.textPrimary} placeholder-gray-500 focus:outline-none ${theme.inputFocus} transition-all`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={`block text-sm font-medium ${isTreasury ? 'text-gray-300' : 'text-gray-700'} mb-1.5`}>
            Password
          </label>
          <div className="relative">
            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isTreasury ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder="Minimum 8 characters"
              minLength={8}
              className={`w-full pl-12 pr-4 py-3.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl ${theme.textPrimary} placeholder-gray-500 focus:outline-none ${theme.inputFocus} transition-all`}
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            required
            id="terms"
            className={`mt-1 w-4 h-4 rounded ${isTreasury ? 'border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500' : 'border-gray-300 text-blue-600 focus:ring-blue-500'}`}
          />
          <label htmlFor="terms" className={`text-sm ${theme.textSecondary}`}>
            I agree to the{' '}
            <Link href="/terms" className={`${isTreasury ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:underline'}`}>Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className={`${isTreasury ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:underline'}`}>Privacy Policy</Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={!isValid || isLoading}
          className={`w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r ${theme.buttonGradient} ${theme.buttonText} font-semibold rounded-xl shadow-lg ${theme.buttonShadow} transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
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
            <div className={`w-full border-t ${isTreasury ? 'border-white/10' : 'border-gray-200'}`} />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-4 ${isTreasury ? 'bg-black text-gray-500' : 'bg-gradient-to-b from-white to-gray-50 text-gray-500'}`}>Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className={`flex items-center justify-center gap-2 px-4 py-3 ${theme.cardBg} border rounded-xl text-sm font-medium ${theme.textPrimary} hover:opacity-80 transition-all`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button className={`flex items-center justify-center gap-2 px-4 py-3 ${theme.cardBg} border rounded-xl text-sm font-medium ${theme.textPrimary} hover:opacity-80 transition-all`}>
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
  theme,
  isTreasury,
}: {
  formData: FormData
  onGoToDashboard: () => void
} & StepProps) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
        <Check className="w-10 h-10 text-black" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">
        You're all set!
      </h1>

      <p className="text-lg text-gray-400 mb-8 max-w-md mx-auto">
        Welcome to Grain & Vault, {formData.companyName || 'there'}. Your treasury is ready.
      </p>

      {/* Summary */}
      <div className="bg-white/5 border-white/10 rounded-2xl p-6 mb-8 text-left border">
        <h3 className="font-semibold text-white mb-4">Your setup:</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Company</p>
              <p className="font-medium text-white">{formData.companyName || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium text-white">{formData.role ? getRoleDisplayName(formData.role) : 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Focus Areas</p>
              <p className="font-medium text-white">
                {formData.needs.length > 0
                  ? formData.needs.map(n => getNeedDisplayName(n)).join(', ')
                  : 'Not set'}
              </p>
            </div>
          </div>
          {formData.erpSystem && formData.erpSystem !== 'none' && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Database className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Integration</p>
                <p className="font-medium text-white">
                  {ERP_SYSTEMS.find(e => e.id === formData.erpSystem)?.name || formData.erpSystem}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onGoToDashboard}
        className={theme.name === 'calm'
          ? 'gc-chip'
          : 'inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all'}
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}
