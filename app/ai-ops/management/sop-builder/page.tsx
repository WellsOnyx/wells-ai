'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Save, Play, History, Copy, Download, Share2, Undo, Redo,
  ZoomIn, ZoomOut, Grid, Trash2, Plus, Search, ChevronDown,
  Mail, Globe, Database, FileUp, Brain, Filter, BarChart,
  Send, MessageSquare, FileText, Calendar, FileBarChart,
  GitBranch, Repeat, Clock, Shuffle, UserCheck, CheckCircle,
  AlertTriangle, Settings, Eye, ChevronRight, Layout, X
} from 'lucide-react'

// Data structures
interface SOPStep {
  id: string
  type: string
  category: string
  name: string
  icon: string
  config: Record<string, any>
  position: { x: number, y: number }
  connections: string[]
}

interface SOP {
  id: string
  name: string
  category: string
  description: string
  steps: SOPStep[]
  trigger: 'manual' | 'scheduled' | 'event'
  schedule?: string
  status: 'draft' | 'published'
  version: number
  estimatedTime?: string
  requiredIntegrations?: string[]
  assignedClients?: string[]
}

// Step library definitions
const STEP_LIBRARY = {
  'Data Collection': [
    { type: 'fetch-email', name: 'Fetch Email', icon: 'Mail', color: '#3B82F6' },
    { type: 'web-scraping', name: 'Web Scraping', icon: 'Globe', color: '#3B82F6' },
    { type: 'api-call', name: 'API Call', icon: 'Shuffle', color: '#3B82F6' },
    { type: 'database-query', name: 'Database Query', icon: 'Database', color: '#3B82F6' },
    { type: 'file-upload', name: 'File Upload', icon: 'FileUp', color: '#3B82F6' },
  ],
  'Processing': [
    { type: 'ai-analysis', name: 'AI Analysis (Claude)', icon: 'Brain', color: '#8B5CF6' },
    { type: 'data-transform', name: 'Data Transformation', icon: 'Shuffle', color: '#8B5CF6' },
    { type: 'filtering', name: 'Filtering', icon: 'Filter', color: '#8B5CF6' },
    { type: 'aggregation', name: 'Aggregation', icon: 'BarChart', color: '#8B5CF6' },
    { type: 'validation', name: 'Validation', icon: 'CheckCircle', color: '#8B5CF6' },
  ],
  'Actions': [
    { type: 'send-email', name: 'Send Email', icon: 'Send', color: '#10B981' },
    { type: 'slack-message', name: 'Slack Message', icon: 'MessageSquare', color: '#10B981' },
    { type: 'create-document', name: 'Create Document', icon: 'FileText', color: '#10B981' },
    { type: 'update-database', name: 'Update Database', icon: 'Database', color: '#10B981' },
    { type: 'schedule-meeting', name: 'Schedule Meeting', icon: 'Calendar', color: '#10B981' },
    { type: 'generate-report', name: 'Generate Report', icon: 'FileBarChart', color: '#10B981' },
  ],
  'Logic': [
    { type: 'conditional', name: 'Conditional Branch', icon: 'GitBranch', color: '#F59E0B' },
    { type: 'loop', name: 'Loop (foreach)', icon: 'Repeat', color: '#F59E0B' },
    { type: 'delay', name: 'Delay/Wait', icon: 'Clock', color: '#F59E0B' },
    { type: 'parallel', name: 'Parallel Execution', icon: 'Shuffle', color: '#F59E0B' },
    { type: 'approval-gate', name: 'Human Approval Gate', icon: 'UserCheck', color: '#F59E0B' },
  ],
  'Integrations': [
    { type: 'jira-ticket', name: 'Jira Create Ticket', icon: 'CheckCircle', color: '#EF4444' },
    { type: 'salesforce-update', name: 'Salesforce Update', icon: 'Database', color: '#EF4444' },
    { type: 'google-calendar', name: 'Google Calendar Event', icon: 'Calendar', color: '#EF4444' },
    { type: 'github-commit', name: 'GitHub Commit', icon: 'GitBranch', color: '#EF4444' },
    { type: 'notion-page', name: 'Notion Page', icon: 'FileText', color: '#EF4444' },
  ],
}

