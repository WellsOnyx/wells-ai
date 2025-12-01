'use client';

import { useState } from 'react';
import { Web3Provider } from '@/app/components/grain/Web3Provider';
import { WalletConnect } from '@/app/components/grain/WalletConnect';
import { GrainCard } from '@/app/components/grain/GrainCard';
import { EscrowCard } from '@/app/components/grain/EscrowCard';
import { MetricCard } from '@/app/components/grain/MetricCard';
import { useEscrow } from '@/app/hooks/useEscrow';
import { useAccount } from 'wagmi';
import { Plus, Filter, Search, Lock, CheckCircle, AlertTriangle } from 'lucide-react';

function EscrowContent() {
  const { address, isConnected } = useAccount();
  const {
    activeEscrows,
    completedEscrows,
    disputedEscrows,
    totalVolume,
    create,
    releaseMilestone,
    dispute,
    isLoading,
  } = useEscrow();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedEscrow, setSelectedEscrow] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'disputed'>('all');

  const [createForm, setCreateForm] = useState({
    counterparty: '',
    amount: '',
    resolver: '',
    milestones: [{ name: '', percentage: 0 }],
  });

  const [disputeForm, setDisputeForm] = useState({
    reason: '',
  });

  const handleAddMilestone = () => {
    setCreateForm({
      ...createForm,
      milestones: [...createForm.milestones, { name: '', percentage: 0 }],
    });
  };

  const handleRemoveMilestone = (index: number) => {
    setCreateForm({
      ...createForm,
      milestones: createForm.milestones.filter((_, i) => i !== index),
    });
  };

  const handleCreateEscrow = async () => {
    if (!isConnected) return;

    try {
      await create(
        createForm.counterparty,
        createForm.amount,
        createForm.milestones,
        createForm.resolver
      );
      setShowCreateModal(false);
      setCreateForm({
        counterparty: '',
        amount: '',
        resolver: '',
        milestones: [{ name: '', percentage: 0 }],
      });
    } catch (error) {
      console.error('Failed to create escrow:', error);
    }
  };

  const handleReleaseMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      await releaseMilestone(escrowId, milestoneIndex);
    } catch (error) {
      console.error('Failed to release milestone:', error);
    }
  };

  const handleDispute = async () => {
    if (!selectedEscrow) return;

    try {
      await dispute(selectedEscrow, disputeForm.reason);
      setShowDisputeModal(false);
      setDisputeForm({ reason: '' });
      setSelectedEscrow(null);
    } catch (error) {
      console.error('Failed to raise dispute:', error);
    }
  };

  const filteredEscrows = (() => {
    switch (filter) {
      case 'active':
        return activeEscrows;
      case 'completed':
        return completedEscrows;
      case 'disputed':
        return disputedEscrows;
      default:
        return [...activeEscrows, ...completedEscrows, ...disputedEscrows];
    }
  })();

  const totalPercentage = createForm.milestones.reduce((sum, m) => sum + m.percentage, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Escrow Management</h1>
              <p className="text-gray-400">Milestone-based payments with dispute resolution</p>
            </div>
            <div className="flex items-center gap-4">
              {isConnected && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-wells-gold hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Escrow
                </button>
              )}
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to manage escrows</p>
            <WalletConnect />
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <MetricCard
                label="Total Volume"
                value={parseFloat(totalVolume).toLocaleString()}
                suffix=" GRAIN"
                icon={<Lock className="w-5 h-5" />}
              />
              <MetricCard
                label="Active Escrows"
                value={activeEscrows.length.toString()}
                icon={<Lock className="w-5 h-5 text-blue-500" />}
              />
              <MetricCard
                label="Completed"
                value={completedEscrows.length.toString()}
                icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              />
              <MetricCard
                label="Disputed"
                value={disputedEscrows.length.toString()}
                icon={<AlertTriangle className="w-5 h-5 text-yellow-500" />}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                {(['all', 'active', 'completed', 'disputed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      filter === f
                        ? 'bg-wells-gold text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Escrow List */}
            {filteredEscrows.length === 0 ? (
              <div className="text-center py-20">
                <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Escrows Found</h2>
                <p className="text-gray-400 mb-6">Create your first escrow to get started</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-wells-gold hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Escrow
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEscrows.map((escrow) => (
                  <EscrowCard
                    key={escrow.id}
                    escrow={escrow}
                    isCreator={escrow.creator.toLowerCase() === address?.toLowerCase()}
                    onRelease={(milestoneIndex) => handleReleaseMilestone(escrow.id, milestoneIndex)}
                    onDispute={() => {
                      setSelectedEscrow(escrow.id);
                      setShowDisputeModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Escrow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-2xl font-bold">Create New Escrow</h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Counterparty Address
                </label>
                <input
                  type="text"
                  value={createForm.counterparty}
                  onChange={(e) => setCreateForm({ ...createForm, counterparty: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold font-mono"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Total Amount (GRAIN)
                </label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Dispute Resolver Address
                </label>
                <input
                  type="text"
                  value={createForm.resolver}
                  onChange={(e) => setCreateForm({ ...createForm, resolver: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold font-mono"
                  placeholder="0x..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-400">
                    Milestones ({totalPercentage}% total)
                  </label>
                  <button
                    onClick={handleAddMilestone}
                    className="text-sm text-wells-gold hover:text-yellow-600 font-medium"
                  >
                    + Add Milestone
                  </button>
                </div>

                <div className="space-y-3">
                  {createForm.milestones.map((milestone, index) => (
                    <div key={index} className="flex gap-3">
                      <input
                        type="text"
                        value={milestone.name}
                        onChange={(e) => {
                          const newMilestones = [...createForm.milestones];
                          newMilestones[index].name = e.target.value;
                          setCreateForm({ ...createForm, milestones: newMilestones });
                        }}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-wells-gold"
                        placeholder="Milestone name"
                      />
                      <input
                        type="number"
                        value={milestone.percentage}
                        onChange={(e) => {
                          const newMilestones = [...createForm.milestones];
                          newMilestones[index].percentage = parseFloat(e.target.value) || 0;
                          setCreateForm({ ...createForm, milestones: newMilestones });
                        }}
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-wells-gold"
                        placeholder="%"
                        min="0"
                        max="100"
                      />
                      {createForm.milestones.length > 1 && (
                        <button
                          onClick={() => handleRemoveMilestone(index)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-500 rounded-lg transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {totalPercentage !== 100 && (
                  <p className="text-sm text-yellow-500 mt-2">
                    Warning: Milestone percentages must total 100% (currently {totalPercentage}%)
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEscrow}
                disabled={isLoading || totalPercentage !== 100 || !createForm.counterparty || !createForm.amount}
                className="flex-1 px-6 py-3 bg-wells-gold hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
              >
                {isLoading ? 'Creating...' : 'Create Escrow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-2xl font-bold">Raise Dispute</h2>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Reason for Dispute
              </label>
              <textarea
                value={disputeForm.reason}
                onChange={(e) => setDisputeForm({ reason: e.target.value })}
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                placeholder="Explain why you're raising this dispute..."
              />
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputeForm({ reason: '' });
                  setSelectedEscrow(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={isLoading || !disputeForm.reason}
                className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EscrowPage() {
  return (
    <Web3Provider>
      <EscrowContent />
    </Web3Provider>
  );
}
