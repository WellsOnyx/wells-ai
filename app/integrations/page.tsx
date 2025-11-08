'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, CheckCircle, ArrowRight, Sparkles, Globe, Mail, Database, Brain, MessageSquare, Phone, Calendar, DollarSign, FileText, Users, TrendingUp } from 'lucide-react'

interface Integration {
  id: string
  name: string
  category: string
  description: string
  logo: string
  features: string[]
  status: 'active' | 'coming_soon'
  usedBy: string[]
  icon: any
}

export default function IntegrationsPage() {
  const router = useRouter()

  const integrations: Integration[] = [
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      category: 'AI Engine',
      description: 'Powers Wells with advanced AI reasoning and natural language understanding',
      logo: '🧠',
      features: [
        'Natural language processing',
        'Context-aware responses',
        'Multi-step reasoning',
        'Personalization engine'
      ],
      status: 'active',
      usedBy: ['All journeys'],
      icon: Brain
    },
    {
      id: 'apollo',
      name: 'Apollo.io',
      category: 'Lead Generation',
      description: 'Access to 275M+ contacts and 73M+ companies for prospecting',
      logo: '🎯',
      features: [
        '275M+ contact database',
        'Company intelligence',
        'Job title filtering',
        'Technology tracking'
      ],
      status: 'active',
      usedBy: ['Seller Journey', 'Founder Journey'],
      icon: Users
    },
    {
      id: 'instantly',
      name: 'Instantly.ai',
      category: 'Email Automation',
      description: 'Unlimited email sending with AI-powered deliverability optimization',
      logo: '📧',
      features: [
        'Unlimited email accounts',
        'AI warmup & rotation',
        'Deliverability optimization',
        'Campaign analytics'
      ],
      status: 'active',
      usedBy: ['Seller Journey', 'GTM Automation'],
      icon: Mail
    },
    {
      id: 'notion',
      name: 'Notion',
      category: 'Workspace',
      description: 'Centralized workspace for tracking deals, partnerships, and hiring',
      logo: '📝',
      features: [
        'Deal pipeline tracking',
        'Partnership management',
        'Hiring workflows',
        'Real-time collaboration'
      ],
      status: 'active',
      usedBy: ['All journeys'],
      icon: FileText
    },
    {
      id: 'twilio',
      name: 'Twilio',
      category: 'Communications',
      description: 'SMS and voice capabilities for real-time engagement',
      logo: '📱',
      features: [
        'SMS messaging',
        'Voice calls',
        'Two-way conversations',
        'Delivery tracking'
      ],
      status: 'active',
      usedBy: ['All journeys'],
      icon: Phone
    },
    {
      id: 'clerk',
      name: 'Clerk',
      category: 'Authentication',
      description: 'Secure user authentication and session management',
      logo: '🔐',
      features: [
        'Multi-factor authentication',
        'Social login',
        'Session management',
        'User profiles'
      ],
      status: 'active',
      usedBy: ['Platform'],
      icon: CheckCircle
    },
    {
      id: 'vercel',
      name: 'Vercel',
      category: 'Infrastructure',
      description: 'Global edge network for instant, reliable deployments',
      logo: '▲',
      features: [
        'Edge computing',
        'Instant deployments',
        'Auto-scaling',
        'Analytics'
      ],
      status: 'active',
      usedBy: ['Platform'],
      icon: Zap
    },
    {
      id: 'postgres',
      name: 'PostgreSQL',
      category: 'Database',
      description: 'Enterprise-grade database for reliable data storage',
      logo: '🐘',
      features: [
        'Relational data',
        'ACID compliance',
        'Real-time queries',
        'Data integrity'
      ],
      status: 'active',
      usedBy: ['Platform'],
      icon: Database
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'Team Collaboration',
      description: 'Real-time team communication and Wells integration',
      logo: '💬',
      features: [
        'Channel integration',
        'Direct messages',
        'Slash commands',
        'Notifications'
      ],
      status: 'active',
      usedBy: ['Founder Journey', 'GTM'],
      icon: MessageSquare
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      category: 'Professional Network',
      description: 'Access professional networks for recruiting and prospecting',
      logo: '💼',
      features: [
        'Profile enrichment',
        'Connection requests',
        'InMail campaigns',
        'Network insights'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: Users
    },
    {
      id: 'calendly',
      name: 'Calendly',
      category: 'Scheduling',
      description: 'Automated meeting scheduling and calendar management',
      logo: '📅',
      features: [
        'Meeting booking',
        'Calendar sync',
        'Timezone handling',
        'Confirmation emails'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: Calendar
    },
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'Payments',
      description: 'Secure payment processing and subscription management',
      logo: '💳',
      features: [
        'Payment processing',
        'Subscription billing',
        'Invoice management',
        'Financial reporting'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: DollarSign
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      category: 'CRM',
      description: 'Customer relationship management and sales pipeline',
      logo: '🎨',
      features: [
        'Contact management',
        'Deal tracking',
        'Email integration',
        'Reporting dashboards'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: TrendingUp
    },
    {
      id: 'zapier',
      name: 'Zapier',
      category: 'Automation',
      description: 'Connect Wells to 5000+ apps with no-code workflows',
      logo: '⚡',
      features: [
        '5000+ app integrations',
        'Custom workflows',
        'Trigger actions',
        'Data mapping'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: Zap
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      category: 'Messaging',
      description: 'Global messaging platform for customer communication',
      logo: '💚',
      features: [
        'International messaging',
        'Rich media support',
        'Business profiles',
        'Automated responses'
      ],
      status: 'coming_soon',
      usedBy: ['Coming Soon'],
      icon: MessageSquare
    }
  ]

  const categories = [
    { id: 'all', name: 'All Integrations', count: integrations.length },
    { id: 'AI Engine', name: 'AI Engine', count: integrations.filter(i => i.category === 'AI Engine').length },
    { id: 'Lead Generation', name: 'Lead Generation', count: integrations.filter(i => i.category === 'Lead Generation').length },
    { id: 'Email Automation', name: 'Email Automation', count: integrations.filter(i => i.category === 'Email Automation').length },
    { id: 'Communications', name: 'Communications', count: integrations.filter(i => i.category === 'Communications').length },
    { id: 'active', name: 'Active Now', count: integrations.filter(i => i.status === 'active').length },
  ]

  const [selectedCategory, setSelectedCategory] = useState('all')

  const filteredIntegrations = selectedCategory === 'all'
    ? integrations
    : selectedCategory === 'active'
    ? integrations.filter(i => i.status === 'active')
    : integrations.filter(i => i.category === selectedCategory)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <Zap className="w-12 h-12 text-amber-500" />
              Integrations
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Wells connects with the best tools in the world to automate your entire workflow
            </p>
            <div className="mt-6 flex items-center justify-center gap-8 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {integrations.filter(i => i.status === 'active').length} Active Integrations
              </span>
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {integrations.filter(i => i.status === 'coming_soon').length} Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Category Filter */}
        <div className="flex gap-4 mb-12 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Integrations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredIntegrations.map((integration) => {
            const Icon = integration.icon
            return (
              <div
                key={integration.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-amber-500/50 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{integration.logo}</div>
                    <div>
                      <h3 className="text-lg font-bold">{integration.name}</h3>
                      <p className="text-xs text-gray-500">{integration.category}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    integration.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {integration.status === 'active' ? 'Active' : 'Coming Soon'}
                  </span>
                </div>

                <p className="text-sm text-gray-400 mb-4">{integration.description}</p>

                <div className="space-y-2 mb-4">
                  {integration.features.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                  {integration.features.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{integration.features.length - 3} more features
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">Used in:</div>
                  <div className="flex flex-wrap gap-2">
                    {integration.usedBy.map((journey, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-700/50 text-gray-400 rounded text-xs"
                      >
                        {journey}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 rounded-xl p-8 border border-amber-700/30 mb-12">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">{integrations.filter(i => i.status === 'active').length}</div>
              <div className="text-sm text-gray-400">Active Integrations</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">275M+</div>
              <div className="text-sm text-gray-400">Contacts Database</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">∞</div>
              <div className="text-sm text-gray-400">Email Capacity</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-amber-500 mb-2">24/7</div>
              <div className="text-sm text-gray-400">AI Availability</div>
            </div>
          </div>
        </div>

        {/* Enterprise Section */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-12 border border-gray-700 text-center">
          <Globe className="w-16 h-16 text-amber-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Need a Custom Integration?</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Wells can integrate with any tool your team uses. We build custom integrations for enterprise customers to fit your exact workflow.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/contact')}
              className="px-8 py-4 bg-amber-500 text-black rounded-full text-lg font-bold hover:bg-amber-400 transition flex items-center gap-2"
            >
              Request Integration
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/docs/sdk')}
              className="px-8 py-4 bg-gray-700 text-white rounded-full text-lg font-bold hover:bg-gray-600 transition"
            >
              View API Docs
            </button>
          </div>
        </div>

        {/* Coming Soon Preview */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Coming Soon
          </h2>
          <div className="grid md:grid-cols-5 gap-4">
            {integrations.filter(i => i.status === 'coming_soon').map((integration) => (
              <div
                key={integration.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 text-center"
              >
                <div className="text-3xl mb-2">{integration.logo}</div>
                <div className="text-sm font-semibold mb-1">{integration.name}</div>
                <div className="text-xs text-gray-500">{integration.category}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
