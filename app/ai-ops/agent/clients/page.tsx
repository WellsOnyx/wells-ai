'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  Star,
  TrendingUp,
  MessageSquare,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Send,
  Plus,
  DollarSign,
  Users,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Mail,
  Phone,
  ExternalLink,
  Filter,
  Download,
  BarChart3,
  Sparkles,
} from 'lucide-react'

interface ClientAccount {
  id: string
  companyName: string
  industry: string
  logo?: string
  contactName: string
  contactEmail: string
  contactPhone: string
  activeSops: number
  satisfactionScore: number
  monthlyValue: number
  tasksThisWeek: number
  tasksCompleted: number
  tasksPending: number
  package: 'basic' | 'professional' | 'enterprise'
  startDate: string
  lastContact: string
  satisfactionTrend: 'up' | 'down' | 'stable'
  riskLevel: 'low' | 'medium' | 'high'
}

interface ClientSOP {
  id: string
  name: string
  category: string
  frequency: string
  lastRun: string
  nextRun: string
  successRate: number
  status: 'active' | 'paused' | 'completed'
  description: string
}

interface CommunicationRecord {
  id: string
  type: 'email' | 'call' | 'meeting' | 'task'
  subject: string
  date: string
  notes: string
}

interface Task {
  id: string
  title: string
  status: 'completed' | 'pending' | 'in-progress'
  dueDate: string
  completedDate?: string
  priority: 'low' | 'medium' | 'high'
}

