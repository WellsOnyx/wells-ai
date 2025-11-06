'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function EnterpriseLanding() {
  const { data: session, status } = useSession()
  const isSignedIn = !!session?.user
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [navPrice, setNavPrice] = useState(1.0417) // Mock GRAIN price
  const [totalNAV, setTotalNAV] = useState(127500000) // Mock total NAV

  // Real-time NAV update simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setNavPrice(prev => prev + (Math.random() - 0.48) * 0.0001)
      setTotalNAV(prev => prev + Math.floor(Math.random() * 10000 - 4800))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Financial data visualization background
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

    // Data grid
    const drawGrid = () => {
      const gridSize = 60
      ctx.strokeStyle = 'rgba(26, 35, 50, 0.04)'
      ctx.lineWidth = 1

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Wells AI Ghost - refined for institutional aesthetic
    interface GhostVertex {
      x: number
      y: number
      baseY: number
      angle: number
    }

    const ghostSize = 100
    const ghostX = canvas.width * 0.88
    const ghostY = canvas.height * 0.65
    let rotation = 0
    let pulsePhase = 0

    const createGhostVertices = (): GhostVertex[] => {
      const vertices: GhostVertex[] = []
      const segments = 6

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        vertices.push({
          x: ghostX + Math.cos(angle) * ghostSize,
          y: ghostY + Math.sin(angle) * ghostSize,
          baseY: ghostY + Math.sin(angle) * ghostSize,
          angle: angle
        })
      }

      return vertices
    }

    const ghostVertices = createGhostVertices()

    // Floating data points with trails
    interface DataPoint {
      x: number
      y: number
      value: number
      opacity: number
      speed: number
      trail: { x: number, y: number, opacity: number }[]
      hue: number
    }

    const dataPoints: DataPoint[] = []
    for (let i = 0; i < 15; i++) {
      dataPoints.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        value: Math.random() * 100,
        opacity: Math.random() * 0.6 + 0.3,
        speed: Math.random() * 0.4 + 0.15,
        trail: [],
        hue: Math.random() * 40 + 20 // Orange to gold range
      })
    }

    // Particle system for more energy
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      size: number
      color: string
    }

    const particles: Particle[] = []
    const createParticle = (x: number, y: number) => {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 2 + 1
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: Math.random() * 60 + 40,
        size: Math.random() * 3 + 1,
        color: `hsl(${Math.random() * 40 + 20}, 80%, 60%)`
      })
    }

    const animate = () => {
      // Clean institutional white background
      ctx.fillStyle = '#fafbfc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drawGrid()

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life--
        p.vy += 0.05 // Gravity

        const alpha = p.life / p.maxLife
        ctx.fillStyle = p.color.replace(')', `, ${alpha})`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
        ctx.fill()

        if (p.life <= 0) particles.splice(i, 1)
      }

      // Spawn particles occasionally
      if (Math.random() < 0.03) {
        createParticle(
          ghostX + (Math.random() - 0.5) * 60,
          ghostY + (Math.random() - 0.5) * 60
        )
      }

      // Floating data points with trails and glow
      dataPoints.forEach((point) => {
        // Update trail
        point.trail.push({ x: point.x, y: point.y, opacity: point.opacity })
        if (point.trail.length > 12) point.trail.shift()

        // Draw trail
        point.trail.forEach((t, i) => {
          const trailAlpha = (i / point.trail.length) * t.opacity * 0.3
          ctx.fillStyle = `hsla(${point.hue}, 80%, 60%, ${trailAlpha})`
          ctx.beginPath()
          ctx.arc(t.x, t.y, 2, 0, Math.PI * 2)
          ctx.fill()
        })

        // Move point
        point.y += point.speed
        if (point.y > canvas.height) {
          point.y = -20
          point.x = Math.random() * canvas.width
        }

        // Draw data point with glow
        ctx.shadowColor = `hsl(${point.hue}, 80%, 60%)`
        ctx.shadowBlur = 8
        ctx.fillStyle = `hsla(${point.hue}, 80%, 60%, ${point.opacity})`
        ctx.font = 'bold 12px monospace'
        ctx.fillText(`$${point.value.toFixed(2)}`, point.x, point.y)
        ctx.shadowBlur = 0
      })

      // Wells AI Ghost
      rotation += 0.002
      pulsePhase += 0.015
      const pulse = Math.sin(pulsePhase) * 6

      // Ghost shell
      ctx.strokeStyle = 'rgba(26, 35, 50, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ghostVertices.forEach((vertex, i) => {
        const nextVertex = ghostVertices[(i + 1) % ghostVertices.length]
        const x1 = vertex.x + Math.cos(rotation) * pulse
        const y1 = vertex.y + Math.sin(rotation) * pulse + Math.sin(vertex.angle + pulsePhase) * 4
        const x2 = nextVertex.x + Math.cos(rotation) * pulse
        const y2 = nextVertex.y + Math.sin(rotation) * pulse + Math.sin(nextVertex.angle + pulsePhase) * 4

        if (i === 0) {
          ctx.moveTo(x1, y1)
        }
        ctx.lineTo(x2, y2)
      })
      ctx.closePath()
      ctx.stroke()

      // Glowing core
      const coreRadius = 20 + pulse * 0.6
      const gradient = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, coreRadius)
      gradient.addColorStop(0, 'rgba(244, 164, 96, 0.9)')
      gradient.addColorStop(0.5, 'rgba(244, 164, 96, 0.5)')
      gradient.addColorStop(1, 'rgba(244, 164, 96, 0)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(ghostX, ghostY, coreRadius, 0, Math.PI * 2)
      ctx.fill()

      // Core dot
      ctx.fillStyle = '#F4A460'
      ctx.shadowColor = 'rgba(244, 164, 96, 0.6)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(ghostX, ghostY, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Vertices
      ghostVertices.forEach((vertex) => {
        const x = vertex.x + Math.cos(rotation) * pulse
        const y = vertex.y + Math.sin(rotation) * pulse + Math.sin(vertex.angle + pulsePhase) * 4

        ctx.fillStyle = '#1a2332'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = 'rgba(26, 35, 50, 0.15)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(ghostX, ghostY)
        ctx.stroke()
      })

      // Wells annotation
      ctx.fillStyle = 'rgba(26, 35, 50, 0.3)'
      ctx.font = '9px monospace'
      ctx.fillText('WELLS', ghostX - 60, ghostY - ghostSize - 10)

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-[#fafbfc] text-[#1a2332]">
      {/* Navigation */}
      <nav className="relative z-10 border-b border-[#1a2332]/10 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#F4A460] to-[#dba63f] rounded-sm flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="font-bold text-[#1a2332] text-lg tracking-tight">Grain & Vault</div>
                <div className="text-[9px] text-[#575757] tracking-[0.15em] uppercase">Financial Infrastructure</div>
              </div>
            </div>
            {/* Early Investor Opportunity Badge - CLICKABLE */}
            <Link href="/early-investor" className="ml-4 px-4 py-2 bg-gradient-to-r from-[#F4A460]/10 to-[#F4A460]/5 border-l-2 border-[#F4A460] rounded-sm hover:from-[#F4A460]/15 hover:to-[#F4A460]/8 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="text-[10px] font-semibold text-[#F4A460] uppercase tracking-wide">
                    Founding Investor
                  </div>
                  <div className="text-xs font-mono text-[#1a2332]/60">
                    $1.00 → ${navPrice.toFixed(4)} {navPrice > 1.04 && <span className="text-[#16a34a]">↗</span>}
                  </div>
                </div>
                <div className="h-8 w-px bg-[#F4A460]/20"></div>
                <div className="flex flex-col items-end">
                  <div className="text-[10px] text-[#1a2332]/40 uppercase tracking-wide">
                    Pre-Launch
                  </div>
                  <div className="text-xs font-bold text-[#F4A460]">
                    Limited Spots →
                  </div>
                </div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link href="/app" className="text-sm text-[#575757] hover:text-[#1a2332] transition-colors">
                  Go to App
                </Link>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-[#575757]">{session?.user?.email}</div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-sm text-[#575757] hover:text-[#1a2332] transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/app" className="text-sm text-[#575757] hover:text-[#1a2332] transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/app"
                  className="px-5 py-2 bg-[#1a2332] text-white text-sm font-medium rounded-sm hover:bg-[#0d1723] transition-all relative overflow-hidden group"
                >
                  <span className="relative z-10">Reserve Your Spot</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#F4A460]/0 via-[#F4A460]/10 to-[#F4A460]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - No video, clean data visualization */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Animated background canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 1 }}
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="max-w-5xl">
            {/* Trust Indicators */}
            <div className="flex items-center gap-6 mb-10">
              <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-[#1a2332]/10 rounded-sm">
                <span className="text-xs font-mono text-[#1a2332]">Base Blockchain</span>
              </div>
              <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-[#1a2332]/10 rounded-sm">
                <span className="text-xs font-mono text-[#1a2332]">USDC-Backed</span>
              </div>
              <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-[#1a2332]/10 rounded-sm">
                <span className="text-xs font-mono text-[#1a2332]">Real-Time NAV</span>
              </div>
            </div>

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-[#1a2332] leading-[1.05] mb-8 tracking-tight">
              Infrastructure<br />
              <span className="text-[#F4A460]">You Can See</span>
            </h1>

            <p className="text-xl md:text-2xl text-[#575757] max-w-3xl mb-8 leading-relaxed">
              The first transparent financial infrastructure for B2B commerce. Every asset tracked.
              Every transaction visible. Every price backed by real value.
            </p>

            {/* Real-time NAV Display */}
            <div className="mb-12 p-6 bg-white/60 backdrop-blur-sm border-2 border-[#1a2332]/10 rounded-sm">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-mono text-[#575757] mb-1">GRAIN PRICE</div>
                  <div className="text-3xl font-bold text-[#1a2332] font-mono">
                    ${navPrice.toFixed(4)}
                  </div>
                  <div className="text-xs text-[#22c55e] font-mono">+4.17% since launch</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-[#575757] mb-1">TOTAL NAV</div>
                  <div className="text-3xl font-bold text-[#1a2332] font-mono">
                    ${(totalNAV / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-xs text-[#575757] font-mono">Updated 3s ago</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-[#575757] mb-1">COLLATERAL RATIO</div>
                  <div className="text-3xl font-bold text-[#1a2332] font-mono">
                    110%
                  </div>
                  <div className="text-xs text-[#22c55e] font-mono">Fully collateralized</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="px-10 py-4 bg-[#F4A460] text-white text-base font-semibold rounded-sm hover:bg-[#e09450] transition-all shadow-lg"
              >
                Request Early Access
              </Link>
              <a
                href="#infrastructure"
                className="px-10 py-4 bg-white/60 backdrop-blur-sm border-2 border-[#1a2332] text-[#1a2332] text-base font-semibold rounded-sm hover:bg-[#1a2332] hover:text-white transition-all"
              >
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="relative z-10 py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { metric: '$1.0417', label: 'Auto-Revaluing Price', desc: 'GRAIN price rises with NAV' },
              { metric: '110%', label: 'Min Collateral', desc: 'Always overcollateralized' },
              { metric: '5 min', label: 'NAV Updates', desc: 'Real-time transparency' },
              { metric: '0.5%', label: 'Transaction Fee', desc: 'Lower than traditional finance' }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-[#1a2332] font-mono mb-2">{item.metric}</div>
                <div className="text-sm font-semibold text-[#575757] mb-1 uppercase tracking-wide">{item.label}</div>
                <div className="text-xs text-[#575757]">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure Section */}
      <section id="infrastructure" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold text-[#1a2332] mb-6">
              Complete Financial Infrastructure
            </h2>
            <p className="text-xl text-[#575757] max-w-3xl mx-auto">
              From stablecoin to escrow to settlements. Everything you need for B2B commerce,
              powered by Grain & Vault.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'GRAIN Stablecoin',
                desc: 'Auto-revaluing USDC-backed token. Price increases with total NAV. Perfect for B2B settlements.',
                features: ['USDC-backed', 'Auto-revaluing', 'On-chain transparency']
              },
              {
                title: 'Vault Treasury',
                desc: 'Multi-asset custody tracking liquid reserves, float, physical assets, investments, and receivables.',
                features: ['5-tier asset tracking', 'Multi-sig security', 'Real-time NAV']
              },
              {
                title: 'Escrow & Payments',
                desc: 'Milestone-based escrow for high-value deals. ACH, wire, and crypto settlements with Wells AI.',
                features: ['Segregated custody', 'Dispute resolution', 'Instant settlements']
              }
            ].map((item, i) => (
              <div key={i} className="p-8 bg-white border-2 border-[#1a2332]/10 rounded-sm hover:border-[#F4A460] hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                {/* Animated gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#F4A460]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-[#1a2332] mb-4 group-hover:text-[#F4A460] transition-colors">{item.title}</h3>
                  <p className="text-[#575757] mb-6 leading-relaxed">{item.desc}</p>
                  <ul className="space-y-2">
                    {item.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-[#575757] group-hover:text-[#1a2332] transition-colors">
                        <svg className="w-4 h-4 text-[#F4A460] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="relative z-10 py-24 px-6 bg-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              Built for Every Industry
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Wells understands your business language. From procurement to hiring to GTM.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { title: 'Procurement', desc: 'Supplier matching, RFQ management, transparent sourcing', icon: '📦' },
              { title: 'Executive Search', desc: 'C-suite placements, candidate matching, hiring automation', icon: '👔' },
              { title: 'GTM Automation', desc: 'Lead generation, outreach, pipeline management', icon: '🎯' },
              { title: 'Professional Services', desc: 'Legal, accounting, consulting workflow automation', icon: '⚖️' }
            ].map((item, i) => (
              <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-sm hover:bg-white/15 hover:border-[#F4A460]/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-[#F4A460] transition-colors">{item.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/90 transition-colors">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wells AI Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-[#F4A460]/10 border border-[#F4A460]/20 rounded-sm mb-6">
                <span className="text-sm font-semibold text-[#F4A460]">POWERED BY GRAIN & VAULT</span>
              </div>
              <h2 className="text-5xl font-bold text-[#1a2332] mb-6">
                Your AI Companion<br />
                for Every Transaction
              </h2>
              <p className="text-xl text-[#575757] mb-8 leading-relaxed">
                Wells is your personal AI agent that handles everything from supplier discovery to
                candidate outreach to payment reconciliation. Just chat naturally.
              </p>
              <ul className="space-y-4">
                {[
                  'Natural language interface for all transactions',
                  'Remembers context and preferences across sessions',
                  'Proactive recommendations and deal matching',
                  'Complete audit trail and transaction history'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-[#F4A460] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-[#575757]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border-2 border-[#1a2332]/10 rounded-sm p-8 shadow-xl">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-[#F4A460]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">👤</span>
                  </div>
                  <div className="flex-1 bg-[#f3f4f6] rounded-lg p-4">
                    <p className="text-sm text-[#1a2332]">I need to source 10,000 units of PCB boards. Military grade. Can you find suppliers?</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-10 h-10 bg-[#1a2332] rounded-full flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="6" r="2" fill="#F4A460"/>
                      <path d="M10 8L6 14M10 8L10 16M10 8L14 14" stroke="#F4A460" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className="flex-1 bg-[#1a2332] rounded-lg p-4">
                    <p className="text-sm text-white">Found 3 qualified suppliers with MIL-STD certification. Average quote: $12.50/unit. Would you like me to create RFQs?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Enhanced with animations */}
      <section className="relative z-10 py-24 px-6 bg-gradient-to-br from-[#F4A460] to-[#dba63f] overflow-hidden">
        {/* Animated background shapes */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block px-6 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6 animate-pulse">
            <span className="text-sm font-semibold text-white uppercase tracking-wide">Limited Spots Available</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 drop-shadow-lg">
            Be a Founding Investor
          </h2>
          <p className="text-xl text-white/95 mb-12 leading-relaxed drop-shadow-md">
            Early investors get GRAIN at $1.00 before public launch. Current NAV: ${navPrice.toFixed(4)}.
            Lock in your allocation before spots fill.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/early-investor"
              className="group relative inline-block px-12 py-5 bg-white text-[#1a2332] text-lg font-bold rounded-sm hover:scale-105 transition-all shadow-2xl overflow-hidden"
            >
              <span className="relative z-10">Secure My Spot →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#1a2332] to-[#0d1723] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white font-bold transition-opacity">Secure My Spot →</span>
            </Link>
            <Link
              href="/app"
              className="px-10 py-4 border-2 border-white text-white text-base font-semibold rounded-sm hover:bg-white hover:text-[#1a2332] transition-all"
            >
              Learn More
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/70">Only 100 founding investor slots | First-come, first-served</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-16 px-6 bg-[#1a2332] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="font-bold text-lg mb-4">Grain & Vault</div>
              <p className="text-white/70 text-sm leading-relaxed">
                Infrastructure You Can See. The first transparent financial infrastructure
                for B2B commerce.
              </p>
            </div>
            <div>
              <div className="font-semibold mb-4">Product</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link href="/app" className="hover:text-white transition">GRAIN Stablecoin</Link></li>
                <li><Link href="/app" className="hover:text-white transition">Vault Treasury</Link></li>
                <li><Link href="/app" className="hover:text-white transition">Escrow & Payments</Link></li>
                <li><Link href="/app" className="hover:text-white transition">Wells AI</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Company</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                <li><a href="https://www.wellsonyx.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Wells Onyx</a></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Legal</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link href="/legal/terms" className="hover:text-white transition">Terms</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-white transition">Privacy</Link></li>
                <li><Link href="/legal/security" className="hover:text-white transition">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/50">© 2025 Grain & Vault. Powered by Wells Onyx.</p>
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
