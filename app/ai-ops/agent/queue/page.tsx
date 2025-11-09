'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ArrowUpDown,
  Play,
  UserPlus,
  SkipForward,
  Coins,
  Calendar,
  TrendingUp,
  CheckSquare,
  Square
} from 'lucide-react'

interface QueueTask {
  id: string
  clientId: string
  clientName: string
  sopType: string
  title: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  estimatedMinutes: number
  grainReward: number
  dueDate: string
  status: 'pending' | 'assigned' | 'in_progress'
  assignedTo?: string
}

type SortField = 'urgency' | 'grain' | 'dueDate' | 'estimatedTime'

// Mock queue data with 20+ diverse tasks
const mockQueueTasks: QueueTask[] = [
  {
    id: 'task-001',
    clientId: 'client-001',
    clientName: 'TechStart Inc',
    sopType: 'Executive Search',
    title: 'Source VP of Engineering candidates',
    priority: 'urgent',
    estimatedMinutes: 180,
    grainReward: 500,
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days overdue
    status: 'pending'
  },
  {
    id: 'task-002',
    clientId: 'client-002',
    clientName: 'FinanceFlow Corp',
    sopType: 'Partnership Development',
    title: 'Research potential banking partners',
    priority: 'high',
    estimatedMinutes: 120,
    grainReward: 350,
    dueDate: new Date().toISOString(), // Due today
    status: 'pending'
  },
  {
    id: 'task-003',
    clientId: 'client-003',
    clientName: 'HealthTech Solutions',
    sopType: 'Market Research',
    title: 'Analyze telehealth market trends',
    priority: 'normal',
    estimatedMinutes: 90,
    grainReward: 200,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-004',
    clientId: 'client-004',
    clientName: 'RetailMax',
    sopType: 'Procurement Support',
    title: 'Source suppliers for retail fixtures',
    priority: 'high',
    estimatedMinutes: 150,
    grainReward: 400,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-005',
    clientId: 'client-005',
    clientName: 'EduTech Academy',
    sopType: 'HR Operations',
    title: 'Process onboarding for 5 new teachers',
    priority: 'urgent',
    estimatedMinutes: 240,
    grainReward: 600,
    dueDate: new Date().toISOString(), // Due today
    status: 'pending'
  },
  {
    id: 'task-006',
    clientId: 'client-006',
    clientName: 'CloudScale Systems',
    sopType: 'Executive Search',
    title: 'Screen CTO candidates - Round 1',
    priority: 'high',
    estimatedMinutes: 200,
    grainReward: 450,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'assigned',
    assignedTo: 'agent-002'
  },
  {
    id: 'task-007',
    clientId: 'client-007',
    clientName: 'GreenEnergy Partners',
    sopType: 'Market Research',
    title: 'Competitive analysis - Solar industry',
    priority: 'normal',
    estimatedMinutes: 100,
    grainReward: 250,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-008',
    clientId: 'client-008',
    clientName: 'LegalEase Corp',
    sopType: 'Partnership Development',
    title: 'Outreach to compliance software vendors',
    priority: 'low',
    estimatedMinutes: 60,
    grainReward: 150,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-009',
    clientId: 'client-009',
    clientName: 'FoodTech Innovations',
    sopType: 'Procurement Support',
    title: 'Negotiate with packaging suppliers',
    priority: 'urgent',
    estimatedMinutes: 180,
    grainReward: 500,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day overdue
    status: 'pending'
  },
  {
    id: 'task-010',
    clientId: 'client-010',
    clientName: 'AutoDrive Labs',
    sopType: 'Executive Search',
    title: 'Source Head of AI/ML candidates',
    priority: 'high',
    estimatedMinutes: 220,
    grainReward: 550,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-011',
    clientId: 'client-011',
    clientName: 'DataViz Pro',
    sopType: 'Market Research',
    title: 'Survey enterprise BI tool landscape',
    priority: 'normal',
    estimatedMinutes: 80,
    grainReward: 180,
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-012',
    clientId: 'client-012',
    clientName: 'SecureNet Inc',
    sopType: 'HR Operations',
    title: 'Background checks for 3 candidates',
    priority: 'high',
    estimatedMinutes: 90,
    grainReward: 220,
    dueDate: new Date().toISOString(), // Due today
    status: 'pending'
  },
  {
    id: 'task-013',
    clientId: 'client-013',
    clientName: 'MediaStream Plus',
    sopType: 'Partnership Development',
    title: 'Identify content licensing opportunities',
    priority: 'normal',
    estimatedMinutes: 120,
    grainReward: 300,
    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-014',
    clientId: 'client-014',
    clientName: 'BioPharm Research',
    sopType: 'Procurement Support',
    title: 'Source laboratory equipment vendors',
    priority: 'urgent',
    estimatedMinutes: 160,
    grainReward: 480,
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days overdue
    status: 'pending'
  },
  {
    id: 'task-015',
    clientId: 'client-015',
    clientName: 'SportsTech Global',
    sopType: 'Executive Search',
    title: 'Recruit VP of Product Management',
    priority: 'high',
    estimatedMinutes: 200,
    grainReward: 520,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_progress',
    assignedTo: 'agent-001'
  },
  {
    id: 'task-016',
    clientId: 'client-016',
    clientName: 'FinTech Ventures',
    sopType: 'Market Research',
    title: 'Blockchain payment solutions analysis',
    priority: 'normal',
    estimatedMinutes: 110,
    grainReward: 270,
    dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-017',
    clientId: 'client-017',
    clientName: 'TravelHub Connect',
    sopType: 'Partnership Development',
    title: 'Partner with hotel booking platforms',
    priority: 'high',
    estimatedMinutes: 140,
    grainReward: 380,
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-018',
    clientId: 'client-018',
    clientName: 'LogiChain Solutions',
    sopType: 'Procurement Support',
    title: 'RFQ for warehouse automation',
    priority: 'normal',
    estimatedMinutes: 95,
    grainReward: 240,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-019',
    clientId: 'client-019',
    clientName: 'AgriTech Farms',
    sopType: 'HR Operations',
    title: 'Seasonal hiring - 10 field workers',
    priority: 'low',
    estimatedMinutes: 70,
    grainReward: 160,
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-020',
    clientId: 'client-020',
    clientName: 'CyberGuard Pro',
    sopType: 'Executive Search',
    title: 'Source CISO candidates',
    priority: 'urgent',
    estimatedMinutes: 190,
    grainReward: 530,
    dueDate: new Date().toISOString(), // Due today
    status: 'pending'
  },
  {
    id: 'task-021',
    clientId: 'client-021',
    clientName: 'RoboManufacture Inc',
    sopType: 'Market Research',
    title: 'Industrial automation market sizing',
    priority: 'normal',
    estimatedMinutes: 85,
    grainReward: 190,
    dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-022',
    clientId: 'client-022',
    clientName: 'QuantumCompute Labs',
    sopType: 'Partnership Development',
    title: 'Research quantum hardware partners',
    priority: 'high',
    estimatedMinutes: 130,
    grainReward: 360,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-023',
    clientId: 'client-023',
    clientName: 'SmartHome Systems',
    sopType: 'Procurement Support',
    title: 'Source IoT sensor suppliers',
    priority: 'normal',
    estimatedMinutes: 100,
    grainReward: 260,
    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  },
  {
    id: 'task-024',
    clientId: 'client-024',
    clientName: 'ClimateTech Alliance',
    sopType: 'HR Operations',
    title: 'Hire sustainability consultants',
    priority: 'high',
    estimatedMinutes: 170,
    grainReward: 420,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending'
  }
]

