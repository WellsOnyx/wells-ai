'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  period?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  prefix?: string;
  suffix?: string;
}

export function MetricCard({
  label,
  value,
  change,
  period = '24h',
  icon,
  loading = false,
  prefix = '',
  suffix = '',
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">{label}</p>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-32 mb-2"></div>
          <div className="h-4 bg-gray-800 rounded w-20"></div>
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-white mb-1">
            {prefix}
            {value}
            {suffix}
          </p>

          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive && <TrendingUp className="w-4 h-4 text-green-500" />}
              {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
              {isNeutral && <Minus className="w-4 h-4 text-gray-500" />}
              <span
                className={`text-sm ${
                  isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-500'
                }`}
              >
                {isPositive && '+'}
                {change.toFixed(2)}% {period}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
