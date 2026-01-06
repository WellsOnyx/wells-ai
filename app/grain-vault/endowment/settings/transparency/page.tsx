'use client'

/**
 * TRANSPARENCY SETTINGS - Admin Dashboard
 *
 * Controls for:
 * - Toggle what's visible to donors
 * - Customize portal branding
 * - Generate shareable links
 * - Manage embed options
 *
 * Grain & Vault Emerald Theme
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield,
  Eye,
  EyeOff,
  Link2,
  Code,
  Copy,
  Check,
  Settings,
  Palette,
  Globe,
  Lock,
  Unlock,
  ExternalLink,
  ChevronLeft,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Users,
  Heart,
  BarChart3,
  Sparkles,
  Image,
  Type,
  Share2,
  QrCode,
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  GlowOrb,
  NoiseOverlay,
  Divider,
  ProgressBar,
} from '@/components/ui/modern'
import {
  DonorPortal,
  TransparencySettings,
  mockDonorPortalData,
} from '@/lib/grain/donor-portal'

// Toggle Switch Component
function Toggle({
  enabled,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label: string
  description?: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
            <Icon className={`w-5 h-5 ${enabled ? 'text-emerald-400' : 'text-gray-400'}`} />
          </div>
        )}
        <div>
          <div className="font-medium">{label}</div>
          {description && (
            <div className="text-sm text-gray-400 mt-0.5">{description}</div>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          enabled ? 'bg-emerald-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function TransparencySettingsPage() {
  const router = useRouter()

  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [settings, setSettings] = useState<TransparencySettings>(
    DonorPortal.getDefaultSettings('org_001')
  )
  const [hasChanges, setHasChanges] = useState(false)

  // Portal info
  const org = mockDonorPortalData.org
  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/grain-vault/donor/${org.slug}`
  const embedCode = DonorPortal.generateEmbedCode({
    id: 'link_001',
    orgId: org.id,
    slug: org.slug,
    fullUrl: portalUrl,
    isPublic: true,
    views: 0,
    createdAt: new Date(),
    createdBy: 'admin',
  })

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        // In production, fetch from API
        // const res = await fetch('/api/grain/donor-portal/settings')
        // const data = await res.json()
        // setSettings(data.settings)

        // For now, use defaults
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Update setting
  const updateSetting = (key: keyof TransparencySettings, value: boolean | string | undefined) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // Save settings
  const handleSave = async () => {
    setSaving(true)
    try {
      // In production, save to API
      // await fetch('/api/grain/donor-portal/settings', {
      //   method: 'PUT',
      //   body: JSON.stringify(settings),
      // })

      await new Promise(resolve => setTimeout(resolve, 1000))
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  // Copy to clipboard
  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-pulse">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div className="text-gray-400">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
      {/* Background Effects */}
      <NoiseOverlay />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="green" size="xl" position={{ top: '-200px', left: '30%' }} />
        <GlowOrb color="purple" size="md" position={{ bottom: '20%', right: '-50px' }} animate={false} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                  <Link
                    href="/grain-vault/endowment/settings"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </Link>
                  <div className="h-6 w-px bg-white/10" />
                  <span className="font-medium">Transparency Portal</span>
                </div>

                <div className="flex items-center gap-4">
                  {hasChanges && (
                    <span className="text-sm text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Unsaved changes
                    </span>
                  )}
                  <ShimmerButton
                    size="sm"
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!hasChanges}
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </ShimmerButton>
                </div>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Main Content */}
        <main className="pt-24 pb-16 px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Transparency Settings</h1>
                  <p className="text-gray-400">Control what donors see on your public portal</p>
                </div>
              </div>

              <FloatingBadge color="green">
                <Shield className="w-4 h-4" />
                Donor Transparency Portal
              </FloatingBadge>
            </div>

            {/* Portal Status */}
            <GlassCard padding="lg" className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${settings.portalEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <div>
                    <div className="font-semibold">
                      Portal Status: {settings.portalEnabled ? 'Live' : 'Disabled'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {settings.portalEnabled
                        ? 'Your portal is publicly accessible'
                        : 'Your portal is hidden from donors'}
                    </div>
                  </div>
                </div>
                <ShimmerButton
                  variant={settings.portalEnabled ? 'secondary' : 'primary'}
                  size="sm"
                  className={settings.portalEnabled ? '' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}
                  onClick={() => updateSetting('portalEnabled', !settings.portalEnabled)}
                >
                  {settings.portalEnabled ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Disable Portal
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Enable Portal
                    </>
                  )}
                </ShimmerButton>
              </div>
            </GlassCard>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Settings Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Visibility Controls */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-400" />
                    Visibility Controls
                  </h2>
                  <p className="text-sm text-gray-400 mb-6">
                    Choose what information is visible to donors on your transparency portal.
                  </p>

                  <div className="space-y-4">
                    <Toggle
                      enabled={settings.showEndowmentValue}
                      onChange={(v) => updateSetting('showEndowmentValue', v)}
                      label="Show Endowment Value"
                      description="Display total endowment size and protected principal"
                      icon={DollarSign}
                    />

                    <Toggle
                      enabled={settings.showFundBalances}
                      onChange={(v) => updateSetting('showFundBalances', v)}
                      label="Show Fund Balances"
                      description="Display current balance for each fund"
                      icon={BarChart3}
                    />

                    <Toggle
                      enabled={settings.showGrantAmounts}
                      onChange={(v) => updateSetting('showGrantAmounts', v)}
                      label="Show Grant Amounts"
                      description="Display dollar amounts on individual grants"
                      icon={Heart}
                    />

                    <Toggle
                      enabled={settings.showDonorNames}
                      onChange={(v) => updateSetting('showDonorNames', v)}
                      label="Show Donor Names"
                      description="Display names of non-anonymous donors"
                      icon={Users}
                    />

                    <Toggle
                      enabled={settings.showImpactMetrics}
                      onChange={(v) => updateSetting('showImpactMetrics', v)}
                      label="Show Impact Metrics"
                      description="Display impact dashboard with statistics"
                      icon={Sparkles}
                    />

                    <Divider className="my-4" />

                    <Toggle
                      enabled={settings.showGrainPrice}
                      onChange={(v) => updateSetting('showGrainPrice', v)}
                      label="Show GRAIN Price"
                      description="Display current GRAIN token price"
                      icon={DollarSign}
                    />

                    <Toggle
                      enabled={settings.showAppreciation}
                      onChange={(v) => updateSetting('showAppreciation', v)}
                      label="Show Appreciation"
                      description="Display endowment appreciation over time"
                      icon={BarChart3}
                    />

                    <Toggle
                      enabled={settings.showProtectionRatio}
                      onChange={(v) => updateSetting('showProtectionRatio', v)}
                      label="Show Protection Ratio"
                      description="Display vault coverage and protection status"
                      icon={Shield}
                    />
                  </div>
                </GlassCard>

                {/* Branding */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-emerald-400" />
                    Branding & Customization
                  </h2>

                  <div className="space-y-4">
                    <Toggle
                      enabled={settings.useCustomBranding}
                      onChange={(v) => updateSetting('useCustomBranding', v)}
                      label="Use Custom Branding"
                      description="Apply your organization's brand colors"
                      icon={Palette}
                    />

                    <Toggle
                      enabled={settings.hideGrainVaultBranding}
                      onChange={(v) => updateSetting('hideGrainVaultBranding', v)}
                      label="Hide Grain & Vault Branding"
                      description="Remove 'Powered by Grain & Vault' footer"
                      icon={Image}
                    />

                    <Divider className="my-4" />

                    {/* Custom CTA */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                        <Type className="w-4 h-4 text-emerald-400" />
                        Custom CTA Text
                      </label>
                      <input
                        type="text"
                        value={settings.customCtaText || ''}
                        onChange={(e) => updateSetting('customCtaText', e.target.value)}
                        placeholder="Donate Now"
                        className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-emerald-400" />
                        Custom CTA URL
                      </label>
                      <input
                        type="url"
                        value={settings.customCtaUrl || ''}
                        onChange={(e) => updateSetting('customCtaUrl', e.target.value)}
                        placeholder="https://your-donation-page.com"
                        className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                        <Type className="w-4 h-4 text-emerald-400" />
                        Custom Footer Message
                      </label>
                      <textarea
                        value={settings.customFooterMessage || ''}
                        onChange={(e) => updateSetting('customFooterMessage', e.target.value)}
                        placeholder="Thank you for supporting our mission..."
                        rows={3}
                        className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                      />
                    </div>
                  </div>
                </GlassCard>

                {/* Access Control */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-400" />
                    Access Control
                  </h2>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Portal Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={settings.portalPassword || ''}
                      onChange={(e) => updateSetting('portalPassword', e.target.value || undefined)}
                      placeholder="Leave blank for public access"
                      className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Set a password to restrict access to your transparency portal.
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Preview & Sharing Column */}
              <div className="space-y-6">
                {/* Portal Link */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-emerald-400" />
                    Portal Link
                  </h2>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                    <div className="text-sm text-gray-400 mb-2">Your portal URL</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm text-emerald-400 truncate">
                        {portalUrl}
                      </code>
                      <button
                        onClick={() => handleCopy(portalUrl, 'url')}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        {copied === 'url' ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <ShimmerButton
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(portalUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Preview
                    </ShimmerButton>
                    <ShimmerButton
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopy(portalUrl, 'url')}
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </ShimmerButton>
                  </div>
                </GlassCard>

                {/* Embed Code */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Code className="w-5 h-5 text-emerald-400" />
                    Embed Code
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Add your transparency portal to any website.
                  </p>

                  <div className="relative">
                    <pre className="p-4 rounded-xl bg-black/50 border border-white/10 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                      {embedCode}
                    </pre>
                    <button
                      onClick={() => handleCopy(embedCode, 'embed')}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      {copied === 'embed' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </GlassCard>

                {/* Preview Card */}
                <GlassCard padding="lg" glow="green">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-400" />
                    Preview
                  </h2>

                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-500/20">
                    {/* Mini Preview */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/30" />
                        <div className="h-3 w-24 bg-white/20 rounded" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 rounded-lg bg-white/10 p-2">
                            <div className="h-2 w-8 bg-emerald-400/50 rounded mb-1" />
                            <div className="h-2 w-full bg-white/20 rounded" />
                          </div>
                        ))}
                      </div>
                      <div className="h-16 rounded-lg bg-white/5 border border-white/10 p-2">
                        <div className="h-2 w-1/2 bg-white/20 rounded mb-2" />
                        <div className="h-2 w-full bg-white/10 rounded" />
                      </div>
                    </div>

                    {/* Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <button
                        onClick={() => window.open(portalUrl, '_blank')}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Full Preview
                      </button>
                    </div>
                  </div>
                </GlassCard>

                {/* Stats */}
                <GlassCard padding="lg">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    Portal Stats
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-2xl font-bold text-emerald-400">1,247</div>
                      <div className="text-xs text-gray-400">Total Views</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-2xl font-bold text-emerald-400">89</div>
                      <div className="text-xs text-gray-400">This Week</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-2xl font-bold text-emerald-400">42</div>
                      <div className="text-xs text-gray-400">Shares</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <div className="text-2xl font-bold text-emerald-400">12</div>
                      <div className="text-xs text-gray-400">Embeds</div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
