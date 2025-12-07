'use client';

/**
 * Credit Application Page
 * Wells AI: Instant credit approval
 */

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface DecisionResult {
  approved: boolean;
  approvedAmount: number;
  apr: number;
  creditScore: number;
  grade: string;
  riskTier: string;
  breakdown: any;
  positiveFactors: string[];
  negativeFactors: string[];
  rejectionReason?: string;
  conditions?: string[];
}

export default function CreditApplicationPage() {
  const [userId] = useState('demo-user-123'); // Replace with actual auth
  const [step, setStep] = useState<'intro' | 'connect' | 'decision' | 'activate'>('intro');
  const [loading, setLoading] = useState(false);

  // Application state
  const [applicationId, setApplicationId] = useState<string>('');
  const [plaidLinkToken, setPlaidLinkToken] = useState<string>('');
  const [plaidPublicToken, setPlaidPublicToken] = useState<string>('');
  const [requestedAmount, setRequestedAmount] = useState<number>(50000);
  const [connectAccounting, setConnectAccounting] = useState(false);

  // Decision state
  const [decision, setDecision] = useState<DecisionResult | null>(null);

  // Plaid Link
  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: (public_token) => {
      setPlaidPublicToken(public_token);
      handleGetDecision(public_token);
    },
    onExit: (err) => {
      if (err) {
        console.error('Plaid error:', err);
        alert('Bank connection failed. Please try again.');
      }
      setLoading(false);
    },
  });

  // Start application
  const handleStartApplication = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/credit/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          requestedAmount,
          connectAccounting,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setApplicationId(data.applicationId);
        setPlaidLinkToken(data.plaidLinkToken);
        setStep('connect');
      } else {
        alert('Failed to start application');
      }
    } catch (error) {
      console.error('Error starting application:', error);
      alert('Failed to start application');
    } finally {
      setLoading(false);
    }
  };

  // Open Plaid Link when ready
  useEffect(() => {
    if (plaidReady && step === 'connect') {
      openPlaid();
    }
  }, [plaidReady, step, openPlaid]);

  // Get instant decision
  const handleGetDecision = async (publicToken: string) => {
    setLoading(true);
    setStep('decision');

    try {
      const response = await fetch('/api/credit/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          plaidPublicToken: publicToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDecision(data.decision);
      } else {
        alert('Failed to get decision');
      }
    } catch (error) {
      console.error('Error getting decision:', error);
      alert('Failed to get decision');
    } finally {
      setLoading(false);
    }
  };

  // Activate credit line
  const handleActivate = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/credit/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          autoPayEnabled: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = '/credit/dashboard';
      } else {
        alert('Failed to activate credit line');
      }
    } catch (error) {
      console.error('Error activating credit line:', error);
      alert('Failed to activate credit line');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Wells AI Credit Line
          </h1>
          <p className="text-xl text-gray-600">
            Instant approval. Zero paperwork. Credit that grows with you.
          </p>
        </div>

        {/* Intro Step */}
        {step === 'intro' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Get Your Credit Decision in 60 Seconds
            </h2>

            {/* Benefits */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Instant Decision</h3>
                <p className="text-sm text-gray-600">Know in seconds if you're approved</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Competitive Rates</h3>
                <p className="text-sm text-gray-600">APRs as low as 6.99%</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Smart Risk</h3>
                <p className="text-sm text-gray-600">We see your transactions, lower your rate</p>
              </div>
            </div>

            {/* Amount Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How much credit do you need?
              </label>
              <input
                type="range"
                min="5000"
                max="500000"
                step="5000"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-center mt-2">
                <span className="text-4xl font-bold text-indigo-600">
                  ${requestedAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Optional: Connect Accounting */}
            <div className="mb-8">
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={connectAccounting}
                  onChange={(e) => setConnectAccounting(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Connect accounting software for better terms (optional)
                </span>
              </label>
            </div>

            {/* CTA */}
            <button
              onClick={handleStartApplication}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Starting...' : 'Get Instant Decision'}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Checking your rate won't impact your credit score
            </p>
          </div>
        )}

        {/* Connect Step */}
        {step === 'connect' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Connecting Your Bank Account
            </h2>
            <p className="text-gray-600 mb-6">
              Securely link your bank account via Plaid to get instant approval
            </p>
          </div>
        )}

        {/* Decision Step */}
        {step === 'decision' && decision && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {decision.approved ? (
              <>
                {/* Approval */}
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Congratulations! You're Approved
                  </h2>
                  <p className="text-gray-600">Credit Score: {decision.creditScore} ({decision.grade})</p>
                </div>

                {/* Approved Terms */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl">
                    <div className="text-sm text-gray-600 mb-2">Credit Limit</div>
                    <div className="text-4xl font-bold text-indigo-600">
                      ${decision.approvedAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl">
                    <div className="text-sm text-gray-600 mb-2">APR</div>
                    <div className="text-4xl font-bold text-green-600">
                      {decision.apr}%
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="mb-8">
                  <h3 className="font-semibold text-gray-900 mb-4">Score Breakdown</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Cash Flow</span>
                        <span>{decision.breakdown.cashFlowScore}/40</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${(decision.breakdown.cashFlowScore / 40) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Revenue Growth</span>
                        <span>{decision.breakdown.revenueGrowthScore}/20</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${(decision.breakdown.revenueGrowthScore / 20) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Wells History</span>
                        <span>{decision.breakdown.wellsHistoryScore}/20</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${(decision.breakdown.wellsHistoryScore / 20) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Positive Factors */}
                {decision.positiveFactors.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-semibold text-gray-900 mb-3">Positive Factors</h3>
                    <ul className="space-y-2">
                      {decision.positiveFactors.map((factor, i) => (
                        <li key={i} className="flex items-start text-sm text-gray-700">
                          <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Conditions */}
                {decision.conditions && decision.conditions.length > 0 && (
                  <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Conditions</h3>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {decision.conditions.map((condition, i) => (
                        <li key={i}>• {condition}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Activate Button */}
                <button
                  onClick={handleActivate}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Activating...' : 'Activate My Credit Line'}
                </button>
              </>
            ) : (
              <>
                {/* Rejection */}
                <div className="text-center">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Unable to Approve at This Time
                  </h2>
                  <p className="text-gray-600 mb-8">
                    {decision.rejectionReason || 'We were unable to approve your application at this time.'}
                  </p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && step === 'decision' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Analyzing Your Financials
            </h2>
            <p className="text-gray-600">
              Calculating credit score and terms...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
