/**
 * IBM Partner Dashboard
 * View and approve opportunities from IBM PartnerWorld
 */

import { ibmAdapter } from '@/adapters/ibm'
import { OpportunityCard } from './OpportunityCard'

export default async function IBMPartnerPage() {
  // Discover opportunities from IBM (observe mode)
  const opportunities = await ibmAdapter.discover('wells-onyx')

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">IBM PartnerWorld</h1>
              <p className="mt-2 text-sm text-gray-600">
                Observe Mode: Viewing simulated opportunities
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                🔍 Observe Mode
              </span>
              <span className="text-sm text-gray-500">
                {opportunities.length} opportunities
              </span>
            </div>
          </div>
        </div>

        {/* Adapter Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">IBM</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">IBM Partner Adapter</h3>
                <p className="text-xs text-gray-500">Stub mode - Using fixture data</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Pipeline Value</div>
              <div className="text-2xl font-bold text-gray-900">
                ${opportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Opportunities Grid */}
        <div className="space-y-6">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>

        {/* Empty State */}
        {opportunities.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-gray-400 text-5xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
            <p className="text-sm text-gray-500">
              Check back later or sync with IBM PartnerWorld
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
