'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface OnboardingStatus {
  isComplete: boolean
  missingSteps: string[]
  hasNotionSetup: boolean
  hasInstantlySetup: boolean
  hasTwilioSetup: boolean
  canSendEmails: boolean
  canSendSMS: boolean
  usingWellsStack: boolean
}

interface GTMOnboardingProps {
  onComplete?: () => void
  showHeader?: boolean
}

export default function GTMOnboarding({ onComplete, showHeader = true }: GTMOnboardingProps) {
  const { user } = useUser()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOnboardingStatus()
  }, [user])

  const loadOnboardingStatus = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/gtm/onboarding-status')

      if (!response.ok) {
        throw new Error('Failed to load onboarding status')
      }

      const data = await response.json()
      setStatus(data)

      if (data.isComplete && onComplete) {
        onComplete()
      }
    } catch (err: any) {
      console.error('Error loading onboarding status:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#575757]">Loading setup status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-sm p-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-red-900 mb-1">Error Loading Setup Status</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadOnboardingStatus}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-sm p-6 text-center">
        <p className="text-sm text-[#575757]">Unable to load setup status. Please try refreshing the page.</p>
      </div>
    )
  }

  const progressPercentage = [
    status.hasNotionSetup,
    status.hasInstantlySetup || status.usingWellsStack,
  ].filter(Boolean).length / 2 * 100

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200">
      {showHeader && (
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-2xl font-serif text-[#183b6d] mb-2">GTM System Setup</h2>
          <p className="text-sm text-[#575757]">
            Connect your tools to start finding customers with AI
          </p>
        </div>
      )}

      <div className="p-6">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#183b6d]">Setup Progress</span>
            <span className="text-sm font-medium text-[#183b6d]">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-[#dba63f] transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        {status.isComplete ? (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-green-900 mb-1">You're all set!</h3>
                <p className="text-sm text-green-700">
                  Your GTM system is ready. You can now create campaigns and find customers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Almost there!</h3>
                <p className="text-sm text-blue-700">
                  Complete the steps below to start generating leads. Takes about 2 minutes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-4">
          {/* Step 1: Notion */}
          <div className={`border-2 rounded-sm p-5 transition-all ${
            status.hasNotionSetup
              ? 'border-green-200 bg-green-50'
              : 'border-[#dba63f] bg-[#dba63f]/5'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                status.hasNotionSetup ? 'bg-green-100' : 'bg-[#dba63f]/20'
              }`}>
                {status.hasNotionSetup ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold text-[#dba63f]">1</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                  Connect Notion
                  {status.hasNotionSetup && (
                    <span className="ml-2 text-sm font-normal text-green-600">✓ Connected</span>
                  )}
                </h3>
                <p className="text-sm text-[#575757] mb-3">
                  {status.hasNotionSetup
                    ? 'Your Notion database is connected and ready for ICP analysis.'
                    : 'Notion stores your deals so Wells AI can analyze your Ideal Customer Profile and find similar prospects.'}
                </p>
                {!status.hasNotionSetup && (
                  <Link
                    href="/settings/gtm"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#183b6d] text-white text-sm rounded-sm hover:bg-[#0d2545] transition-colors"
                  >
                    Configure Notion
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Instantly OR Wells Stack */}
          <div className={`border-2 rounded-sm p-5 transition-all ${
            status.hasInstantlySetup || status.usingWellsStack
              ? 'border-green-200 bg-green-50'
              : 'border-[#dba63f] bg-[#dba63f]/5'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                status.hasInstantlySetup || status.usingWellsStack ? 'bg-green-100' : 'bg-[#dba63f]/20'
              }`}>
                {status.hasInstantlySetup || status.usingWellsStack ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold text-[#dba63f]">2</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                  Email Platform
                  {status.hasInstantlySetup && (
                    <span className="ml-2 text-sm font-normal text-green-600">✓ Using your Instantly account</span>
                  )}
                  {status.usingWellsStack && (
                    <span className="ml-2 text-sm font-normal text-green-600">✓ Using Wells AI Stack</span>
                  )}
                </h3>
                <p className="text-sm text-[#575757] mb-3">
                  {status.hasInstantlySetup
                    ? 'Your Instantly account is connected for sending emails and accessing 200M+ leads.'
                    : status.usingWellsStack
                    ? 'You are using the Wells AI GTM stack (FREE - we only charge 0.33% on deals you close).'
                    : 'Choose between connecting your own Instantly account or using the Wells AI GTM stack (100% FREE - we only charge 0.33% on deals you close).'}
                </p>
                {!status.hasInstantlySetup && !status.usingWellsStack && (
                  <div className="flex gap-3">
                    <Link
                      href="/settings/gtm"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#183b6d] text-white text-sm rounded-sm hover:bg-[#0d2545] transition-colors"
                    >
                      Connect Instantly
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <Link
                      href="/settings/gtm"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#dba63f] text-white text-sm rounded-sm hover:bg-[#c89430] transition-colors"
                    >
                      Get Wells AI Stack (FREE)
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Twilio (Optional) */}
          <div className={`border-2 rounded-sm p-5 transition-all ${
            status.hasTwilioSetup
              ? 'border-green-200 bg-green-50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                status.hasTwilioSetup ? 'bg-green-100' : 'bg-gray-200'
              }`}>
                {status.hasTwilioSetup ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm text-gray-500">Optional</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-[#183b6d] mb-1">
                  Connect Twilio (Optional)
                  {status.hasTwilioSetup && (
                    <span className="ml-2 text-sm font-normal text-green-600">✓ Connected</span>
                  )}
                </h3>
                <p className="text-sm text-[#575757] mb-3">
                  {status.hasTwilioSetup
                    ? 'Twilio is connected for SMS messaging to existing relationships.'
                    : 'Add Twilio to send SMS messages to prospects you already have a relationship with. Cold SMS is blocked for compliance.'}
                </p>
                {!status.hasTwilioSetup && (
                  <Link
                    href="/settings/gtm"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-sm hover:bg-gray-100 transition-colors"
                  >
                    Configure Twilio
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        {status.isComplete && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="px-8 py-3 bg-[#dba63f] text-white font-medium text-sm rounded-sm hover:bg-[#c89430] transition-colors"
            >
              Start Finding Customers
            </Link>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-[#183b6d] mb-3">Need Help?</h4>
          <div className="space-y-2 text-sm text-[#575757]">
            <p>
              <strong>Notion:</strong> We use your Deals database to understand your Ideal Customer Profile
            </p>
            <p>
              <strong>Instantly:</strong> Provides email sending infrastructure and access to 200M+ leads
            </p>
            <p>
              <strong>Wells AI Stack:</strong> All-in-one solution if you don't have Instantly. 100% FREE - we only make money (0.33% fee) when you close deals
            </p>
            <p>
              <strong>Twilio:</strong> Optional SMS sending for existing relationships only (no cold SMS)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
