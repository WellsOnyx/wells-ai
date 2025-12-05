'use client'

import { useState, useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Settings,
  Wallet,
  Sparkles,
  Shield,
  Zap,
  TrendingUp,
  ChevronRight,
  Globe,
  Users,
  CreditCard
} from 'lucide-react'
import {
  GrainVaultOnboardingStep,
  GRAIN_VAULT_STEPS,
  STEP_TITLES,
  CompanyData,
  ERPData,
  TreasuryData,
  ERP_OPTIONS,
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  PAYMENT_VOLUME_OPTIONS,
  ERPSystem
} from '@/lib/grain-vault/types'

export default function GrainVaultOnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Step state
  const [currentStep, setCurrentStep] = useState<GrainVaultOnboardingStep>('welcome')
  const [completedSteps, setCompletedSteps] = useState<GrainVaultOnboardingStep[]>([])

  // Form data
  const [companyData, setCompanyData] = useState<Partial<CompanyData>>({})
  const [erpData, setErpData] = useState<Partial<ERPData>>({})
  const [treasuryData, setTreasuryData] = useState<Partial<TreasuryData>>({})

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check auth
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/grain-vault/signup')
      return
    }
    if (isLoaded) {
      setIsLoading(false)
    }
  }, [isLoaded, user, router])

  // Navigation
  const goToNextStep = useCallback(() => {
    const currentIndex = GRAIN_VAULT_STEPS.indexOf(currentStep)
    const nextStep = GRAIN_VAULT_STEPS[currentIndex + 1]
    if (nextStep) {
      setCompletedSteps(prev => [...prev, currentStep])
      setCurrentStep(nextStep)
    }
  }, [currentStep])

  const goToPreviousStep = useCallback(() => {
    const currentIndex = GRAIN_VAULT_STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(GRAIN_VAULT_STEPS[currentIndex - 1])
    }
  }, [currentStep])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // Try to finalize account data
      await fetch('/api/grain-vault/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyData,
          erpData,
          treasuryData
        })
      })
    } catch (error) {
      console.error('Error completing onboarding:', error)
    }
    // Always navigate to dashboard (account was created during treasury step)
    router.push('/grain-vault/account')
  }, [companyData, erpData, treasuryData, router])

  // Progress calculation
  const progress = Math.round(
    (GRAIN_VAULT_STEPS.indexOf(currentStep) / (GRAIN_VAULT_STEPS.length - 1)) * 100
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentStep !== 'welcome' && (
                <button
                  onClick={goToPreviousStep}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-3 h-3 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                </div>
                <span className="text-lg font-semibold text-white">Grain & Vault</span>
              </div>
            </div>

            {currentStep !== 'welcome' && currentStep !== 'complete' && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  Step {GRAIN_VAULT_STEPS.indexOf(currentStep)} of {GRAIN_VAULT_STEPS.length - 2}
                </div>
                <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <WelcomeStep onContinue={goToNextStep} />
          )}

          {/* Company Step */}
          {currentStep === 'company' && (
            <CompanyStep
              data={companyData}
              onUpdate={setCompanyData}
              onContinue={goToNextStep}
            />
          )}

          {/* ERP Step */}
          {currentStep === 'erp' && (
            <ERPStep
              data={erpData}
              onUpdate={setErpData}
              onContinue={goToNextStep}
            />
          )}

          {/* Treasury Step */}
          {currentStep === 'treasury' && (
            <TreasurySetupStep
              data={treasuryData}
              onUpdate={setTreasuryData}
              onContinue={goToNextStep}
            />
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <CompleteStep
              companyName={companyData.companyName || 'Your Company'}
              erpSystem={erpData.erpSystem}
              onComplete={completeOnboarding}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center space-y-8">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
        <Sparkles className="w-12 h-12 text-white" />
      </div>

      <div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to Grain & Vault
        </h1>
        <p className="text-xl text-gray-400 max-w-md mx-auto">
          Let's set up your treasury account. This takes about 2 minutes.
        </p>
      </div>

      <div className="grid gap-4 max-w-md mx-auto text-left">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Company Info</h3>
            <p className="text-sm text-gray-400">Basic details about your business</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">ERP Integration</h3>
            <p className="text-sm text-gray-400">Connect your financial systems</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Treasury Setup</h3>
            <p className="text-sm text-gray-400">Create your GRAIN wallet</p>
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full max-w-md mx-auto py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
      >
        Get Started
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function CompanyStep({
  data,
  onUpdate,
  onContinue
}: {
  data: Partial<CompanyData>
  onUpdate: (data: Partial<CompanyData>) => void
  onContinue: () => void
}) {
  const isValid = data.companyName && data.companySize && data.industry

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-green-500/20 mb-4">
          <Building2 className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Tell us about your company</h1>
        <p className="text-gray-400">This helps us customize your treasury experience</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={data.companyName || ''}
            onChange={(e) => onUpdate({ ...data, companyName: e.target.value })}
            placeholder="Acme Corporation"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Company Size *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {COMPANY_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onUpdate({ ...data, companySize: option.value })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  data.companySize === option.value
                    ? 'bg-green-500/20 border-green-500 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                }`}
              >
                <div className="font-semibold">{option.label}</div>
                <div className="text-sm text-gray-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Industry *
          </label>
          <select
            value={data.industry || ''}
            onChange={(e) => onUpdate({ ...data, industry: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
          >
            <option value="" className="bg-gray-900">Select industry</option>
            {INDUSTRY_OPTIONS.map((industry) => (
              <option key={industry} value={industry} className="bg-gray-900">
                {industry}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Role
          </label>
          <input
            type="text"
            value={data.role || ''}
            onChange={(e) => onUpdate({ ...data, role: e.target.value })}
            placeholder="CFO, Treasury Manager, etc."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Expected Monthly Payment Volume
          </label>
          <select
            value={data.monthlyPaymentVolume || ''}
            onChange={(e) => onUpdate({ ...data, monthlyPaymentVolume: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
          >
            <option value="" className="bg-gray-900">Select volume</option>
            {PAYMENT_VOLUME_OPTIONS.map((volume) => (
              <option key={volume} value={volume} className="bg-gray-900">
                {volume}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!isValid}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
          isValid
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:scale-[1.02]'
            : 'bg-white/10 text-gray-500 cursor-not-allowed'
        }`}
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function ERPStep({
  data,
  onUpdate,
  onContinue
}: {
  data: Partial<ERPData>
  onUpdate: (data: Partial<ERPData>) => void
  onContinue: () => void
}) {
  const isValid = data.erpSystem

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-blue-500/20 mb-4">
          <Settings className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Connect your ERP</h1>
        <p className="text-gray-400">Native integration with your financial systems</p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select your ERP system *
        </label>

        {/* Popular ERPs */}
        <div className="grid grid-cols-2 gap-3">
          {ERP_OPTIONS.filter(e => e.popular).map((erp) => (
            <button
              key={erp.value}
              onClick={() => onUpdate({ ...data, erpSystem: erp.value })}
              className={`p-4 rounded-xl border text-left transition-all ${
                data.erpSystem === erp.value
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              <div className="font-semibold">{erp.label}</div>
              {erp.popular && (
                <div className="text-xs text-blue-400 mt-1">Popular</div>
              )}
            </button>
          ))}
        </div>

        {/* Other ERPs */}
        <div className="grid grid-cols-2 gap-3">
          {ERP_OPTIONS.filter(e => !e.popular).map((erp) => (
            <button
              key={erp.value}
              onClick={() => onUpdate({ ...data, erpSystem: erp.value })}
              className={`p-4 rounded-xl border text-left transition-all ${
                data.erpSystem === erp.value
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              <div className="font-semibold">{erp.label}</div>
            </button>
          ))}
        </div>
      </div>

      {data.erpSystem && data.erpSystem !== 'none' && data.erpSystem !== 'other' && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">
                SDK Ready for {ERP_OPTIONS.find(e => e.value === data.erpSystem)?.label}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                We'll provide you with SDK credentials and documentation after setup.
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Primary Use Case
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'vendor-payments', label: 'Vendor Payments' },
            { value: 'receivables', label: 'Receivables' },
            { value: 'treasury-management', label: 'Treasury Management' },
            { value: 'all', label: 'All of the Above' }
          ].map((useCase) => (
            <button
              key={useCase.value}
              onClick={() => onUpdate({ ...data, primaryUseCase: useCase.value as ERPData['primaryUseCase'] })}
              className={`p-3 rounded-xl border text-sm transition-all ${
                data.primaryUseCase === useCase.value
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              {useCase.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={!isValid}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
          isValid
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:scale-[1.02]'
            : 'bg-white/10 text-gray-500 cursor-not-allowed'
        }`}
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function TreasurySetupStep({
  data,
  onUpdate,
  onContinue
}: {
  data: Partial<TreasuryData>
  onUpdate: (data: Partial<TreasuryData>) => void
  onContinue: () => void
}) {
  const [isCreating, setIsCreating] = useState(false)

  const createWallet = async () => {
    setIsCreating(true)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate mock wallet address
    const mockAddress = '0x' + Array.from({ length: 40 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('')

    onUpdate({
      ...data,
      walletCreated: true,
      walletAddress: mockAddress
    })
    setIsCreating(false)
  }

  if (isCreating) {
    return (
      <div className="text-center py-12 space-y-8">
        <div className="relative inline-flex">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center animate-pulse">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-green-500/20 blur-xl animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Creating your Treasury...</h2>
          <p className="text-gray-400">Setting up your GRAIN wallet on Base L2</p>
        </div>

        <div className="max-w-sm mx-auto space-y-3">
          {['Initializing secure wallet...', 'Connecting to Base network...', 'Generating wallet address...'].map((text, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              {text}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (data.walletCreated) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Treasury Created!</h1>
          <p className="text-gray-400">Your GRAIN wallet is ready to use</p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">GRAIN Balance</p>
                <p className="text-2xl font-bold text-white">0 GRAIN</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Network</p>
              <p className="text-white font-medium">Base L2</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/30">
            <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
            <p className="text-sm text-gray-300 font-mono break-all">
              {data.walletAddress}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <Shield className="w-8 h-8 text-green-500 mb-2" />
            <h3 className="font-semibold text-white">110% Collateralized</h3>
            <p className="text-sm text-gray-400">Protected reserves</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
            <h3 className="font-semibold text-white">GRAIN Appreciation</h3>
            <p className="text-sm text-gray-400">Value grows over time</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <CreditCard className="w-8 h-8 text-purple-500 mb-2" />
            <h3 className="font-semibold text-white">1:1 Credit Line</h3>
            <p className="text-sm text-gray-400">Instant credit access</p>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-purple-500/20 mb-4">
          <Wallet className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Set up your Treasury</h1>
        <p className="text-gray-400">Create your GRAIN wallet for zero-friction payments</p>
      </div>

      <div className="space-y-4">
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Instant Settlement</h3>
              <p className="text-gray-400 mt-1">
                Pay vendors in under 1 second. No chargebacks, no reversals.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Protected Value</h3>
              <p className="text-gray-400 mt-1">
                110% over-collateralized reserves with automatic price protection.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">1:1 Credit Line</h3>
              <p className="text-gray-400 mt-1">
                Get instant credit against your GRAIN balance. Use it while it appreciates.
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={createWallet}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
      >
        Create Treasury Wallet
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function CompleteStep({
  companyName,
  erpSystem,
  onComplete,
  isSubmitting
}: {
  companyName: string
  erpSystem?: ERPSystem
  onComplete: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="text-center space-y-8">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
        <Check className="w-12 h-12 text-white" />
      </div>

      <div>
        <h1 className="text-4xl font-bold text-white mb-4">
          You're all set!
        </h1>
        <p className="text-xl text-gray-400 max-w-md mx-auto">
          Welcome to Grain & Vault, {companyName}. Your treasury account is ready.
        </p>
      </div>

      <div className="grid gap-4 max-w-md mx-auto text-left">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Treasury Wallet Created</h3>
            <p className="text-sm text-gray-400">Ready for GRAIN deposits</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">SDK Access Enabled</h3>
            <p className="text-sm text-gray-400">
              {erpSystem && erpSystem !== 'none'
                ? `${ERP_OPTIONS.find(e => e.value === erpSystem)?.label} adapter ready`
                : 'API credentials available'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Credit Line Active</h3>
            <p className="text-sm text-gray-400">1:1 on your GRAIN balance</p>
          </div>
        </div>
      </div>

      <button
        onClick={onComplete}
        disabled={isSubmitting}
        className="w-full max-w-md mx-auto py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            Go to Dashboard
            <ChevronRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  )
}
