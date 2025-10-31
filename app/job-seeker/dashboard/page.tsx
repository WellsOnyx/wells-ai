'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface JobMatch {
  rfq: any
  compatibilityScore: number
  matchReasons: string[]
  missingRequirements: string[]
  recommendations: string[]
}

export default function JobSeekerDashboard() {
  const router = useRouter()
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [matches, setMatches] = useState<JobMatch[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      // Load profile
      const profileRes = await fetch('/api/job-seeker/profile')
      const profileData = await profileRes.json()

      if (!profileData.success) {
        // Redirect to onboarding if no profile
        router.push('/job-seeker/onboarding')
        return
      }

      setProfile(profileData.profile)

      // Load job matches
      const matchRes = await fetch('/api/job-seeker/match')
      const matchData = await matchRes.json()

      if (matchData.success) {
        setMatches(matchData.matches)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-600/20 border-green-500'
    if (score >= 60) return 'bg-yellow-600/20 border-yellow-500'
    return 'bg-orange-600/20 border-orange-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/job-seeker/onboarding')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Complete Onboarding
          </button>
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
            <h1 className="text-4xl font-bold mb-2">Welcome back, {profile?.name}!</h1>
            <p className="text-blue-200">{profile?.desiredRole}</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/job-seeker/applications"
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
            >
              My Applications
            </Link>
            <Link
              href="/job-seeker/onboarding"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Profile Summary */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-blue-200 mb-1">Current Role</p>
              <p className="font-semibold">{profile?.currentRole}</p>
            </div>
            <div>
              <p className="text-sm text-blue-200 mb-1">Location</p>
              <p className="font-semibold">{profile?.location}</p>
            </div>
            <div>
              <p className="text-sm text-blue-200 mb-1">Skills</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile?.skills?.slice(0, 5).map((skill: string) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-blue-600/20 border border-blue-500 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
                {profile?.skills?.length > 5 && (
                  <span className="px-3 py-1 bg-slate-700 rounded-full text-sm">
                    +{profile.skills.length - 5} more
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-blue-200 mb-1">Preferences</p>
              <div className="space-y-1">
                {profile?.preferences?.remotePreferred && (
                  <p className="text-sm">✓ Remote work preferred</p>
                )}
                {profile?.preferences?.willingToRelocate && (
                  <p className="text-sm">✓ Willing to relocate</p>
                )}
                {profile?.preferences?.salaryExpectation && (
                  <p className="text-sm">💰 ${profile.preferences.salaryExpectation.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Job Matches</p>
            <p className="text-4xl font-bold">{matches.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">High Match (80+)</p>
            <p className="text-4xl font-bold text-green-400">
              {matches.filter(m => m.compatibilityScore >= 80).length}
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <p className="text-sm text-blue-200 mb-2">Applications</p>
            <p className="text-4xl font-bold">0</p>
            <p className="text-xs text-slate-400 mt-1">View in Applications tab</p>
          </div>
        </div>

        {/* Matched Jobs */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Matched Opportunities</h2>

          {matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No job matches found yet</p>
              <p className="text-sm text-slate-500">
                We're constantly searching for opportunities that match your profile.
                Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {matches.map((match) => (
                <div
                  key={match.rfq.id}
                  className="border border-slate-700 rounded-lg p-6 hover:border-blue-500 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{match.rfq.productName}</h3>
                      <p className="text-blue-200 mb-2">{match.rfq.company}</p>
                      <p className="text-sm text-slate-400">{match.rfq.category}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${getScoreBg(match.compatibilityScore)}`}>
                      <p className="text-sm text-slate-300">Match Score</p>
                      <p className={`text-2xl font-bold ${getScoreColor(match.compatibilityScore)}`}>
                        {match.compatibilityScore}%
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2">Requirements:</p>
                    <p className="text-sm text-slate-300">{match.rfq.specifications}</p>
                  </div>

                  {match.matchReasons.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2 text-green-400">Why You're a Match:</p>
                      <ul className="space-y-1">
                        {match.matchReasons.map((reason, idx) => (
                          <li key={idx} className="text-sm text-slate-300">✓ {reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {match.recommendations.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2 text-blue-400">AI Recommendations:</p>
                      <ul className="space-y-1">
                        {match.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-slate-300">💡 {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <Link
                      href={`/job-seeker/apply?rfqId=${match.rfq.id}`}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-center transition"
                    >
                      Apply Now
                    </Link>
                    <button
                      className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                    >
                      Learn More
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
