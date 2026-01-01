'use client'

/**
 * Cold Start Control Center
 *
 * The nuclear launch console for WellsAI
 * Import contacts, create campaigns, BLAST
 */

import { useState, useEffect } from 'react'
import {
  Rocket,
  Upload,
  Users,
  Send,
  BarChart3,
  Mail,
  MessageSquare,
  Linkedin,
  Twitter,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye,
  MousePointer,
  UserPlus,
  TrendingUp,
  Lock
} from 'lucide-react'

const MASTER_KEY = 'wells-master-2024-coldstart'

interface Stats {
  total: number
  bySource: Record<string, number>
  byRelationship: Record<string, number>
  withEmail: number
  withPhone: number
  contacted: number
  converted: number
}

export default function ColdStartPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [authKey, setAuthKey] = useState('')
  const [authError, setAuthError] = useState('')

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  // Import state
  const [importData, setImportData] = useState('')
  const [importSource, setImportSource] = useState('linkedin')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Campaign state
  const [campaignName, setCampaignName] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [selectedTemplate, setSelectedTemplate] = useState('founder_personal')
  const [targetLimit, setTargetLimit] = useState(1000)
  const [launching, setLaunching] = useState(false)
  const [launchResult, setLaunchResult] = useState<any>(null)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<any>(null)

  // Auth check
  const handleAuth = () => {
    if (authKey === MASTER_KEY) {
      setAuthenticated(true)
      setAuthError('')
      fetchStats()
    } else {
      setAuthError('Invalid master key')
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coldstart?action=stats', {
        headers: { 'Authorization': `Bearer ${MASTER_KEY}` }
      })
      const data = await res.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Import contacts
  const handleImport = async () => {
    if (!importData.trim()) return

    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch('/api/coldstart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MASTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: importSource === 'linkedin' ? 'import_linkedin' : 'import_csv',
          csvData: importData,
          source: importSource
        })
      })

      const result = await res.json()
      setImportResult(result)

      if (result.imported > 0) {
        fetchStats()
      }
    } catch (error: any) {
      setImportResult({ error: error.message })
    } finally {
      setImporting(false)
    }
  }

  // Nuclear Launch
  const handleLaunch = async () => {
    if (!campaignName.trim()) return

    setLaunching(true)
    setLaunchResult(null)

    try {
      const res = await fetch('/api/coldstart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MASTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'nuclear_launch',
          campaignName,
          channels: selectedChannels,
          emailTemplate: selectedTemplate,
          limit: targetLimit
        })
      })

      const result = await res.json()
      setLaunchResult(result)
      fetchStats()
    } catch (error: any) {
      setLaunchResult({ error: error.message })
    } finally {
      setLaunching(false)
    }
  }

  // Process queue
  const handleProcessQueue = async () => {
    setProcessing(true)
    setProcessResult(null)

    try {
      const res = await fetch('/api/coldstart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MASTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'process_queue',
          batchSize: 50
        })
      })

      const result = await res.json()
      setProcessResult(result)
      fetchStats()
    } catch (error: any) {
      setProcessResult({ error: error.message })
    } finally {
      setProcessing(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Rocket className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Cold Start Control</h1>
              <p className="text-red-400 text-sm">☢️ RESTRICTED ACCESS ☢️</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Master Key
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={authKey}
                    onChange={(e) => setAuthKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                    placeholder="Enter master key..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
                {authError && (
                  <p className="text-red-400 text-sm mt-2">{authError}</p>
                )}
              </div>

              <button
                onClick={handleAuth}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Access Control Center
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/10 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-red-500/20 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Cold Start Control Center</h1>
                <p className="text-sm text-red-400">☢️ Nuclear Launch Console</p>
              </div>
            </div>

            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm hover:bg-white/20 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Contacts</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Mail className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.withEmail.toLocaleString()}</p>
              <p className="text-xs text-gray-400">With Email</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <MessageSquare className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.withPhone.toLocaleString()}</p>
              <p className="text-xs text-gray-400">With Phone</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Send className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.contacted.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Contacted</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Eye className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">-</p>
              <p className="text-xs text-gray-400">Opened</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <MousePointer className="w-6 h-6 text-pink-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">-</p>
              <p className="text-xs text-gray-400">Clicked</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <UserPlus className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.converted.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Converted</p>
            </div>
          </div>
        )}

        {/* Source breakdown */}
        {stats && Object.keys(stats.bySource).length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Contacts by Source</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.bySource).map(([source, count]) => (
                <div key={source} className="px-4 py-2 bg-white/5 rounded-lg">
                  <span className="text-gray-400">{source}:</span>{' '}
                  <span className="font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Import Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Import Contacts</h2>
                <p className="text-sm text-gray-400">LinkedIn, Twitter, CSV exports</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Source</label>
                <div className="flex gap-2">
                  {[
                    { id: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
                    { id: 'twitter', icon: Twitter, label: 'Twitter' },
                    { id: 'email_export', icon: Mail, label: 'Email CSV' }
                  ].map(source => (
                    <button
                      key={source.id}
                      onClick={() => setImportSource(source.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
                        importSource === source.id
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <source.icon className="w-4 h-4" />
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Paste CSV Data
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={8}
                  placeholder="Paste your LinkedIn Connections.csv, Twitter followers, or email list here..."
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              <button
                onClick={handleImport}
                disabled={importing || !importData.trim()}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {importing ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Importing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5" />
                    Import Contacts
                  </span>
                )}
              </button>

              {importResult && (
                <div className={`p-4 rounded-xl ${
                  importResult.error
                    ? 'bg-red-500/20 border border-red-500/30'
                    : 'bg-emerald-500/20 border border-emerald-500/30'
                }`}>
                  {importResult.error ? (
                    <p className="text-red-400">{importResult.error}</p>
                  ) : (
                    <>
                      <p className="text-emerald-400 font-medium">
                        ✓ Imported {importResult.imported} contacts
                      </p>
                      {importResult.duplicates > 0 && (
                        <p className="text-amber-400 text-sm mt-1">
                          {importResult.duplicates} duplicates updated
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Launch Section */}
          <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">☢️ Nuclear Launch</h2>
                <p className="text-sm text-red-400">Create campaign & blast</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., LinkedIn 155K Blast"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Channels</label>
                <div className="flex gap-2">
                  {[
                    { id: 'email', icon: Mail, label: 'Email' },
                    { id: 'sms', icon: MessageSquare, label: 'SMS' }
                  ].map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        if (selectedChannels.includes(channel.id)) {
                          setSelectedChannels(selectedChannels.filter(c => c !== channel.id))
                        } else {
                          setSelectedChannels([...selectedChannels, channel.id])
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
                        selectedChannels.includes(channel.id)
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <channel.icon className="w-4 h-4" />
                      {channel.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50"
                >
                  <option value="founder_personal">Founder Personal (casual)</option>
                  <option value="supplier_invite">Supplier Invite</option>
                  <option value="buyer_value">Buyer Value Prop</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Target Limit: {targetLimit.toLocaleString()}
                </label>
                <input
                  type="range"
                  min={100}
                  max={50000}
                  step={100}
                  value={targetLimit}
                  onChange={(e) => setTargetLimit(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-400 font-medium">Warning: This will send real emails/SMS</p>
                    <p className="text-gray-400 mt-1">
                      Make sure Resend API key is configured before launching email campaigns.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLaunch}
                disabled={launching || !campaignName.trim() || selectedChannels.length === 0}
                className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {launching ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Launching...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Rocket className="w-5 h-5" />
                    ☢️ NUCLEAR LAUNCH
                  </span>
                )}
              </button>

              {launchResult && (
                <div className={`p-4 rounded-xl ${
                  launchResult.error
                    ? 'bg-red-500/20 border border-red-500/30'
                    : 'bg-emerald-500/20 border border-emerald-500/30'
                }`}>
                  {launchResult.error ? (
                    <p className="text-red-400">{launchResult.error}</p>
                  ) : (
                    <>
                      <p className="text-emerald-400 font-medium mb-2">
                        ☢️ {launchResult.message}
                      </p>
                      <p className="text-white">
                        Queued: {launchResult.queued?.toLocaleString()} outreach records
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Click "Process Queue" to start sending
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Process Queue Section */}
        <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Send className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Process Outreach Queue</h2>
                <p className="text-sm text-gray-400">Send queued emails and SMS</p>
              </div>
            </div>

            <button
              onClick={handleProcessQueue}
              disabled={processing}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Process Queue (50)
                </>
              )}
            </button>
          </div>

          {processResult && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl">
              <p className="text-white">
                Processed: {processResult.processed} |
                Sent: <span className="text-emerald-400">{processResult.sent}</span> |
                Failed: <span className="text-red-400">{processResult.failed}</span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
