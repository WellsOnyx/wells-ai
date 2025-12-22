'use client'

/**
 * Wells AI Blog - 7 Comprehensive Long-Form Articles
 *
 * White paper level thought leadership on AI-powered B2B matching,
 * executive search, procurement, and enterprise automation.
 */

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  FileText,
  Clock,
  ArrowRight,
  Search,
  TrendingUp,
  Shield,
  Zap,
  Building2,
  Globe,
  Code,
  BarChart3,
  Users,
  Target,
  Briefcase,
  Bot,
  Brain,
  Cpu,
  Network,
  Handshake,
  DollarSign,
  Rocket,
  Factory,
  ShoppingCart,
  Truck,
  HeartPulse,
  LineChart,
  Sparkles,
  MessageSquare,
  Database,
  Workflow,
  BookOpen,
  Filter
} from 'lucide-react'
import {
  GlassCard,
  BentoGrid,
  BentoItem,
  ShimmerButton,
  FloatingBadge,
  GlowOrb,
  NoiseOverlay,
  AnimatedText
} from '@/components/ui/modern'

// 7 Consolidated Long-Form Articles
export const wellsAiBlogPosts = [
  {
    slug: 'complete-guide-ai-b2b-matching',
    title: 'The Complete Guide to AI-Powered B2B Matching: From Keyword Search to Intelligent Discovery',
    excerpt: 'How modern AI transforms B2B matching through semantic understanding, vector embeddings, NLP, and continuous learning. A comprehensive technical and strategic deep-dive into the future of buyer-seller connections.',
    category: 'AI & Technology',
    readTime: '35 min',
    date: '2025-01-20',
    featured: true,
    icon: Brain,
    color: 'amber',
    topics: ['Semantic Search', 'Vector Embeddings', 'NLP', 'Machine Learning', 'LLMs', 'Continuous Learning']
  },
  {
    slug: 'ai-executive-search-leadership',
    title: 'AI Executive Search: Finding C-Suite Leadership in the Age of Automation',
    excerpt: 'Transform executive recruitment from a boutique, relationship-driven process to a data-driven, scalable operation. From CTO and CFO matching to bias reduction, compensation benchmarking, and the future of talent acquisition.',
    category: 'Executive Search',
    readTime: '32 min',
    date: '2025-01-18',
    featured: true,
    icon: Users,
    color: 'purple',
    topics: ['Executive Recruitment', 'CTO Search', 'CFO Matching', 'Talent Pipelines', 'Bias Reduction', 'Compensation Intelligence']
  },
  {
    slug: 'procurement-automation-rfq-to-contract',
    title: 'Procurement Automation: The Complete Journey from RFQ to Contract',
    excerpt: 'End-to-end guide to automating procurement with AI—from requirement capture and supplier matching to vendor risk assessment, spend analytics, contract lifecycle management, and supplier diversity programs.',
    category: 'Procurement',
    readTime: '38 min',
    date: '2025-01-15',
    featured: true,
    icon: FileText,
    color: 'blue',
    topics: ['RFQ Automation', 'Supplier Matching', 'Vendor Risk', 'Spend Analytics', 'Contract Lifecycle', 'Supplier Diversity']
  },
  {
    slug: 'ai-deal-making-negotiation-strategies',
    title: 'AI-Driven Deal Making: Negotiation Strategies, Contract Generation, and Closing at Scale',
    excerpt: 'How AI applies game theory and behavioral economics to B2B negotiations. From escrow automation and deal velocity optimization to LLM-powered contracts, multi-party coordination, and predictive deal scoring.',
    category: 'Deal-Making',
    readTime: '30 min',
    date: '2025-01-12',
    featured: true,
    icon: Handshake,
    color: 'green',
    topics: ['AI Negotiation', 'Escrow Automation', 'Deal Velocity', 'Contract Generation', 'Pricing Optimization', 'Deal Scoring']
  },
  {
    slug: 'enterprise-sales-intelligence-platform',
    title: 'Enterprise Sales Intelligence: Building the Complete Lead-to-Close Platform',
    excerpt: 'Comprehensive guide to AI-powered enterprise sales—from ICP definition and lead generation to intent signals, ABM, competitive intelligence, sales forecasting, and revenue operations automation.',
    category: 'Enterprise Sales',
    readTime: '34 min',
    date: '2025-01-10',
    featured: true,
    icon: Target,
    color: 'amber',
    topics: ['Lead Generation', 'ICP Definition', 'Intent Signals', 'ABM', 'Competitive Intel', 'Sales Forecasting']
  },
  {
    slug: 'industry-playbooks-ai-applications',
    title: 'Industry Playbooks: AI Applications Across Manufacturing, Healthcare, SaaS, and Beyond',
    excerpt: 'Sector-specific strategies for implementing AI in manufacturing procurement, SaaS sales, healthcare vendor management, construction, retail, logistics, education, and startup talent acquisition.',
    category: 'Industries',
    readTime: '36 min',
    date: '2025-01-08',
    featured: true,
    icon: Factory,
    color: 'blue',
    topics: ['Manufacturing', 'Healthcare', 'SaaS', 'Construction', 'Retail', 'Logistics', 'Education', 'Startups']
  },
  {
    slug: 'future-ai-enterprise-automation',
    title: 'The Future of AI in Enterprise: Autonomous Agents, Human-AI Collaboration, and What\'s Next',
    excerpt: 'Vision for the next decade of enterprise AI—from autonomous procurement and conversational commerce to skill-based organizations, AI ethics, network effects, and the evolving role of human judgment.',
    category: 'Future of Work',
    readTime: '28 min',
    date: '2025-01-05',
    featured: true,
    icon: Rocket,
    color: 'purple',
    topics: ['Autonomous Agents', 'Human-AI Collaboration', 'Conversational Commerce', 'AI Ethics', 'Network Effects', 'Predictions']
  }
]

