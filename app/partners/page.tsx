/**
 * Partner Panel - List all partners with status
 * Shows Observe | Pending OAuth | Ready status for each partner
 */

'use client'

import Link from 'next/link'
import { PARTNERS, hasValidCredentials, PartnerAuthType } from '@/config/partners'

interface PartnerStatus {
  id: string
  name: string
  displayName: string
  description: string
  category: string
  logoUrl: string
  brandColor: string
  authType: PartnerAuthType
  status: 'observe' | 'pending_oauth' | 'ready'
  statusLabel: string
  capabilities: {
    discover: boolean
    dealReg: boolean
    coSell: boolean
  }
  projectStatus: 'active' | 'beta' | 'coming_soon' | 'deprecated'
}

function getPartnerStatus(partnerId: string): 'observe' | 'pending_oauth' | 'ready' {
  const partner = PARTNERS[partnerId]
  if (!partner) return 'observe'

  // Check if partner has valid credentials
  const hasCredentials = hasValidCredentials(partnerId)

  // IBM is in observe mode (stub data)
  if (partnerId === 'ibm') {
    return 'observe'
  }

  // OAuth2 partners need credentials to be ready
  if (partner.authType === PartnerAuthType.OAuth2) {
    return hasCredentials ? 'ready' : 'pending_oauth'
  }

  // API Key partners need credentials to be ready
  if (partner.authType === PartnerAuthType.APIKey) {
    return hasCredentials ? 'ready' : 'observe'
  }

  // No auth required
  if (partner.authType === PartnerAuthType.None) {
    return 'ready'
  }

  return 'observe'
}

function getStatusLabel(status: 'observe' | 'pending_oauth' | 'ready'): string {
  switch (status) {
    case 'observe':
      return 'Observe'
    case 'pending_oauth':
      return 'Pending OAuth'
    case 'ready':
      return 'Ready'
  }
}

function getStatusColor(status: 'observe' | 'pending_oauth' | 'ready'): string {
  switch (status) {
    case 'observe':
      return 'bg-blue-900 text-blue-300 border-blue-700'
    case 'pending_oauth':
      return 'bg-yellow-900 text-yellow-300 border-yellow-700'
    case 'ready':
      return 'bg-green-900 text-green-300 border-green-700'
  }
}

export default function PartnersPage() {
  // Build partner list with status
  const partnerList: PartnerStatus[] = Object.values(PARTNERS).map(partner => ({
    id: partner.id,
    name: partner.name,
    displayName: partner.displayName,
    description: partner.description,
    category: partner.category,
    logoUrl: partner.logoUrl,
    brandColor: partner.brandColor,
    authType: partner.authType,
    status: getPartnerStatus(partner.id),
    statusLabel: getStatusLabel(getPartnerStatus(partner.id)),
    capabilities: {
      discover: partner.capabilities.discover,
      dealReg: partner.capabilities.dealReg,
      coSell: partner.capabilities.coSell
    },
    projectStatus: partner.status
  }))

  // Sort: active first, then by status (ready > observe > pending_oauth)
  const sortedPartners = partnerList.sort((a, b) => {
    // Active partners first
    if (a.projectStatus === 'active' && b.projectStatus !== 'active') return -1
    if (a.projectStatus !== 'active' && b.projectStatus === 'active') return 1

    // Then by status
    const statusOrder = { ready: 0, observe: 1, pending_oauth: 2 }
    return statusOrder[a.status] - statusOrder[b.status]
  })

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Partner Panel</h1>
          <p className="text-gray-400">
            Manage integrations with partner ecosystems
          </p>
        </div>

        {/* Partner Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPartners.map((partner) => (
            <Link
              key={partner.id}
              href={`/partners/${partner.id}`}
              className="block bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-all hover:shadow-lg"
            >
              {/* Partner Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Partner Logo/Icon */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold"
                    style={{ backgroundColor: partner.brandColor + '20', color: partner.brandColor }}
                  >
                    {partner.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{partner.name}</h2>
                    <p className="text-xs text-gray-500">{partner.category}</p>
                  </div>
                </div>

                {/* Status Pill */}
                <span
                  className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(partner.status)}`}
                >
                  {partner.statusLabel}
                </span>
              </div>

              {/* Partner Description */}
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {partner.description}
              </p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-2 mb-4">
                {partner.capabilities.discover && (
                  <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
                    Discovery
                  </span>
                )}
                {partner.capabilities.dealReg && (
                  <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
                    Deal Reg
                  </span>
                )}
                {partner.capabilities.coSell && (
                  <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded">
                    Co-Sell
                  </span>
                )}
              </div>

              {/* Auth Type */}
              <div className="text-xs text-gray-500">
                Auth: {partner.authType === PartnerAuthType.OAuth2 ? 'OAuth 2.0' : partner.authType === PartnerAuthType.APIKey ? 'API Key' : 'None'}
              </div>

              {/* Project Status Badge */}
              {partner.projectStatus !== 'active' && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <span className={`text-xs px-2 py-1 rounded ${
                    partner.projectStatus === 'beta'
                      ? 'bg-purple-900 text-purple-300'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {partner.projectStatus === 'beta' ? 'Beta' : 'Coming Soon'}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-12 bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-3">Status Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-xs px-3 py-1 rounded-full border bg-blue-900 text-blue-300 border-blue-700">
                Observe
              </span>
              <p className="text-gray-400">
                Stub data mode. Discovering opportunities without real API access.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs px-3 py-1 rounded-full border bg-yellow-900 text-yellow-300 border-yellow-700">
                Pending OAuth
              </span>
              <p className="text-gray-400">
                Credentials required. Configure OAuth to enable live access.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs px-3 py-1 rounded-full border bg-green-900 text-green-300 border-green-700">
                Ready
              </span>
              <p className="text-gray-400">
                Fully configured. Live API access enabled.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/partners/ibm"
            className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors"
          >
            View IBM Opportunities
          </Link>
          <button
            className="px-6 py-3 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
            disabled
          >
            Configure Partners
          </button>
        </div>
      </div>
    </div>
  )
}
