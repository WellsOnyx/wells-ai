'use client'

/**
 * EcosystemVisualization - Animated particle system showing network activity
 * Particles flow from 4 corner clusters to the central Wells AI hub
 */

import { useEffect, useRef, useState } from 'react'

// Journey colors
const JOURNEY_COLORS = {
  founders: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' },
  buyers: { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.6)' },
  sellers: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.6)' },
  jobs: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' }
}

type JourneyType = keyof typeof JOURNEY_COLORS

// Cluster positions (percentage based for responsiveness)
const CLUSTERS = {
  founders: { x: 12, y: 20 },
  buyers: { x: 12, y: 80 },
  sellers: { x: 88, y: 20 },
  jobs: { x: 88, y: 80 }
}

// Activity feed items that cycle
const ACTIVITY_ITEMS = [
  { type: 'founders', text: '<strong>CTO matched</strong> for Series A startup', time: '2s ago' },
  { type: 'buyers', text: '<strong>RFQ sent</strong> to 12 suppliers', time: '5s ago' },
  { type: 'sellers', text: '<strong>$45K deal</strong> closed via escrow', time: '12s ago' },
  { type: 'jobs', text: '<strong>VP hired</strong> at fintech startup', time: '18s ago' },
  { type: 'founders', text: '<strong>3 investors</strong> intro requested', time: '25s ago' },
  { type: 'buyers', text: '<strong>Quote received</strong> - $127K equipment', time: '32s ago' },
  { type: 'sellers', text: '<strong>New lead</strong> - enterprise buyer', time: '45s ago' },
  { type: 'jobs', text: '<strong>Interview scheduled</strong> for Director role', time: '52s ago' }
]

interface EcosystemVisualizationProps {
  activeConnections: number
  matchesToday: number
}

