import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-[#9ea1a7]/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="12" r="3" fill="#183b6d" />
              <line x1="20" y1="15" x2="12" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="20" y2="32" stroke="#183b6d" strokeWidth="1.5" />
              <line x1="20" y1="15" x2="28" y2="28" stroke="#183b6d" strokeWidth="1.5" />
              <circle cx="12" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="28" cy="28" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="32" r="2.5" fill="#183b6d" />
              <circle cx="20" cy="12" r="1.5" fill="#dba63f" opacity="0.9" />
            </svg>
            <div>
              <div className="font-semibold text-[#183b6d] text-lg tracking-tight">Wells AI</div>
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Conversational Commerce</div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-[#183b6d] hover:text-[#dba63f] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6 bg-[#183b6d]/5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-serif text-[#183b6d] mb-6">
            About Wells AI
          </h1>
          <p className="text-xl text-[#575757] leading-relaxed">
            Building the future of enterprise transactions, one conversation at a time.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Vision */}
          <div>
            <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Our Vision</h2>
            <p className="text-lg text-[#575757] leading-relaxed mb-4">
              We believe that every enterprise transaction—from sourcing semiconductors to hiring executives—will one day begin with a simple conversation. Wells AI is built to make that future a reality.
            </p>
            <p className="text-lg text-[#575757] leading-relaxed">
              By combining conversational AI with deep industry expertise, we're creating a platform that understands what enterprises need and connects them with the right solutions, instantly.
            </p>
          </div>

          {/* What We Do */}
          <div>
            <h2 className="text-3xl font-serif text-[#183b6d] mb-4">What We Do</h2>
            <p className="text-lg text-[#575757] leading-relaxed mb-4">
              Wells AI powers enterprise transactions across industries through natural conversation. Whether you're procuring materials, finding executive talent, or accessing professional services, our AI-powered platform handles the complexity while you focus on what matters.
            </p>
            <div className="bg-[#183b6d]/5 border border-[#9ea1a7]/20 rounded-sm p-8 mt-6">
              <h3 className="text-xl font-semibold text-[#183b6d] mb-4">How It Works</h3>
              <ol className="space-y-3 text-[#575757]">
                <li className="flex gap-3">
                  <span className="font-bold text-[#dba63f]">1.</span>
                  <span>Describe what you need in plain language</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#dba63f]">2.</span>
                  <span>AI instantly matches you with qualified suppliers or candidates</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[#dba63f]">3.</span>
                  <span>Complete the transaction with transparent pricing and secure payments</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Part of Wells Onyx */}
          <div className="border-t border-[#9ea1a7]/20 pt-12">
            <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Part of the Wells Onyx Constellation</h2>
            <p className="text-lg text-[#575757] leading-relaxed mb-4">
              Wells AI is one of twelve specialized practice groups within{' '}
              <a
                href="https://www.wellsonyx.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#dba63f] hover:text-[#c89430] underline"
              >
                Wells Onyx
              </a>
              , a constellation-based organization focused on transformative change across industries.
            </p>
            <p className="text-lg text-[#575757] leading-relaxed mb-6">
              Wells Onyx operates as an interconnected ecosystem of specialized practices, unified leadership, and strategic partnerships. Each practice group—from Search & Strategy to AI Ops to Grain & Vault—is built on a foundation of trust, integrity, and purpose.
            </p>
            <div className="bg-white border-2 border-[#183b6d] rounded-sm p-8">
              <p className="text-xl font-serif text-[#183b6d] italic mb-4">
                "We're not chasing what shines for a moment. We're building what will shine for generations."
              </p>
              <p className="text-sm text-[#575757]">— Wells Onyx Philosophy</p>
            </div>
            <div className="mt-6">
              <a
                href="https://www.wellsonyx.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-3 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition-all"
              >
                Learn More About Wells Onyx →
              </a>
            </div>
          </div>

          {/* Our Principles */}
          <div>
            <h2 className="text-3xl font-serif text-[#183b6d] mb-4">Our Principles</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#183b6d]/5 p-6 rounded-sm">
                <h3 className="font-semibold text-[#183b6d] mb-2">Lead with Trust</h3>
                <p className="text-[#575757]">Every transaction on our platform is built on honesty, transparency, and intention.</p>
              </div>
              <div className="bg-[#183b6d]/5 p-6 rounded-sm">
                <h3 className="font-semibold text-[#183b6d] mb-2">Build with People</h3>
                <p className="text-[#575757]">Technology serves humanity—not the other way around. We build systems that empower people.</p>
              </div>
              <div className="bg-[#183b6d]/5 p-6 rounded-sm">
                <h3 className="font-semibold text-[#183b6d] mb-2">Scale with Purpose</h3>
                <p className="text-[#575757]">Growth should strengthen what matters, not dilute it. Every feature we build has a clear purpose.</p>
              </div>
              <div className="bg-[#183b6d]/5 p-6 rounded-sm">
                <h3 className="font-semibold text-[#183b6d] mb-2">Design for Endurance</h3>
                <p className="text-[#575757]">We're creating infrastructure meant to outlast trends and serve enterprises for decades.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[#183b6d]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-serif text-white mb-6">
            Ready to Experience the Future?
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Join us in building the next generation of enterprise commerce.
          </p>
          <Link
            href="/app"
            className="inline-block px-10 py-4 bg-[#dba63f] text-white text-lg font-semibold rounded-sm hover:bg-[#c89430] transition-all shadow-xl"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  )
}
