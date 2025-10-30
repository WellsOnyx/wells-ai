'use client'

import { useState } from 'react'

export default function GTMDefinition() {
  const [step, setStep] = useState(1) // 1: Define, 2: Preview, 3: Approve, 4: Running
  const [campaign, setCampaign] = useState({
    name: '',
    serviceOffering: '',
    targetRevenue: '',
    targetIndustry: '',
    targetRole: '',
    targetCompanySize: '',
    painPoint: '',
    value_prop: '',
    hook: '',
    desiredOutcome: 'meeting'
  })

  const [sampleMessages, setSampleMessages] = useState<any[]>([])
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [campaignResult, setCampaignResult] = useState<any>(null)

  const handleGenerateSamples = async () => {
    setIsGeneratingSamples(true)
    try {
      const response = await fetch('/api/gtm/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaign)
      })
      const data = await response.json()
      setSampleMessages(data.samples || [])
      setStep(2)
    } catch (error) {
      console.error('Sample generation failed:', error)
    } finally {
      setIsGeneratingSamples(false)
    }
  }

  const handleApproveAndLaunch = async () => {
    setIsLaunching(true)
    try {
      const response = await fetch('/api/gtm/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaign,
          approved: true
        })
      })
      const data = await response.json()
      setCampaignResult(data)
      setStep(3)
    } catch (error) {
      console.error('Launch failed:', error)
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#183b6d] text-white py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-serif mb-2">Wells AI GTM Engine</h1>
          <p className="text-sm text-white/80">
            {step === 1 && 'Define your ICP & messaging'}
            {step === 2 && 'Review sample messages'}
            {step === 3 && 'Campaign running autonomously'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Step 1: Define Campaign */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Campaign Name
              </label>
              <input
                type="text"
                value={campaign.name}
                onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                placeholder="Q4 2025 - Executive Search CTO"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                What are you selling?
              </label>
              <select
                value={campaign.serviceOffering}
                onChange={(e) => setCampaign({ ...campaign, serviceOffering: e.target.value })}
                className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
              >
                <option value="">Select service...</option>

                <optgroup label="💼 Professional Services">
                  <option value="executive-search">Executive Search ($100K-$300K per placement)</option>
                  <option value="search-strategy">Search & Strategy ($450K-$2M packages)</option>
                  <option value="idre-agency">IDRE Agency Services - Onyx Health ($3M+ run-rate)</option>
                </optgroup>

                <optgroup label="🤖 Technology & AI">
                  <option value="wells-os">Wells OS Transformation ($2.5M-$25M)</option>
                  <option value="ai-ops">AI Ops Run-State ($150K-$400K/mo)</option>
                  <option value="wells-ai-platform">Wells AI Platform License (Custom pricing)</option>
                </optgroup>

                <optgroup label="💰 Financial Infrastructure">
                  <option value="grain-vault">Grain & Vault (Payments + Float + AUM)</option>
                </optgroup>

                <optgroup label="🏭 Hardware & Manufacturing">
                  <option value="exo">Exo - Human Augmentation Hardware ($1.26B at scale)</option>
                  <option value="fab">Fab - 7nm Micro-Fabs ($250M+ capacity)</option>
                  <option value="mainstreet-mfg">Mainstreet & Manufacturing (Real Assets)</option>
                  <option value="redemption-mfg">Redemption Manufacturing (Social Enterprise)</option>
                </optgroup>

                <optgroup label="🎓 Education & Impact">
                  <option value="adullam">Adullam Schools Network (200 campuses target)</option>
                </optgroup>

                <optgroup label="🎯 Strategic Services">
                  <option value="black-ops">Black Ops (Nation-scale deals + Special situations)</option>
                </optgroup>
              </select>
            </div>

            <div className="border border-[#183b6d]/20 rounded-sm p-6 bg-[#183b6d]/5">
              <h2 className="text-lg font-medium text-[#183b6d] mb-4">Ideal Customer Profile</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Target Revenue Range
                  </label>
                  <select
                    value={campaign.targetRevenue}
                    onChange={(e) => setCampaign({ ...campaign, targetRevenue: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                  >
                    <option value="">Select range...</option>
                    <option value="10M-50M">$10M - $50M</option>
                    <option value="50M-200M">$50M - $200M</option>
                    <option value="200M-1B">$200M - $1B</option>
                    <option value="1B+">$1B+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Industry/Vertical
                  </label>
                  <input
                    type="text"
                    value={campaign.targetIndustry}
                    onChange={(e) => setCampaign({ ...campaign, targetIndustry: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                    placeholder="e.g., Fintech, Healthcare, SaaS, Manufacturing"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Target Role/Title
                  </label>
                  <input
                    type="text"
                    value={campaign.targetRole}
                    onChange={(e) => setCampaign({ ...campaign, targetRole: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                    placeholder="e.g., CEO, CFO, CTO, VP Operations"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Company Stage/Size
                  </label>
                  <select
                    value={campaign.targetCompanySize}
                    onChange={(e) => setCampaign({ ...campaign, targetCompanySize: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                  >
                    <option value="">Select stage...</option>
                    <option value="seed">Seed Stage (1-10 employees)</option>
                    <option value="series-a">Series A (10-50 employees)</option>
                    <option value="series-b">Series B (50-200 employees)</option>
                    <option value="growth">Growth Stage (200-1000 employees)</option>
                    <option value="enterprise">Enterprise (1000+ employees)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border border-[#dba63f]/40 rounded-sm p-6 bg-[#dba63f]/5">
              <h2 className="text-lg font-medium text-[#183b6d] mb-4">Messaging & Positioning</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Their Pain Point (what problem do they have?)
                  </label>
                  <textarea
                    value={campaign.painPoint}
                    onChange={(e) => setCampaign({ ...campaign, painPoint: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                    rows={3}
                    placeholder="e.g., Struggling to find qualified C-suite candidates. Traditional recruiters take 6+ months."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Your Value Proposition (how do you solve it?)
                  </label>
                  <textarea
                    value={campaign.value_prop}
                    onChange={(e) => setCampaign({ ...campaign, value_prop: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                    rows={3}
                    placeholder="e.g., Close deals over text. AI-powered search delivers qualified candidates in 2 weeks, not 6 months."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    The Hook (why should they care about conversational commerce?)
                  </label>
                  <textarea
                    value={campaign.hook}
                    onChange={(e) => setCampaign({ ...campaign, hook: e.target.value })}
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d] bg-white"
                    rows={3}
                    placeholder="e.g., Plus you get Wells AI platform - run your entire procurement over text. No forms, no portals."
                  />
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleGenerateSamples}
                disabled={isGeneratingSamples || !campaign.name || !campaign.serviceOffering}
                className="w-full px-8 py-4 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingSamples ? 'Generating Samples...' : '→ Preview Sample Messages'}
              </button>
              <p className="text-xs text-[#575757] mt-3 text-center">
                AI will generate 3 sample messages for you to review
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Review Sample Messages */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="border-l-4 border-[#dba63f] pl-6 py-2">
              <h2 className="text-xl font-medium text-[#183b6d] mb-2">Review Sample Messages</h2>
              <p className="text-sm text-[#575757]">
                AI generated these personalized messages based on your ICP. If you approve this style,
                AI will generate similar messages for all targets and send automatically.
              </p>
            </div>

            {sampleMessages.map((sample, index) => (
              <div key={index} className="border border-[#183b6d]/20 rounded-sm p-6 bg-white">
                <div className="mb-4">
                  <p className="text-xs text-[#9ea1a7] mb-1">Target Example {index + 1}</p>
                  <p className="text-sm font-medium text-[#183b6d]">
                    {sample.target.name} • {sample.target.title} at {sample.target.company}
                  </p>
                </div>
                <div className="bg-[#183b6d]/5 rounded-sm p-4 border border-[#183b6d]/10">
                  <p className="text-sm text-[#183b6d] whitespace-pre-wrap font-mono">
                    {sample.message}
                  </p>
                </div>
              </div>
            ))}

            <div className="border border-[#dba63f]/40 rounded-sm p-6 bg-[#dba63f]/5">
              <h3 className="text-sm font-medium text-[#183b6d] mb-2">What happens next?</h3>
              <p className="text-sm text-[#575757] mb-4">
                If you approve this messaging style, Wells AI will:
              </p>
              <ul className="text-sm text-[#575757] space-y-2">
                <li>✓ Discover 100-500 targets matching your ICP</li>
                <li>✓ Generate personalized messages for each (similar to examples above)</li>
                <li>✓ Send via email/SMS automatically</li>
                <li>✓ Handle conversations autonomously</li>
                <li>✓ Qualify leads and book meetings</li>
                <li>✓ You monitor dashboard and jump in as needed</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-4 border-2 border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] transition-all"
              >
                ← Edit Messaging
              </button>
              <button
                onClick={handleApproveAndLaunch}
                disabled={isLaunching}
                className="flex-1 px-6 py-4 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition-all disabled:opacity-50"
              >
                {isLaunching ? 'Launching...' : '✓ Approve & Launch Campaign'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Campaign Running */}
        {step === 3 && campaignResult && (
          <div className="space-y-8">
            <div className="border border-[#dba63f]/40 bg-gradient-to-br from-[#dba63f]/10 to-transparent rounded-sm p-8 text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-2xl font-serif text-[#183b6d] mb-4">Campaign Launched!</h3>
              <p className="text-[#575757] mb-6">
                Wells AI is now running autonomously. Discovering targets, sending personalized messages,
                qualifying leads, and booking meetings.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="bg-white rounded-sm p-4 border border-[#183b6d]/20">
                  <div className="text-2xl font-bold text-[#183b6d]">{campaignResult.targetCount || 0}</div>
                  <div className="text-xs text-[#575757]">Targets Discovered</div>
                </div>
                <div className="bg-white rounded-sm p-4 border border-[#183b6d]/20">
                  <div className="text-2xl font-bold text-[#183b6d]">0</div>
                  <div className="text-xs text-[#575757]">Conversations Started</div>
                </div>
                <div className="bg-white rounded-sm p-4 border border-[#183b6d]/20">
                  <div className="text-2xl font-bold text-[#183b6d]">0</div>
                  <div className="text-xs text-[#575757]">Meetings Booked</div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <a
                href="/gtm/dashboard"
                className="inline-block px-8 py-4 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-all"
              >
                → View Campaign Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
