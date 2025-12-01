'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NAVHistory } from '@/app/hooks/useVault';
import { TrendingUp } from 'lucide-react';

interface NavChartProps {
  history: NAVHistory[];
  period?: '24h' | '7d' | '30d' | 'all';
}

export function NavChart({ history, period = '7d' }: NavChartProps) {
  // Filter history based on period
  const filterHistory = () => {
    const now = Date.now() / 1000;
    const periods = {
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000,
      'all': Infinity,
    };

    const cutoff = now - periods[period];
    return history.filter((h) => h.timestamp >= cutoff);
  };

  const filteredHistory = filterHistory();

  const chartData = filteredHistory.map((h) => ({
    timestamp: h.timestamp,
    date: new Date(h.timestamp * 1000).toLocaleDateString(),
    nav: parseFloat(h.value),
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-wells-gold" />
        <h3 className="text-lg font-semibold text-white">GRAIN NAV History</h3>
      </div>

      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#9ca3af' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#9ca3af' }}
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'NAV']}
            />
            <Line
              type="monotone"
              dataKey="nav"
              stroke="#dba63f"
              strokeWidth={2}
              dot={{ fill: '#dba63f', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
