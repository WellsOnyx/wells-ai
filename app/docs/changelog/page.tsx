import Link from 'next/link'

export default function ChangelogPage() {
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
              <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Changelog</div>
            </div>
          </Link>
          <Link
            href="/docs"
            className="text-[#183b6d] hover:text-[#dba63f] transition-colors"
          >
            ← Back to Docs
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6 bg-[#183b6d]/5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-serif text-[#183b6d] mb-6">
            Changelog
          </h1>
          <p className="text-xl text-[#575757] leading-relaxed">
            Track new features, improvements, and updates to Wells AI
          </p>
        </div>
      </section>

      {/* Changelog Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {/* Version 1.0.0 */}
            <div className="relative pl-8 border-l-2 border-[#dba63f]">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#dba63f]"></div>
              <div className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-serif text-[#183b6d]">Version 1.0.0</h2>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-sm">
                    Current
                  </span>
                </div>
                <p className="text-sm text-[#575757]">November 1, 2025</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">🎉 Major Features</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Enterprise Marketing Site:</strong> Honest, prophetic messaging focused on vision and capabilities</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>About & Contact Pages:</strong> Full integration with Wells Onyx ecosystem and working contact forms</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>SDK Documentation:</strong> Comprehensive docs for GTM SDK and Partner SDK with code examples</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Legal Pages:</strong> Complete Terms of Service, Privacy Policy, and Security documentation</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">✨ Improvements</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span>Updated footer with prophetic vision statement</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span>Removed misleading metrics and fake customer counts</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span>Replaced platform-limiting language with open-ended Resources section</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 0.9.0 - Phase 3 */}
            <div className="relative pl-8 border-l-2 border-[#9ea1a7]/20">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#9ea1a7]/40"></div>
              <div className="mb-2">
                <h2 className="text-2xl font-serif text-[#183b6d]">Version 0.9.0 - Phase 3</h2>
                <p className="text-sm text-[#575757]">October 31, 2025</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">🚀 New Features</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Partner SDK Phase 1:</strong> Complete automation for 66+ partner ecosystems</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>GTM SDK v1.0:</strong> Full GTM automation at 33bps on closed ACV</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Negotiation Engine:</strong> Real-time collaborative negotiation with AI assistance</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Job Seeker System:</strong> Complete ATS integration with resume parsing and matching</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 0.8.0 - Phase 2 */}
            <div className="relative pl-8 border-l-2 border-[#9ea1a7]/20">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#9ea1a7]/40"></div>
              <div className="mb-2">
                <h2 className="text-2xl font-serif text-[#183b6d]">Version 0.8.0 - Phase 2</h2>
                <p className="text-sm text-[#575757]">October 29, 2025</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">🚀 New Features</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Multi-Organization Support:</strong> Complete org management with role-based access</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>GTM Dashboard:</strong> Real-time campaign tracking and attribution</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Twilio Integration:</strong> SMS notifications and two-way communication</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Version 0.7.0 - Initial Release */}
            <div className="relative pl-8 border-l-2 border-[#9ea1a7]/20">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#9ea1a7]/40"></div>
              <div className="mb-2">
                <h2 className="text-2xl font-serif text-[#183b6d]">Version 0.7.0 - Initial Release</h2>
                <p className="text-sm text-[#575757]">October 27, 2025</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">🎉 Initial Features</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Conversational RFQ:</strong> AI-powered procurement assistant</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Supplier Matching:</strong> Intelligent supplier discovery and matching</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Notion Integration:</strong> Automated database sync for deals and partnerships</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#dba63f]">•</span>
                      <span><strong>Vector Database:</strong> Intelligent document search and retrieval</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Roadmap */}
            <div className="relative pl-8 border-l-2 border-[#183b6d]/20">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#183b6d]/20"></div>
              <div className="mb-2">
                <h2 className="text-2xl font-serif text-[#183b6d]">Coming Soon</h2>
                <p className="text-sm text-[#575757]">Roadmap for Q1 2026</p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-3">🔮 Planned Features</h3>
                  <ul className="space-y-2 text-[#575757]">
                    <li className="flex gap-2">
                      <span className="text-[#183b6d]">○</span>
                      <span><strong>Conversational ERP:</strong> Complete business operations through natural language</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#183b6d]">○</span>
                      <span><strong>Multi-Channel Outreach:</strong> Twitter, phone, and video outreach automation</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#183b6d]">○</span>
                      <span><strong>Advanced Analytics:</strong> Predictive pipeline forecasting and deal scoring</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#183b6d]">○</span>
                      <span><strong>Custom AI Models:</strong> Company-specific AI training for better personalization</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#183b6d]">○</span>
                      <span><strong>Contract Automation:</strong> AI-powered contract generation and negotiation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribe to Updates */}
          <div className="mt-16 bg-[#183b6d] text-white rounded-sm p-12 text-center">
            <h3 className="text-3xl font-serif mb-4">Stay Updated</h3>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              Want to be notified about new features and updates? Follow our progress.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="px-8 py-3 bg-[#dba63f] text-white font-medium rounded-sm hover:bg-[#c89430] transition-all"
              >
                Contact Us
              </Link>
              <a
                href="https://www.wellsonyx.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-white/10 text-white font-medium rounded-sm hover:bg-white/20 transition-all"
              >
                Visit Wells Onyx
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
