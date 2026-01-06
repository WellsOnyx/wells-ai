'use client'

/**
 * Grain & Vault Faith Organization Dashboard
 * grainandvault.com/faith/dashboard
 *
 * Treasury management dashboard for churches and ministries.
 * Shows fund breakdown, recent tithes, disbursements, and credit line.
 *
 * "The plans of the diligent lead surely to abundance." - Proverbs 21:5
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield,
  Church,
  Heart,
  Globe,
  Building2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Users,
  TrendingUp,
  Lock,
  PieChart,
  HandHeart,
  BookOpen,
  Wallet,
  CreditCard,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Download,
  Plus,
  Send,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  FileText
} from 'lucide-react'

// Mock data types
interface TreasuryData {
  totalBalance: number
  protectedAmount: number
  creditLineAvailable: number
  creditLineUsed: number
  appreciation: number
  appreciationPercent: number
}

interface FundData {
  type: 'general' | 'building' | 'missions' | 'benevolence'
  name: string
  balance: number
  targetAmount?: number
  percentOfTarget?: number
  monthlyChange: number
  icon: React.ElementType
  color: string
}

interface RecentTithe {
  id: string
  donorName: string
  amount: number
  designation: string
  isAnonymous: boolean
  isRecurring: boolean
  date: string
}

interface RecentDisbursement {
  id: string
  recipient: string
  amount: number
  category: string
  fundType: string
  status: 'completed' | 'pending' | 'approved'
  date: string
}

// Mock data
const mockTreasury: TreasuryData = {
  totalBalance: 847250.00,
  protectedAmount: 847250.00,
  creditLineAvailable: 847250.00,
  creditLineUsed: 45000.00,
  appreciation: 38126.25,
  appreciationPercent: 4.7,
}

const mockFunds: FundData[] = [
  {
    type: 'general',
    name: 'General Fund',
    balance: 593075.00,
    monthlyChange: 12450.00,
    icon: Church,
    color: 'emerald',
  },
  {
    type: 'building',
    name: 'Building Fund',
    balance: 127087.50,
    targetAmount: 500000,
    percentOfTarget: 25.4,
    monthlyChange: 8200.00,
    icon: Building2,
    color: 'blue',
  },
  {
    type: 'missions',
    name: 'Missions Fund',
    balance: 84725.00,
    monthlyChange: 4850.00,
    icon: Globe,
    color: 'purple',
  },
  {
    type: 'benevolence',
    name: 'Benevolence Fund',
    balance: 42362.50,
    monthlyChange: 2100.00,
    icon: HandHeart,
    color: 'amber',
  },
]

const mockTithes: RecentTithe[] = [
  { id: '1', donorName: 'Smith Family', amount: 1500.00, designation: 'split', isAnonymous: false, isRecurring: true, date: '2025-01-05' },
  { id: '2', donorName: 'Anonymous', amount: 500.00, designation: 'building', isAnonymous: true, isRecurring: false, date: '2025-01-05' },
  { id: '3', donorName: 'Johnson, M.', amount: 2000.00, designation: 'general', isAnonymous: false, isRecurring: true, date: '2025-01-05' },
  { id: '4', donorName: 'Anonymous', amount: 250.00, designation: 'missions', isAnonymous: true, isRecurring: false, date: '2025-01-04' },
  { id: '5', donorName: 'Williams Family', amount: 800.00, designation: 'split', isAnonymous: false, isRecurring: true, date: '2025-01-04' },
  { id: '6', donorName: 'Chen, D.', amount: 350.00, designation: 'benevolence', isAnonymous: false, isRecurring: false, date: '2025-01-03' },
]

const mockDisbursements: RecentDisbursement[] = [
  { id: '1', recipient: 'Pastor Salary', amount: 8500.00, category: 'staff_salary', fundType: 'general', status: 'completed', date: '2025-01-01' },
  { id: '2', recipient: 'Johnson Family (Utilities)', amount: 450.00, category: 'benevolence', fundType: 'benevolence', status: 'completed', date: '2025-01-03' },
  { id: '3', recipient: 'Smith Missions (Tanzania)', amount: 2500.00, category: 'missions_support', fundType: 'missions', status: 'completed', date: '2025-01-01' },
  { id: '4', recipient: 'HVAC Repair', amount: 3200.00, category: 'operations', fundType: 'building', status: 'pending', date: '2025-01-06' },
  { id: '5', recipient: 'Youth Pastor Salary', amount: 5200.00, category: 'staff_salary', fundType: 'general', status: 'completed', date: '2025-01-01' },
]

const mockMissionaries = [
  { name: 'Smith Family', field: 'Tanzania', monthlySupport: 2500 },
  { name: 'Garcia, R.', field: 'Mexico', monthlySupport: 1800 },
  { name: 'Wilson Team', field: 'Thailand', monthlySupport: 2200 },
]

export default function FaithDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAmounts, setShowAmounts] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month')

  // Simulated data loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setRefreshing(false)
  }

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return '********'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const colorClasses: Record<string, { bg: string; border: string; text: string; bgLight: string }> = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', bgLight: 'bg-emerald-500/10' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', bgLight: 'bg-blue-500/10' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', bgLight: 'bg-purple-500/10' },
    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', bgLight: 'bg-amber-500/10' },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-black animate-spin" />
          </div>
          <p className="text-gray-400">Loading your treasury...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/grain-vault/faith" className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-300 rounded-sm" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-lg font-semibold">Treasury</span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <Link href="/grain-vault/faith/dashboard" className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-md">
                  Overview
                </Link>
                <Link href="/grain-vault/faith/benevolence" className="px-3 py-1.5 text-gray-400 hover:text-white text-sm font-medium rounded-md transition-colors">
                  Benevolence
                </Link>
                <button className="px-3 py-1.5 text-gray-400 hover:text-white text-sm font-medium rounded-md transition-colors">
                  Reports
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAmounts(!showAmounts)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title={showAmounts ? 'Hide amounts' : 'Show amounts'}
              >
                {showAmounts ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/grain-vault/faith/deposit"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-black text-sm font-medium rounded-lg transition-all hover:from-emerald-600 hover:to-emerald-700"
              >
                <Plus className="w-4 h-4" />
                Record Gift
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Scripture Quote - Subtle */}
        <p className="text-sm text-emerald-400/50 italic text-center mb-8">
          "The plans of the diligent lead surely to abundance." - Proverbs 21:5
        </p>

        {/* Treasury Overview */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Total Treasury Card */}
          <div className="lg:col-span-2 relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/10 rounded-2xl blur" />
            <div className="relative bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-emerald-400 font-medium mb-1">Total Treasury (Protected)</p>
                  <p className="text-4xl md:text-5xl font-bold tracking-tight">
                    {formatCurrency(mockTreasury.totalBalance)}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">100% Protected</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Credit Line Available</p>
                  <p className="text-lg font-semibold text-blue-400">{formatCurrency(mockTreasury.creditLineAvailable)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Credit Used</p>
                  <p className="text-lg font-semibold text-amber-400">{formatCurrency(mockTreasury.creditLineUsed)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">YTD Appreciation</p>
                  <p className="text-lg font-semibold text-purple-400">+{formatCurrency(mockTreasury.appreciation)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">APY Rate</p>
                  <p className="text-lg font-semibold text-emerald-400">+{mockTreasury.appreciationPercent}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href="/grain-vault/faith/deposit"
                className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="font-medium">Record Tithe/Offering</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/grain-vault/faith/benevolence"
                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <HandHeart className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="font-medium">Benevolence Requests</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">3</span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </div>
              </Link>

              <button className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="font-medium">New Disbursement</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </button>

              <button className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="font-medium">Generate Report</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Fund Breakdown */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Fund Breakdown</h2>
            <Link href="#" className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              Manage Allocations <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockFunds.map((fund) => {
              const Icon = fund.icon
              const colors = colorClasses[fund.color]

              return (
                <div
                  key={fund.type}
                  className={`p-5 rounded-xl ${colors.bgLight} border ${colors.border} hover:bg-opacity-20 transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 text-sm">
                      <ArrowUpRight className="w-4 h-4" />
                      <span>+{formatCurrency(fund.monthlyChange)}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-400 mb-1">{fund.name}</p>
                  <p className="text-2xl font-bold mb-2">{formatCurrency(fund.balance)}</p>

                  {fund.targetAmount && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Goal: {formatCurrency(fund.targetAmount)}</span>
                        <span>{fund.percentOfTarget?.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bg.replace('/20', '')} rounded-full`}
                          style={{ width: `${fund.percentOfTarget}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recent Tithes & Offerings */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Recent Tithes & Offerings</h2>
              <button className="text-sm text-emerald-400 hover:text-emerald-300">View All</button>
            </div>

            <div className="space-y-3">
              {mockTithes.slice(0, 5).map((tithe) => (
                <div
                  key={tithe.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      {tithe.isAnonymous ? (
                        <Lock className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <span className="text-sm font-medium text-emerald-400">
                          {tithe.donorName.split(' ')[0][0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tithe.donorName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="capitalize">{tithe.designation}</span>
                        {tithe.isRecurring && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                            Recurring
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-400">{formatCurrency(tithe.amount)}</p>
                    <p className="text-xs text-gray-500">{new Date(tithe.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">This Month</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(27600)}</span>
              </div>
            </div>
          </div>

          {/* Recent Disbursements */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Recent Disbursements</h2>
              <button className="text-sm text-emerald-400 hover:text-emerald-300">View All</button>
            </div>

            <div className="space-y-3">
              {mockDisbursements.slice(0, 5).map((disbursement) => {
                const categoryIcons: Record<string, React.ElementType> = {
                  staff_salary: Users,
                  benevolence: HandHeart,
                  missions_support: Globe,
                  operations: Building2,
                  capital: Building2,
                }
                const Icon = categoryIcons[disbursement.category] || DollarSign

                const categoryColors: Record<string, string> = {
                  staff_salary: 'emerald',
                  benevolence: 'amber',
                  missions_support: 'purple',
                  operations: 'blue',
                }
                const color = categoryColors[disbursement.category] || 'gray'
                const colors = colorClasses[color]

                return (
                  <div
                    key={disbursement.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{disbursement.recipient}</p>
                        <p className="text-xs text-gray-400 capitalize">
                          {disbursement.category.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(disbursement.amount)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        disbursement.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : disbursement.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {disbursement.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">This Month</span>
                <span className="font-semibold">{formatCurrency(19850)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Missions & Credit Line Section */}
        <div className="grid lg:grid-cols-2 gap-8 mt-8">
          {/* Missions Overview */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-bold">Missions Support</h2>
                  <p className="text-sm text-gray-400">Monthly commitment</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-400">{formatCurrency(6500)}</p>
            </div>

            <div className="space-y-3">
              {mockMissionaries.map((missionary, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{missionary.name}</p>
                    <p className="text-xs text-purple-400">{missionary.field}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(missionary.monthlySupport)}/mo</p>
                </div>
              ))}
            </div>

            <button className="mt-4 w-full py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors">
              Manage Missionaries
            </button>
          </div>

          {/* Credit Line Status */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold">Credit Line</h2>
                  <p className="text-sm text-gray-400">0% interest, always available</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Available</span>
                <span className="text-2xl font-bold text-blue-400">
                  {formatCurrency(mockTreasury.creditLineAvailable - mockTreasury.creditLineUsed)}
                </span>
              </div>
              <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                  style={{ width: `${100 - (mockTreasury.creditLineUsed / mockTreasury.creditLineAvailable * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>Used: {formatCurrency(mockTreasury.creditLineUsed)}</span>
                <span>Total: {formatCurrency(mockTreasury.creditLineAvailable)}</span>
              </div>
            </div>

            <div className="p-4 bg-black/30 rounded-lg mb-4">
              <p className="text-sm text-gray-400 mb-2">How it works:</p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>1:1 credit line based on deposits</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>0% interest, always</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span>Your deposits stay protected</span>
                </li>
              </ul>
            </div>

            <button className="w-full py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors">
              Use Credit Line
            </button>
          </div>
        </div>

        {/* Pending Benevolence Alert */}
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold">3 Benevolence Requests Pending Review</p>
              <p className="text-sm text-gray-400">Urgent: 1 immediate, 2 within the week</p>
            </div>
          </div>
          <Link
            href="/grain-vault/faith/benevolence"
            className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors flex items-center gap-2"
          >
            Review Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
