'use client';

import { useState } from 'react';
import { Web3Provider } from '@/app/components/grain/Web3Provider';
import { WalletConnect } from '@/app/components/grain/WalletConnect';
import { NavDisplay } from '@/app/components/grain/NavDisplay';
import { MetricCard } from '@/app/components/grain/MetricCard';
import { AssetBreakdown } from '@/app/components/grain/AssetBreakdown';
import { NavChart } from '@/app/components/grain/NavChart';
import { VestingTimeline } from '@/app/components/grain/VestingTimeline';
import { GrainCard } from '@/app/components/grain/GrainCard';
import { useGrain } from '@/app/hooks/useGrain';
import { useVault } from '@/app/hooks/useVault';
import { useAccount } from 'wagmi';
import {
  TrendingUp,
  Coins,
  Shield,
  ExternalLink,
  Download,
  RefreshCw,
  Wallet,
  Lock,
  Unlock,
} from 'lucide-react';

function DashboardContent() {
  const { address, isConnected } = useAccount();
  const { balance, nav, totalSupply, vestingSchedule, isLoading: grainLoading, refetch: refetchGrain } = useGrain();
  const { totalAssets, tiers, history, lastUpdate, isLoading: vaultLoading, refetch: refetchVault } = useVault();
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  const handleRefresh = () => {
    refetchGrain();
    refetchVault();
  };

  const currentHistory = history[history.length - 1];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">GRAIN Dashboard</h1>
              <p className="text-gray-400">Real-time transparency into the GRAIN ecosystem</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* NAV Hero */}
        <div className="mb-8">
          <GrainCard className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <div className="flex items-center justify-between">
              <NavDisplay size="large" showChange={true} />
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Last Updated</p>
                <p className="text-white font-semibold">
                  {lastUpdate ? new Date(lastUpdate * 1000).toLocaleString() : 'Loading...'}
                </p>
              </div>
            </div>
          </GrainCard>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            label="24h Change"
            value={currentHistory?.change24h?.toFixed(2) || '0.00'}
            suffix="%"
            loading={vaultLoading}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <MetricCard
            label="Total Supply"
            value={parseFloat(totalSupply).toLocaleString()}
            suffix=" GRAIN"
            loading={grainLoading}
            icon={<Coins className="w-5 h-5" />}
          />
          <MetricCard
            label="Total Assets"
            value={parseFloat(totalAssets).toLocaleString()}
            prefix="$"
            loading={vaultLoading}
            icon={<Shield className="w-5 h-5" />}
          />
          <MetricCard
            label="All-Time High"
            value="1.0417"
            prefix="$"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Investor Dashboard (if connected) */}
        {isConnected && balance && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6">Your Portfolio</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <GrainCard title="Total Balance">
                <div className="flex items-baseline gap-2">
                  <Wallet className="w-6 h-6 text-wells-gold" />
                  <span className="text-3xl font-bold">{parseFloat(balance.total).toLocaleString()}</span>
                  <span className="text-gray-400">GRAIN</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  ≈ ${(parseFloat(balance.total) * parseFloat(nav)).toLocaleString()}
                </p>
              </GrainCard>

              <GrainCard title="Locked">
                <div className="flex items-baseline gap-2">
                  <Lock className="w-6 h-6 text-gray-500" />
                  <span className="text-3xl font-bold">{parseFloat(balance.locked).toLocaleString()}</span>
                  <span className="text-gray-400">GRAIN</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {vestingSchedule && `${vestingSchedule.percentVested.toFixed(1)}% vested`}
                </p>
              </GrainCard>

              <GrainCard title="Unlocked">
                <div className="flex items-baseline gap-2">
                  <Unlock className="w-6 h-6 text-green-500" />
                  <span className="text-3xl font-bold text-green-500">
                    {parseFloat(balance.unlocked).toLocaleString()}
                  </span>
                  <span className="text-gray-400">GRAIN</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Available to transfer</p>
              </GrainCard>
            </div>

            {vestingSchedule && (
              <div className="mb-8">
                <VestingTimeline schedule={vestingSchedule} />
              </div>
            )}

            <GrainCard title="Unrealized Gain/Loss">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Cost Basis</p>
                  <p className="text-2xl font-bold text-white">
                    ${(parseFloat(balance.total) * 1.0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Assuming $1.00 locked price</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Current Value</p>
                  <p className="text-2xl font-bold text-white">
                    ${(parseFloat(balance.total) * parseFloat(nav)).toLocaleString()}
                  </p>
                  <p className="text-xs text-green-500 mt-1">
                    +${((parseFloat(balance.total) * parseFloat(nav)) - (parseFloat(balance.total) * 1.0)).toLocaleString()} (+{((parseFloat(nav) - 1.0) / 1.0 * 100).toFixed(2)}%)
                  </p>
                </div>
              </div>
            </GrainCard>
          </div>
        )}

        {/* Charts & Analytics */}
        <div className="grid md:grid-cols-1 gap-6 mb-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">NAV History</h2>
              <div className="flex gap-2">
                {(['24h', '7d', '30d', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      period === p
                        ? 'bg-wells-gold text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <NavChart history={history} period={period} />
          </div>
        </div>

        {/* Asset Breakdown */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Asset Breakdown</h2>
          <AssetBreakdown tiers={tiers} totalAssets={totalAssets} />
        </div>

        {/* Transparency Features */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Transparency & Verification</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GrainCard title="Reserve Proof" subtitle="Real-time on-chain verification">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total GRAIN Supply</span>
                  <span className="text-white font-mono">{parseFloat(totalSupply).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Vault Assets</span>
                  <span className="text-white font-mono">${parseFloat(totalAssets).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Backing Ratio</span>
                  <span className="text-green-500 font-mono">
                    {((parseFloat(totalAssets) / (parseFloat(totalSupply) * parseFloat(nav))) * 100).toFixed(2)}%
                  </span>
                </div>
                <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors text-sm">
                  <ExternalLink className="w-4 h-4" />
                  View on Base Explorer
                </button>
              </div>
            </GrainCard>

            <GrainCard title="Audit Reports" subtitle="Independent third-party audits">
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-wells-gold" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Q4 2025 Audit Report</p>
                      <p className="text-xs text-gray-400">Deloitte • December 2025</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-wells-gold" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Smart Contract Audit</p>
                      <p className="text-xs text-gray-400">OpenZeppelin • November 2025</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-green-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Insurance Certificate</p>
                      <p className="text-xs text-gray-400">$50M Coverage • Lloyd's of London</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </GrainCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Web3Provider>
      <DashboardContent />
    </Web3Provider>
  );
}