const MOCK_CLIENTS: ClientAccount[] = [
  {
    id: 'CLT-001',
    companyName: 'TechVenture Labs',
    industry: 'Technology',
    contactName: 'Sarah Chen',
    contactEmail: 'sarah.chen@techventure.com',
    contactPhone: '+1 (555) 123-4567',
    activeSops: 5,
    satisfactionScore: 4.9,
    monthlyValue: 15000,
    tasksThisWeek: 12,
    tasksCompleted: 10,
    tasksPending: 2,
    package: 'enterprise',
    startDate: '2024-01-15',
    lastContact: '2025-11-08',
    satisfactionTrend: 'up',
    riskLevel: 'low',
  },
  {
    id: 'CLT-002',
    companyName: 'Morgan & Associates Law',
    industry: 'Legal',
    contactName: 'David Morgan',
    contactEmail: 'd.morgan@morganlaw.com',
    contactPhone: '+1 (555) 234-5678',
    activeSops: 4,
    satisfactionScore: 4.7,
    monthlyValue: 12000,
    tasksThisWeek: 8,
    tasksCompleted: 7,
    tasksPending: 1,
    package: 'enterprise',
    startDate: '2024-02-01',
    lastContact: '2025-11-09',
    satisfactionTrend: 'stable',
    riskLevel: 'low',
  },
  {
    id: 'CLT-003',
    companyName: 'HealthFirst Medical',
    industry: 'Healthcare',
    contactName: 'Dr. Emily Roberts',
    contactEmail: 'emily.roberts@healthfirst.com',
    contactPhone: '+1 (555) 345-6789',
    activeSops: 4,
    satisfactionScore: 4.8,
    monthlyValue: 10000,
    tasksThisWeek: 10,
    tasksCompleted: 9,
    tasksPending: 1,
    package: 'professional',
    startDate: '2024-01-20',
    lastContact: '2025-11-07',
    satisfactionTrend: 'up',
    riskLevel: 'low',
  },
  {
    id: 'CLT-004',
    companyName: 'Summit Financial Group',
    industry: 'Finance',
    contactName: 'Michael Torres',
    contactEmail: 'm.torres@summitfin.com',
    contactPhone: '+1 (555) 456-7890',
    activeSops: 5,
    satisfactionScore: 4.6,
    monthlyValue: 13000,
    tasksThisWeek: 15,
    tasksCompleted: 12,
    tasksPending: 3,
    package: 'enterprise',
    startDate: '2024-03-10',
    lastContact: '2025-11-08',
    satisfactionTrend: 'stable',
    riskLevel: 'low',
  },
  {
    id: 'CLT-005',
    companyName: 'CloudScale Solutions',
    industry: 'Technology',
    contactName: 'Jennifer Kim',
    contactEmail: 'j.kim@cloudscale.io',
    contactPhone: '+1 (555) 567-8901',
    activeSops: 3,
    satisfactionScore: 4.4,
    monthlyValue: 8000,
    tasksThisWeek: 6,
    tasksCompleted: 4,
    tasksPending: 2,
    package: 'professional',
    startDate: '2024-04-15',
    lastContact: '2025-11-06',
    satisfactionTrend: 'down',
    riskLevel: 'medium',
  },
  {
    id: 'CLT-006',
    companyName: 'Green Energy Co',
    industry: 'Energy',
    contactName: 'Robert Williams',
    contactEmail: 'r.williams@greenenergy.com',
    contactPhone: '+1 (555) 678-9012',
    activeSops: 4,
    satisfactionScore: 5.0,
    monthlyValue: 9500,
    tasksThisWeek: 7,
    tasksCompleted: 7,
    tasksPending: 0,
    package: 'professional',
    startDate: '2024-02-28',
    lastContact: '2025-11-09',
    satisfactionTrend: 'up',
    riskLevel: 'low',
  },
  {
    id: 'CLT-007',
    companyName: 'Retail Dynamics Inc',
    industry: 'Retail',
    contactName: 'Lisa Anderson',
    contactEmail: 'l.anderson@retaildynamics.com',
    contactPhone: '+1 (555) 789-0123',
    activeSops: 3,
    satisfactionScore: 4.3,
    monthlyValue: 6000,
    tasksThisWeek: 9,
    tasksCompleted: 6,
    tasksPending: 3,
    package: 'professional',
    startDate: '2024-05-01',
    lastContact: '2025-11-05',
    satisfactionTrend: 'down',
    riskLevel: 'medium',
  },
  {
    id: 'CLT-008',
    companyName: 'EduTech Innovations',
    industry: 'Education',
    contactName: 'James Patterson',
    contactEmail: 'j.patterson@edutech.com',
    contactPhone: '+1 (555) 890-1234',
    activeSops: 3,
    satisfactionScore: 4.5,
    monthlyValue: 7500,
    tasksThisWeek: 8,
    tasksCompleted: 6,
    tasksPending: 2,
    package: 'professional',
    startDate: '2024-03-20',
    lastContact: '2025-11-08',
    satisfactionTrend: 'stable',
    riskLevel: 'low',
  },
  {
    id: 'CLT-009',
    companyName: 'Urban Construction LLC',
    industry: 'Construction',
    contactName: 'Maria Garcia',
    contactEmail: 'm.garcia@urbanconstruct.com',
    contactPhone: '+1 (555) 901-2345',
    activeSops: 3,
    satisfactionScore: 4.2,
    monthlyValue: 5500,
    tasksThisWeek: 5,
    tasksCompleted: 3,
    tasksPending: 2,
    package: 'basic',
    startDate: '2024-06-01',
    lastContact: '2025-11-04',
    satisfactionTrend: 'down',
    riskLevel: 'medium',
  },
  {
    id: 'CLT-010',
    companyName: 'NextGen Pharma',
    industry: 'Pharmaceutical',
    contactName: 'Dr. Ahmed Hassan',
    contactEmail: 'a.hassan@nextgenpharma.com',
    contactPhone: '+1 (555) 012-3456',
    activeSops: 4,
    satisfactionScore: 4.8,
    monthlyValue: 11000,
    tasksThisWeek: 11,
    tasksCompleted: 10,
    tasksPending: 1,
    package: 'enterprise',
    startDate: '2024-01-30',
    lastContact: '2025-11-09',
    satisfactionTrend: 'up',
    riskLevel: 'low',
  },
]

