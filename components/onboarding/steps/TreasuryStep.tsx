'use client'

import { useState } from 'react'
import { Shield, Wallet, TrendingUp, CreditCard, Check, ArrowRight } from 'lucide-react'

interface TreasuryStepProps {
  onContinue: () => void
  onSkip: () => void
}

export function TreasuryStep({ onContinue, onSkip }: TreasuryStepProps) {
  const [step, setStep] = useState<'intro' | 'creating' | 'created'>('intro')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  const handleCreateWallet = async () => {
    setStep('creating')

    // Simulate wallet creation
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate mock wallet address
    const mockAddress = '0x' + Array.from({ length: 40 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('')

    setWalletAddress(mockAddress)
    setStep('created')
  }

  if (step === 'creating') {
    return (
      <div className="text-center py-12 space-y-8">
        <div className="relative inline-flex">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Creating your Treasury...</h2>
          <p className="text-gray-400">Setting up your GRAIN wallet on Base L2</p>
        </div>

        <div className="max-w-sm mx-auto space-y-3">
          {[
            'Initializing secure wallet...',
            'Connecting to Base network...',
            'Generating wallet address...',
          ].map((text, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-sm text-gray-400"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              {text}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'created') {
    return (
      <div className="space-y-8">
        {/* Success Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Treasury Created!</h1>
          <p className="text-xl text-gray-400">Your GRAIN wallet is ready</p>
        </div>

        {/* Wallet Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-500" />
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
              {walletAddress}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <Shield className="w-8 h-8 text-amber-500 mb-2" />
            <h3 className="font-semibold text-white">Escrow Protected</h3>
            <p className="text-sm text-gray-400">All deals secured in escrow</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
            <h3 className="font-semibold text-white">GRAIN Appreciation</h3>
            <p className="text-sm text-gray-400">Your balance grows over time</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <CreditCard className="w-8 h-8 text-blue-500 mb-2" />
            <h3 className="font-semibold text-white">Instant Credit</h3>
            <p className="text-sm text-gray-400">1:1 credit line on balance</p>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25 flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Intro screen
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
          <span className="text-amber-500 text-sm font-medium">Powered by Grain & Vault</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Set up your Treasury
        </h1>
        <p className="text-xl text-gray-400">
          Secure payments with built-in appreciation
        </p>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Built-in Escrow</h3>
              <p className="text-gray-400 mt-1">
                All transactions are held in smart contract escrow. Funds only release when both parties are satisfied.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">GRAIN Appreciation</h3>
              <p className="text-gray-400 mt-1">
                Your GRAIN balance appreciates over time. It's like a high-yield savings account for your business.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">1:1 Credit Lines</h3>
              <p className="text-gray-400 mt-1">
                Get instant credit against your GRAIN balance. No banks, no waiting, no credit checks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Info */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-500 font-bold">1%</span>
          </div>
          <div>
            <p className="text-white font-medium">Success fee only</p>
            <p className="text-sm text-gray-400">You only pay when deals close. No hidden fees.</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onSkip}
          className="px-6 py-3 border border-gray-700 rounded-xl text-gray-400 font-medium hover:bg-gray-900 transition-all"
        >
          Skip for now
        </button>
        <button
          onClick={handleCreateWallet}
          className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25"
        >
          Create Treasury Wallet
        </button>
      </div>
    </div>
  )
}
