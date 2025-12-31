'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

interface FlowStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

const flowSteps: FlowStep[] = [
  {
    id: 1,
    title: 'Deposit USD',
    description: 'Card, bank transfer, or wire via Circle',
    icon: '💳',
    highlight: '180+ countries supported',
  },
  {
    id: 2,
    title: 'Convert to GRAIN',
    description: 'Instant conversion at current price',
    icon: '🔄',
    highlight: 'No slippage or fees',
  },
  {
    id: 3,
    title: 'GRAIN Appreciates',
    description: 'Your tokens grow as treasury expands',
    icon: '📈',
    highlight: 'Target 12% APY',
  },
  {
    id: 4,
    title: 'Redeem Anytime',
    description: 'Convert back to USD at current price',
    icon: '💰',
    highlight: '100% liquidity',
  },
];

interface FlowDiagramProps {
  autoPlay?: boolean;
  autoPlayInterval?: number;
  className?: string;
}

export default function FlowDiagram({
  autoPlay = true,
  autoPlayInterval = 3000,
  className = '',
}: FlowDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeStep, setActiveStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isInView || !autoPlay) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % flowSteps.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isInView, autoPlay, autoPlayInterval]);

  const handleStepClick = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveStep(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div ref={ref} className={`w-full ${className}`}>
      {/* Desktop horizontal flow */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Connection line */}
          <div className="absolute top-16 left-0 right-0 h-1 bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-emerald-500"
              initial={{ width: '0%' }}
              animate={isInView ? { width: `${((activeStep + 1) / flowSteps.length) * 100}%` } : {}}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-4 gap-4">
            {flowSteps.map((step, index) => (
              <motion.div
                key={step.id}
                className="relative flex flex-col items-center cursor-pointer group"
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                onClick={() => handleStepClick(index)}
              >
                {/* Step circle */}
                <motion.div
                  className={`
                    relative z-10 w-32 h-32 rounded-full flex items-center justify-center text-4xl
                    border-4 transition-all duration-300
                    ${
                      activeStep >= index
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-emerald-400'
                        : 'bg-gray-900 border-gray-700'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Glow effect for active */}
                  {activeStep === index && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}

                  <span className="relative z-10">{step.icon}</span>

                  {/* Step number */}
                  <div
                    className={`
                      absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${activeStep >= index ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'}
                    `}
                  >
                    {step.id}
                  </div>
                </motion.div>

                {/* Step content */}
                <motion.div
                  className="mt-6 text-center"
                  animate={{ opacity: activeStep >= index ? 1 : 0.5 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm mb-2">{step.description}</p>

                  <AnimatePresence>
                    {activeStep === index && step.highlight && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs"
                      >
                        {step.highlight}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile vertical flow */}
      <div className="md:hidden">
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800">
            <motion.div
              className="w-full bg-gradient-to-b from-emerald-500 to-yellow-500"
              initial={{ height: '0%' }}
              animate={isInView ? { height: `${((activeStep + 1) / flowSteps.length) * 100}%` } : {}}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-8">
            {flowSteps.map((step, index) => (
              <motion.div
                key={step.id}
                className="relative flex gap-6 cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                onClick={() => handleStepClick(index)}
              >
                {/* Step dot */}
                <motion.div
                  className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-lg
                    border-2 -ml-8
                    ${
                      activeStep >= index
                        ? 'bg-emerald-600 border-emerald-400'
                        : 'bg-gray-900 border-gray-700'
                    }
                  `}
                >
                  <span className="text-sm">{step.icon}</span>
                </motion.div>

                {/* Content */}
                <motion.div
                  className="flex-1 pb-4"
                  animate={{ opacity: activeStep >= index ? 1 : 0.5 }}
                >
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">{step.description}</p>

                  {activeStep === index && step.highlight && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs"
                    >
                      {step.highlight}
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Flow animation visualization */}
      <motion.div
        className="mt-16 relative h-20 bg-gray-900/50 rounded-xl overflow-hidden border border-gray-800"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.8 }}
      >
        {/* Moving particles representing funds */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
            style={{
              background: i % 2 === 0 ? '#10b981' : '#fbbf24',
              boxShadow: `0 0 20px ${i % 2 === 0 ? '#10b981' : '#fbbf24'}`,
            }}
            animate={{
              x: ['0%', '100%'],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'linear',
            }}
          />
        ))}

        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-8 text-sm text-gray-400">
          <span>USD In</span>
          <span className="text-emerald-400">GRAIN</span>
          <span>USD Out</span>
        </div>
      </motion.div>
    </div>
  );
}

// Mini flow for embedding
export function MiniFlow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {['Deposit', 'Convert', 'Grow', 'Redeem'].map((step, i) => (
        <div key={step} className="flex items-center">
          <span className="text-gray-400">{step}</span>
          {i < 3 && (
            <motion.span
              className="mx-2 text-emerald-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            >
              &rarr;
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}
