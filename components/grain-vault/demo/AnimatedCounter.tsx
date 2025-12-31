'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  triggerOnView?: boolean;
  delay?: number;
  formatOptions?: Intl.NumberFormatOptions;
}

export default function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 2,
  className = '',
  triggerOnView = true,
  delay = 0,
  formatOptions,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [shouldAnimate, setShouldAnimate] = useState(!triggerOnView);

  useEffect(() => {
    if (triggerOnView && isInView) {
      const timer = setTimeout(() => setShouldAnimate(true), delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isInView, triggerOnView, delay]);

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  useEffect(() => {
    if (shouldAnimate) {
      spring.set(value);
    }
  }, [shouldAnimate, value, spring]);

  const display = useTransform(spring, (current) => {
    if (formatOptions) {
      return new Intl.NumberFormat('en-US', formatOptions).format(current);
    }
    return current.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

// Specialized counters for common use cases

export function CurrencyCounter({
  value,
  currency = 'USD',
  className = '',
  duration = 2,
  delay = 0,
}: {
  value: number;
  currency?: string;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  return (
    <AnimatedCounter
      value={value}
      formatOptions={{ style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
      className={className}
      duration={duration}
      delay={delay}
    />
  );
}

export function PercentageCounter({
  value,
  className = '',
  duration = 2,
  decimals = 1,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  decimals?: number;
  delay?: number;
}) {
  return (
    <AnimatedCounter
      value={value}
      suffix="%"
      decimals={decimals}
      className={className}
      duration={duration}
      delay={delay}
    />
  );
}

export function CompactCounter({
  value,
  prefix = '',
  className = '',
  duration = 2,
  delay = 0,
}: {
  value: number;
  prefix?: string;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  // Format large numbers: 1000 -> 1K, 1000000 -> 1M, etc.
  const formatCompact = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    const delayTimer = setTimeout(() => {
      const startTime = Date.now();
      const durationMs = duration * 1000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = value * easeOutQuart;

        setDisplayValue(formatCompact(currentValue));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, delay * 1000);

    return () => clearTimeout(delayTimer);
  }, [isInView, value, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {prefix}{displayValue}
    </span>
  );
}

// Real-time ticker that continuously updates
export function LiveTicker({
  baseValue,
  incrementPerSecond,
  prefix = '',
  decimals = 2,
  className = '',
}: {
  baseValue: number;
  incrementPerSecond: number;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const [currentValue, setCurrentValue] = useState(baseValue);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setCurrentValue(baseValue + elapsed * incrementPerSecond);
    }, 50);

    return () => clearInterval(interval);
  }, [baseValue, incrementPerSecond]);

  return (
    <span className={className}>
      {prefix}
      {currentValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
