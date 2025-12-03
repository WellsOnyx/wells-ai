'use client'

import { useState } from 'react'
import { Calendar, MessageSquare, Linkedin, Database, Check, ExternalLink } from 'lucide-react'

interface IntegrationsStepProps {
  onContinue: () => void
  onSkip: () => void
}

interface IntegrationConfig {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  recommended: boolean
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Auto-schedule meetings when Wells finds matches',
    icon: Calendar,
    color: 'from-blue-500 to-blue-600',
    recommended: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get real-time notifications in your workspace',
    icon: MessageSquare,
    color: 'from-purple-500 to-purple-600',
    recommended: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Enable warm introductions through your network',
    icon: Linkedin,
    color: 'from-blue-600 to-blue-700',
    recommended: false,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices and payments automatically',
    icon: Database,
    color: 'from-green-500 to-green-600',
    recommended: false,
  },
]

export function IntegrationsStep({ onContinue, onSkip }: IntegrationsStepProps) {
  const [connected, setConnected] = useState<string[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = async (integrationId: string) => {
    setConnecting(integrationId)

    // Simulate OAuth flow
    // In production, this would redirect to OAuth provider
    await new Promise(resolve => setTimeout(resolve, 1500))

    setConnected(prev => [...prev, integrationId])
    setConnecting(null)
  }

  const hasConnections = connected.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Connect your apps
        </h1>
        <p className="text-xl text-gray-400">
          Help Wells work faster by connecting your tools
        </p>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const isConnected = connected.includes(integration.id)
          const isConnecting = connecting === integration.id
          const Icon = integration.icon

          return (
            <div
              key={integration.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                isConnected
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{integration.name}</h3>
                      {integration.recommended && !isConnected && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-500">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{integration.description}</p>
                  </div>
                </div>

                {/* Action Button */}
                {isConnected ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    disabled={isConnecting}
                    className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                      isConnecting
                        ? 'border-gray-700 text-gray-500 cursor-wait'
                        : 'border-gray-700 text-white hover:border-amber-500 hover:bg-amber-500/10'
                    }`}
                  >
                    {isConnecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Value Prop */}
      <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
        <h4 className="font-medium text-white mb-2">Why connect?</h4>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Calendar: Wells auto-books meetings when both parties are free
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Slack: Get instant notifications, respond without leaving work
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            LinkedIn: Warm intros close 3x faster than cold outreach
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onSkip}
          className="px-6 py-3 border border-gray-700 rounded-xl text-gray-400 font-medium hover:bg-gray-900 transition-all"
        >
          Skip for now
        </button>
        <button
          onClick={onContinue}
          className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all ${
            hasConnections
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          {hasConnections ? 'Continue' : 'Skip & Continue'}
        </button>
      </div>
    </div>
  )
}
