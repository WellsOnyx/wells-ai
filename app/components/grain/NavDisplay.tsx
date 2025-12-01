'use client';

import { TrendingUp, TrendingDown, Minus, DollarSign } from 'lucide-react';
import { useVault } from '@/app/hooks/useVault';

interface NavDisplayProps {
  size?: 'small' | 'medium' | 'large';
  showChange?: boolean;
}

export function NavDisplay({ size = 'medium', showChange = true }: NavDisplayProps) {
  const { nav, history, isLoading } = useVault();

  const currentHistory = history[history.length - 1];
  const change24h = currentHistory?.change24h;

  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl',
  };

  const isPositive = change24h !== undefined && change24h > 0;
  const isNegative = change24h !== undefined && change24h < 0;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-gray-800 rounded w-48 mb-2"></div>
        {showChange && <div className="h-6 bg-gray-800 rounded w-32"></div>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <DollarSign className="w-8 h-8 text-wells-gold" />
        <span className={`${sizeClasses[size]} font-bold text-white`}>{nav}</span>
        <span className="text-gray-400 text-lg">GRAIN</span>
      </div>

      {showChange && change24h !== undefined && (
        <div className="flex items-center gap-2 mt-2">
          {isPositive && <TrendingUp className="w-5 h-5 text-green-500" />}
          {isNegative && <TrendingDown className="w-5 h-5 text-red-500" />}
          {!isPositive && !isNegative && <Minus className="w-5 h-5 text-gray-500" />}
          <span
            className={`text-lg font-medium ${
              isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {isPositive && '+'}
            {change24h.toFixed(2)}% 24h
          </span>
        </div>
      )}
    </div>
  );
}
