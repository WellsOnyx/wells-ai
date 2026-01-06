// @ts-nocheck
'use client'

/**
 * Grain & Vault Admin Collateral Dashboard
 *
 * Comprehensive collateral management view for administrators:
 * - Total collateral vs total deposits
 * - Collateralization ratio (target: 100%+)
 * - Asset breakdown by type
 * - Add new collateral
 * - Update valuations
 * - Alerts and health monitoring
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Shield,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Plus,
  ChevronRight,
  Percent,
  Clock,
  Calendar,
  Landmark,
  Coins,
  Home,
  PiggyBank,
  Activity,
  Info,
  X,
} from 'lucide-react'

// Type icons mapping
const typeIcons: Record<string, any> = {
  fdic_deposit: Building2,
  treasury_bill: Landmark,
  treasury_bond: Landmark,
  treasury_note: Landmark,
  money_market: PiggyBank,
  real_estate: Home,
  precious_metals: Coins,
  other: DollarSign,
}

const typeLabels: Record<string, string> = {
  fdic_deposit: 'FDIC Deposits',
  treasury_bill: 'Treasury Bills',
  treasury_bond: 'Treasury Bonds',
  treasury_note: 'Treasury Notes',
  money_market: 'Money Market',
  real_estate: 'Real Estate',
  precious_metals: 'Precious Metals',
  other: 'Other Assets',
}

interface CollateralSummary {
  totalCollateral: number
  totalAllocated: number
  totalAvailable: number
  totalDeposits: number
  collateralizationRatio: number
  collateralizationPercent: string
  isFullyCollateralized: boolean
  excessCollateral: number
  collateralGap: number
  byType: {
    type: string
    count: number
    totalValue: number
    allocatedValue: number
    percentage: number
  }[]
  alerts: {
    id: string
    severity: 'info' | 'warning' | 'critical'
    type: string
    assetId: string | null
    message: string
    createdAt: string
  }[]
  formatted: {
    totalCollateral: string
    totalAllocated: string
    totalAvailable: string
    totalDeposits: string
    excessCollateral: string
    collateralGap: string
  }
}

interface CollateralAsset {
  id: string
  type: string
  name: string
  description: string | null
  custodian: string
  faceValue: number
  currentValue: number
  lastValuation: string
  interestRate: number | null
  maturityDate: string | null
  allocatedAmount: number
  availableAmount: number
  insuranceProvider: string | null
  insuranceLimit: number | null
  status: string
  formatted: {
    faceValue: string
    currentValue: string
    allocatedAmount: string
    availableAmount: string
    interestRate: string | null
    insuranceLimit: string | null
  }
}

export default function AdminCollateralPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<CollateralSummary | null>(null)
  const [assets, setAssets] = useState<CollateralAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showValuationModal, setShowValuationModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<CollateralAsset | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [summaryRes, assetsRes] = await Promise.all([
        fetch('/api/grain/collateral?view=summary'),
        fetch('/api/grain/collateral?view=list'),
      ])

      if (!summaryRes.ok || !assetsRes.ok) {
        throw new Error('Failed to load collateral data')
      }

      const summaryData = await summaryRes.json()
      const assetsData = await assetsRes.json()

      if (!summaryData.success || !assetsData.success) {
        throw new Error(summaryData.error || assetsData.error || 'Unknown error')
      }

      setSummary(summaryData.summary)
      setAssets(assetsData.assets)
      setError(null)
    } catch (err: any) {
      console.error('Collateral dashboard error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Format helpers
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercent = (ratio: number) => {
    return `${(ratio * 100).toFixed(1)}%`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return AlertCircle
      case 'warning':
        return AlertTriangle
      default:
        return Info
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading collateral data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !summary) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Collateral</h2>
          <p className="text-gray-400 mb-6">{error || 'Failed to load data'}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Collateral Management</h1>
                <p className="text-xs text-gray-400">100% Protected Deposits</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-all flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Collateral
              </button>

              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Collateralization Status Banner */}
        <div
          className={`rounded-2xl p-6 mb-8 border ${
            summary.isFullyCollateralized
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-600/10 to-emerald-500/10 border-emerald-500/20'
              : 'bg-gradient-to-r from-red-500/10 via-red-600/10 to-red-500/10 border-red-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  summary.isFullyCollateralized ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}
              >
                {summary.isFullyCollateralized ? (
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-400" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {summary.isFullyCollateralized
                    ? '100% Collateralized'
                    : 'Under-Collateralized'}
                </h2>
                <p className="text-gray-400">
                  {summary.isFullyCollateralized
                    ? `All deposits are fully backed with ${summary.formatted.excessCollateral} excess collateral`
                    : `Need ${summary.formatted.collateralGap} more collateral to reach 100%`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div
                className={`text-5xl font-bold ${
                  summary.isFullyCollateralized ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {summary.collateralizationPercent}
              </div>
              <p className="text-sm text-gray-400">Collateralization Ratio</p>
            </div>
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Collateral */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-xs text-emerald-400 font-semibold">COLLATERAL</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Collateral</p>
            <h3 className="text-2xl font-bold text-white">{summary.formatted.totalCollateral}</h3>
          </div>

          {/* Total Deposits */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs text-blue-400 font-semibold">DEPOSITS</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Total Deposits</p>
            <h3 className="text-2xl font-bold text-white">{summary.formatted.totalDeposits}</h3>
          </div>

          {/* Allocated */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <span className="text-xs text-amber-400 font-semibold">ALLOCATED</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Allocated to Deposits</p>
            <h3 className="text-2xl font-bold text-white">{summary.formatted.totalAllocated}</h3>
          </div>

          {/* Available */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-xs text-purple-400 font-semibold">AVAILABLE</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Available for Allocation</p>
            <h3 className="text-2xl font-bold text-white">{summary.formatted.totalAvailable}</h3>
          </div>
        </div>

        {/* Alerts Section */}
        {summary.alerts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Active Alerts ({summary.alerts.length})
            </h3>
            <div className="space-y-3">
              {summary.alerts.map((alert) => {
                const AlertIcon = getSeverityIcon(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {alert.type.replace(/_/g, ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Asset Breakdown by Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* By Type Chart */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Asset Breakdown by Type</h3>
            <div className="space-y-4">
              {summary.byType.map((item) => {
                const Icon = typeIcons[item.type] || DollarSign
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-300">
                          {typeLabels[item.type] || item.type}
                        </span>
                        <span className="text-xs text-gray-500">({item.count})</span>
                      </div>
                      <span className="text-sm font-medium text-white">
                        {formatUSD(item.totalValue)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {item.percentage.toFixed(1)}% of total
                      </span>
                      <span className="text-xs text-gray-500">
                        Allocated: {formatUSD(item.allocatedValue)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Collateral Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-gray-400">Total Assets</span>
                <span className="text-white font-semibold">{assets.length}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-gray-400">Active Assets</span>
                <span className="text-white font-semibold">
                  {assets.filter((a) => a.status === 'active').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-gray-400">Collateral per $1 Deposits</span>
                <span className="text-emerald-400 font-semibold">
                  ${summary.collateralizationRatio.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-gray-400">Excess Collateral</span>
                <span className="text-emerald-400 font-semibold">
                  {summary.formatted.excessCollateral}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-400">Utilization Rate</span>
                <span className="text-white font-semibold">
                  {summary.totalCollateral > 0
                    ? formatPercent(summary.totalAllocated / summary.totalCollateral)
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Collateral Assets</h3>
                <p className="text-xs text-gray-400">All registered collateral backing deposits</p>
              </div>
            </div>
          </div>

          {assets.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No collateral assets registered</p>
              <p className="text-sm text-gray-500 mt-1">
                Add collateral to back user deposits
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {assets.map((asset) => {
                const Icon = typeIcons[asset.type] || DollarSign
                const utilization =
                  asset.currentValue > 0
                    ? (asset.allocatedAmount / asset.currentValue) * 100
                    : 0

                return (
                  <div
                    key={asset.id}
                    className="px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedAsset(asset)
                      setShowValuationModal(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{asset.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{asset.custodian}</span>
                            {asset.insuranceProvider && (
                              <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">
                                {asset.insuranceProvider} Insured
                              </span>
                            )}
                            {asset.maturityDate && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Matures {formatDate(asset.maturityDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">
                          {asset.formatted.currentValue}
                        </p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <span className="text-xs text-gray-400">
                            {utilization.toFixed(0)}% utilized
                          </span>
                          {asset.interestRate && (
                            <span className="text-xs text-emerald-400">
                              {asset.formatted.interestRate} APY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Utilization bar */}
                    <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        Allocated: {asset.formatted.allocatedAmount}
                      </span>
                      <span className="text-xs text-gray-500">
                        Available: {asset.formatted.availableAmount}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add Collateral Modal */}
        {showAddModal && (
          <AddCollateralModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false)
              fetchData(true)
            }}
          />
        )}

        {/* Update Valuation Modal */}
        {showValuationModal && selectedAsset && (
          <UpdateValuationModal
            asset={selectedAsset}
            onClose={() => {
              setShowValuationModal(false)
              setSelectedAsset(null)
            }}
            onSuccess={() => {
              setShowValuationModal(false)
              setSelectedAsset(null)
              fetchData(true)
            }}
          />
        )}
      </main>
    </div>
  )
}

// Add Collateral Modal Component
function AddCollateralModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    type: 'fdic_deposit',
    name: '',
    description: '',
    custodian: '',
    faceValue: '',
    currentValue: '',
    interestRate: '',
    maturityDate: '',
    insuranceProvider: '',
    insuranceLimit: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/collateral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          type: formData.type,
          name: formData.name,
          description: formData.description || undefined,
          custodian: formData.custodian,
          faceValue: parseFloat(formData.faceValue),
          currentValue: formData.currentValue
            ? parseFloat(formData.currentValue)
            : undefined,
          interestRate: formData.interestRate
            ? parseFloat(formData.interestRate) / 100
            : undefined,
          maturityDate: formData.maturityDate || undefined,
          insuranceProvider: formData.insuranceProvider || undefined,
          insuranceLimit: formData.insuranceLimit
            ? parseFloat(formData.insuranceLimit)
            : undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error)
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add Collateral Asset</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Asset Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="fdic_deposit">FDIC-Insured Deposit</option>
              <option value="treasury_bill">Treasury Bill</option>
              <option value="treasury_note">Treasury Note</option>
              <option value="treasury_bond">Treasury Bond</option>
              <option value="money_market">Money Market Fund</option>
              <option value="real_estate">Real Estate</option>
              <option value="precious_metals">Precious Metals</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Asset Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Primary Operating Account - Chase"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custodian
            </label>
            <input
              type="text"
              value={formData.custodian}
              onChange={(e) => setFormData({ ...formData, custodian: e.target.value })}
              placeholder="e.g., JPMorgan Chase, Treasury Direct"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Face Value ($)
              </label>
              <input
                type="number"
                value={formData.faceValue}
                onChange={(e) => setFormData({ ...formData, faceValue: e.target.value })}
                placeholder="500000"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Value ($)
              </label>
              <input
                type="number"
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                placeholder="Optional - defaults to face"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                placeholder="5.25"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maturity Date
              </label>
              <input
                type="date"
                value={formData.maturityDate}
                onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Insurance Provider
              </label>
              <input
                type="text"
                value={formData.insuranceProvider}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceProvider: e.target.value })
                }
                placeholder="FDIC, SIPC, etc."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Insurance Limit ($)
              </label>
              <input
                type="number"
                value={formData.insuranceLimit}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceLimit: e.target.value })
                }
                placeholder="250000"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this collateral..."
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Collateral
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Update Valuation Modal Component
function UpdateValuationModal({
  asset,
  onClose,
  onSuccess,
}: {
  asset: CollateralAsset
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    newValue: asset.currentValue.toString(),
    source: 'manual' as 'market' | 'appraisal' | 'custodian' | 'manual',
    appraiser: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/grain/collateral', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          newValue: parseFloat(formData.newValue),
          source: formData.source,
          appraiser: formData.appraiser || undefined,
          notes: formData.notes || undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error)
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const newValue = parseFloat(formData.newValue) || 0
  const changeAmount = newValue - asset.currentValue
  const changePercent =
    asset.currentValue > 0 ? (changeAmount / asset.currentValue) * 100 : 0

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Update Valuation</h2>
            <p className="text-sm text-gray-400 mt-1">{asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Current Value Display */}
          <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-gray-400">Current Value</p>
            <p className="text-2xl font-bold text-white">{asset.formatted.currentValue}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Value ($)
            </label>
            <input
              type="number"
              value={formData.newValue}
              onChange={(e) => setFormData({ ...formData, newValue: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Change Preview */}
          {changeAmount !== 0 && (
            <div
              className={`p-4 rounded-lg ${
                changeAmount >= 0
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {changeAmount >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span
                  className={`font-semibold ${
                    changeAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {changeAmount >= 0 ? '+' : ''}${changeAmount.toLocaleString()} (
                  {changePercent >= 0 ? '+' : ''}
                  {changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valuation Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            >
              <option value="manual">Manual Entry</option>
              <option value="market">Market Price</option>
              <option value="appraisal">Third-Party Appraisal</option>
              <option value="custodian">Custodian Statement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Appraiser/Source Name (Optional)
            </label>
            <input
              type="text"
              value={formData.appraiser}
              onChange={(e) => setFormData({ ...formData, appraiser: e.target.value })}
              placeholder="e.g., CBRE, Bloomberg, etc."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason for valuation change..."
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || changeAmount === 0}
              className="flex-1 px-6 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Valuation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
