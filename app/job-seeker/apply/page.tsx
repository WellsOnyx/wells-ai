'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

function ApplyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const rfqId = searchParams.get('rfqId')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [rfq, setRfq] = useState<any>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)

  useEffect(() => {
    if (rfqId) {
      loadData()
    }
  }, [rfqId])

  const loadData = async () => {
    try {
      // Load profile
      const profileRes = await fetch('/api/job-seeker/profile')
      const profileData = await profileRes.json()

      if (!profileData.success) {
        router.push('/job-seeker/onboarding')
        return
      }

      setProfile(profileData.profile)

      // Load RFQ details
      const rfqRes = await fetch(`/api/rfqs?id=${rfqId}`)
      const rfqData = await rfqRes.json()

      if (rfqData.success) {
        setRfq(rfqData.rfq)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const generateCoverLetter = async () => {
    if (!profile || !rfq) return

    setGeneratingCoverLetter(true)
    setError(null)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Write a professional cover letter for this job application:

JOB SEEKER PROFILE:
Name: ${profile.name}
Current Role: ${profile.currentRole}
Skills: ${profile.skills.join(', ')}
Experience: ${profile.experience}

JOB OPPORTUNITY:
Company: ${rfq.company}
Position: ${rfq.productName}
Requirements: ${rfq.specifications}

Write a concise, compelling cover letter (250-350 words).`
            }
          ],
          system: 'You are an expert career coach. Write professional, personalized cover letters.'
        })
      })

      const data = await response.json()
      const letter = data.content?.[0]?.text

      if (letter) {
        setCoverLetter(letter)
      } else {
        setError('Failed to generate cover letter')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate cover letter')
    } finally {
      setGeneratingCoverLetter(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/job-seeker/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId,
          jobSeekerId: user?.id,
          coverLetter: coverLetter || undefined,
          customMessage: customMessage || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Application submitted successfully!')
        router.push('/job-seeker/applications')
      } else {
        setError(data.error || 'Failed to submit application')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p>Loading application...</p>
        </div>
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Job not found</p>
          <button
            onClick={() => router.push('/job-seeker/dashboard')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Apply for Position</h1>
          <p className="text-blue-200">Complete your application</p>
        </div>

        {/* Job Details */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">{rfq.productName}</h2>
          <p className="text-blue-200 mb-4">{rfq.company}</p>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-slate-400">Category</p>
              <p>{rfq.category}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Requirements</p>
              <p>{rfq.specifications}</p>
            </div>
            {rfq.timeline && (
              <div>
                <p className="text-sm text-slate-400">Timeline</p>
                <p>{rfq.timeline}</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            {error}
          </div>
        )}

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Your Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">Name</p>
                <p className="font-semibold">{profile?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Email</p>
                <p className="font-semibold">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Current Role</p>
                <p className="font-semibold">{profile?.currentRole}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Location</p>
                <p className="font-semibold">{profile?.location}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Cover Letter</h3>
              <button
                type="button"
                onClick={generateCoverLetter}
                disabled={generatingCoverLetter}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded-lg font-semibold transition text-sm"
              >
                {generatingCoverLetter ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-64"
              placeholder="Write or generate a cover letter..."
            />
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Additional Message (Optional)</h3>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
              placeholder="Any additional information you'd like to share..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/job-seeker/dashboard')}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg font-semibold transition"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    }>
      <ApplyContent />
    </Suspense>
  )
}
