'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// Components
import ParticleBackground from '@/components/grain-vault/demo/ParticleBackground';
import Scene, { SceneDivider, RevealText, StatCard } from '@/components/grain-vault/demo/Scene';
import AnimatedCounter, { CurrencyCounter, PercentageCounter, CompactCounter, LiveTicker } from '@/components/grain-vault/demo/AnimatedCounter';
import InflationVisualizer from '@/components/grain-vault/demo/InflationVisualizer';
import GRAINTokenAnimation, { FloatingGRAINTokens } from '@/components/grain-vault/demo/GRAINTokenAnimation';
import FlowDiagram from '@/components/grain-vault/demo/FlowDiagram';
import DepositSimulator from '@/components/grain-vault/demo/DepositSimulator';
import ComparisonChart from '@/components/grain-vault/demo/ComparisonChart';
import AuditVisualization from '@/components/grain-vault/demo/AuditVisualization';

// Use cases data
const useCases = [
  {
    title: 'Treasury Management',
    description: 'Companies holding reserves in GRAIN instead of idle cash. Earn while you wait.',
    icon: '🏦',
    stat: '12% APY',
    example: 'Fortune 500 companies, SMBs, DAOs',
  },
  {
    title: 'Payroll in GRAIN',
    description: 'Pay employees in GRAIN. They receive value that grows, not depreciates.',
    icon: '💼',
    stat: '180+ Countries',
    example: 'Remote teams, contractors, global workforce',
  },
  {
    title: 'Cross-Border Payments',
    description: 'Send value globally without forex fees or delays. Instant settlement.',
    icon: '🌍',
    stat: '< 2 min',
    example: 'International suppliers, remittances',
  },
  {
    title: 'Credit Lines',
    description: 'Borrow against GRAIN holdings. Keep earning while accessing liquidity.',
    icon: '💳',
    stat: 'Up to 80% LTV',
    example: 'Working capital, expansion funding',
  },
];

