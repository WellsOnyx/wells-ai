'use client'

/**
 * Grain & Vault - Student Account Management
 * Per-student fund tracking for ESAs and SFOs
 *
 * Features:
 * - List of student accounts
 * - Per-student balance
 * - Disbursement history
 * - Eligible expenses tracking
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Users,
  Search,
  Filter,
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  DollarSign,
  Calendar,
  GraduationCap,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Bell,
  Settings,
  Building2,
  Receipt,
  Shield,
  BookOpen
} from 'lucide-react'
import {
  generateMockStudents,
  generateMockDisbursements,
  EXPENSE_CATEGORY_LABELS,
  type StudentAccount,
  type Disbursement,
  type ExpenseCategory
} from '@/lib/grain/education-funds'

export default function StudentsPage() {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentAccount[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedStudent, setSelectedStudent] = useState<StudentAccount | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 10

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      setStudents(generateMockStudents(50))
      setDisbursements(generateMockDisbursements(100))
      setLoading(false)
    }
    loadData()
  }, [])

  // Filter and search students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = searchQuery === '' ||
        student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && student.status === 'active') ||
        (statusFilter === 'inactive' && student.status !== 'active')

      return matchesSearch && matchesStatus
    })
  }, [students, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / perPage)
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * perPage, currentPage * perPage)

  // Get disbursements for selected student
  const studentDisbursements = useMemo(() => {
    if (!selectedStudent) return []
    return disbursements.filter(d => d.studentAccountId === selectedStudent.id)
  }, [selectedStudent, disbursements])

  // Summary stats
  const stats = useMemo(() => {
    const active = students.filter(s => s.status === 'active').length
    const totalAllocated = students.reduce((sum, s) => sum + s.allocatedAmount, 0)
    const totalDisbursed = students.reduce((sum, s) => sum + s.totalDisbursed, 0)
    const totalAvailable = students.reduce((sum, s) => sum + s.availableBalance, 0)
    return { active, totalAllocated, totalDisbursed, totalAvailable }
  }, [students])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading student accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href="/grain-vault" className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-sm" />
                </div>
                <div>
                  <span className="text-lg font-semibold tracking-tight">Grain & Vault</span>
                  <span className="text-emerald-400 text-sm ml-2">Education</span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-1 ml-8">
                <Link href="/grain-vault/education/dashboard" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Dashboard
                </Link>
                <Link href="/grain-vault/education/students" className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                  Students
                </Link>
                <Link href="/grain-vault/education/vendors" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Vendors
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Link href="/grain-vault/education/dashboard" className="hover:text-white">Dashboard</Link>
              <ChevronRight className="w-4 h-4" />
              <span>Student Accounts</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Student Accounts</h1>
                <p className="text-gray-400 mt-1">Manage student fund allocations and disbursements</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Student
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Students</span>
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold">{students.length}</div>
              <div className="text-sm text-emerald-400">{stats.active} active</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Allocated</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold">${(stats.totalAllocated / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400">across all students</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Total Disbursed</span>
                <Receipt className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold">${(stats.totalDisbursed / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400">to approved vendors</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Available Balance</span>
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold">${(stats.totalAvailable / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400">ready for disbursement</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Student List */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Student</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Grade</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Allocated</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Available</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {paginatedStudents.map((student) => (
                      <tr
                        key={student.id}
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${
                          selectedStudent?.id === student.id ? 'bg-emerald-500/10' : ''
                        }`}
                        onClick={() => setSelectedStudent(student)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/30 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {student.firstName[0]}{student.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{student.firstName} {student.lastName}</div>
                              <div className="text-xs text-gray-400">{student.studentId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{student.gradeLevel}</td>
                        <td className="px-4 py-3 text-right font-medium">${student.allocatedAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={student.availableBalance > 0 ? 'text-emerald-400' : 'text-gray-400'}>
                            ${student.availableBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            student.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            student.status === 'inactive' ? 'bg-gray-500/20 text-gray-400' :
                            student.status === 'graduated' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1 hover:bg-white/10 rounded transition-colors">
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <div className="text-sm text-gray-400">
                    Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filteredStudents.length)} of {filteredStudents.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Detail Panel */}
            <div>
              {selectedStudent ? (
                <div className="bg-white/5 border border-white/10 rounded-xl">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/30 flex items-center justify-center">
                        <span className="text-xl font-medium">
                          {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                        <div className="text-sm text-gray-400">{selectedStudent.studentId}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selectedStudent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {selectedStudent.status}
                      </span>
                      <span className="text-sm text-gray-400">Grade {selectedStudent.gradeLevel}</span>
                      <span className="text-sm text-gray-400">{selectedStudent.schoolYear}</span>
                    </div>
                  </div>

                  {/* Balance Overview */}
                  <div className="p-6 border-b border-white/10">
                    <h4 className="text-sm font-medium text-gray-400 mb-4">Fund Balance</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Allocated</span>
                        <span className="font-medium">${selectedStudent.allocatedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disbursed</span>
                        <span className="font-medium text-purple-400">-${selectedStudent.totalDisbursed.toLocaleString()}</span>
                      </div>
                      {selectedStudent.pendingDisbursements > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pending</span>
                          <span className="font-medium text-amber-400">-${selectedStudent.pendingDisbursements.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t border-white/10 flex justify-between">
                        <span className="font-medium">Available</span>
                        <span className="font-bold text-emerald-400">${selectedStudent.availableBalance.toLocaleString()}</span>
                      </div>
                    </div>
                    <button className="mt-4 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-medium transition-colors">
                      New Disbursement
                    </button>
                  </div>

                  {/* Eligible Categories */}
                  <div className="p-6 border-b border-white/10">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Eligible Expense Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedStudent.eligibleCategories.slice(0, 6).map((cat) => (
                        <span key={cat} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">
                          {EXPENSE_CATEGORY_LABELS[cat]}
                        </span>
                      ))}
                      {selectedStudent.eligibleCategories.length > 6 && (
                        <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                          +{selectedStudent.eligibleCategories.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recent Disbursements */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Disbursements</h4>
                    {studentDisbursements.length > 0 ? (
                      <div className="space-y-3">
                        {studentDisbursements.slice(0, 3).map((d) => (
                          <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <div>
                              <div className="text-sm font-medium">{EXPENSE_CATEGORY_LABELS[d.category]}</div>
                              <div className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">${d.amount}</div>
                              <div className={`text-xs ${
                                d.status === 'completed' ? 'text-emerald-400' :
                                d.status === 'pending_approval' ? 'text-amber-400' :
                                'text-gray-400'
                              }`}>
                                {d.status}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No disbursements yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Student</h3>
                  <p className="text-sm text-gray-400">
                    Click on a student to view their account details and disbursement history.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
