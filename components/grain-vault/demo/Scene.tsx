'use client';

import { useRef, ReactNode } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

interface SceneProps {
  children: ReactNode;
  id?: string;
  className?: string;
  title?: string;
  subtitle?: string;
  dark?: boolean;
  centered?: boolean;
  fullHeight?: boolean;
  delay?: number;
  animationType?: 'fade' | 'slide' | 'scale' | 'reveal';
}

const containerVariants: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.8, staggerChildren: 0.2 },
    },
  },
  slide: {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut', staggerChildren: 0.15 },
    },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, staggerChildren: 0.1 },
    },
  },
  reveal: {
    hidden: { opacity: 0, y: 100 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: 'easeOut', staggerChildren: 0.2 },
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export default function Scene({
  children,
  id,
  className = '',
  title,
  subtitle,
  dark = true,
  centered = true,
  fullHeight = true,
  delay = 0,
  animationType = 'slide',
}: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const baseClasses = `
    relative overflow-hidden
    ${fullHeight ? 'min-h-screen' : ''}
    ${centered ? 'flex flex-col items-center justify-center' : ''}
    ${dark ? 'bg-black text-white' : 'bg-white text-black'}
  `;

  return (
    <motion.section
      ref={ref}
      id={id}
      className={`${baseClasses} ${className}`}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={containerVariants[animationType]}
      transition={{ delay }}
    >
      {/* Gradient overlays for depth */}
      {dark && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent pointer-events-none" />
        </>
      )}

      {/* Content container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20">
        {(title || subtitle) && (
          <motion.div
            className="text-center mb-16"
            variants={itemVariants}
          >
            {subtitle && (
              <motion.p
                className="text-emerald-400 uppercase tracking-[0.3em] text-sm font-medium mb-4"
                variants={itemVariants}
              >
                {subtitle}
              </motion.p>
            )}
            {title && (
              <motion.h2
                className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
                variants={itemVariants}
              >
                {title}
              </motion.h2>
            )}
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
}

// Scene transition divider with animated line
export function SceneDivider({ color = 'emerald' }: { color?: 'emerald' | 'gold' }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const colorClasses = {
    emerald: 'from-transparent via-emerald-500 to-transparent',
    gold: 'from-transparent via-yellow-500 to-transparent',
  };

  return (
    <div ref={ref} className="relative h-32 flex items-center justify-center">
      <motion.div
        className={`h-px w-full bg-gradient-to-r ${colorClasses[color]}`}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className={`absolute w-3 h-3 rounded-full ${color === 'emerald' ? 'bg-emerald-500' : 'bg-yellow-500'}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      />
    </div>
  );
}

// Animated text reveal component for dramatic headlines
export function RevealText({
  children,
  className = '',
  delay = 0,
}: {
  children: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const words = children.split(' ');

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em]">
          <motion.span
            className="inline-block"
            initial={{ y: '100%' }}
            animate={isInView ? { y: 0 } : { y: '100%' }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

// Animated stat card
export function StatCard({
  label,
  value,
  icon,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="relative p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm"
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, borderColor: 'rgba(16, 185, 129, 0.5)' }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10">
        {icon && (
          <div className="text-emerald-400 mb-4">
            {icon}
          </div>
        )}
        <div className="text-4xl md:text-5xl font-bold text-white mb-2">
          {value}
        </div>
        <div className="text-gray-400 text-sm uppercase tracking-wider">
          {label}
        </div>
      </div>
    </motion.div>
  );
}
