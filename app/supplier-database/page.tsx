'use client'

/**
 * Supplier Database Management
 *
 * Full-featured UI for:
 * - Browsing/searching suppliers by industry codes
 * - Bulk importing suppliers
 * - Creating outreach campaigns
 * - Tracking invite conversions
 *
 * Strategy: Onboard sellers to attract buyers ("sneaky sneaky")
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Search,
  Filter,
  Upload,
  Send,
  Users,
  TrendingUp,
  Mail,
  Eye,
  MousePointer,
  CheckCircle,
  MapPin,
  Factory,
  Target,
  Sparkles,
  ChevronDown,
  Plus,
  Download,
  RefreshCw,
  BarChart3,
  Zap
} from 'lucide-react'

interface Supplier {
  id: string
  companyName: string
  contactEmail: string
  primaryNaicsCode?: string
  headquartersState?: string
  employeeCountRange?: string
  status: string
  inviteStatus: string
  isMinorityOwned?: boolean
  isWomanOwned?: boolean
  isVeteranOwned?: boolean
  isSmallBusiness?: boolean
  products: string[]
  createdAt: string
}

interface NAICSCode {
  code: string
  title: string
  sectorName: string
}

interface Stats {
  totalSuppliers: number
  byStatus: Record<string, number>
  byInviteStatus: Record<string, number>
  byIndustry: { code: string; name: string; count: number }[]
  byState: { state: string; count: number }[]
  diversityBreakdown: Record<string, number>
  conversionFunnel: {
    notInvited: number
    invited: number
    opened: number
    clicked: number
    registered: number
  }
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

const EMPLOYEE_RANGES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
]

const REVENUE_RANGES = [
  '<$1M', '$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M+'
]

export default function SupplierDatabasePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [naicsCodes, setNaicsCodes] = useState<NAICSCode[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNaics, setSelectedNaics] = useState<string[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedInviteStatus, setSelectedInviteStatus] = useState('')

  // UI State
  const [activeTab, setActiveTab] = useState<'browse' | 'import' | 'campaigns' | 'analytics'>('browse')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)

  // Import state
  const [importData, setImportData] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Campaign state
  const [campaignName, setCampaignName] = useState('')
  const [campaignNaics, setCampaignNaics] = useState<string[]>([])
  const [campaignStates, setCampaignStates] = useState<string[]>([])
  const [creatingCampaign, setCreatingCampaign] = useState(false)

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (selectedNaics.length) params.set('naics', selectedNaics.join(','))
      if (selectedStates.length) params.set('states', selectedStates.join(','))
      if (selectedStatus) params.set('status', selectedStatus)
      if (selectedInviteStatus) params.set('invite_status', selectedInviteStatus)

      const res = await fetch(`/api/suppliers/database?${params}`)
      const data = await res.json()

      setSuppliers(data.suppliers || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedNaics, selectedStates, selectedStatus, selectedInviteStatus])

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/suppliers/database?action=stats')
      const data = await res.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // Fetch NAICS codes
  const fetchNaicsCodes = async () => {
    try {
      const res = await fetch('/api/suppliers/database?action=naics-sectors')
      const data = await res.json()
      setNaicsCodes(data.sectors || [])
    } catch (error) {
      console.error('Error fetching NAICS codes:', error)
    }
  }

  useEffect(() => {
    fetchSuppliers()
    fetchStats()
    fetchNaicsCodes()
  }, [fetchSuppliers])

  // Handle bulk import
  const handleImport = async () => {
    if (!importData.trim()) return

    setImporting(true)
    setImportResult(null)

    try {
      // Parse CSV/JSON
      let suppliers: any[] = []

      if (importData.trim().startsWith('[')) {
        // JSON array
        suppliers = JSON.parse(importData)
      } else {
        // CSV format
        const lines = importData.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const supplier: any = {}

          headers.forEach((header, idx) => {
            if (header === 'company' || header === 'company_name' || header === 'name') {
              supplier.companyName = values[idx]
            } else if (header === 'email' || header === 'contact_email') {
              supplier.contactEmail = values[idx]
            } else if (header === 'state') {
              supplier.headquartersState = values[idx]
            } else if (header === 'naics' || header === 'naics_code' || header === 'primary_naics') {
              supplier.primaryNaicsCode = values[idx]
            } else if (header === 'phone') {
              supplier.phone = values[idx]
            } else if (header === 'website') {
              supplier.website = values[idx]
            } else if (header === 'products') {
              supplier.products = values[idx].split(';').map(p => p.trim())
            }
          })

          if (supplier.companyName && supplier.contactEmail) {
            suppliers.push(supplier)
          }
        }
      }

      const res = await fetch('/api/suppliers/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_import',
          suppliers,
          source: 'csv_import'
        })
      })

      const result = await res.json()
      setImportResult(result)

      if (result.imported > 0) {
        fetchSuppliers()
        fetchStats()
      }
    } catch (error: any) {
      setImportResult({ error: error.message })
    } finally {
      setImporting(false)
    }
  }

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return

    setCreatingCampaign(true)

    try {
      const res = await fetch('/api/suppliers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_campaign',
          name: campaignName,
          targetNaicsCodes: campaignNaics,
          targetStates: campaignStates,
          emailSubject: `Join Wells AI - The Future of B2B Commerce`,
          headline: 'Get More Buyers. Close More Deals.',
          benefits: [
            'Access qualified enterprise buyers actively sourcing',
            'AI-powered matching brings deals to you',
            'Zero upfront cost - only pay when you win',
            'Real-time negotiation and contracting'
          ],
          ctaText: 'Join Wells AI Free'
        })
      })

      const result = await res.json()

      if (result.campaign) {
        setCampaignName('')
        setCampaignNaics([])
        setCampaignStates([])
        setShowCampaignModal(false)
        fetchStats()
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
    } finally {
      setCreatingCampaign(false)
    }
  }

  // Send invites to selected suppliers
  const handleSendInvites = async () => {
    if (selectedSuppliers.size === 0) return

    try {
      const res = await fetch('/api/suppliers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_invites',
          supplierIds: Array.from(selectedSuppliers)
        })
      })

      const result = await res.json()
      alert(`Sent ${result.sent} invites!`)
      setSelectedSuppliers(new Set())
      fetchSuppliers()
      fetchStats()
    } catch (error) {
      console.error('Error sending invites:', error)
    }
  }

  // Toggle supplier selection
  const toggleSupplier = (id: string) => {
    const newSelected = new Set(selectedSuppliers)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedSuppliers(newSelected)
  }

  // Select all visible
  const selectAll = () => {
    if (selectedSuppliers.size === suppliers.length) {
      setSelectedSuppliers(new Set())
    } else {
      setSelectedSuppliers(new Set(suppliers.map(s => s.id)))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Factory className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Supplier Database</h1>
                <p className="text-sm text-gray-400">
                  {total.toLocaleString()} suppliers with industry codes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCampaignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Target className="w-4 h-4" />
                New Campaign
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Supplier
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-4">
            {[
              { id: 'browse', label: 'Browse', icon: Building2 },
              { id: 'import', label: 'Import', icon: Upload },
              { id: 'campaigns', label: 'Campaigns', icon: Send },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Banner */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSuppliers.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Total Suppliers</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.conversionFunnel.invited.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Invited</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.conversionFunnel.opened.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Opened</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <MousePointer className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.conversionFunnel.clicked.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Clicked</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.conversionFunnel.registered.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Registered</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search suppliers by name, email, or products..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-medium transition-colors ${
                  showFilters
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {selectedSuppliers.size > 0 && (
                <button
                  onClick={handleSendInvites}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl text-black text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                  Send Invites ({selectedSuppliers.size})
                </button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Industry (NAICS)</label>
                  <select
                    multiple
                    value={selectedNaics}
                    onChange={(e) => setSelectedNaics(Array.from(e.target.selectedOptions, o => o.value))}
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    {naicsCodes.map(code => (
                      <option key={code.code} value={code.code}>
                        {code.code} - {code.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">State</label>
                  <select
                    multiple
                    value={selectedStates}
                    onChange={(e) => setSelectedStates(Array.from(e.target.selectedOptions, o => o.value))}
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <label className="block text-sm font-medium text-gray-400 mb-2 mt-4">Invite Status</label>
                  <select
                    value={selectedInviteStatus}
                    onChange={(e) => setSelectedInviteStatus(e.target.value)}
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">All</option>
                    <option value="not_invited">Not Invited</option>
                    <option value="invited">Invited</option>
                    <option value="opened">Opened</option>
                    <option value="clicked">Clicked</option>
                    <option value="registered">Registered</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    onClick={() => {
                      setSelectedNaics([])
                      setSelectedStates([])
                      setSelectedStatus('')
                      setSelectedInviteStatus('')
                    }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Suppliers Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.size === suppliers.length && suppliers.length > 0}
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Industry</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Invite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No suppliers found. Try adjusting your filters or import some data.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map(supplier => (
                      <tr key={supplier.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.has(supplier.id)}
                            onChange={() => toggleSupplier(supplier.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{supplier.companyName}</p>
                            <p className="text-sm text-gray-400">{supplier.contactEmail}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {supplier.isSmallBusiness && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">SB</span>
                              )}
                              {supplier.isMinorityOwned && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">MBE</span>
                              )}
                              {supplier.isWomanOwned && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-pink-500/20 text-pink-400 rounded">WBE</span>
                              )}
                              {supplier.isVeteranOwned && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">VET</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {supplier.primaryNaicsCode || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {supplier.headquartersState || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            supplier.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            supplier.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {supplier.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            supplier.inviteStatus === 'registered' ? 'bg-emerald-500/20 text-emerald-400' :
                            supplier.inviteStatus === 'clicked' ? 'bg-cyan-500/20 text-cyan-400' :
                            supplier.inviteStatus === 'opened' ? 'bg-purple-500/20 text-purple-400' :
                            supplier.inviteStatus === 'invited' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {supplier.inviteStatus.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 py-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Showing {suppliers.length} of {total.toLocaleString()} suppliers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Bulk Import Suppliers</h2>
                  <p className="text-sm text-gray-400">Import from CSV or JSON format</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    CSV Format Example:
                  </label>
                  <pre className="p-3 bg-black/30 rounded-lg text-xs text-gray-400 overflow-x-auto">
{`company,email,state,naics,phone,products
Acme Manufacturing,sales@acme.com,TX,332,555-1234,metal parts;fasteners
Global Supply Co,info@globalsupply.com,CA,423,555-5678,industrial supplies`}
                  </pre>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Paste your data (CSV or JSON):
                  </label>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={12}
                    placeholder="Paste CSV or JSON data here..."
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <button
                  onClick={handleImport}
                  disabled={importing || !importData.trim()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5" />
                      Import Suppliers
                    </span>
                  )}
                </button>

                {importResult && (
                  <div className={`p-4 rounded-xl ${
                    importResult.error ? 'bg-red-500/20 border border-red-500/30' : 'bg-emerald-500/20 border border-emerald-500/30'
                  }`}>
                    {importResult.error ? (
                      <p className="text-red-400">{importResult.error}</p>
                    ) : (
                      <>
                        <p className="text-emerald-400 font-medium">
                          Successfully imported {importResult.imported} suppliers
                        </p>
                        {importResult.failed > 0 && (
                          <p className="text-amber-400 text-sm mt-1">
                            {importResult.failed} failed to import
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Outreach Campaigns</h2>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <Target className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No active campaigns</h3>
              <p className="text-gray-400 mb-4">
                Create a campaign to start inviting suppliers by industry
              </p>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Zap className="w-5 h-5" />
                Launch First Campaign
              </button>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && stats && (
          <div className="space-y-6">
            {/* Conversion Funnel */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4">Conversion Funnel</h3>
              <div className="flex items-end justify-between h-40">
                {[
                  { label: 'Not Invited', value: stats.conversionFunnel.notInvited, color: 'bg-gray-500' },
                  { label: 'Invited', value: stats.conversionFunnel.invited, color: 'bg-amber-500' },
                  { label: 'Opened', value: stats.conversionFunnel.opened, color: 'bg-purple-500' },
                  { label: 'Clicked', value: stats.conversionFunnel.clicked, color: 'bg-cyan-500' },
                  { label: 'Registered', value: stats.conversionFunnel.registered, color: 'bg-emerald-500' }
                ].map((step, i) => {
                  const maxValue = Math.max(stats.conversionFunnel.notInvited, stats.conversionFunnel.invited || 1)
                  const height = Math.max(10, (step.value / maxValue) * 100)

                  return (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <p className="text-xl font-bold mb-2">{step.value.toLocaleString()}</p>
                      <div
                        className={`w-full max-w-[60px] ${step.color} rounded-t-lg transition-all`}
                        style={{ height: `${height}%` }}
                      />
                      <p className="text-xs text-gray-400 mt-2 text-center">{step.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Industries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Top Industries</h3>
                <div className="space-y-3">
                  {stats.byIndustry.slice(0, 5).map((industry, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-amber-400">{industry.code}</span>
                        <span className="text-sm text-gray-300 truncate max-w-[200px]">
                          {industry.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{industry.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Top States</h3>
                <div className="space-y-3">
                  {stats.byState.slice(0, 5).map((state, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-300">{state.state}</span>
                      </div>
                      <span className="text-sm font-medium">{state.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Diversity Breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4">Diversity Certifications</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: 'Small Business', value: stats.diversityBreakdown.smallBusiness, color: 'blue' },
                  { label: 'Minority Owned', value: stats.diversityBreakdown.minorityOwned, color: 'purple' },
                  { label: 'Woman Owned', value: stats.diversityBreakdown.womanOwned, color: 'pink' },
                  { label: 'Veteran Owned', value: stats.diversityBreakdown.veteranOwned, color: 'green' },
                  { label: '8(a) Certified', value: stats.diversityBreakdown.certified8a, color: 'amber' },
                  { label: 'HUBZone', value: stats.diversityBreakdown.hubzone, color: 'cyan' }
                ].map((cert, i) => (
                  <div key={i} className="text-center">
                    <p className="text-2xl font-bold">{cert.value?.toLocaleString() || 0}</p>
                    <p className="text-xs text-gray-400">{cert.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold mb-4">Create Outreach Campaign</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Manufacturing Q1 Outreach"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target Industries (NAICS)</label>
                <select
                  multiple
                  value={campaignNaics}
                  onChange={(e) => setCampaignNaics(Array.from(e.target.selectedOptions, o => o.value))}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {naicsCodes.map(code => (
                    <option key={code.code} value={code.code}>
                      {code.code} - {code.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target States</label>
                <select
                  multiple
                  value={campaignStates}
                  onChange={(e) => setCampaignStates(Array.from(e.target.selectedOptions, o => o.value))}
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCampaignModal(false)}
                  className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCampaign}
                  disabled={creatingCampaign || !campaignName.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creatingCampaign ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
