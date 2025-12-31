'use client'

/**
 * Job Seeker Dashboard
 *
 * A comprehensive view of your career journey:
 * - Active opportunities and matches
 * - Interview pipeline
 * - Skills profile
 * - Salary insights
 * - Career progress
 *
 * "Commit to the LORD whatever you do, and he will establish your plans."
 * - Proverbs 16:3
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  TrendingUp,
  Calendar,
  MessageSquare,
  Target,
  DollarSign,
  Star,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Heart,
  Users,
  Building2,
  Sparkles,
  FileText,
  ArrowUpRight,
  BarChart3,
  Zap,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface Opportunity {
  id: string
  company: string
  role: string
  matchScore: number
  stage: 'new' | 'applied' | 'interviewing' | 'offer' | 'declined'
  salary: { min: number; max: number }
  location: string
  updatedAt: Date
  nextAction?: string
}

interface Interview {
  id: string
  company: string
  role: string
  type: 'phone' | 'video' | 'onsite' | 'technical'
  scheduledAt: Date
  prepStatus: 'not_started' | 'in_progress' | 'ready'
}

interface SkillHighlight {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  marketDemand: 'low' | 'medium' | 'high' | 'very_high'
  valueAdd: number // $ per year
}

interface CareerInsight {
  type: 'opportunity' | 'skill' | 'market' | 'encouragement'
  title: string
  description: string
  actionUrl?: string
  verse?: string
}

// ============================================================================
// SAMPLE DATA (would come from API in production)
// ============================================================================

const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    company: 'Fintech Startup',
    role: 'Senior Product Manager',
    matchScore: 94,
    stage: 'interviewing',
    salary: { min: 180000, max: 220000 },
    location: 'Remote',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    nextAction: 'Final interview tomorrow at 2pm'
  },
  {
    id: '2',
    company: 'Enterprise SaaS',
    role: 'Director of Product',
    matchScore: 87,
    stage: 'applied',
    salary: { min: 200000, max: 250000 },
    location: 'Hybrid - NYC',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    nextAction: 'Waiting for recruiter response'
  },
  {
    id: '3',
    company: 'AI Infrastructure',
    role: 'Product Lead',
    matchScore: 91,
    stage: 'new',
    salary: { min: 190000, max: 240000 },
    location: 'Remote',
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
    nextAction: 'Wells sent intro - awaiting response'
  }
]

const SAMPLE_INTERVIEWS: Interview[] = [
  {
    id: '1',
    company: 'Fintech Startup',
    role: 'Senior Product Manager',
    type: 'video',
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    prepStatus: 'in_progress'
  }
]

const SAMPLE_SKILLS: SkillHighlight[] = [
  { name: 'Product Strategy', level: 'expert', marketDemand: 'very_high', valueAdd: 35000 },
  { name: 'Roadmap Planning', level: 'expert', marketDemand: 'high', valueAdd: 25000 },
  { name: 'SQL & Analytics', level: 'advanced', marketDemand: 'high', valueAdd: 20000 },
  { name: 'AI/ML Products', level: 'intermediate', marketDemand: 'very_high', valueAdd: 40000 },
]

const SAMPLE_INSIGHTS: CareerInsight[] = [
  {
    type: 'opportunity',
    title: 'Hot market for your skills',
    description: 'Companies are actively hiring for your profile. This is your season to move.',
    verse: 'Ecclesiastes 3:1'
  },
  {
    type: 'encouragement',
    title: 'Stay the course',
    description: 'Your preparation is paying off. Trust the process.',
    verse: 'Hebrews 10:36'
  }
]

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StageTag({ stage }: { stage: Opportunity['stage'] }) {
  const config = {
    new: { label: 'New Match', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    applied: { label: 'Applied', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    interviewing: { label: 'Interviewing', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    offer: { label: 'Offer', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    declined: { label: 'Declined', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  }

  const { label, color } = config[stage]

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {label}
    </span>
  )
}

function MatchScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = score >= 90 ? '#10B981' : score >= 80 ? '#F59E0B' : '#6366F1'

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-white/10"
        />
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke={color}
          strokeWidth="3"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-white">{score}</span>
      </div>
    </div>
  )
}

function formatSalary(min: number, max: number): string {
  const formatNum = (n: number) => `$${(n / 1000).toFixed(0)}k`
  return `${formatNum(min)} - ${formatNum(max)}`
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JobsDashboardPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(SAMPLE_OPPORTUNITIES)
  const [interviews, setInterviews] = useState<Interview[]>(SAMPLE_INTERVIEWS)
  const [skills, setSkills] = useState<SkillHighlight[]>(SAMPLE_SKILLS)
  const [insights, setInsights] = useState<CareerInsight[]>(SAMPLE_INSIGHTS)
  const [isLoading, setIsLoading] = useState(false)

  // Calculate stats
  const activeOpportunities = opportunities.filter(o => o.stage !== 'declined').length
  const interviewingCount = opportunities.filter(o => o.stage === 'interviewing').length
  const avgMatchScore = Math.round(opportunities.reduce((sum, o) => sum + o.matchScore, 0) / opportunities.length)
  const potentialSalaryMax = Math.max(...opportunities.map(o => o.salary.max))
  const skillsValue = skills.reduce((sum, s) => sum + s.valueAdd, 0)

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.1),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Wells AI</h1>
                <p className="text-xs text-white/40">Career Dashboard</p>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/jobs/chat"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Talk to Wells</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeOpportunities}</p>
                <p className="text-sm text-white/40">Active Opportunities</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{interviewingCount}</p>
                <p className="text-sm text-white/40">In Interview Process</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{avgMatchScore}%</p>
                <p className="text-sm text-white/40">Avg Match Score</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">${(potentialSalaryMax / 1000).toFixed(0)}k</p>
                <p className="text-sm text-white/40">Top Opportunity</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Column - Opportunities */}
          <div className="lg:col-span-2 space-y-6">
            {/* Opportunities Section */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Active Opportunities</h2>
                </div>
                <Link
                  href="/jobs/chat"
                  className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  Find more <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start gap-4">
                      <MatchScoreRing score={opp.matchScore} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white truncate">{opp.role}</h3>
                          <StageTag stage={opp.stage} />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-white/50 mb-2">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {opp.company}
                          </span>
                          <span>{opp.location}</span>
                          <span className="text-emerald-400">{formatSalary(opp.salary.min, opp.salary.max)}</span>
                        </div>
                        {opp.nextAction && (
                          <p className="text-sm text-amber-400/80 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {opp.nextAction}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-white/30">{formatTimeAgo(opp.updatedAt)}</p>
                        <Link
                          href={`/jobs/opportunity/${opp.id}`}
                          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-2"
                        >
                          View <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Interviews */}
            {interviews.length > 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Upcoming Interviews</h2>
                  </div>
                </div>

                <div className="p-4">
                  {interviews.map((interview) => (
                    <div key={interview.id} className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{interview.company}</h3>
                          <p className="text-sm text-white/50">{interview.role} - {interview.type} interview</p>
                          <p className="text-sm text-amber-400 mt-1">
                            Tomorrow at {interview.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/jobs/prep/${interview.id}`}
                        className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors"
                      >
                        Prep with Wells
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Skills Profile */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Your Skills</h2>
                </div>
                <p className="text-sm text-emerald-400 mt-1">+${(skillsValue / 1000).toFixed(0)}k potential value</p>
              </div>

              <div className="p-4 space-y-3">
                {skills.map((skill, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{skill.name}</span>
                      {skill.marketDemand === 'very_high' && (
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      skill.level === 'expert' ? 'bg-purple-500/20 text-purple-300' :
                      skill.level === 'advanced' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {skill.level}
                    </span>
                  </div>
                ))}

                <Link
                  href="/jobs/chat"
                  className="block text-center text-sm text-purple-400 hover:text-purple-300 pt-2"
                >
                  Analyze more skills
                </Link>
              </div>
            </div>

            {/* Career Insights */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Insights</h2>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {insights.map((insight, i) => (
                  <div key={i} className={`p-3 rounded-xl ${
                    insight.type === 'encouragement' ? 'bg-pink-500/5 border border-pink-500/20' :
                    'bg-blue-500/5 border border-blue-500/20'
                  }`}>
                    <h4 className="text-sm font-medium text-white mb-1">{insight.title}</h4>
                    <p className="text-sm text-white/50">{insight.description}</p>
                    {insight.verse && (
                      <p className="text-xs text-white/30 mt-2 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-pink-400/50" />
                        {insight.verse}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/jobs/chat"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-white">Update resume</span>
                  <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60" />
                </Link>
                <Link
                  href="/jobs/chat"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-white">Negotiate salary</span>
                  <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60" />
                </Link>
                <Link
                  href="/jobs/chat"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <Target className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-white">Career planning</span>
                  <ChevronRight className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60" />
                </Link>
              </div>
            </div>

            {/* Faith Footer */}
            <div className="text-center py-4">
              <p className="text-xs text-white/30 flex items-center justify-center gap-1.5">
                <Heart className="w-3 h-3 text-pink-400/50" />
                <span className="italic">"Commit to the LORD whatever you do"</span>
              </p>
              <p className="text-xs text-white/20 mt-1">Proverbs 16:3</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
