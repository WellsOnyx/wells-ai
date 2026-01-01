'use client'

/**
 * Deals Page
 *
 * Frictionless B2B transactions - "Yes, proceed" = deal done
 * Premium minimal design matching dashboard aesthetic
 */

import { useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2,
  Plus,
  Handshake,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Filter,
  Search,
  MoreHorizontal,
  ChevronRight,
  Wallet,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { DealCard } from '@/components/deals/DealCard'
import { DealConfirmation } from '@/components/deals/DealConfirmation'
import { QuickDeal } from '@/components/deals/QuickDeal'
import { TrustedParties } from '@/components/deals/TrustedParties'
import { B2BDeal } from '@/lib/deals/types'

type ViewMode = 'list' | 'create' | 'confirm' | 'trusted'
type RoleFilter = 'all' | 'buyer' | 'seller'
type StatusFilter = 'active' | 'all' | 'completed'

export default function DealsPage() {
  const { user, isLoaded } = useUser()

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [deals, setDeals] = useState<B2BDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<B2BDeal | null>(null)

  // Stats
  const [stats, setStats] = useState({
    activeDeals: 0,
    totalVolume: 0,
    completedThisMonth: 0,
    pendingAction: 0,
  })

  // Fetch deals
  useEffect(() => {
    fetchDeals()
  }, [roleFilter, statusFilter])

  async function fetchDeals() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all' && statusFilter !== 'active') params.set('status', statusFilter)
      if (statusFilter === 'active') params.set('action', 'true')

      const res = await fetch(`/api/b2b?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals || [])

        // Calculate stats
        const active = data.deals?.filter((d: B2BDeal) =>
          !['completed', 'cancelled', 'refunded'].includes(d.status)
        ).length || 0
        const volume = data.deals?.reduce((sum: number, d: B2BDeal) => sum + d.amount, 0) || 0
        const pending = data.deals?.filter((d: B2BDeal) =>
          d.status === 'proposed' || d.status === 'delivered'
        ).length || 0

        setStats({
          activeDeals: active,
          totalVolume: volume,
          completedThisMonth: data.deals?.filter((d: B2BDeal) => d.status === 'completed').length || 0,
          pendingAction: pending,
        })
      }
    } catch (err) {
      console.error('Failed to fetch deals:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDealAction(dealId: string, action: string) {
    try {
      const res = await fetch(`/api/b2b/${dealId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        fetchDeals()
        setSelectedDeal(null)
        setViewMode('list')
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    }
  }

  function handleDealClick(deal: B2BDeal) {
    setSelectedDeal(deal)
    if (deal.status === 'proposed' || deal.status === 'delivered') {
      setViewMode('confirm')
    }
  }

  function handleDealCreated(deal: B2BDeal) {
    fetchDeals()
    setViewMode('list')
  }

  const getUserRole = (deal: B2BDeal): 'buyer' | 'seller' => {
    return roleFilter === 'seller' ? 'seller' : 'buyer'
  }

  // Filter deals by search
  const filteredDeals = deals.filter(deal =>
    !searchQuery ||
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const firstName = user?.firstName || 'there'

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Handshake className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Deals</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-6">
            <button
              onClick={() => setViewMode('list')}
              className={`text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              All Deals
            </button>
            <button
              onClick={() => setViewMode('trusted')}
              className={`text-sm font-medium transition-colors ${
                viewMode === 'trusted' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Trusted Partners
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('create')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Deal
            </button>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                }
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero - Only on list view */}
        {viewMode === 'list' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-white mb-2">
                Your Deals
              </h1>
              <p className="text-gray-400">
                Frictionless B2B transactions. Say "yes, proceed" and it's done.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm text-gray-400">Active</span>
                </div>
                <p className="text-2xl font-semibold text-white">{stats.activeDeals}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-sm text-gray-400">Volume</span>
                </div>
                <p className="text-2xl font-semibold text-white">${stats.totalVolume.toLocaleString()}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-sm text-gray-400">Completed</span>
                </div>
                <p className="text-2xl font-semibold text-white">{stats.completedThisMonth}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-sm text-gray-400">Pending</span>
                </div>
                <p className="text-2xl font-semibold text-white">{stats.pendingAction}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {/* Role Filter */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                  {(['all', 'buyer', 'seller'] as RoleFilter[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                        roleFilter === r
                          ? 'bg-purple-600 text-white'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {r === 'all' ? 'All Roles' : r}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                  {(['active', 'all', 'completed'] as StatusFilter[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                        statusFilter === s
                          ? 'bg-purple-600 text-white'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {s === 'active' ? 'Active' : s === 'all' ? 'All' : 'Completed'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search deals..."
                  className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 w-64"
                />
              </div>
            </div>

            {/* Deals List */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Handshake className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No deals yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Start your first frictionless B2B transaction. Create a deal and just say "yes, proceed".
                </p>
                <button
                  onClick={() => setViewMode('create')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Deal
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredDeals.map(deal => {
                  const userRole = getUserRole(deal)
                  return (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      userRole={userRole}
                      onClick={() => handleDealClick(deal)}
                      onConfirm={() => handleDealAction(deal.id, 'confirm')}
                      onFund={() => handleDealAction(deal.id, 'fund')}
                      onDeliver={() => handleDealAction(deal.id, 'deliver')}
                      onRelease={() => handleDealAction(deal.id, 'release')}
                    />
                  )
                })}
              </div>
            )}

            {/* Summary */}
            {!loading && filteredDeals.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-gray-400">
                  {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
                </span>
                <span className="text-white font-medium">
                  ${filteredDeals.reduce((sum, d) => sum + d.amount, 0).toLocaleString()} total value
                </span>
              </div>
            )}
          </>
        )}

        {/* Create Deal View */}
        {viewMode === 'create' && (
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to deals
            </button>
            <QuickDeal
              onSuccess={handleDealCreated}
              onCancel={() => setViewMode('list')}
            />
          </div>
        )}

        {/* Confirm Deal View */}
        {viewMode === 'confirm' && selectedDeal && (
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => {
                setViewMode('list')
                setSelectedDeal(null)
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to deals
            </button>
            <DealConfirmation
              deal={selectedDeal}
              userRole={getUserRole(selectedDeal)}
              onConfirm={() => handleDealAction(selectedDeal.id, 'confirm')}
              onReject={() => {
                setViewMode('list')
                setSelectedDeal(null)
              }}
            />
          </div>
        )}

        {/* Trusted Partners View */}
        {viewMode === 'trusted' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-white mb-2">Trusted Partners</h1>
              <p className="text-gray-400">
                Auto-approve and auto-fund deals with your trusted trading partners.
              </p>
            </div>

            {/* Trust Levels Explainer */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium text-white">Standard</span>
                </div>
                <p className="text-xs text-gray-500">Normal deal flow with manual confirmation</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-sm font-medium text-white">Elevated</span>
                </div>
                <p className="text-xs text-gray-500">Auto-approve deals, manual funding</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-medium text-white">Unlimited</span>
                </div>
                <p className="text-xs text-gray-500">Auto-approve + auto-fund instantly</p>
              </div>
            </div>

            <TrustedParties
              onSelect={(party) => {
                // Could navigate to create deal with this party
                setViewMode('create')
              }}
            />
          </div>
        )}

        {/* Quick Actions Footer - Only on list view */}
        {viewMode === 'list' && !loading && (
          <div className="mt-12 grid grid-cols-3 gap-4">
            <Link
              href="/dashboard?journey=treasury"
              className="group p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-white font-medium">Treasury</span>
                <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-sm text-gray-500">Manage your GRAIN balance and payments</p>
            </Link>

            <button
              onClick={() => setViewMode('trusted')}
              className="group p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-white font-medium">Trust Network</span>
                <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-sm text-gray-500">Set up auto-approve with trusted partners</p>
            </button>

            <Link
              href="/dashboard?journey=sourcing"
              className="group p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white font-medium">Find Suppliers</span>
                <ChevronRight className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-sm text-gray-500">Source products and create new deals</p>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
