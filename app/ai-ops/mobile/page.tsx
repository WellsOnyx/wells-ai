'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import {
  Home,
  CheckSquare,
  Users,
  DollarSign,
  Menu,
  Bell,
  Settings,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  AlertCircle,
  Briefcase,
  Shield,
  Wrench,
  HeadphonesIcon,
  Filter,
  Calendar,
  Building2,
  Sparkles,
  X,
  Mic,
  Send,
  MoreVertical,
  RefreshCw,
  ArrowLeft,
  FileText,
  BarChart3,
} from 'lucide-react'

// Types
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
}

interface AgentStats {
  tasksCompletedToday: number
  hoursLoggedToday: number
  grainEarnedToday: number
  efficiencyScore: number
  currentGrainBalance: number
}

interface Client {
  id: string
  name: string
  logo?: string
  activeTasksCount: number
  totalGrainEarned: number
}

// Mock Data
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
    status: 'in_progress',
    dueDate: '2025-11-09T16:00:00Z',
  },
  {
    id: 'task-5',
    clientId: 'client-005',
    clientName: 'CustomerCare Co',
    sopType: 'customer_service',
    title: 'Respond to escalated tickets',
    description: 'Handle 5 escalated customer support tickets requiring senior agent attention',
    priority: 'urgent',
    estimatedMinutes: 55,
    grainReward: 85,
    status: 'pending',
    dueDate: '2025-11-09T12:00:00Z',
  },
]

const MOCK_CLIENTS: Client[] = [
  { id: 'client-001', name: 'Acme Corp', activeTasksCount: 3, totalGrainEarned: 1250 },
  { id: 'client-002', name: 'TechStart Inc', activeTasksCount: 2, totalGrainEarned: 890 },
  { id: 'client-003', name: 'Legal Solutions LLC', activeTasksCount: 1, totalGrainEarned: 650 },
  { id: 'client-004', name: 'FinanceFirst', activeTasksCount: 4, totalGrainEarned: 1450 },
  { id: 'client-005', name: 'CustomerCare Co', activeTasksCount: 2, totalGrainEarned: 540 },
]

// Helper functions
const sopTypeIcons = {
  chief_of_staff: Briefcase,
  technical_ops: Wrench,
  paralegal: Shield,
  finance: DollarSign,
  customer_service: HeadphonesIcon,
}

const sopTypeColors = {
  chief_of_staff: 'bg-purple-500/20 text-purple-400',
  technical_ops: 'bg-blue-500/20 text-blue-400',
  paralegal: 'bg-green-500/20 text-green-400',
  finance: 'bg-yellow-500/20 text-yellow-400',
  customer_service: 'bg-pink-500/20 text-pink-400',
}

const priorityColors = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-500',
}

const formatDueDate = (date: string) => {
  const d = new Date(date)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 0) return 'Overdue'
  if (diffHours < 1) return 'Due now'
  if (diffHours < 24) return `${diffHours}h`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Mobile device detection utilities
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768
const isTablet = () => typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024
const isTouchDevice = () => typeof window !== 'undefined' && 'ontouchstart' in window

