'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Lock, CheckCircle, Clock, AlertTriangle, DollarSign, ArrowRight, FileText, Users } from 'lucide-react'

interface Escrow {
  id: string
  buyerId: string
  sellerId: string
  amount: string
  description: string
  status: string
  createdAt: string
  fundedAt?: string
  completedAt?: string
}

export default function VaultDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'escrows'>('overview')
  const [newEscrow, setNewEscrow] = useState({
    sellerId: '',
    amount: '',
    description: '',
    rfqId: ''
  })
  const [creating, setCreating] = useState(false)

  const escrows: Escrow[] = [
    {
      id: 'escrow_001',
      buyerId: 'buyer_123',
      sellerId: 'seller_456',
      amount: '5000',
      description: 'Custom metal parts manufacturing - RFQ #1234',
      status: 'in_progress',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      fundedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'escrow_002',
      buyerId: 'buyer_123',
      sellerId: 'seller_789',
      amount: '12000',
      description: 'Software development services',
      status: 'completed',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      fundedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  const stats = {
    totalEscrowed: '$17,000',
    activeEscrows: 1,
    completedEscrows: 1,
    savedInDisputes: '$0'
  }

  async function handleCreateEscrow(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/vault/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEscrow)
      })

      if (!response.ok) throw new Error('Failed to create escrow')

      const data = await response.json()
      alert(`Escrow created! ID: ${data.escrow.id}`)
      setNewEscrow({ sellerId: '', amount: '', description: '', rfqId: '' })
      setActiveTab('escrows')
    } catch (error) {
      console.error('Escrow creation error:', error)
      alert('Failed to create escrow')
    } finally {
      setCreating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'created':
        return { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock, label: 'Awaiting Funds' }
      case 'funded':
        return { color: 'bg-blue-500/20 text-blue-400', icon: Lock, label: 'Funded' }
      case 'in_progress':
        return { color: 'bg-purple-500/20 text-purple-400', icon: Clock, label: 'In Progress' }
      case 'completed':
        return { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'Completed' }
      case 'disputed':
        return { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle, label: 'Disputed' }
      default:
        return { color: 'bg-gray-500/20 text-gray-400', icon: Clock, label: status }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="w-8 h-8 text-blue-500" />
                Vault Escrow
              </h1>
              <p className="text-gray-400 mt-1">Secure USDC payments with smart contracts</p>
            </div>
            <button
              onClick={() => setActiveTab('create')}
              className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-400 transition"
            >
              Create Escrow
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'create'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Escrow
          </button>
          <button
            onClick={() => setActiveTab('escrows')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'escrows'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Escrows
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <DollarSign className="w-8 h-8 text-green-500 mb-4" />
                <div className="text-3xl font-bold text-green-500 mb-1">{stats.totalEscrowed}</div>
                <div className="text-sm text-gray-400">Total Escrowed</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <Clock className="w-8 h-8 text-blue-500 mb-4" />
                <div className="text-3xl font-bold text-blue-500 mb-1">{stats.activeEscrows}</div>
                <div className="text-sm text-gray-400">Active Escrows</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <CheckCircle className="w-8 h-8 text-purple-500 mb-4" />
                <div className="text-3xl font-bold text-purple-500 mb-1">{stats.completedEscrows}</div>
                <div className="text-sm text-gray-400">Completed</div>
              </div>

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                <Shield className="w-8 h-8 text-amber-500 mb-4" />
                <div className="text-3xl font-bold text-amber-500 mb-1">{stats.savedInDisputes}</div>
                <div className="text-sm text-gray-400">Saved in Disputes</div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold mb-6">How Vault Escrow Works</h2>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Create & Fund</h3>
                  <p className="text-sm text-gray-400">
                    Buyer creates escrow and deposits USDC into smart contract
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-purple-500" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Seller Delivers</h3>
                  <p className="text-sm text-gray-400">
                    Seller completes work. Funds held securely on-chain
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Auto Release</h3>
                  <p className="text-sm text-gray-400">
                    Buyer confirms delivery. Smart contract releases funds + GRAIN rewards
                  </p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-700/30">
                <Shield className="w-8 h-8 text-blue-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">Trustless Payments</h3>
                <p className="text-sm text-gray-400">
                  No need to trust the other party. Smart contracts enforce payment terms automatically.
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-700/30">
                <DollarSign className="w-8 h-8 text-green-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">Instant Settlement</h3>
                <p className="text-sm text-gray-400">
                  USDC transfers settle instantly on-chain. No waiting for bank wires or ACH.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create Escrow Tab */}
        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold mb-6">Create New Escrow</h2>

              <form onSubmit={handleCreateEscrow} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Seller ID / Email
                  </label>
                  <input
                    type="text"
                    value={newEscrow.sellerId}
                    onChange={(e) => setNewEscrow({ ...newEscrow, sellerId: e.target.value })}
                    placeholder="seller@example.com"
                    required
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={newEscrow.amount}
                    onChange={(e) => setNewEscrow({ ...newEscrow, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    2.5% escrow fee will be added
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newEscrow.description}
                    onChange={(e) => setNewEscrow({ ...newEscrow, description: e.target.value })}
                    placeholder="What is this payment for?"
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    RFQ/Deal ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newEscrow.rfqId}
                    onChange={(e) => setNewEscrow({ ...newEscrow, rfqId: e.target.value })}
                    placeholder="Link to existing RFQ or deal"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-400">
                      <strong className="text-white">Secure & Transparent:</strong> Funds are held in a smart contract and can only be released when both parties agree or through dispute resolution.
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full px-6 py-4 bg-blue-500 text-white rounded-full text-lg font-bold hover:bg-blue-400 transition flex items-center justify-center gap-2 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Escrow...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Create Escrow
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Escrows List Tab */}
        {activeTab === 'escrows' && (
          <div className="space-y-4">
            {escrows.map((escrow) => {
              const badge = getStatusBadge(escrow.status)
              const Icon = badge.icon

              return (
                <div
                  key={escrow.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">{escrow.description}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>Escrow ID: {escrow.id}</span>
                        <span>Created {new Date(escrow.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${badge.color}`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Amount</div>
                      <div className="text-2xl font-bold text-green-500">${parseFloat(escrow.amount).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Seller</div>
                      <div className="font-mono text-sm">{escrow.sellerId.slice(0, 12)}...</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Status</div>
                      <div className="font-semibold">{badge.label}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-400 transition flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" />
                      View Details
                    </button>
                    {escrow.status === 'in_progress' && (
                      <button className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-400 transition">
                        Release Funds
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
