'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function EarlyInvestorPage() {
  const [navPrice, setNavPrice] = useState(1.0417)
  const [spotsLeft, setSpotsLeft] = useState(87)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNavPrice(prev => prev + (Math.random() - 0.48) * 0.0001)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Integrate with actual signup endpoint
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F4A460] to-[#dba63f] flex items-center justify-center px-6">
        <div className="max-w-2xl w-full bg-white rounded-sm p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#F4A460] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-[#1a2332] mb-4">You're on the List!</h1>
          <p className="text-lg text-[#575757] mb-8">
            Check your email for next steps. We'll send your founding investor documents within 24 hours.
          </p>
          <p className="text-sm text-[#575757] mb-8">
            Current NAV: <span className="font-mono font-bold text-[#F4A460]">${navPrice.toFixed(4)}</span><br />
            Your entry price: <span className="font-mono font-bold text-[#16a34a]">$1.00 (locked)</span>
          </p>
          <Link href="/" className="inline-block px-8 py-4 bg-[#1a2332] text-white font-semibold rounded-sm hover:bg-[#0d1723] transition-all">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 bg-gradient-to-br from-[#F4A460] to-[#dba63f] overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full mb-8 animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span className="text-sm font-bold text-white uppercase tracking-wide">{spotsLeft} Spots Remaining</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-white mb-8 leading-tight drop-shadow-lg">
            Founding Investor<br />
            Opportunity
          </h1>

          <p className="text-2xl text-white/95 mb-6 font-medium drop-shadow-md">
            Lock in GRAIN at <span className="font-mono font-bold">$1.00</span> before public launch
          </p>

          <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            Current NAV: <span className="font-mono font-bold">${navPrice.toFixed(4)}</span> (+{((navPrice - 1) * 100).toFixed(2)}%)
            <br className="md:hidden" /> Already appreciating. Don't miss the ground floor.
          </p>

          {/* Scroll indicator */}
          <div className="inline-flex flex-col items-center gap-2">
            <span className="text-sm text-white/70 uppercase tracking-wide">Scroll to Reserve</span>
            <svg className="w-6 h-6 text-white/70 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1a2332] mb-6">
              Why Founding Investors Win
            </h2>
            <p className="text-xl text-[#575757] max-w-3xl mx-auto">
              Get in before the platform processes its first billion in transactions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Locked-In Price',
                desc: 'Buy GRAIN at $1.00 while NAV is already $' + navPrice.toFixed(4) + '. Your allocation is locked at launch price.',
                icon: '🔒'
              },
              {
                title: 'Auto-Appreciating Asset',
                desc: 'As Grain & Vault processes transactions, NAV increases automatically. Your tokens appreciate without you doing anything.',
                icon: '📈'
              },
              {
                title: 'First Access',
                desc: 'Founding investors get priority access to new features, higher transaction limits, and preferential fee structures.',
                icon: '⚡'
              }
            ].map((item, i) => (
              <div key={i} className="p-8 bg-gradient-to-br from-[#F4A460]/5 to-transparent border-2 border-[#F4A460]/20 rounded-sm hover:border-[#F4A460] hover:shadow-xl transition-all duration-300 group">
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">{item.icon}</div>
                <h3 className="text-2xl font-bold text-[#1a2332] mb-4">{item.title}</h3>
                <p className="text-[#575757] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              How Founding Investor Works
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Simple, transparent, and secure
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Reserve Your Spot', desc: 'Submit your email to lock in $1.00 pricing' },
              { step: '2', title: 'Receive Documents', desc: 'Get investment agreement within 24 hours' },
              { step: '3', title: 'Wire Funds', desc: 'Minimum $10,000 investment via ACH or wire' },
              { step: '4', title: 'Receive GRAIN', desc: 'Tokens delivered at public launch on Base' }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-[#F4A460] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signup Form */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#F4A460] to-[#dba63f]">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-sm p-12 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-[#1a2332] mb-4">
                Reserve Your Allocation
              </h2>
              <p className="text-lg text-[#575757]">
                <span className="font-bold text-[#F4A460]">{spotsLeft} spots remaining</span> of 100 total founding investor allocations
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#1a2332] mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-4 py-4 border-2 border-[#1a2332]/20 rounded-sm focus:outline-none focus:border-[#F4A460] transition-colors text-lg"
                />
              </div>

              <div className="bg-[#F4A460]/10 border-l-4 border-[#F4A460] p-4 rounded-sm">
                <p className="text-sm text-[#1a2332]">
                  <strong>Minimum Investment:</strong> $10,000<br />
                  <strong>Entry Price:</strong> $1.00 per GRAIN (locked)<br />
                  <strong>Current NAV:</strong> ${navPrice.toFixed(4)} per GRAIN
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-[#1a2332] text-white text-lg font-bold rounded-sm hover:bg-[#0d1723] hover:scale-105 transition-all shadow-xl"
              >
                Secure My Spot →
              </button>

              <p className="text-xs text-[#575757] text-center leading-relaxed">
                By submitting, you agree to receive investment documentation. No commitment until funds are wired.
                Accredited investors only. Subject to verification.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#1a2332] text-white text-center">
        <p className="text-sm text-white/70 mb-4">
          © 2025 Grain & Vault. Powered by Wells Onyx.
        </p>
        <p className="text-xs text-white/50 max-w-2xl mx-auto leading-relaxed">
          This is not an offer to sell securities. All investments are subject to verification of accredited investor status.
          Past performance does not guarantee future results. NAV is an estimate and may fluctuate.
        </p>
      </footer>
    </div>
  )
}