export default function MobileDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // State
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'clients' | 'earnings' | 'more'>('home')
  const [tasks, setTasks] = useState<AgentTask[]>(MOCK_TASKS)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [showTaskDetails, setShowTaskDetails] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [swipeStart, setSwipeStart] = useState<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState<{ [key: string]: number }>({})
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [notificationCount, setNotificationCount] = useState(3)

  // Refs for touch handling
  const pullToRefreshRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)

  // Auth check
  useEffect(() => {
    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress
      if (!email?.endsWith('@wellsonyx.com')) {
        router.push('/')
      }
    }
  }, [isLoaded, user, router])

  // Pull to refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setIsPulling(true)
      setSwipeStart(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPulling && swipeStart !== null) {
      const currentY = e.touches[0].clientY
      const distance = Math.max(0, Math.min(currentY - swipeStart, 100))
      setPullDistance(distance)
    }
  }

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      handleRefresh()
    }
    setIsPulling(false)
    setSwipeStart(null)
    setPullDistance(0)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false)
      // Optionally trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    }, 1500)
  }

  // Task swipe handlers
  const handleTaskSwipeStart = (e: React.TouchEvent, taskId: string) => {
    setSwipeStart(e.touches[0].clientX)
  }

  const handleTaskSwipeMove = (e: React.TouchEvent, taskId: string) => {
    if (swipeStart !== null) {
      const currentX = e.touches[0].clientX
      const offset = currentX - swipeStart
      setSwipeOffset({ ...swipeOffset, [taskId]: offset })
    }
  }

  const handleTaskSwipeEnd = (taskId: string) => {
    const offset = swipeOffset[taskId] || 0

    if (offset > 100) {
      // Swipe right - Mark complete
      handleCompleteTask(taskId)
      if ('vibrate' in navigator) navigator.vibrate([50, 50])
    } else if (offset < -100) {
      // Swipe left - Snooze
      handleSnoozeTask(taskId)
      if ('vibrate' in navigator) navigator.vibrate([50, 50])
    }

    setSwipeStart(null)
    setSwipeOffset({ ...swipeOffset, [taskId]: 0 })
  }

  const handleCompleteTask = (taskId: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, status: 'completed' as const } : t
    ))
  }

  const handleSnoozeTask = (taskId: string) => {
    // Move task to end of list
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      setTasks([...tasks.filter(t => t.id !== taskId), task])
    }
  }

  const handleStartTask = (task: AgentTask) => {
    setTasks(tasks.map(t =>
      t.id === task.id ? { ...t, status: 'in_progress' as const } : t
    ))
    setShowTaskDetails(false)
    if ('vibrate' in navigator) navigator.vibrate(50)
  }

  const handleTaskClick = (task: AgentTask) => {
    setSelectedTask(task)
    setShowTaskDetails(true)
  }

  const filteredTasks = tasks
    .filter(task => filterPriority === 'all' || task.priority === filterPriority)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div
      className="mobile-dashboard min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {isPulling && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center"
          style={{ transform: `translateY(${pullDistance}px)`, transition: isPulling ? 'none' : 'transform 0.3s' }}
        >
          <div className="bg-white/10 backdrop-blur-md rounded-full p-3 mt-2">
            <RefreshCw className={`w-6 h-6 text-white ${pullDistance > 60 ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                {activeTab === 'home' && 'Dashboard'}
                {activeTab === 'tasks' && 'My Tasks'}
                {activeTab === 'clients' && 'Clients'}
                {activeTab === 'earnings' && 'Earnings'}
                {activeTab === 'more' && 'Settings'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {user?.firstName || 'Agent'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors touch-target">
                <Bell className="w-5 h-5 text-white" />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                    {notificationCount}
                  </span>
                )}
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors touch-target">
                <Settings className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* GRAIN Balance Card */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-5 border border-yellow-500/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-yellow-200/80">GRAIN Balance</p>
                  <p className="text-3xl font-bold text-yellow-400 mt-1">
                    {MOCK_STATS.currentGrainBalance.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/20 rounded-full">
                  <Zap className="w-8 h-8 text-yellow-400" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium">+{MOCK_STATS.grainEarnedToday}</span>
                <span className="text-gray-400">earned today</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-gray-400">Completed</p>
                </div>
                <p className="text-2xl font-bold text-white">{MOCK_STATS.tasksCompletedToday}</p>
                <p className="text-xs text-gray-500 mt-1">tasks today</p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-gray-400">Hours</p>
                </div>
                <p className="text-2xl font-bold text-white">{MOCK_STATS.hoursLoggedToday}h</p>
                <p className="text-xs text-gray-500 mt-1">logged today</p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-gray-400">Efficiency</p>
                </div>
                <p className="text-2xl font-bold text-white">{MOCK_STATS.efficiencyScore}%</p>
                <p className="text-xs text-gray-500 mt-1">performance</p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <p className="text-xs text-gray-400">Earned</p>
                </div>
                <p className="text-2xl font-bold text-white">{MOCK_STATS.grainEarnedToday}</p>
                <p className="text-xs text-gray-500 mt-1">GRAIN today</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="p-4 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl border border-purple-500/30 transition-colors touch-target"
                >
                  <CheckSquare className="w-6 h-6 text-purple-400 mb-2" />
                  <p className="text-sm font-medium text-white">View Tasks</p>
                </button>
                <button
                  onClick={() => setShowAIAssistant(true)}
                  className="p-4 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl border border-blue-500/30 transition-colors touch-target"
                >
                  <Sparkles className="w-6 h-6 text-blue-400 mb-2" />
                  <p className="text-sm font-medium text-white">AI Assistant</p>
                </button>
                <button
                  onClick={() => setActiveTab('clients')}
                  className="p-4 bg-green-500/20 hover:bg-green-500/30 rounded-xl border border-green-500/30 transition-colors touch-target"
                >
                  <Users className="w-6 h-6 text-green-400 mb-2" />
                  <p className="text-sm font-medium text-white">My Clients</p>
                </button>
                <button
                  onClick={() => setActiveTab('earnings')}
                  className="p-4 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-xl border border-yellow-500/30 transition-colors touch-target"
                >
                  <BarChart3 className="w-6 h-6 text-yellow-400 mb-2" />
                  <p className="text-sm font-medium text-white">Earnings</p>
                </button>
              </div>
            </div>

            {/* Upcoming Tasks Preview */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Urgent Tasks</h3>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-xs text-purple-400 font-medium touch-target"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {filteredTasks.filter(t => t.priority === 'urgent').slice(0, 3).map(task => {
                  const IconComponent = sopTypeIcons[task.sopType]
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-left transition-colors touch-target"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${sopTypeColors[task.sopType]}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{task.title}</p>
                          <p className="text-xs text-gray-400">{task.clientName}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          <Zap className="w-3 h-3" />
                          {task.grainReward}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterDrawer(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 rounded-xl border border-white/10 text-white touch-target"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {filterPriority === 'all' ? 'All Tasks' : filterPriority.charAt(0).toUpperCase() + filterPriority.slice(1)}
                </span>
              </button>
              <button className="p-3 bg-white/10 rounded-xl border border-white/10 touch-target">
                <MoreVertical className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Tasks List */}
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const IconComponent = sopTypeIcons[task.sopType]
                const offset = swipeOffset[task.id] || 0

                return (
                  <div
                    key={task.id}
                    className="relative overflow-hidden rounded-xl"
                    onTouchStart={(e) => handleTaskSwipeStart(e, task.id)}
                    onTouchMove={(e) => handleTaskSwipeMove(e, task.id)}
                    onTouchEnd={() => handleTaskSwipeEnd(task.id)}
                  >
                    {/* Swipe Actions Background */}
                    <div className="absolute inset-0 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Complete</span>
                      </div>
                      <div className="flex items-center gap-2 text-orange-400">
                        <span className="text-sm font-medium">Snooze</span>
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Task Card */}
                    <div
                      className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 transition-transform"
                      style={{ transform: `translateX(${offset}px)` }}
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg ${sopTypeColors[task.sopType]}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
                            <p className="text-sm font-semibold text-white truncate">{task.title}</p>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{task.clientName}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock className="w-3 h-3" />
                              {task.estimatedMinutes}m
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400 font-medium">
                              <Zap className="w-3 h-3" />
                              {task.grainReward}
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <Calendar className="w-3 h-3" />
                              {formatDueDate(task.dueDate)}
                            </span>
                          </div>
                        </div>
                        {task.status === 'in_progress' && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded-full">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            <span className="text-xs text-blue-400 font-medium">Active</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Empty State */}
            {filteredTasks.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-medium">All tasks completed!</p>
                <p className="text-sm text-gray-400 mt-1">Great job, take a break.</p>
              </div>
            )}
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="space-y-3">
            {MOCK_CLIENTS.map(client => (
              <div
                key={client.id}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors touch-target"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{client.name}</p>
                      <p className="text-xs text-gray-400">{client.activeTasksCount} active tasks</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-xs text-gray-400">Total Earned</span>
                  <span className="text-sm font-semibold text-yellow-400">
                    {client.totalGrainEarned} GRAIN
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm rounded-2xl p-5 border border-purple-500/30">
              <p className="text-sm text-purple-200/80 mb-2">This Week's Earnings</p>
              <p className="text-4xl font-bold text-white mb-4">1,250 GRAIN</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Tasks</p>
                  <p className="text-lg font-bold text-white">47</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Hours</p>
                  <p className="text-lg font-bold text-white">28.5</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Avg/Task</p>
                  <p className="text-lg font-bold text-white">26.6</p>
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Daily Breakdown</h3>
              <div className="space-y-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
                  const earnings = [180, 220, 190, 325, 335][i]
                  const maxEarnings = 350
                  const percentage = (earnings / maxEarnings) * 100

                  return (
                    <div key={day}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{day}</span>
                        <span className="text-white font-medium">{earnings} GRAIN</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conversion Info */}
            <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                <p className="text-sm font-semibold text-blue-300">GRAIN Value</p>
              </div>
              <p className="text-xs text-gray-300">
                1,000 GRAIN = $100 USD • Min withdrawal: 5,000 GRAIN
              </p>
            </div>
          </div>
        )}

        {/* More Tab */}
        {activeTab === 'more' && (
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.firstName?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-400">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <button className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors touch-target">
                Edit Profile
              </button>
            </div>

            {/* Settings Menu */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              {[
                { icon: Bell, label: 'Notifications', badge: '3' },
                { icon: Shield, label: 'Privacy & Security' },
                { icon: Settings, label: 'Preferences' },
                { icon: FileText, label: 'Help & Support' },
              ].map((item, i) => (
                <button
                  key={i}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0 touch-target"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-white">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>

            {/* Logout Button */}
            <button className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors touch-target">
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'tasks', icon: CheckSquare, label: 'Tasks', badge: filteredTasks.filter(t => t.status === 'pending').length },
            { id: 'clients', icon: Users, label: 'Clients' },
            { id: 'earnings', icon: DollarSign, label: 'Earnings' },
            { id: 'more', icon: Menu, label: 'More' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="relative flex-1 flex flex-col items-center gap-1 py-2 touch-target"
              >
                <div className="relative">
                  <tab.icon className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] ${isActive ? 'text-purple-400 font-semibold' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-purple-400 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFilterDrawer(false)}
          />
          <div className="relative w-full bg-gray-900 rounded-t-3xl p-6 safe-area-bottom animate-slide-up">
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-white mb-4">Filter Tasks</h3>
            <div className="space-y-2 mb-6">
              {['all', 'urgent', 'high', 'normal', 'low'].map(priority => (
                <button
                  key={priority}
                  onClick={() => {
                    setFilterPriority(priority)
                    setShowFilterDrawer(false)
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-colors touch-target ${
                    filterPriority === priority
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent'
                  }`}
                >
                  <span className="text-white font-medium">
                    {priority === 'all' ? 'All Tasks' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilterDrawer(false)}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors touch-target"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Task Details Bottom Sheet */}
      {showTaskDetails && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTaskDetails(false)}
          />
          <div className="relative w-full bg-gray-900 rounded-t-3xl p-6 safe-area-bottom max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6" />

            {/* Task Header */}
            <div className="flex items-start gap-3 mb-6">
              <div className={`p-3 rounded-xl ${sopTypeColors[selectedTask.sopType]}`}>
                {(() => {
                  const IconComponent = sopTypeIcons[selectedTask.sopType]
                  return <IconComponent className="w-6 h-6" />
                })()}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">{selectedTask.title}</h3>
                <p className="text-sm text-gray-400">{selectedTask.clientName}</p>
              </div>
              <button
                onClick={() => setShowTaskDetails(false)}
                className="p-2 hover:bg-white/10 rounded-full touch-target"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Task Meta */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className={`w-3 h-3 rounded-full ${priorityColors[selectedTask.priority]} mx-auto mb-2`} />
                <p className="text-xs text-gray-400">Priority</p>
                <p className="text-sm font-semibold text-white capitalize">{selectedTask.priority}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-blue-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Duration</p>
                <p className="text-sm font-semibold text-white">{selectedTask.estimatedMinutes}m</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Reward</p>
                <p className="text-sm font-semibold text-yellow-400">{selectedTask.grainReward}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{selectedTask.description}</p>
            </div>

            {/* Due Date */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-300">
                  Due {formatDueDate(selectedTask.dueDate)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {selectedTask.status === 'pending' && (
                <button
                  onClick={() => handleStartTask(selectedTask)}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors touch-target"
                >
                  <PlayCircle className="w-5 h-5" />
                  Start Task
                </button>
              )}
              {selectedTask.status === 'in_progress' && (
                <button className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors touch-target">
                  <CheckCircle className="w-5 h-5" />
                  Mark Complete
                </button>
              )}
              <button
                onClick={() => {
                  setShowTaskDetails(false)
                  setShowAIAssistant(true)
                }}
                className="w-full py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-purple-500/30 touch-target"
              >
                <Sparkles className="w-5 h-5" />
                Get AI Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="fixed inset-0 z-50 bg-gray-900">
          <div className="h-full flex flex-col">
            {/* AI Header */}
            <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAIAssistant(false)}
                    className="p-2 hover:bg-white/10 rounded-full touch-target"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-white">AI Assistant</h2>
                    <p className="text-xs text-gray-400">Ask me anything</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>

            {/* AI Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-none p-4 max-w-[80%]">
                  <p className="text-sm text-gray-300">
                    Hi! I'm your AI assistant. I can help you with:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-400">
                    <li>• Task drafts and templates</li>
                    <li>• Research and analysis</li>
                    <li>• Quality checks</li>
                    <li>• Best practices</li>
                  </ul>
                  <p className="mt-2 text-sm text-gray-300">
                    What can I help you with today?
                  </p>
                </div>
              </div>
            </div>

            {/* AI Input */}
            <div className="bg-black/30 backdrop-blur-md border-t border-white/10 p-4 safe-area-bottom">
              <div className="flex items-center gap-2">
                <button className="p-3 bg-white/10 hover:bg-white/15 rounded-full touch-target">
                  <Mic className="w-5 h-5 text-white" />
                </button>
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button className="p-3 bg-purple-500 hover:bg-purple-600 rounded-full touch-target">
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (for quick task start) */}
      <button className="fixed bottom-24 right-4 w-14 h-14 bg-purple-500 hover:bg-purple-600 rounded-full shadow-lg flex items-center justify-center touch-target z-30">
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      <style jsx>{`
        .touch-target {
          min-width: 44px;
          min-height: 44px;
        }

        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .mobile-dashboard {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        @media (max-width: 767px) {
          * {
            -webkit-tap-highlight-color: transparent;
          }
        }
      `}</style>
    </div>
  )
}
