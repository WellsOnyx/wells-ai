import { h } from 'preact';
import { useState } from 'preact/hooks';
import { apiClient } from '../services/api';
import { MOCK_CATEGORIES } from '../mock/data';
import { useStore } from '../hooks/useStore';

/**
 * Multi-step RFQ creation wizard
 */
export function RFQForm() {
  const { user, setShowUpgradeModal } = useStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    quantity: '',
    budget: '',
    deadline: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    // Check tier limits (free tier gets 2 RFQs per month)
    if (user.tier === 'free') {
      // In real app, check actual RFQ count
      const canCreate = Math.random() > 0.3; // Mock check
      if (!canCreate) {
        setShowUpgradeModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await apiClient.createRFQ({
        ...formData,
        quantity: parseInt(formData.quantity),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setStep(1);
        setFormData({
          title: '',
          category: '',
          description: '',
          quantity: '',
          budget: '',
          deadline: '',
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to create RFQ:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">RFQ Created!</h3>
          <p className="text-sm text-gray-600">Suppliers will start responding soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Progress indicator */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Step {step} of 3</span>
          <span className="text-xs text-gray-500">{Math.round((step / 3) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RFQ Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', (e.target as HTMLInputElement).value)}
                placeholder="e.g., Custom aluminum parts for drones"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => updateField('category', (e.target as HTMLSelectElement).value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a category</option>
                {MOCK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
                placeholder="Describe what you need in detail..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              ></textarea>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold text-gray-900">Requirements</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => updateField('quantity', (e.target as HTMLInputElement).value)}
                placeholder="1000"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget *
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => updateField('budget', (e.target as HTMLInputElement).value)}
                placeholder="$10,000 - $15,000"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline *
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => updateField('deadline', (e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Review & Submit</h2>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <span className="text-xs text-gray-500">Title</span>
                <p className="text-sm font-medium text-gray-900">{formData.title}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Category</span>
                <p className="text-sm font-medium text-gray-900">{formData.category}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Description</span>
                <p className="text-sm text-gray-900">{formData.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Quantity</span>
                  <p className="text-sm font-medium text-gray-900">{formData.quantity}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Budget</span>
                  <p className="text-sm font-medium text-gray-900">{formData.budget}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Deadline</span>
                  <p className="text-sm font-medium text-gray-900">{formData.deadline}</p>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <p className="text-sm text-primary-800">
                📧 Your RFQ will be sent to matching suppliers. You'll receive responses via email and in-app notifications.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <div className="flex space-x-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium ios-button"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && (!formData.title || !formData.category || !formData.description)) ||
                (step === 2 && (!formData.quantity || !formData.budget || !formData.deadline))
              }
              className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-medium ios-button disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-medium ios-button disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit RFQ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
