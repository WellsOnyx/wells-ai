'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'

interface DashboardData {
  accountId: string
  isComplete: boolean
  earnings: {
    available: number
    pending: number
  }
  recentTransfers: Array<{
    id: string
    amount: number
    created: number
    description: string
  }>
  upcomingPayout?: {
    amount: number
    arrival_date: number
  }
  payoutSchedule: string
}

export default function SellerDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Handle URL parameters (success/error messages)
  useEffect(() => {
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')

    if (success === 'onboarding_complete') {
      alert('Stripe Connect onboarding completed successfully! You can now receive payments.')
      // Remove query params
      router.replace('/seller/dashboard')
    }

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        onboarding_incomplete: 'Onboarding not complete. Please finish the process.',
        no_account_id: 'No Stripe account found. Please start onboarding.',
        refresh_failed: 'Failed to refresh onboarding link. Please try again.',
        return_handler_failed: 'An error occurred. Please contact support.',
      }
      setError(errorMessages[errorParam] || 'An unknown error occurred.')
    }
  }, [searchParams, router])

  // Load dashboard data
  useEffect(() => {
    if (!isLoaded || !user) return

    const loadDashboard = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if user has completed Stripe Connect onboarding
        const stripeConnectAccountId = user.publicMetadata?.stripeConnectAccountId as string | undefined
        const stripeConnectComplete = user.publicMetadata?.stripeConnectComplete as boolean

        if (!stripeConnectAccountId || !stripeConnectComplete) {
          // User hasn't completed onboarding
          setDashboardData(null)
          setLoading(false)
          return
        }

        // User has completed onboarding - fetch dashboard data
        // In production, you'd call an API endpoint here that fetches:
        // - Balance (available + pending)
        // - Recent transfers
        // - Upcoming payout
        // For now, we'll show a placeholder

        // TODO: Create /api/stripe/connect/stats endpoint
        const mockData: DashboardData = {
          accountId: stripeConnectAccountId,
          isComplete: stripeConnectComplete,
          earnings: {
            available: 0,
            pending: 0,
          },
          recentTransfers: [],
          payoutSchedule: 'Daily',
        }

        setDashboardData(mockData)
        setLoading(false)
      } catch (err: any) {
        console.error('Error loading dashboard:', err)
        setError(err.message || 'Failed to load dashboard')
        setLoading(false)
      }
    }

    loadDashboard()
  }, [isLoaded, user])

  const handleStartOnboarding = async () => {
    try {
      setOnboarding(true)
      setError(null)

      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create onboarding link')
      }

      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl
    } catch (err: any) {
      console.error('Error starting onboarding:', err)
      setError(err.message || 'Failed to start onboarding')
      setOnboarding(false)
    }
  }

  const handleOpenDashboard = async () => {
    try {
      const response = await fetch('/api/stripe/connect/dashboard', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate dashboard link')
      }

      // Open Stripe Express Dashboard in new tab
      window.open(data.dashboardUrl, '_blank')
    } catch (err: any) {
      console.error('Error opening dashboard:', err)
      setError(err.message || 'Failed to open dashboard')
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/sign-in')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Seller Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your earnings and payouts</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex text-red-400 hover:text-red-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Not Onboarded State */}
        {!dashboardData && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">Set Up Payments</h2>
            <p className="mt-2 text-gray-600 max-w-md mx-auto">
              Complete your Stripe Connect onboarding to start receiving payments from buyers.
              It only takes a few minutes.
            </p>
            <div className="mt-8">
              <button
                onClick={handleStartOnboarding}
                disabled={onboarding}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {onboarding ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  'Complete Stripe Onboarding'
                )}
              </button>
            </div>
            <div className="mt-6 text-sm text-gray-500">
              <p>Powered by Stripe Connect</p>
            </div>
          </div>
        )}

        {/* Onboarded State */}
        {dashboardData && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Available Balance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Available Balance</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      ${(dashboardData.earnings.available / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Ready for payout</p>
              </div>

              {/* Pending Balance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      ${(dashboardData.earnings.pending / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Processing</p>
              </div>

              {/* Payout Schedule */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Payout Schedule</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{dashboardData.payoutSchedule}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Automatic payouts</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Your Account</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleOpenDashboard}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Stripe Dashboard
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                View detailed transaction history, manage payouts, update banking information, and more in your Stripe Express Dashboard.
              </p>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
              {dashboardData.recentTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="mt-4 text-gray-600">No transactions yet</p>
                  <p className="mt-2 text-sm text-gray-500">Your transactions will appear here once you start receiving payments.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.recentTransfers.map((transfer) => (
                        <tr key={transfer.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(transfer.created * 1000).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {transfer.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                            +${(transfer.amount / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
