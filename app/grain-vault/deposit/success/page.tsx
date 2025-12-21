'use client'

/**
 * Deposit Success Page
 *
 * Shows successful deposit confirmation and updated balance.
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  CheckCircle,
  ArrowRight,
  Wallet,
  TrendingUp,
  Loader2,
  Copy,
  Check
} from 'lucide-react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()

  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const sessionId = searchParams.get('session') || ''
  const amount = parseFloat(searchParams.get('amount') || '0')
  const grainAmount = parseFloat(searchParams.get('grain') || amount.toString())

  // Fetch updated balance
  useEffect(() => {
    async function fetchBalance() {
      try {
        const response = await fetch('/api/grain-vault/wallet')
        if (response.ok) {
          const data = await response.json()
          setBalance(data.balance?.grain || data.grain_balance || 0)
        }
      } catch (e) {
        console.error('Failed to fetch balance:', e)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchBalance()
    }
  }, [user])

  function copyTransactionId() {
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Deposit Successful!</h1>
          <p className="text-gray-400">
            Your GRAIN has been added to your wallet
          </p>
        </div>

        {/* Amount Card */}
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/10 rounded-xl p-6 mb-6 border border-green-500/30">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">You Deposited</p>
            <p className="text-4xl font-bold text-white mb-2">
              ${amount.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-2 text-green-400">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xl font-semibold">
                +{grainAmount.toFixed(2)} GRAIN
              </span>
            </div>
          </div>
        </div>

        {/* Updated Balance */}
        {balance !== null && (
          <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">New Balance</p>
                <p className="text-2xl font-bold text-white">
                  {balance.toFixed(2)} GRAIN
                </p>
                <p className="text-green-400 text-sm">
                  ≈ ${(balance * 1.0).toFixed(2)} USD
                </p>
              </div>
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
                <Wallet className="w-7 h-7 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Transaction ID */}
        {sessionId && (
          <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Transaction ID</p>
                <p className="text-sm font-mono text-gray-300 truncate max-w-[200px]">
                  {sessionId}
                </p>
              </div>
              <button
                onClick={copyTransactionId}
                className="text-gray-400 hover:text-white p-2"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/grain-vault/dashboard"
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            View Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/grain-vault/deposit"
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            Make Another Deposit
          </Link>
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>
            GRAIN is backed 1:1 by USDC held in secure custody.
          </p>
          <p className="mt-1">
            Your funds are always available for withdrawal.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
