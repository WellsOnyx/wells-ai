'use client';

import { useState } from 'react';
import { usePaymentHistory, useFormatCurrency, useCopyToClipboard } from '@/lib/viral/hooks';

export default function PaymentHistoryPage() {
  const accountId = 'user_demo_123'; // TODO: Get from auth context
  const { payments, stats, loading, error, refetch } = usePaymentHistory(accountId);
  const { formatUSD } = useFormatCurrency();
  const { copy, copied } = useCopyToClipboard();

  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'claimed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'expired':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading payment history...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Error Loading History</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => refetch()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const activePayments = activeTab === 'sent' ? payments.sent : payments.received;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Payment History
          </h1>
          <p className="text-gray-400 text-lg">
            Track your viral payments and network growth
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Volume Sent</span>
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
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">
              {formatUSD(stats?.total_volume_sent || 0)}
            </div>
            <div className="text-sm text-gray-500">{stats?.total_sent || 0} payments</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Volume Received</span>
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
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">
              {formatUSD(stats?.total_volume_received || 0)}
            </div>
            <div className="text-sm text-gray-500">{stats?.total_received || 0} payments</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Network Size</span>
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
            <div className="text-3xl font-bold mb-1">{stats?.network_enrollments || 0}</div>
            <div className="text-sm text-gray-500">people enrolled</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm font-medium">Referrer Bonus</span>
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-green-400 mb-1">
              {formatUSD(stats?.total_referrer_bonus || 0)}
            </div>
            <div className="text-sm text-green-300/70">earned from network</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-2xl border border-gray-700 border-b-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'sent'
                  ? 'bg-gray-900/50 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sent Payments ({payments.sent.length})
            </button>
            <button
              onClick={() => setActiveTab('received')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'received'
                  ? 'bg-gray-900/50 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Received Payments ({payments.received.length})
            </button>
          </div>
        </div>

        {/* Payments List */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-b-2xl border border-gray-700 border-t-0 overflow-hidden">
          {activePayments.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">No {activeTab} payments yet</h3>
              <p className="text-gray-400 mb-6">
                {activeTab === 'sent'
                  ? 'Start sending viral payments to grow your network'
                  : 'You haven\'t received any payments yet'}
              </p>
              {activeTab === 'sent' && (
                <a
                  href="/viral/send"
                  className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
                >
                  Send Your First Payment
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {activePayments.map((payment) => (
                <div key={payment.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {activeTab === 'sent'
                            ? payment.recipient_email ||
                              payment.recipient_phone ||
                              payment.recipient_company ||
                              'Anonymous'
                            : 'Payment Received'}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {payment.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{formatDate(payment.created_at)}</span>
                        {payment.memo && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-xs">{payment.memo}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold mb-1">
                        {formatUSD(payment.amount_usdc)}
                      </div>
                      {payment.status === 'claimed' && activeTab === 'sent' && (
                        <div className="text-sm text-green-400">
                          +{formatUSD(payment.referrer_bonus)} bonus
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <button
                    onClick={() =>
                      setExpandedPayment(expandedPayment === payment.id ? null : payment.id)
                    }
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    {expandedPayment === payment.id ? 'Hide' : 'Show'} details
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        expandedPayment === payment.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {expandedPayment === payment.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Payment ID</div>
                          <div className="font-mono text-sm">{payment.id}</div>
                        </div>

                        {activeTab === 'sent' && payment.claim_url && (
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Claim Link</div>
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-sm truncate flex-1">
                                {payment.claim_url}
                              </div>
                              <button
                                onClick={() => copy(payment.claim_url)}
                                className="text-blue-400 hover:text-blue-300 text-xs"
                              >
                                {copied ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Referral Code</div>
                          <div className="font-mono text-sm">{payment.referral_code}</div>
                        </div>

                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Expires</div>
                          <div className="text-sm">
                            {new Date(payment.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {payment.claimed_at && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                          <div className="text-xs text-green-400 mb-1">Claimed</div>
                          <div className="text-sm text-green-300">
                            {new Date(payment.claimed_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/30">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-3">Grow Your Network</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Every payment you send enrolls someone new into Wells. Earn 0.1% on all their future
              payments. Build your network, build passive income.
            </p>
            <a
              href="/viral/send"
              className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Send a Viral Payment
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
