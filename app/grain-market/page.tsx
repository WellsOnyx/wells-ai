// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GrainMarketPage() {
  const [stats, setStats] = useState(null);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      const statsRes = await fetch('/api/grain-market/earnings?action=stats');
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.stats);

      const poolsRes = await fetch('/api/grain-market/pool?status=active');
      const poolsData = await poolsRes.json();
      if (poolsData.success) setPools(poolsData.pools);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">GRAIN Lending Market</h1>
          <div className="mt-4 flex gap-3">
            <Link href="/grain-market/dashboard" className="px-4 py-2 border rounded-lg">Dashboard</Link>
            <Link href="/grain-market/lend" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Lend GRAIN</Link>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm text-gray-600">Total Pooled</div>
            <div className="text-2xl font-bold">{stats?.total_grain_pooled || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm text-gray-600">Active Pools</div>
            <div className="text-2xl font-bold text-blue-600">{stats?.active_pools || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm text-gray-600">Avg APR</div>
            <div className="text-2xl font-bold text-green-600">{stats?.avg_rate?.toFixed(2) || 0}%</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-sm text-gray-600">Total Earnings</div>
            <div className="text-2xl font-bold text-purple-600">{stats?.total_platform_earnings || 0}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-8">
          <h2 className="text-2xl font-bold mb-6">Active Pools</h2>
          {pools.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No pools available</p>
          ) : (
            <div className="space-y-4">
              {pools.map(p => (
                <div key={p.id} className="border rounded-lg p-6">
                  <div className="flex justify-between">
                    <div><strong>{p.lender_name || 'Anonymous'}</strong></div>
                    <div className="text-2xl font-bold text-green-600">{p.annual_rate}%</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>Available: {p.grain_available}</div>
                    <div>Term: {p.min_term_months}-{p.max_term_months} mo</div>
                    <div>Max LTV: {p.max_ltv}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
