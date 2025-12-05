'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function GrainVaultSigninPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link
          href="/grain-vault"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Grain & Vault
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
          </div>
          <span className="text-xl font-bold text-white">Grain & Vault</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-gray-400 mb-8">Sign in to your treasury account</p>

        <SignIn
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
            },
            layout: {
              socialButtonsPlacement: 'top',
              socialButtonsVariant: 'blockButton',
            },
          }}
          routing="path"
          path="/grain-vault/signin"
          signUpUrl="/grain-vault/signup"
          forceRedirectUrl="/grain-vault/account"
        />

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link href="/grain-vault/signup" className="text-green-400 hover:text-green-300 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
