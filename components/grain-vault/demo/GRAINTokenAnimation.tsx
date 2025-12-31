'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';

interface GRAINTokenAnimationProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPrice?: boolean;
  showFormula?: boolean;
  interactive?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { container: 'w-24 h-24', text: 'text-lg', glow: 80 },
  md: { container: 'w-40 h-40', text: 'text-2xl', glow: 120 },
  lg: { container: 'w-64 h-64', text: 'text-4xl', glow: 200 },
  xl: { container: 'w-96 h-96', text: 'text-6xl', glow: 300 },
};

export default function GRAINTokenAnimation({
  size = 'lg',
  showPrice = true,
  showFormula = false,
  interactive = true,
  className = '',
}: GRAINTokenAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [price, setPrice] = useState(1.0842);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-100, 100], [15, -15]);
  const rotateY = useTransform(mouseX, [-100, 100], [-15, 15]);

  // Simulate live price updates
  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setPrice((prev) => {
        const change = (Math.random() - 0.4) * 0.0001; // Slight upward bias
        return Math.max(1.0, prev + change);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isInView]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    animate(mouseX, 0, { duration: 0.5 });
    animate(mouseY, 0, { duration: 0.5 });
    setIsHovered(false);
  };

  const sizeConfig = sizeClasses[size];

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '1000px' }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: sizeConfig.glow,
          height: sizeConfig.glow,
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(251, 191, 36, 0.2) 50%, transparent 70%)',
        }}
        animate={{
          scale: isHovered ? 1.3 : [1, 1.1, 1],
          opacity: isHovered ? 0.8 : [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: isHovered ? 0.3 : 3,
          repeat: isHovered ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Token */}
      <motion.div
        className={`relative ${sizeConfig.container} rounded-full cursor-pointer`}
        style={{
          rotateX: interactive ? rotateX : 0,
          rotateY: interactive ? rotateY : 0,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, scale: 0.5, rotateY: -180 }}
        animate={
          isInView
            ? { opacity: 1, scale: 1, rotateY: 0 }
            : { opacity: 0, scale: 0.5, rotateY: -180 }
        }
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.05 }}
      >
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #10b981, #fbbf24, #10b981)',
            padding: '3px',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-full h-full rounded-full bg-black" />
        </motion.div>

        {/* Inner gradient */}
        <div
          className="absolute inset-2 rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #000000 50%, #1e3a5f 100%)',
          }}
        >
          {/* Shine effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
            }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
          />
        </div>

        {/* GRAIN text */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: 'translateZ(20px)' }}
        >
          <span
            className={`font-bold ${sizeConfig.text} bg-gradient-to-br from-emerald-400 via-yellow-400 to-emerald-400 bg-clip-text text-transparent`}
            style={{
              textShadow: '0 0 30px rgba(16, 185, 129, 0.5)',
            }}
          >
            G
          </span>
        </div>

        {/* Particle orbits */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{
              duration: 10 + i * 5,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <motion.div
              className="absolute w-2 h-2 rounded-full bg-emerald-400"
              style={{
                top: '50%',
                left: '50%',
                marginTop: `-${40 + i * 15}%`,
                marginLeft: '-4px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)',
              }}
              animate={{
                opacity: [0.4, 1, 0.4],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Live price display */}
      {showPrice && (
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">
            Current Price
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-white font-mono">
              ${price.toFixed(4)}
            </span>
            <motion.span
              className="text-emerald-400 text-sm"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              LIVE
            </motion.span>
          </div>
        </motion.div>
      )}

      {/* Formula visualization */}
      {showFormula && (
        <motion.div
          className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="text-gray-400 text-sm uppercase tracking-widest mb-4 text-center">
            Price Formula
          </div>
          <div className="flex items-center justify-center gap-4 text-xl font-mono">
            <span className="text-white">Price</span>
            <span className="text-gray-500">=</span>
            <div className="flex flex-col items-center">
              <span className="text-emerald-400">Reserve + Equity</span>
              <div className="w-full h-px bg-white/30 my-1" />
              <span className="text-yellow-400">Supply</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-emerald-400 font-mono">$12.4M</div>
              <div className="text-gray-500">Reserve</div>
            </div>
            <div>
              <div className="text-emerald-400 font-mono">$1.2M</div>
              <div className="text-gray-500">Equity</div>
            </div>
            <div>
              <div className="text-yellow-400 font-mono">12.5M</div>
              <div className="text-gray-500">Supply</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Floating GRAIN tokens for background decoration
export function FloatingGRAINTokens({ count = 5 }: { count?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-8 h-8 rounded-full opacity-20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: 'conic-gradient(from 0deg, #10b981, #fbbf24, #10b981)',
          }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 360],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: i * 0.5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
