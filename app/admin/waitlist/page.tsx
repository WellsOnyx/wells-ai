'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

export default function WaitlistAdminPage() {
  const { isLoaded, user } = useUser()
  const [waitlist, setWaitlist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    priority: 0,
    approved: 0,
    waiting: 0
  })

  useEffect(() => {
    if (isLoaded && user) {
      fetchWaitlist()
    }
  }, [isLoaded, user])

  const fetchWaitlist = async () => {
    try {
      const response = await fetch('/api/waitlist/list')
      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setWaitlist(data.waitlist)

      // Calculate stats
      setStats({
        total: data.total,
        priority: data.waitlist.filter((w: any) => w.status === 'Priority').length,
        approved: data.waitlist.filter((w: any) => w.status === 'Approved').length,
        waiting: data.waitlist.filter((w: any) => w.status === 'Waiting').length
      })

      setLoading(false)
    } catch (error) {
      console.error('Error fetching waitlist:', error)
      setLoading(false)
    }
  }

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/early-access?invite=${code}`
    navigator.clipboard.writeText(link)
    alert('Invite link copied!')
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#183b6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#575757]">Loading waitlist...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[#575757] mb-4">Please sign in to view the waitlist</p>
          <Link href="/sign-in" className="text-[#dba63f] hover:text-[#c89430]">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#183b6d] text-white py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif mb-2">Waitlist Admin</h1>
              <p className="text-white/70">Manage early access signups</p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-sm transition"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#183b6d]/5 border-2 border-[#183b6d]/20 rounded-sm p-6">
            <div className="text-4xl font-bold text-[#183b6d] mb-2">{stats.total}</div>
            <div className="text-sm text-[#575757]">Total Signups</div>
          </div>
          <div className="bg-[#dba63f]/5 border-2 border-[#dba63f]/20 rounded-sm p-6">
            <div className="text-4xl font-bold text-[#dba63f] mb-2">{stats.priority}</div>
            <div className="text-sm text-[#575757]">Priority (invited)</div>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-sm p-6">
            <div className="text-4xl font-bold text-green-700 mb-2">{stats.approved}</div>
            <div className="text-sm text-[#575757]">Approved</div>
          </div>
          <div className="bg-gray-50 border-2 border-gray-200 rounded-sm p-6">
            <div className="text-4xl font-bold text-gray-700 mb-2">{stats.waiting}</div>
            <div className="text-sm text-[#575757]">Waiting</div>
          </div>
        </div>

        {/* Waitlist Table */}
        <div className="bg-white border-2 border-[#9ea1a7]/20 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#183b6d] text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Position</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Invites</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#9ea1a7]/20">
                {waitlist.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-[#183b6d]/5 transition">
                    <td className="px-6 py-4 text-sm font-semibold text-[#183b6d]">
                      #{entry.position}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#575757]">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        entry.status === 'Priority' ? 'bg-[#dba63f]/20 text-[#dba63f]' :
                        entry.status === 'Approved' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#575757]">
                      {entry.invitesUsed} / 3 used
                    </td>
                    <td className="px-6 py-4 text-sm text-[#575757]">
                      {new Date(entry.joinedDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => copyInviteLink(entry.inviteCode)}
                        className="text-[#dba63f] hover:text-[#c89430] text-sm font-medium"
                      >
                        Copy Invite
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {waitlist.length === 0 && (
            <div className="py-12 text-center text-[#575757]">
              No signups yet. Share the early access page!
            </div>
          )}
        </div>

        {/* Export */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => {
              const csv = [
                ['Position', 'Email', 'Status', 'Invites Used', 'Invite Code', 'Joined Date'],
                ...waitlist.map(e => [
                  e.position,
                  e.email,
                  e.status,
                  e.invitesUsed,
                  e.inviteCode,
                  new Date(e.joinedDate).toLocaleDateString()
                ])
              ].map(row => row.join(',')).join('\n')

              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `waitlist-${new Date().toISOString().split('T')[0]}.csv`
              a.click()
            }}
            className="px-6 py-3 bg-[#183b6d] text-white font-medium rounded-sm hover:bg-[#0d2545] transition"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
