'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OFFER_PACKAGES } from '@/lib/gtm/offer-packages'

interface ICPSuggestion {
  titles: string[]
  industries: string[]
  companySizes: string[]
  painPoints: string[]
  valueProps: string[]
}

export default function LaunchCampaign() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: Service, 2: ICP, 3: Preview, 4: Launch
  const [loading, setLoading] = useState(false)

  // Step 1: Service Selection
  const [serviceOffering, setServiceOffering] = useState('')

  // Step 2: ICP Development
  const [icpSuggestion, setICPSuggestion] = useState<ICPSuggestion | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [targetTitles, setTargetTitles] = useState<string[]>([])
  const [targetIndustries, setTargetIndustries] = useState<string[]>([])
  const [companySizes, setCompanySizes] = useState<string[]>([])
  const [painPoints, setPainPoints] = useState<string[]>([])
  const [valueProps, setValueProps] = useState<string[]>([])
  const [customNotes, setCustomNotes] = useState('')

  // Step 3: Preview
  const [previewMessages, setPreviewMessages] = useState<any[]>([])

  // Step 4: Launch
  const [launchConfig, setLaunchConfig] = useState({
    targetCount: 100,
    messagesPerDay: 20,
    channels: ['Email'] as string[],
    autoApprove: false
  })

  // Load ICP suggestion when service selected
  useEffect(() => {
    if (serviceOffering) {
      loadICPSuggestion()
    }
  }, [serviceOffering])

  const loadICPSuggestion = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/gtm/icp/suggest?service=${encodeURIComponent(serviceOffering)}`)
      const data = await response.json()

      if (data.success && data.suggestion) {
        setICPSuggestion(data.suggestion)
        setTargetTitles(data.suggestion.titles || [])
        setTargetIndustries(data.suggestion.industries || [])
        setCompanySizes(data.suggestion.companySizes || [])
        setPainPoints(data.suggestion.painPoints || [])
        setValueProps(data.suggestion.valueProps || [])

        // Auto-generate campaign name
        const offerPackage = OFFER_PACKAGES[serviceOffering as keyof typeof OFFER_PACKAGES]
        if (offerPackage) {
          setCampaignName(`${offerPackage.name} - ${data.suggestion.industries?.[0] || 'Enterprise'}`)
        }
      }
    } catch (error) {
      console.error('Failed to load ICP suggestion:', error)
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/gtm/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceOffering,
          targetTitles,
          targetIndustries,
          companySizes,
          painPoints,
          valueProps
        })
      })

      const data = await response.json()
      if (data.success) {
        setPreviewMessages(data.samples || [])
        setStep(3)
      }
    } catch (error) {
      console.error('Failed to generate preview:', error)
    } finally {
      setLoading(false)
    }
  }

  const launchCampaign = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/gtm/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          serviceOffering,
          icp: {
            titles: targetTitles,
            industries: targetIndustries,
            companySizes,
            painPoints,
            valueProps,
            notes: customNotes
          },
          targetCount: launchConfig.targetCount,
          messagesPerDay: launchConfig.messagesPerDay,
          channels: launchConfig.channels,
          autoApprove: launchConfig.autoApprove
        })
      })

      const data = await response.json()
      if (data.success) {
        // Redirect to dashboard
        router.push('/gtm/dashboard')
      }
    } catch (error) {
      console.error('Failed to launch campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const offerPackage = serviceOffering ? OFFER_PACKAGES[serviceOffering as keyof typeof OFFER_PACKAGES] : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif text-[#183b6d]">Launch GTM Campaign</h1>
              <div className="text-sm text-[#575757] mt-1">
                Step {step} of 4: {
                  step === 1 ? 'Service Selection' :
                  step === 2 ? 'ICP Development' :
                  step === 3 ? 'Message Preview' :
                  'Launch Configuration'
                }
              </div>
            </div>
            <button
              onClick={() => router.push('/gtm/dashboard')}
              className="text-[#9ea1a7] hover:text-[#183b6d]"
            >
              ✕ Cancel
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  s <= step ? 'bg-[#183b6d]' : 'bg-[#9ea1a7]/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* STEP 1: SERVICE SELECTION */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                Select Service Offering
              </h2>
              <p className="text-sm text-[#575757]">
                Choose which Wells Onyx service you're selling in this campaign
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(OFFER_PACKAGES).map(([key, pkg]) => (
                <button
                  key={key}
                  onClick={() => {
                    setServiceOffering(key)
                    setStep(2)
                  }}
                  className={`border-2 rounded-sm p-6 text-left transition-all ${
                    serviceOffering === key
                      ? 'border-[#dba63f] bg-[#dba63f]/5'
                      : 'border-[#9ea1a7]/20 hover:border-[#183b6d]'
                  }`}
                >
                  <div className="text-lg font-medium text-[#183b6d] mb-2">
                    {pkg.name}
                  </div>
                  <div className="text-sm text-[#575757] mb-3">
                    {pkg.category}
                  </div>
                  <div className="text-xs text-[#dba63f]">
                    {'range' in pkg.pricing ? pkg.pricing.range : 'Contact for pricing'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: ICP DEVELOPMENT */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                  Define Your Ideal Customer Profile
                </h2>
                <p className="text-sm text-[#575757]">
                  AI has analyzed historical deals to suggest your ICP. Customize as needed.
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-[#9ea1a7] hover:text-[#183b6d]"
              >
                ← Change Service
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="text-[#9ea1a7]">Analyzing historical deals...</div>
              </div>
            ) : (
              <>
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Executive Search - Tech Companies"
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                  />
                </div>

                {/* Target Titles */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Target Job Titles
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {targetTitles.map((title, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-[#183b6d]/10 text-[#183b6d] rounded-full text-sm flex items-center gap-2"
                      >
                        {title}
                        <button
                          onClick={() => setTargetTitles(targetTitles.filter((_, i) => i !== idx))}
                          className="text-[#9ea1a7] hover:text-[#183b6d]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add title (e.g., CEO, VP of Engineering)"
                    className="w-full px-4 py-2 border border-[#9ea1a7]/30 rounded-sm text-sm focus:outline-none focus:border-[#183b6d]"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                        setTargetTitles([...targetTitles, (e.target as HTMLInputElement).value])
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                </div>

                {/* Target Industries */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Target Industries
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {targetIndustries.map((industry, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-[#183b6d]/10 text-[#183b6d] rounded-full text-sm flex items-center gap-2"
                      >
                        {industry}
                        <button
                          onClick={() => setTargetIndustries(targetIndustries.filter((_, i) => i !== idx))}
                          className="text-[#9ea1a7] hover:text-[#183b6d]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add industry (e.g., Healthcare, Technology)"
                    className="w-full px-4 py-2 border border-[#9ea1a7]/30 rounded-sm text-sm focus:outline-none focus:border-[#183b6d]"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                        setTargetIndustries([...targetIndustries, (e.target as HTMLInputElement).value])
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                </div>

                {/* Company Sizes */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Company Size
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {['1-50', '51-200', '201-1000', '1000+'].map(size => (
                      <button
                        key={size}
                        onClick={() => {
                          if (companySizes.includes(size)) {
                            setCompanySizes(companySizes.filter(s => s !== size))
                          } else {
                            setCompanySizes([...companySizes, size])
                          }
                        }}
                        className={`px-4 py-3 border rounded-sm text-sm transition-all ${
                          companySizes.includes(size)
                            ? 'border-[#183b6d] bg-[#183b6d]/10 text-[#183b6d]'
                            : 'border-[#9ea1a7]/30 text-[#575757] hover:border-[#183b6d]'
                        }`}
                      >
                        {size} employees
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pain Points */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Customer Pain Points
                  </label>
                  <div className="space-y-2 mb-3">
                    {painPoints.map((pain, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-[#9ea1a7] mt-1">•</span>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm text-[#575757]">{pain}</span>
                          <button
                            onClick={() => setPainPoints(painPoints.filter((_, i) => i !== idx))}
                            className="text-xs text-[#9ea1a7] hover:text-[#183b6d]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea
                    placeholder="Add pain point (e.g., Struggling to find qualified C-suite talent)"
                    className="w-full px-4 py-2 border border-[#9ea1a7]/30 rounded-sm text-sm focus:outline-none focus:border-[#183b6d]"
                    rows={2}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLTextAreaElement).value) {
                        e.preventDefault()
                        setPainPoints([...painPoints, (e.target as HTMLTextAreaElement).value])
                        ;(e.target as HTMLTextAreaElement).value = ''
                      }
                    }}
                  />
                </div>

                {/* Value Props */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Value Propositions
                  </label>
                  <div className="space-y-2 mb-3">
                    {valueProps.map((prop, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-[#dba63f] mt-1">✓</span>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm text-[#575757]">{prop}</span>
                          <button
                            onClick={() => setValueProps(valueProps.filter((_, i) => i !== idx))}
                            className="text-xs text-[#9ea1a7] hover:text-[#183b6d]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea
                    placeholder="Add value proposition (e.g., 90-day guarantee on placements)"
                    className="w-full px-4 py-2 border border-[#9ea1a7]/30 rounded-sm text-sm focus:outline-none focus:border-[#183b6d]"
                    rows={2}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLTextAreaElement).value) {
                        e.preventDefault()
                        setValueProps([...valueProps, (e.target as HTMLTextAreaElement).value])
                        ;(e.target as HTMLTextAreaElement).value = ''
                      }
                    }}
                  />
                </div>

                {/* Custom Notes */}
                <div>
                  <label className="block text-sm font-medium text-[#183b6d] mb-2">
                    Additional Campaign Notes (Optional)
                  </label>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Any special instructions for this campaign..."
                    className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-6 border-t border-[#9ea1a7]/20">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={generatePreview}
                    disabled={!campaignName || targetTitles.length === 0}
                    className="px-8 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Preview →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: MESSAGE PREVIEW */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                  Preview AI-Generated Messages
                </h2>
                <p className="text-sm text-[#575757]">
                  These are sample messages AI will generate for your targets
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-sm text-[#9ea1a7] hover:text-[#183b6d]"
              >
                ← Edit ICP
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="text-[#9ea1a7]">Generating preview messages...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {previewMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-sm font-medium text-[#183b6d] mb-1">
                          Sample {idx + 1}: {msg.targetTitle}
                        </div>
                        <div className="text-xs text-[#9ea1a7]">
                          {msg.targetIndustry} • {msg.companySize}
                        </div>
                      </div>
                      <span className="text-xs px-3 py-1 bg-[#183b6d]/10 text-[#183b6d] rounded">
                        Email
                      </span>
                    </div>

                    {msg.subject && (
                      <div className="mb-3 pb-3 border-b border-[#9ea1a7]/20">
                        <div className="text-xs text-[#9ea1a7] mb-1">Subject Line</div>
                        <div className="text-sm font-medium text-[#183b6d]">{msg.subject}</div>
                      </div>
                    )}

                    <div className="text-sm text-[#575757] whitespace-pre-wrap bg-[#183b6d]/5 p-4 rounded-sm">
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-[#9ea1a7]/20">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-8 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531] transition-all"
              >
                Configure Launch →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: LAUNCH CONFIGURATION */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                  Launch Configuration
                </h2>
                <p className="text-sm text-[#575757]">
                  Set campaign parameters and start the GTM engine
                </p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="text-sm text-[#9ea1a7] hover:text-[#183b6d]"
              >
                ← Back to Preview
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Target Count */}
              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Number of Targets to Discover
                </label>
                <input
                  type="number"
                  value={launchConfig.targetCount}
                  onChange={(e) => setLaunchConfig({ ...launchConfig, targetCount: parseInt(e.target.value) || 100 })}
                  className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                  min="10"
                  max="1000"
                  step="10"
                />
                <div className="text-xs text-[#575757] mt-1">
                  We'll use Apollo.io to find {launchConfig.targetCount} prospects matching your ICP
                </div>
              </div>

              {/* Messages Per Day */}
              <div>
                <label className="block text-sm font-medium text-[#183b6d] mb-2">
                  Outreach Messages Per Day
                </label>
                <input
                  type="number"
                  value={launchConfig.messagesPerDay}
                  onChange={(e) => setLaunchConfig({ ...launchConfig, messagesPerDay: parseInt(e.target.value) || 20 })}
                  className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"
                  min="5"
                  max="100"
                  step="5"
                />
                <div className="text-xs text-[#575757] mt-1">
                  Safe limit to avoid spam filters and maintain deliverability
                </div>
              </div>
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-[#183b6d] mb-2">
                Outreach Channels
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['Email', 'SMS', 'LinkedIn'].map(channel => (
                  <button
                    key={channel}
                    onClick={() => {
                      if (launchConfig.channels.includes(channel)) {
                        setLaunchConfig({
                          ...launchConfig,
                          channels: launchConfig.channels.filter(c => c !== channel)
                        })
                      } else {
                        setLaunchConfig({
                          ...launchConfig,
                          channels: [...launchConfig.channels, channel]
                        })
                      }
                    }}
                    className={`px-4 py-3 border rounded-sm text-sm transition-all ${
                      launchConfig.channels.includes(channel)
                        ? 'border-[#183b6d] bg-[#183b6d]/10 text-[#183b6d]'
                        : 'border-[#9ea1a7]/30 text-[#575757] hover:border-[#183b6d]'
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Approve */}
            <div className="border border-[#9ea1a7]/20 rounded-sm p-5">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={launchConfig.autoApprove}
                  onChange={(e) => setLaunchConfig({ ...launchConfig, autoApprove: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#183b6d] mb-1">
                    Auto-approve AI-generated messages
                  </div>
                  <div className="text-xs text-[#575757]">
                    If unchecked, all messages will require human approval before sending. Recommended to
                    keep off for first campaign to ensure quality.
                  </div>
                </div>
              </label>
            </div>

            {/* Campaign Summary */}
            <div className="border-l-4 border-[#dba63f] bg-[#dba63f]/5 rounded-sm p-6">
              <h3 className="text-lg font-medium text-[#183b6d] mb-4">
                Campaign Summary
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[#9ea1a7] mb-1">Campaign Name</div>
                  <div className="text-[#183b6d] font-medium">{campaignName}</div>
                </div>
                <div>
                  <div className="text-[#9ea1a7] mb-1">Service Offering</div>
                  <div className="text-[#183b6d] font-medium">{offerPackage?.name}</div>
                </div>
                <div>
                  <div className="text-[#9ea1a7] mb-1">Target Count</div>
                  <div className="text-[#183b6d] font-medium">{launchConfig.targetCount} prospects</div>
                </div>
                <div>
                  <div className="text-[#9ea1a7] mb-1">Outreach Pace</div>
                  <div className="text-[#183b6d] font-medium">{launchConfig.messagesPerDay}/day</div>
                </div>
                <div>
                  <div className="text-[#9ea1a7] mb-1">Channels</div>
                  <div className="text-[#183b6d] font-medium">{launchConfig.channels.join(', ')}</div>
                </div>
                <div>
                  <div className="text-[#9ea1a7] mb-1">Approval Mode</div>
                  <div className="text-[#183b6d] font-medium">
                    {launchConfig.autoApprove ? 'Auto-approve' : 'Manual review'}
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="flex justify-between pt-6 border-t border-[#9ea1a7]/20">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
              >
                ← Back
              </button>
              <button
                onClick={launchCampaign}
                disabled={loading || launchConfig.channels.length === 0}
                className="px-12 py-4 bg-[#dba63f] text-white font-medium text-lg rounded-sm hover:bg-[#c89531] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Launching...' : '🚀 Launch Campaign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
