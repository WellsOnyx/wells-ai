'use client'

import { useState, useEffect } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import Link from 'next/link'

/**
 * ATS/HRIS Settings Page
 *
 * Connect your ATS or HRIS to Wells AI:
 * - Greenhouse, Lever, Ashby, BambooHR, Workday, etc.
 * - Sync jobs and post to Wells AI
 * - Route applications to your ATS
 * - Sync employee data
 */

interface ATSConnection {
  accountToken: string
  integration: string
  isActive: boolean
  lastSyncAt?: string
}

export default function ATSSettingsPage() {
  const { user } = useUser()
  const { organization } = useOrganization()

  const [atsConnection, setAtsConnection] = useState<ATSConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [jobs, setJobs] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [showJobs, setShowJobs] = useState(false)
  const [showEmployees, setShowEmployees] = useState(false)

  // Check if ATS is already connected (from localStorage for demo)
  useEffect(() => {
    const savedConnection = localStorage.getItem('ats_connection')
    if (savedConnection) {
      try {
        setAtsConnection(JSON.parse(savedConnection))
      } catch (error) {
        console.error('Failed to load ATS connection:', error)
      }
    }
  }, [])

  const handleConnectATS = async () => {
    if (!user || !organization) return

    setIsConnecting(true)
    try {
      // Step 1: Generate Merge Link Token
      const response = await fetch('/api/ats/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: organization.name,
          email: user.primaryEmailAddress?.emailAddress,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate link token')
      }

      const { linkToken } = await response.json()

      // Step 2: Open Merge Link (in production, use Merge.dev Link SDK)
      alert(
        `Merge Link Token generated!\n\nIn production, this would open Merge Link for you to connect your ATS.\n\nToken: ${linkToken.substring(0, 20)}...`
      )

      // For demo purposes, simulate a connection
      const demoConnection: ATSConnection = {
        accountToken: 'demo_' + Math.random().toString(36).substring(7),
        integration: 'greenhouse',
        isActive: true,
        lastSyncAt: new Date().toISOString(),
      }

      setAtsConnection(demoConnection)
      localStorage.setItem('ats_connection', JSON.stringify(demoConnection))

      alert('ATS connected successfully! (Demo mode)')
    } catch (error: any) {
      console.error('Connect ATS error:', error)
      alert(`Failed to connect ATS: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnectATS = () => {
    const confirmed = confirm('Are you sure you want to disconnect your ATS?')
    if (!confirmed) return

    setAtsConnection(null)
    localStorage.removeItem('ats_connection')
    setJobs([])
    setEmployees([])
    setShowJobs(false)
    setShowEmployees(false)
  }

  const handleSyncJobs = async () => {
    if (!atsConnection) return

    setIsSyncing(true)
    setSyncStatus('Syncing jobs from ATS...')

    try {
      const response = await fetch('/api/ats/jobs?status=OPEN', {
        headers: {
          'X-Account-Token': atsConnection.accountToken,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sync jobs')
      }

      const { jobs } = await response.json()
      setJobs(jobs)
      setShowJobs(true)
      setSyncStatus(`Successfully synced ${jobs.length} open jobs`)

      // Update last sync time
      const updatedConnection = {
        ...atsConnection,
        lastSyncAt: new Date().toISOString(),
      }
      setAtsConnection(updatedConnection)
      localStorage.setItem('ats_connection', JSON.stringify(updatedConnection))
    } catch (error: any) {
      console.error('Sync jobs error:', error)
      setSyncStatus(`Failed to sync jobs: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncEmployees = async () => {
    if (!atsConnection) return

    setIsSyncing(true)
    setSyncStatus('Syncing employees from HRIS...')

    try {
      const response = await fetch('/api/ats/sync', {
        headers: {
          'X-Account-Token': atsConnection.accountToken,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to sync employees')
      }

      const { employees } = await response.json()
      setEmployees(employees)
      setShowEmployees(true)
      setSyncStatus(`Successfully synced ${employees.length} employees`)

      // Update last sync time
      const updatedConnection = {
        ...atsConnection,
        lastSyncAt: new Date().toISOString(),
      }
      setAtsConnection(updatedConnection)
      localStorage.setItem('ats_connection', JSON.stringify(updatedConnection))
    } catch (error: any) {
      console.error('Sync employees error:', error)
      setSyncStatus(`Failed to sync employees: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#9ea1a7]/20">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Link
            href="/settings"
            className="text-sm text-[#9ea1a7] hover:text-[#183b6d] mb-2 inline-block"
          >
            Back to Settings
          </Link>
          <h1 className="text-3xl font-serif text-[#183b6d]">ATS & HRIS Integration</h1>
          <p className="text-sm text-[#575757] mt-1">
            Connect your Applicant Tracking System or HR Information System
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-8">
          {/* Connection Status */}
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <h2 className="text-xl font-medium text-[#183b6d] mb-6">Connection Status</h2>

            {atsConnection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-medium text-green-900">Connected</div>
                      <div className="text-sm text-green-700">
                        {atsConnection.integration.charAt(0).toUpperCase() +
                          atsConnection.integration.slice(1)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectATS}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-sm transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-[#575757] mb-1">Account Token</div>
                    <code className="text-xs bg-gray-50 px-2 py-1 rounded">
                      {atsConnection.accountToken.substring(0, 20)}...
                    </code>
                  </div>
                  <div>
                    <div className="text-sm text-[#575757] mb-1">Last Sync</div>
                    <div className="text-sm text-[#183b6d]">
                      {atsConnection.lastSyncAt
                        ? new Date(atsConnection.lastSyncAt).toLocaleString()
                        : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-[#9ea1a7]/20 rounded-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <div className="text-[#575757]">Not Connected</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-[#575757]">
                    Connect your ATS or HRIS to enable:
                  </p>
                  <ul className="text-sm text-[#575757] space-y-2 ml-4">
                    <li>Post jobs from your ATS to Wells AI</li>
                    <li>Route applications from Wells AI to your ATS</li>
                    <li>Sync employee data for internal recruiting</li>
                    <li>Two-way sync for seamless hiring workflow</li>
                  </ul>
                </div>

                <button
                  onClick={handleConnectATS}
                  disabled={isConnecting}
                  className="px-6 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545] transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect ATS/HRIS'}
                </button>
              </div>
            )}
          </div>

          {/* Supported Systems */}
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <h2 className="text-xl font-medium text-[#183b6d] mb-6">Supported Systems</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[#575757]">
                  Applicant Tracking Systems
                </h3>
                <ul className="text-sm text-[#575757] space-y-1">
                  <li>Greenhouse</li>
                  <li>Lever</li>
                  <li>Ashby</li>
                  <li>JazzHR</li>
                  <li>iCIMS</li>
                  <li>SmartRecruiters</li>
                  <li>Jobvite</li>
                  <li>Bullhorn</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[#575757]">HR Information Systems</h3>
                <ul className="text-sm text-[#575757] space-y-1">
                  <li>BambooHR</li>
                  <li>Workday</li>
                  <li>SAP SuccessFactors</li>
                  <li>ADP Workforce Now</li>
                  <li>Namely</li>
                  <li>Gusto</li>
                  <li>Rippling</li>
                  <li>Zenefits</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[#575757]">And More</h3>
                <div className="text-sm text-[#575757]">
                  <p className="mb-2">50+ integrations via Merge.dev</p>
                  <p className="text-xs">
                    Don't see your system? Contact us and we'll add it.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          {atsConnection && (
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">Sync Data</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-[#9ea1a7]/20 rounded-sm">
                  <div>
                    <h3 className="font-medium text-[#183b6d]">Sync Open Jobs</h3>
                    <p className="text-sm text-[#575757] mt-1">
                      Pull open positions from your ATS to post on Wells AI
                    </p>
                  </div>
                  <button
                    onClick={handleSyncJobs}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89430] transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Jobs'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-[#9ea1a7]/20 rounded-sm">
                  <div>
                    <h3 className="font-medium text-[#183b6d]">Sync Employees</h3>
                    <p className="text-sm text-[#575757] mt-1">
                      Pull employee data from your HRIS for internal recruiting
                    </p>
                  </div>
                  <button
                    onClick={handleSyncEmployees}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89430] transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Employees'}
                  </button>
                </div>

                {syncStatus && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm text-sm text-blue-900">
                    {syncStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Synced Jobs */}
          {showJobs && jobs.length > 0 && (
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">
                Synced Jobs ({jobs.length})
              </h2>

              <div className="space-y-3">
                {jobs.map((job, index) => (
                  <div
                    key={job.id || index}
                    className="p-4 border border-[#9ea1a7]/20 rounded-sm"
                  >
                    <h3 className="font-medium text-[#183b6d]">{job.name}</h3>
                    <div className="text-sm text-[#575757] mt-1">
                      {job.code && <span className="mr-3">Code: {job.code}</span>}
                      {job.status && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          {job.status}
                        </span>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-sm text-[#575757] mt-2 line-clamp-2">
                        {job.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synced Employees */}
          {showEmployees && employees.length > 0 && (
            <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
              <h2 className="text-xl font-medium text-[#183b6d] mb-6">
                Synced Employees ({employees.length})
              </h2>

              <div className="space-y-3">
                {employees.map((employee, index) => (
                  <div
                    key={employee.id || index}
                    className="p-4 border border-[#9ea1a7]/20 rounded-sm"
                  >
                    <h3 className="font-medium text-[#183b6d]">
                      {employee.display_full_name ||
                        `${employee.first_name} ${employee.last_name}`}
                    </h3>
                    <div className="text-sm text-[#575757] mt-1">
                      {employee.employments?.[0]?.job_title && (
                        <span className="mr-3">{employee.employments[0].job_title}</span>
                      )}
                      {employee.work_email && <span>{employee.work_email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="bg-white rounded-sm border border-[#9ea1a7]/20 p-6">
            <h2 className="text-xl font-medium text-[#183b6d] mb-6">How It Works</h2>

            <div className="space-y-4 text-sm text-[#575757]">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[#183b6d] text-white rounded-full flex items-center justify-center font-medium">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-[#183b6d] mb-1">Connect Your System</h3>
                  <p>
                    Click "Connect ATS/HRIS" and authenticate with your system through
                    Merge.dev's secure OAuth flow.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[#183b6d] text-white rounded-full flex items-center justify-center font-medium">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-[#183b6d] mb-1">Sync Your Data</h3>
                  <p>
                    Pull jobs from your ATS or employees from your HRIS with one click. Data
                    syncs in real-time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[#183b6d] text-white rounded-full flex items-center justify-center font-medium">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-[#183b6d] mb-1">Two-Way Sync</h3>
                  <p>
                    Applications from Wells AI automatically flow into your ATS. No manual
                    data entry required.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[#183b6d] text-white rounded-full flex items-center justify-center font-medium">
                  4
                </div>
                <div>
                  <h3 className="font-medium text-[#183b6d] mb-1">Stay In Sync</h3>
                  <p>
                    Wells AI monitors your ATS for changes and keeps everything up to date
                    automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
