'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Shield,
  Settings,
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Code,
  Building2,
  Activity,
  ChevronRight,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Zap
} from 'lucide-react'
import { ERP_OPTIONS } from '@/lib/grain-vault/types'
import TreasuryChat from '@/app/components/TreasuryChat'

interface AccountData {
  id: string
  companyName: string
  companySize: string
  industry: string
  erpSystem: string
  erpConnected: boolean
  walletAddress?: string
  grainBalance: number
  creditLine: number
  usedCredit: number
  tier: string
  status: string
  apiKey?: string
  sdkEnabled: boolean
  createdAt: string
}

interface CreditLinePosition {
  protectedDeposit: number
  creditLineLimit: number
  creditLineUsed: number
  creditLineAvailable: number
  appreciationGrain: number
  grainPrice: number
  currentValue: number
}

export default function GrainVaultAccountPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [account, setAccount] = useState<AccountData | null>(null)
  const [creditPosition, setCreditPosition] = useState<CreditLinePosition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/grain-vault/signin')
      return
    }

    if (isLoaded && user) {
      fetchAccount()
    }
  }, [isLoaded, user, router])

  const fetchAccount = async () => {
    try {
      const response = await fetch('/api/grain-vault/account')
      const data = await response.json()

      // Check for 404 or needsOnboarding flag
      if (!response.ok || data.needsOnboarding) {
        router.push('/grain-vault/onboard')
        return
      }

      if (data.account) {
        setAccount(data.account)
        // Fetch credit line position
        fetchCreditPosition(data.account.id)
      }
    } catch (error) {
      console.error('Error fetching account:', error)
      // On error, redirect to onboarding
      router.push('/grain-vault/onboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCreditPosition = async (userId: string) => {
    try {
      const response = await fetch(`/api/grain/credit-line?userId=${userId}`)
      const data = await response.json()
      if (data.success && data.position) {
        setCreditPosition(data.position)
      }
    } catch (error) {
      console.error('Error fetching credit position:', error)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No account found</p>
          <Link
            href="/grain-vault/onboarding"
            className="text-green-400 hover:text-green-300"
          >
            Complete onboarding
          </Link>
        </div>
      </div>
    )
  }

  const availableCredit = account.creditLine - account.usedCredit

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/grain-vault" className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                </div>
                <span className="text-xl font-bold text-white">Grain & Vault</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">{account.companyName}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold">
                {account.companyName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Welcome back, {account.companyName}
              </h1>
              <p className="text-gray-400">
                Your treasury dashboard for {ERP_OPTIONS.find(e => e.value === account.erpSystem)?.label || 'your ERP'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                account.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {account.status}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-400 capitalize">
                {account.tier}
              </span>
            </div>
          </div>
        </div>

        {/* Three Layer Model - Visual Stack */}
        <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-bold text-white">Your Three-Layer Position</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/grain-vault/deposit"
                className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
              >
                + Deposit
              </Link>
              <Link
                href="/grain-vault/pay"
                className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors"
              >
                Send Payment
              </Link>
              <Link
                href="/grain-vault/withdraw"
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Withdraw
              </Link>
            </div>
          </div>

          {/* Visual Three-Layer Stack */}
          <div className="relative mb-6">
            {/* Layer 3: Appreciation (Top) */}
            <div className="relative z-30 p-5 rounded-t-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 border-b-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 font-medium">LAYER 3 • APPRECIATION</p>
                    <p className="text-sm text-white">Bonus GRAIN from ecosystem growth</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    {creditPosition?.appreciationGrain?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-purple-400">GRAIN (free to spend)</p>
                </div>
              </div>
            </div>

            {/* Layer 2: Credit Line (Middle) */}
            <div className="relative z-20 p-5 bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-x border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/30 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-400 font-medium">LAYER 2 • CREDIT LINE</p>
                    <p className="text-sm text-white">0% interest • 0% fees • 1:1 GRAIN</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    {creditPosition?.creditLineAvailable?.toLocaleString() || account.creditLine.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-400">
                    GRAIN available
                    {creditPosition?.creditLineUsed && creditPosition.creditLineUsed > 0 && (
                      <span className="text-amber-400 ml-2">
                        ({creditPosition.creditLineUsed.toLocaleString()} used)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {/* Credit usage bar */}
              {creditPosition?.creditLineLimit && creditPosition.creditLineLimit > 0 && (
                <div className="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                    style={{
                      width: `${((creditPosition.creditLineAvailable || 0) / creditPosition.creditLineLimit) * 100}%`
                    }}
                  />
                </div>
              )}
            </div>

            {/* Layer 1: Protected Deposit (Bottom/Foundation) */}
            <div className="relative z-10 p-5 rounded-b-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 border-t-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-green-400 font-medium">LAYER 1 • PROTECTED DEPOSIT</p>
                    <p className="text-sm text-white">100% protected • Your cash • Always available</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">
                    ${creditPosition?.protectedDeposit?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-green-400">USD (withdraw anytime)</p>
                </div>
              </div>
            </div>

            {/* Connection Lines */}
            <div className="absolute left-8 top-[60px] bottom-[60px] w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500 opacity-30" />
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-black/30 border border-white/10">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">GRAIN Price</p>
              <p className="text-lg font-bold text-white">
                ${creditPosition?.grainPrice?.toFixed(4) || '1.0000'}
              </p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-xs text-gray-500 mb-1">Total Value</p>
              <p className="text-lg font-bold text-green-400">
                ${creditPosition?.currentValue?.toLocaleString() || '0'}
              </p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-xs text-gray-500 mb-1">Credit Utilization</p>
              <p className="text-lg font-bold text-blue-400">
                {creditPosition?.creditLineLimit && creditPosition.creditLineLimit > 0
                  ? `${(((creditPosition.creditLineUsed || 0) / creditPosition.creditLineLimit) * 100).toFixed(1)}%`
                  : '0%'
                }
              </p>
            </div>
            <div className="text-center border-l border-white/10">
              <p className="text-xs text-gray-500 mb-1">Spending Power</p>
              <p className="text-lg font-bold text-purple-400">
                {((creditPosition?.creditLineAvailable || 0) + (creditPosition?.appreciationGrain || 0)).toLocaleString()} GRAIN
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {/* GRAIN Balance */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-400" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-sm text-gray-400 mb-1">Total GRAIN</p>
            <p className="text-3xl font-bold text-white">
              {((creditPosition?.creditLineAvailable || 0) + (creditPosition?.appreciationGrain || 0)).toLocaleString() || account.grainBalance.toLocaleString()}
            </p>
            <p className="text-xs text-green-400 mt-1">Backed by real liquidity</p>
          </div>

          {/* Credit Line */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs text-blue-400">1:1 ratio</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Credit Line Limit</p>
            <p className="text-3xl font-bold text-white">{creditPosition?.creditLineLimit?.toLocaleString() || account.creditLine.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Available: {creditPosition?.creditLineAvailable?.toLocaleString() || availableCredit.toLocaleString()}</p>
          </div>

          {/* Protected Deposit */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-sm text-gray-400 mb-1">Protected</p>
            <p className="text-3xl font-bold text-white">100%</p>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
            </div>
          </div>

          {/* Payments Today */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs text-amber-400">{'<'}1s avg</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Payments Today</p>
            <p className="text-3xl font-bold text-white">0</p>
            <p className="text-xs text-gray-500 mt-1">0 failed (0%)</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wallet Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Treasury Wallet</h2>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                  Base L2
                </span>
              </div>

              {account.walletAddress ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black/30">
                    <p className="text-xs text-gray-500 mb-2">Wallet Address</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-300 font-mono">
                        {account.walletAddress.slice(0, 10)}...{account.walletAddress.slice(-8)}
                      </p>
                      <button
                        onClick={() => copyToClipboard(account.walletAddress!, 'wallet')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {copied === 'wallet' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors">
                      <ArrowDownLeft className="w-5 h-5" />
                      Deposit GRAIN
                    </button>
                    <button className="flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                      <ArrowUpRight className="w-5 h-5" />
                      Send Payment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Wallet not created yet</p>
                  <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-semibold">
                    Create Wallet
                  </button>
                </div>
              )}
            </div>

            {/* SDK Access */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Code className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">SDK Access</h2>
                    <p className="text-sm text-gray-400">
                      {ERP_OPTIONS.find(e => e.value === account.erpSystem)?.label || 'Generic'} Adapter
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  account.sdkEnabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {account.sdkEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {account.apiKey && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black/30">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">API Key</p>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-300 font-mono">
                        {showApiKey ? account.apiKey : '••••••••••••••••••••••••••••••••'}
                      </p>
                      <button
                        onClick={() => copyToClipboard(account.apiKey!, 'apiKey')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {copied === 'apiKey' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0d1117] border border-white/10">
                    <p className="text-xs text-gray-500 mb-3">Quick Start</p>
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                      <code>
                        {`import { createTreasurySDK } from '@grainandvault/sdk'

const treasury = createTreasurySDK({
  apiKey: '${showApiKey ? account.apiKey : 'your-api-key'}',
  erp: '${account.erpSystem}'
})`}
                      </code>
                    </pre>
                  </div>

                  <Link
                    href="/grain-vault/demo"
                    className="flex items-center justify-center gap-2 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    View Full Documentation
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Account Info */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4">Account Details</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Company</span>
                  <span className="text-white font-medium">{account.companyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Industry</span>
                  <span className="text-white">{account.industry}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Size</span>
                  <span className="text-white capitalize">{account.companySize}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">ERP System</span>
                  <span className="text-white">
                    {ERP_OPTIONS.find(e => e.value === account.erpSystem)?.label || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Account ID</span>
                  <span className="text-gray-300 font-mono text-sm">{account.id}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>

              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-400" />
                    <span className="text-white">Account Settings</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <span className="text-white">Connect ERP</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-gray-400" />
                    <span className="text-white">Regenerate API Key</span>
                  </div>
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Support */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Need help?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Our team is here to help you get the most out of Grain & Vault.
              </p>
              <a
                href="mailto:support@grainandvault.com"
                className="text-green-400 hover:text-green-300 text-sm font-medium"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Wells AI Treasury Chat */}
      <TreasuryChat
        accountId={account.id}
        companyName={account.companyName}
        grainBalance={account.grainBalance}
        creditLine={account.creditLine}
      />
    </div>
  )
}