export default function EcosystemVisualization({
  activeConnections,
  matchesToday
}: EcosystemVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activityIndex, setActivityIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Intersection observer for visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.2 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Particle spawning system
  useEffect(() => {
    if (!isVisible || !containerRef.current) return

    const container = containerRef.current
    const journeyTypes: JourneyType[] = ['founders', 'buyers', 'sellers', 'jobs']
    let particleCount = 0
    const maxParticles = 12

    const spawnParticle = () => {
      if (particleCount >= maxParticles) return

      // Pick random journey type
      const journeyType = journeyTypes[Math.floor(Math.random() * journeyTypes.length)]
      const cluster = CLUSTERS[journeyType]
      const colors = JOURNEY_COLORS[journeyType]

      // Create particle element
      const particle = document.createElement('div')
      particle.className = 'ecosystem-particle'
      particle.style.cssText = `
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${colors.color};
        box-shadow: 0 0 12px ${colors.glow}, 0 0 24px ${colors.glow};
        pointer-events: none;
        z-index: 15;
        opacity: 0;
        left: ${cluster.x}%;
        top: ${cluster.y}%;
        transform: translate(-50%, -50%);
      `

      container.appendChild(particle)
      particleCount++

      // Animate particle to center using Web Animations API
      const animation = particle.animate([
        {
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.5)',
          left: `${cluster.x}%`,
          top: `${cluster.y}%`
        },
        {
          opacity: 1,
          transform: 'translate(-50%, -50%) scale(1)',
          offset: 0.1
        },
        {
          opacity: 1,
          transform: 'translate(-50%, -50%) scale(1)',
          offset: 0.8
        },
        {
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.3)',
          left: '50%',
          top: '50%'
        }
      ], {
        duration: 2000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
      })

      animation.onfinish = () => {
        particle.remove()
        particleCount--
      }
    }

    // Spawn particles at random intervals
    const spawnInterval = setInterval(() => {
      spawnParticle()
    }, 300 + Math.random() * 500)

    // Initial burst of particles
    for (let i = 0; i < 6; i++) {
      setTimeout(() => spawnParticle(), i * 150)
    }

    return () => {
      clearInterval(spawnInterval)
      // Clean up particles
      container.querySelectorAll('.ecosystem-particle').forEach(p => p.remove())
    }
  }, [isVisible])

  // Cycle activity feed
  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setActivityIndex(prev => (prev + 1) % ACTIVITY_ITEMS.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [isVisible])

  // Get visible activity items (3 at a time)
  const visibleActivities = [
    ACTIVITY_ITEMS[activityIndex],
    ACTIVITY_ITEMS[(activityIndex + 1) % ACTIVITY_ITEMS.length],
    ACTIVITY_ITEMS[(activityIndex + 2) % ACTIVITY_ITEMS.length]
  ]

  return (
    <div ref={containerRef} className="relative w-full h-[500px]">
      {/* Central Wells Hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        {/* Animated Rings */}
        <div
          className="absolute w-[140px] h-[140px] border-2 border-blue-500/40 rounded-full left-1/2 top-1/2"
          style={{
            transform: 'translate(-50%, -50%)',
            animation: 'pulse-ring 3s ease-out infinite'
          }}
        />
        <div
          className="absolute w-[180px] h-[180px] border border-blue-500/20 border-dashed rounded-full left-1/2 top-1/2"
          style={{
            transform: 'translate(-50%, -50%)',
            animation: 'rotate-ring 20s linear infinite'
          }}
        />
        <div
          className="absolute w-[220px] h-[220px] border border-blue-500/10 rounded-full left-1/2 top-1/2"
          style={{
            transform: 'translate(-50%, -50%)',
            animation: 'pulse-ring 3s ease-out infinite 1s'
          }}
        />

        {/* Core Hub */}
        <div className="relative w-[100px] h-[100px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-full flex flex-col items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_24px_rgba(10,15,26,0.4),0_0_60px_rgba(59,130,246,0.3)] z-10">
          <span className="text-3xl font-bold text-white">W</span>
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Wells AI</span>
        </div>
      </div>

      {/* Founders Cluster - Top Left */}
      <div className="absolute left-[8%] top-[15%]">
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-2xl">👤</span>
          <span className="text-sm font-semibold text-blue-500">Founders</span>
          <span className="text-[11px] text-gray-500 font-medium">127 active</span>
        </div>
        <div className="flex flex-wrap gap-2 max-w-[100px]">
          {[12, 10, 8, 10, 6, 8, 6].map((size, i) => (
            <div
              key={i}
              className="bg-blue-500 rounded-full"
              style={{
                width: size,
                height: size,
                opacity: 1 - i * 0.1,
                animation: `node-pulse 2s ease-in-out infinite ${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Buyers Cluster - Bottom Left */}
      <div className="absolute left-[8%] bottom-[15%]">
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-2xl">🛒</span>
          <span className="text-sm font-semibold text-violet-500">Buyers</span>
          <span className="text-[11px] text-gray-500 font-medium">89 active</span>
        </div>
        <div className="flex flex-wrap gap-2 max-w-[100px]">
          {[12, 10, 8, 10, 6, 8].map((size, i) => (
            <div
              key={i}
              className="bg-violet-500 rounded-full"
              style={{
                width: size,
                height: size,
                opacity: 1 - i * 0.1,
                animation: `node-pulse 2s ease-in-out infinite ${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Sellers Cluster - Top Right */}
      <div className="absolute right-[8%] top-[15%]">
        <div className="flex flex-col gap-1 mb-4 items-end">
          <span className="text-2xl">🏪</span>
          <span className="text-sm font-semibold text-emerald-500">Sellers</span>
          <span className="text-[11px] text-gray-500 font-medium">203 active</span>
        </div>
        <div className="flex flex-wrap gap-2 max-w-[100px] justify-end">
          {[12, 10, 8, 10, 6, 8, 6, 10].map((size, i) => (
            <div
              key={i}
              className="bg-emerald-500 rounded-full"
              style={{
                width: size,
                height: size,
                opacity: 1 - i * 0.08,
                animation: `node-pulse 2s ease-in-out infinite ${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Job Seekers Cluster - Bottom Right */}
      <div className="absolute right-[8%] bottom-[15%]">
        <div className="flex flex-col gap-1 mb-4 items-end">
          <span className="text-2xl">💼</span>
          <span className="text-sm font-semibold text-amber-500">Job Seekers</span>
          <span className="text-[11px] text-gray-500 font-medium">341 active</span>
        </div>
        <div className="flex flex-wrap gap-2 max-w-[100px] justify-end">
          {[12, 10, 8, 10, 6, 8, 6].map((size, i) => (
            <div
              key={i}
              className="bg-amber-500 rounded-full"
              style={{
                width: size,
                height: size,
                opacity: 1 - i * 0.1,
                animation: `node-pulse 2s ease-in-out infinite ${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Stats Overlay */}
      <div className="absolute top-10 right-10 flex flex-col gap-4 z-20">
        <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{activeConnections}</span>
          <span className="text-[11px] text-gray-500 font-medium">Active connections</span>
        </div>
        <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{matchesToday}</span>
          <span className="text-[11px] text-gray-500 font-medium">Matches today</span>
        </div>
        <div className="flex flex-col items-end px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <span className="text-2xl font-bold text-gray-900">$127K</span>
          <span className="text-[11px] text-gray-500 font-medium">Pipeline value</span>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-20">
        {visibleActivities.map((item, i) => (
          <div
            key={`${activityIndex}-${i}`}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-[13px] shadow-sm"
            style={{
              animation: 'feed-in 0.4s ease forwards',
              animationDelay: `${i * 0.15}s`,
              opacity: 0
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: JOURNEY_COLORS[item.type as JourneyType]?.color || '#3b82f6'
              }}
            />
            <span className="text-gray-600" dangerouslySetInnerHTML={{ __html: item.text }} />
            <span className="text-[11px] text-gray-400 ml-auto">{item.time}</span>
          </div>
        ))}
      </div>

      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
        }

        @keyframes rotate-ring {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes node-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }

        @keyframes feed-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
