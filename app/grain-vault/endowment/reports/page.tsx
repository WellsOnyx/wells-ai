// @ts-nocheck
'use client'

/**
 * Grain & Vault - Board Reporting Dashboard
 *
 * Board Reporting System for Endowments/Nonprofits:
 * - Quarterly endowment summary
 * - Fund performance report
 * - Grant activity report
 * - Compliance/fiduciary report
 * - Spending policy adherence
 *
 * Features:
 * - Report templates selection
 * - Date range picker
 * - Preview before export
 * - Download buttons (PDF, CSV, Excel)
 * - Email to board members
 */

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Building2,
  PieChart,
  BarChart3,
  DollarSign,
  Landmark,
  Eye,
  Mail,
  Printer,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Settings,
  Filter,
  Share2,
  X,
  Send,
  Loader2,
  FileSpreadsheet,
  File,
  Activity,
  Percent
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// =============================================================================
// TYPES
// =============================================================================

type ReportType =
  | 'quarterly_endowment_summary'
  | 'fund_performance'
  | 'grant_activity'
  | 'compliance_fiduciary'
  | 'spending_policy_adherence'

interface ReportTemplate {
  type: ReportType
  name: string
  description: string
  frequency: string
}

interface ReportMetadata {
  id: string
  type: ReportType
  title: string
  description: string
  dateRange: {
    start: string
    end: string
  }
  status: 'draft' | 'pending_review' | 'approved' | 'published'
  createdAt: string
  createdBy: string
  organizationId: string
  organizationName: string
}

interface GeneratedReport {
  metadata: ReportMetadata
  [key: string]: any
}

// Legacy type for backward compatibility with UI
interface Report {
  id: string
  title: string
  type: 'quarterly' | 'annual' | 'compliance' | 'performance' | 'custom'
  period: string
  generatedDate: string
  status: 'ready' | 'generating' | 'scheduled'
  pages: number
  size: string
  downloadUrl: string
}

const MOCK_REPORTS: Report[] = [
  {
    id: 'RPT-2025-Q4',
    title: 'Q4 2025 Financial Summary',
    type: 'quarterly',
    period: 'October - December 2025',
    generatedDate: '2025-12-20',
    status: 'ready',
    pages: 24,
    size: '2.4 MB',
    downloadUrl: '#'
  },
  {
    id: 'RPT-2025-Q3',
    title: 'Q3 2025 Financial Summary',
    type: 'quarterly',
    period: 'July - September 2025',
    generatedDate: '2025-10-05',
    status: 'ready',
    pages: 22,
    size: '2.1 MB',
    downloadUrl: '#'
  },
  {
    id: 'RPT-2025-ANNUAL',
    title: 'FY 2025 Annual Report',
    type: 'annual',
    period: 'July 2024 - June 2025',
    generatedDate: '2025-07-31',
    status: 'ready',
    pages: 68,
    size: '8.5 MB',
    downloadUrl: '#'
  },
  {
    id: 'RPT-2025-COMP-Q4',
    title: 'Q4 2025 Compliance Report',
    type: 'compliance',
    period: 'October - December 2025',
    generatedDate: '2025-12-22',
    status: 'ready',
    pages: 15,
    size: '1.2 MB',
    downloadUrl: '#'
  },
  {
    id: 'RPT-2025-PERF',
    title: 'Investment Performance Analysis',
    type: 'performance',
    period: 'YTD 2025',
    generatedDate: '2025-12-15',
    status: 'ready',
    pages: 32,
    size: '4.8 MB',
    downloadUrl: '#'
  },
  {
    id: 'RPT-2026-Q1',
    title: 'Q1 2026 Financial Summary',
    type: 'quarterly',
    period: 'January - March 2026',
    generatedDate: '',
    status: 'scheduled',
    pages: 0,
    size: '',
    downloadUrl: '#'
  }
]

// Board Meeting Data
const BOARD_MEETINGS = [
  {
    date: '2026-01-15',
    title: 'Q4 Review Meeting',
    status: 'upcoming',
    materials: ['Q4 Financial Summary', 'Investment Performance', 'Compliance Report']
  },
  {
    date: '2025-10-20',
    title: 'Q3 Review Meeting',
    status: 'completed',
    materials: ['Q3 Financial Summary', 'Spending Policy Review']
  },
  {
    date: '2025-07-18',
    title: 'Annual Meeting',
    status: 'completed',
    materials: ['FY 2025 Annual Report', 'Audit Report', 'Strategic Plan Update']
  }
]

