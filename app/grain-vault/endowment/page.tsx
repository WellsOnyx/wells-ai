// @ts-nocheck
'use client'

/**
 * Grain & Vault Endowment Dashboard
 *
 * A comprehensive dashboard for nonprofit endowment management featuring:
 * 1. Total Endowment Value - protected principal + appreciation
 * 2. Fund Protection Status - 100% FDIC/collateral backed visualization
 * 3. Credit Line Status - available vs used for operations
 * 4. Restricted Funds - breakdown by donor restriction
 * 5. Grant Activity - recent disbursements
 * 6. Yield/Appreciation - endowment growth
 * 7. Compliance Indicators - spending policy adherence
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Shield,
  TrendingUp,
  DollarSign,
  Building2,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Users,
  Wallet,
  Landmark,
  Lock,
  Unlock,
  CreditCard,
  Activity,
  Calendar,
  ChevronRight,
  Download,
  AlertTriangle,
  Sparkles,
  CircleDollarSign
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// =============================================================================
// MOCK DATA - $50M Endowment with Various Restricted Funds
// =============================================================================

const MOCK_ENDOWMENT_DATA = {
  // Total Endowment Overview
  totalValue: 52_847_392.18,
  protectedPrincipal: 48_500_000.00,
  totalAppreciation: 4_347_392.18,
  appreciationPercent: 8.97,

  // Fund Protection Status
  protection: {
    fdicCovered: 25_000_000.00,
    collateralBacked: 27_847_392.18,
    totalProtected: 52_847_392.18,
    protectionRatio: 100,
    lastAuditDate: '2025-11-15',
    nextAuditDate: '2026-02-15'
  },

  // Credit Line Status
  creditLine: {
    totalAvailable: 5_000_000.00,
    currentlyUsed: 1_247_500.00,
    availableBalance: 3_752_500.00,
    interestRate: 4.25,
    utilizationPercent: 24.95
  },

  // Restricted Fund Breakdown
  restrictedFunds: {
    unrestricted: {
      value: 18_234_892.45,
      percent: 34.5,
      description: 'Board-designated and general operating'
    },
    temporarilyRestricted: {
      value: 22_456_789.12,
      percent: 42.5,
      description: 'Time or purpose restricted by donor',
      subFunds: [
        { name: 'Scholarship Fund 2026', value: 8_500_000, releaseDate: '2026-08-01' },
        { name: 'Building Campaign', value: 6_200_000, releaseDate: '2027-01-15' },
        { name: 'Research Initiative', value: 4_856_789.12, releaseDate: '2026-06-30' },
        { name: 'Program Development', value: 2_900_000, releaseDate: '2025-12-31' }
      ]
    },
    permanentlyRestricted: {
      value: 12_155_710.61,
      percent: 23.0,
      description: 'Principal must be maintained in perpetuity',
      subFunds: [
        { name: 'Smith Family Endowment', value: 5_000_000, established: '1998' },
        { name: 'Legacy Scholarship Fund', value: 3_500_000, established: '2005' },
        { name: 'Johnson Research Chair', value: 2_155_710.61, established: '2012' },
        { name: 'Memorial Arts Fund', value: 1_500_000, established: '2018' }
      ]
    }
  },

  // Yield & Appreciation History (Last 12 months)
  yieldHistory: [
    { month: 'Jan', yield: 185420, appreciation: 312500, total: 497920 },
    { month: 'Feb', yield: 192340, appreciation: 285000, total: 477340 },
    { month: 'Mar', yield: 178900, appreciation: 425000, total: 603900 },
    { month: 'Apr', yield: 195600, appreciation: 380000, total: 575600 },
    { month: 'May', yield: 201450, appreciation: 295000, total: 496450 },
    { month: 'Jun', yield: 189230, appreciation: 520000, total: 709230 },
    { month: 'Jul', yield: 203780, appreciation: 345000, total: 548780 },
    { month: 'Aug', yield: 198450, appreciation: 410000, total: 608450 },
    { month: 'Sep', yield: 195670, appreciation: 275000, total: 470670 },
    { month: 'Oct', yield: 207890, appreciation: 495000, total: 702890 },
    { month: 'Nov', yield: 212340, appreciation: 385000, total: 597340 },
    { month: 'Dec', yield: 218500, appreciation: 220000, total: 438500 }
  ],

  // Grant Activity (Recent Disbursements)
  recentGrants: [
    { id: 'GR-2025-042', recipient: 'Community Arts Center', amount: 125000, date: '2025-12-18', status: 'completed', fund: 'Memorial Arts Fund' },
    { id: 'GR-2025-041', recipient: 'STEM Education Initiative', amount: 85000, date: '2025-12-15', status: 'completed', fund: 'Unrestricted' },
    { id: 'GR-2025-040', recipient: 'Johnson Research Lab', amount: 150000, date: '2025-12-10', status: 'completed', fund: 'Johnson Research Chair' },
    { id: 'GR-2025-039', recipient: 'Annual Scholarship Awards', amount: 425000, date: '2025-12-01', status: 'completed', fund: 'Legacy Scholarship Fund' },
    { id: 'GR-2025-038', recipient: 'Building Renovation Phase 1', amount: 750000, date: '2025-11-28', status: 'pending', fund: 'Building Campaign' },
    { id: 'GR-2025-037', recipient: 'Youth Programs Expansion', amount: 95000, date: '2025-11-20', status: 'completed', fund: 'Unrestricted' }
  ],

  // Compliance & Spending Policy
  compliance: {
    spendingPolicyRate: 5.0, // Annual draw percentage
    currentYearDraw: 2_425_000.00,
    maxAllowedDraw: 2_642_369.61, // 5% of total value
    drawUtilization: 91.8,
    policyStatus: 'compliant',
    lastComplianceReview: '2025-12-01',
    nextComplianceReview: '2026-03-01',
    auditorName: 'Grant Thornton LLP',
    fiscalYearEnd: '2026-06-30'
  },

  // Portfolio Allocation
  allocation: [
    { category: 'Fixed Income (T-Bills/Bonds)', value: 21_138_957, percent: 40, color: '#10b981' },
    { category: 'Equities', value: 15_854_218, percent: 30, color: '#3b82f6' },
    { category: 'Money Market', value: 7_927_109, percent: 15, color: '#8b5cf6' },
    { category: 'Real Assets', value: 5_284_739, percent: 10, color: '#f59e0b' },
    { category: 'Cash & Equivalents', value: 2_642_370, percent: 5, color: '#6b7280' }
  ]
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function EndowmentDashboard() {
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y')

  const data = MOCK_ENDOWMENT_DATA

  // Format currency
  const formatUSD = (amount: number, compact = false) => {
    if (compact) {
      if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
      if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (pct: number) => `${pct.toFixed(1)}%`

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  // Chart data for yield history
  const yieldChartData = {
    labels: data.yieldHistory.map(h => h.month),
    datasets: [
      {
        label: 'Total Growth',
        data: data.yieldHistory.map(h => h.total),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Yield',
        data: data.yieldHistory.map(h => h.yield),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4
      }
    ]
  }

  const yieldChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { color: '#9ca3af' }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${formatUSD(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#9ca3af',
          callback: (value: number) => formatUSD(value, true)
        }
      }
    }
  }

  // Allocation donut chart
  const allocationChartData = {
    labels: data.allocation.map(a => a.category),
    datasets: [{
      data: data.allocation.map(a => a.percent),
      backgroundColor: data.allocation.map(a => a.color),
      borderColor: '#000',
      borderWidth: 2
    }]
  }

  const allocationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const item = data.allocation[ctx.dataIndex]
            return `${item.category}: ${formatUSD(item.value, true)} (${item.percent}%)`
          }
        }
      }
    }
  }

  // Restricted funds donut chart
  const restrictedChartData = {
    labels: ['Unrestricted', 'Temporarily Restricted', 'Permanently Restricted'],
    datasets: [{
      data: [
        data.restrictedFunds.unrestricted.percent,
        data.restrictedFunds.temporarilyRestricted.percent,
        data.restrictedFunds.permanentlyRestricted.percent
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6'],
      borderColor: '#000',
      borderWidth: 2
    }]
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Landmark className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Endowment Management</h1>
                <p className="text-xs text-gray-400">Grain & Vault</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/grain-vault/endowment/reports"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm"
              >
                <FileText className="w-4 h-4" />
                Board Reports
              </Link>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Section 1: Total Endowment Value - Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20 backdrop-blur-xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Total Value */}
              <div className="lg:col-span-1">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-emerald-300/80 font-medium">Total Endowment Value</span>
                </div>
                <p className="text-4xl sm:text-5xl font-bold text-white mb-2">
                  {formatUSD(data.totalValue, true)}
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-semibold">+{formatPercent(data.appreciationPercent)} YTD</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    +{formatUSD(data.totalAppreciation, true)} growth
                  </div>
                </div>
              </div>

              {/* Principal & Appreciation */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Protected Principal</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatUSD(data.protectedPrincipal, true)}</p>
                  <p className="text-xs text-gray-500 mt-1">Original donor contributions</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Total Appreciation</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">+{formatUSD(data.totalAppreciation, true)}</p>
                  <p className="text-xs text-gray-500 mt-1">Investment returns to date</p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Fiscal Year End</span>
                  </div>
                  <p className="text-lg font-semibold text-white">{data.compliance.fiscalYearEnd}</p>
                  <p className="text-xs text-emerald-400 mt-1">173 days remaining</p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Annualized Return</span>
                  </div>
                  <p className="text-lg font-semibold text-emerald-400">+7.8%</p>
                  <p className="text-xs text-gray-500 mt-1">3-year rolling average</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Fund Protection Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Fund Protection Status</h2>
                <p className="text-sm text-gray-400">100% FDIC & Collateral Backed</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Fully Protected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400">FDIC Covered</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatUSD(data.protection.fdicCovered, true)}</p>
              <p className="text-xs text-emerald-400 mt-1">Multiple bank partnerships</p>
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Collateral Backed</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatUSD(data.protection.collateralBacked, true)}</p>
              <p className="text-xs text-blue-400 mt-1">T-Bills & securities</p>
            </div>

            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Protection Ratio</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{formatPercent(data.protection.protectionRatio)}</p>
              <p className="text-xs text-purple-400 mt-1">Full coverage maintained</p>
            </div>
          </div>

          {/* Protection Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Protection Coverage</span>
              <span className="text-emerald-400 font-medium">{formatUSD(data.protection.totalProtected, true)} / {formatUSD(data.totalValue, true)}</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                style={{ width: `${data.protection.protectionRatio}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Last Audit: {data.protection.lastAuditDate}</span>
              <span>Next Audit: {data.protection.nextAuditDate}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Credit Line & Compliance Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit Line Status */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Credit Line Status</h2>
                  <p className="text-sm text-gray-400">Operations & Cash Flow</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Interest Rate</p>
                <p className="text-lg font-semibold text-blue-400">{data.creditLine.interestRate}%</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">Available Balance</p>
                  <p className="text-xl font-bold text-emerald-400">{formatUSD(data.creditLine.availableBalance, true)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">Currently Used</p>
                  <p className="text-xl font-bold text-amber-400">{formatUSD(data.creditLine.currentlyUsed, true)}</p>
                </div>
              </div>

              {/* Credit Utilization */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Credit Utilization</span>
                  <span className="text-blue-400 font-medium">{formatPercent(data.creditLine.utilizationPercent)}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                    style={{ width: `${data.creditLine.utilizationPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">$0</span>
                  <span className="text-gray-500">Total Line: {formatUSD(data.creditLine.totalAvailable, true)}</span>
                </div>
              </div>

              <Link
                href="/grain-vault/endowment/grants"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500/20 text-blue-400 rounded-xl font-medium hover:bg-blue-500/30 transition-all border border-blue-500/30"
              >
                <CircleDollarSign className="w-4 h-4" />
                Request Disbursement
              </Link>
            </div>
          </div>

          {/* Compliance Indicators */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Compliance Status</h2>
                  <p className="text-sm text-gray-400">{formatPercent(data.compliance.spendingPolicyRate)} Annual Spending Policy</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                data.compliance.policyStatus === 'compliant'
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-amber-500/20 border-amber-500/30'
              }`}>
                {data.compliance.policyStatus === 'compliant' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className={`text-sm font-medium ${
                  data.compliance.policyStatus === 'compliant' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {data.compliance.policyStatus === 'compliant' ? 'Compliant' : 'Review Needed'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">YTD Spending</p>
                  <p className="text-xl font-bold text-white">{formatUSD(data.compliance.currentYearDraw, true)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">Max Allowed (5%)</p>
                  <p className="text-xl font-bold text-gray-300">{formatUSD(data.compliance.maxAllowedDraw, true)}</p>
                </div>
              </div>

              {/* Spending Policy Adherence */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Draw Utilization</span>
                  <span className="text-purple-400 font-medium">{formatPercent(data.compliance.drawUtilization)}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.compliance.drawUtilization > 100
                        ? 'bg-gradient-to-r from-red-500 to-red-400'
                        : data.compliance.drawUtilization > 90
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}
                    style={{ width: `${Math.min(data.compliance.drawUtilization, 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Auditor: {data.compliance.auditorName}</span>
                  <span>Next Review: {data.compliance.nextComplianceReview}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Restricted Funds Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Restricted Funds Breakdown</h2>
                <p className="text-sm text-gray-400">By donor restriction type</p>
              </div>
            </div>
            <Link
              href="/grain-vault/endowment/funds"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm"
            >
              Manage Funds
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <Doughnut data={restrictedChartData} options={allocationChartOptions} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="text-lg font-bold">{formatUSD(data.totalValue, true)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fund Details */}
            <div className="lg:col-span-2 space-y-4">
              {/* Unrestricted */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">Unrestricted</span>
                  </div>
                  <span className="text-lg font-bold text-white">{formatUSD(data.restrictedFunds.unrestricted.value, true)}</span>
                </div>
                <p className="text-xs text-gray-400">{data.restrictedFunds.unrestricted.description}</p>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.restrictedFunds.unrestricted.percent}%` }} />
                </div>
              </div>

              {/* Temporarily Restricted */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-amber-400">Temporarily Restricted</span>
                  </div>
                  <span className="text-lg font-bold text-white">{formatUSD(data.restrictedFunds.temporarilyRestricted.value, true)}</span>
                </div>
                <p className="text-xs text-gray-400">{data.restrictedFunds.temporarilyRestricted.description}</p>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.restrictedFunds.temporarilyRestricted.percent}%` }} />
                </div>
              </div>

              {/* Permanently Restricted */}
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-purple-400">Permanently Restricted</span>
                  </div>
                  <span className="text-lg font-bold text-white">{formatUSD(data.restrictedFunds.permanentlyRestricted.value, true)}</span>
                </div>
                <p className="text-xs text-gray-400">{data.restrictedFunds.permanentlyRestricted.description}</p>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${data.restrictedFunds.permanentlyRestricted.percent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Yield/Appreciation Chart */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Yield & Appreciation</h2>
                <p className="text-sm text-gray-400">Monthly growth performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    timeRange === range
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            <Line data={yieldChartData} options={yieldChartOptions} />
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Total Yield (12mo)</p>
              <p className="text-lg font-bold text-blue-400">
                {formatUSD(data.yieldHistory.reduce((sum, h) => sum + h.yield, 0), true)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Total Appreciation</p>
              <p className="text-lg font-bold text-emerald-400">
                {formatUSD(data.yieldHistory.reduce((sum, h) => sum + h.appreciation, 0), true)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Combined Growth</p>
              <p className="text-lg font-bold text-teal-400">
                {formatUSD(data.yieldHistory.reduce((sum, h) => sum + h.total, 0), true)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Avg Monthly</p>
              <p className="text-lg font-bold text-purple-400">
                {formatUSD(data.yieldHistory.reduce((sum, h) => sum + h.total, 0) / 12, true)}
              </p>
            </div>
          </div>
        </div>

        {/* Section 6: Grant Activity & Portfolio Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Grant Activity */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Recent Grants</h2>
                  <p className="text-sm text-gray-400">Credit line disbursements</p>
                </div>
              </div>
              <Link
                href="/grain-vault/endowment/grants"
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {data.recentGrants.slice(0, 5).map((grant) => (
                <div
                  key={grant.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      grant.status === 'completed' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    }`}>
                      {grant.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{grant.recipient}</p>
                      <p className="text-xs text-gray-400">{grant.fund}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatUSD(grant.amount, true)}</p>
                    <p className="text-xs text-gray-500">{grant.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Allocation */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Portfolio Allocation</h2>
                  <p className="text-sm text-gray-400">Asset class distribution</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative w-40 h-40 flex-shrink-0">
                <Doughnut data={allocationChartData} options={allocationChartOptions} />
              </div>

              <div className="flex-1 space-y-2">
                {data.allocation.map((asset, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: asset.color }}
                      />
                      <span className="text-xs text-gray-300 truncate max-w-[140px]">{asset.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-white">{asset.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/grain-vault/endowment/funds"
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Manage Funds</h3>
            <p className="text-xs text-gray-400">Restricted fund buckets</p>
          </Link>

          <Link
            href="/grain-vault/endowment/grants"
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <CircleDollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Grant Disbursements</h3>
            <p className="text-xs text-gray-400">Request & track grants</p>
          </Link>

          <Link
            href="/grain-vault/endowment/reports"
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Board Reports</h3>
            <p className="text-xs text-gray-400">Quarterly & annual</p>
          </Link>

          <Link
            href="/grain-vault/dashboard"
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Treasury Dashboard</h3>
            <p className="text-xs text-gray-400">Full account view</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
