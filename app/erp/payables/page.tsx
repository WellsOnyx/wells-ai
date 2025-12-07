'use client';

import { useState, useEffect } from 'react';

interface Bill {
  id: string;
  vendor_name: string;
  bill_number: string;
  total_amount: number;
  due_date: string;
  wells_fee_amount: number;
  payment_cost_saved: number;
  net_customer_savings: number;
  intercept_proposed: boolean;
  intercept_accepted: boolean;
  status: string;
}

export default function PayablesDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const connectionId = 'demo-connection-id'; // TODO: Get from auth context

  useEffect(() => {
    loadBills();
    loadStats();
  }, []);

  const loadBills = async () => {
    try {
      const response = await fetch(`/api/erp/bills?connectionId=${connectionId}`);
      const data = await response.json();
      setBills(data.bills || []);
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/erp/stats?connectionId=${connectionId}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/erp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      const data = await response.json();
      alert(`Sync complete! Found ${data.billsFound} bills, created ${data.interceptsCreated} intercepts`);
      await loadBills();
      await loadStats();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const toggleBill = (billId: string) => {
    const newSelected = new Set(selectedBills);
    if (newSelected.has(billId)) {
      newSelected.delete(billId);
    } else {
      newSelected.add(billId);
    }
    setSelectedBills(newSelected);
  };

  const payWithWells = async (billId: string) => {
    try {
      // Get intercept for this bill
      const response = await fetch(`/api/erp/intercepts?billId=${billId}`);
      const data = await response.json();

      if (data.intercept) {
        // Approve intercept
        await fetch('/api/erp/intercepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interceptId: data.intercept.id, action: 'approve' }),
        });

        alert('Payment approved! Will be processed soon.');
        await loadBills();
      }
    } catch (error) {
      console.error('Failed to approve payment:', error);
      alert('Failed to approve payment');
    }
  };

  const paySelectedWithWells = async () => {
    for (const billId of selectedBills) {
      await payWithWells(billId);
    }
    setSelectedBills(new Set());
  };

  const totalSelected = Array.from(selectedBills)
    .map(id => bills.find(b => b.id === id))
    .filter(b => b)
    .reduce((sum, b) => sum + b!.total_amount, 0);

  const totalSavings = Array.from(selectedBills)
    .map(id => bills.find(b => b.id === id))
    .filter(b => b)
    .reduce((sum, b) => sum + (b!.net_customer_savings || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading payables...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Payables Dashboard</h1>
            <p className="text-purple-300">Intercept and pay bills through Wells AI</p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-white mb-2">{stats.totalBills}</div>
              <div className="text-purple-300 text-sm">Total Bills</div>
            </div>
            <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/20">
              <div className="text-3xl font-bold text-green-400 mb-2">{stats.interceptedBills}</div>
              <div className="text-green-300 text-sm">Intercepted</div>
            </div>
            <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-blue-500/20">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                ${stats.potentialRevenue?.toFixed(0)}
              </div>
              <div className="text-blue-300 text-sm">Potential Revenue</div>
            </div>
            <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/20">
              <div className="text-3xl font-bold text-yellow-400 mb-2">
                ${stats.actualRevenue?.toFixed(0)}
              </div>
              <div className="text-yellow-300 text-sm">Actual Revenue</div>
            </div>
            <div className="bg-purple-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-purple-400 mb-2">{stats.vendorsEnrolled}</div>
              <div className="text-purple-300 text-sm">Vendors Enrolled</div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedBills.size > 0 && (
          <div className="bg-purple-600 rounded-xl p-4 mb-6 flex justify-between items-center">
            <div className="text-white">
              <span className="font-bold">{selectedBills.size} bills selected</span>
              <span className="ml-4">Total: ${totalSelected.toFixed(2)}</span>
              <span className="ml-4 text-green-300">Save: ${totalSavings.toFixed(2)}</span>
            </div>
            <button
              onClick={paySelectedWithWells}
              className="bg-white text-purple-600 font-bold py-2 px-6 rounded-lg hover:bg-gray-100 transition"
            >
              Pay Selected with Wells
            </button>
          </div>
        )}

        {/* Bills Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-purple-500/20">
          <table className="w-full">
            <thead className="bg-purple-900/50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedBills.size === bills.length && bills.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBills(new Set(bills.map(b => b.id)));
                      } else {
                        setSelectedBills(new Set());
                      }
                    }}
                    className="w-5 h-5"
                  />
                </th>
                <th className="px-6 py-4 text-left text-white font-semibold">Vendor</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Bill #</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Amount</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Due Date</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Wells Fee</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Your Savings</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/20">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedBills.has(bill.id)}
                      onChange={() => toggleBill(bill.id)}
                      className="w-5 h-5"
                    />
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{bill.vendor_name}</td>
                  <td className="px-6 py-4 text-purple-300">{bill.bill_number}</td>
                  <td className="px-6 py-4 text-white font-bold">
                    ${bill.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-purple-300">
                    {new Date(bill.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-yellow-400">
                    ${bill.wells_fee_amount?.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-green-400 font-bold">
                    ${bill.net_customer_savings?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4">
                    {bill.intercept_accepted ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                        Approved
                      </span>
                    ) : bill.intercept_proposed ? (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
                        Proposed
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-500/20 text-gray-300 rounded-full text-sm">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {!bill.intercept_accepted && (
                      <button
                        onClick={() => payWithWells(bill.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
                      >
                        Pay with Wells
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {bills.length === 0 && (
            <div className="text-center py-12 text-purple-300">
              No unpaid bills found. Click "Sync Now" to fetch from your ERP.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