// Example pre-built SOPs
const EXAMPLE_SOPS: SOP[] = [
  {
    id: 'sop-1',
    name: 'CEO Daily Brief',
    category: 'Executive',
    description: 'Automated daily briefing with key metrics, calendar, and priorities',
    trigger: 'scheduled',
    schedule: 'daily-7am',
    status: 'published',
    version: 3,
    estimatedTime: '5 minutes',
    requiredIntegrations: ['Gmail', 'Google Calendar', 'Notion'],
    assignedClients: ['Acme Corp', 'TechStart Inc'],
    steps: [
      { id: '1', type: 'fetch-email', category: 'Data Collection', name: 'Fetch Urgent Emails', icon: 'Mail', config: { filter: 'important', limit: 10 }, position: { x: 100, y: 100 }, connections: ['2'] },
      { id: '2', type: 'google-calendar', category: 'Integrations', name: 'Get Today\'s Meetings', icon: 'Calendar', config: { calendar: 'primary' }, position: { x: 100, y: 220 }, connections: ['3'] },
      { id: '3', type: 'database-query', category: 'Data Collection', name: 'Query KPIs', icon: 'Database', config: { query: 'SELECT * FROM metrics' }, position: { x: 100, y: 340 }, connections: ['4'] },
      { id: '4', type: 'ai-analysis', category: 'Processing', name: 'Generate Brief', icon: 'Brain', config: { model: 'claude-3-opus' }, position: { x: 350, y: 220 }, connections: ['5'] },
      { id: '5', type: 'create-document', category: 'Actions', name: 'Create PDF', icon: 'FileText', config: { format: 'pdf' }, position: { x: 600, y: 220 }, connections: ['6'] },
      { id: '6', type: 'send-email', category: 'Actions', name: 'Email to CEO', icon: 'Send', config: { to: 'ceo@company.com' }, position: { x: 850, y: 220 }, connections: [] },
    ],
  },
  {
    id: 'sop-2',
    name: 'Invoice Processing',
    category: 'Finance',
    description: 'Extract invoice data, validate, and update accounting system',
    trigger: 'event',
    status: 'published',
    version: 2,
    estimatedTime: '3 minutes',
    requiredIntegrations: ['Gmail', 'QuickBooks'],
    assignedClients: ['Acme Corp'],
    steps: [
      { id: '1', type: 'fetch-email', category: 'Data Collection', name: 'Fetch Invoice Emails', icon: 'Mail', config: { label: 'invoices' }, position: { x: 100, y: 150 }, connections: ['2'] },
      { id: '2', type: 'file-upload', category: 'Data Collection', name: 'Extract Attachments', icon: 'FileUp', config: { fileType: 'pdf' }, position: { x: 100, y: 270 }, connections: ['3'] },
      { id: '3', type: 'ai-analysis', category: 'Processing', name: 'Extract Invoice Data', icon: 'Brain', config: { extractFields: ['amount', 'date', 'vendor'] }, position: { x: 350, y: 210 }, connections: ['4'] },
      { id: '4', type: 'validation', category: 'Processing', name: 'Validate Data', icon: 'CheckCircle', config: { rules: ['amount > 0', 'date valid'] }, position: { x: 600, y: 210 }, connections: ['5', '6'] },
      { id: '5', type: 'update-database', category: 'Actions', name: 'Update QuickBooks', icon: 'Database', config: { system: 'quickbooks' }, position: { x: 850, y: 150 }, connections: ['7'] },
      { id: '6', type: 'approval-gate', category: 'Logic', name: 'Request Approval', icon: 'UserCheck', config: { approver: 'finance@company.com' }, position: { x: 850, y: 270 }, connections: ['5'] },
      { id: '7', type: 'slack-message', category: 'Actions', name: 'Notify Finance', icon: 'MessageSquare', config: { channel: '#finance' }, position: { x: 1100, y: 150 }, connections: [] },
      { id: '8', type: 'send-email', category: 'Actions', name: 'Send Confirmation', icon: 'Send', config: { template: 'invoice-processed' }, position: { x: 1100, y: 270 }, connections: [] },
    ],
  },
  {
    id: 'sop-3',
    name: 'Contract Review',
    category: 'Legal',
    description: 'AI-powered contract analysis and risk assessment',
    trigger: 'manual',
    status: 'draft',
    version: 1,
    estimatedTime: '10 minutes',
    requiredIntegrations: ['DocuSign', 'Notion'],
    assignedClients: [],
    steps: [
      { id: '1', type: 'file-upload', category: 'Data Collection', name: 'Upload Contract', icon: 'FileUp', config: { accept: '.pdf,.docx' }, position: { x: 100, y: 200 }, connections: ['2'] },
      { id: '2', type: 'ai-analysis', category: 'Processing', name: 'Analyze Terms', icon: 'Brain', config: { focus: 'legal-risk' }, position: { x: 350, y: 200 }, connections: ['3'] },
      { id: '3', type: 'conditional', category: 'Logic', name: 'Risk Level?', icon: 'GitBranch', config: { condition: 'risk > medium' }, position: { x: 600, y: 200 }, connections: ['4', '5'] },
      { id: '4', type: 'approval-gate', category: 'Logic', name: 'Legal Review', icon: 'UserCheck', config: { approver: 'legal@company.com' }, position: { x: 850, y: 120 }, connections: ['6'] },
      { id: '5', type: 'generate-report', category: 'Actions', name: 'Generate Report', icon: 'FileBarChart', config: { template: 'contract-summary' }, position: { x: 850, y: 280 }, connections: ['6'] },
    ],
  },
]

