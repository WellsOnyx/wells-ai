// @ts-nocheck
'use client'

/**
 * Grain & Vault - Cross-Chain Bridge Page
 *
 * Transfer USDC from any supported chain to Grain & Vault using Circle's CCTP.
 * Supports Fast Transfer (<30s) and Standard Transfer (~15 min).
 */

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap,
  Clock,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Wallet,
  Shield,
  ChevronDown,
  Info,
} from 'lucide-react'

// Types
interface ChainInfo {
  id: string
  name: string
  chainId: number
  domainId: number
  isTestnet: boolean
  usdcAddress: string
  explorerUrl: string
}

interface BridgeEstimate {
  sourceChain: string
  destinationChain: string
  amount: string
  gasFees: {
    source: string
    destination: string
    total: string
  }
  protocolFee: string
  protocolFeeBps: number
  totalCost: string
  netAmount: string
  estimatedTime: string
  transferSpeed: 'FAST' | 'STANDARD'
}

type TransferSpeed = 'FAST' | 'STANDARD'
type TransferStatus = 'idle' | 'connecting' | 'approving' | 'burning' | 'attesting' | 'minting' | 'completed' | 'error'

// Loading fallback
function BridgePageLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading bridge...</p>
      </div>
    </div>
  )
}

export default function BridgePage() {
  return (
    <Suspense fallback={<BridgePageLoading />}>
      <BridgePageContent />
    </Suspense>
  )
}