const MOCK_SOPS: Record<string, ClientSOP[]> = {
  'CLT-001': [
    {
      id: 'SOP-001',
      name: 'Weekly Sprint Planning Automation',
      category: 'Project Management',
      frequency: 'Weekly',
      lastRun: '2025-11-04',
      nextRun: '2025-11-11',
      successRate: 98,
      status: 'active',
      description: 'Automated sprint planning and task distribution',
    },
    {
      id: 'SOP-002',
      name: 'Daily Standup Summary',
      category: 'Communication',
      frequency: 'Daily',
      lastRun: '2025-11-09',
      nextRun: '2025-11-10',
      successRate: 100,
      status: 'active',
      description: 'AI-generated standup summaries and action items',
    },
    {
      id: 'SOP-003',
      name: 'Monthly Financial Report',
      category: 'Finance',
      frequency: 'Monthly',
      lastRun: '2025-11-01',
      nextRun: '2025-12-01',
      successRate: 95,
      status: 'active',
      description: 'Automated financial reporting and analysis',
    },
    {
      id: 'SOP-004',
      name: 'Client Onboarding Process',
      category: 'Operations',
      frequency: 'As Needed',
      lastRun: '2025-11-02',
      nextRun: 'On Demand',
      successRate: 92,
      status: 'active',
      description: 'Streamlined client onboarding workflow',
    },
    {
      id: 'SOP-005',
      name: 'Security Audit & Compliance',
      category: 'Security',
      frequency: 'Weekly',
      lastRun: '2025-11-07',
      nextRun: '2025-11-14',
      successRate: 100,
      status: 'active',
      description: 'Automated security checks and compliance reporting',
    },
  ],
  'CLT-002': [
    {
      id: 'SOP-006',
      name: 'Case Document Management',
      category: 'Legal',
      frequency: 'Daily',
      lastRun: '2025-11-09',
      nextRun: '2025-11-10',
      successRate: 97,
      status: 'active',
      description: 'Automated document filing and organization',
    },
    {
      id: 'SOP-007',
      name: 'Client Communication Log',
      category: 'Communication',
      frequency: 'Daily',
      lastRun: '2025-11-09',
      nextRun: '2025-11-10',
      successRate: 100,
      status: 'active',
      description: 'Automated logging of all client communications',
    },
    {
      id: 'SOP-008',
      name: 'Billing & Invoicing',
      category: 'Finance',
      frequency: 'Weekly',
      lastRun: '2025-11-06',
      nextRun: '2025-11-13',
      successRate: 98,
      status: 'active',
      description: 'Automated billing cycles and invoice generation',
    },
    {
      id: 'SOP-009',
      name: 'Court Date Reminders',
      category: 'Operations',
      frequency: 'Daily',
      lastRun: '2025-11-09',
      nextRun: '2025-11-10',
      successRate: 100,
      status: 'active',
      description: 'Automated court date tracking and reminders',
    },
  ],
  // Add mock SOPs for other clients
}

// Add default SOPs for clients without specific ones
Object.keys(MOCK_CLIENTS).forEach((_, index) => {
  const clientId = MOCK_CLIENTS[index].id
  if (!MOCK_SOPS[clientId]) {
    MOCK_SOPS[clientId] = [
      {
        id: `SOP-${clientId}-1`,
        name: 'Daily Operations Report',
        category: 'Operations',
        frequency: 'Daily',
        lastRun: '2025-11-09',
        nextRun: '2025-11-10',
        successRate: 96,
        status: 'active',
        description: 'Daily operational metrics and insights',
      },
      {
        id: `SOP-${clientId}-2`,
        name: 'Weekly Team Sync',
        category: 'Communication',
        frequency: 'Weekly',
        lastRun: '2025-11-06',
        nextRun: '2025-11-13',
        successRate: 94,
        status: 'active',
        description: 'Weekly team synchronization and planning',
      },
      {
        id: `SOP-${clientId}-3`,
        name: 'Monthly Analytics Review',
        category: 'Analytics',
        frequency: 'Monthly',
        lastRun: '2025-11-01',
        nextRun: '2025-12-01',
        successRate: 98,
        status: 'active',
        description: 'Comprehensive monthly performance analysis',
      },
    ]
  }
})