const iconMap: Record<string, any> = {
  Mail, Globe, Database, FileUp, Brain, Filter, BarChart,
  Send, MessageSquare, FileText, Calendar, FileBarChart,
  GitBranch, Repeat, Clock, Shuffle, UserCheck, CheckCircle
}

export default function SOPBuilderPage() {
  const [currentSOP, setCurrentSOP] = useState<SOP>(EXAMPLE_SOPS[0])
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [draggedStep, setDraggedStep] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [history, setHistory] = useState<SOP[]>([currentSOP])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(Object.keys(STEP_LIBRARY))
  const canvasRef = useRef<HTMLDivElement>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (autoSaveStatus === 'unsaved') {
        setAutoSaveStatus('saving')
        setTimeout(() => setAutoSaveStatus('saved'), 500)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [autoSaveStatus])

  // Update history for undo/redo
  const updateHistory = (newSOP: SOP) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newSOP)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setAutoSaveStatus('unsaved')
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setCurrentSOP(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setCurrentSOP(history[historyIndex + 1])
    }
  }

  const handleDragStart = (step: any) => {
    setDraggedStep(step)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedStep || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom

    const newStep: SOPStep = {
      id: `step-${Date.now()}`,
      type: draggedStep.type,
      category: draggedStep.category || 'Data Collection',
      name: draggedStep.name,
      icon: draggedStep.icon,
      config: {},
      position: { x, y },
      connections: [],
    }

    const newSOP = {
      ...currentSOP,
      steps: [...currentSOP.steps, newStep],
    }

    setCurrentSOP(newSOP)
    updateHistory(newSOP)
    setDraggedStep(null)
  }

  const deleteStep = (stepId: string) => {
    const newSOP = {
      ...currentSOP,
      steps: currentSOP.steps.filter(s => s.id !== stepId).map(s => ({
        ...s,
        connections: s.connections.filter(c => c !== stepId),
      })),
    }
    setCurrentSOP(newSOP)
    updateHistory(newSOP)
    if (selectedStep === stepId) setSelectedStep(null)
  }

  const updateStepConfig = (stepId: string, config: Record<string, any>) => {
    const newSOP = {
      ...currentSOP,
      steps: currentSOP.steps.map(s => s.id === stepId ? { ...s, config } : s),
    }
    setCurrentSOP(newSOP)
    updateHistory(newSOP)
  }

  const connectSteps = (fromId: string, toId: string) => {
    const newSOP = {
      ...currentSOP,
      steps: currentSOP.steps.map(s =>
        s.id === fromId && !s.connections.includes(toId)
          ? { ...s, connections: [...s.connections, toId] }
          : s
      ),
    }
    setCurrentSOP(newSOP)
    updateHistory(newSOP)
  }

  const loadTemplate = (sop: SOP) => {
    setCurrentSOP(sop)
    updateHistory(sop)
    setShowTemplates(false)
  }

  const exportAsJSON = () => {
    const dataStr = JSON.stringify(currentSOP, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `${currentSOP.name.replace(/\s+/g, '-').toLowerCase()}.json`
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getStepPosition = (step: SOPStep) => ({
    left: step.position.x * zoom + pan.x,
    top: step.position.y * zoom + pan.y,
  })

  const selectedStepData = currentSOP.steps.find(s => s.id === selectedStep)

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* LEFT SIDEBAR - Step Library */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold mb-3">Step Library</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search steps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(STEP_LIBRARY).map(([category, steps]) => {
            const isExpanded = expandedCategories.includes(category)
            const filteredSteps = steps.filter(step =>
              step.name.toLowerCase().includes(searchQuery.toLowerCase())
            )

            if (filteredSteps.length === 0 && searchQuery) return null

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-2 hover:bg-gray-800 rounded-lg mb-2"
                >
                  <span className="font-semibold text-sm">{category}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="space-y-2">
                    {filteredSteps.map((step) => {
                      const Icon = iconMap[step.icon] || CheckCircle
                      return (
                        <div
                          key={step.type}
                          draggable
                          onDragStart={() => handleDragStart({ ...step, category })}
                          className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-move border border-gray-700 transition-all hover:border-gray-600"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: step.color + '20', color: step.color }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium">{step.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => setShowTemplates(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Layout className="w-4 h-4" />
            <span className="text-sm font-medium">Load Template</span>
          </button>
        </div>
      </div>

      {/* CENTER - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={currentSOP.name}
              onChange={(e) => {
                const newSOP = { ...currentSOP, name: e.target.value }
                setCurrentSOP(newSOP)
                updateHistory(newSOP)
              }}
              className="text-xl font-bold bg-transparent border-none outline-none focus:outline-none w-64"
            />
            <span className={`px-2 py-1 rounded text-xs ${
              currentSOP.status === 'published'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {currentSOP.status}
            </span>
            <span className="text-xs text-gray-500">
              {autoSaveStatus === 'saved' && '✓ Saved'}
              {autoSaveStatus === 'saving' && '⏳ Saving...'}
              {autoSaveStatus === 'unsaved' && '• Unsaved changes'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-2" />
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-2 hover:bg-gray-800 rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="p-2 hover:bg-gray-800 rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-gray-800 rounded-lg" title="Auto Layout">
              <Grid className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-2" />
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg">
              <Play className="w-4 h-4" />
              <span className="text-sm">Test Run</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg">
              <History className="w-4 h-4" />
              <span className="text-sm">Version History</span>
            </button>
            <button
              onClick={exportAsJSON}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Export</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
              <Save className="w-4 h-4" />
              <span className="text-sm">Publish SOP</span>
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 bg-gray-950 relative overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
            {currentSOP.steps.map(step =>
              step.connections.map(targetId => {
                const target = currentSOP.steps.find(s => s.id === targetId)
                if (!target) return null

                const startPos = getStepPosition(step)
                const endPos = getStepPosition(target)

                const startX = startPos.left + 120
                const startY = startPos.top + 35
                const endX = endPos.left
                const endY = endPos.top + 35

                const midX = (startX + endX) / 2

                return (
                  <g key={`${step.id}-${targetId}`}>
                    <path
                      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                      stroke="#3B82F6"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                )
              })
            )}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#3B82F6" />
              </marker>
            </defs>
          </svg>

          {/* Steps */}
          {currentSOP.steps.map((step) => {
            const Icon = iconMap[step.icon] || CheckCircle
            const pos = getStepPosition(step)
            const isSelected = selectedStep === step.id
            const stepDef = Object.values(STEP_LIBRARY).flat().find(s => s.type === step.type)
            const color = stepDef?.color || '#6B7280'

            return (
              <div
                key={step.id}
                onClick={() => setSelectedStep(step.id)}
                className={`absolute w-60 bg-gray-800 rounded-lg shadow-lg border-2 cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 shadow-blue-500/50' : 'border-gray-700'
                }`}
                style={{ left: pos.left, top: pos.top }}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color + '20', color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => {
                            const newSOP = {
                              ...currentSOP,
                              steps: currentSOP.steps.map(s =>
                                s.id === step.id ? { ...s, name: e.target.value } : s
                              ),
                            }
                            setCurrentSOP(newSOP)
                            updateHistory(newSOP)
                          }}
                          className="w-full text-sm font-semibold bg-transparent border-none outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-xs text-gray-500">{step.type}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStep(step.id)
                      }}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {Object.keys(step.config).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400">
                        {Object.entries(step.config).slice(0, 2).map(([key, value]) => (
                          <div key={key} className="truncate">
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.connections.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <ChevronRight className="w-3 h-3" />
                      <span>{step.connections.length} connection(s)</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty State */}
          {currentSOP.steps.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Layout className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  Drag steps from the library to get started
                </h3>
                <p className="text-gray-600">
                  Or load a template to see examples
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR - Configuration */}
      <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
        {selectedStepData ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Step Configuration</h2>
              <button
                onClick={() => setSelectedStep(null)}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Step Info */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Step Name</label>
                <input
                  type="text"
                  value={selectedStepData.name}
                  onChange={(e) => {
                    const newSOP = {
                      ...currentSOP,
                      steps: currentSOP.steps.map(s =>
                        s.id === selectedStepData.id ? { ...s, name: e.target.value } : s
                      ),
                    }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  placeholder="Add a description..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                />
              </div>

              {/* Type-specific configuration */}
              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold mb-4">Input Parameters</h3>

                {selectedStepData.type === 'ai-analysis' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Model</label>
                      <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                        <option>claude-3-opus-20240229</option>
                        <option>claude-3-sonnet-20240229</option>
                        <option>claude-3-haiku-20240307</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Prompt Template</label>
                      <textarea
                        placeholder="Enter your prompt..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg h-24 resize-none text-sm"
                      />
                    </div>
                  </div>
                )}

                {selectedStepData.type === 'send-email' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">To</label>
                      <input
                        type="email"
                        placeholder="recipient@example.com"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Subject</label>
                      <input
                        type="text"
                        placeholder="Email subject..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Body Template</label>
                      <textarea
                        placeholder="Email body..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg h-24 resize-none text-sm"
                      />
                    </div>
                  </div>
                )}

                {selectedStepData.type === 'database-query' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Database</label>
                      <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                        <option>Production</option>
                        <option>Analytics</option>
                        <option>Data Warehouse</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Query</label>
                      <textarea
                        placeholder="SELECT * FROM..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg h-24 resize-none text-sm font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedStepData.type === 'conditional' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Condition</label>
                      <input
                        type="text"
                        placeholder="e.g., risk_score > 0.7"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">True Branch</label>
                      <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                        <option>Select next step...</option>
                        {currentSOP.steps.filter(s => s.id !== selectedStepData.id).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">False Branch</label>
                      <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                        <option>Select next step...</option>
                        {currentSOP.steps.filter(s => s.id !== selectedStepData.id).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Handling */}
              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold mb-4">Error Handling</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Retry Count</label>
                    <input
                      type="number"
                      defaultValue="3"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Timeout (seconds)</label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">On Failure</label>
                    <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
                      <option>Stop execution</option>
                      <option>Continue to next step</option>
                      <option>Go to error handler</option>
                      <option>Notify admin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Connections */}
              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold mb-4">Connections</h3>
                <div className="space-y-2">
                  {selectedStepData.connections.map(connId => {
                    const connStep = currentSOP.steps.find(s => s.id === connId)
                    return connStep ? (
                      <div key={connId} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                        <span className="text-sm">{connStep.name}</span>
                        <button
                          onClick={() => {
                            const newSOP = {
                              ...currentSOP,
                              steps: currentSOP.steps.map(s =>
                                s.id === selectedStepData.id
                                  ? { ...s, connections: s.connections.filter(c => c !== connId) }
                                  : s
                              ),
                            }
                            setCurrentSOP(newSOP)
                            updateHistory(newSOP)
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null
                  })}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        connectSteps(selectedStepData.id, e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                  >
                    <option value="">+ Add connection</option>
                    {currentSOP.steps
                      .filter(s => s.id !== selectedStepData.id && !selectedStepData.connections.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Test Button */}
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                <Play className="w-4 h-4" />
                <span className="text-sm font-medium">Test Step</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h2 className="text-lg font-bold mb-6">SOP Metadata</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">SOP Name</label>
                <input
                  type="text"
                  value={currentSOP.name}
                  onChange={(e) => {
                    const newSOP = { ...currentSOP, name: e.target.value }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                <select
                  value={currentSOP.category}
                  onChange={(e) => {
                    const newSOP = { ...currentSOP, category: e.target.value }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                >
                  <option>Executive</option>
                  <option>Finance</option>
                  <option>Legal</option>
                  <option>Sales</option>
                  <option>Marketing</option>
                  <option>Operations</option>
                  <option>HR</option>
                  <option>Support</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  value={currentSOP.description}
                  onChange={(e) => {
                    const newSOP = { ...currentSOP, description: e.target.value }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Trigger Type</label>
                <select
                  value={currentSOP.trigger}
                  onChange={(e) => {
                    const newSOP = { ...currentSOP, trigger: e.target.value as any }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                >
                  <option value="manual">Manual</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="event">Event-based</option>
                </select>
              </div>

              {currentSOP.trigger === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Schedule</label>
                  <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
                    <option>Daily at 7:00 AM</option>
                    <option>Daily at 5:00 PM</option>
                    <option>Monday-Friday at 9:00 AM</option>
                    <option>Weekly on Monday</option>
                    <option>Monthly on 1st</option>
                    <option>Custom cron...</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Estimated Execution Time</label>
                <input
                  type="text"
                  value={currentSOP.estimatedTime || ''}
                  onChange={(e) => {
                    const newSOP = { ...currentSOP, estimatedTime: e.target.value }
                    setCurrentSOP(newSOP)
                    updateHistory(newSOP)
                  }}
                  placeholder="e.g., 5 minutes"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Required Integrations</label>
                <div className="space-y-2">
                  {['Gmail', 'Slack', 'Notion', 'Google Calendar', 'QuickBooks', 'Salesforce'].map(integration => (
                    <label key={integration} className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded cursor-pointer">
                      <input type="checkbox" className="w-4 h-4" />
                      <span className="text-sm">{integration}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Assigned Clients</label>
                <select multiple className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg h-32">
                  <option>Acme Corp</option>
                  <option>TechStart Inc</option>
                  <option>Global Industries</option>
                  <option>Innovation Labs</option>
                  <option>Future Systems</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Cmd/Ctrl to select multiple</p>
              </div>

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-semibold mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Steps</span>
                    <span className="font-medium">{currentSOP.steps.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Connections</span>
                    <span className="font-medium">
                      {currentSOP.steps.reduce((sum, s) => sum + s.connections.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Version</span>
                    <span className="font-medium">v{currentSOP.version}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="font-medium capitalize">{currentSOP.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Load SOP Template</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                {EXAMPLE_SOPS.map(sop => (
                  <div
                    key={sop.id}
                    onClick={() => loadTemplate(sop)}
                    className="p-6 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{sop.name}</h3>
                        <p className="text-sm text-gray-400">{sop.category}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        sop.status === 'published'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {sop.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-400 mb-4">{sop.description}</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Settings className="w-3 h-3" />
                        <span>{sop.steps.length} steps</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{sop.estimatedTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <CheckCircle className="w-3 h-3" />
                        <span>v{sop.version}</span>
                      </div>
                    </div>

                    {sop.requiredIntegrations && sop.requiredIntegrations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex flex-wrap gap-1">
                          {sop.requiredIntegrations.map(int => (
                            <span key={int} className="px-2 py-1 bg-gray-700 rounded text-xs">
                              {int}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* New SOP Card */}
                <div
                  onClick={() => {
                    const newSOP: SOP = {
                      id: `sop-${Date.now()}`,
                      name: 'New SOP',
                      category: 'Operations',
                      description: 'Add your description here',
                      steps: [],
                      trigger: 'manual',
                      status: 'draft',
                      version: 1,
                    }
                    loadTemplate(newSOP)
                  }}
                  className="p-6 bg-gray-800 hover:bg-gray-750 rounded-lg border-2 border-dashed border-gray-700 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-center"
                >
                  <div className="text-center">
                    <Plus className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-lg">Start from Scratch</h3>
                    <p className="text-sm text-gray-400 mt-1">Create a new empty SOP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
