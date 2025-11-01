import Link from 'next/link'

export default function DocsPage() {
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
            Documentation
          </h1>
          <p className="text-xl text-[#575757] leading-relaxed">
            Everything you need to build with Wells AI
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Quick Start */}
          <div className="mb-16">
            <h2 className="text-3xl font-serif text-[#183b6d] mb-6">Quick Start</h2>
            <div className="bg-[#183b6d]/5 border border-[#9ea1a7]/20 rounded-sm p-8">
              <div className="prose max-w-none">
                <p className="text-[#575757] mb-4">
                  Wells AI is the enterprise conversational commerce platform. Get started in minutes:
                </p>
                <ol className="space-y-2 text-[#575757]">
                  <li>Sign up at <Link href="/app" className="text-[#dba63f] hover:text-[#c89430]">/app</Link></li>
                  <li>Configure your ICP (Ideal Customer Profile)</li>
                  <li>Let Wells AI handle the rest</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Documentation Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* SDK Documentation */}
            <Link href="/docs/sdk" className="block group">
              <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm p-8 hover:border-[#dba63f] transition-all h-full">
                <div className="w-12 h-12 bg-[#183b6d]/5 rounded-sm flex items-center justify-center text-[#183b6d] group-hover:bg-[#dba63f] group-hover:text-white transition-all mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-serif text-[#183b6d] mb-3">SDK Documentation</h3>
                <p className="text-[#575757] mb-4">
                  Complete API reference for Wells GTM SDK and Partner SDK. Install in one line and automate your entire go-to-market.
                </p>
                <div className="flex items-center text-[#dba63f] group-hover:text-[#c89430] font-medium">
                  View SDK Docs →
                </div>
              </div>
            </Link>

            {/* API Reference */}
            <div className="block group opacity-50 cursor-not-allowed">
              <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm p-8 h-full">
                <div className="w-12 h-12 bg-[#183b6d]/5 rounded-sm flex items-center justify-center text-[#183b6d] mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-serif text-[#183b6d] mb-3">API Reference</h3>
                <p className="text-[#575757] mb-4">
                  REST API documentation for building custom integrations with Wells AI platform.
                </p>
                <div className="flex items-center text-[#575757] font-medium">
                  Coming Soon
                </div>
              </div>
            </div>

            {/* Guides */}
            <div className="block group opacity-50 cursor-not-allowed">
              <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm p-8 h-full">
                <div className="w-12 h-12 bg-[#183b6d]/5 rounded-sm flex items-center justify-center text-[#183b6d] mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-2xl font-serif text-[#183b6d] mb-3">Integration Guides</h3>
                <p className="text-[#575757] mb-4">
                  Step-by-step guides for integrating Wells AI with your existing tools and workflows.
                </p>
                <div className="flex items-center text-[#575757] font-medium">
                  Coming Soon
                </div>
              </div>
            </div>

            {/* Changelog */}
            <Link href="/docs/changelog" className="block group">
              <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm p-8 hover:border-[#dba63f] transition-all h-full">
                <div className="w-12 h-12 bg-[#183b6d]/5 rounded-sm flex items-center justify-center text-[#183b6d] group-hover:bg-[#dba63f] group-hover:text-white transition-all mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-serif text-[#183b6d] mb-3">Changelog</h3>
                <p className="text-[#575757] mb-4">
                  Track new features, improvements, and updates to the Wells AI platform.
                </p>
                <div className="flex items-center text-[#dba63f] group-hover:text-[#c89430] font-medium">
                  View Changelog →
                </div>
              </div>
            </Link>
          </div>

          {/* Support Section */}
          <div className="bg-[#183b6d] text-white rounded-sm p-12">
            <div className="text-center">
              <h2 className="text-3xl font-serif mb-4">Need Help?</h2>
              <p className="text-white/80 mb-8 max-w-2xl mx-auto">
                Our team is here to support you. Reach out with questions, feedback, or feature requests.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact"
                  className="px-8 py-3 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89430] transition-all"
                >
                  Contact Support
                </Link>
                <a
                  href="mailto:hello@wellsonyx.com"
                  className="px-8 py-3 bg-white/10 text-white font-medium rounded-sm hover:bg-white/20 transition-all"
                >
                  Email Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