// Key Performance Indicators
const KPI_DATA = {
  currentQuarter: {
    totalReturn: 8.97,
    benchmark: 7.5,
    spendingRate: 4.6,
    spendingPolicy: 5.0,
    newContributions: 2_450_000,
    disbursements: 2_425_000,
    netAssetGrowth: 4_347_392
  },
  quarterlyReturns: [
    { quarter: 'Q1 2025', return: 2.1, benchmark: 1.8 },
    { quarter: 'Q2 2025', return: 2.4, benchmark: 2.0 },
    { quarter: 'Q3 2025', return: 1.8, benchmark: 1.5 },
    { quarter: 'Q4 2025', return: 2.5, benchmark: 2.2 }
  ],
  assetAllocation: {
    current: [
      { category: 'Fixed Income', percent: 40, target: 40 },
      { category: 'Equities', percent: 30, target: 30 },
      { category: 'Money Market', percent: 15, target: 15 },
      { category: 'Real Assets', percent: 10, target: 10 },
      { category: 'Cash', percent: 5, target: 5 }
    ]
  },
  spendingHistory: [
    { year: 'FY 2021', amount: 2_100_000, rate: 4.8 },
    { year: 'FY 2022', amount: 2_200_000, rate: 4.7 },
    { year: 'FY 2023', amount: 2_300_000, rate: 4.6 },
    { year: 'FY 2024', amount: 2_350_000, rate: 4.5 },
    { year: 'FY 2025', amount: 2_425_000, rate: 4.6 }
  ]
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getQuarterStartDate(): string {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const startMonth = quarter * 3
  return new Date(now.getFullYear(), startMonth, 1).toISOString().split('T')[0]
}

function getQuarterEndDate(): string {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const endMonth = quarter * 3 + 2
  const lastDay = new Date(now.getFullYear(), endMonth + 1, 0).getDate()
  return new Date(now.getFullYear(), endMonth, lastDay).toISOString().split('T')[0]
}

function getQuarterRange(offset: number): { start: string; end: string } {
  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3)
  const targetQuarter = currentQuarter + offset

  let year = now.getFullYear()
  let quarter = targetQuarter

  if (quarter < 0) {
    year -= 1
    quarter = 4 + quarter
  } else if (quarter > 3) {
    year += 1
    quarter = quarter - 4
  }

  const startMonth = quarter * 3
  const endMonth = quarter * 3 + 2
  const lastDay = new Date(year, endMonth + 1, 0).getDate()

  return {
    start: new Date(year, startMonth, 1).toISOString().split('T')[0],
    end: new Date(year, endMonth, lastDay).toISOString().split('T')[0],
  }
}

function getYearRange(offset: number): { start: string; end: string } {
  const year = new Date().getFullYear() + offset
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  }
}

