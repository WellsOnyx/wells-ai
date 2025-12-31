'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

interface AssetData {
  name: string;
  symbol: string;
  color: string;
  returns: number[];
  icon: string;
}

const assets: AssetData[] = [
  {
    name: 'GRAIN',
    symbol: 'GRAIN',
    color: '#10b981',
    returns: [0, 3, 6, 9, 12, 15, 19, 24, 29, 35, 42, 50],
    icon: 'G',
  },
  {
    name: 'S&P 500',
    symbol: 'SPX',
    color: '#3b82f6',
    returns: [0, 1, 2, 5, 3, 8, 6, 10, 12, 9, 14, 11],
    icon: '$',
  },
  {
    name: 'Gold',
    symbol: 'XAU',
    color: '#fbbf24',
    returns: [0, 1, 0, 2, 1, 3, 2, 5, 4, 6, 5, 8],
    icon: 'Au',
  },
  {
    name: 'Savings Account',
    symbol: 'SAVE',
    color: '#6b7280',
    returns: [0, 0.04, 0.08, 0.12, 0.17, 0.21, 0.25, 0.29, 0.33, 0.38, 0.42, 0.5],
    icon: '%',
  },
];

interface ComparisonChartProps {
  className?: string;
}

export default function ComparisonChart({ className = '' }: ComparisonChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['GRAIN', 'SPX', 'SAVE']);
  const [hoveredPoint, setHoveredPoint] = useState<{ asset: string; month: number } | null>(null);

  const maxReturn = Math.max(...assets.flatMap((a) => a.returns));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const toggleAsset = (symbol: string) => {
    setSelectedAssets((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const filteredAssets = assets.filter((a) => selectedAssets.includes(a.symbol));

  return (
    <motion.div
      ref={ref}
      className={`w-full ${className}`}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Asset toggles */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {assets.map((asset) => (
          <motion.button
            key={asset.symbol}
            onClick={() => toggleAsset(asset.symbol)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full transition-all
              ${
                selectedAssets.includes(asset.symbol)
                  ? 'bg-gray-800 border-2'
                  : 'bg-gray-900 border-2 border-transparent opacity-50'
              }
            `}
            style={{
              borderColor: selectedAssets.includes(asset.symbol) ? asset.color : 'transparent',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black"
              style={{ backgroundColor: asset.color }}
            >
              {asset.icon}
            </div>
            <span className="text-white text-sm">{asset.name}</span>
          </motion.button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative h-[400px] bg-gray-900/50 rounded-2xl border border-gray-800 p-8">
        {/* Y-axis labels */}
        <div className="absolute left-2 top-8 bottom-8 flex flex-col justify-between text-xs text-gray-500">
          {[50, 40, 30, 20, 10, 0].map((val) => (
            <span key={val}>{val}%</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-8 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-t border-gray-800/50" />
            ))}
          </div>

          {/* SVG Chart */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Draw lines for each selected asset */}
            {filteredAssets.map((asset, assetIndex) => {
              const points = asset.returns
                .map((ret, i) => {
                  const x = (i / (asset.returns.length - 1)) * 100;
                  const y = 100 - (ret / maxReturn) * 100;
                  return `${x},${y}`;
                })
                .join(' ');

              return (
                <motion.g key={asset.symbol}>
                  {/* Gradient fill under line */}
                  <defs>
                    <linearGradient
                      id={`gradient-${asset.symbol}`}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={asset.color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={asset.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  <motion.path
                    d={`M ${points} L 100,100 L 0,100 Z`}
                    fill={`url(#gradient-${asset.symbol})`}
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.5 + assetIndex * 0.2, duration: 0.5 }}
                  />

                  {/* Line */}
                  <motion.polyline
                    points={points}
                    fill="none"
                    stroke={asset.color}
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
                    transition={{
                      pathLength: { delay: 0.3 + assetIndex * 0.2, duration: 1.5 },
                      opacity: { delay: 0.3, duration: 0.3 },
                    }}
                  />

                  {/* Data points */}
                  {asset.returns.map((ret, i) => {
                    const x = (i / (asset.returns.length - 1)) * 100;
                    const y = 100 - (ret / maxReturn) * 100;
                    const isHovered =
                      hoveredPoint?.asset === asset.symbol && hoveredPoint?.month === i;

                    return (
                      <motion.circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={isHovered ? 1.5 : 0.8}
                        fill={asset.color}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.8 + i * 0.05 + assetIndex * 0.2 }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredPoint({ asset: asset.symbol, month: i })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </motion.g>
              );
            })}
          </svg>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 transform translate-y-6">
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>

          {/* Hover tooltip */}
          {hoveredPoint && (
            <motion.div
              className="absolute z-20 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                left: `${(hoveredPoint.month / 11) * 100}%`,
                top: `${100 - (assets.find((a) => a.symbol === hoveredPoint.asset)?.returns[hoveredPoint.month] || 0) / maxReturn * 100}%`,
                transform: 'translate(-50%, -120%)',
              }}
            >
              <div className="font-bold text-white">
                {assets.find((a) => a.symbol === hoveredPoint.asset)?.name}
              </div>
              <div className="text-emerald-400">
                +{assets.find((a) => a.symbol === hoveredPoint.asset)?.returns[hoveredPoint.month]}%
              </div>
              <div className="text-gray-400 text-xs">
                {months[hoveredPoint.month]}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Legend / Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {assets.map((asset) => {
          const finalReturn = asset.returns[asset.returns.length - 1];
          return (
            <motion.div
              key={asset.symbol}
              className={`
                p-4 rounded-xl border transition-all
                ${selectedAssets.includes(asset.symbol)
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-gray-900/30 border-gray-800 opacity-50'}
              `}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: asset.color }}
                />
                <span className="text-gray-400 text-sm">{asset.name}</span>
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: asset.color }}
              >
                +{finalReturn}%
              </div>
              <div className="text-gray-500 text-xs">12-month return</div>
            </motion.div>
          );
        })}
      </div>

      {/* Key insight */}
      <motion.div
        className="mt-8 p-6 rounded-xl bg-gradient-to-r from-emerald-900/30 to-emerald-950/30 border border-emerald-500/30 text-center"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 1 }}
      >
        <div className="text-emerald-400 text-lg font-bold mb-2">
          GRAIN outperformed traditional assets by{' '}
          <span className="text-yellow-400">
            {((50 / 11 - 1) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-gray-400 text-sm">
          With consistent growth backed by treasury reserves, not market speculation
        </div>
      </motion.div>
    </motion.div>
  );
}
