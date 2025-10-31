'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function JobSeekerOnboarding() {
  const router = useRouter()
  const { user } = useUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  // Form state
  const [formData, setFormData] = useState({
    name: user?.fullName || '',
    email: user?.emailAddresses?.[0]?.emailAddress || '',
    phone: '',
    currentRole: '',
    desiredRole: '',
    skills: [] as string[],
    experience: '',
    location: '',
    resumeText: '',
    careerGoals: '',
    preferences: {
      remotePreferred: false,
      willingToRelocate: false,
      salaryExpectation: undefined,
      availabilityDate: ''
    }
  })

  const [skillInput, setSkillInput] = useState('')
  const [parseLoading, setParseLoading] = useState(false)

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()]
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skill)
    })
  }

  const handleParseResume = async () => {
    if (!formData.resumeText) {
      setError('Please paste your resume text first')
      return
    }

    setParseLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/job-seeker/resume-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: formData.resumeText })
      })

      const data = await response.json()

      if (data.success) {
        // Auto-fill form with parsed data
        setFormData({
          ...formData,
          name: data.parsed.name || formData.name,
          email: data.parsed.email || formData.email,
          phone: data.parsed.phone || formData.phone,
          currentRole: data.parsed.currentRole || formData.currentRole,
          skills: data.parsed.skills.length > 0 ? data.parsed.skills : formData.skills,
          experience: data.parsed.experience || formData.experience
        })
        alert(`Resume parsed successfully! ATS Score: ${data.parsed.atsScore}/100`)
      } else {
        setError(data.error || 'Failed to parse resume')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse resume')
    } finally {
      setParseLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate required fields
    if (!formData.name || !formData.email || !formData.currentRole ||
        !formData.desiredRole || formData.skills.length === 0 ||
        !formData.experience || !formData.location) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/job-seeker/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        router.push('/job-seeker/dashboard')
      } else {
        setError(data.error || 'Failed to create profile')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Job Seeker Onboarding</h1>
          <p className="text-blue-200">Create your profile and find your next opportunity</p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Step {step} of 4</span>
            <span className="text-sm">{Math.round((step / 4) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-4">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone (optional)</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Location *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="San Francisco, CA"
                  required
                />
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
              >
                Next: Career Details
              </button>
            </div>
          )}

          {/* Step 2: Career Details */}
          {step === 2 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-4">Career Details</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Current Role *</label>
                <input
                  type="text"
                  value={formData.currentRole}
                  onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Senior Software Engineer"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Desired Role *</label>
                <input
                  type="text"
                  value={formData.desiredRole}
                  onChange={(e) => setFormData({ ...formData, desiredRole: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VP of Engineering"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Skills * (add at least one)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a skill (e.g., Python, Leadership, AWS)"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-blue-600/20 border border-blue-500 rounded-full text-sm flex items-center gap-2"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Experience Summary *</label>
                <textarea
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                  placeholder="Brief summary of your work experience, achievements, and expertise..."
                  required
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                >
                  Next: Resume Upload
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Resume Upload */}
          {step === 3 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-4">Resume Upload (Optional)</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Paste Your Resume</label>
                <textarea
                  value={formData.resumeText}
                  onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-64 font-mono text-sm"
                  placeholder="Paste your resume text here for AI analysis..."
                />
              </div>

              {formData.resumeText && (
                <button
                  type="button"
                  onClick={handleParseResume}
                  disabled={parseLoading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded-lg font-semibold transition"
                >
                  {parseLoading ? 'Parsing with AI...' : 'Parse Resume with AI'}
                </button>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                >
                  Next: Preferences
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Preferences */}
          {step === 4 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-4">Job Preferences</h2>

              <div>
                <label className="block text-sm font-medium mb-2">Career Goals</label>
                <textarea
                  value={formData.careerGoals}
                  onChange={(e) => setFormData({ ...formData, careerGoals: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="What are you looking for in your next role?"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.preferences.remotePreferred}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, remotePreferred: e.target.checked }
                    })}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                  />
                  <span>Prefer remote work</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.preferences.willingToRelocate}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, willingToRelocate: e.target.checked }
                    })}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                  />
                  <span>Willing to relocate</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Salary Expectation (USD)</label>
                <input
                  type="number"
                  value={formData.preferences.salaryExpectation || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, salaryExpectation: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="150000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Available Start Date</label>
                <input
                  type="date"
                  value={formData.preferences.availabilityDate}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, availabilityDate: e.target.value }
                  })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg font-semibold transition"
                >
                  {loading ? 'Creating Profile...' : 'Complete Onboarding'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
