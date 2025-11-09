'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Briefcase,
  Clock,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
  Filter,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  Sparkles,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  Shield,
  Wrench,
  HeadphonesIcon,
  BarChart3,
} from 'lucide-react'

interface AgentTask {
  id: string
  clientId: string
  clientName: string
  sopType: 'chief_of_staff' | 'technical_ops' | 'paralegal' | 'finance' | 'customer_service'
  title: string
  description: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  estimatedMinutes: number
  grainReward: number
  status: 'pending' | 'in_progress' | 'review' | 'completed'
  dueDate: string
  clientLogo?: string
}

interface AgentStats {
  tasksCompletedToday: number
  hoursLoggedToday: number
  grainEarnedToday: number
  efficiencyScore: number
  currentGrainBalance: number
}

const MOCK_STATS: AgentStats = {
  tasksCompletedToday: 12,
  hoursLoggedToday: 6.5,
  grainEarnedToday: 325,
  efficiencyScore: 94,
  currentGrainBalance: 8750,
}

const MOCK_TASKS: AgentTask[] = [
  {
    id: 'task-1',
    clientId: 'client-001',
    clientName: 'Acme Corp',
    sopType: 'chief_of_staff',
    title: 'Prepare CEO daily brief',
    description: 'Compile news mentions, competitor updates, and internal metrics for CEO daily review',
    priority: 'urgent',
    estimatedMinutes: 45,
    grainReward: 75,
    status: 'pending',
    dueDate: '2025-11-09T09:00:00Z',
  },
  {
    id: 'task-2',
    clientId: 'client-002',
    clientName: 'TechStart Inc',
    sopType: 'technical_ops',
    title: 'Review deployment logs',
    description: 'Analyze last night\'s production deployment logs and identify any anomalies or errors',
    priority: 'high',
    estimatedMinutes: 30,
    grainReward: 50,
    status: 'pending',
    dueDate: '2025-11-09T11:00:00Z',
  },
  {
    id: 'task-3',
    clientId: 'client-003',
    clientName: 'Legal Solutions LLC',
    sopType: 'paralegal',
    title: 'Review NDA for new partnership',
    description: 'Review and markup NDA document, flag any unusual clauses or potential issues',
    priority: 'high',
    estimatedMinutes: 60,
    grainReward: 100,
    status: 'pending',
    dueDate: '2025-11-09T14:00:00Z',
  },
  {
    id: 'task-4',
    clientId: 'client-004',
    clientName: 'FinanceFirst',
    sopType: 'finance',
    title: 'Process vendor invoices',
    description: 'Review and approve 15 pending vendor invoices, verify against POs',
    priority: 'normal',
    estimatedMinutes: 40,
    grainReward: 60,
    status: 'pending',
    dueDate: '2025-11-09T16:00:00Z',
  },
  {
    id: 'task-5',
    clientId: 'client-001',
    clientName: 'Acme Corp',
    sopType: 'chief_of_staff',
    title: 'Schedule board meeting',
    description: 'Coordinate with 8 board members to find optimal time for Q4 board meeting',
    priority: 'normal',
    estimatedMinutes: 35,
    grainReward: 55,
    status: 'pending',
    dueDate: '2025-11-10T10:00:00Z',
  },
  {
    id: 'task-6',
    clientId: 'client-002',
    clientName: 'TechStart Inc',
    sopType: 'technical_ops',
    title: 'Update monitoring dashboard',
    description: 'Add new service health metrics to Grafana dashboard and configure alerts',
    priority: 'normal',
    estimatedMinutes: 50,
    grainReward: 70,
    status: 'pending',
    dueDate: '2025-11-10T15:00:00Z',
  },
  {
    id: 'task-7',
    clientId: 'client-005',
    clientName: 'CustomerCare Co',
    sopType: 'customer_service',
    title: 'Respond to escalated tickets',
    description: 'Handle 5 escalated customer support tickets requiring senior agent attention',
    priority: 'urgent',
    estimatedMinutes: 55,
    grainReward: 85,
    status: 'in_progress',
    dueDate: '2025-11-09T12:00:00Z',
  },
  {
    id: 'task-8',
    clientId: 'client-004',
    clientName: 'FinanceFirst',
    sopType: 'finance',
    title: 'Generate P&L report',
    description: 'Prepare detailed P&L report for October with variance analysis',
    priority: 'high',
    estimatedMinutes: 90,
    grainReward: 140,
    status: 'pending',
    dueDate: '2025-11-09T17:00:00Z',
  },
  {
    id: 'task-9',
    clientId: 'client-003',
    clientName: 'Legal Solutions LLC',
    sopType: 'paralegal',
    title: 'Research case precedents',
    description: 'Research and summarize relevant case law for upcoming trademark dispute',
    priority: 'normal',
    estimatedMinutes: 120,
    grainReward: 180,
    status: 'pending',
    dueDate: '2025-11-11T09:00:00Z',
  },
  {
    id: 'task-10',
    clientId: 'client-002',
    clientName: 'TechStart Inc',
    sopType: 'technical_ops',
    title: 'Security audit review',
    description: 'Review Snyk security scan results and create remediation plan for critical vulnerabilities',
    priority: 'high',
    estimatedMinutes: 75,
    grainReward: 115,
    status: 'pending',
    dueDate: '2025-11-09T13:00:00Z',
  },
]

