'use client';

import { useState } from 'react';
import { Web3Provider } from '@/app/components/grain/Web3Provider';
import { WalletConnect } from '@/app/components/grain/WalletConnect';
import { NavDisplay } from '@/app/components/grain/NavDisplay';
import { CountdownTimer } from '@/app/components/grain/CountdownTimer';
import { InvestmentCalculator } from '@/app/components/grain/InvestmentCalculator';
import { GrainCard } from '@/app/components/grain/GrainCard';
import { useGrain } from '@/app/hooks/useGrain';
import { useAccount } from 'wagmi';
import {
  Sparkles,
  Lock,
  Shield,
  TrendingUp,
  Users,
  CheckCircle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const LOCKED_PRICE = 1.0;
const CURRENT_NAV = 1.0417;
const SPOTS_TOTAL = 100;
const SPOTS_REMAINING = 87;
const LAUNCH_DATE = new Date('2026-01-01T00:00:00Z');
const MINIMUM_INVESTMENT = 10000;

function InvestPageContent() {
  const { address, isConnected } = useAccount();
  const { mint, isLoading, balance } = useGrain();
  const [amount, setAmount] = useState('10000');
  const [kycData, setKycData] = useState({
    name: '',
    email: '',
    address: '',
    accredited: false,
  });
  const [step, setStep] = useState<'landing' | 'kyc' | 'invest' | 'confirm'>('landing');
  const [txHash, setTxHash] = useState<string>('');

  const handleKycSubmit = () => {
    if (kycData.name && kycData.email && kycData.address && kycData.accredited) {
      setStep('invest');
    }
  };

  const handleInvest = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    const investAmount = parseFloat(amount);
    if (investAmount < MINIMUM_INVESTMENT) {
      alert(`Minimum investment is $${MINIMUM_INVESTMENT.toLocaleString()}`);
      return;
    }

    try {
      await mint(amount);
      setStep('confirm');
      setTxHash('0x...');
    } catch (error) {
      console.error('Investment failed:', error);
      alert('Investment failed. Please try again.');
    }
  };

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Investment Confirmed!</h1>
            <p className="text-xl text-gray-400">
              Welcome to the Founding Investor Program
            </p>
          </div>

          <GrainCard className="mb-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Investment Amount</span>
                <span className="text-white font-semibold">${parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">GRAIN Received</span>
                <span className="text-white font-semibold">
                  {(parseFloat(amount) / LOCKED_PRICE).toLocaleString()} GRAIN
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Locked Price</span>
                <span className="text-white font-semibold">${LOCKED_PRICE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current NAV</span>
                <span className="text-green-500 font-semibold">${CURRENT_NAV.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transaction Hash</span>
                <span className="text-blue-400 font-mono text-sm">{txHash}</span>
              </div>
            </div>
          </GrainCard>

          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">What's Next?</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your GRAIN tokens are now in your wallet</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Vesting begins immediately with a 6-month cliff</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Track your investment in the Investor Dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Receive monthly NAV updates via email</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <a
              href="/grain/dashboard"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-wells-gold hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
            >
              View Dashboard
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="/grain"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'invest') {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Complete Your Investment</h1>
            <p className="text-xl text-gray-400">
              Lock in your $1.00 GRAIN price before launch
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <InvestmentCalculator lockedPrice={LOCKED_PRICE} currentNav={CURRENT_NAV} />
            </div>

            <div className="space-y-6">
              <GrainCard title="Investment Summary">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Investor</span>
                    <span className="text-white font-semibold">{kycData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email</span>
                    <span className="text-white font-semibold">{kycData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accredited Status</span>
                    <span className="text-green-500 font-semibold">Verified</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wallet</span>
                    <span className="text-blue-400 font-mono text-sm">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                </div>
              </GrainCard>

              <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border border-yellow-700/50 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-200 font-medium mb-1">Important Notice</p>
                    <p className="text-yellow-300 text-sm">
                      Your GRAIN tokens will vest over 24 months with a 6-month cliff. Ensure you understand
                      the vesting terms before proceeding.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleInvest}
                disabled={isLoading || !isConnected}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-wells-gold hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
              >
                {isLoading ? 'Processing...' : 'Confirm Investment'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'kyc') {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Investor Verification</h1>
            <p className="text-xl text-gray-400">
              Please provide your information to continue
            </p>
          </div>

          <GrainCard>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={kycData.name}
                  onChange={(e) => setKycData({ ...kycData, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={kycData.email}
                  onChange={(e) => setKycData({ ...kycData, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Residential Address
                </label>
                <textarea
                  value={kycData.address}
                  onChange={(e) => setKycData({ ...kycData, address: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-wells-gold"
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kycData.accredited}
                    onChange={(e) => setKycData({ ...kycData, accredited: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-gray-600 text-wells-gold focus:ring-wells-gold"
                  />
                  <div>
                    <p className="text-white font-medium mb-1">Accredited Investor Status</p>
                    <p className="text-sm text-gray-400">
                      I certify that I am an accredited investor as defined by SEC Rule 501 of Regulation D,
                      with either $1M+ net worth (excluding primary residence) or $200K+ annual income.
                    </p>
                  </div>
                </label>
              </div>

              <button
                onClick={handleKycSubmit}
                disabled={!kycData.name || !kycData.email || !kycData.address || !kycData.accredited}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-wells-gold hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
              >
                Continue to Investment
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </GrainCard>
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-wells-blue/20 to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-wells-gold/20 border border-wells-gold/50 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-wells-gold" />
              <span className="text-sm font-medium text-wells-gold">Founding Investor Program</span>
            </div>
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Lock in $1.00 GRAIN
              <br />
              Before Public Launch
            </h1>
            <p className="text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
              Join 13 institutional investors backing the first asset-backed stablecoin with real-world utility
            </p>

            <div className="flex items-center justify-center gap-6 mb-12">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Current NAV</p>
                <p className="text-3xl font-bold text-green-500">${CURRENT_NAV.toFixed(4)}</p>
              </div>
              <div className="w-px h-12 bg-gray-700" />
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Your Price</p>
                <p className="text-3xl font-bold text-wells-gold">${LOCKED_PRICE.toFixed(2)}</p>
              </div>
              <div className="w-px h-12 bg-gray-700" />
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Spots Remaining</p>
                <p className="text-3xl font-bold text-white">
                  {SPOTS_REMAINING}/{SPOTS_TOTAL}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mb-12">
              {!isConnected ? (
                <WalletConnect />
              ) : (
                <button
                  onClick={() => setStep('kyc')}
                  className="flex items-center gap-2 px-8 py-4 bg-wells-gold hover:bg-yellow-600 text-black font-bold text-lg rounded-lg transition-colors"
                >
                  Start Investment
                  <ArrowRight className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="max-w-2xl mx-auto">
              <CountdownTimer targetDate={LAUNCH_DATE} label="Public launch in" />
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Why Join as a Founding Investor?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <GrainCard>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-wells-gold/20 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-wells-gold" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Locked $1.00 Price</h3>
              <p className="text-gray-400">
                Your price is locked at $1.00 per GRAIN, regardless of future NAV increases
              </p>
            </div>
          </GrainCard>

          <GrainCard>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">NAV Already at $1.0417</h3>
              <p className="text-gray-400">
                Immediate unrealized gain of 4.17% on day one
              </p>
            </div>
          </GrainCard>

          <GrainCard>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Asset-Backed Security</h3>
              <p className="text-gray-400">
                Backed by $50M+ in real assets across 5 tiers
              </p>
            </div>
          </GrainCard>
        </div>
      </div>

      {/* Calculator */}
      <div className="max-w-4xl mx-auto px-4 py-20">
        <InvestmentCalculator lockedPrice={LOCKED_PRICE} currentNav={CURRENT_NAV} />
      </div>

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-wells-blue to-blue-900 rounded-2xl p-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Invest?</h2>
          <p className="text-xl text-blue-200 mb-8">
            Join the founding round before all 100 spots are filled
          </p>
          {!isConnected ? (
            <WalletConnect />
          ) : (
            <button
              onClick={() => setStep('kyc')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-wells-gold hover:bg-yellow-600 text-black font-bold text-lg rounded-lg transition-colors"
            >
              Start Investment Process
              <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvestPage() {
  return (
    <Web3Provider>
      <InvestPageContent />
    </Web3Provider>
  );
}