function BridgePageContent() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chains, setChains] = useState<ChainInfo[]>([])
  const [defaultDestination, setDefaultDestination] = useState<string>('Base')

  // Form state
  const [sourceChain, setSourceChain] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [transferSpeed, setTransferSpeed] = useState<TransferSpeed>('FAST')
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)

  // Transfer state
  const [transferStatus, setTransferStatus] = useState<TransferStatus>('idle')
  const [burnTxHash, setBurnTxHash] = useState<string>('')
  const [mintTxHash, setMintTxHash] = useState<string>('')
  const [transferId, setTransferId] = useState<string>('')

  // Fetch supported chains
  const fetchChains = useCallback(async () => {
    try {
      const res = await fetch('/api/grain-vault/bridge/chains')
      if (!res.ok) throw new Error('Failed to load chains')

      const data = await res.json()
      setChains(data.chains || [])
      setDefaultDestination(data.defaultDestination || 'Base')

      // Set default source (first non-destination chain)
      if (data.chains?.length > 0) {
        const firstSource = data.chains.find((c: ChainInfo) => c.id !== data.defaultDestination)
        if (firstSource) setSourceChain(firstSource.id)
      }
    } catch (err: any) {
      console.error('Failed to load chains:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchChains()
    } else if (isLoaded && !isSignedIn) {
      router.push('/grain-vault/signin')
    }
  }, [isLoaded, isSignedIn, fetchChains, router])

  // Fetch estimate when inputs change
  useEffect(() => {
    const fetchEstimate = async () => {
      if (!sourceChain || !amount || parseFloat(amount) <= 0) {
        setEstimate(null)
        return
      }

      setEstimating(true)
      try {
        const params = new URLSearchParams({
          sourceChain,
          destinationChain: defaultDestination,
          amount,
          speed: transferSpeed,
        })

        const res = await fetch(`/api/grain-vault/bridge/estimate?${params}`)
        if (res.ok) {
          const data = await res.json()
          setEstimate(data.estimate)
        }
      } catch (err) {
        console.error('Estimate error:', err)
      } finally {
        setEstimating(false)
      }
    }

    const debounce = setTimeout(fetchEstimate, 500)
    return () => clearTimeout(debounce)
  }, [sourceChain, amount, transferSpeed, defaultDestination])

  // Get chain info
  const sourceChainInfo = useMemo(() => {
    return chains.find(c => c.id === sourceChain)
  }, [chains, sourceChain])

  const destChainInfo = useMemo(() => {
    return chains.find(c => c.id === defaultDestination)
  }, [chains, defaultDestination])

  // Handle bridge initiation
  const handleBridge = async () => {
    if (!sourceChain || !amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setError(null)
    setTransferStatus('connecting')

    try {
      // This would typically connect to user's wallet
      // For now, show instructions
      setTransferStatus('idle')
      setError('Connect your wallet to bridge USDC. Use the wallet button in your browser extension.')
    } catch (err: any) {
      setError(err.message)
      setTransferStatus('error')
    }
  }

  // Format helpers
  const formatUSD = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  // Loading state
  if (!isLoaded || loading) {
    return <BridgePageLoading />
  }

  // Transfer in progress
  if (transferStatus !== 'idle' && transferStatus !== 'error') {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header user={user} />

        <main className="max-w-lg mx-auto px-6 py-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {['connecting', 'approving', 'burning', 'attesting', 'minting', 'completed'].map((step, i) => {
                  const isActive = step === transferStatus
                  const isCompleted = ['connecting', 'approving', 'burning', 'attesting', 'minting', 'completed'].indexOf(transferStatus) > i

                  return (
                    <div key={step} className="flex-1 flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-500' :
                        isActive ? 'bg-green-500/20 border-2 border-green-500' :
                        'bg-white/10'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                        ) : (
                          <span className="text-xs text-gray-500">{i + 1}</span>
                        )}
                      </div>
                      {i < 5 && (
                        <div className={`flex-1 h-0.5 mx-1 ${
                          isCompleted ? 'bg-green-500' : 'bg-white/10'
                        }`} />
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-gray-400 text-sm">
                {transferStatus === 'connecting' && 'Connecting to wallet...'}
                {transferStatus === 'approving' && 'Approve USDC spending...'}
                {transferStatus === 'burning' && 'Burning USDC on source chain...'}
                {transferStatus === 'attesting' && 'Waiting for attestation...'}
                {transferStatus === 'minting' && 'Minting USDC on destination...'}
                {transferStatus === 'completed' && 'Transfer complete!'}
              </p>
            </div>

            {/* Transfer Details */}
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-semibold">{formatUSD(amount)}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">From</span>
                <span className="text-white">{sourceChainInfo?.name}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">To</span>
                <span className="text-white">{destChainInfo?.name} (Grain & Vault)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Speed</span>
                <span className={`${transferSpeed === 'FAST' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {transferSpeed === 'FAST' ? 'Fast (<30s)' : 'Standard (~15 min)'}
                </span>
              </div>
            </div>

            {/* Transaction Links */}
            {burnTxHash && (
              <a
                href={`${sourceChainInfo?.explorerUrl}/tx/${burnTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-2 hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400">Burn Transaction</span>
                <span className="text-green-400 flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            )}

            {mintTxHash && (
              <a
                href={`${destChainInfo?.explorerUrl}/tx/${mintTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-2 hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400">Mint Transaction</span>
                <span className="text-green-400 flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            )}

            {/* Completed Actions */}
            {transferStatus === 'completed' && (
              <div className="mt-6 flex gap-3">
                <Link
                  href="/grain-vault/dashboard"
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold text-center hover:bg-green-600 transition-colors"
                >
                  View Balance
                </Link>
                <button
                  onClick={() => {
                    setTransferStatus('idle')
                    setAmount('')
                    setBurnTxHash('')
                    setMintTxHash('')
                  }}
                  className="flex-1 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors"
                >
                  Bridge More
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header user={user} />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/grain-vault/deposit"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deposit
        </Link>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Cross-Chain Bridge</h1>
          <p className="text-gray-400">
            Transfer USDC from any supported chain directly to Grain & Vault using Circle's CCTP
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Bridge Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          {/* Source Chain */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              From Chain
            </label>
            <div className="relative">
              <select
                value={sourceChain}
                onChange={(e) => setSourceChain(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:border-green-500/50"
              >
                {chains
                  .filter(c => c.id !== defaultDestination)
                  .map(chain => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} {chain.isTestnet ? '(Testnet)' : ''}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            {sourceChainInfo && (
              <p className="mt-1 text-xs text-gray-500">
                USDC: {sourceChainInfo.usdcAddress.slice(0, 10)}...{sourceChainInfo.usdcAddress.slice(-8)}
              </p>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center my-2">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <ArrowDown className="w-5 h-5 text-green-400" />
            </div>
          </div>

          {/* Destination (Fixed) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              To Chain
            </label>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{destChainInfo?.name || 'Base'}</p>
                    <p className="text-xs text-green-400">Grain & Vault Treasury</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-all"
              />
            </div>
          </div>

          {/* Transfer Speed */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Transfer Speed
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTransferSpeed('FAST')}
                className={`p-4 rounded-xl border transition-all ${
                  transferSpeed === 'FAST'
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className={`w-5 h-5 ${transferSpeed === 'FAST' ? 'text-yellow-400' : 'text-gray-400'}`} />
                  <span className="font-semibold text-white">Fast Transfer</span>
                </div>
                <p className="text-sm text-gray-400">~30 seconds</p>
                <p className="text-xs text-gray-500 mt-1">0-14 bps fee</p>
              </button>

              <button
                onClick={() => setTransferSpeed('STANDARD')}
                className={`p-4 rounded-xl border transition-all ${
                  transferSpeed === 'STANDARD'
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={`w-5 h-5 ${transferSpeed === 'STANDARD' ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className="font-semibold text-white">Standard</span>
                </div>
                <p className="text-sm text-gray-400">~15 minutes</p>
                <p className="text-xs text-gray-500 mt-1">No protocol fee</p>
              </button>
            </div>
          </div>

          {/* Estimate */}
          {estimate && (
            <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Transfer Summary</h4>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">You send</span>
                  <span className="text-white font-semibold">{formatUSD(estimate.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Protocol fee ({estimate.protocolFeeBps} bps)</span>
                  <span className="text-gray-300">-{formatUSD(estimate.protocolFee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Est. gas fees</span>
                  <span className="text-gray-300">~{formatUSD(estimate.gasFees.total)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-gray-400">You receive (GRAIN)</span>
                  <span className="text-green-400 font-bold">{formatUSD(estimate.netAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Estimated time</span>
                  <span className={`${transferSpeed === 'FAST' ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {estimate.estimatedTime}
                  </span>
                </div>
              </div>
            </div>
          )}

          {estimating && (
            <div className="mb-6 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Calculating...</span>
            </div>
          )}

          {/* Bridge Button */}
          <button
            onClick={handleBridge}
            disabled={!sourceChain || !amount || parseFloat(amount) <= 0 || estimating}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet & Bridge
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Secure & Native</h3>
            </div>
            <p className="text-sm text-gray-400">
              CCTP burns USDC on source and mints on destination. No wrapped tokens or liquidity pools.
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">1:1 Transfer</h3>
            </div>
            <p className="text-sm text-gray-400">
              Your USDC is converted to GRAIN at the current rate with no slippage.
            </p>
          </div>
        </div>

        {/* Supported Chains */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            Supported Chains
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {chains
              .filter(c => !c.isTestnet)
              .map(chain => (
                <div
                  key={chain.id}
                  className={`p-3 rounded-lg text-center ${
                    chain.id === defaultDestination
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-white/5'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    chain.id === defaultDestination ? 'text-green-400' : 'text-white'
                  }`}>
                    {chain.name}
                  </p>
                  {chain.id === defaultDestination && (
                    <p className="text-xs text-green-400/80">Destination</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// Header Component
function Header({ user }: { user: any }) {
  return (
    <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/grain-vault" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <div className="w-3 h-3 bg-black rounded-sm" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Grain & Vault</h1>
              <p className="text-xs text-gray-400">{user?.firstName || 'Account'}</p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/grain-vault/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
