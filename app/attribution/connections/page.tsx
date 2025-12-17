'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  UserPlus,
  Check,
  X,
  Trash2,
  Loader2,
  Mail,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { ConnectionsResponse, MAX_CONNECTIONS } from '@/lib/attribution/types'

export default function ConnectionsPage() {
  const { isLoaded, isSignedIn } = useUser()
  const [data, setData] = useState<ConnectionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/attribution/connections')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchConnections()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchConnections])

  const handleAccept = async (connectionId: string) => {
    setActionLoading(connectionId)
    try {
      const res = await fetch(`/api/attribution/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      if (res.ok) {
        fetchConnections()
      }
    } catch (error) {
      console.error('Failed to accept:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (connectionId: string) => {
    setActionLoading(connectionId)
    try {
      const res = await fetch(`/api/attribution/connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      })
      if (res.ok) {
        fetchConnections()
      }
    } catch (error) {
      console.error('Failed to decline:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (connectionId: string) => {
    if (!confirm('Remove this connection?')) return
    setActionLoading(connectionId)
    try {
      const res = await fetch(`/api/attribution/connections/${connectionId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchConnections()
      }
    } catch (error) {
      console.error('Failed to remove:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) {
      setInviteError('Email is required')
      return
    }
    setActionLoading('invite')
    setInviteError('')
    try {
      const res = await fetch('/api/attribution/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: inviteEmail, // In a real app, you'd look up user by email
          targetEmail: inviteEmail,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setShowInviteModal(false)
        setInviteEmail('')
        fetchConnections()
      } else {
        setInviteError(json.error || 'Failed to send invite')
      }
    } catch (error) {
      setInviteError('Failed to send invite')
    } finally {
      setActionLoading(null)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/attribution"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Connections</h1>
              <p className="text-gray-400 mt-1">
                {data?.count || 0} of {MAX_CONNECTIONS} connections
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={data?.remaining === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Connection Limit Warning */}
        {data?.remaining === 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-200">
              You&apos;ve reached the maximum of {MAX_CONNECTIONS} connections. Remove a connection to add new ones.
            </span>
          </div>
        )}

        {/* Pending Requests Received */}
        {data?.pendingRequests.received && data.pendingRequests.received.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Pending Requests ({data.pendingRequests.received.length})
            </h2>
            <div className="space-y-3">
              {data.pendingRequests.received.map((conn) => (
                <div
                  key={conn.connectionId}
                  className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"
                >
                  <div>
                    <div className="font-medium">
                      {conn.displayName || conn.email || 'Unknown User'}
                    </div>
                    {conn.email && (
                      <div className="text-sm text-gray-400">{conn.email}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(conn.connectionId)}
                      disabled={actionLoading === conn.connectionId}
                      className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition"
                    >
                      {actionLoading === conn.connectionId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDecline(conn.connectionId)}
                      disabled={actionLoading === conn.connectionId}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Connections */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Active Connections ({data?.connections.length || 0})
          </h2>
          {data?.connections.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-xl">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No connections yet</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                Invite your first connection
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.connections.map((conn) => (
                <div
                  key={conn.connectionId}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-400 font-semibold">
                        {(conn.displayName || conn.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {conn.displayName || conn.email || 'Unknown User'}
                      </div>
                      {conn.email && conn.displayName && (
                        <div className="text-sm text-gray-400">{conn.email}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(conn.connectionId)}
                    disabled={actionLoading === conn.connectionId}
                    className="p-2 text-gray-500 hover:text-red-400 transition"
                  >
                    {actionLoading === conn.connectionId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Sent */}
        {data?.pendingRequests.sent && data.pendingRequests.sent.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              Sent Requests ({data.pendingRequests.sent.length})
            </h2>
            <div className="space-y-3">
              {data.pendingRequests.sent.map((conn) => (
                <div
                  key={conn.connectionId}
                  className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                >
                  <div>
                    <div className="font-medium">
                      {conn.displayName || conn.email || 'Unknown User'}
                    </div>
                    <div className="text-sm text-blue-400">Pending</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-xl font-bold mb-4">Invite Connection</h2>
            <p className="text-gray-400 mb-6">
              Enter the email of the person you want to connect with.
            </p>
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            {inviteError && (
              <p className="text-red-400 text-sm mt-2">{inviteError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={actionLoading === 'invite'}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center justify-center gap-2"
              >
                {actionLoading === 'invite' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Send Invite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
