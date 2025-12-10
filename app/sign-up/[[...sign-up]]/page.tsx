'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Zap, Shield, MessageSquare, CheckCircle } from 'lucide-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-100px] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
        <div className="absolute top-[50%] left-[-50px] w-[300px] h-[300px] rounded-full bg-blue-500/10 blur-[80px]" />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all group-hover:scale-110">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">WellsAI</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Value Props */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">Start Free Today</span>
            </div>

            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
              Join WellsAI
            </h2>
            <p className="text-xl text-gray-400 mb-10">
              The AI platform that turns conversations into outcomes
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Natural Conversations</h3>
                  <p className="text-gray-400">Just tell Wells what you need. No forms, no complexity.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Instant Results</h3>
                  <p className="text-gray-400">Get matched with talent, suppliers, or customers in minutes.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Secure Transactions</h3>
                  <p className="text-gray-400">Built-in escrow and payment protection for every deal.</p>
                </div>
              </div>
            </div>

            {/* Pricing callout */}
            <div className="mt-10 p-6 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-amber-500" />
                <p className="text-amber-400 font-semibold">Pay only on success</p>
              </div>
              <p className="text-gray-400 text-sm">1% flat fee on closed deals. Searching and matching are free.</p>
            </div>
          </div>

          {/* Right Side - Sign Up Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Mobile header */}
            <div className="text-center mb-8 lg:hidden">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-400">Start Free</span>
              </div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
                Get Started
              </h1>
              <p className="text-gray-400">Create your WellsAI account</p>
            </div>

            {/* Clerk Sign Up Component - Fully Customized */}
            <div className="relative">
              {/* Glow effect behind the card */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-transparent to-purple-500/20 blur-3xl opacity-50" />

              <div className="relative">
                <SignUp
                  appearance={{
                    layout: {
                      socialButtonsPlacement: 'top',
                      socialButtonsVariant: 'blockButton',
                      termsPageUrl: '/terms',
                      privacyPageUrl: '/privacy',
                      logoPlacement: 'none',
                      shimmer: true,
                    },
                    variables: {
                      colorPrimary: '#f59e0b',
                      colorBackground: '#0a0a0a',
                      colorInputBackground: '#171717',
                      colorInputText: '#ffffff',
                      colorText: '#ffffff',
                      colorTextSecondary: '#9ca3af',
                      colorDanger: '#ef4444',
                      colorSuccess: '#22c55e',
                      borderRadius: '0.75rem',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      spacingUnit: '1rem',
                    },
                    elements: {
                      rootBox: 'w-full',
                      card: 'bg-gradient-to-b from-gray-900/90 to-gray-900/70 border border-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl rounded-2xl',

                      // Hide Clerk branding completely
                      footer: 'hidden',
                      footerAction: 'hidden',
                      footerActionLink: 'hidden',
                      footerActionText: 'hidden',
                      badge: 'hidden',

                      // Header styling (hide default header)
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden',

                      // Social buttons
                      socialButtonsBlockButton: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 rounded-xl py-3',
                      socialButtonsBlockButtonText: 'text-white font-medium',
                      socialButtonsProviderIcon: 'w-5 h-5',

                      // Divider
                      dividerLine: 'bg-white/10',
                      dividerText: 'text-gray-500 text-sm',

                      // Form fields
                      formFieldLabel: 'text-gray-300 font-medium mb-2',
                      formFieldInput: 'bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all',
                      formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',

                      // Primary button (Sign Up)
                      formButtonPrimary: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02]',

                      // Identity preview (when email is entered)
                      identityPreview: 'bg-white/5 border border-white/10 rounded-xl',
                      identityPreviewText: 'text-white',
                      identityPreviewEditButton: 'text-amber-500 hover:text-amber-400',
                      identityPreviewEditButtonIcon: 'text-amber-500',

                      // OTP/verification code inputs
                      otpCodeFieldInput: 'bg-white/5 border border-white/10 text-white text-center text-lg rounded-xl',

                      // Alternative methods
                      alternativeMethodsBlockButton: 'bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl',

                      // Links
                      formFieldAction: 'text-amber-500 hover:text-amber-400 font-medium',

                      // Error messages
                      formFieldErrorText: 'text-red-400 text-sm mt-1',
                      alert: 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl',
                      alertText: 'text-red-400',

                      // Loading states
                      spinner: 'text-amber-500',

                      // Card internal spacing
                      main: 'px-8 py-8',
                    }
                  }}
                  forceRedirectUrl="/onboarding"
                  signInUrl="/sign-in"
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-8 text-center">
              <p className="text-gray-400">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-amber-500 hover:text-amber-400 font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>© 2025 WellsAI by Wells Onyx. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
