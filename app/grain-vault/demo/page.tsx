'use client'

/**
 * Grain & Vault Interactive Demo
 *
 * A hands-on demo that shows the power of the Treasury SDK
 * - Initialize treasury wallet
 * - Make instant payments
 * - View real-time dashboard
 * - Experience zero friction
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Send,
  CheckCircle,
  Clock,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  ArrowLeft,
  Play,
  RefreshCw,
  Building2,
  DollarSign,
  Activity,
  Lock,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  Users,
  FileText,
} from 'lucide-react'

// Demo mock data
const DEMO_DATA = {
  wallet: {
    id: 'treasury_acme_corp_demo',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    balance: 2487594,
    creditLine: 2487594,
    creditUsed: 0,
    appreciation: 3.2,
  },
  vendors: [
    { id: 'v-001', name: 'Tech Supplies Inc', address: '0x1234...5678', terms: 'Net-30', lastPayment: 25000 },
    { id: 'v-002', name: 'Industrial Motors Co', address: '0x2345...6789', terms: 'Net-15', lastPayment: 156000 },
    { id: 'v-003', name: 'Global Logistics LLC', address: '0x3456...7890', terms: 'Net-45', lastPayment: 45000 },
    { id: 'v-004', name: 'Raw Materials Direct', address: '0x4567...8901', terms: 'Net-30', lastPayment: 89000 },
  ],
  transactions: [
    { id: 'tx-001', vendor: 'Tech Supplies Inc', amount: 25000, reference: 'PO-2024-001234', time: '0.8s', status: 'completed' },
    { id: 'tx-002', vendor: 'Industrial Motors Co', amount: 156000, reference: 'PO-2024-001235', time: '0.6s', status: 'completed' },
    { id: 'tx-003', vendor: 'Global Logistics LLC', amount: 45000, reference: 'PO-2024-001236', time: '0.9s', status: 'completed' },
  ]
}

type DemoStep = 'intro' | 'initialize' | 'payment' | 'dashboard' | 'complete'

export default function GrainVaultDemo() {
  const [step, setStep] = useState<DemoStep>('intro')
  const [isProcessing, setIsProcessing] = useState(false)
  const [walletInitialized, setWalletInitialized] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(DEMO_DATA.vendors[0])
  const [paymentAmount, setPaymentAmount] = useState('25000')
  const [poReference, setPOReference] = useState('PO-2024-001237')
  const [settlementTime, setSettlementTime] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [balance, setBalance] = useState(DEMO_DATA.wallet.balance)
  const [transactions, setTransactions] = useState(DEMO_DATA.transactions)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleInitialize = async () => {
    setIsProcessing(true)
    // Simulate wallet initialization
    await new Promise(resolve => setTimeout(resolve, 1500))
    setWalletInitialized(true)
    setIsProcessing(false)
    // Auto-advance after showing success
    setTimeout(() => setStep('payment'), 1500)
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    const startTime = Date.now()

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 800))

    const endTime = Date.now()
    const time = ((endTime - startTime) / 1000).toFixed(1)
    setSettlementTime(time)

    // Update balance and transactions
    const amount = parseInt(paymentAmount)
    setBalance(prev => prev - amount)
    setTransactions(prev => [{
      id: `tx-${Date.now()}`,
      vendor: selectedVendor.name,
      amount,
      reference: poReference,
      time: `${time}s`,
      status: 'completed'
    }, ...prev])

    setPaymentComplete(true)
    setIsProcessing(false)
  }

  const resetDemo = () => {
    setStep('intro')
    setWalletInitialized(false)
    setPaymentComplete(false)
    setSettlementTime(null)
    setBalance(DEMO_DATA.wallet.balance)
    setTransactions(DEMO_DATA.transactions)
    setPaymentAmount('25000')
    setPOReference('PO-2024-001237')
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(DEMO_DATA.wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/grain-vault" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">Grain & Vault</span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">Interactive Demo</span>
              <button
                onClick={resetDemo}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {['intro', 'initialize', 'payment', 'dashboard'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${step === s ? 'bg-amber-500 text-black' :
                    ['intro', 'initialize', 'payment', 'dashboard'].indexOf(step) > i ? 'bg-green-500 text-black' :
                    'bg-white/10 text-gray-500'}
                `}>
                  {['intro', 'initialize', 'payment', 'dashboard'].indexOf(step) > i ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={`
                    w-16 md:w-24 h-0.5 mx-2 transition-colors
                    ${['intro', 'initialize', 'payment', 'dashboard'].indexOf(step) > i ? 'bg-green-500' : 'bg-white/10'}
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 lg:px-8 py-12">

        {/* Step 1: Intro */}
        {step === 'intro' && (
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full text-amber-400 text-sm font-medium mb-8">
              <Play className="w-4 h-4" />
              Interactive Demo
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Experience <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Zero Friction</span>
            </h1>

            <p className="text-xl text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
              See how the Treasury SDK transforms B2B payments. Initialize a wallet,
              make instant payments, and watch your treasury dashboard update in real-time.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                { icon: Wallet, title: 'Initialize Wallet', desc: 'Create your treasury wallet in seconds' },
                { icon: Send, title: 'Instant Payments', desc: 'Pay vendors with sub-second settlement' },
                { icon: Activity, title: 'Live Dashboard', desc: 'Real-time treasury visibility' },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('initialize')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all shadow-2xl shadow-amber-500/25"
            >
              Start Demo
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 2: Initialize Wallet */}
        {step === 'initialize' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-center">Initialize Treasury Wallet</h2>
            <p className="text-gray-400 text-center mb-8">
              Create your GRAIN treasury wallet with Circle's secure infrastructure
            </p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              {!walletInitialized ? (
                <>
                  <div className="bg-black/50 rounded-xl p-6 mb-6 font-mono text-sm">
                    <div className="text-gray-500 mb-2">// treasury-init.ts</div>
                    <div>
                      <span className="text-purple-400">import</span> {'{'} createTreasurySDK {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'@grainandvault/sdk'</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-blue-400">const</span> treasury = <span className="text-yellow-400">createTreasurySDK</span>({'{'}
                    </div>
                    <div className="pl-4">apiKey: process.env.<span className="text-green-400">GRAIN_VAULT_KEY</span>,</div>
                    <div className="pl-4">organization: <span className="text-green-400">'acme-corp'</span>,</div>
                    <div className="pl-4">erp: {'{'} type: <span className="text-green-400">'netsuite'</span> {'}'}</div>
                    <div>{'}'});</div>
                    <div className="mt-4">
                      <span className="text-purple-400">await</span> treasury.<span className="text-yellow-400">initialize</span>()
                    </div>
                  </div>

                  <button
                    onClick={handleInitialize}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5" />
                        Initialize Wallet
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Wallet Created!</h3>
                  <p className="text-gray-400 mb-6">Your treasury wallet is ready</p>

                  <div className="bg-black/50 rounded-xl p-4 mb-6">
                    <div className="text-sm text-gray-500 mb-2">Wallet Address</div>
                    <div className="flex items-center justify-between gap-4">
                      <code className="text-amber-400 font-mono text-sm truncate">
                        {DEMO_DATA.wallet.address}
                      </code>
                      <button
                        onClick={copyAddress}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/50 rounded-xl p-4">
                      <div className="text-sm text-gray-500 mb-1">GRAIN Balance</div>
                      <div className="text-2xl font-bold text-amber-400">{formatCurrency(balance)}</div>
                    </div>
                    <div className="bg-black/50 rounded-xl p-4">
                      <div className="text-sm text-gray-500 mb-1">Credit Line</div>
                      <div className="text-2xl font-bold text-green-400">{formatCurrency(DEMO_DATA.wallet.creditLine)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Make Payment */}
        {step === 'payment' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-center">Make Instant Payment</h2>
            <p className="text-gray-400 text-center mb-8">
              Pay a vendor with sub-second settlement. No chargebacks. No failed payments.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Payment Form */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-semibold mb-6 flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" />
                  Payment Details
                </h3>

                {!paymentComplete ? (
                  <>
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">Select Vendor</label>
                        <select
                          value={selectedVendor.id}
                          onChange={(e) => setSelectedVendor(DEMO_DATA.vendors.find(v => v.id === e.target.value) || DEMO_DATA.vendors[0])}
                          className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                        >
                          {DEMO_DATA.vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-gray-400 block mb-2">Amount (GRAIN)</label>
                        <input
                          type="text"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          placeholder="25000"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-gray-400 block mb-2">PO Reference</label>
                        <input
                          type="text"
                          value={poReference}
                          onChange={(e) => setPOReference(e.target.value)}
                          className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                          placeholder="PO-2024-001237"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handlePayment}
                      disabled={isProcessing || !paymentAmount}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          Pay {formatCurrency(parseInt(paymentAmount) || 0)} GRAIN
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Payment Complete!</h3>
                    <p className="text-gray-400 mb-4">Settled in {settlementTime} seconds</p>

                    <div className="bg-black/50 rounded-xl p-4 text-left">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Vendor</span>
                        <span>{selectedVendor.name}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Amount</span>
                        <span className="text-amber-400">{formatCurrency(parseInt(paymentAmount))} GRAIN</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Reference</span>
                        <span>{poReference}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Settlement</span>
                        <span className="text-green-400">{settlementTime}s</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep('dashboard')}
                      className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      View Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-semibold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Live Treasury
                </h3>

                <div className="space-y-4">
                  <div className="bg-black/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Current Balance</span>
                      <Wallet className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(balance)} <span className="text-amber-400 text-lg">GRAIN</span></div>
                    <div className="text-xs text-green-400 mt-1">+{DEMO_DATA.wallet.appreciation}% appreciation</div>
                  </div>

                  <div className="bg-black/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Credit Available</span>
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">{formatCurrency(DEMO_DATA.wallet.creditLine)}</div>
                    <div className="text-xs text-gray-500 mt-1">1:1 collateral ratio</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/50 rounded-xl p-4">
                      <div className="text-sm text-gray-500 mb-1">Avg Settlement</div>
                      <div className="text-xl font-bold">0.8s</div>
                    </div>
                    <div className="bg-black/50 rounded-xl p-4">
                      <div className="text-sm text-gray-500 mb-1">Failed Payments</div>
                      <div className="text-xl font-bold text-purple-400">0</div>
                    </div>
                  </div>

                  <div className="bg-black/50 rounded-xl p-4">
                    <div className="text-sm text-gray-500 mb-3">Recent Transactions</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {transactions.slice(0, 3).map((tx, i) => (
                        <div key={tx.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 truncate">{tx.vendor}</span>
                          <span className="text-amber-400">-{formatCurrency(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Dashboard */}
        {step === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">Treasury Dashboard</h2>
                <p className="text-gray-400">Real-time visibility into your B2B payments</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'GRAIN Balance', value: formatCurrency(balance), sub: `+${DEMO_DATA.wallet.appreciation}% appreciation`, icon: Wallet, color: 'amber' },
                { label: 'Credit Available', value: formatCurrency(DEMO_DATA.wallet.creditLine), sub: '1:1 collateral ratio', icon: TrendingUp, color: 'green' },
                { label: 'Avg Settlement', value: '0.8s', sub: 'vs 3-5 days traditional', icon: Clock, color: 'purple' },
                { label: 'Failed Payments', value: '0', sub: 'Zero chargebacks', icon: Shield, color: 'blue' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500">{stat.label}</span>
                    <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                  </div>
                  <div className={`text-3xl font-bold mb-1 ${stat.color === 'amber' ? 'text-amber-400' : stat.color === 'green' ? 'text-green-400' : stat.color === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500">{stat.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* Transaction History */}
              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Transaction History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b border-white/10">
                        <th className="pb-3">Vendor</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Reference</th>
                        <th className="pb-3">Settlement</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-white/5 text-sm">
                          <td className="py-3">{tx.vendor}</td>
                          <td className="py-3 text-amber-400">{formatCurrency(tx.amount)} GRAIN</td>
                          <td className="py-3 text-gray-400 font-mono text-xs">{tx.reference}</td>
                          <td className="py-3">{tx.time}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vendor Network */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Vendor Network
                </h3>
                <div className="space-y-3">
                  {DEMO_DATA.vendors.map((vendor) => (
                    <div key={vendor.id} className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{vendor.name}</div>
                        <div className="text-xs text-gray-500">{vendor.terms}</div>
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{vendor.address}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Complete CTA */}
            <div className="bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/20 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Ready to eliminate payment friction?</h3>
              <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                You've just experienced the future of B2B payments. Sub-second settlement,
                zero chargebacks, and complete treasury visibility.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:sdk@grainandvault.com?subject=Treasury SDK Access Request&body=I just completed the Grain %26 Vault demo and I'm interested in getting SDK access for my organization.%0A%0ACompany:%0AUse Case:%0AExpected Monthly Volume:"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all"
                >
                  Request SDK Access
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link
                  href="/grain-vault"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                >
                  Back to Overview
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/[0.02] mt-12">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© 2025 Grain & Vault. All rights reserved.</p>
            <p>
              Grain & Vault is a{' '}
              <Link href="https://wellsonyx.io" className="text-amber-400 hover:text-amber-300 transition-colors">
                Wells Onyx
              </Link>
              {' '}portfolio company.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
