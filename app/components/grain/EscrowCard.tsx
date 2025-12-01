'use client';

import { Escrow, EscrowStatus } from '@/app/hooks/useEscrow';
import { CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

interface EscrowCardProps {
  escrow: Escrow;
  onRelease?: (milestoneIndex: number) => void;
  onDispute?: () => void;
  isCreator?: boolean;
}

const STATUS_LABELS = {
  [EscrowStatus.ACTIVE]: 'Active',
  [EscrowStatus.COMPLETED]: 'Completed',
  [EscrowStatus.DISPUTED]: 'Disputed',
  [EscrowStatus.RESOLVED]: 'Resolved',
  [EscrowStatus.CANCELLED]: 'Cancelled',
};

const STATUS_COLORS = {
  [EscrowStatus.ACTIVE]: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  [EscrowStatus.COMPLETED]: 'bg-green-500/20 text-green-500 border-green-500/50',
  [EscrowStatus.DISPUTED]: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
  [EscrowStatus.RESOLVED]: 'bg-purple-500/20 text-purple-500 border-purple-500/50',
  [EscrowStatus.CANCELLED]: 'bg-red-500/20 text-red-500 border-red-500/50',
};

export function EscrowCard({ escrow, onRelease, onDispute, isCreator }: EscrowCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Escrow #{escrow.id}</h3>
          <p className="text-sm text-gray-400">
            {isCreator ? 'To' : 'From'}: {(isCreator ? escrow.counterparty : escrow.creator).slice(0, 10)}...
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[escrow.status]}`}>
          {STATUS_LABELS[escrow.status]}
        </span>
      </div>

      {/* Amount */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Total Amount</span>
          <span className="text-lg font-bold text-white">{parseFloat(escrow.amount).toLocaleString()} GRAIN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Released</span>
          <span className="text-sm text-green-500">{parseFloat(escrow.released).toLocaleString()} GRAIN</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className="text-white font-semibold">{escrow.progressPercentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-wells-gold to-yellow-500 h-full transition-all duration-500"
            style={{ width: `${escrow.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-2 mb-4">
        {escrow.milestones.map((milestone, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-lg ${
              milestone.completed ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {milestone.completed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-gray-500" />
              )}
              <div>
                <p className="text-sm font-medium text-white">{milestone.name}</p>
                <p className="text-xs text-gray-400">{milestone.percentage}% • {milestone.amount} GRAIN</p>
              </div>
            </div>
            {!milestone.completed && escrow.status === EscrowStatus.ACTIVE && isCreator && onRelease && (
              <button
                onClick={() => onRelease(index)}
                className="px-3 py-1 bg-wells-gold hover:bg-yellow-600 text-black text-xs font-semibold rounded transition-colors"
              >
                Release
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {escrow.status === EscrowStatus.ACTIVE && onDispute && (
        <button
          onClick={onDispute}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-500 font-semibold rounded-lg transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Raise Dispute
        </button>
      )}
    </div>
  );
}
