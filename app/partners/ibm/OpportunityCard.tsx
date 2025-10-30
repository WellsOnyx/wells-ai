'use client'

/**
 * Opportunity Card Component
 * Displays IBM opportunity with approve button
 */

import { Opportunity, OpportunityStage } from '@/lib/opportunity'
import { useState } from 'react'
import { PlaybookType } from '@/lib/playbooks/types'

interface OpportunityCardProps {
  opportunity: Opportunity
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isApproved, setIsApproved] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)

    try {
      // Run playbook (queue for consent)
      const response = await fetch('/api/playbooks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: PlaybookType.DealRegistration,
          partner: 'ibm',
          oppId: opportunity.id,
          params: {
            opportunityId: opportunity.id,
            partnerId: 'ibm',
            dealValue: opportunity.estimatedValue,
            expectedCloseDate: opportunity.expectedCloseDate || '',
            competitorInfo: opportunity.metadata.raw?.competingWith,
            partnerManagerEmail: opportunity.metadata.partnerManagerEmail
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to queue playbook')
      }

      const result = await response.json()
      console.log('✅ Playbook queued:', result)

      setIsApproved(true)
    } catch (error) {
      console.error('❌ Failed to approve:', error)
      alert('Failed to approve opportunity. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  const getStageColor = (stage: OpportunityStage) => {
    switch (stage) {
      case OpportunityStage.Discovery:
        return 'bg-blue-100 text-blue-800'
      case OpportunityStage.Qualified:
        return 'bg-green-100 text-green-800'
      case OpportunityStage.Proposal:
        return 'bg-yellow-100 text-yellow-800'
      case OpportunityStage.Negotiation:
        return 'bg-orange-100 text-orange-800'
      case OpportunityStage.Closed:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {opportunity.title}
            </h3>
            <p className="text-sm text-gray-600">
              {opportunity.companyName}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStageColor(opportunity.stage)}`}>
            {opportunity.stage}
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Deal Value</div>
            <div className="text-lg font-bold text-gray-900">
              ${opportunity.estimatedValue.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Expected Close</div>
            <div className="text-sm font-medium text-gray-900">
              {opportunity.expectedCloseDate || 'TBD'}
            </div>
          </div>
        </div>

        {/* Products */}
        {opportunity.products && opportunity.products.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">Products</div>
            <div className="flex flex-wrap gap-2">
              {opportunity.products.map((product, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {product}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {opportunity.description && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1">Description</div>
            <p className="text-sm text-gray-700 line-clamp-2">
              {opportunity.description}
            </p>
          </div>
        )}

        {/* Competitors */}
        {opportunity.metadata.raw?.competingWith && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1">Competing Against</div>
            <p className="text-sm text-gray-700">
              {opportunity.metadata.raw.competingWith}
            </p>
          </div>
        )}

        {/* Partner Manager */}
        {opportunity.metadata.partnerManagerEmail && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1">IBM Partner Manager</div>
            <div className="text-sm text-gray-700">
              {opportunity.metadata.raw?.partnerManagerName || 'Partner Manager'}
              <span className="text-gray-400 ml-2">
                {opportunity.metadata.partnerManagerEmail}
              </span>
            </div>
          </div>
        )}

        {/* Wells Revenue */}
        {opportunity.wellsOpportunity && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-600 font-medium mb-1">Wells Revenue (33 bps)</div>
                <div className="text-lg font-bold text-green-700">
                  ${opportunity.wellsOpportunity.estimatedWellsRevenue.toLocaleString()}
                </div>
              </div>
              {opportunity.wellsOpportunity.potentialWellsOpportunity && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  Paired Opportunity
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            ID: {opportunity.id}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleApprove}
              disabled={isApproving || isApproved}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isApproved
                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                  : isApproving
                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isApproved ? '✓ Queued for Approval' : isApproving ? 'Queuing...' : 'Approve & Register Deal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
