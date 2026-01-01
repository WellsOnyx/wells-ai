'use client'

/**
 * Testimonials - Social Proof Section
 * Glassmorphic design with animated entrance on scroll
 * Features realistic B2B testimonials, stats bar, and trusted-by logos
 */

import { useEffect, useRef, useState } from 'react'
import { Quote, Star, TrendingUp, Clock, Users, Building2 } from 'lucide-react'

interface Testimonial {
  quote: string
  author: string
  role: string
  company: string
  companyInitials: string
  metric: string
  metricLabel: string
  gradient: string
}

const testimonials: Testimonial[] = [
  {
    quote: "We used to spend 3 weeks sourcing vendors for each project. Wells AI matched us with qualified suppliers in under 2 hours. Our procurement cycle dropped from 45 days to 12.",
    author: "Sarah Chen",
    role: "Director of Procurement",
    company: "Meridian Manufacturing",
    companyInitials: "MM",
    metric: "73%",
    metricLabel: "faster sourcing",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    quote: "As a small manufacturer, we struggled to get visibility with enterprise buyers. Within 60 days on Wells AI, we closed 4 new accounts worth $340K in annual contracts.",
    author: "Marcus Rodriguez",
    role: "Founder & CEO",
    company: "Precision Components LLC",
    companyInitials: "PC",
    metric: "$340K",
    metricLabel: "new contracts",
    gradient: "from-emerald-500 to-green-500"
  },
  {
    quote: "The AI negotiation feature changed our sales game. It handles initial back-and-forth, qualifies buyers automatically, and only loops me in when it's time to close. My deal velocity tripled.",
    author: "James Okonkwo",
    role: "VP of Sales",
    company: "Atlas Industrial Supply",
    companyInitials: "AI",
    metric: "3x",
    metricLabel: "deal velocity",
    gradient: "from-violet-500 to-purple-500"
  },
  {
    quote: "I was skeptical about AI handling supplier negotiations, but the results speak for themselves. It understood our specs, found competitive options, and negotiated terms better than our junior buyers.",
    author: "Katherine Walsh",
    role: "Chief Procurement Officer",
    company: "Northwind Logistics",
    companyInitials: "NL",
    metric: "18%",
    metricLabel: "cost savings",
    gradient: "from-amber-500 to-orange-500"
  }
]

const stats = [
  { value: "$2.4M+", label: "Negotiated Value", icon: TrendingUp },
  { value: "47 sec", label: "Avg Deal Time", icon: Clock },
  { value: "1,200+", label: "Active Suppliers", icon: Users }
]

const trustedByCompanies = [
  { initials: "AC", name: "Apex Corp" },
  { initials: "TM", name: "TechMfg" },
  { initials: "GS", name: "Global Supply" },
  { initials: "IP", name: "Industrial Pro" },
  { initials: "NS", name: "NexSource" },
  { initials: "QM", name: "QuickMetal" }
]

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0f1a] dark:to-[#0d1220] overflow-hidden"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Header */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-full text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-5 shadow-sm">
            <span className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </span>
            Trusted by industry leaders
          </div>
          <h2 className="font-playfair text-[clamp(32px,4vw,48px)] font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
            Real Results from
            <br />
            <em className="bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 bg-clip-text text-transparent">
              Real Businesses
            </em>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            See how procurement teams, suppliers, and enterprise buyers are transforming
            their operations with Wells AI.
          </p>
        </div>

        {/* Stats Bar */}
        <div
          className={`mb-16 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="relative bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-lg dark:shadow-none">
            {/* Glassmorphic glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 dark:from-blue-500/10 dark:via-violet-500/10 dark:to-emerald-500/10 pointer-events-none" />

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center gap-4 ${
                    i < stats.length - 1 ? 'md:border-r border-gray-200 dark:border-white/10' : ''
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500/10 to-violet-500/10 dark:from-blue-500/20 dark:to-violet-500/20 rounded-xl flex items-center justify-center">
                    <stat.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Testimonial Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className={`transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <div className="group relative h-full bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-8 hover:border-gray-300 dark:hover:border-white/20 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black/20 transition-all duration-300">
                {/* Subtle gradient overlay on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${testimonial.gradient} opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-[0.08] transition-opacity duration-300 pointer-events-none`} />

                {/* Quote icon */}
                <div className={`absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br ${testimonial.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Quote className="w-5 h-5 text-white" />
                </div>

                <div className="relative">
                  {/* Quote text */}
                  <blockquote className="text-gray-700 dark:text-gray-300 text-[15px] leading-relaxed mb-6 pl-4 border-l-2 border-gray-200 dark:border-white/10">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author section */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Company logo placeholder */}
                      <div className={`w-12 h-12 bg-gradient-to-br ${testimonial.gradient} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                        {testimonial.companyInitials}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-sm">
                          {testimonial.author}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {testimonial.role}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {testimonial.company}
                        </div>
                      </div>
                    </div>

                    {/* Metric badge */}
                    <div className="text-right">
                      <div className={`text-xl font-bold bg-gradient-to-r ${testimonial.gradient} bg-clip-text text-transparent`}>
                        {testimonial.metric}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {testimonial.metricLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trusted By Section */}
        <div
          className={`transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Trusted by innovative companies
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {trustedByCompanies.map((company, i) => (
              <div
                key={i}
                className="group relative"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Logo placeholder box */}
                <div className="w-24 h-14 md:w-28 md:h-16 bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl flex items-center justify-center hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {company.initials}
                    </span>
                  </div>
                </div>
                {/* Tooltip */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {company.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div
          className={`mt-16 text-center transition-all duration-700 delay-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Join hundreds of companies already using Wells AI
          </p>
          <a
            href="/join"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Get Started Free
            <span className="text-lg">-&gt;</span>
          </a>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .font-playfair {
          font-family: 'Playfair Display', Georgia, serif;
        }
      `}</style>
    </section>
  )
}
