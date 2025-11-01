'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function EnterpriseLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Constellation animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
    }

    const particles: Particle[] = []
    const particleCount = 80
    const connectionDistance = 150

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
      })
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle, i) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        ctx.fillStyle = 'rgba(24, 59, 109, 0.5)'
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2)
        ctx.fill()

        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x
          const dy = particle.y - otherParticle.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            ctx.strokeStyle = `rgba(24, 59, 109, ${0.25 * (1 - distance / connectionDistance)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(otherParticle.x, otherParticle.y)
            ctx.stroke()
          }
        })
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-white text-[#000000] overflow-hidden">
      {/* Constellation Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 1 }}
      />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-[#9ea1a7]/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>
          <Link
            href="/app"
            className="px-6 py-2.5 bg-[#183b6d] text-white text-sm font-medium rounded-sm hover:bg-[#0d2545] transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl">
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-serif text-[#183b6d] leading-[0.9] mb-8 tracking-tight">
              The Enterprise<br />
              <span className="text-[#dba63f]">Conversation</span><br />
              Platform
            </h1>
            <p className="text-xl md:text-2xl text-[#575757] max-w-3xl mb-12 font-light leading-relaxed">
              Built to power enterprise transactions across industries. From semiconductors to executive talent.
              From commodities to compliance. One conversation for every deal.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="px-10 py-4 bg-[#dba63f] text-white text-base font-medium rounded-sm hover:bg-[#c89430] transition-all shadow-lg"
              >
                Start Trading
              </Link>
              <a
                href="#platform"
                className="px-10 py-4 bg-white border-2 border-[#183b6d] text-[#183b6d] text-base font-medium rounded-sm hover:bg-[#183b6d] hover:text-white transition-all"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="relative z-10 py-20 px-6 bg-[#183b6d]/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="text-center">
              <div className="text-5xl font-bold text-[#183b6d] mb-2">24/7</div>
              <div className="text-sm text-[#575757] tracking-wide uppercase">AI-Powered Platform</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#183b6d] mb-2">0.5%</div>
              <div className="text-sm text-[#575757] tracking-wide uppercase">Starting Fee</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#183b6d] mb-2">∞</div>
              <div className="text-sm text-[#575757] tracking-wide uppercase">Industries Supported</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-[#183b6d] mb-2">100%</div>
              <div className="text-sm text-[#575757] tracking-wide uppercase">Transparent Pricing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-serif text-[#183b6d] mb-6">
              One Platform.<br />Every Industry.
            </h2>
            <p className="text-xl text-[#575757] max-w-3xl mx-auto">
              Wells AI understands your business language—whether you're sourcing chips or closing C-suite searches.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Procurement',
                desc: 'From raw materials to semiconductors. AI-powered supplier matching with transparent pricing.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )
              },
              {
                title: 'Executive Search',
                desc: 'C-suite to VP-level placements. AI-enhanced candidate matching with human expertise.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )
              },
              {
                title: 'Professional Services',
                desc: 'Legal, accounting, consulting. End-to-end workflow from discovery to payment.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )
              },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-[#9ea1a7]/20 rounded-sm p-8 hover:border-[#dba63f] transition-all group">
                <div className="w-14 h-14 bg-[#183b6d]/5 rounded-sm flex items-center justify-center text-[#183b6d] group-hover:bg-[#dba63f] group-hover:text-white transition-all mb-6">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-semibold text-[#183b6d] mb-4">{item.title}</h3>
                <p className="text-[#575757] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 py-32 px-6 bg-[#183b6d] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-serif mb-6">
              Simple. Powerful. Trusted.
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Three steps to close any enterprise deal
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Describe',
                desc: 'Tell Wells AI what you need in plain language. No forms, no friction.'
              },
              {
                step: '02',
                title: 'Match',
                desc: 'AI instantly matches you with qualified suppliers or candidates. Both sides notified.'
              },
              {
                step: '03',
                title: 'Transact',
                desc: 'Complete the deal through Wells AI. Secure payments, transparent fees, guaranteed outcomes.'
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-8xl font-bold text-white/10 absolute -top-8 -left-4">{item.step}</div>
                <div className="relative">
                  <h3 className="text-2xl font-semibold mb-4">{item.title}</h3>
                  <p className="text-white/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Pricing */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-serif text-[#183b6d] mb-8">
              Pricing That Scales<br />With Your Business
            </h2>
            <p className="text-xl text-[#575757] mb-12 leading-relaxed">
              From 0.5% for commodities to 10% for full GTM automation. Our dynamic pricing engine ensures
              you never pay more than fair market value for our services.
            </p>
            <div className="bg-[#183b6d]/5 border border-[#9ea1a7]/20 rounded-sm p-12">
              <div className="grid md:grid-cols-2 gap-8 text-left">
                <div>
                  <div className="text-[#dba63f] font-bold text-sm mb-2 tracking-wide">COMMODITIES</div>
                  <div className="text-4xl font-bold text-[#183b6d] mb-2">0.5%</div>
                  <p className="text-sm text-[#575757]">Low-margin bulk goods like vegetables, grain, raw materials</p>
                </div>
                <div>
                  <div className="text-[#dba63f] font-bold text-sm mb-2 tracking-wide">STANDARD B2B</div>
                  <div className="text-4xl font-bold text-[#183b6d] mb-2">2%</div>
                  <p className="text-sm text-[#575757]">Manufacturing, distribution, components, standard services</p>
                </div>
                <div>
                  <div className="text-[#dba63f] font-bold text-sm mb-2 tracking-wide">HIGH-VALUE</div>
                  <div className="text-4xl font-bold text-[#183b6d] mb-2">3%</div>
                  <p className="text-sm text-[#575757]">Executive search, consulting, software, specialized services</p>
                </div>
                <div>
                  <div className="text-[#dba63f] font-bold text-sm mb-2 tracking-wide">FULL GTM</div>
                  <div className="text-4xl font-bold text-[#183b6d] mb-2">10%</div>
                  <p className="text-sm text-[#575757]">Complete sales automation from discovery to close</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-32 px-6 bg-[#dba63f]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-serif text-white mb-8">
            Ready to Transform<br />Your Enterprise Transactions?
          </h2>
          <p className="text-xl text-white/90 mb-12">
            Be among the first to experience the future of conversational commerce
          </p>
          <Link
            href="/app"
            className="inline-block px-12 py-5 bg-white text-[#183b6d] text-lg font-semibold rounded-sm hover:bg-[#183b6d] hover:text-white transition-all shadow-xl"
          >
            Start Your First Transaction
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-16 px-6 bg-[#183b6d] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="font-semibold text-lg mb-4">Wells AI</div>
              <p className="text-white/70 text-sm">
                Every enterprise transaction will one day begin with a conversation. We're building that future.
              </p>
            </div>
            <div>
              <div className="font-semibold mb-4">Resources</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
                <li><a href="#" className="hover:text-white transition">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Company</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                <li><a href="https://www.wellsonyx.com/careers" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Careers</a></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Legal</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/50">© 2025 Wells AI. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-white/50 hover:text-white transition">LinkedIn</a>
              <a href="#" className="text-white/50 hover:text-white transition">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
