// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GrainLenderDashboard() {
  const [lenderId, setLenderId] = useState('');
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('overview');

  const loadDashboard = async () => {
    if (!lenderId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/grain-market/earnings?action=performance&lender_id=${lenderId}`);
      const data = await res.json();
      
      if (data.success) {
        setPerformance(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error loading dashboard: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const pausePool = async (poolId) => {
    try {
      const res = await fetch(`/api/grain-market/pool/${poolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender_id: lenderId, status: 'paused' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Pool paused successfully');
        loadDashboard();
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const activatePool = async (poolId) => {
    try {
      const res = await fetch(`/api/grain-market/pool/${poolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender_id: lenderId, status: 'active' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Pool activated successfully');
        loadDashboard();
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Lender Dashboard</h1>
          
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter your lender ID or email"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={lenderId}
              onChange={(e) => setLenderId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadDashboard()}
            />
            <button
              onClick={loadDashboard}
              disabled={!lenderId || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Dashboard'}
            </button>
          </div>

          {performance && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                  <div className="text-sm text-blue-700 mb-1">Total GRAIN</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {performance.performance.total_grain?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                  <div className="text-sm text-green-700 mb-1">In Use</div>
                  <div className="text-2xl font-bold text-green-900">
                    {performance.performance.grain_in_use?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                  <div className="text-sm text-purple-700 mb-1">Lifetime Earnings</div>
                  <div className="text-2xl font-bold text-purple-900">
                    ${performance.performance.lifetime_earnings?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6">
                  <div className="text-sm text-amber-700 mb-1">Loans Backed</div>
                  <div className="text-2xl font-bold text-amber-900">
                    {performance.performance.loans_backed || 0}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mb-6 border-b">
                <button
                  onClick={() => setView('overview')}
                  className={`px-4 py-2 font-medium ${view === 'overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  Pools
                </button>
                <button
                  onClick={() => setView('matches')}
                  className={`px-4 py-2 font-medium ${view === 'matches' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  Active Matches
                </button>
                <button
                  onClick={() => setView('earnings')}
                  className={`px-4 py-2 font-medium ${view === 'earnings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                  Earnings History
                </button>
              </div>

              {view === 'overview' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Your Lending Pools</h2>
                    <Link href="/grain-market/lend" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Create New Pool
                    </Link>
                  </div>
                  {performance.pools.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No pools yet</p>
                  ) : (
                    performance.pools.map(pool => (
                      <div key={pool.id} className="border rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="font-semibold text-lg">{pool.annual_rate}% APR</div>
                            <div className="text-sm text-gray-600">Status: <span className={pool.status === 'active' ? 'text-green-600' : 'text-gray-600'}>{pool.status}</span></div>
                          </div>
                          <div className="flex gap-2">
                            {pool.status === 'active' ? (
                              <button onClick={() => pausePool(pool.id)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                                Pause
                              </button>
                            ) : (
                              <button onClick={() => activatePool(pool.id)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Total</div>
                            <div className="font-semibold">{pool.grain_amount.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Available</div>
                            <div className="font-semibold text-green-600">{pool.grain_available.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Locked</div>
                            <div className="font-semibold text-blue-600">{pool.grain_locked.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Earnings</div>
                            <div className="font-semibold text-purple-600">${pool.total_earnings.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {view === 'matches' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Active Backing Matches</h2>
                  {performance.active_matches.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No active matches</p>
                  ) : (
                    performance.active_matches.map(match => (
                      <div key={match.id} className="border rounded-lg p-6">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-gray-600">Loan ID</div>
                            <div className="font-semibold">{match.loan_id.substring(0, 8)}...</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">GRAIN Backed</div>
                            <div className="font-semibold">{match.grain_backed.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Earnings Paid</div>
                            <div className="font-semibold text-green-600">${match.total_earnings_paid.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {view === 'earnings' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Earnings History</h2>
                  {performance.earnings_history.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No earnings yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Loan Payment</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Your Earnings</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rate</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {performance.earnings_history.map(earning => (
                            <tr key={earning.id}>
                              <td className="px-4 py-3 text-sm">{new Date(earning.payment_date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm">${earning.loan_payment_amount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">${earning.lender_earnings_amount.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm">{earning.earnings_rate}%</td>
                              <td className="px-4 py-3 text-sm">{earning.days_backed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
