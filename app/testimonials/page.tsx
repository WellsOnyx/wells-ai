'use client'

import { useRouter } from 'next/navigation'
import { Star, Quote, TrendingUp, Users, Briefcase, ShoppingCart, CheckCircle, ArrowRight } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  avatar: string
  rating: number
  journey: 'seller' | 'buyer' | 'job_seeker' | 'founder'
  quote: string
  results: {
    metric: string
    value: string
  }[]
  featured: boolean
}

export default function TestimonialsPage() {
  const router = useRouter()

  const testimonials: Testimonial[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      role: 'VP of Sales',
      company: 'TechFlow Solutions',
      avatar: '👩‍💼',
      rating: 5,
      journey: 'seller',
      quote: 'Wells transformed our outbound sales process. What used to take our team 40 hours a week now runs on autopilot. We\'re booking 3x more meetings with higher quality prospects.',
      results: [
        { metric: 'Meetings Booked', value: '+312%' },
        { metric: 'Time Saved', value: '40 hrs/week' },
        { metric: 'Reply Rate', value: '18%' }
      ],
      featured: true
    },
    {
      id: '2',
      name: 'Marcus Rodriguez',
      role: 'Procurement Director',
      company: 'BuildRight Construction',
      avatar: '👨‍💼',
      rating: 5,
      journey: 'buyer',
      quote: 'The RFQ automation is incredible. Wells found us suppliers we never knew existed and saved us $120K on our last project. The quote comparison feature alone is worth the subscription.',
      results: [
        { metric: 'Cost Savings', value: '$120K' },
        { metric: 'Suppliers Found', value: '47' },
        { metric: 'Time to Quote', value: '-85%' }
      ],
      featured: true
    },
    {
      id: '3',
      name: 'Emily Watson',
      role: 'Senior Software Engineer',
      company: 'Hired at Series B Startup',
      avatar: '👩‍💻',
      rating: 5,
      journey: 'job_seeker',
      quote: 'I was applying to jobs for 6 months with no luck. Wells optimized my resume, found perfect-fit roles, and even helped me prep for interviews. Got 3 offers in 2 weeks!',
      results: [
        { metric: 'Offers Received', value: '3' },
        { metric: 'Time to Offer', value: '2 weeks' },
        { metric: 'Salary Increase', value: '+42%' }
      ],
      featured: true
    },
    {
      id: '4',
      name: 'James Park',
      role: 'Founder & CEO',
      company: 'DataSync AI',
      avatar: '👨‍🚀',
      rating: 5,
      journey: 'founder',
      quote: 'As a solo founder, Wells is like having a full GTM team. It handles sales, procurement, and hiring while I focus on product. Already at $30K MRR and I haven\'t hired anyone yet.',
      results: [
        { metric: 'MRR', value: '$30K' },
        { metric: 'Team Size', value: '1 (just me)' },
        { metric: 'Hours Saved', value: '60/week' }
      ],
      featured: true
    },
    {
      id: '5',
      name: 'Lisa Thompson',
      role: 'Head of Revenue',
      company: 'CloudScale Inc',
      avatar: '👩‍💼',
      rating: 5,
      journey: 'seller',
      quote: 'The AI personalization is insane. Every email feels hand-written, and prospects actually respond. Our reply rate went from 3% to 22%. Wells paid for itself in the first week.',
      results: [
        { metric: 'Reply Rate', value: '22%' },
        { metric: 'Deals Closed', value: '+156%' },
        { metric: 'ROI', value: '840%' }
      ],
      featured: false
    },
    {
      id: '6',
      name: 'David Kim',
      role: 'Operations Manager',
      company: 'UrbanBuild Co',
      avatar: '👨‍💼',
      rating: 5,
      journey: 'buyer',
      quote: 'We needed 10,000 custom parts fast. Wells found 15 suppliers, negotiated pricing, and had quotes back in 6 hours. Would\'ve taken us weeks manually.',
      results: [
        { metric: 'Quotes Received', value: '15' },
        { metric: 'Time Saved', value: '95%' },
        { metric: 'Best Price', value: '$2.40/unit' }
      ],
      featured: false
    },
    {
      id: '7',
      name: 'Rachel Green',
      role: 'Product Manager',
      company: 'Now at Google',
      avatar: '👩‍💼',
      rating: 5,
      journey: 'job_seeker',
      quote: 'The resume optimizer is a game-changer. Wells showed me exactly what ATS systems look for and rewrote my bullets with quantifiable impact. Went from 2% to 45% interview rate.',
      results: [
        { metric: 'Interview Rate', value: '45%' },
        { metric: 'Applications', value: '87' },
        { metric: 'Final Offers', value: '6' }
      ],
      featured: false
    },
    {
      id: '8',
      name: 'Alex Rivera',
      role: 'Founder',
      company: 'HealthTech Startup',
      avatar: '👨‍⚕️',
      rating: 5,
      journey: 'founder',
      quote: 'Wells handles everything I hate: cold outreach, supplier negotiations, job postings. I just focus on building product and talking to customers. Best $1000/mo I spend.',
      results: [
        { metric: 'Customers', value: '47' },
        { metric: 'Pipeline', value: '$380K' },
        { metric: 'Time to First Sale', value: '11 days' }
      ],
      featured: false
    }
  ]

  const featuredTestimonials = testimonials.filter(t => t.featured)
  const otherTestimonials = testimonials.filter(t => !t.featured)

  const stats = [
    { label: 'Average Rating', value: '4.9/5', icon: Star },
    { label: 'Active Users', value: '2,847', icon: Users },
    { label: 'Total Savings', value: '$8.2M', icon: TrendingUp },
    { label: 'Success Rate', value: '94%', icon: CheckCircle }
  ]

  const getJourneyBadge = (journey: string) => {
    switch (journey) {
      case 'seller': return { label: 'Seller', color: 'bg-blue-500/20 text-blue-400', icon: Briefcase }
      case 'buyer': return { label: 'Buyer', color: 'bg-green-500/20 text-green-400', icon: ShoppingCart }
      case 'job_seeker': return { label: 'Job Seeker', color: 'bg-purple-500/20 text-purple-400', icon: Users }
      case 'founder': return { label: 'Founder', color: 'bg-amber-500/20 text-amber-400', icon: TrendingUp }
      default: return { label: 'User', color: 'bg-gray-500/20 text-gray-400', icon: Users }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">Loved by Thousands</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              See how Wells is transforming businesses and careers across industries
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 text-center"
              >
                <Icon className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-amber-500 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            )
          })}
        </div>

        {/* Featured Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Success Stories</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {featuredTestimonials.map((testimonial) => {
              const badge = getJourneyBadge(testimonial.journey)
              const BadgeIcon = badge.icon

              return (
                <div
                  key={testimonial.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700 hover:border-amber-500/50 transition"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{testimonial.avatar}</div>
                      <div>
                        <h3 className="text-lg font-bold">{testimonial.name}</h3>
                        <p className="text-sm text-gray-400">{testimonial.role}</p>
                        <p className="text-sm text-gray-500">{testimonial.company}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${badge.color}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>

                  {/* Quote */}
                  <div className="relative mb-6">
                    <Quote className="absolute -top-2 -left-2 w-8 h-8 text-amber-500/20" />
                    <p className="text-gray-300 leading-relaxed pl-6 italic">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Results */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-700">
                    {testimonial.results.map((result, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-2xl font-bold text-amber-500 mb-1">{result.value}</div>
                        <div className="text-xs text-gray-500">{result.metric}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Other Testimonials */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8">More Success Stories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {otherTestimonials.map((testimonial) => {
              const badge = getJourneyBadge(testimonial.journey)
              const BadgeIcon = badge.icon

              return (
                <div
                  key={testimonial.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-amber-500/50 transition"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl">{testimonial.avatar}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{testimonial.name}</h4>
                      <p className="text-xs text-gray-500">{testimonial.role}</p>
                    </div>
                  </div>

                  {/* Badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold mb-3 ${badge.color}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {badge.label}
                  </span>

                  {/* Rating */}
                  <div className="flex gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-500 text-amber-500" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-4">"{testimonial.quote}"</p>

                  {/* Top Result */}
                  <div className="pt-4 border-t border-gray-700 text-center">
                    <div className="text-xl font-bold text-amber-500">{testimonial.results[0].value}</div>
                    <div className="text-xs text-gray-500">{testimonial.results[0].metric}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/20 rounded-xl p-12 border border-amber-700/30 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Join Them?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Start your 14-day free trial and see why thousands trust Wells to run their operations
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/app')}
              className="px-8 py-4 bg-amber-500 text-black rounded-full text-lg font-bold hover:bg-amber-400 transition flex items-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="px-8 py-4 bg-gray-700 text-white rounded-full text-lg font-bold hover:bg-gray-600 transition"
            >
              View Pricing
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-6">No credit card required • Cancel anytime • 14-day money-back guarantee</p>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-6">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-600">
            <span className="text-2xl font-bold">Apollo</span>
            <span className="text-2xl font-bold">Instantly</span>
            <span className="text-2xl font-bold">Notion</span>
            <span className="text-2xl font-bold">Anthropic</span>
            <span className="text-2xl font-bold">Vercel</span>
          </div>
        </div>
      </div>
    </div>
  )
}