const categories = ['All', 'AI & Technology', 'Executive Search', 'Procurement', 'Deal-Making', 'Enterprise Sales', 'Industries', 'Future of Work']

// Safe auth hook that doesn't throw when Clerk isn't configured
function useSafeAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__clerk_frontend_api) {
        setIsLoaded(true)
      } else {
        setIsLoaded(true)
        setIsSignedIn(false)
      }
    } catch {
      setIsLoaded(true)
      setIsSignedIn(false)
    }
  }, [])

  return { isSignedIn, isLoaded }
}

export default function WellsAIBlog() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useSafeAuth()

  const filteredPosts = wellsAiBlogPosts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <NoiseOverlay />

      {/* Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="amber" size="xl" position={{ top: '-200px', right: '20%' }} />
        <GlowOrb color="purple" size="lg" position={{ bottom: '30%', left: '-100px' }} animate={false} />
        <GlowOrb color="blue" size="md" position={{ top: '50%', right: '-50px' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <GlassCard hover={false} padding="none" className="rounded-none border-x-0 border-t-0">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    <AnimatedText text="WellsAI" gradient gradientColors="from-amber-400 to-amber-600" />
                  </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                  <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                    Home
                  </Link>
                  <Link href="/founder/chat" className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium">
                    Talk to Wells
                  </Link>

                  {isSignedIn ? (
                    <ShimmerButton variant="primary" size="sm" onClick={() => window.location.href = '/dashboard'}>
                      Dashboard
                    </ShimmerButton>
                  ) : (
                    <>
                      <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Sign In
                      </Link>
                      <ShimmerButton variant="primary" size="sm" onClick={() => window.location.href = '/founder/chat'}>
                        Get Started
                      </ShimmerButton>
                    </>
                  )}
                </nav>
              </div>
            </div>
          </GlassCard>
        </header>

        {/* Hero */}
        <section className="pt-32 pb-16 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <FloatingBadge color="amber">
                <BookOpen className="w-4 h-4" />
                Enterprise AI White Papers
              </FloatingBadge>
              <h1 className="text-4xl md:text-6xl font-bold mt-6 mb-4">
                <AnimatedText text="The Wells AI Blog" gradient gradientColors="from-amber-400 via-orange-400 to-red-400" className="text-4xl md:text-6xl font-bold" />
              </h1>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Comprehensive white papers covering the landscape of AI-powered B2B operations.
                Deep technical insights, strategic frameworks, and actionable implementation guides.
              </p>
              <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  In-Depth Articles
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Long-Form Reading
                </span>
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Expert Insights
                </span>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-12">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search articles or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Filter className="w-4 h-4 text-gray-500 mr-2" />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Articles Grid */}
        <section className="px-6 lg:px-8 pb-24">
          <div className="max-w-7xl mx-auto">
            {filteredPosts.length === 0 ? (
              <GlassCard className="text-center py-16">
                <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No articles found</h3>
                <p className="text-gray-400">Try adjusting your search or filter criteria.</p>
              </GlassCard>
            ) : (
              <div className="space-y-8">
                {filteredPosts.map((post, index) => (
                  <Link key={post.slug} href={`/wells-ai/blog/${post.slug}`}>
                    <GlassCard hover glow={post.color as any} className="group cursor-pointer">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Icon/Visual */}
                        <div className={`w-full lg:w-48 h-32 lg:h-auto rounded-xl bg-gradient-to-br from-${post.color}-500/20 to-${post.color}-600/10 flex items-center justify-center flex-shrink-0`}>
                          <post.icon className={`w-16 h-16 text-${post.color}-400`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${post.color}-500/20 text-${post.color}-400`}>
                              {post.category}
                            </span>
                            <span className="text-sm text-gray-500">{post.date}</span>
                            <span className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {post.readTime}
                            </span>
                          </div>

                          <h2 className="text-2xl lg:text-3xl font-bold mb-3 group-hover:text-amber-400 transition-colors">
                            {post.title}
                          </h2>

                          <p className="text-gray-400 mb-4 text-lg leading-relaxed">
                            {post.excerpt}
                          </p>

                          {/* Topics */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {post.topics.map((topic) => (
                              <span key={topic} className="px-3 py-1 rounded-lg text-xs bg-white/5 text-gray-400 border border-white/10">
                                {topic}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 text-amber-400 font-medium">
                            Read Full Article
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-8 pb-24">
          <div className="max-w-4xl mx-auto">
            <GlassCard glow="amber" className="text-center">
              <h3 className="text-2xl font-bold mb-4">Ready to Transform Your Business?</h3>
              <p className="text-gray-400 mb-6">
                See how Wells AI can automate your B2B operations—from procurement to talent to deal-making.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <ShimmerButton onClick={() => window.location.href = '/founder/chat'}>
                  Talk to Wells
                </ShimmerButton>
                <Link href="/demo">
                  <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                    Watch Demo
                  </button>
                </Link>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-lg font-semibold">WellsAI</span>
                </div>
                <p className="text-gray-400 text-sm">AI that turns conversations into outcomes.</p>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Journeys</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/founder/chat" className="hover:text-white transition-colors">Founder</Link></li>
                  <li><Link href="/buyer/chat" className="hover:text-white transition-colors">Buyer</Link></li>
                  <li><Link href="/suppliers/join" className="hover:text-white transition-colors">Seller</Link></li>
                  <li><Link href="/jobs/chat" className="hover:text-white transition-colors">Jobs</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Resources</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/wells-ai/blog" className="text-amber-400 hover:text-amber-300 transition-colors">Blog</Link></li>
                  <li><Link href="/demo" className="hover:text-white transition-colors">Demo</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-sm">Company</h4>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li><Link href="/grain-vault" className="text-green-400 hover:text-green-300 transition-colors">Grain & Vault</Link></li>
                  <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 text-center text-sm text-gray-500">
              <p>2025 WellsAI. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
