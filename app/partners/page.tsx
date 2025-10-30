/**
 * Partner SDK Dashboard
 * Consent & approval UI for partner automations
 */

'use client'

import { useState, useEffect } from 'react'

interface PendingAction {
  id: string
  type: string
  opportunity: {
    name: string
    value: number
    customer: string
  }
  confidence: number
  reasoning: string[]
  status: string
}

interface LearningStats {
  totalActions: number
  approved: number
  rejected: number
  executed: number
  successRate: number
  avgConfidence: number
}

export default function PartnersPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [partner, setPartner] = useState('ibm')
  const [mode, setMode] = useState('observe')
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize SDK
   */
  const initializeSDK = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/partner-sdk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner,
          mode,
          playbooks: ['deal_registration', 'co_sell_request'],
          consent: {
            required: true,
            type: 'action',
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        setInstanceId(data.instanceId)
        // Start polling for updates
        pollStatus(data.instanceId)
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Poll SDK status
   */
  const pollStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/partner-sdk?instanceId=${id}`)
      const data = await response.json()

      if (data.success) {
        setPendingActions(data.pendingActions || [])
        setStats(data.learningStats)

        // Continue polling every 5 seconds
        setTimeout(() => pollStatus(id), 5000)
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }

  /**
   * Approve action
   */
  const approveAction = async (actionId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/partner-sdk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          actionId,
          decision: 'approve',
          approver: {
            userId: 'user_1',
            name: 'Jonah Manning',
            email: 'jonah@wellsonyx.com',
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh pending actions
        if (instanceId) {
          pollStatus(instanceId)
        }
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Reject action
   */
  const rejectAction = async (actionId: string, reason: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/partner-sdk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          actionId,
          decision: 'reject',
          reason,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh pending actions
        if (instanceId) {
          pollStatus(instanceId)
        }
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Stop SDK
   */
  const stopSDK = async () => {
    if (!instanceId) return

    setLoading(true)

    try {
      await fetch(`/api/partner-sdk?instanceId=${instanceId}`, {
        method: 'DELETE',
      })

      setInstanceId(null)
      setPendingActions([])
      setStats(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Partner SDK Dashboard</h1>
        <p className="text-gray-400 mb-8">
          Drop-in automation for partnership ecosystems
        </p>

        {/* Configuration */}
        {!instanceId && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Initialize SDK</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Partner Platform
                </label>
                <select
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                >
                  <option value="ibm">IBM PartnerWorld</option>
                  <option value="cisco">Cisco Partner Network</option>
                  <option value="snowflake">Snowflake Partner Network</option>
                  <option value="freshworks">Freshworks Marketplace</option>
                  <option value="microsoft">Microsoft Partner Network</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                >
                  <option value="observe">Observe (Learn-only)</option>
                  <option value="suggest">Suggest (With approval)</option>
                  <option value="autopilot">Autopilot (Auto-execute approved)</option>
                </select>
              </div>

              <button
                onClick={initializeSDK}
                disabled={loading}
                className="w-full bg-white text-black font-semibold py-3 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting...' : 'Start SDK'}
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        {instanceId && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Status</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Instance: {instanceId}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-400">Observing</span>
                  </div>
                  <button
                    onClick={stopSDK}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Stop
                  </button>
                </div>
              </div>

              {stats && (
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats.totalActions}</div>
                    <div className="text-sm text-gray-400">Total Actions</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-2xl font-bold">
                      {Math.round(stats.successRate * 100)}%
                    </div>
                    <div className="text-sm text-gray-400">Success Rate</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
                    <div className="text-sm text-gray-400">Avg Confidence</div>
                  </div>
                </div>
              )}
            </div>

            {/* Pending Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                Suggested Actions ({pendingActions.length})
              </h2>

              {pendingActions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">👀</div>
                  <p>Observing partner ecosystem...</p>
                  <p className="text-sm mt-2">Actions will appear when opportunities are discovered</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingActions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold">
                              {action.type === 'deal_reg'
                                ? 'Register Deal'
                                : action.type === 'co_sell'
                                ? 'Co-Sell Request'
                                : action.type}
                            </h3>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                action.confidence >= 80
                                  ? 'bg-green-900 text-green-300'
                                  : action.confidence >= 60
                                  ? 'bg-yellow-900 text-yellow-300'
                                  : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {action.confidence}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {action.opportunity.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            ${action.opportunity.value.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {action.opportunity.customer}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-sm text-gray-400 mb-2">Reasoning:</div>
                        <ul className="text-sm space-y-1">
                          {action.reasoning.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-gray-500">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => approveAction(action.id)}
                          disabled={loading}
                          className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Approve & Execute
                        </button>
                        <button
                          onClick={() =>
                            rejectAction(action.id, 'Not the right timing')
                          }
                          disabled={loading}
                          className="flex-1 bg-gray-700 text-white py-2 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                        <button
                          disabled={loading}
                          className="px-4 bg-gray-700 text-white rounded hover:bg-gray-600"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-red-900 border border-red-700 rounded-lg p-4">
            <div className="font-semibold text-red-200">Error</div>
            <div className="text-sm text-red-300 mt-1">{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}