export default function GRAINImmersiveDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNav, setShowNav] = useState(false);
  const { scrollYProgress } = useScroll({ container: containerRef });

  // Progress bar
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowNav(containerRef.current.scrollTop > 500);
      }
    };

    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-auto overflow-x-hidden bg-black scroll-smooth"
    >
      {/* Particle background */}
      <ParticleBackground />

      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-yellow-500 to-emerald-500 z-50"
        style={{ width: progressWidth }}
      />

      {/* Floating nav */}
      <AnimatePresence>
        {showNav && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full bg-black/80 backdrop-blur-lg border border-gray-800"
          >
            <div className="flex items-center gap-6">
              <Link href="#problem" className="text-gray-400 hover:text-white text-sm transition-colors">
                Problem
              </Link>
              <Link href="#solution" className="text-gray-400 hover:text-white text-sm transition-colors">
                Solution
              </Link>
              <Link href="#how-it-works" className="text-gray-400 hover:text-white text-sm transition-colors">
                How It Works
              </Link>
              <Link href="#use-cases" className="text-gray-400 hover:text-white text-sm transition-colors">
                Use Cases
              </Link>
              <Link href="#security" className="text-gray-400 hover:text-white text-sm transition-colors">
                Security
              </Link>
              <Link
                href="#get-started"
                className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* SCENE 0: Hero / Opening */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-emerald-950/20 to-black" />
        <FloatingGRAINTokens count={8} />

        <motion.div
          className="relative z-10 text-center px-6"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          {/* Logo animation */}
          <motion.div
            className="mb-8"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 1.5, type: 'spring', bounce: 0.3 }}
          >
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-emerald-600 to-yellow-500 text-6xl font-bold text-black shadow-2xl shadow-emerald-500/30">
              G
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight">
              <RevealText delay={1}>GRAIN</RevealText>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                The treasury token that{' '}
                <span className="text-emerald-400">grows</span>, not shrinks.
              </motion.span>
            </p>

            {/* Live ticker preview */}
            <motion.div
              className="flex items-center justify-center gap-8 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
            >
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">Current Price</div>
                <LiveTicker
                  baseValue={1.0842}
                  incrementPerSecond={0.0000001}
                  prefix="$"
                  decimals={4}
                  className="text-3xl font-mono text-emerald-400"
                />
              </div>
              <div className="w-px h-12 bg-gray-800" />
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">TVL</div>
                <div className="text-3xl font-mono text-yellow-400">$13.6M</div>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
            >
              <Link
                href="#get-started"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-lg hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/25"
              >
                Start Earning
              </Link>
              <Link
                href="/grain-vault/demo/commercial"
                className="px-8 py-4 rounded-xl bg-transparent border-2 border-gray-700 text-white font-bold text-lg hover:border-emerald-500 transition-all"
              >
                Watch Commercial
              </Link>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{ delay: 3, y: { duration: 2, repeat: Infinity } }}
          >
            <div className="text-gray-500 text-sm mb-2">Scroll to explore</div>
            <div className="w-6 h-10 rounded-full border-2 border-gray-600 mx-auto flex items-start justify-center p-2">
              <motion.div
                className="w-1.5 h-3 rounded-full bg-gray-400"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      <SceneDivider color="emerald" />

      {/* SCENE 1: The Problem */}
      <Scene
        id="problem"
        title="The Problem"
        subtitle="Why traditional savings fail"
        animationType="reveal"
      >
        <div className="text-center mb-16">
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Every day, your money loses value. Inflation silently erodes your purchasing power
            while traditional banks pay you almost nothing.
          </p>
        </div>

        <InflationVisualizer className="max-w-5xl mx-auto" />

        <motion.div
          className="mt-16 grid md:grid-cols-3 gap-8 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30">
            <div className="text-4xl font-bold text-red-400 mb-2">
              <PercentageCounter value={7.5} />
            </div>
            <div className="text-gray-400">Average inflation (2022)</div>
          </div>
          <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30">
            <div className="text-4xl font-bold text-red-400 mb-2">
              <PercentageCounter value={0.5} />
            </div>
            <div className="text-gray-400">Avg savings account APY</div>
          </div>
          <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30">
            <div className="text-4xl font-bold text-red-400 mb-2">
              -<PercentageCounter value={7} />
            </div>
            <div className="text-gray-400">Real return on cash</div>
          </div>
        </motion.div>
      </Scene>

      <SceneDivider color="gold" />

      {/* SCENE 2: The Solution - GRAIN */}
      <Scene
        id="solution"
        title="Meet GRAIN"
        subtitle="The Solution"
        animationType="scale"
      >
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <GRAINTokenAnimation size="xl" showPrice showFormula />
          </div>

          <div className="flex-1 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-3xl font-bold text-white mb-4">
                Your Money Grows, Not Shrinks
              </h3>
              <p className="text-gray-400 text-lg leading-relaxed">
                GRAIN is a treasury-backed token designed to appreciate over time.
                Unlike stablecoins pegged to $1, GRAIN&apos;s price increases as the
                treasury grows through yield-generating activities.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  100%
                </div>
                <div className="text-gray-400 text-sm">Collateralized</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  ~12%
                </div>
                <div className="text-gray-400 text-sm">Target APY</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  24/7
                </div>
                <div className="text-gray-400 text-sm">Liquidity</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-400 mb-1">
                  Base
                </div>
                <div className="text-gray-400 text-sm">L2 Blockchain</div>
              </div>
            </motion.div>
          </div>
        </div>
      </Scene>

      <SceneDivider color="emerald" />

      {/* SCENE 3: How It Works */}
      <Scene
        id="how-it-works"
        title="How It Works"
        subtitle="Simple & Transparent"
        animationType="slide"
      >
        <FlowDiagram className="max-w-5xl mx-auto mb-20" />

        <DepositSimulator />
      </Scene>

      <SceneDivider color="gold" />

      {/* SCENE 4: Use Cases */}
      <Scene
        id="use-cases"
        title="Use Cases"
        subtitle="Built for Business"
        animationType="fade"
      >
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-gray-800 hover:border-emerald-500/50 transition-all group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{useCase.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">
                      {useCase.title}
                    </h3>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                      {useCase.stat}
                    </span>
                  </div>
                  <p className="text-gray-400 mb-4">{useCase.description}</p>
                  <div className="text-gray-500 text-sm">
                    <span className="text-gray-600">Use case:</span>{' '}
                    {useCase.example}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Scene>

      <SceneDivider color="emerald" />

      {/* SCENE 5: The Numbers */}
      <Scene
        id="numbers"
        title="The Numbers"
        subtitle="Performance"
        animationType="reveal"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 max-w-5xl mx-auto">
          <StatCard
            label="Total Value Locked"
            value={<CompactCounter value={13600000} prefix="$" />}
            delay={0}
          />
          <StatCard
            label="Active Users"
            value={<AnimatedCounter value={2847} />}
            delay={0.1}
          />
          <StatCard
            label="Transactions"
            value={<CompactCounter value={45230} />}
            delay={0.2}
          />
          <StatCard
            label="Appreciation Rate"
            value={<PercentageCounter value={12.4} />}
            delay={0.3}
          />
        </div>

        <ComparisonChart className="max-w-5xl mx-auto" />
      </Scene>

      <SceneDivider color="gold" />

      {/* SCENE 6: Security & Trust */}
      <Scene
        id="security"
        title="Security & Trust"
        subtitle="Built on Solid Foundations"
        animationType="slide"
      >
        <AuditVisualization className="max-w-5xl mx-auto" />
      </Scene>

      <SceneDivider color="emerald" />

      {/* SCENE 7: Get Started */}
      <Scene
        id="get-started"
        title="Join the Treasury Revolution"
        subtitle="Get Started"
        animationType="scale"
        className="pb-32"
      >
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            className="text-xl text-gray-400 mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Whether you&apos;re an individual looking to preserve wealth or an
            enterprise managing treasury, GRAIN is your answer to inflation.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              className="px-10 py-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-xl hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-2xl shadow-emerald-500/25"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Create Account
            </motion.button>
            <motion.button
              className="px-10 py-5 rounded-2xl bg-transparent border-2 border-yellow-500/50 text-yellow-400 font-bold text-xl hover:bg-yellow-500/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Contact Sales
            </motion.button>
          </motion.div>

          {/* Quick links */}
          <motion.div
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            {['Documentation', 'API Access', 'Support', 'Whitepaper'].map((link) => (
              <a
                key={link}
                href="#"
                className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-emerald-500/50 text-gray-400 hover:text-white transition-all"
              >
                {link}
              </a>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.footer
          className="mt-32 pt-16 border-t border-gray-800"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-yellow-500 flex items-center justify-center text-lg font-bold text-black">
                G
              </div>
              <span className="text-xl font-bold text-white">GRAIN</span>
            </div>

            <div className="flex items-center gap-8 text-gray-500 text-sm">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
              <a href="#" className="hover:text-white transition-colors">Compliance</a>
            </div>

            <div className="text-gray-600 text-sm">
              &copy; 2024 Grain & Vault. All rights reserved.
            </div>
          </div>
        </motion.footer>
      </Scene>
    </div>
  );
}