export default function AgentQueuePage() {
  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()
  const [tasks, setTasks] = useState<QueueTask[]>(mockQueueTasks)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('urgency')
  const [filters, setFilters] = useState({
    priority: 'all',
    sopType: 'all',
    client: 'all',
    dateFrom: '',
    dateTo: ''
  })

  // Authentication check
  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user?.primaryEmailAddress?.emailAddress.endsWith('@wellsonyx.com'))) {
      router.push('/')
    }
  }, [isLoaded, isSignedIn, user, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Calculate urgency score for sorting
  const calculateUrgencyScore = (task: QueueTask): number => {
    const priorityScores = { urgent: 1000, high: 500, normal: 100, low: 10 }
    const daysUntilDue = Math.floor((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const dueDateScore = daysUntilDue < 0 ? 2000 : Math.max(0, 200 - (daysUntilDue * 10))

    return priorityScores[task.priority] + dueDateScore + task.grainReward
  }

  // Check if task is overdue or due today
  const getTaskUrgency = (dueDate: string): 'overdue' | 'today' | 'upcoming' => {
    const now = new Date()
    const due = new Date(dueDate)
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const todayEnd = new Date(now.setHours(23, 59, 59, 999))

    if (due < todayStart) return 'overdue'
    if (due >= todayStart && due <= todayEnd) return 'today'
    return 'upcoming'
  }

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false
      if (filters.sopType !== 'all' && task.sopType !== filters.sopType) return false
      if (filters.client !== 'all' && task.clientName !== filters.client) return false
      if (filters.dateFrom && new Date(task.dueDate) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && new Date(task.dueDate) > new Date(filters.dateTo)) return false
      return true
    })

    return filtered.sort((a, b) => {
      switch (sortField) {
        case 'urgency':
          return calculateUrgencyScore(b) - calculateUrgencyScore(a)
        case 'grain':
          return b.grainReward - a.grainReward
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        case 'estimatedTime':
          return a.estimatedMinutes - b.estimatedMinutes
        default:
          return 0
      }
    })
  }, [tasks, filters, sortField])

  // Calculate queue statistics
  const queueStats = useMemo(() => {
    const pendingTasks = filteredAndSortedTasks.filter(t => t.status === 'pending')
    return {
      totalGrain: pendingTasks.reduce((sum, t) => sum + t.grainReward, 0),
      totalHours: pendingTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0) / 60,
      overdueTasks: pendingTasks.filter(t => getTaskUrgency(t.dueDate) === 'overdue').length,
      dueTodayTasks: pendingTasks.filter(t => getTaskUrgency(t.dueDate) === 'today').length
    }
  }, [filteredAndSortedTasks])

  // Get unique values for filters
  const uniqueClients = Array.from(new Set(tasks.map(t => t.clientName))).sort()
  const uniqueSopTypes = Array.from(new Set(tasks.map(t => t.sopType))).sort()

  // Toggle task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  // Select all visible tasks
  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredAndSortedTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredAndSortedTasks.map(t => t.id)))
    }
  }

  // Task actions
  const handleStartTask = (taskId: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId
        ? { ...t, status: 'in_progress' as const, assignedTo: user.id }
        : t
    ))
  }

  const handleQuickAssign = (taskId: string) => {
    setTasks(tasks.map(t =>
      t.id === taskId
        ? { ...t, status: 'assigned' as const, assignedTo: user.id }
        : t
    ))
  }

  const handleBulkAssign = () => {
    setTasks(tasks.map(t =>
      selectedTasks.has(t.id)
        ? { ...t, status: 'assigned' as const, assignedTo: user.id }
        : t
    ))
    setSelectedTasks(new Set())
  }

  const handleBulkComplete = () => {
    setTasks(tasks.filter(t => !selectedTasks.has(t.id)))
    setSelectedTasks(new Set())
  }

  // Priority badge colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'assigned': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'in_progress': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  // Row background based on urgency
  const getRowBackground = (dueDate: string) => {
    const urgency = getTaskUrgency(dueDate)
    if (urgency === 'overdue') return 'bg-red-500/10 hover:bg-red-500/20'
    if (urgency === 'today') return 'bg-yellow-500/10 hover:bg-yellow-500/20'
    return 'hover:bg-white/5'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-purple-400" />
            Task Queue
          </h1>
          <p className="text-gray-300">
            Prioritized work queue - Choose tasks strategically to maximize GRAIN rewards
          </p>
        </div>

        {/* Queue Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-gray-300 text-sm font-medium">Total GRAIN Available</span>
            </div>
            <p className="text-3xl font-bold text-white">{queueStats.totalGrain.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-blue-400" />
              <span className="text-gray-300 text-sm font-medium">Estimated Hours</span>
            </div>
            <p className="text-3xl font-bold text-white">{queueStats.totalHours.toFixed(1)}h</p>
          </div>

          <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="text-gray-300 text-sm font-medium">Overdue Tasks</span>
            </div>
            <p className="text-3xl font-bold text-white">{queueStats.overdueTasks}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-yellow-400" />
              <span className="text-gray-300 text-sm font-medium">Due Today</span>
            </div>
            <p className="text-3xl font-bold text-white">{queueStats.dueTodayTasks}</p>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Filters & Sort</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filters.sopType}
              onChange={(e) => setFilters({ ...filters, sopType: e.target.value })}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All SOP Types</option>
              {uniqueSopTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={filters.client}
              onChange={(e) => setFilters({ ...filters, client: e.target.value })}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Clients</option>
              {uniqueClients.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="From Date"
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="To Date"
            />

            <button
              onClick={() => setFilters({ priority: 'all', sopType: 'all', client: 'all', dateFrom: '', dateTo: '' })}
              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg px-4 py-2 text-red-400 font-medium transition-all"
            >
              Clear Filters
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ArrowUpDown className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium">Sort by:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortField('urgency')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  sortField === 'urgency'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                Urgency Score
              </button>
              <button
                onClick={() => setSortField('grain')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  sortField === 'grain'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                GRAIN Reward
              </button>
              <button
                onClick={() => setSortField('dueDate')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  sortField === 'dueDate'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                Due Date
              </button>
              <button
                onClick={() => setSortField('estimatedTime')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  sortField === 'estimatedTime'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                Time Required
              </button>
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedTasks.size > 0 && (
          <div className="bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkAssign}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Bulk Assign to Me
                </button>
                <button
                  onClick={handleBulkComplete}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Bulk Complete
                </button>
                <button
                  onClick={() => setSelectedTasks(new Set())}
                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 px-6 py-2 rounded-lg font-medium transition-all"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue Table */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="text-white hover:text-purple-400 transition-colors"
                    >
                      {selectedTasks.size === filteredAndSortedTasks.length ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    SOP Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    GRAIN
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTasks.map((task, index) => (
                  <tr
                    key={task.id}
                    className={`border-t border-white/10 transition-all ${getRowBackground(task.dueDate)}`}
                  >
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleTaskSelection(task.id)}
                        className="text-white hover:text-purple-400 transition-colors"
                      >
                        {selectedTasks.has(task.id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                        {task.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {task.clientName}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {task.title}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {task.sopType}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-400" />
                        {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}m
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-bold">{task.grainReward}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${
                        getTaskUrgency(task.dueDate) === 'overdue' ? 'text-red-400 font-bold' :
                        getTaskUrgency(task.dueDate) === 'today' ? 'text-yellow-400 font-semibold' :
                        'text-gray-300'
                      }`}>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStartTask(task.id)}
                              className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-all"
                              title="Start Task"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleQuickAssign(task.id)}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-all"
                              title="Assign to Me"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 p-2 rounded-lg transition-all"
                          title="Skip Task"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedTasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No tasks found matching your filters</p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-6 text-center text-gray-400">
          <p>
            Showing {filteredAndSortedTasks.length} of {tasks.length} total tasks
          </p>
        </div>
      </div>
    </div>
  )
}
