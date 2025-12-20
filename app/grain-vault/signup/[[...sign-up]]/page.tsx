'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { Shield, Zap, TrendingUp, ArrowLeft, Gift, CheckCircle, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

interface ReferralInfo {
  valid: boolean
  code?: string
  tierName?: string
  refereeBonus?: number
  error?: string
}

function ReferralBanner({ referralInfo }: { referralInfo: ReferralInfo | null }) {
  if (!referralInfo) return null

  if (referralInfo.valid) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Referral Applied!</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-sm text-gray-300">
              You&apos;ll receive <span className="font-bold text-green-400">{referralInfo.refereeBonus} GRAIN</span> bonus when you sign up
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (referralInfo.error) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-400">{referralInfo.error}</p>
      </div>
    )
  }

  return null
}

function SignupContent() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Validate and store referral code
  useEffect(() => {
    if (refCode) {
      setIsValidating(true)
      // Store in localStorage for use after signup
      localStorage.setItem('gv_referral_code', refCode)

      // Validate the code
      fetch('/api/grain-vault/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: refCode })
      })
        .then(res => res.json())
        .then(data => {
          setReferralInfo(data)
          if (data.valid) {
            // Store validated info
            localStorage.setItem('gv_referral_validated', JSON.stringify(data))
          }
        })
        .catch(() => {
          setReferralInfo({ valid: false, error: 'Failed to validate referral code' })
        })
        .finally(() => setIsValidating(false))
    }
  }, [refCode])

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-500/20 via-black to-blue-500/20 p-12 flex-col justify-between">
        <div>
          <Link
            href="/grain-vault"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Grain & Vault
          </Link>

          <div className="flex items-center gap-3 mb-12">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <div className="w-5 h-5 bg-black rounded-sm" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-sm" />
            </div>
            <span className="text-2xl font-bold text-white">Grain & Vault</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Open your
            <br />
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Treasury Account
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-12 max-w-md">
            Get started with zero-friction payments and protected reserves in minutes.
          </p>

          {/* Features */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Instant Settlement</h3>
                <p className="text-sm text-gray-400">Pay vendors in under 1 second. No waiting.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">110% Collateralized</h3>
                <p className="text-sm text-gray-400">Every GRAIN backed by $1.10 in reserves.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">1:1 Credit Line</h3>
                <p className="text-sm text-gray-400">Use your balance while it appreciates.</p>
              </div>
            </div>

            {refCode && referralInfo?.valid && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Referral Bonus</h3>
                  <p className="text-sm text-gray-400">+{referralInfo.refereeBonus} GRAIN welcome bonus</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>By signing up, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </div>

      {/* Right side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden mb-8">
            <Link
              href="/grain-vault"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <div className="w-4 h-4 bg-black rounded-sm" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
              </div>
              <span className="text-xl font-bold text-white">Grain & Vault</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-gray-400">Start with zero-friction treasury operations</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Create your account</h2>
            <p className="text-gray-400">Enter your details to get started</p>
          </div>

          {/* Referral Banner */}
          {isValidating ? (
            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              <span className="text-gray-400">Validating referral code...</span>
            </div>
          ) : (
            <ReferralBanner referralInfo={referralInfo} />
          )}

          <SignUp
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none border-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'bg-white/10 border border-white/20 hover:bg-white/20 text-white',
                socialButtonsBlockButtonText: 'text-white font-medium',
                dividerLine: 'bg-white/10',
                dividerText: 'text-gray-500',
                formFieldLabel: 'text-gray-300',
                formFieldInput:
                  'bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500',
                formButtonPrimary:
                  'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold',
                footerActionLink: 'text-green-400 hover:text-green-300',
                identityPreviewText: 'text-white',
                identityPreviewEditButton: 'text-green-400 hover:text-green-300',
                formFieldSuccessText: 'text-green-400',
                formFieldErrorText: 'text-red-400',
                otpCodeFieldInput: 'bg-white/5 border-white/10 text-white',
                formResendCodeLink: 'text-green-400 hover:text-green-300',
                footer: 'hidden',
                footerAction: 'hidden',
                internal: 'hidden',
              },
              layout: {
                socialButtonsPlacement: 'top',
                socialButtonsVariant: 'blockButton',
                showOptionalFields: false,
              },
            }}
            routing="path"
            path="/grain-vault/signup"
            signInUrl="/grain-vault/signin"
            forceRedirectUrl="/grain-vault/onboard"
          />

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/grain-vault/signin" className="text-green-400 hover:text-green-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function GrainVaultSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
