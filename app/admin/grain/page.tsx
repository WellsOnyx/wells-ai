'use client';

import { useState } from 'react';
import { Web3Provider } from '@/app/components/grain/Web3Provider';
import { WalletConnect } from '@/app/components/grain/WalletConnect';
import { GrainCard } from '@/app/components/grain/GrainCard';
import { MetricCard } from '@/app/components/grain/MetricCard';
import { NavChart } from '@/app/components/grain/NavChart';
import { useGrain } from '@/app/hooks/useGrain';
import { useVault, AssetTier } from '@/app/hooks/useVault';
import { useAccount } from 'wagmi';
import {
  Shield,
  DollarSign,
  Users,
  Activity,
  AlertTriangle,
  RefreshCw,
  Settings,
  Lock,
  Unlock,
  TrendingUp,
  Database,
  Zap,
} from 'lucide-react';

function AdminContent() {
  const { address, isConnected } = useAccount();
  const { totalSupply, nav, isLoading: grainLoading } = useGrain();
  const { totalAssets, tiers, history, deposit, withdraw, isLoading: vaultLoading } = useVault();

  const [navUpdateForm, setNavUpdateForm] = useState({ newNav: '' });
  const [tierUpdateForm, setTierUpdateForm] = useState({
    tier: AssetTier.LIQUID,
    amount: '',
    action: 'deposit' as 'deposit' | 'withdraw',
  });

  // Simulated admin data - in production, fetch from backend
  const [systemHealth, setSystemHealth] = useState({
    contractStatus: 'operational',
    multiSigBalance: '1250000',
    gasPrice: '0.05',
    lastSync: new Date().toISOString(),
    errorCount: 0,
    circuitBreaker: false,
  });

  const [foundingInvestors] = useState([
    { address: '0x1234...5678', grainBalance: '50000', locked: '40000', unlocked: '10000', kycStatus: 'verified' },
    { address: '0xabcd...ef01', grainBalance: '100000', locked: '80000', unlocked: '20000', kycStatus: 'verified' },
    { address: '0x9876...5432', grainBalance: '75000', locked: '60000', unlocked: '15000', kycStatus: 'verified' },
  ]);

  const handleUpdateNav = async () => {
    if (!navUpdateForm.newNav) return;

    try {
      // In production: Call admin contract method to update NAV
      const response = await fetch('/api/grain/admin/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newNav: navUpdateForm.newNav }),
      });

      if (response.ok) {
        alert('NAV updated successfully');
        setNavUpdateForm({ newNav: '' });
      }
    } catch (error) {
      console.error('Failed to update NAV:', error);
    }
  };

  const handleTierUpdate = async () => {
    if (!tierUpdateForm.amount) return;

    try {
      if (tierUpdateForm.action === 'deposit') {
        await deposit(tierUpdateForm.tier, tierUpdateForm.amount);
      } else {
        await withdraw(tierUpdateForm.tier, tierUpdateForm.amount);
      }
      setTierUpdateForm({ ...tierUpdateForm, amount: '' });
    } catch (error) {
      console.error('Failed to update tier:', error);
    }
  };

  const handleCircuitBreaker = async () => {
    try {
      const response = await fetch('/api/grain/admin/circuit-breaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !systemHealth.circuitBreaker }),
      });

      if (response.ok) {
        setSystemHealth({ ...systemHealth, circuitBreaker: !systemHealth.circuitBreaker });
      }
    } catch (error) {
      console.error('Failed to toggle circuit breaker:', error);
    }
  };

  const isAdmin = address === process.env.NEXT_PUBLIC_ADMIN_ADDRESS;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-gray-400 mb-6">Connect your admin wallet to continue</p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">Your wallet does not have admin privileges</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">GRAIN Admin Panel</h1>
              <p className="text-gray-400">System management and monitoring</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                systemHealth.circuitBreaker
                  ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                  : 'bg-green-500/20 text-green-500 border border-green-500/50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${systemHealth.circuitBreaker ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-xs font-medium">
                  {systemHealth.circuitBreaker ? 'PAUSED' : 'OPERATIONAL'}
                </span>
              </div>
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* System Health */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Contract Status"
              value={systemHealth.contractStatus.toUpperCase()}
              icon={<Activity className="w-5 h-5 text-green-500" />}
            />
            <MetricCard
              label="Multi-Sig Balance"
              value={parseFloat(systemHealth.multiSigBalance).toLocaleString()}
              prefix="$"
              icon={<Wallet className="w-5 h-5" />}
            />
            <MetricCard
              label="Gas Price"
              value={systemHealth.gasPrice}
              suffix=" Gwei"
              icon={<Zap className="w-5 h-5" />}
            />
            <MetricCard
              label="Error Count (24h)"
              value={systemHealth.errorCount.toString()}
              icon={<AlertTriangle className="w-5 h-5 text-yellow-500" />}
            />
          </div>
        </div>

        {/* NAV Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">NAV Management</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GrainCard title="Current NAV">
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <DollarSign className="w-8 h-8 text-wells-gold" />
                  <span className="text-4xl font-bold text-white">{nav}</span>
                  <span className="text-gray-400">GRAIN</span>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Supply</span>
                    <span className="text-white font-mono">{parseFloat(totalSupply).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Assets</span>
                    <span className="text-white font-mono">${parseFloat(totalAssets).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Backing Ratio</span>
                    <span className="text-green-500 font-mono">
                      {((parseFloat(totalAssets) / (parseFloat(totalSupply) * parseFloat(nav))) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </GrainCard>

            <GrainCard title="Update NAV" subtitle="Manual override (use with caution)">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    New NAV Value
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={navUpdateForm.newNav}
                      onChange={(e) => setNavUpdateForm({ newNav: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                      placeholder="1.0417"
                    />
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300">
                      NAV updates should only be made after proper asset valuation. This action is logged and auditable.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleUpdateNav}
                  disabled={!navUpdateForm.newNav || vaultLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-wells-gold hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Update NAV
                </button>
              </div>
            </GrainCard>
          </div>
        </div>

        {/* Asset Tier Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Asset Tier Management</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GrainCard title="Current Tier Values">
              <div className="space-y-3">
                {tiers.map((tier) => (
                  <div key={tier.tier} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-white">{tier.name}</p>
                      <p className="text-xs text-gray-400">{tier.percentage.toFixed(1)}% of total</p>
                    </div>
                    <p className="text-sm font-semibold text-white">${parseFloat(tier.amount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </GrainCard>

            <GrainCard title="Update Tier">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Select Tier
                  </label>
                  <select
                    value={tierUpdateForm.tier}
                    onChange={(e) => setTierUpdateForm({ ...tierUpdateForm, tier: parseInt(e.target.value) as AssetTier })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                  >
                    <option value={AssetTier.LIQUID}>Tier 1: Liquid Assets</option>
                    <option value={AssetTier.FLOAT}>Tier 2: Float</option>
                    <option value={AssetTier.PHYSICAL}>Tier 3: Physical</option>
                    <option value={AssetTier.INVESTMENTS}>Tier 4: Investments</option>
                    <option value={AssetTier.RECEIVABLES}>Tier 5: Receivables</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Action
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTierUpdateForm({ ...tierUpdateForm, action: 'deposit' })}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        tierUpdateForm.action === 'deposit'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => setTierUpdateForm({ ...tierUpdateForm, action: 'withdraw' })}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        tierUpdateForm.action === 'withdraw'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={tierUpdateForm.amount}
                      onChange={(e) => setTierUpdateForm({ ...tierUpdateForm, amount: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                      placeholder="1000000"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTierUpdate}
                  disabled={!tierUpdateForm.amount || vaultLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-wells-gold hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
                >
                  <Database className="w-4 h-4" />
                  {tierUpdateForm.action === 'deposit' ? 'Deposit to' : 'Withdraw from'} Tier
                </button>
              </div>
            </GrainCard>
          </div>
        </div>

        {/* User Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Founding Investors</h2>
          <GrainCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-sm font-medium text-gray-400 pb-3">Address</th>
                    <th className="text-right text-sm font-medium text-gray-400 pb-3">Total GRAIN</th>
                    <th className="text-right text-sm font-medium text-gray-400 pb-3">Locked</th>
                    <th className="text-right text-sm font-medium text-gray-400 pb-3">Unlocked</th>
                    <th className="text-center text-sm font-medium text-gray-400 pb-3">KYC Status</th>
                  </tr>
                </thead>
                <tbody>
                  {foundingInvestors.map((investor, index) => (
                    <tr key={index} className="border-b border-gray-800 last:border-0">
                      <td className="py-3 text-sm font-mono text-white">{investor.address}</td>
                      <td className="py-3 text-sm text-right font-semibold text-white">
                        {parseFloat(investor.grainBalance).toLocaleString()}
                      </td>
                      <td className="py-3 text-sm text-right text-gray-400">
                        {parseFloat(investor.locked).toLocaleString()}
                      </td>
                      <td className="py-3 text-sm text-right text-green-500">
                        {parseFloat(investor.unlocked).toLocaleString()}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-500 border border-green-500/50">
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GrainCard>
        </div>

        {/* Emergency Controls */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Emergency Controls</h2>
          <GrainCard>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Circuit Breaker</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Pause all contract operations in case of emergency. Only use if critical issue detected.
                </p>
                <button
                  onClick={handleCircuitBreaker}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-lg transition-colors ${
                    systemHealth.circuitBreaker
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {systemHealth.circuitBreaker ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      Resume Operations
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Pause All Contracts
                    </>
                  )}
                </button>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Transaction Logs</h3>
                <p className="text-sm text-gray-400 mb-4">
                  View recent administrative actions and system events.
                </p>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
                  <Activity className="w-4 h-4" />
                  View Logs
                </button>
              </div>
            </div>
          </GrainCard>
        </div>

        {/* NAV History Chart */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Price History</h2>
          <NavChart history={history} period="all" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Web3Provider>
      <AdminContent />
    </Web3Provider>
  );
}
