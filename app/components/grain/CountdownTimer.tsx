'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: Date;
  label?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({ targetDate, label = 'Launch in' }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference > 0) {
        setTimeRemaining({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="bg-gradient-to-r from-wells-blue to-blue-900 border border-blue-700 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-300" />
        <p className="text-sm text-blue-300 font-medium">{label}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">
            {String(timeRemaining.days).padStart(2, '0')}
          </div>
          <div className="text-xs text-blue-300 uppercase">Days</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">
            {String(timeRemaining.hours).padStart(2, '0')}
          </div>
          <div className="text-xs text-blue-300 uppercase">Hours</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">
            {String(timeRemaining.minutes).padStart(2, '0')}
          </div>
          <div className="text-xs text-blue-300 uppercase">Minutes</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">
            {String(timeRemaining.seconds).padStart(2, '0')}
          </div>
          <div className="text-xs text-blue-300 uppercase">Seconds</div>
        </div>
      </div>
    </div>
  );
}
