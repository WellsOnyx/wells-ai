'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

interface DepositSimulatorProps {
  className?: string;
  grainPrice?: number;
  targetApy?: number;
}

const presetAmounts = [1000, 10000, 100000, 1000000];
const timeFrames = [
  { label: '1 Month', months: 1 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '5 Years', months: 60 },
];

export default function DepositSimulator({
  className = '',
  grainPrice = 1.0842,
  targetApy = 0.12,
}: DepositSimulatorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const [depositAmount, setDepositAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedTimeFrame, setSelectedTimeFrame] = useState(2); // 1 Year default
  const [isCalculating, setIsCalculating] = useState(false);

  // Calculations
  const months = timeFrames[selectedTimeFrame].months;
  const grainReceived = depositAmount / grainPrice;
  const monthlyRate = Math.pow(1 + targetApy, 1 / 12) - 1;
  const futurePrice = grainPrice * Math.pow(1 + monthlyRate, months);
  const futureValue = grainReceived * futurePrice;
  const totalGain = futureValue - depositAmount;
  const percentageGain = (totalGain / depositAmount) * 100;

  const handleAmountChange = (amount: number) => {
    setIsCalculating(true);
    setDepositAmount(amount);
    setCustomAmount('');
    setTimeout(() => setIsCalculating(false), 300);
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const parsed = parseFloat(value.replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      setDepositAmount(parsed);
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`w-full max-w-4xl mx-auto ${className}`}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      <div className="p-8 rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-gray-800">
        {/* Header */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white mb-2">
            Deposit Simulator
          </h3>
          <p className="text-gray-400">
            See how your money could grow with GRAIN
          </p>
        </div>

        {/* Amount selector */}
        <div className="mb-8">
          <label className="block text-gray-400 text-sm mb-3">
            Deposit Amount
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {presetAmounts.map((amount) => (
              <motion.button
                key={amount}
                onClick={() => handleAmountChange(amount)}
                className={`
                  py-3 px-4 rounded-xl font-medium transition-all
                  ${
                    depositAmount === amount && !customAmount
                      ? 'bg-emerald-600 text-white border-2 border-emerald-400'
                      : 'bg-gray-800 text-gray-300 border-2 border-transparent hover:border-emerald-600'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                ${amount.toLocaleString()}
              </motion.button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">
              $
            </span>
            <input
              type="text"
              value={customAmount}
              onChange={(e) => handleCustomAmount(e.target.value)}
              placeholder="Enter custom amount"
              className="w-full py-4 pl-10 pr-4 rounded-xl bg-gray-800 border-2 border-gray-700 text-white text-lg focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Time frame selector */}
        <div className="mb-8">
          <label className="block text-gray-400 text-sm mb-3">
            Time Frame
          </label>
          <div className="grid grid-cols-4 gap-3">
            {timeFrames.map((tf, index) => (
              <motion.button
                key={tf.label}
                onClick={() => setSelectedTimeFrame(index)}
                className={`
                  py-3 px-4 rounded-xl font-medium transition-all
                  ${
                    selectedTimeFrame === index
                      ? 'bg-yellow-600 text-black border-2 border-yellow-400'
                      : 'bg-gray-800 text-gray-300 border-2 border-transparent hover:border-yellow-600'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tf.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${depositAmount}-${selectedTimeFrame}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Current transaction */}
            <div className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-4">
                Today&apos;s Transaction
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-gray-500 text-sm">You Deposit</div>
                  <div className="text-2xl font-bold text-white">
                    ${depositAmount.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-center text-emerald-500 text-2xl">
                  &rarr;
                </div>
                <div>
                  <div className="text-gray-500 text-sm">You Receive</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {grainReceived.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-lg">GRAIN</span>
                  </div>
                  <div className="text-gray-500 text-sm">
                    @ ${grainPrice.toFixed(4)}/GRAIN
                  </div>
                </div>
              </div>
            </div>

            {/* Future projection */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="text-emerald-400 text-sm uppercase tracking-widest">
                  After {timeFrames[selectedTimeFrame].label}
                </div>
                <div className="text-xs text-gray-500">
                  *Based on {(targetApy * 100).toFixed(0)}% target APY
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-gray-500 text-sm">Projected GRAIN Price</div>
                  <div className="text-2xl font-bold text-white">
                    ${futurePrice.toFixed(4)}
                  </div>
                  <div className="text-emerald-400 text-sm">
                    +{((futurePrice / grainPrice - 1) * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">Your GRAIN Value</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    ${futureValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-sm">Total Gain</div>
                  <motion.div
                    className="text-3xl font-bold text-yellow-400"
                    animate={{ scale: isCalculating ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    +${totalGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </motion.div>
                  <div className="text-yellow-400/70 text-sm">
                    +{percentageGain.toFixed(1)}% return
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  Same ${depositAmount.toLocaleString()} in a savings account (0.5% APY):
                </div>
                <div className="text-gray-500">
                  ${(
                    depositAmount * Math.pow(1.005, months / 12)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  <span className="text-red-400 ml-2">
                    (+${(depositAmount * (Math.pow(1.005, months / 12) - 1)).toFixed(0)})
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <motion.button
          className="w-full mt-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-lg hover:from-emerald-500 hover:to-emerald-400 transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          Start Earning with GRAIN
        </motion.button>

        {/* Disclaimer */}
        <p className="mt-4 text-center text-xs text-gray-500">
          Projections are estimates based on target APY. Actual returns may vary.
          GRAIN is not a security or investment contract.
        </p>
      </div>
    </motion.div>
  );
}
