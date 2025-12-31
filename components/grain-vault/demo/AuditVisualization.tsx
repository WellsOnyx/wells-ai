'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

interface AuditVisualizationProps {
  className?: string;
}

interface AuditData {
  reserve: number;
  equity: number;
  supply: number;
  price: number;
  lastUpdate: Date;
}

export default function AuditVisualization({ className = '' }: AuditVisualizationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const [auditData, setAuditData] = useState<AuditData>({
    reserve: 12400000,
    equity: 1242000,
    supply: 12573420,
    price: 1.0842,
    lastUpdate: new Date(),
  });

  const [isUpdating, setIsUpdating] = useState(false);

  // Simulate live updates
  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setIsUpdating(true);

      setTimeout(() => {
        setAuditData((prev) => {
          // Small random changes to simulate live data
          const reserveChange = Math.random() * 5000 - 1000;
          const equityChange = Math.random() * 500 - 100;
          const newReserve = prev.reserve + reserveChange;
          const newEquity = prev.equity + equityChange;
          const newPrice = (newReserve + newEquity) / prev.supply;

          return {
            reserve: newReserve,
            equity: newEquity,
            supply: prev.supply,
            price: newPrice,
            lastUpdate: new Date(),
          };
        });
        setIsUpdating(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, [isInView]);

  const collateralizationRatio = ((auditData.reserve + auditData.equity) / (auditData.supply * auditData.price)) * 100;

  return (
    <motion.div
      ref={ref}
      className={`w-full ${className}`}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.div
            className="w-3 h-3 rounded-full bg-emerald-500"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-emerald-400 text-sm uppercase tracking-widest">
            Live Audit Feed
          </span>
        </div>
        <h3 className="text-3xl font-bold text-white">
          100% Transparent. 100% Collateralized.
        </h3>
      </div>

      {/* Main visualization */}
      <div className="relative max-w-4xl mx-auto">
        {/* Reserve/Supply visualization */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Reserve side */}
          <motion.div
            className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border border-emerald-500/30"
            initial={{ x: -50, opacity: 0 }}
            animate={isInView ? { x: 0, opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <div className="text-emerald-400 text-sm uppercase tracking-widest mb-4">
              Treasury Backing
            </div>

            {/* Reserve bar */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">USDC Reserve</span>
                  <motion.span
                    className="text-white font-mono"
                    animate={{ opacity: isUpdating ? 0.5 : 1 }}
                  >
                    ${auditData.reserve.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </motion.span>
                </div>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={isInView ? { width: '91%' } : {}}
                    transition={{ delay: 0.5, duration: 1 }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Equity Buffer</span>
                  <motion.span
                    className="text-white font-mono"
                    animate={{ opacity: isUpdating ? 0.5 : 1 }}
                  >
                    ${auditData.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </motion.span>
                </div>
                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                    initial={{ width: 0 }}
                    animate={isInView ? { width: '9%' } : {}}
                    transition={{ delay: 0.7, duration: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Value Locked</span>
                <span className="text-2xl font-bold text-emerald-400">
                  ${(auditData.reserve + auditData.equity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Supply side */}
          <motion.div
            className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/30 to-blue-950/30 border border-blue-500/30"
            initial={{ x: 50, opacity: 0 }}
            animate={isInView ? { x: 0, opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
          >
            <div className="text-blue-400 text-sm uppercase tracking-widest mb-4">
              Token Supply
            </div>

            <div className="flex items-center justify-center py-8">
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: 0.6, type: 'spring' }}
              >
                {/* Circular supply indicator */}
                <svg className="w-48 h-48" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#1e3a5f"
                    strokeWidth="8"
                  />
                  {/* Supply circle */}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                    animate={isInView ? { strokeDashoffset: 0 } : {}}
                    transition={{ delay: 0.8, duration: 1.5 }}
                    transform="rotate(-90 50 50)"
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-2xl font-bold text-white font-mono"
                    animate={{ opacity: isUpdating ? 0.5 : 1 }}
                  >
                    {(auditData.supply / 1000000).toFixed(2)}M
                  </motion.span>
                  <span className="text-gray-400 text-sm">GRAIN</span>
                </div>
              </motion.div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-400">Current Price</span>
                <span className="text-2xl font-bold text-blue-400 font-mono">
                  ${auditData.price.toFixed(4)}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Collateralization meter */}
        <motion.div
          className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-gray-800"
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
        >
          <div className="text-center mb-6">
            <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
              Collateralization Ratio
            </div>
            <motion.div
              className="text-5xl font-bold"
              style={{
                color: collateralizationRatio >= 100 ? '#10b981' : '#ef4444',
              }}
            >
              {collateralizationRatio.toFixed(1)}%
            </motion.div>
          </div>

          {/* Gauge */}
          <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 via-emerald-400 to-yellow-400"
              initial={{ width: 0 }}
              animate={isInView ? { width: `${Math.min(collateralizationRatio, 100)}%` } : {}}
              transition={{ delay: 0.8, duration: 1 }}
            />
            {/* 100% marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white"
              style={{ left: '100%', transform: 'translateX(-100%)' }}
            />
          </div>

          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>0%</span>
            <span className="text-emerald-400">100% (Fully Backed)</span>
            <span>150%</span>
          </div>

          {/* Verification badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {['On-chain Verified', 'Real-time Audited', 'Open Source'].map((badge, i) => (
              <motion.div
                key={badge}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 1 + i * 0.1 }}
              >
                <svg
                  className="w-4 h-4 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-emerald-400 text-sm">{badge}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Last update indicator */}
        <motion.div
          className="mt-4 text-center text-sm text-gray-500"
          animate={{ opacity: isUpdating ? 0.5 : 1 }}
        >
          Last verified: {auditData.lastUpdate.toLocaleTimeString()}
          <AnimatePresence>
            {isUpdating && (
              <motion.span
                className="ml-2 text-emerald-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Updating...
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Partner logos */}
      <motion.div
        className="mt-16"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 1.2 }}
      >
        <div className="text-center text-gray-500 text-sm uppercase tracking-widest mb-8">
          Powered By
        </div>
        <div className="flex flex-wrap items-center justify-center gap-12">
          {/* Circle */}
          <div className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <span className="text-2xl font-bold text-black">C</span>
            </div>
            <span className="text-white font-medium">Circle</span>
          </div>

          {/* Base */}
          <div className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">B</span>
            </div>
            <span className="text-white font-medium">Base</span>
          </div>

          {/* Coinbase */}
          <div className="flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">CB</span>
            </div>
            <span className="text-white font-medium">Coinbase</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
