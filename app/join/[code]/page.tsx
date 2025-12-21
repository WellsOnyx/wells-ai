// @ts-nocheck
'use client'

/**
 * Join via Invite Link Page
 *
 * Handles the invite flow when a supplier or customer clicks an invite link.
 * - Validates the invite code
 * - Shows who invited them and the benefits
 * - Redirects to signup with the invite code attached
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Building2,
  ShoppingCart,
  Zap,
  TrendingUp,
  Shield,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle
} from 'lucide-react'

interface InviteInfo {
  valid: boolean
  type: 'supplier' | 'customer'
  inviterName?: string
  inviterCompany?: string
  benefits: string[]
  error?: string
}

export default function JoinInvitePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = params.code as string
  const type = searchParams.get('type') as 'supplier' | 'customer' | null

  const [loading, setLoading] = useState(true)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)

  useEffect(() => {
    // For now, just validate the code format and show benefits
    // In production, this would call an API to validate the code
    const validateInvite = async () => {
      setLoading(true)

      // Basic code format validation
      if (!code || code.length < 6) {
        setInviteInfo({
          valid: false,
          type: type || 'supplier',
          benefits: [],
          error: 'Invalid invite code'
        })
        setLoading(false)
        return
      }

      // Set benefits based on type
      const inviteType = type || 'supplier'
      const benefits = inviteType === 'supplier'
        ? [
            'Get paid faster with instant GRAIN settlements',
            'Zero payment processing fees',
            'Your GRAIN balance appreciates over time',
            'Build trusted business relationships',
            'Simple onboarding in under 2 minutes'
          ]
        : [
            'Receive payments instantly in GRAIN',
            'No transaction fees on payments',
            'Your balance grows as GRAIN appreciates',
            'Strengthen your supplier relationships',
            'Easy setup with no technical knowledge needed'
          ]

      setInviteInfo({
        valid: true,
        type: inviteType,
        benefits
      })
      setLoading(false)
    }

    validateInvite()
  }, [code, type])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Validating your invite...</p>
        </div>
      </div>
    )
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Invite Link</h1>
          <p className="text-gray-400 mb-6">
            {inviteInfo?.error || 'This invite link is invalid or has expired.'}
          </p>
          <Link
            href="/grain-vault"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all"
          >
            Go to Grain & Vault
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    )
  }

  const isSupplier = inviteInfo.type === 'supplier'
  const Icon = isSupplier ? Building2 : ShoppingCart
  const accentColor = isSupplier ? 'blue' : 'green'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 right-0 w-[800px] h-[800px] bg-${accentColor}-500/10 rounded-full blur-3xl`} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${
            isSupplier ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'
          } flex items-center justify-center shadow-2xl ${
            isSupplier ? 'shadow-blue-500/30' : 'shadow-green-500/30'
          }`}>
            <Icon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold mb-4">
            {isSupplier
              ? "You've been invited to get paid in GRAIN"
              : "You've been invited to receive GRAIN payments"
            }
          </h1>

          <p className="text-xl text-gray-400">
            {isSupplier
              ? 'Join Grain & Vault and start receiving instant, fee-free payments from your customers.'
              : 'Join Grain & Vault and receive appreciating payments from your suppliers.'
            }
          </p>
        </div>

        {/* Benefits Card */}
        <div className={`p-8 rounded-2xl bg-white/5 border ${
          isSupplier ? 'border-blue-500/20' : 'border-green-500/20'
        } mb-8`}>
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className={`w-6 h-6 ${isSupplier ? 'text-blue-400' : 'text-green-400'}`} />
            <h2 className="text-xl font-semibold">Why join Grain & Vault?</h2>
          </div>

          <div className="space-y-4">
            {inviteInfo.benefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full ${
                  isSupplier ? 'bg-blue-500/20' : 'bg-green-500/20'
                } flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <CheckCircle className={`w-4 h-4 ${isSupplier ? 'text-blue-400' : 'text-green-400'}`} />
                </div>
                <p className="text-gray-300">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* GRAIN Value Proposition */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <h3 className="font-semibold text-white mb-1">Instant</h3>
            <p className="text-xs text-gray-400">Payments settle in seconds, not days</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <h3 className="font-semibold text-white mb-1">100% Backed</h3>
            <p className="text-xs text-gray-400">Every GRAIN is backed by real assets</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h3 className="font-semibold text-white mb-1">Appreciating</h3>
            <p className="text-xs text-gray-400">GRAIN only goes up in value</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={`/grain-vault/signup?invite=${code}&type=${inviteInfo.type}`}
            className={`inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${
              isSupplier
                ? 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25'
                : 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-500/25'
            } text-white rounded-xl font-semibold transition-all shadow-lg text-lg`}
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="mt-4 text-sm text-gray-500">
            Takes less than 2 minutes. No credit card required.
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Bank-grade security</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Trusted by 1000+ businesses</span>
            </div>
          </div>
        </div>

        {/* Already have account */}
        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Already have an account?{' '}
            <Link
              href={`/grain-vault/signin?invite=${code}&type=${inviteInfo.type}`}
              className={`${isSupplier ? 'text-blue-400 hover:text-blue-300' : 'text-green-400 hover:text-green-300'} font-medium transition-colors`}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
