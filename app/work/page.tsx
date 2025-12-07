// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'

/**
 * WORKER JOURNEY PAGE
 *
 * The conduit for the post-AI workforce.
 * Work through Wells, get paid through Wells.
 *
 * Key Insight: In the age of AI displacing jobs,
 * Wells doesn't just match people to obvious opportunities.
 * It discovers where human value actually lies and creates
 * pathways to economic opportunity people would never find alone.
 *
 * The Architect Story:
 * - Traditional: Can't find architecture jobs (AI doing design)
 * - Wells Discovery: CAD skills + spatial reasoning → custom garden boxes
 * - Outcome: $200K business they never knew was possible
 */

export default function WorkPage() {
  const [step, setStep] = useState<'intro' | 'profile' | 'discovery' | 'opportunities' | 'dashboard'>('intro')
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    headline: '',
    bio: '',
    skills: [] as string[],
    experience_years: '',
    rate_min: '',
    rate_max: ''
  })
  const [skillInput, setSkillInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [grainBalance, setGrainBalance] = useState(0)

  // Simulate AI discovery process
  const startDiscovery = async () => {
    setStep('discovery')
    setIsProcessing(true)
    setActivities([])

    const addActivity = (type: string, message: string) => {
      setActivities(prev => [...prev, { id: Date.now(), type, message, time: new Date().toLocaleTimeString() }])
    }

    // Simulate discovery process
    await delay(800)
    addActivity('analyzing', 'Analyzing your skills and experience...')

    await delay(1200)
    addActivity('searching', 'Scanning 15,000+ active opportunities...')

    await delay(1500)
    addActivity('found', 'Found traditional job matches')

    await delay(1000)
    addActivity('analyzing', 'Looking deeper for unexpected opportunities...')

    await delay(2000)
    addActivity('discovery', 'Discovered non-obvious economic pathways!')

    await delay(800)
    addActivity('negotiating', 'Pre-negotiating rates on your behalf...')

    await delay(1000)
    addActivity('generating', 'Preparing your opportunity portfolio...')

    // Generate opportunities based on profile
    const discoveredOpportunities = generateOpportunities(profile)
    setOpportunities(discoveredOpportunities)

    await delay(500)
    addActivity('grain', '+100 GRAIN welcome bonus credited!')
    setGrainBalance(100)

    await delay(500)
    addActivity('success', 'Your opportunity portfolio is ready!')

    setIsProcessing(false)
    setStep('opportunities')
  }

  // Generate opportunities based on profile
  const generateOpportunities = (p: typeof profile) => {
    const allText = `${p.headline} ${p.bio} ${p.skills.join(' ')}`.toLowerCase()
    const ops = []

    // Always add traditional matches
    ops.push({
      type: 'traditional',
      category: 'Contract Work',
      title: 'Direct Skill Match',
      description: 'Projects matching your stated skills',
      matches: [
        { company: 'TechCorp', role: 'Consultant', rate: '$125/hr', fit: 'High' },
        { company: 'StartupX', role: 'Contractor', rate: '$100/hr', fit: 'Medium' }
      ],
      score: 75
    })

    // Unexpected discoveries based on skills
    if (allText.includes('architect') || allText.includes('cad') || allText.includes('design') || allText.includes('3d')) {
      ops.unshift({
        type: 'unexpected',
        category: 'Manufacturing Opportunity',
        title: 'Custom Product Business',
        description: 'Your design skills are perfect for custom manufacturing. Not competing for architecture jobs - building something AI can\'t replicate.',
        examples: ['Garden furniture', 'Architectural models', 'Custom storage', 'Modular components'],
        potential: '$100K-300K/year',
        why_you: 'CAD expertise + spatial reasoning + design aesthetic',
        story: 'Like the architect who discovered garden boxes - your skills translate to physical products with high margins and loyal customers.',
        score: 95
      })
    }

    if (allText.includes('developer') || allText.includes('engineer') || allText.includes('code') || allText.includes('software')) {
      ops.unshift({
        type: 'unexpected',
        category: 'Consulting Opportunity',
        title: 'AI Implementation Consulting',
        description: 'Help businesses actually implement AI. Not writing code AI will replace - guiding humans through the transition.',
        potential: '$200K-500K/year',
        why_you: 'You understand what\'s possible AND what\'s practical',
        score: 92
      })
    }

    if (allText.includes('teacher') || allText.includes('train') || allText.includes('instruct') || allText.includes('education')) {
      ops.unshift({
        type: 'unexpected',
        category: 'Content Opportunity',
        title: 'Micro-Learning Creator',
        description: 'Transform teaching skills into scalable learning products. AI can\'t replace human insight and experience.',
        potential: '$50K-200K/year passive',
        why_you: 'Teaching methodology + domain expertise',
        score: 88
      })
    }

    if (allText.includes('sales') || allText.includes('business') || allText.includes('relationship') || allText.includes('client')) {
      ops.unshift({
        type: 'unexpected',
        category: 'Partnership Opportunity',
        title: 'Wells Partner Program',
        description: 'Introduce businesses to Wells AI. Earn ongoing revenue share on every transaction.',
        potential: '$100K-500K/year',
        why_you: 'Relationship skills + industry knowledge',
        commission: '20% ongoing revenue share',
        score: 90
      })
    }

    if (allText.includes('write') || allText.includes('content') || allText.includes('marketing') || allText.includes('story')) {
      ops.unshift({
        type: 'unexpected',
        category: 'Creator Opportunity',
        title: 'Industry Content Strategist',
        description: 'AI writes generic content. Human expertise creates content that actually converts. Position yourself as the expert voice.',
        potential: '$75K-250K/year',
        why_you: 'Domain expertise + storytelling ability',
        score: 85
      })
    }

    // Sort by score
    return ops.sort((a, b) => b.score - a.score)
  }

  const addSkill = () => {
    if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
      setProfile(p => ({ ...p, skills: [...p.skills, skillInput.trim()] }))
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setProfile(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }))
  }

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  // INTRO STEP
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <span className="text-amber-400">⚡</span>
              <span className="text-sm text-amber-300">The Conduit for the Post-AI Workforce</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Work Through Wells
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              In the age of AI displacement, Wells discovers where human value actually lies.
              Not just matching you to jobs - finding economic pathways you'd never discover alone.
            </p>
          </div>

          {/* The Promise */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-white mb-2">Discover Hidden Value</h3>
              <p className="text-gray-400 text-sm">
                Your skills have applications you've never considered. Wells AI finds them.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-4">💰</div>
              <h3 className="text-lg font-bold text-white mb-2">Get Paid Instantly</h3>
              <p className="text-gray-400 text-sm">
                Work through Wells, get paid through Wells. No invoicing, no chasing payments.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-4">🌾</div>
              <h3 className="text-lg font-bold text-white mb-2">Build Wealth</h3>
              <p className="text-gray-400 text-sm">
                Earn GRAIN on every payment. Credit line against your balance. Real assets backing your work.
              </p>
            </div>
          </div>

          {/* The Story */}
          <div className="p-8 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mb-12">
            <div className="flex items-start gap-4">
              <div className="text-4xl">📦</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">The Architect Story</h3>
                <p className="text-gray-300 mb-4">
                  "I was an architect for 15 years. AI started doing design work. Couldn't find jobs.
                  Wells analyzed my skills differently - CAD expertise, spatial reasoning, design aesthetic.
                  It connected me with garden box manufacturing. First year: $180K. Second year: $240K.
                  A business I never knew I could build."
                </p>
                <p className="text-amber-400 text-sm font-medium">
                  Wells doesn't match you to what AI is replacing. It finds what AI can't do.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setStep('profile')}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              Discover My Opportunities
            </button>
            <p className="text-gray-500 text-sm mt-4">
              +100 GRAIN welcome bonus when you complete your profile
            </p>
          </div>
        </div>
      </div>
    )
  }

  // PROFILE STEP
  if (step === 'profile') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Tell Us About Yourself</h2>
            <p className="text-gray-400">The more we know, the better opportunities we can discover</p>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="you@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Professional Headline</label>
                <input
                  type="text"
                  value={profile.headline}
                  onChange={(e) => setProfile(p => ({ ...p, headline: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="e.g., Licensed Architect with 15 years experience"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">About You</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="Tell us about your background, what you've done, what you're looking for..."
                />
              </div>
            </div>

            {/* Skills */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <label className="block text-sm text-gray-400 mb-2">Skills & Expertise</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="Add a skill (e.g., CAD, React, Teaching)"
                />
                <button
                  onClick={addSkill}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-sm"
                  >
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-1 hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Rate */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <label className="block text-sm text-gray-400 mb-2">Desired Rate (optional)</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={profile.rate_min}
                    onChange={(e) => setProfile(p => ({ ...p, rate_min: e.target.value }))}
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Min"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={profile.rate_max}
                    onChange={(e) => setProfile(p => ({ ...p, rate_max: e.target.value }))}
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                    placeholder="Max"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Hourly rate range - Wells will negotiate on your behalf</p>
            </div>

            {/* Submit */}
            <button
              onClick={startDiscovery}
              disabled={!profile.full_name || !profile.email}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                !profile.full_name || !profile.email
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
              }`}
            >
              Discover My Opportunities
            </button>
          </div>
        </div>
      </div>
    )
  }

  // DISCOVERY STEP
  if (step === 'discovery') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="max-w-lg w-full px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
              <svg className="w-8 h-8 text-amber-400 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Wells AI is Working</h2>
            <p className="text-gray-400">Discovering your optimal economic pathways...</p>
          </div>

          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 animate-fadeIn"
              >
                <span className="text-xl">
                  {activity.type === 'analyzing' && '🧠'}
                  {activity.type === 'searching' && '🔍'}
                  {activity.type === 'found' && '✨'}
                  {activity.type === 'discovery' && '💡'}
                  {activity.type === 'negotiating' && '🤝'}
                  {activity.type === 'generating' && '📝'}
                  {activity.type === 'grain' && '🌾'}
                  {activity.type === 'success' && '✅'}
                </span>
                <div className="flex-1">
                  <p className="text-white">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>
    )
  }

  // OPPORTUNITIES STEP
  if (step === 'opportunities') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Your Opportunity Portfolio</h2>
              <p className="text-gray-400">Discovered pathways matched to your unique value</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-400">🌾</span>
              <span className="text-amber-400 font-bold">{grainBalance} GRAIN</span>
            </div>
          </div>

          {/* Opportunities */}
          <div className="space-y-6">
            {opportunities.map((op, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border backdrop-blur-sm ${
                  op.type === 'unexpected'
                    ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {op.type === 'unexpected' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm mb-4">
                    <span>💡</span>
                    <span>Unexpected Discovery</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">{op.category}</p>
                    <h3 className="text-xl font-bold text-white">{op.title}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-emerald-400">{op.score}%</span>
                    <p className="text-xs text-gray-400">match</p>
                  </div>
                </div>

                <p className="text-gray-300 mb-4">{op.description}</p>

                {op.potential && (
                  <div className="p-3 rounded-lg bg-white/5 mb-4">
                    <span className="text-sm text-gray-400">Potential: </span>
                    <span className="text-emerald-400 font-bold">{op.potential}</span>
                  </div>
                )}

                {op.why_you && (
                  <p className="text-sm text-amber-400 mb-4">
                    <span className="font-medium">Why you: </span>{op.why_you}
                  </p>
                )}

                {op.story && (
                  <p className="text-sm text-gray-400 italic mb-4">"{op.story}"</p>
                )}

                {op.examples && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {op.examples.map((ex: string, i: number) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-white/5 text-gray-300 text-sm">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}

                {op.matches && (
                  <div className="space-y-2 mb-4">
                    {op.matches.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div>
                          <span className="text-white font-medium">{m.company}</span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-gray-400">{m.role}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-400">{m.rate}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            m.fit === 'High' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {m.fit} fit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button className={`w-full py-3 rounded-xl font-medium transition-all ${
                  op.type === 'unexpected'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}>
                  {op.type === 'unexpected' ? 'Explore This Opportunity' : 'View Details'}
                </button>
              </div>
            ))}
          </div>

          {/* How it Works */}
          <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">How Working Through Wells Works</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <span className="text-2xl">1️⃣</span>
                <p className="text-white font-medium mt-2">Accept an Opportunity</p>
                <p className="text-sm text-gray-400">Wells handles all contracts and negotiations</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <span className="text-2xl">2️⃣</span>
                <p className="text-white font-medium mt-2">Do the Work</p>
                <p className="text-sm text-gray-400">Focus on delivery, Wells handles the rest</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <span className="text-2xl">3️⃣</span>
                <p className="text-white font-medium mt-2">Get Paid Instantly</p>
                <p className="text-sm text-gray-400">Direct to your Wells wallet + GRAIN rewards</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
