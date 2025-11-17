import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Deal } from '../types';
import { apiClient } from '../services/api';

/**
 * Kanban-style deal pipeline view
 */
export function DealPipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getDeals();
      setDeals(data);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stages: Array<{ id: Deal['stage']; label: string; color: string }> = [
    { id: 'lead', label: 'Lead', color: 'bg-gray-100 text-gray-700' },
    { id: 'qualified', label: 'Qualified', color: 'bg-blue-100 text-blue-700' },
    { id: 'proposal', label: 'Proposal', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-purple-100 text-purple-700' },
    { id: 'closed', label: 'Closed', color: 'bg-green-100 text-green-700' },
  ];

  const getDealsByStage = (stage: Deal['stage']) => {
    return deals.filter(deal => deal.stage === stage);
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto bg-gray-50">
      <div className="p-4">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Deal Pipeline</h2>
          <p className="text-sm text-gray-600">Track your opportunities</p>
        </div>

        {/* Pipeline stages - horizontal scroll on mobile */}
        <div className="flex space-x-4 pb-4 min-w-max">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            const stageValue = stageDeals.reduce((sum, deal) => {
              const value = parseFloat(deal.value.replace(/[$,]/g, ''));
              return sum + value;
            }, 0);

            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                {/* Stage header */}
                <div className={`${stage.color} rounded-t-xl px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{stage.label}</h3>
                    <span className="text-sm font-medium">{stageDeals.length}</span>
                  </div>
                  <p className="text-xs mt-1">
                    ${(stageValue / 1000).toFixed(0)}K total
                  </p>
                </div>

                {/* Deals */}
                <div className="bg-white border-x border-b border-gray-200 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                  {stageDeals.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No deals</p>
                  ) : (
                    stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="bg-white border border-gray-200 rounded-lg p-3 shadow-ios-card hover:shadow-ios transition-shadow cursor-pointer"
                      >
                        <h4 className="font-medium text-gray-900 text-sm mb-1">{deal.title}</h4>
                        <p className="text-xs text-gray-600 mb-2">{deal.supplier}</p>

                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-primary-600">{deal.value}</span>
                          <span className={`text-xs font-medium ${getProbabilityColor(deal.probability)}`}>
                            {deal.probability}%
                          </span>
                        </div>

                        <div className="text-xs text-gray-500">
                          <p>📅 {deal.dueDate}</p>
                          <p className="mt-1">✓ {deal.nextAction}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Pipeline Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Deals</p>
              <p className="text-xl font-bold text-gray-900">{deals.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-xl font-bold text-gray-900">
                ${(deals.reduce((sum, d) => sum + parseFloat(d.value.replace(/[$,]/g, '')), 0) / 1000).toFixed(0)}K
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg. Probability</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(deals.reduce((sum, d) => sum + d.probability, 0) / deals.length)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
