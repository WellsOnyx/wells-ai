'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';

interface InflationVisualizerProps {
  initialValue?: number;
  years?: number;
  inflationRate?: number;
  grainGrowthRate?: number;
  className?: string;
}

export default function InflationVisualizer({
  initialValue = 100000,
  years = 10,
  inflationRate = 0.07,
  grainGrowthRate = 0.12,
  className = '',
}: InflationVisualizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [currentYear, setCurrentYear] = useState(0);
  const [traditionalValue, setTraditionalValue] = useState(initialValue);
  const [grainValue, setGrainValue] = useState(initialValue);

  useEffect(() => {
    if (!isInView) return;

    let yearCounter = 0;
    const interval = setInterval(() => {
      if (yearCounter >= years) {
        clearInterval(interval);
        return;
      }

      yearCounter++;
      setCurrentYear(yearCounter);

      // Traditional savings lose purchasing power
      const tradValue = initialValue * Math.pow(1 - inflationRate, yearCounter);
      setTraditionalValue(Math.round(tradValue));

      // GRAIN grows
      const grainVal = initialValue * Math.pow(1 + grainGrowthRate, yearCounter);
      setGrainValue(Math.round(grainVal));
    }, 400);

    return () => clearInterval(interval);
  }, [isInView, initialValue, years, inflationRate, grainGrowthRate]);

  const traditionalPercent = (traditionalValue / initialValue) * 100;
  const grainPercent = Math.min((grainValue / (initialValue * 3)) * 100, 100);

  return (
    <div ref={ref} className={`w-full ${className}`}>
      {/* Year counter */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
          After
        </div>
        <div className="text-6xl font-bold text-white">
          {currentYear}
          <span className="text-2xl text-gray-400 ml-2">
            {currentYear === 1 ? 'Year' : 'Years'}
          </span>
        </div>
      </motion.div>

      {/* Split comparison */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Traditional Savings */}
        <motion.div
          className="relative p-8 rounded-2xl bg-gradient-to-br from-red-900/30 to-red-950/50 border border-red-500/30"
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="text-red-400 text-sm uppercase tracking-widest mb-2">
            Traditional Savings
          </div>
          <div className="text-4xl font-bold text-white mb-4">
            ${traditionalValue.toLocaleString()}
          </div>
          <div className="text-red-400 text-sm mb-6">
            Purchasing Power
          </div>

          {/* Progress bar showing value loss */}
          <div className="h-4 bg-red-950/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              style={{ width: `${traditionalPercent}%` }}
              initial={{ width: '100%' }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Loss indicator */}
          <div className="mt-4 text-red-400 text-2xl font-bold">
            -{((1 - traditionalValue / initialValue) * 100).toFixed(1)}%
          </div>
          <div className="text-red-400/70 text-sm">
            Lost to inflation
          </div>

          {/* Animated "shrinking" visualization */}
          <div className="absolute right-8 top-8 opacity-20">
            <motion.div
              className="w-20 h-20 rounded-full border-4 border-red-400"
              animate={{
                scale: [1, traditionalPercent / 100],
                opacity: [1, 0.5],
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* GRAIN */}
        <motion.div
          className="relative p-8 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border border-emerald-500/30"
          initial={{ opacity: 0, x: 50 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="text-emerald-400 text-sm uppercase tracking-widest mb-2">
            GRAIN Treasury
          </div>
          <div className="text-4xl font-bold text-white mb-4">
            ${grainValue.toLocaleString()}
          </div>
          <div className="text-emerald-400 text-sm mb-6">
            Growing Value
          </div>

          {/* Progress bar showing growth */}
          <div className="h-4 bg-emerald-950/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: `${grainPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Gain indicator */}
          <div className="mt-4 text-emerald-400 text-2xl font-bold">
            +{((grainValue / initialValue - 1) * 100).toFixed(1)}%
          </div>
          <div className="text-emerald-400/70 text-sm">
            Total appreciation
          </div>

          {/* Animated "growing" visualization */}
          <div className="absolute right-8 top-8 opacity-20">
            <motion.div
              className="w-20 h-20 rounded-full border-4 border-emerald-400"
              animate={{
                scale: [1, 1 + (grainValue / initialValue - 1) * 0.3],
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      </div>

      {/* Bottom stats */}
      <motion.div
        className="mt-12 grid grid-cols-3 gap-8 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <div>
          <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
            Inflation Rate
          </div>
          <div className="text-2xl font-bold text-red-400">
            {(inflationRate * 100).toFixed(0)}%
          </div>
          <div className="text-gray-500 text-xs">per year</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
            GRAIN Growth
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {(grainGrowthRate * 100).toFixed(0)}%
          </div>
          <div className="text-gray-500 text-xs">target APY</div>
        </div>
        <div>
          <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
            Net Advantage
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            ${(grainValue - traditionalValue).toLocaleString()}
          </div>
          <div className="text-gray-500 text-xs">difference</div>
        </div>
      </motion.div>
    </div>
  );
}

// Compact inflation ticker for hero sections
export function InflationTicker({ className = '' }: { className?: string }) {
  const [value, setValue] = useState(100);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      // Lose value every second (visualizing 7% annual inflation accelerated)
      const newValue = 100 * Math.pow(0.9999, elapsed);
      setValue(Math.max(newValue, 0));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const lost = 100 - value;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="text-red-400 font-mono">
        <span className="text-sm opacity-70">$</span>
        <span className="text-xl">{value.toFixed(2)}</span>
      </div>
      <div className="text-red-500/50 text-xs">
        Lost: ${lost.toFixed(2)}
      </div>
    </div>
  );
}
