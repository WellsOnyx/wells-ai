// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LendGrainPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lender_id: '',
    lender_email: '',
    lender_name: '',
    grain_amount: '',
    annual_rate: '2.0',
    min_loan_amount: '',
    max_loan_amount: '',
    min_term_months: '12',
    max_term_months: '360',
    max_ltv: '80',
    auto_approve: false,
    accepted_loan_types: ['mortgage', 'auto', 'personal', 'business']
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/grain-market/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (data.success) {
        alert('GRAIN pool created successfully!');
        router.push('/grain-market/dashboard');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error creating pool: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLoanType = (type) => {
    setFormData(prev => ({
      ...prev,
      accepted_loan_types: prev.accepted_loan_types.includes(type)
        ? prev.accepted_loan_types.filter(t => t !== type)
        : [...prev.accepted_loan_types, type]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lend Your GRAIN</h1>
          <p className="text-gray-600 mb-8">Set your terms and start earning yield on your GRAIN</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your ID</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.lender_id}
                  onChange={(e) => setFormData({...formData, lender_id: e.target.value})}
                  placeholder="lender@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.lender_email}
                  onChange={(e) => setFormData({...formData, lender_email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Name (Optional)</label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.lender_name}
                onChange={(e) => setFormData({...formData, lender_name: e.target.value})}
                placeholder="Your name or 'Anonymous'"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GRAIN Amount</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.grain_amount}
                  onChange={(e) => setFormData({...formData, grain_amount: e.target.value})}
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Annual Rate (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.annual_rate}
                  onChange={(e) => setFormData({...formData, annual_rate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Term (months)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.min_term_months}
                  onChange={(e) => setFormData({...formData, min_term_months: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Term (months)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.max_term_months}
                  onChange={(e) => setFormData({...formData, max_term_months: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max LTV (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={formData.max_ltv}
                onChange={(e) => setFormData({...formData, max_ltv: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Accepted Loan Types</label>
              <div className="flex flex-wrap gap-3">
                {['mortgage', 'auto', 'personal', 'business'].map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.accepted_loan_types.includes(type)}
                      onChange={() => toggleLoanType(type)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_approve"
                checked={formData.auto_approve}
                onChange={(e) => setFormData({...formData, auto_approve: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="auto_approve" className="text-sm text-gray-700">
                Auto-approve backing requests (instant matching)
              </label>
            </div>

            <div className="pt-6 border-t flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating Pool...' : 'Create Lending Pool'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
