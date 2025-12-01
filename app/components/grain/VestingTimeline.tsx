'use client';

import { Clock, Lock, Unlock } from 'lucide-react';
import { VestingSchedule } from '@/app/hooks/useGrain';

interface VestingTimelineProps {
  schedule: VestingSchedule;
}

export function VestingTimeline({ schedule }: VestingTimelineProps) {
  const startDate = new Date(schedule.start * 1000);
  const cliffDate = new Date(schedule.cliff * 1000);
  const endDate = new Date((schedule.start + schedule.duration) * 1000);
  const now = new Date();

  const isAfterCliff = now >= cliffDate;
  const isFullyVested = schedule.percentVested >= 100;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-wells-gold" />
        <h3 className="text-lg font-semibold text-white">Vesting Schedule</h3>
      </div>

      <div className="space-y-6">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Vesting Progress</span>
            <span className="text-white font-semibold">{schedule.percentVested.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-wells-gold to-yellow-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, schedule.percentVested)}%` }}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Total Granted</span>
            </div>
            <p className="text-xl font-bold text-white">{parseFloat(schedule.total).toLocaleString()} GRAIN</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-400">Released</span>
            </div>
            <p className="text-xl font-bold text-white">{parseFloat(schedule.released).toLocaleString()} GRAIN</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800" />

          {/* Start */}
          <div className="relative pl-12 pb-6">
            <div className="absolute left-2.5 w-3 h-3 bg-wells-gold rounded-full" />
            <div>
              <p className="text-sm font-medium text-white">Start Date</p>
              <p className="text-xs text-gray-400">{startDate.toLocaleDateString()}</p>
            </div>
          </div>

          {/* Cliff */}
          <div className="relative pl-12 pb-6">
            <div
              className={`absolute left-2.5 w-3 h-3 rounded-full ${
                isAfterCliff ? 'bg-green-500' : 'bg-gray-600'
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white">Cliff Period</p>
              <p className="text-xs text-gray-400">{cliffDate.toLocaleDateString()}</p>
              {!isAfterCliff && (
                <p className="text-xs text-yellow-500 mt-1">Tokens locked until cliff</p>
              )}
            </div>
          </div>

          {/* End */}
          <div className="relative pl-12">
            <div
              className={`absolute left-2.5 w-3 h-3 rounded-full ${
                isFullyVested ? 'bg-green-500' : 'bg-gray-600'
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white">Fully Vested</p>
              <p className="text-xs text-gray-400">{endDate.toLocaleDateString()}</p>
              {isFullyVested && (
                <p className="text-xs text-green-500 mt-1">All tokens unlocked</p>
              )}
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-lg p-4">
          <p className="text-sm text-blue-300 mb-2">Current Status</p>
          <p className="text-white font-medium">
            {isFullyVested
              ? 'All tokens fully vested and unlocked'
              : isAfterCliff
              ? 'Tokens vesting linearly'
              : 'Currently in cliff period - no tokens unlocked yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