function getReportTypeIcon(type: ReportType) {
  switch (type) {
    case 'quarterly_endowment_summary':
      return <BarChart3 className="w-5 h-5 text-green-400" />
    case 'fund_performance':
      return <TrendingUp className="w-5 h-5 text-blue-400" />
    case 'grant_activity':
      return <Users className="w-5 h-5 text-purple-400" />
    case 'compliance_fiduciary':
      return <Shield className="w-5 h-5 text-amber-400" />
    case 'spending_policy_adherence':
      return <Percent className="w-5 h-5 text-orange-400" />
    default:
      return <FileText className="w-5 h-5 text-gray-400" />
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-500/20 text-gray-400'
    case 'pending_review':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'approved':
      return 'bg-green-500/20 text-green-400'
    case 'published':
      return 'bg-blue-500/20 text-blue-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReportsPage() {
  const { user, isLoaded } = useUser()
  const [selectedReportType, setSelectedReportType] = useState<string>('all')
  const [expandedSection, setExpandedSection] = useState<string | null>('generate')
  const [generatingReport, setGeneratingReport] = useState(false)

  // New state for API integration
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [apiReports, setApiReports] = useState<ReportMetadata[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Report generation state
  const [selectedTemplate, setSelectedTemplate] = useState<ReportType | null>(null)
  const [dateRange, setDateRange] = useState({
    start: getQuarterStartDate(),
    end: getQuarterEndDate(),
  })

  // Preview state
  const [previewReport, setPreviewReport] = useState<GeneratedReport | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Export state
  const [exporting, setExporting] = useState<string | null>(null)

  // Fetch templates and reports from API
  useEffect(() => {
    if (isLoaded) {
      fetchReportsData()
    }
  }, [isLoaded])

  const fetchReportsData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/grain/reports?action=list')
      if (!res.ok) throw new Error('Failed to fetch reports')

      const data = await res.json()
      setTemplates(data.templates || [])
      setApiReports(data.reports || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching reports:', err)
      // Use default templates if API fails
      setTemplates([
        { type: 'quarterly_endowment_summary', name: 'Quarterly Endowment Summary', description: 'Comprehensive overview of endowment performance and fund balances', frequency: 'Quarterly' },
        { type: 'fund_performance', name: 'Fund Performance Report', description: 'Detailed analysis of fund performance and asset allocation', frequency: 'Quarterly' },
        { type: 'grant_activity', name: 'Grant Activity Report', description: 'Summary of grant approvals, disbursements, and impact', frequency: 'Monthly/Quarterly' },
        { type: 'compliance_fiduciary', name: 'Compliance & Fiduciary Report', description: 'Assessment of policy compliance and fiduciary duties', frequency: 'Quarterly/Annual' },
        { type: 'spending_policy_adherence', name: 'Spending Policy Adherence', description: 'Analysis of spending rates and policy compliance', frequency: 'Quarterly' },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Generate report via API
  const generateReportFromAPI = async () => {
    if (!selectedTemplate) {
      setError('Please select a report template')
      return
    }

    setGeneratingReport(true)
    setError(null)

    try {
      const res = await fetch('/api/grain/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedTemplate,
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to generate report')
      }

      const data = await res.json()
      setPreviewReport(data.report)
      setShowPreview(true)
      setSuccess('Report generated successfully!')
      setExpandedSection('preview')

      // Refresh the reports list
      fetchReportsData()
    } catch (err: any) {
      console.error('Error generating report:', err)
      setError(err.message)
    } finally {
      setGeneratingReport(false)
    }
  }

  // Export report
  const exportReport = async (reportId: string, format: 'pdf' | 'csv' | 'excel') => {
    setExporting(`${reportId}-${format}`)
    try {
      const url = `/api/grain/reports/${reportId}/export?format=${format}`
      const res = await fetch(url)

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `report-${reportId}.${format === 'excel' ? 'csv' : format === 'pdf' ? 'html' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      setSuccess(`Report exported as ${format.toUpperCase()}`)
    } catch (err: any) {
      console.error('Export error:', err)
      setError(`Failed to export: ${err.message}`)
    } finally {
      setExporting(null)
    }
  }

  // Export preview report
  const exportPreviewReport = async (format: 'pdf' | 'csv' | 'excel') => {
    if (!previewReport) return

    setExporting(`preview-${format}`)
    try {
      const url = `/api/grain/reports/preview/export?format=${format}&generate=true&type=${previewReport.metadata.type}&startDate=${dateRange.start}&endDate=${dateRange.end}`
      const res = await fetch(url)

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${previewReport.metadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format === 'excel' ? 'csv' : format === 'pdf' ? 'html' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      setSuccess(`Report exported as ${format.toUpperCase()}`)
    } catch (err: any) {
      console.error('Export error:', err)
      setError(`Failed to export: ${err.message}`)
    } finally {
      setExporting(null)
    }
  }

  // Send email
  const sendEmail = async () => {
    if (!emailRecipients || !previewReport) return

    setSendingEmail(true)
    try {
      // In production, this would call an email API
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSuccess(`Report sent to ${emailRecipients.split(',').length} recipient(s)`)
      setShowEmailModal(false)
      setEmailRecipients('')
      setEmailSubject('')
    } catch (err: any) {
      setError('Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const formatUSD = (amount: number, compact = false) => {
    if (compact) {
      if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
      if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Scheduled'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getReportTypeBadge = (type: Report['type']) => {
    const configs = {
      quarterly: { color: 'bg-blue-500/20 text-blue-400', label: 'Quarterly' },
      annual: { color: 'bg-purple-500/20 text-purple-400', label: 'Annual' },
      compliance: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Compliance' },
      performance: { color: 'bg-amber-500/20 text-amber-400', label: 'Performance' },
      custom: { color: 'bg-gray-500/20 text-gray-400', label: 'Custom' }
    }
    const config = configs[type]
    return (
      <span className={`px-2 py-0.5 ${config.color} text-xs font-medium rounded`}>
        {config.label}
      </span>
    )
  }

  const filteredReports = selectedReportType === 'all'
    ? MOCK_REPORTS
    : MOCK_REPORTS.filter(r => r.type === selectedReportType)

  // Chart configurations
  const returnsChartData = {
    labels: KPI_DATA.quarterlyReturns.map(q => q.quarter),
    datasets: [
      {
        label: 'Actual Return',
        data: KPI_DATA.quarterlyReturns.map(q => q.return),
        backgroundColor: '#10b981',
        borderRadius: 4
      },
      {
        label: 'Benchmark',
        data: KPI_DATA.quarterlyReturns.map(q => q.benchmark),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      }
    ]
  }

  const returnsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { color: '#9ca3af' }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#9ca3af',
          callback: (value: number) => `${value}%`
        }
      }
    }
  }

  const spendingChartData = {
    labels: KPI_DATA.spendingHistory.map(s => s.year),
    datasets: [
      {
        label: 'Spending ($M)',
        data: KPI_DATA.spendingHistory.map(s => s.amount / 1000000),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const spendingChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#9ca3af',
          callback: (value: number) => `$${value}M`
        }
      }
    }
  }

  const handleGenerateReport = async () => {
    // Use the API-based generation
    generateReportFromAPI()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/grain-vault/dashboard"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <FileText className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Board Reports</h1>
                  <p className="text-xs text-gray-400">Endowment Reporting System</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchReportsData()}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-300 text-sm">{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Report Generation Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'generate' ? null : 'generate')}
            className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-white">Generate New Report</h2>
                <p className="text-sm text-gray-400">Select a template and date range</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'generate' ? 'rotate-180' : ''}`} />
          </button>

          {expandedSection === 'generate' && (
            <div className="border-t border-white/10 p-6 space-y-6">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Report Template
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.type}
                      onClick={() => setSelectedTemplate(template.type)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedTemplate === template.type
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedTemplate === template.type
                            ? 'bg-green-500/30'
                            : 'bg-white/10'
                        }`}>
                          {getReportTypeIcon(template.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                          <span className="inline-block mt-2 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                            {template.frequency}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Date Range Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDateRange(getQuarterRange(0))}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
                >
                  Current Quarter
                </button>
                <button
                  onClick={() => setDateRange(getQuarterRange(-1))}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
                >
                  Last Quarter
                </button>
                <button
                  onClick={() => setDateRange(getYearRange(0))}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
                >
                  Current Year
                </button>
                <button
                  onClick={() => setDateRange(getYearRange(-1))}
                  className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
                >
                  Last Year
                </button>
              </div>

              {/* Generate Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleGenerateReport}
                  disabled={!selectedTemplate || generatingReport}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
                >
                  {generatingReport ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Report Preview Section */}
        {showPreview && previewReport && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Report Preview</h2>
                  <p className="text-sm text-gray-400">{previewReport.metadata.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <ReportPreviewContent report={previewReport} formatUSD={formatUSD} />
            </div>

            {/* Export & Email Actions */}
            <div className="p-6 border-t border-white/10 bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => exportPreviewReport('pdf')}
                    disabled={exporting !== null}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {exporting === 'preview-pdf' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <File className="w-4 h-4" />
                    )}
                    Export PDF
                  </button>
                  <button
                    onClick={() => exportPreviewReport('csv')}
                    disabled={exporting !== null}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-500/30 transition flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {exporting === 'preview-csv' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    Export CSV
                  </button>
                  <button
                    onClick={() => exportPreviewReport('excel')}
                    disabled={exporting !== null}
                    className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-500/30 transition flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {exporting === 'preview-excel' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    Export Excel
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEmailSubject(previewReport.metadata.title)
                    setShowEmailModal(true)
                  }}
                  className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg hover:bg-purple-500/30 transition flex items-center gap-2 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Email to Board
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Board Meeting Alert */}
        <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Upcoming Board Meeting</h2>
                <p className="text-sm text-gray-400">{BOARD_MEETINGS[0].title} - {formatDate(BOARD_MEETINGS[0].date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                20 days away
              </span>
              <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                Prepare Materials
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
            <span>Required Materials:</span>
            {BOARD_MEETINGS[0].materials.map((material, idx) => (
              <span key={idx} className="px-2 py-1 bg-white/5 rounded text-xs">{material}</span>
            ))}
          </div>
        </div>

        {/* KPI Summary Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'kpis' ? null : 'kpis')}
            className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-white">Key Performance Indicators</h2>
                <p className="text-sm text-gray-400">Current quarter executive summary</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'kpis' ? 'rotate-180' : ''}`} />
          </button>

          {expandedSection === 'kpis' && (
            <div className="border-t border-white/10 p-6 space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Total Return (YTD)</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">+{KPI_DATA.currentQuarter.totalReturn}%</p>
                  <p className="text-xs text-gray-500 mt-1">vs Benchmark: {KPI_DATA.currentQuarter.benchmark}%</p>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Spending Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{KPI_DATA.currentQuarter.spendingRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">Policy: {KPI_DATA.currentQuarter.spendingPolicy}% max</p>
                </div>

                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">Net Asset Growth</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-400">+{formatUSD(KPI_DATA.currentQuarter.netAssetGrowth, true)}</p>
                  <p className="text-xs text-gray-500 mt-1">Year-to-date</p>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-gray-400">Compliance Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <p className="text-lg font-bold text-emerald-400">Compliant</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">All policies met</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4">Quarterly Returns vs Benchmark</h3>
                  <div className="h-48">
                    <Bar data={returnsChartData} options={returnsChartOptions} />
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4">Historical Spending Trend</h3>
                  <div className="h-48">
                    <Line data={spendingChartData} options={spendingChartOptions} />
                  </div>
                </div>
              </div>

              {/* Asset Allocation Table */}
              <div className="p-4 bg-white/5 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Asset Allocation Compliance</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-xs text-gray-400">Asset Class</th>
                      <th className="text-right py-2 text-xs text-gray-400">Current</th>
                      <th className="text-right py-2 text-xs text-gray-400">Target</th>
                      <th className="text-right py-2 text-xs text-gray-400">Variance</th>
                      <th className="text-right py-2 text-xs text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {KPI_DATA.assetAllocation.current.map((asset, idx) => {
                      const variance = asset.percent - asset.target
                      return (
                        <tr key={idx}>
                          <td className="py-3 text-sm text-white">{asset.category}</td>
                          <td className="py-3 text-sm text-right text-white">{asset.percent}%</td>
                          <td className="py-3 text-sm text-right text-gray-400">{asset.target}%</td>
                          <td className={`py-3 text-sm text-right ${variance === 0 ? 'text-gray-400' : variance > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {variance > 0 ? '+' : ''}{variance}%
                          </td>
                          <td className="py-3 text-right">
                            <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Available Reports */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Available Reports</h2>
                <p className="text-sm text-gray-400">Download or view past reports</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Types</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="compliance">Compliance</option>
                <option value="performance">Performance</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    report.status === 'ready' ? 'bg-emerald-500/20' :
                    report.status === 'generating' ? 'bg-amber-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    {report.status === 'ready' ? (
                      <FileText className="w-5 h-5 text-emerald-400" />
                    ) : report.status === 'generating' ? (
                      <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{report.title}</h3>
                      {getReportTypeBadge(report.type)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{report.period}</span>
                      {report.status === 'ready' && (
                        <>
                          <span>-</span>
                          <span>{report.pages} pages</span>
                          <span>-</span>
                          <span>{report.size}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {report.status === 'ready' ? (
                    <>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Preview">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Email">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Print">
                        <Printer className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </>
                  ) : report.status === 'generating' ? (
                    <span className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm">
                      Generating...
                    </span>
                  ) : (
                    <span className="px-3 py-2 bg-gray-500/20 text-gray-400 rounded-lg text-sm">
                      {formatDate(report.generatedDate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Board Meeting History */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Board Meeting History</h2>
              <p className="text-sm text-gray-400">Past meetings and materials</p>
            </div>
          </div>

          <div className="space-y-4">
            {BOARD_MEETINGS.map((meeting, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${
                  meeting.status === 'upcoming'
                    ? 'bg-purple-500/10 border-purple-500/20'
                    : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      meeting.status === 'upcoming' ? 'bg-purple-500/20' : 'bg-gray-500/20'
                    }`}>
                      <Calendar className={`w-4 h-4 ${meeting.status === 'upcoming' ? 'text-purple-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{meeting.title}</h3>
                      <p className="text-xs text-gray-500">{formatDate(meeting.date)}</p>
                    </div>
                  </div>
                  {meeting.status === 'upcoming' ? (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                      Upcoming
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      Completed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">Materials:</span>
                  {meeting.materials.map((material, midx) => (
                    <button
                      key={midx}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors"
                    >
                      {material}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Report Generation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group text-left">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Generate Quarterly Report</h3>
            <p className="text-xs text-gray-400">Current quarter financial summary</p>
          </button>

          <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group text-left">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Generate Compliance Report</h3>
            <p className="text-xs text-gray-400">Spending policy adherence</p>
          </button>

          <button className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group text-left">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <PieChart className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-semibold text-white mb-1">Generate Fund Analysis</h3>
            <p className="text-xs text-gray-400">Individual fund performance</p>
          </button>
        </div>

        {/* Export Options */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Export Data</h2>
                <p className="text-sm text-gray-400">Download raw data for custom analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                <FileText className="w-4 h-4" />
                Export CSV
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                <FileText className="w-4 h-4" />
                Export Excel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm">
                <Share2 className="w-4 h-4" />
                API Access
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-400" />
                Email Report to Board
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipients (comma-separated emails)
                </label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="board@example.org, cfo@example.org"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Include Attachments
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" defaultChecked className="rounded bg-white/10 border-white/20" />
                    PDF Report
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" className="rounded bg-white/10 border-white/20" />
                    Excel Data
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={!emailRecipients || sendingEmail}
                className="px-6 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition flex items-center gap-2 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// REPORT PREVIEW CONTENT COMPONENT
// =============================================================================

function ReportPreviewContent({
  report,
  formatUSD
}: {
  report: GeneratedReport
  formatUSD: (amount: number, compact?: boolean) => string
}) {
  const { metadata } = report

  // Render based on report type
  const renderContent = () => {
    switch (metadata.type) {
      case 'quarterly_endowment_summary':
        return <QuarterlyEndowmentPreview report={report} formatUSD={formatUSD} />
      case 'fund_performance':
        return <FundPerformancePreview report={report} formatUSD={formatUSD} />
      case 'grant_activity':
        return <GrantActivityPreview report={report} formatUSD={formatUSD} />
      case 'compliance_fiduciary':
        return <CompliancePreview report={report} />
      case 'spending_policy_adherence':
        return <SpendingPolicyPreview report={report} formatUSD={formatUSD} />
      default:
        return <div className="text-gray-400">Preview not available for this report type</div>
    }
  }

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
        <h3 className="text-2xl font-bold text-white">{metadata.title}</h3>
        <p className="text-gray-400 mt-1">{metadata.description}</p>
        <p className="text-sm text-green-400 mt-3">
          Report Period: {new Date(metadata.dateRange.start).toLocaleDateString()} - {new Date(metadata.dateRange.end).toLocaleDateString()}
        </p>
      </div>

      {/* Report Content */}
      {renderContent()}
    </div>
  )
}

// Preview components for different report types
function QuarterlyEndowmentPreview({ report, formatUSD }: { report: any; formatUSD: (n: number, c?: boolean) => string }) {
  const { totalEndowmentValue, fundSummaryByType, keyMetrics, executiveSummary, fundBalances } = report

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {executiveSummary && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-green-400 mb-3">Executive Summary</h4>
          {executiveSummary.highlights?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Highlights</p>
              <ul className="space-y-1">
                {executiveSummary.highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {executiveSummary.concerns?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Areas of Concern</p>
              <ul className="space-y-1">
                {executiveSummary.concerns.map((c: string, i: number) => (
                  <li key={i} className="text-sm text-yellow-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Total Endowment Value */}
      {totalEndowmentValue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Current Value" value={formatUSD(totalEndowmentValue.current || 0)} icon={<DollarSign className="w-4 h-4" />} color="green" />
          <MetricCard label="Prior Period" value={formatUSD(totalEndowmentValue.prior || 0)} icon={<Clock className="w-4 h-4" />} color="gray" />
          <MetricCard label="Change" value={formatUSD(totalEndowmentValue.change || 0)} icon={<TrendingUp className="w-4 h-4" />} color={totalEndowmentValue.change >= 0 ? 'green' : 'red'} />
          <MetricCard label="Total Return" value={`${keyMetrics?.totalReturnPercent?.toFixed(2) || 0}%`} icon={<Percent className="w-4 h-4" />} color="blue" />
        </div>
      )}

      {/* Fund Summary */}
      {fundSummaryByType && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Fund Summary by Type</h4>
          <div className="space-y-3">
            <FundTypeBar label="Unrestricted" value={fundSummaryByType.unrestricted || 0} total={fundSummaryByType.total || 1} color="bg-green-500" formatUSD={formatUSD} />
            <FundTypeBar label="Temporarily Restricted" value={fundSummaryByType.temporarilyRestricted || 0} total={fundSummaryByType.total || 1} color="bg-blue-500" formatUSD={formatUSD} />
            <FundTypeBar label="Permanently Restricted" value={fundSummaryByType.permanentlyRestricted || 0} total={fundSummaryByType.total || 1} color="bg-purple-500" formatUSD={formatUSD} />
          </div>
        </div>
      )}

      {/* Fund Balances Table */}
      {fundBalances && fundBalances.length > 0 && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Fund Balances</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2">Fund Name</th>
                  <th className="text-right py-2">Protected</th>
                  <th className="text-right py-2">Credit Available</th>
                  <th className="text-right py-2">Total Value</th>
                  <th className="text-right py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {fundBalances.map((fund: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-white">{fund.fundName}</td>
                    <td className="py-2 text-right text-gray-400">{formatUSD(fund.protectedPrincipal)}</td>
                    <td className="py-2 text-right text-gray-400">{formatUSD(fund.creditLineAvailable)}</td>
                    <td className="py-2 text-right text-white">{formatUSD(fund.totalValue)}</td>
                    <td className={`py-2 text-right ${fund.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fund.changePercent >= 0 ? '+' : ''}{fund.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FundPerformancePreview({ report, formatUSD }: { report: any; formatUSD: (n: number, c?: boolean) => string }) {
  const { overallPerformance, assetAllocation } = report

  return (
    <div className="space-y-6">
      {overallPerformance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Return" value={`${overallPerformance.totalReturn?.toFixed(2) || 0}%`} icon={<TrendingUp className="w-4 h-4" />} color="green" />
          <MetricCard label="Benchmark" value={`${overallPerformance.benchmarkReturn?.toFixed(2) || 0}%`} icon={<BarChart3 className="w-4 h-4" />} color="gray" />
          <MetricCard label="Excess Return" value={`${overallPerformance.excessReturn?.toFixed(2) || 0}%`} icon={<Activity className="w-4 h-4" />} color={overallPerformance.excessReturn >= 0 ? 'green' : 'red'} />
          <MetricCard label="Sharpe Ratio" value={overallPerformance.sharpeRatio?.toFixed(2) || '0'} icon={<PieChart className="w-4 h-4" />} color="blue" />
        </div>
      )}

      {assetAllocation && assetAllocation.length > 0 && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Asset Allocation</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2">Asset Class</th>
                  <th className="text-right py-2">Target</th>
                  <th className="text-right py-2">Actual</th>
                  <th className="text-right py-2">Variance</th>
                  <th className="text-right py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {assetAllocation.map((aa: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-white">{aa.assetClass}</td>
                    <td className="py-2 text-right text-gray-400">{aa.targetPercent}%</td>
                    <td className="py-2 text-right text-white">{aa.actualPercent}%</td>
                    <td className={`py-2 text-right ${aa.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {aa.variance >= 0 ? '+' : ''}{aa.variance.toFixed(1)}%
                    </td>
                    <td className="py-2 text-right text-gray-400">{formatUSD(aa.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function GrantActivityPreview({ report, formatUSD }: { report: any; formatUSD: (n: number, c?: boolean) => string }) {
  const { executiveSummary, disbursements } = report

  return (
    <div className="space-y-6">
      {executiveSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Grants Approved" value={executiveSummary.totalGrantsApproved || 0} icon={<CheckCircle className="w-4 h-4" />} color="green" />
          <MetricCard label="Grants Disbursed" value={executiveSummary.totalGrantsDisbursed || 0} icon={<DollarSign className="w-4 h-4" />} color="blue" />
          <MetricCard label="Amount Approved" value={formatUSD(executiveSummary.totalAmountApproved || 0)} icon={<TrendingUp className="w-4 h-4" />} color="purple" />
          <MetricCard label="Amount Disbursed" value={formatUSD(executiveSummary.totalAmountDisbursed || 0)} icon={<Users className="w-4 h-4" />} color="green" />
        </div>
      )}

      {disbursements && disbursements.length > 0 && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Recent Disbursements</h4>
          <div className="space-y-3">
            {disbursements.slice(0, 5).map((g: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">{g.grantee}</p>
                  <p className="text-xs text-gray-400">{g.purpose}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-400">{formatUSD(g.amount)}</p>
                  <p className="text-xs text-gray-400">{g.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CompliancePreview({ report }: { report: any }) {
  const { executiveSummary, investmentPolicyCompliance } = report

  return (
    <div className="space-y-6">
      {executiveSummary && (
        <div className={`p-4 rounded-xl border ${
          executiveSummary.overallStatus === 'compliant'
            ? 'bg-green-500/10 border-green-500/30'
            : executiveSummary.overallStatus === 'attention_needed'
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {executiveSummary.overallStatus === 'compliant' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            )}
            <div>
              <p className="font-semibold text-white">
                Overall Status: {executiveSummary.overallStatus?.replace(/_/g, ' ').toUpperCase()}
              </p>
              <p className="text-sm text-gray-300">{executiveSummary.summary}</p>
            </div>
          </div>
        </div>
      )}

      {investmentPolicyCompliance && investmentPolicyCompliance.length > 0 && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Investment Policy Compliance</h4>
          <div className="space-y-3">
            {investmentPolicyCompliance.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-white">{m.metric}</p>
                  <p className="text-xs text-gray-400">Target: {m.target}% | Actual: {m.actual}%</p>
                </div>
                <span className={`px-3 py-1 text-xs rounded-full ${
                  m.status === 'compliant'
                    ? 'bg-green-500/20 text-green-400'
                    : m.status === 'warning'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {m.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SpendingPolicyPreview({ report, formatUSD }: { report: any; formatUSD: (n: number, c?: boolean) => string }) {
  const { executiveSummary, yearToDateSummary, quarterlyMetrics } = report

  return (
    <div className="space-y-6">
      {executiveSummary && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-2">{executiveSummary.policyType}</h4>
          <p className="text-sm text-gray-400">{executiveSummary.policyDescription}</p>
          <p className="text-sm text-gray-300 mt-2">{executiveSummary.summary}</p>
        </div>
      )}

      {yearToDateSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Policy Amount" value={formatUSD(yearToDateSummary.totalPolicyAmount || 0)} icon={<DollarSign className="w-4 h-4" />} color="gray" />
          <MetricCard label="Actual Amount" value={formatUSD(yearToDateSummary.totalActualAmount || 0)} icon={<DollarSign className="w-4 h-4" />} color="green" />
          <MetricCard label="Variance" value={formatUSD(yearToDateSummary.variance || 0)} icon={<TrendingUp className="w-4 h-4" />} color={yearToDateSummary.variance >= 0 ? 'red' : 'green'} />
          <MetricCard label="Variance %" value={`${yearToDateSummary.variancePercent?.toFixed(2) || 0}%`} icon={<Percent className="w-4 h-4" />} color={Math.abs(yearToDateSummary.variancePercent) < 5 ? 'green' : 'yellow'} />
        </div>
      )}

      {quarterlyMetrics && quarterlyMetrics.length > 0 && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <h4 className="font-semibold text-white mb-4">Quarterly Spending</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2">Quarter</th>
                  <th className="text-right py-2">Policy Rate</th>
                  <th className="text-right py-2">Actual Rate</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyMetrics.map((q: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-white">Q{q.quarter} {q.year}</td>
                    <td className="py-2 text-right text-gray-400">{q.policySpendingRate?.toFixed(3)}%</td>
                    <td className="py-2 text-right text-white">{q.actualSpendingRate?.toFixed(3)}%</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        q.status === 'within_policy'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {q.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Components
function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'green' | 'red' | 'blue' | 'purple' | 'gray' | 'yellow'
}) {
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gray: 'bg-white/10 text-gray-400 border-white/10',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function FundTypeBar({
  label,
  value,
  total,
  color,
  formatUSD,
}: {
  label: string
  value: number
  total: number
  color: string
  formatUSD: (n: number, c?: boolean) => string
}) {
  const percent = total > 0 ? (value / total) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm text-white">{formatUSD(value)} ({percent.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
