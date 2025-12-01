'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TierAssets } from '@/app/hooks/useVault';
import { Layers } from 'lucide-react';

interface AssetBreakdownProps {
  tiers: TierAssets[];
  totalAssets: string;
}

const TIER_COLORS = {
  1: '#3b82f6', // blue-500
  2: '#8b5cf6', // purple-500
  3: '#ec4899', // pink-500
  4: '#f59e0b', // amber-500
  5: '#10b981', // green-500
};

export function AssetBreakdown({ tiers, totalAssets }: AssetBreakdownProps) {
  const chartData = tiers.map((tier) => ({
    name: tier.name,
    value: parseFloat(tier.amount),
    percentage: tier.percentage,
    color: TIER_COLORS[tier.tier as keyof typeof TIER_COLORS],
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Layers className="w-5 h-5 text-wells-gold" />
        <h3 className="text-lg font-semibold text-white">Asset Breakdown</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier List */}
        <div className="space-y-3">
          <div className="mb-4">
            <p className="text-sm text-gray-400">Total Vault Assets</p>
            <p className="text-2xl font-bold text-white">${parseFloat(totalAssets).toLocaleString()}</p>
          </div>

          {tiers.map((tier) => (
            <div key={tier.tier} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier.tier as keyof typeof TIER_COLORS] }}
                />
                <div>
                  <p className="text-sm font-medium text-white">{tier.name}</p>
                  <p className="text-xs text-gray-400">{tier.percentage.toFixed(1)}% of total</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-white">${parseFloat(tier.amount).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Descriptions */}
      <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="text-xs">
          <p className="text-gray-400 mb-1">Tier 1: Liquid Assets</p>
          <p className="text-gray-500">USDC and cash equivalents</p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400 mb-1">Tier 2: Float</p>
          <p className="text-gray-500">Funds in transit</p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400 mb-1">Tier 3: Physical</p>
          <p className="text-gray-500">Physical inventory</p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400 mb-1">Tier 4: Investments</p>
          <p className="text-gray-500">Venture investments</p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400 mb-1">Tier 5: Receivables</p>
          <p className="text-gray-500">Accounts receivable</p>
        </div>
      </div>
    </div>
  );
}
