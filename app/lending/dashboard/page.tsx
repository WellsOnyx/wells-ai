// @ts-nocheck
/**
 * Borrower Dashboard
 * View active loans, make payments, and manage account
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LendingDashboard() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('user@example.com'); // In production, get from auth

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const response = await fetch(`/api/lending/loans?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.success) {
        setLoans(data.loans || []);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Loans</h1>
          <p className="text-gray-600">Manage your loans and payments</p>
        </div>

        {loans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold mb-2">No Active Loans</h2>
            <p className="text-gray-600 mb-6">You don't have any loans yet. Ready to apply?</p>
            <Link
              href="/lending/apply"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-amber-700 transition"
            >
              Apply for a Loan
            </Link>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-gray-600 text-sm mb-1">Total Loans</div>
                  <div className="text-3xl font-bold">{summary.totalLoans}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-gray-600 text-sm mb-1">Total Balance</div>
                  <div className="text-3xl font-bold">
                    ${summary.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-gray-600 text-sm mb-1">Monthly Payment</div>
                  <div className="text-3xl font-bold">
                    ${summary.totalMonthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            {/* Loans List */}
            <div className="space-y-6">
              {loans.map(loan => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoanCard({ loan }) {
  const [showDetails, setShowDetails] = useState(false);

  const percentPaid = ((parseFloat(loan.original_amount) - parseFloat(loan.current_balance)) / parseFloat(loan.original_amount)) * 100;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold">{loan.product.product_name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                loan.status === 'active' ? 'bg-green-100 text-green-800' :
                loan.status === 'paid_off' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
                {loan.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="text-gray-600">Loan #{loan.loan_number}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-600 text-sm">Next Payment</div>
            <div className="text-xl font-bold">
              ${parseFloat(loan.monthly_payment).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-gray-500 text-sm">
              Due {new Date(loan.next_payment_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Loan Progress</span>
            <span className="font-semibold">{percentPaid.toFixed(1)}% Paid</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-amber-500 to-yellow-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(percentPaid, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Key Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-gray-600 text-sm">Current Balance</div>
            <div className="font-bold">
              ${parseFloat(loan.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-sm">Original Amount</div>
            <div className="font-bold">
              ${parseFloat(loan.original_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-sm">Interest Rate</div>
            <div className="font-bold">{(parseFloat(loan.interest_rate) * 100).toFixed(3)}%</div>
          </div>
          <div>
            <div className="text-gray-600 text-sm">Months Remaining</div>
            <div className="font-bold">{loan.remaining_months} / {loan.term_months}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href={`/lending/loans/${loan.id}/pay`}
            className="flex-1 bg-amber-600 text-white text-center py-3 rounded-lg font-bold hover:bg-amber-700 transition"
          >
            Make Payment
          </Link>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
          <Link
            href={`/lending/loans/${loan.id}/payoff`}
            className="px-6 bg-blue-100 text-blue-700 py-3 rounded-lg font-bold hover:bg-blue-200 transition"
          >
            Payoff Quote
          </Link>
        </div>
      </div>

      {/* Expandable Details */}
      {showDetails && (
        <div className="border-t bg-gray-50 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-3">Loan Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Origination Date:</span>
                  <span className="font-semibold">{new Date(loan.origination_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Maturity Date:</span>
                  <span className="font-semibold">{new Date(loan.maturity_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">APR:</span>
                  <span className="font-semibold">{(parseFloat(loan.apr) * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Day:</span>
                  <span className="font-semibold">{loan.payment_day_of_month}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-3">Payment History</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Principal Paid:</span>
                  <span className="font-semibold">
                    ${parseFloat(loan.total_principal_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Interest Paid:</span>
                  <span className="font-semibold">
                    ${parseFloat(loan.total_interest_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Payment Date:</span>
                  <span className="font-semibold">
                    {loan.last_payment_date ? new Date(loan.last_payment_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Autopay:</span>
                  <span className={`font-semibold ${loan.autopay_enabled ? 'text-green-600' : 'text-gray-600'}`}>
                    {loan.autopay_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href={`/lending/loans/${loan.id}`}
              className="text-amber-600 hover:text-amber-700 font-semibold"
            >
              View Full Statement →
            </Link>
            <Link
              href={`/lending/loans/${loan.id}/schedule`}
              className="text-amber-600 hover:text-amber-700 font-semibold"
            >
              View Amortization Schedule →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
