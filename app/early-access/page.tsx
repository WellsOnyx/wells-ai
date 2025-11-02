'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function EarlyAccessPage() {
  const [email, setEmail] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [waitlistData, setWaitlistData] = useState<{
    position: number
    totalSignups: number
    inviteCode: string
    invitesRemaining: number
  } | null>(null)

  // Check URL for invite code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    if (code) {
      setInviteCode(code)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, inviteCode: inviteCode || undefined })
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(data.error || 'Something went wrong')
        return
      }

      setStatus('success')
      setWaitlistData(data)
      setEmail('')
    } catch (error) {
      setStatus('error')
      setMessage('Failed to join waitlist. Please try again.')
    }
  }

  const copyInviteLink = () => {
    if (!waitlistData) return
    const link = `${window.location.origin}/early-access?invite=${waitlistData.inviteCode}`
    navigator.clipboard.writeText(link)
    alert('Invite link copied!')
  }

  return (
    <div className="min-h-screen bg-white text-[#000000] relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9fa] via-white to-[#dba63f]/5"></div>

      {/* Constellation network background */}
      <div className="absolute inset-0 opacity-[0.15]">
        <svg className="absolute inset-0 w-full h-full" style={{ filter: 'blur(0.5px)' }}>
          <defs>
            <pattern id="constellation" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="1.5" fill="#183b6d" />
              <circle cx="150" cy="80" r="1.5" fill="#183b6d" />
              <circle cx="100" cy="150" r="1.5" fill="#183b6d" />
              <line x1="50" y1="50" x2="150" y2="80" stroke="#183b6d" strokeWidth="0.5" opacity="0.3" />
              <line x1="150" y1="80" x2="100" y2="150" stroke="#183b6d" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#constellation)" />
        </svg>
      </div>

      {/* Floating gold accents */}
      <div className="absolute inset-0">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-[#dba63f] rounded-full opacity-30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <nav className="border-b border-[#9ea1a7]/10 bg-white/80 backdrop-blur-sm">
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
                <div className="text-[10px] text-[#575757] tracking-[0.15em] uppercase">Early Access</div>
              </div>
            </Link>
            <Link
              href="/"
              className="text-[#575757] hover:text-[#183b6d] transition-colors text-sm font-medium"
            >
              ← Back
            </Link>
          </div>
        </nav>

        {status !== 'success' ? (
          // Waitlist signup
          <div className="min-h-[90vh] flex items-center justify-center px-6 py-20">
            <div className="max-w-4xl w-full text-center">
              {/* Coming Soon Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#dba63f]/20 border-2 border-[#dba63f] rounded-sm text-[#dba63f] text-sm font-semibold mb-8">
                <span className="w-2 h-2 bg-[#dba63f] rounded-full animate-pulse"></span>
                LAUNCHING SOON
              </div>

              {/* Hero */}
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif text-[#183b6d] leading-[0.95] mb-8 tracking-tight">
                The future of<br />
                <span className="text-[#dba63f]">enterprise commerce</span><br />
                starts with a<br />
                conversation
              </h1>

              <p className="text-xl md:text-2xl text-[#000000] max-w-3xl mx-auto mb-12 leading-relaxed bg-white/80 backdrop-blur-sm p-6 rounded-sm">
                We're building the platform that will power every enterprise transaction—from semiconductors
                to executive talent. One AI. One conversation. Infinite possibilities.
              </p>

              {/* Teaser features */}
              <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
                <div className="bg-white backdrop-blur-sm border border-[#9ea1a7]/10 rounded-sm p-6 shadow-sm">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-2">AI-Powered</h3>
                  <p className="text-[#575757] text-sm">
                    Claude Sonnet 4 understanding every industry, every need, every transaction
                  </p>
                </div>
                <div className="bg-white backdrop-blur-sm border border-[#9ea1a7]/10 rounded-sm p-6 shadow-sm">
                  <div className="text-4xl mb-4">⚡</div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-2">Zero Friction</h3>
                  <p className="text-[#575757] text-sm">
                    No forms. No portals. Just talk. From discovery to close in one conversation.
                  </p>
                </div>
                <div className="bg-white backdrop-blur-sm border border-[#9ea1a7]/10 rounded-sm p-6 shadow-sm">
                  <div className="text-4xl mb-4">💎</div>
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-2">Success-Based</h3>
                  <p className="text-[#575757] text-sm">
                    Pay only when deals close. Starting at 0.33% on closed ACV.
                  </p>
                </div>
              </div>

              {/* Signup form */}
              <div className="max-w-xl mx-auto">
                <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-8 shadow-lg">
                  {!inviteCode ? (
                    // No invite code - show locked state
                    <div>
                      <div className="mb-6 p-6 bg-[#dba63f]/20 border-2 border-[#dba63f] rounded-sm text-center">
                        <div className="text-4xl mb-3">🔒</div>
                        <p className="text-[#dba63f] font-semibold mb-2">
                          Invite Only
                        </p>
                        <p className="text-[#575757] text-sm">
                          Wells AI is currently invite-only. You need an invite link to join the waitlist.
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#575757] text-sm">
                          Know someone with access? Ask them to share their invite link with you.
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Has invite code - show form
                    <>
                      <div className="mb-6 p-4 bg-[#dba63f]/20 border-2 border-[#dba63f] rounded-sm">
                        <p className="text-[#dba63f] text-sm font-semibold">
                          🎉 You've been invited! Join now.
                        </p>
                      </div>

                      <h2 className="text-2xl font-serif text-[#183b6d] mb-2">Join the waitlist</h2>
                      <p className="text-[#575757] text-sm mb-6">
                        Get priority access + 3 invites of your own to share
                      </p>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          className="w-full px-6 py-4 bg-white border border-[#9ea1a7]/30 rounded-sm text-[#000000] placeholder:text-[#9ea1a7] focus:outline-none focus:border-[#dba63f] transition-all"
                        />

                        {status === 'error' && (
                          <div className="p-4 bg-red-500/10 border-2 border-red-500 rounded-sm">
                            <p className="text-red-600 text-sm">{message}</p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={status === 'loading'}
                          className="w-full px-8 py-4 bg-[#dba63f] text-white font-semibold rounded-sm hover:bg-[#c89430] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                          {status === 'loading' ? 'Joining...' : 'Request Early Access'}
                        </button>
                      </form>

                      <p className="text-[#9ea1a7] text-xs mt-6">
                        We respect your privacy. Unsubscribe anytime.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Social proof */}
              <div className="mt-16 flex items-center justify-center gap-8 text-[#575757] text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#dba63f] rounded-full animate-pulse"></div>
                  <span>Live in Q1 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#dba63f] rounded-full animate-pulse"></div>
                  <span>Invite-only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#dba63f] rounded-full animate-pulse"></div>
                  <span>Enterprise-grade</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Success state with invite codes
          <div className="min-h-[90vh] flex items-center justify-center px-6 py-20">
            <div className="max-w-2xl w-full text-center">
              <div className="w-20 h-20 bg-[#dba63f] rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-4xl font-serif text-[#183b6d] mb-4">You're on the list!</h2>
              <p className="text-[#575757] text-lg mb-8">
                Thanks for joining the Wells AI early access program.
              </p>

              <div className="bg-white border border-[#9ea1a7]/20 rounded-sm p-8 mb-8 shadow-lg">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-[#dba63f] mb-2">
                      #{waitlistData?.position.toLocaleString()}
                    </div>
                    <div className="text-[#575757] text-sm">Your position</div>
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-[#dba63f] mb-2">
                      {waitlistData?.invitesRemaining}
                    </div>
                    <div className="text-[#575757] text-sm">Invites remaining</div>
                  </div>
                </div>

                <div className="border-t border-[#9ea1a7]/10 pt-6">
                  <h3 className="text-lg font-semibold text-[#183b6d] mb-4">Skip the line</h3>
                  <p className="text-[#575757] text-sm mb-4">
                    Share your unique invite link. For every 3 people who join, you move up 1 position.
                  </p>

                  <div className="flex gap-3">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/early-access?invite=${waitlistData?.inviteCode}`}
                      className="flex-1 px-4 py-3 bg-white border border-[#9ea1a7]/30 rounded-sm text-[#000000] text-sm"
                    />
                    <button
                      onClick={copyInviteLink}
                      className="px-6 py-3 bg-[#dba63f] text-white font-semibold rounded-sm hover:bg-[#c89430] transition-all shadow-lg"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <a
                  href={`https://twitter.com/intent/tweet?text=Just%20joined%20the%20waitlist%20for%20%40WellsAI%20-%20the%20future%20of%20enterprise%20commerce%20starts%20with%20a%20conversation&url=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/early-access?invite=${waitlistData?.inviteCode}` : '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white border border-[#9ea1a7]/30 text-[#183b6d] rounded-sm hover:bg-[#f8f9fa] transition-all font-medium"
                >
                  Share on Twitter
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/early-access?invite=${waitlistData?.inviteCode}` : '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white border border-[#9ea1a7]/30 text-[#183b6d] rounded-sm hover:bg-[#f8f9fa] transition-all font-medium"
                >
                  Share on LinkedIn
                </a>
              </div>

              <p className="text-[#9ea1a7] text-sm mt-8">
                We'll email you when it's your turn to get access.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-[#9ea1a7]/10 py-8 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-[#575757] text-sm">
              © 2025 Wells AI. Part of the{' '}
              <a href="https://www.wellsonyx.com" target="_blank" rel="noopener noreferrer" className="text-[#dba63f] hover:text-[#c89430] font-medium">
                Wells Onyx
              </a>
              {' '}constellation.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