const sopTypeIcons = {
  chief_of_staff: Briefcase,
  technical_ops: Wrench,
  paralegal: Shield,
  finance: DollarSign,
  customer_service: HeadphonesIcon,
}

const sopTypeColors = {
  chief_of_staff: 'bg-purple-500/20 text-purple-300',
  technical_ops: 'bg-blue-500/20 text-blue-300',
  paralegal: 'bg-green-500/20 text-green-300',
  finance: 'bg-yellow-500/20 text-yellow-300',
  customer_service: 'bg-pink-500/20 text-pink-300',
}

const priorityColors = {
  urgent: 'border-red-500 bg-red-500/10',
  high: 'border-orange-500 bg-orange-500/10',
  normal: 'border-blue-500 bg-blue-500/10',
  low: 'border-gray-500 bg-gray-500/10',
}

const priorityBadgeColors = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  normal: 'bg-blue-500 text-white',
  low: 'bg-gray-500 text-white',
}

export default function AgentWorkspace() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [tasks, setTasks] = useState<AgentTask[]>(MOCK_TASKS)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'grainReward'>('dueDate')
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)

  useEffect(() => {
    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress
      if (!email?.endsWith('@wellsonyx.com')) {
        router.push('/')
      }
    }
  }, [isLoaded, user, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  const filteredTasks = tasks
    .filter((task) => filterPriority === 'all' || task.priority === filterPriority)
    .sort((a, b) => {
      if (sortBy === 'dueDate') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      } else {
        return b.grainReward - a.grainReward
      }
    })

  const handleStartTask = (task: AgentTask) => {
    setTasks(
      tasks.map((t) =>
        t.id === task.id ? { ...t, status: 'in_progress' as const } : t
      )
    )
    setSelectedTask(task)
    setShowAIPanel(true)
  }

  const handleRequestAI = (task: AgentTask) => {
    setSelectedTask(task)
    setShowAIPanel(true)
  }

  const formatDueDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 0) return 'Overdue'
    if (diffHours < 1) return 'Due now'
    if (diffHours < 24) return `Due in ${diffHours}h`
    return `Due ${d.toLocaleDateString()}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Agent Workspace
              </h1>
              <p className="text-gray-400 mt-1">
                Welcome back, {user?.firstName || 'Agent'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-400">GRAIN Balance</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {MOCK_STATS.currentGrainBalance.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Today's Earnings</p>
                <p className="text-2xl font-bold text-green-400">
                  +{MOCK_STATS.grainEarnedToday}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="border-b border-white/10 bg-black/10 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="grid grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Completed Today</p>
                <p className="text-xl font-bold text-white">
                  {MOCK_STATS.tasksCompletedToday}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Hours Logged</p>
                <p className="text-xl font-bold text-white">
                  {MOCK_STATS.hoursLoggedToday}h
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">GRAIN Earned</p>
                <p className="text-xl font-bold text-white">
                  {MOCK_STATS.grainEarnedToday}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Efficiency Score</p>
                <p className="text-xl font-bold text-white">
                  {MOCK_STATS.efficiencyScore}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Active Tasks Panel - Left 60% */}
          <div className="col-span-7">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              {/* Filter and Sort Controls */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Active Tasks
                  <span className="text-sm font-normal text-gray-400">
                    ({filteredTasks.length})
                  </span>
                </h2>
                <div className="flex items-center gap-3">
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'grainReward')}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="dueDate">Sort by Due Date</option>
                    <option value="grainReward">Sort by GRAIN Reward</option>
                  </select>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const IconComponent = sopTypeIcons[task.sopType]
                  const isExpanded = expandedTaskId === task.id

                  return (
                    <div
                      key={task.id}
                      className={`border-l-4 rounded-lg overflow-hidden transition-all ${
                        priorityColors[task.priority]
                      } ${
                        task.status === 'in_progress'
                          ? 'bg-white/10'
                          : 'bg-white/5'
                      }`}
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() =>
                          setExpandedTaskId(isExpanded ? null : task.id)
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className={`p-2 rounded-lg ${
                                  sopTypeColors[task.sopType]
                                }`}
                              >
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-white font-semibold">
                                  {task.title}
                                </h3>
                                <p className="text-sm text-gray-400">
                                  {task.clientName}
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm">
                              <span
                                className={`px-2 py-1 rounded-full ${
                                  priorityBadgeColors[task.priority]
                                } text-xs font-medium`}
                              >
                                {task.priority.toUpperCase()}
                              </span>
                              <span className="text-gray-400 flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {task.estimatedMinutes}m
                              </span>
                              <span className="text-yellow-400 flex items-center gap-1 font-medium">
                                <Zap className="w-4 h-4" />
                                {task.grainReward} GRAIN
                              </span>
                              <span className="text-gray-400 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDueDate(task.dueDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-gray-300 mb-4">
                              {task.description}
                            </p>
                            <div className="flex items-center gap-3">
                              {task.status === 'pending' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartTask(task)
                                  }}
                                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                                >
                                  <PlayCircle className="w-4 h-4" />
                                  Start Task
                                </button>
                              )}
                              {task.status === 'in_progress' && (
                                <div className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg font-medium flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                  In Progress
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRequestAI(task)
                                }}
                                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg font-medium flex items-center gap-2 transition-colors border border-purple-500/30"
                              >
                                <Sparkles className="w-4 h-4" />
                                Request AI Help
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* AI Assistant Panel - Right 40% */}
          <div className="col-span-5">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI Assistant
              </h2>

              {selectedTask ? (
                <div className="space-y-4">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-sm text-purple-300 mb-2">
                      Current Task:
                    </p>
                    <p className="text-white font-semibold">
                      {selectedTask.title}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedTask.clientName}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                      Quick Actions
                    </h3>
                    <button className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg text-left transition-colors border border-white/10">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="font-medium">Generate Draft</p>
                          <p className="text-xs text-gray-400">
                            AI-powered first draft
                          </p>
                        </div>
                      </div>
                    </button>
                    <button className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg text-left transition-colors border border-white/10">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="font-medium">Research & Analysis</p>
                          <p className="text-xs text-gray-400">
                            Get relevant insights
                          </p>
                        </div>
                      </div>
                    </button>
                    <button className="w-full px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg text-left transition-colors border border-white/10">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-yellow-400" />
                        <div>
                          <p className="font-medium">Quality Check</p>
                          <p className="text-xs text-gray-400">
                            Review before submission
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                    <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      AI Suggestions
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Start by reviewing the client's recent activity and
                          preferences
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Check previous similar tasks for patterns and best
                          practices
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>
                          Estimated completion time: {selectedTask.estimatedMinutes}{' '}
                          minutes
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-yellow-300 mb-2">
                      Efficiency Tip
                    </h3>
                    <p className="text-sm text-gray-300">
                      Tasks in this category typically take 15% less time when
                      you use the draft generation feature first.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-block p-4 bg-purple-500/20 rounded-full mb-4">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-gray-400">
                    Select a task to get AI-powered assistance
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Click on any task or use "Request AI Help" to begin
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
