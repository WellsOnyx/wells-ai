'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Coins, TrendingUp, Lock, Award, ArrowUpRight, ArrowDownRight, History, Sparkles, Users, Shield } from 'lucide-react'

interface GRAINBalance {
  userId: string
  available: string
  staked: string
  pending: string
  totalEarned: string
  totalSpent: string
  transactions: Transaction[]
  rewardRates: any
  stakingAPY: number
  governanceRights: boolean
  feeDiscount: number
}

interface Transaction {
  id: string
  type: 'earn' | 'spend' | 'stake' | 'unstake'
  amount: string
  reason: string
  timestamp: string
  status: string
}

export default function GRAINWallet() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [balance, setBalance] = useState<GRAINBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [staking, setStaking] = useState(false)
  const [stakeAmount, setStakeAmount] = useState('')

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    } else if (user) {
      loadBalance()
    }
  }, [isLoaded, user])

  async function loadBalance() {
    try {
      const response = await fetch('/api/grain/balance')
      if (!response.ok) throw new Error('Failed to load balance')
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Failed to load GRAIN balance:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStake() {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return

    setStaking(true)
    try {
      const response = await fetch('/api/grain/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: stakeAmount, action: 'stake' })
      })

      if (!response.ok) throw new Error('Staking failed')

      const data = await response.json()
      setStakeAmount('')
      loadBalance()
      alert(data.message)
    } catch (error) {
      console.error('Staking error:', error)
      alert('Failed to stake GRAIN')
    } finally {
      setStaking(false)
    }
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  if (!balance) return null

  const totalBalance = parseFloat(balance.available) + parseFloat(balance.staked)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Coins className="w-8 h-8 text-amber-500" />
                GRAIN Wallet
              </h1>
              <p className="text-gray-400 mt-1">Your Wells ecosystem rewards</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
            >
              Earn More GRAIN
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/30 rounded-xl p-6 border border-amber-700/50">
            <div className="flex items-center justify-between mb-4">
              <Coins className="w-8 h-8 text-amber-500" />
              <span className="text-xs text-gray-400">Available</span>
            </div>
            <div className="text-3xl font-bold text-amber-500 mb-1">
              {parseFloat(balance.available).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">GRAIN</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Lock className="w-8 h-8 text-purple-500" />
              <span className="text-xs text-gray-400">Staked</span>
            </div>
            <div className="text-3xl font-bold text-purple-500 mb-1">
              {parseFloat(balance.staked).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Earning {balance.stakingAPY}% APY</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="text-xs text-gray-400">Total Earned</span>
            </div>
            <div className="text-3xl font-bold text-green-500 mb-1">
              {parseFloat(balance.totalEarned).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">All time</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Award className="w-8 h-8 text-blue-500" />
              <span className="text-xs text-gray-400">Fee Discount</span>
            </div>
            <div className="text-3xl font-bold text-blue-500 mb-1">
              {balance.feeDiscount}%
            </div>
            <div className="text-sm text-gray-400">On all transactions</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Staking Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stake GRAIN */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-500" />
                Stake GRAIN
              </h2>

              <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Annual Percentage Yield</span>
                  <span className="text-2xl font-bold text-purple-500">{balance.stakingAPY}%</span>
                </div>
                <div className="text-xs text-gray-500">
                  Stake your GRAIN to earn passive rewards and unlock governance rights
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Amount to Stake
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => setStakeAmount(balance.available)}
                      className="px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
                    >
                      Max
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Available: {parseFloat(balance.available).toLocaleString()} GRAIN
                  </div>
                </div>

                <button
                  onClick={handleStake}
                  disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || staking}
                  className="w-full px-6 py-4 bg-purple-500 text-white rounded-full text-lg font-bold hover:bg-purple-400 transition flex items-center justify-center gap-2 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {staking ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Staking...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Stake GRAIN
                    </>
                  )}
                </button>
              </div>

              {parseFloat(balance.staked) > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Currently Staked</div>
                      <div className="text-2xl font-bold text-purple-500">
                        {parseFloat(balance.staked).toLocaleString()} GRAIN
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition">
                      Unstake
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                Transaction History
              </h2>

              <div className="space-y-3">
                {balance.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition"
                  >
                    <div className="flex items-center gap-3">
                      {tx.type === 'earn' ? (
                        <ArrowDownRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-semibold">{tx.reason}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'earn' ? '+' : '-'}{parseFloat(tx.amount).toLocaleString()}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        tx.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Governance Rights */}
            {balance.governanceRights && (
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-700/30">
                <Shield className="w-12 h-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">Governance Rights Unlocked</h3>
                <p className="text-sm text-gray-400 mb-4">
                  You have {totalBalance.toLocaleString()} GRAIN and can vote on platform proposals
                </p>
                <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-400 transition">
                  View Proposals
                </button>
              </div>
            )}

            {/* Earn More */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <Sparkles className="w-8 h-8 text-amber-500 mb-4" />
              <h3 className="text-lg font-bold mb-4">Ways to Earn GRAIN</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-green-500">0.1</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Complete Transactions</div>
                    <div className="text-xs text-gray-500">Per $1 transacted</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-purple-500">100</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Refer Users</div>
                    <div className="text-xs text-gray-500">Per successful referral</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-500">1</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Daily Login</div>
                    <div className="text-xs text-gray-500">Per active day</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-500">0.05</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Provide Liquidity</div>
                    <div className="text-xs text-gray-500">Per $1 in escrow daily</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Link */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <Users className="w-8 h-8 text-purple-500 mb-4" />
              <h3 className="text-lg font-bold mb-2">Invite Friends</h3>
              <p className="text-sm text-gray-400 mb-4">
                Earn 100 GRAIN for each friend who signs up
              </p>
              <button className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-400 transition">
                Get Referral Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
