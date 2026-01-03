'use client'

/**
 * Sign In Page - Grain & Vault Branded
 *
 * Uses centralized Clerk theme from lib/clerk-theme.ts
 * Clerk Pro: Full white-label, no Clerk badge
 */

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Coins, Shield, Lock, Brain, Fingerprint } from 'lucide-react'
import { signInAppearance } from '@/lib/clerk-theme'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs - Emerald theme */}
        <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-100px] w-[400px] h-[400px] rounded-full bg-teal-500/10 blur-[100px]" />
        <div className="absolute top-[50%] left-[-50px] w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[80px]" />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header - Grain & Vault branding */}
      <header className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all group-hover:scale-110">
                  <Coins className="w-5 h-5 text-black" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-sm" />
              </div>
              <span className="text-xl font-bold tracking-tight">Grain & Vault</span>
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
        <div className="w-full max-w-md">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-400">Secure Sign In</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-gray-400 text-lg">Sign in to your Grain & Vault account</p>
          </div>

          {/* Clerk Sign In Component */}
          <div className="relative">
            {/* Glow effect behind the card */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-teal-500/20 blur-3xl opacity-50" />

            <div className="relative">
              <SignIn
                appearance={signInAppearance}
                signUpUrl="/join"
                forceRedirectUrl="/dashboard"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link href="/join" className="text-emerald-500 hover:text-emerald-400 font-semibold transition-colors">
                Create one
              </Link>
            </p>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 pt-4 border-t border-white/10 flex-wrap">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>256-bit encryption</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Fingerprint className="w-4 h-4 text-emerald-500" />
                <span>Passkey Support</span>
              </div>
            </div>

            {/* Powered by WellsAI */}
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs pt-2">
              <Brain className="w-3 h-3" />
              <span>Powered by WellsAI</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>© 2025 Grain & Vault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
