'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Briefcase, MapPin, DollarSign, Calendar, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react'

interface Application {
  id: string
  jobId: string
  jobTitle: string
  company: string
  location: string
  salary: { min: number; max: number; currency: string }
  status: 'pending' | 'reviewing' | 'interview' | 'offer' | 'rejected'
  appliedAt: string
  lastUpdate?: string
  nextStep?: string
}

interface ApplicationStats {
  total: number
  pending: number
  interviews: number
  offers: number
  responseRate: number
}

export default function ApplicationsDashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    pending: 0,
    interviews: 0,
    offers: 0,
    responseRate: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    } else if (user) {
      loadApplications()
    }
  }, [isLoaded, user])

  async function loadApplications() {
    try {
      const response = await fetch('/api/applications/list')
      if (!response.ok) throw new Error('Failed to load applications')

      const data = await response.json()
      setApplications(data.applications || [])

      // Calculate stats
      const total = data.applications?.length || 0
      const pending = data.applications?.filter((a: Application) => a.status === 'pending').length || 0
      const interviews = data.applications?.filter((a: Application) => a.status === 'interview').length || 0
      const offers = data.applications?.filter((a: Application) => a.status === 'offer').length || 0
      const responded = data.applications?.filter((a: Application) => a.status !== 'pending').length || 0
      const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

      setStats({ total, pending, interviews, offers, responseRate })
    } catch (error) {
      console.error('Failed to load applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'reviewing': return 'bg-blue-500/20 text-blue-400'
      case 'interview': return 'bg-purple-500/20 text-purple-400'
      case 'offer': return 'bg-green-500/20 text-green-400'
      case 'rejected': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'interview': return <Calendar className="w-4 h-4" />
      case 'offer': return <CheckCircle className="w-4 h-4" />
      case 'rejected': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Application Tracker</h1>
              <p className="text-gray-400 mt-1">Monitor your job search progress</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
            >
              Find More Jobs
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Briefcase className="w-8 h-8 text-amber-500" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <div className="text-gray-400 text-sm">Total Applied</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
            <div className="text-gray-400 text-sm">Pending</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold">{stats.interviews}</span>
            </div>
            <div className="text-gray-400 text-sm">Interviews</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold">{stats.offers}</span>
            </div>
            <div className="text-gray-400 text-sm">Offers</div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">{stats.responseRate}%</span>
            </div>
            <div className="text-gray-400 text-sm">Response Rate</div>
          </div>
        </div>

        {/* Applications List */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold">Your Applications</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No applications yet</h3>
              <p className="text-gray-400 mb-6">Let Wells find and apply to jobs for you</p>
              <button
                onClick={() => router.push('/app')}
                className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
              >
                Start Job Search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {applications.map((app) => (
                <div key={app.id} className="p-6 hover:bg-gray-800/50 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{app.jobTitle}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                        <span className="font-medium">{app.company}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {app.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${app.salary.min.toLocaleString()}-${app.salary.max.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      {app.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Applied {new Date(app.appliedAt).toLocaleDateString()}
                      </span>
                      {app.lastUpdate && (
                        <span>Updated {new Date(app.lastUpdate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {app.nextStep && (
                      <span className="text-amber-500 font-medium">{app.nextStep}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-gradient-to-br from-amber-900/20 to-amber-800/20 rounded-xl p-8 border border-amber-700/30">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            Tips to Increase Your Success Rate
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Optimize Your Resume</h4>
              <p className="text-sm text-gray-400">Ask Wells to optimize your resume for ATS and specific roles</p>
              <button className="mt-2 text-amber-500 text-sm font-semibold hover:text-amber-400">
                Optimize Now →
              </button>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Prep for Interviews</h4>
              <p className="text-sm text-gray-400">Get company research and practice questions from Wells</p>
              <button className="mt-2 text-amber-500 text-sm font-semibold hover:text-amber-400">
                Start Prep →
              </button>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Follow Up</h4>
              <p className="text-sm text-gray-400">Wells can draft and send follow-up emails automatically</p>
              <button className="mt-2 text-amber-500 text-sm font-semibold hover:text-amber-400">
                Set Up →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
