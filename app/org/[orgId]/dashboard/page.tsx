'use client'

import { useOrganization } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardStats {
  totalRFQs: number
  activeRFQs: number
  totalDeals: number
  totalTransactionValue: number
  averageDealSize: number
  conversionRate: number
}

interface RFQ {
  id: string
  company: string
  category: string
  productName: string
  status: string
  suppliersNotified: number
  createdDate: string
}

interface Supplier {
  id: string
  companyName: string
  categories: string[]
  totalQuotes: number
  totalDeals: number
}

/**
 * Organization Dashboard
 *
 * Organization-scoped procurement history, team activity, and analytics
 */
export default function OrganizationDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const { organization, membership, memberships } = useOrganization({
    memberships: { pageSize: 10 }
  })

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is admin
  const isAdmin = membership?.role === 'org:admin'

  // Verify user has access to this org
  useEffect(() => {
    if (organization && params.orgId !== organization.id) {
      router.push('/')
    }
  }, [organization, params.orgId, router])

  // Load dashboard data
  useEffect(() => {
    if (!organization) return

    const loadDashboardData = async () => {
      setIsLoading(true)
      try {
        // Load RFQs for this organization
        const rfqResponse = await fetch(`/api/rfqs?orgId=${organization.id}`)
        const rfqData = await rfqResponse.json()

        if (rfqData.success) {
          setRfqs(rfqData.rfqs || [])

          // Calculate stats
          const activeStatuses = ['New', 'Suppliers Notified', 'Quotes Received', 'Negotiating']
          const activeRFQs = rfqData.rfqs?.filter((rfq: RFQ) =>
            activeStatuses.includes(rfq.status)
          ) || []

          const completedRFQs = rfqData.rfqs?.filter((rfq: RFQ) =>
            rfq.status === 'Deal Closed'
          ) || []

          setStats({
            totalRFQs: rfqData.rfqs?.length || 0,
            activeRFQs: activeRFQs.length,
            totalDeals: completedRFQs.length,
            totalTransactionValue: completedRFQs.length * 150000, // Mock calculation
            averageDealSize: completedRFQs.length > 0 ? 150000 : 0,
            conversionRate: rfqData.rfqs?.length > 0
              ? (completedRFQs.length / rfqData.rfqs.length) * 100
              : 0
          })
        }

        // Load suppliers (org-scoped)
        const supplierResponse = await fetch(`/api/suppliers/cached?orgId=${organization.id}`)
        const supplierData = await supplierResponse.json()

        if (supplierData.suppliers) {
          setSuppliers(supplierData.suppliers.slice(0, 5)) // Top 5 suppliers
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [organization])

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#575757]">Loading organization...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#9ea1a7]/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-2 inline-block"
              >
                ← Back to Wells AI
              </Link>
              <h1 className="text-3xl font-serif text-[#183b6d]">{organization.name}</h1>
              <p className="text-sm text-[#575757] mt-1">
                Organization Dashboard • {memberships?.data?.length || 0} team members
              </p>
            </div>
            <Link
              href={`/org/${organization.id}/settings`}
              className="flex items-center gap-2 px-4 py-2 border border-[#9ea1a7]/30 rounded-sm hover:border-[#183b6d] transition-colors text-sm text-[#183b6d]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-[#575757]">Loading dashboard...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <div className="text-sm text-[#9ea1a7] mb-2">Total RFQs</div>
                <div className="text-3xl font-serif text-[#183b6d]">
                  {stats?.totalRFQs || 0}
                </div>
              </div>

              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <div className="text-sm text-[#9ea1a7] mb-2">Active RFQs</div>
                <div className="text-3xl font-serif text-[#183b6d]">
                  {stats?.activeRFQs || 0}
                </div>
              </div>

              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <div className="text-sm text-[#9ea1a7] mb-2">Deals Closed</div>
                <div className="text-3xl font-serif text-[#183b6d]">
                  {stats?.totalDeals || 0}
                </div>
              </div>

              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <div className="text-sm text-[#9ea1a7] mb-2">Conversion Rate</div>
                <div className="text-3xl font-serif text-[#183b6d]">
                  {stats?.conversionRate?.toFixed(1) || 0}%
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent RFQs */}
              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <h2 className="text-xl font-medium text-[#183b6d] mb-6">Recent RFQs</h2>

                {rfqs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#9ea1a7] mb-4">No RFQs yet</p>
                    <Link
                      href="/"
                      className="inline-block px-4 py-2 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89430] transition-colors text-sm"
                    >
                      Create First RFQ
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rfqs.slice(0, 5).map((rfq) => (
                      <div
                        key={rfq.id}
                        className="border border-[#9ea1a7]/20 rounded-sm p-4 hover:border-[#183b6d] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-sm font-medium text-[#183b6d]">
                              {rfq.productName}
                            </h3>
                            <p className="text-xs text-[#575757]">{rfq.category}</p>
                          </div>
                          <div className="px-2 py-1 bg-[#dba63f]/10 text-[#dba63f] rounded-sm text-xs">
                            {rfq.status}
                          </div>
                        </div>
                        <div className="text-xs text-[#9ea1a7]">
                          {rfq.suppliersNotified} suppliers notified • {new Date(rfq.createdDate).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Members */}
              <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
                <h2 className="text-xl font-medium text-[#183b6d] mb-6">Team Members</h2>

                <div className="space-y-3">
                  {memberships?.data?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 border border-[#9ea1a7]/20 rounded-sm"
                    >
                      <div className="w-10 h-10 bg-[#183b6d] rounded-sm flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {member.publicUserData?.firstName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#183b6d]">
                          {member.publicUserData?.firstName} {member.publicUserData?.lastName}
                        </div>
                        <div className="text-xs text-[#575757]">
                          {member.role === 'org:admin' ? 'Admin' : 'Member'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <Link
                    href={`/org/${organization.id}/settings`}
                    className="mt-4 w-full block text-center px-4 py-2 border border-[#9ea1a7]/30 rounded-sm hover:border-[#183b6d] transition-colors text-sm text-[#183b6d]"
                  >
                    Manage Team
                  </Link>
                )}
              </div>
            </div>

            {/* Shared Suppliers */}
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">Shared Suppliers</h2>

              {suppliers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[#9ea1a7]">No suppliers connected yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="border border-[#9ea1a7]/20 rounded-sm p-4 hover:border-[#183b6d] transition-colors"
                    >
                      <h3 className="text-sm font-medium text-[#183b6d] mb-2">
                        {supplier.companyName}
                      </h3>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {supplier.categories.slice(0, 2).map((category) => (
                          <span
                            key={category}
                            className="px-2 py-0.5 bg-[#183b6d]/10 text-[#183b6d] rounded-sm text-xs"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-[#9ea1a7]">
                        {supplier.totalQuotes} quotes • {supplier.totalDeals} deals
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">Quick Actions</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/"
                  className="flex items-center gap-3 p-4 border border-[#9ea1a7]/20 rounded-sm hover:border-[#dba63f] hover:bg-[#dba63f]/5 transition-colors"
                >
                  <div className="w-10 h-10 bg-[#dba63f]/10 rounded-sm flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#dba63f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#183b6d]">New RFQ</div>
                    <div className="text-xs text-[#575757]">Request a quote</div>
                  </div>
                </Link>

                {isAdmin && (
                  <Link
                    href={`/org/${organization.id}/settings`}
                    className="flex items-center gap-3 p-4 border border-[#9ea1a7]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-colors"
                  >
                    <div className="w-10 h-10 bg-[#183b6d]/10 rounded-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#183b6d]">Invite Team</div>
                      <div className="text-xs text-[#575757]">Add members</div>
                    </div>
                  </Link>
                )}

                <Link
                  href="/"
                  className="flex items-center gap-3 p-4 border border-[#9ea1a7]/20 rounded-sm hover:border-[#183b6d] hover:bg-[#183b6d]/5 transition-colors"
                >
                  <div className="w-10 h-10 bg-[#183b6d]/10 rounded-sm flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#183b6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#183b6d]">Chat with Wells AI</div>
                    <div className="text-xs text-[#575757]">Start conversation</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
