'use client';

/**
 * Credit Dashboard Page
 * Wells AI: Manage credit line, draw funds, make payments
 */

import { useState, useEffect } from 'react';

interface CreditLine {
  id: string;
  creditLimit: number;
  availableCredit: number;
  usedCredit: number;
  apr: number;
  status: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export default function CreditDashboardPage() {
  const [userId] = useState('demo-user-123'); // Replace with actual auth
  const [loading, setLoading] = useState(true);
  const [creditLine, setCreditLine] = useState<CreditLine | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Draw state
  const [drawAmount, setDrawAmount] = useState<number>(1000);
  const [drawPurpose, setDrawPurpose] = useState<string>('general');

  // Payment state
  const [paymentAmount, setPaymentAmount] = useState<number>(100);

  // Load credit line data
  useEffect(() => {
    loadCreditLine();
  }, []);

  const loadCreditLine = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/credit/draw?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setCreditLine(data.creditLine);
        // Load transactions
        await loadTransactions(data.creditLine.id);
      }
    } catch (error) {
      console.error('Error loading credit line:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (creditLineId: string) => {
    try {
      // Note: You'd need to create a transactions endpoint
      // For now, using mock data
      setTransactions([]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  // Handle draw
  const handleDraw = async () => {
    if (!creditLine) return;

    try {
      const response = await fetch('/api/credit/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditLineId: creditLine.id,
          amount: drawAmount,
          purpose: drawPurpose,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully drew $${drawAmount.toLocaleString()}`);
        setShowDrawModal(false);
        loadCreditLine();
      } else {
        alert(data.error || 'Failed to draw funds');
      }
    } catch (error) {
      console.error('Error drawing funds:', error);
      alert('Failed to draw funds');
    }
  };

  // Handle payment
  const handlePayment = async () => {
    if (!creditLine) return;

    try {
      const response = await fetch('/api/credit/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditLineId: creditLine.id,
          amount: paymentAmount,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Payment of $${paymentAmount.toLocaleString()} processed successfully`);
        setShowPayModal(false);
        loadCreditLine();
      } else {
        alert(data.error || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your credit line...</p>
        </div>
      </div>
    );
  }

  if (!creditLine) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Credit Line</h2>
          <p className="text-gray-600 mb-8">Apply for a credit line to get started</p>
          <a
            href="/credit/apply"
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Apply Now
          </a>
        </div>
      </div>
    );
  }

  const utilizationPercentage = (creditLine.usedCredit / creditLine.creditLimit) * 100;
  const monthlyPayment = (creditLine.usedCredit * (creditLine.apr / 100 / 12) + creditLine.usedCredit * 0.02); // Simplified

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Dashboard</h1>
          <p className="text-gray-600">Manage your Wells AI credit line</p>
        </div>

        {/* Credit Line Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Available Credit */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg p-6">
            <div className="text-sm opacity-90 mb-2">Available Credit</div>
            <div className="text-4xl font-bold mb-4">
              ${creditLine.availableCredit.toLocaleString()}
            </div>
            <div className="text-sm opacity-90">
              of ${creditLine.creditLimit.toLocaleString()} limit
            </div>
          </div>

          {/* Used Credit */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Current Balance</div>
            <div className="text-4xl font-bold text-gray-900 mb-4">
              ${creditLine.usedCredit.toLocaleString()}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${
                  utilizationPercentage > 80 ? 'bg-red-500' : utilizationPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${utilizationPercentage}%` }}
              />
            </div>
            <div className="text-sm text-gray-600">
              {utilizationPercentage.toFixed(1)}% utilization
            </div>
          </div>

          {/* APR */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Your APR</div>
            <div className="text-4xl font-bold text-gray-900 mb-4">
              {creditLine.apr}%
            </div>
            <div className="text-sm text-gray-600">
              Est. monthly payment: ${monthlyPayment.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Draw Funds */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Draw Funds</h3>
                <p className="text-sm text-gray-600">Access your available credit</p>
              </div>
            </div>
            <button
              onClick={() => setShowDrawModal(true)}
              disabled={creditLine.availableCredit <= 0}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Draw Funds
            </button>
          </div>

          {/* Make Payment */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Make Payment</h3>
                <p className="text-sm text-gray-600">Pay down your balance</p>
              </div>
            </div>
            <button
              onClick={() => setShowPayModal(true)}
              disabled={creditLine.usedCredit <= 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Make Payment
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600">No transactions yet</p>
              <p className="text-sm text-gray-500">Draw funds or make a payment to see activity here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center border-b border-gray-100 pb-4">
                  <div>
                    <div className="font-medium text-gray-900">{tx.description}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${tx.transactionType === 'payment' ? 'text-green-600' : 'text-gray-900'}`}>
                      {tx.transactionType === 'payment' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Balance: ${tx.balanceAfter.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Draw Modal */}
      {showDrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Draw Funds</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Draw
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 text-xl">$</span>
                <input
                  type="number"
                  value={drawAmount}
                  onChange={(e) => setDrawAmount(parseInt(e.target.value) || 0)}
                  max={creditLine.availableCredit}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-xl font-semibold"
                />
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Max available: ${creditLine.availableCredit.toLocaleString()}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose
              </label>
              <select
                value={drawPurpose}
                onChange={(e) => setDrawPurpose(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              >
                <option value="general">General Working Capital</option>
                <option value="inventory">Inventory Purchase</option>
                <option value="equipment">Equipment</option>
                <option value="payroll">Payroll</option>
                <option value="expansion">Business Expansion</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDrawModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDraw}
                disabled={drawAmount <= 0 || drawAmount > creditLine.availableCredit}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Draw ${drawAmount.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Payment</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 text-xl">$</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                  max={creditLine.usedCredit}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-xl font-semibold"
                />
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Current balance: ${creditLine.usedCredit.toLocaleString()}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">New Balance:</span>
                <span className="font-semibold">${Math.max(0, creditLine.usedCredit - paymentAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">New Available:</span>
                <span className="font-semibold text-green-600">
                  ${(creditLine.availableCredit + paymentAmount).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={paymentAmount <= 0 || paymentAmount > creditLine.usedCredit}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Pay ${paymentAmount.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
