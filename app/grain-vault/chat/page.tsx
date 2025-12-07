// @ts-nocheck
'use client'

/**
 * Grain & Vault Chat Page
 * Treasury assistant chat powered by unified chat system
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import UnifiedChat from '@/components/chat/UnifiedChat'

export default function GrainVaultChatPage() {
  const { userId, isLoaded } = useAuth()
  const [treasuryContext, setTreasuryContext] = useState<any>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(true)

  useEffect(() => {
    if (isLoaded && userId) {
      loadTreasuryContext()
    } else if (isLoaded && !userId) {
      setIsLoadingContext(false)
    }
  }, [isLoaded, userId])

  const loadTreasuryContext = async () => {
    try {
      const response = await fetch('/api/grain-vault/account')
      if (response.ok) {
        const data = await response.json()
        setTreasuryContext({
          accountId: data.account?.id,
          companyName: data.account?.companyName,
          grainBalance: data.wallet?.balance || 0,
          creditLine: data.creditLine?.limitAmount || 0,
        })
      }
    } catch (error) {
      console.error('Error loading treasury context:', error)
    } finally {
      setIsLoadingContext(false)
    }
  }

  if (!isLoaded || isLoadingContext) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading treasury assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Treasury Assistant</h1>
              <p className="text-gray-600 mt-1">
                Manage your GRAIN balance, payments, and treasury operations
              </p>
            </div>

            {treasuryContext && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="text-sm text-gray-600">GRAIN Balance</div>
                <div className="text-2xl font-bold text-green-600">
                  {treasuryContext.grainBalance.toLocaleString()}
                </div>
                {treasuryContext.creditLine > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Credit: {treasuryContext.creditLine.toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg" style={{ height: 'calc(100vh - 200px)' }}>
          <UnifiedChat
            product="grainvault"
            journey="treasury"
            treasuryContext={treasuryContext}
            welcomeMessage={
              userId
                ? `Hi! I'm Wells, your treasury assistant. I can help you check your GRAIN balance, send payments, view transactions, and manage your credit line. What would you like to do?`
                : `Hi! I'm Wells, your treasury assistant for Grain & Vault. Please sign in to access your account.`
            }
            placeholder="Ask about balance, send payment, or view transactions..."
            className="h-full"
          />
        </div>
      </div>

      {/* Quick Actions */}
      {userId && treasuryContext && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickAction
              title="Check Balance"
              description="View your current GRAIN balance and credit"
              icon="💰"
            />
            <QuickAction
              title="Send Payment"
              description="Transfer GRAIN to a vendor or partner"
              icon="📤"
            />
            <QuickAction
              title="View Transactions"
              description="See your recent payment history"
              icon="📊"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-500 hover:shadow-md transition-all cursor-pointer">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  )
}
