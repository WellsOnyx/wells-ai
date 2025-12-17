'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  Network,
  Users,
  ChevronDown,
  ChevronRight,
  Loader2,
  DollarSign,
} from 'lucide-react'
import { NetworkTreeResponse, formatUsd } from '@/lib/attribution/types'

interface TreeNodeProps {
  node: {
    userId: string
    displayName?: string
    email?: string
    networkSize: number
    earnings: number
    children?: TreeNodeProps['node'][]
  }
  level: number
}

function TreeNode({ node, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children && node.children.length > 0

  const levelColors = {
    1: 'border-purple-500 bg-purple-500/10',
    2: 'border-blue-500 bg-blue-500/10',
    3: 'border-green-500 bg-green-500/10',
    4: 'border-orange-500 bg-orange-500/10',
  }

  return (
    <div className="ml-4">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border ${
          levelColors[level as keyof typeof levelColors] || 'border-gray-500 bg-gray-500/10'
        } mb-2`}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/10 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {node.displayName || node.email || `User ${node.userId.slice(0, 8)}...`}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              level === 1 ? 'bg-purple-500/20 text-purple-400' :
              level === 2 ? 'bg-blue-500/20 text-blue-400' :
              level === 3 ? 'bg-green-500/20 text-green-400' :
              'bg-orange-500/20 text-orange-400'
            }`}>
              L{level}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {node.networkSize} in network
            </span>
            {node.earnings > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <DollarSign className="w-3 h-3" />
                {formatUsd(node.earnings)}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="border-l border-white/10 ml-3 pl-2">
          {node.children!.map((child, idx) => (
            <TreeNode key={`${child.userId}-${idx}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function NetworkTreePage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [data, setData] = useState<NetworkTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNetwork = useCallback(async () => {
    try {
      const res = await fetch('/api/attribution/network')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Failed to fetch network:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchNetwork()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn, fetchNetwork])

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
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Network className="w-6 h-6 text-purple-400" />
                Your Network Tree
              </h1>
              <p className="text-gray-400 mt-1">
                Visualize your 4-level attribution network
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{data?.stats.byLevel.l1 || 0}</div>
            <div className="text-sm text-purple-400">L1 Direct</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{data?.stats.byLevel.l2 || 0}</div>
            <div className="text-sm text-blue-400">L2</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{data?.stats.byLevel.l3 || 0}</div>
            <div className="text-sm text-green-400">L3</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{data?.stats.byLevel.l4 || 0}</div>
            <div className="text-sm text-orange-400">L4</div>
          </div>
        </div>

        {/* Network Tree */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">
                {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'Y'}
              </span>
            </div>
            <div>
              <div className="font-semibold text-lg">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.emailAddresses?.[0]?.emailAddress || 'You'}
              </div>
              <div className="text-sm text-gray-400">
                Total network reach: {data?.stats.totalReach || 0} people
              </div>
            </div>
          </div>

          {data?.tree.level1.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Your network is empty</p>
              <Link
                href="/attribution/connections"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                Add Connections
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {data?.tree.level1.map((node, idx) => (
                <TreeNode key={`${node.userId}-${idx}`} node={node} level={1} />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>L1 Direct</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>L2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>L3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>L4</span>
          </div>
        </div>
      </div>
    </div>
  )
}
