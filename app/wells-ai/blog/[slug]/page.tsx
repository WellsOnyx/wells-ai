'use client'

/**
 * Wells AI Blog Post - Individual Article Page
 *
 * Dynamic page for rendering white paper level blog content
 * with SEO optimization and professional formatting.
 */

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import {
  ArrowLeft,
  Clock,
  Calendar,
  Share2,
  BookOpen,
  TrendingUp,
  Shield,
  Zap,
  Building2,
  Globe,
  Code,
  BarChart3,
  Lock,
  Users,
  Target,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import {
  GlassCard,
  ShimmerButton,
  FloatingBadge,
  GlowOrb,
  NoiseOverlay,
  AnimatedText
} from '@/components/ui/modern'
import { wellsAiBlogContent } from '@/lib/blog/wells-ai-content'
import { wellsAiBlogPosts } from '../page'

export default function WellsAIBlogPost() {
  const params = useParams()
  const slug = params?.slug as string
  const { isSignedIn } = useAuth()

  const post = wellsAiBlogPosts.find(p => p.slug === slug)
  const content = wellsAiBlogContent[slug]

  if (!post || !content) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <GlassCard className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-gray-400 mb-6">The article you're looking for doesn't exist or has been moved.</p>
          <Link href="/wells-ai/blog">
            <ShimmerButton>
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </ShimmerButton>
          </Link>
        </GlassCard>
      </div>
    )
  }

  const Icon = post.icon

  // Get related posts
  const relatedPosts = wellsAiBlogPosts
    .filter(p => p.slug !== slug && (p.category === post.category || p.featured))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <NoiseOverlay />

      {/* Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GlowOrb color="amber" size="lg" position={{ top: '-150px', right: '30%' }} />
        <GlowOrb color="purple" size="md" position={{ bottom: '40%', left: '-80px' }} animate={false} />
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
                  <Link href="/wells-ai/blog" className="text-sm text-amber-400 font-medium">
                    Blog
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

        {/* Article */}
        <article className="pt-32 pb-24 px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Back Link */}
            <Link href="/wells-ai/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to all articles
            </Link>

            {/* Header */}
            <header className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-xl bg-${post.color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-7 h-7 text-${post.color}-400`} />
                </div>
                <div>
                  <FloatingBadge color={post.color as any}>
                    {post.category}
                  </FloatingBadge>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {post.title}
              </h1>

              <p className="text-xl text-gray-400 mb-8">
                {post.excerpt}
              </p>

              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {post.readTime} read
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <button className="flex items-center gap-2 hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </header>

            {/* Content */}
            <div className="prose prose-invert prose-lg max-w-none">
              {content.sections.map((section, i) => (
                <section key={i} className="mb-12">
                  {section.type === 'intro' && (
                    <div className="text-lg text-gray-300 leading-relaxed">
                      {section.content}
                    </div>
                  )}

                  {section.type === 'heading' && (
                    <h2 className="text-2xl md:text-3xl font-bold mt-16 mb-6 flex items-center gap-3">
                      {section.icon && <section.icon className={`w-7 h-7 text-${section.iconColor || 'amber'}-400`} />}
                      {section.content}
                    </h2>
                  )}

                  {section.type === 'subheading' && (
                    <h3 className="text-xl font-bold mt-10 mb-4 text-gray-200">
                      {section.content}
                    </h3>
                  )}

                  {section.type === 'paragraph' && (
                    <p className="text-gray-300 leading-relaxed mb-6">
                      {section.content}
                    </p>
                  )}

                  {section.type === 'list' && (
                    <ul className="space-y-3 mb-6">
                      {section.items?.map((item, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.type === 'callout' && (
                    <GlassCard glow={section.color as any} className="my-8">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg bg-${section.color || 'amber'}-500/20 flex items-center justify-center flex-shrink-0`}>
                          <Lightbulb className={`w-5 h-5 text-${section.color || 'amber'}-400`} />
                        </div>
                        <div>
                          {section.title && <h4 className="font-bold mb-2">{section.title}</h4>}
                          <p className="text-gray-300">{section.content}</p>
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {section.type === 'stats' && (
                    <div className="grid md:grid-cols-3 gap-4 my-8">
                      {section.stats?.map((stat, j) => (
                        <GlassCard key={j} className="text-center">
                          <div className={`text-3xl font-bold text-${stat.color || 'amber'}-400 mb-2`}>
                            {stat.value}
                          </div>
                          <div className="text-sm text-gray-400">{stat.label}</div>
                        </GlassCard>
                      ))}
                    </div>
                  )}

                  {section.type === 'quote' && (
                    <blockquote className="border-l-4 border-amber-500 pl-6 py-4 my-8 italic text-gray-300">
                      "{section.content}"
                      {section.author && (
                        <footer className="mt-2 text-sm text-gray-500 not-italic">
                          — {section.author}
                        </footer>
                      )}
                    </blockquote>
                  )}

                  {section.type === 'code' && (
                    <div className="relative my-8">
                      <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-purple-500/20 rounded-xl blur-sm" />
                      <div className="relative bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-sm text-gray-400">
                          {section.language || 'typescript'}
                        </div>
                        <pre className="p-6 overflow-x-auto">
                          <code className="text-sm text-gray-300">{section.content}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Conclusion CTA */}
            <div className="mt-16 pt-12 border-t border-white/10">
              <GlassCard glow="amber" className="text-center">
                <h3 className="text-2xl font-bold mb-4">Ready to Transform Your Business?</h3>
                <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                  Talk to Wells AI and see how we can help you find talent, source suppliers, and close deals faster.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <ShimmerButton size="lg" onClick={() => window.location.href = '/founder/chat'}>
                    Talk to Wells
                    <ArrowRight className="w-5 h-5" />
                  </ShimmerButton>
                  <ShimmerButton variant="secondary" size="lg" onClick={() => window.location.href = '/demo'}>
                    See Demo
                  </ShimmerButton>
                </div>
              </GlassCard>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="px-6 lg:px-8 pb-24 border-t border-white/10">
            <div className="max-w-7xl mx-auto pt-16">
              <h2 className="text-2xl font-bold mb-8">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link key={related.slug} href={`/wells-ai/blog/${related.slug}`}>
                    <GlassCard hover className="h-full group cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-lg bg-${related.color}-500/20 flex items-center justify-center`}>
                          <related.icon className={`w-5 h-5 text-${related.color}-400`} />
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400">
                          {related.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-2 group-hover:text-amber-400 transition-colors line-clamp-2">
                        {related.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {related.readTime}
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center text-sm text-gray-500">
            <p>2025 WellsAI. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
