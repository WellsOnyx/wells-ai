'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  Activity,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  FileText,
  Book,
} from 'lucide-react';
import { usePartner, usePartnerStats, usePartnerTransactions, useVolumeData } from '@/lib/partners/hooks';
import { getStoredApiKey, clearApiKey } from '@/lib/partners/auth';

export default function PartnerDashboard() {
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();
  const { stats, loading: statsLoading } = usePartnerStats();
  const { transactions, loading: txLoading } = usePartnerTransactions(10);
  const { volumeData, loading: volumeLoading } = useVolumeData(30);

  useEffect(() => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      router.push('/partners');
    }
  }, [router]);

  const handleLogout = () => {
    clearApiKey();
    router.push('/partners');
  };

  if (partnerLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!partner || !stats) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load partner data</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{partner.platform_name}</h1>
              <p className="text-sm text-slate-600">{partner.company_name}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/partners/docs"
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
              >
                <Book className="w-4 h-4" />
                API Docs
              </Link>
              <Link
                href="/partners/settings"
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Total Volume</p>
              <DollarSign className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.total_volume)}</p>
            <p className="text-xs text-slate-500 mt-1">All-time</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Fees Earned</p>
              <TrendingUp className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.fees_earned)}</p>
            <div className="flex items-center mt-1">
              {stats.volume_trend >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
              )}
              <p className={`text-xs ${stats.volume_trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(stats.volume_trend).toFixed(1)}% vs last 30 days
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Transactions</p>
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatNumber(stats.transaction_count)}</p>
            <p className="text-xs text-slate-500 mt-1">All-time</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600">Avg Transaction</p>
              <CreditCard className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(stats.avg_transaction_size)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Per transaction</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Volume Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Volume (Last 30 Days)</h2>
            {volumeLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="h-64">
                {volumeData.length > 0 ? (
                  <div className="h-full flex items-end justify-between gap-1">
                    {volumeData.map((data, idx) => {
                      const maxVolume = Math.max(...volumeData.map((d) => d.volume));
                      const height = maxVolume > 0 ? (data.volume / maxVolume) * 100 : 0;
                      return (
                        <div
                          key={data.date}
                          className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer relative group"
                          style={{ height: `${height}%` }}
                          title={`${data.date}: ${formatCurrency(data.volume)}`}
                        >
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                            {new Date(data.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            <br />
                            {formatCurrency(data.volume)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    No volume data yet
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">API Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-600">Operational</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Uptime</span>
                <span className="text-sm font-medium text-slate-900">99.99%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Avg Response</span>
                <span className="text-sm font-medium text-slate-900">87ms</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Revenue Share</span>
                <span className="text-sm font-medium text-blue-600">
                  {partner.revenue_share_percent}%
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <Link
                  href="/partners/docs"
                  className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center text-sm font-medium"
                >
                  View Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
            <Link href="/partners/transactions" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>

          {txLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                      Your Fee
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">
                        {tx.external_id || tx.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-green-600">
                        {formatCurrency(tx.partner_share)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : tx.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No transactions yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Start integrating to see transactions appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
