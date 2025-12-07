'use client';

/**
 * DEPOSIT PAGE
 *
 * User-facing interface for adding funds to Wells AI wallet.
 * Supports card and ACH deposits with Stripe Elements.
 *
 * FLOW:
 * 1. User selects deposit method (card/ACH)
 * 2. Enters amount
 * 3. Completes payment via Stripe Elements
 * 4. Funds convert to USDC and add to balance
 * 5. Float tracking begins automatically
 */

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Load Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ============================================================================
// DEPOSIT FORM
// ============================================================================

function DepositForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/deposit?success=true`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setProcessing(false);
      } else {
        setSucceeded(true);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {succeeded && (
        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
          <p className="text-sm text-green-800">
            Payment successful! Your USDC balance will update shortly.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing || succeeded}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Processing...' : succeeded ? 'Success!' : 'Add Funds'}
      </button>
    </form>
  );
}

// ============================================================================
// MAIN DEPOSIT PAGE
// ============================================================================

export default function DepositPage() {
  const [balance, setBalance] = useState<any>(null);
  const [amount, setAmount] = useState<string>('100');
  const [method, setMethod] = useState<'card' | 'ach'>('card');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [floatMetrics, setFloatMetrics] = useState<any>(null);

  // Load balance on mount
  useEffect(() => {
    loadBalance();
    loadFloatMetrics();
  }, []);

  const loadBalance = async () => {
    try {
      const response = await fetch('/api/payments/balance');
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const loadFloatMetrics = async () => {
    try {
      const response = await fetch('/api/payments/float-metrics');
      const data = await response.json();
      setFloatMetrics(data);
    } catch (error) {
      console.error('Failed to load float metrics:', error);
    }
  };

  const handleCreateIntent = async () => {
    setLoading(true);

    try {
      const amountInCents = Math.round(parseFloat(amount) * 100);

      const response = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCents,
          method,
        }),
      });

      const data = await response.json();

      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        alert('Failed to create payment intent');
      }
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setAmount('100');
    loadBalance();
    loadFloatMetrics();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Add Funds</h1>
          <p className="text-lg text-gray-600">
            Deposit to your Wells AI wallet and start earning yield on payment float
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Deposit Form */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Deposit</h2>

            {!clientSecret ? (
              <div className="space-y-6">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="1"
                      step="1"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      placeholder="100"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    You'll receive {amount} USDC
                  </p>
                </div>

                {/* Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setMethod('card')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        method === 'card'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">💳</div>
                        <div className="font-medium text-gray-900">Card</div>
                        <div className="text-xs text-gray-500">Instant</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setMethod('ach')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        method === 'ach'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">🏦</div>
                        <div className="font-medium text-gray-900">ACH</div>
                        <div className="text-xs text-gray-500">1-3 days</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Continue Button */}
                <button
                  onClick={handleCreateIntent}
                  disabled={loading || !amount || parseFloat(amount) < 1}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Continue'}
                </button>

                {/* Info */}
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>How it works:</strong> Your deposit converts to USDC instantly.
                    When you make payments, the settlement float earns yield which is
                    automatically shared with you.
                  </p>
                </div>
              </div>
            ) : (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#2563eb',
                    },
                  },
                }}
              >
                <DepositForm onSuccess={handleSuccess} />
              </Elements>
            )}
          </div>

          {/* Balance & Float Info */}
          <div className="space-y-6">
            {/* Current Balance */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Current Balance
              </h3>

              {balance ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">USDC Available</div>
                    <div className="text-3xl font-bold text-gray-900">
                      ${balance.usdc.available.toFixed(2)}
                    </div>
                  </div>

                  {balance.usdc.pending > 0 && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Pending</div>
                      <div className="text-xl font-semibold text-gray-600">
                        ${balance.usdc.pending.toFixed(2)}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Deposited</span>
                      <span className="font-medium text-gray-900">
                        ${balance.usd.totalDeposited.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">Total Withdrawn</span>
                      <span className="font-medium text-gray-900">
                        ${balance.usd.totalWithdrawn.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              )}
            </div>

            {/* Float Earnings */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-8 border border-green-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Float Earnings
              </h3>

              {floatMetrics ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Total Earned</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${floatMetrics.totalYieldEarned.toFixed(2)}
                    </div>
                  </div>

                  {floatMetrics.pendingYield > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Pending</div>
                      <div className="text-lg font-semibold text-green-500">
                        ${floatMetrics.pendingYield.toFixed(2)}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-green-200">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Active Float</span>
                      <span className="font-medium text-gray-900">
                        ${floatMetrics.totalFloatAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Current APY</span>
                      <span className="font-medium text-gray-900">
                        {(floatMetrics.currentAPY * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Est. Monthly</span>
                      <span className="font-medium text-green-600">
                        ${floatMetrics.estimatedMonthlyYield.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="h-10 bg-green-200 rounded mb-4"></div>
                  <div className="h-6 bg-green-200 rounded"></div>
                </div>
              )}

              <div className="mt-6 p-4 bg-white bg-opacity-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  Earnings come from deploying payment float to yield strategies
                  during settlement windows. 20% of yield is shared with you.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <a
                  href="/payments/history"
                  className="block w-full text-center rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View Transaction History
                </a>
                <a
                  href="/payments/withdraw"
                  className="block w-full text-center rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Withdraw to Bank
                </a>
                <a
                  href="/settings/payout"
                  className="block w-full text-center rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Setup Bank Account
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
