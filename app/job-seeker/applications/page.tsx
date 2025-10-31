'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Application {
  id: string
  rfqId: string
  jobSeekerName: string
  currentRole: string
  desiredRole: string
  coverLetter?: string
  appliedDate: string
  status: string
}

export default function JobApplications() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      const response = await fetch('/api/job-seeker/apply')
      const data = await response.json()

      if (data.success) {
        setApplications(data.applications)
      } else {
        setError(data.error || 'Failed to load applications')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-600/20 text-blue-400 border-blue-500'
      case 'Under Review':
        return 'bg-yellow-600/20 text-yellow-400 border-yellow-500'
      case 'Interview':
        return 'bg-purple-600/20 text-purple-400 border-purple-500'
      case 'Accepted':
        return 'bg-green-600/20 text-green-400 border-green-500'
      case 'Rejected':
        return 'bg-red-600/20 text-red-400 border-red-500'
      default:
        return 'bg-slate-600/20 text-slate-400 border-slate-500'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p>Loading applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Applications</h1>
            <p className="text-blue-200">Track your job applications</p>
          </div>
          <Link
            href="/job-seeker/dashboard"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Total Applications</p>
            <p className="text-4xl font-bold">{applications.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Submitted</p>
            <p className="text-4xl font-bold text-blue-400">
              {applications.filter(a => a.status === 'Submitted').length}
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Under Review</p>
            <p className="text-4xl font-bold text-yellow-400">
              {applications.filter(a => a.status === 'Under Review').length}
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Interviews</p>
            <p className="text-4xl font-bold text-purple-400">
              {applications.filter(a => a.status === 'Interview').length}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            {error}
          </div>
        )}

        {/* Applications List */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Applications</h2>

          {applications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No applications yet</p>
              <Link
                href="/job-seeker/dashboard"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
              >
                Browse Job Matches
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="border border-slate-700 rounded-lg p-6 hover:border-blue-500 transition cursor-pointer"
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{app.desiredRole}</h3>
                      <p className="text-sm text-slate-400">
                        Applied: {new Date(app.appliedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-4 py-2 rounded-lg border ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Current Role</p>
                      <p className="font-semibold">{app.currentRole}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Application ID</p>
                      <p className="font-mono text-xs">{app.id}</p>
                    </div>
                  </div>

                  {app.coverLetter && (
                    <div className="mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedApp(app)
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        View Cover Letter →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cover Letter Modal */}
        {selectedApp && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50"
            onClick={() => setSelectedApp(null)}
          >
            <div
              className="bg-slate-800 rounded-lg p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Application Details</h2>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-blue-200 mb-1">Position</p>
                  <p className="font-semibold text-lg">{selectedApp.desiredRole}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-200 mb-1">Status</p>
                  <span className={`inline-block px-4 py-2 rounded-lg border ${getStatusColor(selectedApp.status)}`}>
                    {selectedApp.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-blue-200 mb-1">Applied Date</p>
                  <p>{new Date(selectedApp.appliedDate).toLocaleString()}</p>
                </div>
              </div>

              {selectedApp.coverLetter && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Cover Letter</h3>
                  <div className="bg-slate-900/50 rounded-lg p-6 whitespace-pre-wrap">
                    {selectedApp.coverLetter}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
