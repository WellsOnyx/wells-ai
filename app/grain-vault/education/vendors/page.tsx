'use client'

/**
 * Grain & Vault - Approved Vendor Management
 * Vendor qualification and payment tracking for ESAs and SFOs
 *
 * Features:
 * - Add/remove approved vendors
 * - Vendor categories (tuition, curriculum, therapy, etc.)
 * - Payment history per vendor
 * - Vendor verification status
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Building2,
  Search,
  Filter,
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Bell,
  Settings,
  Users,
  Receipt,
  Shield,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  CreditCard,
  Wallet,
  UserCheck,
  Tag
} from 'lucide-react'
import {
  generateMockVendors,
  generateMockDisbursements,
  EXPENSE_CATEGORY_LABELS,
  type ApprovedVendor,
  type Disbursement,
  type ExpenseCategory
} from '@/lib/grain/education-funds'

export default function VendorsPage() {
  const [loading, setLoading] = useState(true)
  const [vendors, setVendors] = useState<ApprovedVendor[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all')
  const [selectedVendor, setSelectedVendor] = useState<ApprovedVendor | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      setVendors(generateMockVendors(25))
      setDisbursements(generateMockDisbursements(100))
      setLoading(false)
    }
    loadData()
  }, [])

  // Filter vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      const matchesSearch = searchQuery === '' ||
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && vendor.status === 'active') ||
        (statusFilter === 'pending' && vendor.status === 'pending_approval') ||
        (statusFilter === 'suspended' && vendor.status === 'suspended')

      const matchesCategory = categoryFilter === 'all' ||
        vendor.vendorType.includes(categoryFilter)

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [vendors, searchQuery, statusFilter, categoryFilter])

  // Get payments for selected vendor
  const vendorPayments = useMemo(() => {
    if (!selectedVendor) return []
    return disbursements.filter(d => d.vendorId === selectedVendor.id && d.status === 'completed')
  }, [selectedVendor, disbursements])

  // Summary stats
  const stats = useMemo(() => {
    const active = vendors.filter(v => v.status === 'active').length
    const pending = vendors.filter(v => v.status === 'pending_approval').length
    const totalPayments = disbursements.filter(d => d.status === 'completed').length
    const totalVolume = disbursements.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount, 0)
    return { active, pending, totalPayments, totalVolume }
  }, [vendors, disbursements])

  // All unique categories from vendors
  const allCategories = useMemo(() => {
    const cats = new Set<ExpenseCategory>()
    vendors.forEach(v => v.vendorType.forEach(t => cats.add(t)))
    return Array.from(cats)
  }, [vendors])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading approved vendors...</p>
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
                <Link href="/grain-vault/education/dashboard" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Dashboard
                </Link>
                <Link href="/grain-vault/education/students" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Students
                </Link>
                <Link href="/grain-vault/education/vendors" className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium">
                  Vendors
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
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
              <Link href="/grain-vault/education/dashboard" className="hover:text-white">Dashboard</Link>
              <ChevronRight className="w-4 h-4" />
              <span>Approved Vendors</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Approved Vendors</h1>
                <p className="text-gray-400 mt-1">Manage qualified vendors for eligible expense disbursements</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Vendor
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Vendors</span>
                <Building2 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold">{vendors.length}</div>
              <div className="text-sm text-emerald-400">{stats.active} active</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Pending Approval</span>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-sm text-gray-400">awaiting review</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Payments</span>
                <Receipt className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold">{stats.totalPayments}</div>
              <div className="text-sm text-gray-400">disbursements</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Volume</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold">${(stats.totalVolume / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400">paid to vendors</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Categories</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{EXPENSE_CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Vendor List */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="divide-y divide-white/10">
                  {filteredVendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                        selectedVendor?.id === vendor.id ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''
                      }`}
                      onClick={() => setSelectedVendor(vendor)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-purple-400" />
                          </div>
                          <div>
                            <div className="font-medium mb-1">{vendor.name}</div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {vendor.vendorType.slice(0, 2).map((type) => (
                                <span key={type} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">
                                  {EXPENSE_CATEGORY_LABELS[type]}
                                </span>
                              ))}
                              {vendor.vendorType.length > 2 && (
                                <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">
                                  +{vendor.vendorType.length - 2}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{vendor.totalPayments} payments</span>
                              <span>${vendor.totalAmount.toLocaleString()} total</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            vendor.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            vendor.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-400' :
                            vendor.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {vendor.status === 'pending_approval' ? 'Pending' : vendor.status}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            {vendor.paymentMethod === 'grain_direct' ? (
                              <>
                                <Wallet className="w-3 h-3" />
                                <span>GRAIN</span>
                              </>
                            ) : vendor.paymentMethod === 'ach' ? (
                              <>
                                <CreditCard className="w-3 h-3" />
                                <span>ACH</span>
                              </>
                            ) : (
                              <>
                                <Receipt className="w-3 h-3" />
                                <span>Check</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredVendors.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      No vendors found matching your criteria
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vendor Detail Panel */}
            <div>
              {selectedVendor ? (
                <div className="bg-white/5 border border-white/10 rounded-xl">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">{selectedVendor.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          selectedVendor.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                          selectedVendor.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {selectedVendor.status === 'pending_approval' ? 'Pending Approval' : selectedVendor.status}
                        </span>
                      </div>
                    </div>

                    {selectedVendor.status === 'pending_approval' && (
                      <div className="flex gap-2 mt-4">
                        <button className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-medium transition-colors">
                          Approve
                        </button>
                        <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="p-6 border-b border-white/10">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Contact Information</h4>
                    <div className="space-y-3">
                      {selectedVendor.contactName && (
                        <div className="flex items-center gap-3 text-sm">
                          <UserCheck className="w-4 h-4 text-gray-500" />
                          <span>{selectedVendor.contactName}</span>
                        </div>
                      )}
                      {selectedVendor.contactEmail && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-purple-400">{selectedVendor.contactEmail}</span>
                        </div>
                      )}
                      {selectedVendor.contactPhone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span>{selectedVendor.contactPhone}</span>
                        </div>
                      )}
                      {selectedVendor.address && (
                        <div className="flex items-center gap-3 text-sm">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">{selectedVendor.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="p-6 border-b border-white/10">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Approved Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedVendor.vendorType.map((type) => (
                        <span key={type} className="px-2 py-1 bg-purple-500/20 rounded text-xs text-purple-300">
                          {EXPENSE_CATEGORY_LABELS[type]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="p-6 border-b border-white/10">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Payment Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Method</span>
                        <span className="font-medium flex items-center gap-1">
                          {selectedVendor.paymentMethod === 'grain_direct' ? (
                            <>
                              <Wallet className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400">GRAIN Direct</span>
                            </>
                          ) : selectedVendor.paymentMethod === 'ach' ? (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>ACH Transfer</span>
                            </>
                          ) : (
                            <>
                              <Receipt className="w-4 h-4" />
                              <span>Check</span>
                            </>
                          )}
                        </span>
                      </div>
                      {selectedVendor.bankAccountLast4 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Account</span>
                          <span className="font-medium">****{selectedVendor.bankAccountLast4}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total Payments</span>
                        <span className="font-medium">{selectedVendor.totalPayments}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total Volume</span>
                        <span className="font-medium text-emerald-400">${selectedVendor.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Payments */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Payments</h4>
                    {vendorPayments.length > 0 ? (
                      <div className="space-y-3">
                        {vendorPayments.slice(0, 5).map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <div>
                              <div className="text-sm font-medium">{EXPENSE_CATEGORY_LABELS[payment.category]}</div>
                              <div className="text-xs text-gray-400">{new Date(payment.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">${payment.amount}</div>
                              <div className="text-xs text-emerald-400">Completed</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No payments recorded yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Vendor</h3>
                  <p className="text-sm text-gray-400">
                    Click on a vendor to view their details and payment history.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Vendor</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  placeholder="Enter vendor name"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tax ID</label>
                <input
                  type="text"
                  placeholder="Enter tax ID (optional)"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Expense Categories *</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                      <input type="checkbox" className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/20" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  placeholder="Primary contact name"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@vendor.com"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Payment Method *</label>
                <select className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50">
                  <option value="grain_direct">GRAIN Direct (Instant)</option>
                  <option value="ach">ACH Transfer</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  Add Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
