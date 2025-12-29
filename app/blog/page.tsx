'use client'

/**
 * WellsAI Blog Listing Page
 * Blog posts about procurement, AI, and business
 */

import Link from 'next/link'
import { ArrowRight, Clock, User } from 'lucide-react'

const BLOG_POSTS = [
  {
    slug: 'future-of-procurement',
    title: 'The Future of Procurement is Conversational',
    excerpt: 'How AI agents are replacing traditional RFP processes and what it means for procurement teams.',
    category: 'Industry Trends',
    author: 'Jonah Manning',
    date: 'Dec 18, 2025',
    readTime: '5 min read',
    featured: true
  },
  {
    slug: 'ai-vs-traditional-sourcing',
    title: 'AI Sourcing vs Traditional: A Cost Comparison',
    excerpt: 'We analyzed 100 procurement cycles. Here\'s what we found about time and cost savings with AI.',
    category: 'Research',
    author: 'Wells AI',
    date: 'Dec 15, 2025',
    readTime: '8 min read',
    featured: true
  },
  {
    slug: 'escrow-protection-guide',
    title: 'Why Escrow Matters in B2B Transactions',
    excerpt: 'Understanding payment protection and how it eliminates risk from vendor relationships.',
    category: 'Guides',
    author: 'Jonah Manning',
    date: 'Dec 12, 2025',
    readTime: '4 min read',
    featured: false
  },
  {
    slug: 'supplier-discovery-tips',
    title: '7 Tips for Finding the Right Supplier',
    excerpt: 'Beyond price: what smart procurement teams look for when evaluating vendors.',
    category: 'Tips',
    author: 'Wells AI',
    date: 'Dec 10, 2025',
    readTime: '6 min read',
    featured: false
  },
  {
    slug: 'rfq-best-practices',
    title: 'RFQ Best Practices for 2026',
    excerpt: 'How to write RFQs that get quality responses from qualified suppliers.',
    category: 'Guides',
    author: 'Jonah Manning',
    date: 'Dec 8, 2025',
    readTime: '7 min read',
    featured: false
  },
  {
    slug: 'fractional-hiring-guide',
    title: 'The Complete Guide to Fractional Hiring',
    excerpt: 'When to hire fractional vs full-time, and how to find the right fractional executives.',
    category: 'Guides',
    author: 'Wells AI',
    date: 'Dec 5, 2025',
    readTime: '10 min read',
    featured: false
  }
]

export default function BlogPage() {
  const featuredPosts = BLOG_POSTS.filter(p => p.featured)
  const regularPosts = BLOG_POSTS.filter(p => !p.featured)

  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
        .font-playfair { font-family: 'Playfair Display', Georgia, serif; }
      `}</style>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 font-semibold text-[17px]">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Home
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="inline-flex px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full text-[11px] font-semibold text-white uppercase tracking-wider mb-5">
            Blog
          </div>
          <h1 className="font-playfair text-[clamp(40px,5vw,56px)] font-medium text-gray-900 mb-6 tracking-tight">
            Insights & Updates
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">
            Thoughts on procurement, AI, and the future of B2B commerce.
          </p>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {featuredPosts.map((post, i) => (
              <Link
                key={i}
                href={`/blog/${post.slug}`}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-[2/1] bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">W</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {post.category}
                    </span>
                    <span className="text-sm text-gray-400">{post.date}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User className="w-4 h-4" />
                      {post.author}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {post.readTime}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All Posts */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">All Articles</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post, i) => (
              <Link
                key={i}
                href={`/blog/${post.slug}`}
                className="group bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {post.category}
                  </span>
                  <span className="text-sm text-gray-400">{post.date}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  Read more
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="bg-gray-900 rounded-3xl p-12 text-center">
            <h2 className="text-3xl font-medium text-white mb-4">
              Stay Updated
            </h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Get the latest insights on AI, procurement, and business delivered to your inbox.
            </p>
            <form className="flex items-center gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-5 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3.5 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-all"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-gray-900 font-semibold text-[17px] mb-4">
            <div className="w-7 h-7 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[7px] flex items-center justify-center text-white text-[13px] font-bold">
              W
            </div>
            WellsAI
          </Link>
          <p className="text-sm text-gray-500">
            © 2025 WellsAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
