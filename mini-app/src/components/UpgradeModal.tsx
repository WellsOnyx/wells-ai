import { h } from 'preact';
import { useStore } from '../hooks/useStore';
import { TIER_LIMITS } from '../mock/data';

/**
 * Upgrade modal for tier gating
 */
export function UpgradeModal() {
  const { showUpgradeModal, setShowUpgradeModal, upgradeUser } = useStore();

  if (!showUpgradeModal) return null;

  const handleUpgrade = (plan: 'monthly' | 'annual') => {
    // In real app, this would trigger Apple IAP flow
    console.log('Initiating upgrade to:', plan);

    // Simulate successful upgrade
    upgradeUser('pro');
    setShowUpgradeModal(false);

    // Show success message
    alert('Upgrade successful! You now have Pro access.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => setShowUpgradeModal(false)}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-primary-500 to-primary-700 text-white p-6 rounded-t-2xl">
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="absolute top-4 right-4 text-white opacity-80 hover:opacity-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <div className="text-4xl mb-2">🚀</div>
            <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
            <p className="text-primary-100 text-sm mt-2">Unlock unlimited access</p>
          </div>
        </div>

        <div className="p-6">
          {/* Feature comparison */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Pro Features</h3>
            <div className="space-y-2">
              {TIER_LIMITS.pro.features.map((feature, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing cards */}
          <div className="space-y-3 mb-6">
            {/* Annual plan */}
            <div className="border-2 border-primary-500 rounded-xl p-4 bg-primary-50 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">Annual Plan</h4>
                  <p className="text-xs text-gray-600">Save 17%</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-600">$499</p>
                  <p className="text-xs text-gray-500">/year</p>
                </div>
              </div>
              <button
                onClick={() => handleUpgrade('annual')}
                className="w-full py-3 bg-primary-500 text-white rounded-lg font-semibold ios-button"
              >
                Choose Annual
              </button>
            </div>

            {/* Monthly plan */}
            <div className="border border-gray-300 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">Monthly Plan</h4>
                  <p className="text-xs text-gray-600">Flexible billing</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">$49</p>
                  <p className="text-xs text-gray-500">/month</p>
                </div>
              </div>
              <button
                onClick={() => handleUpgrade('monthly')}
                className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold ios-button"
              >
                Choose Monthly
              </button>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Why upgrade now?</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✨ Unlimited AI-powered supplier searches</li>
              <li>📊 Advanced analytics and insights</li>
              <li>🔌 API access for integrations</li>
              <li>🎯 Priority customer support</li>
              <li>💾 Unlimited RFQ creation</li>
            </ul>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Cancel anytime. Billed via Apple App Store.
          </p>
        </div>
      </div>
    </div>
  );
}