export default function ClientManagementPage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()
  const [selectedClient, setSelectedClient] = useState<ClientAccount | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'satisfaction' | 'value' | 'tasks'>('satisfaction')
  const [filterPackage, setFilterPackage] = useState<'all' | 'basic' | 'professional' | 'enterprise'>('all')
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showAddSOPModal, setShowAddSOPModal] = useState(false)

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user?.emailAddresses[0]?.emailAddress.endsWith('@wellsonyx.com'))) {
      router.push('/ai-ops')
    }
  }, [isLoaded, isSignedIn, user, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-purple-400">
          <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  // Filter and sort clients
  const filteredClients = MOCK_CLIENTS.filter(client => {
    const matchesSearch = client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.contactName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPackage = filterPackage === 'all' || client.package === filterPackage
    return matchesSearch && matchesPackage
  }).sort((a, b) => {
    switch (sortBy) {
      case 'satisfaction':
        return b.satisfactionScore - a.satisfactionScore
      case 'value':
        return b.monthlyValue - a.monthlyValue
      case 'tasks':
        return b.tasksPending - a.tasksPending
      default:
        return 0
    }
  })

  // Calculate stats
  const totalMonthlyValue = MOCK_CLIENTS.reduce((sum, client) => sum + client.monthlyValue, 0)
  const averageSatisfaction = MOCK_CLIENTS.reduce((sum, client) => sum + client.satisfactionScore, 0) / MOCK_CLIENTS.length
  const totalActiveSops = MOCK_CLIENTS.reduce((sum, client) => sum + client.activeSops, 0)
  const totalTasksThisWeek = MOCK_CLIENTS.reduce((sum, client) => sum + client.tasksThisWeek, 0)
  const atRiskClients = MOCK_CLIENTS.filter(client => client.satisfactionScore < 4.0).length

  const getSatisfactionColor = (score: number) => {
    if (score >= 4.5) return 'text-green-400'
    if (score >= 4.0) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getSatisfactionBgColor = (score: number) => {
    if (score >= 4.5) return 'bg-green-500/20 border-green-500/30'
    if (score >= 4.0) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-red-500/20 border-red-500/30'
  }

  const getPackageBadgeColor = (pkg: string) => {
    switch (pkg) {
      case 'enterprise':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'professional':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'basic':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950">
      {/* Header */}
      <div className="border-b border-purple-500/20 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Client Portfolio</h1>
              <p className="text-purple-300">Managing 10 client accounts</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMessageModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Message All
              </button>
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-300 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total MRR</span>
              </div>
              <p className="text-2xl font-bold text-white">${(totalMonthlyValue / 1000).toFixed(0)}K</p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-900/20 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-300 mb-2">
                <Star className="w-4 h-4" />
                <span className="text-sm">Avg Satisfaction</span>
              </div>
              <p className="text-2xl font-bold text-white">{averageSatisfaction.toFixed(1)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-300 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Active SOPs</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalActiveSops}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-900/20 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-orange-300 mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm">Tasks This Week</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalTasksThisWeek}</p>
            </div>
            <div className="bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-300 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">At Risk</span>
              </div>
              <p className="text-2xl font-bold text-white">{atRiskClients}</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input
                type="text"
                placeholder="Search clients, industries, contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="satisfaction">Sort: Satisfaction</option>
                <option value="value">Sort: Value</option>
                <option value="tasks">Sort: Tasks Pending</option>
              </select>
              <select
                value={filterPackage}
                onChange={(e) => setFilterPackage(e.target.value as any)}
                className="px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Packages</option>
                <option value="enterprise">Enterprise</option>
                <option value="professional">Professional</option>
                <option value="basic">Basic</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        {/* Client Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 border ${
                selectedClient?.id === client.id ? 'border-purple-500' : 'border-purple-500/30'
              } rounded-xl p-6 cursor-pointer hover:border-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-900 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{client.companyName}</h3>
                    <p className="text-purple-300 text-sm">{client.industry}</p>
                  </div>
                </div>
              </div>

              {/* Package Badge */}
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPackageBadgeColor(client.package)}`}>
                  {client.package.toUpperCase()}
                </span>
              </div>

              {/* Satisfaction Score */}
              <div className={`mb-4 p-3 rounded-lg border ${getSatisfactionBgColor(client.satisfactionScore)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className={`w-5 h-5 ${getSatisfactionColor(client.satisfactionScore)} fill-current`} />
                    <span className={`text-2xl font-bold ${getSatisfactionColor(client.satisfactionScore)}`}>
                      {client.satisfactionScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {client.satisfactionTrend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-400" />}
                    {client.satisfactionTrend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-400" />}
                    {client.satisfactionTrend === 'stable' && <Activity className="w-4 h-4 text-yellow-400" />}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-300">Monthly Value:</span>
                  <span className="text-white font-semibold">${(client.monthlyValue / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-300">Active SOPs:</span>
                  <span className="text-white font-semibold">{client.activeSops}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-300">Tasks This Week:</span>
                  <span className="text-white font-semibold">{client.tasksThisWeek}</span>
                </div>
              </div>

              {/* Task Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-purple-300 mb-2">
                  <span>Progress</span>
                  <span>{client.tasksCompleted}/{client.tasksThisWeek}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-purple-400 h-2 rounded-full transition-all"
                    style={{ width: `${(client.tasksCompleted / client.tasksThisWeek) * 100}%` }}
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="pt-4 border-t border-purple-500/20">
                <p className="text-white text-sm font-medium mb-1">{client.contactName}</p>
                <p className="text-purple-300 text-xs">{client.contactEmail}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMessageModal(true)
                  }}
                  className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedClient(client)
                  }}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Client Details Panel */}
        {selectedClient && (
          <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-purple-500/30 rounded-xl p-8">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{selectedClient.companyName}</h2>
                <p className="text-purple-300">Detailed Client Overview</p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Overview */}
              <div className="lg:col-span-1 space-y-6">
                {/* Company Info */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    Company Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-purple-300 mb-1">Industry</p>
                      <p className="text-white">{selectedClient.industry}</p>
                    </div>
                    <div>
                      <p className="text-purple-300 mb-1">Package</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPackageBadgeColor(selectedClient.package)}`}>
                        {selectedClient.package.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-purple-300 mb-1">Start Date</p>
                      <p className="text-white">{new Date(selectedClient.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-purple-300 mb-1">Last Contact</p>
                      <p className="text-white">{new Date(selectedClient.lastContact).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Primary Contact
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-white font-medium mb-2">{selectedClient.contactName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-purple-400" />
                      <a href={`mailto:${selectedClient.contactEmail}`} className="text-purple-300 hover:text-purple-200">
                        {selectedClient.contactEmail}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-purple-400" />
                      <a href={`tel:${selectedClient.contactPhone}`} className="text-purple-300 hover:text-purple-200">
                        {selectedClient.contactPhone}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </div>

                {/* Satisfaction Trends */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    Satisfaction Trends
                  </h3>
                  <div className={`p-4 rounded-lg border ${getSatisfactionBgColor(selectedClient.satisfactionScore)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-4xl font-bold ${getSatisfactionColor(selectedClient.satisfactionScore)}`}>
                        {selectedClient.satisfactionScore.toFixed(1)}
                      </span>
                      <div className="flex items-center gap-1">
                        {selectedClient.satisfactionTrend === 'up' && (
                          <>
                            <ArrowUpRight className="w-5 h-5 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">+0.2</span>
                          </>
                        )}
                        {selectedClient.satisfactionTrend === 'down' && (
                          <>
                            <ArrowDownRight className="w-5 h-5 text-red-400" />
                            <span className="text-red-400 text-sm font-medium">-0.3</span>
                          </>
                        )}
                        {selectedClient.satisfactionTrend === 'stable' && (
                          <span className="text-yellow-400 text-sm font-medium">Stable</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(selectedClient.satisfactionScore)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column - SOPs */}
              <div className="lg:col-span-1">
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-400" />
                      Active SOPs ({MOCK_SOPS[selectedClient.id]?.length || 0})
                    </h3>
                    <button
                      onClick={() => setShowAddSOPModal(true)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add SOP
                    </button>
                  </div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {(MOCK_SOPS[selectedClient.id] || []).map((sop) => (
                      <div
                        key={sop.id}
                        className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium">{sop.name}</h4>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              sop.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : sop.status === 'paused'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {sop.status}
                          </span>
                        </div>
                        <p className="text-purple-300 text-sm mb-3">{sop.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <p className="text-purple-300 mb-1">Category</p>
                            <p className="text-white">{sop.category}</p>
                          </div>
                          <div>
                            <p className="text-purple-300 mb-1">Frequency</p>
                            <p className="text-white">{sop.frequency}</p>
                          </div>
                          <div>
                            <p className="text-purple-300 mb-1">Last Run</p>
                            <p className="text-white">{new Date(sop.lastRun).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-purple-300 mb-1">Next Run</p>
                            <p className="text-white">{sop.nextRun === 'On Demand' ? sop.nextRun : new Date(sop.nextRun).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-purple-300 text-xs">Success Rate</span>
                          <span className="text-green-400 text-sm font-semibold">{sop.successRate}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-gradient-to-r from-green-600 to-green-400 h-1.5 rounded-full"
                            style={{ width: `${sop.successRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Tasks & Communication */}
              <div className="lg:col-span-1 space-y-6">
                {/* Recent Tasks */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-400" />
                    Recent Tasks
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-green-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">Q4 Financial Review</span>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                      <p className="text-purple-300 text-xs">Completed: Nov 8, 2025</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-green-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">Team Performance Report</span>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                      <p className="text-purple-300 text-xs">Completed: Nov 7, 2025</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-yellow-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">Strategic Planning Session</span>
                        <Clock className="w-4 h-4 text-yellow-400" />
                      </div>
                      <p className="text-purple-300 text-xs">Due: Nov 10, 2025</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">Client Check-in Call</span>
                        <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <p className="text-purple-300 text-xs">Scheduled: Nov 12, 2025</p>
                    </div>
                  </div>
                </div>

                {/* Communication Timeline */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Communication Timeline
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Mail className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">Email: Monthly Report Sent</p>
                        <p className="text-purple-300 text-xs">Nov 9, 2025 - 10:30 AM</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">Call: Quarterly Review</p>
                        <p className="text-purple-300 text-xs">Nov 8, 2025 - 2:00 PM</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">Meeting: Strategy Session</p>
                        <p className="text-purple-300 text-xs">Nov 6, 2025 - 3:30 PM</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">Task: Deliverable Submitted</p>
                        <p className="text-purple-300 text-xs">Nov 5, 2025 - 4:15 PM</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Performance Metrics
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-300 text-sm">Task Completion</span>
                        <span className="text-white text-sm font-semibold">
                          {Math.round((selectedClient.tasksCompleted / selectedClient.tasksThisWeek) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full"
                          style={{ width: `${(selectedClient.tasksCompleted / selectedClient.tasksThisWeek) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-300 text-sm">SOP Success Rate</span>
                        <span className="text-white text-sm font-semibold">96%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-gradient-to-r from-purple-600 to-purple-400 h-2 rounded-full" style={{ width: '96%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-300 text-sm">Response Time</span>
                        <span className="text-white text-sm font-semibold">&lt; 2hrs</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-2 rounded-full" style={{ width: '94%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-6">Send Message</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-purple-300 mb-2">To:</label>
                <input
                  type="text"
                  value={selectedClient ? selectedClient.contactEmail : 'All Clients'}
                  disabled
                  className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Subject:</label>
                <input
                  type="text"
                  placeholder="Enter subject..."
                  className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Message:</label>
                <textarea
                  rows={6}
                  placeholder="Enter your message..."
                  className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-all">
                <Send className="w-5 h-5" />
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add SOP Modal */}
      {showAddSOPModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-6">Add New SOP</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-purple-300 mb-2">SOP Name:</label>
                <input
                  type="text"
                  placeholder="Enter SOP name..."
                  className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Category:</label>
                <select className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500">
                  <option>Operations</option>
                  <option>Finance</option>
                  <option>Communication</option>
                  <option>Analytics</option>
                  <option>Security</option>
                </select>
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Frequency:</label>
                <select className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500">
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>As Needed</option>
                </select>
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Description:</label>
                <textarea
                  rows={4}
                  placeholder="Describe the SOP..."
                  className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddSOPModal(false)}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-all">
                <Plus className="w-5 h-5" />
                Create SOP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
