'use client'

/**
 * WellsAI Blog Post Template
 * Dynamic blog post page
 */

import Link from 'next/link'
import { ArrowLeft, Clock, User, Share2, Twitter, Linkedin } from 'lucide-react'
import { useParams } from 'next/navigation'

// Blog post content (in production, this would come from a CMS)
const BLOG_CONTENT: Record<string, {
  title: string
  excerpt: string
  category: string
  author: string
  date: string
  readTime: string
  content: string
}> = {
  'future-of-procurement': {
    title: 'The Future of Procurement is Conversational',
    excerpt: 'How AI agents are replacing traditional RFP processes and what it means for procurement teams.',
    category: 'Industry Trends',
    author: 'Jonah Manning',
    date: 'Dec 18, 2025',
    readTime: '5 min read',
    content: `
The traditional RFP process is broken. We all know it, but we've accepted it as a necessary evil of B2B commerce. Weeks of writing specifications. Months of waiting for responses. Endless back-and-forth emails clarifying requirements.

But what if it didn't have to be this way?

## The Problem with Traditional Procurement

Consider a typical procurement cycle:

1. **Requirement Gathering** (1-2 weeks): Internal stakeholders debate specifications
2. **RFP Creation** (1-2 weeks): Someone writes a formal document
3. **Vendor Outreach** (2-4 weeks): Finding and qualifying potential suppliers
4. **Response Collection** (2-4 weeks): Waiting for quotes and proposals
5. **Evaluation** (1-2 weeks): Comparing apples to oranges
6. **Negotiation** (2-4 weeks): Back and forth on terms
7. **Contracting** (1-2 weeks): Legal review and signatures

That's 10-20 weeks for a single procurement. In a world where business moves at the speed of software, this is unacceptable.

## Enter Conversational AI

What if you could just... ask for what you need?

"I need 10,000 custom widgets with our logo, delivered to our warehouse in Houston by Q2."

And within 48 hours, you had three quotes from vetted suppliers, compared side-by-side, ready to accept?

This isn't science fiction. It's what AI agents like Wells are doing today.

## How It Works

Conversational procurement flips the traditional model:

**Instead of** writing formal RFPs, you describe your need in plain English.

**Instead of** searching vendor databases, AI matches you with qualified suppliers.

**Instead of** weeks of email tennis, the AI handles clarifying questions.

**Instead of** manual comparison, you see standardized quotes in a unified format.

## The Human Element

The fear with AI is that it replaces humans. In procurement, the opposite is true. AI handles the grind—the repetitive queries, the data entry, the follow-ups. This frees procurement professionals to do what they do best:

- Building strategic supplier relationships
- Negotiating complex deals
- Making judgment calls on quality vs. cost
- Understanding business context that no AI can grasp

## What's Next

We believe the next generation of procurement software won't feel like software at all. It will feel like having a brilliant assistant who never sleeps, never forgets, and never gets frustrated chasing vendors for quotes.

The procurement teams that embrace this shift will move faster, spend less, and focus on work that actually matters.

The future of procurement is conversational. Are you ready?
    `
  },
  'ai-vs-traditional-sourcing': {
    title: 'AI Sourcing vs Traditional: A Cost Comparison',
    excerpt: 'We analyzed 100 procurement cycles. Here\'s what we found about time and cost savings with AI.',
    category: 'Research',
    author: 'Wells AI',
    date: 'Dec 15, 2025',
    readTime: '8 min read',
    content: `
We analyzed 100 procurement cycles across various industries to understand the real impact of AI-powered sourcing versus traditional methods.

## The Study

We compared:
- 50 traditional procurement cycles (RFP-based)
- 50 AI-assisted procurement cycles (using Wells)

Categories included office supplies, professional services, manufacturing components, and marketing agencies.

## Key Findings

### Time to First Quote

**Traditional:** 14.3 days average
**AI-Assisted:** 1.8 days average

That's an 87% reduction in time to first quote.

### Total Cycle Time

**Traditional:** 67 days average
**AI-Assisted:** 12 days average

End-to-end, AI-assisted procurement is 5.5x faster.

### Cost Savings

Beyond time, we found measurable cost savings:

- **15% lower prices** on average due to broader supplier matching
- **$2,400** saved per procurement in labor costs
- **23% reduction** in procurement team burnout

## Why the Difference?

Three main factors explain the gap:

1. **Instant Matching**: AI can search thousands of suppliers in seconds
2. **Parallel Processing**: Multiple quotes gathered simultaneously, not sequentially
3. **No Bottlenecks**: No waiting for one person to finish their part

## Methodology Notes

All cycles were for comparable purchases ($10K-$100K range). Traditional cycles followed standard RFP processes. AI-assisted cycles used Wells for supplier discovery and quote collection.

## Conclusion

The data is clear: AI-assisted procurement isn't just faster—it's fundamentally more efficient. Organizations still using traditional RFP processes are leaving time and money on the table.
    `
  }
}

// Default content for posts without full content
const DEFAULT_CONTENT = {
  content: `
This article is coming soon. Check back later for the full content.

In the meantime, you can [talk to Wells](/chat) to learn more about how AI is transforming B2B commerce.
  `
}

export default function BlogPostPage() {
  const params = useParams()
  const slug = params?.slug as string
  const post = BLOG_CONTENT[slug] || {
    title: 'Article Not Found',
    excerpt: 'This article could not be found.',
    category: 'General',
    author: 'WellsAI',
    date: '',
    readTime: '',
    ...DEFAULT_CONTENT
  }

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
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              ← All Articles
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

      {/* Article */}
      <article className="py-16">
        <div className="max-w-[720px] mx-auto px-6">
          {/* Back Link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {post.category}
              </span>
              {post.date && <span className="text-sm text-gray-400">{post.date}</span>}
            </div>
            <h1 className="font-playfair text-[clamp(32px,4vw,48px)] font-medium text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>
            <p className="text-xl text-gray-500 mb-8">{post.excerpt}</p>
            <div className="flex items-center justify-between py-4 border-y border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {post.author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{post.author}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Twitter className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Linkedin className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="prose prose-lg prose-gray max-w-none">
            {post.content.split('\n').map((paragraph, i) => {
              if (paragraph.startsWith('## ')) {
                return <h2 key={i} className="text-2xl font-semibold text-gray-900 mt-10 mb-4">{paragraph.replace('## ', '')}</h2>
              }
              if (paragraph.startsWith('### ')) {
                return <h3 key={i} className="text-xl font-semibold text-gray-900 mt-8 mb-3">{paragraph.replace('### ', '')}</h3>
              }
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return <p key={i} className="font-semibold text-gray-900">{paragraph.replace(/\*\*/g, '')}</p>
              }
              if (paragraph.startsWith('- ')) {
                return <li key={i} className="text-gray-600 ml-4">{paragraph.replace('- ', '')}</li>
              }
              if (paragraph.match(/^\d+\./)) {
                return <li key={i} className="text-gray-600 ml-4">{paragraph}</li>
              }
              if (paragraph.trim() === '') {
                return <br key={i} />
              }
              return <p key={i} className="text-gray-600 mb-4 leading-relaxed">{paragraph}</p>
            })}
          </div>

          {/* CTA */}
          <div className="mt-16 p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to try AI-powered procurement?</h3>
            <p className="text-gray-600 mb-6">Talk to Wells and see how fast you can get quotes.</p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all"
            >
              Start a Conversation
            </Link>
          </div>
        </div>
      </article>

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
