'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useUser, SignOutButton } from '@clerk/nextjs'
import Footer from './Footer'

export default function LuxuryLanding() {
  const { user, isSignedIn } = useUser()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scrollY, setScrollY] = useState(0)

  // Smooth scroll tracking
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Luxury particle system - subtle, elegant
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
      size: number
      speedX: number
      speedY: number
      opacity: number
      hue: number
    }

    const particles: Particle[] = []
    const particleCount = 40

    // Create elegant floating particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.3 + 0.1,
        hue: Math.random() * 40 + 30 // Gold range
      })
    }

    const animate = () => {
      // Deep rich background
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update and draw particles
      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        // Draw particle with gold glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 4
        )
        gradient.addColorStop(0, `hsla(${particle.hue}, 70%, 60%, ${particle.opacity})`)
        gradient.addColorStop(1, `hsla(${particle.hue}, 70%, 60%, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 4, 0, Math.PI * 2)
        ctx.fill()
      })

      // Connect nearby particles with subtle lines
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 120) {
            ctx.strokeStyle = `rgba(218, 165, 32, ${(1 - distance / 120) * 0.1})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
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
    <div className="relative min-h-screen bg-[#0a0a0a] text-[#f5f5f0]">
      {/* Animated luxury background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ opacity: 0.6 }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#daa520]/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-serif tracking-wider text-[#daa520]">Grain & Vault</div>
            <div className="h-6 w-px bg-[#daa520]/30"></div>
            <div className="text-xs tracking-[0.3em] text-[#f5f5f0]/50 uppercase">B2B Commerce Platform</div>
          </div>

          <div className="flex items-center gap-6">
            {isSignedIn ? (
              <>
                <Link
                  href="/app"
                  className="text-sm tracking-wide text-[#f5f5f0]/70 hover:text-[#daa520] transition-colors duration-300"
                >
                  Enter
                </Link>
                <SignOutButton>
                  <button className="text-sm tracking-wide text-[#f5f5f0]/70 hover:text-[#daa520] transition-colors duration-300">
                    Sign Out
                  </button>
                </SignOutButton>
              </>
            ) : (
              <>
                <Link
                  href="/app"
                  className="text-sm tracking-wide text-[#f5f5f0]/70 hover:text-[#daa520] transition-colors duration-300"
                >
                  Sign In
                </Link>
                <Link
                  href="/app"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#daa520] to-[#b8860b] text-[#0a0a0a] text-sm font-medium tracking-wide hover:from-[#b8860b] hover:to-[#daa520] transition-all duration-500 shadow-lg shadow-[#daa520]/20"
                >
                  Begin
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-8">
        <div
          className="relative z-10 max-w-5xl mx-auto"
          style={{
            transform: `translateY(${scrollY * 0.3}px)`,
            opacity: 1 - scrollY / 600
          }}
        >
          {/* Luxury badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 border border-[#daa520]/20 bg-[#daa520]/5 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#daa520] animate-pulse"></div>
            <span className="text-xs tracking-[0.25em] text-[#daa520] uppercase">Invitation Only</span>
          </div>

          {/* Main headline - large, editorial style */}
          <h1 className="font-serif text-7xl md:text-8xl lg:text-9xl leading-[0.9] mb-8 tracking-tight">
            <span className="block text-[#f5f5f0]">Zero Friction</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#daa520] via-[#f0e68c] to-[#daa520]">
              Commerce
            </span>
          </h1>

          {/* Subtitle - refined typography */}
          <p className="text-xl md:text-2xl text-[#f5f5f0]/60 max-w-2xl mb-12 leading-relaxed font-light">
            B2B commerce platform with Treasury + Grain Vault. Pay 33bps, enjoy 0 friction. Move capital at the speed of conversation.
          </p>

          {/* CTA */}
          <div className="flex items-center gap-6">
            <Link
              href="/demo"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#daa520] to-[#b8860b] text-[#0a0a0a] font-medium tracking-wide hover:from-[#b8860b] hover:to-[#daa520] transition-all duration-500 shadow-2xl shadow-[#daa520]/30 hover:scale-105"
            >
              <svg
                className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>See Wells in Action</span>
            </Link>
            <Link
              href="#experience"
              className="text-sm tracking-wide text-[#f5f5f0]/70 hover:text-[#daa520] transition-colors duration-300 underline underline-offset-8 decoration-[#daa520]/30"
            >
              Discover More
            </Link>
          </div>
        </div>
      </section>

      {/* See Wells in Action - Demo Showcase */}
      <section className="relative py-24 px-8 border-t border-[#daa520]/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 border border-[#daa520]/20 bg-[#daa520]/5 backdrop-blur-sm">
            <svg className="w-4 h-4 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs tracking-[0.25em] text-[#daa520] uppercase">Interactive Demos</span>
          </div>

          <h2 className="font-serif text-5xl md:text-6xl text-[#f5f5f0] mb-6 tracking-tight">
            See Wells in Action
          </h2>

          <p className="text-lg text-[#f5f5f0]/60 mb-12 max-w-2xl mx-auto leading-relaxed">
            Experience how Wells transforms B2B commerce from both perspectives—whether you're sourcing suppliers or seeking buyers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Buyer Demo */}
            <Link
              href="/demo"
              className="group relative bg-[#1a1a1a] border border-[#daa520]/20 p-8 hover:border-[#daa520]/50 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#daa520]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>

              <div className="relative z-10">
                <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>

                <h3 className="font-serif text-2xl text-[#f5f5f0] mb-3 tracking-tight">
                  Buyer Experience
                </h3>

                <p className="text-[#f5f5f0]/60 mb-6 leading-relaxed">
                  Watch Wells source suppliers, negotiate contracts, and close deals—all through conversation.
                </p>

                <div className="inline-flex items-center gap-2 text-[#daa520] text-sm font-medium group-hover:gap-3 transition-all duration-300">
                  <span>Start Demo</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Seller Demo */}
            <Link
              href="/demo/seller"
              className="group relative bg-[#1a1a1a] border border-[#daa520]/20 p-8 hover:border-[#daa520]/50 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#daa520]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>

              <div className="relative z-10">
                <div className="w-12 h-12 mb-4 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <h3 className="font-serif text-2xl text-[#f5f5f0] mb-3 tracking-tight">
                  Seller Experience
                </h3>

                <p className="text-[#f5f5f0]/60 mb-6 leading-relaxed">
                  See how Wells handles RFQs, matches you with buyers, and automates deal orchestration.
                </p>

                <div className="inline-flex items-center gap-2 text-[#daa520] text-sm font-medium group-hover:gap-3 transition-all duration-300">
                  <span>Start Demo</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Capabilities - Editorial grid */}
      <section id="experience" className="relative py-32 px-8 border-t border-[#daa520]/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#daa520]/10">
            {[
              {
                title: 'Treasury + Grain Vault',
                description: 'Unified treasury with Grain tokenomics. Earn on float, optimize working capital, and unlock liquidity across your entire operation. 0 friction, real-time settlement.',
                icon: '✦'
              },
              {
                title: 'Value-Based Pricing',
                description: 'Pay based on what we deliver: 0.33% for transaction facilitation | 3.3% when you use our GTM engine | 7% when we originate the deal. Simple, transparent, aligned.',
                icon: '◆'
              },
              {
                title: 'B2B Commerce Platform',
                description: 'Source suppliers, negotiate contracts, manage RFQs. From semiconductors to executive search—everything transactable, conversationally orchestrated.',
                icon: '●'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative bg-[#0a0a0a] p-12 hover:bg-[#1a1a1a] transition-all duration-700"
              >
                <div className="mb-6 text-4xl text-[#daa520] opacity-30 group-hover:opacity-100 transition-opacity duration-700">
                  {feature.icon}
                </div>
                <h3 className="font-serif text-2xl text-[#f5f5f0] mb-4 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-[#f5f5f0]/50 leading-relaxed font-light">
                  {feature.description}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#daa520]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Luxury Statement Section */}
      <section className="relative py-40 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="font-serif text-4xl md:text-5xl leading-relaxed text-[#f5f5f0] italic mb-8">
            "Pay for what we deliver. 0 friction.<br />
            Treasury that thinks. Commerce that flows."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#daa520]/50"></div>
            <span className="text-sm tracking-[0.3em] text-[#daa520] uppercase">Grain Vault Powered</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#daa520]/50"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer variant="luxury" />
    </div>
  )
}
