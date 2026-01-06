'use client'

/**
 * Grain & Vault - SFO Dashboard
 * Education Fund Management Dashboard for Scholarship Fund Organizations
 *
 * Key metrics displayed:
 * - Total funds under management
 * - Student accounts overview
 * - Disbursement queue
 * - Compliance status
 * - Fund protection status
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield,
  GraduationCap,
  Users,
  Building2,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  FileCheck,
  DollarSign,
  Wallet,
  BarChart3,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  UserCheck,
  Receipt,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  PieChart,
  Activity,
  ExternalLink,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Bell,
  Settings
} from 'lucide-react'
import {
  generateMockOrganization,
  generateMockStudents,
  generateMockVendors,
  generateMockDisbursements,
  calculateFundMetrics,
  EXPENSE_CATEGORY_LABELS,
  type EducationFundOrganization,
  type StudentAccount,
  type ApprovedVendor,
  type Disbursement
} from '@/lib/grain/education-funds'

export default function SFODashboardPage() {
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<EducationFundOrganization | null>(null)
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [vendors, setVendors] = useState<ApprovedVendor[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [metrics, setMetrics] = useState<ReturnType<typeof calculateFundMetrics> | null>(null)

  useEffect(() => {
    // Load mock data - in production, this would fetch from API
    const loadData = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call

      const orgData = generateMockOrganization()
      setOrg(orgData)
      setStudents(generateMockStudents(15))
      setVendors(generateMockVendors(10))
      setDisbursements(generateMockDisbursements(20))
      setMetrics(calculateFundMetrics(orgData))
      setLoading(false)
    }

    loadData()
  }, [])

  const pendingDisbursements = disbursements.filter(d => d.status === 'pending_approval')
  const recentDisbursements = disbursements.slice(0, 5)

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading SFO dashboard...</p>
        </div>
      </div>
    )
  }

  if (!org || !metrics) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load organization data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/grain-vault" className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                </div>
                <div>
                  <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
                  <span className="text-emerald-400 text-sm ml-2">Education</span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-1 ml-8">
                <Link href="/grain-vault/education/dashboard" className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/grain-vault/education/students" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Students
                </Link>
                <Link href="/grain-vault/education/vendors" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Vendors
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors relative">
                <Bell className="w-5 h-5 text-gray-400" />
                {pendingDisbursements.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </button>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Building2 className="w-4 h-4" />
              <span>{org.state} {org.programName}</span>
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">{org.name}</h1>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  org.complianceStatus === 'compliant'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : org.complianceStatus === 'review_needed'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {org.complianceStatus === 'compliant' ? 'Compliant' :
                   org.complianceStatus === 'review_needed' ? 'Review Needed' : 'Action Required'}
                </div>
                <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Disbursement
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Funds */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Total Funds Under Management</span>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">${(org.currentValue / 1000000).toFixed(2)}M</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  +{metrics.appreciationRate.toFixed(1)}%
                </span>
                <span className="text-gray-500">appreciation</span>
              </div>
            </div>

            {/* Protected Principal */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Protected Principal</span>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">${(org.protectedPrincipal / 1000000).toFixed(2)}M</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-400">{metrics.fundProtectionRatio.toFixed(0)}%</span>
                <span className="text-gray-500">protected</span>
              </div>
            </div>

            {/* Active Students */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Active Students</span>
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{org.activeStudents}</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">${metrics.averagePerStudent.toLocaleString()}</span>
                <span className="text-gray-500">avg per student</span>
              </div>
            </div>

            {/* Credit Line Available */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Credit Line Available</span>
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">${(org.creditLineAvailable / 1000).toFixed(0)}K</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">{(100 - metrics.utilizationRate).toFixed(0)}%</span>
                <span className="text-gray-500">remaining</span>
              </div>
            </div>
          </div>

          {/* Fund Protection Visual */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-semibold">Fund Protection Status</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-400 mb-1">Principal Deposited</div>
                <div className="text-2xl font-bold text-white">${org.totalDeposited.toLocaleString()}</div>
                <div className="text-sm text-emerald-400">100% Protected in Vault</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Appreciation Earned</div>
                <div className="text-2xl font-bold text-emerald-400">+${org.appreciationEarned.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Bonus funds for students</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Total Disbursed via Credit</div>
                <div className="text-2xl font-bold text-white">${org.creditLineUsed.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Principal remains protected</div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Disbursement Queue & Activity */}
            <div className="lg:col-span-2 space-y-8">
              {/* Pending Disbursements */}
              {pendingDisbursements.length > 0 && (
                <div className="bg-white/5 border border-amber-500/30 rounded-xl">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold">Pending Approval</h2>
                          <p className="text-sm text-gray-400">{pendingDisbursements.length} disbursements awaiting review</p>
                        </div>
                      </div>
                      <Link href="/grain-vault/education/disbursements" className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center gap-1">
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-white/10">
                    {pendingDisbursements.slice(0, 3).map((d) => (
                      <div key={d.id} className="p-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                              <Receipt className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <div className="font-medium">{EXPENSE_CATEGORY_LABELS[d.category]}</div>
                              <div className="text-sm text-gray-400">{d.description}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${d.amount.toLocaleString()}</div>
                            <div className="flex gap-2 mt-1">
                              <button className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-xs font-medium transition-colors">
                                Approve
                              </button>
                              <button className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded text-xs font-medium transition-colors">
                                Review
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white/5 border border-white/10 rounded-xl">
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Recent Disbursements</h2>
                        <p className="text-sm text-gray-400">{org.totalDisbursements} total disbursements</p>
                      </div>
                    </div>
                    <Link href="/grain-vault/education/disbursements" className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1">
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-white/10">
                  {recentDisbursements.map((d) => (
                    <div key={d.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            d.status === 'completed' ? 'bg-emerald-500/20' :
                            d.status === 'processing' ? 'bg-blue-500/20' :
                            d.status === 'pending_approval' ? 'bg-amber-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            {d.status === 'completed' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                             d.status === 'processing' ? <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" /> :
                             d.status === 'pending_approval' ? <Clock className="w-5 h-5 text-amber-400" /> :
                             <AlertCircle className="w-5 h-5 text-gray-400" />}
                          </div>
                          <div>
                            <div className="font-medium">{EXPENSE_CATEGORY_LABELS[d.category]}</div>
                            <div className="text-sm text-gray-400">
                              {d.invoiceNumber && `Invoice ${d.invoiceNumber} - `}
                              {new Date(d.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${d.amount.toLocaleString()}</div>
                          <div className={`text-sm ${
                            d.status === 'completed' ? 'text-emerald-400' :
                            d.status === 'processing' ? 'text-blue-400' :
                            d.status === 'pending_approval' ? 'text-amber-400' :
                            'text-gray-400'
                          }`}>
                            {d.status === 'completed' ? 'Completed' :
                             d.status === 'processing' ? 'Processing' :
                             d.status === 'pending_approval' ? 'Pending' :
                             d.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Quick Stats & Actions */}
            <div className="space-y-6">
              {/* Student Accounts Quick View */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Student Accounts</h3>
                  <Link href="/grain-vault/education/students" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Students</span>
                    <span className="font-medium">{org.totalStudents}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Active</span>
                    <span className="font-medium text-emerald-400">{org.activeStudents}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Avg Balance</span>
                    <span className="font-medium">${metrics.averagePerStudent.toLocaleString()}</span>
                  </div>
                </div>
                <Link
                  href="/grain-vault/education/students"
                  className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-center block transition-colors"
                >
                  Manage Students
                </Link>
              </div>

              {/* Approved Vendors Quick View */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Approved Vendors</h3>
                  <Link href="/grain-vault/education/vendors" className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Vendors</span>
                    <span className="font-medium">{org.totalVendors}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Active</span>
                    <span className="font-medium text-purple-400">{vendors.filter(v => v.status === 'active').length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pending Approval</span>
                    <span className="font-medium text-amber-400">{vendors.filter(v => v.status === 'pending_approval').length}</span>
                  </div>
                </div>
                <Link
                  href="/grain-vault/education/vendors"
                  className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-center block transition-colors"
                >
                  Manage Vendors
                </Link>
              </div>

              {/* Compliance Status */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold">Compliance</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      org.complianceStatus === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' :
                      org.complianceStatus === 'review_needed' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {org.complianceStatus === 'compliant' ? 'Compliant' :
                       org.complianceStatus === 'review_needed' ? 'Review Needed' : 'Action Required'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Last Audit</span>
                    <span className="font-medium">
                      {org.lastAuditDate ? new Date(org.lastAuditDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">State Reporting</span>
                    <span className={`text-xs font-medium ${org.stateReportingEnabled ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {org.stateReportingEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <button className="mt-4 w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors">
                  Generate Report
                </button>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center">
                    <Plus className="w-4 h-4" />
                    New Disbursement
                  </button>
                  <button className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center">
                    <Users className="w-4 h-4" />
                    Add Student
                  </button>
                  <button className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 justify-center">
                    <Building2 className="w-4 h-4" />
                    Add Vendor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
