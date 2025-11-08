'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Sparkles, CheckCircle, AlertCircle, TrendingUp, Zap, Download, Copy } from 'lucide-react'

interface OptimizationResult {
  score: number
  issues: Issue[]
  improvements: Improvement[]
  keywords: string[]
  optimizedResume?: string
}

interface Issue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  fix: string
}

interface Improvement {
  section: string
  before: string
  after: string
  impact: string
}

export default function ResumeOptimizer() {
  const router = useRouter()
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [optimizing, setOptimizing] = useState(false)
  const [result, setResult] = useState<OptimizationResult | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setResumeText(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const optimizeResume = async () => {
    setOptimizing(true)

    // Simulate API call
    setTimeout(() => {
      setResult({
        score: 78,
        issues: [
          {
            severity: 'critical',
            category: 'ATS Compatibility',
            description: 'Complex formatting detected that may not parse correctly',
            fix: 'Use simple, single-column layout with standard fonts'
          },
          {
            severity: 'warning',
            category: 'Keywords',
            description: 'Missing 8 key skills from job description',
            fix: 'Add: Python, AWS, Docker, Kubernetes, CI/CD, Microservices, REST APIs, PostgreSQL'
          },
          {
            severity: 'warning',
            category: 'Impact',
            description: '60% of bullets lack quantifiable achievements',
            fix: 'Add metrics: revenue impact, time saved, efficiency gains, team size'
          },
          {
            severity: 'info',
            category: 'Length',
            description: 'Resume is 2.5 pages - ideal is 1-2 pages',
            fix: 'Remove outdated experience or condense older roles'
          }
        ],
        improvements: [
          {
            section: 'Work Experience',
            before: 'Responsible for backend development',
            after: 'Led backend development for payment processing system handling $2M+ monthly transactions, reducing API latency by 40% through Redis caching and query optimization',
            impact: '+35% relevance score'
          },
          {
            section: 'Skills',
            before: 'Python, JavaScript, Databases',
            after: 'Python (Django, FastAPI), JavaScript (React, Node.js), PostgreSQL, MongoDB, Redis, AWS (EC2, S3, Lambda), Docker, Kubernetes',
            impact: '+25% keyword match'
          },
          {
            section: 'Work Experience',
            before: 'Built new features for the platform',
            after: 'Architected and delivered 12+ customer-facing features increasing user engagement by 28%, including real-time notifications system serving 50K+ daily active users',
            impact: '+40% impact score'
          }
        ],
        keywords: ['Python', 'AWS', 'Docker', 'Kubernetes', 'Microservices', 'REST APIs', 'PostgreSQL', 'CI/CD'],
        optimizedResume: '# OPTIMIZED RESUME\n\nYour optimized resume with ATS-friendly formatting and enhanced content...'
      })
      setOptimizing(false)
    }, 2000)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'info': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4" />
      case 'warning': return <AlertCircle className="w-4 h-4" />
      case 'info': return <CheckCircle className="w-4 h-4" />
      default: return <CheckCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="w-8 h-8 text-amber-500" />
                AI Resume Optimizer
              </h1>
              <p className="text-gray-400 mt-1">Beat ATS systems and land more interviews</p>
            </div>
            <button
              onClick={() => router.push('/app')}
              className="px-6 py-3 bg-amber-500 text-black rounded-full font-semibold hover:bg-amber-400 transition"
            >
              Chat with Wells
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Your Resume</h2>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Upload or paste your resume
                </label>
                <div className="flex gap-3 mb-3">
                  <label className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload File
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here..."
                  className="w-full h-64 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm"
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Job Description (Optional)</h2>

              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description to optimize for specific role..."
                className="w-full h-48 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none text-sm"
              />

              <p className="text-xs text-gray-500 mt-2">
                Adding a job description helps Wells optimize your resume for specific keywords and requirements
              </p>
            </div>

            <button
              onClick={optimizeResume}
              disabled={!resumeText || optimizing}
              className="w-full px-6 py-4 bg-amber-500 text-black rounded-full text-lg font-bold hover:bg-amber-400 transition flex items-center justify-center gap-2 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {optimizing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Optimize Resume
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {!result ? (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-12 border border-gray-700 text-center">
                <Zap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-gray-400">Upload your resume to get started</h3>
                <p className="text-sm text-gray-500">
                  Wells will analyze your resume for ATS compatibility, keywords, and impact
                </p>
              </div>
            ) : (
              <>
                {/* Score Card */}
                <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/20 rounded-xl p-6 border border-amber-700/30">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">ATS Score</h2>
                    <div className="text-5xl font-bold text-amber-500">{result.score}/100</div>
                  </div>

                  <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                    <div
                      className="bg-gradient-to-r from-amber-600 to-amber-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${result.score}%` }}
                    ></div>
                  </div>

                  <p className="text-sm text-gray-400">
                    {result.score >= 80 ? 'Excellent! Your resume is highly optimized.' :
                     result.score >= 60 ? 'Good, but there\'s room for improvement.' :
                     'Needs work. Follow the suggestions below.'}
                  </p>
                </div>

                {/* Issues */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Issues Found ({result.issues.length})
                  </h2>

                  <div className="space-y-3">
                    {result.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">{issue.category}</div>
                            <div className="text-sm mb-2">{issue.description}</div>
                            <div className="text-xs text-gray-400">
                              <span className="font-semibold">Fix:</span> {issue.fix}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improvements */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Suggested Improvements
                  </h2>

                  <div className="space-y-4">
                    {result.improvements.map((improvement, idx) => (
                      <div key={idx} className="border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-amber-500">{improvement.section}</span>
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                            {improvement.impact}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Before:</div>
                            <div className="text-sm text-gray-400 italic">{improvement.before}</div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 mb-1">After:</div>
                            <div className="text-sm text-white">{improvement.after}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing Keywords */}
                {result.keywords.length > 0 && (
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-bold mb-4">Missing Keywords</h2>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-semibold"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Add these keywords naturally throughout your resume to improve ATS matching
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button className="flex-1 px-6 py-3 bg-green-500 text-white rounded-full font-semibold hover:bg-green-400 transition flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Optimized
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-full font-semibold hover:bg-gray-600 transition flex items-center justify-center gap-2">
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Resume Optimization Tips
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2 text-amber-500">Use Action Verbs</h4>
              <p className="text-sm text-gray-400">Start bullet points with: Led, Built, Increased, Reduced, Implemented, Designed</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-amber-500">Quantify Everything</h4>
              <p className="text-sm text-gray-400">Add numbers: revenue impact, time saved, team size, users served, efficiency gains</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-amber-500">Keep It Simple</h4>
              <p className="text-sm text-gray-400">Avoid tables, graphics, headers/footers. Use standard fonts and single-column layout</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
