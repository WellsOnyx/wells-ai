'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  usePaymentDetails,
  useClaimPayment,
  useFormatCurrency,
} from '@/lib/viral/hooks';

export default function ClaimPaymentPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;

  const { payment, loading: loadingDetails, error: detailsError } = usePaymentDetails(paymentId);
  const { claimPayment, loading: claiming, error: claimError } = useClaimPayment();
  const { formatUSD } = useFormatCurrency();

  const [claimResult, setClaimResult] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);

  const handleClaim = async () => {
    const result = await claimPayment(
      paymentId,
      email || undefined,
      phone || undefined
    );

    if (result.success) {
      setClaimResult(result);
    }
  };

  // Loading state
  if (loadingDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (detailsError || !payment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Not Found</h1>
          <p className="text-gray-400 mb-6">
            {detailsError || 'This payment link is invalid or has expired.'}
          </p>
          <a
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // Success - Payment claimed
  if (claimResult?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold mb-3">Payment Claimed!</h1>
              <p className="text-gray-400 text-lg">
                Welcome to Wells - Your payment is now in your wallet
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-8 mb-8">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold mb-2">
                  {formatUSD(claimResult.claimed.amount)}
                </div>
                <div className="text-gray-400">Added to your wallet</div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-400 mb-1">Your Wallet Address</div>
                <div className="font-mono text-sm text-white break-all">
                  {claimResult.claimed.wallet}
                </div>
              </div>

              {claimResult.claimed.memo && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Memo</div>
                  <div className="text-white">{claimResult.claimed.memo}</div>
                </div>
              )}
            </div>

            <div className="bg-gray-900/50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">What's Next?</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Credit Available</h3>
                    <p className="text-gray-400 text-sm">
                      You've been pre-approved for{' '}
                      <strong className="text-green-400">
                        {formatUSD(claimResult.next_steps?.credit_available || 0)}
                      </strong>{' '}
                      in credit based on this transaction.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Invite & Earn</h3>
                    <p className="text-gray-400 text-sm">
                      Earn <strong className="text-purple-400">0.1%</strong> on every payment
                      you send. Build your network and earn passive income!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Instant Payments</h3>
                    <p className="text-gray-400 text-sm">
                      Send money to anyone, anywhere. They don't need a Wells account to receive
                      payments.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/viral/send"
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-lg font-semibold text-center hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                Send Your First Payment
              </a>
              <a
                href="/viral/history"
                className="flex-1 bg-gray-700 text-white py-4 rounded-lg font-semibold text-center hover:bg-gray-600 transition-colors"
              >
                View Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Payment already claimed
  if (payment.payment.status === 'claimed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Already Claimed</h1>
          <p className="text-gray-400 mb-6">
            This payment has already been claimed. The funds are in the recipient's wallet.
          </p>
          <a
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // Payment expired
  if (payment.payment.status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Expired</h1>
          <p className="text-gray-400 mb-6">
            This payment link expired on{' '}
            {new Date(payment.payment.expires_at).toLocaleDateString()}.
          </p>
          <a
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // Main claim flow - payment is pending and claimable
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            You've Got Money!
          </h1>
          <p className="text-gray-400 text-lg">
            Someone sent you a payment. Claim it now to activate your Wells wallet.
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-6">
          <div className="text-center mb-8">
            <div className="text-6xl font-bold mb-3 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              {formatUSD(payment.payment.amount)}
            </div>
            <div className="text-gray-400">Waiting for you to claim</div>
          </div>

          {payment.payment.memo && (
            <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-400 mb-1">Message</div>
              <div className="text-white">{payment.payment.memo}</div>
            </div>
          )}

          {payment.payment.from_company && (
            <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-400 mb-1">From</div>
              <div className="text-white font-semibold">{payment.payment.from_company}</div>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">What Happens When You Claim?</h3>
            <ul className="space-y-2 text-blue-200 text-sm">
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Instant wallet creation (no signup required)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Funds appear in your wallet immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Pre-approved for credit line (based on this payment)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Start sending payments and earning 0.1% on each one</span>
              </li>
            </ul>
          </div>

          {claimError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{claimError}</p>
            </div>
          )}

          {showContactForm && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-500"
                />
              </div>

              <p className="text-gray-400 text-xs">
                Providing contact info is optional but helps us notify you about future payments.
              </p>
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-green-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {claiming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Claiming...
              </span>
            ) : (
              'Claim Payment Now'
            )}
          </button>

          {!showContactForm && (
            <button
              onClick={() => setShowContactForm(true)}
              className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors"
            >
              + Add contact info (optional)
            </button>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-500 text-sm">
              Expires on{' '}
              {new Date(payment.payment.expires_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <h2 className="text-lg font-semibold mb-3">Why Wells?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">0 fees</div>
              <div className="text-gray-400">For receiving payments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">Instant</div>
              <div className="text-gray-400">No waiting, no banks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">Earn</div>
              <div className="text-gray-400">0.1% on every payment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
